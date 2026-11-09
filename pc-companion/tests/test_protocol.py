from copy import deepcopy
import json
from pathlib import Path
import os
import unittest

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec

from anker_companion.protocol import ProtocolError, b64, canonical, derive_keys, open_envelope, public_bytes, seal, stamp, text, unb64, validate_payload, validate_state, verify_emergency, utc, plan_date
from tests.helpers import Clock, state


class ProtocolTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.key = bytes(range(32))

    def test_state_keeps_nullable_unplanned_timestamps(self):
        value = state(self.clock)
        value["schedule"] = {key: None for key in value["schedule"]}
        self.assertIs(validate_state(value), value)

    def test_unknown_fields_and_impossible_lease_are_rejected(self):
        for value in [dict(state(self.clock), extra=True), dict(state(self.clock), validUntil=utc(self.clock() + 19 * 3600))]:
            with self.subTest(value=value.keys()), self.assertRaises(ProtocolError):
                validate_state(value)

    def test_brain_dump_requires_separate_consent(self):
        value = state(self.clock, brainDump={"text": "Nur ein synthetischer Gedanke", "nextStep": "Morgen ansehen"})
        with self.assertRaises(ProtocolError):
            validate_state(value)
        value["prefs"]["shareBrainDump"] = True
        validate_state(value)
        value["brainDump"]["other"] = "unexpected"
        with self.assertRaises(ProtocolError):
            validate_state(value)

    def test_unicode_and_501_units_limits_match_javascript(self):
        self.assertEqual(text("ä" * 500), "ä" * 500)
        self.assertEqual(text("🌅" * 250), "🌅" * 250)
        for invalid in ("🌅" * 251, "A\x00B", "A\x01B"):
            with self.assertRaises(ProtocolError):
                text(invalid)
        for value in ["a" * 501, "🧠" * 251, "\ud800"]:
            with self.subTest(length=len(value)), self.assertRaises(ProtocolError):
                text(value)

    def test_decryption_rejects_tamper_replay_wrong_direction_and_unknown_envelope(self):
        envelope = seal("pair", "phone", 42, state(self.clock), self.key, self.clock(), bytes(range(12)))
        decoded, value = open_envelope(envelope, "pair", "phone", 41, self.key)
        self.assertEqual(decoded["seq"], 42)
        self.assertEqual(value["type"], "state")
        for changed in [dict(envelope, seq=41), dict(envelope, pair="other"), dict(envelope, sender="phone"), dict(envelope, ct=b64(bytes([0]) + unb64(envelope["ct"])[1:]))]:
            with self.subTest(changed=changed.keys()), self.assertRaises(ProtocolError):
                open_envelope(changed, "pair", "phone", 41, self.key)
        with self.assertRaises(ProtocolError):
            open_envelope(envelope, "pair", "pc", 41, self.key)

    def test_sizes_and_noncanonical_base64_are_rejected(self):
        with self.assertRaises(ProtocolError):
            open_envelope(b" " * 65537, "pair", "phone", 0, self.key)
        for value in ["a=", "a", "***", "Zg=="]:
            with self.subTest(value=value), self.assertRaises(ProtocolError):
                unb64(value)

    def test_berlin_day_crosses_at_four_and_dst_offset_is_explicit(self):
        self.assertEqual(plan_date(stamp("2026-11-13T01:30:00+01:00")), "2026-11-12")
        self.assertEqual(plan_date(stamp("2026-11-13T04:00:00+01:00")), "2026-11-13")
        self.assertEqual(stamp("2026-10-25T02:30:00+01:00") - stamp("2026-10-25T02:30:00+02:00"), 3600)

    def test_ecdh_direction_keys_are_equal_but_directions_differ(self):
        a, b = ec.derive_private_key(1, ec.SECP256R1()), ec.derive_private_key(2, ec.SECP256R1())
        first = derive_keys(a, b64(public_bytes(b.public_key())), bytes(range(32)))
        second = derive_keys(b, b64(public_bytes(a.public_key())), bytes(range(32)))
        self.assertEqual(first, second)
        self.assertNotEqual(first[0], first[1])

    def test_shared_root_cross_language_vector(self):
        default = Path(__file__).resolve().parents[2] / "src/core/pcLink/fixtures/v3-crypto.json"
        vector_path = Path(os.environ.get("ANKER_SHARED_FIXTURE", default))
        vector = json.loads(vector_path.read_text())
        phone = ec.derive_private_key(int(vector["phonePrivateScalarHex"], 16), ec.SECP256R1())
        incoming, outgoing = derive_keys(phone, vector["pcPublic"], unb64(vector["salt"], 32))
        self.assertEqual(b64(incoming), vector["phoneToPcKey"])
        self.assertEqual(b64(outgoing), vector["pcToPhoneKey"])
        self.assertEqual(seal("fixture-pair", "phone", 1, vector["payload"], incoming, stamp(vector["envelope"]["sentAt"]), unb64(vector["envelope"]["nonce"])), vector["envelope"])

    def test_emergency_token_is_signed_scoped_finite_and_single_use(self):
        key = ec.generate_private_key(ec.SECP256R1())
        value = state(self.clock)
        token = {"v": 3, "pair": "pair", "sessionId": value["sessionId"], "date": value["date"],
                 "issuedAt": utc(self.clock()), "expiresAt": utc(self.clock() + 300), "until": utc(self.clock() + 900), "nonce": b64(bytes(range(16)))}
        token["signature"] = b64(key.sign(canonical(token), ec.ECDSA(hashes.SHA256())))
        signing = b64(public_bytes(key.public_key()))
        self.assertEqual(verify_emergency(token, "pair", signing, value, set(), self.clock()), self.clock() + 900)
        for bad, used, at in [(token, {token["nonce"]}, self.clock()), (dict(token, sessionId="other"), set(), self.clock()), (token, set(), self.clock() + 301), (dict(token, until=utc(self.clock() + 1800)), set(), self.clock())]:
            with self.subTest(at=at), self.assertRaises(ProtocolError):
                verify_emergency(bad, "pair", signing, value, used, at)


if __name__ == "__main__":
    unittest.main()
