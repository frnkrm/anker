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

    def sync_ui(self):
        class UI:
            def __init__(self): self.messages = []
            def render(self, value): self.messages.append(value)
            def ask_pair(self, _value): pass
        ui = UI(); self.bridge.ui = ui; self.engine.ui = ui
        self.bridge.sync_timeout = .5
        return ui

    def sync_results(self, ui, identifier):
        return [item["actionResult"] for item in ui.messages if item.get("actionResult", {}).get("requestId") == identifier]

    async def ws_receive(self, socket):
        raw = await asyncio.wait_for(socket.receive_json(), 1)
        envelope, result = open_envelope(raw, self.identifier, "pc", self.receive_seq, self.outgoing)
        self.receive_seq = envelope["seq"]
        return result

    async def ws_exchange(self, socket, payload):
        await socket.send_json(self.envelope(payload))
        return await self.ws_receive(socket)

    async def sync_socket(self):
        await self.pair()
        socket = await self.client.ws_connect(self.url + "/v3/ws?pair=" + self.identifier, autoping=False)
        self.addAsyncCleanup(socket.close)
        await self.ws_exchange(socket, {"type": "pull", "after": 0})
        return socket

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

    async def test_sync_needs_an_authenticated_wss_session_not_pair_id_or_tcp_connection(self):
        ui = self.sync_ui()
        await self.bridge.ui_action({"action": "sync", "requestId": "unpaired"})
        self.assertEqual(self.sync_results(ui, "unpaired")[0]["status"], "unpaired")
        await self.pair()
        await self.exchange(state(self.clock))
        async with self.client.ws_connect(self.url + "/v3/ws?pair=" + self.identifier) as socket:
            await self.bridge.ui_action({"action": "sync", "requestId": "not-authenticated"})
            self.assertEqual(self.sync_results(ui, "not-authenticated")[0]["status"], "offline")
            self.assertEqual(self.bridge._sessions, {})
            self.assertFalse(socket.closed)
        await self.bridge.ui_action({"action": "sync", "requestId": "offline"})
        self.assertEqual(self.sync_results(ui, "offline")[0]["status"], "offline")

    async def test_sync_sends_encrypted_events_but_stored_state_and_ping_do_not_confirm_it(self):
        ui = self.sync_ui(); socket = await self.sync_socket()
        await self.exchange(state(self.clock))
        self.bridge.sync_timeout = .05
        task = self.bridge.ui_action({"action": "sync", "requestId": "no-new-state"})
        payload = await self.ws_receive(socket)
        self.assertEqual(payload, {"type": "events", "items": [], "lastSeq": 0})
        self.assertEqual(self.sync_results(ui, "no-new-state"), [])
        await socket.ping(b"not-a-plan")
        self.assertEqual((await socket.receive()).type, aiohttp.WSMsgType.PONG)
        await task
        result = self.sync_results(ui, "no-new-state")
        self.assertEqual(len(result), 1)
        self.assertFalse(result[0]["ok"])
        self.assertEqual(result[0]["status"], "timeout")

    async def test_sync_accepts_newly_received_current_cached_state_and_reports_its_real_timestamp(self):
        ui = self.sync_ui(); socket = await self.sync_socket()
        cached = state(self.clock)
        await self.ws_exchange(socket, cached)
        self.clock.now += 30
        task = self.bridge.ui_action({"action": "sync", "requestId": "fresh-receipt"})
        await self.ws_receive(socket)
        self.assertEqual(self.sync_results(ui, "fresh-receipt"), [])
        await self.ws_exchange(socket, cached)
        await task
        result = self.sync_results(ui, "fresh-receipt")[0]
        self.assertTrue(result["ok"])
        self.assertEqual(result["status"], "received")
        self.assertEqual(result["receivedAt"], utc(self.clock()))
        self.assertEqual(result["sourceGeneratedAt"], cached["generatedAt"])
        self.assertNotEqual(result["receivedAt"], result["sourceGeneratedAt"])
        self.assertEqual(self.platform.effects, [])

    async def test_sync_uses_the_last_real_cursor_and_does_not_skip_open_pc_events(self):
        ui = self.sync_ui(); await self.pair()
        for index in range(3): self.store.event(self.clock(), "2026-11-12", "thought", text=f"Synthetic {index}")
        async with self.client.ws_connect(self.url + "/v3/ws?pair=" + self.identifier) as socket:
            initial = await self.ws_exchange(socket, {"type": "pull", "after": 1})
            self.assertEqual([item["seq"] for item in initial["items"]], [2, 3])
            task = self.bridge.ui_action({"action": "sync", "requestId": "with-events"})
            pushed = await self.ws_receive(socket)
            self.assertEqual(pushed, initial)
            await self.ws_exchange(socket, state(self.clock))
            self.assertEqual(self.sync_results(ui, "with-events"), [])
            await self.ws_exchange(socket, {"type": "pull", "after": 3})
            self.assertEqual(self.sync_results(ui, "with-events"), [])
            await self.ws_exchange(socket, state(self.clock))
            await task
            self.assertTrue(self.sync_results(ui, "with-events")[0]["ok"])
            self.assertEqual(len(self.store.read()["outbox"]), 3)

    async def test_sync_with_open_events_requests_phone_opening_instead_of_success(self):
        ui = self.sync_ui(); socket = await self.sync_socket()
        self.store.event(self.clock(), "2026-11-12", "thought", text="Synthetic pending note")
        self.bridge.sync_timeout = .05
        task = self.bridge.ui_action({"action": "sync", "requestId": "pending-events"})
        self.assertEqual(len((await self.ws_receive(socket))["items"]), 1)
        await self.ws_exchange(socket, state(self.clock))
        await task
        result = self.sync_results(ui, "pending-events")[0]
        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "pending-events")
        self.assertIn("Öffne Anker", ui.messages[-1]["message"])

    async def test_sync_expired_foreign_date_or_wrong_effective_revision_does_not_confirm(self):
        ui = self.sync_ui(); socket = await self.sync_socket()
        task = self.bridge.ui_action({"action": "sync", "requestId": "valid-plan-only"})
        await self.ws_receive(socket)
        await self.ws_exchange(socket, state(self.clock, generatedAt=utc(self.clock() - 10), validUntil=utc(self.clock() - 1)))
        self.assertEqual(self.sync_results(ui, "valid-plan-only"), [])
        await self.ws_exchange(socket, state(self.clock, date="2026-11-13"))
        self.assertEqual(self.sync_results(ui, "valid-plan-only"), [])
        await self.ws_exchange(socket, state(self.clock))
        await task
        self.assertTrue(self.sync_results(ui, "valid-plan-only")[0]["ok"])

    async def test_sync_briefing_needs_a_current_entry_and_the_effective_plan_revision(self):
        ui = self.sync_ui(); socket = await self.sync_socket()
        current = state(self.clock)
        await self.ws_exchange(socket, current)
        briefing = {"type": "briefing", "revision": "new-revision", "generatedAt": utc(self.clock()), "validUntil": utc(self.clock() + 3600),
                    "prefs": current["prefs"], "days": [{"date": "2026-11-13", "validUntil": utc(self.clock() + 3600), "pc": {"mode": "paused"}}]}
        task = self.bridge.ui_action({"action": "sync", "requestId": "briefing-revision"})
        await self.ws_receive(socket)
        await self.ws_exchange(socket, briefing)
        self.assertEqual(self.sync_results(ui, "briefing-revision"), [])
        briefing["days"][0]["date"] = "2026-11-12"
        await self.ws_exchange(socket, briefing)
        self.assertEqual(self.sync_results(ui, "briefing-revision"), [])
        await self.ws_exchange(socket, {**current, "revision": "new-revision"})
        await task
        self.assertTrue(self.sync_results(ui, "briefing-revision")[0]["ok"])

    async def test_sync_can_confirm_a_current_briefing_without_a_live_state(self):
        ui = self.sync_ui(); socket = await self.sync_socket()
        task = self.bridge.ui_action({"action": "sync", "requestId": "briefing-only"})
        await self.ws_receive(socket)
        current = state(self.clock)
        briefing = {"type": "briefing", "revision": "briefing-only", "generatedAt": utc(self.clock()), "validUntil": utc(self.clock() + 3600),
                    "prefs": current["prefs"], "days": [{"date": "2026-11-12", "validUntil": utc(self.clock() + 3600), "pc": {"mode": "paused"}}]}
        await self.ws_exchange(socket, briefing)
        await task
        self.assertTrue(self.sync_results(ui, "briefing-only")[0]["ok"])

    async def test_sync_old_replayed_state_is_not_a_fresh_confirmation(self):
        ui = self.sync_ui(); socket = await self.sync_socket()
        current = state(self.clock)
        await self.ws_exchange(socket, current)
        task = self.bridge.ui_action({"action": "sync", "requestId": "old-state"})
        await self.ws_receive(socket)
        await socket.send_json(self.envelope({**current, "generatedAt": utc(self.clock() - 1)}))
        self.assertEqual((await socket.receive()).type, aiohttp.WSMsgType.CLOSE)
        await task
        self.assertEqual(self.sync_results(ui, "old-state")[0]["status"], "offline")
        self.assertFalse(self.sync_results(ui, "old-state")[0]["ok"])
        self.assertEqual(self.store.read()["snapshot"], current)

    async def test_sync_serializes_sequence_reservation_and_send_with_normal_replies(self):
        ui = self.sync_ui(); socket = await self.sync_socket()
        session = next(iter(self.bridge._sessions.values()))
        original_send = session.socket.send_json
        held, release = asyncio.Event(), asyncio.Event()
        async def delayed_send(value, *args, **kwargs):
            if value["seq"] == 2:
                held.set()
                await release.wait()
            return await original_send(value, *args, **kwargs)
        session.socket.send_json = delayed_send
        task = self.bridge.ui_action({"action": "sync", "requestId": "ordered"})
        try:
            await asyncio.wait_for(held.wait(), 1)
            await socket.send_json(self.envelope({"type": "pull", "after": 0}))
            with self.assertRaises(asyncio.TimeoutError):
                await asyncio.wait_for(socket.receive_json(), .03)
            self.assertEqual(self.store.read()["pairs"][self.identifier]["sendSeq"], 2)
            release.set()
            self.assertEqual((await self.ws_receive(socket))["type"], "events")
            self.assertEqual((await self.ws_receive(socket))["type"], "events")
            self.assertEqual(self.receive_seq, 3)
            await self.ws_exchange(socket, state(self.clock))
            await task
            self.assertTrue(self.sync_results(ui, "ordered")[0]["ok"])
        finally:
            release.set()
            session.socket.send_json = original_send
            if not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)

    async def test_sync_request_ids_do_not_cross_confirm_and_rest_is_not_wss(self):
        ui = self.sync_ui(); socket = await self.sync_socket()
        first = self.bridge.ui_action({"action": "sync", "requestId": "first"})
        await self.ws_receive(socket)
        await self.bridge.ui_action({"action": "sync", "requestId": "second"})
        self.assertEqual(self.sync_results(ui, "second")[0]["status"], "busy")
        self.assertEqual(self.sync_results(ui, "first"), [])
        await self.ws_exchange(socket, state(self.clock))
        await first
        third = self.bridge.ui_action({"action": "sync", "requestId": "third"})
        await self.ws_receive(socket)
        await self.exchange(state(self.clock))
        self.assertEqual(self.sync_results(ui, "third"), [])
        await self.ws_exchange(socket, state(self.clock))
        await third
        self.assertEqual(len(self.sync_results(ui, "first")), 1)
        self.assertEqual(len(self.sync_results(ui, "second")), 1)
        self.assertEqual(len(self.sync_results(ui, "third")), 1)
        self.assertTrue(self.sync_results(ui, "third")[0]["ok"])

    async def test_sync_response_from_another_authenticated_session_does_not_confirm_click(self):
        ui = self.sync_ui(); original = await self.sync_socket()
        task = self.bridge.ui_action({"action": "sync", "requestId": "same-session-only"})
        await self.ws_receive(original)
        async with self.client.ws_connect(self.url + "/v3/ws?pair=" + self.identifier) as other:
            await self.ws_exchange(other, state(self.clock))
            self.assertEqual(self.sync_results(ui, "same-session-only"), [])
            await self.ws_exchange(original, state(self.clock))
            await task
        self.assertTrue(self.sync_results(ui, "same-session-only")[0]["ok"])

    async def test_sync_old_socket_cleanup_cannot_end_a_new_request_after_reconnect(self):
        ui = self.sync_ui(); old = await self.sync_socket()
        self.bridge.sync_timeout = .05
        first = self.bridge.ui_action({"action": "sync", "requestId": "old-socket"})
        await self.ws_receive(old)
        async with self.client.ws_connect(self.url + "/v3/ws?pair=" + self.identifier) as new:
            await self.ws_exchange(new, state(self.clock))
            self.assertEqual(self.sync_results(ui, "old-socket"), [])
            await first
            self.assertEqual(self.sync_results(ui, "old-socket")[0]["status"], "timeout")
            self.bridge.sync_timeout = .5
            second = self.bridge.ui_action({"action": "sync", "requestId": "new-socket"})
            await self.ws_receive(new)
            await old.close()
            self.assertEqual(self.sync_results(ui, "new-socket"), [])
            await self.ws_exchange(new, state(self.clock))
            await second
        self.assertTrue(self.sync_results(ui, "new-socket")[0]["ok"])
        self.assertEqual(len(self.sync_results(ui, "old-socket")), 1)

    async def test_sync_cursor_ahead_of_durable_pc_sequence_is_not_an_acknowledgement(self):
        ui = self.sync_ui(); await self.pair()
        async with self.client.ws_connect(self.url + "/v3/ws?pair=" + self.identifier) as socket:
            await self.ws_exchange(socket, {"type": "pull", "after": 5})
            self.bridge.sync_timeout = .05
            task = self.bridge.ui_action({"action": "sync", "requestId": "future-cursor"})
            self.assertEqual((await self.ws_receive(socket))["lastSeq"], 5)
            await self.ws_exchange(socket, state(self.clock))
            await task
        result = self.sync_results(ui, "future-cursor")[0]
        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "pending-events")

    async def test_sync_disconnect_and_deadline_while_waiting_for_send_lock_are_honest(self):
        ui = self.sync_ui(); socket = await self.sync_socket()
        task = self.bridge.ui_action({"action": "sync", "requestId": "disconnect"})
        await self.ws_receive(socket)
        await socket.close()
        await task
        self.assertEqual(self.sync_results(ui, "disconnect")[0]["status"], "offline")
        socket = await self.client.ws_connect(self.url + "/v3/ws?pair=" + self.identifier)
        self.addAsyncCleanup(socket.close)
        await self.ws_exchange(socket, {"type": "pull", "after": 0})
        session = next(iter(self.bridge._sessions.values()))
        await session.send_lock.acquire()
        self.bridge.sync_timeout = .03
        before = self.store.read()["pairs"][self.identifier]["sendSeq"]
        try:
            await self.bridge.ui_action({"action": "sync", "requestId": "lock-timeout"})
        finally:
            session.send_lock.release()
        self.assertEqual(self.sync_results(ui, "lock-timeout")[0]["status"], "timeout")
        self.assertEqual(self.store.read()["pairs"][self.identifier]["sendSeq"], before)

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

    async def scheduled_monday_night(self, bedtime_sequence=None):
        self.clock.now = stamp("2026-11-09T21:00:00Z")
        await self.pair()
        self.engine.local_settings({"enforceEnabled": True, "strictLock": True})
        value = state(self.clock, sessionId="day:2026-11-09", date="2026-11-09")
        value["prefs"].update(strictLock=True, offlinePolicy="fixed-time")
        if bedtime_sequence is not None:
            value["prefs"]["bedtimeSequence"] = bedtime_sequence
            value["schedule"]["pcStopAt"] = utc(stamp(value["schedule"]["bedAt"]) - 1800)
        await self.exchange(value)
        self.clock.now = stamp(value["schedule"]["bedAt"] if bedtime_sequence is not False else value["schedule"]["pcStopAt"])
        self.engine.tick(); self.clock.now += 60; self.engine.tick()
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

    async def assert_auto_night_emergency_without_prior_phone_qr(self, bedtime_sequence):
        original, morning = await self.scheduled_monday_night(bedtime_sequence)
        active = {**morning, "state": "MORNING_ACTIVE"}
        self.assertFalse(active["lockEnforced"])
        self.platform.observation["locked"] = True
        self.engine.tick()
        acknowledged = await self.exchange(active)
        expected_stop = original["schedule"]["bedAt"] if bedtime_sequence else original["schedule"]["pcStopAt"]
        self.assertEqual(acknowledged["effective"], {"date": "2026-11-10", "mode": "locked", "stopAt": expected_stop})
        self.assertLess(stamp(acknowledged["effective"]["stopAt"]), self.clock())
        self.assertEqual(acknowledged["warnings"], [])
        latch = self.engine.active_latch(self.store.read(), self.clock())
        token = {"v": 3, "pair": self.identifier, "sessionId": active["sessionId"], "date": active["date"],
                 "issuedAt": utc(self.clock()), "expiresAt": utc(self.clock() + 300), "until": utc(self.clock() + 900), "nonce": b64(bytes(range(16)))}
        token["signature"] = b64(self.signing.sign(canonical(token), ec.ECDSA(hashes.SHA256())))
        accepted = await self.exchange({"type": "command", "id": "real-qr-after-auto-night", "action": "EMERGENCY_EXTENSION", "token": token})
        self.assertEqual(accepted["emergencyUntil"], token["until"])
        self.assertEqual(self.store.read()["runtime"]["emergencySessionId"], latch["sessionId"])
        self.assertEqual(self.store.read()["runtime"]["nightLatch"]["validUntil"], latch["validUntil"])
        beyond = {**token, "until": utc(stamp(latch["morningDeadlineAt"]) + 60), "nonce": b64(bytes(range(16, 32)))}
        beyond.pop("signature")
        beyond["signature"] = b64(self.signing.sign(canonical(beyond), ec.ECDSA(hashes.SHA256())))
        async with self.client.post(self.url + "/v3/link", json=self.envelope({"type": "command", "id": "outside-original-night", "action": "EMERGENCY_EXTENSION", "token": beyond})) as response:
            self.assertEqual(response.status, 400)
        self.assertEqual(self.store.read()["runtime"]["nightLatch"]["validUntil"], latch["validUntil"])

    async def test_observed_locked_ack_allows_signed_qr_for_automatic_legacy_night_after_four(self):
        await self.assert_auto_night_emergency_without_prior_phone_qr(False)

    async def test_observed_locked_ack_allows_signed_qr_for_automatic_bedtime_night_after_four(self):
        await self.assert_auto_night_emergency_without_prior_phone_qr(True)

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
