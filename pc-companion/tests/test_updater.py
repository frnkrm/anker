"""Updater trust/ZIP/staging boundaries with synthetic RSA and no live installer."""
from __future__ import annotations

import base64
from contextlib import ExitStack
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import zipfile

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.x509.oid import NameOID

from anker_companion import updater as update


class UpdaterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Synthetic updater test only')])
        certificate = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(cls.key.public_key())
            .serial_number(123).not_valid_before(datetime(2020, 1, 1, tzinfo=timezone.utc))
            .not_valid_after(datetime(2040, 1, 1, tzinfo=timezone.utc)).sign(cls.key, hashes.SHA256()))
        cls.pem = certificate.public_bytes(serialization.Encoding.PEM)
        cls.pin = certificate.fingerprint(hashes.SHA256()).hex()

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.base = self.root / 'AnkerPcCompanion'
        self.now = datetime(2026, 11, 10, 1, tzinfo=timezone.utc).timestamp()
        self.stack = self.enterContext(ExitStack())
        self.stack.enter_context(patch.object(update, 'CERTIFICATE_PEM', self.pem))
        self.stack.enter_context(patch.object(update, 'CERTIFICATE_SHA256', self.pin))
        self.archive, self.manifest = self.package()
        self.channel = self.signed(self.manifest)
        self.calls = []
        self.manager = update.UpdateManager(self.base, '0.1.1', self.fetch, clock=lambda: self.now)

    def signed(self, manifest, *, domain=None):
        payload = update.signature_payload(manifest) if domain is None else domain + json.dumps(manifest, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()
        signature = self.key.sign(payload, padding.PKCS1v15(), hashes.SHA256())
        return json.dumps({'manifest': manifest, 'signature': base64.urlsafe_b64encode(signature).decode().rstrip('=')}).encode()

    def package(self, *, mutate=None, extras=(), symlink_name=None):
        contents = {name: b'synthetic source\n' for name in update.PAYLOAD_FILES}
        contents['anker_companion/__init__.py'] = b'__version__ = "0.1.2"\n'
        package = {'schemaVersion': 1, 'artifact': 'anker-pc-companion-source', 'version': '0.1.2',
            'protocolVersion': 3, 'stateSchemaVersion': 1, 'pythonMinimum': '3.11', 'sourceCommit': 'a' * 40,
            'files': [{'path': name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()} for name, raw in sorted(contents.items())]}
        if mutate:
            mutate(contents, package)
        contents['package-manifest.json'] = json.dumps(package).encode()
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name, raw in sorted(contents.items()):
                if name == symlink_name:
                    item = zipfile.ZipInfo('anker-' + 'b' * 40 + '/' + name)
                    item.create_system = 3; item.external_attr = (stat.S_IFLNK | 0o777) << 16
                    archive.writestr(item, raw)
                else:
                    archive.writestr('anker-' + 'b' * 40 + '/' + name, raw)
            for name, raw, mode in extras:
                item = zipfile.ZipInfo('anker-' + 'b' * 40 + '/' + name)
                item.create_system = 3; item.external_attr = mode << 16
                archive.writestr(item, raw)
        raw = buffer.getvalue()
        manifest = {'schemaVersion': 1, 'version': '0.1.2', 'protocolVersion': 3, 'stateSchemaVersion': 1,
            'sourceCommit': 'a' * 40, 'downloadCommit': 'b' * 40,
            'url': 'https://codeload.github.com/frnkrm/anker/zip/' + 'b' * 40,
            'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw),
            'createdAt': '2026-11-10T00:00:00Z', 'expiresAt': '2026-11-20T00:00:00Z'}
        return raw, manifest

    def fetch(self, url, limit):
        self.calls.append((url, limit))
        return self.channel if url == update.CHANNEL_URL else self.archive

    def stage(self):
        self.assertEqual(self.manager.check()['status'], 'available')
        result = self.manager.download()
        return result['stageId'], self.base / 'updates' / result['stageId']

    def assert_code(self, code, callable_, *args, **kwargs):
        with self.assertRaises(update.UpdateError) as error:
            callable_(*args, **kwargs)
        self.assertEqual(error.exception.code, code)
        self.assertEqual(str(error.exception), code)

    def test_default_auto_check_does_nothing_and_never_downloads(self):
        self.assertEqual(self.manager.check(automatic=True), {'status': 'disabled'})
        self.assertEqual(self.calls, [])
        self.assertFalse(self.base.exists())
        self.assertEqual(self.manager.check()['status'], 'available')
        self.assertEqual(self.calls, [(update.CHANNEL_URL, update.MAX_CHANNEL)])
        self.assertFalse(self.base.exists())

    def test_enabled_automatic_checks_are_bounded_and_do_not_install_or_download(self):
        self.assertEqual(self.manager.check(automatic=True, auto_checks_enabled=True)['status'], 'available')
        self.assertEqual(self.manager.check(automatic=True, auto_checks_enabled=True), {'status': 'not-due'})
        self.assertEqual(len(self.calls), 1)
        self.assertFalse(self.base.exists())

    def test_real_signature_and_domain_are_required_and_no_arbitrary_certificate_is_accepted(self):
        self.assertEqual(update.verify_channel(self.channel, '0.1.1', self.now), self.manifest)
        bad = json.loads(self.channel); bad['manifest']['version'] = '0.1.3'
        self.assert_code('signature-invalid', update.verify_channel, json.dumps(bad).encode(), '0.1.1', self.now)
        self.assert_code('signature-invalid', update.verify_channel, self.signed(self.manifest, domain=b'OTHER\x00'), '0.1.1', self.now)
        with patch.object(update, 'CERTIFICATE_SHA256', '0' * 64):
            self.assert_code('certificate-invalid', update.verify_channel, self.channel, '0.1.1', self.now)

    def test_expired_future_or_too_long_lived_channels_stop_before_download(self):
        for change, code in [({'expiresAt': '2026-11-10T01:00:00Z'}, 'expired'),
                             ({'createdAt': '2026-11-11T00:00:00Z'}, 'expired'),
                             ({'expiresAt': '2027-01-01T00:00:00Z'}, 'channel-invalid')]:
            with self.subTest(change=change):
                self.assert_code(code, update.verify_channel, self.signed({**self.manifest, **change}), '0.1.1', self.now)

    def test_equal_older_and_prerelease_versions_are_not_installable(self):
        for version in ['0.1.1', '0.1.0']:
            self.assert_code('not-newer', update.verify_channel, self.signed({**self.manifest, 'version': version}), '0.1.1', self.now)
        for version in ['0.1.3-rc.1', '00.1.2', '0.1.2\n', '999999999999999999999999.1.2']:
            self.assert_code('channel-invalid', update.verify_channel, self.signed({**self.manifest, 'version': version}), '0.1.1', self.now)

    def test_wrong_host_mutable_branch_redirect_port_and_protocol_are_rejected(self):
        for url in ['http://codeload.github.com/frnkrm/anker/zip/' + 'b' * 40,
                    'https://evil.invalid/download.zip', 'https://codeload.github.com:443/frnkrm/anker/zip/' + 'b' * 40,
                    'https://codeload.github.com/frnkrm/anker/zip/main', self.manifest['url'] + '?redirect=1']:
            self.assert_code('channel-invalid', update.verify_channel, self.signed({**self.manifest, 'url': url}), '0.1.1', self.now)
        for key, value in [('protocolVersion', 4), ('stateSchemaVersion', 2), ('schemaVersion', True), ('bytes', True)]:
            self.assert_code('channel-invalid', update.verify_channel, self.signed({**self.manifest, key: value}), '0.1.1', self.now)

    def test_oversize_duplicate_json_and_malformed_signed_input_are_bounded(self):
        self.assert_code('response-too-large', update.verify_channel, b' ' * (update.MAX_CHANNEL + 1), '0.1.1', self.now)
        for raw in [b'{"manifest":{},"manifest":{},"signature":"x"}', b'{"manifest":NaN}', b'\xff']:
            self.assert_code('channel-invalid', update.verify_channel, raw, '0.1.1', self.now)
        self.assert_code('channel-invalid', update.verify_channel,
            self.signed({**self.manifest, 'bytes': update.MAX_ARCHIVE + 1}), '0.1.1', self.now)

    def test_archive_hash_and_every_manifest_file_are_rechecked(self):
        contents = update.verify_archive(self.archive, self.manifest)
        self.assertEqual(set(contents), update.PAYLOAD_FILES | {'package-manifest.json'})
        self.assert_code('archive-invalid', update.verify_archive, self.archive + b'changed', self.manifest)
        for mutate in [lambda files, package: files.__setitem__('anker_companion/engine.py', b'changed'),
                       lambda files, package: package.__setitem__('sourceCommit', 'c' * 40),
                       lambda files, package: package.__setitem__('protocolVersion', 4),
                       lambda files, package: package['files'].__setitem__(0, dict(package['files'][1])),
                       lambda files, package: package['files'][0].__setitem__('path', {})]:
            raw, manifest = self.package(mutate=mutate)
            self.assert_code('package-invalid', update.verify_archive, raw, manifest)

    def test_zip_paths_symlinks_extra_executables_and_case_collisions_stop(self):
        for path, mode in [('../escape.ps1', 0o100644), ('/absolute', 0o100644),
                           ('anker_companion/../../escape', 0o100644), ('secret.env', 0o100644),
                           ('anker_companion/ENGINE.py', 0o100644), ('linked', stat.S_IFLNK | 0o777)]:
            with self.subTest(path=path):
                raw, manifest = self.package(extras=[(path, b'synthetic', mode)])
                self.assert_code('package-invalid', update.verify_archive, raw, manifest)
        # Correct name, content, size and manifest hash: only link metadata is bad.
        raw, manifest = self.package(symlink_name='anker_companion/engine.py')
        self.assert_code('package-invalid', update.verify_archive, raw, manifest)

    def test_expansion_file_and_archive_size_bounds_are_independent(self):
        with patch.object(update, 'MAX_FILE', 8):
            self.assert_code('package-invalid', update.verify_archive, self.archive, self.manifest)
        with patch.object(update, 'MAX_EXPANDED', 8):
            self.assert_code('package-invalid', update.verify_archive, self.archive, self.manifest)

    def test_download_requires_click_and_preserves_program_dpapi_and_private_configuration(self):
        self.assert_code('check-required', self.manager.download)
        self.base.mkdir(); (self.base / 'app').mkdir()
        private = {'companion.state': b'synthetic DPAPI ciphertext', 'private-config.json': b'synthetic private config',
                   'app/existing-program.py': b'existing installed source'}
        for name, raw in private.items(): (self.base / name).write_bytes(raw)
        stage_id, stage = self.stage()
        self.assertEqual(self.manager.verify_stage(stage_id)[0], self.manifest)
        self.assertTrue(stage.is_dir())
        for name, raw in private.items(): self.assertEqual((self.base / name).read_bytes(), raw)
        self.assertEqual(self.calls[-1], (self.manifest['url'], update.MAX_ARCHIVE))

    def test_mutated_stage_or_archive_cannot_reach_handoff(self):
        stage_id, stage = self.stage()
        (stage / 'package/anker_companion/engine.py').write_bytes(b'mutated')
        self.assert_code('stage-invalid', self.manager.verify_stage, stage_id)
        with patch.object(update.subprocess, 'Popen') as launch:
            self.assert_code('stage-invalid', self.manager.prepare_install, stage_id, confirmed=True)
            launch.assert_not_called()

    def test_stage_symlink_is_rejected_without_reading_or_deleting_outside_data(self):
        stage_id, stage = self.stage()
        outside = self.root / 'outside-private.txt'; outside.write_bytes(b'keep me')
        target = stage / 'package/anker_companion/engine.py'; target.unlink()
        symbolic = True
        try: target.symlink_to(outside)
        except OSError:
            symbolic = False
            os.link(outside, target)  # NTFS hardlinks do not need symlink privilege.
        self.assert_code('path-unsafe' if symbolic else 'stage-invalid', self.manager.verify_stage, stage_id)
        self.manager.dispose()
        if symbolic: self.assert_code('path-unsafe', self.manager.clear_staging)
        else: self.manager.clear_staging()
        self.assertEqual(outside.read_bytes(), b'keep me')

    def test_confirmation_is_separate_and_source_checkout_cannot_replace_installed_app(self):
        stage_id, _ = self.stage()
        self.assert_code('confirmation-required', self.manager.prepare_install, stage_id)
        with patch.object(update.subprocess, 'Popen') as launch:
            self.assert_code('handoff-unavailable', self.manager.prepare_install, stage_id, confirmed=True)
            launch.assert_not_called()

    def handoff_fixture(self, stage_id, *, valid=True):
        app = self.base / 'app'; (app / 'anker_companion').mkdir(parents=True)
        (app / 'update-helper.ps1').write_bytes(b'trusted installed helper')
        executable = app / '.venv/Scripts/pythonw.exe'; executable.parent.mkdir(parents=True); executable.write_bytes(b'fixture only')
        system = self.root / 'Windows'
        powershell = system / 'System32/WindowsPowerShell/v1.0/powershell.exe'
        powershell.parent.mkdir(parents=True); powershell.write_bytes(b'fixture only')
        child = SimpleNamespace(pid=123456, poll=lambda: None, wait=lambda timeout: 0)
        def launch(arguments, **kwargs):
            token = arguments[arguments.index('-HandoffToken') + 1]
            ready = self.base / 'updates' / ('handoff-' + token + '.json')
            ready.write_text(json.dumps({'status': 'ready', 'stageId': stage_id, 'processId': os.getpid(),
                'helperPid': child.pid, 'startFileTime': '123456789', 'token': token if valid else '0' * 32}))
            self.assertNotIn('SYNTHETIC_PRIVATE_KEY', kwargs['env'])
            self.assertEqual(arguments[arguments.index('-CurrentProcessId') + 1], str(os.getpid()))
            return child
        self.stack.enter_context(patch.object(update, '__file__', str(app / 'anker_companion/updater.py')))
        self.stack.enter_context(patch.object(update.sys, 'executable', str(executable)))
        self.stack.enter_context(patch.object(update, '_process_filetime', return_value=123456789))
        self.stack.enter_context(patch.dict(os.environ, {'SystemRoot': str(system), 'SYNTHETIC_PRIVATE_KEY': 'not inherited'}))
        mocked = self.stack.enter_context(patch.object(update.subprocess, 'Popen', side_effect=launch))
        return child, mocked

    def test_handoff_is_bound_to_stage_parent_start_nonce_and_helper_process(self):
        stage_id, _ = self.stage()
        _, launch = self.handoff_fixture(stage_id)
        self.assertEqual(self.manager.prepare_install(stage_id, confirmed=True),
                         {'status': 'handoff-ready', 'version': '0.1.2', 'stageId': stage_id})
        self.assertEqual(launch.call_count, 1)
        self.assert_code('busy', self.manager.prepare_install, stage_id, confirmed=True)
        self.manager.dispose(cancel_handoff=False)
        self.assert_code('busy', self.manager.clear_staging)

    def test_wrong_ready_nonce_never_authorizes_parent_shutdown(self):
        stage_id, _ = self.stage()
        self.handoff_fixture(stage_id, valid=False)
        self.assert_code('handoff-unavailable', self.manager.prepare_install, stage_id, confirmed=True)

    def test_existing_installed_hardlink_destination_blocks_before_helper_or_copy(self):
        stage_id, _ = self.stage()
        _, launch = self.handoff_fixture(stage_id)
        outside = self.root / 'outside-user-data'; outside.write_bytes(b'outside stays private')
        os.link(outside, self.base / 'app/README.md')
        self.assert_code('path-unsafe', self.manager.prepare_install, stage_id, confirmed=True)
        launch.assert_not_called()
        self.assertEqual(outside.read_bytes(), b'outside stays private')

    def test_existing_venv_link_is_not_followed_by_the_install_destination_check(self):
        stage_id, _ = self.stage()
        _, launch = self.handoff_fixture(stage_id)
        outside = self.root / 'outside-user-data'; outside.write_bytes(b'outside stays private')
        os.link(outside, self.base / 'app/.venv/Scripts/runtime-data.dll')
        self.assert_code('path-unsafe', self.manager.prepare_install, stage_id, confirmed=True)
        launch.assert_not_called()
        self.assertEqual(outside.read_bytes(), b'outside stays private')

    def test_dispose_cooperatively_cancels_own_helper_before_reset_cleanup(self):
        stage_id, _ = self.stage()
        child, _ = self.handoff_fixture(stage_id)
        self.manager.prepare_install(stage_id, confirmed=True)
        running = [True]
        child.poll = lambda: None if running[0] else 0
        def wait(timeout):
            self.assertEqual(timeout, 35)
            self.assertEqual(len(list((self.base / 'updates').glob('cancel-*.json'))), 1)
            running[0] = False
            return 0
        child.wait = wait
        self.manager.dispose()
        self.manager.clear_staging()
        self.assertFalse((self.base / 'updates').exists())
        self.assertTrue((self.base / 'app/update-helper.ps1').exists())

    def test_reset_requires_dispose_and_preflights_every_file_before_deleting(self):
        _, stage = self.stage()
        keep = self.base / 'companion.state'; keep.write_bytes(b'keep DPAPI')
        self.assert_code('busy', self.manager.clear_staging)
        unknown = self.base / 'updates/unknown-user-file'; unknown.write_bytes(b'keep unknown')
        self.manager.dispose()
        self.assert_code('path-unsafe', self.manager.clear_staging)
        self.assertTrue((stage / 'archive.zip').exists())
        unknown.unlink()
        self.manager.clear_staging()
        self.assertEqual(keep.read_bytes(), b'keep DPAPI')
        self.assertFalse((self.base / 'updates').exists())
        self.assert_code('updater-closed', self.manager.check)

    def test_dispose_waits_for_existing_operation_and_prevents_late_followup_writes(self):
        entered, release, disposed = threading.Event(), threading.Event(), threading.Event()
        def blocked(_url, _limit):
            entered.set(); self.assertTrue(release.wait(2)); return self.channel
        manager = update.UpdateManager(self.base, '0.1.1', blocked, lambda: self.now)
        worker = threading.Thread(target=manager.check)
        cleanup = threading.Thread(target=lambda: (manager.dispose(), disposed.set()))
        try:
            worker.start(); self.assertTrue(entered.wait(1)); cleanup.start()
            self.assertFalse(disposed.wait(.02))
            self.assert_code('busy', manager.download)
        finally:
            release.set(); worker.join(2); cleanup.join(2)
        self.assertTrue(disposed.is_set())
        self.assert_code('updater-closed', manager.download)
        self.assertFalse(self.base.exists())

    def test_network_uses_get_no_redirect_and_redacts_failures(self):
        data = b'bounded'
        class Response(io.BytesIO):
            status = 200
            headers = {'Content-Length': str(len(data))}
            def geturl(self): return update.CHANNEL_URL
        captured = []
        def open_(request, timeout):
            captured.append((request, timeout)); return Response(data)
        with patch.object(update.urllib.request, 'build_opener', return_value=SimpleNamespace(open=open_)) as opener:
            self.assertEqual(update._http_get(update.CHANNEL_URL, 64), data)
            self.assertIsInstance(opener.call_args.args[0], update._NoRedirect)
        self.assertEqual(captured[0][0].method, 'GET')
        self.assertNotIn('Authorization', captured[0][0].headers)
        self.assertIsNone(update._NoRedirect().redirect_request(None, None, 302, '', {}, 'https://evil.invalid'))
        with patch.object(update.urllib.request, 'build_opener', side_effect=RuntimeError('synthetic private remote body')):
            self.assert_code('network-unavailable', update._http_get, update.CHANNEL_URL, 64)
        self.assert_code('channel-invalid', update._http_get, 'https://evil.invalid', 64)

    def test_network_header_limit_and_incomplete_body_fail_without_further_requests(self):
        reads = []
        class Response(io.BytesIO):
            status = 200
            headers = {'Content-Length': '999999999'}
            def geturl(self): return update.CHANNEL_URL
            def read1(self, count): reads.append(count); return super().read1(count)
        with patch.object(update.urllib.request, 'build_opener', return_value=SimpleNamespace(open=lambda *_args, **_kwargs: Response(b'bad'))):
            self.assert_code('response-too-large', update._http_get, update.CHANNEL_URL, 64)
        self.assertEqual(reads, [])
        Response.headers = {'Content-Length': '4'}
        with patch.object(update.urllib.request, 'build_opener', return_value=SimpleNamespace(open=lambda *_args, **_kwargs: Response(b'bad'))):
            self.assert_code('network-unavailable', update._http_get, update.CHANNEL_URL, 64)


class ProductionTrustTests(unittest.TestCase):
    def test_embedded_certificate_is_exact_public_b4_and_contains_no_private_key(self):
        certificate = x509.load_pem_x509_certificate(update.CERTIFICATE_PEM)
        self.assertEqual(certificate.fingerprint(hashes.SHA256()).hex(), 'b47ffffebe137cf15129961de43a27e3ec811acffe4542b6324e11768995b13a')
        self.assertNotIn(b'PRIVATE KEY', update.CERTIFICATE_PEM)


def powershell():
    return os.environ.get('ANKER_TEST_PWSH') or shutil.which('pwsh') or shutil.which('powershell.exe')


@unittest.skipUnless(powershell(), 'PowerShell parser is unavailable on this test host.')
class HelperPowerShellTests(unittest.TestCase):
    def run_ps(self, script):
        with tempfile.TemporaryDirectory() as folder:
            wrapper = Path(folder) / 'test.ps1'; wrapper.write_text(script, encoding='utf-8')
            return subprocess.run([powershell(), '-NoProfile', '-File', str(wrapper)], capture_output=True, text=True, timeout=20)

    def test_real_parser_and_fixed_safe_execution_contract(self):
        helper = Path(__file__).resolve().parents[1] / 'update-helper.ps1'
        source = helper.read_text()
        result = self.run_ps("$e=$null;$t=$null;[Management.Automation.Language.Parser]::ParseFile('" + str(helper).replace("'", "''") + "',[ref]$t,[ref]$e)>$null;if($e.Count){exit 2};'parsed'")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('parsed', result.stdout)
        self.assertIn('-NoAutostart', source)
        self.assertIn('WaitForExit(100)', source)
        self.assertIn('Elapsed.TotalSeconds -lt 30', source)
        self.assertIn('-I -c $ankerVerifier', source)
        self.assertNotIn('Stop-Process', source)
        self.assertNotIn('Set-ExecutionPolicy', source)
        self.assertNotIn('RunAs', source)

    def test_real_process_identity_accepts_only_matching_pid_start_and_executable(self):
        helper = str(Path(__file__).resolve().parents[1] / 'update-helper.ps1').replace("'", "''")
        result = self.run_ps(". '" + helper + "'\n$p=[Diagnostics.Process]::GetProcessById($PID);$s=$p.StartTime.ToFileTimeUtc().ToString([Globalization.CultureInfo]::InvariantCulture);$x=$p.MainModule.FileName\n$q=Get-AnkerUpdateParent $PID $s $x;$q.Dispose()\ntry {Get-AnkerUpdateParent $PID '1' $x;exit 3} catch {}\n'identity-verified'")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('identity-verified', result.stdout)

    def test_actual_helper_target_preflight_rejects_hardlinks_before_any_write(self):
        helper = str(Path(__file__).resolve().parents[1] / 'update-helper.ps1').replace("'", "''")
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); app = root / 'app'; app.mkdir()
            outside = root / 'outside-user-data'; outside.write_bytes(b'original private data')
            os.link(outside, app / 'README.md')
            script = ". '" + helper + "'\ntry { Assert-AnkerUpdateTargets '" + str(app).replace("'", "''") + "'; exit 3 } catch { if($_.Exception.Message -cne 'path-unsafe'){exit 4} }\n'link-blocked'"
            result = self.run_ps(script)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn('link-blocked', result.stdout)
            self.assertEqual(outside.read_bytes(), b'original private data')

    def test_helper_order_and_fail_closed_recheck_with_controlled_fake_effects(self):
        helper = Path(__file__).resolve().parents[1] / 'update-helper.ps1'
        with tempfile.TemporaryDirectory() as folder:
            local = Path(folder)
            app = local / 'AnkerPcCompanion/app'; app.mkdir(parents=True)
            copied = app / 'update-helper.ps1'; copied.write_bytes(helper.read_bytes())
            executable = app / '.venv/Scripts/pythonw.exe'; executable.parent.mkdir(parents=True); executable.write_bytes(b'fake only')
            stage = local / 'AnkerPcCompanion/updates' / ('stage-' + 'a' * 32); stage.mkdir(parents=True)
            quote = lambda value: "'" + str(value).replace("'", "''") + "'"
            script = ". " + quote(copied) + "\n$env:LOCALAPPDATA=" + quote(local) + "\n$StageRoot=" + quote(stage) + "\n$CurrentProcessId=123;$CurrentStartFileTime='456';$CurrentExecutable=" + quote(executable) + "\n$HandoffToken='" + 'b' * 32 + "'\n" + """
$script:trace=[Collections.Generic.List[string]]::new()
function Test-AnkerUpdateWindows { return $true }
function Get-AnkerUpdateParent { $p=[pscustomobject]@{};$p|Add-Member ScriptMethod Dispose {};return $p }
function Assert-AnkerUpdateStage { $script:trace.Add('verify');return '0.1.2' }
function Wait-AnkerUpdateParent { $script:trace.Add('wait') }
function Invoke-AnkerUpdateInstall { $script:trace.Add('install');'ignored installer output' }
$ok=Start-AnkerUpdate
if($ok -isnot [bool] -or -not $ok -or ($script:trace -join ',') -cne 'verify,wait,verify,install'){exit 3}
$script:trace.Clear();$script:verifications=0
Remove-Item -LiteralPath (Join-Path (Split-Path $StageRoot -Parent) ('handoff-'+$HandoffToken+'.json'))
function Assert-AnkerUpdateStage { $script:trace.Add('verify');$script:verifications++;if($script:verifications -eq 2){throw 'stage-invalid'};return '0.1.2' }
$ok=Start-AnkerUpdate
if($ok -isnot [bool] -or $ok -or ($script:trace -join ',') -cne 'verify,wait,verify'){exit 4}
'controlled-handoff-verified'
"""
            wrapper = app / 'test-helper.ps1'; wrapper.write_text(script, encoding='utf-8')
            result = subprocess.run([powershell(), '-NoProfile', '-File', str(wrapper)], capture_output=True, text=True, timeout=20)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn('controlled-handoff-verified', result.stdout)


if __name__ == '__main__':
    unittest.main(verbosity=2)
