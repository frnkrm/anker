"""Thread-safe Tk desktop surface; only explicit actions leave this module."""
from __future__ import annotations

from copy import deepcopy
import ctypes
from ctypes import wintypes
import math
import os
from queue import Empty, SimpleQueue
from typing import Callable
from uuid import uuid4

from .windows import PlatformError, WindowsPlatform


class DesktopUI:
    BG = "#101114"
    SURFACE = "#1b1e26"
    FG = "#f1f3f5"
    MUTED = "#b5bbc7"
    ACCENT = "#83d6c1"
    WARM = "#cf9659"

    def __init__(self, on_action: Callable[[dict], None], platform: WindowsPlatform | None = None) -> None:
        self.on_action = on_action
        self.platform = platform
        self.queue: SimpleQueue[tuple[str, object]] = SimpleQueue()
        self.snapshot: dict = {}
        self.root = None
        self._tray = None
        self._tray_images: dict[int, object] = {}
        self._overlays: dict[tuple[int, int, int, int], object] = {}
        self._bar = None
        self._card = None
        self._last_card = None
        self._pair_window = None
        self._offer_window = None
        self._qr = None
        self._qr_image = None
        self._pending_actions: dict[str, tuple[str, Callable[[bool], None]]] = {}
        self.capture_exclusion_supported: bool | None = None

    def render(self, snapshot: dict) -> None:
        self.queue.put(("render", deepcopy(snapshot)))

    def ask_pair(self, pairing: dict) -> None:
        self.queue.put(("pair", deepcopy(pairing)))

    def show_note(self, title: str, text: str) -> None:
        self.queue.put(("note", (str(title), str(text))))

    def close(self) -> None:
        self.queue.put(("close", None))

    def _emit(self, action: dict) -> bool:
        try:
            self.on_action(action)
            return True
        except Exception:
            if self.root is not None:
                self.status.set("Die Aktion konnte noch nicht übernommen werden.")
            return False

    def _submit(self, action: dict, complete: Callable[[bool], None]) -> str:
        request_id = uuid4().hex
        self._pending_actions[request_id] = (action["action"], complete)
        if not self._emit({**action, "requestId": request_id}):
            self._pending_actions.pop(request_id, None)
            complete(False)
        return request_id

    def _resolve_action_result(self, result: object) -> None:
        if not isinstance(result, dict) or not isinstance(result.get("ok"), bool):
            return
        request_id = result.get("requestId")
        if not isinstance(request_id, str):
            return
        pending = self._pending_actions.get(request_id)
        if pending is None or pending[0] != result.get("action"):
            return
        self._pending_actions.pop(request_id, None)
        pending[1](result["ok"])

    @staticmethod
    def _valid_note(value: str, *, empty: bool = False) -> bool:
        try:
            # Android/JavaScript maxLength counts UTF-16 units, including emoji pairs.
            return (empty or bool(value.strip())) and len(value.encode("utf-16-le")) <= 1000
        except UnicodeEncodeError:
            return False

    def _strict(self) -> bool:
        return bool(self.snapshot.get("prefs", {}).get("strictLock", self.snapshot.get("strictLock", False)))

    def _extend(self, minutes: int) -> None:
        if self._strict():
            self._note("Verlängern am Handy", "Öffne Anker und bestätige die Notverlängerung mit deinem QR-Code. Der PC kann dafür kein Token erzeugen.")
        else:
            self._emit({"action": "extend", "minutes": minutes})

    def _pause(self) -> None:
        if self._strict():
            self._extend(15)
        else:
            self._emit({"action": "pause"})

    def _button(self, parent, text: str, command, *, primary: bool = False):
        return self.tk.Button(parent, text=text, command=command, font=("Segoe UI", 11),
                              bg=self.ACCENT if primary else self.SURFACE,
                              fg=self.BG if primary else self.FG, activebackground=self.ACCENT,
                              activeforeground=self.BG, relief="flat", borderwidth=0,
                              highlightthickness=2, highlightbackground=self.SURFACE,
                              highlightcolor=self.ACCENT, padx=12, pady=10, takefocus=True,
                              wraplength=340)

    def _label(self, parent, text: str = "", *, size: int = 12, muted: bool = False, variable=None):
        label = self.tk.Label(parent, text=text, textvariable=variable, font=("Segoe UI", size),
                              bg=self.BG, fg=self.MUTED if muted else self.FG,
                              justify="left", anchor="w", wraplength=400)
        parent.bind("<Configure>", lambda event: label.configure(wraplength=max(160, event.width-40)) if event.widget == parent else None, add="+")
        return label

    def _scroll_body(self, window):
        shell = self.tk.Frame(window, bg=self.BG); shell.pack(fill="both", expand=True)
        canvas = self.tk.Canvas(shell, bg=self.BG, highlightthickness=0)
        scrollbar = self.tk.Scrollbar(shell, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y"); canvas.pack(side="left", fill="both", expand=True)
        content = self.tk.Frame(canvas, bg=self.BG)
        item = canvas.create_window((0, 0), window=content, anchor="nw")
        content.bind("<Configure>", lambda _event: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.bind("<Configure>", lambda event: canvas.itemconfigure(item, width=event.width))
        window.bind("<MouseWheel>", lambda event: canvas.yview_scroll(-int(event.delta/120), "units"))
        window.bind("<Next>", lambda _event: canvas.yview_scroll(1, "pages"))
        window.bind("<Prior>", lambda _event: canvas.yview_scroll(-1, "pages"))
        return content

    def run(self) -> None:
        # No Tk root, tray registration or Windows hooks are created on import.
        import tkinter as tk
        from tkinter import messagebox
        self.tk = tk
        self.messagebox = messagebox
        if os.name == "nt":
            try:
                ctypes.WinDLL("user32").SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))
            except (AttributeError, OSError):
                pass
        self.root = tk.Tk()
        self.root.title("Anker PC-Begleiter")
        self.root.configure(bg=self.BG)
        self.root.geometry("480x630")
        self.root.minsize(360, 460)
        self.root.protocol("WM_DELETE_WINDOW", self._hide_or_close)
        self.root.bind("<Escape>", lambda _event: self._hide_or_close())
        self.status = tk.StringVar(value="Noch nicht gekoppelt")
        self.remaining = tk.StringVar(value="")
        self._label(self.root, "Anker PC-Begleiter", size=22).pack(fill="x", padx=20, pady=(20, 8))
        self._label(self.root, variable=self.status).pack(fill="x", padx=20, pady=6)
        self._label(self.root, variable=self.remaining, size=20).pack(fill="x", padx=20, pady=4)
        self._label(self.root, "1. Privates WLAN wählen · 2. Mit Handy koppeln · 3. Testabend starten", muted=True).pack(fill="x", padx=20, pady=10)
        actions = self._scroll_body(self.root)
        for text, callback in [
            ("Mit Handy koppeln", lambda: self._emit({"action": "pair"})),
            ("Speicherpunkt setzen", lambda: self._form("savepoint")),
            ("Gedanke notieren", lambda: self._form("thought")),
            ("+15 Minuten", lambda: self._extend(15)),
            ("Heute ohne PC-Stopp", self._pause),
            ("Abendablauf testen", lambda: self._emit({"action": "test"})),
            ("Einstellungen", self._settings),
            ("Beenden", self._request_quit),
        ]:
            self._button(actions, text, callback).pack(fill="x", pady=3)
        self.root.update_idletasks()
        if self.platform is not None and os.name == "nt":
            try:
                self.platform.attach_window(self._handle(self.root))
                if not self.platform.register_hotkeys(lambda: self._form("savepoint"), lambda: self._form("thought")):
                    self.status.set("Ein Tastenkürzel ist belegt. Speicherpunkt und Gedanke bleiben hier erreichbar.")
            except PlatformError:
                self.status.set("Windows-Ereignisse sind noch nicht verfügbar. Bitte Einrichtung prüfen.")
        self._start_tray()
        self.root.after(100, self._drain)
        try:
            self.root.mainloop()
        finally:
            self._hide_overlays()
            if self.platform is not None:
                self.platform.detach_window()
            if self._tray is not None:
                self._tray.stop()

    def _drain(self) -> None:
        try:
            while True:
                kind, value = self.queue.get_nowait()
                if kind == "render":
                    self._resolve_action_result(value.get("actionResult"))
                    self.snapshot = value
                    self._render()
                elif kind == "pair":
                    self._pair(value)
                elif kind == "note":
                    self._note(*value)
                elif kind == "form":
                    self._form(value)
                elif kind == "main":
                    self.root.deiconify()
                    self.root.lift()
                elif kind == "extend":
                    self._extend(int(value))
                elif kind == "action":
                    self._emit(value)
                elif kind == "settings":
                    self._settings()
                elif kind == "quit":
                    self._request_quit()
                elif kind == "close":
                    self.root.destroy()
                    return
        except Empty:
            pass
        self.root.after(100, self._drain)

    def _render(self) -> None:
        item = self.snapshot
        state = str(item.get("state", item.get("phase", "IDLE")))
        text = str(item.get("message") or item.get("title") or ("Gekoppelt" if item.get("paired") else "Noch nicht gekoppelt"))
        self.status.set(text[:500])
        seconds = item.get("graceRemaining", item.get("remainingSeconds"))
        seconds = max(0, int(seconds)) if isinstance(seconds, (int, float)) and math.isfinite(seconds) else None
        self.remaining.set(f"Noch {math.ceil(seconds / 60)} Min" if seconds is not None and seconds > 0 else "")
        opacity = item.get("dimOpacity", 0)
        if not isinstance(opacity, (int, float)) or not math.isfinite(opacity):
            opacity = 0
        if item.get("prefs", {}).get("dimEnabled", False) and state in {"EVENING_WIND_DOWN", "WIND_DOWN_T30", "BRAIN_DUMP_T10", "BEDTIME_HARD_CUT"}:
            self._show_overlays(max(0.0, min(0.4, float(opacity))))
        else:
            self._hide_overlays()
        self._progress_bar(seconds if state in {"EVENING_WIND_DOWN", "WIND_DOWN_T30", "BRAIN_DUMP_T10", "BEDTIME_HARD_CUT"} else None)
        card_key = item.get("cardId") or ((state, bool(item.get("testMode"))) if state in {"WIND_DOWN_T30", "BRAIN_DUMP_T10", "BEDTIME_HARD_CUT", "NIGHT_LOCK"} else None)
        if card_key and card_key != self._last_card:
            self._last_card = card_key
            self._show_card(state, text, seconds)
        elif card_key is None:
            self._last_card = None
            if self._card is not None:
                self._card.destroy()
                self._card = None
        pairing_qr = item.get("pairingQr")
        if pairing_qr and pairing_qr != getattr(self, "_last_qr", None):
            try:
                import qrcode
                from PIL import ImageTk
                self._close_offer()
                self._offer_window = self.tk.Toplevel(self.root)
                self._offer_window.title("Mit Handy koppeln")
                self._offer_window.configure(bg=self.BG)
                self._offer_window.geometry("420x420")
                self._label(self._offer_window, "In Anker am Handy: PC-Begleiter → Mit PC koppeln", size=14).pack(fill="x", padx=16, pady=12)
                self._qr = self._label(self._offer_window)
                self._qr.pack(padx=16, pady=6)
                self._qr_image = ImageTk.PhotoImage(qrcode.make(str(pairing_qr)).resize((240, 240)))
                self._qr.configure(image=self._qr_image, text="")
                self._button(self._offer_window, "Schließen", self._close_offer).pack(fill="x", padx=16, pady=12)
                self._offer_window.protocol("WM_DELETE_WINDOW", self._close_offer)
                self._last_qr = pairing_qr
            except ImportError:
                self.status.set("QR-Anzeige fehlt. Bitte das vollständige Windows-Paket installieren.")
        elif not pairing_qr:
            self._close_offer()
            self._last_qr = None
        if item.get("pairing"):
            self._pair(item["pairing"])
        if self._tray is not None:
            self._tray.title = ("Anker · " + text)[:120]
            bucket = min(12, max(0, math.ceil((seconds or 0) / 300)))
            self._tray.icon = self._tray_images[bucket]
            self._tray.update_menu()

    def _handle(self, widget) -> int:
        identifier = widget.winfo_id()
        if os.name != "nt":
            return identifier
        user = ctypes.WinDLL("user32", use_last_error=True)
        user.GetAncestor.argtypes = [wintypes.HWND, wintypes.UINT]
        user.GetAncestor.restype = wintypes.HWND
        return int(user.GetAncestor(identifier, 2) or identifier)

    def _style_window(self, window, *, transparent: bool, rectangle: tuple[int, int, int, int] | None = None) -> None:
        if os.name != "nt":
            return
        user = ctypes.WinDLL("user32", use_last_error=True)
        handle = self._handle(window)
        get_style = user.GetWindowLongPtrW if ctypes.sizeof(ctypes.c_void_p) == 8 else user.GetWindowLongW
        set_style = user.SetWindowLongPtrW if ctypes.sizeof(ctypes.c_void_p) == 8 else user.SetWindowLongW
        get_style.argtypes = [wintypes.HWND, ctypes.c_int]; get_style.restype = ctypes.c_ssize_t
        set_style.argtypes = [wintypes.HWND, ctypes.c_int, ctypes.c_ssize_t]; set_style.restype = ctypes.c_ssize_t
        flags = int(get_style(handle, -20)) | 0x80 | 0x80000
        if transparent:
            flags |= 0x20 | 0x08000000
        set_style(handle, -20, flags)
        user.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.UINT]
        user.SetWindowPos.restype = wintypes.BOOL
        if rectangle:
            left, top, right, bottom = rectangle
            user.SetWindowPos(handle, -1, left, top, right - left, bottom - top, 0x10 | 0x40)
        else:
            user.SetWindowPos(handle, -1, 0, 0, 0, 0, 0x1 | 0x2 | 0x10 | 0x40)
        user.ShowWindow(handle, 4)
        if transparent:
            user.SetWindowDisplayAffinity.argtypes = [wintypes.HWND, wintypes.DWORD]
            user.SetWindowDisplayAffinity.restype = wintypes.BOOL
            self.capture_exclusion_supported = bool(user.SetWindowDisplayAffinity(handle, 0x11))

    def _show_overlays(self, opacity: float) -> None:
        if opacity <= 0:
            self._hide_overlays()
            return
        try:
            rectangles = self.platform.monitors() if self.platform is not None and os.name == "nt" else [(0, 0, self.root.winfo_screenwidth(), self.root.winfo_screenheight())]
        except PlatformError:
            self._hide_overlays()
            return
        for old in set(self._overlays) - set(rectangles):
            self._overlays.pop(old).destroy()
        for rectangle in rectangles:
            window = self._overlays.get(rectangle)
            if window is None:
                window = self.tk.Toplevel(self.root)
                window.overrideredirect(True)
                window.configure(bg="#c27b35")
                window.attributes("-topmost", True)
                left, top, right, bottom = rectangle
                window.geometry(f"{right-left}x{bottom-top}{left:+d}{top:+d}")
                window.update_idletasks()
                self._overlays[rectangle] = window
                self._style_window(window, transparent=True, rectangle=rectangle)
            window.attributes("-alpha", opacity)

    def _hide_overlays(self) -> None:
        for window in self._overlays.values():
            window.destroy()
        self._overlays.clear()

    def _progress_bar(self, seconds: int | None) -> None:
        if seconds is None or seconds <= 0:
            if self._bar is not None:
                self._bar.destroy(); self._bar = None
            return
        if self._bar is None:
            self._bar = self.tk.Toplevel(self.root)
            self._bar.overrideredirect(True)
            self._bar.attributes("-topmost", True)
            width = min(600, self.root.winfo_screenwidth())
            self._bar.geometry(f"{width}x42+{max(0,(self.root.winfo_screenwidth()-width)//2)}+0")
            self._bar_canvas = self.tk.Canvas(self._bar, bg=self.BG, height=42, highlightthickness=0)
            self._bar_canvas.pack(fill="both", expand=True)
            self._bar.update_idletasks()
            self._style_window(self._bar, transparent=True)
        width = self._bar.winfo_width()
        self._bar_canvas.delete("all")
        self._bar_canvas.create_rectangle(0, 34, width * min(1, seconds / 1800), 42, fill=self.ACCENT, outline="")
        self._bar_canvas.create_text(width / 2, 17, text=f"Anker · noch {math.ceil(seconds/60)} Min", fill=self.FG, font=("Segoe UI", 12))

    def _show_card(self, state: str, message: str, seconds: int | None) -> None:
        if self._card is not None:
            self._card.destroy()
        self._card = self.tk.Toplevel(self.root)
        self._card.title("Anker")
        self._card.configure(bg=self.BG)
        self._card.attributes("-topmost", True)
        self._card.geometry("440x230")
        self._card.minsize(340, 210)
        self._card.bind("<Escape>", lambda _event: self._card.withdraw())
        title = "Testabend" if self.snapshot.get("testMode") else "Zeit für den Übergang"
        self._label(self._card, title, size=18).pack(fill="x", padx=16, pady=(16, 6))
        self._label(self._card, message[:500]).pack(fill="x", padx=16, pady=6)
        buttons = self.tk.Frame(self._card, bg=self.BG); buttons.pack(fill="x", padx=16, pady=10)
        actions = [("Speicherpunkt", lambda: self._form("savepoint"))]
        if self._strict():
            actions += [("Verlängern am Handy", lambda: self._extend(15)), ("Beenden", self._request_quit)]
        else:
            actions += [("+15 Min", lambda: self._extend(15)), ("Heute ohne", self._pause)]
        for label, callback in actions:
            self._button(buttons, label, callback).pack(side="left", fill="x", expand=True, padx=2)
        self._card.update_idletasks()
        self._style_window(self._card, transparent=False)

    def _form(self, kind: str) -> None:
        window = self.tk.Toplevel(self.root)
        window.title("Speicherpunkt" if kind == "savepoint" else "Gedanke")
        window.configure(bg=self.BG); window.geometry("460x320")
        dialog = self._scroll_body(window)
        self._label(dialog, "Wo stehst du gerade?" if kind == "savepoint" else "Was möchtest du festhalten?", size=16).pack(fill="x", padx=16, pady=12)
        text = self.tk.Entry(dialog, font=("Segoe UI", 12)); text.pack(fill="x", padx=16, ipady=8)
        next_step = None
        if kind == "savepoint":
            self._label(dialog, "Nächster Schritt (optional)", muted=True).pack(fill="x", padx=16, pady=(12, 4))
            next_step = self.tk.Entry(dialog, font=("Segoe UI", 12)); next_step.pack(fill="x", padx=16, ipady=8)
        feedback = self._label(dialog, muted=True); feedback.pack(fill="x", padx=16, pady=6)
        pending_id = None
        waiting = False
        def complete(ok: bool):
            nonlocal waiting, pending_id
            waiting = False; pending_id = None
            if not window.winfo_exists():
                return
            if ok:
                window.destroy()
            else:
                text.configure(state="normal")
                if next_step is not None:
                    next_step.configure(state="normal")
                button.configure(state="normal")
                feedback.configure(text="Noch nicht gespeichert. Dein Text bleibt erhalten; versuche es erneut.")
        def submit(_event=None):
            nonlocal waiting, pending_id
            if waiting:
                return
            value, next_value = text.get().strip(), next_step.get().strip() if next_step is not None else ""
            if not self._valid_note(value) or not self._valid_note(next_value, empty=True):
                feedback.configure(text="Ein kurzer Text genügt; höchstens 500 Zeichen je Feld.")
                return
            action = {"action": kind, "text": value}
            if kind == "savepoint": action["nextStep"] = next_value
            waiting = True
            text.configure(state="disabled")
            if next_step is not None:
                next_step.configure(state="disabled")
            button.configure(state="disabled")
            feedback.configure(text="Zum Speichern übergeben. Die Bestätigung erscheint im PC-Status.")
            pending_id = self._submit(action, complete)
        def dismiss(_event=None):
            if pending_id is not None:
                self._pending_actions.pop(pending_id, None)
            window.destroy()
        button = self._button(dialog, "Merken", submit, primary=True); button.pack(fill="x", padx=16, pady=6)
        window.protocol("WM_DELETE_WINDOW", dismiss)
        window.bind("<Return>", submit); window.bind("<Escape>", dismiss)
        text.focus_set()

    def _pair(self, pairing: dict) -> None:
        identifier = str(pairing.get("id", ""))
        if not identifier or identifier == getattr(self, "_last_pair", None): return
        self._last_pair = identifier
        dialog = self.tk.Toplevel(self.root)
        dialog.title("Handy koppeln"); dialog.configure(bg=self.BG)
        self._label(dialog, "Stimmt dieser Code auf deinem Handy?", size=16).pack(padx=20, pady=12)
        self._label(dialog, str(pairing.get("code", ""))[:4], size=32).pack(padx=20, pady=8)
        self._label(dialog, str(pairing.get("n", "Handy"))[:100], muted=True).pack(padx=20)
        def answer(approved: bool):
            self._emit({"action": "confirm_pair" if approved else "reject_pair", "id": identifier})
            dialog.destroy()
        self._button(dialog, "Ja, koppeln", lambda: answer(True), primary=True).pack(fill="x", padx=20, pady=8)
        self._button(dialog, "Abbrechen", lambda: answer(False)).pack(fill="x", padx=20, pady=(0, 16))
        dialog.protocol("WM_DELETE_WINDOW", lambda: answer(False))
        dialog.bind("<Escape>", lambda _event: answer(False))
        self._pair_window = dialog

    def _note(self, title: str, text: str) -> None:
        if self.root is None:
            self.show_note(title, text); return
        dialog = self.tk.Toplevel(self.root); dialog.title(title[:120]); dialog.configure(bg=self.BG)
        self._label(dialog, title[:120], size=18).pack(fill="x", padx=20, pady=12)
        body = self.tk.Text(dialog, height=10, width=40, wrap="word", bg=self.SURFACE, fg=self.FG, font=("Segoe UI", 12))
        scroll = self.tk.Scrollbar(dialog, command=body.yview)
        body.configure(yscrollcommand=scroll.set)
        body.insert("1.0", text[:1000]); body.configure(state="disabled")
        scroll.pack(side="right", fill="y"); body.pack(fill="both", expand=True, padx=20, pady=8)
        self._button(dialog, "Ok", dialog.destroy, primary=True).pack(fill="x", padx=20, pady=12)
        dialog.bind("<Escape>", lambda _event: dialog.destroy())

    def _settings(self) -> None:
        window = self.tk.Toplevel(self.root); window.title("Einstellungen"); window.configure(bg=self.BG)
        window.geometry("500x650"); dialog = self._scroll_body(window)
        # Effective preferences include the phone choice. Never turn that into local consent.
        prefs = self.snapshot.get("localPrefs", {})
        values = {}
        controls = []
        for name, title in [("enforceEnabled", "PC-Aktionen ausdrücklich erlauben"), ("strictLock", "Strenger Nachtmodus"),
                            ("dimEnabled", "Bildschirmdämmerung – Signal zum Übergang"), ("audioDuck", "Ton im Übergang langsam reduzieren")]:
            values[name] = self.tk.BooleanVar(value=bool(prefs.get(name, False)))
            control = self.tk.Checkbutton(dialog, text=title, variable=values[name], bg=self.BG, fg=self.FG,
                                          selectcolor=self.SURFACE, activebackground=self.BG, activeforeground=self.FG,
                                          font=("Segoe UI", 11), wraplength=380, anchor="w", justify="left")
            control.pack(fill="x", padx=16, pady=7); controls.append(control)
        self._label(dialog, "Eine Freigabe startet allein noch keine Sperre. Ein gültiger Auftrag vom gekoppelten Handy bleibt erforderlich.", muted=True).pack(fill="x", padx=16, pady=10)
        stop_action = self.tk.StringVar(value=str(prefs.get("stopAction", "lock")))
        action_row = self.tk.Frame(dialog, bg=self.BG); action_row.pack(fill="x", padx=16)
        for code, label in [("lock", "Sperren"), ("hibernate", "Ruhezustand"), ("shutdown", "Herunterfahren")]:
            control = self.tk.Radiobutton(action_row, text=label, value=code, variable=stop_action, bg=self.BG, fg=self.FG,
                                          selectcolor=self.SURFACE, activebackground=self.BG, activeforeground=self.FG)
            control.pack(side="left"); controls.append(control)
        self._label(dialog, "Speicher-Countdown (mindestens 60 Sekunden)", muted=True).pack(fill="x", padx=16, pady=(8, 0))
        grace = self.tk.StringVar(value=str(prefs.get("graceSeconds", 60)))
        control = self.tk.Spinbox(dialog, from_=60, to=600, increment=30, textvariable=grace)
        control.pack(fill="x", padx=16, pady=6); controls.append(control)
        self._label(dialog, "Dämmerung höchstens (0 bis 40 Prozent)", muted=True).pack(fill="x", padx=16)
        dim = self.tk.Scale(dialog, from_=0, to=40, orient="horizontal", bg=self.BG, fg=self.FG, troughcolor=self.SURFACE, highlightthickness=0)
        dim.set(round(float(prefs.get("dimMax", 0.25))*100)); dim.pack(fill="x", padx=16); controls.append(dim)
        feedback = self._label(dialog, muted=True); feedback.pack(fill="x", padx=16, pady=6)
        pending_id = None
        waiting = False
        def complete(ok: bool):
            nonlocal waiting, pending_id
            waiting = False; pending_id = None
            if not window.winfo_exists():
                return
            if ok:
                window.destroy()
            else:
                for control in controls:
                    control.configure(state="normal")
                button.configure(state="normal")
                feedback.configure(text="Noch nicht übernommen. Deine Auswahl bleibt erhalten; versuche es erneut.")
        def save():
            nonlocal waiting, pending_id
            if waiting:
                return
            selected = {name: value.get() for name, value in values.items()}
            try:
                seconds = int(grace.get())
                if not 60 <= seconds <= 600: raise ValueError()
            except ValueError:
                self.messagebox.showinfo("Speicherzeit", "Wähle zwischen 60 und 600 Sekunden.", parent=window); return
            selected.update(stopAction=stop_action.get(), graceSeconds=seconds, dimMax=dim.get()/100)
            if selected["strictLock"] and not prefs.get("strictLock"):
                if not self.messagebox.askokcancel("Strengen Modus aktivieren?", "Nach dem Speicher-Countdown wird der PC erneut gesperrt, bis die Morgenroutine bestätigt ist. Verlängern geht dann am Handy. Du kannst den Begleiter weiterhin beenden.", parent=window): return
            waiting = True
            for control in controls:
                control.configure(state="disabled")
            button.configure(state="disabled")
            feedback.configure(text="Zum Übernehmen übergeben. Die Bestätigung erscheint im PC-Status.")
            pending_id = self._submit({"action": "settings", "prefs": selected}, complete)
        def dismiss(_event=None):
            if pending_id is not None:
                self._pending_actions.pop(pending_id, None)
            window.destroy()
        window.protocol("WM_DELETE_WINDOW", dismiss)
        window.bind("<Escape>", dismiss)
        button = self._button(dialog, "Übernehmen", save, primary=True); button.pack(fill="x", padx=16, pady=8)
        self._button(dialog, "Entkoppeln", lambda: self._emit({"action": "unpair"})).pack(fill="x", padx=16, pady=6)
        if self.snapshot.get("legacyConflict"):
            self._button(dialog, "Klassische Aufgabe entfernen", lambda: self._emit({"action": "remove_legacy"})).pack(fill="x", padx=16, pady=6)

    def _close_offer(self) -> None:
        if self._offer_window is not None:
            self._offer_window.destroy()
            self._offer_window = None
            self._qr = None
            self._qr_image = None

    def _request_quit(self) -> None:
        if self.messagebox.askokcancel("Anker beenden?", "Dann läuft kein PC-Stopp durch diesen Begleiter.", parent=self.root):
            self._emit({"action": "quit"}); self.close()

    def _hide_or_close(self) -> None:
        if self._tray is not None: self.root.withdraw()
        else: self._request_quit()

    def _start_tray(self) -> None:
        if os.name != "nt": return
        try:
            import pystray
            from PIL import Image, ImageDraw
            for bucket in range(13):
                image = Image.new("RGBA", (64, 64), (0, 0, 0, 0)); draw = ImageDraw.Draw(image)
                draw.ellipse((2, 2, 62, 62), outline=self.SURFACE, width=5)
                if bucket: draw.arc((2, 2, 62, 62), -90, -90 + 360 * bucket / 12, fill=self.ACCENT, width=5)
                draw.line((32, 17, 32, 47), fill=self.ACCENT, width=5)
                draw.arc((18, 28, 46, 49), 0, 180, fill=self.ACCENT, width=5)
                draw.ellipse((27, 12, 37, 22), outline=self.ACCENT, width=3)
                self._tray_images[bucket] = image
            def queue(kind, value=None): return lambda _icon, _item: self.queue.put((kind, value))
            menu = pystray.Menu(
                pystray.MenuItem("Anker öffnen", queue("main"), default=True),
                pystray.MenuItem("Speicherpunkt setzen", queue("form", "savepoint")),
                pystray.MenuItem("Gedanke notieren", queue("form", "thought")),
                pystray.MenuItem("+15 Min", lambda _i, _m: self.queue.put(("extend", 15)), enabled=lambda _m: not self._strict()),
                pystray.MenuItem("+30 Min", lambda _i, _m: self.queue.put(("extend", 30)), enabled=lambda _m: not self._strict()),
                pystray.MenuItem("Heute ohne PC-Stopp", queue("action", {"action": "pause"}), enabled=lambda _m: not self._strict()),
                pystray.MenuItem("Wieder aktivieren", queue("action", {"action": "resume"})),
                pystray.MenuItem("Abendablauf testen", queue("action", {"action": "test"})),
                pystray.MenuItem("Mit Handy koppeln", queue("action", {"action": "pair"})),
                pystray.MenuItem("Einstellungen", queue("settings")),
                pystray.MenuItem("Beenden", queue("quit")),
            )
            self._tray = pystray.Icon("Anker PC-Begleiter", self._tray_images[0], "Anker PC-Begleiter", menu)
            self._tray.run_detached()
        except (ImportError, OSError, RuntimeError):
            self._tray = None


TkDesktopUI = DesktopUI
