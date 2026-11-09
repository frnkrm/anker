"""Pinned TLS/WSS LAN endpoint. Pairing is physical and effects follow durable receipts."""
from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import ipaddress
import json
import os
from pathlib import Path
import secrets
import socket
import ssl
import tempfile
import time
from typing import Any
import uuid

from aiohttp import WSMsgType, web
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

from .engine import CompanionEngine
from .protocol import MAX_BYTES, ProtocolError, b64, canonical, derive_keys, integer, obj, open_envelope, pair_proof, pairing_code, public_bytes, public_key, seal, stamp, text, unb64, utc, validate_payload, verify_emergency
from .storage import AtomicStateStore


def local_addresses() -> list[str]:
    result = []
    try:
        for _, _, _, _, address in socket.getaddrinfo(socket.gethostname(), None, type=socket.SOCK_STREAM):
            value = address[0].split("%", 1)[0]
            if allowed_address(value) and value not in result:
                result.append(value)
    except OSError:
        pass
    return result


def allowed_address(value: str, loopback: bool = False) -> bool:
    try:
        address = ipaddress.ip_address(value)
        if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
            address = address.ipv4_mapped
        if loopback and address.is_loopback:
            return True
        networks = ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16") if address.version == 4 else ("fc00::/7", "fe80::/10")
        return any(address in ipaddress.ip_network(network) for network in networks)
    except ValueError:
        return False


def tls_context(store: AtomicStateStore, directory: Path) -> tuple[ssl.SSLContext, str, bytes]:
    data = store.read()
    if not data["tls"]:
        private = ec.generate_private_key(ec.SECP256R1())
        subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Anker PC-Begleiter")])
        now = datetime.now(timezone.utc)
        certificate = (x509.CertificateBuilder().subject_name(subject).issuer_name(subject)
                       .public_key(private.public_key()).serial_number(x509.random_serial_number())
                       .not_valid_before(now - timedelta(days=1)).not_valid_after(now + timedelta(days=3650))
                       .add_extension(x509.SubjectAlternativeName([x509.DNSName("localhost")]), critical=False)
                       .sign(private, hashes.SHA256()))
        value = {"cert": certificate.public_bytes(serialization.Encoding.PEM).decode(),
                 "key": b64(private.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))}
        store.update(lambda state: state.update(tls=value))
        data = store.read()
    identity = data["tls"]
    cert_bytes = identity["cert"].encode()
    certificate = x509.load_pem_x509_certificate(cert_bytes)
    der = certificate.public_bytes(serialization.Encoding.DER)
    pin = hashlib.sha256(der).hexdigest()
    directory.mkdir(parents=True, exist_ok=True)
    # SSLContext only accepts file paths. Decrypted keys exist in a private temporary
    # file only while OpenSSL loads them and are deleted immediately afterwards.
    for abandoned in directory.glob(".anker-tls-key-*.pem"):
        abandoned.unlink(missing_ok=True)
    cert_path = directory / "pc-certificate.pem"
    cert_path.write_bytes(cert_bytes)  # Public material, not a private key.
    descriptor, temp_name = tempfile.mkstemp(prefix=".anker-tls-key-", suffix=".pem", dir=directory)
    key_path = Path(temp_name)
    try:
        os.chmod(key_path, 0o600)
        with os.fdopen(descriptor, "wb") as output:
            output.write(unb64(identity["key"]))
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.load_cert_chain(cert_path, key_path)
    finally:
        key_path.unlink(missing_ok=True)
    return context, pin, der


