"""Build a deterministic, allowlisted Windows source ZIP. No installed user state."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
MODULES = ("__init__", "__main__", "desktop_settings", "engine", "protocol", "server", "storage", "tray", "ui", "vault", "widgets", "windows")
FILES = tuple(sorted(("Einrichten.cmd", "Start.cmd", "install.ps1", "uninstall.ps1", "requirements.txt", "README.md", "PROTOCOL.md",
                      *(f"anker_companion/{name}.py" for name in MODULES))))


def package(source: Path, output: Path, commit: str, *, committed: bool = False) -> dict:
    if not re.fullmatch(r"[a-f0-9]{40}", commit):
        raise ValueError("A complete source commit is required.")
    source = source.resolve()
    if committed and source != (ROOT / 'pc-companion').resolve():
        raise ValueError("Committed packages must use the repository companion directory.")
    members = {}
    for name in FILES:
        path = source / name
        if not path.is_file() or path.is_symlink() or any(parent.is_symlink() for parent in path.parents if parent != source and source in parent.parents):
            raise ValueError("Missing or linked package source: " + name)
        # Git normalizes .cmd blobs to LF but checks them out as CRLF. Reading
        # the committed blobs gives identical ZIPs on both CI operating systems
        # and proves each public byte against sourceCommit, regardless of EOL.
        members[name] = subprocess.check_output(['git', 'show', f'{commit}:pc-companion/{name}'], cwd=ROOT) if committed else path.read_bytes()
    version = re.search(rb'__version__\s*=\s*["\'](\d+\.\d+\.\d+)["\']', members['anker_companion/__init__.py'])
    if not version:
        raise ValueError("Companion version is missing.")
    manifest = {"schemaVersion": 1, "artifact": "anker-pc-companion-source", "version": version[1].decode(),
                "protocolVersion": 3, "stateSchemaVersion": 1, "pythonMinimum": "3.11", "sourceCommit": commit,
                "files": [{"path": name, "bytes": len(value), "sha256": hashlib.sha256(value).hexdigest()} for name, value in members.items()]}
    members['package-manifest.json'] = (json.dumps(manifest, sort_keys=True, indent=2, ensure_ascii=False) + '\n').encode()
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, value in sorted(members.items()):
            entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            entry.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(entry, value, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix(output.suffix + '.sha256').write_text(f'{digest}  {output.name}\n', encoding='utf-8')
    return {"file": str(output), "sha256": digest, "bytes": output.stat().st_size, "version": manifest['version'], "files": len(members), "sourceCommit": commit}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, help='Controlled fixture source; normal packages read committed repository blobs.')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--source-commit')
    args = parser.parse_args()
    commit = args.source_commit or subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    print(json.dumps(package(args.source_dir or ROOT / 'pc-companion', args.output, commit, committed=args.source_dir is None)))


if __name__ == '__main__':
    main()
