"""Small Windows capability boundary. Importing this module changes nothing."""
from __future__ import annotations

from collections import deque
import ctypes
from ctypes import wintypes
import io
import math
import os
import subprocess
import struct
import threading
import time
import wave
from typing import Callable, Protocol

from .desktop_settings import DEFAULT_HOTKEYS, parse_hotkey, validate_hotkeys


class PlatformError(RuntimeError):
    pass


class WindowsApi(Protocol):
    def lock(self) -> bool: ...
    def locked(self) -> bool | None: ...
    def idle_seconds(self) -> float: ...
    def notification_state(self) -> int | None: ...
    def monitors(self) -> list[tuple[int, int, int, int]]: ...


class _LastInput(ctypes.Structure):
    _fields_ = [("size", wintypes.UINT), ("tick", wintypes.DWORD)]


class _NativeWindowsApi:
    def __init__(self) -> None:
        if os.name != "nt":
            raise PlatformError("windows-unavailable")
        self.user = ctypes.WinDLL("user32", use_last_error=True)
        self.kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        self.shell = ctypes.WinDLL("shell32", use_last_error=True)
        self.user.LockWorkStation.restype = wintypes.BOOL
        self.user.OpenInputDesktop.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        self.user.OpenInputDesktop.restype = wintypes.HANDLE
        self.user.GetUserObjectInformationW.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
        self.user.CloseDesktop.argtypes = [wintypes.HANDLE]
        self.kernel.GetTickCount64.restype = ctypes.c_ulonglong

    def lock(self) -> bool:
        return bool(self.user.LockWorkStation())

    def locked(self) -> bool | None:
        # Reading the input desktop never switches desktops or captures their contents.
        desktop = self.user.OpenInputDesktop(0, False, 1)
        if not desktop:
            return None
        try:
            name = ctypes.create_unicode_buffer(256)
            needed = wintypes.DWORD()
            if not self.user.GetUserObjectInformationW(desktop, 2, name, ctypes.sizeof(name), ctypes.byref(needed)):
                return None
            value = name.value.casefold()
            if value == "default":
                return False
            if value in {"winlogon", "disconnect", "screen-saver"}:
                return True
            return None
        finally:
            self.user.CloseDesktop(desktop)

    def idle_seconds(self) -> float:
        info = _LastInput(ctypes.sizeof(_LastInput), 0)
        if not self.user.GetLastInputInfo(ctypes.byref(info)):
            raise PlatformError("idle-unavailable")
        # GetLastInputInfo's timestamp wraps after 2**32 ms.
        return ((int(self.kernel.GetTickCount64()) - info.tick) & 0xFFFFFFFF) / 1000

    def notification_state(self) -> int | None:
        value = ctypes.c_int()
        return value.value if self.shell.SHQueryUserNotificationState(ctypes.byref(value)) == 0 else None

    def monitors(self) -> list[tuple[int, int, int, int]]:
        rectangles: list[tuple[int, int, int, int]] = []
        callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HANDLE, wintypes.HDC, ctypes.POINTER(wintypes.RECT), wintypes.LPARAM)
        def visit(_monitor: int, _context: int, rectangle: ctypes.POINTER(wintypes.RECT), _data: int) -> bool:
            item = rectangle.contents
            rectangles.append((item.left, item.top, item.right, item.bottom))
            return True
        callback = callback_type(visit)
        if not self.user.EnumDisplayMonitors(None, None, callback, 0):
            raise PlatformError("monitor-query-failed")
        return rectangles