class PairingManager:
    def __init__(self, store: AtomicStateStore, pc_name: str, pin: str, addresses: list[str], clock=time.time):
        self.store, self.pc_name, self.pin, self.addresses, self.clock = store, pc_name, pin, addresses, clock
        self.drafts: dict[str, dict[str, Any]] = {}

    def create(self) -> dict[str, Any]:
        if self.store.read()["pairs"]:
            raise ProtocolError("already-paired")
        now = self.clock()
        self.drafts = {key: item for key, item in self.drafts.items() if item["expires"] > now}
        private = ec.generate_private_key(ec.SECP256R1())
        identifier, secret = str(uuid.uuid4()), os.urandom(32)
        public = b64(public_bytes(private.public_key()))
        value = {"t": "anker-pc-pair", "v": 3, "id": identifier, "n": self.pc_name,
                 "k": public, "c": self.pin, "s": b64(secret), "a": self.addresses, "e": utc(now + 600)}
        self.drafts[identifier] = {"private": private, "secret": secret, "public": public,
                                   "expires": now + 600, "status": "open", "request": None}
        return {"qr": "anker-pc-pair:v3:" + b64(canonical(value)), "data": value}

    def request(self, value: Any) -> dict[str, Any]:
        value = obj(value, {"id", "n", "k", "signingKey", "proof"})
        identifier = text(value["id"], 128)
        draft = self.drafts.get(identifier)
        if not draft or draft["expires"] <= self.clock():
            raise ProtocolError("pair-expired")
        if draft["status"] in {"paired", "rejected"}:
            raise ProtocolError("pair-used")
        text(value["n"], 100); public_key(value["k"]); public_key(value["signingKey"])
        expected = pair_proof(draft["secret"], identifier, value["k"], value["signingKey"])
        if not isinstance(value["proof"], str) or not hmac.compare_digest(expected, value["proof"]):
            raise ProtocolError("pair-proof")
        if draft["request"] and draft["request"] != value:
            raise ProtocolError("pair-bound")
        draft["request"] = dict(value)
        draft["status"] = "pending"
        draft["code"] = pairing_code(unb64(draft["public"], 65), unb64(value["k"], 65))
        return {"status": "pending", "id": identifier, "code": draft["code"]}

    def approve(self, identifier: str) -> None:
        draft = self.drafts.get(identifier)
        if not draft or draft["expires"] <= self.clock() or draft["status"] != "pending":
            raise ProtocolError("pair-expired")
        if self.store.read()["pairs"]:
            raise ProtocolError("already-paired")
        request = draft["request"]
        incoming, outgoing = derive_keys(draft["private"], request["k"], draft["secret"])
        pair = {"name": request["n"], "phoneToPc": b64(incoming), "pcToPhone": b64(outgoing), "signingKey": request["signingKey"], "sendSeq": 0, "receiveSeq": 0, "pairedAt": utc(self.clock())}
        self.store.update(lambda state: state["pairs"].update({identifier: pair}))
        draft["status"] = "paired"
        draft.pop("private", None); draft.pop("secret", None); draft.pop("request", None)

    def reject(self, identifier: str) -> None:
        draft = self.drafts.get(identifier)
        if draft:
            draft["status"] = "rejected"
            draft.pop("private", None); draft.pop("secret", None); draft.pop("request", None)

    def status(self, identifier: str) -> dict[str, str]:
        draft = self.drafts.get(identifier)
        if not draft or draft["expires"] <= self.clock():
            return {"status": "expired", "id": identifier}
        return {"status": draft["status"], "id": identifier}


