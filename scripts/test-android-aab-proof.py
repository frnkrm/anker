"""Offline protocol tests. Synthetic non-keys and process/API fakes only."""
import base64
import copy
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import stat
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import urllib.error
import zipfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('aab_proof', ROOT / 'scripts/android-aab-proof.py')
P = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(P)
W = 'a' * 40
APP = {'applicationId': 'de.frnkrm.anker.mobile', 'versionCode': 18, 'versionName': '1.5.0-rc.4',
       'sdk': {'min': 26, 'target': 36, 'compile': 36}, 'manifestSHA256': 'b' * 64, 'permissions': []}


def env(mode='sign'):
    inputs = dict(mode=mode, source_commit=P.SOURCE, expected_workflow_commit=W,
                  prepare_run_id='8100', prepare_run_attempt='2', unsigned_artifact_id='8400',
                  expected_unsigned_sha256='b' * 64, expected_proof_sha256='c' * 64)
    if mode == 'prepare':
        inputs.update({k: '' for k in P.SIGN_FIELDS})
    return {'GITHUB_ACTIONS': 'true', 'GITHUB_REPOSITORY': P.REPO, 'GITHUB_EVENT_NAME': 'workflow_dispatch',
            'GITHUB_REF': 'refs/heads/main', 'GITHUB_WORKFLOW_SHA': W, 'GITHUB_SHA': W,
            'GITHUB_RUN_ID': '9100', 'GITHUB_RUN_ATTEMPT': '1', 'AAB_INPUTS': json.dumps(inputs)}


def run(commit=W, event='push', path=P.CI, id=9000, attempt=1, completed=True):
    now = datetime.now(timezone.utc)
    return {'id': id, 'run_attempt': attempt, 'repository': {'full_name': P.REPO, 'id': 77},
            'head_repository': {'full_name': P.REPO, 'id': 77}, 'head_sha': commit, 'head_branch': 'main',
            'event': event, 'path': path, 'status': 'completed' if completed else 'in_progress',
            'conclusion': 'success' if completed else None,
            'run_started_at': (now - timedelta(minutes=8)).isoformat(),
            'updated_at': (now - timedelta(minutes=6)).isoformat()}


def context(mode='sign'):
    ctx = P.invocation(env(mode))
    ctx.update(sourceCI=P.ci_from_run(run(P.SOURCE, id=44144640024), P.SOURCE),
               workflowCI=P.ci_from_run(run(), W))
    return ctx


def zip_bytes(files):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w') as z:
        for name, value in files.items():
            z.writestr(name, value)
    return stream.getvalue()


def synthetic_bundle(path):
    elf = bytearray(120)
    elf[:6] = b'\x7fELF\x02\x01'
    struct.pack_into('<Q', elf, 32, 64)
    struct.pack_into('<HH', elf, 54, 56, 1)
    struct.pack_into('<IIQQQQQQ', elf, 64, 1, 0, 0, 0, 0, 120, 120, 16384)
    path.write_bytes(zip_bytes({'BundleConfig.pb': b'configuration', 'base/manifest/AndroidManifest.xml': b'proto',
       'base/resources.pb': b'resources', 'base/assets/public/index.html': b'viewport-fit=contain',
       'base/assets/public/main.js': P.FINGERPRINT.encode(), 'base/lib/arm64-v8a/test.so': bytes(elf)}))


def proof_for(bundle, ctx):
    return {'schemaVersion': 1, 'kind': 'anker-code18-unsigned', 'sourceCommit': P.SOURCE,
      'sourceFingerprint': P.FINGERPRINT, 'workflowCommit': W, 'sourceCI': ctx['sourceCI'],
      'workflowCI': ctx['workflowCI'], 'prepareRun': {'id': 8100, 'attempt': 2}, 'reference': P.REFERENCE,
      'application': APP, 'bundle': {'sha256': P.sha(bundle.read_bytes()), 'bytes': bundle.stat().st_size,
          'entries': P.safe_zip(bundle)}, 'checks': {'bundletool': True, 'jarUnsigned': True, 'assets': True, 'elf64': 1},
      'tools': {'bundletool': '1.18.1', 'toolLockSHA256': P.sha((ROOT / 'scripts/android-aab-tools.json').read_bytes())}}


class FakeAPI:
    def __init__(self, archive=b'archive'):
        self.rows = {'/compare/' + P.SOURCE + '...main': {'status': 'ahead', 'merge_base_commit': {'sha': P.SOURCE}},
                     '/compare/' + W + '...main': {'status': 'identical', 'merge_base_commit': {'sha': W}},
                     '/actions/runs/44144640024': run(P.SOURCE, id=44144640024), '/actions/runs/9000': run(),
                     '/actions/workflows/ci.yml/runs?head_sha=' + W + '&event=push&status=success&per_page=100': {'workflow_runs': [run()]}}
        prepare = run(event='workflow_dispatch', path=P.WORKFLOW, id=8100, attempt=2)
        self.rows['/actions/runs/8100'] = prepare
        self.rows['/actions/runs/8100/attempts/2'] = copy.deepcopy(prepare)
        self.rows['/actions/artifacts/8400'] = {'id': 8400, 'name': 'anker-code18-unsigned-8100-2',
             'expired': False, 'size_in_bytes': len(archive), 'digest': 'sha256:' + P.sha(archive),
             'created_at': (datetime.now(timezone.utc) - timedelta(minutes=7)).isoformat(),
             'workflow_run': {'id': 8100, 'head_sha': W, 'head_branch': 'main', 'repository_id': 77, 'head_repository_id': 77}}
        self.body = archive
        self.calls = []

    def get(self, path):
        self.calls.append(path)
        return copy.deepcopy(self.rows[path])

    def archive(self, id):
        if id != 8400:
            raise AssertionError('Unexpected artifact request')
        return self.body