class WindowsPlatform:
    TASK_NAME = "Anker PC-Stopp"

    def __init__(self, api: WindowsApi | None = None, runner: Callable[..., subprocess.CompletedProcess[str]] | None = None,
                 on_system_event: Callable[[str], None] | None = None, sound_player: Callable[[bytes], None] | None = None) -> None:
        self._api = api
        self._runner = runner or subprocess.run
        self._runner_injected = runner is not None
        self._events: deque[str] = deque(maxlen=32)
        self._lock = threading.Lock()
        self._on_system_event = on_system_event
        self._window_hook: WindowEvents | None = None
        self._session_locked: bool | None = None
        self._sound_player = sound_player

    def _get_api(self) -> WindowsApi:
        if self._api is None:
            self._api = _NativeWindowsApi()
        return self._api

    def _command(self, args: list[str]) -> subprocess.CompletedProcess[str]:
        if os.name != "nt" and not self._runner_injected:
            raise PlatformError("windows-unavailable")
        try:
            return self._runner(args, capture_output=True, text=True, timeout=10, check=False,
                                **({"creationflags": 0x08000000} if os.name == "nt" else {}))
        except (OSError, subprocess.SubprocessError) as error:
            raise PlatformError("windows-command-failed") from error

    def lock(self) -> None:
        if not self._get_api().lock():
            raise PlatformError("lock-request-failed")

    def shutdown(self) -> None:
        # The engine owns the save countdown. A Windows delay >0 can imply force.
        if self._command(["shutdown.exe", "/s", "/t", "0"]).returncode:
            raise PlatformError("shutdown-request-failed")

    def hibernate(self) -> None:
        if self._command(["shutdown.exe", "/h"]).returncode:
            raise PlatformError("hibernate-request-failed")

    def legacy_conflict(self) -> bool:
        result = self._command(["schtasks.exe", "/Query", "/TN", self.TASK_NAME, "/FO", "CSV", "/NH"])
        if result.returncode == 0:
            return True
        # Only the explicit Windows not-found code is a safe absence. Access/query
        # errors remain conflicts, preventing two independent enforcement paths.
        text = (result.stdout + result.stderr).casefold()
        absent = ("cannot find the file" in text or "nicht finden" in text or "nicht gefunden" in text)
        return not absent

    def remove_legacy_task(self) -> None:
        # Called only from the explicit installation-conflict button.
        if self._command(["schtasks.exe", "/Delete", "/TN", self.TASK_NAME, "/F"]).returncode:
            raise PlatformError("legacy-task-remove-failed")

    def notification_state(self) -> int | None:
        return self._get_api().notification_state()

    def quiet_reminder_sound(self) -> dict:
        try:
            state = self.notification_state()
        except Exception:
            state = None
        if type(state) is not int or state not in range(1, 8):
            state = None
        if state is None:
            return {"status": "suppressed", "reason": "notification-state-unknown"}
        # An explicitly opted-in cue remains useful during games/presentations.
        # Still respect no-user/quiet-time/unknown signals without changing DND.
        if state not in {2, 3, 4, 5, 7}:
            return {"status": "suppressed", "reason": "system-busy", "notificationState": state}
        try:
            player = self._sound_player
            if player is None:
                if os.name != "nt":
                    raise PlatformError("windows-unavailable")
                import winsound
                player = lambda value: winsound.PlaySound(value, winsound.SND_MEMORY | winsound.SND_NODEFAULT)
            output = io.BytesIO()
            with wave.open(output, "wb") as signal:
                signal.setnchannels(1); signal.setsampwidth(2); signal.setframerate(24000)
                # A short low-amplitude signal; never change global/system volume.
                samples = [int(1100 * min(1, index / 240, (1919 - index) / 240) * math.sin(2 * math.pi * 660 * index / 24000)) for index in range(1920)]
                signal.writeframes(struct.pack("<" + "h" * len(samples), *samples))
            player(output.getvalue())
            return {"status": "requested", "notificationState": state}
        except Exception:
            return {"status": "unavailable", "reason": "sound-unavailable", "notificationState": state}

    def monitors(self) -> list[tuple[int, int, int, int]]:
        return self._get_api().monitors()

    def _event(self, name: str) -> None:
        with self._lock:
            # A real WTS event confirms the current session. LockWorkStation's
            # return value only confirms that a request was accepted.
            if name in {"lock", "unlock"}:
                self._session_locked = name == "lock"
            elif name == "logoff":
                self._session_locked = None
            self._events.append(name)
        if self._on_system_event is not None:
            # A caller can synchronously persist WM_ENDSESSION before process exit.
            self._on_system_event(name)

    def sample(self) -> dict[str, object]:
        api = self._get_api()
        with self._lock:
            confirmed = self._session_locked
        # OpenInputDesktop can be denied on the secure lock desktop. Once WTS
        # has supplied a session state, an unknown desktop cannot erase it.
        detected = api.locked() if confirmed is None else None
        value: dict[str, object] = {"idleSeconds": api.idle_seconds()}
        with self._lock:
            value["locked"] = self._session_locked if self._session_locked is not None else detected
            if self._events:
                value["powerEvent"] = self._events.popleft()
        return value

    def attach_window(self, window: int) -> None:
        if os.name != "nt":
            return
        self.detach_window()
        self._window_hook = WindowEvents(window, self._event)

    def detach_window(self) -> None:
        if self._window_hook is not None:
            self._window_hook.close()
            self._window_hook = None
        with self._lock:
            # Without the listener a later unlock could no longer update this
            # fact; a newly attached/current session must be observed afresh.
            self._session_locked = None

    def register_hotkeys(self, savepoint: Callable[[], None], thought: Callable[[], None], hotkeys: dict | None = None) -> bool:
        return self._window_hook.register_hotkeys(savepoint, thought, hotkeys) if self._window_hook is not None else False

    def prepare_hotkeys(self, hotkeys: dict) -> object:
        if self._window_hook is None:
            raise PlatformError("hotkeys-unavailable")
        return self._window_hook.prepare_hotkeys(hotkeys)

    def commit_hotkeys(self, token: object) -> bool:
        if self._window_hook is None:
            raise PlatformError("hotkeys-unavailable")
        return self._window_hook.commit_hotkeys(token)

    def rollback_hotkeys(self, token: object) -> bool:
        if self._window_hook is None:
            raise PlatformError("hotkeys-unavailable")
        return self._window_hook.rollback_hotkeys(token)


