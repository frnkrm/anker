"""Pinned internal activation contracts; no Google access or credentials."""
import copy
import contextlib
import io
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('internal17', Path(__file__).with_name('google-play-internal-release.py'))
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)
d = m.draft
BASE = d.API_PATH
OWN = BASE + '/own'
VERIFY = BASE + '/verify'
PRIVATE = 'PRIVATE_RELEASE_NOTE_NOT_FOR_LOGS'
OLD = {'status': 'completed', 'versionCodes': ['16'], 'name': 'old', 'releaseNotes': [{'language': 'de-DE', 'text': PRIVATE}]}
TARGET = {'status': 'draft', 'versionCodes': ['17'], 'name': d.RELEASE_NAME, 'releaseNotes': [{'language': 'de-DE', 'text': PRIVATE}]}


class Fake:
    def __init__(self):
        self.rows = [copy.deepcopy(OLD), copy.deepcopy(TARGET)]
        self.bundle = {'versionCode': 17, 'sha256': d.BUNDLE_SHA256}
        self.calls = []
        self.inserts = 0
        self.failures = {}
        self.changed = None
        self.observed = None
        self.validate = {'id': 'own'}
        self.commit = {'id': 'own'}

    def request(self, method, path, payload=None):
        self.calls.append((method, path, payload))
        if (method, path) in self.failures:
            raise self.failures[(method, path)]
        if method == 'POST' and path == BASE:
            self.inserts += 1
            return {'id': 'own' if self.inserts == 1 else 'verify'}
        if method == 'GET' and path.endswith('/bundles'):
            return {'bundles': [self.bundle]}
        if method == 'GET' and path.endswith('/tracks/internal'):
            return {'track': 'internal', 'releases': copy.deepcopy(self.observed if path.startswith(VERIFY) and self.observed is not None else self.rows)}
        if method == 'PUT' and path == OWN + '/tracks/internal':
            self.rows = json.loads(payload)['releases']
            return {'track': 'internal', 'releases': copy.deepcopy(self.changed if self.changed is not None else self.rows)}
        if method == 'POST' and path == OWN + ':validate': return self.validate
        if method == 'POST' and path == OWN + ':commit' + m.COMMIT_QUERY: return self.commit
        if method == 'DELETE' and path in [OWN, VERIFY]: return {}
        raise AssertionError('Unexpected endpoint')


def report():
    return {'commitAttempted': False, 'commitAcknowledged': False, 'activeReleaseVerified': False}


