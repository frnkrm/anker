"""Strict Anker-Link v3 schemas and interoperable cryptography; no platform effects."""
from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import math
import os
import re
from typing import Any
from zoneinfo import ZoneInfo

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

MAX_BYTES = 65_536
MAX_SEQ = 2**53 - 1
STAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$")
STATES = {"DAY_ACTIVE", "IDLE", "MORNING_PENDING", "MORNING_ACTIVE", "MORNING_COMPLETED", "ALARM_RINGING", "EVENING_WIND_DOWN", "WIND_DOWN_T30", "BRAIN_DUMP_T10", "BEDTIME_HARD_CUT", "NIGHT_LOCK", "ZOMBIE_MODE"}
PREF_KEYS = {"enforceEnabled", "strictLock", "dimEnabled", "dimMax", "audioDuck", "shareBrainDump", "morningCountdown", "offlinePolicy", "stopAction", "graceSeconds"}
EVENT_KINDS = {"pc-rest", "pc-resumed", "extended", "suspended-today", "resumed-today", "shutdown-started", "shutdown-blocked", "save-point", "thought", "unpaired"}
SCHEDULE_REQUIRED = {"windDownAt", "brainDumpAt", "bedAt", "wakeAt", "morningDeadlineAt"}
SCHEDULE_OPTIONAL = {"pcStopAt", "leaveAt", "workStartAt", "homeOffice", "lightHintAt"}


class ProtocolError(ValueError):
    """A neutral error code; never incorporates payload contents."""


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def unb64(value: Any, length: int | None = None) -> bytes:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]*", value):
        raise ProtocolError("encoding")
    try:
        data = base64.b64decode(value + "=" * (-len(value) % 4), altchars=b"-_", validate=True)
    except (ValueError, TypeError) as error:
        raise ProtocolError("encoding") from error
    if b64(data) != value or (length is not None and len(data) != length):
        raise ProtocolError("encoding")
    return data


