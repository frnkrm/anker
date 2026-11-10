import json
import unittest

from anker_companion.protocol import ProtocolError, canonical, open_envelope
from tests import test_server as server_helpers
from tests.helpers import state


class AtomicRelayServerTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = server_helpers.ServerTests.asyncSetUp
    pair = server_helpers.ServerTests.pair
    envelope = server_helpers.ServerTests.envelope

    def enable(self):
        self.store.update(lambda data: data.update(relay={"enabled": True, "project": "a" * 20, "pair": self.identifier, "deviceToken": "1" * 64, "pendingReplies": []}))

    async def test_failed_atomic_commit_preserves_counters_effects_events_and_reply_queue(self):
        await self.pair(); self.enable()
        self.bridge.exchange(canonical(self.envelope(state(self.clock))))
        before = self.store.read()
        raw = canonical(self.envelope({"type": "command", "id": "atomic-extension", "action": "extend", "minutes": 15}))
        self.vault.fail = True
        with self.assertRaises(OSError): self.bridge.relay_exchange(raw, self.identifier)
        self.assertEqual(self.store.read(), before)
        self.vault.fail = False
        reply = self.bridge.relay_exchange(raw, self.identifier)
        after = self.store.read()
        self.assertEqual(after["pairs"][self.identifier]["receiveSeq"], before["pairs"][self.identifier]["receiveSeq"] + 1)
        self.assertEqual(after["pairs"][self.identifier]["sendSeq"], before["pairs"][self.identifier]["sendSeq"] + 1)
        self.assertEqual(after["relay"]["pendingReplies"], [reply])
        self.assertEqual(len(after["outbox"]), len(before["outbox"]) + 1)
        _, payload = open_envelope(reply, self.identifier, "pc", before["pairs"][self.identifier]["sendSeq"], self.outgoing)
        self.assertEqual(payload["commandId"], "atomic-extension")

    async def test_relay_reply_is_durable_in_same_single_commit_as_input_and_output_sequence(self):
        await self.pair(); self.enable(); commits = []
        original = self.store._write
        def write(data):
            original(data); commits.append(data)
        self.store._write = write
        reply = self.bridge.relay_exchange(canonical(self.envelope(state(self.clock))), self.identifier)
        self.assertEqual(len(commits), 1)
        self.assertEqual(commits[0]["pairs"][self.identifier]["receiveSeq"], 1)
        self.assertEqual(commits[0]["pairs"][self.identifier]["sendSeq"], 1)
        self.assertEqual(commits[0]["relay"]["pendingReplies"], [reply])
        with self.assertRaises(ProtocolError):
            self.bridge.relay_exchange(canonical(self.envelope(state(self.clock))), "different-pair")

    async def test_disabled_missing_or_full_relay_never_consumes_a_frame(self):
        await self.pair()
        for config in [None, {"enabled": False, "pair": self.identifier, "pendingReplies": []}, {"enabled": True, "pair": "foreign", "pendingReplies": []}, {"enabled": True, "pair": self.identifier, "pendingReplies": [{}] * 64}]:
            self.store.update(lambda data: data.update(relay=config))
            before = self.store.read()
            with self.assertRaises(ProtocolError): self.bridge.relay_exchange(canonical(self.envelope(state(self.clock))), self.identifier)
            self.assertEqual(self.store.read(), before)

    async def test_unpair_preserves_only_encrypted_final_reply_in_private_relay_group(self):
        await self.pair(); self.enable()
        reply = self.bridge.relay_exchange(canonical(self.envelope({"type": "command", "id": "relay-unpair", "action": "unpair"})), self.identifier)
        data = self.store.read()
        self.assertEqual(data["pairs"], {})
        self.assertEqual(data["relay"]["pendingReplies"], [reply])
        self.assertNotIn("phoneToPc", json.dumps(data))


if __name__ == "__main__": unittest.main()
