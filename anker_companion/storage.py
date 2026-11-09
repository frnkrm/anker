"""Versioned atomic encrypted state; the production vault is Windows DPAPI only."""
from __future__ import annotations

from copy import deepcopy
from contextlib import contextmanager
import json
import os
from pathlib import Path
import threading
from typing import Any, Callable, Protocol

from .protocol import canonical


class Vault(Protocol):
    def protect(self, value: bytes) -> bytes: ...
    def unprotect(self, value: bytes) -> bytes: ...


def initial_state() -> dict[str, Any]:
    return {"schemaVersion": 1, "pairs": {}, "outbox": [], "eventSeq": 0, "snapshot": None,
            "briefing": None, "localPrefs": {"enforceEnabled": False, "strictLock": False, "dimEnabled": False, "audioDuck": False},
            "runtime": {}, "notes": [], "commandIds": [], "commandResults": {}, "tls": None}


class AtomicStateStore:
    def __init__(self, path: Path, vault: Vault):
        self.path = Path(path)
        self.vault = vault
        self._lock = threading.RLock()
        self._batch: dict[str, Any] | None = None
        self.path.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.chmod(self.path.parent, 0o700)
        except OSError:
            pass
        if self.path.exists():
            try:
                state = json.loads(vault.unprotect(self.path.read_bytes()))
                if not isinstance(state, dict) or state.get("schemaVersion") != 1:
                    raise ValueError()
                self._state = {**initial_state(), **state}
            except Exception as error:
                raise RuntimeError("state-unreadable") from error
        else:
            self._state = initial_state()

    def read(self) -> dict[str, Any]:
        with self._lock:
            return deepcopy(self._batch if self._batch is not None else self._state)

    def _write(self, next_state: dict[str, Any]) -> None:
        protected = self.vault.protect(canonical(next_state))
        temp = self.path.with_suffix(".next")
        try:
            with temp.open("wb") as output:
                try:
                    os.chmod(temp, 0o600)
                except OSError:
                    pass
                output.write(protected)
                output.flush(); os.fsync(output.fileno())
            os.replace(temp, self.path)
        finally:
            temp.unlink(missing_ok=True)
        self._state = next_state

    @contextmanager
    def transaction(self):
        """Commit sequence receipt, local effects and generated outbox together."""
        with self._lock:
            if self._batch is not None:
                raise RuntimeError("nested-transaction")
            self._batch = deepcopy(self._state)
            try:
                yield
                self._write(self._batch)
            finally:
                self._batch = None

    def update(self, mutate: Callable[[dict[str, Any]], Any]) -> Any:
        with self._lock:
            next_state = deepcopy(self._batch if self._batch is not None else self._state)
            result = mutate(next_state)
            if self._batch is not None:
                self._batch = next_state
            else:
                self._write(next_state)
            return result

    def next_send(self, pair: str) -> int:
        def change(state: dict[str, Any]) -> int:
            item = state["pairs"][pair]
            item["sendSeq"] = item.get("sendSeq", 0) + 1
            return item["sendSeq"]
        return self.update(change)

    def accept_receive(self, pair: str, seq: int) -> None:
        from .protocol import ProtocolError
        def change(state: dict[str, Any]) -> None:
            item = state["pairs"][pair]
            if seq <= item.get("receiveSeq", 0):
                raise ProtocolError("replay")
            item["receiveSeq"] = seq
        self.update(change)

    def event(self, at: float, date: str, kind: str, **fields: Any) -> dict[str, Any]:
        from .protocol import utc, validate_event
        import uuid
        def change(state: dict[str, Any]) -> dict[str, Any]:
            state["eventSeq"] += 1
            entry = {"id": str(uuid.uuid4()), "seq": state["eventSeq"], "at": utc(at), "date": date, "kind": kind, **fields}
            validate_event(entry)
            state["outbox"].append(entry)
            # A finite local history; no message content is ever written to logs.
            state["outbox"] = [item for item in state["outbox"] if item["at"] >= utc(at - 30 * 86400)][-10000:]
            return deepcopy(entry)
        return self.update(change)