def utc(at: float) -> str:
    return datetime.fromtimestamp(at, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def stamp(value: Any, nullable: bool = False) -> float | None:
    if value is None and nullable:
        return None
    if not isinstance(value, str) or not STAMP.fullmatch(value):
        raise ProtocolError("timestamp")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError as error:
        raise ProtocolError("timestamp") from error


def day(value: Any) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ProtocolError("date")
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError as error:
        raise ProtocolError("date") from error
    return value


def plan_date(at: float) -> str:
    from datetime import timedelta
    local = datetime.fromtimestamp(at, ZoneInfo("Europe/Berlin"))
    return (local - timedelta(hours=4)).strftime("%Y-%m-%d")


def next_local_time(local_time: Any, now: float) -> float:
    """Next real Berlin wall-clock occurrence, at most 24 elapsed hours away.

    During the repeated autumn hour choose the earliest still-future occurrence.
    A spring-gap time on the otherwise next chosen local date is rejected.
    """
    if not isinstance(local_time, str) or not re.fullmatch(r"(?:[01][0-9]|2[0-3]):[0-5][0-9]", local_time):
        raise ProtocolError("clock")
    if isinstance(now, bool) or not isinstance(now, (int, float)) or not math.isfinite(now):
        raise ProtocolError("clock-range")
    zone = ZoneInfo("Europe/Berlin")
    try:
        current = datetime.fromtimestamp(now, zone)
    except (OverflowError, OSError, ValueError):
        raise ProtocolError("clock-range") from None
    hour, minute = (int(part) for part in local_time.split(":"))
    for offset in (0, 1):
        try:
            date = current.date() + timedelta(days=offset)
        except (OverflowError, ValueError):
            raise ProtocolError("clock-range") from None
        wall = datetime(date.year, date.month, date.day, hour, minute)
        candidates = set()
        for fold in (0, 1):
            at = wall.replace(tzinfo=zone, fold=fold).timestamp()
            if datetime.fromtimestamp(at, zone).replace(tzinfo=None) == wall:
                candidates.add(at)
        if not candidates and (offset or wall > current.replace(tzinfo=None)):
            raise ProtocolError("clock-nonexistent")
        future = sorted(at for at in candidates if now < at <= now + 24 * 3600)
        if future:
            return future[0]
    raise ProtocolError("clock-range")


def obj(value: Any, required: set[str], optional: set[str] = frozenset()) -> dict[str, Any]:
    if not isinstance(value, dict) or not required <= value.keys() or value.keys() - required - optional:
        raise ProtocolError("schema")
    return value


def text(value: Any, limit: int = 500, empty: bool = False) -> str:
    if not isinstance(value, str):
        raise ProtocolError("text")
    try:
        units = len(value.encode("utf-16-le")) // 2
    except UnicodeError as error:
        raise ProtocolError("text") from error
    if units > limit or (not empty and not value.strip()) or any(ord(char) < 32 and char not in "\t\n\r" for char in value):
        raise ProtocolError("text")
    return value


def integer(value: Any, low: int = 0, high: int = MAX_SEQ) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
        raise ProtocolError("number")
    return value


def boolean(value: Any) -> bool:
    if not isinstance(value, bool):
        raise ProtocolError("boolean")
    return value


def prefs(value: Any) -> dict[str, Any]:
    result = obj(value, PREF_KEYS, {"ifThen", "bedtimeSequence", "singleTransition", "bedAfterStopMin"})
    for name in ("enforceEnabled", "strictLock", "dimEnabled", "audioDuck", "shareBrainDump", "morningCountdown"):
        boolean(result[name])
    if "bedtimeSequence" in result:
        boolean(result["bedtimeSequence"])
    if "singleTransition" in result:
        boolean(result["singleTransition"])
    if "bedAfterStopMin" in result:
        integer(result["bedAfterStopMin"], 0, 30)
    if isinstance(result["dimMax"], bool) or not isinstance(result["dimMax"], (int, float)) or not math.isfinite(result["dimMax"]) or not 0 <= result["dimMax"] <= 0.4:
        raise ProtocolError("dim")
    if not isinstance(result["offlinePolicy"], str) or not isinstance(result["stopAction"], str) or result["offlinePolicy"] not in ("pause", "fixed-time") or result["stopAction"] not in ("lock", "hibernate", "shutdown"):
        raise ProtocolError("preference")
    integer(result["graceSeconds"], 60, 600)
    if "ifThen" in result:
        text(result["ifThen"])
    return result


def validate_state(value: Any) -> dict[str, Any]:
    result = obj(value, {"type", "state", "sessionId", "revision", "date", "generatedAt", "validUntil", "remainingSeconds", "routineStep", "lockEnforced", "schedule", "prefs"}, {"brainDump"})
    if result["type"] != "state" or not isinstance(result["state"], str) or result["state"] not in STATES:
        raise ProtocolError("state")
    text(result["sessionId"], 128); text(result["revision"], 128); day(result["date"])
    generated, until = stamp(result["generatedAt"]), stamp(result["validUntil"])
    if not generated < until <= generated + 18 * 3600:
        raise ProtocolError("lease")
    integer(result["remainingSeconds"], 0, 18 * 3600)
    boolean(result["lockEnforced"])
    if result["routineStep"] is not None:
        step = obj(result["routineStep"], {"index", "total"})
        integer(step["total"], 1, 200); integer(step["index"], 0, step["total"])
    schedule = obj(result["schedule"], SCHEDULE_REQUIRED, SCHEDULE_OPTIONAL)
    for name, at in schedule.items():
        boolean(at) if name == "homeOffice" else stamp(at, nullable=name != "lightHintAt")
    wake, deadline = stamp(schedule["wakeAt"], True), stamp(schedule["morningDeadlineAt"], True)
    if deadline is not None and (wake is None or not wake <= deadline <= wake + 3 * 3600):
        raise ProtocolError("morning-deadline")
    pref = prefs(result["prefs"])
    if "brainDump" in result:
        note = obj(result["brainDump"], {"text"}, {"nextStep"})
        text(note["text"])
        if "nextStep" in note:
            text(note["nextStep"])
        if not pref["shareBrainDump"]:
            raise ProtocolError("share-consent")
    return result


def validate_briefing(value: Any) -> dict[str, Any]:
    result = obj(value, {"type", "revision", "generatedAt", "validUntil", "days", "prefs"})
    if result["type"] != "briefing":
        raise ProtocolError("type")
    text(result["revision"], 128); stamp(result["generatedAt"]); stamp(result["validUntil"]); prefs(result["prefs"])
    if not isinstance(result["days"], list) or not 1 <= len(result["days"]) <= 14:
        raise ProtocolError("days")
    dates = set()
    for entry in result["days"]:
        obj(entry, {"date", "validUntil", "pc"}, {"bedAt", "wakeAt", "windDownAt", "brainDumpAt", "morningDeadlineAt", "morning", "lightHintAt"})
        date = day(entry["date"])
        if date in dates:
            raise ProtocolError("duplicate-day")
        dates.add(date); stamp(entry["validUntil"])
        pc = obj(entry["pc"], {"mode"}, {"stopAt", "localTime"})
        if pc["mode"] == "scheduled":
            stamp(pc.get("stopAt"))
            if not isinstance(pc.get("localTime"), str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", pc["localTime"]):
                raise ProtocolError("clock")
        elif pc["mode"] != "paused" or len(pc) != 1:
            raise ProtocolError("mode")
        for name in {"bedAt", "wakeAt", "windDownAt", "brainDumpAt", "morningDeadlineAt"} & entry.keys():
            stamp(entry[name], True)
        if "lightHintAt" in entry:
            stamp(entry["lightHintAt"])
        if "morning" in entry:
            morning = obj(entry["morning"], {"homeOffice"}, {"leaveAt", "workStartAt"})
            boolean(morning["homeOffice"])
            for name in {"leaveAt", "workStartAt"} & morning.keys():
                stamp(morning[name], True)
    return result


def validate_event(value: Any) -> dict[str, Any]:
    result = obj(value, {"id", "seq", "at", "date", "kind"}, {"basis", "newStopAt", "text", "nextStep", "anchor"})
    text(result["id"], 128); integer(result["seq"], 1); stamp(result["at"]); day(result["date"])
    if not isinstance(result["kind"], str) or result["kind"] not in EVENT_KINDS:
        raise ProtocolError("event-kind")
    if "basis" in result and (not isinstance(result["basis"], str) or result["basis"] not in {"anker-shutdown", "user-shutdown", "sleep", "lock", "logoff", "idle"}):
        raise ProtocolError("event-basis")
    if "anchor" in result and (not isinstance(result["anchor"], str) or result["anchor"] not in {"bed", "pc-stop"}):
        raise ProtocolError("event-anchor")
    if "newStopAt" in result:
        stamp(result["newStopAt"])
    if result["kind"] == "extended":
        stamp(result.get("newStopAt"))
    for name in {"text", "nextStep"} & result.keys():
        text(result[name], empty=True)
    if result["kind"] in {"thought", "save-point"}:
        text(result.get("text"))
    return result


def validate_payload(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ProtocolError("schema")
    kind = value.get("type")
    if kind == "state":
        return validate_state(value)
    if kind == "briefing":
        return validate_briefing(value)
    if kind == "pull":
        obj(value, {"type", "after"}); integer(value["after"])
    elif kind == "command":
        obj(value, {"type", "id", "action"}, {"minutes", "token"})
        text(value["id"], 128)
        if not isinstance(value["action"], str) or value["action"] not in {"ping", "unpair", "test-evening", "resume-today", "suspend-today", "extend", "EMERGENCY_EXTENSION"}:
            raise ProtocolError("action")
        if "minutes" in value:
            integer(value["minutes"], 1, 24 * 60)
        if value["action"] == "extend" and "minutes" not in value or value["action"] == "EMERGENCY_EXTENSION" and "token" not in value:
            raise ProtocolError("action-fields")
        if "token" in value:
            validate_emergency_shape(value["token"])
    else:
        raise ProtocolError("type")
    return value


def public_bytes(key: ec.EllipticCurvePublicKey) -> bytes:
    return key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)


def public_key(value: str) -> ec.EllipticCurvePublicKey:
    data = unb64(value, 65)
    if data[0] != 4:
        raise ProtocolError("public-key")
    try:
        return ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), data)
    except ValueError as error:
        raise ProtocolError("public-key") from error


