"""Optional ciphertext-only relay; the existing v3 owner keeps all keys and counters.

No network operation is performed on import, without consent, or while a fresh
authenticated LAN session exists. Relay credentials are stored only in the same
DPAPI-protected AtomicStateStore, never in engine snapshots or diagnostics.
"""
from __future__ import annotations

import asyncio
from copy import deepcopy
from dataclasses import dataclass
import json
import math
import re
import time
from typing import Any, Callable

import aiohttp

from .protocol import MAX_BYTES, ProtocolError, canonical, integer, obj, stamp, unb64, utc
from .storage import AtomicStateStore

MAX_AGE = 14 * 86400
MAX_RESPONSE_BYTES = 8 * MAX_BYTES + 2048
SETUP_PREFIX = "anker-pc-relay:v1:"


class RelayError(Exception):
    def __init__(self, code="unavailable"):
        self.code = code if code in {"unavailable", "unauthorized", "rejected"} else "unavailable"
        super().__init__(self.code)


@dataclass(frozen=True, repr=False)
class RelayConfiguration:
    project: str
    pair: str
    device_token: str

    @property
    def endpoint(self) -> str:
        return f"https://{self.project}.supabase.co/functions/v1/pc-link"


def _configuration_values(value: Any) -> RelayConfiguration:
    try:
        value = obj(value, {"project", "pair", "deviceToken"})
        if (not isinstance(value["project"], str) or not re.fullmatch(r"[a-z0-9]{20}", value["project"])
                or not isinstance(value["pair"], str) or not re.fullmatch(r"[A-Za-z0-9._:-]{1,160}", value["pair"])
                or not isinstance(value["deviceToken"], str) or not re.fullmatch(r"[a-f0-9]{64}", value["deviceToken"])):
            raise ValueError()
        return RelayConfiguration(value["project"], value["pair"], value["deviceToken"])
    except Exception:
        raise RelayError("rejected") from None


def configure_relay(store: AtomicStateStore, setup_code: str) -> None:
    """An explicit, private paste from the owner's phone. Never a public QR/export."""
    try:
        if not isinstance(setup_code, str) or not setup_code.startswith(SETUP_PREFIX) or len(setup_code) > 2048:
            raise ValueError()
        config = _configuration_values(json.loads(unb64(setup_code.removeprefix(SETUP_PREFIX))))
        def change(data):
            if len(data["pairs"]) != 1 or config.pair not in data["pairs"]:
                raise ValueError()
            data["relay"] = {"enabled": True, "project": config.project, "pair": config.pair,
                             "deviceToken": config.device_token, "pendingReplies": []}
        store.update(change)
    except Exception:
        raise RelayError("rejected") from None


def disable_relay(store: AtomicStateStore) -> None:
    def change(data):
        if isinstance(data.get("relay"), dict):
            data["relay"]["enabled"] = False
    store.update(change)


def clear_relay(store: AtomicStateStore) -> None:
    store.update(lambda data: data.pop("relay", None))


def relay_configuration(store: AtomicStateStore, *, pending_only: bool = False) -> RelayConfiguration | None:
    value = store.read()
    config = value.get("relay")
    if not isinstance(config, dict) or config.get("enabled") is not True:
        return None
    parsed = _configuration_values({key: config.get(key) for key in ("project", "pair", "deviceToken")})
    if len(value["pairs"]) == 1 and parsed.pair in value["pairs"]:
        return parsed
    # After an authenticated unpair, only its already sealed final reply may be
    # flushed. No key, incoming poll or new exchange is available on this path.
    return parsed if pending_only and not value["pairs"] and isinstance(config.get("pendingReplies"), list) and config["pendingReplies"] else None


def _envelope(value: Any, pair: str, direction: str, now: float) -> dict:
    try:
        value = obj(value, {"v", "kind", "pair", "from", "seq", "sentAt", "nonce", "ct"})
        if type(value["v"]) is not int or value["v"] != 3 or value["kind"] != "anker-link" or value["pair"] != pair or value["from"] != direction:
            raise ValueError()
        integer(value["seq"], 1)
        sent = stamp(value["sentAt"])
        if not now - MAX_AGE <= sent <= now + 120 or len(canonical(value)) > MAX_BYTES:
            raise ValueError()
        unb64(value["nonce"], 12)
        if len(unb64(value["ct"])) < 16:
            raise ValueError()
        return deepcopy(value)
    except Exception:
        raise RelayError("rejected") from None


