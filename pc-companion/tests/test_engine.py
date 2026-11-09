from copy import deepcopy
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace

from anker_companion.engine import CompanionEngine
from anker_companion.protocol import ProtocolError, plan_date, utc
from anker_companion.storage import AtomicStateStore
from tests.helpers import Clock, FakePlatform, TestVault, state


class EngineTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.clock = Clock()
        self.platform = FakePlatform()
        self.vault = TestVault()
        self.store = AtomicStateStore(Path(self.directory.name) / "state", self.vault)
        self.engine = CompanionEngine(self.store, self.platform, self.clock)
        self.value = state(self.clock)
        # These effect tests explicitly choose the prepared fixed-time fallback;
        # separate tests below exercise the default pause-on-disconnect policy.
        self.value["prefs"]["offlinePolicy"] = "fixed-time"
        self.engine.accept_state(self.value, "pair", self.clock())

    def allow(self, strict=False):
        self.engine.local_settings({"enforceEnabled": True, "strictLock": strict})

    def different_stop_timeline(self, bedtime_sequence):
        directory = tempfile.TemporaryDirectory(); self.addCleanup(directory.cleanup)
        clock = Clock("2026-11-12T20:00:00Z")
        platform = FakePlatform()
        store = AtomicStateStore(Path(directory.name) / "state", TestVault())
        audio_ticks = []
        audio = SimpleNamespace(tick=lambda at, enabled: audio_ticks.append((at, enabled)), restore=lambda: None)
        engine = CompanionEngine(store, platform, clock, audio=audio)
        value = state(clock, state="DAY_ACTIVE")
        value["prefs"].update(bedtimeSequence=bedtime_sequence, offlinePolicy="fixed-time", audioDuck=True)
        bed = clock() + 7200  # 23:00 Berlin, separate PC stop at 22:30.
        pc_stop = bed - 1800
        value["schedule"].update(pcStopAt=utc(pc_stop), bedAt=utc(bed), windDownAt=utc(bed - 1800), brainDumpAt=utc(bed - 600))
        engine.local_settings({"enforceEnabled": True, "audioDuck": True})
        engine.accept_state(value, "pair", clock())
        return clock, platform, engine, audio_ticks, bed if bedtime_sequence else pc_stop

    def test_selected_bedtime_or_legacy_pc_stop_runs_all_three_phases(self):
        for bedtime_sequence in (False, True):
            with self.subTest(bedtimeSequence=bedtime_sequence):
                clock, platform, engine, audio_ticks, cut = self.different_stop_timeline(bedtime_sequence)
                clock.now = cut - 1801
                self.assertEqual(engine.tick()["state"], "DAY_ACTIVE")
                clock.now = cut - 1800
                wind = engine.tick()
                self.assertEqual((wind["state"], wind["remainingSeconds"], wind["graceRemaining"]), ("WIND_DOWN_T30", 1800, None))
                self.assertFalse(audio_ticks[-1][1])
                clock.now = cut - 600
                brain = engine.tick()
                self.assertEqual((brain["state"], brain["remainingSeconds"]), ("BRAIN_DUMP_T10", 600))
                self.assertTrue(audio_ticks[-1][1])
                clock.now = cut
                self.assertEqual(engine.tick()["graceRemaining"], 60)
                clock.now += 59
                self.assertEqual(engine.tick()["graceRemaining"], 1)
                self.assertEqual(platform.effects, [])
                clock.now += 1
                self.assertEqual(engine.tick()["graceRemaining"], 0)
                self.assertEqual(platform.effects, ["lock"])
                platform.observation["locked"] = True; engine.tick()
                self.assertEqual(engine.ack("rev1")["effective"], {"date": "2026-11-12", "mode": "locked", "stopAt": utc(cut)})

    def test_extension_moves_the_complete_sequence_for_both_timing_choices(self):
        for bedtime_sequence in (False, True):
            with self.subTest(bedtimeSequence=bedtime_sequence):
                clock, platform, engine, _audio_ticks, original_cut = self.different_stop_timeline(bedtime_sequence)
                engine.extend(15)
                extended = engine.store.read()["outbox"][-1]
                self.assertEqual(extended["newStopAt"], utc(original_cut + 900))
                if bedtime_sequence:
                    self.assertEqual(extended["anchor"], "bed")
                else:
                    self.assertNotIn("anchor", extended)
                cut = original_cut + 900
                clock.now = original_cut - 1800
                self.assertEqual(engine.tick()["state"], "DAY_ACTIVE")
                clock.now = cut - 1800
                self.assertEqual(engine.tick()["state"], "WIND_DOWN_T30")
                clock.now = cut - 600
                self.assertEqual(engine.tick()["state"], "BRAIN_DUMP_T10")
                clock.now = cut
                self.assertEqual(engine.tick()["graceRemaining"], 60)
                self.assertEqual(platform.effects, [])

    def test_no_effect_without_both_explicit_permissions(self):
        self.clock.now += 2000
        self.engine.tick(); self.clock.now += 120; self.engine.tick()
        self.assertEqual(self.platform.effects, [])
        self.allow(); self.value["prefs"]["enforceEnabled"] = False
        self.engine.accept_state(self.value, "pair", self.clock())
        self.engine.tick(); self.clock.now += 120; self.engine.tick()
        self.assertEqual(self.platform.effects, [])

    def test_full_save_grace_then_lock_and_no_second_ordinary_lock(self):
        self.allow(); self.clock.now += 1800
        self.assertEqual(self.engine.tick()["graceRemaining"], 60)
        self.clock.now += 59; self.engine.tick()
        self.assertEqual(self.platform.effects, [])
        self.clock.now += 1; self.engine.tick(); self.clock.now += 10; self.engine.tick()
        self.assertEqual(self.platform.effects, ["lock"])
        # A successful API request is not a confirmed observed locked desktop.
        self.assertEqual(self.engine.ack("rev1")["effective"]["mode"], "scheduled")
        self.platform.observation["locked"] = True; self.engine.tick()
        self.assertEqual(self.engine.ack("rev1")["effective"]["mode"], "locked")

    def test_restart_wake_and_clock_rollback_restart_grace(self):
        self.allow(); self.clock.now += 1800; self.engine.tick(); self.clock.now += 50
        self.engine = CompanionEngine(self.store, self.platform, self.clock)
        self.assertEqual(self.engine.tick()["graceRemaining"], 60)
        self.clock.now += 50; self.platform.observation["powerEvent"] = "resume"
        self.assertEqual(self.engine.tick()["graceRemaining"], 60)
        self.clock.now -= 10
        self.assertEqual(self.engine.tick()["graceRemaining"], 60)
        self.assertEqual(self.platform.effects, [])

    def test_expired_lease_legacy_and_clock_skew_never_lock(self):
        self.allow(); self.clock.now += 1800
        self.platform.conflict = True; self.engine._legacy_checked = float("-inf")
        self.assertIn("legacy-conflict", self.engine.tick()["warnings"])
        self.platform.conflict = False; self.engine._legacy_checked = float("-inf")
        self.engine.accept_state(self.value, "pair", self.clock() + 121)
        self.assertIn("clock-skew", self.engine.tick()["warnings"])
        self.clock.now += 13 * 3600
        self.assertIn("source-expired", self.engine.tick()["warnings"])
        self.assertEqual(self.platform.effects, [])

    def test_standard_extension_survives_same_briefing_but_new_plan_replaces_it(self):
        self.allow(); self.engine.extend(15)
        expected = self.store.read()["runtime"]["extensionAt"]
        self.engine.accept_state(self.value, "pair", self.clock())
        self.assertEqual(self.store.read()["runtime"]["extensionAt"], expected)
        other = deepcopy(self.value); other["revision"] = "rev2"
        self.engine.accept_state(other, "pair", self.clock())
        self.assertIsNone(self.store.read()["runtime"]["extensionAt"])

    def test_strict_relock_each_ten_seconds_and_reject_pc_extension(self):
        self.value["prefs"]["strictLock"] = True; self.value["lockEnforced"] = True; self.value["state"] = "NIGHT_LOCK"
        self.allow(strict=True); self.engine.accept_state(self.value, "pair", self.clock())
        self.clock.now += 1800; self.engine.tick(); self.clock.now += 60; self.engine.tick()
        self.clock.now += 9; self.engine.tick(); self.assertEqual(len(self.platform.effects), 1)
        self.clock.now += 1; self.engine.tick(); self.assertEqual(len(self.platform.effects), 2)
        with self.assertRaises(ProtocolError):
            self.engine.extend(15)
        with self.assertRaises(ProtocolError):
            self.engine.pause()

    def test_valid_night_crosses_four_and_matching_morning_completion_releases(self):
        self.value["state"] = "NIGHT_LOCK"; self.value["lockEnforced"] = True; self.value["prefs"]["strictLock"] = True
        self.allow(strict=True); self.engine.accept_state(self.value, "pair", self.clock())
        self.clock.now += 8 * 3600  # 06:00 Berlin next day, same night lease.
        self.engine.tick(); self.clock.now += 60; self.engine.tick()
        self.assertEqual(self.platform.effects, ["lock"])
        wrong = deepcopy(self.value); wrong.update(state="MORNING_COMPLETED", sessionId="wrong")
        with self.assertRaises(ProtocolError):
            self.engine.accept_state(wrong, "pair", self.clock())
        completed = deepcopy(self.value); completed["state"] = "MORNING_COMPLETED"
        self.engine.accept_state(completed, "pair", self.clock())
        self.clock.now += 30; self.engine.tick()
        self.assertEqual(self.platform.effects, ["lock"])
        self.assertEqual(self.engine.ack("rev1")["effective"]["mode"], "released")

    def test_ordinary_day_snapshot_does_not_release_strict_night_latch(self):
        self.value["state"] = "NIGHT_LOCK"; self.value["lockEnforced"] = True; self.value["prefs"]["strictLock"] = True
        self.allow(strict=True); self.engine.accept_state(self.value, "pair", self.clock())
        self.clock.now += 1800; self.engine.tick(); self.clock.now += 60; self.engine.tick()
        changed = deepcopy(self.value)
        changed.update(state="DAY_ACTIVE", lockEnforced=False, revision="ordinary-new-plan", generatedAt=utc(self.clock()))
        changed["prefs"].update(enforceEnabled=False, strictLock=False)
        changed["schedule"]["bedAt"] = utc(self.clock() + 3600)
        self.engine.accept_state(changed, "pair", self.clock())
        self.clock.now += 10; self.engine.tick()
        self.assertEqual(self.platform.effects, ["lock", "lock"])
        with self.assertRaises(ProtocolError):
            self.engine.local_settings({"strictLock": False})

    def test_suspend_today_and_test_mode_never_enforce(self):
        self.allow(); self.engine.pause(); self.clock.now += 1900
        self.engine.tick(); self.clock.now += 120; self.engine.tick()
        self.assertEqual(self.platform.effects, [])
        self.engine.resume(); self.engine.start_test(); self.clock.now += 100
        self.assertTrue(self.engine.tick()["testMode"])
        self.assertEqual(self.platform.effects, [])

    def test_rest_is_only_after_thirty_minutes_and_resume_is_distinct(self):
        self.platform.observation["locked"] = True
        self.engine.tick(); self.clock.now += 1799; self.engine.tick()
        self.assertEqual(self.store.read()["outbox"], [])
        self.clock.now += 1; self.engine.tick()
        self.assertEqual([item["kind"] for item in self.store.read()["outbox"]], ["pc-rest"])
        self.platform.observation["locked"] = False; self.engine.tick()
        self.assertEqual([item["kind"] for item in self.store.read()["outbox"]], ["pc-rest", "pc-resumed"])

    def test_transaction_rolls_back_receipt_and_effect_on_durable_failure(self):
        before = self.store.read(); self.vault.fail = True
        with self.assertRaises(OSError):
            with self.store.transaction():
                self.engine.save_note("Synthetischer Speicherpunkt")
                self.store.update(lambda item: item["commandIds"].append("receipt"))
        self.assertEqual(self.store.read(), before)
        self.vault.fail = False
        restored = AtomicStateStore(self.store.path, self.vault)
        self.assertEqual(restored.read(), before)

    def test_offline_pause_has_no_new_system_effects_after_ninety_seconds(self):
        self.value["prefs"].update(offlinePolicy="pause", dimEnabled=True, audioDuck=True)
        self.engine.accept_state(self.value, "pair", self.clock()); self.allow()
        self.engine.local_settings({"dimEnabled": True, "audioDuck": True})
        self.clock.now += 1800
        view = self.engine.tick()
        self.assertIn("link-stale", view["warnings"])
        self.assertEqual(view["dimOpacity"], 0)
        self.assertIsNone(view["graceRemaining"])
        self.clock.now += 120; self.engine.tick()
        self.assertEqual(self.platform.effects, [])

    def test_phone_strict_state_never_removes_unconsented_local_choice(self):
        self.value.update(state="NIGHT_LOCK", lockEnforced=True)
        self.value["prefs"]["strictLock"] = True
        self.engine.accept_state(self.value, "pair", self.clock())
        self.assertIsNone(self.engine.active_latch(self.store.read(), self.clock()))
        self.engine.local_settings({"enforceEnabled": True, "strictLock": False})
        self.engine.local_settings({"enforceEnabled": False})
        self.clock.now += 1800; self.engine.tick(); self.clock.now += 60; self.engine.tick()
        self.assertEqual(self.platform.effects, [])

    def test_authenticated_heartbeat_preserves_older_generated_state_until_lease(self):
        self.value["prefs"]["offlinePolicy"] = "pause"
        self.engine.accept_state(self.value, "pair", self.clock()); self.allow()
        self.clock.now += 1800; self.engine.link_contact()
        self.assertEqual(self.engine.tick()["graceRemaining"], 60)
        self.clock.now += 60; self.engine.link_contact(); self.engine.tick()
        self.assertEqual(self.platform.effects, ["lock"])
        self.assertEqual(self.store.read()["snapshot"]["generatedAt"], self.value["generatedAt"])

    def briefing(self, mode="scheduled", policy="fixed-time"):
        prefs = deepcopy(self.value["prefs"]); prefs["offlinePolicy"] = policy
        return {"type": "briefing", "revision": "days-r1", "generatedAt": utc(self.clock()),
                "validUntil": "2026-11-15T03:00:00Z", "prefs": prefs, "days": [
                    {"date": "2026-11-12", "validUntil": "2026-11-13T03:00:00Z", "pc": {"mode": "scheduled", "stopAt": "2026-11-12T21:30:00Z", "localTime": "22:30"}},
                    {"date": "2026-11-13", "validUntil": "2026-11-14T03:00:00Z", "pc": {"mode": mode, **({"stopAt": "2026-11-13T22:00:00Z", "localTime": "23:00"} if mode == "scheduled" else {})}, "bedAt": "2026-11-13T22:30:00Z"}]}

    def test_cached_exact_next_day_uses_its_pc_time_not_yesterday_or_bedtime(self):
        self.engine.accept_briefing(self.briefing()); self.allow()
        self.clock.now = __import__("datetime").datetime.fromisoformat("2026-11-13T22:00:00+00:00").timestamp()
        ack = self.engine.ack("days-r1")
        self.assertEqual(ack["effective"], {"date": "2026-11-13", "mode": "scheduled", "stopAt": "2026-11-13T22:00:00.000Z"})
        self.assertEqual(self.engine.tick()["graceRemaining"], 60)
        self.clock.now += 60; self.engine.tick()
        self.assertEqual(self.platform.effects, ["lock"])

    def test_paused_missing_and_expired_cached_days_never_invent_schedule(self):
        self.allow(); self.engine.accept_briefing(self.briefing(mode="paused"))
        self.clock.now = __import__("datetime").datetime.fromisoformat("2026-11-13T22:00:00+00:00").timestamp()
        self.assertEqual(self.engine.ack("days-r1")["effective"]["mode"], "paused")
        self.engine.tick(); self.clock.now += 60; self.engine.tick()
        self.assertEqual(self.platform.effects, [])
        self.clock.now = __import__("datetime").datetime.fromisoformat("2026-11-14T03:00:00+00:00").timestamp()
        self.assertEqual(plan_date(self.clock()), "2026-11-14")
        self.assertIn("source-expired", self.engine.tick()["warnings"])
        self.assertEqual(self.platform.effects, [])

    def test_cached_pause_policy_still_requires_live_authenticated_contact(self):
        self.allow(); self.engine.accept_briefing(self.briefing(policy="pause"))
        self.clock.now = __import__("datetime").datetime.fromisoformat("2026-11-13T22:00:00+00:00").timestamp()
        self.assertIn("link-stale", self.engine.tick()["warnings"])
        self.assertEqual(self.platform.effects, [])
        self.engine.link_contact()
        self.assertEqual(self.engine.tick()["graceRemaining"], 60)

    def test_scheduled_strict_night_starts_before_phone_hardware_scan_and_survives_offline(self):
        self.value["prefs"].update(strictLock=True, offlinePolicy="pause")
        self.engine.accept_state(self.value, "pair", self.clock()); self.allow(strict=True)
        self.clock.now += 1800; self.engine.link_contact(); self.engine.tick()
        self.assertFalse(self.value["lockEnforced"])
        self.assertTrue(self.store.read()["runtime"]["nightLatch"]["scheduledNight"])
        self.clock.now += 100; self.engine.tick(); self.clock.now += 10; self.engine.tick()
        self.assertEqual(self.platform.effects, ["lock", "lock"])
        changed = deepcopy(self.value)
        changed.update(state="DAY_ACTIVE", generatedAt=utc(self.clock()), revision="new")
        changed["prefs"].update(strictLock=False, enforceEnabled=False)
        self.engine.accept_state(changed, "pair", self.clock())
        self.clock.now += 10; self.engine.tick()
        self.assertEqual(self.platform.effects, ["lock", "lock", "lock"])

    def test_fixed_time_daily_briefing_never_creates_unscoped_strict_watchdog(self):
        self.allow(strict=True)
        briefing = self.briefing(); briefing["prefs"]["strictLock"] = True
        self.engine.accept_briefing(briefing)
        self.clock.now = __import__("datetime").datetime.fromisoformat("2026-11-13T22:00:00+00:00").timestamp()
        self.engine.tick(); self.clock.now += 60; self.engine.tick(); self.clock.now += 20; self.engine.tick()
        self.assertEqual(self.platform.effects, ["lock"])
        self.assertIsNone(self.engine.active_latch(self.store.read(), self.clock()))


if __name__ == "__main__":
    unittest.main()
