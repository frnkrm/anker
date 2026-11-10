from __future__ import annotations

from queue import SimpleQueue
import unittest

from anker_companion.tray import NIN_BALLOONUSERCLICK, create_tray_icon


class BackendIcon:
    """Native dispatch boundary; initialization binds the actual override."""
    def __init__(self, name, *, menu=None):
        self.name, self.menu = name, menu
        self.handled = []
        self.message_handlers = {"notify": self._on_notify}

    def _on_notify(self, wparam, lparam):
        self.handled.append((wparam, lparam))
        return "normal-tray-event"


class TrayReminderTests(unittest.TestCase):
    def test_balloon_click_queues_window_open_without_running_tk_on_native_thread(self):
        work = SimpleQueue()
        menu = object()
        icon = create_tray_icon(BackendIcon, "Anker", menu=menu,
                                on_open=lambda: work.put(("main", None)))
        self.assertEqual(icon.name, "Anker")
        self.assertIs(icon.menu, menu)
        self.assertTrue(work.empty())
        self.assertIsNone(icon.message_handlers["notify"](7, NIN_BALLOONUSERCLICK))
        self.assertEqual(work.get_nowait(), ("main", None))
        self.assertFalse(icon.handled)

    def test_normal_left_right_default_menu_and_unknown_events_keep_backend_behavior(self):
        calls = []
        icon = create_tray_icon(BackendIcon, "Anker", on_open=lambda: calls.append("open"))
        for event in (0x0202, 0x0205, 0x0402, 0x0403, 0x0404, 0, True, "invalid"):
            with self.subTest(event=event):
                self.assertEqual(icon.message_handlers["notify"](17, event), "normal-tray-event")
        self.assertEqual(len(icon.handled), 8)
        self.assertEqual(calls, [])

    def test_version_four_notification_identifier_does_not_hide_a_click(self):
        calls = []
        icon = create_tray_icon(BackendIcon, "Anker", on_open=lambda: calls.append("open"))
        icon.message_handlers["notify"](0, (42 << 16) | NIN_BALLOONUSERCLICK)
        self.assertEqual(calls, ["open"])
        self.assertEqual(icon.handled, [])


if __name__ == "__main__":
    unittest.main()
