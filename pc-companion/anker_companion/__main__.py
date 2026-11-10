"""Windows entry point; starts only after the user launches or installs the companion."""
from __future__ import annotations

import argparse
import asyncio
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import sys
import threading
import time

from aiohttp import web

from .engine import CompanionEngine
from .server import BridgeServer, Discovery, PairingManager, local_addresses, tls_context
from .storage import AtomicStateStore
from .desktop_settings import desktop_preferences


def configure_log(directory: Path) -> RotatingFileHandler:
    folder = directory / "logs"
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob("companion.log*"):
        if old.stat().st_mtime < time.time() - 14 * 86400:
            old.unlink(missing_ok=True)
    handler = RotatingFileHandler(folder / "companion.log", maxBytes=200_000, backupCount=4, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
    logging.getLogger("anker").addHandler(handler)
    logging.getLogger("anker").setLevel(logging.INFO)
    return handler
    # No HTTP access logs, raw exception text, device names, addresses or task text.


def main() -> int:
    parser = argparse.ArgumentParser(description="Anker PC-Begleiter")
    parser.add_argument("--port", type=int, default=47830)
    parser.add_argument("--name", default="Mein PC")
    parser.add_argument("--data-dir", type=Path)
    args = parser.parse_args()
    if sys.platform != "win32":
        parser.error("Der echte PC-Begleiter benötigt Windows. Plattformunabhängige Tests: python -m unittest discover -s tests.")
    if not 1024 <= args.port <= 65535 or not args.name.strip() or len(args.name) > 100:
        parser.error("Port oder PC-Name ist ungültig.")
    from .vault import DpapiVault
    from .windows import MasterAudioDucker, WindowsPlatform
    from .ui import DesktopUI
    import ctypes
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateMutexW.argtypes = [ctypes.c_void_p, ctypes.c_bool, ctypes.c_wchar_p]
    kernel.CreateMutexW.restype = ctypes.c_void_p
    ctypes.set_last_error(0)
    instance = kernel.CreateMutexW(None, False, "Local\\AnkerPcCompanion-v3")
    if not instance or ctypes.get_last_error() == 183:
        if instance:
            kernel.CloseHandle(ctypes.c_void_p(instance))
        return 0
    directory = args.data_dir or Path(os.environ["LOCALAPPDATA"]) / "AnkerPcCompanion"
    log_handler = configure_log(directory)
    handlers = {}
    platform = WindowsPlatform(on_system_event=lambda name: handlers["engine"].system_event(name) if "engine" in handlers else None)
    store = AtomicStateStore(directory / "companion.state", DpapiVault(), desktop_name=args.name)
    context, pin, _ = tls_context(store, directory)
    addresses = local_addresses()
    desktop = desktop_preferences(store.read())
    pairing = PairingManager(store, desktop["pcName"], pin, [f"{address}:{args.port}" if ":" not in address else f"[{address}]:{args.port}" for address in addresses])
    loop = asyncio.new_event_loop()
    stopped = threading.Event()
    server: BridgeServer

    def action(value: dict) -> None:
        if value.get("action") == "quit":
            stopped.set()
            loop.call_soon_threadsafe(lambda: None)
        else:
            loop.call_soon_threadsafe(server.ui_action, value)

    ui = DesktopUI(action, platform=platform)
    ui.snapshot["desktopPrefs"] = desktop
    audio = MasterAudioDucker()
    engine = CompanionEngine(store, platform, ui=ui, audio=audio)
    handlers["engine"] = engine
    def stop_for_reset() -> None:
        stopped.set()
        logger = logging.getLogger("anker")
        logger.removeHandler(log_handler)
        log_handler.flush(); log_handler.close()

    server = BridgeServer(store, engine, pairing, ui=ui, on_delete_data=stop_for_reset)

    async def run() -> None:
        runner = web.AppRunner(server.app, access_log=None)
        discovery = Discovery(args.port, addresses, pin)
        await runner.setup()
        try:
            await web.TCPSite(runner, "0.0.0.0", args.port, ssl_context=context).start()
            try:
                await asyncio.to_thread(discovery.start)
            except Exception:
                logging.getLogger("anker").warning("discovery-unavailable")
            logging.getLogger("anker").info("started protocol=3")
            for note in store.read()["notes"]:
                if not note.get("shown"):
                    ui.show_note("Für heute gemerkt", note["text"] + ("\n" + note["nextStep"] if note.get("nextStep") else ""))
            store.update(lambda data: [note.update(shown=True) for note in data["notes"]])
            while not stopped.is_set():
                try:
                    engine.tick()
                except Exception:
                    logging.getLogger("anker").warning("tick-not-completed")
                await asyncio.sleep(1)
        except Exception:
            logging.getLogger("anker").error("server-start-failed")
            ui.show_note("Verbindung noch nicht gestartet", "Port oder Firewall prüfen. Es wurde kein PC-Auftrag ausgeführt.")
        finally:
            audio.restore()
            await asyncio.to_thread(discovery.close)
            await runner.cleanup()
            logging.getLogger("anker").info("stopped")

    thread = threading.Thread(target=lambda: loop.run_until_complete(run()), daemon=True, name="AnkerLAN")
    thread.start()
    try:
        ui.run()
    finally:
        stopped.set()
        thread.join(timeout=5)
        audio.restore()
        kernel.CloseHandle(ctypes.c_void_p(instance))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
