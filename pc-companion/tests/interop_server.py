"""Loopback-only synthetic server used by the Node interoperability check."""
import asyncio
import json
from pathlib import Path
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from aiohttp import web
from anker_companion.engine import CompanionEngine
from anker_companion.server import BridgeServer, PairingManager, tls_context
from anker_companion.storage import AtomicStateStore
from tests.helpers import Clock, FakePlatform, TestVault, state


async def main():
    with tempfile.TemporaryDirectory() as folder:
        clock = Clock()
        store = AtomicStateStore(Path(folder) / "fixture.state", TestVault())
        platform = FakePlatform()
        engine = CompanionEngine(store, platform, clock)
        context, pin, _ = tls_context(store, Path(folder))
        pairing = PairingManager(store, "Node fixture", pin, [], clock)
        server = BridgeServer(store, engine, pairing, clock=clock, allow_loopback=True)
        runner = web.AppRunner(server.app, access_log=None)
        await runner.setup()
        site = web.TCPSite(runner, "127.0.0.1", 0, ssl_context=context)
        await site.start()
        port = site._server.sockets[0].getsockname()[1]
        print(json.dumps({"port": port, "pin": pin, "certificate": store.read()["tls"]["cert"],
                          "qr": pairing.create()["data"], "state": state(clock), "now": clock()}), flush=True)
        try:
            while True:
                raw = await asyncio.to_thread(sys.stdin.readline)
                if not raw:
                    break
                command = json.loads(raw)
                if command["action"] == "approve":
                    pairing.approve(command["id"])
                elif command["action"] == "savepoint":
                    engine.save_note("Fixture save point", "Fixture next step")
                elif command["action"] == "stop":
                    print(json.dumps({"ok": True, "effects": platform.effects}), flush=True)
                    break
                print(json.dumps({"ok": True}), flush=True)
        finally:
            await runner.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
