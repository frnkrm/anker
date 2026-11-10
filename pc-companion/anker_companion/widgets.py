"""Small Tk controls and bounded window geometry; importing creates no GUI."""
from __future__ import annotations

import math
import os
from typing import Callable


def window_geometry(work_area: tuple[int, int, int, int], scale: float = 1.0,
                    current: tuple[int, int] | None = None) -> tuple[int, int, int, int, int, int]:
    """Keep the default window and its minimum inside the current work area."""
    if (len(work_area) != 4 or any(type(n) is not int for n in work_area)
            or work_area[2] <= work_area[0] or work_area[3] <= work_area[1]):
        raise ValueError("Invalid monitor work area")
    scale = scale if isinstance(scale, (int, float)) and not isinstance(scale, bool) and math.isfinite(scale) else 1.0
    scale = max(0.75, min(4.0, float(scale)))
    left, top, right, bottom = work_area
    margin = min(round(16 * scale), max(0, (right - left - 1) // 4), max(0, (bottom - top - 1) // 4))
    # Leave space for the native title bar/borders in addition to the client area.
    frame = min(round(40 * scale), max(0, (bottom - top) // 5))
    max_width, max_height = max(1, right - left - 2 * margin), max(1, bottom - top - 2 * margin - frame)
    width, height = min(round(520 * scale), max_width), min(round(720 * scale), max_height)
    minimum_width, minimum_height = min(round(340 * scale), width), min(round(390 * scale), height)
    x, y = current if current is not None else (left + (right - left - width) // 2, top + (bottom - top - height) // 2)
    x, y = max(left + margin, min(x, right - margin - width)), max(top + margin, min(y, bottom - margin - height))
    return width, height, x, y, minimum_width, minimum_height


_BUTTON_CLASSES: dict[type, type] = {}


def rounded_button(tk, parent, text: str, command: Callable, *, primary: bool = False,
                   scale: float = 1.0, background: str = "#101114"):
    """A focusable, wrapping Canvas button with the usual configure/invoke API."""
    base = tk.Canvas
    cls = _BUTTON_CLASSES.get(base)
    if cls is None:
        from tkinter import font as tkfont

        class RoundedButton(base):
            def __init__(self, parent, text, command, primary, scale, background):
                self._text = str(text)
                self._command = command
                self._primary = primary
                self._scale = scale
                self._enabled = True
                self._focused = self._hover = self._armed = False
                self._font = tkfont.Font(root=parent, family="Segoe UI" if os.name == "nt" else "Helvetica", size=-max(11, round(15 * scale)))
                super().__init__(parent, width=260, height=48, borderwidth=0, highlightthickness=0,
                                 background=background, takefocus=True, cursor="hand2")
                self.bind("<Configure>", lambda _event: self._draw())
                self.bind("<FocusIn>", lambda _event: self._focus(True))
                self.bind("<FocusOut>", lambda _event: self._focus(False))
                self.bind("<Enter>", lambda _event: self._enter(True))
                self.bind("<Leave>", lambda _event: self._enter(False))
                self.bind("<ButtonPress-1>", self._press)
                self.bind("<ButtonRelease-1>", self._release)
                self.bind("<Return>", lambda _event: self._keyboard())
                self.bind("<KP_Enter>", lambda _event: self._keyboard())
                self.bind("<space>", lambda _event: self._keyboard())
                self._draw()

            def _focus(self, value):
                self._focused = value
                self._draw()

            def _enter(self, value):
                self._hover = value
                if not value:
                    self._armed = False
                self._draw()

            def _press(self, _event):
                if self._enabled:
                    self.focus_set()
                    self._armed = True
                    self._draw()
                return "break"

            def _release(self, event):
                armed, self._armed = self._armed, False
                if armed and 0 <= event.x < self.winfo_width() and 0 <= event.y < self.winfo_height():
                    self.invoke()
                self._draw()
                return "break"

            def _keyboard(self):
                self.invoke()
                return "break"

            def invoke(self):
                if self._enabled and callable(self._command):
                    return self._command()
                return None

            def cget(self, key):
                if key == "text": return self._text
                if key == "command": return self._command
                if key == "state": return "normal" if self._enabled else "disabled"
                return super().cget(key)

            def configure(self, cnf=None, **options):
                if isinstance(cnf, dict): options = {**cnf, **options}
                if "text" in options: self._text = str(options.pop("text"))
                if "command" in options: self._command = options.pop("command")
                if "state" in options:
                    self._enabled = options.pop("state") != "disabled"
                    options.update(takefocus=self._enabled, cursor="hand2" if self._enabled else "arrow")
                    self._armed = False
                result = super().configure(**options)
                self._draw()
                return result

            config = configure

            def set_scale(self, scale):
                self._scale = max(0.75, min(4.0, float(scale)))
                self._font.configure(size=-max(11, round(15 * self._scale)))
                self._draw()

            def _draw(self):
                if not hasattr(self, "_w") or not self.winfo_exists(): return
                scale = self._scale
                width = max(1, self.winfo_width())
                if width <= 1: width = int(super().cget("width"))
                padding = max(8, round(14 * scale))
                self.delete("all")
                text_id = self.create_text(width / 2, padding, text=self._text, font=self._font,
                                           width=max(1, width - 2 * padding), anchor="n", justify="center")
                box = self.bbox(text_id)
                text_height = 0 if box is None else box[3] - box[1]
                height = max(round(46 * scale), text_height + 2 * padding)
                if int(super().cget("height")) != height: super().configure(height=height)
                color = ("#99e2cc" if self._hover or self._armed else "#83d6c1") if self._primary else ("#303642" if self._hover or self._armed else "#232832")
                foreground = "#101114" if self._primary else "#f1f3f5"
                if not self._enabled: color, foreground = "#20242c", "#858e9b"
                inset = max(2, round(2 * scale))
                radius = min(round(14 * scale), width / 4, height / 4)
                x0, y0, x1, y1 = inset, inset, max(inset, width - inset), max(inset, height - inset)
                polygon = self.create_polygon(
                    x0 + radius, y0, x1 - radius, y0, x1, y0, x1, y0 + radius,
                    x1, y1 - radius, x1, y1, x1 - radius, y1, x0 + radius, y1,
                    x0, y1, x0, y1 - radius, x0, y0 + radius, x0, y0,
                    smooth=True, splinesteps=24, fill=color,
                    outline="#b3f4df" if self._focused and self._enabled else color,
                    width=max(2, round(2 * scale)))
                self.tag_lower(polygon, text_id)
                self.itemconfigure(text_id, fill=foreground)
                self.coords(text_id, width / 2, (height - text_height) / 2)

        cls = RoundedButton
        _BUTTON_CLASSES[base] = cls
    return cls(parent, text, command, primary, scale, background)
