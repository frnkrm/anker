from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
import unittest
from unittest.mock import patch
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from anker_companion.windows import MasterAudioDucker, PlatformError, WindowsPlatform
from anker_companion.ui import DesktopUI


class UiValue:
    def __init__(self, value=None): self.value = value
    def get(self): return self.value
    def set(self, value): self.value = value


class UiWidget(UiValue):
    """A callback/field double, without importing or creating a Tk interpreter."""
    def __init__(self, **options):
        super().__init__(""); self.options = options; self.destroyed = False; self.events = {}
    def pack(self, **_kwargs): return None
    def configure(self, **options): self.options.update(options)
    def title(self, _value): pass
    def geometry(self, _value): pass
    def minsize(self, *_values): pass
    def attributes(self, *_values): pass
    def overrideredirect(self, _value): pass
    def update_idletasks(self): pass
    def winfo_screenwidth(self): return 1920
    def winfo_width(self): return 600
    def delete(self, _value): self.draws = []
    def create_rectangle(self, *values, **options): self.draws.append(("rectangle", values, options))
    def create_text(self, *values, **options): self.draws.append(("text", values, options))
    def bind(self, name, callback): self.events[name] = callback
    def protocol(self, name, callback): self.events[name] = callback
    def focus_set(self): pass
    def destroy(self): self.destroyed = True
    def winfo_exists(self): return not self.destroyed
    def winfo_ismapped(self): return not self.destroyed


def ui_double(on_action):
    ui = DesktopUI(on_action)
    widgets = []; entries = []; windows = []; buttons = []; strings = []
    def widget(_parent=None, **options):
        result = UiWidget(**options); widgets.append(result); return result
    def entry(parent=None, **options):
        result = widget(parent, **options); entries.append(result); return result
    def window(parent=None, **options):
        result = widget(parent, **options); windows.append(result); return result
    def string(value=None):
        result = UiValue(value); strings.append(result); return result
    def button(parent, text, command, **_kwargs):
        result = widget(parent, text=text, command=command); buttons.append(result); return result
    ui.root = UiWidget(); ui.status = UiValue(""); ui.remaining = UiValue("")
    ui.tk = SimpleNamespace(Toplevel=window, Entry=entry, BooleanVar=UiValue, StringVar=string,
                            Checkbutton=widget, Frame=widget, Radiobutton=widget, Spinbox=widget, Scale=widget, Canvas=widget)
    ui.messagebox = SimpleNamespace(showinfo=lambda *_args, **_kwargs: None, askokcancel=lambda *_args, **_kwargs: True)
    ui._scroll_body = lambda value: value
    ui._label = lambda parent, text="", **options: widget(parent, text=text, **options)
    ui._button = button
    ui._style_window = lambda *_args, **_kwargs: None
    return ui, SimpleNamespace(widgets=widgets, entries=entries, windows=windows, buttons=buttons, strings=strings)