class InternalReleaseTests(unittest.TestCase):
    def setUp(self):
        guard = patch('urllib.request.OpenerDirector.open', side_effect=AssertionError('Real HTTP forbidden'))
        guard.start(); self.addCleanup(guard.stop)
        self.api = Fake()
        self.result = report()

    def perform(self): m.perform(self.api, self.result, m.CONFIRMATION)

    def commits(self): return [c for c in self.api.calls if ':commit' in c[1]]

    def test_exact_draft_activated_without_upload_and_full_target_metadata_preserved(self):
        self.perform()
        expected = copy.deepcopy(TARGET); expected.update(status='completed', versionCodes=['16', '17'])
        self.assertEqual(self.api.rows, [expected])
        self.assertEqual(self.result['status'], 'internal-active')
        self.assertTrue(self.result['activeReleaseVerified'])
        self.assertEqual(len(self.commits()), 1)
        self.assertIn('ERROR_IF_IN_REVIEW', self.commits()[0][1])
        self.assertNotIn('changesNotSentForReview', self.commits()[0][1])
        self.assertEqual(self.api.calls[-1][:2], ('DELETE', VERIFY))
        self.assertNotIn(PRIVATE, json.dumps(self.result))
        self.assertFalse(any('/upload' in c[1] or '/production' in c[1] for c in self.api.calls))

    def test_release_pair_order_irrelevant(self):
        self.api.rows.reverse(); self.perform(); self.assertTrue(self.result['activeReleaseVerified'])

    def test_confirmation_required_before_any_api_call(self):
        with self.assertRaises(d.UploadError): m.perform(self.api, self.result, 'wrong')
        self.assertEqual(self.api.calls, [])

    def test_foreign_missing_duplicate_active17_or_modified_identity_stops_before_track_write(self):
        for rows in [[], [OLD], [TARGET], [TARGET, TARGET], [OLD, OLD, TARGET],
                     [OLD, {**TARGET, 'name': 'foreign'}], [OLD, {**TARGET, 'status': 'completed'}],
                     [OLD, {**TARGET, 'versionCodes': ['18']}], [OLD, {**TARGET, 'userFraction': .5}]]:
            with self.subTest(rows=rows):
                self.api = Fake(); self.api.rows = copy.deepcopy(rows); self.result = report()
                with self.assertRaises(d.UploadError): self.perform()
                self.assertFalse(any(c[0] == 'PUT' for c in self.api.calls))
                self.assertEqual(self.api.calls[-1][:2], ('DELETE', OWN))

    def test_wrong_bundle_hash_or_duplicate_bundle_stops_before_write(self):
        self.api.bundle['sha256'] = 'a' * 64
        with self.assertRaises(d.UploadError): self.perform()
        self.assertFalse(any(c[0] == 'PUT' for c in self.api.calls))

    def test_changed_put_metadata_or_extra_release_aborts_before_validate_commit(self):
        for rows in [[{**TARGET, 'status': 'completed', 'versionCodes': ['16','17'], 'name': 'changed'}], [OLD, TARGET]]:
            self.api = Fake(); self.api.changed = rows; self.result = report()
            with self.assertRaises(d.UploadError): self.perform()
            self.assertFalse(self.commits())
            self.assertEqual(self.api.calls[-1][:2], ('DELETE', OWN))

    def test_wrong_validate_identity_stops_before_commit(self):
        self.api.validate = {'id': 'foreign'}
        with self.assertRaises(d.UploadError): self.perform()
        self.assertFalse(self.commits())

    def test_commit_timeout_server_errors_bad_identity_never_retry_or_delete_ambiguous_edit(self):
        for code in ['NETWORK_ERROR', 'HTTP_SERVER_ERROR', 'HTTP_CONFLICT', 'RESPONSE_INVALID']:
            self.api = Fake(); self.result = report()
            self.api.failures[('POST', OWN + ':commit' + m.COMMIT_QUERY)] = d.UploadError(code)
            with self.assertRaises(d.UploadError): self.perform()
            self.assertEqual(len(self.commits()), 1)
            self.assertFalse(any(c[0] == 'DELETE' for c in self.api.calls))
            self.assertFalse(self.result['activeReleaseVerified'])
        self.api = Fake(); self.result = report(); self.api.commit = {'id': 'foreign'}
        with self.assertRaises(d.UploadError): self.perform()
        self.assertEqual(len(self.commits()), 1)

    def test_full_readback_metadata_missing_old_code_duplicates_or_extra_release_rejected(self):
        good = {**TARGET, 'status': 'completed', 'versionCodes': ['16','17']}
        for rows in [[{**good, 'releaseNotes': []}], [{**good, 'versionCodes': ['17']}],
                     [{**good, 'versionCodes': ['16','17','17']}], [good, OLD], [TARGET]]:
            self.api = Fake(); self.result = report(); self.api.observed = rows
            with self.assertRaises(d.UploadError) as caught: self.perform()
            self.assertEqual(caught.exception.code, 'POST_COMMIT_UNVERIFIED')
            self.assertFalse(self.result['activeReleaseVerified'])
            self.assertEqual(self.api.calls[-1][:2], ('DELETE', VERIFY))

    def test_readback_version_code_order_accepted(self):
        self.api.observed = [{**TARGET, 'status':'completed', 'versionCodes':['17','16']}]
        self.perform(); self.assertTrue(self.result['activeReleaseVerified'])

    def test_already_exactly_active_is_readonly_and_closes_empty_edit(self):
        self.api.rows = [{**TARGET, 'status':'completed', 'versionCodes':['16','17']}]
        self.perform(); self.assertEqual(self.result['status'], 'already-active')
        self.assertFalse(any(c[0]=='PUT' or ':validate' in c[1] or ':commit' in c[1] for c in self.api.calls))
        self.assertEqual(self.api.calls[-1][:2], ('DELETE', OWN))

    def test_transport_rejects_other_tracks_uploads_testers_unsafe_payloads_and_review_cancellation(self):
        t = m.ReleaseTransport('SYNTHETIC'); t.client = Mock()
        for method, path, payload in [('PUT', OWN+'/tracks/production', b'{}'), ('POST', '/upload'+OWN+'/bundles', b'x'),
                ('PUT', OWN+'/testers', b'{}'), ('POST', OWN+':commit', None),
                ('PUT', OWN+'/tracks/internal', b'{"track":"internal","releases":[]}'),
                ('PUT', OWN+'/tracks/internal', d.json_body({'track':'internal','releases':[TARGET]}))]:
            with self.assertRaises(d.UploadError): t.request(method, path, payload)
        t.client.request.assert_not_called()
        t.request('PUT', OWN+'/tracks/internal', d.json_body({'track':'internal','releases':[{**TARGET,'status':'completed','versionCodes':['16','17']}]}))
        self.assertEqual(t.client.request.call_count, 1)

    def test_cli_success_and_unknown_commit_result_are_sanitized_and_nonzero_on_uncertainty(self):
        for failure in [False, True]:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as directory:
                api = Fake()
                if failure:
                    api.failures[('POST', OWN+':commit'+m.COMMIT_QUERY)] = RuntimeError(PRIVATE)
                output = io.StringIO(); result_path = Path(directory)/'report.json'
                with patch.object(d, 'read_manifest', return_value={}), patch.object(d, 'token_from_env', return_value='SYNTHETIC'), patch.object(m, 'ReleaseTransport', return_value=api), contextlib.redirect_stdout(output):
                    code = m.main(['--manifest', 'not-read', '--report', str(result_path), '--confirm', m.CONFIRMATION])
                result = json.loads(result_path.read_text())
                self.assertEqual(code, 3 if failure else 0)
                self.assertEqual(result['activeReleaseVerified'], not failure)
                self.assertFalse(result['bundleUploaded'] or result['productionChanged'] or result['testerListsChanged'])
                self.assertNotIn(PRIVATE, output.getvalue())
                self.assertNotIn('SYNTHETIC', output.getvalue())
                self.assertEqual(len([c for c in api.calls if ':commit' in c[1]]), 1)

    def test_invalid_manifest_or_confirmation_prevents_transport_creation(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(m, 'ReleaseTransport') as transport, contextlib.redirect_stdout(io.StringIO()):
            result_path = Path(directory)/'report.json'
            code = m.main(['--manifest', str(Path(directory)/'missing'), '--report', str(result_path), '--confirm', m.CONFIRMATION])
            self.assertEqual(code, 2); transport.assert_not_called()
            code = m.main(['--manifest', 'missing', '--report', str(result_path), '--confirm', 'wrong'])
            self.assertEqual(code, 2); transport.assert_not_called()

    def test_duplicate_bundle_rejected_before_any_track_write(self):
        with self.assertRaises(d.UploadError):
            d.known_bundle({'bundles': [self.api.bundle, self.api.bundle]})

    def test_readback_network_error_does_not_report_success_or_repeat_commit(self):
        self.api.failures[('GET', VERIFY+'/tracks/internal')] = d.UploadError('NETWORK_ERROR')
        with self.assertRaises(d.UploadError) as caught: self.perform()
        self.assertEqual(caught.exception.code, 'POST_COMMIT_UNVERIFIED')
        self.assertTrue(self.result['commitAcknowledged'])
        self.assertFalse(self.result['activeReleaseVerified'])
        self.assertEqual(len(self.commits()), 1)
        self.assertEqual(self.api.calls[-1][:2], ('DELETE', VERIFY))

    def test_workflow_is_main_only_optin_shares_lock_and_runs_security_tests_before_auth(self):
        s=(ROOT/'.github/workflows/google-play-internal-release.yml').read_text()
        self.assertIn("github.ref == 'refs/heads/main'", s)
        self.assertIn("github.repository == 'frnkrm/anker'", s)
        self.assertIn("inputs.confirmation == 'RELEASE_CODE17_INTERNAL'", s)
        self.assertIn("contains(github.event.head_commit.message, '[anker-internal17-release]')", s)
        self.assertIn('group: anker-google-play-internal-draft', s)
        self.assertNotIn('pull_request:', s)
        self.assertNotIn('workflow_run:', s)
        self.assertLess(s.index('python3 scripts/test-google-play-internal-release.py'),s.index('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:'))
        self.assertLess(s.index('Freigegebenen App-Stand und grüne CI prüfen'),s.index('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:'))
        original=(ROOT/'.github/workflows/google-play-upload.yml').read_text()
        marker='      - name: Freigegebenen App-Stand und grüne CI prüfen\n'
        original_gate=original.split(marker)[1].split('      - name: Festes signiertes Bundle')[0]
        gate=s.split(marker)[1].split('      - name: Nur für Google Play authentifizieren')[0]
        self.assertEqual(gate, original_gate)
        self.assertEqual(s.count('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:'),1)
        self.assertIn('python3 scripts/test-google-play-internal-release.py',(ROOT/'.github/workflows/ci.yml').read_text())


if __name__ == '__main__': unittest.main()
