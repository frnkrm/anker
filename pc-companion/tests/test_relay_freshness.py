"""A durable mailbox receipt is not evidence of a currently connected phone."""
from copy import deepcopy
import unittest

from anker_companion.protocol import ProtocolError, canonical, open_envelope, seal, utc
from tests import test_server as server_helpers
from tests import test_relay as relay_helpers
from tests.helpers import state


class RelayFreshnessTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = server_helpers.ServerTests.asyncSetUp
    pair = server_helpers.ServerTests.pair
    envelope = server_helpers.ServerTests.envelope

    async def enabled(self, *, locked=False):
        await self.pair()
        self.store.update(lambda data: data.update(relay={"enabled": True, "project": "a" * 20, "pair": self.identifier, "deviceToken": "1" * 64, "pendingReplies": []}))
        self.store.update(lambda data: data["localPrefs"].update(enforceEnabled=True, strictLock=True))
        value = state(self.clock)
        value["prefs"]["strictLock"] = True
        if locked:
            value.update(state="NIGHT_LOCK", lockEnforced=True)
        self.bridge.exchange(canonical(self.envelope(value)))
        return value

    def queued(self, payload, sent_at):
        self.send_seq += 1
        return canonical(seal(self.identifier, "phone", self.send_seq, payload, self.incoming, sent_at))

    async def test_old_mailbox_pull_keeps_outbox_delivery_but_cannot_restart_paused_automation(self):
        await self.enabled()
        original_contact = self.clock()
        event = self.store.event(self.clock(), "2026-11-12", "extended", newStopAt=utc(self.clock() + 2700))
        self.clock.now += 1860
        self.assertIn("link-stale", self.engine.tick()["warnings"])
        before = self.store.read()
        reply = self.bridge.relay_exchange(self.queued({"type": "pull", "after": 0}, original_contact), self.identifier)
        after = self.store.read()
        _, payload = open_envelope(reply, self.identifier, "pc", before["pairs"][self.identifier]["sendSeq"], self.outgoing)
        self.assertEqual(payload["items"], [event])
        self.assertEqual(after["runtime"]["linkSeenAt"], original_contact)
        self.assertEqual(after["pairs"][self.identifier]["receiveSeq"], before["pairs"][self.identifier]["receiveSeq"] + 1)
        self.assertEqual(after["relay"]["pendingReplies"], [reply])
        self.assertIn("link-stale", self.engine.tick()["warnings"])
        self.clock.now += 61
        self.engine.tick()
        self.assertIsNone(self.store.read()["runtime"].get("nightLatch"))
        self.assertEqual(self.platform.effects, [])

    async def test_delayed_state_is_persisted_without_contact_or_new_night_latch(self):
        value = await self.enabled()
        original_contact = self.clock()
        self.clock.now += 1860
        value.update(state="NIGHT_LOCK", lockEnforced=True, generatedAt=utc(self.clock()))
        self.bridge.relay_exchange(self.queued(value, self.clock() - 91), self.identifier)
        data = self.store.read()
        self.assertEqual(data["snapshot"], value)
        self.assertEqual(data["runtime"]["linkSeenAt"], original_contact)
        self.assertIsNone(data["runtime"].get("nightLatch"))
        self.assertEqual(self.engine.ack(value["revision"])["effective"]["mode"], "paused")
        self.engine.tick(); self.clock.now += 61; self.engine.tick()
        self.assertEqual(self.platform.effects, [])

    async def test_delayed_briefing_is_saved_without_renewing_contact_or_fixed_time_effects(self):
        value = await self.enabled()
        original_contact = self.clock()
        self.clock.now += 1860
        preferences = deepcopy(value["prefs"])
        preferences["offlinePolicy"] = "fixed-time"
        briefing = {"type": "briefing", "revision": "delayed-days", "generatedAt": utc(self.clock()),
            "validUntil": value["validUntil"], "prefs": preferences, "days": [{"date": value["date"],
            "validUntil": value["validUntil"], "pc": {"mode": "scheduled", "stopAt": value["schedule"]["bedAt"], "localTime": "22:30"}}]}
        self.bridge.relay_exchange(self.queued(briefing, self.clock() - 91), self.identifier)
        self.assertEqual(self.store.read()["briefing"], briefing)
        self.assertEqual(self.store.read()["runtime"]["linkSeenAt"], original_contact)
        self.assertEqual(self.engine.ack(briefing["revision"])["effective"]["mode"], "paused")
        self.engine.tick(); self.clock.now += 61; self.engine.tick()
        self.assertEqual(self.platform.effects, [])

    async def test_delayed_morning_release_gets_negative_transport_ack_without_state_or_latch_change(self):
        value = await self.enabled(locked=True)
        self.clock.now += 91
        value.update(state="MORNING_COMPLETED", revision="old-morning", lockEnforced=False, generatedAt=utc(self.clock()))
        before = self.store.read()
        reply = self.bridge.relay_exchange(self.queued(value, self.clock() - 91), self.identifier)
        after = self.store.read()
        _, ack = open_envelope(reply, self.identifier, "pc", before["pairs"][self.identifier]["sendSeq"], self.outgoing)
        self.assertEqual(ack["revision"], before["snapshot"]["revision"])
        self.assertNotEqual(ack["effective"]["mode"], "released")
        self.assertIn("source-expired", ack["warnings"])
        self.assertIn("link-stale", ack["warnings"])
        self.assertNotIn("commandId", ack)
        self.assertEqual(after["snapshot"], before["snapshot"])
        self.assertEqual(after["runtime"], before["runtime"])
        self.assertEqual(after["pairs"][self.identifier]["receiveSeq"], before["pairs"][self.identifier]["receiveSeq"] + 1)
        self.assertEqual(after["relay"]["pendingReplies"], [reply])
        self.assertEqual(self.platform.effects, [])

    async def test_fresh_morning_release_for_a_different_session_remains_atomically_rejected(self):
        value = await self.enabled(locked=True)
        value.update(state="MORNING_COMPLETED", sessionId="foreign-night-session", lockEnforced=False)
        before = self.store.read()
        with self.assertRaisesRegex(ProtocolError, "^morning-session$"):
            self.bridge.relay_exchange(self.queued(value, self.clock()), self.identifier)
        self.assertEqual(self.store.read(), before)

    async def test_delayed_night_frame_does_not_replace_existing_scheduled_latch_identity(self):
        value = await self.enabled()
        self.clock.now += 1800
        self.engine.link_contact(self.clock(), force=True)
        self.engine.tick()
        before = deepcopy(self.store.read()["runtime"]["nightLatch"])
        self.assertTrue(before["scheduledNight"])
        value.update(state="NIGHT_LOCK", lockEnforced=True, sessionId="night:" + value["date"] + ":new-phone-identity", generatedAt=utc(self.clock()))
        self.bridge.relay_exchange(self.queued(value, self.clock() - 91), self.identifier)
        self.assertEqual(self.store.read()["runtime"]["nightLatch"], before)

    async def test_authenticated_send_timestamp_has_exact_symmetric_ninety_second_bound(self):
        await self.enabled()
        for offset in (-91, -90, 90, 91):
            with self.subTest(offset=offset):
                old_contact = self.clock() - 1000
                self.store.update(lambda data: data["runtime"].update(linkSeenAt=old_contact))
                self.bridge.relay_exchange(self.queued({"type": "pull", "after": 0}, self.clock() + offset), self.identifier)
                self.assertEqual(self.store.read()["runtime"]["linkSeenAt"], self.clock() if abs(offset) <= 90 else old_contact)

    async def test_clock_rollback_does_not_make_future_contact_or_old_relay_frame_live(self):
        await self.enabled()
        self.clock.now += 1860
        future_contact = self.clock() + 1000
        self.store.update(lambda data: data["runtime"].update(linkSeenAt=future_contact))
        self.assertIn("link-stale", self.engine.tick()["warnings"])
        self.bridge.relay_exchange(self.queued({"type": "pull", "after": 0}, self.clock() + 1000), self.identifier)
        self.assertEqual(self.store.read()["runtime"]["linkSeenAt"], future_contact)
        self.assertIn("link-stale", self.engine.tick()["warnings"])
        self.clock.now += 61; self.engine.tick()
        self.assertEqual(self.platform.effects, [])

    async def test_normal_live_transport_retains_existing_contact_semantics_for_old_envelopes(self):
        await self.enabled()
        old = self.clock()
        self.clock.now += 1860
        self.bridge.exchange(self.queued({"type": "pull", "after": 0}, old))
        self.assertEqual(self.store.read()["runtime"]["linkSeenAt"], self.clock())
        self.assertNotIn("link-stale", self.engine.ack("rev1")["warnings"])

    async def test_expired_ordinary_commands_never_change_runtime_or_acknowledge_success(self):
        await self.enabled()
        self.clock.now += 1860
        for action in ("extend", "suspend-today", "resume-today", "test-evening", "ping"):
            with self.subTest(action=action):
                self.store.update(lambda data: data["runtime"].update(suspendedDate="2026-11-12" if action == "resume-today" else None))
                payload = {"type": "command", "id": "old-" + action, "action": action}
                if action == "extend": payload["minutes"] = 15
                before = self.store.read()
                reply = self.bridge.relay_exchange(self.queued(payload, self.clock() - 91), self.identifier)
                _, ack = open_envelope(reply, self.identifier, "pc", before["pairs"][self.identifier]["sendSeq"], self.outgoing)
                after = self.store.read()
                self.assertEqual(after["runtime"], before["runtime"])
                self.assertEqual(after["outbox"], before["outbox"])
                self.assertIsNone(self.engine.test_started)
                self.assertIn("command-expired", ack["warnings"])
                self.assertNotIn("commandId", ack)
                self.assertTrue(after["commandResults"][payload["id"]]["expired"])
                self.assertEqual(after["relay"]["pendingReplies"][-1], reply)

    async def test_negative_command_receipt_survives_later_fresh_envelope_and_rejects_hash_change(self):
        await self.enabled()
        payload = {"type": "command", "id": "expired-once", "action": "test-evening"}
        self.bridge.relay_exchange(self.queued(payload, self.clock() - 91), self.identifier)
        persisted = self.store.read()
        self.assertTrue(persisted["commandResults"][payload["id"]]["expired"])
        reply = self.bridge.relay_exchange(self.queued(payload, self.clock()), self.identifier)
        _, ack = open_envelope(reply, self.identifier, "pc", persisted["pairs"][self.identifier]["sendSeq"], self.outgoing)
        self.assertNotIn("commandId", ack)
        self.assertIn("command-expired", ack["warnings"])
        self.assertIsNone(self.engine.test_started)
        self.assertEqual(self.store.read()["commandIds"].count(payload["id"]), 1)
        before = self.store.read()
        with self.assertRaisesRegex(ProtocolError, "^command-id-reused$"):
            self.bridge.relay_exchange(self.queued({**payload, "action": "ping"}, self.clock()), self.identifier)
        self.assertEqual(self.store.read(), before)

    async def test_expired_command_negative_receipt_is_atomic_with_encrypted_reply_and_counters(self):
        await self.enabled()
        raw = self.queued({"type": "command", "id": "failed-expiration", "action": "test-evening"}, self.clock() - 91)
        before = self.store.read(); self.vault.fail = True
        with self.assertRaises(OSError): self.bridge.relay_exchange(raw, self.identifier)
        self.assertEqual(self.store.read(), before)
        self.assertIsNone(self.engine.test_started)
        self.vault.fail = False
        self.bridge.relay_exchange(raw, self.identifier)
        self.assertTrue(self.store.read()["commandResults"]["failed-expiration"]["expired"])
        self.assertIsNone(self.engine.test_started)

    async def test_old_relay_command_flushed_over_live_lan_still_cannot_suspend_today(self):
        value = await self.enabled()
        queued_at = self.clock()
        self.clock.now += 1860
        before = self.store.read()
        reply = self.bridge.exchange(self.queued({"type": "command", "id": "old-via-lan", "action": "suspend-today"}, queued_at))
        _, ack = open_envelope(reply, self.identifier, "pc", before["pairs"][self.identifier]["sendSeq"], self.outgoing)
        self.assertNotIn("commandId", ack)
        self.assertIn("command-expired", ack["warnings"])
        after = self.store.read()
        self.assertIsNone(after["runtime"].get("suspendedDate"))
        self.assertEqual(after["runtime"]["linkSeenAt"], self.clock())
        self.assertTrue(after["commandResults"]["old-via-lan"]["expired"])
        self.assertEqual(after["outbox"], before["outbox"])
        self.assertEqual(after["snapshot"], value)


class RelayMorningMailboxTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = relay_helpers.RelayTests.asyncSetUp
    enable = relay_helpers.RelayTests.enable

    async def test_real_tls_mailbox_continues_from_expired_morning_to_fresh_valid_release(self):
        self.enable()
        pair = relay_helpers.PAIR
        self.store.update(lambda data: data["localPrefs"].update(enforceEnabled=True, strictLock=True))
        current = state(self.clock, state="NIGHT_LOCK", lockEnforced=True)
        current["prefs"]["strictLock"] = True
        self.engine.accept_state(current, pair, self.clock())
        original_latch = deepcopy(self.store.read()["runtime"]["nightLatch"])
        self.clock.now += 91
        old = {**current, "state": "MORNING_COMPLETED", "revision": "obsolete-morning", "lockEnforced": False}
        fresh = {**old, "revision": "fresh-morning", "generatedAt": utc(self.clock())}
        self.inbox.extend([seal(pair, "phone", 1, old, self.phone_key, self.clock() - 91),
                           seal(pair, "phone", 2, fresh, self.phone_key, self.clock())])
        observations = []
        def exchange(raw, pair):
            reply = self.bridge.relay_exchange(raw, expected_pair=pair)
            observations.append(deepcopy(self.store.read()))
            return reply
        self.pump.exchange = exchange
        await self.pump.tick(self.routed)
        self.assertEqual([request["operation"] for request in self.requests], ["get", "put", "put"])
        self.assertEqual(len(observations), 2)
        self.assertEqual(observations[0]["runtime"]["nightLatch"], original_latch)
        self.assertEqual(observations[0]["snapshot"], current)
        first = open_envelope(self.replies[0], pair, "pc", 0, self.pc_key)[1]
        second = open_envelope(self.replies[1], pair, "pc", 1, self.pc_key)[1]
        self.assertEqual(first["revision"], current["revision"])
        self.assertNotEqual(first["effective"]["mode"], "released")
        self.assertIn("source-expired", first["warnings"])
        self.assertEqual(second["revision"], fresh["revision"])
        self.assertEqual(second["effective"]["mode"], "released")
        self.assertEqual(self.store.read()["pairs"][pair]["receiveSeq"], 2)
        self.assertIsNone(self.store.read()["runtime"]["nightLatch"])
        self.assertEqual(self.store.read()["relay"]["pendingReplies"], [])
        self.assertEqual(self.platform.effects, [])


if __name__ == "__main__": unittest.main()
