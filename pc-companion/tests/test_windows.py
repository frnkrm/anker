from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from anker_companion.windows import MasterAudioDucker, PlatformError, WindowsPlatform
from anker_companion.ui import DesktopUI


class FakeWindows:
    def __init__(self): self.lock_calls = 0
    def lock(self): self.lock_calls += 1; return True
    def locked(self): return False
    def idle_seconds(self): return 18.5
    def notification_state(self): return 3
    def monitors(self): return [(-1920, 0, 0, 1080), (0, 0, 1920, 1080)]


class FakeVolume:
    def __init__(self, value=0.8): self.value = value; self.writes = []
    def get(self): return self.value
    def set(self, value): self.value = value; self.writes.append(value)


class WindowsBoundaryTests(unittest.TestCase):
    def test_native_actions_are_never_started_by_import_or_construction(self):
        platform = WindowsPlatform()
        self.assertIsNone(platform._api)
        if os.name != "nt":
            for action in [platform.lock, platform.hibernate, platform.shutdown, platform.sample]:
                with self.assertRaisesRegex(PlatformError, "windows-unavailable"): action()

    def test_save_grace_belongs_to_engine_not_forcing_windows_timeout(self):
        calls = []
        def runner(args, **kwargs):
            calls.append(args)
            self.assertNotIn("shell", kwargs)
            return subprocess.CompletedProcess(args, 0, "", "")
        platform = WindowsPlatform(FakeWindows(), runner)
        platform.shutdown(); platform.hibernate()
        self.assertEqual(calls, [["shutdown.exe", "/s", "/t", "0"], ["shutdown.exe", "/h"]])
        self.assertNotIn("/f", sum(calls, []))

    def test_unknown_legacy_query_fails_closed(self):
        responses = [(0, "", ""), (1, "", "Access is denied"), (1, "", "The system cannot find the file specified."), (1, "", "Das System kann die angegebene Datei nicht finden.")]
        for response, expected in zip(responses, [True, True, False, False]):
            def runner(args, **_kwargs): return subprocess.CompletedProcess(args, *response)
            self.assertEqual(WindowsPlatform(runner=runner).legacy_conflict(), expected)

    def test_only_seconds_and_session_events_are_sampled(self):
        platform = WindowsPlatform(FakeWindows())
        platform._event("sleep")
        self.assertEqual(platform.sample(), {"locked": False, "idleSeconds": 18.5, "powerEvent": "sleep"})
        self.assertEqual(platform.sample(), {"locked": False, "idleSeconds": 18.5})

    def test_callback_can_persist_session_event_immediately(self):
        events = []
        platform = WindowsPlatform(FakeWindows(), on_system_event=events.append)
        platform._event("shutdown")
        self.assertEqual(events, ["shutdown"])

    def test_audio_starts_only_after_opt_in_and_waits_full_minute(self):
        endpoint = FakeVolume(); ducker = MasterAudioDucker(endpoint)
        ducker.tick(0, False); self.assertEqual(endpoint.writes, [])
        ducker.tick(10, True); ducker.tick(69, True); self.assertEqual(endpoint.writes, [])
        ducker.tick(70, True); self.assertAlmostEqual(endpoint.value, 0.8*0.91)
        ducker.tick(70, True); self.assertEqual(len(endpoint.writes), 1)

    def test_audio_floor_and_restore_do_not_raise_a_quiet_original_level(self):
        for value in [0.1, 0.8]:
            endpoint = FakeVolume(value); ducker = MasterAudioDucker(endpoint)
            ducker.tick(0, True); ducker.tick(6000, True)
            self.assertAlmostEqual(endpoint.value, min(value, 0.2))
            ducker.restore(); self.assertAlmostEqual(endpoint.value, value)

    def test_manual_volume_change_wins_and_is_never_undone(self):
        endpoint = FakeVolume(); ducker = MasterAudioDucker(endpoint)
        ducker.tick(0, True); ducker.tick(60, True)
        endpoint.value = 0.4
        ducker.tick(120, True); ducker.tick(600, True); ducker.restore()
        self.assertEqual(endpoint.value, 0.4)

    def test_manual_change_at_stop_is_not_overwritten(self):
        endpoint = FakeVolume(); ducker = MasterAudioDucker(endpoint)
        ducker.tick(0, True); ducker.tick(60, True)
        endpoint.value = 0.25
        ducker.restore(); self.assertEqual(endpoint.value, 0.25)

    def test_ui_holds_snapshot_copy_and_never_constructs_tk_on_import(self):
        ui = DesktopUI(lambda _action: None)
        snapshot = {"state": "NIGHT_LOCK", "prefs": {"strictLock": True}}
        ui.render(snapshot); snapshot["prefs"]["strictLock"] = False
        kind, captured = ui.queue.get_nowait()
        self.assertEqual(kind, "render"); self.assertTrue(captured["prefs"]["strictLock"])
        self.assertIsNone(ui.root)

    def test_strict_ui_does_not_issue_extension_or_pause(self):
        actions = []; notes = []
        ui = DesktopUI(actions.append); ui.snapshot = {"prefs": {"strictLock": True}}
        with patch.object(ui, "_note", side_effect=lambda *args: notes.append(args)):
            ui._extend(15); ui._pause()
        self.assertEqual(actions, []); self.assertEqual(len(notes), 2)
        ui.snapshot = {"prefs": {"strictLock": False}}
        ui._extend(30); ui._pause()
        self.assertEqual(actions, [{"action": "extend", "minutes": 30}, {"action": "pause"}])


if __name__ == "__main__": unittest.main()
