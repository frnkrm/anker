"""Offline boundary tests. All signing tools and credentials below are synthetic mocks."""
from pathlib import Path
import base64
import contextlib
import hashlib
import importlib.util
import io
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import textwrap
import time
import unittest
from unittest.mock import patch
import urllib.error
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
WORKFLOW = (ROOT / '.github/workflows/android-update.yml').read_text()
SPEC = importlib.util.spec_from_file_location('proof', ROOT / 'scripts/android-update-proof.py')
PROOF = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROOF)
SHA = 'a' * 40
IDENTITY = 'b' * 64
FAKE_CERT = b'SYNTHETIC PUBLIC CERTIFICATE; NOT A REAL SIGNING KEY'
FAKE_CERT_SHA = hashlib.sha256(FAKE_CERT).hexdigest()


def inline_python(step_name):
    section = WORKFLOW.split('      - name: ' + step_name + '\n', 1)[1].split('\n      - ', 1)[0]
    lines = section.split('        run: |\n', 1)[1].splitlines()
    lines = lines[:lines.index('          PY') + 1]
    body = '\n'.join(line[10:] for line in lines)
    assert body.startswith("python3 - <<'PY'\n") and body.endswith('\nPY')
    return body.removeprefix("python3 - <<'PY'\n").removesuffix('\nPY')


CI_CODE = inline_python('Exakten grünen CI-Commit auf main prüfen')
SIGN_CODE = inline_python('Daten prüfen und gegebenenfalls mit bestehendem Schlüssel signieren')


