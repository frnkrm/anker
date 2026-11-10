"""Pinned TLS/WSS LAN endpoint. Pairing is physical and effects follow durable receipts."""
from __future__ import annotations

import asyncio
from copy import deepcopy
from dataclasses import dataclass, field
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

from . import __version__
from .engine import CompanionEngine
from .desktop_settings import DesktopSettingsError, delete_managed_files, desktop_patch, desktop_preferences
from .protocol import MAX_BYTES, ProtocolError, b64, canonical, derive_keys, integer, obj, open_envelope, pair_proof, pairing_code, plan_date, public_bytes, public_key, seal, stamp, text, unb64, utc, validate_payload, verify_emergency
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
        # Reopening pairing replaces, rather than silently retaining, old offers.
        for identifier in self.drafts:
            self.reject(identifier)
        self.drafts.clear()
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


@dataclass(eq=False)
class _WssSession:
    socket: web.WebSocketResponse
    pair: str
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    receive_seq: int = 0
    after: int = 0


@dataclass(eq=False)
class _SyncRequest:
    session: _WssSession
    future: asyncio.Future
    sent: bool = False
    after_receive_seq: int = 0


class BridgeServer:
    def __init__(self, store: AtomicStateStore, engine: CompanionEngine, pairing: PairingManager, ui: Any = None, clock=time.time, allow_loopback=False, sync_timeout=25.0, on_delete_data=None):
        self.store, self.engine, self.pairing, self.ui, self.clock = store, engine, pairing, ui, clock
        self.allow_loopback = allow_loopback
        self.sockets: set[web.WebSocketResponse] = set()
        self._sessions: dict[web.WebSocketResponse, _WssSession] = {}
        self._pending_sync: dict[str, _SyncRequest] = {}
        self._sync_tasks: set[asyncio.Task] = set()
        self.sync_timeout = sync_timeout
        self.on_delete_data = on_delete_data
        self._resetting = False
        self.app = web.Application(client_max_size=MAX_BYTES, middlewares=[self._guard])
        self.app.add_routes([web.get("/health", self.hello), web.get("/v3/hello", self.hello),
                             web.post("/v3/pair", self.pair), web.get("/v3/pair/{id}", self.pair_status),
                             web.post("/v3/link", self.link), web.get("/v3/ws", self.websocket)])
        self.app.on_shutdown.append(self._shutdown)

    async def _shutdown(self, _app) -> None:
        for pending in tuple(self._pending_sync.values()):
            if not pending.future.done():
                pending.future.set_result({"status": "offline"})
        await asyncio.gather(*(socket_.close(code=1001, message=b"server-stopped") for socket_ in tuple(self.sockets)), return_exceptions=True)
        if self._sync_tasks:
            await asyncio.gather(*tuple(self._sync_tasks), return_exceptions=True)

    @web.middleware
    async def _guard(self, request: web.Request, handler):
        if self._resetting:
            return web.json_response({"error": "restart-required"}, status=503)
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
        return web.json_response({"version": __version__, "protocol": 3, "name": self.pairing.pc_name,
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
        session = _WssSession(socket_, identifier)
        try:
            async for message in socket_:
                if message.type == WSMsgType.TEXT:
                    try:
                        # Reserve the persistent outgoing sequence and send it under
                        # the same lock as an unsolicited events response.
                        async with session.send_lock:
                            reply, envelope, payload = self._exchange(message.data, expected_pair=identifier)
                            await socket_.send_json(reply)
                            if identifier in self.store.read()["pairs"]:
                                session.receive_seq = envelope["seq"]
                                if payload["type"] == "pull":
                                    session.after = payload["after"]
                                self._sessions[socket_] = session
                                self._confirm_sync(session, envelope, payload)
                    except ProtocolError:
                        await socket_.close(code=1008, message=b"message-rejected")
                        break
                    except Exception:
                        await socket_.close(code=1011, message=b"temporary-failure")
                        break
                elif message.type in {WSMsgType.PING, WSMsgType.PONG}:
                    if message.type == WSMsgType.PING:
                        await socket_.pong(message.data)
                    if self._sessions.get(socket_) is session and identifier in self.store.read()["pairs"]:
                        self.engine.link_contact()
                elif message.type in {WSMsgType.BINARY, WSMsgType.ERROR}:
                    await socket_.close(code=1008, message=b"message-rejected")
                    break
        finally:
            self.sockets.discard(socket_)
            self._sessions.pop(socket_, None)
            pending = self._pending_sync.get(identifier)
            if pending and pending.session is session and not pending.future.done():
                pending.future.set_result({"status": "offline"})
        return socket_

    def exchange(self, raw: bytes | str, expected_pair: str | None = None) -> dict[str, Any]:
        return self._exchange(raw, expected_pair)[0]

    def _exchange(self, raw: bytes | str, expected_pair: str | None = None) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
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
            return reply, envelope, payload
        seq = self.store.next_send(identifier)
        return seal(identifier, "pc", seq, response, unb64(pair["pcToPhone"], 32), now), envelope, payload

    def _open_events(self, session: _WssSession) -> bool:
        data = self.store.read()
        # A cursor ahead of this PC's durable sequence is not a proven receipt.
        return session.after > data["eventSeq"] or any(item["seq"] > session.after for item in data["outbox"])

    def _confirm_sync(self, session: _WssSession, envelope: dict, payload: dict) -> None:
        pending = self._pending_sync.get(session.pair)
        if not pending or pending.session is not session or not pending.sent or pending.future.done() or envelope["seq"] <= pending.after_receive_seq:
            return
        if payload["type"] not in {"state", "briefing"} or self._open_events(session):
            return
        now = self.clock()
        if abs(stamp(envelope["sentAt"]) - now) > 120 or stamp(payload["generatedAt"]) > now + 120 or stamp(payload["validUntil"]) <= now:
            return
        if payload["type"] == "state" and payload["date"] != plan_date(now):
            return
        if payload["type"] == "briefing" and not any(day["date"] == plan_date(now) and stamp(day["validUntil"]) > now for day in payload["days"]):
            return
        effective, _, _ = self.engine._effective(self.store.read(), now)
        if not effective or effective["revision"] != payload["revision"] or effective["date"] != plan_date(now) or stamp(effective["validUntil"]) <= now:
            return
        # This is a newly received, currently applicable phone snapshot. It is
        # deliberately not a claim that the phone's JS recomputed it after click.
        pending.future.set_result({"status": "received", "receivedAt": utc(now), "sourceGeneratedAt": utc(stamp(payload["generatedAt"]))})

    def _sync_result(self, action: dict, result: dict) -> None:
        messages = {"received": "Handystand neu empfangen.", "offline": "Handy nicht verbunden. Öffne Anker und die PC-Verbindung.",
                    "unpaired": "Kopple zuerst dein Handy mit diesem PC.", "busy": "Ein Abgleich läuft bereits.",
                    "pending-events": "Öffne Anker am Handy, damit offene PC-Rückmeldungen übernommen werden.",
                    "timeout": "Noch kein neuer gültiger Handystand empfangen. Öffne Anker und versuche es erneut."}
        status = result["status"]
        response = {"action": "sync", "ok": status == "received", **result}
        if isinstance(action.get("requestId"), str):
            response["requestId"] = action["requestId"]
        if self.ui:
            self.ui.render({**self.engine.last_view, "message": messages[status], "actionResult": response})

    async def _sync(self, action: dict) -> None:
        pending = None
        try:
            pairs = self.store.read()["pairs"]
            sessions = [item for item in self._sessions.values() if item.pair in pairs and not item.socket.closed]
            if not pairs:
                self._sync_result(action, {"status": "unpaired"}); return
            if len(pairs) != 1 or not sessions:
                self._sync_result(action, {"status": "offline"}); return
            session = max(sessions, key=lambda item: item.receive_seq)
            if session.pair in self._pending_sync:
                self._sync_result(action, {"status": "busy"}); return
            pending = _SyncRequest(session, asyncio.get_running_loop().create_future())
            self._pending_sync[session.pair] = pending
            if self.ui:
                self.ui.render({**self.engine.last_view, "message": "Abgleich angefragt – warte auf das Handy."})
            try:
                # The bound includes queueing behind a normal reply and sending,
                # not only the wait after a successful TCP write.
                async with asyncio.timeout(self.sync_timeout):
                    async with session.send_lock:
                        pair = self.store.read()["pairs"].get(session.pair)
                        if not pair or self._sessions.get(session.socket) is not session or session.socket.closed:
                            self._sync_result(action, {"status": "offline"}); return
                        pending.after_receive_seq = session.receive_seq
                        # The exact same page builder as an authenticated native pull.
                        # Never substitute eventSeq: that would skip unapplied PC events.
                        now = self.clock()
                        events = self._apply({"type": "pull", "after": session.after}, session.pair, now, now)
                        seq = self.store.next_send(session.pair)
                        await session.socket.send_json(seal(session.pair, "pc", seq, events, unb64(pair["pcToPhone"], 32), now))
                        pending.sent = True
                    result = await pending.future
            except asyncio.TimeoutError:
                result = {"status": "pending-events" if self._open_events(session) else "timeout"}
            self._sync_result(action, result)
        except Exception:
            self._sync_result(action, {"status": "offline"})
        finally:
            if pending and self._pending_sync.get(pending.session.pair) is pending:
                self._pending_sync.pop(pending.session.pair, None)

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
        for pending in tuple(self._pending_sync.values()):
            if not pending.future.done():
                pending.future.set_result({"status": "offline"})
        if self.engine.audio:
            self.engine.audio.restore()

    def _management_result(self, action: dict, ok: bool, **fields) -> None:
        if self.ui:
            result = {"action": action.get("action"), "ok": ok, **fields}
            if isinstance(action.get("requestId"), str):
                result["requestId"] = action["requestId"]
            self.ui.render({**self.engine.last_view, "desktopPrefs": desktop_preferences(self.store.read()), "actionResult": result})

    def _desktop_settings(self, action: dict) -> None:
        old = desktop_preferences(self.store.read())
        updated = desktop_patch(old, action.get("prefs"))
        self.store.update(lambda data: data.update(desktopPrefs=updated))
        self.pairing.pc_name = updated["pcName"]
        if old["pcName"] != updated["pcName"]:
            for identifier in tuple(self.pairing.drafts):
                self.pairing.reject(identifier)
                if self.ui and hasattr(self.ui, "close_pairing_offer"):
                    try: self.ui.close_pairing_offer(identifier)
                    except Exception: pass
            self.pairing.drafts.clear()
        self._management_result(action, True)

    async def _delete_data(self, action: dict) -> None:
        self._resetting = True
        try:
            # Revoke durably where possible, but do not let a failed vault write
            # prevent an explicitly requested unlink of the private state file.
            try:
                self.unpair()
            except Exception:
                if self.engine.audio:
                    try: self.engine.audio.restore()
                    except Exception: pass
            for identifier in tuple(self.pairing.drafts):
                self.pairing.reject(identifier)
                if self.ui and hasattr(self.ui, "close_pairing_offer"):
                    try: self.ui.close_pairing_offer(identifier)
                    except Exception: pass
            self.pairing.drafts.clear()
            self.engine.test_started = None
            self.engine.last_view = {}
            self.store.close_and_forget()
            for pending in tuple(self._pending_sync.values()):
                if not pending.future.done():
                    pending.future.set_result({"status": "offline"})
            try:
                async with asyncio.timeout(3):
                    await asyncio.gather(*(socket_.close(code=1001, message=b"local-data-reset") for socket_ in tuple(self.sockets)), return_exceptions=True)
            except asyncio.TimeoutError:
                pass
            self._sessions.clear()
            # Production stops its loop and closes its own rotating log handler
            # before unlinking, so neither state nor logs are recreated afterward.
            if self.on_delete_data:
                self.on_delete_data()
            delete_managed_files(self.store.path)
            self._management_result(action, True, restartRequired=True)
        except Exception:
            self._management_result(action, False, status="delete-incomplete", restartRequired=True)

    def ui_action(self, action: dict[str, Any]) -> asyncio.Task | None:
        kind = action.get("action")
        try:
            if self._resetting:
                self._management_result(action, False, status="restart-required", restartRequired=True)
                return
            if kind == "desktop-settings":
                self._desktop_settings(action)
                return
            if kind == "preview-extend-until":
                preview = self.engine.preview_extension_until(action.get("localTime"))
                self._management_result(action, True, preview=preview)
                return
            if kind == "extend-until":
                if not isinstance(action.get("expectedTargetAt"), str):
                    raise DesktopSettingsError("preview-required")
                self.engine.extend_until(action.get("localTime"), expected_target_at=action["expectedTargetAt"])
                self._management_result(action, True)
                return
            if kind == "delete-data":
                if action.get("userConfirmed") is not True:
                    raise DesktopSettingsError("confirmation-required")
                task = asyncio.get_running_loop().create_task(self._delete_data(dict(action)))
                self._sync_tasks.add(task)
                task.add_done_callback(self._sync_tasks.discard)
                return task
            if kind == "sync":
                task = asyncio.get_running_loop().create_task(self._sync(dict(action)))
                self._sync_tasks.add(task)
                task.add_done_callback(self._sync_tasks.discard)
                return task
            if kind == "pair":
                value = self.pairing.create()
                if self.ui:
                    self.ui.show_pairing_offer(value["qr"], stamp(value["data"]["e"]), value["data"]["id"])
            elif kind == "confirm_pair":
                try:
                    self.pairing.approve(action["id"])
                finally:
                    if self.ui:
                        self.ui.close_pairing_offer(action["id"])
            elif kind == "reject_pair":
                try:
                    self.pairing.reject(action["id"])
                finally:
                    if self.ui:
                        self.ui.close_pairing_offer(action["id"])
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
        except Exception as error:
            if kind in {"desktop-settings", "preview-extend-until", "extend-until", "delete-data"}:
                allowed = {"pc-name-invalid", "hotkey-invalid", "hotkey-conflict", "theme-invalid", "desktop-settings-invalid", "confirmation-required", "preview-required", "preview-expired", "clock", "clock-range", "clock-nonexistent", "phone-override-required", "no-schedule"}
                reason = str(error) if isinstance(error, (DesktopSettingsError, ProtocolError)) and str(error) in allowed else "not-saved"
                self._management_result(action, False, reason=reason)
                return
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
