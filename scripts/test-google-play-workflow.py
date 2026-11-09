"""Offline tests for the real Play workflow boundaries; no credentials or HTTP calls."""
from pathlib import Path
import contextlib
import copy
import hashlib
import io
import json
import os
import re
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = (ROOT / '.github/workflows/google-play-upload.yml').read_text()
APPROVAL = json.loads((ROOT / 'docs/PLAY_UPLOAD_APPROVAL.json').read_text())
SOURCE = 'a' * 40
FINGERPRINT = 'b' * 64
WORKFLOW_SOURCE = 'c' * 40
REPOSITORY = 'frnkrm/anker'
RUN_ID = 424242
SYNTHETIC_TOKEN = 'SYNTHETIC-TOKEN-NEVER-LOG'
PRIVATE_BODY = 'SYNTHETIC-HTTP-BODY-NEVER-LOG'


def step(name):
    marker = '      - name: ' + name + '\n'
    if WORKFLOW.count(marker) != 1:
        raise AssertionError('A workflow step must have one unambiguous name: ' + name)
    return WORKFLOW.split(marker, 1)[1].split('\n      - ', 1)[0]


def inline_python(name):
    section = step(name)
    lines = section.split('        run: |\n', 1)[1].splitlines()
    lines = lines[:lines.index('          PY') + 1]
    body = '\n'.join(line[10:] for line in lines)
    if not body.startswith("python3 - <<'PY'\n") or not body.endswith('\nPY'):
        raise AssertionError('Expected one complete inline Python block.')
    return compile(body.removeprefix("python3 - <<'PY'\n").removesuffix('\nPY'), '<workflow:' + name + '>', 'exec')


CI = inline_python('Freigegebenen App-Stand und grüne CI prüfen')
BIND = inline_python('Getestete Werkzeuge und Manifest binden')
HANDOFF = inline_python('Werkzeugidentität und Bundledaten vor Authentifizierung prüfen')
SECRET_PRESENT = inline_python('Verfügbarkeit des Google-Secrets prüfen')
UPLOAD_RESULT = inline_python('Ausschließlich internen Entwurf speichern')


