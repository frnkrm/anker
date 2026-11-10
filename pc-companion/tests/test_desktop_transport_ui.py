"""Explicit relay/update choices never become implicit downloads or secret output."""
import json
import unittest

from tests.test_windows import ui_double
from tests.test_pairing_ui import Root

SECRET = 'anker-pc-relay:v1:SYNTHETIC_PRIVATE_SETUP_CODE'


class DesktopTransportUiTests(unittest.TestCase):
    def ui(self):
        sent = []
        ui, view = ui_double(sent.append)
        ui.root = Root()
        return ui, view, sent

    @staticmethod
    def button(view, title):
        return next(widget.options['command'] for widget in view.buttons if widget.options.get('text') == title)

    def answer(self, ui, request, **data):
        ui._resolve_action_result({'action': request['action'], 'requestId': request['requestId'], **data})

    def test_relay_code_is_masked_cleared_and_never_put_in_public_state(self):
        ui, view, sent = self.ui(); ui._relay_settings()
        self.assertEqual(view.entries[0].options['show'], '•')
        view.entries[0].set(SECRET)
        self.button(view, 'Relay einrichten')()
        self.assertEqual(sent[0]['action'], 'relay_configure')
        self.assertEqual(sent[0]['setupCode'], SECRET)
        self.assertEqual(view.entries[0].get(), '')
        self.assertNotIn(SECRET, json.dumps(ui.snapshot))
        self.assertNotIn(SECRET, str([widget.options for widget in view.widgets]))
        self.answer(ui, sent[0], ok=False, rawError=SECRET)
        self.assertNotIn(SECRET, ui._feedback_text)
        self.assertNotIn(SECRET, str([widget.options for widget in view.widgets]))

    def test_relay_delivery_failure_still_clears_input_without_exception_text(self):
        ui, view, _sent = self.ui()
        ui.on_action = lambda _action: (_ for _ in ()).throw(RuntimeError(SECRET))
        ui._relay_settings(); view.entries[0].set(SECRET)
        self.button(view, 'Relay einrichten')()
        self.assertEqual(view.entries[0].get(), '')
        self.assertEqual(ui._pending_actions, {})
        self.assertNotIn(SECRET, ui.status.get())

    def test_relay_status_is_transport_receipt_and_hides_project_or_token(self):
        ui, _view, _sent = self.ui()
        text = ui._relay_status_text({'status': 'received', 'project': SECRET, 'deviceToken': SECRET,
                                     'lastExchangeAt': '2026-11-10T22:00:00Z'})
        self.assertIn('Transportkontakt', text)
        self.assertIn('23:00', text)
        self.assertNotIn('Plan', text)
        self.assertNotIn(SECRET, text)

    def test_relay_clear_is_explicit_and_stale_reply_does_not_reopen_dialog(self):
        ui, view, sent = self.ui(); ui._relay_settings()
        ui.messagebox.askokcancel = lambda *_args, **_kwargs: False
        self.button(view, 'Relay-Einrichtung entfernen')()
        self.assertEqual(sent, [])
        self.button(view, 'Relay deaktivieren')()
        self.assertEqual(sent[0]['action'], 'relay_disable')
        view.windows[0].events['WM_DELETE_WINDOW']()
        self.answer(ui, sent[0], ok=True)
        self.assertIsNone(ui._relay_window)
        self.assertIsNone(ui._relay_status_variable)

    def test_update_check_does_not_download_and_unstaged_install_does_nothing(self):
        ui, view, sent = self.ui(); ui._update_settings()
        self.assertEqual(sent, [])
        self.button(view, 'Update herunterladen')()
        self.button(view, 'Heruntergeladenes Update installieren')()
        self.assertEqual(sent, [])
        self.button(view, 'Jetzt auf PC-Updates prüfen')()
        self.answer(ui, sent[0], ok=True, update={'status': 'available', 'version': '0.2.0'})
        self.assertEqual([value['action'] for value in sent], ['update-check'])
        self.assertEqual(next(value for value in view.buttons if value.options['text'] == 'Update herunterladen').options['state'], 'normal')

    def test_update_install_needs_confirmed_stage_user_choice_and_handoff(self):
        ui, view, sent = self.ui(); ui._update_settings()
        self.button(view, 'Jetzt auf PC-Updates prüfen')()
        self.answer(ui, sent[-1], ok=True, update={'status': 'available', 'version': '0.2.0'})
        self.button(view, 'Update herunterladen')()
        self.answer(ui, sent[-1], ok=True, update={'status': 'staged', 'stageId': 'trusted-stage-id', 'version': '0.2.0'})
        ui._update_view_handler({'status': 'handoff-ready', 'stageId': 'trusted-stage-id'})
        self.assertNotIn('quit', [value['action'] for value in sent])
        ui.messagebox.askokcancel = lambda *_args, **_kwargs: False
        self.button(view, 'Heruntergeladenes Update installieren')()
        self.assertEqual(len(sent), 2)
        ui.messagebox.askokcancel = lambda *_args, **_kwargs: True
        self.button(view, 'Heruntergeladenes Update installieren')()
        self.assertTrue(sent[-1]['userConfirmed'])
        self.assertEqual(sent[-1]['stageId'], 'trusted-stage-id')
        self.answer(ui, sent[-1], ok=False, update={'status': 'unavailable', 'reason': SECRET})
        self.assertNotIn('quit', [value['action'] for value in sent])
        self.assertNotIn(SECRET, str([value.options for value in view.widgets]))
        self.button(view, 'Heruntergeladenes Update installieren')()
        messages = []
        ui.messagebox.showinfo = lambda _title, text, **_kwargs: messages.append(text)
        self.answer(ui, sent[-1], ok=True, update={'status': 'handoff-ready'})
        self.assertEqual(sent[-1]['action'], 'quit')
        self.assertIn('noch nicht als abgeschlossen bestätigt', messages[0])

    def test_unrelated_update_reply_never_enables_download_and_version_is_sanitized(self):
        ui, view, sent = self.ui(); ui._update_settings()
        self.button(view, 'Jetzt auf PC-Updates prüfen')()
        self.answer(ui, {**sent[0], 'requestId': 'stale'}, ok=True, update={'status': 'available', 'version': '0.2.0'})
        self.assertEqual(next(value for value in view.buttons if value.options['text'] == 'Update herunterladen').options['state'], 'disabled')
        self.answer(ui, sent[0], ok=True, update={'status': 'available', 'version': SECRET})
        self.assertNotIn(SECRET, str([value.options for value in view.widgets]))

    def test_automatic_update_checks_default_off_in_existing_settings(self):
        ui, view, sent = self.ui(); ui._settings(); self.button(view, 'Übernehmen')()
        self.assertIs(sent[0]['prefs']['autoUpdateChecks'], False)


if __name__ == '__main__': unittest.main(verbosity=2)
