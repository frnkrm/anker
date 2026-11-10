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
# Historical regression fixtures deliberately stay Code16 when production moves
# to Code17. They prove their named boundaries, not the current release approval.
LEGACY16 = {
    "PACKAGE": "de.frnkrm.anker.mobile", "VERSION": 16,
    "RELEASE_NAME": "Anker 1.5.0-rc.2 · Code16",
    "SOURCE": "4d8eaa1cd1dc463e3ce9032779d857a215d020fc",
    "FINGERPRINT": "9786f18293f2eb5d9c3e61098cb03c07ad8e3e5cebcaca0c1c583e0bd9ea5ada",
    "DOWNLOAD_COMMIT": "b2a062709f061f6b1b4470a3826dd0b48b3c0b29",
    "BUNDLE_SHA256": "522e3feb9dbfd8a146dec903dff3e496fc50d4e5a8cead72a5a43bc85964d76e",
    "BUNDLE_BYTES": 22655691,
    "CERTIFICATE": "b47ffffebe137cf15129961de43a27e3ec811acffe4542b6324e11768995b13a",
    "CI_RUN": 42619085381,
    "API_PATH": "/androidpublisher/v3/applications/de.frnkrm.anker.mobile/edits",
    "ARTIFACT_URL": "https://raw.githubusercontent.com/frnkrm/anker/b2a062709f061f6b1b4470a3826dd0b48b3c0b29/Anker.aab",
}
CODE17_RELEASE_NAME = "Anker 1.5.0-rc.3 · Code17"
BASE = LEGACY16["API_PATH"]
OWN = BASE + "/own-edit"
VERIFY = BASE + "/verify-edit"
MATCHING = {"versionCode": 16, "sha256": LEGACY16["BUNDLE_SHA256"]}
TARGET = {"name": LEGACY16["RELEASE_NAME"], "versionCodes": ["16"], "status": "draft"}
PRODUCTION_PINS_AT_IMPORT = {name: getattr(uploader, name) for name in LEGACY16}