@contextlib.contextmanager
def working_directory(directory):
    previous = Path.cwd()
    os.chdir(directory)
    try:
        yield
    finally:
        os.chdir(previous)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class CiGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'docs').mkdir()
        self.manifest = copy.deepcopy(APPROVAL)
        self.manifest.update(sourceCommit=SOURCE, sourceFingerprint=FINGERPRINT)
        self.manifest['ci'].update(runId=RUN_ID, sourceCommit=SOURCE)
        self.approved = {
            'applicationId': self.manifest['packageName'], 'sourceCommit': SOURCE,
            'sourceFingerprint': FINGERPRINT, 'versionCode': self.manifest['versionCode'],
            'publicCertificateSha256': self.manifest['signingCertificateSha256'],
            'ciRunURL': f'https://github.com/{REPOSITORY}/actions/runs/{RUN_ID}',
        }
        self.run = {
            'id': RUN_ID, 'head_sha': SOURCE, 'head_branch': 'main', 'event': 'push',
            'status': 'completed', 'conclusion': 'success', 'path': '.github/workflows/ci.yml',
            'html_url': self.approved['ciRunURL'], 'repository': {'full_name': REPOSITORY},
        }
        names = ['check', 'PC-Begleiter / ubuntu-latest / Python 3.12', 'PC-Begleiter / windows-latest / Python 3.12']
        self.jobs = {'total_count': 3, 'jobs': [
            {'id': index + 10, 'name': name, 'run_id': RUN_ID, 'status': 'completed', 'conclusion': 'success'}
            for index, name in enumerate(names)
        ]}
        self.comparison = {'status': 'ahead'}
        self.requests = []
        self.handlers = []
        self.failure = None
        self.repository = REPOSITORY

    def execute(self):
        (self.root / 'docs/PLAY_UPLOAD_APPROVAL.json').write_text(json.dumps(self.manifest))
        (self.root / 'docs/AKTUELLER_UPDATESTAND.json').write_text(json.dumps(self.approved))
        self.requests = []
        output = io.StringIO()
        error = None
        test = self

        class FakeOpener:
            def open(self, request, *, timeout):
                test.requests.append(request)
                test.assertEqual(timeout, 30)
                test.assertEqual(request.get_header('Authorization'), 'Bearer ' + SYNTHETIC_TOKEN)
                test.assertTrue(request.full_url.startswith('https://api.github.com/repos/' + REPOSITORY + '/'))
                if test.failure is not None:
                    if isinstance(test.failure, Exception):
                        raise test.failure
                    return io.BytesIO(test.failure)
                path = request.full_url.removeprefix('https://api.github.com/repos/' + REPOSITORY)
                if path == f'/actions/runs/{RUN_ID}':
                    value = test.run
                elif path == f'/actions/runs/{RUN_ID}/jobs?filter=latest&per_page=100':
                    value = test.jobs
                elif path == '/compare/' + SOURCE + '...' + WORKFLOW_SOURCE:
                    value = test.comparison
                else:
                    raise AssertionError('Unexpected API endpoint: ' + path)
                return io.BytesIO(json.dumps(value).encode())

        def opener(*handlers):
            self.handlers = handlers
            return FakeOpener()

        env = {'GH_TOKEN': SYNTHETIC_TOKEN, 'GITHUB_REPOSITORY': self.repository, 'GITHUB_SHA': WORKFLOW_SOURCE}
        with working_directory(self.root), patch.dict(os.environ, env, clear=True), \
                patch('urllib.request.build_opener', side_effect=opener), \
                patch('urllib.request.urlopen', side_effect=AssertionError('Real HTTP is forbidden')), \
                contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            try:
                exec(CI, {})
            except SystemExit as caught:
                error = caught
        visible = output.getvalue() + (str(error) if error else '')
        self.assertNotIn(SYNTHETIC_TOKEN, visible)
        self.assertNotIn(PRIVATE_BODY, visible)
        if error:
            raise error
        return output.getvalue()

    def test_exact_three_job_main_push_ci_and_ancestor_accepted(self):
        self.assertIn('alle drei grünen CI-Jobs', self.execute())
        self.assertEqual(len(self.requests), 3)
        self.comparison['status'] = 'identical'
        self.execute()

    def test_approved_source_fingerprint_package_and_version_mismatch_fail_before_http(self):
        for key, bad in [('sourceCommit', 'd' * 40), ('sourceFingerprint', 'e' * 64),
                         ('applicationId', 'another.app'), ('versionCode', -1)]:
            with self.subTest(field=key):
                original = self.approved[key]
                self.approved[key] = bad
                with self.assertRaises(SystemExit):
                    self.execute()
                self.assertFalse(self.requests)
                self.approved[key] = original

    def test_wrong_certificate_fails_before_http_but_public_format_is_normalized(self):
        self.approved['publicCertificateSha256'] = 'f' * 64
        with self.assertRaises(SystemExit):
            self.execute()
        self.assertFalse(self.requests)
        self.approved['publicCertificateSha256'] = self.manifest['signingCertificateSha256'].replace(':', '').lower()
        self.execute()

    def test_foreign_repository_and_unrelated_approved_run_fail_before_http(self):
        self.repository = 'foreign/repository'
        with self.assertRaises(SystemExit):
            self.execute()
        self.assertFalse(self.requests)
        self.repository = REPOSITORY
        self.approved['ciRunURL'] = f'https://github.com/{REPOSITORY}/actions/runs/99'
        with self.assertRaises(SystemExit):
            self.execute()
        self.assertFalse(self.requests)

    def test_run_identity_branch_event_workflow_and_green_state_are_all_required(self):
        mutations = [('id', 99), ('head_sha', 'd' * 40), ('head_branch', 'feature'),
                     ('event', 'pull_request'), ('status', 'in_progress'), ('conclusion', 'failure'),
                     ('path', '.github/workflows/unrelated.yml'), ('html_url', 'https://example.invalid/run'),
                     ('repository', {'full_name': 'foreign/repository'})]
        for key, bad in mutations:
            with self.subTest(field=key):
                original = self.run[key]
                self.run[key] = bad
                with self.assertRaises(SystemExit):
                    self.execute()
                self.assertEqual(len(self.requests), 1)
                self.run[key] = original

    def test_missing_matrix_job_duplicate_identity_and_wrong_job_run_are_rejected(self):
        valid = copy.deepcopy(self.jobs)
        variants = []
        missing = copy.deepcopy(valid); missing['jobs'].pop(); variants.append(missing)
        wrong_count = copy.deepcopy(valid); wrong_count['total_count'] = 4; variants.append(wrong_count)
        duplicate = copy.deepcopy(valid); duplicate['jobs'][1]['id'] = duplicate['jobs'][0]['id']; variants.append(duplicate)
        for key, bad in [('run_id', 99), ('status', 'queued'), ('conclusion', 'cancelled'), ('name', 'unexpected job')]:
            changed = copy.deepcopy(valid); changed['jobs'][1][key] = bad; variants.append(changed)
        for index, value in enumerate(variants):
            with self.subTest(variant=index), self.assertRaises(SystemExit):
                self.jobs = value
                self.execute()
        self.jobs = valid

    def test_diverged_or_behind_source_is_not_an_approved_workflow_ancestor(self):
        for status in ['behind', 'diverged', None]:
            with self.subTest(status=status), self.assertRaises(SystemExit):
                self.comparison['status'] = status
                self.execute()

    def test_http_errors_invalid_json_and_oversized_responses_do_not_disclose_body_or_token(self):
        cases = [urllib.error.HTTPError('https://api.github.com/', 403, PRIVATE_BODY + SYNTHETIC_TOKEN,
                                        {}, io.BytesIO(PRIVATE_BODY.encode())),
                 PRIVATE_BODY.encode(), b'x' * 3_000_001]
        for value in cases:
            with self.subTest(kind=type(value).__name__), self.assertRaisesRegex(SystemExit, 'konnte nicht gelesen'):
                self.failure = value
                self.execute()

    def test_github_opener_explicitly_refuses_redirects(self):
        self.execute()
        self.assertEqual(len(self.handlers), 1)
        handler = self.handlers[0]
        self.assertIsInstance(handler, urllib.request.HTTPRedirectHandler)
        self.assertIsNone(handler.redirect_request(None, None, 302, 'redirect', {}, 'https://untrusted.invalid/token'))


class HandoffTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'scripts').mkdir()
        self.input = self.root / 'anker-play-input'
        self.input.mkdir()
        self.publisher = self.root / 'scripts/google-play-upload.py'
        self.auth = self.root / 'scripts/google-play-auth.py'
        self.publisher.write_text('# synthetic publisher; never executed\n')
        self.auth.write_text('# synthetic authentication; never executed\n')
        self.bundle = self.input / 'Anker.aab'
        self.manifest_path = self.input / 'PLAY_UPLOAD_APPROVAL.json'
        self.manifest = copy.deepcopy(APPROVAL)
        self.bundle.write_bytes(b'SYNTHETIC PUBLIC BUNDLE DATA; NOT AN ANDROID APP')
        self.output = self.root / 'step-output'
        self.set_manifest_bundle()
        self.bindings = self.bind()

    def set_manifest_bundle(self):
        self.manifest['artifact'].update(bytes=self.bundle.stat().st_size, sha256=digest(self.bundle))
        self.manifest_path.write_text(json.dumps(self.manifest))
        (self.root / 'docs').mkdir(exist_ok=True)
        (self.root / 'docs/PLAY_UPLOAD_APPROVAL.json').write_bytes(self.manifest_path.read_bytes())

    def bind(self):
        self.output.write_text('')
        env = {'GITHUB_OUTPUT': str(self.output)}
        with working_directory(self.root), patch.dict(os.environ, env, clear=True):
            exec(BIND, {})
        return dict(line.split('=', 1) for line in self.output.read_text().splitlines())

    def execute(self):
        env = {'RUNNER_TEMP': str(self.root),
               'EXPECTED_PUBLISHER_SHA256': self.bindings['publisher_sha256'],
               'EXPECTED_AUTH_SHA256': self.bindings['auth_sha256'],
               'EXPECTED_MANIFEST_SHA256': self.bindings['manifest_sha256']}
        output = io.StringIO()
        with working_directory(self.root), patch.dict(os.environ, env, clear=True), \
                patch('urllib.request.urlopen', side_effect=AssertionError('Authentication/network forbidden')), \
                patch('urllib.request.build_opener', side_effect=AssertionError('Authentication/network forbidden')), \
                contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            exec(HANDOFF, {})
        self.assertNotIn(SYNTHETIC_TOKEN, output.getvalue())
        return output.getvalue()

    def test_valid_two_file_handoff_is_bound_to_actual_preflight_outputs(self):
        self.assertEqual(set(self.bindings), {'publisher_sha256', 'auth_sha256', 'manifest_sha256'})
        self.assertEqual(self.bindings['publisher_sha256'], digest(self.publisher))
        self.assertEqual(self.bindings['auth_sha256'], digest(self.auth))
        self.assertEqual(self.bindings['manifest_sha256'], digest(self.manifest_path))
        self.assertIn('vor der Authentifizierung', self.execute())

    def test_expected_bundle_size_and_hash_come_from_the_bound_manifest(self):
        self.bundle.write_bytes(b'ANOTHER SYNTHETIC PAYLOAD WITH A DIFFERENT SIZE AND HASH')
        self.set_manifest_bundle()
        self.bindings = self.bind()
        self.execute()

    def test_changed_publisher_or_auth_script_fails_before_authentication(self):
        for path in [self.publisher, self.auth]:
            with self.subTest(path=path.name):
                original = path.read_bytes()
                path.write_bytes(original + b'# tampered\n')
                with self.assertRaisesRegex(SystemExit, 'Werkzeuge oder das Manifest'):
                    self.execute()
                path.write_bytes(original)

    def test_changed_manifest_cannot_substitute_a_different_bundle(self):
        self.bundle.write_bytes(b'CHANGED SYNTHETIC DATA')
        self.set_manifest_bundle()
        with self.assertRaisesRegex(SystemExit, 'Werkzeuge oder das Manifest'):
            self.execute()

    def test_same_size_bundle_corruption_and_truncated_bundle_are_rejected(self):
        original = self.bundle.read_bytes()
        for data in [b'X' + original[1:], original[:-1]]:
            with self.subTest(size=len(data)), self.assertRaisesRegex(SystemExit, 'geprüfte signierte'):
                self.bundle.write_bytes(data)
                self.execute()

    def test_extra_missing_or_directory_entries_are_rejected(self):
        extra = self.input / 'unexpected.json'; extra.write_text('{}')
        with self.assertRaisesRegex(SystemExit, 'nur Bundle'):
            self.execute()
        extra.unlink()
        original = self.bundle.read_bytes(); self.bundle.unlink()
        with self.assertRaisesRegex(SystemExit, 'nur Bundle'):
            self.execute()
        self.bundle.mkdir()
        with self.assertRaisesRegex(SystemExit, 'unerlaubte Datei'):
            self.execute()
        self.bundle.rmdir(); self.bundle.write_bytes(original)

    def test_symlinks_are_rejected_even_when_the_file_bytes_and_hash_match(self):
        for path in [self.bundle, self.manifest_path, self.publisher, self.auth]:
            with self.subTest(path=path.name):
                original = path.read_bytes()
                target = self.root / ('target-' + path.name); target.write_bytes(original)
                path.unlink(); path.symlink_to(target)
                with self.assertRaises(SystemExit):
                    self.execute()
                path.unlink(); path.write_bytes(original)

    def test_missing_preflight_hash_never_falls_back_to_unbound_local_files(self):
        for name in list(self.bindings):
            with self.subTest(name=name):
                original = self.bindings[name]; self.bindings[name] = ''
                with self.assertRaises(SystemExit):
                    self.execute()
                self.bindings[name] = original


