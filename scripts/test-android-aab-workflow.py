"""Parse and inspect the draft without running Actions, Gradle or a signer."""
import ast
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / '.github/workflows/android-aab-pruefstand.yml'
TEXT = PATH.read_text()


def load_yaml(path):
    # Already locked transitive js-yaml dependency; CI runs npm ci beforehand.
    code = "const fs=require('node:fs'); console.log(JSON.stringify(require('js-yaml').load(fs.readFileSync(process.argv[1],'utf8'))))"
    result = subprocess.run(['node', '-e', code, str(path)], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


class WorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.workflow = load_yaml(PATH)

    def test_only_explicit_dispatch_and_read_permissions(self):
        w = self.workflow
        self.assertEqual(set(w['on']), {'workflow_dispatch'})
        self.assertEqual(w['permissions'], {})
        self.assertFalse(w['concurrency']['cancel-in-progress'])
        for job in w['jobs'].values():
            self.assertNotIn('environment', job)
            self.assertTrue(all(k in ['contents', 'actions'] and v == 'read' for k, v in job['permissions'].items()))
            self.assertIn('timeout-minutes', job)

    def test_required_m_w_and_explicit_sign_binding_inputs(self):
        inputs = self.workflow['on']['workflow_dispatch']['inputs']
        self.assertEqual(inputs['mode']['options'], ['prepare', 'sign'])
        self.assertEqual(inputs['source_commit']['default'], '003b14416f859404700dda21161377a257b6b268')
        self.assertTrue(inputs['source_commit']['required'])
        self.assertTrue(inputs['expected_workflow_commit']['required'])
        self.assertNotIn('default', inputs['expected_workflow_commit'])
        for name in ['prepare_run_id', 'prepare_run_attempt', 'unsigned_artifact_id', 'expected_unsigned_sha256', 'expected_proof_sha256']:
            self.assertEqual(inputs[name]['type'], 'string')
            self.assertEqual(inputs[name]['default'], '')

    def test_workflow_and_helper_pin_the_integrated_fix_source(self):
        tree = ast.parse((ROOT / 'scripts/android-aab-proof.py').read_text())
        constants = {node.targets[0].id: ast.literal_eval(node.value) for node in tree.body
                     if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name)
                     and node.targets[0].id in ('SOURCE', 'FINGERPRINT')}
        self.assertEqual(constants['SOURCE'], '003b14416f859404700dda21161377a257b6b268')
        self.assertEqual(constants['FINGERPRINT'], '15bd26708e0d6e690b68b7a0c24818e4a0ae1c26ee9bb5d524ea2af1ad449521')
        self.assertEqual(self.workflow['on']['workflow_dispatch']['inputs']['source_commit']['default'], constants['SOURCE'])

    def test_resolve_is_main_manual_and_has_no_signing_values(self):
        job = self.workflow['jobs']['resolve']
        for term in ["github.repository == 'frnkrm/anker'", "github.ref == 'refs/heads/main'", "github.event_name == 'workflow_dispatch'"]:
            self.assertIn(term, job['if'])
        self.assertNotIn('secrets.', json.dumps(job))
        checkout = job['steps'][0]['with']
        self.assertEqual(checkout['ref'], '${{ github.workflow_sha }}')
        self.assertFalse(checkout['persist-credentials'])

    def test_prepare_and_sign_are_separate_invocations(self):
        jobs = self.workflow['jobs']
        self.assertEqual(jobs['prepare']['needs'], 'resolve')
        self.assertEqual(jobs['sign']['needs'], 'resolve')
        self.assertEqual(jobs['prepare']['if'], "needs.resolve.outputs.mode == 'prepare'")
        self.assertEqual(jobs['sign']['if'], "needs.resolve.outputs.mode == 'sign'")
        self.assertNotIn('prepare', jobs['sign']['needs'])
        self.assertNotIn('secrets.', json.dumps(jobs['prepare']))
        self.assertEqual(jobs['verify']['needs'], ['resolve', 'sign'])

    def test_build_uses_M_but_policy_uses_W(self):
        job = self.workflow['jobs']['prepare']
        checkouts = [s['with'] for s in job['steps'] if s.get('uses', '').startswith('actions/checkout@')]
        self.assertEqual(checkouts[0]['path'], 'policy')
        self.assertEqual(checkouts[0]['ref'], '${{ needs.resolve.outputs.workflow }}')
        self.assertEqual(checkouts[1]['path'], 'app')
        self.assertEqual(checkouts[1]['ref'], '003b14416f859404700dda21161377a257b6b268')
        run = next(s for s in job['steps'] if s.get('working-directory') == 'app')['run']
        self.assertEqual(run.count('npm run build'), 2)
        self.assertIn('--dry-run', run)
        self.assertIn('android-aab-unsigned.gradle', run)
        for forbidden in ['assembleDebug', 'assembleRelease', 'signReleaseBundle', 'bundleRelease']:
            self.assertNotIn(forbidden, run)

    def test_public_backend_config_is_only_in_unsigned_build(self):
        steps = self.workflow['jobs']['prepare']['steps']
        build = next(s for s in steps if s.get('working-directory') == 'app')
        self.assertEqual(build['env']['VITE_SUPABASE_URL'], '${{ vars.VITE_SUPABASE_URL }}')
        self.assertEqual(build['env']['VITE_SUPABASE_ANON_KEY'], '${{ vars.VITE_SUPABASE_ANON_KEY }}')
        self.assertIn('sb_publishable_', build['run'])
        self.assertIn('https://bnthnmkhwumaqfurbgte.supabase.co', build['run'])
        self.assertLess(build['run'].index('sb_publishable_'), build['run'].index('npm ci'))
        for name in ('resolve', 'sign', 'verify'):
            self.assertNotIn('VITE_', json.dumps(self.workflow['jobs'][name]))
        self.assertNotIn('secrets.', json.dumps(self.workflow['jobs']['prepare']))

    def test_public_config_gate_rejects_secret_and_wrong_destination(self):
        step = next(s for s in self.workflow['jobs']['prepare']['steps'] if s.get('working-directory') == 'app')
        script = step['run'].split("python3 - <<'PY'\n", 1)[1].split('\nPY\n', 1)[0]
        good = {'VITE_SUPABASE_URL': 'https://bnthnmkhwumaqfurbgte.supabase.co',
                'VITE_SUPABASE_ANON_KEY': 'sb_publishable_' + 'synthetic_' * 4}
        for updates, expected in [({}, 0), ({'VITE_SUPABASE_URL': 'https://other.example'}, 1),
                                  ({'VITE_SUPABASE_ANON_KEY': 'sb_secret_SYNTHETIC'}, 1),
                                  ({'VITE_SUPABASE_ANON_KEY': ''}, 1)]:
            result = subprocess.run([sys.executable, '-c', script], env={**os.environ, **good, **updates}, capture_output=True, text=True)
            self.assertEqual(result.returncode, expected)
            self.assertNotIn('sb_secret_', result.stderr)

    def test_sign_job_has_only_sparse_trusted_W_code_and_no_app_execution(self):
        job = self.workflow['jobs']['sign']
        checkouts = [s['with'] for s in job['steps'] if s.get('uses', '').startswith('actions/checkout@')]
        self.assertEqual(len(checkouts), 1)
        self.assertEqual(checkouts[0]['ref'], '${{ needs.resolve.outputs.workflow }}')
        self.assertFalse(checkouts[0]['sparse-checkout-cone-mode'])
        self.assertFalse(checkouts[0]['persist-credentials'])
        self.assertEqual(set(checkouts[0]['sparse-checkout'].splitlines()),
                         {'scripts/android-aab-proof.py', 'scripts/AnkerAabVerifier.java', 'scripts/android-aab-tools.json'})
        runs = '\n'.join(s.get('run', '') for s in job['steps'])
        self.assertNotIn('npm', runs); self.assertNotIn('gradle', runs.lower())
        self.assertNotIn('download-artifact@', json.dumps(job))

    def test_secrets_referenced_only_by_one_actual_sign_step(self):
        matches = []
        for jobname, job in self.workflow['jobs'].items():
            self.assertNotIn('secrets.', json.dumps(job.get('env', {})))
            for index, step in enumerate(job['steps']):
                if 'secrets.' in json.dumps(step):matches.append((jobname, index, step))
        self.assertEqual(len(matches), 1)
        jobname, index, step = matches[0]; self.assertEqual(jobname, 'sign')
        self.assertEqual(set(step['env']), {'ANKER_ANDROID_KEYSTORE_BASE64','ANKER_ANDROID_STORE_PASSWORD','ANKER_ANDROID_KEY_ALIAS','ANKER_ANDROID_KEY_PASSWORD'})
        self.assertIn(' sign ', step['run'])
        preceding = self.workflow['jobs']['sign']['steps'][:index]
        self.assertTrue(any(' input ' in s.get('run', '') for s in preceding))
        self.assertTrue(all('secrets.' not in json.dumps(s) for s in preceding))
        self.assertNotIn('secrets.', json.dumps(self.workflow['jobs']['verify']))

    def test_artifacts_names_include_attempt_and_only_data_whitelist(self):
        for job in self.workflow['jobs'].values():
            for step in job['steps']:
                if step.get('uses', '').startswith('actions/upload-artifact@'):
                    self.assertIn('${{ github.run_id }}', step['with']['name'])
                    self.assertIn('${{ github.run_attempt }}', step['with']['name'])
                    self.assertEqual(step['with']['if-no-files-found'], 'error')
                    paths = step['with']['path'].splitlines()
                    self.assertEqual(len(paths), 2)
                    self.assertTrue(all(p.endswith(('.aab', '.json')) for p in paths))
                    self.assertNotIn('if', step)  # no always()/failure() uploads

    def test_verification_is_mandatory_before_final_output(self):
        job = self.workflow['jobs']['verify']; steps = job['steps']
        download = next(s['run'] for s in steps if '--signed-artifact-id' in s.get('run', ''))
        self.assertIn('--signed-input', download)
        self.assertEqual(next(s for s in steps if '--signed-artifact-id' in s.get('run', ''))['env']['SIGNED_ARTIFACT'], '${{ needs.sign.outputs.artifact }}')
        v = next(i for i, s in enumerate(steps) if ' verify ' in s.get('run', ''))
        a = next(i for i, s in enumerate(steps) if s.get('uses', '').startswith('actions/upload-artifact@'))
        self.assertLess(v, a)
        self.assertIn('aab-verified', steps[a]['with']['path'])
        self.assertNotIn('always()', json.dumps(job))

    def test_no_upload_release_or_secret_setup_path_and_actions_pinned(self):
        for forbidden in ['google-play', 'GOOGLE_PLAY', 'release create', 'git push', 'setup-android-signing', 'sign-local-update', 'AKTUELLER_UPDATESTAND', 'PLAY_UPLOAD_APPROVAL']:
            self.assertNotIn(forbidden, TEXT)
        for job in self.workflow['jobs'].values():
            for step in job['steps']:
                if 'uses' in step:self.assertRegex(step['uses'], r'^actions/[a-z-]+@[a-f0-9]{40}$')

    def test_user_inputs_never_interpolated_into_shell_scripts(self):
        for job in self.workflow['jobs'].values():
            for step in job['steps']:
                self.assertNotIn('${{', step.get('run', ''))
                if 'run' in step:
                    with tempfile.NamedTemporaryFile(mode='w', suffix='.sh') as script:
                        script.write(step['run']); script.flush()
                        result = subprocess.run(['bash', '-n', script.name], capture_output=True, text=True)
                        self.assertEqual(result.returncode, 0, result.stderr)

    def test_ci_embeds_only_new_offline_tests_and_java_tool(self):
        ci = load_yaml(ROOT / '.github/workflows/ci.yml')
        steps = ci['jobs']['check']['steps']
        index = next(i for i, s in enumerate(steps) if 'test-android-aab-proof.py' in s.get('run', ''))
        self.assertEqual(steps[index]['run'].splitlines(), ['python3 scripts/test-android-aab-proof.py', 'python3 scripts/test-android-aab-workflow.py'])
        self.assertEqual(steps[index - 1]['with']['java-version'], 21)

    def test_tool_lock_is_existing_version_and_hash_bound(self):
        lock = json.loads((ROOT / 'scripts/android-aab-tools.json').read_text())
        self.assertEqual(lock['bundletoolVersion'], '1.18.1')
        self.assertEqual(len(lock['jars']), 17)
        for row in lock['jars']:
            self.assertEqual(Path(row['file']).name, row['file'])
            self.assertRegex(row['sha256'], '^[a-f0-9]{64}$')
            self.assertTrue(all(u.startswith(('https://dl.google.com/dl/android/maven2/', 'https://repo.maven.apache.org/maven2/')) for u in row['urls']))

    def test_python_syntax_and_unsigned_guard_are_observers(self):
        ast.parse((ROOT / 'scripts/android-aab-proof.py').read_text())
        guard = (ROOT / 'scripts/android-aab-unsigned.gradle').read_text()
        for term in ['LinkOption.NOFOLLOW_LINKS', 'gradle.beforeProject', 'signingConfig != null', 'PackageBundleTask', 'FinalizeBundleTask']:
            self.assertIn(term, guard)
        self.assertNotRegex(guard, r'signingConfig\s*=(?!=)')
        self.assertNotIn('enabled = false', guard)


