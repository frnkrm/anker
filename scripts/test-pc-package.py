"""Exercise the shipped source package and real PS functions with fake OS edges."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('pc_package', ROOT / 'scripts/package-pc-companion.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(); self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.source = self.root / 'source'; self.source.mkdir()
        for name in builder.FILES:
            target = self.source / name; target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / 'pc-companion' / name, target)
        self.commit = 'a' * 40

    def build(self, name='package.zip'):
        path = self.root / name
        return path, builder.package(self.source, path, self.commit)

    def test_reproducible_manifest_exact_source_bytes_and_private_file_exclusion(self):
        (self.source / 'companion.state').write_bytes(b'synthetic-private-state')
        (self.source / 'private.key').write_bytes(b'synthetic-private-key')
        (self.source / '.venv').mkdir(); (self.source / '.venv/fake.exe').write_bytes(b'not-shipped')
        first, meta = self.build(); second, _other = self.build('second.zip')
        self.assertEqual(first.read_bytes(), second.read_bytes())
        self.assertEqual(meta['sha256'], hashlib.sha256(first.read_bytes()).hexdigest())
        self.assertEqual(first.with_suffix('.zip.sha256').read_text(), meta['sha256'] + '  package.zip\n')
        with zipfile.ZipFile(first) as archive:
            self.assertEqual(archive.namelist(), sorted((*builder.FILES, 'package-manifest.json')))
            manifest = json.loads(archive.read('package-manifest.json'))
            self.assertEqual((manifest['version'], manifest['protocolVersion'], manifest['stateSchemaVersion'], manifest['sourceCommit']), ('0.1.0', 3, 1, self.commit))
            for entry in manifest['files']:
                content = archive.read(entry['path'])
                self.assertEqual(content, (self.source / entry['path']).read_bytes())
                self.assertEqual((entry['bytes'], entry['sha256']), (len(content), hashlib.sha256(content).hexdigest()))
            self.assertTrue(all(item.date_time == (1980, 1, 1, 0, 0, 0) for item in archive.infolist()))

    def test_missing_source_and_invalid_commit_fail_before_output(self):
        with self.assertRaises(ValueError):
            builder.package(self.source, self.root / 'bad.zip', 'HEAD')
        (self.source / 'Start.cmd').unlink()
        with self.assertRaises(ValueError):
            self.build()
        self.assertFalse((self.root / 'package.zip').exists())

    def test_linked_module_is_rejected(self):
        if os.name == 'nt':
            # Windows symlinks require privileges/developer mode, which this
            # user-level package deliberately never asks CI or users to enable.
            return
        target = self.source / 'anker_companion'
        target.rename(self.root / 'modules')
        target.symlink_to(self.root / 'modules', target_is_directory=True)
        with self.assertRaises(ValueError):
            self.build()

    def test_real_installer_functions_parse_and_preserve_data_with_fake_effects(self):
        path, _meta = self.build()
        extracted = self.root / 'unpacked'
        with zipfile.ZipFile(path) as archive:
            archive.extractall(extracted)
        if os.name == 'nt':
            # Test genuine Windows PowerShell 5.1 as well as the CI Python build.
            runner = str(Path(os.environ['SystemRoot']) / 'System32/WindowsPowerShell/v1.0/powershell.exe')
        else:
            runner = os.environ.get('ANKER_PWSH') or shutil.which('pwsh')
        self.assertTrue(runner, 'PowerShell is required for installer verification.')
        result = subprocess.run([runner, '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(ROOT / 'scripts/test-pc-install.ps1'), '-Source', str(extracted)], capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main(verbosity=2)
