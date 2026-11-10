"""Local desktop metadata and bounded file cleanup, never part of the phone wire."""
from __future__ import annotations

from copy import deepcopy
import os
from pathlib import Path
import re
import stat


class DesktopSettingsError(ValueError):
    pass


DEFAULT_HOTKEYS = {"savepoint": "CTRL+ALT+A", "thought": "CTRL+ALT+G"}


def desktop_defaults(pc_name: str = "Mein PC") -> dict:
    return {"pcName": pc_name, "hotkeys": dict(DEFAULT_HOTKEYS), "theme": "system"}


def parse_hotkey(value: object) -> tuple[str, int, int]:
    if not isinstance(value, str) or len(value) > 40:
        raise DesktopSettingsError("hotkey-invalid")
    parts = [part.strip().upper() for part in value.split("+")]
    if not 2 <= len(parts) <= 4 or len(set(parts)) != len(parts):
        raise DesktopSettingsError("hotkey-invalid")
    modifiers, key = parts[:-1], parts[-1]
    bits = {"CTRL": 2, "ALT": 1, "SHIFT": 4}
    if not all(part in bits for part in modifiers):
        raise DesktopSettingsError("hotkey-invalid")
    if re.fullmatch(r"[A-Z0-9]", key):
        virtual = ord(key)
    elif re.fullmatch(r"F(?:[1-9]|1[0-9]|2[0-4])", key):
        virtual = 0x70 + int(key[1:]) - 1
    else:
        raise DesktopSettingsError("hotkey-invalid")
    canonical = "+".join([part for part in ("CTRL", "ALT", "SHIFT") if part in modifiers] + [key])
    return canonical, sum(bits[part] for part in modifiers) | 0x4000, virtual


def validate_hotkeys(value: object) -> dict[str, str]:
    if not isinstance(value, dict) or set(value) != {"savepoint", "thought"}:
        raise DesktopSettingsError("hotkey-invalid")
    result = {action: parse_hotkey(value[action])[0] for action in ("savepoint", "thought")}
    if result["savepoint"] == result["thought"]:
        raise DesktopSettingsError("hotkey-conflict")
    return result


def desktop_patch(current: dict, patch: object) -> dict:
    if not isinstance(patch, dict) or set(patch) - {"pcName", "hotkeys", "theme"}:
        raise DesktopSettingsError("desktop-settings-invalid")
    result = deepcopy(current)
    if "pcName" in patch:
        name = patch["pcName"]
        if not isinstance(name, str) or not name.strip() or any(ord(char) < 32 for char in name):
            raise DesktopSettingsError("pc-name-invalid")
        try:
            if len(name.strip().encode("utf-16-le")) // 2 > 100:
                raise DesktopSettingsError("pc-name-invalid")
        except UnicodeError:
            raise DesktopSettingsError("pc-name-invalid") from None
        result["pcName"] = name.strip()
    if "hotkeys" in patch:
        result["hotkeys"] = validate_hotkeys(patch["hotkeys"])
    if "theme" in patch:
        if not isinstance(patch["theme"], str) or patch["theme"] not in {"system", "light", "dark"}:
            raise DesktopSettingsError("theme-invalid")
        result["theme"] = patch["theme"]
    return result


def desktop_preferences(state: dict, pc_name: str = "Mein PC") -> dict:
    stored = state.get("desktopPrefs", {})
    if not isinstance(stored, dict):
        raise DesktopSettingsError("desktop-settings-invalid")
    return desktop_patch(desktop_patch(desktop_defaults(), {"pcName": pc_name}), stored)


def _reparse(path: Path) -> bool:
    info = path.lstat()
    return stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & 0x400)


def delete_managed_files(state_path: Path) -> None:
    """Delete only known companion files. Never recurse or follow reparse links."""
    state_path = Path(os.path.abspath(state_path))
    directory = state_path.parent
    initial = directory.lstat()
    directory_identity = (initial.st_dev, initial.st_ino)

    def check_directory() -> None:
        for parent in (directory, *directory.parents):
            if _reparse(parent):
                raise DesktopSettingsError("delete-unsafe-path")
        info = directory.lstat()
        if not stat.S_ISDIR(info.st_mode) or (info.st_dev, info.st_ino) != directory_identity:
            raise DesktopSettingsError("delete-unsafe-path")

    check_directory()
    paths = [state_path, state_path.with_suffix(".next"), directory / "pc-certificate.pem"]
    for entry in directory.iterdir():
        if re.fullmatch(r"\.anker-tls-key-[A-Za-z0-9_-]+\.pem", entry.name):
            paths.append(entry)
    logs = directory / "logs"
    logs_identity = None
    if os.path.lexists(logs):
        if _reparse(logs) or not logs.is_dir():
            raise DesktopSettingsError("delete-unsafe-path")
        info = logs.lstat(); logs_identity = (info.st_dev, info.st_ino)
        for entry in logs.iterdir():
            if re.fullmatch(r"companion\.log(?:\.[0-9]{1,3})?", entry.name):
                paths.append(entry)
    # Validate the complete bounded allowlist before unlinking anything.
    for path in paths:
        if os.path.lexists(path) and (_reparse(path) or not path.is_file()):
            raise DesktopSettingsError("delete-unsafe-path")
    failed = False
    for path in paths:
        try:
            check_directory()
            if path.parent == logs:
                info = logs.lstat()
                if _reparse(logs) or (info.st_dev, info.st_ino) != logs_identity:
                    raise DesktopSettingsError("delete-unsafe-path")
            path.unlink(missing_ok=True)
        except (OSError, DesktopSettingsError):
            failed = True
    if logs_identity is not None:
        try:
            check_directory()
            info = logs.lstat()
            if _reparse(logs) or (info.st_dev, info.st_ino) != logs_identity:
                raise DesktopSettingsError("delete-unsafe-path")
            if not any(logs.iterdir()):
                check_directory()
                logs.rmdir()
        except (OSError, DesktopSettingsError):
            failed = True
    if failed:
        raise DesktopSettingsError("delete-incomplete")
