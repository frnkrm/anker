"""Monitor, action feedback and tray reachability without Windows effects."""
from types import SimpleNamespace
import unittest

from anker_companion.ui import DesktopUI
from anker_companion.widgets import window_geometry
from tests.test_pairing_ui import Root
from tests.test_windows import UiValue, UiWidget


class StateWindow(Root):
    def __init__(self):
        super().__init__()
        self.current_state = 'normal'
        self.states = []
        self.lifts = 0

    def state(self): return self.current_state
    def withdraw(self): self.current_state = 'withdrawn'; self.states.append('withdrawn')
    def iconify(self): self.current_state = 'iconic'; self.states.append('iconic')
    def deiconify(self): self.current_state = 'normal'; self.states.append('normal')
    def lift(self): self.lifts += 1
    def focus_force(self): pass
    def winfo_x(self): return 40
    def winfo_y(self): return 50


class DesktopUxTests(unittest.TestCase):
    def ui(self):
        sent = []
        ui = DesktopUI(sent.append)
        ui.root = StateWindow()
        ui.status = UiValue('Current plan')
        ui.remaining = UiValue('')
        ui._feedback_variable = UiValue('')
        ui._action_buttons['sync'] = UiWidget(state='normal')
        return ui, sent

    def test_default_small_and_negative_monitor_fit_leave_titlebar_room(self):
        for area in [(0, 0, 1920, 1040), (0, 0, 800, 560), (-1920, -150, 0, 930),
                     (0, 0, 320, 240), (3840, 0, 7680, 2160)]:
            for scale in [0.75, 1, 1.25, 2, 4, float('nan'), float('inf')]:
                width, height, x, y, minimum_width, minimum_height = window_geometry(area, scale, (9000, 9000))
                self.assertGreater(width, 0)
                self.assertGreater(height, 0)
                self.assertLessEqual(area[0], x)
                self.assertLessEqual(area[1], y)
                self.assertLessEqual(x + width, area[2])
                self.assertLess(y + height, area[3])
                self.assertLessEqual(minimum_width, width)
                self.assertLessEqual(minimum_height, height)
        self.assertEqual(window_geometry((0, 0, 1920, 1040))[:2], (520, 720))

    def test_invalid_monitor_coordinates_are_rejected(self):
        for area in [(0, 0, 0, 100), (0, 100, 300, 100), (0, 0, 300), (False, 0, 300, 200)]:
            with self.subTest(area=area), self.assertRaises(ValueError):
                window_geometry(area)

    def test_sync_pending_is_not_success_and_duplicate_click_does_not_send_twice(self):
        ui, sent = self.ui()
        ui._dispatch_action({'action': 'sync'})
        ui._dispatch_action({'action': 'sync'})
        self.assertEqual(len(sent), 1)
        self.assertIn('warte auf das Handy', ui._feedback_text)
        self.assertEqual(ui._action_buttons['sync'].options['state'], 'disabled')
        self.assertNotIn('neu empfangen', ui._feedback_text)

    def test_only_matching_received_result_finishes_pending_sync(self):
        ui, sent = self.ui(); ui._dispatch_action({'action': 'sync'})
        request = sent[0]['requestId']
        ui._resolve_action_result({'action': 'sync', 'requestId': 'wrong-id', 'ok': True, 'status': 'received'})
        self.assertIn('warte', ui._feedback_text)
        self.assertEqual(ui._last_sync_result, {})
        ui._resolve_action_result({'action': 'sync', 'requestId': request, 'ok': True, 'status': 'received'})
        self.assertEqual(ui._feedback_text, 'Handystand neu empfangen.')
        self.assertEqual(ui._action_buttons['sync'].options['state'], 'normal')

    def test_sync_failure_reason_is_readable_and_never_echoes_remote_text(self):
        for status, expected in [('offline', 'WLAN-Verbindung'), ('pending-events', 'PC-Rückmeldungen'),
                                 ('unpaired', 'Kopple zuerst'), ('timeout', 'Noch keinen neuen'), ('busy', 'läuft bereits')]:
            ui, sent = self.ui(); ui._dispatch_action({'action': 'sync'})
            ui._resolve_action_result({'action': 'sync', 'requestId': sent[0]['requestId'], 'ok': False,
                                       'status': status, 'message': 'PRIVATE_REMOTE_TEXT'})
            self.assertIn(expected, ui._feedback_text)
            self.assertNotIn('PRIVATE', ui._feedback_text)

    def test_only_typed_received_state_can_claim_sync_success(self):
        for status in [None, {}, 'offline', 'PRIVATE_REMOTE_STATUS']:
            ui, sent = self.ui(); ui._dispatch_action({'action': 'sync'})
            ui._resolve_action_result({'action': 'sync', 'requestId': sent[0]['requestId'], 'ok': True, 'status': status})
            self.assertNotIn('neu empfangen', ui._feedback_text)
            self.assertNotIn('PRIVATE', ui._feedback_text)

    def test_sync_feedback_names_source_time_without_claiming_new_calculation(self):
        ui, sent = self.ui(); ui._dispatch_action({'action': 'sync'})
        ui._resolve_action_result({'action': 'sync', 'requestId': sent[0]['requestId'], 'ok': True,
                                   'status': 'received', 'sourceGeneratedAt': '2026-11-10T20:45:00Z'})
        self.assertEqual(ui._feedback_text, 'Handystand empfangen · Stand 10.11. 21:45')
        self.assertNotIn('berechnet', ui._feedback_text)

    def test_timeout_and_late_result_never_promote_a_new_request_to_success(self):
        ui, sent = self.ui(); ui._dispatch_action({'action': 'sync'})
        first = sent[0]['requestId']
        timeout = next(callback for delay, callback in ui.root.timers.values() if delay == 30000)
        timeout()
        self.assertIn('Noch keinen neuen', ui._feedback_text)
        ui._dispatch_action({'action': 'sync'})
        ui._resolve_action_result({'action': 'sync', 'requestId': first, 'ok': True, 'status': 'received'})
        self.assertIn('warte', ui._feedback_text)
        self.assertEqual(len(sent), 2)
        self.assertEqual(ui._last_sync_result, {})

    def test_close_with_ready_tray_hides_without_any_quit_action(self):
        ui, sent = self.ui()
        ui._tray = SimpleNamespace(visible=True, _running=True)
        ui._tray_ready = True
        ui._hide_or_close()
        self.assertEqual(ui.root.current_state, 'withdrawn')
        self.assertEqual(sent, [])

    def test_close_without_ready_tray_keeps_taskbar_window_instead_of_quitting(self):
        for icon in [None, SimpleNamespace(visible=False, _running=True), SimpleNamespace(visible=True, _running=False)]:
            ui, sent = self.ui(); ui._tray = icon; ui._tray_ready = icon is not None
            ui._hide_or_close()
            self.assertEqual(ui.root.current_state, 'iconic')
            self.assertEqual(sent, [])

    def test_minimize_uses_tray_only_after_readiness_and_reopen_is_reachable(self):
        ui, _sent = self.ui()
        ui._tray = SimpleNamespace(visible=True, _running=True)
        ui.root.iconify(); ui._minimized_to_tray()
        self.assertEqual(ui.root.current_state, 'iconic')
        ui._tray_ready = True; ui._minimized_to_tray()
        self.assertEqual(ui.root.current_state, 'withdrawn')
        ui._show_main()
        self.assertEqual(ui.root.current_state, 'normal')
        self.assertEqual(ui.root.lifts, 1)

    def test_tray_failure_restores_taskbar_path_and_does_not_stop_daemon(self):
        ui, sent = self.ui(); ui.root.withdraw(); ui._tray_ready = True
        ui._tray_failed()
        self.assertEqual(ui.root.states[-2:], ['normal', 'iconic'])
        self.assertFalse(ui._tray_ready)
        self.assertEqual(sent, [])

    def test_notification_failure_restores_reachable_window_without_private_text(self):
        ui, _sent = self.ui(); ui.root.withdraw()
        class BrokenIcon:
            visible = True
            _running = True
            def notify(self, *_args): raise RuntimeError('PRIVATE_ERROR')
        ui._tray = BrokenIcon(); ui._tray_ready = True
        ui._notify_reminder('Neutral PC-Stopp reminder')
        self.assertEqual(ui.root.current_state, 'iconic')
        self.assertNotIn('PRIVATE', ui._feedback_text)

    def test_pending_feedback_survives_background_status_renders(self):
        ui, _sent = self.ui(); ui._dispatch_action({'action': 'sync'})
        ui._progress_bar = lambda _value: None
        ui._hide_overlays = lambda: None
        ui.snapshot = {'message': 'Unrelated periodic state'}
        ui._render()
        self.assertEqual(ui.status.get(), 'Unrelated periodic state')
        self.assertIn('warte auf das Handy', ui._feedback_text)


if __name__ == '__main__': unittest.main(verbosity=2)
