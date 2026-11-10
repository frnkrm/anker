"""Finite opt-in Windows execution of phone-owned timestamps; injectable clock/platform."""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime
import time
from typing import Any
from zoneinfo import ZoneInfo

from . import __version__
from .protocol import ProtocolError, next_local_time, plan_date, stamp, text, utc, validate_briefing, validate_state
from .storage import AtomicStateStore

NIGHT = {"BEDTIME_HARD_CUT", "NIGHT_LOCK", "MORNING_PENDING", "MORNING_ACTIVE", "ALARM_RINGING", "ZOMBIE_MODE"}


class CompanionEngine:
    def __init__(self, store: AtomicStateStore, platform: Any, clock=time.time, ui: Any = None, audio: Any = None):
        self.store, self.platform, self.clock, self.ui, self.audio = store, platform, clock, ui, audio
        self.last_now = clock()
        self.test_started: float | None = None
        self.last_view: dict[str, Any] = {}
        self._legacy_checked = float("-inf")
        self._legacy_result = True
        self._morning_card_id: str | None = None
        self._transition_card_id: str | None = None
        # Login/restart never inherits an almost-finished save grace.
        self.store.update(lambda data: data["runtime"].update(graceStartedAt=None, lastLockAt=0, bootAt=self.last_now))

    def _message(self, message: str) -> None:
        if self.ui:
            self.ui.render({**self.last_view, "message": message})

    def accept_state(self, state: dict[str, Any], pair: str, sent_at: float, now: float | None = None) -> dict[str, Any]:
        now = self.clock() if now is None else now
        state = deepcopy(validate_state(state))
        def change(data: dict[str, Any]) -> None:
            old = data.get("snapshot")
            if old and stamp(state["generatedAt"]) < stamp(old["generatedAt"]):
                raise ProtocolError("stale-state")
            runtime = data["runtime"]
            latch = self.active_latch(data, now)
            if latch is None:
                runtime["nightLatch"] = None
            elif latch.get("scheduledNight") and pair == latch.get("pair") and state["lockEnforced"] and state["state"] in NIGHT and state["sessionId"].startswith("night:" + latch["date"] + ":") and abs(sent_at - now) <= 120 and stamp(state["validUntil"]) > now:
                # A later real phone bedtime override replaces only the identity
                # of our schedule-only latch, never its consent or finite bounds.
                latch = deepcopy(latch)
                original_session = latch["sessionId"]
                latch.update(sessionId=state["sessionId"], scheduledNight=False)
                latch["state"]["sessionId"] = state["sessionId"]
                runtime["nightLatch"] = latch
                if runtime.get("emergencySessionId") == original_session:
                    runtime["emergencySessionId"] = state["sessionId"]
            if state["state"] == "MORNING_COMPLETED" and latch:
                if not self.matches_night_session(data, latch, state, pair, now) or abs(sent_at - now) > 120 or stamp(state["validUntil"]) <= now or stamp(state["generatedAt"]) > now + 120:
                    raise ProtocolError("morning-session")
            same_pc = bool(old and old["sessionId"] == state["sessionId"] and old["schedule"].get("bedAt") == state["schedule"].get("bedAt") and old["revision"] == state["revision"])
            if not same_pc and not latch:
                runtime.update(graceStartedAt=None, actedTarget=None, extensionAt=None, extensionRevision=None)
            runtime.update(sourcePair=pair, sourceSkew=abs(sent_at - now) > 120, receivedAt=now, linkSeenAt=now)
            data["snapshot"] = state
            if state["state"] == "MORNING_COMPLETED":
                runtime.update(nightLatch=None, graceStartedAt=None, emergencyUntil=None, actedTarget=None)
            elif state["lockEnforced"] and state["state"] in NIGHT and not latch and all((state["prefs"]["enforceEnabled"], state["prefs"]["strictLock"], data["localPrefs"].get("enforceEnabled"), data["localPrefs"].get("strictLock"))):
                runtime["nightLatch"] = {"pair": pair, "sessionId": state["sessionId"], "date": state["date"], "validUntil": state["validUntil"], "morningDeadlineAt": state["schedule"]["morningDeadlineAt"], "wakeAt": state["schedule"]["wakeAt"], "state": deepcopy(state)}
        self.store.update(change)
        return self.ack(state["revision"], now)

    def accept_briefing(self, briefing: dict[str, Any], now: float | None = None, sent_at: float | None = None) -> dict[str, Any]:
        now = self.clock() if now is None else now
        briefing = deepcopy(validate_briefing(briefing))
        def change(data):
            old = data.get("briefing")
            if old and stamp(briefing["generatedAt"]) < stamp(old["generatedAt"]):
                raise ProtocolError("stale-briefing")
            data["briefing"] = briefing
            data["runtime"].update(briefingSkew=abs((now if sent_at is None else sent_at) - now) > 120, linkSeenAt=now)
        self.store.update(change)
        return self.ack(briefing["revision"], now)

    def link_contact(self, now: float | None = None, force: bool = False) -> None:
        """A valid AES frame or a heartbeat on its authenticated socket keeps the lease live."""
        now = self.clock() if now is None else now
        if force or now - self.store.read()["runtime"].get("linkSeenAt", float("-inf")) >= 10:
            self.store.update(lambda data: data["runtime"].update(linkSeenAt=now))

    @staticmethod
    def _briefing_state(data: dict[str, Any], now: float) -> dict[str, Any] | None:
        """Select an already dated phone entry. Never calculate a tomorrow from yesterday."""
        briefing = data.get("briefing")
        if not briefing or stamp(briefing["validUntil"]) <= now:
            return None
        entry = next((item for item in briefing["days"] if item["date"] == plan_date(now) and stamp(item["validUntil"]) > now), None)
        if entry is None:
            return None
        scheduled = entry["pc"]["mode"] == "scheduled"
        schedule = {key: entry.get(key) for key in ("windDownAt", "brainDumpAt", "bedAt", "wakeAt", "morningDeadlineAt")}
        schedule["pcStopAt"] = entry["pc"]["stopAt"] if scheduled else None
        if "lightHintAt" in entry:
            schedule["lightHintAt"] = entry["lightHintAt"]
        schedule.update(entry.get("morning", {}))
        prefs = deepcopy(briefing["prefs"])
        # A future daily entry has no hardware-authenticated night session. It can
        # perform its opted-in one-shot PC stop, never create a new night watchdog.
        prefs["strictLock"] = False
        if not scheduled:
            prefs.update(enforceEnabled=False, dimEnabled=False, audioDuck=False)
        return {"type": "state", "state": "DAY_ACTIVE", "sessionId": "briefing:" + entry["date"],
                "revision": briefing["revision"], "date": entry["date"], "generatedAt": briefing["generatedAt"],
                "validUntil": utc(min(stamp(entry["validUntil"]), stamp(briefing["validUntil"]))),
                "remainingSeconds": 0, "routineStep": None, "lockEnforced": False,
                "schedule": schedule, "prefs": prefs, "_briefing": True}

    def _effective(self, data: dict[str, Any], now: float) -> tuple[dict[str, Any] | None, list[str], dict[str, Any]]:
        state = data.get("snapshot")
        latch = self.active_latch(data, now)
        latched = bool(latch and latch.get("state", {}).get("prefs", {}).get("strictLock"))
        if latched:
            state = deepcopy(latch["state"])
            current = data.get("snapshot")
            if current and self.matches_night_session(data, latch, current, data["runtime"].get("sourcePair"), now, allow_original=True):
                state["date"] = current["date"]
        warnings: list[str] = []
        snapshot_current = state is not None and stamp(state["validUntil"]) > now and state["date"] == plan_date(now)
        link_fresh = now - data["runtime"].get("linkSeenAt", float("-inf")) <= 90
        briefing = self._briefing_state(data, now)
        # Connected live snapshots take precedence. On rollover/expired leases use
        # only today's explicit cached entry. Fixed-time also permits this offline.
        if not latched and briefing is not None and (not snapshot_current or not link_fresh and briefing["prefs"]["offlinePolicy"] == "fixed-time"):
            state = briefing
        local = data["localPrefs"]
        effective = {"enforceEnabled": False, "strictLock": False, "dimEnabled": False, "audioDuck": False}
        if not state:
            return None, ["no-schedule"], effective
        remote = state["prefs"]
        effective = {**remote, **{key: bool(remote.get(key) and local.get(key)) for key in effective}}
        effective["stopAction"] = local.get("stopAction", remote["stopAction"])
        effective["graceSeconds"] = max(local.get("graceSeconds", 60), remote["graceSeconds"])
        effective["dimMax"] = min(local.get("dimMax", .4), remote["dimMax"])
        if not effective["enforceEnabled"]:
            warnings.append("local-enforcement-off")
        if data["runtime"].get("briefingSkew" if state.get("_briefing") else "sourceSkew"):
            warnings.append("clock-skew")
        if stamp(state["validUntil"]) <= now or not latched and state["date"] != plan_date(now):
            warnings.append("source-expired")
        if not link_fresh and remote["offlinePolicy"] == "pause" and not latched:
            warnings.append("link-stale")
        if now - self._legacy_checked >= 60 or now < self._legacy_checked:
            try:
                self._legacy_result = self.platform.legacy_conflict()
            except Exception:
                self._legacy_result = True
            self._legacy_checked = now
        if self._legacy_result:
            warnings.append("legacy-conflict")
        deadline = stamp(state["schedule"]["morningDeadlineAt"], True)
        if state["state"] != "MORNING_COMPLETED" and deadline is not None and now >= deadline:
            warnings.append("morning-deadline-reached")
        return state, warnings, effective

    @staticmethod
    def active_latch(data: dict[str, Any], now: float) -> dict[str, Any] | None:
        latch = data["runtime"].get("nightLatch")
        if not latch or now >= stamp(latch["validUntil"]):
            return None
        deadline = stamp(latch["morningDeadlineAt"], True)
        return latch if deadline is None or now < deadline else None

    @staticmethod
    def matches_night_session(data: dict[str, Any], latch: dict[str, Any], state: dict[str, Any], pair: str, now: float, allow_original: bool = False) -> bool:
        if pair != latch.get("pair", data["runtime"].get("sourcePair")):
            return False
        if state["sessionId"] == latch["sessionId"] and (not latch.get("scheduledNight") or allow_original):
            return True
        # The PC's schedule-only latch has no phone nightLockedAt fact. After
        # 04:00 the phone legitimately uses day:<wakeDate>; bind only that dated
        # morning to this pair, never arbitrary new sessions or other mornings.
        if not latch.get("scheduledNight"):
            return False
        wake = stamp(latch["wakeAt"], True)
        incoming_wake = stamp(state["schedule"]["wakeAt"], True)
        if wake is None or incoming_wake is None:
            return False
        date = datetime.fromtimestamp(wake, ZoneInfo("Europe/Berlin")).date().isoformat()
        incoming_date = datetime.fromtimestamp(incoming_wake, ZoneInfo("Europe/Berlin")).date().isoformat()
        return state["sessionId"] == "day:" + date and state["date"] == date and incoming_date == date and plan_date(now) == date

    def ack(self, revision: str, now: float | None = None) -> dict[str, Any]:
        now = self.clock() if now is None else now
        data = self.store.read()
        state, warnings, pref = self._effective(data, now)
        date = state["date"] if state else plan_date(now)
        mode = "paused"
        target = None
        if state:
            target = self._target(data, state, now)
            if state["state"] == "MORNING_COMPLETED":
                mode = "released"
            elif data["runtime"].get("suspendedDate") == plan_date(now):
                mode = "suspended-today"
            elif "legacy-conflict" in warnings:
                mode = "legacy-conflict"
            elif not warnings and pref["enforceEnabled"] and target is not None:
                mode = "locked" if data["runtime"].get("observedLocked") is True else "scheduled"
        effective = {"date": date, "mode": mode}
        if target is not None and mode in {"scheduled", "locked"}:
            effective["stopAt"] = utc(target)
        return {"type": "ack", "revision": revision, "receivedAt": utc(now), "effective": effective,
                "companion": {"version": __version__, "protocol": 3}, "warnings": warnings}

    def _target(self, data: dict[str, Any], state: dict[str, Any], now: float) -> float | None:
        runtime = data["runtime"]
        schedule = state["schedule"]
        target_key = "bedAt" if state["prefs"].get("bedtimeSequence", False) else "pcStopAt" if "pcStopAt" in schedule else "bedAt"
        target = stamp(schedule[target_key], True)
        extension = runtime.get("extensionAt")
        if extension is not None and runtime.get("extensionRevision") == state["revision"]:
            target = extension
        emergency = runtime.get("emergencyUntil")
        if emergency is not None and emergency > now and runtime.get("emergencySessionId") == state["sessionId"]:
            target = emergency
        return target

    def _phase(self, data: dict[str, Any], state: dict[str, Any], now: float, target: float | None) -> str:
        phase = state["state"]
        if phase == "MORNING_COMPLETED":
            return phase
        latch = self.active_latch(data, now)
        if latch and latch["sessionId"] == state["sessionId"]:
            deadline = stamp(latch["morningDeadlineAt"], True)
            if now < stamp(latch["validUntil"]) and (deadline is None or now < deadline):
                wake = stamp(latch["wakeAt"], True)
                return "MORNING_PENDING" if wake is not None and now >= wake else "NIGHT_LOCK"
        if target is not None and now >= target:
            return "BEDTIME_HARD_CUT"
        schedule = state["schedule"]
        if state["prefs"].get("singleTransition", False):
            # This is the chosen phone reminder, not a synthetic T30 offset.
            # Moving the PC stop does not move or replay this independent choice.
            if phase in {"MORNING_PENDING", "MORNING_ACTIVE", "ALARM_RINGING", "ZOMBIE_MODE", "NIGHT_LOCK"}:
                return phase
            wind = stamp(schedule["windDownAt"], True)
            if wind is not None and now >= wind:
                return "EVENING_WIND_DOWN"
            return phase if phase not in {"WIND_DOWN_T30", "BRAIN_DUMP_T10", "EVENING_WIND_DOWN", "BEDTIME_HARD_CUT"} else "DAY_ACTIVE"
        if target is None:
            return phase
        # The phone supplies its T30/T10 offsets relative to bedAt. Preserve the
        # chosen PC stop by shifting the whole sequence, not only the final cut.
        base = stamp(schedule["bedAt"], True)
        delta = target - (base if base is not None else target)
        brain = stamp(state["schedule"]["brainDumpAt"], True)
        wind = stamp(state["schedule"]["windDownAt"], True)
        if brain is not None and now >= brain + delta:
            return "BRAIN_DUMP_T10"
        if wind is not None and now >= wind + delta:
            return "WIND_DOWN_T30"
        # Cached timed phases cannot outlive a deliberate extension. The new
        # supplied thresholds above determine when their banner/ducking resumes.
        # An independent evening transition and a real night latch stay intact.
        return phase if phase not in NIGHT | {"WIND_DOWN_T30", "BRAIN_DUMP_T10"} else "DAY_ACTIVE"

    def tick(self, now: float | None = None) -> dict[str, Any]:
        now = self.clock() if now is None else now
        data = self.store.read()
        rollback = now < self.last_now
        self.last_now = now
        try:
            sample = self.platform.sample()
        except Exception:
            sample = {"locked": None, "idleSeconds": 0}
        if data["runtime"].get("observedLocked") != sample.get("locked"):
            self.store.update(lambda item: item["runtime"].update(observedLocked=sample.get("locked")))
        if rollback or sample.get("powerEvent") in {"resume", "wake"}:
            self.store.update(lambda item: item["runtime"].update(graceStartedAt=None, actedTarget=None, lastLockAt=0))
            data = self.store.read()
        self._observe_rest(sample, data, now)
        state, warnings, pref = self._effective(data, now)
        phase = "IDLE"
        target = None
        grace_remaining = None
        dim = 0.0
        morning = None
        card_id = None
        card_kind = None
        time_pill = None
        if_then = None
        message = "Mit deinem Handy koppeln" if not data["pairs"] else "Warte auf einen aktuellen Abendplan"
        test_mode = self.test_started is not None
        if test_mode:
            elapsed = max(0, now - self.test_started)
            phase = "WIND_DOWN_T30" if elapsed < 40 else "BRAIN_DUMP_T10" if elapsed < 80 else "BEDTIME_HARD_CUT"
            target = self.test_started + 120
            message = "Testabend · keine Sperre und kein Herunterfahren"
            if elapsed >= 120:
                self.test_started = None
        elif state:
            target = self._target(data, state, now)
            phase = self._phase(data, state, now, target)
            suspended = data["runtime"].get("suspendedDate") == plan_date(now)
            valid = not any(item in warnings for item in ("clock-skew", "source-expired", "legacy-conflict", "morning-deadline-reached", "link-stale")) and not suspended
            enabled = valid and pref["enforceEnabled"]
            self._light_hint(data, state, now, phase, valid)
            # A live, explicitly enabled night schedule starts its finite watchdog
            # at bedtime even if the user has not yet scanned the phone's QR/NFC.
            if enabled and pref["strictLock"] and target is not None and now >= target and state["state"] != "MORNING_COMPLETED" and not state.get("_briefing") and not self.active_latch(data, now):
                latch = {"pair": data["runtime"].get("sourcePair"), "sessionId": state["sessionId"], "date": state["date"], "validUntil": state["validUntil"], "morningDeadlineAt": state["schedule"]["morningDeadlineAt"], "wakeAt": state["schedule"]["wakeAt"], "state": deepcopy(state), "scheduledNight": True}
                self.store.update(lambda item: item["runtime"].update(nightLatch=latch))
                data = self.store.read()
            if suspended:
                phase = "IDLE"; message = "Heute ohne PC-Stopp"
            elif warnings:
                message = {"clock-skew": "Bitte Windows-Uhr und Handy-Uhr abgleichen", "source-expired": "Plan abgelaufen · Handy erneut abgleichen", "link-stale": "Handy nicht verbunden · PC-Automatik pausiert", "legacy-conflict": "Klassisches PC-Stopp-Paket zuerst prüfen", "local-enforcement-off": "PC-Automatik ist ausgeschaltet", "morning-deadline-reached": "Schutzzeit beendet · Morgen am Handy prüfen"}.get(warnings[0], "Plan prüfen")
            else:
                message = "Dein nächster Schritt wartet auf dem Handy"
            if valid and pref["dimEnabled"] and target is not None and phase not in {"MORNING_COMPLETED", "MORNING_PENDING"} and sample.get("locked") is not True:
                if pref.get("singleTransition", False):
                    wind = stamp(state["schedule"]["windDownAt"], True)
                    fraction = (now - wind) / (target - wind) if wind is not None and wind < target else float(now >= target)
                    dim = max(0.0, min(pref["dimMax"], pref["dimMax"] * fraction)) if phase in {"EVENING_WIND_DOWN", "BEDTIME_HARD_CUT", "NIGHT_LOCK"} else 0.0
                else:
                    dim = max(0.0, min(pref["dimMax"], pref["dimMax"] * (1 - (target - now) / 1800)))
            if phase in {"BEDTIME_HARD_CUT", "NIGHT_LOCK", "MORNING_PENDING"} and target is not None and now >= target and enabled:
                runtime = data["runtime"]
                grace = runtime.get("graceStartedAt")
                if grace is None:
                    self.store.update(lambda item: item["runtime"].update(graceStartedAt=now))
                    grace = now
                grace_remaining = max(0, int(pref["graceSeconds"] - (now - grace)))
                if grace_remaining == 0 and not runtime.get("actedTarget"):
                    self._act(pref["stopAction"], state, target, now)
                if pref["strictLock"] and (state["lockEnforced"] or (self.active_latch(data, now) or {}).get("scheduledNight")) and sample.get("locked") is False and runtime.get("actedTarget") and now - runtime.get("lastLockAt", 0) >= 10:
                    try:
                        self.platform.lock()
                        self.store.update(lambda item: item["runtime"].update(lastLockAt=now))
                    except Exception:
                        message = "Windows konnte die Sperre noch nicht ausführen"
            elif data["runtime"].get("graceStartedAt") is not None:
                self.store.update(lambda item: item["runtime"].update(graceStartedAt=None, actedTarget=None))
            if self.audio:
                self.audio.tick(now, valid and pref["audioDuck"] and not pref.get("singleTransition", False) and phase in {"BRAIN_DUMP_T10", "BEDTIME_HARD_CUT", "NIGHT_LOCK"} and sample.get("locked") is not True)
            morning = self._morning_countdown(data, state, now, phase, valid)
            if morning is not None and 0 < morning["remainingSeconds"] <= 600:
                receipt = f"morning:{state['date']}:{morning['kind']}:{morning['targetAt']}"
                if self._morning_card_id == receipt or self._claim_hint(receipt):
                    self._morning_card_id = receipt
                    card_id, card_kind = receipt, "morning"
            else:
                self._morning_card_id = None
            if valid and pref.get("singleTransition", False) and phase == "EVENING_WIND_DOWN":
                receipt = "transition:" + state["date"]
                # No late catch-up after a restart or a long offline gap.
                wind = stamp(state["schedule"]["windDownAt"], True)
                if self._transition_card_id == receipt or wind is not None and 0 <= now - wind <= 300 and self._claim_hint(receipt):
                    self._transition_card_id = receipt
                    card_id, card_kind = receipt, "transition"
            else:
                self._transition_card_id = None
            if valid and phase in {"EVENING_WIND_DOWN", "WIND_DOWN_T30", "BRAIN_DUMP_T10", "BEDTIME_HARD_CUT", "NIGHT_LOCK"}:
                if_then = pref.get("ifThen")
            if (valid and data["localPrefs"].get("timePillEnabled", False) and target is not None and 0 < target - now <= 3600
                    and morning is None and state["state"] not in NIGHT and not state["lockEnforced"]
                    and phase in {"IDLE", "DAY_ACTIVE", "EVENING_WIND_DOWN", "WIND_DOWN_T30", "BRAIN_DUMP_T10"}):
                time_pill = {"targetAt": utc(target), "remainingSeconds": max(0, int(target - now))}
            if phase == "MORNING_COMPLETED" and state.get("brainDump") and data["runtime"].get("shownBrainDump") != state["sessionId"]:
                note = state["brainDump"]
                if self.ui:
                    self.ui.show_note("Für heute gemerkt", note["text"] + ("\n" + note["nextStep"] if note.get("nextStep") else ""))
                self.store.update(lambda item: item["runtime"].update(shownBrainDump=state["sessionId"]))
        if self.audio and (not state or test_mode):
            self.audio.restore()
        if not state or test_mode:
            self._morning_card_id = self._transition_card_id = None
        remaining = max(0, int(target - now)) if target is not None else 0
        view = {"state": phase, "phase": phase, "title": {"EVENING_WIND_DOWN": "Dein sanfter Abendübergang", "WIND_DOWN_T30": "Zeit für deinen Übergang", "BRAIN_DUMP_T10": "Gedanken für morgen parken", "BEDTIME_HARD_CUT": "Jetzt in Ruhe speichern", "NIGHT_LOCK": "PC-Ruhe", "MORNING_PENDING": "Dein Morgen wartet", "MORNING_COMPLETED": "Morgenroutine abgeschlossen"}.get(phase, "Anker PC-Begleiter"),
                "message": message, "remainingSeconds": remaining, "graceRemaining": grace_remaining,
                "dimOpacity": dim, "prefs": pref, "legacyConflict": "legacy-conflict" in warnings,
                "paired": bool(data["pairs"]), "testMode": test_mode, "warnings": warnings,
                "morning": morning, "cardId": card_id, "cardKind": card_kind, "ifThen": if_then, "timePill": time_pill,
                "desktopPrefs": deepcopy(data.get("desktopPrefs", {})),
                "localPrefs": {"enforceEnabled": False, "strictLock": False, "dimEnabled": False, "audioDuck": False, "timePillEnabled": False, "quietSignalEnabled": False, "autoUpdateChecks": False, "dimMax": .25, "graceSeconds": 60, "stopAction": "lock", **data["localPrefs"]}}
        self.last_view = view
        if self.ui:
            self.ui.render(view)
        return view

    def _claim_hint(self, receipt: str) -> bool:
        claimed = self.store.read()["runtime"].get("shownHintIds", [])
        if receipt in claimed:
            return False
        self.store.update(lambda item: item["runtime"].update(shownHintIds=(item["runtime"].get("shownHintIds", []) + [receipt])[-30:]))
        return True

    def _morning_countdown(self, data: dict[str, Any], state: dict[str, Any], now: float, phase: str, valid: bool) -> dict[str, Any] | None:
        if (not valid or not state["prefs"]["morningCountdown"] or self.active_latch(data, now)
                or state["lockEnforced"] or state["state"] in {"ALARM_RINGING", "NIGHT_LOCK"}
                or phase in {"EVENING_WIND_DOWN", "WIND_DOWN_T30", "BRAIN_DUMP_T10", "BEDTIME_HARD_CUT", "NIGHT_LOCK", "ALARM_RINGING"}):
            return None
        schedule = state["schedule"]
        home = schedule.get("homeOffice")
        if not isinstance(home, bool):
            return None
        target = stamp(schedule.get("workStartAt" if home else "leaveAt"), True)
        if target is None or not now < target <= stamp(state["validUntil"]):
            return None
        wake = stamp(schedule.get("wakeAt"), True)
        if wake is not None:
            if now < wake:
                return None
        elif target - now > 3 * 3600:
            return None
        return {"kind": "work" if home else "leave", "title": "Arbeitsbeginn" if home else "Losgehen",
                "targetAt": utc(target), "remainingSeconds": max(0, int(target - now))}

    def _light_hint(self, data: dict[str, Any], state: dict[str, Any], now: float, phase: str, valid: bool) -> None:
        """Phone-owned, opt-in visual reminder only; no late catch-up or effects."""
        at = state["schedule"].get("lightHintAt")
        if not self.ui or not valid or at is None or state["lockEnforced"] or phase in NIGHT | {"WIND_DOWN_T30", "BRAIN_DUMP_T10", "EVENING_WIND_DOWN", "MORNING_COMPLETED"}:
            return
        if not 0 <= now - stamp(at) <= 300:
            return
        receipt = state["date"]
        if receipt in data["runtime"].get("shownLightHintDates", []):
            return
        # Persist before enqueueing so a restart cannot replay an already accepted hint.
        self.store.update(lambda item: item["runtime"].update(shownLightHintDates=(item["runtime"].get("shownLightHintDates", []) + [receipt])[-14:]))
        self.ui.show_note("Abendlicht", "Deckenlicht aus, warmes Licht an.")

    def _act(self, action: str, state: dict[str, Any], target: float, now: float) -> None:
        try:
            if action == "hibernate":
                self.platform.hibernate()
            elif action == "shutdown":
                self.platform.shutdown()
            else:
                self.platform.lock()
            self.store.update(lambda item: item["runtime"].update(actedTarget=target, lastLockAt=now))
            if action == "shutdown":
                self.store.event(now, state["date"], "shutdown-started")
        except Exception:
            self.store.event(now, state["date"], "shutdown-blocked")

    def _observe_rest(self, sample: dict[str, Any], data: dict[str, Any], now: float) -> None:
        state = data.get("snapshot")
        if not state:
            return
        runtime = data["runtime"]
        bed = stamp(state["schedule"]["bedAt"], True)
        rest = runtime.get("rest")
        if rest is None and (bed is None or not bed - 7200 <= now <= stamp(state["validUntil"])):
            return
        basis = "lock" if sample.get("locked") is True else "idle" if sample.get("idleSeconds", 0) >= 900 else None
        power = sample.get("powerEvent")
        if power in {"sleep", "shutdown", "logoff"}:
            basis = "user-shutdown" if power == "shutdown" else power
        if basis and rest is None:
            self.store.update(lambda item: item["runtime"].update(rest={"at": now, "basis": basis, "emitted": False}))
        elif rest:
            if not rest["emitted"] and now - rest["at"] >= 1800:
                self.store.event(rest["at"], plan_date(rest["at"]), "pc-rest", basis=rest["basis"])
                self.store.update(lambda item: item["runtime"]["rest"].update(emitted=True))
                rest["emitted"] = True
            if not basis:
                if rest["emitted"]:
                    self.store.event(now, state["date"], "pc-resumed")
                self.store.update(lambda item: item["runtime"].update(rest=None))

    def system_event(self, name: str) -> None:
        """Called synchronously by WM_ENDSESSION/power hooks before Windows suspends."""
        if name not in {"sleep", "shutdown", "logoff"}:
            return
        data = self.store.read()
        self._observe_rest({"powerEvent": name, "locked": None, "idleSeconds": 0}, data, self.clock())

    def extend(self, minutes: int, now: float | None = None) -> None:
        now = self.clock() if now is None else now
        data = self.store.read(); state, _, pref = self._effective(data, now)
        if not state:
            raise ProtocolError("no-schedule")
        if pref["strictLock"]:
            raise ProtocolError("phone-override-required")
        target = max(now, self._target(data, state, now) or now) + minutes * 60
        self.store.update(lambda item: item["runtime"].update(extensionAt=target, extensionRevision=state["revision"], graceStartedAt=None, actedTarget=None, nightLatch=None))
        anchor = {"anchor": "bed"} if state["prefs"].get("bedtimeSequence", False) else {}
        self.store.event(now, state["date"], "extended", newStopAt=utc(target), **anchor)

    def _extension_context(self, now: float) -> tuple[dict[str, Any], dict[str, Any]]:
        state, warnings, pref = self._effective(self.store.read(), now)
        if not state or any(warning in warnings for warning in {"source-expired", "clock-skew", "link-stale"}):
            raise ProtocolError("no-schedule")
        if pref["strictLock"]:
            raise ProtocolError("phone-override-required")
        return state, pref

    def preview_extension_until(self, local_time: str, now: float | None = None) -> dict[str, Any]:
        """Preview only explicit bounds; no stored change, work fact or wake adjustment."""
        now = self.clock() if now is None else now
        state, pref = self._extension_context(now)
        target = next_local_time(local_time, now)
        result: dict[str, Any] = {"pcStopAt": utc(target)}
        bed = target if pref.get("bedtimeSequence", False) else target + pref["bedAfterStopMin"] * 60 if "bedAfterStopMin" in pref else None
        wake = stamp(state["schedule"]["wakeAt"], True)
        if bed is not None:
            result["bedAt"] = utc(bed)
        if wake is not None:
            result["wakeAt"] = utc(wake)
        if bed is not None and wake is not None:
            result["sleepOpportunityMinutes"] = max(0, int((wake - bed) // 60))
        return result

    def extend_until(self, local_time: str, now: float | None = None, *, expected_target_at: str | None = None) -> None:
        now = self.clock() if now is None else now
        state, _ = self._extension_context(now)
        target = next_local_time(local_time, now)
        if expected_target_at is not None and stamp(expected_target_at) != target:
            raise ProtocolError("preview-expired")
        # Keep the same existing revision/extension and outbox path as +15/+30.
        # A paused day stays paused; selecting a time never resumes it implicitly.
        with self.store.transaction():
            self.store.update(lambda item: item["runtime"].update(extensionAt=target, extensionRevision=state["revision"], graceStartedAt=None, actedTarget=None, nightLatch=None))
            anchor = {"anchor": "bed"} if state["prefs"].get("bedtimeSequence", False) else {}
            self.store.event(now, state["date"], "extended", newStopAt=utc(target), **anchor)

    def pause(self, now: float | None = None) -> None:
        now = self.clock() if now is None else now
        data = self.store.read(); _, _, pref = self._effective(data, now)
        if pref["strictLock"]:
            raise ProtocolError("phone-override-required")
        self.store.update(lambda item: item["runtime"].update(suspendedDate=plan_date(now), graceStartedAt=None, actedTarget=None, nightLatch=None))
        self.store.event(now, plan_date(now), "suspended-today")

    def resume(self) -> None:
        self.store.update(lambda item: item["runtime"].update(suspendedDate=None, graceStartedAt=None, actedTarget=None))
        self.store.event(self.clock(), plan_date(self.clock()), "resumed-today")

    def save_note(self, value: str, next_step: str = "", kind: str = "save-point") -> None:
        text(value); text(next_step, empty=True)
        now = self.clock()
        fields = {"text": value}
        if next_step:
            fields["nextStep"] = next_step
        self.store.event(now, plan_date(now), kind, **fields)
        if kind == "save-point":
            self.store.update(lambda item: item["notes"].append({"text": value, "nextStep": next_step, "shown": False}))

    def start_test(self) -> None:
        self.test_started = self.clock()
        self.store.update(lambda item: item["runtime"].update(graceStartedAt=None, actedTarget=None))

    def local_settings(self, prefs: dict[str, Any]) -> None:
        bools = {"enforceEnabled", "strictLock", "dimEnabled", "audioDuck", "timePillEnabled", "quietSignalEnabled", "autoUpdateChecks"}
        if set(prefs) - bools - {"stopAction", "graceSeconds", "dimMax"} or any(not isinstance(value, bool) for key, value in prefs.items() if key in bools):
            raise ProtocolError("preference")
        if "stopAction" in prefs and prefs["stopAction"] not in {"lock", "hibernate", "shutdown"}:
            raise ProtocolError("preference")
        if "graceSeconds" in prefs and (isinstance(prefs["graceSeconds"], bool) or not isinstance(prefs["graceSeconds"], int) or not 60 <= prefs["graceSeconds"] <= 600):
            raise ProtocolError("preference")
        if "dimMax" in prefs and (isinstance(prefs["dimMax"], bool) or not isinstance(prefs["dimMax"], (int, float)) or not 0 <= prefs["dimMax"] <= .4):
            raise ProtocolError("preference")
        latch = self.active_latch(self.store.read(), self.clock())
        if latch and latch.get("state", {}).get("prefs", {}).get("strictLock") and (prefs.get("enforceEnabled") is False or prefs.get("strictLock") is False):
            raise ProtocolError("phone-override-required")
        self.store.update(lambda item: item["localPrefs"].update(prefs))
