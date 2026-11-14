"""Parse and inspect the draft without running Actions, Gradle or a signer."""
import ast
import json
from pathlib import Path
import re
import subprocess
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
        self.assertEqual(inputs['source_commit']['default'], '10cc894a27302a5a49b6884c843d2a6b509ab354')
        self.assertTrue(inputs['source_commit']['required'])
        self.assertTrue(inputs['expected_workflow_commit']['required'])
        self.assertNotIn('default', inputs['expected_workflow_commit'])
        for name in ['prepare_run_id', 'prepare_run_attempt', 'unsigned_artifact_id', 'expected_unsigned_sha256', 'expected_proof_sha256']:
            self.assertEqual(inputs[name]['type'], 'string')
            self.assertEqual(inputs[name]['default'], '')

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
        self.assertEqual(checkouts[1]['ref'], '10cc894a27302a5a49b6884c843d2a6b509ab354')
        run = next(s for s in job['steps'] if s.get('working-directory') == 'app')['run']
        self.assertEqual(run.count('npm run build'), 2)
        self.assertIn('--dry-run', run)
        self.assertIn('android-aab-unsigned.gradle', run)
        for forbidden in ['assembleDebug', 'assembleRelease', 'signReleaseBundle', 'bundleRelease']:
            self.assertNotIn(forbidden, run)

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


if __name__ == '__main__':unittest.main(verbosity=2)
