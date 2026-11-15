"""Temporary-edit diagnostics cannot commit or disclose remote text/credentials."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
import urllib.error

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SPEC = importlib.util.spec_from_file_location('diagnostic', HERE/'google-play-internal-diagnose.py')
m = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(m)
FIXTURES = importlib.util.spec_from_file_location('release_fixtures', HERE/'test-google-play-internal-release.py')
f = importlib.util.module_from_spec(FIXTURES); FIXTURES.loader.exec_module(f)


class DiagnosticTests(unittest.TestCase):
    def setUp(self):
        self.guard = patch('urllib.request.OpenerDirector.open', side_effect=AssertionError('No real HTTP'))
        self.guard.start(); self.addCleanup(self.guard.stop)
        self.report = {'diagnosticOnly':True,'commitAttempted':False,'publishedByThisRun':False}
        self.fake = f.Fake()
        self.api = m.DiagnosticApi('SYNTHETIC',self.report)
        self.api.client.client.request = self.fake.request

    def test_success_validates_then_discards_without_commit(self):
        m.diagnose(self.api,self.report)
        self.assertEqual(self.report['status'],'validated-not-committed')
        self.assertEqual(self.report['editCleanup'],'deleted')
        self.assertEqual(self.fake.calls[-1][:2],('DELETE',f.OWN))
        self.assertFalse(any(':commit' in c[1] or '/upload' in c[1] for c in self.fake.calls))
        self.assertNotIn(f.PRIVATE,json.dumps(self.report))

    def test_each_rejected_stage_is_identified_and_always_discards_own_edit(self):
        for method,path,stage in [('GET',f.OWN+'/tracks/internal','read-internal-track'),
            ('PUT',f.OWN+'/tracks/internal','stage-internal-change'),('POST',f.OWN+':validate','validate-uncommitted-edit')]:
            with self.subTest(stage=stage):
                self.setUp()
                self.fake.failures[(method,path)] = m.d.UploadError('HTTP_FORBIDDEN',403)
                with self.assertRaises(m.d.UploadError):m.diagnose(self.api,self.report)
                self.assertEqual(self.report['failedOperation'],stage)
                self.assertEqual(self.report['editCleanup'],'deleted')
                self.assertFalse(any(':commit' in c[1] for c in self.fake.calls))

    def test_commit_upload_other_track_and_tester_routes_never_reach_client(self):
        client = Mock(); self.api.client = client
        for method,path in [('POST',f.OWN+':commit'+m.release.COMMIT_QUERY),('POST','/upload'+f.OWN+'/bundles'),
                            ('PUT',f.OWN+'/tracks/production'),('PUT',f.OWN+'/testers')]:
            with self.assertRaises(m.d.UploadError):self.api.request(method,path)
        client.request.assert_not_called()

    def test_unknown_or_private_google_fields_do_not_escape(self):
        for raw in [b'not json',json.dumps({'error':{'message':f.PRIVATE,'status':f.PRIVATE,'errors':[{'reason':f.PRIVATE}]}}).encode()]:
            self.assertNotIn(f.PRIVATE,json.dumps(m.safe_failure(raw)))
        self.assertEqual(m.safe_failure(json.dumps({'error':{'message':'The caller does not have permission','status':'PERMISSION_DENIED','errors':[{'reason':'forbidden'}]}}).encode()),
            {'messageKind':'caller-permission-denied','googleStatus':'PERMISSION_DENIED','googleReason':'forbidden'})
        self.assertEqual(m.safe_failure(json.dumps({'error':{'message':'Only releases with status draft may be created on draft app.'}}).encode())['messageKind'],'app-still-draft')

    def test_error_capture_is_bounded_closed_and_never_returns_raw_body(self):
        limits=[]
        class Body(io.BytesIO):
            def read(self,n):limits.append(n);return super().read(n)
        body=Body(json.dumps({'error':{'message':f.PRIVATE,'status':'PERMISSION_DENIED'}}).encode())
        error=urllib.error.HTTPError('https://androidpublisher.googleapis.com',403,f.PRIVATE,{},body)
        opener=Mock();opener.open.side_effect=error
        with self.assertRaises(m.d.UploadError) as caught:m.CaptureErrors(opener).open(Mock(),timeout=1)
        self.assertEqual(limits,[65537]);self.assertTrue(body.closed)
        self.assertEqual(caught.exception.http_status,403)
        self.assertNotIn(f.PRIVATE,str(caught.exception)+json.dumps(caught.exception.safe_info))

    def test_wrong_bundle_cannot_stage_any_change(self):
        self.fake.bundle['sha256']='f'*64
        with self.assertRaises(m.d.UploadError):m.diagnose(self.api,self.report)
        self.assertFalse(any(c[0]=='PUT' for c in self.fake.calls))

    def test_workflow_requires_main_optin_and_uses_only_diagnostic_cli(self):
        s=(ROOT/'.github/workflows/google-play-internal-diagnose.yml').read_text()
        self.assertIn("github.ref == 'refs/heads/main'",s)
        self.assertIn("inputs.confirmation == 'DIAGNOSE_CODE17_NO_COMMIT'",s)
        self.assertIn('[anker-internal17-diagnose]',s)
        self.assertNotIn('[anker-internal17-release]',s)
        self.assertIn('python3 scripts/google-play-internal-diagnose.py',s)
        self.assertNotIn('python3 scripts/google-play-internal-release.py',s)
        self.assertEqual(s.count('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:'),1)
        self.assertIn('group: anker-google-play-internal-draft',s)
        self.assertIn('python3 scripts/test-google-play-internal-diagnose.py',(ROOT/'.github/workflows/ci.yml').read_text())

    def test_identity_check_is_before_auth_and_prints_only_boolean(self):
        s=(ROOT/'.github/workflows/google-play-internal-diagnose.yml').read_text()
        code=s.split("          python3 - <<'PY_ID'\n")[1].split('          PY_ID')[0]
        code='\n'.join(line[10:] for line in code.splitlines())
        self.assertLess(s.index('serviceAccountMatchesExpected='),s.index('          python3 scripts/google-play-auth.py --run'))
        for email,expected in [('anker-play-upload@anker-514222.iam.gserviceaccount.com',True),(f.PRIVATE,False)]:
            output=io.StringIO()
            with patch.dict(os.environ,{'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON':json.dumps({'client_email':email,'private_key':f.PRIVATE})},clear=True),contextlib.redirect_stdout(output):
                if expected:exec(compile(code,'identity','exec'),{})
                else:
                    with self.assertRaises(SystemExit):exec(compile(code,'identity','exec'),{})
            self.assertNotIn(email,output.getvalue());self.assertNotIn(f.PRIVATE,output.getvalue())
            self.assertIn('serviceAccountMatchesExpected='+str(expected).lower(),output.getvalue())


if __name__=='__main__':unittest.main()
