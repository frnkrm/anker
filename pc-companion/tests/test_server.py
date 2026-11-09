import asyncio
from copy import deepcopy
import json
from pathlib import Path
import tempfile
import unittest

import aiohttp
from aiohttp import web
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec

from anker_companion.engine import CompanionEngine
from anker_companion.protocol import ProtocolError, b64, canonical, derive_keys, open_envelope, pair_proof, public_bytes, seal, stamp, utc
from anker_companion.server import BridgeServer, PairingManager, allowed_address, tls_context
from anker_companion.storage import AtomicStateStore
from tests.helpers import Clock, FakePlatform, TestVault, state


class ServerTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.clock = Clock()
        self.platform = FakePlatform()
        self.vault = TestVault()
        self.store = AtomicStateStore(Path(self.temp.name) / "state", self.vault)
        self.engine = CompanionEngine(self.store, self.platform, self.clock)
        context, self.pin, _ = tls_context(self.store, Path(self.temp.name))
        self.pairing = PairingManager(self.store, "Fixture PC", self.pin, ["127.0.0.1:47830"], self.clock)
        self.bridge = BridgeServer(self.store, self.engine, self.pairing, clock=self.clock, allow_loopback=True)
        self.runner = web.AppRunner(self.bridge.app, access_log=None)
        await self.runner.setup()
        listener = web.TCPSite(self.runner, "127.0.0.1", 0, ssl_context=context)
        await listener.start()
        port = listener._server.sockets[0].getsockname()[1]
        self.url = f"https://127.0.0.1:{port}"
        self.client = aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=aiohttp.Fingerprint(bytes.fromhex(self.pin))), trust_env=True)
        self.addAsyncCleanup(self.client.close)
        self.addAsyncCleanup(self.runner.cleanup)
        self.phone = ec.generate_private_key(ec.SECP256R1())
        self.signing = ec.generate_private_key(ec.SECP256R1())
        self.send_seq = 0
        self.receive_seq = 0

    async def pair(self, approve=True):
        qr = self.pairing.create()["data"]
        self.identifier = qr["id"]
        self.incoming, self.outgoing = derive_keys(self.phone, qr["k"], __import__("anker_companion.protocol", fromlist=["unb64"]).unb64(qr["s"]))
        phone = b64(public_bytes(self.phone.public_key()))
        signing = b64(public_bytes(self.signing.public_key()))
        from anker_companion.protocol import unb64
        request = {"id": self.identifier, "n": "Fixture phone", "k": phone, "signingKey": signing,
                   "proof": pair_proof(unb64(qr["s"]), self.identifier, phone, signing)}
        async with self.client.post(self.url + "/v3/pair", json=request) as response:
            self.assertEqual(response.status, 200)
            self.assertEqual((await response.json())["status"], "pending")
        if approve:
            self.pairing.approve(self.identifier)
        return qr, request

    def envelope(self, payload):
        self.send_seq += 1
        return seal(self.identifier, "phone", self.send_seq, payload, self.incoming, self.clock())

    async def exchange(self, payload):
        async with self.client.post(self.url + "/v3/link", json=self.envelope(payload)) as response:
            self.assertEqual(response.status, 200, await response.text())
            envelope, result = open_envelope(await response.json(), self.identifier, "pc", self.receive_seq, self.outgoing)
            self.receive_seq = envelope["seq"]
            return result

    async def test_pairing_needs_physical_confirmation_and_expires_once(self):
        qr, request = await self.pair(approve=False)
        self.assertFalse(self.store.read()["pairs"])
        async with self.client.get(self.url + "/v3/pair/" + self.identifier) as response:
            self.assertEqual((await response.json())["status"], "pending")
        self.pairing.approve(self.identifier)
        self.assertIn(self.identifier, self.store.read()["pairs"])
        async with self.client.post(self.url + "/v3/pair", json=request) as response:
            self.assertEqual(response.status, 400)
        self.clock.now += 601
        self.assertEqual(self.pairing.status(self.identifier)["status"], "expired")

    async def test_real_wss_ack_and_replay_rejection(self):
        await self.pair()
        async with self.client.ws_connect(self.url + "/v3/ws?pair=" + self.identifier) as socket:
            envelope = self.envelope(state(self.clock))
            await socket.send_json(envelope)
            message = await socket.receive_json()
            _, result = open_envelope(message, self.identifier, "pc", 0, self.outgoing)
            self.assertEqual(result["type"], "ack")
            self.assertEqual(result["revision"], "rev1")
            self.assertEqual(self.store.read()["pairs"][self.identifier]["receiveSeq"], 1)
            await socket.send_json(envelope)
            message = await socket.receive()
            self.assertEqual(message.type, aiohttp.WSMsgType.CLOSE)
            self.assertEqual(socket.close_code, 1008)

    async def test_heartbeat_freshness_requires_authenticated_socket_not_known_pair_id(self):
        await self.pair()
        async with self.client.ws_connect(self.url + "/v3/ws?pair=" + self.identifier, autoping=False) as socket:
            await socket.ping(b"not-authenticated")
            self.assertEqual((await socket.receive()).type, aiohttp.WSMsgType.PONG)
            self.assertNotIn("linkSeenAt", self.store.read()["runtime"])
            await socket.send_json(self.envelope(state(self.clock)))
            await socket.receive_json()
            original = self.clock()
            self.clock.now += 100
            await socket.ping(b"authenticated")
            self.assertEqual((await socket.receive()).type, aiohttp.WSMsgType.PONG)
            self.assertGreater(self.store.read()["runtime"]["linkSeenAt"], original)
            self.assertNotIn("link-stale", self.engine.ack("rev1")["warnings"])

    async def test_rest_unknown_fields_tamper_and_browser_origin_never_have_effects(self):
        await self.pair()
        bad = state(self.clock); bad["unknown"] = True
        async with self.client.post(self.url + "/v3/link", json=self.envelope(bad)) as response:
            self.assertEqual(response.status, 400)
        async with self.client.post(self.url + "/v3/link", json=self.envelope(state(self.clock)), headers={"Origin": "https://attacker.invalid"}) as response:
            self.assertEqual(response.status, 403)
            self.assertNotIn("Access-Control-Allow-Origin", response.headers)
        envelope = self.envelope(state(self.clock)); envelope["ct"] = "AA"
        async with self.client.post(self.url + "/v3/link", json=envelope) as response:
            self.assertEqual(response.status, 400)
        self.assertIsNone(self.store.read()["snapshot"])
        self.assertEqual(self.platform.effects, [])

    async def test_wrong_certificate_pin_is_rejected_before_request(self):
        bad = aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=aiohttp.Fingerprint(bytes(32))), trust_env=True)
        self.addAsyncCleanup(bad.close)
        with self.assertRaises(aiohttp.ServerFingerprintMismatch):
            await bad.get(self.url + "/health")

    async def test_outbox_pull_is_at_least_once_and_cursor_never_skips_page(self):
        await self.pair()
        for index in range(105):
            self.store.event(self.clock(), "2026-11-12", "thought", text=f"Fixture {index}")
        page = await self.exchange({"type": "pull", "after": 0})
        self.assertEqual(len(page["items"]), 100)
        self.assertEqual(page["lastSeq"], 100)
        again = await self.exchange({"type": "pull", "after": 0})
        self.assertEqual(page["items"], again["items"])
        last = await self.exchange({"type": "pull", "after": 100})
        self.assertEqual(len(last["items"]), 5)
        self.assertEqual(last["lastSeq"], 105)

    async def test_utf8_outbox_pages_fit_envelope_and_event_cursor_never_skips(self):
        await self.pair()
        for index in range(50):
            self.store.event(self.clock(), "2026-11-12", "save-point", text="字" * 500, nextStep="語" * 500)
        cursor, seen = 0, []
        while len(seen) < 50:
            batch = await self.exchange({"type": "pull", "after": cursor})
            self.assertTrue(batch["items"])
            self.assertEqual(batch["lastSeq"], batch["items"][-1]["seq"])
            seen.extend(item["seq"] for item in batch["items"])
            cursor = batch["lastSeq"]
        self.assertEqual(seen, list(range(1, 51)))

    async def test_durable_receive_sequence_survives_restart(self):
        await self.pair()
        await self.exchange(state(self.clock))
        restored = AtomicStateStore(self.store.path, self.vault)
        self.assertEqual(restored.read()["pairs"][self.identifier]["receiveSeq"], 1)
        self.assertNotIn(b"phoneToPc", self.store.path.read_bytes())
        self.assertNotIn(b"Fixture phone", self.store.path.read_bytes())

    async def test_emergency_ack_correlates_only_signed_real_grant_and_same_command_is_idempotent(self):
        await self.pair()
        value = state(self.clock); value.update(state="NIGHT_LOCK", lockEnforced=True); value["prefs"]["strictLock"] = True
        await self.exchange(value)
        token = {"v": 3, "pair": self.identifier, "sessionId": value["sessionId"], "date": value["date"],
                 "issuedAt": utc(self.clock()), "expiresAt": utc(self.clock() + 300), "until": utc(self.clock() + 900), "nonce": b64(bytes(range(16)))}
        token["signature"] = b64(self.signing.sign(canonical(token), ec.ECDSA(hashes.SHA256())))
        command = {"type": "command", "id": "hardware-fixture", "action": "EMERGENCY_EXTENSION", "token": token}
        accepted = await self.exchange(command)
        self.assertEqual(accepted["commandId"], "hardware-fixture")
        self.assertEqual(accepted["emergencyUntil"], token["until"])
        repeated = await self.exchange(command)
        self.assertEqual(repeated["emergencyUntil"], accepted["emergencyUntil"])
        changed = deepcopy(command); changed["token"]["nonce"] = b64(bytes([1]) * 16)
        async with self.client.post(self.url + "/v3/link", json=self.envelope(changed)) as response:
            self.assertEqual(response.status, 400)

    async def test_unpair_is_authenticated_and_removes_state_and_secret_keys(self):
        await self.pair(); await self.exchange(state(self.clock))
        response = await self.exchange({"type": "command", "id": "unpair-fixture", "action": "unpair"})
        self.assertEqual(response["commandId"], "unpair-fixture")
        self.assertEqual(self.store.read()["pairs"], {})
        self.assertIsNone(self.store.read()["snapshot"])

    async def test_public_address_is_not_local_and_origin_never_gets_cors(self):
        self.assertFalse(allowed_address("8.8.8.8"))
        self.assertFalse(allowed_address("127.0.0.1"))
        self.assertTrue(allowed_address("127.0.0.1", True))
        self.assertTrue(allowed_address("192.168.1.20"))
        self.assertTrue(allowed_address("fd00::1"))

    async def test_ui_ack_only_after_durable_commit_and_echoes_exact_request(self):
        class UI:
            def __init__(self): self.messages = []
            def render(self, value): self.messages.append(value)
        ui = UI(); self.bridge.ui = ui; self.engine.ui = ui
        self.bridge.ui_action({"action": "thought", "text": "Synthetische Notiz", "requestId": "dialog-one"})
        self.assertEqual(ui.messages[-1]["actionResult"], {"action": "thought", "ok": True, "requestId": "dialog-one"})
        before = self.store.read(); self.vault.fail = True
        self.bridge.ui_action({"action": "savepoint", "text": "Noch nicht gespeichert", "requestId": "dialog-two"})
        self.assertEqual(ui.messages[-1]["actionResult"], {"action": "savepoint", "ok": False, "requestId": "dialog-two"})
        self.assertEqual(self.store.read(), before)
        self.vault.fail = False
        self.bridge.ui_action({"action": "settings", "prefs": {"enforceEnabled": True}, "requestId": "settings-one"})
        self.assertEqual(ui.messages[-1]["actionResult"], {"action": "settings", "ok": True, "requestId": "settings-one"})

    async def scheduled_monday_night(self):
        self.clock.now = stamp("2026-11-09T21:00:00Z")
        await self.pair()
        self.engine.local_settings({"enforceEnabled": True, "strictLock": True})
        value = state(self.clock, sessionId="day:2026-11-09", date="2026-11-09")
        value["prefs"].update(strictLock=True, offlinePolicy="fixed-time")
        await self.exchange(value)
        self.clock.now += 1800; self.engine.tick(); self.clock.now += 60; self.engine.tick()
        self.assertTrue(self.store.read()["runtime"]["nightLatch"]["scheduledNight"])
        self.assertFalse(value["lockEnforced"])
        self.clock.now = stamp("2026-11-10T07:15:00Z")
        completed = deepcopy(value)
        completed.update(state="MORNING_COMPLETED", sessionId="day:2026-11-10", date="2026-11-10", generatedAt=utc(self.clock()))
        return value, completed

    async def test_encrypted_real_tuesday_completion_releases_only_its_monday_schedule_latch(self):
        value, completed = await self.scheduled_monday_night()
        for patch in ({"sessionId": "day:2026-11-09", "date": "2026-11-09"}, {"sessionId": "day:2026-11-11", "date": "2026-11-11"}, {"sessionId": "unrelated"}):
            bad = {**completed, **patch}
            async with self.client.post(self.url + "/v3/link", json=self.envelope(bad)) as response:
                self.assertEqual(response.status, 400)
            self.assertIsNotNone(self.engine.active_latch(self.store.read(), self.clock()))
        wrong_morning = deepcopy(completed)
        wrong_morning["schedule"].update(wakeAt="2026-11-11T06:00:00Z", morningDeadlineAt="2026-11-11T09:00:00Z")
        async with self.client.post(self.url + "/v3/link", json=self.envelope(wrong_morning)) as response:
            self.assertEqual(response.status, 400)
        other_pair = "other-fixture-pair"
        self.store.update(lambda data: data["pairs"].update({other_pair: {**data["pairs"][self.identifier], "receiveSeq": 0, "sendSeq": 0}}))
        foreign = seal(other_pair, "phone", 1, completed, self.incoming, self.clock())
        async with self.client.post(self.url + "/v3/link", json=foreign) as response:
            self.assertEqual(response.status, 400)
        self.assertIsNotNone(self.engine.active_latch(self.store.read(), self.clock()))
        result = await self.exchange(completed)
        self.assertEqual(result["effective"]["mode"], "released")
        self.assertIsNone(self.engine.active_latch(self.store.read(), self.clock()))
        self.clock.now += 15; self.engine.tick()
        self.assertEqual(self.platform.effects, ["lock"])

    async def test_new_day_hardware_emergency_binds_to_original_finite_schedule_latch(self):
        value, completed = await self.scheduled_monday_night()
        active = {**completed, "state": "MORNING_ACTIVE"}
        await self.exchange(active)
        original = self.store.read()["runtime"]["nightLatch"]
        token = {"v": 3, "pair": self.identifier, "sessionId": active["sessionId"], "date": active["date"],
                 "issuedAt": utc(self.clock()), "expiresAt": utc(self.clock() + 300), "until": utc(self.clock() + 900), "nonce": b64(bytes(range(16)))}
        token["signature"] = b64(self.signing.sign(canonical(token), ec.ECDSA(hashes.SHA256())))
        accepted = await self.exchange({"type": "command", "id": "tuesday-hardware", "action": "EMERGENCY_EXTENSION", "token": token})
        runtime = self.store.read()["runtime"]
        self.assertEqual(accepted["emergencyUntil"], token["until"])
        self.assertEqual(accepted["effective"]["date"], "2026-11-10")
        self.assertEqual(runtime["emergencySessionId"], value["sessionId"])
        self.assertEqual(runtime["nightLatch"]["validUntil"], original["validUntil"])
        self.assertEqual(self.engine.ack(active["revision"])["effective"]["stopAt"], token["until"])
        self.clock.now += 10; self.engine.tick()
        self.assertEqual(self.platform.effects, ["lock"])

    async def test_later_real_bedtime_override_upgrades_identity_without_extending_auto_night(self):
        value, _ = await self.scheduled_monday_night()
        self.clock.now = stamp("2026-11-09T22:00:00Z")
        actual = deepcopy(value)
        actual.update(state="NIGHT_LOCK", sessionId="night:2026-11-09:bed-override", lockEnforced=True, generatedAt=utc(self.clock()), validUntil=utc(self.clock() + 18 * 3600))
        await self.exchange(actual)
        latch = self.store.read()["runtime"]["nightLatch"]
        self.assertFalse(latch["scheduledNight"])
        self.assertEqual(latch["sessionId"], actual["sessionId"])
        self.assertEqual(latch["validUntil"], value["validUntil"])
        self.clock.now = stamp("2026-11-10T07:15:00Z")
        bad = {**actual, "state": "MORNING_COMPLETED", "sessionId": "day:2026-11-10", "date": "2026-11-10", "generatedAt": utc(self.clock())}
        async with self.client.post(self.url + "/v3/link", json=self.envelope(bad)) as response:
            self.assertEqual(response.status, 400)
        completed = {**bad, "sessionId": actual["sessionId"]}
        self.assertEqual((await self.exchange(completed))["effective"]["mode"], "released")


if __name__ == "__main__":
    unittest.main()
