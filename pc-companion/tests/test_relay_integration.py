import asyncio
import json
import unittest

import aiohttp

from anker_companion.__main__ import DesktopStatusUI
from anker_companion.protocol import b64, canonical
from anker_companion.relay import RelayPump, SETUP_PREFIX
from tests import test_server as server_helpers
from tests.helpers import state


class RelayIntegrationTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = server_helpers.ServerTests.asyncSetUp
    pair = server_helpers.ServerTests.pair
    envelope = server_helpers.ServerTests.envelope
    ws_receive = server_helpers.ServerTests.ws_receive
    ws_exchange = server_helpers.ServerTests.ws_exchange

    def setup_code(self):
        return SETUP_PREFIX + b64(canonical({"project": "a" * 20, "pair": self.identifier, "deviceToken": "1" * 64}))

    def ui(self):
        class UI:
            def __init__(self): self.messages = []
            def render(self, value): self.messages.append(value)
            def ask_pair(self, _value): pass
        ui = UI(); self.bridge.ui = ui; self.engine.ui = ui
        self.bridge.relay_pump = RelayPump(self.store, self.bridge.relay_exchange, self.bridge.local_session_fresh, self.clock)
        return ui

    async def test_relay_settings_remain_private_and_public_status_survives_engine_renders(self):
        await self.pair(); ui = self.ui(); code = self.setup_code()
        self.bridge.ui_action({"action": "relay_configure", "setupCode": code, "requestId": "configure"})
        self.assertTrue(ui.messages[-1]["actionResult"]["ok"])
        self.assertEqual(ui.messages[-1]["relay"], {"enabled": True, "status": "waiting"})
        self.assertEqual(self.store.read()["relay"]["deviceToken"], "1" * 64)
        self.engine.ui = DesktopStatusUI(ui, self.bridge.public_status)
        self.engine.tick()
        self.assertEqual(ui.messages[-1]["relay"], {"enabled": True, "status": "waiting"})
        self.assertNotIn(code, json.dumps(ui.messages))
        self.assertNotIn("deviceToken", json.dumps(ui.messages))
        self.bridge.ui_action({"action": "relay_disable", "requestId": "disable"})
        self.assertFalse(ui.messages[-1]["relay"]["enabled"])
        self.bridge.ui_action({"action": "relay_clear", "requestId": "clear"})
        self.assertNotIn("relay", self.store.read())

    async def test_invalid_private_setup_never_echoes_input_or_claims_success(self):
        await self.pair(); ui = self.ui()
        self.bridge.ui_action({"action": "relay_configure", "setupCode": "PRIVATE_INVALID_SETUP", "requestId": "invalid"})
        result = ui.messages[-1]["actionResult"]
        self.assertFalse(result["ok"])
        self.assertEqual(result["reason"], "relay-rejected")
        self.assertNotIn("PRIVATE_INVALID_SETUP", json.dumps(ui.messages))

    async def test_lan_freshness_needs_authenticated_wss_contact_not_rest_or_pair_id(self):
        await self.pair(); self.bridge.monotonic = self.clock
        self.bridge.exchange(canonical(self.envelope(state(self.clock))))
        self.assertFalse(self.bridge.local_session_fresh(self.identifier))
        async with self.client.ws_connect(self.url + "/v3/ws?pair=" + self.identifier, autoping=False) as socket:
            self.assertFalse(self.bridge.local_session_fresh(self.identifier))
            await self.ws_exchange(socket, {"type": "pull", "after": 0})
            self.assertTrue(self.bridge.local_session_fresh(self.identifier))
            self.clock.now += 91
            self.bridge.exchange(canonical(self.envelope(state(self.clock))))
            self.assertFalse(self.bridge.local_session_fresh(self.identifier))
            await socket.ping(b"authenticated-local-contact")
            self.assertEqual((await socket.receive()).type, aiohttp.WSMsgType.PONG)
            self.assertTrue(self.bridge.local_session_fresh(self.identifier))
            self.assertFalse(self.bridge.local_session_fresh("another-pair"))

    async def test_reset_joins_relay_before_closed_store_and_drops_private_config(self):
        await self.pair(); ui = self.ui()
        self.bridge.ui_action({"action": "relay_configure", "setupCode": self.setup_code(), "requestId": "setup"})
        cleanup = []
        async def pump():
            try:
                await asyncio.Future()
            finally:
                self.store.update(lambda data: data["runtime"].update(relayStopped=True))
                cleanup.append(True)
        self.bridge.relay_task = asyncio.create_task(pump())
        await asyncio.sleep(0)
        await self.bridge.ui_action({"action": "delete-data", "userConfirmed": True, "requestId": "reset"})
        self.assertEqual(cleanup, [True])
        self.assertTrue(ui.messages[-1]["actionResult"]["ok"])
        self.assertIsNone(self.bridge.relay_task)
        self.assertNotIn("relay", self.store.read())
        self.assertFalse(self.store.path.exists())
        self.assertEqual(ui.messages[-1]["relay"], {"enabled": False, "status": "off"})


if __name__ == "__main__": unittest.main()