def derive_keys(private: ec.EllipticCurvePrivateKey, peer: str, salt: bytes) -> tuple[bytes, bytes]:
    if len(salt) != 32:
        raise ProtocolError("salt")
    shared = private.exchange(ec.ECDH(), public_key(peer))
    return tuple(HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=direction).derive(shared) for direction in (b"anker-link v3 phone->pc", b"anker-link v3 pc->phone"))


def pairing_code(pc: bytes, phone: bytes) -> str:
    return f"{int.from_bytes(hashlib.sha256(pc + phone).digest()[:4], 'big') % 10000:04d}"


def pair_proof(secret: bytes, pair: str, phone: str, signing: str) -> str:
    return b64(hmac.new(secret, f"pair|{pair}|{phone}|{signing}".encode(), hashlib.sha256).digest())


def seal(pair: str, sender: str, seq: int, payload: dict[str, Any], key: bytes, now: float, nonce: bytes | None = None) -> dict[str, Any]:
    integer(seq, 1)
    envelope = {"v": 3, "kind": "anker-link", "pair": pair, "from": sender, "seq": seq, "sentAt": utc(now)}
    iv = nonce if nonce is not None else os.urandom(12)
    if len(iv) != 12 or sender not in {"phone", "pc"}:
        raise ProtocolError("envelope")
    plaintext = json.dumps(payload, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")
    envelope.update(nonce=b64(iv), ct=b64(AESGCM(key).encrypt(iv, plaintext, canonical(envelope))))
    if len(canonical(envelope)) > MAX_BYTES:
        raise ProtocolError("too-large")
    return envelope


def open_envelope(raw: bytes | str | dict[str, Any], pair: str, expected_sender: str, last_seq: int, key: bytes) -> tuple[dict[str, Any], dict[str, Any]]:
    try:
        if isinstance(raw, (bytes, str)):
            if len(raw.encode() if isinstance(raw, str) else raw) > MAX_BYTES:
                raise ProtocolError("too-large")
            raw = json.loads(raw)
        envelope = obj(raw, {"v", "kind", "pair", "from", "seq", "sentAt", "nonce", "ct"})
        if len(canonical(envelope)) > MAX_BYTES:
            raise ProtocolError("too-large")
        if envelope["v"] != 3 or envelope["kind"] != "anker-link" or envelope["pair"] != pair or envelope["from"] != expected_sender:
            raise ProtocolError("identity")
        integer(envelope["seq"], 1); stamp(envelope["sentAt"])
        if envelope["seq"] <= last_seq:
            raise ProtocolError("replay")
        aad = {name: envelope[name] for name in ("v", "kind", "pair", "from", "seq", "sentAt")}
        plaintext = AESGCM(key).decrypt(unb64(envelope["nonce"], 12), unb64(envelope["ct"]), canonical(aad))
        payload = json.loads(plaintext)
        if not isinstance(payload, dict):
            raise ProtocolError("schema")
        return envelope, payload
    except ProtocolError:
        raise
    except Exception as error:
        raise ProtocolError("authentication") from error


def validate_emergency_shape(value: Any) -> dict[str, Any]:
    token = obj(value, {"v", "pair", "sessionId", "date", "issuedAt", "expiresAt", "until", "nonce", "signature"})
    if token["v"] != 3:
        raise ProtocolError("token-version")
    text(token["pair"], 128); text(token["sessionId"], 128); day(token["date"])
    stamp(token["issuedAt"]); stamp(token["expiresAt"]); stamp(token["until"])
    unb64(token["nonce"], 16); unb64(token["signature"])
    return token


def verify_emergency(token: Any, pair: str, signing_key: str, state: dict[str, Any], used_nonces: set[str], now: float) -> float:
    token = validate_emergency_shape(token)
    issued, expires, until = stamp(token["issuedAt"]), stamp(token["expiresAt"]), stamp(token["until"])
    if token["pair"] != pair or token["sessionId"] != state["sessionId"] or token["date"] != state["date"] or token["nonce"] in used_nonces:
        raise ProtocolError("token-identity")
    if issued > now + 60 or not issued < expires <= issued + 300 or expires < now or not now < until <= issued + 7200 or until > stamp(state["validUntil"]):
        raise ProtocolError("token-expired")
    body = {name: value for name, value in token.items() if name != "signature"}
    try:
        public_key(signing_key).verify(unb64(token["signature"]), canonical(body), ec.ECDSA(hashes.SHA256()))
    except Exception as error:
        raise ProtocolError("token-signature") from error
    return until
