"""Current-user Windows DPAPI. There is deliberately no plaintext fallback."""
from __future__ import annotations

import ctypes
import os
from typing import Protocol


class VaultError(RuntimeError):
    pass


class ProtectionProvider(Protocol):
    def protect(self, value: bytes) -> bytes: ...
    def unprotect(self, value: bytes) -> bytes: ...


class _Blob(ctypes.Structure):
    _fields_ = [("size", ctypes.c_uint32), ("data", ctypes.POINTER(ctypes.c_ubyte))]


class _NativeDpapi:
    def __init__(self) -> None:
        if os.name != "nt":
            raise VaultError("dpapi-unavailable")
        self.crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
        self.kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        pointer = ctypes.POINTER(_Blob)
        self.crypt32.CryptProtectData.argtypes = [pointer, ctypes.c_wchar_p, pointer, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_uint32, pointer]
        self.crypt32.CryptProtectData.restype = ctypes.c_int
        self.crypt32.CryptUnprotectData.argtypes = [pointer, ctypes.c_void_p, pointer, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_uint32, pointer]
        self.crypt32.CryptUnprotectData.restype = ctypes.c_int
        self.kernel32.LocalFree.argtypes = [ctypes.c_void_p]
        self.kernel32.LocalFree.restype = ctypes.c_void_p

    def _run(self, value: bytes, decrypt: bool) -> bytes:
        buffer = ctypes.create_string_buffer(value, max(1, len(value)))
        source = _Blob(len(value), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
        result = _Blob()
        function = self.crypt32.CryptUnprotectData if decrypt else self.crypt32.CryptProtectData
        # UI_FORBIDDEN, never LOCAL_MACHINE: another Windows account cannot decrypt.
        success = function(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(result))
        if not success:
            raise VaultError("dpapi-unprotect-failed" if decrypt else "dpapi-protect-failed")
        try:
            if result.size > 8 * 1024 * 1024:
                raise VaultError("dpapi-result-too-large")
            return ctypes.string_at(result.data, result.size)
        finally:
            self.kernel32.LocalFree(ctypes.cast(result.data, ctypes.c_void_p))

    def protect(self, value: bytes) -> bytes:
        return self._run(value, False)

    def unprotect(self, value: bytes) -> bytes:
        return self._run(value, True)


class DpapiVault:
    """An injectable provider is only for tests; production always uses native DPAPI."""

    HEADER = b"ANKER-DPAPI\x00\x01"
    MAX_BYTES = 8 * 1024 * 1024

    def __init__(self, provider: ProtectionProvider | None = None) -> None:
        self._provider = provider

    def _get_provider(self) -> ProtectionProvider:
        if self._provider is None:
            self._provider = _NativeDpapi()
        return self._provider

    @staticmethod
    def _check(value: bytes) -> None:
        if not isinstance(value, bytes) or len(value) > DpapiVault.MAX_BYTES:
            raise VaultError("invalid-vault-value")

    def protect(self, value: bytes) -> bytes:
        self._check(value)
        return self.HEADER + self._get_provider().protect(value)

    def unprotect(self, value: bytes) -> bytes:
        self._check(value)
        if not value.startswith(self.HEADER) or len(value) <= len(self.HEADER):
            raise VaultError("invalid-vault-format")
        return self._get_provider().unprotect(value[len(self.HEADER):])
