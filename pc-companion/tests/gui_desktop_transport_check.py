"""Real Tk administration controls with synthetic action results, no network/filesystem effects."""
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
    sent, errors, callback_errors = [], [], []
    result = {}
    ui = DesktopUI(sent.append)
    def later(ms, callback):
        def guarded():
            try: callback()
            except Exception as error:
                errors.append({'phase': callback.__name__, 'type': type(error).__name__}); ui.root.destroy()
        ui.root.after(ms, guarded)
    def widgets(parent):
        values = []
        for widget in parent.winfo_children(): values.append(widget); values.extend(widgets(widget))
        return values
    def button(parent, title):
        for widget in widgets(parent):
            try:
                if hasattr(widget, 'invoke') and widget.cget('text') == title: return widget
            except tk.TclError: pass
        raise AssertionError('Requested administration button must be present')
    def answer(**values):
        ui._resolve_action_result({'action': sent[-1]['action'], 'requestId': sent[-1]['requestId'], **values})
    def save(name):
        ui.root.update_idletasks(); ImageGrab.grab(xdisplay=os.environ['DISPLAY']).save(output/name)
    def relay():
        ui._relay_settings(); window = ui._relay_window
        entry = next(widget for widget in widgets(window) if isinstance(widget, tk.Entry))
        assert entry.cget('show') == '•'
        entry.insert(0, 'anker-pc-relay:v1:SYNTHETIC_NOT_A_REAL_DEVICE_SECRET')
        button(window, 'Relay einrichten').invoke()
        assert sent[-1]['action'] == 'relay_configure' and entry.get() == ''
        answer(ok=True)
        ui.snapshot = {'state': 'DAY_ACTIVE', 'relay': {'enabled': True, 'status': 'received', 'lastExchangeAt': '2026-11-10T22:00:00Z'}, 'prefs': {}}
        ui._render()
        assert 'Transportkontakt' in ui._relay_status_variable.get()
        assert 'Plan' not in ui._relay_status_variable.get()
        assert 'setupCode' not in json.dumps(ui.snapshot)
        result['relayEntryMaskedAndClearedAfterSubmit'] = True
        result['relayReceiptDoesNotClaimPlanAck'] = True
        save('relay-status-no-secret.png')
        window.tk.call(window.protocol('WM_DELETE_WINDOW'))
        ui.snapshot['update'] = {'status': 'available', 'version': '0.2.0'}
        ui._update_settings()
        later(180, update)
    def update():
        window = ui._updates_window
        assert len(sent) == 1
        button(window, 'Update herunterladen').invoke()
        assert sent[-1]['action'] == 'update-download'
        answer(ok=True, update={'status': 'staged', 'version': '0.2.0', 'stageId': 'synthetic-stage'})
        result['availableSnapshotDoesNotStartDownload'] = True
        save('update-staged-synthetic-result.png')
        button(window, 'Heruntergeladenes Update installieren').invoke()
        assert len(sent) == 2
        result['installRequiresSeparateConfirmation'] = True
        ui.root.destroy()
    def setup():
        ui.root.report_callback_exception = lambda kind, value, tb: callback_errors.append(kind.__name__)
        ui.messagebox = SimpleNamespace(askokcancel=lambda *_args, **_kwargs: False, showinfo=lambda *_args, **_kwargs: None)
        later(180, relay)
        later(6000, lambda: (_ for _ in ()).throw(AssertionError('GUI administration check timed out')))
    ui._start_tray = setup
    ui.run()
    assert not errors and not callback_errors, (errors, callback_errors)
    result.update(syntheticOnly=True, syntheticActionResults=True, windowsSystemEffects=0, networkRequests=0, callbackErrors=[])
    source = Path(__file__).resolve().parents[1]/'anker_companion'
    result['sourceSha256'] = {name: hashlib.sha256((source/name).read_bytes()).hexdigest() for name in ['ui.py', 'widgets.py']}
    (output/'GUI-TRANSPORT-RESULT.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--output', type=Path, required=True)
    print(json.dumps(check(parser.parse_args().output), ensure_ascii=False, indent=2))
