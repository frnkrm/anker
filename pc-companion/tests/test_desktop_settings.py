from copy import deepcopy
import io
import json
import os
from pathlib import Path
import struct
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import wave

import aiohttp

from anker_companion.desktop_settings import DesktopSettingsError, delete_managed_files, desktop_defaults, desktop_patch, parse_hotkey
from anker_companion.protocol import ProtocolError
from anker_companion.storage import AtomicStateStore, initial_state
from anker_companion.windows import PlatformError, WindowEvents, WindowsPlatform
from tests.helpers import TestVault, state
from tests import test_server as server_helpers


class DesktopPreferencesTests(unittest.TestCase):
    def test_metadata_normalizes_names_hotkeys_and_theme_without_operational_flags(self):
        value = desktop_patch(desktop_defaults(), {"pcName": "  Mein Büro  ", "hotkeys": {"savepoint": "alt + ctrl + f12", "thought": "shift+F24"}, "theme": "light"})
        self.assertEqual(value, {"pcName": "Mein Büro", "hotkeys": {"savepoint": "CTRL+ALT+F12", "thought": "SHIFT+F24"}, "theme": "light"})
        for change in [{"pcName": ""}, {"pcName": "bad\nname"}, {"pcName": "x" * 101}, {"theme": "unknown"}, {"timePill": True}, {"quietSignalEnabled": True}, {"hotkeys": {"savepoint": "ALT+A", "thought": "alt+a"}}]:
            with self.subTest(change=change), self.assertRaises(DesktopSettingsError):
                desktop_patch(desktop_defaults(), change)
        for key in ["A", "WIN+A", "CTRL+CTRL+A", "CTRL+F25", "CTRL+DELETE", "CTRL+", True]:
            with self.subTest(key=key), self.assertRaises(DesktopSettingsError): parse_hotkey(key)

    def test_old_schema1_store_gets_metadata_and_reload_preserves_private_data(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "companion.state"; vault = TestVault()
            old = initial_state(); old.pop("desktopPrefs")
            old["notes"] = [{"text": "PRIVATE_NOTE"}]
            path.write_bytes(vault.protect(json.dumps(old).encode()))
            store = AtomicStateStore(path, vault, desktop_name="Office PC")
            self.assertEqual(store.read()["desktopPrefs"]["pcName"], "Office PC")
            store.update(lambda data: data["desktopPrefs"].update(pcName="PRIVATE_PC_NAME", theme="dark"))
            restored = AtomicStateStore(path, vault, desktop_name="Do not overwrite")
            self.assertEqual(restored.read()["desktopPrefs"]["pcName"], "PRIVATE_PC_NAME")
            self.assertEqual(restored.read()["notes"], old["notes"])
            self.assertNotIn(b"PRIVATE_PC_NAME", path.read_bytes())
            self.assertEqual(restored.read()["schemaVersion"], 1)

    def test_managed_delete_preserves_program_legacy_and_unknown_files(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory); logs = folder / "logs"; logs.mkdir()
            for path in [folder / "companion.state", folder / "companion.next", folder / "pc-certificate.pem", folder / ".anker-tls-key-fixture.pem", logs / "companion.log", logs / "companion.log.4"]:
                path.write_text("synthetic")
            keep = [folder / "Anker PC-Stopp.ps1", folder / "Anker.exe", logs / "other-program.log"]
            for path in keep: path.write_text("keep")
            delete_managed_files(folder / "companion.state")
            self.assertTrue(all(path.read_text() == "keep" for path in keep))
            self.assertFalse((folder / "companion.state").exists())
            self.assertFalse((folder / "pc-certificate.pem").exists())
            self.assertFalse((logs / "companion.log").exists())

    def test_delete_never_follows_a_log_directory_or_managed_file_symlink(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as outside:
            folder = Path(directory); target = Path(outside) / "companion.log"; target.write_text("outside")
            state_file = folder / "companion.state"; state_file.write_text("private")
            try: (folder / "logs").symlink_to(outside, target_is_directory=True)
            except OSError: self.skipTest("Symbolische Links sind hier nicht verfügbar")
            with self.assertRaises(DesktopSettingsError): delete_managed_files(state_file)
            self.assertEqual(target.read_text(), "outside")
            self.assertEqual(state_file.read_text(), "private")
            (folder / "logs").unlink()
            state_file.unlink(); state_file.symlink_to(target)
            with self.assertRaises(DesktopSettingsError): delete_managed_files(state_file)
            self.assertEqual(target.read_text(), "outside")

    def test_closed_store_cannot_recreate_deleted_private_state(self):
        with tempfile.TemporaryDirectory() as directory:
            store = AtomicStateStore(Path(directory) / "state", TestVault())
            store.update(lambda data: data["notes"].append({"text": "private"}))
            store.close_and_forget(); delete_managed_files(store.path)
            for action in [lambda: store.update(lambda data: data.update(notes=["bad"])), lambda: store.next_send("old-pair")]:
                with self.assertRaises(RuntimeError): action()
            with self.assertRaises(RuntimeError), store.transaction(): pass
            self.assertEqual(store.read()["pairs"], {})
            self.assertEqual(store.read()["notes"], [])
            self.assertFalse(store.path.exists())

    def test_delete_rechecks_data_directory_after_preflight_before_each_unlink(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory); folder = base / "data"; outside = base / "outside"
            folder.mkdir(); outside.mkdir()
            for parent in [folder, outside]:
                (parent / "companion.state").write_text("private" if parent == folder else "outside-state")
                (parent / "pc-certificate.pem").write_text("private-cert" if parent == folder else "outside-cert")
            probe = base / "probe"
            try: probe.symlink_to(outside, target_is_directory=True); probe.unlink()
            except OSError: self.skipTest("Symbolische Links sind hier nicht verfügbar")
            original = Path.is_file; swapped = False
            def is_file(path):
                nonlocal swapped
                result = original(path)
                if path == folder / "pc-certificate.pem" and not swapped:
                    folder.rename(base / "original-data")
                    folder.symlink_to(outside, target_is_directory=True)
                    swapped = True
                return result
            with patch.object(Path, "is_file", is_file), self.assertRaises(DesktopSettingsError):
                delete_managed_files(folder / "companion.state")
            self.assertTrue(swapped)
            self.assertEqual((outside / "companion.state").read_text(), "outside-state")
            self.assertEqual((outside / "pc-certificate.pem").read_text(), "outside-cert")
            self.assertEqual((base / "original-data" / "companion.state").read_text(), "private")


class DesktopManagementTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = server_helpers.ServerTests.asyncSetUp
    pair = server_helpers.ServerTests.pair
    envelope = server_helpers.ServerTests.envelope
    ws_receive = server_helpers.ServerTests.ws_receive
    ws_exchange = server_helpers.ServerTests.ws_exchange

    def ui(self):
        class UI:
            def __init__(self): self.messages = []; self.closed = []
            def render(self, value): self.messages.append(value)
            def ask_pair(self, _value): pass
            def close_pairing_offer(self, identifier): self.closed.append(identifier)
        value = UI(); self.bridge.ui = value; self.engine.ui = value
        return value

    async def test_name_and_metadata_save_preserve_pairing_and_change_hello(self):
        await self.pair(); ui = self.ui(); before = self.store.read()["pairs"]
        self.bridge.ui_action({"action": "desktop-settings", "requestId": "metadata", "prefs": {"pcName": "Wohnzimmer", "theme": "light", "hotkeys": {"savepoint": "CTRL+ALT+F8", "thought": "CTRL+SHIFT+G"}}})
        self.assertTrue(ui.messages[-1]["actionResult"]["ok"])
        self.assertEqual(self.store.read()["pairs"], before)
        self.assertEqual(ui.messages[-1]["desktopPrefs"]["pcName"], "Wohnzimmer")
        async with self.client.get(self.url + "/health") as response:
            self.assertEqual((await response.json())["name"], "Wohnzimmer")
        restored = AtomicStateStore(self.store.path, self.vault)
        self.assertEqual(restored.read()["desktopPrefs"]["pcName"], "Wohnzimmer")

    async def test_rename_revokes_only_pending_offer_and_new_qr_uses_saved_name(self):
        ui = self.ui(); offer = self.pairing.create()["data"]
        self.bridge.ui_action({"action": "desktop-settings", "prefs": {"pcName": "Neuer Name"}, "requestId": "name"})
        self.assertEqual(ui.closed, [offer["id"]])
        self.assertEqual(self.pairing.drafts, {})
        self.assertEqual(self.pairing.create()["data"]["n"], "Neuer Name")

    async def test_failed_settings_write_has_no_success_or_in_memory_name_change(self):
        ui = self.ui(); before = self.store.read(); name = self.pairing.pc_name
        self.vault.fail = True
        self.bridge.ui_action({"action": "desktop-settings", "prefs": {"pcName": "Not saved"}, "requestId": "failed"})
        self.assertFalse(ui.messages[-1]["actionResult"]["ok"])
        self.assertEqual(self.store.read(), before)
        self.assertEqual(self.pairing.pc_name, name)
        self.vault.fail = False

    async def test_preview_and_expected_target_delegate_without_outer_transaction(self):
        ui = self.ui(); target = "2026-11-12T22:00:00Z"; calls = []
        self.engine.preview_extension_until = lambda clock: {"pcStopAt": target, "sleepOpportunityMinutes": 420}
        def extend(clock, *, expected_target_at):
            calls.append((clock, expected_target_at))
            with self.store.transaction(): self.store.update(lambda data: data["runtime"].update(testExtended=True))
        self.engine.extend_until = extend
        before = self.store.read()
        self.bridge.ui_action({"action": "preview-extend-until", "localTime": "23:00", "requestId": "preview"})
        self.assertEqual(ui.messages[-1]["actionResult"]["preview"]["pcStopAt"], target)
        self.assertEqual(self.store.read(), before)
        self.bridge.ui_action({"action": "extend-until", "localTime": "23:00", "requestId": "missing"})
        self.assertEqual(ui.messages[-1]["actionResult"]["reason"], "preview-required")
        self.assertEqual(calls, [])
        self.bridge.ui_action({"action": "extend-until", "localTime": "23:00", "expectedTargetAt": target, "requestId": "apply"})
        self.assertTrue(ui.messages[-1]["actionResult"]["ok"])
        self.assertEqual(calls, [("23:00", target)])

    async def test_expired_preview_remains_a_neutral_error(self):
        ui = self.ui()
        def stale(*_args, **_kwargs): raise ProtocolError("preview-expired")
        self.engine.extend_until = stale
        self.bridge.ui_action({"action": "extend-until", "localTime": "23:00", "expectedTargetAt": "2026-11-12T22:00:00Z", "requestId": "stale"})
        self.assertEqual(ui.messages[-1]["actionResult"], {"action": "extend-until", "ok": False, "reason": "preview-expired", "requestId": "stale"})

    async def test_delete_requires_explicit_confirmation_then_revokes_and_deletes_only_local_data(self):
        await self.pair(); ui = self.ui(); saved = self.store.read()
        self.bridge.ui_action({"action": "delete-data", "requestId": "not-confirmed"})
        self.assertEqual(ui.messages[-1]["actionResult"]["reason"], "confirmation-required")
        self.assertEqual(self.store.read(), saved)
        socket = await self.client.ws_connect(self.url + "/v3/ws?pair=" + self.identifier)
        await self.ws_exchange(socket, {"type": "pull", "after": 0})
        logs = self.store.path.parent / "logs"; logs.mkdir()
        (logs / "companion.log").write_text("private")
        keep = self.store.path.parent / "Anker PC-Stopp.ps1"; keep.write_text("keep")
        stopped = []; self.bridge.on_delete_data = lambda: stopped.append(True)
        task = self.bridge.ui_action({"action": "delete-data", "userConfirmed": True, "requestId": "confirmed"})
        self.assertEqual((await socket.receive()).type, aiohttp.WSMsgType.CLOSE)
        await task
        self.assertEqual(ui.messages[-1]["actionResult"], {"action": "delete-data", "ok": True, "restartRequired": True, "requestId": "confirmed"})
        self.assertTrue(stopped)
        self.assertEqual(self.store.read()["pairs"], {})
        self.assertEqual(self.pairing.drafts, {})
        self.assertFalse(self.store.path.exists() or (logs / "companion.log").exists())
        self.assertEqual(keep.read_text(), "keep")
        with self.assertRaises(RuntimeError): self.store.update(lambda data: data.update(notes=["recreated"]))
        async with self.client.get(self.url + "/health") as response: self.assertEqual(response.status, 503)

    async def test_delete_failure_is_not_reported_as_complete_and_runtime_stays_revoked(self):
        await self.pair(); ui = self.ui()
        with patch("anker_companion.server.delete_managed_files", side_effect=OSError("PRIVATE failure body")):
            await self.bridge.ui_action({"action": "delete-data", "userConfirmed": True, "requestId": "partial"})
        result = ui.messages[-1]["actionResult"]
        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "delete-incomplete")
        self.assertEqual(self.store.read()["pairs"], {})
        self.assertFalse(self.store.read()["localPrefs"]["enforceEnabled"])
        self.assertNotIn("PRIVATE", json.dumps(result))
        self.bridge.ui_action({"action": "pair", "requestId": "blocked"})
        self.assertEqual(ui.messages[-1]["actionResult"]["status"], "restart-required")


class HotkeyAdapterTests(unittest.TestCase):
    def hook(self):
        class User:
            def __init__(self): self.registered = {}; self.conflicts = set(); self.failed_unregister = set()
            def RegisterHotKey(self, _window, identifier, modifiers, key):
                combo = (modifiers, key)
                if combo in self.conflicts or combo in self.registered.values(): return False
                self.registered[identifier] = combo; return True
            def UnregisterHotKey(self, _window, identifier):
                if identifier in self.failed_unregister: return False
                self.registered.pop(identifier, None); return True
        hook = object.__new__(WindowEvents)
        hook.window = 1; hook.user = User(); hook.hotkeys = {}; hook._hotkey_specs = {}; hook._hotkey_callbacks = {}; hook._pending_hotkeys = None
        hook._reserved_hotkeys = set(); hook._hotkey_next = 0xA001; hook._hotkey_thread = threading.get_ident(); hook._hotkey_uncertain = False
        events = []; self.assertTrue(hook.register_hotkeys(lambda: events.append("savepoint"), lambda: events.append("thought")))
        return hook, events

    def test_conflict_after_partial_prepare_leaves_all_old_hotkeys_functioning(self):
        hook, events = self.hook(); before = deepcopy(hook.user.registered); original = dict(hook.hotkeys)
        hook.user.conflicts.add(parse_hotkey("CTRL+ALT+F8")[1:])
        with self.assertRaises(PlatformError): hook.prepare_hotkeys({"savepoint": "CTRL+ALT+B", "thought": "CTRL+ALT+F8"})
        self.assertEqual(hook.user.registered, before)
        self.assertEqual(hook.hotkeys, original)
        hook._message(1, 0x0312, next(iter(original)), 0)
        self.assertEqual(events, ["savepoint"])

    def test_prepare_then_rollback_retains_old_keys_and_swap_reuses_registrations(self):
        hook, events = self.hook(); before = deepcopy(hook.user.registered)
        token = hook.prepare_hotkeys({"savepoint": "CTRL+ALT+B", "thought": "CTRL+ALT+F8"})
        self.assertEqual(len(hook.user.registered), 4)
        self.assertTrue(hook.rollback_hotkeys(token))
        self.assertEqual(hook.user.registered, before)
        token = hook.prepare_hotkeys({"savepoint": "CTRL+ALT+G", "thought": "CTRL+ALT+A"})
        self.assertEqual(hook.user.registered, before)
        self.assertTrue(hook.commit_hotkeys(token))
        hook._message(1, 0x0312, 0xA002, 0); hook._message(1, 0x0312, 0xA001, 0)
        self.assertEqual(events, ["savepoint", "thought"])

    def test_unregister_failure_preserves_old_callback_and_requires_restart(self):
        hook, events = self.hook(); hook.user.failed_unregister.add(0xA001)
        token = hook.prepare_hotkeys({"savepoint": "CTRL+ALT+B", "thought": "CTRL+ALT+F8"})
        self.assertFalse(hook.commit_hotkeys(token))
        hook._message(1, 0x0312, 0xA001, 0)
        self.assertEqual(events, ["savepoint"])
        with self.assertRaises(PlatformError): hook.prepare_hotkeys(desktop_defaults()["hotkeys"])

    def test_registration_requires_the_owning_tk_thread(self):
        hook, _events = self.hook(); before = deepcopy(hook.user.registered); hook._hotkey_thread = -1
        with self.assertRaises(PlatformError): hook.prepare_hotkeys(desktop_defaults()["hotkeys"])
        self.assertEqual(hook.user.registered, before)

    def test_quiet_signal_respects_known_system_state_and_uses_low_amplitude_only(self):
        calls = []
        for status in [None, 1, 6]:
            platform = WindowsPlatform(api=SimpleNamespace(notification_state=lambda value=status: value), sound_player=calls.append)
            self.assertEqual(platform.quiet_reminder_sound()["status"], "suppressed")
        self.assertEqual(calls, [])
        for status in [2, 3, 4, 5, 7]:
            platform = WindowsPlatform(api=SimpleNamespace(notification_state=lambda value=status: value), sound_player=calls.append)
            result = platform.quiet_reminder_sound()
            self.assertEqual(result["status"], "requested")
            self.assertEqual(result["notificationState"], status)
        self.assertEqual(len(calls), 5)
        with wave.open(io.BytesIO(calls[0]), "rb") as sound:
            self.assertEqual(sound.getnframes(), 1920)
            samples = struct.unpack("<" + "h" * 1920, sound.readframes(1920))
            self.assertLessEqual(max(abs(value) for value in samples), 1100)
        broken = WindowsPlatform(api=SimpleNamespace(notification_state=lambda: 5), sound_player=lambda _value: (_ for _ in ()).throw(OSError("PRIVATE")))
        result = broken.quiet_reminder_sound()
        self.assertEqual(result["status"], "unavailable")
        self.assertNotIn("PRIVATE", json.dumps(result))


if __name__ == "__main__": unittest.main()
