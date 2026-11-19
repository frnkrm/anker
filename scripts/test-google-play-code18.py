"""Offline delivery protocol tests; no real credentials or Google requests."""
import copy
from datetime import timedelta
import importlib.util
import json
import os
from types import SimpleNamespace
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('delivery', Path(__file__).with_name('google-play-code18.py'))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
BODY = b'synthetic verified bundle'
DIGEST = c.p.sha(BODY)
OLD = {'name': c.RETAINED_NAME, 'versionCodes': ['17'], 'status': 'completed',
       'releaseNotes': [{'language': 'de-DE', 'text': 'Keep this metadata'}]}


def inputs(mode='internal'):
    return dict(mode=mode, confirmation='RELEASE_CODE18_INTERNAL' if mode == 'internal' else 'UPLOAD_CODE18_DRAFT',
                expected_workflow_commit='a' * 40, sign_workflow_commit='b' * 40,
                sign_run_id='123', sign_run_attempt='1', artifact_id='456', bundle_sha256=DIGEST, proof_sha256='c' * 64)


class API:
    def __init__(self, *, existing=None, known=False, fail=None):
        self.rows = [copy.deepcopy(OLD)] + ([copy.deepcopy(existing)] if existing else [])
        self.known = known
        self.fail = fail
        self.calls = []
        self.next_id = 0

    def request(self, method, path, payload=None, **kwargs):
        self.calls.append((method, path, payload))
        if self.fail and self.fail in path:
            raise c.legacy.UploadError('NETWORK_ERROR')
        if method == 'POST' and path == c.legacy.API_PATH:
            self.next_id += 1
            return {'id': str(self.next_id)}
        if path.endswith('/bundles') and method == 'GET':
            return {'bundles': [{'versionCode': 18, 'sha256': DIGEST}] if self.known else []}
        if kwargs.get('bundle'):
            self.known = True
            return {'versionCode': 18, 'sha256': DIGEST}
        if path.endswith('/tracks/internal'):
            if method == 'PUT':
                self.rows = json.loads(payload)['releases']
            return {'track': 'internal', 'releases': copy.deepcopy(self.rows)}
        if method == 'DELETE':
            return {}
        return {'id': path.rsplit('/', 1)[1].split(':')[0]}


def report():
    return {'commitAttempted': False, 'commitAcknowledged': False, 'bundleUploadAttempted': False}


