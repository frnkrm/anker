"""Exercise the production pairing button, server and UI queue without OS effects."""
from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from cryptography.hazmat.primitives.asymmetric import ec

from anker_companion.engine import CompanionEngine
from anker_companion.protocol import ProtocolError, b64, pair_proof, public_bytes
from anker_companion.server import BridgeServer, PairingManager
from anker_companion.storage import AtomicStateStore
from tests.helpers import Clock, FakePlatform, TestVault
from tests.test_windows import UiValue, UiWidget, ui_double


class Window(UiWidget):
    def lift(self): pass


class Root(Window):
    def __init__(self):
        super().__init__()
        self.timers = {}
        self.serial = 0
        self.mainloop_callback = lambda: None

    def after(self, milliseconds, callback):
        self.serial += 1
        identifier = str(self.serial)
        self.timers[identifier] = (milliseconds, callback)
        return identifier

    def after_cancel(self, identifier):
        self.timers.pop(identifier, None)

    def winfo_screenheight(self): return 1080
    def mainloop(self): self.mainloop_callback()


class PairingUiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.clock = Clock()
        self.store = AtomicStateStore(Path(self.temp.name) / 'state', TestVault())
        self.platform = FakePlatform()
        self.ui, self.view = ui_double(lambda _action: None)
        self.ui.clock = self.clock
        self.ui.root = Root()
        self.root = self.ui.root
        self.image_inputs = []
        def photo(image, **_options):
            self.image_inputs.append(image.copy())
            return object()
        self.photo = self.enterContext(patch('PIL.ImageTk.PhotoImage', side_effect=photo))
        def window(_parent=None, **options):
            result = Window(**options)
            self.view.windows.append(result)
            return result
        self.window = window
        self.ui.tk.Toplevel = window
        self.engine = CompanionEngine(self.store, self.platform, self.clock, ui=self.ui)
        self.pairing = PairingManager(self.store, 'Synthetic PC', 'a' * 64, ['192.168.1.2:47830'], self.clock)
        self.bridge = BridgeServer(self.store, self.engine, self.pairing, ui=self.ui, clock=self.clock)
        self.ui.on_action = self.bridge.ui_action

    def open(self):
        self.ui._emit({'action': 'pair'})
        self.ui._drain()
        self.assertIsNotNone(self.ui._offer_window)
        self.assertFalse(self.ui._offer_window.destroyed)
        return self.ui._offer_identifier

    def phone_request(self, identifier):
        draft = self.pairing.drafts[identifier]
        phone = ec.generate_private_key(ec.SECP256R1())
        signing = ec.generate_private_key(ec.SECP256R1())
        key = b64(public_bytes(phone.public_key()))
        signing_key = b64(public_bytes(signing.public_key()))
        request = {'id': identifier, 'n': 'Synthetic phone', 'k': key, 'signingKey': signing_key,
                   'proof': pair_proof(draft['secret'], identifier, key, signing_key)}
        answer = self.pairing.request(request)
        self.ui.ask_pair({**answer, 'n': request['n']})
        self.ui._drain()
        return request

    def button(self, label):
        return next(widget.options['command'] for widget in reversed(self.view.buttons)
                    if widget.options.get('text') == label)

    def test_actual_main_button_callback_reaches_server_and_persistent_offer(self):
        def mainloop():
            self.button('Mit Handy koppeln')()
            self.ui._drain()
            self.assertIsNotNone(self.ui._offer_window)
            window = self.ui._offer_window
            for _ in range(3):
                self.clock.now += 1
                self.engine.tick()
                self.ui._drain()
                self.assertIs(self.ui._offer_window, window)
                self.assertFalse(window.destroyed)
        self.root.mainloop_callback = mainloop
        with patch('tkinter.Tk', return_value=self.root), patch('tkinter.StringVar', side_effect=UiValue), \
             patch('tkinter.Toplevel', side_effect=self.window), patch.object(self.ui, '_start_tray'):
            self.ui.run()
        self.assertIsNone(self.ui._offer_window)  # run() cleanup owns shutdown.
        self.assertEqual(self.platform.effects, [])

    def test_status_actionresult_and_rapid_engine_ticks_never_contain_or_close_qr(self):
        identifier = self.open()
        window = self.ui._offer_window
        for _ in range(20):
            self.engine._message('Synthetic status')
            self.engine.tick()
        self.ui._drain()
        self.assertIs(self.ui._offer_window, window)
        self.assertFalse(window.destroyed)
        self.assertNotIn('pairingQr', self.engine.last_view)
        self.assertNotIn('anker-pc-pair', json.dumps(self.ui.snapshot))
        self.assertNotIn('anker-pc-pair', json.dumps(self.engine.last_view))
        self.assertNotIn(self.pairing.drafts[identifier]['secret'].hex(), self.ui.status.get())

    def test_close_reopen_replaces_secret_and_old_offer_cannot_be_used(self):
        old = self.open()
        previous_secret = self.pairing.drafts[old]['secret']
        old_request = self.phone_request(old)
        self.button('Abbrechen')()
        self.ui._drain()
        self.assertIsNone(self.ui._offer_window)
        self.assertEqual(self.pairing.status(old)['status'], 'rejected')
        new = self.open()
        self.assertNotEqual(new, old)
        self.assertNotEqual(self.pairing.drafts[new]['secret'], previous_secret)
        with self.assertRaises(ProtocolError):
            self.pairing.request(old_request)
        self.assertEqual(self.store.read()['pairs'], {})

    def test_qr_close_button_invalidates_offer_and_does_not_close_next_offer(self):
        old = self.open()
        close = self.button('Schließen')
        close()
        self.ui._drain()
        self.assertIsNone(self.ui._offer_window)
        self.assertEqual(self.pairing.status(old)['status'], 'rejected')
        new = self.open()
        window = self.ui._offer_window
        close()
        self.ui.close_pairing_offer(old)
        self.ui._check_offer_expiry(old)
        self.ui._drain()
        self.assertEqual(self.ui._offer_identifier, new)
        self.assertIs(self.ui._offer_window, window)

    def test_new_offer_replaces_pending_dialog_and_stale_confirmation_is_ignored(self):
        old = self.open()
        old_request = self.phone_request(old)
        dialog = self.ui._pair_window
        approve = self.button('Ja, koppeln')
        new = self.open()
        self.assertTrue(dialog.destroyed)
        approve()
        self.ui._drain()
        self.assertEqual(self.ui._offer_identifier, new)
        self.assertEqual(self.store.read()['pairs'], {})
        with self.assertRaises(ProtocolError):
            self.pairing.request(old_request)

    def test_confirmation_or_rejection_closes_only_its_matching_offer(self):
        for approved in [False, True]:
            with self.subTest(approved=approved):
                identifier = self.open()
                self.phone_request(identifier)
                self.assertIsNone(self.ui._offer_window)
                self.assertIsNotNone(self.ui._pair_window)
                self.button('Ja, koppeln' if approved else 'Abbrechen')()
                self.ui._drain()
                self.assertIsNone(self.ui._pair_window)
                self.assertEqual(bool(self.store.read()['pairs']), approved)
                if approved:
                    self.bridge.unpair()

    def test_expiry_closes_qr_and_pending_dialog_and_never_approves_late_click(self):
        for pending in [False, True]:
            with self.subTest(pending=pending):
                identifier = self.open()
                approve = None
                if pending:
                    self.phone_request(identifier)
                    approve = self.button('Ja, koppeln')
                self.clock.now += 601
                self.ui._check_offer_expiry(identifier)
                if approve:
                    approve()
                self.ui._drain()
                self.assertIsNone(self.ui._offer_window)
                self.assertIsNone(self.ui._pair_window)
                self.assertEqual(self.store.read()['pairs'], {})
                self.assertEqual(self.pairing.status(identifier)['status'], 'expired')

    def test_render_failure_does_not_stop_following_events_or_next_drain(self):
        self.ui.queue.put(('render', None))
        self.ui.render({'message': 'Following status'})
        self.ui._drain()
        self.assertEqual(self.ui.snapshot['message'], 'Following status')
        self.assertIn('Die Anzeige konnte', self.ui.status.get())
        self.assertTrue(any(delay == 100 for delay, _ in self.root.timers.values()))
        self.open()

    def test_qr_image_failure_is_visible_redacted_and_recoverable(self):
        self.photo.side_effect = RuntimeError('synthetic-secret-must-not-appear')
        self.ui._emit({'action': 'pair'})
        self.ui._drain()
        self.assertIsNone(self.ui._offer_window)
        self.assertNotIn('synthetic-secret', self.ui.status.get())
        self.assertIn('Die Anzeige konnte', self.ui.status.get())
        self.engine.tick()
        self.ui._drain()
        self.assertIn('Die Anzeige konnte', self.ui.status.get())
        self.assertTrue(any(delay == 100 for delay, _ in self.root.timers.values()))
        self.photo.side_effect = lambda image, **_options: object()
        self.open()

    def test_malformed_offer_event_does_not_close_current_offer_or_stop_updates(self):
        identifier = self.open()
        window = self.ui._offer_window
        self.ui.queue.put(('pairing-offer', ('invalid', float('nan'), 'unrelated-id')))
        self.ui.queue.put(('pair', None))
        self.ui.render({'message': 'Update after invalid event'})
        self.ui._drain()
        self.assertIs(self.ui._offer_window, window)
        self.assertEqual(self.ui._offer_identifier, identifier)
        self.assertEqual(self.ui.snapshot['message'], 'Update after invalid event')
        self.assertTrue(any(delay == 100 for delay, _ in self.root.timers.values()))

    def test_qr_pixels_have_four_module_quiet_zone_and_no_interpolation(self):
        self.open()
        image = self.image_inputs[-1].convert('RGB')
        self.assertEqual({color for _, color in image.getcolors()}, {(0, 0, 0), (255, 255, 255)})
        # Find the first dark finder pixel: exactly four full white modules precede it.
        first_dark = next(x for x in range(image.width) if image.getpixel((x, x)) == (0, 0, 0))
        self.assertEqual(first_dark % 4, 0)
        scale = first_dark // 4
        self.assertGreaterEqual(scale, 1)
        self.assertEqual(image.width % scale, 0)
        for y in range(image.height):
            self.assertTrue(all(image.getpixel((x, y)) == (255, 255, 255) for x in range(first_dark)))
        for y in range(0, image.height, scale):
            for x in range(0, image.width, scale):
                values = {image.getpixel((x + dx, y + dy)) for dx in range(scale) for dy in range(scale)}
                self.assertEqual(len(values), 1)

    def test_shutdown_releases_images_windows_and_pending_offer_timer(self):
        self.open()
        window = self.ui._offer_window
        timer = self.ui._offer_timer
        self.ui.close()
        self.ui._drain()
        self.assertTrue(window.destroyed)
        self.assertTrue(self.root.destroyed)
        self.assertIsNone(self.ui._qr_image)
        self.assertNotIn(timer, self.root.timers)


if __name__ == '__main__':
    unittest.main(verbosity=2)
