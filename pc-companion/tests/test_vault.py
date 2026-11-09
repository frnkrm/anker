from __future__ import annotations

import os
import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from anker_companion.vault import DpapiVault, VaultError


class FakeProvider:
    def __init__(self): self.input = None
    def protect(self, value): self.input = value; return b"opaque-test-ciphertext"
    def unprotect(self, value):
        if value != b"opaque-test-ciphertext": raise VaultError("authentication-failed")
        return self.input


class DpapiBoundaryTests(unittest.TestCase):
    def test_uses_injected_protection_boundary_not_a_plaintext_fallback(self):
        provider = FakeProvider(); vault = DpapiVault(provider)
        encrypted = vault.protect(b"private-direction-keys")
        self.assertNotIn(b"private-direction-keys", encrypted)
        self.assertEqual(vault.unprotect(encrypted), b"private-direction-keys")

    def test_rejects_plaintext_or_unknown_container(self):
        vault = DpapiVault(FakeProvider())
        for value in [b'{}', b'private-direction-keys', b'', vault.HEADER]:
            with self.assertRaisesRegex(VaultError, "invalid-vault-format"): vault.unprotect(value)

    def test_does_not_swallow_provider_authentication_failure(self):
        with self.assertRaisesRegex(VaultError, "authentication-failed"):
            DpapiVault(FakeProvider()).unprotect(DpapiVault.HEADER+b"modified")

    def test_real_non_windows_never_falls_back_to_plaintext(self):
        if os.name != "nt":
            with self.assertRaisesRegex(VaultError, "dpapi-unavailable"): DpapiVault().protect(b"secret")

    def test_rejects_invalid_input_types_before_provider(self):
        with self.assertRaisesRegex(VaultError, "invalid-vault-value"): DpapiVault(FakeProvider()).protect("not-bytes")


if __name__ == "__main__": unittest.main()