class RelayHttpClient:
    def __init__(self, config: RelayConfiguration, session: aiohttp.ClientSession, clock=time.time):
        # Validate even if a caller manually constructed a configuration.
        self.config = _configuration_values({"project": config.project, "pair": config.pair, "deviceToken": config.device_token})
        self.session, self.clock = session, clock

    async def _request(self, body: dict) -> dict:
        try:
            async with self.session.post(self.config.endpoint, json=body,
                    headers={"x-anker-relay-token": self.config.device_token},
                    allow_redirects=False, timeout=aiohttp.ClientTimeout(total=10), ssl=True) as response:
                if response.status in {401, 403}:
                    raise RelayError("unauthorized")
                if response.status in {400, 409}:
                    raise RelayError("rejected")
                if response.status != 200 or response.content_type != "application/json":
                    raise RelayError()
                output = bytearray()
                async for chunk in response.content.iter_chunked(8192):
                    output.extend(chunk)
                    if len(output) > MAX_RESPONSE_BYTES:
                        raise RelayError()
                value = json.loads(output)
                if not isinstance(value, dict) or value.get("ok") is not True:
                    raise RelayError()
                return value
        except RelayError:
            raise
        except Exception:
            raise RelayError() from None

    async def get(self, after: int) -> list[dict]:
        try: integer(after)
        except ProtocolError: raise RelayError("rejected") from None
        result = await self._request({"operation": "get", "pair": self.config.pair, "after": after})
        if set(result) != {"ok", "envelopes"} or not isinstance(result["envelopes"], list) or len(result["envelopes"]) > 8:
            raise RelayError()
        rows, last = [], after
        for item in result["envelopes"]:
            frame = _envelope(item, self.config.pair, "phone", self.clock())
            if frame["seq"] <= last:
                raise RelayError("rejected")
            last = frame["seq"]; rows.append(frame)
        return rows

    async def put(self, value: dict) -> None:
        now = self.clock()
        envelope = _envelope(value, self.config.pair, "pc", now)
        expires = min(now + MAX_AGE, stamp(envelope["sentAt"]) + MAX_AGE)
        result = await self._request({"operation": "put", "pair": self.config.pair, "envelope": envelope, "expiresAt": utc(expires)})
        if result != {"ok": True}:
            raise RelayError()


class RelayPump:
    def __init__(self, store: AtomicStateStore, exchange: Callable[[str, str], dict],
                 lan_fresh: Callable[[str], bool], clock=time.time):
        self.store, self.exchange, self.lan_fresh, self.clock = store, exchange, lan_fresh, clock
        self.status = "off"
        self.last_exchange_at: str | None = None
        self._lock = asyncio.Lock()

    def public_status(self) -> dict:
        try: enabled = relay_configuration(self.store) is not None
        except RelayError: enabled = False
        return {"enabled": enabled, "status": self.status if enabled else "off",
                **({"lastExchangeAt": self.last_exchange_at} if self.last_exchange_at else {})}

    def _current(self, config: RelayConfiguration) -> bool:
        return relay_configuration(self.store, pending_only=True) == config

    def _pending(self, config: RelayConfiguration) -> list[dict]:
        raw = self.store.read().get("relay", {}).get("pendingReplies", [])
        if not isinstance(raw, list) or len(raw) > 64:
            raise RelayError("rejected")
        rows = []
        for value in raw:
            if not isinstance(value, dict):
                raise RelayError("rejected")
            if stamp(value.get("sentAt")) + MAX_AGE <= self.clock():
                continue  # A stale encrypted response is not a durable user event.
            rows.append(_envelope(value, config.pair, "pc", self.clock()))
        if len(rows) != len(raw) and self._current(config):
            self.store.update(lambda data: data["relay"].update(pendingReplies=rows))
        return rows

    async def _flush(self, config: RelayConfiguration, client: RelayHttpClient) -> bool:
        for frame in self._pending(config):
            if not self._current(config): return False
            await client.put(frame)
            if not self._current(config): return False
            def remove(data):
                pending = data["relay"]["pendingReplies"]
                data["relay"]["pendingReplies"] = [item for item in pending if item["seq"] != frame["seq"]]
            self.store.update(remove)
        return True

    async def tick(self, session: aiohttp.ClientSession) -> None:
        if self._lock.locked(): return
        async with self._lock:
            try:
                config = relay_configuration(self.store, pending_only=True)
                if config is None:
                    self.status = "off"; return
                if self.lan_fresh(config.pair):
                    self.status = "lan"; return
                self.status = "waiting"
                client = RelayHttpClient(config, session, self.clock)
                if not await self._flush(config, client): return
                if not self.store.read()["pairs"]:
                    clear_relay(self.store)
                    self.status = "off"; return
                after = self.store.read()["pairs"][config.pair].get("receiveSeq", 0)
                rows = await client.get(after)
                for frame in rows:
                    if not self._current(config) or self.lan_fresh(config.pair): return
                    current = self.store.read()["pairs"].get(config.pair)
                    if current is None: return
                    if frame["seq"] <= current.get("receiveSeq", 0): continue
                    # One existing exchange owns AEAD, durable seqIn/seqOut and effects.
                    reply = self.exchange(canonical(frame).decode(), config.pair)
                    reply = _envelope(reply, config.pair, "pc", self.clock())
                    # relay_exchange must durably retain its reply in the SAME
                    # transaction as receiveSeq/effects/seqOut, before returning.
                    if not any(item == reply for item in self.store.read().get("relay", {}).get("pendingReplies", [])):
                        raise RelayError()
                    self.last_exchange_at = utc(self.clock())
                    self.status = "received"
                    if not await self._flush(config, client): return
                    if not self.store.read()["pairs"]:
                        clear_relay(self.store)
                        self.status = "off"; return
            except RelayError as error:
                self.status = error.code
            except ProtocolError:
                self.status = "rejected"
            except Exception:
                self.status = "unavailable"

    async def run(self, stopped: Callable[[], bool], interval: float = 5) -> None:
        if isinstance(interval, bool) or not isinstance(interval, (int, float)) or not math.isfinite(interval) or interval < 1:
            raise RelayError("rejected")
        async with aiohttp.ClientSession(trust_env=False) as session:
            while not stopped():
                await self.tick(session)
                await asyncio.sleep(interval)