class BridgeServer:
    def __init__(self, store: AtomicStateStore, engine: CompanionEngine, pairing: PairingManager, ui: Any = None, clock=time.time, allow_loopback=False):
        self.store, self.engine, self.pairing, self.ui, self.clock = store, engine, pairing, ui, clock
        self.allow_loopback = allow_loopback
        self.sockets: set[web.WebSocketResponse] = set()
        self.app = web.Application(client_max_size=MAX_BYTES, middlewares=[self._guard])
        self.app.add_routes([web.get("/health", self.hello), web.get("/v3/hello", self.hello),
                             web.post("/v3/pair", self.pair), web.get("/v3/pair/{id}", self.pair_status),
                             web.post("/v3/link", self.link), web.get("/v3/ws", self.websocket)])

    @web.middleware
    async def _guard(self, request: web.Request, handler):
        if not allowed_address(request.remote or "", self.allow_loopback):
            return web.json_response({"error": "local-network-only"}, status=403)
        if request.headers.get("Origin") and request.path not in {"/health", "/v3/hello"}:
            return web.json_response({"error": "native-client-required"}, status=403)
        try:
            response = await handler(request)
        except ProtocolError as error:
            response = web.json_response({"error": str(error)}, status=400)
        except web.HTTPRequestEntityTooLarge:
            response = web.json_response({"error": "too-large"}, status=413)
        except (json.JSONDecodeError, UnicodeError, TypeError, ValueError):
            response = web.json_response({"error": "schema"}, status=400)
        except Exception:
            response = web.json_response({"error": "temporary-failure"}, status=503)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    async def hello(self, request: web.Request) -> web.Response:
        return web.json_response({"version": "0.1.0", "protocol": 3, "name": self.pairing.pc_name,
                                  "pairingOpen": any(item["expires"] > self.clock() and item["status"] == "open" for item in self.pairing.drafts.values())})

    async def pair(self, request: web.Request) -> web.Response:
        value = await request.json()
        result = self.pairing.request(value)
        if self.ui:
            self.ui.ask_pair({**result, "n": value["n"]})
        return web.json_response(result)

    async def pair_status(self, request: web.Request) -> web.Response:
        return web.json_response(self.pairing.status(request.match_info["id"]))

    async def link(self, request: web.Request) -> web.Response:
        raw = await request.read()
        return web.json_response(self.exchange(raw))

    async def websocket(self, request: web.Request) -> web.WebSocketResponse:
        identifier = request.query.get("pair", "")
        if identifier not in self.store.read()["pairs"]:
            raise ProtocolError("pairing-required")
        socket_ = web.WebSocketResponse(max_msg_size=MAX_BYTES, heartbeat=10, receive_timeout=30, autoping=False)
        await socket_.prepare(request)
        self.sockets.add(socket_)
        authenticated = False
        try:
            async for message in socket_:
                if message.type == WSMsgType.TEXT:
                    try:
                        reply = self.exchange(message.data, expected_pair=identifier)
                        authenticated = True
                        await socket_.send_json(reply)
                    except ProtocolError:
                        await socket_.close(code=1008, message=b"message-rejected")
                        break
                    except Exception:
                        await socket_.close(code=1011, message=b"temporary-failure")
                        break
                elif message.type in {WSMsgType.PING, WSMsgType.PONG}:
                    if message.type == WSMsgType.PING:
                        await socket_.pong(message.data)
                    if authenticated and identifier in self.store.read()["pairs"]:
                        self.engine.link_contact()
                elif message.type in {WSMsgType.BINARY, WSMsgType.ERROR}:
                    await socket_.close(code=1008, message=b"message-rejected")
                    break
        finally:
            self.sockets.discard(socket_)
        return socket_

    def exchange(self, raw: bytes | str, expected_pair: str | None = None) -> dict[str, Any]:
        if len(raw.encode() if isinstance(raw, str) else raw) > MAX_BYTES:
            raise ProtocolError("too-large")
        try:
            parsed = json.loads(raw)
        except (ValueError, TypeError) as error:
            raise ProtocolError("schema") from error
        identifier = parsed.get("pair") if isinstance(parsed, dict) else None
        if not isinstance(identifier, str) or expected_pair is not None and identifier != expected_pair:
            raise ProtocolError("identity")
        pair = self.store.read()["pairs"].get(identifier)
        if not pair:
            raise ProtocolError("pairing-required")
        envelope, payload = open_envelope(raw, identifier, "phone", pair["receiveSeq"], unb64(pair["phoneToPc"], 32))
        validate_payload(payload)
        now = self.clock()
        with self.store.transaction():
            self.store.accept_receive(identifier, envelope["seq"])
            self.engine.link_contact(now, force=True)
            response = self._apply(payload, identifier, stamp(envelope["sentAt"]), now)
        # An unpair acknowledgement is encrypted before the now-unused key is erased.
        if payload.get("action") == "unpair":
            seq = self.store.next_send(identifier)
            reply = seal(identifier, "pc", seq, response, unb64(pair["pcToPhone"], 32), now)
            self.unpair()
            return reply
        seq = self.store.next_send(identifier)
        return seal(identifier, "pc", seq, response, unb64(pair["pcToPhone"], 32), now)

    def _apply(self, payload: dict[str, Any], identifier: str, sent_at: float, now: float) -> dict[str, Any]:
        kind = payload["type"]
        if kind == "state":
            return self.engine.accept_state(payload, identifier, sent_at, now)
        if kind == "briefing":
            return self.engine.accept_briefing(payload, now, sent_at)
        if kind == "pull":
            data = self.store.read()
            items = []
            for item in (entry for entry in data["outbox"] if entry["seq"] > payload["after"]):
                candidate = {"type": "events", "items": [*items, item], "lastSeq": item["seq"]}
                # Leave space for base64 expansion, GCM tag and envelope metadata.
                if len(items) >= 100 or len(canonical(candidate)) > 46 * 1024:
                    break
                items.append(item)
            return {"type": "events", "items": items, "lastSeq": items[-1]["seq"] if items else max(payload["after"], data["eventSeq"])}
        data = self.store.read()
        command_hash = hashlib.sha256(canonical(payload)).hexdigest()
        previous = data.get("commandResults", {}).get(payload["id"])
        if previous and previous["hash"] != command_hash:
            raise ProtocolError("command-id-reused")
        receipt = dict(previous or {"hash": command_hash})
        if payload["id"] not in data["commandIds"]:
            action = payload["action"]
            if action == "extend":
                self.engine.extend(payload["minutes"], now)
            elif action == "suspend-today":
                self.engine.pause(now)
            elif action == "resume-today":
                self.engine.resume()
            elif action == "test-evening":
                self.engine.start_test()
            elif action == "EMERGENCY_EXTENSION":
                state = data.get("snapshot")
                if not state:
                    raise ProtocolError("no-schedule")
                runtime = data["runtime"]
                latch = self.engine.active_latch(data, now)
                grant_session = state["sessionId"]
                if latch:
                    if not self.engine.matches_night_session(data, latch, state, identifier, now, allow_original=True):
                        raise ProtocolError("token-identity")
                    # Verify the real phone signature against its current dated
                    # identity, but keep the original finite PC night as the grant.
                    state = deepcopy(state)
                    bounds = [stamp(state["validUntil"]), stamp(latch["validUntil"])]
                    if latch["morningDeadlineAt"] is not None:
                        bounds.append(stamp(latch["morningDeadlineAt"]))
                    state["validUntil"] = utc(min(bounds))
                    grant_session = latch["sessionId"]
                nonces = set(runtime.get("emergencyNonces", []))
                until = verify_emergency(payload["token"], identifier, data["pairs"][identifier]["signingKey"], state, nonces, now)
                nonces.add(payload["token"]["nonce"])
                self.store.update(lambda item: item["runtime"].update(emergencyUntil=until, emergencySessionId=grant_session, emergencyNonces=sorted(nonces)[-1000:], graceStartedAt=None, actedTarget=None))
                receipt["emergencyUntil"] = utc(until)
            def remember(item):
                item["commandIds"] = [*item["commandIds"], payload["id"]][-5000:]
                item.setdefault("commandResults", {})[payload["id"]] = receipt
                item["commandResults"] = {key: value for key, value in item["commandResults"].items() if key in item["commandIds"]}
            self.store.update(remember)
        revision = data["snapshot"]["revision"] if data.get("snapshot") else "none"
        result = self.engine.ack(revision, now)
        result["commandId"] = payload["id"]
        if "emergencyUntil" in receipt:
            result["emergencyUntil"] = receipt["emergencyUntil"]
        return result

    def unpair(self) -> None:
        def clear(data: dict[str, Any]) -> None:
            data.update(pairs={}, snapshot=None, briefing=None, outbox=[], notes=[], commandIds=[], commandResults={}, runtime={})
            data["localPrefs"].update(enforceEnabled=False, strictLock=False)
        self.store.update(clear)
        if self.engine.audio:
            self.engine.audio.restore()

    def ui_action(self, action: dict[str, Any]) -> None:
        kind = action.get("action")
        try:
            if kind == "pair":
                value = self.pairing.create()
                if self.ui:
                    self.ui.render({**self.engine.last_view, "pairingQr": value["qr"]})
            elif kind == "confirm_pair":
                self.pairing.approve(action["id"])
            elif kind == "reject_pair":
                self.pairing.reject(action["id"])
            elif kind == "unpair":
                self.unpair()
            elif kind == "extend":
                integer(action.get("minutes"), 1, 1440); self.engine.extend(action["minutes"])
            elif kind == "pause":
                self.engine.pause()
            elif kind == "resume":
                self.engine.resume()
            elif kind == "test":
                self.engine.start_test()
            elif kind in {"savepoint", "thought"}:
                with self.store.transaction():
                    self.engine.save_note(action.get("text", ""), action.get("nextStep", ""), "save-point" if kind == "savepoint" else "thought")
            elif kind == "settings":
                self.engine.local_settings(action.get("prefs", {}))
            elif kind == "remove_legacy":
                self.engine.platform.remove_legacy_task()
                self.engine._legacy_checked = float("-inf")
            else:
                return
            self.engine._message("Gespeichert")
            if self.ui:
                result = {"action": kind, "ok": True}
                if isinstance(action.get("requestId"), str):
                    result["requestId"] = action["requestId"]
                self.ui.render({**self.engine.last_view, "actionResult": result})
        except Exception:
            self.engine._message("Noch nicht übernommen. Bitte Einstellung und Verbindung prüfen.")
            if self.ui:
                result = {"action": kind, "ok": False}
                if isinstance(action.get("requestId"), str):
                    result["requestId"] = action["requestId"]
                self.ui.render({**self.engine.last_view, "actionResult": result})


class Discovery:
    def __init__(self, port: int, addresses: list[str], identity: str):
        self.port, self.addresses, self.identity = port, addresses, identity
        self.zeroconf = self.info = None

    def start(self) -> None:
        from zeroconf import ServiceInfo, Zeroconf
        ipv4 = [socket.inet_aton(address) for address in self.addresses if ":" not in address]
        if not ipv4:
            return
        self.zeroconf = Zeroconf()
        self.info = ServiceInfo("_anker._tcp.local.", f"Anker-{self.identity[:12]}._anker._tcp.local.", addresses=ipv4,
                                port=self.port, properties={"v": "3", "id": self.identity[:12]}, server=f"anker-{self.identity[:12]}.local.")
        self.zeroconf.register_service(self.info)

    def close(self) -> None:
        if self.zeroconf:
            if self.info:
                self.zeroconf.unregister_service(self.info)
            self.zeroconf.close()
