"""Thread-safe Tk desktop surface; only explicit actions leave this module."""
from __future__ import annotations

from copy import deepcopy
import ctypes
from ctypes import wintypes
from datetime import datetime
import math
import os
import re
import time
from queue import Empty, SimpleQueue
from typing import Callable
from uuid import uuid4
from zoneinfo import ZoneInfo

from .windows import PlatformError, WindowsPlatform
from .widgets import rounded_button, theme_palette, window_geometry


class DesktopUI:
    FONT = "Segoe UI" if os.name == "nt" else "Helvetica"
    BG = "#101114"
    SURFACE = "#1b1e26"
    FG = "#f1f3f5"
    MUTED = "#b5bbc7"
    ACCENT = "#83d6c1"
    WARM = "#cf9659"

    def __init__(self, on_action: Callable[[dict], None], platform: WindowsPlatform | None = None, clock=time.time) -> None:
        self.on_action = on_action
        self.platform = platform
        self.clock = clock
        self.queue: SimpleQueue[tuple[str, object]] = SimpleQueue()
        self.snapshot: dict = {}
        self.root = None
        self._tray = None
        self._tray_ready = False
        self._tray_images: dict[int, object] = {}
        self._overlays: dict[tuple[int, int, int, int], object] = {}
        self._bar = None
        self._card = None
        self._last_card = None
        self._pair_window = None
        self._offer_window = None
        self._qr = None
        self._qr_image = None
        self._offer_identifier = None
        self._offer_expires_at = None
        self._offer_timer = None
        self._display_error = None
        self._pending_actions: dict[str, tuple[str, Callable[[bool], None]]] = {}
        self._main_pending: dict[str, str] = {}
        self._action_buttons: dict[str, object] = {}
        self._feedback_variable = None
        self._feedback_label = None
        self._remaining_label = None
        self._feedback_text = ""
        self._last_sync_result: dict = {}
        self._last_extension_preview: dict = {}
        self._palette = theme_palette("dark")
        self._theme_variant = "dark"
        self._time_pill = None
        self._time_pill_text = None
        self._morning_remaining = None
        self._dpi_scale = 1.0
        self._monitor_signature = None
        self.capture_exclusion_supported: bool | None = None

    def render(self, snapshot: dict) -> None:
        self.queue.put(("render", deepcopy(snapshot)))

    def ask_pair(self, pairing: dict) -> None:
        self.queue.put(("pair", deepcopy(pairing)))

    def show_pairing_offer(self, qr: str, expires_at: float, identifier: str) -> None:
        # Short-lived pairing material is an event, never part of engine snapshots.
        self.queue.put(("pairing-offer", (qr, expires_at, identifier)))

    def close_pairing_offer(self, identifier: str) -> None:
        self.queue.put(("close-pairing-offer", identifier))

    def show_note(self, title: str, text: str) -> None:
        self.queue.put(("note", (str(title), str(text))))

    def close(self) -> None:
        self.queue.put(("close", None))

    def _emit(self, action: dict) -> bool:
        try:
            if action.get("action") == "pair":
                self._display_error = None
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
        if result.get("action") == "sync":
            state = result.get("status")
            self._last_sync_result = {"status": state if isinstance(state, str) and state in {"received", "offline", "pending-events", "timeout", "busy", "unpaired"} else "unknown"}
            generated = result.get("sourceGeneratedAt")
            if isinstance(generated, str) and len(generated) <= 40:
                try:
                    instant = datetime.fromisoformat(generated.replace("Z", "+00:00"))
                    if instant.tzinfo is not None:
                        self._last_sync_result["sourceGeneratedAt"] = instant.astimezone(ZoneInfo("Europe/Berlin")).strftime("%d.%m. %H:%M")
                except (ValueError, OverflowError): pass
        if result.get("action") == "preview-extend-until":
            preview = result.get("preview")
            self._last_extension_preview = dict(preview) if isinstance(preview, dict) else {}
        self._pending_actions.pop(request_id, None)
        pending[1](result["ok"])

    def _set_feedback(self, text: str) -> None:
        self._feedback_text = text
        if self._feedback_variable is not None:
            self._feedback_variable.set(text)

    def _perform_action(self, action: dict, pending: str, success: str) -> None:
        kind = action["action"]
        if kind in self._main_pending:
            self._set_feedback(pending)
            return
        button = self._action_buttons.get(kind)
        if button is not None:
            button.configure(state="disabled")
        self._set_feedback(pending)
        if kind == "sync":
            self._last_sync_result = {}
        # Install the marker before emitting: a synchronous failure can finish now.
        self._main_pending[kind] = ""
        def complete(ok: bool) -> None:
            self._main_pending.pop(kind, None)
            if button is not None:
                try: button.configure(state="normal")
                except Exception: pass
            if kind == "sync" and self._last_sync_result.get("status") != "received": ok = False
            feedback = success if ok else "Noch nicht bestätigt. Prüfe die Verbindung und versuche es erneut."
            if kind == "sync" and ok and self._last_sync_result.get("sourceGeneratedAt"):
                feedback = "Handystand empfangen · Stand " + self._last_sync_result["sourceGeneratedAt"]
            if kind == "pair" and ok and self._offer_window is None:
                feedback = "QR-Code konnte noch nicht angezeigt werden. Bitte erneut versuchen."
            if kind == "sync" and not ok:
                feedback = {
                    "pending-events": "Öffne Anker am Handy, damit offene PC-Rückmeldungen übernommen werden.",
                    "offline": "Noch keine Handyverbindung. Öffne Anker am Handy und prüfe das gemeinsame WLAN.",
                    "unpaired": "Kopple zuerst dein Handy über Mit Handy koppeln.",
                    "timeout": "Noch keinen neuen Handystand empfangen. Öffne Anker am Handy und versuche es erneut.",
                    "busy": "Ein Abgleich läuft bereits. Warte kurz und versuche es danach erneut.",
                }.get(self._last_sync_result.get("status"), feedback)
            self._set_feedback(feedback)
        request_id = self._submit(action, complete)
        if kind not in self._main_pending:
            return
        self._main_pending[kind] = request_id
        def timeout() -> None:
            if self._main_pending.get(kind) != request_id:
                return
            self._pending_actions.pop(request_id, None)
            if kind == "sync": self._last_sync_result = {"status": "timeout"}
            complete(False)
        if self.root is not None:
            self.root.after(30_000, timeout)

    def _dispatch_action(self, action: dict) -> None:
        kind = action.get("action")
        if kind == "sync":
            self._perform_action(action, "Abgleich angefragt – warte auf das Handy …", "Handystand neu empfangen.")
        elif kind == "pair":
            self._perform_action(action, "Kopplungs-QR wird vorbereitet …", "QR-Code bereit. Scanne ihn mit Anker am Handy.")
        elif kind == "test":
            self._perform_action(action, "Testabend wird vorbereitet …", "Testabend gestartet. Er löst keine PC-Sperre aus.")
        elif kind == "pause":
            self._pause()
        elif kind == "resume":
            self._perform_action(action, "Wiederaufnahme angefragt …", "PC-Stopp wieder aktiviert, sofern ein gültiger Plan vorliegt.")
        else:
            self._emit(action)

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
            self._perform_action({"action": "extend", "minutes": minutes}, "Verlängerung angefragt …", "Verlängerung am PC gespeichert. Die Übertragung zum Handy wird getrennt bestätigt.")

    def _pause(self) -> None:
        if self._strict():
            self._extend(15)
        else:
            self._perform_action({"action": "pause"}, "Pause angefragt …", "PC-Stopp für heute am PC ausgesetzt.")

    def _button(self, parent, text: str, command, *, primary: bool = False):
        button = rounded_button(self.tk, parent, text, command, primary=primary,
                                scale=self._dpi_scale, background=self.BG)
        button.set_theme(self._palette)
        return button

    def _label(self, parent, text: str = "", *, size: int = 12, muted: bool = False, variable=None):
        label = self.tk.Label(parent, text=text, textvariable=variable, font=(self.FONT, -max(10, round(size * 96 / 72 * self._dpi_scale))),
                              bg=self.BG, fg=self.MUTED if muted else self.FG,
                              justify="left", anchor="w", wraplength=400)
        label._anker_font_points = size
        label._anker_muted = muted
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
        def reveal_focus(event):
            widget = event.widget
            ancestor = widget
            while ancestor is not None and ancestor is not content:
                ancestor = getattr(ancestor, "master", None)
            if ancestor is not content or widget is content:
                return
            canvas.update_idletasks()
            top = widget.winfo_rooty() - content.winfo_rooty()
            bottom = top + widget.winfo_height()
            viewport = canvas.canvasy(0)
            height = canvas.winfo_height()
            total = max(1, content.winfo_height())
            if top < viewport:
                canvas.yview_moveto(max(0, top / total))
            elif bottom > viewport + height:
                canvas.yview_moveto(max(0, (bottom - height) / total))
        window.bind("<FocusIn>", reveal_focus, add="+")
        window.bind("<MouseWheel>", lambda event: canvas.yview_scroll(-int(event.delta/120), "units"))
        window.bind("<Button-4>", lambda _event: canvas.yview_scroll(-1, "units"))
        window.bind("<Button-5>", lambda _event: canvas.yview_scroll(1, "units"))
        window.bind("<Next>", lambda _event: canvas.yview_scroll(1, "pages"))
        window.bind("<Prior>", lambda _event: canvas.yview_scroll(-1, "pages"))
        return content

    def _monitor_metrics(self) -> tuple[tuple[int, int, int, int], float]:
        if os.name == "nt":
            try:
                class MonitorInfo(ctypes.Structure):
                    _fields_ = [("cbSize", wintypes.DWORD), ("rcMonitor", wintypes.RECT),
                                ("rcWork", wintypes.RECT), ("dwFlags", wintypes.DWORD)]
                user = ctypes.WinDLL("user32", use_last_error=True)
                handle = self._handle(self.root)
                user.MonitorFromWindow.argtypes = [wintypes.HWND, wintypes.DWORD]
                user.MonitorFromWindow.restype = wintypes.HANDLE
                user.GetMonitorInfoW.argtypes = [wintypes.HANDLE, ctypes.POINTER(MonitorInfo)]
                user.GetMonitorInfoW.restype = wintypes.BOOL
                monitor = user.MonitorFromWindow(handle, 2)
                info = MonitorInfo(); info.cbSize = ctypes.sizeof(info)
                if not monitor or not user.GetMonitorInfoW(monitor, ctypes.byref(info)):
                    raise OSError()
                user.GetDpiForWindow.argtypes = [wintypes.HWND]
                user.GetDpiForWindow.restype = wintypes.UINT
                dpi = user.GetDpiForWindow(handle)
                scale = dpi / 96 if 72 <= dpi <= 384 else self._dpi_scale
                work = info.rcWork
                return (work.left, work.top, work.right, work.bottom), scale
            except (AttributeError, OSError, ValueError):
                pass
        return (0, 0, self.root.winfo_screenwidth(), self.root.winfo_screenheight()), 1.0

    def _fit_main_window(self) -> None:
        area, scale = self._monitor_metrics()
        signature = (area, scale)
        if signature == self._monitor_signature:
            return
        first = self._monitor_signature is None
        current = None if first else (self.root.winfo_x(), self.root.winfo_y())
        width, height, x, y, min_width, min_height = window_geometry(area, scale, current)
        self._monitor_signature = signature
        self._dpi_scale = max(0.75, min(4.0, scale))
        self.root.minsize(min_width, min_height)
        self.root.geometry(f"{width}x{height}")
        if os.name == "nt":
            try:
                user = ctypes.WinDLL("user32", use_last_error=True)
                user.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int,
                                             ctypes.c_int, ctypes.c_int, wintypes.UINT]
                user.SetWindowPos.restype = wintypes.BOOL
                user.SetWindowPos(self._handle(self.root), None, x, y, 0, 0, 0x1 | 0x4 | 0x10)
            except (AttributeError, OSError, ValueError):
                pass
        else:
            self.root.geometry(f"{width}x{height}{x:+}{y:+}")
        def scale_buttons(widget):
            # Separate toplevels (especially the pixel-exact QR) keep their scale.
            if widget is not self.root and isinstance(widget, self.tk.Toplevel): return
            if hasattr(widget, "set_scale"): widget.set_scale(self._dpi_scale)
            if hasattr(widget, "_anker_font_points"):
                widget.configure(font=(self.FONT, -max(10, round(widget._anker_font_points * 96 / 72 * self._dpi_scale))))
            for child in widget.winfo_children(): scale_buttons(child)
        scale_buttons(self.root)

    def _watch_monitor(self) -> None:
        try:
            self._apply_theme()
            if self.root.state() not in {"withdrawn", "iconic"}:
                self._fit_main_window()
        except Exception:
            # A temporary monitor/DPI failure must not close or hide Anker.
            pass
        try: self.root.after(500, self._watch_monitor)
        except Exception: pass

    def _apply_theme(self) -> None:
        desktop = self.snapshot.get("desktopPrefs", {})
        mode = desktop.get("theme", "system") if isinstance(desktop, dict) else "system"
        dark = True
        if mode == "system" and os.name == "nt":
            try:
                import winreg
                with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize") as key:
                    dark = winreg.QueryValueEx(key, "AppsUseLightTheme")[0] == 0
            except (ImportError, OSError, TypeError): pass
        palette = theme_palette(mode, dark)
        variant = palette["bg"]
        if variant == self._theme_variant:
            return
        self._theme_variant = variant
        self._palette = palette
        self.BG, self.SURFACE, self.FG, self.MUTED = (palette[key] for key in ("bg", "surface", "text", "muted"))
        if self.root is None: return
        def recolor(widget):
            if hasattr(widget, "set_theme"):
                widget.set_theme(palette)
            else:
                try: widget.configure(bg=self.BG)
                except Exception: pass
                try: widget.configure(fg=self.MUTED if getattr(widget, "_anker_muted", False) else self.FG)
                except Exception: pass
                try: widget.configure(selectcolor=self.SURFACE)
                except Exception: pass
            for child in getattr(widget, "winfo_children", lambda: [])(): recolor(child)
        recolor(self.root)

    def run(self) -> None:
        # No Tk root, tray registration or Windows hooks are created on import.
        import tkinter as tk
        from tkinter import messagebox
        self.tk = tk
        self.messagebox = messagebox
        self._apply_theme()
        if os.name == "nt":
            try:
                ctypes.WinDLL("user32").SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))
            except (AttributeError, OSError):
                pass
        self.root = tk.Tk()
        self.root.title("Anker PC-Begleiter")
        self.root.configure(bg=self.BG)
        self.root.geometry("520x720")
        self.root.minsize(340, 390)
        self.root.protocol("WM_DELETE_WINDOW", self._hide_or_close)
        self.root.bind("<Escape>", lambda _event: self._hide_or_close())
        self.root.bind("<Unmap>", self._on_unmap)
        self.status = tk.StringVar(value="Noch nicht gekoppelt")
        self.remaining = tk.StringVar(value="")
        self._morning_remaining = tk.StringVar(value="")
        self._feedback_variable = tk.StringVar(value="Wähle eine Aktion. Anker zeigt dir hier deren Rückmeldung.")
        actions = self._scroll_body(self.root)
        self._label(actions, "Anker PC-Begleiter", size=22).pack(fill="x", padx=20, pady=(20, 8))
        self._label(actions, variable=self.status).pack(fill="x", padx=20, pady=6)
        self._remaining_label = self._label(actions, variable=self.remaining, size=20)
        self._remaining_label.pack(fill="x", padx=20, pady=4)
        self._feedback_label = self._label(actions, variable=self._feedback_variable, muted=True)
        self._feedback_label.pack(fill="x", padx=20, pady=(4, 12))
        for key, text, callback, primary in [
            ("sync", "Jetzt abgleichen", lambda: self._perform_action({"action": "sync"}, "Abgleich angefragt – warte auf das Handy …", "Handystand neu empfangen."), True),
            ("pair", "Mit Handy koppeln", lambda: self._perform_action({"action": "pair"}, "Kopplungs-QR wird vorbereitet …", "QR-Code bereit. Scanne ihn mit Anker am Handy."), False),
            ("savepoint", "Speicherpunkt setzen", lambda: self._form("savepoint"), False),
            ("thought", "Gedanke notieren", lambda: self._form("thought"), False),
            ("extend", "+15 Minuten", lambda: self._extend(15), False),
            ("extend-until", "Bis zu einer Uhrzeit …", self._extend_form, False),
            ("pause", "Heute ohne PC-Stopp", self._pause, False),
            ("test", "Abendablauf testen", lambda: self._perform_action({"action": "test"}, "Testabend wird vorbereitet …", "Testabend gestartet. Er löst keine PC-Sperre aus."), False),
            ("settings", "Einstellungen", self._settings, False),
            ("quit", "Beenden", self._request_quit, False),
        ]:
            button = self._button(actions, text, callback, primary=primary)
            button.pack(fill="x", padx=16, pady=4)
            self._action_buttons[key] = button
        self._label(actions, "Minimieren oder ×: Anker läuft weiter. Nur Beenden schließt den Begleiter.", muted=True).pack(fill="x", padx=20, pady=(12, 20))
        self.root.update_idletasks()
        if self.platform is not None and os.name == "nt":
            try:
                self.platform.attach_window(self._handle(self.root))
                desktop = self.snapshot.get("desktopPrefs", {})
                hotkeys = desktop.get("hotkeys") if isinstance(desktop, dict) else None
                if not self.platform.register_hotkeys(lambda: self._form("savepoint"), lambda: self._form("thought"), hotkeys=hotkeys):
                    self.status.set("Ein Tastenkürzel ist belegt. Speicherpunkt und Gedanke bleiben hier erreichbar.")
            except PlatformError:
                self.status.set("Windows-Ereignisse sind noch nicht verfügbar. Bitte Einrichtung prüfen.")
        self._start_tray()
        try: self._fit_main_window()
        except Exception: pass  # Keep the reachable default window on DPI-query failure.
        self.root.after(500, self._watch_monitor)
        self.root.after(100, self._drain)
        try:
            self.root.mainloop()
        finally:
            self._close_offer()
            self._close_time_pill()
            self._hide_overlays()
            if self.platform is not None:
                self.platform.detach_window()
            if self._tray is not None:
                try: self._tray.stop()
                except Exception: pass

    def _drain(self) -> None:
        closed = False
        while True:
            try:
                kind, value = self.queue.get_nowait()
            except Empty:
                break
            try:
                if kind == "render":
                    self._resolve_action_result(value.get("actionResult"))
                    self.snapshot = value
                    self._render()
                elif kind == "pair":
                    self._pair(value)
                elif kind == "pairing-offer":
                    self._show_pairing_offer(*value)
                elif kind == "close-pairing-offer":
                    if value == self._offer_identifier:
                        self._close_offer()
                elif kind == "note":
                    self._note(*value)
                elif kind == "form":
                    self._form(value)
                elif kind == "main":
                    self._show_main()
                elif kind == "tray-ready":
                    self._tray_ready = self._tray is not None and bool(self._tray.visible)
                    self._minimized_to_tray()
                elif kind == "tray-failed":
                    self._tray_failed()
                elif kind == "extend":
                    self._extend(int(value))
                elif kind == "action":
                    self._dispatch_action(value)
                elif kind == "settings":
                    self._settings()
                elif kind == "feedback" and isinstance(value, str):
                    self._set_feedback(value[:200])
                elif kind == "quit":
                    self._request_quit()
                elif kind == "close":
                    self._close_offer()
                    self.root.destroy()
                    closed = True
                    break
            except Exception:
                # A bad Tk/QR render must not stop future actions or leak its data.
                if kind == "pairing-offer" and isinstance(value, tuple) and len(value) == 3:
                    self._cancel_offer(value[2])
                elif kind == "pair" and isinstance(value, dict):
                    self._cancel_offer(value.get("id"))
                self._display_error = "Die Anzeige konnte noch nicht geöffnet werden. Bitte erneut versuchen."
                try:
                    self.status.set(self._display_error)
                except Exception:
                    pass
        if not closed:
            try:
                self.root.after(100, self._drain)
            except Exception:
                pass  # The window may already have been closed by the user.

    def _render(self) -> None:
        item = self.snapshot
        self._apply_theme()
        state = str(item.get("state", item.get("phase", "IDLE")))
        text = str(item.get("message") or item.get("title") or ("Gekoppelt" if item.get("paired") else "Noch nicht gekoppelt"))
        self.status.set(self._display_error or text[:500])
        grace = item.get("graceRemaining")
        saving = isinstance(grace, (int, float)) and not isinstance(grace, bool) and math.isfinite(grace)
        seconds = grace if saving else item.get("remainingSeconds")
        seconds = max(0, int(seconds)) if isinstance(seconds, (int, float)) and math.isfinite(seconds) else None
        self.remaining.set(f"Zum Speichern: {seconds // 60:02d}:{seconds % 60:02d}" if saving and seconds is not None
                           else f"Noch {math.ceil(seconds / 60)} Min" if seconds is not None and seconds > 0 else "")
        morning = item.get("morning")
        if isinstance(morning, dict) and self._morning_remaining is not None:
            remaining = morning.get("remainingSeconds")
            if type(remaining) in {int, float} and math.isfinite(remaining):
                self._morning_remaining.set(f"Noch {max(0, int(remaining)) // 60:02d}:{max(0, int(remaining)) % 60:02d}")
                target_time = self._format_instant(morning.get("targetAt"))
                if not saving and morning.get("kind") in {"leave", "work"} and target_time:
                    title = "Losgehen" if morning['kind'] == 'leave' else "Arbeitsbeginn"
                    self.remaining.set(f"{title} um {target_time} · {self._morning_remaining.get()}")
                    seconds = max(0, int(remaining))
        self._render_time_pill(item.get("timePill"))
        if self._remaining_label is not None:
            if self.remaining.get():
                self._remaining_label.pack(fill="x", padx=20, pady=4, before=self._feedback_label)
            else:
                self._remaining_label.pack_forget()
        opacity = item.get("dimOpacity", 0)
        if not isinstance(opacity, (int, float)) or not math.isfinite(opacity):
            opacity = 0
        if item.get("prefs", {}).get("dimEnabled", False) and state in {"EVENING_WIND_DOWN", "WIND_DOWN_T30", "BRAIN_DUMP_T10", "BEDTIME_HARD_CUT"}:
            self._show_overlays(max(0.0, min(0.4, float(opacity))))
        else:
            self._hide_overlays()
        self._progress_bar(seconds if saving or state in {"EVENING_WIND_DOWN", "WIND_DOWN_T30", "BRAIN_DUMP_T10", "BEDTIME_HARD_CUT"} else None)
        card_key = item.get("cardId") or ((state, bool(item.get("testMode"))) if state in {"WIND_DOWN_T30", "BRAIN_DUMP_T10", "BEDTIME_HARD_CUT", "NIGHT_LOCK"} else None)
        if card_key and card_key != self._last_card:
            self._last_card = card_key
            previous_card = self._card
            if item.get("cardKind") == "morning" and isinstance(morning, dict):
                self._show_morning_card(morning)
            else:
                self._show_card(state, text, seconds)
            if item.get("localPrefs", {}).get("quietSignalEnabled") is True and not item.get("testMode"):
                if self._card is not None and self._card is not previous_card:
                    self._card.update_idletasks()
                    if self._card.winfo_ismapped(): self._quiet_signal()
            if not item.get("testMode") and state in {"WIND_DOWN_T30", "BRAIN_DUMP_T10", "BEDTIME_HARD_CUT", "NIGHT_LOCK"}:
                self._notify_reminder("Dein Abendübergang steht an. Öffne Anker für den aktuellen PC-Stopp.")
        elif card_key is None:
            self._last_card = None
            if self._card is not None:
                self._close_card()
        if item.get("pairing"):
            self._pair(item["pairing"])
        if self._tray is not None:
            try:
                self._tray.title = ("Anker · " + text)[:120]
                bucket = min(12, max(0, math.ceil((seconds or 0) / 300)))
                self._tray.icon = self._tray_images[bucket]
                self._tray.update_menu()
            except Exception:
                self._tray_failed()

    def _show_pairing_offer(self, qr: str, expires_at: float, identifier: str) -> None:
        if (not isinstance(qr, str) or not qr.startswith("anker-pc-pair:v3:") or len(qr) > 8192
                or not isinstance(identifier, str) or not identifier or len(identifier) > 128
                or isinstance(expires_at, bool) or not isinstance(expires_at, (int, float))
                or not math.isfinite(expires_at) or expires_at <= self.clock()):
            raise ValueError("Invalid pairing display event")
        self._close_offer()
        self._offer_identifier = identifier
        self._offer_expires_at = expires_at
        import qrcode
        from PIL import ImageTk
        code = qrcode.QRCode(box_size=1, border=4)
        code.add_data(qr)
        code.make(fit=True)
        modules = len(code.get_matrix())
        available = max(160, min(640, self.root.winfo_screenwidth() - 64, self.root.winfo_screenheight() - 260))
        code.box_size = max(1, min(6, available // modules))
        image = code.make_image(fill_color="black", back_color="white").get_image()
        self._offer_window = self.tk.Toplevel(self.root)
        self._offer_window.title("Mit Handy koppeln")
        self._offer_window.configure(bg=self.BG)
        self._offer_window.geometry(f"{max(360, image.width + 48)}x{image.height + 190}")
        self._label(self._offer_window, "Am Handy: Mehr → Abend & Alltag → PC-Stopp → PC erstmals koppeln → Kopplungs-QR am PC scannen", size=12).pack(fill="x", padx=16, pady=12)
        self._qr = self._label(self._offer_window)
        self._qr.pack(padx=16, pady=6)
        self._qr_image = ImageTk.PhotoImage(image, master=self._offer_window)
        self._qr.configure(image=self._qr_image, text="")
        cancel = lambda: self._cancel_offer(identifier)
        self._button(self._offer_window, "Schließen", cancel).pack(fill="x", padx=16, pady=12)
        self._offer_window.protocol("WM_DELETE_WINDOW", cancel)
        self._offer_window.bind("<Escape>", lambda _event: cancel())
        self._offer_window.lift()
        self._check_offer_expiry(identifier)

    def _check_offer_expiry(self, identifier: str) -> None:
        if identifier != self._offer_identifier:
            return
        self._offer_timer = None
        if self._offer_expires_at is None or self.clock() >= self._offer_expires_at:
            self._cancel_offer(identifier)
            self._display_error = "Der Kopplungs-QR ist abgelaufen. Wähle erneut Mit Handy koppeln."
            self.status.set(self._display_error)
            self._set_feedback(self._display_error)
        else:
            self._offer_timer = self.root.after(1000, lambda: self._check_offer_expiry(identifier))

    def _cancel_offer(self, identifier: str | None) -> None:
        if identifier is None or identifier != self._offer_identifier:
            return
        self._close_offer()
        self._emit({"action": "reject_pair", "id": identifier})
        self._set_feedback("Kopplung abgebrochen. Du kannst einen neuen QR-Code öffnen.")

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
        grace = self.snapshot.get("graceRemaining")
        saving = isinstance(grace, (int, float)) and not isinstance(grace, bool) and math.isfinite(grace)
        total = max(60, int(self.snapshot.get("prefs", {}).get("graceSeconds", 60))) if saving else 1800
        self._bar_canvas.create_rectangle(0, 34, width * min(1, seconds / total), 42, fill=self.ACCENT, outline="")
        caption = f"Anker · Speichern {seconds // 60:02d}:{seconds % 60:02d}" if saving else f"Anker · noch {math.ceil(seconds/60)} Min"
        self._bar_canvas.create_text(width / 2, 17, text=caption, fill=self.FG, font=("Segoe UI", 12))

    @staticmethod
    def _format_instant(value: object, *, date: bool = False) -> str | None:
        if not isinstance(value, str) or len(value) > 40: return None
        try:
            moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if moment.tzinfo is None: return None
            return moment.astimezone(ZoneInfo("Europe/Berlin")).strftime("%d.%m. %H:%M" if date else "%H:%M")
        except (ValueError, OverflowError): return None

    def _close_card(self) -> None:
        card, self._card = self._card, None
        if card is not None:
            try: card.destroy()
            except Exception: pass

    def _close_time_pill(self) -> None:
        window, self._time_pill = self._time_pill, None
        self._time_pill_text = None
        if window is not None:
            try: window.destroy()
            except Exception: pass

    def _render_time_pill(self, value: object) -> None:
        if (self.snapshot.get("localPrefs", {}).get("timePillEnabled") is not True
                or not isinstance(value, dict) or type(value.get("remainingSeconds")) not in {int, float}
                or not math.isfinite(value["remainingSeconds"]) or not 0 <= value["remainingSeconds"] <= 3600
                or self._format_instant(value.get("targetAt")) is None):
            self._close_time_pill()
            return
        if self._time_pill is None:
            self._time_pill = self.tk.Toplevel(self.root)
            self._time_pill.overrideredirect(True)
            self._time_pill.attributes("-topmost", True)
            self._time_pill.configure(bg=self.SURFACE)
            self._time_pill_text = self.tk.StringVar(value="")
            label = self._label(self._time_pill, variable=self._time_pill_text, size=11)
            label.pack(fill="both", expand=True, padx=10, pady=8)
            label.bind("<Button-1>", lambda _event: self._show_main())
            self._time_pill.bind("<Button-1>", lambda _event: self._show_main())
        minutes = math.ceil(value["remainingSeconds"] / 60)
        self._time_pill_text.set(f"PC-Stopp in {minutes} Min · {self._format_instant(value['targetAt'])}")
        area, scale = self._monitor_metrics()
        width, height = min(round(280 * scale), max(160, area[2] - area[0] - 24)), round(50 * scale)
        x, y = area[2] - width - 12, area[1] + (54 if self._bar is not None else 12)
        self._time_pill.geometry(f"{width}x{height}{x:+}{y:+}")
        self._time_pill.update_idletasks()
        self._style_window(self._time_pill, transparent=False, rectangle=(x, y, x + width, y + height))

    def _quiet_signal(self) -> None:
        try:
            result = self.platform.quiet_reminder_sound() if self.platform is not None else {'status': 'unavailable'}
            status = result.get('status') if isinstance(result, dict) else 'unavailable'
        except Exception: status = 'unavailable'
        if status == 'suppressed':
            self._set_feedback("Windows hält den kurzen Signalton gerade zurück. Die Anker-Karte bleibt sichtbar.")
        elif status != 'requested':
            self._set_feedback("Der kurze Signalton war nicht verfügbar. Die sichtbare Karte bleibt erreichbar.")

    def _show_morning_card(self, morning: dict) -> None:
        if morning.get('kind') not in {'leave', 'work'} or self._format_instant(morning.get('targetAt')) is None:
            return
        self._close_card()
        self._card = self.tk.Toplevel(self.root)
        self._card.title("Anker · Morgen")
        self._card.configure(bg=self.BG)
        self._card.attributes("-topmost", True)
        self._card.geometry("420x300"); self._card.minsize(320, 240)
        body = self._scroll_body(self._card)
        title = "Losgehen" if morning.get("kind") == "leave" else "Arbeitsbeginn"
        self._label(body, title, size=22).pack(fill="x", padx=16, pady=(16, 8))
        target = self._format_instant(morning.get("targetAt"))
        self._label(body, f"Geplant um {target}" if target else "Dein geplanter Morgen", muted=True).pack(fill="x", padx=16, pady=6)
        self._label(body, variable=self._morning_remaining, size=24).pack(fill="x", padx=16, pady=8)
        self._button(body, "Anker am PC öffnen", self._show_main, primary=True).pack(fill="x", padx=16, pady=4)
        self._button(body, "Schließen", self._close_card).pack(fill="x", padx=16, pady=4)
        self._card.protocol("WM_DELETE_WINDOW", self._close_card)
        self._card.bind("<Escape>", lambda _event: self._close_card())

    def _show_card(self, state: str, message: str, seconds: int | None) -> None:
        self._close_card()
        self._card = self.tk.Toplevel(self.root)
        self._card.title("Anker")
        self._card.configure(bg=self.BG)
        self._card.attributes("-topmost", True)
        self._card.geometry("440x410")
        self._card.minsize(340, 260)
        self._card.bind("<Escape>", lambda _event: self._close_card())
        self._card.protocol("WM_DELETE_WINDOW", self._close_card)
        body = self._scroll_body(self._card)
        title = str(self.snapshot.get("title") or {"WIND_DOWN_T30": "Zeit für deinen Übergang", "BRAIN_DUMP_T10": "Gedanken für morgen parken", "BEDTIME_HARD_CUT": "Jetzt in Ruhe speichern", "NIGHT_LOCK": "PC-Ruhe"}.get(state, "Zeit für deinen Übergang"))
        if self.snapshot.get("testMode"):
            title = "Testabend · " + title
        self._label(body, title, size=18).pack(fill="x", padx=16, pady=(16, 6))
        self._label(body, message[:500]).pack(fill="x", padx=16, pady=6)
        self._label(body, variable=self.remaining, size=20).pack(fill="x", padx=16, pady=6)
        sentence = self.snapshot.get("ifThen")
        if isinstance(sentence, str) and sentence.strip():
            self._label(body, sentence[:500], muted=True).pack(fill="x", padx=16, pady=6)
        buttons = self.tk.Frame(body, bg=self.BG); buttons.pack(fill="x", padx=16, pady=10)
        actions = [("Speicherpunkt", lambda: self._form("savepoint"))]
        if self._strict():
            actions += [("Verlängern am Handy", lambda: self._extend(15)), ("Beenden", self._request_quit)]
        else:
            actions += [("+15 Min", lambda: self._extend(15)), ("Bis …", self._extend_form), ("Heute ohne", self._pause)]
        for label, callback in actions:
            self._button(buttons, label, callback).pack(fill="x", pady=3)
        self._card.update_idletasks()
        self._style_window(self._card, transparent=False)

    def _extend_form(self) -> None:
        if self._strict():
            self._extend(15)
            return
        window = self.tk.Toplevel(self.root)
        window.title("Bis zu einer Uhrzeit …"); window.configure(bg=self.BG)
        window.geometry("440x300")
        body = self._scroll_body(window)
        self._label(body, "Bis wann möchtest du den PC nutzen?", size=18).pack(fill="x", padx=16, pady=(16, 8))
        self._label(body, "Uhrzeit direkt eingeben, zum Beispiel 23:30. Vor der Übernahme siehst du die tatsächlichen Zeiten.", muted=True).pack(fill="x", padx=16, pady=6)
        entry = self.tk.Entry(body, font=(self.FONT, 16), bg=self.SURFACE, fg=self.FG, insertbackground=self.FG)
        entry.pack(fill="x", padx=16, pady=8, ipady=8)
        feedback = self._label(body, muted=True); feedback.pack(fill="x", padx=16, pady=6)
        pending_id = None
        waiting = False

        def enable(text):
            nonlocal waiting, pending_id
            waiting = False; pending_id = None
            if window.winfo_exists():
                entry.configure(state="normal"); button.configure(state="normal"); feedback.configure(text=text)

        def finished(ok):
            if not window.winfo_exists(): return
            if ok:
                self._set_feedback("Die gewünschte PC-Zeit wurde übernommen. Der aktuelle Plan zeigt die bestätigten Zeiten.")
                window.destroy()
            else:
                enable("Noch nicht übernommen. Prüfe die Uhrzeit und erstelle eine neue Vorschau.")

        def submit(_event=None):
            nonlocal waiting, pending_id
            if waiting: return
            local_time = entry.get().strip()
            if re.fullmatch(r"(?:[01][0-9]|2[0-3]):[0-5][0-9]", local_time) is None:
                feedback.configure(text="Bitte eine Uhrzeit als HH:mm eingeben, zum Beispiel 23:30.")
                return
            if self._strict():
                feedback.configure(text="Der strenge Modus ist aktiv. Bestätige eine Verlängerung am Handy mit deinem QR-Code.")
                return
            waiting = True
            entry.configure(state="disabled"); button.configure(state="disabled")
            feedback.configure(text="Vorschau wird geprüft …")
            self._last_extension_preview = {}

            def previewed(ok):
                nonlocal pending_id
                if not window.winfo_exists(): return
                preview = self._last_extension_preview
                target = self._format_instant(preview.get("pcStopAt"), date=True)
                if not ok or target is None:
                    enable("Diese Uhrzeit ist noch nicht möglich. Prüfe deinen Abendplan und versuche es erneut.")
                    return
                lines = ["PC-Stopp: " + target]
                for name, label in [("bedAt", "Bettzeit"), ("wakeAt", "Weckzeit")]:
                    formatted = self._format_instant(preview.get(name), date=True)
                    if formatted: lines.append(label + ": " + formatted)
                opportunity = preview.get("sleepOpportunityMinutes")
                if type(opportunity) is int and 0 <= opportunity <= 1440:
                    lines.append(f"Geplante Schlafgelegenheit: {opportunity // 60} h {opportunity % 60:02d} min")
                if not self.messagebox.askokcancel("Diese Zeiten übernehmen?", "\n".join(lines), parent=window):
                    enable("Die Vorschau wurde nicht übernommen. Du kannst die Uhrzeit ändern.")
                    return
                if self._strict():
                    enable("Der strenge Modus ist inzwischen aktiv. Bitte am Handy per QR-Code bestätigen.")
                    return
                feedback.configure(text="Zeitänderung wird übernommen …")
                pending_id = self._submit({'action': 'extend-until', 'localTime': local_time,
                                           'expectedTargetAt': preview['pcStopAt']}, finished)
            pending_id = self._submit({'action': 'preview-extend-until', 'localTime': local_time}, previewed)

        def dismiss(_event=None):
            if pending_id is not None: self._pending_actions.pop(pending_id, None)
            window.destroy()
        button = self._button(body, "Vorschau ansehen", submit, primary=True)
        button.pack(fill="x", padx=16, pady=6)
        window.protocol("WM_DELETE_WINDOW", dismiss); window.bind("<Escape>", dismiss)
        window.bind("<Return>", submit); entry.focus_set()

    def _form(self, kind: str) -> None:
        window = self.tk.Toplevel(self.root)
        window.title("Speicherpunkt" if kind == "savepoint" else "Gedanke")
        window.configure(bg=self.BG); window.geometry("460x320")
        dialog = self._scroll_body(window)
        self._label(dialog, "Wo stehst du gerade?" if kind == "savepoint" else "Was möchtest du festhalten?", size=16).pack(fill="x", padx=16, pady=12)
        text = self.tk.Entry(dialog, font=(self.FONT, 12), bg=self.SURFACE, fg=self.FG, insertbackground=self.FG)
        text.pack(fill="x", padx=16, ipady=8)
        next_step = None
        if kind == "savepoint":
            self._label(dialog, "Nächster Schritt (optional)", muted=True).pack(fill="x", padx=16, pady=(12, 4))
            next_step = self.tk.Entry(dialog, font=(self.FONT, 12), bg=self.SURFACE, fg=self.FG, insertbackground=self.FG)
            next_step.pack(fill="x", padx=16, ipady=8)
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
        if not identifier or identifier != self._offer_identifier:
            return
        if self._offer_expires_at is None or self.clock() >= self._offer_expires_at:
            self._cancel_offer(identifier)
            return
        if identifier == getattr(self, "_last_pair", None):
            return
        if self._offer_window is not None:
            self._offer_window.destroy()
            self._offer_window = self._qr = self._qr_image = None
        dialog = self.tk.Toplevel(self.root)
        self._pair_window = dialog
        dialog.title("Handy koppeln"); dialog.configure(bg=self.BG)
        self._label(dialog, "Stimmt dieser Code auf deinem Handy?", size=16).pack(padx=20, pady=12)
        self._label(dialog, str(pairing.get("code", ""))[:4], size=32).pack(padx=20, pady=8)
        self._label(dialog, str(pairing.get("n", "Handy"))[:100], muted=True).pack(padx=20)
        def answer(approved: bool):
            if identifier != self._offer_identifier:
                return
            if self._offer_expires_at is None or self.clock() >= self._offer_expires_at:
                self._cancel_offer(identifier)
                return
            self._close_offer()
            self._perform_action({"action": "confirm_pair" if approved else "reject_pair", "id": identifier},
                                 "Kopplungsantwort wird übernommen …", "Kopplung bestätigt." if approved else "Kopplung abgebrochen.")
        self._button(dialog, "Ja, koppeln", lambda: answer(True), primary=True).pack(fill="x", padx=20, pady=8)
        self._button(dialog, "Abbrechen", lambda: answer(False)).pack(fill="x", padx=20, pady=(0, 16))
        dialog.protocol("WM_DELETE_WINDOW", lambda: answer(False))
        dialog.bind("<Escape>", lambda _event: answer(False))
        self._last_pair = identifier

    def _note(self, title: str, text: str) -> None:
        if self.root is None:
            self.show_note(title, text); return
        dialog = self.tk.Toplevel(self.root); dialog.title(title[:120]); dialog.configure(bg=self.BG)
        self._label(dialog, title[:120], size=18).pack(fill="x", padx=20, pady=12)
        body = self.tk.Text(dialog, height=10, width=40, wrap="word", bg=self.SURFACE, fg=self.FG, font=(self.FONT, 12))
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
                            ("dimEnabled", "Bildschirmdämmerung – Signal zum Übergang"), ("audioDuck", "Ton im Übergang langsam reduzieren"),
                            ("timePillEnabled", "Kleine Zeitpille in der letzten Stunde"),
                            ("quietSignalEnabled", "Kurzer zurückhaltender Ton bei neuen Hinweiskarten")]:
            values[name] = self.tk.BooleanVar(value=bool(prefs.get(name, False)))
            control = self.tk.Checkbutton(dialog, text=title, variable=values[name], bg=self.BG, fg=self.FG,
                                          selectcolor=self.SURFACE, activebackground=self.BG, activeforeground=self.FG,
                                          font=("Segoe UI", 11), wraplength=380, anchor="w", justify="left")
            control.pack(fill="x", padx=16, pady=7); controls.append(control)
        self._label(dialog, "Eine Freigabe startet allein noch keine Sperre. Ein gültiger Auftrag vom gekoppelten Handy bleibt erforderlich.", muted=True).pack(fill="x", padx=16, pady=10)
        self._label(dialog, "Windows kann Benachrichtigungen bei Nicht stören, Konzentrationshilfe oder Vollbild ausblenden. Die Anker-Karte bleibt der sichtbare Weg; diese Windows-Auswahl wird nicht automatisch geändert.", muted=True).pack(fill="x", padx=16, pady=6)
        stop_action = self.tk.StringVar(value=str(prefs.get("stopAction", "lock")))
        action_row = self.tk.Frame(dialog, bg=self.BG); action_row.pack(fill="x", padx=16)
        for code, label in [("lock", "Sperren"), ("hibernate", "Ruhezustand"), ("shutdown", "Herunterfahren")]:
            control = self.tk.Radiobutton(action_row, text=label, value=code, variable=stop_action, bg=self.BG, fg=self.FG,
                                          selectcolor=self.SURFACE, activebackground=self.BG, activeforeground=self.FG)
            control.pack(side="left"); controls.append(control)
        self._label(dialog, "Speicher-Countdown (mindestens 60 Sekunden)", muted=True).pack(fill="x", padx=16, pady=(8, 0))
        grace = self.tk.StringVar(value=str(prefs.get("graceSeconds", 60)))
        control = self.tk.Spinbox(dialog, from_=60, to=600, increment=30, textvariable=grace,
                                  bg=self.SURFACE, fg=self.FG, buttonbackground=self.SURFACE, insertbackground=self.FG)
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
        self._button(dialog, "Darstellung, PC-Name & Tastenkürzel", self._desktop_settings).pack(fill="x", padx=16, pady=6)
        self._button(dialog, "Entkoppeln", lambda: self._perform_action({"action": "unpair"}, "Kopplung wird aufgehoben …", "Kopplung am PC aufgehoben.")).pack(fill="x", padx=16, pady=6)
        if self.snapshot.get("legacyConflict"):
            self._button(dialog, "Klassische Aufgabe entfernen", lambda: self._perform_action({"action": "remove_legacy"}, "Klassische Aufgabe wird entfernt …", "Klassische PC-Stopp-Aufgabe entfernt.")).pack(fill="x", padx=16, pady=6)

    def _desktop_settings(self) -> None:
        prefs = self.snapshot.get("desktopPrefs", {})
        if not isinstance(prefs, dict): prefs = {}
        window = self.tk.Toplevel(self.root)
        window.title("Darstellung & PC-Verwaltung"); window.configure(bg=self.BG)
        window.geometry("480x650"); window.minsize(340, 360)
        body = self._scroll_body(window)
        controls = []
        self._label(body, "Darstellung", size=18).pack(fill="x", padx=16, pady=(16, 8))
        theme = self.tk.StringVar(value=prefs.get("theme", "system"))
        for value, text in [("system", "Windows-Auswahl verwenden"), ("dark", "Dunkel"), ("light", "Hell")]:
            control = self.tk.Radiobutton(body, text=text, value=value, variable=theme, bg=self.BG, fg=self.FG,
                                          selectcolor=self.SURFACE, activebackground=self.BG, activeforeground=self.FG)
            control.pack(fill="x", padx=16, pady=4); controls.append(control)
        self._label(body, "Name dieses PCs", size=16).pack(fill="x", padx=16, pady=(16, 4))
        name = self.tk.StringVar(value=prefs.get("pcName", "Mein PC"))
        control = self.tk.Entry(body, textvariable=name, font=(self.FONT, 12), bg=self.SURFACE, fg=self.FG, insertbackground=self.FG)
        control.pack(fill="x", padx=16, pady=6, ipady=6); controls.append(control)
        self._label(body, "Der Name erscheint bei der lokalen Kopplung. Eine bestehende Kopplung bleibt erhalten.", muted=True).pack(fill="x", padx=16, pady=4)
        hotkeys = prefs.get("hotkeys", {})
        if not isinstance(hotkeys, dict): hotkeys = {}
        savepoint = self.tk.StringVar(value=hotkeys.get("savepoint", "CTRL+ALT+A"))
        thought = self.tk.StringVar(value=hotkeys.get("thought", "CTRL+ALT+G"))
        for title, variable in [("Tastenkürzel für den Speicherpunkt", savepoint), ("Tastenkürzel für einen Gedanken", thought)]:
            self._label(body, title).pack(fill="x", padx=16, pady=(12, 4))
            control = self.tk.Entry(body, textvariable=variable, font=(self.FONT, 12), bg=self.SURFACE, fg=self.FG, insertbackground=self.FG)
            control.pack(fill="x", padx=16, pady=4, ipady=6); controls.append(control)
        self._label(body, "Zum Beispiel CTRL+ALT+A oder CTRL+SHIFT+F8. Belegte Kombinationen werden nicht still übernommen.", muted=True).pack(fill="x", padx=16, pady=6)
        feedback = self._label(body, muted=True); feedback.pack(fill="x", padx=16, pady=8)
        token = None
        pending_id = None
        waiting = False

        def rollback():
            nonlocal token
            restored = True
            if token is not None:
                try: restored = self.platform.rollback_hotkeys(token) is True
                except Exception: restored = False
                token = None
            return restored

        def enable(text):
            nonlocal waiting, pending_id
            waiting = False; pending_id = None
            if window.winfo_exists():
                for widget in controls: widget.configure(state="normal")
                button.configure(state="normal"); delete.configure(state="normal")
                feedback.configure(text=text)

        def completed(ok):
            nonlocal token
            if not window.winfo_exists():
                rollback(); return
            if not ok:
                restored = rollback()
                enable("Noch nicht bestätigt. Deine Eingaben bleiben erhalten; prüfe die Auswahl und versuche es erneut." if restored
                       else "Noch nicht bestätigt. Die Tastenkürzel konnten nicht vollständig wiederhergestellt werden. Starte den Begleiter neu; die Fenster-Tasten bleiben erreichbar.")
                return
            if token is not None:
                try:
                    if self.platform.commit_hotkeys(token) is not True: raise RuntimeError()
                    token = None
                except Exception:
                    rollback()
                    enable("Die Auswahl ist gespeichert, aber die neuen Tastenkürzel sind noch nicht aktiv. Starte den Begleiter neu; die Tasten im Anker-Fenster bleiben erreichbar.")
                    return
            self._set_feedback("Darstellung und PC-Einstellungen gespeichert.")
            window.destroy()

        def save():
            nonlocal token, waiting, pending_id
            if waiting: return
            selected_name = name.get().strip()
            selected_keys = {'savepoint': savepoint.get().strip().upper().replace(' ', ''),
                             'thought': thought.get().strip().upper().replace(' ', '')}
            if not selected_name or len(selected_name) > 100:
                feedback.configure(text="Bitte einen kurzen PC-Namen mit höchstens 100 Zeichen eingeben.")
                return
            if any(re.fullmatch(r"(?:(?:CTRL|ALT|SHIFT)\+)+(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4]))", key) is None for key in selected_keys.values()) or selected_keys['savepoint'] == selected_keys['thought']:
                feedback.configure(text="Bitte zwei verschiedene Tastenkürzel mit CTRL, ALT oder SHIFT und einer Taste wählen.")
                return
            if selected_keys != {'savepoint': hotkeys.get('savepoint', 'CTRL+ALT+A'), 'thought': hotkeys.get('thought', 'CTRL+ALT+G')}:
                try:
                    if self.platform is None: raise RuntimeError()
                    token = self.platform.prepare_hotkeys(selected_keys)
                except Exception:
                    feedback.configure(text="Diese Tastenkürzel konnten nicht reserviert werden. Deine bisherige Auswahl bleibt aktiv.")
                    return
            waiting = True
            for widget in controls: widget.configure(state="disabled")
            button.configure(state="disabled"); delete.configure(state="disabled")
            feedback.configure(text="PC-Einstellungen werden gespeichert …")
            pending_id = self._submit({'action': 'desktop-settings', 'prefs': {'pcName': selected_name,
                                      'hotkeys': selected_keys, 'theme': theme.get()}}, completed)
            request = pending_id
            def timeout():
                if request in self._pending_actions:
                    self._pending_actions.pop(request, None); completed(False)
            self.root.after(30_000, timeout)

        def delete_data():
            nonlocal waiting, pending_id
            if waiting: return
            if not self.messagebox.askokcancel("Alle lokalen Anker-PC-Daten löschen?", "Kopplung, PC-Einstellungen, lokale Notizen und technische Logs dieses Begleiters werden entfernt. Deine Handy-Daten bleiben erhalten. Danach beendet sich Anker und muss über Start.cmd neu gestartet und gekoppelt werden.", parent=window):
                return
            waiting = True
            button.configure(state="disabled"); delete.configure(state="disabled")
            feedback.configure(text="Lokale Begleiterdaten werden entfernt …")
            def deleted(ok):
                if ok:
                    self.messagebox.showinfo("Lokale Daten entfernt", "Anker beendet sich jetzt. Öffne anschließend Start.cmd, um den Begleiter neu einzurichten.", parent=window)
                    self._emit({'action': 'quit'}); self.close()
                else:
                    enable("Die Löschung ist noch nicht vollständig bestätigt. Die Begleitung bleibt deaktiviert; prüfe den Datenordner, bevor du erneut einrichtest.")
            pending_id = self._submit({'action': 'delete-data', 'userConfirmed': True}, deleted)

        def dismiss(_event=None):
            if waiting:
                feedback.configure(text="Die Änderung wird noch verarbeitet. Bitte warte auf die Rückmeldung.")
                return
            rollback(); window.destroy()
        button = self._button(body, "PC-Einstellungen speichern", save, primary=True)
        button.pack(fill="x", padx=16, pady=8)
        self._label(body, "Lokale Daten entfernen", size=16).pack(fill="x", padx=16, pady=(20, 4))
        delete = self._button(body, "Alle Anker-Daten auf diesem PC löschen", delete_data)
        delete.pack(fill="x", padx=16, pady=8)
        window.protocol("WM_DELETE_WINDOW", dismiss); window.bind("<Escape>", dismiss)

    def _close_offer(self) -> None:
        if self._offer_timer is not None:
            try:
                self.root.after_cancel(self._offer_timer)
            except Exception:
                pass
        self._offer_timer = None
        self._offer_identifier = self._offer_expires_at = None
        self._last_pair = None
        windows = [self._offer_window, self._pair_window]
        self._offer_window = self._pair_window = self._qr = self._qr_image = None
        for window in windows:
            if window is not None:
                try:
                    window.destroy()
                except Exception:
                    pass  # Cleanup must also work after an external window close.

    def _request_quit(self) -> None:
        if self.messagebox.askokcancel("Anker beenden?", "Dann läuft kein PC-Stopp durch diesen Begleiter.", parent=self.root):
            self._emit({"action": "quit"}); self.close()

    def _hide_or_close(self) -> None:
        if self._tray_available():
            self.root.withdraw()
        else:
            self.root.iconify()
            self._set_feedback("Anker läuft weiter und bleibt über die Windows-Taskleiste erreichbar.")

    def _tray_available(self) -> bool:
        try:
            return self._tray_ready and self._tray is not None and bool(self._tray.visible) and bool(getattr(self._tray, "_running", True))
        except Exception:
            return False

    def _on_unmap(self, event) -> None:
        if event.widget is self.root:
            try: self.root.after_idle(self._minimized_to_tray)
            except Exception: pass

    def _minimized_to_tray(self) -> None:
        try:
            if self.root.state() == "iconic" and self._tray_available():
                self.root.withdraw()
        except Exception:
            pass

    def _show_main(self) -> None:
        self.root.deiconify()
        try: self._fit_main_window()
        except Exception: pass
        self.root.lift()
        try: self.root.focus_force()
        except Exception: pass

    def _tray_failed(self) -> None:
        self._tray_ready = False
        self._set_feedback("Der Infobereich ist gerade nicht verfügbar. Anker bleibt über die Taskleiste erreichbar.")
        try:
            if self.root.state() == "withdrawn":
                self.root.deiconify()
                self.root.iconify()
        except Exception:
            pass

    def _notify_reminder(self, text: str) -> None:
        if self._tray_available():
            try: self._tray.notify(text, "Anker")
            except Exception: self._tray_failed()

    def _start_tray(self) -> None:
        if os.name != "nt": return
        try:
            import pystray
            from PIL import Image, ImageDraw
            from .tray import create_tray_icon
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
                pystray.MenuItem("Jetzt abgleichen", queue("action", {"action": "sync"})),
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
            self._tray = create_tray_icon(pystray.Icon, "Anker PC-Begleiter", self._tray_images[0], "Anker PC-Begleiter", menu,
                                          on_open=lambda: self.queue.put(("main", None)))
            def ready(icon):
                try:
                    icon.visible = True
                    self.queue.put(("tray-ready", None))
                except Exception:
                    self.queue.put(("tray-failed", None))
            self._tray.run_detached(setup=ready)
        except (ImportError, OSError, RuntimeError, AttributeError):
            self._tray = None
            self._tray_ready = False


TkDesktopUI = DesktopUI