class ProtocolTests(unittest.TestCase):
    def setUp(self):
        self.network = patch('urllib.request.OpenerDirector.open', side_effect=AssertionError('NETWORK_FORBIDDEN'))
        self.network.start()
        self.addCleanup(self.network.stop)

    def test_manual_main_only(self):
        good = env('prepare')
        self.assertEqual(P.invocation(good)['sourceCommit'], P.SOURCE)
        for key, value in [('GITHUB_ACTIONS', 'false'), ('GITHUB_REPOSITORY', 'other/repo'),
                           ('GITHUB_EVENT_NAME', 'push'), ('GITHUB_EVENT_NAME', 'pull_request'),
                           ('GITHUB_REF', 'refs/heads/dev'), ('GITHUB_WORKFLOW_SHA', P.SOURCE), ('GITHUB_SHA', P.SOURCE)]:
            with self.subTest(key=key, value=value), self.assertRaises(P.ProofError):
                P.invocation(dict(good, **{key: value}))

    def test_source_workflow_and_mode_inputs(self):
        for key, value in [('source_commit', 'd' * 40), ('expected_workflow_commit', ''),
                           ('mode', 'auto'), ('prepare_run_id', '8100')]:
            e = env('prepare'); values = json.loads(e['AAB_INPUTS']); values[key] = value; e['AAB_INPUTS'] = json.dumps(values)
            with self.subTest(key=key), self.assertRaises(P.ProofError): P.invocation(e)

    def test_prepare_accepts_all_optional_binding_presence_combinations(self):
        # Optional empty workflow inputs need not be present in the JSON object.
        # These synthetic representations do not establish the failed run's input.
        canonical = env('prepare')
        expected = P.invocation(canonical)
        for mask in range(1 << len(P.SIGN_FIELDS)):
            values = json.loads(canonical['AAB_INPUTS'])
            for bit, key in enumerate(P.SIGN_FIELDS):
                if not mask & (1 << bit):
                    del values[key]
            e = dict(canonical, AAB_INPUTS=json.dumps(values))
            with self.subTest(present_mask=mask):
                self.assertEqual(P.invocation(e), expected)
                self.assertEqual(json.loads(e['AAB_INPUTS']), values)

    def test_input_schema_rejects_nonobjects_missing_required_and_unknown_keys(self):
        for mode in ('prepare', 'sign'):
            e = env(mode)
            full = json.loads(e['AAB_INPUTS'])
            cases = [None, [], '', True, 1, ['mode', 'source_commit', 'expected_workflow_commit']]
            cases += [{k: v for k, v in full.items() if k != required}
                      for required in ('mode', 'source_commit', 'expected_workflow_commit')]
            cases += [dict(full, unexpected=''), dict(full, prepare_run='')]
            for index, values in enumerate(cases):
                with self.subTest(mode=mode, case=index), self.assertRaisesRegex(P.ProofError, '^INVALID_SCHEMA$'):
                    P.invocation(dict(e, AAB_INPUTS=json.dumps(values)))

    def test_prepare_rejects_present_null_wrong_types_and_nonempty_bindings(self):
        for key in P.SIGN_FIELDS:
            for value in (None, False, True, 0, 1, [], {}, ' ', '8100'):
                # Cover both complete and otherwise-omitted optional fields.
                for complete in (True, False):
                    e = env('prepare')
                    values = json.loads(e['AAB_INPUTS'])
                    if not complete:
                        values = {k: v for k, v in values.items() if k not in P.SIGN_FIELDS}
                    values[key] = value
                    with self.subTest(key=key, type=type(value).__name__, complete=complete), self.assertRaises(P.ProofError):
                        P.invocation(dict(e, AAB_INPUTS=json.dumps(values)))

    def test_sign_never_defaults_any_missing_binding(self):
        e = env()
        full = json.loads(e['AAB_INPUTS'])
        for mask in range((1 << len(P.SIGN_FIELDS)) - 1):
            values = dict(full)
            for bit, key in enumerate(P.SIGN_FIELDS):
                if not mask & (1 << bit):
                    del values[key]
            with self.subTest(present_mask=mask), self.assertRaisesRegex(P.ProofError, '^INVALID_SCHEMA$'):
                P.invocation(dict(e, AAB_INPUTS=json.dumps(values)))
        for key in P.SIGN_FIELDS:
            for value in (None, False, True, 0, 1, [], {}, ''):
                with self.subTest(key=key, type=type(value).__name__), self.assertRaises(P.ProofError):
                    P.invocation(dict(e, AAB_INPUTS=json.dumps(dict(full, **{key: value}))))

    def test_optional_prepare_inputs_keep_required_values_and_manual_main_gates(self):
        e = env('prepare')
        values = {k: v for k, v in json.loads(e['AAB_INPUTS']).items() if k not in P.SIGN_FIELDS}
        e['AAB_INPUTS'] = json.dumps(values)
        for key in values:
            for value in (None, False, 0, [], {}, ''):
                with self.subTest(input=key, type=type(value).__name__), self.assertRaises(P.ProofError):
                    P.invocation(dict(e, AAB_INPUTS=json.dumps(dict(values, **{key: value}))))
        for key, value in [('GITHUB_ACTIONS', 'false'), ('GITHUB_REPOSITORY', 'other/repo'),
                           ('GITHUB_EVENT_NAME', 'push'), ('GITHUB_EVENT_NAME', 'pull_request'),
                           ('GITHUB_REF', 'refs/heads/dev'), ('GITHUB_WORKFLOW_SHA', P.SOURCE),
                           ('GITHUB_SHA', P.SOURCE), ('GITHUB_RUN_ATTEMPT', '0')]:
            with self.subTest(env_key=key), self.assertRaises(P.ProofError):
                P.invocation(dict(e, **{key: value}))

    def test_optional_prepare_inputs_keep_separate_ci_and_context_checks(self):
        e = env('prepare')
        values = {k: v for k, v in json.loads(e['AAB_INPUTS']).items() if k not in P.SIGN_FIELDS}
        e['AAB_INPUTS'] = json.dumps(values)
        canonical_api, omitted_api = FakeAPI(), FakeAPI()
        expected = P.resolve(env('prepare'), canonical_api)
        self.assertEqual(P.resolve(e, omitted_api), expected)
        self.assertEqual(omitted_api.calls, canonical_api.calls)
        for ci_path in ('/actions/runs/44144640024', '/actions/runs/9000'):
            for field, value in [('head_sha', 'd' * 40), ('head_branch', 'dev'), ('event', 'pull_request'),
                                 ('conclusion', 'failure'), ('status', 'in_progress')]:
                api = FakeAPI(); api.rows[ci_path][field] = value
                with self.subTest(ci_path=ci_path, field=field), self.assertRaises(P.ProofError):
                    P.resolve(e, api)
        self.assertEqual(P.context(dict(e, AAB_CONTEXT=json.dumps(expected))), expected)
        for field, value in [('sourceCommit', W), ('workflowCommit', P.SOURCE),
                             ('run', {'id': 9100, 'attempt': 2}), ('unexpected', '')]:
            bad = dict(expected, **{field: value})
            with self.subTest(context_field=field), self.assertRaises(P.ProofError):
                P.context(dict(e, AAB_CONTEXT=json.dumps(bad)))

    def test_invalid_input_shape_stops_cli_before_github_construction(self):
        for values in (None, [], {}, dict(json.loads(env('prepare')['AAB_INPUTS']), unexpected='')):
            e = dict(env('prepare'), AAB_INPUTS=json.dumps(values))
            with self.subTest(type=type(values).__name__), patch.dict(os.environ, e, clear=True), \
                 patch.object(P, 'GitHub', side_effect=AssertionError('API_MUST_NOT_BE_CONSTRUCTED')) as api, \
                 self.assertRaisesRegex(P.ProofError, '^INVALID_SCHEMA$'):
                P.main(['resolve'])
            api.assert_not_called()

    def test_sign_requires_all_explicit_ids_and_hashes(self):
        for key in P.SIGN_FIELDS:
            e = env(); values = json.loads(e['AAB_INPUTS']); values[key] = ''; e['AAB_INPUTS'] = json.dumps(values)
            with self.subTest(key=key), self.assertRaises(P.ProofError): P.invocation(e)
        for value in ['0', '-1', '01', 'latest', '1.0', '1\n2', True]:
            with self.subTest(value=value), self.assertRaises(P.ProofError): P.number(value)

    def test_sign_rerun_requires_new_explicit_dispatch_but_prepare_attempt_is_bound(self):
        e = dict(env(), GITHUB_RUN_ATTEMPT='2')
        with self.assertRaisesRegex(P.ProofError, 'SIGN_REDISPATCH_REQUIRED'):P.invocation(e)
        self.assertEqual(P.invocation(dict(env('prepare'), GITHUB_RUN_ATTEMPT='2'))['run']['attempt'], 2)

    def test_json_strictness(self):
        for raw in ['{"a":1,"a":2}', '{"a":NaN}', '{bad', 'x' * (P.JSON_LIMIT + 1)]:
            with self.subTest(raw=raw[:30]), self.assertRaises(P.ProofError): P.json_load(raw)

    def test_resolve_two_independent_exact_ci_gates(self):
        result = P.resolve(env(), FakeAPI())
        self.assertEqual(result['sourceCI']['headSha'], P.SOURCE)
        self.assertEqual(result['workflowCI']['headSha'], W)
        for field, value in [('head_sha', W), ('head_branch', 'dev'), ('event', 'pull_request'),
                             ('path', P.WORKFLOW), ('status', 'in_progress'), ('conclusion', 'failure')]:
            api = FakeAPI(); api.rows['/actions/runs/44144640024'][field] = value
            with self.subTest(field=field), self.assertRaises(P.ProofError): P.resolve(env(), api)

    def test_old_app_source_is_rejected_before_any_api_request(self):
        e = env('prepare'); values = json.loads(e['AAB_INPUTS'])
        values['source_commit'] = '10cc894a27302a5a49b6884c843d2a6b509ab354'
        e['AAB_INPUTS'] = json.dumps(values); api = FakeAPI()
        with self.assertRaisesRegex(P.ProofError, 'SOURCE_WORKFLOW_MISMATCH'): P.resolve(e, api)
        self.assertEqual(api.calls, [])

    def test_old_main_ci_cannot_prove_the_integrated_wake_fix(self):
        api = FakeAPI()
        key = '/actions/runs/44144640024'
        api.rows[key] = run('10cc894a27302a5a49b6884c843d2a6b509ab354', id=43601398931)
        with self.assertRaisesRegex(P.ProofError, 'RUN_IDENTITY'): P.resolve(env(), api)

    def test_workflow_ci_cannot_replace_source_ci_or_use_wrong_repository(self):
        api = FakeAPI(); api.rows['/actions/runs/44144640024'] = run()
        with self.assertRaises(P.ProofError): P.resolve(env(), api)
        for field in ['repository', 'head_repository']:
            api = FakeAPI(); api.rows['/actions/runs/9000'][field]['id'] = 0
            with self.subTest(field=field), self.assertRaises(P.ProofError): P.resolve(env(), api)

    def test_no_docs_or_failed_workflow_ci_exception(self):
        api = FakeAPI(); key = next(k for k in api.rows if k.startswith('/actions/workflows/'))
        api.rows[key]['workflow_runs'] = [dict(run(), conclusion='failure')]
        with self.assertRaises(P.ProofError): P.resolve(env(), api)
        api = FakeAPI(); api.rows['/compare/' + P.SOURCE + '...main']['merge_base_commit']['sha'] = W
        with self.assertRaises(P.ProofError): P.resolve(env(), api)

    def test_context_rejects_tampering_and_attempt_change(self):
        ctx = context(); e = env(); e['AAB_CONTEXT'] = json.dumps(ctx)
        self.assertEqual(P.context(e), ctx)
        for field, value in [('sourceCommit', W), ('workflowCommit', P.SOURCE), ('run', {'id': 9100, 'attempt': 2})]:
            bad = copy.deepcopy(ctx); bad[field] = value; e['AAB_CONTEXT'] = json.dumps(bad)
            with self.subTest(field=field), self.assertRaises(P.ProofError): P.context(e)

    def test_artifact_identity_attempt_digest_and_time(self):
        def check(api):return P.artifact_metadata(api, 8400, 8100, 2, W, 'anker-code18-unsigned-8100-2')
        self.assertEqual(check(FakeAPI())['id'], 8400)
        changes = [('name', 'latest'), ('id', 8401), ('expired', True), ('digest', 'b' * 64),
                   ('created_at', '2020-01-01T00:00:00Z'), ('size_in_bytes', P.LIMIT + 1)]
        for field, value in changes:
            api = FakeAPI(); api.rows['/actions/artifacts/8400'][field] = value
            with self.subTest(field=field), self.assertRaises(P.ProofError): check(api)
        for path in ['/actions/runs/8100', '/actions/runs/8100/attempts/2']:
            api = FakeAPI(); api.rows[path]['run_attempt'] = 3
            with self.subTest(path=path), self.assertRaises(P.ProofError): check(api)
        api = FakeAPI(); api.rows['/actions/artifacts/8400']['workflow_run']['head_sha'] = P.SOURCE
        with self.assertRaises(P.ProofError): check(api)

    def test_zip_paths_duplicates_types_expansion_and_exact_handoff(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'test.zip'
            for name in ['../escape', '/absolute', 'a/../b', 'a//b', 'a\\b', 'C:/file', 'a\nb']:
                path.write_bytes(zip_bytes({name: b'x'}))
                with self.subTest(name=name), self.assertRaises(P.ProofError): P.safe_zip(path)
            for mode in [stat.S_IFLNK, stat.S_IFIFO, stat.S_IFCHR]:
                with zipfile.ZipFile(path, 'w') as z:
                    info = zipfile.ZipInfo('file'); info.external_attr = (mode | 0o600) << 16; z.writestr(info, 'x')
                with self.subTest(mode=mode), self.assertRaises(P.ProofError): P.safe_zip(path)
            path.write_bytes(zip_bytes({'file': b'long'}))
            with self.assertRaises(P.ProofError): P.safe_zip(path, limit=3)
            for files in [{'unsigned.aab': b'x', 'proof.json': b'{}', 'execute.py': b'evil'}, {'sub/unsigned.aab': b'x'}]:
                with self.assertRaises(P.ProofError): P.extract_data(zip_bytes(files), Path(tmp) / 'output', ['unsigned.aab', 'proof.json'])
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter('ignore')
                with zipfile.ZipFile(path, 'w') as z: z.writestr('same', 'a'); z.writestr('same', 'b')
            with self.assertRaises(P.ProofError): P.safe_zip(path)

    def test_signature_whitelist_not_all_meta_inf(self):
        payload = {'base/dex/classes.dex': {}, 'META-INF/services/service': {}}
        signed = dict(payload, **{k: {} for k in ['META-INF/MANIFEST.MF', 'META-INF/ANKER.SF', 'META-INF/ANKER.RSA']})
        self.assertEqual(len(P.signature_names(signed, True)), 3)
        for name in ['META-INF/OTHER.SF', 'META-INF/OTHER.RSA', 'META-INF/anker.sf', 'META-INF/SIG-UNKNOWN']:
            with self.subTest(name=name), self.assertRaises(P.ProofError): P.signature_names(dict(signed, **{name: {}}), True)
        with self.assertRaises(P.ProofError): P.signature_names(signed, False)

    def test_fixed_app_post_sync_fingerprint_is_accepted_with_valid_native_library(self):
        # Observed through the existing Vite hook on app 0c31179 after pinned
        # Capacitor sync, including its generated res/xml/config.xml. Deliberately
        # independent of P.FINGERPRINT so a pre-sync policy pin fails this case.
        post_sync = b'f595199f70ff101f11a164156d96f55d941f1a40ce756e284419640bb31f64ec'
        with tempfile.TemporaryDirectory() as tmp:
            bundle = Path(tmp) / 'synthetic.aab'; synthetic_bundle(bundle)
            with zipfile.ZipFile(bundle) as z: files = {n: z.read(n) for n in z.namelist()}
            files['base/assets/public/main.js'] = b'const BUILD_FINGERPRINT="' + post_sync + b'";'
            bundle.write_bytes(zip_bytes(files))
            self.assertEqual(P.native_and_identity(bundle), 1)

    def test_source_identity_and_native_presence_fail_independently(self):
        with tempfile.TemporaryDirectory() as tmp:
            bundle = Path(tmp) / 'synthetic.aab'; synthetic_bundle(bundle)
            with zipfile.ZipFile(bundle) as z: files = {n: z.read(n) for n in z.namelist()}
            for marker in [b'wrong-source', b'4f8a7b5add918138f3dadcfe84fc8f16c818ad8610481dd6b1b56f035923efc1']:
                bundle.write_bytes(zip_bytes(dict(files, **{'base/assets/public/main.js': marker})))
                with self.subTest(marker=marker), self.assertRaisesRegex(P.ProofError, '^FINGERPRINT_MISMATCH$'):
                    P.native_and_identity(bundle)
            for native in [None, b'\x7fELF\x01\x01' + b'not-64-bit']:
                changed = {k: v for k, v in files.items() if not k.startswith('base/lib/')}
                if native is not None: changed['base/lib/armeabi-v7a/test.so'] = native
                bundle.write_bytes(zip_bytes(changed))
                with self.subTest(native=native), self.assertRaisesRegex(P.ProofError, '^NATIVE_MISSING$'):
                    P.native_and_identity(bundle)

    def test_native_alignment_is_not_relaxed_by_source_pin_correction(self):
        with tempfile.TemporaryDirectory() as tmp:
            bundle = Path(tmp) / 'synthetic.aab'; synthetic_bundle(bundle)
            with zipfile.ZipFile(bundle) as z: files = {n: z.read(n) for n in z.namelist()}
            native = bytearray(files['base/lib/arm64-v8a/test.so'])
            struct.pack_into('<Q', native, 112, 4096)
            files['base/lib/arm64-v8a/test.so'] = bytes(native)
            bundle.write_bytes(zip_bytes(files))
            with self.assertRaisesRegex(P.ProofError, '^ELF_ALIGNMENT$'): P.native_and_identity(bundle)

    def test_unsigned_payload_proof_and_u1_u2_separation(self):
        with tempfile.TemporaryDirectory() as tmp:
            bundle = Path(tmp) / 'unsigned.aab'; synthetic_bundle(bundle); ctx = context(); proof = proof_for(bundle, ctx)
            ctx['binding']['expected_unsigned_sha256'] = proof['bundle']['sha256']
            with patch.object(P, 'jar_report', return_value={'signed': False}), patch.object(P, 'inspect_bundle', return_value=APP):
                self.assertEqual(P.validate_unsigned(proof, bundle, ctx, 'cp', 'classes'), proof)
                self.assertNotEqual(proof['bundle']['sha256'], P.REFERENCE['sha256'])
                mutations = [('sourceCommit', W), ('workflowCommit', P.SOURCE), ('sourceFingerprint', 'd' * 64),
                             ('prepareRun', {'id': 8100, 'attempt': 1}), ('checks', dict(proof['checks'], assets=False))]
                for key, value in mutations:
                    bad = copy.deepcopy(proof); bad[key] = value
                    with self.subTest(key=key), self.assertRaises(P.ProofError): P.validate_unsigned(bad, bundle, ctx, 'cp', 'classes')
                bad = copy.deepcopy(proof); bad['bundle']['entries']['base/resources.pb']['sha256'] = 'e' * 64
                with self.assertRaises(P.ProofError): P.validate_unsigned(bad, bundle, ctx, 'cp', 'classes')

    def test_prepare_produces_json_roundtrip_proof_consumable_only_for_its_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); bundle = root / 'u.aab'; synthetic_bundle(bundle)
            dist = root / 'dist'; assets = root / 'android/app/src/main/assets/public'
            dist.mkdir(); assets.mkdir(parents=True)
            for name, body in [('index.html', b'viewport-fit=contain'), ('main.js', P.FINGERPRINT.encode())]:
                (dist / name).write_bytes(body); (assets / name).write_bytes(body)
            prepared = context('prepare'); prepared['run'] = {'id': 8100, 'attempt': 2}
            def command(args, **kwargs):return (P.SOURCE + '\n').encode() if 'rev-parse' in args else b''
            with patch.object(P, 'tool', side_effect=command), patch.object(P, 'jar_report'), patch.object(P, 'inspect_bundle', return_value=APP):
                produced = P.prepared_proof(prepared, bundle, root, 'cp', 'classes')
                produced = json.loads(json.dumps(produced))
                ctx = context(); ctx['binding']['expected_unsigned_sha256'] = produced['bundle']['sha256']
                self.assertEqual(P.validate_unsigned(produced, bundle, ctx, 'cp', 'classes')['prepareRun'], prepared['run'])
            with patch.object(P, 'tool', return_value=b'wrong-source\n'), self.assertRaisesRegex(P.ProofError, 'DIRTY_SOURCE'):
                P.prepared_proof(prepared, bundle, root, 'cp', 'classes')

    def test_manifest_checks_all_components_even_when_permission_count_unchanged(self):
        import xml.etree.ElementTree as ET
        a = 'http://schemas.android.com/apk/res/android'
        xml = ('<manifest xmlns:android="' + a + '" package="de.frnkrm.anker.mobile" android:versionCode="18" android:versionName="1.5.0-rc.4" android:compileSdkVersion="36">'
               '<uses-sdk android:minSdkVersion="26" android:targetSdkVersion="36"/>'
               '<uses-feature android:name="android.hardware.nfc" android:required="false"/>'
               '<uses-permission android:name="android.permission.NFC"/>' + ''.join('<uses-permission android:name="synthetic.' + str(i) + '"/>' for i in range(30)) +
               '<application android:allowBackup="false"><activity android:name="Synthetic" android:exported="false"/></application></manifest>').encode()
        def canon(e):return [e.tag, sorted(e.attrib.items()), [canon(c) for c in e]]
        digest = P.sha(json.dumps(canon(ET.fromstring(xml)), separators=(',', ':')).encode())
        with patch.object(P, 'MANIFEST_SHA256', digest), patch.object(P, 'tool', side_effect=[b'ok', xml]):
            self.assertEqual(P.inspect_bundle('synthetic.aab', 'cp')['versionCode'], 18)
        for bad in [xml.replace(b'synthetic.0', b'synthetic.DIFFERENT'), xml.replace(b'exported="false"', b'exported="true"'),
                    xml.replace(b'minSdkVersion="26"', b'minSdkVersion="25"')]:
            with self.subTest(bad=bad[-80:]), patch.object(P, 'MANIFEST_SHA256', digest), patch.object(P, 'tool', side_effect=[b'ok', bad]), self.assertRaises(P.ProofError):
                P.inspect_bundle('synthetic.aab', 'cp')

    def test_archive_digest_and_metadata_hash_are_independent(self):
        with tempfile.TemporaryDirectory() as tmp:
            bundle = Path(tmp) / 'u.aab'; synthetic_bundle(bundle); ctx = context(); proof = proof_for(bundle, ctx)
            raw = json.dumps(proof).encode(); outer = zip_bytes({'unsigned.aab': bundle.read_bytes(), 'proof.json': raw})
            ctx['binding'].update(expected_unsigned_sha256=proof['bundle']['sha256'], expected_proof_sha256=P.sha(raw))
            with patch.object(P, 'jar_report'), patch.object(P, 'inspect_bundle', return_value=APP):
                P.download_unsigned(ctx, FakeAPI(outer), Path(tmp) / 'valid', 'cp', 'classes')
                api = FakeAPI(outer); api.rows['/actions/artifacts/8400']['digest'] = 'sha256:' + proof['bundle']['sha256']
                with self.assertRaisesRegex(P.ProofError, 'ARCHIVE_HASH'): P.download_unsigned(ctx, api, Path(tmp) / 'archive-bad', 'cp', 'classes')
                bad = copy.deepcopy(ctx); bad['binding']['expected_proof_sha256'] = P.sha(outer)
                with self.assertRaisesRegex(P.ProofError, 'PROOF_HASH'): P.download_unsigned(bad, FakeAPI(outer), Path(tmp) / 'proof-bad', 'cp', 'classes')

    def test_no_partial_or_missing_secret_fallback(self):
        ctx = context()
        for count in range(4):
            fake = dict(env(), **dict(zip(P.SECRETS[:count], ['fake'] * count)))
            with self.subTest(count=count), patch.object(P, 'validate_receipt', return_value={}), patch.object(P, 'tool') as runner:
                with self.assertRaisesRegex(P.ProofError, 'SIGNING_VALUES_UNAVAILABLE'): P.sign(ctx, 'input', 'output', 'cp', 'classes', fake)
                runner.assert_not_called()

    def test_invalid_input_stops_before_reading_any_signing_value(self):
        class UnreadableValues(dict):
            def get(self, *args):raise AssertionError('Signing values must not be inspected')
        with patch.object(P, 'validate_receipt', side_effect=P.ProofError('PROOF_HASH')), patch.object(P, 'tool') as runner:
            with self.assertRaisesRegex(P.ProofError, '^PROOF_HASH$'):P.sign(context(), 'input', 'output', 'cp', 'classes', UnreadableValues())
            runner.assert_not_called()

    def test_signing_is_mocked_passwords_never_arguments_and_private_files_cleaned(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); der = b'SYNTHETIC PUBLIC CERTIFICATE, NOT A KEY'; cert = P.sha(der)
            fake = dict(env(), RUNNER_TEMP=tmp, **dict(zip(P.SECRETS, [base64.b64encode(b'SYNTHETIC NONKEY BYTES').decode(), 'fake-store-password', 'fake-alias', 'fake-key-password'])))
            calls = []
            def process(args, **kwargs):
                calls.append((args, kwargs))
                self.assertNotIn('fake-store-password', args); self.assertNotIn('fake-key-password', args)
                if args[0] == 'keytool': return der
                if args[0] == 'java': return b'{"algorithm":"RSA"}'
                if args[0] == 'jarsigner':
                    Path(args[args.index('-signedjar') + 1]).write_bytes(b'SYNTHETIC SIGNED RESULT')
                    return b''
                raise AssertionError('Unexpected process')
            with patch.object(P, 'CERT', cert), patch.object(P, 'validate_receipt', return_value={'bundle': {'sha256': 'b' * 64}}), patch.object(P, 'tool', side_effect=process):
                P.sign(context(), 'input', root / 'out', 'cp', 'classes', fake)
            self.assertEqual([x[0][0] for x in calls], ['keytool', 'java', 'jarsigner'])
            self.assertFalse(list(root.glob('anker-private-*')))
            receipt = json.loads((root / 'out/sign-proof.json').read_text()); self.assertFalse(receipt['verified'])
            self.assertNotIn('fake-store-password', (root / 'out/sign-proof.json').read_text())

    def test_wrong_cert_or_process_failure_cleans_private_temp_and_never_falls_back(self):
        for failure in ['wrong-cert', 'process-failure']:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as tmp:
                fake = dict(env(), RUNNER_TEMP=tmp, **dict(zip(P.SECRETS, [base64.b64encode(b'NONKEY').decode(), 'fake-password', 'fake-alias', 'fake-password'])))
                calls = []
                def process(args, **kwargs):
                    calls.append(args[0])
                    if failure == 'process-failure': raise P.ProofError('TOOL_FAILED')
                    return b'wrong synthetic public cert'
                with patch.object(P, 'validate_receipt', return_value={}), patch.object(P, 'tool', side_effect=process), self.assertRaises(P.ProofError):
                    P.sign(context(), 'input', Path(tmp) / 'out', 'cp', 'classes', fake)
                self.assertNotIn('jarsigner', calls); self.assertFalse(list(Path(tmp).glob('anker-private-*')))
                self.assertFalse((Path(tmp) / 'out/sign-proof.json').exists())

    def test_verification_rejects_payload_tampering_before_crypto_tool(self):
        with tempfile.TemporaryDirectory() as tmp:
            u, s = Path(tmp) / 'u.aab', Path(tmp) / 's.aab'; synthetic_bundle(u)
            with zipfile.ZipFile(u) as z: files = {n: z.read(n) for n in z.namelist()}
            files.update({k: b'fake-signature' for k in ['META-INF/MANIFEST.MF', 'META-INF/ANKER.SF', 'META-INF/ANKER.RSA']})
            files['base/resources.pb'] = b'modified'; s.write_bytes(zip_bytes(files))
            with patch.object(P, 'jar_report') as verifier, self.assertRaisesRegex(P.ProofError, 'SIGNED_PAYLOAD_CHANGED'):
                P.verify_signed(u, s, 'classes', 'cp', APP)
            verifier.assert_not_called()

    def test_unsigned_extra_or_wrong_signer_verification_failure_never_finalizes(self):
        with tempfile.TemporaryDirectory() as tmp:
            u, s = Path(tmp) / 'u.aab', Path(tmp) / 's.aab'; synthetic_bundle(u)
            with zipfile.ZipFile(u) as z: files = {n: z.read(n) for n in z.namelist()}
            files.update({k: b'fake-signature' for k in ['META-INF/MANIFEST.MF', 'META-INF/ANKER.SF', 'META-INF/ANKER.RSA']}); s.write_bytes(zip_bytes(files))
            for report in [{'signed': False, 'payloadEntries': 6, 'certificateSha256': None},
                           {'signed': True, 'payloadEntries': 6, 'certificateSha256': 'f' * 64},
                           {'signed': True, 'payloadEntries': 6, 'certificateSha256': P.CERT, 'minSigners': 0, 'maxSigners': 1},
                           {'signed': True, 'payloadEntries': 6, 'certificateSha256': P.CERT, 'minSigners': 1, 'maxSigners': 2}]:
                with self.subTest(report=report), patch.object(P, 'tool', return_value=json.dumps(report).encode()), self.assertRaises(P.ProofError):
                    P.jar_report(s, 'classes', True, Path(tmp) / 'public.der')

    def test_final_output_only_after_secret_free_verification(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); source = root / 'input'; signed = root / 'pending'; source.mkdir(); signed.mkdir()
            synthetic_bundle(source / 'unsigned.aab'); (signed / 'signed.aab').write_bytes(b'SYNTHETIC SIGNED BYTES')
            ctx = context(); proof = proof_for(source / 'unsigned.aab', ctx)
            receipt = {'schemaVersion': 1, 'kind': 'anker-code18-signed-pending', 'context': ctx,
                       'unsignedSHA256': proof['bundle']['sha256'], 'proofSHA256': ctx['binding']['expected_proof_sha256'],
                       'signedSHA256': P.sha((signed / 'signed.aab').read_bytes()), 'signedBytes': (signed / 'signed.aab').stat().st_size,
                       'certificateSHA256': P.CERT, 'requestedSignatureAlgorithm': 'SHA256withRSA', 'verified': False}
            (signed / 'sign-proof.json').write_text(json.dumps(receipt))
            (signed / 'transfer.json').write_text(json.dumps({'context': ctx, 'artifactId': 9200, 'archiveDigest': 'sha256:' + 'e' * 64}))
            (source / 'validated.json').write_text(json.dumps({'artifactId': 8400, 'archiveDigest': 'sha256:' + 'd' * 64}))
            with patch.object(P, 'validate_receipt', return_value=proof), patch.object(P, 'verify_signed', side_effect=P.ProofError('FAKE_CRYPTO_REJECTION')):
                with self.assertRaises(P.ProofError):P.verify(ctx, source, signed, root / 'not-final', 'cp', 'classes', 9200)
                self.assertFalse((root / 'not-final').exists())
            with patch.object(P, 'validate_receipt', return_value=proof), patch.object(P, 'verify_signed', return_value={'syntheticOnly': True, 'publicKeyAlgorithm': 'RSA'}):
                with self.assertRaisesRegex(P.ProofError, 'SIGNED_TRANSFER'):P.verify(ctx, source, signed, root / 'wrong-id', 'cp', 'classes', 9201)
                bad = dict(receipt, requestedSignatureAlgorithm='SHA256withECDSA')
                (signed / 'sign-proof.json').write_text(json.dumps(bad))
                with self.assertRaisesRegex(P.ProofError, 'SIGNED_ALGORITHM'):P.verify(ctx, source, signed, root / 'wrong-algorithm', 'cp', 'classes', 9200)
                (signed / 'sign-proof.json').write_text(json.dumps(receipt))
                P.verify(ctx, source, signed, root / 'final', 'cp', 'classes', 9200)
            final = json.loads((root / 'final/proof.json').read_text())
            self.assertFalse(final['uploadedToPlay']); self.assertFalse(final['deviceVerified'])
            self.assertNotEqual(final['signedSHA256'], proof['bundle']['sha256'])
            self.assertEqual(final['signedInputArtifact']['id'], 9200)
            self.assertEqual(final['unsignedArtifact']['id'], 8400)

    def test_private_environment_is_allowlisted(self):
        values = {'PATH': '/bin', 'JAVA_HOME': '/java', 'GH_TOKEN': 'fake-token', 'JAVA_TOOL_OPTIONS': 'fake-options',
                  'ANKER_ANDROID_STORE_PASSWORD': 'fake-password', 'UNRELATED_SECRET': 'fake-secret'}
        self.assertEqual(P.public_env(values), {'PATH': '/bin', 'JAVA_HOME': '/java'})

    def test_api_errors_sanitized_and_storage_get_never_carries_github_token(self):
        api = P.GitHub('SYNTHETIC_TOKEN')
        class Response:
            status = 200
            def __enter__(self):return self
            def __exit__(self, *args):pass
            def read(self, *_):return b'archive'
        requests = []
        def opening(req, **kwargs):
            requests.append(req)
            if len(requests) == 1:
                raise urllib.error.HTTPError(req.full_url, 302, 'redirect', {'Location': 'https://fake.blob.core.windows.net/object?signed=fake'}, None)
            return Response()
        with patch.object(api.opener, 'open', side_effect=opening):self.assertEqual(api.archive(8400), b'archive')
        self.assertEqual(requests[0].get_header('Authorization'), 'Bearer SYNTHETIC_TOKEN')
        self.assertIsNone(requests[1].get_header('Authorization'))
        for code in [401, 403, 500]:
            with self.subTest(code=code), patch.object(api.opener, 'open', side_effect=urllib.error.HTTPError('https://fake/?secret=DO_NOT_PRINT', code, 'DO_NOT_PRINT', {}, None)):
                with self.assertRaises(P.ProofError) as caught:api.get('/actions/runs/1')
                self.assertEqual(str(caught.exception), 'API_ACCESS_FAILED')

    def test_cli_without_actions_context_never_touches_network_or_secrets(self):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/android-aab-proof.py'), 'resolve'],
                                env={'PATH': os.environ.get('PATH', '')}, capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertIn('MANUAL_MAIN_ONLY', result.stdout)
        self.assertNotIn('Traceback', result.stderr + result.stdout)

    def test_cli_argument_and_tool_failure_do_not_expose_raw_values(self):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/android-aab-proof.py'), 'sign', '--fake-password=DO_NOT_PRINT'],
                                capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('DO_NOT_PRINT', result.stdout + result.stderr)
        with patch.object(P.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1, b'DO_NOT_PRINT', b'DO_NOT_PRINT')):
            with self.assertRaisesRegex(P.ProofError, '^TOOL_FAILED$'):P.tool(['synthetic-program'])

    def test_validation_receipt_cannot_be_reused_for_another_run_or_old_time(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp); bundle = folder / 'unsigned.aab'; synthetic_bundle(bundle); ctx = context(); proof = proof_for(bundle, ctx)
            raw = json.dumps(proof).encode(); (folder / 'proof.json').write_bytes(raw)
            ctx['binding'].update(expected_unsigned_sha256=proof['bundle']['sha256'], expected_proof_sha256=P.sha(raw))
            receipt = {'context': ctx, 'artifactId': 8400, 'archiveDigest': 'sha256:' + 'd' * 64,
                       'validatedAt': datetime.now(timezone.utc).isoformat(), 'proofSHA256': P.sha(raw)}
            (folder / 'validated.json').write_text(json.dumps(receipt))
            with patch.object(P, 'validate_unsigned', return_value=proof):self.assertEqual(P.validate_receipt(folder, ctx, 'cp', 'classes'), proof)
            for mutate in ['time', 'run', 'proof']:
                bad = copy.deepcopy(receipt)
                if mutate == 'time':bad['validatedAt'] = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
                if mutate == 'run':bad['context']['run']['id'] = 9999
                if mutate == 'proof':bad['proofSHA256'] = 'f' * 64
                (folder / 'validated.json').write_text(json.dumps(bad))
                with self.subTest(mutate=mutate), self.assertRaises(P.ProofError):P.validate_receipt(folder, ctx, 'cp', 'classes')


class JavaBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Compiles only the trusted verifier, never Android/app code; creates no key.
        cls.tmp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tmp.name)
        javac = shutil.which('javac')
        if not javac: raise RuntimeError('JDK compiler required for offline JAR boundary test; do not skip.')
        subprocess.run([javac, '-d', str(cls.root), str(ROOT / 'scripts/AnkerAabVerifier.java')], check=True, capture_output=True)

    @classmethod
    def tearDownClass(cls):cls.tmp.cleanup()

    def test_real_jar_reader_accepts_synthetic_unsigned_and_rejects_it_as_signed(self):
        jar = self.root / 'synthetic.aab'; synthetic_bundle(jar)
        command = ['java', '-cp', str(self.root), 'AnkerAabVerifier']
        result = subprocess.run(command + ['unsigned', str(jar)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        self.assertFalse(json.loads(result.stdout)['signed'])
        result = subprocess.run(command + ['signed', str(jar), P.CERT, str(self.root / 'public.der')], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stderr.strip(), 'AAB_JAR_VERIFICATION_FAILED')
        self.assertFalse((self.root / 'public.der').exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
