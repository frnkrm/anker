"""User choices and result boundaries for the optional desktop tools."""
from types import SimpleNamespace
import unittest

from anker_companion.widgets import theme_palette
from tests.test_windows import UiValue, ui_double
from tests.test_pairing_ui import Root


class Hooks:
    def __init__(self): self.calls = []; self.commit_ok = True; self.conflict = False
    def prepare_hotkeys(self, value):
        self.calls.append(('prepare', value))
        if self.conflict: raise RuntimeError('PRIVATE_CONFLICT')
        return 'opaque-test-token'
    def commit_hotkeys(self, value): self.calls.append(('commit', value)); return self.commit_ok
    def rollback_hotkeys(self, value): self.calls.append(('rollback', value)); return True


class DesktopFeaturesTests(unittest.TestCase):
    def ui(self):
        sent = []
        ui, view = ui_double(sent.append)
        ui.root = Root()
        ui._morning_remaining = UiValue('')
        return ui, view, sent

    @staticmethod
    def button(view, text):
        return next(value.options['command'] for value in view.buttons if value.options.get('text') == text)

    def test_optional_signal_and_pill_begin_off_without_changing_existing_consents(self):
        ui, view, sent = self.ui(); ui._settings()
        self.button(view, 'Übernehmen')()
        self.assertIs(sent[0]['prefs']['timePillEnabled'], False)
        self.assertIs(sent[0]['prefs']['quietSignalEnabled'], False)
        self.assertIs(sent[0]['prefs']['enforceEnabled'], False)

    def test_private_if_then_is_on_evening_card_and_never_in_notification(self):
        ui, view, sent = self.ui(); notifications = []
        ui._notify_reminder = notifications.append
        ui.snapshot = {'state': 'WIND_DOWN_T30', 'cardId': 'evening-one', 'ifThen': 'PRIVATE_WHEN_THEN', 'prefs': {}}
        ui._render()
        self.assertTrue(any(value.options.get('text') == 'PRIVATE_WHEN_THEN' for value in view.widgets))
        self.assertEqual(len(notifications), 1)
        self.assertNotIn('PRIVATE', notifications[0])
        self.assertEqual(sent, [])

    def test_morning_card_uses_explicit_target_and_updates_without_reopening(self):
        ui, view, sent = self.ui()
        ui.snapshot = {'state': 'DAY_ACTIVE', 'cardKind': 'morning', 'cardId': 'morning:day:leave:target',
                       'morning': {'title': 'Losgehen', 'kind': 'leave', 'targetAt': '2026-11-10T06:30:00Z', 'remainingSeconds': 600}, 'prefs': {}}
        ui._render(); card = ui._card
        self.assertTrue(any(value.options.get('text') == 'Geplant um 07:30' for value in view.widgets))
        self.assertEqual(ui._morning_remaining.get(), 'Noch 10:00')
        self.assertIn('Losgehen um 07:30', ui.remaining.get())
        ui.snapshot['morning']['remainingSeconds'] = 300; ui._render()
        self.assertIs(ui._card, card)
        self.assertEqual(ui._morning_remaining.get(), 'Noch 05:00')
        ui._close_card(); ui._render()
        self.assertIsNone(ui._card)
        self.assertEqual(sent, [])

    def test_time_pill_requires_optin_bounded_hour_and_known_target(self):
        ui, _view, sent = self.ui()
        value = {'targetAt': '2026-11-10T22:00:00Z', 'remainingSeconds': 3540}
        ui._render_time_pill(value); self.assertIsNone(ui._time_pill)
        ui.snapshot = {'localPrefs': {'timePillEnabled': True}}
        ui._render_time_pill(value)
        self.assertIn('59 Min', ui._time_pill_text.get())
        self.assertIn('23:00', ui._time_pill_text.get())
        for bad in [{**value, 'remainingSeconds': 3601}, {**value, 'remainingSeconds': float('nan')}, {**value, 'targetAt': 'PRIVATE_BAD_TIME'}]:
            ui._render_time_pill(bad); self.assertIsNone(ui._time_pill)
        self.assertEqual(sent, [])

    def test_signal_only_after_visible_new_card_and_never_from_timer_tick_or_test(self):
        ui, _view, _sent = self.ui(); calls = []
        ui.platform = SimpleNamespace(quiet_reminder_sound=lambda: calls.append('sound') or {'status': 'requested'})
        ui.snapshot = {'state': 'WIND_DOWN_T30', 'cardId': 'one', 'prefs': {}, 'localPrefs': {'quietSignalEnabled': True}}
        ui._render(); ui._render()
        self.assertEqual(calls, ['sound'])
        ui.snapshot.update(cardId='test', testMode=True); ui._render()
        self.assertEqual(calls, ['sound'])
        ui.snapshot.update(cardId='two', testMode=False, localPrefs={}); ui._render()
        self.assertEqual(calls, ['sound'])

    def test_sound_suppression_and_failure_are_visible_without_remote_exception(self):
        ui, _view, _sent = self.ui()
        ui.platform = SimpleNamespace(quiet_reminder_sound=lambda: {'status': 'suppressed'})
        ui._quiet_signal(); self.assertIn('Windows hält', ui._feedback_text)
        ui.platform = SimpleNamespace(quiet_reminder_sound=lambda: (_ for _ in ()).throw(RuntimeError('PRIVATE_ERROR')))
        ui._quiet_signal(); self.assertIn('nicht verfügbar', ui._feedback_text)
        self.assertNotIn('PRIVATE', ui._feedback_text)

    def test_theme_choices_follow_system_and_never_share_mutable_palette(self):
        self.assertEqual(theme_palette('system', False), theme_palette('light'))
        self.assertEqual(theme_palette('system', True), theme_palette('dark'))
        first = theme_palette('dark'); first['bg'] = 'changed'
        self.assertNotEqual(first, theme_palette('dark'))
        ui, _view, _sent = self.ui(); ui.snapshot = {'desktopPrefs': {'theme': 'light'}}
        ui._apply_theme(); self.assertEqual(ui.BG, '#f3f6f8')
        ui.snapshot['desktopPrefs']['theme'] = 'dark'; ui._apply_theme(); self.assertEqual(ui.BG, '#101114')

    def test_free_time_previews_then_confirms_exact_server_target(self):
        ui, view, sent = self.ui(); ui._extend_form()
        view.entries[0].set('23:30'); self.button(view, 'Vorschau ansehen')()
        self.assertEqual([value['action'] for value in sent], ['preview-extend-until'])
        ui._resolve_action_result({'action': 'preview-extend-until', 'requestId': sent[0]['requestId'], 'ok': True,
                                   'preview': {'pcStopAt': '2026-11-10T22:30:00Z', 'bedAt': None, 'wakeAt': None}})
        self.assertEqual(sent[-1]['action'], 'extend-until')
        self.assertEqual(sent[-1]['expectedTargetAt'], '2026-11-10T22:30:00Z')
        self.assertEqual(sent[-1]['localTime'], '23:30')
        ui._resolve_action_result({'action': 'extend-until', 'requestId': sent[-1]['requestId'], 'ok': False})
        self.assertEqual(view.entries[0].get(), '23:30')
        self.assertFalse(view.windows[0].destroyed)

    def test_free_time_cancel_and_strict_mode_never_issue_extension(self):
        for strict in [False, True]:
            ui, view, sent = self.ui(); ui._extend_form()
            view.entries[0].set('23:30'); self.button(view, 'Vorschau ansehen')()
            ui.messagebox.askokcancel = lambda *_args, **_kwargs: False
            ui.snapshot = {'prefs': {'strictLock': strict}}
            ui._resolve_action_result({'action': 'preview-extend-until', 'requestId': sent[0]['requestId'], 'ok': True,
                                       'preview': {'pcStopAt': '2026-11-10T22:30:00Z'}})
            self.assertEqual([value['action'] for value in sent], ['preview-extend-until'])
        ui, _view, sent = self.ui(); ui.snapshot = {'prefs': {'strictLock': True}}
        ui._note = lambda *_args: None
        ui._extend_form(); self.assertEqual(sent, [])

    def test_hotkey_reservation_precedes_persist_and_commits_only_after_matching_result(self):
        ui, view, sent = self.ui(); hooks = Hooks(); ui.platform = hooks
        ui._desktop_settings(); view.strings[2].set('CTRL+SHIFT+F8')
        self.button(view, 'PC-Einstellungen speichern')()
        self.assertEqual([value[0] for value in hooks.calls], ['prepare'])
        self.assertEqual(sent[0]['action'], 'desktop-settings')
        ui._resolve_action_result({'action': 'desktop-settings', 'requestId': 'stale', 'ok': True})
        self.assertEqual([value[0] for value in hooks.calls], ['prepare'])
        ui._resolve_action_result({'action': 'desktop-settings', 'requestId': sent[0]['requestId'], 'ok': True})
        self.assertEqual([value[0] for value in hooks.calls], ['prepare', 'commit'])
        self.assertTrue(view.windows[0].destroyed)

    def test_hotkey_conflict_or_failed_persist_preserves_fields_and_rolls_back(self):
        for conflict in [True, False]:
            ui, view, sent = self.ui(); hooks = Hooks(); hooks.conflict = conflict; ui.platform = hooks
            ui._desktop_settings(); view.strings[2].set('CTRL+SHIFT+F8')
            self.button(view, 'PC-Einstellungen speichern')()
            if conflict:
                self.assertEqual(sent, [])
            else:
                ui._resolve_action_result({'action': 'desktop-settings', 'requestId': sent[0]['requestId'], 'ok': False})
                self.assertEqual(hooks.calls[-1][0], 'rollback')
            self.assertFalse(view.windows[0].destroyed)
            self.assertEqual(view.strings[2].get(), 'CTRL+SHIFT+F8')
            self.assertNotIn('PRIVATE', str([value.options for value in view.widgets]))

    def test_stored_but_unregistered_hotkeys_are_not_claimed_active(self):
        ui, view, sent = self.ui(); hooks = Hooks(); hooks.commit_ok = False; ui.platform = hooks
        ui._desktop_settings(); view.strings[2].set('CTRL+SHIFT+F8')
        self.button(view, 'PC-Einstellungen speichern')()
        ui._resolve_action_result({'action': 'desktop-settings', 'requestId': sent[0]['requestId'], 'ok': True})
        self.assertFalse(view.windows[0].destroyed)
        self.assertTrue(any('noch nicht aktiv' in value.options.get('text', '') for value in view.widgets))
        self.assertEqual(hooks.calls[-1][0], 'rollback')

    def test_delete_requires_user_confirmation_and_failed_result_never_quits(self):
        ui, view, sent = self.ui(); ui._desktop_settings()
        button = self.button(view, 'Alle Anker-Daten auf diesem PC löschen')
        ui.messagebox.askokcancel = lambda *_args, **_kwargs: False
        button(); self.assertEqual(sent, [])
        ui.messagebox.askokcancel = lambda *_args, **_kwargs: True
        button(); self.assertTrue(sent[0]['userConfirmed'])
        ui._resolve_action_result({'action': 'delete-data', 'requestId': sent[0]['requestId'], 'ok': False})
        self.assertEqual([value['action'] for value in sent], ['delete-data'])
        self.assertFalse(view.windows[0].destroyed)


if __name__ == '__main__': unittest.main(verbosity=2)