class WorkflowShapeTests(unittest.TestCase):
    def test_manual_main_gate_and_single_marked_push_are_explicit(self):
        header = WORKFLOW.split('\njobs:', 1)[0]
        triggers = header.split('\non:\n', 1)[1].split('\npermissions:', 1)[0]
        self.assertEqual(set(re.findall(r'(?m)^  ([a-z_]+):', triggers)), {'workflow_dispatch', 'push'})
        self.assertRegex(header, r'(?m)^  workflow_dispatch:\s*$')
        self.assertRegex(header, r'(?m)^  push:\s*\n    branches: \[main\]\n    paths: \[\x27.github/workflows/google-play-upload.yml\x27\]')
        self.assertNotRegex(header, r'(?m)^  (?:pull_request|pull_request_target|workflow_run|schedule):')
        preflight = WORKFLOW.split('\n  preflight:', 1)[1].split('\n  upload:', 1)[0]
        self.assertIn("github.repository == 'frnkrm/anker'", preflight)
        self.assertIn("github.ref == 'refs/heads/main'", preflight)
        self.assertIn("github.event_name == 'workflow_dispatch'", preflight)
        self.assertIn("github.event_name == 'push'", preflight)
        self.assertEqual(preflight.count("contains(github.event.head_commit.message, '[anker-play-draft]')"), 1)
        self.assertIn('cancel-in-progress: false', header)

    def test_secret_json_and_access_token_are_scoped_to_their_only_consuming_steps(self):
        blocks = re.split(r'(?m)^      - ', WORKFLOW)[1:]
        json_consumers = [block for block in blocks if re.search(r'(?m)^          GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:', block)]
        token_consumers = [block for block in blocks if re.search(r'(?m)^          GOOGLE_PLAY_ACCESS_TOKEN:', block)]
        self.assertEqual(len(json_consumers), 1)
        self.assertTrue(json_consumers[0].startswith('name: Nur für Google Play authentifizieren\n'))
        self.assertIn('${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON }}', json_consumers[0])
        self.assertEqual(len(token_consumers), 1)
        self.assertTrue(token_consumers[0].startswith('name: Ausschließlich internen Entwurf speichern\n'))
        self.assertIn('${{ steps.auth.outputs.access_token }}', token_consumers[0])
        secret_references = [block for block in blocks if 'secrets.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON' in block]
        self.assertEqual(len(secret_references), 2)
        self.assertEqual({block.splitlines()[0] for block in secret_references}, {
            'name: Verfügbarkeit des Google-Secrets prüfen',
            'name: Nur für Google Play authentifizieren',
        })
        self.assertEqual(WORKFLOW.count('${{ steps.auth.outputs.access_token }}'), 1)
        self.assertNotIn('secrets.', WORKFLOW.split('\n  preflight:', 1)[1].split('\n  upload:', 1)[0])
        self.assertNotIn('GITHUB_ENV', WORKFLOW)
        self.assertNotIn('GOOGLE_APPLICATION_CREDENTIALS', WORKFLOW)

    def test_handoff_validation_precedes_secret_access_and_only_two_public_tools_are_checked_out(self):
        order = ['Werkzeugidentität und Bundledaten vor Authentifizierung prüfen',
                 'Verfügbarkeit des Google-Secrets prüfen', 'Nur für Google Play authentifizieren',
                 'Ausschließlich internen Entwurf speichern']
        positions = [WORKFLOW.index('      - name: ' + name) for name in order]
        self.assertEqual(positions, sorted(positions))
        upload = WORKFLOW.split('\n  upload:', 1)[1]
        self.assertRegex(upload, r'(?m)^    needs: preflight$')
        self.assertIn('artifact-ids: ${{ needs.preflight.outputs.artifact_id }}', upload)
        sparse = upload.split('          sparse-checkout: |\n', 1)[1].split('\n      - ', 1)[0]
        self.assertEqual([line.strip() for line in sparse.splitlines()], ['/scripts/google-play-upload.py', '/scripts/google-play-auth.py'])
        self.assertIn('persist-credentials: false', upload)

    def test_no_app_build_write_permissions_or_production_release_are_added(self):
        self.assertIn('\npermissions: {}\n', WORKFLOW)
        permission_blocks = re.findall(r'(?m)^    permissions:\n((?:      [^\n]+\n)+)', WORKFLOW)
        self.assertEqual(len(permission_blocks), 2)
        for block in permission_blocks:
            self.assertEqual(set(line.strip() for line in block.splitlines()), {'contents: read', 'actions: read'})
        self.assertNotRegex(WORKFLOW, r'\b(?:gradlew|assembleRelease|bundleRelease|npm|production|id-token)\b')
        self.assertEqual(APPROVAL['track'], 'internal')
        self.assertEqual(APPROVAL['releaseStatus'], 'draft')
        self.assertIs(APPROVAL['changesNotSentForReview'], True)
        self.assertEqual(APPROVAL['changesInReviewBehavior'], 'ERROR_IF_IN_REVIEW')

    def test_secret_availability_boolean_is_checked_without_reading_the_json(self):
        for present in ['false', '', None, 'TRUE']:
            env = {} if present is None else {'ANKER_PLAY_SECRET_PRESENT': present}
            with self.subTest(present=present), patch.dict(os.environ, env, clear=True), self.assertRaises(SystemExit):
                exec(SECRET_PRESENT, {})
        with patch.dict(os.environ, {'ANKER_PLAY_SECRET_PRESENT': 'true'}, clear=True), contextlib.redirect_stdout(io.StringIO()):
            exec(SECRET_PRESENT, {})