class WindowEvents:
    """WTS/power/end-session messages only; no process, key or window monitoring."""
    def __init__(self, window: int, notify: Callable[[str], None]) -> None:
        self.window = window
        self.notify = notify
        self.user = ctypes.WinDLL("user32", use_last_error=True)
        self.wts = ctypes.WinDLL("wtsapi32", use_last_error=True)
        self.wts.WTSRegisterSessionNotification.argtypes = [wintypes.HWND, wintypes.DWORD]
        self.wts.WTSRegisterSessionNotification.restype = wintypes.BOOL
        self.wts.WTSUnRegisterSessionNotification.argtypes = [wintypes.HWND]
        self.user.RegisterHotKey.argtypes = [wintypes.HWND, ctypes.c_int, wintypes.UINT, wintypes.UINT]
        self.user.RegisterHotKey.restype = wintypes.BOOL
        self.user.UnregisterHotKey.argtypes = [wintypes.HWND, ctypes.c_int]
        self.callback_type = ctypes.WINFUNCTYPE(ctypes.c_ssize_t, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM)
        self.user.CallWindowProcW.argtypes = [ctypes.c_void_p, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
        self.user.CallWindowProcW.restype = ctypes.c_ssize_t
        self._set_proc = self.user.SetWindowLongPtrW if ctypes.sizeof(ctypes.c_void_p) == 8 else self.user.SetWindowLongW
        self._set_proc.argtypes = [wintypes.HWND, ctypes.c_int, ctypes.c_void_p]
        self._set_proc.restype = ctypes.c_void_p
        self.callback = self.callback_type(self._message)
        self.previous = self._set_proc(window, -4, ctypes.cast(self.callback, ctypes.c_void_p))
        if not self.previous:
            raise PlatformError("session-listener-unavailable")
        self.hotkeys: dict[int, Callable[[], None]] = {}
        self._hotkey_specs: dict[int, str] = {}
        self._hotkey_callbacks: dict[str, Callable[[], None]] = {}
        self._pending_hotkeys: dict | None = None
        self._reserved_hotkeys: set[int] = set()
        self._hotkey_next = 0xA001
        self._hotkey_thread = threading.get_ident()
        self._hotkey_uncertain = False
        self.wts.WTSRegisterSessionNotification(window, 0)

    def _hotkey_owner(self) -> None:
        if threading.get_ident() != self._hotkey_thread:
            raise PlatformError("hotkey-thread-required")
        if self._hotkey_uncertain:
            raise PlatformError("hotkeys-restart-required")

    def register_hotkeys(self, savepoint: Callable[[], None], thought: Callable[[], None], hotkeys: dict | None = None) -> bool:
        self._hotkey_callbacks = {"savepoint": savepoint, "thought": thought}
        try:
            return self.commit_hotkeys(self.prepare_hotkeys(hotkeys or DEFAULT_HOTKEYS))
        except Exception:
            return False

    def prepare_hotkeys(self, hotkeys: dict) -> object:
        self._hotkey_owner()
        desired = validate_hotkeys(hotkeys)
        if self._pending_hotkeys is not None or set(self._hotkey_callbacks) != {"savepoint", "thought"}:
            raise PlatformError("hotkey-change-pending")
        assigned, registered = {}, {}
        try:
            for action, spec in desired.items():
                existing = next((key for key, value in self._hotkey_specs.items() if value == spec), None)
                if existing is not None:
                    assigned[action] = existing
                    continue
                _, modifiers, virtual = parse_hotkey(spec)
                if self._hotkey_next > 0xBFFF:
                    raise PlatformError("hotkey-id-exhausted")
                identifier = self._hotkey_next; self._hotkey_next += 1
                if not self.user.RegisterHotKey(self.window, identifier, modifiers, virtual):
                    raise PlatformError("hotkey-conflict")
                self._reserved_hotkeys.add(identifier)
                registered[identifier] = spec
                assigned[action] = identifier
        except Exception:
            for identifier in registered:
                if self.user.UnregisterHotKey(self.window, identifier):
                    self._reserved_hotkeys.discard(identifier)
                else:
                    self._hotkey_uncertain = True
            raise
        token = object()
        self._pending_hotkeys = {"token": token, "assigned": assigned, "registered": registered, "desired": desired}
        return token

    def commit_hotkeys(self, token: object) -> bool:
        self._hotkey_owner()
        pending = self._pending_hotkeys
        if pending is None or pending["token"] is not token:
            raise PlatformError("hotkey-change-expired")
        keep = set(pending["assigned"].values())
        removed = True
        retained_callbacks, retained_specs = {}, {}
        for identifier in set(self.hotkeys) - keep:
            if self.user.UnregisterHotKey(self.window, identifier):
                self._reserved_hotkeys.discard(identifier)
            else:
                removed = False
                retained_callbacks[identifier] = self.hotkeys[identifier]
                retained_specs[identifier] = self._hotkey_specs[identifier]
        self.hotkeys = {**retained_callbacks, **{identifier: self._hotkey_callbacks[action] for action, identifier in pending["assigned"].items()}}
        self._hotkey_specs = {**retained_specs, **{identifier: pending["desired"][action] for action, identifier in pending["assigned"].items()}}
        self._pending_hotkeys = None
        self._hotkey_uncertain = not removed
        return removed

    def rollback_hotkeys(self, token: object) -> bool:
        self._hotkey_owner()
        pending = self._pending_hotkeys
        if pending is None or pending["token"] is not token:
            raise PlatformError("hotkey-change-expired")
        complete = True
        for identifier in pending["registered"]:
            if self.user.UnregisterHotKey(self.window, identifier):
                self._reserved_hotkeys.discard(identifier)
            else:
                complete = False
        self._pending_hotkeys = None
        self._hotkey_uncertain = not complete
        return complete

    def _message(self, window: int, message: int, word: int, long: int) -> int:
        if message == 0x0312 and int(word) in self.hotkeys:
            try:
                self.hotkeys[int(word)]()
            except Exception:
                pass
            return 0
        event: str | None = None
        if message == 0x02B1:
            event = {6: "logoff", 7: "lock", 8: "unlock"}.get(int(word))
        elif message == 0x0218:
            event = {4: "sleep", 7: "resume", 18: "resume"}.get(int(word))
        elif message == 0x0011:
            event = "shutdown-requested"
        elif message == 0x0016 and word:
            event = "shutdown"
        if event is not None:
            try:
                self.notify(event)
            except Exception:
                # Never block Windows shutdown or veto logoff if persistence fails.
                pass
        return int(self.user.CallWindowProcW(self.previous, window, message, word, long))

    def close(self) -> None:
        for identifier in set(self.hotkeys) | self._reserved_hotkeys:
            self.user.UnregisterHotKey(self.window, identifier)
        self.wts.WTSUnRegisterSessionNotification(self.window)
        self._set_proc(self.window, -4, self.previous)


class AudioEndpoint(Protocol):
    def get(self) -> float: ...
    def set(self, value: float) -> None: ...


class _PycawEndpoint:
    def _call(self, value: float | None = None) -> float:
        if os.name != "nt":
            raise PlatformError("windows-audio-unavailable")
        try:
            import comtypes
            from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
            comtypes.CoInitialize()
            try:
                device = AudioUtilities.GetSpeakers()
                endpoint = getattr(device, "EndpointVolume", None)
                if endpoint is None:
                    interface = device.Activate(IAudioEndpointVolume._iid_, comtypes.CLSCTX_ALL, None)
                    endpoint = ctypes.cast(interface, ctypes.POINTER(IAudioEndpointVolume))
                if value is not None:
                    endpoint.SetMasterVolumeLevelScalar(value, None)
                return float(endpoint.GetMasterVolumeLevelScalar())
            finally:
                comtypes.CoUninitialize()
        except Exception as error:
            raise PlatformError("windows-audio-unavailable") from error

    def get(self) -> float:
        return self._call()

    def set(self, value: float) -> None:
        self._call(value)


class MasterAudioDucker:
    """Opt-in 9% relative reduction per minute, never below 20% master volume.

    A manual volume change ends ducking for this phase and prevents restoration.
    """
    def __init__(self, endpoint: AudioEndpoint | None = None) -> None:
        self.endpoint = endpoint or _PycawEndpoint()
        self.original: float | None = None
        self.last_set: float | None = None
        self.started_at: float | None = None
        self.manual_override = False

    def tick(self, now: float, enabled: bool) -> None:
        if not enabled:
            self.restore()
            return
        if not math.isfinite(now):
            return
        current = self.endpoint.get()
        if not 0 <= current <= 1:
            raise PlatformError("invalid-audio-level")
        if self.original is None:
            self.original = current
            self.last_set = current
            self.started_at = now
            return
        if self.manual_override:
            return
        if self.last_set is not None and abs(current - self.last_set) > 0.005:
            self.manual_override = True
            return
        elapsed = max(0, int((now - (self.started_at if self.started_at is not None else now)) // 60))
        target = max(min(self.original, 0.2), self.original * 0.91 ** elapsed)
        if self.last_set is not None and target < self.last_set - 0.0001:
            self.endpoint.set(target)
            self.last_set = target

    def restore(self) -> None:
        try:
            if self.original is not None and self.last_set is not None and not self.manual_override:
                if abs(self.endpoint.get() - self.last_set) <= 0.005:
                    self.endpoint.set(self.original)
        finally:
            self.original = None
            self.last_set = None
            self.started_at = None
            self.manual_override = False
