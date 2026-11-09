#!/usr/bin/env python3
"""Offline contract/security tests; no real Google requests or credentials."""
from __future__ import annotations

import contextlib
import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
import urllib.error
import urllib.request


SPEC = importlib.util.spec_from_file_location("anker_google_play_upload", Path(__file__).with_name("google-play-upload.py"))
assert SPEC and SPEC.loader
uploader = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(uploader)
FAKE_TOKEN = "FAKE_ACCESS_TOKEN_FOR_OFFLINE_TESTS_ONLY"
PRIVATE_ERROR = "PRIVATE_RESPONSE_BODY_AND_TOKEN_" + FAKE_TOKEN
BASE = uploader.API_PATH
OWN = BASE + "/own-edit"
VERIFY = BASE + "/verify-edit"
MATCHING = {"versionCode": 16, "sha256": uploader.BUNDLE_SHA256}
TARGET = {"name": "Anker 1.5.0-rc.2 · Code16", "versionCodes": ["16"], "status": "draft"}


def approval():
    return {"schemaVersion": 1, "packageName": uploader.PACKAGE, "versionCode": 16,
            "sourceCommit": uploader.SOURCE, "sourceFingerprint": uploader.FINGERPRINT,
            "artifact": {"repository": "frnkrm/anker", "gitCommit": uploader.DOWNLOAD_COMMIT, "path": "Anker.aab", "sha256": uploader.BUNDLE_SHA256, "bytes": uploader.BUNDLE_BYTES},
            "signingCertificateSha256": uploader.CERTIFICATE, "ci": {"repository": "frnkrm/anker", "runId": uploader.CI_RUN, "sourceCommit": uploader.SOURCE},
            "track": "internal", "releaseStatus": "draft", "changesNotSentForReview": True, "changesInReviewBehavior": "ERROR_IF_IN_REVIEW"}


class FakeApi:
    def __init__(self, bundles=None, releases=None):
        self.bundles = copy.deepcopy(bundles or [])
        self.track = {"track": "internal", "releases": copy.deepcopy(releases or [])}
        self.calls = []
        self.failures = {}
        self.upload_response = copy.deepcopy(MATCHING)
        self.changed_response = None
        self.readback_response = None
        self.validate_response = {"id": "own-edit"}
        self.commit_response = {"id": "own-edit"}
        self.verification_id = "verify-edit"
        self.inserts = 0

    def request(self, method, path, payload=None, *, bundle=False):
        self.calls.append((method, path, payload, bundle))
        failure = self.failures.get((method, path))
        if failure:
            raise failure
        if method == "POST" and path == BASE:
            self.inserts += 1
            return {"id": "own-edit" if self.inserts == 1 else self.verification_id}
        if method == "GET" and path == OWN + "/bundles":
            return {"bundles": copy.deepcopy(self.bundles)}
        if method == "GET" and path == OWN + "/tracks/internal":
            return copy.deepcopy(self.track)
        if method == "POST" and path == "/upload" + OWN + "/bundles?uploadType=media":
            assert bundle is True and payload == b"offline-approved-bundle"
            return copy.deepcopy(self.upload_response)
        if method == "PUT" and path == OWN + "/tracks/internal":
            self.track = json.loads(payload)
            return copy.deepcopy(self.changed_response if self.changed_response is not None else self.track)
        if method == "POST" and path == OWN + ":validate":
            assert payload is None
            return copy.deepcopy(self.validate_response)
        if method == "POST" and path == OWN + ":commit" + uploader.COMMIT_QUERY:
            assert payload is None
            return copy.deepcopy(self.commit_response)
        if method == "GET" and path == VERIFY + "/tracks/internal":
            return copy.deepcopy(self.readback_response if self.readback_response is not None else self.track)
        if method == "DELETE" and path in {OWN, VERIFY}:
            return {}
        raise AssertionError("Unexpected mocked endpoint")

    def has(self, method, suffix):
        return any(m == method and p.endswith(suffix) for m, p, _, _ in self.calls)


