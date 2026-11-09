from copy import deepcopy
from datetime import datetime
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from anker_companion.protocol import utc


class TestVault:
    """Explicit test injection. Production never selects this implementation."""
    def __init__(self, key=None):
        self.key = key or os.urandom(32)
        self.fail = False

    def protect(self, value):
        if self.fail:
            raise OSError("synthetic-storage-failure")
        nonce = os.urandom(12)
        return nonce + AESGCM(self.key).encrypt(nonce, value, b"fixture")

    def unprotect(self, value):
        return AESGCM(self.key).decrypt(value[:12], value[12:], b"fixture")


class Clock:
    def __init__(self, at="2026-11-12T21:00:00Z"):
        self.now = datetime.fromisoformat(at.replace("Z", "+00:00")).timestamp()

    def __call__(self):
        return self.now


class FakePlatform:
    def __init__(self):
        self.effects = []
        self.conflict = False
        self.observation = {"locked": False, "idleSeconds": 0}

    def legacy_conflict(self):
        return self.conflict

    def sample(self):
        value = deepcopy(self.observation)
        self.observation.pop("powerEvent", None)
        return value

    def lock(self):
        self.effects.append("lock")

    def hibernate(self):
        self.effects.append("hibernate")

    def shutdown(self):
        self.effects.append("shutdown")


def state(clock, **patch):
    at = clock()
    value = {"type": "state", "state": "WIND_DOWN_T30", "sessionId": "night-fixture", "revision": "rev1",
             "date": "2026-11-12", "generatedAt": utc(at), "validUntil": utc(at + 12 * 3600),
             "remainingSeconds": 1800, "routineStep": None, "lockEnforced": False,
             "schedule": {"windDownAt": utc(at), "brainDumpAt": utc(at + 1200), "bedAt": utc(at + 1800), "wakeAt": utc(at + 9 * 3600), "morningDeadlineAt": utc(at + 12 * 3600)},
             "prefs": {"enforceEnabled": True, "strictLock": False, "dimEnabled": False, "dimMax": .25, "audioDuck": False,
                       "shareBrainDump": False, "morningCountdown": False, "offlinePolicy": "pause", "stopAction": "lock", "graceSeconds": 60}}
    value.update(patch)
    return value
