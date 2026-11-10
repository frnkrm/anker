"""Explicit real-Tk optional-feature check; synthetic data and no Windows effects."""
from pathlib import Path
from types import SimpleNamespace
import argparse
import hashlib
import json
import os
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import tkinter as tk
from PIL import ImageGrab
from anker_companion.ui import DesktopUI


def check(output: Path) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    sent, errors, callback_errors, confirmations = [], [], [], []
    result = {}
    ui = DesktopUI(sent.append)

    def later(ms, callback):
        def guarded():
            try: callback()
            except Exception as error:
                errors.append({'phase': callback.__name__, 'type': type(error).__name__})
                ui.root.destroy()
        ui.root.after(ms, guarded)

    def widgets(parent):
        answer = []
        for widget in parent.winfo_children(): answer.append(widget); answer.extend(widgets(widget))
        return answer

    def button(parent, text):
        for widget in widgets(parent):
            try:
                if hasattr(widget, 'invoke') and widget.cget('text') == text: return widget
            except tk.TclError: pass
        raise AssertionError('Requested button must exist')

    def save(name):
        ui.root.update_idletasks()
        ImageGrab.grab(xdisplay=os.environ['DISPLAY']).save(output/name)

    def light():
        ui.snapshot = {'state': 'DAY_ACTIVE', 'message': 'Synthetische Vorschau · Hell', 'desktopPrefs': {'theme': 'light'}, 'prefs': {}}
        ui._render(); assert ui.root.cget('bg') == '#f3f6f8'
        save('theme-light.png')
        ui.snapshot = {'state': 'EVENING_WIND_DOWN', 'message': 'Zeit für deinen Übergang', 'cardKind': 'transition', 'cardId': 'synthetic-evening',
                       'ifThen': 'Wenn Anker sich meldet, speichere ich und stehe kurz auf.', 'remainingSeconds': 1800,
                       'timePill': {'targetAt': '2026-11-10T22:00:00Z', 'remainingSeconds': 3540},
                       'localPrefs': {'timePillEnabled': True, 'quietSignalEnabled': False}, 'desktopPrefs': {'theme': 'dark'}, 'prefs': {}}
        ui._render()
        later(180, evening)

    def evening():
        assert ui.root.cget('bg') == '#101114'
        assert ui._time_pill is not None and ui._time_pill.winfo_ismapped()
        assert ui._card is not None and ui._card.winfo_ismapped()
        assert ui._bar.winfo_rooty() + ui._bar.winfo_height() <= ui._time_pill.winfo_rooty()
        labels = [widget.cget('text') for widget in widgets(ui._card) if isinstance(widget, tk.Label)]
        assert any('speichere ich' in text for text in labels)
        result['lightDarkAndTimePillRendered'] = True
        result['timePillAndCountdownBarNeverOverlapOnFirstFrame'] = True
        result['eveningIfThenVisible'] = True
        save('evening-if-then-and-time-pill.png')
        button(ui._card, 'Bis Uhrzeit').invoke()
        window = next(widget for widget in ui.root.winfo_children() if isinstance(widget, tk.Toplevel) and widget.title() == 'Bis zu einer Uhrzeit')
        entry = next(widget for widget in widgets(window) if isinstance(widget, tk.Entry))
        entry.insert(0, '23:30')
        button(window, 'Vorschau ansehen').invoke()
        assert sent[-1]['action'] == 'preview-extend-until'
        ui._resolve_action_result({'action': 'preview-extend-until', 'requestId': sent[-1]['requestId'], 'ok': True,
                                   'preview': {'pcStopAt': '2026-11-10T22:30:00Z', 'bedAt': '2026-11-10T23:00:00Z', 'wakeAt': '2026-11-11T06:00:00Z'}})
        assert sent[-1]['action'] == 'extend-until' and sent[-1]['expectedTargetAt'] == '2026-11-10T22:30:00Z'
        assert confirmations and '10.11. 23:30' in confirmations[-1]
        ui._resolve_action_result({'action': 'extend-until', 'requestId': sent[-1]['requestId'], 'ok': True})
        assert not window.winfo_exists()
        result['freeTimeRequiresServerPreviewAndConfirmation'] = True
        ui.snapshot = {'state': 'DAY_ACTIVE', 'cardKind': 'morning', 'cardId': 'synthetic-morning',
                       'morning': {'kind': 'leave', 'title': 'Losgehen', 'targetAt': '2026-11-11T06:30:00Z', 'remainingSeconds': 600},
                       'prefs': {}, 'desktopPrefs': {'theme': 'dark'}, 'localPrefs': {}}
        ui._render()
        later(180, morning)

    def morning():
        card = ui._card
        assert card is not None and card.winfo_ismapped()
        assert ui._morning_remaining.get() == 'Noch 10:00'
        assert 'Losgehen um 07:30' in ui.remaining.get()
        ui.snapshot['morning']['remainingSeconds'] = 540; ui._render()
        assert ui._card is card and ui._morning_remaining.get() == 'Noch 09:00'
        save('morning-countdown.png')
        button(card, 'Schließen').invoke(); ui._render(); assert ui._card is None
        result['morningCountdownUpdatesWithoutReopeningDismissedCard'] = True
        assert ui._time_pill is None
        ui._desktop_settings()
        window = next(widget for widget in ui.root.winfo_children() if isinstance(widget, tk.Toplevel) and widget.title() == 'Darstellung & PC-Verwaltung')
        entries = [widget for widget in widgets(window) if isinstance(widget, tk.Entry)]
        entries[0].delete(0, 'end'); entries[0].insert(0, 'Synthetischer Test-PC')
        entries[1].delete(0, 'end'); entries[1].insert(0, 'CTRL+SHIFT+F8')
        ui.platform = SimpleNamespace(prepare_hotkeys=lambda value: result.setdefault('preparedHotkeys', value) or 'token',
                                      commit_hotkeys=lambda _token: result.setdefault('hotkeysCommittedAfterAck', True),
                                      rollback_hotkeys=lambda _token: True, detach_window=lambda: None)
        button(window, 'PC-Einstellungen speichern').invoke()
        assert sent[-1]['action'] == 'desktop-settings'
        assert 'hotkeysCommittedAfterAck' not in result
        ui._resolve_action_result({'action': 'desktop-settings', 'requestId': sent[-1]['requestId'], 'ok': True})
        assert result['hotkeysCommittedAfterAck'] is True and not window.winfo_exists()
        result['metadataSaveWaitsForMatchingResult'] = True
        ui.root.destroy()

    def setup():
        ui.root.report_callback_exception = lambda kind, value, tb: callback_errors.append(kind.__name__)
        ui.messagebox = SimpleNamespace(askokcancel=lambda _title, text, **_kwargs: confirmations.append(text) or True,
                                        showinfo=lambda *_args, **_kwargs: None)
        later(180, light)
        later(8000, lambda: (_ for _ in ()).throw(AssertionError('GUI feature check timed out')))
    ui._start_tray = setup
    ui.run()
    assert not errors and not callback_errors, (errors, callback_errors)
    result.update(syntheticOnly=True, windowsSystemEffects=0, callbackErrors=callback_errors)
    source = Path(__file__).resolve().parents[1]/'anker_companion'
    result['sourceSha256'] = {name: hashlib.sha256((source/name).read_bytes()).hexdigest() for name in ['ui.py', 'widgets.py']}
    (output/'GUI-FEATURES-RESULT.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--output', type=Path, required=True)
    print(json.dumps(check(parser.parse_args().output), ensure_ascii=False, indent=2))