class DesktopActionBoundaryTests(unittest.TestCase):
    def test_evening_engine_shape_keeps_the_top_countdown_when_grace_is_null(self):
        ui, _view = ui_double(lambda _action: self.fail("Rendering must not issue a system action"))
        shown = []; ui._progress_bar = shown.append
        for state, remaining in [("WIND_DOWN_T30", 1800), ("BRAIN_DUMP_T10", 600)]:
            ui.snapshot = {"state": state, "remainingSeconds": remaining, "graceRemaining": None,
                           "title": "Gedanken für morgen parken" if state == "BRAIN_DUMP_T10" else "Zeit für deinen Übergang",
                           "message": "Dein nächster Schritt wartet auf dem Handy", "prefs": {}}
            ui._render()
            self.assertEqual(shown[-1], remaining)
            self.assertEqual(ui.remaining.get(), f"Noch {remaining // 60} Min")

    def test_brain_dump_overlay_names_the_phase_and_exposes_a_live_seconds_countdown(self):
        ui, view = ui_double(lambda _action: self.fail("Rendering must not issue a system action"))
        progress = []; ui._progress_bar = progress.append
        ui.snapshot = {"state": "BRAIN_DUMP_T10", "remainingSeconds": 600, "graceRemaining": None,
                       "title": "Gedanken für morgen parken", "message": "Öffne dafür Anker am Handy", "prefs": {}}
        ui._render()
        self.assertTrue(any(widget.options.get("text") == "Gedanken für morgen parken" for widget in view.widgets))
        self.assertTrue(any(widget.options.get("text") == "Öffne dafür Anker am Handy" for widget in view.widgets))
        ui.snapshot.update(state="BEDTIME_HARD_CUT", title="Jetzt in Ruhe speichern", graceRemaining=60, remainingSeconds=0)
        ui._render()
        count_label = next(widget for widget in reversed(view.widgets) if widget.options.get("variable") is ui.remaining)
        self.assertEqual(count_label.options["variable"].get(), "Zum Speichern: 01:00")
        # An enabled strict schedule latches NIGHT_LOCK on the next engine tick;
        # its still-running save grace must remain visible on top of the game.
        ui.snapshot.update(state="NIGHT_LOCK", title="PC-Ruhe", graceRemaining=59)
        ui._render()
        self.assertEqual(progress[-1], 59)
        self.assertEqual(count_label.options["variable"].get(), "Zum Speichern: 00:59")
        card = ui._card
        for seconds, expected in [(1, "00:01"), (0, "00:00")]:
            ui.snapshot["graceRemaining"] = seconds
            ui._render()
            self.assertIs(ui._card, card)
            self.assertEqual(count_label.options["variable"].get(), f"Zum Speichern: {expected}")

    def test_save_grace_progress_uses_its_full_duration_instead_of_thirty_minutes(self):
        ui, _view = ui_double(lambda _action: self.fail("Drawing must not issue an action"))
        ui.snapshot = {"graceRemaining": 60, "prefs": {"graceSeconds": 60}}
        ui._progress_bar(60)
        rectangle = next(value for value in ui._bar_canvas.draws if value[0] == "rectangle")
        self.assertEqual(rectangle[1][2], 600)
        self.assertIn("Speichern 01:00", ui._bar_canvas.draws[-1][2]["text"])
        ui.snapshot["graceRemaining"] = 30; ui._progress_bar(30)
        self.assertEqual(ui._bar_canvas.draws[0][1][2], 300)
        ui.snapshot["graceRemaining"] = None; ui._progress_bar(1800)
        self.assertEqual(ui._bar_canvas.draws[0][1][2], 600)
        self.assertIn("noch 30 Min", ui._bar_canvas.draws[-1][2]["text"])

    def test_settings_preserve_local_choices_when_the_phone_is_off(self):
        actions = []; ui, view = ui_double(actions.append)
        ui.snapshot = {"localPrefs": {"enforceEnabled": True, "strictLock": True, "dimEnabled": True, "audioDuck": True,
                                     "stopAction": "hibernate", "graceSeconds": 120, "dimMax": .3},
                       "prefs": {"enforceEnabled": False, "strictLock": False, "dimEnabled": False, "audioDuck": False}}
        ui._settings()
        next(button for button in view.buttons if button.options["text"] == "Übernehmen").options["command"]()
        self.assertEqual(actions[0]["prefs"], {"enforceEnabled": True, "strictLock": True, "dimEnabled": True,
                                              "audioDuck": True, "stopAction": "hibernate", "graceSeconds": 120, "dimMax": .3,
                                              "timePillEnabled": False, "quietSignalEnabled": False})
        self.assertNotIn("morningCountdown", actions[0]["prefs"])

    def test_effective_phone_consent_never_becomes_new_local_consent(self):
        actions = []; ui, view = ui_double(actions.append)
        ui.snapshot = {"prefs": {"enforceEnabled": True, "strictLock": True}}
        ui._settings()
        next(button for button in view.buttons if button.options["text"] == "Übernehmen").options["command"]()
        self.assertFalse(actions[0]["prefs"]["enforceEnabled"])
        self.assertFalse(actions[0]["prefs"]["strictLock"])

    def test_settings_reject_out_of_schema_grace_without_sending(self):
        actions = []; ui, view = ui_double(actions.append); ui._settings()
        view.strings[1].set("900")
        next(button for button in view.buttons if button.options["text"] == "Übernehmen").options["command"]()
        self.assertEqual(actions, [])
        self.assertFalse(view.windows[0].destroyed)

    def test_note_utf16_limit_matches_the_phone_and_rejects_invalid_unicode(self):
        for value, accepted in [("a" * 500, True), ("a" * 501, False), ("😀" * 250, True), ("😀" * 251, False), ("\ud800", False)]:
            with self.subTest(length=len(value)):
                actions = []; ui, view = ui_double(actions.append); ui._form("thought")
                view.entries[0].set(value); view.buttons[0].options["command"]()
                self.assertEqual(bool(actions), accepted)
                self.assertFalse(view.windows[0].destroyed)

    def test_failed_storage_retains_draft_and_permits_retry_without_private_error(self):
        actions = []; ui, view = ui_double(actions.append); ui._form("savepoint")
        view.entries[0].set("Mein Dokument"); view.entries[1].set("Absatz 3")
        submit = view.buttons[0].options["command"]; submit(); submit()
        self.assertEqual(len(actions), 1)
        self.assertEqual(view.buttons[0].options["state"], "disabled")
        ui._resolve_action_result({"action": "savepoint", "ok": False, "requestId": actions[0]["requestId"]})
        self.assertEqual(view.entries[0].get(), "Mein Dokument")
        self.assertEqual(view.entries[1].get(), "Absatz 3")
        self.assertEqual(view.buttons[0].options["state"], "normal")
        self.assertFalse(view.windows[0].destroyed)
        submit(); self.assertEqual(len(actions), 2)
        self.assertNotEqual(actions[0]["requestId"], actions[1]["requestId"])
        ui._resolve_action_result({"action": "savepoint", "ok": True, "requestId": actions[1]["requestId"]})
        self.assertTrue(view.windows[0].destroyed)

    def test_unrelated_and_stale_results_never_complete_another_draft(self):
        actions = []; ui, view = ui_double(actions.append); ui._form("thought")
        view.entries[0].set("Nicht verlieren"); view.buttons[0].options["command"]()
        for result in [{"action": "settings", "ok": True, "requestId": actions[0]["requestId"]},
                       {"action": "thought", "ok": True, "requestId": "old-dialog"},
                       {"action": "thought", "ok": "true", "requestId": actions[0]["requestId"]}]:
            ui._resolve_action_result(result)
        self.assertFalse(view.windows[0].destroyed)
        self.assertEqual(view.entries[0].get(), "Nicht verlieren")
        view.windows[0].events["WM_DELETE_WINDOW"]()
        self.assertEqual(ui._pending_actions, {})

    def test_immediate_delivery_failure_keeps_values_and_hides_exception_text(self):
        def fail(_action): raise OSError("private-key-location-and-notiz")
        ui, view = ui_double(fail); ui._form("thought"); view.entries[0].set("Mein Entwurf")
        view.buttons[0].options["command"]()
        self.assertEqual(view.entries[0].get(), "Mein Entwurf")
        self.assertEqual(view.entries[0].options["state"], "normal")
        self.assertEqual(view.buttons[0].options["state"], "normal")
        self.assertEqual(ui._pending_actions, {})
        self.assertNotIn("private-key-location", ui.status.get())
        self.assertNotIn("private-key-location", str([widget.options for widget in view.widgets]))

    def test_settings_only_close_after_matching_persisted_result(self):
        actions = []; ui, view = ui_double(actions.append); ui._settings()
        submit = next(button for button in view.buttons if button.options["text"] == "Übernehmen")
        submit.options["command"]()
        self.assertFalse(view.windows[0].destroyed)
        ui._resolve_action_result({"action": "settings", "ok": False, "requestId": actions[0]["requestId"]})
        self.assertEqual(submit.options["state"], "normal")
        submit.options["command"]()
        ui._resolve_action_result({"action": "settings", "ok": True, "requestId": actions[1]["requestId"]})
        self.assertTrue(view.windows[0].destroyed)


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

    def test_wts_lock_and_unlock_survive_an_inaccessible_input_desktop(self):
        api = FakeWindows(); api.locked = lambda: None
        platform = WindowsPlatform(api)
        self.assertIsNone(platform.sample()["locked"])
        platform._event("lock")
        self.assertEqual(platform.sample(), {"locked": True, "idleSeconds": 18.5, "powerEvent": "lock"})
        self.assertTrue(platform.sample()["locked"])
        platform._event("unlock")
        self.assertEqual(platform.sample(), {"locked": False, "idleSeconds": 18.5, "powerEvent": "unlock"})
        self.assertFalse(platform.sample()["locked"])

    def test_lock_request_and_unrelated_events_do_not_claim_observed_lock(self):
        api = FakeWindows(); api.locked = lambda: None
        platform = WindowsPlatform(api)
        platform.lock()
        self.assertEqual(api.lock_calls, 1)
        for event in [None, "sleep", "resume", "shutdown-requested"]:
            if event is not None: platform._event(event)
            self.assertIsNone(platform.sample()["locked"])

    def test_confirmed_wts_state_wins_over_a_racing_desktop_read(self):
        api = FakeWindows(); platform = WindowsPlatform(api)
        def stale_desktop():
            platform._event("lock")
            return False
        api.locked = stale_desktop
        self.assertTrue(platform.sample()["locked"])
        api.locked = lambda: self.fail("Ein bestätigter WTS-Stand braucht keinen unsicheren Desktop-Rückfall")
        self.assertTrue(platform.sample()["locked"])

    def test_session_end_and_listener_detach_require_fresh_observation(self):
        api = FakeWindows(); api.locked = lambda: None
        platform = WindowsPlatform(api); platform._event("lock")
        platform._event("logoff")
        self.assertIsNone(platform.sample()["locked"])
        platform._event("lock"); platform.detach_window()
        self.assertIsNone(platform.sample()["locked"])
        self.assertIsNone(WindowsPlatform(api).sample()["locked"])

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
        self.assertEqual([{key: value for key, value in action.items() if key != 'requestId'} for action in actions],
                         [{"action": "extend", "minutes": 30}, {"action": "pause"}])
        self.assertEqual(len({action['requestId'] for action in actions}), 2)
        self.assertTrue(all(len(action['requestId']) == 32 for action in actions))


if __name__ == "__main__": unittest.main()