def legacy16_approval():
    return {"schemaVersion": 1, "packageName": LEGACY16["PACKAGE"], "versionCode": 16,
            "sourceCommit": LEGACY16["SOURCE"], "sourceFingerprint": LEGACY16["FINGERPRINT"],
            "artifact": {"repository": "frnkrm/anker", "gitCommit": LEGACY16["DOWNLOAD_COMMIT"], "path": "Anker.aab", "sha256": LEGACY16["BUNDLE_SHA256"], "bytes": LEGACY16["BUNDLE_BYTES"]},
            "signingCertificateSha256": LEGACY16["CERTIFICATE"], "ci": {"repository": "frnkrm/anker", "runId": LEGACY16["CI_RUN"], "sourceCommit": LEGACY16["SOURCE"]},
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


class LegacyCode16UploadTests(unittest.TestCase):
    def setUp(self):
        self.legacy_pins = patch.multiple(uploader, **LEGACY16)
        self.legacy_pins.start()
        self.addCleanup(self.legacy_pins.stop)
        self.network = patch("urllib.request.OpenerDirector.open", side_effect=AssertionError("Real network forbidden in tests"))
        self.network.start()
        self.addCleanup(self.network.stop)
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.manifest = self.root / "approval.json"
        self.manifest.write_text(json.dumps(legacy16_approval()))

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
        self.assertEqual(uploader.read_manifest(self.manifest), legacy16_approval())
        value = legacy16_approval()
        value["signingCertificateSha256"] = ":".join(uploader.CERTIFICATE[i:i+2].upper() for i in range(0, 64, 2))
        self.manifest.write_text(json.dumps(value))
        self.assertEqual(uploader.read_manifest(self.manifest)["versionCode"], 16)

    def test_manifest_cannot_change_version_track_status_review_behavior_or_provenance(self):
        changes = [("versionCode", 17), ("versionCode", True), ("schemaVersion", True), ("packageName", "other.package"), ("track", "production"), ("releaseStatus", "completed"),
                   ("sourceCommit", "0" * 40), ("sourceFingerprint", "0" * 64), ("changesNotSentForReview", False), ("changesInReviewBehavior", "CANCEL_IN_REVIEW_AND_SUBMIT"), ("signingCertificateSha256", "00" * 32)]
        for key, value in changes:
            with self.subTest(key=key, value=value):
                data = legacy16_approval(); data[key] = value
                self.manifest.write_text(json.dumps(data))
                self.assert_reason("MANIFEST_INVALID", uploader.read_manifest, self.manifest)
        for group, key, value in [("artifact", "sha256", "0" * 64), ("artifact", "gitCommit", "0" * 40), ("artifact", "path", "other.aab"), ("artifact", "bytes", 22), ("ci", "runId", 1), ("ci", "sourceCommit", "0" * 40)]:
            with self.subTest(group=group, key=key):
                data=legacy16_approval(); data[group][key]=value; self.manifest.write_text(json.dumps(data))
                self.assert_reason("MANIFEST_INVALID", uploader.read_manifest, self.manifest)

    def test_missing_extra_oversized_and_corrupt_manifest_fail_closed(self):
        for data in [{}, {**legacy16_approval(), "apiBase": "https://attacker.invalid"}, {**legacy16_approval(), "changesInReviewBehavior": None}]:
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

    def test_conflict_report_contains_only_structural_status_and_numeric_versions(self):
        api=FakeApi(releases=[{"name":PRIVATE_ERROR,"releaseNotes":[{"text":PRIVATE_ERROR}],"status":"completed","versionCodes":["16"]}])
        report=uploader.new_report()
        self.assert_reason("EXISTING_RELEASE_CONFLICT",uploader.perform_upload,api,b"offline-approved-bundle",report)
        self.assertEqual(report["trackObservation"],{"trackMatches":True,"releasesShape":"list","releases":[{"status":"completed","versionCodes":[16]}],"truncated":False})
        self.assertNotIn(PRIVATE_ERROR,json.dumps(report))
        self.assertFalse(any(c[0]=="PUT" or c[3] or ":commit" in c[1] for c in api.calls))
        self.assertFalse(report["draftVerified"] or report["commitAttempted"])

    def test_exact_completed_release_and_matching_bundle_are_observed_readonly(self):
        release={"status":"completed","versionCodes":["16"],"name":PRIVATE_ERROR,"releaseNotes":[{"text":PRIVATE_ERROR}]}
        api=FakeApi(bundles=[MATCHING],releases=[release]);report=self.upload(api)
        self.assertEqual(report["status"],"already-active")
        self.assertTrue(report["activeReleaseVerified"] and report["bundleReused"])
        self.assertEqual(report["existingReleaseStatus"],"completed")
        self.assertFalse(report["draftVerified"] or report["bundleUploadConfirmed"] or report["commitAttempted"] or report["publishedByThisRun"])
        self.assertEqual(report["steps"],["edit-created","existing-exact-active-release-read"])
        self.assertEqual([(m,p) for m,p,_,_ in api.calls],[("POST",BASE),("GET",OWN+"/bundles"),("GET",OWN+"/tracks/internal"),("DELETE",OWN)])
        self.assertEqual(api.track["releases"],[release])
        self.assertEqual(report["editCleanup"],"deleted")
        self.assertNotIn(PRIVATE_ERROR,json.dumps(report))

    def test_completed_release_with_wrong_bundle_hash_still_stops(self):
        api=FakeApi(bundles=[{"versionCode":16,"sha256":"0"*64}],releases=[{"status":"completed","versionCodes":["16"]}])
        report=uploader.new_report()
        self.assert_reason("ARTIFACT_CONFLICT",uploader.perform_upload,api,b"offline-approved-bundle",report)
        self.assertFalse(report["activeReleaseVerified"] or report["commitAttempted"])
        self.assertFalse(any(c[0]=="PUT" or c[3] or ":commit" in c[1] for c in api.calls))

    def test_every_other_active_track_shape_remains_a_conflict_even_with_matching_bundle(self):
        cases=[[{"status":"completed","versionCodes":["17"]}], [{"status":"completed","versionCodes":["16","15"]}],
               [{"status":"completed","versionCodes":["16"]},{"status":"completed","versionCodes":["16"]}],
               [{"status":"completed","versionCodes":["16"]},{"status":"draft","versionCodes":["15"]}],
               [{"status":"halted","versionCodes":["16"]}], [{"status":"inProgress","versionCodes":["16"]}],
               [{"status":"unknown","versionCodes":["16"]}], [{"status":"completed","versionCodes":[16]}]]
        for releases in cases:
            with self.subTest(releases=releases):
                api=FakeApi(bundles=[MATCHING],releases=releases);report=uploader.new_report()
                self.assert_reason("EXISTING_RELEASE_CONFLICT",uploader.perform_upload,api,b"offline-approved-bundle",report)
                self.assertTrue(report["bundleReused"])
                self.assertFalse(report["activeReleaseVerified"] or report["draftVerified"] or report["commitAttempted"])
                self.assertFalse(any(c[0]=="PUT" or c[3] or ":validate" in c[1] or ":commit" in c[1] for c in api.calls))
        api=FakeApi(bundles=[MATCHING],releases=[{"status":"completed","versionCodes":["16"]}]);api.track["track"]="production"
        self.assert_reason("EXISTING_RELEASE_CONFLICT",self.upload,api)
        self.assertFalse(any(c[0]=="PUT" or c[3] or ":validate" in c[1] or ":commit" in c[1] for c in api.calls))

    def test_cli_already_active_is_observation_success_without_new_publication(self):
        api=FakeApi(bundles=[MATCHING],releases=[{"status":"completed","versionCodes":["16"]}]);out=io.StringIO();report_path=self.root/'active.json'
        with patch.object(uploader,"read_bundle",return_value=b"offline-approved-bundle"),patch.object(uploader,"token_from_env",return_value=FAKE_TOKEN),patch.object(uploader,"Transport",return_value=api),contextlib.redirect_stdout(out):
            result=uploader.main(["upload","--manifest",str(self.manifest),"--bundle",str(self.root/'Anker.aab'),"--report",str(report_path)])
        self.assertEqual(result,0)
        report=json.loads(report_path.read_text())
        self.assertEqual(report["status"],"already-active")
        self.assertTrue(report["activeReleaseVerified"])
        self.assertFalse(report["draftVerified"] or report["commitAttempted"] or report["commitAcknowledged"] or report["publishedByThisRun"])
        self.assertNotIn(FAKE_TOKEN,out.getvalue()+report_path.read_text())

    def test_future_code17_draft_retains_the_complete_known_completed_code16(self):
        old={"status":"completed","versionCodes":["16"],"name":PRIVATE_ERROR,"releaseNotes":[{"language":"de-DE","text":PRIVATE_ERROR}],"inAppUpdatePriority":2}
        untouched=copy.deepcopy(old)
        api=FakeApi(bundles=[MATCHING],releases=[old])
        api.upload_response={"versionCode":17,"sha256":"1"*64}
        with patch.object(uploader,"VERSION",17),patch.object(uploader,"BUNDLE_SHA256","1"*64),patch.object(uploader,"RELEASE_NAME",CODE17_RELEASE_NAME):
            report=self.upload(api)
        put=next(c for c in api.calls if c[0]=="PUT")
        body=json.loads(put[2])
        self.assertEqual(body["releases"][0],untouched)
        self.assertEqual(old,untouched)
        self.assertEqual(body["releases"][1]["versionCodes"],["17"])
        self.assertEqual(body["releases"][1]["status"],"draft")
        self.assertEqual(body["releases"][1]["name"],CODE17_RELEASE_NAME)
        self.assertEqual(len(body["releases"]),2)
        self.assertEqual(api.track["releases"],body["releases"])
        self.assertEqual(report["status"],"draft-committed")
        self.assertTrue(report["draftVerified"] and report["bundleUploadConfirmed"])
        self.assertFalse(report["activeReleaseVerified"] or report["publishedByThisRun"])
        self.assertNotIn(PRIVATE_ERROR,json.dumps(report))

    def test_future_code17_existing_draft_is_reused_beside_unchanged_completed16(self):
        old={"status":"completed","versionCodes":["16"],"name":PRIVATE_ERROR}
        new={"status":"draft","versionCodes":["17"],"name":PRIVATE_ERROR}
        api=FakeApi(bundles=[MATCHING,{"versionCode":17,"sha256":"1"*64}],releases=[old,new])
        with patch.object(uploader,"VERSION",17),patch.object(uploader,"BUNDLE_SHA256","1"*64),patch.object(uploader,"RELEASE_NAME",CODE17_RELEASE_NAME):
            report=self.upload(api)
        self.assertEqual(report["status"],"already-draft")
        self.assertTrue(report["draftVerified"] and report["bundleReused"])
        self.assertFalse(report["commitAttempted"] or report["publishedByThisRun"])
        self.assertEqual(api.track["releases"],[old,new])
        self.assertFalse(any(c[0]=="PUT" or c[3] or ":validate" in c[1] or ":commit" in c[1] for c in api.calls))

    def test_future_code17_exact_active_target_still_has_its_readonly_path(self):
        active={"status":"completed","versionCodes":["17"]}
        api=FakeApi(bundles=[{"versionCode":17,"sha256":"1"*64}],releases=[active])
        with patch.object(uploader,"VERSION",17),patch.object(uploader,"BUNDLE_SHA256","1"*64),patch.object(uploader,"RELEASE_NAME",CODE17_RELEASE_NAME):
            report=self.upload(api)
        self.assertEqual(report["status"],"already-active")
        self.assertTrue(report["activeReleaseVerified"])
        self.assertFalse(report["draftVerified"] or report["commitAttempted"] or report["publishedByThisRun"])
        self.assertFalse(any(c[0]=="PUT" or c[3] or ":validate" in c[1] or ":commit" in c[1] for c in api.calls))

    def test_future_code17_rejects_all_other_active_or_mixed_previous_releases(self):
        old={"status":"completed","versionCodes":["16"]}
        cases=[[{"status":"completed","versionCodes":["15"]}], [{"status":"completed","versionCodes":["16","15"]}],
               [{"status":"inProgress","versionCodes":["16"]}], [{"status":"halted","versionCodes":["16"]}],
               [old,old], [old,{"status":"draft","versionCodes":["16"]}],
               [old,{"status":"draft","versionCodes":["16","17"]}], [old,{"status":"completed","versionCodes":["17"]}],
               [old,{"status":"inProgress","versionCodes":["17"]}]]
        for releases in cases:
            with self.subTest(releases=releases):
                api=FakeApi(releases=releases)
                with patch.object(uploader,"VERSION",17),patch.object(uploader,"BUNDLE_SHA256","1"*64),patch.object(uploader,"RELEASE_NAME",CODE17_RELEASE_NAME):
                    self.assert_reason("EXISTING_RELEASE_CONFLICT",self.upload,api)
                self.assertFalse(any(c[0]=="PUT" or c[3] or ":validate" in c[1] or ":commit" in c[1] for c in api.calls))

    def test_previous_active_release_allowance_is_not_generic_or_enabled_for_code16(self):
        for target,previous in [(16,"16"),(16,"15"),(18,"16"),(18,"17")]:
            with self.subTest(target=target,previous=previous),patch.object(uploader,"VERSION",target):
                self.assert_reason("EXISTING_RELEASE_CONFLICT",uploader.inspect_track,{"track":"internal","releases":[{"status":"completed","versionCodes":[previous]}]})

    def test_code17_update_response_cannot_change_or_drop_the_retained_code16(self):
        old={"status":"completed","versionCodes":["16"],"name":"Preserve name","releaseNotes":[{"language":"de-DE","text":"Preserve notes"}]}
        target={**TARGET,"name":CODE17_RELEASE_NAME,"versionCodes":["17"]}
        for changed in [[],[{**old,"name":"Changed"}],[{**old,"status":"draft"}],[{**old,"releaseNotes":[]}]]:
            api=FakeApi(releases=[old]);api.upload_response={"versionCode":17,"sha256":"1"*64}
            api.changed_response={"track":"internal","releases":[*changed,target]}
            with self.subTest(changed=changed),patch.object(uploader,"VERSION",17),patch.object(uploader,"BUNDLE_SHA256","1"*64),patch.object(uploader,"RELEASE_NAME",CODE17_RELEASE_NAME):
                self.assert_reason("DRAFT_RESPONSE_MISMATCH",self.upload,api)
            self.assertFalse(any(":validate" in c[1] or ":commit" in c[1] for c in api.calls))

    def test_code17_persisted_readback_must_retain_completed16_exactly(self):
        old={"status":"completed","versionCodes":["16"],"name":"Preserve name","releaseNotes":[{"language":"de-DE","text":"Preserve notes"}]}
        target={**TARGET,"name":CODE17_RELEASE_NAME,"versionCodes":["17"]}
        for changed in [[],[{**old,"name":"Changed"}],[{**old,"status":"draft"}],[{**old,"releaseNotes":[]}]]:
            api=FakeApi(releases=[old]);api.upload_response={"versionCode":17,"sha256":"1"*64}
            api.readback_response={"track":"internal","releases":[*changed,target]};report=uploader.new_report()
            with self.subTest(changed=changed),patch.object(uploader,"VERSION",17),patch.object(uploader,"BUNDLE_SHA256","1"*64),patch.object(uploader,"RELEASE_NAME",CODE17_RELEASE_NAME):
                self.assert_reason("POST_COMMIT_UNVERIFIED",uploader.perform_upload,api,b"offline-approved-bundle",report)
            self.assertTrue(report["commitAcknowledged"])
            self.assertFalse(report["draftVerified"] or report["publishedByThisRun"])
            self.assertNotIn(("DELETE",OWN),[(m,p) for m,p,_,_ in api.calls])

    def test_track_observation_redacts_hostile_track_status_versions_and_freetext(self):
        raw={"track":PRIVATE_ERROR,"name":PRIVATE_ERROR,"releases":[{"status":PRIVATE_ERROR,"versionCodes":["16",PRIVATE_ERROR,True,16,"2100000001","00016"],"releaseNotes":[PRIVATE_ERROR]}, {"status":{"private":PRIVATE_ERROR},"versionCodes":None}]}
        observation=uploader.track_observation(raw)
        self.assertEqual(observation,{"trackMatches":False,"releasesShape":"list","releases":[{"status":"unknown","versionCodes":[16]},{"status":"unknown","versionCodes":[]}],"truncated":True})
        self.assertNotIn(PRIVATE_ERROR,json.dumps(observation))
        self.assertNotIn("name",json.dumps(observation))
        self.assertNotIn("releaseNotes",json.dumps(observation))

    def test_track_observation_is_bounded_to_six_releases_and_six_codes_each(self):
        raw={"track":"internal","releases":[{"status":"draft","versionCodes":[str(v) for v in range(101,109)]} for _ in range(8)]}
        observation=uploader.track_observation(raw)
        self.assertEqual(len(observation["releases"]),6)
        self.assertTrue(observation["truncated"])
        self.assertTrue(all(row=={"status":"draft","versionCodes":[101,102,103,104,105,106]} for row in observation["releases"]))
        self.assertEqual(uploader.track_observation({"track":"internal","releases":[{"status":"draft","versionCodes":["1","2100000000"]}]} )["releases"][0]["versionCodes"],[1,2100000000])

    def test_missing_malformed_or_empty_release_versions_still_fail_and_remain_observable(self):
        for release in [{"status":"draft"},{"status":"draft","versionCodes":[]},{"status":"draft","versionCodes":PRIVATE_ERROR},PRIVATE_ERROR]:
            api=FakeApi(releases=[release]);report=uploader.new_report()
            self.assert_reason("EXISTING_RELEASE_CONFLICT",uploader.perform_upload,api,b"offline-approved-bundle",report)
            observed=report["trackObservation"]
            self.assertEqual(observed["releases"][0]["versionCodes"],[])
            self.assertTrue(observed["truncated"])
            self.assertNotIn(PRIVATE_ERROR,json.dumps(report))
            self.assertFalse(any(c[0]=="PUT" or c[3] or ":commit" in c[1] for c in api.calls))

    def test_wrong_track_and_nonlist_releases_are_diagnosed_without_changing_guards(self):
        for track in [{"track":PRIVATE_ERROR,"releases":[]},{"track":"internal","releases":{"secret":PRIVATE_ERROR}}]:
            api=FakeApi();api.track=track;report=uploader.new_report()
            self.assert_reason("EXISTING_RELEASE_CONFLICT",uploader.perform_upload,api,b"offline-approved-bundle",report)
            observation=report["trackObservation"]
            self.assertEqual(observation["trackMatches"],track["track"]=="internal")
            self.assertEqual(observation["releasesShape"],"list" if isinstance(track["releases"],list) else "invalid")
            self.assertEqual(observation["releases"],[])
            self.assertNotIn(PRIVATE_ERROR,json.dumps(report))
            self.assertFalse(any(c[0]=="PUT" or c[3] or ":commit" in c[1] for c in api.calls))

    def test_existing_exact_draft_observation_preserves_readonly_idempotency(self):
        api=FakeApi(bundles=[MATCHING],releases=[TARGET]);report=self.upload(api)
        self.assertEqual(report["status"],"already-draft")
        self.assertEqual(report["trackObservation"],{"trackMatches":True,"releasesShape":"list","releases":[{"status":"draft","versionCodes":[16]}],"truncated":False})
        self.assertFalse(any(c[0]=="PUT" or c[3] or ":commit" in c[1] for c in api.calls))

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


class ProductionApprovalTests(unittest.TestCase):
    """Unpatched publisher pins plus the actual checked-in approval, not Legacy16 fixtures."""

    def setUp(self):
        # A fixture patch leaking from a legacy regression must never make these
        # current-approval checks green against historical values.
        self.assertEqual({name: getattr(uploader, name) for name in LEGACY16}, PRODUCTION_PINS_AT_IMPORT)
        self.network = patch("urllib.request.OpenerDirector.open", side_effect=AssertionError("Real network forbidden in tests"))
        self.network.start()
        self.addCleanup(self.network.stop)
        self.manifest = Path(__file__).resolve().parents[1] / "docs/PLAY_UPLOAD_APPROVAL.json"
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def test_actual_approval_is_bound_to_unpatched_production_target_and_provenance(self):
        value = uploader.read_manifest(self.manifest)
        expected = {
            16: (LEGACY16["SOURCE"], LEGACY16["FINGERPRINT"], LEGACY16["CI_RUN"], LEGACY16["RELEASE_NAME"]),
            17: ('80f6a692b005ab08edacf9e6ad9e9669e4c383f7',
                 '10c21f4f5bb07215244a1cc53dc21f8423a020f24aa7c1cfb4df38b9c3e441c7',
                 42748341550, CODE17_RELEASE_NAME),
        }
        self.assertIn(uploader.VERSION, expected)
        source, fingerprint, ci_run, name = expected[uploader.VERSION]
        self.assertEqual(value["packageName"], "de.frnkrm.anker.mobile")
        self.assertEqual(value["versionCode"], uploader.VERSION)
        self.assertEqual(value["sourceCommit"], source)
        self.assertEqual(value["sourceFingerprint"], fingerprint)
        self.assertEqual(value["ci"], {"repository": "frnkrm/anker", "runId": ci_run, "sourceCommit": source})
        self.assertEqual(uploader.RELEASE_NAME, name)
        self.assertEqual(value["signingCertificateSha256"].replace(":", "").lower(), LEGACY16["CERTIFICATE"])
        artifact = value["artifact"]
        self.assertEqual(artifact, {"repository": "frnkrm/anker", "gitCommit": uploader.DOWNLOAD_COMMIT,
                                   "path": "Anker.aab", "sha256": uploader.BUNDLE_SHA256, "bytes": uploader.BUNDLE_BYTES})
        self.assertRegex(artifact["gitCommit"], r"^[a-f0-9]{40}$")
        self.assertRegex(artifact["sha256"], r"^[a-f0-9]{64}$")
        self.assertIs(type(artifact["bytes"]), int)
        self.assertGreater(artifact["bytes"], 1_000_000)
        self.assertEqual(uploader.ARTIFACT_URL,
                         f'https://raw.githubusercontent.com/frnkrm/anker/{artifact["gitCommit"]}/Anker.aab')
        self.assertEqual((value["track"], value["releaseStatus"], value["changesNotSentForReview"], value["changesInReviewBehavior"]),
                         ("internal", "draft", True, "ERROR_IF_IN_REVIEW"))

    def test_actual_approval_mutations_fail_against_real_unpatched_pins(self):
        original = json.loads(self.manifest.read_text())
        changes = [
            ("versionCode", uploader.VERSION + 1), ("packageName", "other.package"),
            ("sourceCommit", "0" * 40), ("sourceFingerprint", "0" * 64),
            ("track", "production"), ("releaseStatus", "completed"),
            ("changesInReviewBehavior", "CANCEL_IN_REVIEW_AND_SUBMIT"),
        ]
        wrong = self.root / "wrong-approval.json"
        variants = []
        for field, changed in changes:
            value = copy.deepcopy(original); value[field] = changed; variants.append(value)
        for field, changed in [("runId", uploader.CI_RUN + 1), ("sourceCommit", "0" * 40)]:
            value = copy.deepcopy(original); value["ci"][field] = changed; variants.append(value)
        for field, changed in [("sha256", "0" * 64), ("gitCommit", "0" * 40), ("bytes", uploader.BUNDLE_BYTES + 1)]:
            value = copy.deepcopy(original); value["artifact"][field] = changed; variants.append(value)
        for index, value in enumerate(variants):
            with self.subTest(mutation=index):
                wrong.write_text(json.dumps(value))
                with self.assertRaises(uploader.UploadError) as raised:
                    uploader.read_manifest(wrong)
                self.assertEqual(raised.exception.code, "MANIFEST_INVALID")

    def test_actual_target_draft_cli_preserves_completed16_when_code17_is_approved(self):
        approval = uploader.read_manifest(self.manifest)
        self.assertIn(approval["versionCode"], [16, 17])
        # No production constant is patched: this same test exercises the real
        # Code17 draft/retained16 path as soon as Code17 is explicitly approved.
        old = {"status": "completed", "versionCodes": ["16"], "name": PRIVATE_ERROR,
               "releaseNotes": [{"language": "de-DE", "text": PRIVATE_ERROR}], "inAppUpdatePriority": 2}
        retained = [copy.deepcopy(old)] if approval["versionCode"] == 17 else []
        bundles = [copy.deepcopy(MATCHING)] if retained else []
        api = FakeApi(bundles=bundles, releases=retained)
        api.upload_response = {"versionCode": approval["versionCode"], "sha256": approval["artifact"]["sha256"]}
        report_path = self.root / "actual-target-result.json"
        output = io.StringIO()
        with patch.object(uploader, "read_bundle", return_value=b"offline-approved-bundle"), \
                patch.object(uploader, "token_from_env", return_value=FAKE_TOKEN), \
                patch.object(uploader, "Transport", return_value=api), contextlib.redirect_stdout(output):
            code = uploader.main(["upload", "--manifest", str(self.manifest), "--bundle", str(self.root / "Anker.aab"), "--report", str(report_path)])
        self.assertEqual(code, 0)
        report = json.loads(report_path.read_text())
        target = {"name": uploader.RELEASE_NAME, "versionCodes": [str(approval["versionCode"])], "status": "draft"}
        self.assertEqual(api.track, {"track": "internal", "releases": [*retained, target]})
        self.assertEqual(old["status"], "completed")
        self.assertEqual(old["versionCodes"], ["16"])
        self.assertEqual(report["versionCode"], approval["versionCode"])
        self.assertEqual(report["sourceCommit"], approval["sourceCommit"])
        self.assertEqual(report["sourceFingerprint"], approval["sourceFingerprint"])
        self.assertEqual(report["bundleSha256"], approval["artifact"]["sha256"])
        self.assertEqual(report["ciRunId"], approval["ci"]["runId"])
        self.assertEqual(report["status"], "draft-committed")
        self.assertTrue(report["draftVerified"] and report["bundleUploadConfirmed"] and report["commitAcknowledged"])
        self.assertFalse(report["activeReleaseVerified"] or report["publishedByThisRun"])
        self.assertEqual(sum(call[3] for call in api.calls), 1)
        self.assertEqual(sum(":validate" in call[1] for call in api.calls), 1)
        self.assertEqual(sum(":commit" in call[1] for call in api.calls), 1)
        put = next(call for call in api.calls if call[0] == "PUT")
        self.assertEqual(json.loads(put[2]), api.track)
        self.assertIn(("GET", VERIFY + "/tracks/internal"), [(m, p) for m, p, _, _ in api.calls])
        self.assertNotIn(PRIVATE_ERROR, report_path.read_text() + output.getvalue())
        self.assertNotIn(FAKE_TOKEN, report_path.read_text() + output.getvalue())


if __name__ == "__main__":
    unittest.main(verbosity=2)
