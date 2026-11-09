from copy import deepcopy
from pathlib import Path
import tempfile
import unittest

from anker_companion.engine import CompanionEngine
from anker_companion.protocol import ProtocolError, utc
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
        self.engine.accept_state(self.value, "pair", self.clock())

    def allow(self, strict=False):
        self.engine.local_settings({"enforceEnabled": True, "strictLock": strict})

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
        self.engine.accept_state(self.value, "pair", self.clock()); self.allow(strict=True)
        self.clock.now += 1800; self.engine.tick(); self.clock.now += 60; self.engine.tick()
        self.clock.now += 9; self.engine.tick(); self.assertEqual(len(self.platform.effects), 1)
        self.clock.now += 1; self.engine.tick(); self.assertEqual(len(self.platform.effects), 2)
        with self.assertRaises(ProtocolError):
            self.engine.extend(15)
        with self.assertRaises(ProtocolError):
            self.engine.pause()

    def test_valid_night_crosses_four_and_matching_morning_completion_releases(self):
        self.value["state"] = "NIGHT_LOCK"; self.value["lockEnforced"] = True; self.value["prefs"]["strictLock"] = True
        self.engine.accept_state(self.value, "pair", self.clock()); self.allow(strict=True)
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
        self.engine.accept_state(self.value, "pair", self.clock()); self.allow(strict=True)
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


if __name__ == "__main__":
    unittest.main()