class FakeResponse:
    def __init__(self, data, status=200):
        self.data, self.status = data, status
        self.read_limits = []

    def read(self, maximum):
        self.read_limits.append(maximum)
        return self.data[:maximum]

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class TestUpload(unittest.TestCase):
    def setUp(self):
        self.network = patch("urllib.request.OpenerDirector.open", side_effect=AssertionError("Real network forbidden in tests"))
        self.network.start()
        self.addCleanup(self.network.stop)
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.manifest = self.root / "approval.json"
        self.manifest.write_text(json.dumps(approval()))

    def assert_reason(self, code, function, *args):
        with self.assertRaises(uploader.UploadError) as raised:
            function(*args)
        self.assertEqual(raised.exception.code, code)
        self.assertNotIn(PRIVATE_ERROR, str(raised.exception))
        return raised.exception

    def upload(self, api):
        report = uploader.new_report()
        uploader.perform_upload(api, b"offline-approved-bundle", report)
        return report

    def test_valid_pinned_approval_and_public_certificate_format(self):
        self.assertEqual(uploader.read_manifest(self.manifest), approval())
        value = approval()
        value["signingCertificateSha256"] = ":".join(uploader.CERTIFICATE[i:i+2].upper() for i in range(0, 64, 2))
        self.manifest.write_text(json.dumps(value))
        self.assertEqual(uploader.read_manifest(self.manifest)["versionCode"], 16)

    def test_manifest_cannot_change_version_track_status_review_behavior_or_provenance(self):
        changes = [("versionCode", 17), ("versionCode", True), ("schemaVersion", True), ("packageName", "other.package"), ("track", "production"), ("releaseStatus", "completed"),
                   ("sourceCommit", "0" * 40), ("sourceFingerprint", "0" * 64), ("changesNotSentForReview", False), ("changesInReviewBehavior", "CANCEL_IN_REVIEW_AND_SUBMIT"), ("signingCertificateSha256", "00" * 32)]
        for key, value in changes:
            with self.subTest(key=key, value=value):
                data = approval(); data[key] = value
                self.manifest.write_text(json.dumps(data))
                self.assert_reason("MANIFEST_INVALID", uploader.read_manifest, self.manifest)
        for group, key, value in [("artifact", "sha256", "0" * 64), ("artifact", "gitCommit", "0" * 40), ("artifact", "path", "other.aab"), ("artifact", "bytes", 22), ("ci", "runId", 1), ("ci", "sourceCommit", "0" * 40)]:
            with self.subTest(group=group, key=key):
                data=approval(); data[group][key]=value; self.manifest.write_text(json.dumps(data))
                self.assert_reason("MANIFEST_INVALID", uploader.read_manifest, self.manifest)

    def test_missing_extra_oversized_and_corrupt_manifest_fail_closed(self):
        for data in [{}, {**approval(), "apiBase": "https://attacker.invalid"}, {**approval(), "changesInReviewBehavior": None}]:
            self.manifest.write_text(json.dumps(data))
            self.assert_reason("MANIFEST_INVALID", uploader.read_manifest, self.manifest)
        for text in [PRIVATE_ERROR, " " * 16385, "[]", "null"]:
            self.manifest.write_text(text)
            self.assert_reason("MANIFEST_INVALID", uploader.read_manifest, self.manifest)

    def test_bundle_tamper_is_checked_by_size_and_sha256(self):
        path = self.root / "Anker.aab"
        path.write_bytes(b"wrong")
        self.assert_reason("BUNDLE_INVALID", uploader.read_bundle, path)
        with path.open("wb") as stream:
            stream.truncate(uploader.BUNDLE_BYTES)
        self.assert_reason("BUNDLE_INVALID", uploader.read_bundle, path)
        data = b"offline-test-artifact"
        path.write_bytes(data)
        with patch.object(uploader, "BUNDLE_BYTES", len(data)), patch.object(uploader, "BUNDLE_SHA256", hashlib.sha256(data).hexdigest()):
            self.assertEqual(uploader.read_bundle(path), data)
            path.write_bytes(data[:-1] + b"X")
            self.assert_reason("BUNDLE_INVALID", uploader.read_bundle, path)

    def test_new_upload_preserves_other_draft_release_and_verifies_persisted_state(self):
        other = {"name": "Existing draft", "versionCodes": ["15"], "status": "draft", "releaseNotes": [{"language": "de-DE", "text": "Other draft text"}]}
        api=FakeApi(releases=[other]); report=self.upload(api)
        self.assertEqual(report["status"], "draft-committed")
        self.assertTrue(report["draftVerified"] and report["commitAcknowledged"] and report["bundleUploadConfirmed"])
        self.assertFalse(report["publishedByThisRun"])
        self.assertEqual(api.track["releases"], [other, TARGET])
        self.assertEqual(api.calls[-1][:2], ("DELETE", VERIFY))
        self.assertNotIn(("DELETE", OWN), [(m,p) for m,p,_,_ in api.calls])
        commits=[entry for entry in api.calls if ":commit" in entry[1]]
        self.assertEqual(len(commits), 1)
        self.assertTrue(commits[0][1].endswith("?changesNotSentForReview=true&changesInReviewBehavior=ERROR_IF_IN_REVIEW"))
        self.assertLess(next(i for i,c in enumerate(api.calls) if c[1].endswith("/tracks/internal")), next(i for i,c in enumerate(api.calls) if c[3]))

    def test_matching_uploaded_bundle_is_reused_without_new_version_upload(self):
        api=FakeApi(bundles=[MATCHING]); report=self.upload(api)
        self.assertTrue(report["bundleReused"] and report["draftVerified"])
        self.assertFalse(report["bundleUploadConfirmed"])
        self.assertFalse(any(c[3] for c in api.calls))

    def test_exact_existing_draft_is_idempotent_and_preserves_its_notes(self):
        existing={**TARGET,"releaseNotes":[{"language":"de-DE","text":"Keep this note"}]}
        api=FakeApi(bundles=[MATCHING], releases=[existing]); report=self.upload(api)
        self.assertEqual(report["status"], "already-draft")
        self.assertTrue(report["draftVerified"] and report["bundleReused"])
        self.assertFalse(report["commitAttempted"])
        self.assertEqual(api.track["releases"], [existing])
        self.assertFalse(any(c[0]=="PUT" or c[3] or ":commit" in c[1] for c in api.calls))
        self.assertEqual(api.calls[-1][:2], ("DELETE", OWN))

    def test_existing_live_mixed_or_wrong_track_stops_before_bundle_upload(self):
        for release in [{"versionCodes":["15"],"status":"completed"},{"versionCodes":["16"],"status":"inProgress"},{"versionCodes":["16"],"status":"halted"},{"versionCodes":["16","15"],"status":"draft"}]:
            with self.subTest(release=release):
                api=FakeApi(releases=[release])
                self.assert_reason("EXISTING_RELEASE_CONFLICT", self.upload, api)
                self.assertFalse(any(c[0]=="PUT" or c[3] or ":commit" in c[1] for c in api.calls))
        api=FakeApi(); api.track["track"]="production"
        self.assert_reason("EXISTING_RELEASE_CONFLICT", self.upload, api)

    def test_existing_draft_without_matching_bundle_is_not_overwritten(self):
        api=FakeApi(releases=[TARGET])
        self.assert_reason("DRAFT_RESPONSE_MISMATCH", self.upload, api)
        self.assertFalse(any(c[0]=="PUT" or c[3] for c in api.calls))

    def test_existing_same_version_wrong_hash_or_duplicate_stops_without_upload(self):
        for bundles in [[{"versionCode":16,"sha256":"0"*64}],[MATCHING,MATCHING]]:
            api=FakeApi(bundles=bundles)
            self.assert_reason("ARTIFACT_CONFLICT", self.upload, api)
            self.assertFalse(any(c[0]=="PUT" or c[3] for c in api.calls))

    def test_upload_response_must_match_both_version_and_hash(self):
        for response in [{"versionCode":17,"sha256":uploader.BUNDLE_SHA256},{"versionCode":16,"sha256":"0"*64},{"versionCode":"16","sha256":uploader.BUNDLE_SHA256}]:
            api=FakeApi(); api.upload_response=response
            self.assert_reason("UPLOAD_RESPONSE_MISMATCH", self.upload, api)
            self.assertFalse(any(c[0]=="PUT" or ":commit" in c[1] for c in api.calls))
            self.assertEqual(api.calls[-1][:2], ("DELETE", OWN))

    def test_track_response_and_validation_are_confirmed_before_commit(self):
        api=FakeApi(); api.changed_response={"track":"internal","releases":[]}
        self.assert_reason("DRAFT_RESPONSE_MISMATCH", self.upload, api)
        self.assertFalse(any(":commit" in c[1] for c in api.calls))
        api=FakeApi(); api.validate_response={"id":"another-edit"}
        self.assert_reason("RESPONSE_INVALID", self.upload, api)
        self.assertFalse(any(":commit" in c[1] for c in api.calls))

    def test_commit_409_is_not_retried_or_changed_to_cancel_in_review(self):
        api=FakeApi(); api.failures[("POST",OWN+":commit"+uploader.COMMIT_QUERY)]=uploader.UploadError("HTTP_CONFLICT",409)
        self.assert_reason("HTTP_CONFLICT", self.upload, api)
        self.assertEqual(sum(":commit" in c[1] for c in api.calls),1)
        self.assertTrue(all("CANCEL_" not in c[1] for c in api.calls))
        self.assertEqual(api.calls[-1][:2], ("DELETE",OWN))

    def test_ambiguous_commit_never_retries_or_deletes_original_edit(self):
        for failure in [uploader.UploadError("NETWORK_ERROR"),uploader.UploadError("HTTP_SERVER_ERROR",503),RuntimeError(PRIVATE_ERROR)]:
            api=FakeApi(); api.failures[("POST",OWN+":commit"+uploader.COMMIT_QUERY)]=failure
            report=uploader.new_report()
            self.assert_reason("COMMIT_RESULT_UNKNOWN",uploader.perform_upload,api,b"offline-approved-bundle",report)
            self.assertEqual(sum(":commit" in c[1] for c in api.calls),1)
            self.assertFalse(any(c[0]=="DELETE" for c in api.calls))
            self.assertEqual(report["editCleanup"],"not-attempted-after-ambiguous-commit")
            self.assertFalse(report["commitAcknowledged"] or report["draftVerified"])

    def test_malformed_commit_response_is_inconclusive_without_cleanup(self):
        api=FakeApi();api.commit_response={"id":"unrelated-edit"}
        self.assert_reason("COMMIT_RESULT_UNKNOWN",self.upload,api)
        self.assertFalse(any(c[0]=="DELETE" for c in api.calls))

    def test_post_commit_readback_failure_does_not_delete_committed_edit(self):
        api=FakeApi();api.failures[("GET",VERIFY+"/tracks/internal")]=uploader.UploadError("HTTP_NOT_FOUND",404)
        report=uploader.new_report()
        self.assert_reason("POST_COMMIT_UNVERIFIED",uploader.perform_upload,api,b"offline-approved-bundle",report)
        self.assertTrue(report["commitAcknowledged"])
        self.assertFalse(report["draftVerified"])
        self.assertEqual([(m,p) for m,p,_,_ in api.calls if m=="DELETE"],[("DELETE",VERIFY)])

    def test_reused_committed_edit_id_is_never_deleted(self):
        api=FakeApi();api.verification_id="own-edit"
        self.assert_reason("POST_COMMIT_UNVERIFIED",self.upload,api)
        self.assertFalse(any(c[0]=="DELETE" for c in api.calls))

    def test_cleanup_failure_is_reported_without_claiming_rollback(self):
        api=FakeApi(bundles=[{"versionCode":16,"sha256":"0"*64}]); api.failures[("DELETE",OWN)]=RuntimeError(PRIVATE_ERROR)
        report=uploader.new_report()
        self.assert_reason("ARTIFACT_CONFLICT",uploader.perform_upload,api,b"offline-approved-bundle",report)
        self.assertEqual(report["editCleanup"],"unconfirmed")
        self.assertNotIn("rollback",json.dumps(report))
        self.assertNotIn(PRIVATE_ERROR,json.dumps(report))

    def test_upload_timeout_stays_unknown_even_after_edit_cleanup(self):
        api=FakeApi()
        api.failures[("POST","/upload"+OWN+"/bundles?uploadType=media")]=uploader.UploadError("NETWORK_ERROR")
        report=uploader.new_report()
        self.assert_reason("NETWORK_ERROR",uploader.perform_upload,api,b"offline-approved-bundle",report)
        self.assertFalse(report["bundleUploadConfirmed"])
        self.assertEqual(report["bundleUploadState"],"unknown")
        self.assertTrue(report["versionReservationUnknown"])
        self.assertEqual(report["editCleanup"],"deleted")
        self.assertEqual(sum(c[3] for c in api.calls),1)
        self.assertFalse(report["commitAttempted"])

    def test_token_is_read_only_from_fixed_env_and_never_from_service_account_json(self):
        class OnlyToken:
            def get(self,key,default=None):
                if key!=uploader.TOKEN_ENV:
                    raise AssertionError("Service account JSON must not be read")
                return FAKE_TOKEN
        with patch.object(uploader.os,"environ",OnlyToken()):
            self.assertEqual(uploader.token_from_env(),FAKE_TOKEN)
        for invalid in ["", "{\"private_key\":\"SECRET\"}",FAKE_TOKEN+"\n","x"*8193]:
            with patch.dict(uploader.os.environ,{uploader.TOKEN_ENV:invalid}):
                self.assert_reason("TOKEN_MISSING",uploader.token_from_env)

    def test_https_fixed_host_only_and_unsafe_methods_queries_or_tracks_rejected(self):
        api=uploader.Transport(FAKE_TOKEN);api._opener=Mock()
        unsafe=[("GET","http://attacker.invalid/path"),("GET",OWN+"/tracks/production"),("PUT",OWN+"/bundles"),("POST",OWN+":commit"),("POST",OWN+":commit?changesNotSentForReview=false"),("POST",OWN+":commit?changesNotSentForReview=true&changesInReviewBehavior=CANCEL_IN_REVIEW_AND_SUBMIT"),("DELETE",BASE),("GET",BASE+"/../applications/other")]
        for method,path in unsafe:
            self.assert_reason("RESPONSE_INVALID",api.request,method,path)
        api._opener.open.assert_not_called()
        response=FakeResponse(b'{"bundles":[]}'); api._opener.open.return_value=response
        api.request("GET",OWN+"/bundles")
        request=api._opener.open.call_args.args[0]
        self.assertTrue(request.full_url.startswith("https://androidpublisher.googleapis.com/"))
        self.assertEqual(request.get_header("Authorization"),"Bearer "+FAKE_TOKEN)
        self.assertEqual(api._opener.open.call_args.kwargs["timeout"],120)

    def test_redirect_handler_and_redirect_errors_never_send_token_to_other_host(self):
        api=uploader.Transport(FAKE_TOKEN)
        redirects=[h for h in api._opener.handlers if isinstance(h,urllib.request.HTTPRedirectHandler)]
        self.assertEqual(len(redirects),1)
        request=urllib.request.Request("https://androidpublisher.googleapis.com"+BASE,headers={"Authorization":"Bearer "+FAKE_TOKEN})
        self.assertIsNone(redirects[0].redirect_request(request,None,302,"redirect",{},"https://attacker.invalid/?"+FAKE_TOKEN))
        api._opener=Mock()
        api._opener.open.side_effect=urllib.error.HTTPError(request.full_url,302,PRIVATE_ERROR,{"Location":"https://attacker.invalid"},io.BytesIO(PRIVATE_ERROR.encode()))
        self.assert_reason("REDIRECT_BLOCKED",api.request,"POST",BASE)
        self.assertEqual(api._opener.open.call_count,1)

    def test_responses_are_bounded_and_raw_error_bodies_are_redacted(self):
        api=uploader.Transport(FAKE_TOKEN);api._opener=Mock()
        response=FakeResponse(b"x"*(uploader.MAX_JSON_BYTES+1));api._opener.open.return_value=response
        self.assert_reason("RESPONSE_TOO_LARGE",api.request,"GET",OWN+"/bundles")
        self.assertEqual(response.read_limits,[uploader.MAX_JSON_BYTES+1])
        for body in [b"[]",b"not json PRIVATE",b""]:
            api._opener.open.return_value=FakeResponse(body)
            self.assert_reason("RESPONSE_INVALID",api.request,"GET",OWN+"/bundles")
        api._opener.open.side_effect=urllib.error.HTTPError("https://androidpublisher.googleapis.com",403,PRIVATE_ERROR,{},io.BytesIO(PRIVATE_ERROR.encode()))
        error=self.assert_reason("HTTP_FORBIDDEN",api.request,"GET",OWN+"/bundles")
        self.assertEqual(error.http_status,403)

    def test_public_artifact_download_has_no_auth_and_checks_pinned_bytes(self):
        api=uploader.Transport();api._opener=Mock();api._opener.open.return_value=FakeResponse(b"tampered")
        self.assert_reason("BUNDLE_INVALID",api.download)
        request=api._opener.open.call_args.args[0]
        self.assertEqual(request.full_url,uploader.ARTIFACT_URL)
        self.assertIsNone(request.get_header("Authorization"))

    def test_cli_invalid_manifest_never_reads_token_or_makes_requests(self):
        self.manifest.write_text('{}');report_path=self.root/'result.json'
        with patch.object(uploader,"token_from_env",side_effect=AssertionError("Must not run")),patch.object(uploader,"Transport",side_effect=AssertionError("Must not run")),contextlib.redirect_stdout(io.StringIO()):
            result=uploader.main(["upload","--manifest",str(self.manifest),"--bundle",str(self.root/'Anker.aab'),"--report",str(report_path)])
        self.assertEqual(result,2)
        self.assertEqual(json.loads(report_path.read_text())["reason"],"MANIFEST_INVALID")

    def test_cli_never_echoes_accidental_secret_arguments(self):
        output=io.StringIO()
        with contextlib.redirect_stderr(output),self.assertRaises(SystemExit) as stopped:
            uploader.main(["upload","--token",FAKE_TOKEN])
        self.assertEqual(stopped.exception.code,2)
        self.assertNotIn(FAKE_TOKEN,output.getvalue())

    def test_prepare_cli_writes_verified_download_without_reading_google_credentials(self):
        transport=Mock();transport.download.return_value=b"verified-by-download-boundary"
        target=self.root/'prepared';report_path=self.root/'prepare.json'
        with patch.object(uploader,"Transport",return_value=transport) as factory,patch.object(uploader,"token_from_env",side_effect=AssertionError("No Google auth in prepare")),contextlib.redirect_stdout(io.StringIO()):
            result=uploader.main(["prepare","--manifest",str(self.manifest),"--output-dir",str(target),"--report",str(report_path)])
        self.assertEqual(result,0)
        factory.assert_called_once_with()
        self.assertEqual((target/'Anker.aab').read_bytes(),b"verified-by-download-boundary")
        report=json.loads(report_path.read_text())
        self.assertEqual(report["status"],"prepared")
        self.assertFalse(report["googleRequestsMade"] or report["commitAttempted"])

    def test_cli_reports_redacted_http_failure_and_ambiguous_commit_distinctly(self):
        for commit in [False,True]:
            with self.subTest(commit=commit):
                api=FakeApi()
                endpoint=OWN+":commit"+uploader.COMMIT_QUERY if commit else BASE
                api.failures[("POST",endpoint)]=uploader.UploadError("NETWORK_ERROR") if commit else uploader.UploadError("HTTP_FORBIDDEN",403)
                out=io.StringIO();report_path=self.root/'result.json'
                with patch.object(uploader,"read_bundle",return_value=b"offline-approved-bundle"),patch.object(uploader,"token_from_env",return_value=FAKE_TOKEN),patch.object(uploader,"Transport",return_value=api),contextlib.redirect_stdout(out):
                    result=uploader.main(["upload","--manifest",str(self.manifest),"--bundle",str(self.root/'Anker.aab'),"--report",str(report_path)])
                report=json.loads(report_path.read_text())
                self.assertEqual(result,3 if commit else 2)
                self.assertEqual(report["status"],"inconclusive" if commit else "failed")
                self.assertFalse(report["draftVerified"])
                self.assertNotIn(FAKE_TOKEN,report_path.read_text()+out.getvalue())
                self.assertNotIn(PRIVATE_ERROR,report_path.read_text()+out.getvalue())


if __name__ == "__main__":
    unittest.main(verbosity=2)
