"""Actual AES-GCM/exchange and local pinned-TLS relay-adapter checks; no cloud."""
from __future__ import annotations

import asyncio
from copy import deepcopy
import json
from pathlib import Path
import tempfile
import unittest

import aiohttp
from aiohttp import web

from anker_companion.engine import CompanionEngine
from anker_companion.protocol import b64, canonical, open_envelope, seal, utc
from anker_companion.relay import RelayError, RelayHttpClient, RelayPump, SETUP_PREFIX, clear_relay, configure_relay, disable_relay, relay_configuration
from anker_companion.server import BridgeServer, PairingManager, tls_context
from anker_companion.storage import AtomicStateStore
from tests.helpers import Clock, FakePlatform, TestVault, state

PAIR = "synthetic-relay-pair"
PROJECT = "a" * 20
TOKEN = "b" * 64


def setup_code(**patch):
    return SETUP_PREFIX + b64(canonical({"project": PROJECT, "pair": PAIR, "deviceToken": TOKEN, **patch}))


class RelayTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.clock = Clock(); self.platform = FakePlatform()
        self.store = AtomicStateStore(Path(self.temp.name) / "state", TestVault())
        self.phone_key, self.pc_key = bytes(range(32)), bytes(reversed(range(32)))
        self.store.update(lambda data: data["pairs"].update({PAIR: {"phoneToPc": b64(self.phone_key), "pcToPhone": b64(self.pc_key), "sendSeq": 0, "receiveSeq": 0, "signingKey": "synthetic-unused"}}))
        self.engine = CompanionEngine(self.store, self.platform, self.clock)
        self.bridge = BridgeServer(self.store, self.engine, PairingManager(self.store, "Synthetic PC", "a" * 64, [], self.clock), clock=self.clock)
        self.lan = False
        self.pump = RelayPump(self.store, lambda raw, pair: self.bridge.relay_exchange(raw, expected_pair=pair), lambda _pair: self.lan, self.clock)
        self.requests, self.inbox, self.replies = [], [], []
        self.http_status = 200
        self.bad_response = None
        self.get_received, self.release_get = asyncio.Event(), asyncio.Event()
        self.release_get.set()
        async def handler(request):
            self.assertEqual(request.headers.get('x-anker-relay-token'), TOKEN)
            body = await request.json(); self.requests.append(deepcopy(body))
            if self.http_status != 200:
                return web.json_response({"private-error": TOKEN}, status=self.http_status)
            if self.bad_response is not None:
                return web.Response(body=self.bad_response, content_type="application/json")
            if body["operation"] == "get":
                self.get_received.set(); await self.release_get.wait()
                return web.json_response({"ok": True, "envelopes": [item for item in self.inbox if item["seq"] > body["after"]][:8]})
            self.replies.append(deepcopy(body["envelope"]))
            return web.json_response({"ok": True})
        app = web.Application(); app.router.add_post('/functions/v1/pc-link', handler)
        context, pin, _ = tls_context(self.store, Path(self.temp.name))
        runner = web.AppRunner(app, access_log=None); await runner.setup(); self.addAsyncCleanup(runner.cleanup)
        listener = web.TCPSite(runner, '127.0.0.1', 0, ssl_context=context); await listener.start()
        self.local_url = f'https://127.0.0.1:{listener._server.sockets[0].getsockname()[1]}/functions/v1/pc-link'
        self.session = aiohttp.ClientSession(trust_env=True); self.addAsyncCleanup(self.session.close)
        test = self
        class RoutedSession:
            """Only the test substitutes the endpoint, retaining real certificate pin validation."""
            def post(self, url, **options):
                test.assertEqual(url, f'https://{PROJECT}.supabase.co/functions/v1/pc-link')
                test.assertIs(options['ssl'], True)
                test.assertIs(options['allow_redirects'], False)
                test.assertEqual(options['timeout'].total, 10)
                options['ssl'] = aiohttp.Fingerprint(bytes.fromhex(pin))
                return test.session.post(test.local_url, **options)
        self.routed = RoutedSession()

    def enable(self): configure_relay(self.store, setup_code())
    def add(self, payload=None, seq=1):
        frame = seal(PAIR, 'phone', seq, payload or state(self.clock), self.phone_key, self.clock())
        self.inbox.append(frame)
        return frame

    async def test_absent_disabled_or_unpaired_setup_performs_no_network(self):
        await self.pump.tick(self.routed); self.assertEqual(self.requests, [])
        self.enable(); disable_relay(self.store)
        await self.pump.tick(self.routed); self.assertEqual(self.requests, [])
        self.enable(); self.store.update(lambda data: data.update(pairs={}))
        await self.pump.tick(self.routed)
        self.assertEqual(self.requests, []); self.assertFalse(self.pump.public_status()['enabled'])

    async def test_fresh_authenticated_lan_has_priority_without_contacting_cloud(self):
        self.enable(); self.lan = True; self.add()
        await self.pump.tick(self.routed)
        self.assertEqual(self.requests, []); self.assertEqual(self.pump.public_status()['status'], 'lan')
        self.assertIsNone(self.store.read()['snapshot'])

    async def test_real_encrypted_tls_roundtrip_uses_existing_exchange_and_durable_counters(self):
        self.enable(); self.add()
        await self.pump.tick(self.routed)
        self.assertEqual([value['operation'] for value in self.requests], ['get', 'put'])
        self.assertEqual(self.store.read()['snapshot'], state(self.clock))
        pair = self.store.read()['pairs'][PAIR]
        self.assertEqual((pair['receiveSeq'], pair['sendSeq']), (1, 1))
        result = open_envelope(self.replies[0], PAIR, 'pc', 0, self.pc_key)[1]
        self.assertEqual(result['type'], 'ack'); self.assertEqual(result['revision'], 'rev1')
        self.assertEqual(self.store.read()['relay']['pendingReplies'], [])
        self.assertEqual(self.pump.public_status()['status'], 'received')
        self.assertNotIn('revision', self.pump.public_status())
        self.assertNotIn(TOKEN, json.dumps(self.pump.public_status()))
        self.assertEqual(self.platform.effects, [])

    async def test_relay_get_uses_same_counter_as_a_previously_received_lan_frame(self):
        self.enable()
        first = self.add(seq=1)
        self.bridge.exchange(canonical(first).decode(), expected_pair=PAIR)
        self.add(seq=2)
        await self.pump.tick(self.routed)
        self.assertEqual(self.requests[0]['after'], 1)
        self.assertEqual(self.store.read()['pairs'][PAIR]['receiveSeq'], 2)
        self.assertEqual(self.store.read()['pairs'][PAIR]['sendSeq'], 2)

    async def test_lost_ciphertext_reply_retries_exact_frame_without_repeating_effect_or_sequence(self):
        self.enable(); self.add()
        original = self.routed.post
        failure = True
        def post(url, **options):
            nonlocal failure
            if options['json']['operation'] == 'put' and failure:
                failure = False
                self.http_status = 503
            else: self.http_status = 200
            return original(url, **options)
        self.routed.post = post
        await self.pump.tick(self.routed)
        pending = deepcopy(self.store.read()['relay']['pendingReplies'])
        self.assertEqual(len(pending), 1)
        self.assertEqual(self.pump.public_status()['status'], 'unavailable')
        await self.pump.tick(self.routed)
        self.assertEqual(self.replies, pending)
        self.assertEqual(self.store.read()['relay']['pendingReplies'], [])
        self.assertEqual(self.store.read()['pairs'][PAIR]['sendSeq'], 1)
        self.assertEqual(self.store.read()['pairs'][PAIR]['receiveSeq'], 1)

    async def test_disabling_while_http_is_pending_does_not_apply_the_response(self):
        self.enable(); self.add(); self.release_get.clear()
        task = asyncio.create_task(self.pump.tick(self.routed))
        try:
            await asyncio.wait_for(self.get_received.wait(), 1)
            disable_relay(self.store)
        finally:
            self.release_get.set()
            await task
        self.assertIsNone(self.store.read()['snapshot'])
        self.assertEqual(self.store.read()['pairs'][PAIR]['receiveSeq'], 0)
        self.assertEqual(self.replies, [])

    async def test_commit_failure_leaves_same_request_retryable_without_losing_its_reply(self):
        self.enable(); self.add()
        before = self.store.read()
        self.store.vault.fail = True
        await self.pump.tick(self.routed)
        self.assertEqual(self.store.read(), before)
        self.assertEqual(self.replies, [])
        self.store.vault.fail = False
        await self.pump.tick(self.routed)
        self.assertEqual(self.store.read()['pairs'][PAIR]['receiveSeq'], 1)
        self.assertEqual(len(self.replies), 1)

    async def test_unpair_flushes_only_already_sealed_final_reply_then_erases_relay_capability(self):
        self.enable(); self.add({'type': 'command', 'id': 'relay-final-unpair', 'action': 'unpair'})
        await self.pump.tick(self.routed)
        self.assertEqual([row['operation'] for row in self.requests], ['get', 'put'])
        self.assertEqual(len(self.replies), 1)
        self.assertEqual(open_envelope(self.replies[0], PAIR, 'pc', 0, self.pc_key)[1]['commandId'], 'relay-final-unpair')
        self.assertEqual(self.store.read()['pairs'], {})
        self.assertNotIn('relay', self.store.read())
        await self.pump.tick(self.routed)
        self.assertEqual(len(self.requests), 2)

    async def test_final_unpair_reply_cannot_flush_after_local_disable_or_clear(self):
        for deactivate in [disable_relay, clear_relay]:
            with self.subTest(deactivate=deactivate.__name__):
                self.store.update(lambda data: data['pairs'].update({PAIR: {'phoneToPc': b64(self.phone_key), 'pcToPhone': b64(self.pc_key), 'sendSeq': 0, 'receiveSeq': 0}}))
                self.enable()
                raw = seal(PAIR, 'phone', 1, {'type': 'command', 'id': 'local-stop', 'action': 'unpair'}, self.phone_key, self.clock())
                self.bridge.relay_exchange(canonical(raw).decode(), PAIR)
                deactivate(self.store)
                count = len(self.requests)
                await self.pump.tick(self.routed)
                self.assertEqual(len(self.requests), count)

    async def test_expired_private_reply_is_removed_without_deleting_durable_pc_events(self):
        self.enable()
        old = seal(PAIR, 'pc', 1, {'type': 'events', 'items': [], 'lastSeq': 0}, self.pc_key, self.clock())
        self.store.update(lambda data: data['relay'].update(pendingReplies=[old]))
        self.store.event(self.clock(), '2026-11-12', 'thought', text='Synthetic durable thought')
        self.clock.now += 14 * 86400 + 1
        await self.pump.tick(self.routed)
        self.assertEqual(self.store.read()['relay']['pendingReplies'], [])
        self.assertEqual(len(self.store.read()['outbox']), 1)
        self.assertEqual(self.replies, [])
        self.assertEqual(self.pump.public_status()['status'], 'waiting')

    async def test_lan_reconnection_during_get_prevents_relay_side_effects(self):
        self.enable(); self.add(); self.release_get.clear()
        task = asyncio.create_task(self.pump.tick(self.routed))
        try:
            await asyncio.wait_for(self.get_received.wait(), 1)
            self.lan = True
        finally:
            self.release_get.set(); await task
        self.assertIsNone(self.store.read()['snapshot'])
        self.assertEqual(self.replies, [])

    async def test_wrong_pair_direction_or_aead_tag_is_never_accepted_as_a_plan(self):
        self.enable(); frame = self.add()
        for changed in [{**frame, 'pair': 'foreign'}, {**frame, 'from': 'pc'}, {**frame, 'ct': b64(bytes(32))}]:
            self.inbox = [changed]
            await self.pump.tick(self.routed)
            self.assertEqual(self.pump.public_status()['status'], 'rejected')
            self.assertIsNone(self.store.read()['snapshot'])
            self.assertEqual(self.store.read()['pairs'][PAIR]['receiveSeq'], 0)
        self.assertEqual(self.platform.effects, [])

    async def test_unauthorized_oversized_malformed_or_redirect_responses_are_redacted(self):
        self.enable()
        for code, status in [(401, 'unauthorized'), (403, 'unauthorized'), (302, 'unavailable'), (503, 'unavailable')]:
            self.http_status = code
            await self.pump.tick(self.routed)
            self.assertEqual(self.pump.public_status()['status'], status)
            self.assertNotIn(TOKEN, json.dumps(self.pump.public_status()))
        self.http_status = 200
        for response in [b'{', b'x' * 530_000, b'{"ok":true,"envelopes":[{},{}]}']:
            self.bad_response = response
            await self.pump.tick(self.routed)
            self.assertIn(self.pump.public_status()['status'], {'unavailable', 'rejected'})
        self.assertIsNone(self.store.read()['snapshot'])

    async def test_explicit_setup_accepts_only_fixed_supabase_project_and_existing_pair(self):
        for patch in [{'project': 'https://attacker.invalid'}, {'project': 'a' * 19}, {'pair': 'foreign'}, {'deviceToken': 'x' * 64}, {'endpoint': 'https://attacker.invalid'}]:
            with self.assertRaises(RelayError): configure_relay(self.store, setup_code(**patch))
        self.enable()
        self.assertEqual(relay_configuration(self.store).endpoint, f'https://{PROJECT}.supabase.co/functions/v1/pc-link')
        self.assertNotIn(TOKEN, repr(relay_configuration(self.store)))
        self.assertNotIn(TOKEN.encode(), self.store.path.read_bytes())
        clear_relay(self.store)
        self.assertNotIn('relay', self.store.read())
        self.assertEqual(self.requests, [])

    async def test_bad_cursor_and_unordered_mailbox_page_are_rejected(self):
        self.enable(); self.add(seq=2); self.add(seq=1)
        client = RelayHttpClient(relay_configuration(self.store), self.routed, self.clock)
        for cursor in [True, -1, 0.1]:
            with self.assertRaises(RelayError): await client.get(cursor)
        with self.assertRaises(RelayError): await client.get(0)
        self.assertIsNone(self.store.read()['snapshot'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