class DeliveryTests(unittest.TestCase):
    def test_exact_manual_main_invocation_only(self):
        env = dict(GITHUB_ACTIONS='true', GITHUB_REPOSITORY=c.p.REPO, GITHUB_REF='refs/heads/main',
                   GITHUB_EVENT_NAME='workflow_dispatch', GITHUB_WORKFLOW_REF=c.p.REPO + '/' + c.WORKFLOW + '@refs/heads/main',
                   GITHUB_SHA='a' * 40, GITHUB_WORKFLOW_SHA='a' * 40, GITHUB_RUN_ATTEMPT='1', PLAY18_INPUTS=json.dumps(inputs()))
        self.assertEqual(c.invocation(env), inputs())
        for field, value in [('GITHUB_ACTIONS', 'false'), ('GITHUB_REF', 'refs/heads/other'),
                             ('GITHUB_EVENT_NAME', 'push'), ('GITHUB_RUN_ATTEMPT', '2'), ('GITHUB_SHA', 'd' * 40)]:
            with self.subTest(field=field), self.assertRaises(c.p.ProofError):
                c.invocation({**env, field: value})
        for field, value in [('mode', 'production'), ('confirmation', 'UPLOAD_CODE18_DRAFT'), ('artifact_id', '0'),
                             ('bundle_sha256', 'BAD')]:
            with self.subTest(field=field), self.assertRaises(c.p.ProofError):
                c.invocation({**env, 'PLAY18_INPUTS': json.dumps({**inputs(), field: value})})

    def test_time_gate_before_any_google_request(self):
        api = API()
        with self.assertRaises(c.p.ProofError):
            c.deliver(api, inputs(), BODY, report(), now=c.EARLIEST - timedelta(seconds=1))
        self.assertEqual(api.calls, [])

    def test_hash_gate_before_any_google_request(self):
        api = API()
        with self.assertRaises(c.p.ProofError):
            c.deliver(api, inputs(), b'wrong', report(), now=c.EARLIEST)
        self.assertEqual(api.calls, [])

    def test_internal_upload_preserves_old_release_and_reads_back(self):
        api, result = API(), report()
        c.deliver(api, inputs(), BODY, result, now=c.EARLIEST)
        self.assertEqual(api.rows, [{**OLD, 'name': c.NAME, 'status': 'completed', 'versionCodes': ['18']}])
        self.assertTrue(result['activeReleaseVerified'])
        self.assertTrue(result['commitAcknowledged'])
        self.assertEqual(sum('/upload/' in path for _, path, _ in api.calls), 1)
        commits = [path for _, path, _ in api.calls if ':commit' in path]
        self.assertEqual(len(commits), 1)
        self.assertIn('ERROR_IF_IN_REVIEW', commits[0])
        self.assertNotIn('changesNotSentForReview', commits[0])

    def test_draft_is_default_scope_and_does_not_activate(self):
        api, result = API(), report()
        c.deliver(api, inputs('draft'), BODY, result, now=c.EARLIEST)
        self.assertEqual(api.rows[0], OLD)
        self.assertEqual(api.rows[1]['status'], 'draft')
        self.assertTrue(result['draftVerified'])
        self.assertFalse(result['activeReleaseVerified'])
        self.assertTrue(any('changesNotSentForReview=true' in path for _, path, _ in api.calls))

    def test_existing_exact_draft_can_be_activated_without_reupload(self):
        api = API(existing={'name': c.NAME, 'status': 'draft', 'versionCodes': ['18']}, known=True)
        result = report()
        c.deliver(api, inputs(), BODY, result, now=c.EARLIEST)
        self.assertFalse(result['bundleUploadAttempted'])
        self.assertTrue(result['activeReleaseVerified'])
        self.assertTrue(any(method == 'PUT' for method, _, _ in api.calls))

    def test_existing_active_is_idempotent_and_never_downgraded_to_draft(self):
        for mode in ('draft', 'internal'):
            api = API(existing={'name': c.NAME, 'status': 'completed', 'versionCodes': ['18']}, known=True)
            api.rows = [{'name': c.NAME, 'status': 'completed', 'versionCodes': ['18']}]
            result = report()
            c.deliver(api, inputs(mode), BODY, result, now=c.EARLIEST)
            self.assertTrue(result['activeReleaseVerified'])
            self.assertFalse(any(method == 'PUT' or ':commit' in path for method, path, _ in api.calls))

    def test_conflicting_code18_hash_rejected(self):
        with self.assertRaises(c.p.ProofError):
            c.known_bundle({'bundles': [{'versionCode': 18, 'sha256': 'e' * 64}]}, DIGEST)
        with self.assertRaises(c.p.ProofError):
            c.known_bundle({'bundles': [{'versionCode': 18, 'sha256': DIGEST}] * 2}, DIGEST)

    def test_unknown_or_in_progress_releases_untouched(self):
        for row in [{'name': 'unknown', 'status': 'draft', 'versionCodes': ['19']},
                    {'name': c.NAME, 'status': 'inProgress', 'versionCodes': ['18']},
                    {'name': c.NAME, 'status': 'draft', 'versionCodes': ['18'], 'userFraction': 0.5}]:
            api = API(existing=row)
            with self.assertRaises(c.p.ProofError):
                c.deliver(api, inputs(), BODY, report(), now=c.EARLIEST)
            self.assertFalse(any(method == 'PUT' or '/upload/' in path or ':commit' in path for method, path, _ in api.calls))
            self.assertEqual(api.calls[-1][0], 'DELETE')

    def test_changed_baseline_stops_before_upload_and_preserves_all_metadata(self):
        for change in [{'versionCodes': ['16', '17']}, {'versionCodes': ['16']},
                       {'versionCodes': ['17', '19']}, {'name': 'unknown'},
                       {'status': 'inProgress'}, {'userFraction': 0.5}]:
            api = API()
            api.rows = [{**copy.deepcopy(OLD), **change}]
            before = copy.deepcopy(api.rows)
            with self.subTest(change=change), self.assertRaises(c.p.ProofError):
                c.deliver(api, inputs(), BODY, report(), now=c.EARLIEST)
            self.assertEqual(api.rows, before)
            self.assertFalse(any(method == 'PUT' or '/upload/' in path or ':commit' in path for method, path, _ in api.calls))
        api = API(known=True)
        api.rows = [{'name': c.NAME, 'status': 'completed', 'versionCodes': ['17', '18']}]
        with self.assertRaises(c.p.ProofError):
            c.deliver(api, inputs(), BODY, report(), now=c.EARLIEST)
        self.assertFalse(any(method == 'PUT' or '/upload/' in path or ':commit' in path for method, path, _ in api.calls))
        api = API()
        api.rows[0]['inAppUpdatePriority'] = 2
        old = copy.deepcopy(api.rows[0])
        c.deliver(api, inputs(), BODY, report(), now=c.EARLIEST)
        self.assertEqual(api.rows, [{**old, 'name': c.NAME, 'versionCodes': ['18']}])

    def test_ambiguous_commit_never_retried_or_deleted(self):
        api, result = API(fail=':commit'), report()
        with self.assertRaises(c.legacy.UploadError):
            c.deliver(api, inputs(), BODY, result, now=c.EARLIEST)
        self.assertTrue(result['commitAttempted'])
        self.assertFalse(result['commitAcknowledged'])
        self.assertEqual(sum(':commit' in path for _, path, _ in api.calls), 1)
        self.assertFalse(any(method == 'DELETE' for method, _, _ in api.calls))

    def test_ambiguous_upload_never_retried(self):
        api, result = API(fail='/upload/'), report()
        with self.assertRaises(c.legacy.UploadError):
            c.deliver(api, inputs(), BODY, result, now=c.EARLIEST)
        self.assertTrue(result['bundleUploadAttempted'])
        self.assertFalse(result['commitAttempted'])
        self.assertEqual(sum('/upload/' in path for _, path, _ in api.calls), 1)

    def test_existing_transport_remains_code17(self):
        self.assertEqual(c.legacy.VERSION, 17)
        self.assertEqual(c.legacy.SOURCE, '80f6a692b005ab08edacf9e6ad9e9669e4c383f7')

    def test_artifact_origin_failure_stops_before_download(self):
        class GitHub:
            def archive(self, _):
                raise AssertionError('Must not download an untrusted artifact')
        with patch.object(c, 'check_ci'), patch.object(c.p, 'artifact_metadata', side_effect=c.p.ProofError('ARTIFACT_ORIGIN')):
            with self.assertRaises(c.p.ProofError):
                c.prepare(GitHub(), inputs(), Path('unused'), None, None)

    def test_mismatched_proof_fails_before_crypto_or_play(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'proof.json').write_text('{}')
            (root / 'Anker-Code18-SIGNIERT.aab').write_bytes(BODY)
            with patch.object(c.p, 'jar_report', side_effect=AssertionError('Do not trust mismatched proof')):
                with self.assertRaises(c.p.ProofError):
                    c.verify_files(root, inputs(), None, None)

    def test_signed_recheck_uses_disposable_public_certificate_and_strict_trust(self):
        public = b'SYNTHETIC PUBLIC CERTIFICATE'
        cert_hash = c.p.sha(public)
        def ci(commit):
            return dict(id=1, attempt=1, headSha=commit, branch='main', event='push',
                        status='completed', conclusion='success', workflow=c.p.CI)
        jar = dict(signed=True, payloadEntries=10, minSigners=1, maxSigners=1,
                   certificateSha256=cert_hash, publicKeyAlgorithm='RSA')
        proof = dict(schemaVersion=1, kind='anker-code18-signed-verified', signedSHA256=DIGEST,
                     signedBytes=len(BODY), certificateSHA256=cert_hash, payloadUnchanged=True,
                     uploadedToPlay=False, jarVerification=jar,
                     context=dict(sourceCommit=c.p.SOURCE, sourceFingerprint=c.p.FINGERPRINT,
                                  workflowCommit='b' * 40, mode='sign', run=dict(id=123, attempt=1),
                                  sourceCI=ci(c.p.SOURCE), workflowCI=ci('b' * 40)))
        paths, calls = [], []
        def read_jar(file, classes, *, signed, certificate):
            self.assertTrue(signed)
            self.assertIsInstance(certificate, Path)
            self.assertFalse(certificate.exists())
            certificate.write_bytes(public)
            paths.append(certificate)
            return copy.deepcopy(jar)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'Anker-Code18-SIGNIERT.aab').write_bytes(BODY)
            for field in (None, 'sourceCommit', 'sourceFingerprint'):
                value = copy.deepcopy(proof)
                if field:
                    value['context'][field] = '0' * (40 if field == 'sourceCommit' else 64)
                raw = json.dumps(value).encode()
                (root / 'proof.json').write_bytes(raw)
                data = {**inputs(), 'proof_sha256': c.p.sha(raw)}
                with patch.object(c.p, 'CERT', cert_hash), patch.object(c.p, 'jar_report', side_effect=read_jar), \
                     patch.object(c.p, 'inspect_bundle'), patch.object(c.p, 'native_and_identity'), \
                     patch.object(c.p, 'tool', side_effect=lambda args: calls.append(args)):
                    if field:
                        with self.assertRaises(c.p.ProofError):
                            c.verify_files(root, data, None, None)
                    else:
                        self.assertEqual(c.verify_files(root, data, None, None), BODY)
        self.assertEqual(len(paths), 1)
        self.assertFalse(paths[0].exists())
        self.assertEqual([args[0] for args in calls], ['keytool', 'jarsigner'])
        self.assertIn('-strict', calls[1])

    def test_public_tools_step_accepts_only_the_publisher_context_before_fetch(self):
        root = Path(__file__).resolve().parents[1]
        js = "console.log(JSON.stringify(require('js-yaml').load(require('node:fs').readFileSync('.github/workflows/google-play-code18.yml','utf8'))))"
        workflow = json.loads(subprocess.run(['node', '-e', js], cwd=root, capture_output=True, text=True, check=True).stdout)
        step = next(s for s in workflow['jobs']['code18']['steps'] if s.get('name') == 'Öffentliche gebundene Prüfwerkzeuge bereitstellen')
        self.assertTrue(step['run'].startswith("python3 - <<'PY'\n"))
        code = step['run'].split('\n', 1)[1].rsplit('\nPY', 1)[0]
        env = dict(GITHUB_ACTIONS='true', GITHUB_REPOSITORY=c.p.REPO, GITHUB_REF='refs/heads/main',
                   GITHUB_EVENT_NAME='workflow_dispatch', GITHUB_WORKFLOW_REF=c.p.REPO + '/' + c.WORKFLOW + '@refs/heads/main',
                   GITHUB_SHA='a' * 40, GITHUB_WORKFLOW_SHA='a' * 40, GITHUB_RUN_ATTEMPT='1',
                   PLAY18_INPUTS=json.dumps(inputs()), RUNNER_TEMP=str(root / 'synthetic-runner-temp'))
        loader = SimpleNamespace(exec_module=lambda module: None)
        for change in [{}, {'GITHUB_EVENT_NAME': 'push'}, {'GITHUB_REF': 'refs/heads/other'},
                       {'GITHUB_SHA': 'd' * 40}, {'PLAY18_INPUTS': json.dumps({**inputs(), 'mode': 'production'})}]:
            with self.subTest(change=change), patch.dict(os.environ, {**env, **change}, clear=True), \
                 patch.object(importlib.util, 'spec_from_file_location', return_value=SimpleNamespace(loader=loader)), \
                 patch.object(importlib.util, 'module_from_spec', return_value=c), patch.object(c.p, 'tooling') as fetch:
                if change:
                    with self.assertRaises(c.p.ProofError):exec(compile(code, '<public-tools-step>', 'exec'), {})
                    fetch.assert_not_called()
                else:
                    exec(compile(code, '<public-tools-step>', 'exec'), {})
                    fetch.assert_called_once_with(Path(env['RUNNER_TEMP']) / 'play18-tools', fetch=True)

    def test_workflow_has_no_push_and_auth_only_after_artifact_check(self):
        root = Path(__file__).resolve().parents[1]
        js = "console.log(JSON.stringify(require('js-yaml').load(require('node:fs').readFileSync('.github/workflows/google-play-code18.yml','utf8'))))"
        workflow = json.loads(subprocess.run(['node', '-e', js], cwd=root, capture_output=True, text=True, check=True).stdout)
        self.assertEqual(set(workflow['on']), {'workflow_dispatch'})
        self.assertEqual(workflow['on']['workflow_dispatch']['inputs']['mode']['default'], 'draft')
        self.assertFalse(workflow['concurrency']['cancel-in-progress'])
        job = workflow['jobs']['code18']
        self.assertEqual(job['permissions'], {'contents': 'read', 'actions': 'read'})
        steps = job['steps']
        auth = next(i for i, s in enumerate(steps) if s.get('id') == 'auth')
        verify = next(i for i, s in enumerate(steps) if 'google-play-code18.py prepare' in s.get('run', ''))
        self.assertLess(verify, auth)
        self.assertEqual(sum('secrets.' in json.dumps(s) for s in steps), 1)
        for s in steps:
            self.assertNotIn('${{', s.get('run', ''))
            self.assertNotIn('ANKER_ANDROID_', json.dumps(s))


if __name__ == '__main__':
    unittest.main(verbosity=2)
