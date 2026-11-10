"""Clickable Windows reminders on the existing pystray backend; no import effects."""
from __future__ import annotations

from typing import Callable


# Shell_NotifyIcon reports balloon clicks through the icon's existing callback.
# pystray 0.19.5 handles left/right clicks there, but not this notification code.
NIN_BALLOONUSERCLICK = 0x0405


def create_tray_icon(icon_type: type, *args, on_open: Callable[[], None], **kwargs):
    """Keep native tray behavior and add a queue-only reminder-click callback.

    The caller supplies its already selected backend. This module neither
    imports pystray nor creates a native window when imported by Linux tests.
    ``on_open`` must enqueue work for Tk, since native callbacks use another
    thread. No notification is sent until the caller explicitly calls notify.
    """
    class ReminderIcon(icon_type):
        def _on_notify(self, wparam, lparam):
            # LOWORD also supports notification messages using NOTIFYICON_VERSION_4.
            if type(lparam) is int and (lparam & 0xFFFF) == NIN_BALLOONUSERCLICK:
                on_open()
                return None
            return super()._on_notify(wparam, lparam)

    return ReminderIcon(*args, **kwargs)