class UploadResultTests(unittest.TestCase):
    def execute(self, result, returncode):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            captured = io.StringIO()

            def invoke(arguments):
                self.assertEqual(arguments[1:3], ['scripts/google-play-upload.py', 'upload'])
                self.assertEqual(arguments[3:], ['--manifest', str(root / 'anker-play-input/PLAY_UPLOAD_APPROVAL.json'),
                    '--bundle', str(root / 'anker-play-input/Anker.aab'), '--report', str(root / 'anker-play-result.json')])
                if result is not None:
                    (root / 'anker-play-result.json').write_text(json.dumps(result))
                return SimpleNamespace(returncode=returncode)

            with patch.dict(os.environ, {'RUNNER_TEMP': directory}, clear=True), \
                 patch('subprocess.run', side_effect=invoke), contextlib.redirect_stdout(captured), \
                 self.assertRaises(SystemExit) as outcome:
                exec(UPLOAD_RESULT, {})
            return outcome.exception.code, captured.getvalue()

    def test_only_a_successful_process_and_verified_persisted_draft_emit_success(self):
        for status in ['already-draft', 'draft-committed']:
            with self.subTest(status=status):
                code, output = self.execute({'status': status, 'draftVerified': True}, 0)
                self.assertEqual(code, 0)
                self.assertIn('::notice title=Anker Play Upload::Entwurf bestätigt', output)
        for result in [{'status': 'prepared', 'draftVerified': True}, {'status': 'draft-committed', 'draftVerified': False}]:
            code, output = self.execute(result, 0)
            self.assertEqual(code, 2)
            self.assertNotIn('::notice', output)

    def test_error_annotation_contains_safe_codes_and_never_remote_text_or_token(self):
        code, output = self.execute({'status': 'failed', 'reason': 'HTTP_FORBIDDEN', 'httpStatus': 403,
                                    'instructions': PRIVATE_BODY, 'token': SYNTHETIC_TOKEN}, 2)
        self.assertEqual(code, 2)
        self.assertIn('Grund HTTP_FORBIDDEN; HTTP 403', output)
        self.assertNotIn(PRIVATE_BODY, output)
        self.assertNotIn(SYNTHETIC_TOKEN, output)
        code, output = self.execute({'status': 'failed', 'reason': 'HTTP_ERROR\n' + SYNTHETIC_TOKEN,
                                    'httpStatus': '403\n' + PRIVATE_BODY}, 2)
        self.assertEqual(code, 2)
        self.assertIn('Grund NO_CONFIRMED_RESULT; HTTP unknown', output)
        self.assertNotIn(PRIVATE_BODY, output)
        self.assertNotIn(SYNTHETIC_TOKEN, output)

    def test_ambiguous_commit_is_reported_as_inconclusive_without_success_notice(self):
        code, output = self.execute({'status': 'inconclusive', 'reason': 'COMMIT_RESULT_UNKNOWN'}, 3)
        self.assertEqual(code, 3)
        self.assertIn('Status inconclusive', output)
        self.assertNotIn('::notice', output)

    def test_absent_report_is_failure_even_when_the_process_exit_code_is_zero(self):
        code, output = self.execute(None, 0)
        self.assertEqual(code, 2)
        self.assertIn('NO_CONFIRMED_RESULT', output)

    def test_conflict_observation_exposes_only_bounded_status_and_numeric_versions(self):
        observation = {'trackMatches': True, 'releasesShape': 'list', 'truncated': False,
                       'releases': [{'status': 'completed', 'versionCodes': [15]},
                                    {'status': 'draft', 'versionCodes': [16]}]}
        code, output = self.execute({'status': 'failed', 'reason': 'EXISTING_RELEASE_CONFLICT',
                                    'trackObservation': observation}, 2)
        self.assertEqual(code, 2)
        prefix = '::notice title=Anker Play Bestandsprüfung::'
        line = next(line for line in output.splitlines() if line.startswith(prefix))
        self.assertEqual(json.loads(line.removeprefix(prefix)), observation)
        self.assertNotIn('Entwurf bestätigt', output)

    def test_conflict_observation_never_echoes_remote_fields_or_hostile_values(self):
        observation = {'trackMatches': SYNTHETIC_TOKEN, 'releasesShape': PRIVATE_BODY, 'truncated': PRIVATE_BODY,
                       'token': SYNTHETIC_TOKEN, 'releases': [
                           {'status': PRIVATE_BODY, 'versionCodes': [SYNTHETIC_TOKEN, True, 0, -1, 2100000001, 16],
                            'name': PRIVATE_BODY, 'releaseNotes': [SYNTHETIC_TOKEN]}] * 20}
        code, output = self.execute({'status': 'failed', 'reason': 'EXISTING_RELEASE_CONFLICT',
                                    'trackObservation': observation}, 2)
        self.assertEqual(code, 2)
        self.assertNotIn(PRIVATE_BODY, output)
        self.assertNotIn(SYNTHETIC_TOKEN, output)
        prefix = '::notice title=Anker Play Bestandsprüfung::'
        line = next(line for line in output.splitlines() if line.startswith(prefix))
        safe = json.loads(line.removeprefix(prefix))
        self.assertEqual(safe, {'trackMatches': False, 'releasesShape': 'invalid', 'truncated': True,
                               'releases': [{'status': 'unknown', 'versionCodes': [16]}] * 6})

    def test_verified_existing_active_bundle_is_success_without_claiming_a_new_draft(self):
        result = {'status': 'already-active', 'activeReleaseVerified': True, 'bundleReused': True,
                  'existingReleaseStatus': 'completed', 'commitAttempted': False,
                  'bundleUploadConfirmed': False, 'publishedByThisRun': False}
        code, output = self.execute(result, 0)
        self.assertEqual(code, 0)
        self.assertIn('Bereits vorhanden bestätigt', output)
        self.assertIn('identisches geprüftes Bundle', output)
        self.assertIn('kein neuer Upload oder Release', output)
        self.assertNotIn('Entwurf bestätigt', output)

    def test_existing_active_success_needs_every_readonly_identity_and_process_confirmation(self):
        result = {'status': 'already-active', 'activeReleaseVerified': True, 'bundleReused': True,
                  'existingReleaseStatus': 'completed', 'commitAttempted': False,
                  'bundleUploadConfirmed': False, 'publishedByThisRun': False}
        for key, bad in [('activeReleaseVerified', False), ('bundleReused', False),
                         ('existingReleaseStatus', 'inProgress'), ('commitAttempted', True),
                         ('bundleUploadConfirmed', True), ('publishedByThisRun', True)]:
            with self.subTest(field=key):
                changed = {**result, key: bad}
                code, output = self.execute(changed, 0)
                self.assertEqual(code, 2)
                self.assertNotIn('Bereits vorhanden bestätigt', output)
        code, output = self.execute(result, 2)
        self.assertEqual(code, 2)
        self.assertNotIn('Bereits vorhanden bestätigt', output)


if __name__ == '__main__':
    unittest.main(verbosity=2)