class ProofTests(unittest.TestCase):
    def test_source_version_must_match_checked_in_defaults(self):
        gradle = "versionCode((System.getenv('VERSION_CODE') ?: '11').toInteger())\nversionName(System.getenv('VERSION_NAME') ?: '1.3.0-rc.4')"
        self.assertEqual(PROOF.source_version({'version': '1.3.0-rc.4'}, gradle), ('1.3.0-rc.4', '11'))
        with self.assertRaises(ValueError):
            PROOF.source_version({'version': '1.3.0-rc.2'}, gradle)
        with self.assertRaises(ValueError):
            PROOF.source_version({'version': '1.3.0-rc.4'}, gradle.replace("'11'", "'0'"))

    def test_missing_apk_fields_rejected(self):
        with self.assertRaises(ValueError):
            PROOF.apk_metadata("package: name='de.frnkrm.anker.mobile'")

    def test_exact_ci_proof(self):
        value = {'headSha': SHA, 'headBranch': 'main', 'conclusion': 'success', 'event': 'push', 'workflow': 'ci.yml'}
        self.assertEqual(PROOF.ci_proof(value, SHA), value)
        for field, bad in [('headSha', 'c' * 40), ('headBranch', 'feature/test'), ('conclusion', 'failure'), ('event', 'pull_request'), ('workflow', 'other.yml')]:
            with self.subTest(field=field), self.assertRaises(ValueError):
                PROOF.ci_proof(dict(value, **{field: bad}), SHA)

    def test_fresh_native_results_required(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, 'TEST-example.xml')
            xml = '<testsuite name="ExampleTest" tests="3" failures="0" errors="0" skipped="0"/>'
            path.write_text(xml)
            started = time.time() - 1
            self.assertEqual(PROOF.native_results(directory, started)['totals']['tests'], 3)
            with self.assertRaises(ValueError):
                PROOF.native_results(directory, time.time() + 1)
            path.write_text(xml.replace('skipped="0"', 'skipped="1"'))
            with self.assertRaises(ValueError):
                PROOF.native_results(directory, started)

    def test_empty_native_results_rejected(self):
        with tempfile.TemporaryDirectory() as directory, self.assertRaises(ValueError):
            PROOF.native_results(directory, 0)

    def test_every_checked_in_native_test_class_needs_fresh_result(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'ExampleTest.kt').write_text('class ExampleTest')
            (root / 'TEST-example.xml').write_text('<testsuite name="de.frnkrm.ExampleTest" tests="3"/>')
            self.assertTrue(PROOF.native_results(root, 0, root)['freshRerun'])
            (root / 'MissingTest.kt').write_text('class MissingTest')
            with self.assertRaises(ValueError):
                PROOF.native_results(root, 0, root)

    def test_assets_and_native_alignment(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dist = root / 'dist'
            dist.mkdir()
            (dist / 'index.html').write_text('<meta name="viewport" content="viewport-fit=contain">')
            (dist / 'main.js').write_text('const fingerprint="' + IDENTITY + '";')
            elf = bytearray(120)
            elf[:6] = b'\x7fELF\x02\x01'
            struct.pack_into('<Q', elf, 32, 64)
            struct.pack_into('<HH', elf, 54, 56, 1)
            struct.pack_into('<IIQQQQQQ', elf, 64, 1, 0, 0, 0, 0, 120, 120, 16384)
            apk = root / 'unsigned.apk'
            def write_apk(*, altered=False, bad_alignment=False, extra=False):
                data = bytearray(elf)
                if bad_alignment:
                    struct.pack_into('<Q', data, 112, 4096)
                with zipfile.ZipFile(apk, 'w') as archive:
                    for file in dist.iterdir():
                        archive.writestr('assets/public/' + file.name, b'altered' if altered and file.name == 'main.js' else file.read_bytes())
                    archive.writestr('lib/arm64-v8a/example.so', data)
                    if extra:
                        archive.writestr('assets/public/unexpected.js', 'extra')
            write_apk()
            self.assertEqual(PROOF.apk_contents(apk, dist, IDENTITY)['count'], 2)
            for options in [{'altered': True}, {'bad_alignment': True}, {'extra': True}]:
                write_apk(**options)
                with self.subTest(options=options), self.assertRaises(ValueError):
                    PROOF.apk_contents(apk, dist, IDENTITY)


class CiGateTests(unittest.TestCase):
    def gate(self, *, sha=SHA, status='ahead', runs=None, branch='main', helper=True, manifest='valid'):
        with tempfile.TemporaryDirectory() as directory:
            run = {'head_sha': SHA, 'head_branch': branch, 'event': 'push', 'status': 'completed', 'conclusion': 'success', 'id': 42, 'html_url': 'https://github.com/example/repo/actions/runs/42'}
            approved = {'schemaVersion': 1, 'sourceCommit': SHA, 'sourceFingerprint': IDENTITY, 'versionName': '1.3.0-rc.4', 'versionCode': 11, 'ciRunURL': run['html_url'], 'publicCertificateSha256': 'b47ffffebe137cf15129961de43a27e3ec811acffe4542b6324e11768995b13a'} if manifest == 'valid' else manifest
            def response(request, **kwargs):
                url = request.full_url
                if '/contents/docs/AKTUELLER_UPDATESTAND.json?ref=main' in url:
                    if approved is None:
                        raise urllib.error.HTTPError(url, 404, 'Not Found', {}, None)
                    raw = json.dumps(approved).encode()
                    value = {'type': 'file', 'encoding': 'base64', 'size': len(raw), 'content': base64.b64encode(raw).decode()}
                elif '/compare/' in url:
                    value = {'status': status}
                elif '/actions/workflows/' in url:
                    value = {'workflow_runs': [run] if runs is None else runs}
                elif '/contents/scripts/android-update-proof.py?ref=' in url:
                    if not helper:
                        raise urllib.error.HTTPError(url, 404, 'Not Found', {}, None)
                    value = {'type': 'file'}
                else:
                    raise AssertionError('Unexpected GitHub API request: ' + url)
                return io.BytesIO(json.dumps(value).encode())
            env = {'ANKER_SOURCE_COMMIT': sha, 'GITHUB_REPOSITORY': 'example/repo', 'GH_TOKEN': 'FAKE-TOKEN', 'RUNNER_TEMP': directory, 'GITHUB_OUTPUT': str(Path(directory, 'output'))}
            with patch.dict(os.environ, env), patch('urllib.request.urlopen', side_effect=response), contextlib.redirect_stdout(io.StringIO()):
                exec(compile(CI_CODE, '<ci-gate>', 'exec'), {})
            return json.loads(Path(directory, 'anker-ci-proof.json').read_text())

    def test_exact_main_ancestor_green_commit_accepted(self):
        self.assertEqual(self.gate()['headSha'], SHA)

    def test_empty_input_selects_only_approved_manifest_commit(self):
        proof = self.gate(sha='')
        self.assertEqual(proof['headSha'], SHA)
        self.assertEqual(proof['approvedStand']['sourceFingerprint'], IDENTITY)

    def test_missing_manifest_fails_without_fallback(self):
        with self.assertRaisesRegex(SystemExit, 'Noch kein freigegebener'):
            self.gate(sha='', manifest=None)

    def test_bad_manifest_fields_fail_without_fallback(self):
        valid = self.gate(sha='')['approvedStand']
        for name, value in [('sourceCommit', 'main'), ('sourceFingerprint', 'bad'), ('versionCode', '11'), ('ciRunURL', 'https://evil.example/run'), ('publicCertificateSha256', 'f' * 64), ('schemaVersion', 2)]:
            with self.subTest(name=name), self.assertRaisesRegex(SystemExit, 'unvollständig oder ungültig'):
                self.gate(sha='', manifest=dict(valid, **{name: value}))

    def test_manifest_run_must_be_the_exact_successful_main_run(self):
        valid = self.gate(sha='')['approvedStand']
        with self.assertRaisesRegex(SystemExit, 'Keine erfolgreiche CI'):
            self.gate(sha='', manifest=dict(valid, ciRunURL='https://github.com/example/repo/actions/runs/99'))

    def test_docs_head_without_exact_ci_rejected(self):
        with self.assertRaises(SystemExit):
            self.gate(runs=[])

    def test_other_branch_commit_rejected(self):
        with self.assertRaises(SystemExit):
            self.gate(status='diverged')

    def test_same_commit_green_only_on_feature_branch_rejected(self):
        with self.assertRaises(SystemExit):
            self.gate(branch='feature/test')

    def test_old_commit_without_helper_fails_early_with_guidance(self):
        with self.assertRaisesRegex(SystemExit, 'ältere Commit'):
            self.gate(helper=False)

    def test_abbreviated_or_injected_ref_rejected(self):
        for value in ['main', 'abc123', SHA + '; echo bad']:
            with self.subTest(value=value), self.assertRaises(SystemExit):
                self.gate(sha=value)


class SigningTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        source = self.root / 'anker-input'
        source.mkdir()
        apk = source / 'unsigned.apk'
        apk.write_bytes(b'SYNTHETIC APK DATA; SDK TOOLS ARE MOCKED')
        self.proof = {'schemaVersion': 1, 'applicationId': 'de.frnkrm.anker.mobile', 'versionName': '1.3.0-rc.4', 'versionCode': '11', 'sourceCommit': SHA, 'sourceIdentity': IDENTITY, 'unsignedApkSha256': PROOF.sha256(apk), 'ci': {'headSha': SHA, 'headBranch': 'main', 'conclusion': 'success', 'event': 'push', 'workflow': 'ci.yml'}, 'nativeTests': {'freshRerun': True, 'totals': {'tests': 3, 'failures': 0, 'errors': 0, 'skipped': 0}}}
        self.trusted_ci = json.loads(json.dumps(self.proof['ci']))
        sdk = self.root / 'sdk/build-tools/35.0.0'
        sdk.mkdir(parents=True)
        mock = self.root / 'fake-tool'
        mock.write_text('#!/usr/bin/env python3\n' + textwrap.dedent('''\
            import hashlib, json, os, pathlib, shutil, sys
            name = pathlib.Path(sys.argv[0]).name
            with open(os.environ['FAKE_TOOL_LOG'], 'a') as log:
                log.write(json.dumps({'tool': name, 'argv': sys.argv[1:], 'environmentSecretNames': sorted(k for k in os.environ if k.startswith('ANKER_ANDROID_') or k.startswith('ANKER_SIGN_'))}) + '\\n')
            if name == 'aapt':
                print("package: name='de.frnkrm.anker.mobile' versionCode='11' versionName='1.3.0-rc.4' compileSdkVersion='36'")
                print("sdkVersion:'26'\\ntargetSdkVersion:'36'")
            elif name == 'keytool':
                sys.stdout.buffer.write(b'SYNTHETIC PUBLIC CERTIFICATE; NOT A REAL SIGNING KEY')
            elif name == 'apksigner':
                if sys.argv[1] == 'sign':
                    shutil.copyfile(sys.argv[-1], sys.argv[sys.argv.index('--out') + 1])
                elif pathlib.Path(sys.argv[-1]).name == 'unsigned.apk':
                    sys.exit(1)
                else:
                    print('Signer #1 certificate SHA-256 digest: ' + hashlib.sha256(b'SYNTHETIC PUBLIC CERTIFICATE; NOT A REAL SIGNING KEY').hexdigest())
            '''))
        mock.chmod(0o755)
        for name in ['aapt', 'apksigner', 'zipalign']:
            (sdk / name).symlink_to(mock)
        (self.root / 'keytool').symlink_to(mock)
        self.env = dict(os.environ, RUNNER_TEMP=str(self.root), ANDROID_HOME=str(self.root / 'sdk'), ANKER_SOURCE_COMMIT=SHA, ANKER_UNSIGNED_SHA256=PROOF.sha256(apk), PATH=str(self.root) + os.pathsep + os.environ['PATH'], GITHUB_STEP_SUMMARY=str(self.root / 'summary'), FAKE_TOOL_LOG=str(self.root / 'tools.jsonl'))
        for name in list(self.env):
            if name.startswith('ANKER_ANDROID_'):
                del self.env[name]

    def tearDown(self):
        self.temporary.cleanup()

    def execute(self, *, credentials=False, expected=FAKE_CERT_SHA, **extra):
        metadata = self.root / 'anker-input/build-proof.json'
        metadata.write_text(json.dumps(self.proof))
        self.env['ANKER_METADATA_SHA256'] = PROOF.sha256(metadata)
        self.env['ANKER_EXPECTED_CI_PROOF'] = json.dumps(self.trusted_ci)
        if credentials:
            self.env.update(ANKER_ANDROID_KEYSTORE_BASE64=base64.b64encode(b'FAKE-KEYSTORE-NOT-A-KEY').decode(), ANKER_ANDROID_STORE_PASSWORD='FAKE-STORE-PASSWORD', ANKER_ANDROID_KEY_ALIAS='FAKE-ALIAS', ANKER_ANDROID_KEY_PASSWORD='FAKE-KEY-PASSWORD')
        self.env.update(extra)
        code = re.sub(r"expected_cert = '[a-f0-9]{64}'", "expected_cert = '" + expected + "'", SIGN_CODE)
        return subprocess.run(['python3', '-c', code], env=self.env, text=True, capture_output=True)

    def tools(self):
        file = self.root / 'tools.jsonl'
        return [json.loads(line) for line in file.read_text().splitlines()] if file.exists() else []

    def test_no_secrets_produces_clearly_unsigned_artifact(self):
        result = self.execute()
        self.assertEqual(result.returncode, 0, result.stderr)
        receipt = json.loads((self.root / 'anker-update/build-proof.json').read_text())
        self.assertFalse(receipt['installableApk'])
        self.assertIn('UNSIGNIERT.apk', receipt['apkFile'])
        self.assertFalse(any(row['tool'] == 'keytool' for row in self.tools()))

    def test_partial_configuration_fails_closed(self):
        result = self.execute(ANKER_ANDROID_STORE_PASSWORD='FAKE-STORE-PASSWORD')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('FAKE-STORE-PASSWORD', result.stdout + result.stderr)
        self.assertFalse((self.root / 'anker-update').exists())

    def test_wrong_certificate_never_signs_and_key_is_removed(self):
        result = self.execute(credentials=True, expected='f' * 64)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any(row['tool'] == 'apksigner' and row['argv'][0] == 'sign' for row in self.tools()))
        self.assertEqual(list(self.root.glob('anker-signing-*')), [])

    def test_mock_signed_success_passwords_never_in_argv(self):
        result = self.execute(credentials=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        receipt = json.loads((self.root / 'anker-update/build-proof.json').read_text())
        self.assertEqual(receipt['certificateSha256'], FAKE_CERT_SHA)
        self.assertTrue(receipt['installableApk'])
        self.assertFalse(receipt['published'])
        self.assertEqual(list(self.root.glob('anker-signing-*')), [])
        for row in self.tools():
            self.assertNotIn('FAKE-STORE-PASSWORD', str(row['argv']))
            self.assertNotIn('FAKE-KEY-PASSWORD', str(row['argv']))
            self.assertFalse(any(name.startswith('ANKER_ANDROID_') for name in row['environmentSecretNames']))
            if row['tool'] in ['aapt', 'zipalign']:
                self.assertEqual(row['environmentSecretNames'], [])

    def test_invalid_base64_rejected(self):
        result = self.execute(credentials=True, ANKER_ANDROID_KEYSTORE_BASE64='not valid base64!')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(list(self.root.glob('anker-signing-*')), [])

    def test_corrupt_handoff_digest_rejected(self):
        result = self.execute(ANKER_UNSIGNED_SHA256='0' * 64)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.tools(), [])

    def test_legacy_app_id_is_rejected_before_any_private_tool(self):
        self.proof['applicationId'] = 'de.frnkrm.anker'
        result = self.execute(credentials=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.tools(), [])

    def test_wrong_ci_rejected(self):
        self.proof['ci']['headSha'] = 'c' * 40
        self.assertNotEqual(self.execute().returncode, 0)

    def test_stale_native_proof_rejected(self):
        self.proof['nativeTests']['freshRerun'] = False
        self.assertNotEqual(self.execute().returncode, 0)

    def test_approved_manifest_must_match_actual_build(self):
        approved = {'sourceFingerprint': 'c' * 64, 'versionName': '1.3.0-rc.4', 'versionCode': 11, 'publicCertificateSha256': FAKE_CERT_SHA}
        self.proof['ci']['approvedStand'] = approved
        self.trusted_ci = json.loads(json.dumps(self.proof['ci']))
        result = self.execute(credentials=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.tools(), [])

    def test_matching_approved_manifest_reaches_mock_signed_output(self):
        approved = {'sourceFingerprint': IDENTITY, 'versionName': '1.3.0-rc.4', 'versionCode': 11, 'publicCertificateSha256': FAKE_CERT_SHA}
        self.proof['ci']['approvedStand'] = approved
        self.trusted_ci = json.loads(json.dumps(self.proof['ci']))
        result = self.execute(credentials=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        receipt = json.loads((self.root / 'anker-update/build-proof.json').read_text())
        self.assertTrue(receipt['installableApk'])
        self.assertEqual(receipt['ci']['approvedStand'], approved)

    def test_approved_manifest_cannot_be_removed_by_build_data(self):
        self.trusted_ci['approvedStand'] = {'sourceFingerprint': IDENTITY}
        self.assertNotEqual(self.execute().returncode, 0)
        self.assertEqual(self.tools(), [])

    def test_extra_artifact_file_rejected(self):
        (self.root / 'anker-input/run-me.py').write_text('raise Exception("never executed")')
        result = self.execute()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.tools(), [])


class PowerShellTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pwsh = os.environ.get('PWSH_PATH') or shutil.which('pwsh')
        if not cls.pwsh:
            raise unittest.SkipTest('PowerShell 7.2+ is required for secret-transfer mock tests.')

    def test_mock_gh_receives_values_only_on_stdin(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            mock = root / 'gh-mock'
            mock.write_text('#!/usr/bin/env python3\nimport json,os,sys\nwith open(os.environ["ANKER_MOCK_LOG"],"a") as f: f.write(json.dumps({"argv":sys.argv[1:],"stdin":sys.stdin.read()})+"\\n")\n')
            mock.chmod(0o755)
            harness = root / 'test.ps1'
            harness.write_text('''param([string]$Setup, [string]$Mock)
. $Setup
Set-AnkerSigningSecrets -GhExecutable $Mock -TargetRepository 'example/repo' -KeystoreBase64 'RkFLRS1LRVk=' -StorePassword 'FAKE-STORE' -Alias 'FAKE-ALIAS' -KeyPassword 'FAKE-KEY'
''')
            log = root / 'calls.jsonl'
            result = subprocess.run([self.pwsh, '-NoProfile', '-NonInteractive', '-File', str(harness), str(ROOT / 'scripts/setup-android-signing.ps1'), str(mock)], env=dict(os.environ, ANKER_MOCK_LOG=str(log)), capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            rows = [json.loads(line) for line in log.read_text().splitlines()]
            self.assertEqual(len(rows), 4)
            self.assertEqual([row['stdin'] for row in rows], ['RkFLRS1LRVk=', 'FAKE-STORE', 'FAKE-ALIAS', 'FAKE-KEY'])
            self.assertEqual([row['argv'][2] for row in rows], ['ANKER_ANDROID_KEYSTORE_BASE64', 'ANKER_ANDROID_STORE_PASSWORD', 'ANKER_ANDROID_KEY_ALIAS', 'ANKER_ANDROID_KEY_PASSWORD'])
            for row in rows:
                self.assertEqual(row['argv'][:2], ['secret', 'set'])
                self.assertEqual(row['argv'][3:], ['--repo', 'example/repo'])
                self.assertNotIn(row['stdin'], str(row['argv']))
            self.assertNotIn('FAKE-STORE', result.stdout + result.stderr)

    def test_missing_explicit_keystore_path_does_not_use_debug_key(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            log = root / 'gh-called'
            mock = root / 'gh'
            mock.write_text('#!/usr/bin/env python3\nimport os,pathlib\npathlib.Path(os.environ["ANKER_MISSING_PATH_LOG"]).touch()\n')
            mock.chmod(0o755)
            result = subprocess.run([self.pwsh, '-NoProfile', '-NonInteractive', '-File', str(ROOT / 'scripts/setup-android-signing.ps1')], env=dict(os.environ, PATH=str(root) + os.pathsep + os.environ['PATH'], ANKER_MISSING_PATH_LOG=str(log)), capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('-KeystorePath', result.stdout + result.stderr)
            self.assertFalse(log.exists())

    def test_mock_gh_errors_are_redacted(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            mock = root / 'gh-mock'
            mock.write_text('#!/usr/bin/env python3\nimport sys\nprint("LEAK-"+sys.stdin.read(),file=sys.stderr)\nsys.exit(1)\n')
            mock.chmod(0o755)
            harness = root / 'test.ps1'
            harness.write_text('''param([string]$Setup, [string]$Mock)
. $Setup
try { Set-AnkerSigningSecrets -GhExecutable $Mock -TargetRepository 'example/repo' -KeystoreBase64 'RkFLRS1LRVk=' -StorePassword 'FAKE-STORE' -Alias 'FAKE-ALIAS' -KeyPassword 'FAKE-KEY' } catch { Write-Output $_.Exception.Message; exit 2 }
''')
            result = subprocess.run([self.pwsh, '-NoProfile', '-NonInteractive', '-File', str(harness), str(ROOT / 'scripts/setup-android-signing.ps1'), str(mock)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertNotIn('LEAK-', result.stdout + result.stderr)
            self.assertNotIn('RkFLRS1LRVk=', result.stdout + result.stderr)


class WorkflowBoundaryTests(unittest.TestCase):
    def test_inline_python_compiles(self):
        compile(CI_CODE, '<workflow-ci-gate>', 'exec')
        compile(SIGN_CODE, '<workflow-sign>', 'exec')
        compile(inline_python('Öffentlichen CI-Nachweis des getrennten Resolvejobs übernehmen'), '<workflow-transfer>', 'exec')

    def test_signing_job_has_no_checkout_or_build_execution(self):
        build, sign = WORKFLOW.split('\n  sign:\n', 1)
        self.assertNotIn('${{ secrets.', build)
        self.assertNotRegex(sign, r'uses: (?:actions/checkout|actions/setup-node|gradle/)')
        self.assertNotRegex(sign, r'(?m)^\s+(?:- run: |run: )(?:npm|npx|node|bash|pwsh)')
        self.assertIn('needs: [resolve, build]', sign)
        self.assertEqual(re.findall(r'^  ([a-z_]+):$', WORKFLOW, re.M), ['workflow_dispatch', 'resolve', 'build', 'sign'])

    def test_actions_are_official_and_pinned(self):
        actions = re.findall(r'uses: ([^\s]+)', WORKFLOW)
        self.assertGreaterEqual(len(actions), 6)
        for action in actions:
            self.assertRegex(action, r'^(?:actions/[a-z-]+|gradle/actions/setup-gradle)@[a-f0-9]{40}$')


if __name__ == '__main__':
    unittest.main(verbosity=2)