class PrepareSDKTests(unittest.TestCase):
    """Execute only the SDK step with isolated PATH/SDK and artificial tools."""

    @classmethod
    def setUpClass(cls):
        steps = load_yaml(PATH)['jobs']['prepare']['steps']
        cls.sdk_step = next(s['run'] for s in steps if s.get('name') == 'Benötigte bestehende Android-SDK-Versionen bereitstellen')

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='anker-sdk-offline-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bin = self.root / 'path'
        self.bin.mkdir()
        # No inherited SDK, PATH, credentials, Actions files or real sdkmanager.
        (self.bin / 'python3').symlink_to(sys.executable)
        self.log = self.root / 'invocations.jsonl'
        self.env = {'PATH': str(self.bin), 'FAKE_SDK_LOG': str(self.log)}

    def fake(self, path):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('#!' + sys.executable + '\n' + '''import json, os, sys
with open(os.environ['FAKE_SDK_LOG'], 'a') as f:
    f.write(json.dumps(sys.argv[1:]) + '\\n')
if os.environ.get('FAKE_SDK_EXIT'):
    print('FAKE_SDK_FAILURE', file=sys.stderr)
sys.exit(int(os.environ.get('FAKE_SDK_EXIT', '0')))
''')
        path.chmod(0o755)
        return path

    def sdk(self, name='sdk'):
        root = self.root / name
        self.fake(root / 'cmdline-tools/latest/bin/sdkmanager')
        return root

    def invoke(self):
        return subprocess.run(['/bin/bash', '-e', '-c', self.sdk_step], env=self.env,
                              cwd=self.root, capture_output=True, text=True, timeout=10)

    def assert_success(self):
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.log.read_text().splitlines(),
                         [json.dumps(['platforms;android-36', 'build-tools;35.0.0'])])

    def assert_rejected(self, reason):
        result = self.invoke()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('AAB-SDK-Prüfung abgebrochen: ' + reason, result.stderr)
        self.assertFalse(self.log.exists(), 'No tool may execute on invalid configuration')
        self.assertNotIn(str(self.root), result.stderr)

    def test_path_tool_without_sdk_roots(self):
        self.fake(self.bin / 'sdkmanager')
        self.assert_success()

    def test_configured_sdk_without_path(self):
        self.env['ANDROID_HOME'] = str(self.sdk())
        self.assert_success()

    def test_sdk_root_alias_without_path(self):
        self.env['ANDROID_SDK_ROOT'] = str(self.sdk())
        self.assert_success()

    def test_both_roots_same_canonical_sdk(self):
        sdk = self.sdk()
        alias = self.root / 'alias'
        alias.symlink_to(sdk, target_is_directory=True)
        self.env.update(ANDROID_HOME=str(sdk), ANDROID_SDK_ROOT=str(alias))
        self.assert_success()

    def test_path_tool_inside_configured_sdk(self):
        sdk = self.sdk()
        (self.bin / 'sdkmanager').symlink_to(sdk / 'cmdline-tools/latest/bin/sdkmanager')
        self.env['ANDROID_HOME'] = str(sdk)
        self.assert_success()

    def test_conflicting_sdk_roots_do_not_execute_path_tool(self):
        self.env.update(ANDROID_HOME=str(self.sdk('one')), ANDROID_SDK_ROOT=str(self.sdk('two')))
        self.fake(self.bin / 'sdkmanager')
        self.assert_rejected('SDK_ROOT_CONFLICT')

    def test_path_tool_outside_configured_sdk_is_not_silently_replaced(self):
        self.env['ANDROID_HOME'] = str(self.sdk())
        self.fake(self.bin / 'sdkmanager')
        self.assert_rejected('SDK_TOOL_ROOT_CONFLICT')

    def test_no_tool_or_sdk_is_actionable(self):
        self.assert_rejected('SDKMANAGER_UNAVAILABLE')

    def test_configured_sdk_without_commandline_tools(self):
        sdk = self.root / 'sdk'
        sdk.mkdir()
        self.env['ANDROID_HOME'] = str(sdk)
        self.assert_rejected('SDKMANAGER_UNAVAILABLE')

    def test_nonexecutable_sdkmanager(self):
        sdk = self.sdk()
        (sdk / 'cmdline-tools/latest/bin/sdkmanager').chmod(0o644)
        self.env['ANDROID_HOME'] = str(sdk)
        self.assert_rejected('SDKMANAGER_UNAVAILABLE')

    def test_sdkmanager_directory_is_not_executable_tool(self):
        sdk = self.root / 'sdk'
        (sdk / 'cmdline-tools/latest/bin/sdkmanager').mkdir(parents=True)
        self.env['ANDROID_HOME'] = str(sdk)
        self.assert_rejected('SDKMANAGER_UNAVAILABLE')

    def test_missing_or_relative_root_does_not_fall_back_to_path(self):
        self.fake(self.bin / 'sdkmanager')
        for value in [str(self.root / 'missing'), 'relative/sdk', ' ', 'bad\nroot']:
            with self.subTest(value=repr(value)):
                self.env['ANDROID_HOME'] = value
                self.assert_rejected('SDK_ROOT_INVALID')

    def test_empty_roots_allow_existing_path_tool(self):
        self.env.update(ANDROID_HOME='', ANDROID_SDK_ROOT='')
        self.fake(self.bin / 'sdkmanager')
        self.assert_success()

    def test_spaces_and_shell_metacharacters_are_literal_paths(self):
        sdk = self.sdk('sdk with space;$(touch PWNED)')
        self.env['ANDROID_HOME'] = str(sdk)
        self.assert_success()
        self.assertFalse((self.root / 'PWNED').exists())

    def test_sdk_tool_symlink_outside_root_is_rejected(self):
        sdk = self.root / 'sdk'
        candidate = sdk / 'cmdline-tools/latest/bin/sdkmanager'
        candidate.parent.mkdir(parents=True)
        candidate.symlink_to(self.fake(self.root / 'other/sdkmanager'))
        self.env['ANDROID_HOME'] = str(sdk)
        self.assert_rejected('SDK_TOOL_ROOT_CONFLICT')

    def test_real_tool_exit_and_stderr_propagate_without_retry(self):
        self.env.update(ANDROID_HOME=str(self.sdk()), FAKE_SDK_EXIT='23')
        result = self.invoke()
        self.assertEqual(result.returncode, 23, result.stderr)
        self.assertIn('FAKE_SDK_FAILURE', result.stderr)
        self.assertEqual(len(self.log.read_text().splitlines()), 1)

    def test_invalid_tool_interpreter_aborts_with_limited_diagnostic(self):
        sdk = self.sdk()
        (sdk / 'cmdline-tools/latest/bin/sdkmanager').write_text('#!/NONEXISTENT-ANKER-TEST-INTERPRETER\n')
        self.env['ANDROID_HOME'] = str(sdk)
        self.assert_rejected('SDKMANAGER_EXECUTION_FAILED')


if __name__ == '__main__':unittest.main(verbosity=2)
