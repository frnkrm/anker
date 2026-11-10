import asyncio
import json
import threading
import unittest

from anker_companion.updater import UpdateError
from tests import test_server as server_helpers


class FakeUpdater:
    def __init__(self, base):
        self.base = base; self.calls = []; self.closed = False
        self.started = threading.Event(); self.release = threading.Event(); self.disposing = threading.Event()
        self.block = False; self.lock = threading.RLock(); self.fail_dispose = False

    def check(self, **options):
        with self.lock:
            self.calls.append(("check", options, threading.get_ident()))
            self.started.set()
            if self.block: self.release.wait(2)
            return {"status": "available", "version": "0.2.0", "bytes": 1024, "url": "PRIVATE_URL", "token": "PRIVATE_TOKEN"}

    def download(self):
        with self.lock:
            self.calls.append(("download", {}, threading.get_ident()))
            return {"status": "staged", "version": "0.2.0", "stageId": "stage-" + "a" * 32, "path": "PRIVATE_PATH"}

    def prepare_install(self, stage, confirmed=False):
        with self.lock:
            self.calls.append(("install", {"stage": stage, "confirmed": confirmed}, threading.get_ident()))
            return {"status": "handoff-ready", "version": "0.2.0", "stageId": stage, "installed": True}

    def dispose(self, cancel_handoff=True):
        self.disposing.set()
        with self.lock:
            self.calls.append(("dispose", {"cancel_handoff": cancel_handoff}, threading.get_ident()))
            if self.fail_dispose: raise UpdateError("busy")
            self.closed = True

    def clear_staging(self):
        assert self.closed
        self.calls.append(("clear", {"stateStillExists": (self.base / "state").exists()}, threading.get_ident()))
        marker = self.base / "updates" / "synthetic-cache"
        marker.unlink(missing_ok=True)
        if marker.parent.exists(): marker.parent.rmdir()


class UpdaterIntegrationTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = server_helpers.ServerTests.asyncSetUp

    def ui(self):
        class UI:
            def __init__(self): self.messages = []
            def render(self, value): self.messages.append(value)
        ui = UI(); self.bridge.ui = ui; self.engine.ui = ui
        manager = FakeUpdater(self.store.path.parent); self.bridge.updater = manager
        return ui, manager

    async def test_explicit_actions_run_off_loop_and_only_publish_safe_metadata(self):
        ui, manager = self.ui(); loop_thread = threading.get_ident()
        await self.bridge.ui_action({"action": "update-check", "requestId": "check"})
        result = ui.messages[-1]["actionResult"]
        self.assertTrue(result["ok"])
        self.assertEqual(result["update"], {"status": "available", "version": "0.2.0", "bytes": 1024})
        self.assertFalse(manager.calls[0][1]["automatic"])
        self.assertNotEqual(manager.calls[0][2], loop_thread)
        self.assertNotIn("PRIVATE", json.dumps(ui.messages))
        await self.bridge.ui_action({"action": "update-download", "requestId": "download"})
        self.assertEqual(ui.messages[-1]["actionResult"]["update"]["status"], "staged")
        self.assertEqual(self.bridge.public_status()["update"]["status"], "staged")

    async def test_install_requires_confirmation_and_exact_displayed_stage_then_handoff_only(self):
        ui, manager = self.ui(); stopped = []; self.bridge.on_install_handoff = lambda: stopped.append(True)
        await self.bridge.ui_action({"action": "update-download", "requestId": "stage"})
        stage = "stage-" + "a" * 32
        await self.bridge.ui_action({"action": "update-install", "stageId": stage, "requestId": "unconfirmed"})
        self.assertFalse(ui.messages[-1]["actionResult"]["ok"])
        self.assertFalse(any(call[0] == "install" for call in manager.calls))
        await self.bridge.ui_action({"action": "update-download", "requestId": "stage-again"})
        await self.bridge.ui_action({"action": "update-install", "stageId": "stage-" + "b" * 32, "userConfirmed": True, "requestId": "wrong-stage"})
        self.assertFalse(any(call[0] == "install" for call in manager.calls))
        await self.bridge.ui_action({"action": "update-download", "requestId": "correct-stage"})
        await self.bridge.ui_action({"action": "update-install", "stageId": stage, "userConfirmed": True, "requestId": "install"})
        result = ui.messages[-1]["actionResult"]
        self.assertTrue(result["ok"])
        self.assertEqual(result["update"]["status"], "handoff-ready")
        self.assertNotIn("installed", result["update"])
        self.assertEqual(stopped, [True])
        await self.bridge.stop_updates()
        self.assertFalse(manager.calls[-1][1]["cancel_handoff"])

    async def test_normal_stop_cancels_handoff_and_auto_checks_begin_disabled(self):
        _ui, manager = self.ui(); loops = []
        def stopped(): loops.append(True); return len(loops) > 1
        await self.bridge.automatic_updates(stopped, interval=0)
        self.assertEqual(manager.calls, [])
        await self.bridge.stop_updates()
        self.assertTrue(manager.calls[-1][1]["cancel_handoff"])

    async def test_opted_in_background_checks_do_not_download_or_emit_action_ack(self):
        ui, manager = self.ui()
        self.store.update(lambda data: data["localPrefs"].update(autoUpdateChecks=True))
        loops = []
        def stopped(): loops.append(True); return len(loops) > 1
        await self.bridge.automatic_updates(stopped, interval=0)
        self.assertEqual([call[0] for call in manager.calls], ["check"])
        self.assertTrue(manager.calls[0][1]["automatic"] and manager.calls[0][1]["auto_checks_enabled"])
        self.assertEqual(ui.messages[-1]["update"]["status"], "available")
        self.assertNotIn("actionResult", ui.messages[-1])

    async def test_busy_network_operation_does_not_block_loop_or_start_second_mutation(self):
        ui, manager = self.ui(); manager.block = True
        task = self.bridge.ui_action({"action": "update-check", "requestId": "slow"})
        try:
            self.assertTrue(await asyncio.to_thread(manager.started.wait, 1))
            await self.bridge.ui_action({"action": "update-download", "requestId": "busy"})
            self.assertEqual(ui.messages[-1]["actionResult"]["update"]["status"], "busy")
            async with self.client.get(self.url + "/health") as response: self.assertEqual(response.status, 200)
            self.assertEqual([call[0] for call in manager.calls], ["check"])
        finally:
            manager.release.set()
            await task

    async def test_reset_joins_worker_disposes_and_clears_owned_staging_before_files(self):
        ui, manager = self.ui(); manager.block = True
        cache = self.store.path.parent / "updates" / "synthetic-cache"; cache.parent.mkdir(); cache.write_text("public staging")
        check = self.bridge.ui_action({"action": "update-check", "requestId": "slow-check"})
        try:
            self.assertTrue(await asyncio.to_thread(manager.started.wait, 1))
            reset = self.bridge.ui_action({"action": "delete-data", "userConfirmed": True, "requestId": "reset"})
            self.assertTrue(await asyncio.to_thread(manager.disposing.wait, 1))
            self.assertTrue(self.store.path.exists() and cache.exists())
        finally:
            manager.release.set()
            await check
        await reset
        self.assertTrue(ui.messages[-1]["actionResult"]["ok"])
        self.assertTrue(manager.closed)
        clear = next(call for call in manager.calls if call[0] == "clear")
        self.assertTrue(clear[1]["stateStillExists"])
        self.assertFalse(self.store.path.exists() or cache.exists())
        self.assertFalse(any(item.get("actionResult", {}).get("requestId") == "slow-check" for item in ui.messages))

    async def test_busy_helper_prevents_deletion_and_does_not_claim_complete_reset(self):
        ui, manager = self.ui(); manager.fail_dispose = True
        cache = self.store.path.parent / "updates" / "synthetic-cache"; cache.parent.mkdir(); cache.write_text("keep until helper stopped")
        await self.bridge.ui_action({"action": "delete-data", "userConfirmed": True, "requestId": "busy-reset"})
        self.assertFalse(ui.messages[-1]["actionResult"]["ok"])
        self.assertEqual(ui.messages[-1]["actionResult"]["status"], "delete-incomplete")
        self.assertTrue(cache.exists())
        self.assertFalse(any(call[0] == "clear" for call in manager.calls))
        self.assertEqual(self.store.read()["pairs"], {})

    async def test_disabling_automatic_checks_drops_late_result_without_download(self):
        ui, manager = self.ui(); manager.block = True
        self.store.update(lambda data: data["localPrefs"].update(autoUpdateChecks=True))
        task = asyncio.create_task(self.bridge._update({"action": "update-check"}, automatic=True))
        try:
            self.assertTrue(await asyncio.to_thread(manager.started.wait, 1))
            self.store.update(lambda data: data["localPrefs"].update(autoUpdateChecks=False))
        finally:
            manager.release.set()
            await task
        self.assertEqual([call[0] for call in manager.calls], ["check"])
        self.assertNotIn("update", self.bridge.public_status())
        self.assertEqual(ui.messages, [])

    async def test_unexpected_handoff_cannot_claim_install_readiness_or_quit(self):
        ui, manager = self.ui(); stopped = []; self.bridge.on_install_handoff = lambda: stopped.append(True)
        for returned in [{"status": "handoff-ready", "version": "0.2.0"}, {"status": "handoff-ready", "version": "0.2.0", "stageId": "stage-" + "b" * 32}]:
            await self.bridge.ui_action({"action": "update-download", "requestId": "stage"})
            manager.prepare_install = lambda *_args, value=returned, **_kwargs: value
            await self.bridge.ui_action({"action": "update-install", "stageId": "stage-" + "a" * 32, "userConfirmed": True, "requestId": "install"})
            self.assertFalse(ui.messages[-1]["actionResult"]["ok"])
            self.assertFalse(self.bridge._install_handoff)
        self.assertEqual(stopped, [])


if __name__ == "__main__": unittest.main()
