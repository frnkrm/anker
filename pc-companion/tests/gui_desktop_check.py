"""Explicit real-Tk regression, e.g. DISPLAY=:93 python tests/gui_desktop_check.py --output DIR.

This is intentionally outside unittest's default test_ pattern: it needs a real
desktop/Xvfb, uses only synthetic data, and never creates Windows system effects.
"""
from pathlib import Path
import argparse
import hashlib
import json
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import tkinter as tk
from PIL import ImageGrab, ImageTk

from anker_companion.ui import DesktopUI
from anker_companion.widgets import rounded_button


def check(output: Path) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    result = {}
    root = tk.Tk(); root.geometry('360x420')
    invoked = []
    first = rounded_button(tk, root, 'Eine längere deutsche Beschriftung bleibt vollständig lesbar', lambda: invoked.append(True))
    first.pack(fill='x', padx=16, pady=8)
    second = rounded_button(tk, root, 'Nächste Aktion', lambda: None)
    second.pack(fill='x', padx=16, pady=8)
    root.update(); first.focus_force(); root.update()
    first.event_generate('<Return>'); first.event_generate('<space>'); root.update()
    assert len(invoked) == 2 and root.focus_get() is first
    assert first.winfo_height() > 46
    bbox = first.bbox('all')
    assert bbox[0] >= 0 and bbox[2] <= first.winfo_width() and bbox[3] <= first.winfo_height()
    first.event_generate('<Tab>'); root.update()
    assert root.focus_get() is second
    first.configure(state='disabled'); first.invoke()
    first.event_generate('<Return>'); root.update()
    assert len(invoked) == 2 and first.cget('state') == 'disabled'
    result['roundedButtonKeyboardFocusWrapDisabled'] = True
    root.destroy()

    sent, callback_errors, errors = [], [], []
    ui = DesktopUI(sent.append)
    ui.render({'message': 'Verbunden · PC-Stopp heute 23:00', 'paired': True, 'prefs': {}, 'state': 'DAY_ACTIVE'})

    def later(ms, callback):
        def guarded():
            try: callback()
            except Exception as error:
                errors.append({'phase': callback.__name__, 'type': type(error).__name__})
                ui.root.destroy()
        ui.root.after(ms, guarded)

    def save(name):
        ui.root.update_idletasks()
        if sys.platform == 'win32':
            ImageGrab.grab().save(output / name)
        else:
            import os
            ImageGrab.grab(xdisplay=os.environ['DISPLAY']).save(output / name)

    def start():
        ui._action_buttons['sync'].invoke()
        assert 'warte auf das Handy' in ui._feedback_text
        assert ui._action_buttons['sync'].cget('state') == 'disabled'
        ui.render({'message': 'Periodischer Planstatus', 'state': 'DAY_ACTIVE', 'prefs': {}})
        later(180, pending)

    def pending():
        assert 'warte auf das Handy' in ui._feedback_text
        ui.render({'message': 'Verbunden · PC-Stopp heute 23:00', 'paired': True, 'prefs': {}, 'state': 'DAY_ACTIVE',
                   'actionResult': {'action': 'sync', 'requestId': sent[-1]['requestId'], 'ok': True,
                                    'status': 'received', 'sourceGeneratedAt': '2026-11-10T20:45:00Z'}})
        later(180, pause)

    def pause():
        assert 'Stand 10.11. 21:45' in ui._feedback_text
        assert ui._action_buttons['sync'].cget('state') == 'normal'
        result['syncWaitsForMatchingResultAndShowsSourceTime'] = True
        ui._action_buttons['pause'].invoke()
        ui.render({'message': 'Verbunden · Heute ohne PC-Stopp', 'paired': True, 'prefs': {}, 'state': 'DAY_ACTIVE',
                   'actionResult': {'action': 'pause', 'requestId': sent[-1]['requestId'], 'ok': True}})
        later(180, normal)

    def normal():
        assert ui._feedback_text == 'PC-Stopp für heute am PC ausgesetzt.'
        save('main-paired-pause-feedback.png')
        result['mainDefaultSize'] = [ui.root.winfo_width(), ui.root.winfo_height()]
        result['pauseFeedbackVisible'] = True
        result['tkScalingBefore'] = float(ui.root.tk.call('tk', 'scaling'))
        ui.show_pairing_offer('anker-pc-pair:v3:SYNTHETIC_GUI_TEST_NO_DEVICE_SECRET', time.time()+60, 'synthetic-ui-id')
        later(180, dpi)

    def dpi():
        assert ui._offer_window is not None
        result['qrImageBeforeMonitorChange'] = [ui._qr_image.width(), ui._qr_image.height()]
        ui._monitor_metrics = lambda: ((0, 0, 1280, 720), 2.0)
        ui._fit_main_window()
        later(180, high_dpi)

    def high_dpi():
        assert ui.root.winfo_width() <= 1280 and ui.root.winfo_height() < 720
        assert float(ui.root.tk.call('tk', 'scaling')) == result['tkScalingBefore']
        assert [ui._qr_image.width(), ui._qr_image.height()] == result['qrImageBeforeMonitorChange']
        result['monitorDpiFitWithoutGlobalTkOrQrRescale'] = True
        ui._close_offer()
        save('main-1280x720-dpi200.png')
        ui._monitor_metrics = lambda: ((0, 0, 640, 480), 1.0)
        ui._fit_main_window(); ui.root.geometry('340x400')
        later(180, small)

    def small():
        button = ui._action_buttons['quit']
        button.focus_force()
        later(180, focused)

    def focused():
        button = ui._action_buttons['quit']
        assert ui.root.focus_get() is button
        assert button.winfo_rooty() >= ui.root.winfo_rooty()
        assert button.winfo_rooty()+button.winfo_height() <= ui.root.winfo_rooty()+ui.root.winfo_height()+2
        for control in ui._action_buttons.values():
            assert control.bbox('all')[0] >= 0
            assert control.bbox('all')[2] <= control.winfo_width()
        result['smallWindowScrollsKeyboardFocusIntoView'] = True
        result['smallWindowSize'] = [ui.root.winfo_width(), ui.root.winfo_height()]
        save('main-small-keyboard-focus.png')
        ui.root.destroy()

    def setup():
        ui.root.report_callback_exception = lambda kind, value, tb: callback_errors.append(kind.__name__)
        later(180, start)
        later(8000, lambda: (_ for _ in ()).throw(AssertionError('GUI check timed out')))

    ui._start_tray = setup
    ui.run()
    assert not errors and not callback_errors, (errors, callback_errors)
    result['callbackErrors'] = callback_errors
    result['syntheticOnly'] = True
    result['windowsSystemEffects'] = 0
    source = Path(__file__).resolve().parents[1] / 'anker_companion'
    result['sourceSha256'] = {name: hashlib.sha256((source/name).read_bytes()).hexdigest() for name in ['ui.py', 'widgets.py']}
    (output/'GUI-UX-RESULT.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    print(json.dumps(check(parser.parse_args().output), ensure_ascii=False, indent=2))
