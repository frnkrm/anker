#!/usr/bin/env python3
"""Upload the approved, immutable Code17 bundle as an internal Play draft only.

No signing keys or service-account JSON are read. Google credentials come only
from GOOGLE_PLAY_ACCESS_TOKEN, supplied by the workflow's authentication step.
There are no automatic network retries after an ambiguous commit. Code17 alone
permits one same-edit compatibility commit after an exact, explicit flag refusal.
"""
from __future__ import annotations

import argparse
import copy
from datetime import datetime, timezone
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import socket
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request


PACKAGE = "de.frnkrm.anker.mobile"
VERSION = 17
RELEASE_NAME = 'Anker 1.5.0-rc.3 · Code17'
SOURCE = '80f6a692b005ab08edacf9e6ad9e9669e4c383f7'
FINGERPRINT = '10c21f4f5bb07215244a1cc53dc21f8423a020f24aa7c1cfb4df38b9c3e441c7'
DOWNLOAD_COMMIT = 'e448f35c88a4483a6451a1b65b78b2101f8485bd'
BUNDLE_SHA256 = '2e53d046d32ec4fc53f083a0a9a59e688f1224615af7946330642e97b8c84098'
BUNDLE_BYTES = 22705124
CERTIFICATE = "b47ffffebe137cf15129961de43a27e3ec811acffe4542b6324e11768995b13a"
CI_RUN = 42748341550
ARTIFACT_URL = f"https://raw.githubusercontent.com/frnkrm/anker/{DOWNLOAD_COMMIT}/Anker.aab"
HOST = "androidpublisher.googleapis.com"
API_PATH = f"/androidpublisher/v3/applications/{PACKAGE}/edits"
TOKEN_ENV = "GOOGLE_PLAY_ACCESS_TOKEN"
COMMIT_QUERY = "?changesNotSentForReview=true&changesInReviewBehavior=ERROR_IF_IN_REVIEW"
COMMIT_COMPAT_QUERY = "?changesInReviewBehavior=ERROR_IF_IN_REVIEW"
COMMIT_FLAG_DIAGNOSTIC = "COMMIT_REVIEW_FLAG_UNSUPPORTED"
MAX_GOOGLE_ERROR_BYTES = 64 * 1024
MAX_JSON_BYTES = 1024 * 1024
TIMEOUT_SECONDS = 120

MESSAGES = {
    "MANIFEST_INVALID": "Die Freigabedatei passt nicht zum ausdrücklich freigegebenen Code17-Bundle. Nichts wurde hochgeladen.",
    "BUNDLE_INVALID": "Die Datei stimmt nicht mit dem geprüften Code17-Bundle überein. Das freigegebene Paket erneut vorbereiten.",
    "ARTIFACT_DOWNLOAD_FAILED": "Das fest freigegebene öffentliche Bundle konnte nicht geladen werden. Downloadzugang prüfen; es gab keinen Google-Upload.",
    "TOKEN_MISSING": "Der Workflow hat kein gültiges kurzlebiges Google-Zugriffstoken bereitgestellt. Den Authentifizierungsschritt prüfen.",
    "HTTP_UNAUTHORIZED": "Google hat die Anmeldung abgelehnt. Ein frisches Token und den Authentifizierungsschritt prüfen.",
    "HTTP_FORBIDDEN": "Google hat den Zugriff verweigert. Play-Console-Apprechte des Dienstkontos und Android-Publisher-API-Aktivierung prüfen.",
    "HTTP_NOT_FOUND": "Google findet die App oder den Zugriffspfad nicht. Paketkennung und Appzugriff in der Console prüfen; möglicherweise ist ein erster manueller Console-Upload erforderlich. Das ist noch nicht nachgewiesen.",
    "HTTP_CONFLICT": "Google meldet einen Konflikt. Version17 und bestehende Entwürfe in der Console prüfen; nicht blind erneut hochladen.",
    "HTTP_INVALID_REQUEST": "Google hat den Entwurf abgelehnt. Console-Einrichtung, App-Signierung und mögliche Erstupload-Voraussetzungen prüfen; nichts öffentlich freigeben.",
    "HTTP_RATE_LIMIT": "Google begrenzt die Anfragen. Den tatsächlichen Console-Stand prüfen; dieser Lauf wiederholt keine Mutation automatisch.",
    "HTTP_SERVER_ERROR": "Google hat die Anfrage nicht bestätigt. Den tatsächlichen Console-Stand prüfen, bevor ein neuer Lauf gestartet wird.",
    "HTTP_ERROR": "Die Anfrage wurde nicht bestätigt. Den Console-Stand und die freigegebenen Rechte prüfen.",
    "REDIRECT_BLOCKED": "Eine Weiterleitung wurde aus Sicherheitsgründen blockiert. Zugangsdaten wurden nicht an das Weiterleitungsziel gesendet.",
    "NETWORK_ERROR": "Die Verbindung wurde nicht bestätigt. Den Console-Stand prüfen; dieser Lauf wiederholt keine Mutation automatisch.",
    "RESPONSE_INVALID": "Die Antwort hatte ein unerwartetes Format. Der Lauf stoppt, ohne eine Veröffentlichung zu behaupten.",
    "RESPONSE_TOO_LARGE": "Die Antwort überschreitet die feste Größenbegrenzung. Der Lauf stoppt.",
    "ARTIFACT_CONFLICT": "Version17 ist bei Google mit einer anderen Bundle-Prüfsumme vorhanden. Nicht ersetzen; den Console-Stand klären.",
    "EXISTING_RELEASE_CONFLICT": "Im internen Track liegt ein unerwarteter oder bereits aktiver Release. Der Lauf verändert diesen Bestand nicht.",
    "UPLOAD_RESPONSE_MISMATCH": "Google hat nicht genau Version17 mit der freigegebenen Bundle-Prüfsumme bestätigt. Den Console-Stand prüfen.",
    "DRAFT_RESPONSE_MISMATCH": "Google hat den gewünschten Entwurfsbestand nicht eindeutig bestätigt. Keine erfolgreiche Freigabe behaupten.",
    "COMMIT_RESULT_UNKNOWN": "Die Commit-Antwort ist unklar. Der Entwurf könnte gespeichert sein. Vor einem neuen Lauf den tatsächlichen Console-Stand prüfen; es wird nicht automatisch wiederholt.",
    "POST_COMMIT_UNVERIFIED": "Google hat den Commit bestätigt, der gespeicherte Entwurfsstatus konnte danach aber nicht sicher gelesen werden. In der Console prüfen.",
    "LOCAL_IO_ERROR": "Eine lokale Datei konnte nicht gelesen oder geschrieben werden. Keine Zugangsdaten oder Fehlermeldungsinhalte werden ausgegeben.",
    "UNEXPECTED_ERROR": "Der Lauf wurde ohne bestätigtes Ergebnis beendet. Den Console-Stand und den bereinigten Bericht prüfen.",
}


class UploadError(Exception):
    def __init__(self, code: str, http_status: int | None = None, *, diagnostic_code: str | None = None):
        self.code = code if code in MESSAGES else "UNEXPECTED_ERROR"
        self.http_status = http_status if type(http_status) is int and 100 <= http_status <= 599 else None
        self.diagnostic_code = COMMIT_FLAG_DIAGNOSTIC if diagnostic_code == COMMIT_FLAG_DIAGNOSTIC else None
        super().__init__(self.code)


class SafeArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        # Do not echo unknown arguments: credentials are accepted only via env.
        self.exit(2, "Ungültiger Aufruf. Nutze --help; Zugangsdaten gehören ausschließlich in die vorgesehene Umgebungsvariable.\n")


def exact_keys(value: object, keys: set[str]) -> bool:
    return isinstance(value, dict) and set(value) == keys


def read_manifest(path: Path) -> dict:
    try:
        if path.stat().st_size > 16384:
            raise UploadError("MANIFEST_INVALID")
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, UnicodeError):
        raise UploadError("MANIFEST_INVALID") from None
    keys = {"schemaVersion", "packageName", "versionCode", "sourceCommit", "sourceFingerprint", "artifact", "signingCertificateSha256", "ci", "track", "releaseStatus", "changesNotSentForReview", "changesInReviewBehavior"}
    if not exact_keys(value, keys):
        raise UploadError("MANIFEST_INVALID")
    artifact, ci = value["artifact"], value["ci"]
    valid = (type(value["schemaVersion"]) is int and value["schemaVersion"] == 1
             and value["packageName"] == PACKAGE and type(value["versionCode"]) is int and value["versionCode"] == VERSION
             and value["sourceCommit"] == SOURCE and value["sourceFingerprint"] == FINGERPRINT
             and value["track"] == "internal" and value["releaseStatus"] == "draft" and value["changesNotSentForReview"] is True
             and value["changesInReviewBehavior"] == "ERROR_IF_IN_REVIEW"
             and isinstance(value["signingCertificateSha256"], str)
             and value["signingCertificateSha256"].replace(":", "").lower() == CERTIFICATE
             and exact_keys(artifact, {"repository", "gitCommit", "path", "sha256", "bytes"})
             and artifact == {"repository": "frnkrm/anker", "gitCommit": DOWNLOAD_COMMIT, "path": "Anker.aab", "sha256": BUNDLE_SHA256, "bytes": BUNDLE_BYTES}
             and type(artifact["bytes"]) is int
             and exact_keys(ci, {"repository", "runId", "sourceCommit"})
             and ci == {"repository": "frnkrm/anker", "runId": CI_RUN, "sourceCommit": SOURCE} and type(ci["runId"]) is int)
    if not valid:
        raise UploadError("MANIFEST_INVALID")
    return value


def read_bundle(path: Path) -> bytes:
    try:
        if path.stat().st_size != BUNDLE_BYTES:
            raise UploadError("BUNDLE_INVALID")
        with path.open("rb") as stream:
            data = stream.read(BUNDLE_BYTES + 1)
    except OSError:
        raise UploadError("BUNDLE_INVALID") from None
    if len(data) != BUNDLE_BYTES or hashlib.sha256(data).hexdigest() != BUNDLE_SHA256:
        raise UploadError("BUNDLE_INVALID")
    return data


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def http_code(status: int) -> str:
    if 300 <= status < 400:
        return "REDIRECT_BLOCKED"
    return {400: "HTTP_INVALID_REQUEST", 401: "HTTP_UNAUTHORIZED", 403: "HTTP_FORBIDDEN", 404: "HTTP_NOT_FOUND", 409: "HTTP_CONFLICT", 429: "HTTP_RATE_LIMIT"}.get(status, "HTTP_SERVER_ERROR" if status >= 500 else "HTTP_ERROR")


def commit_error_diagnostic(raw: bytes) -> str | None:
    """Recognize one Google refusal; never retain or return remote text."""
    try:
        if len(raw) >= MAX_GOOGLE_ERROR_BYTES:
            return None
        def unique(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise ValueError()
                result[key] = value
            return result
        def invalid_constant(_):
            raise ValueError()
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=unique, parse_constant=invalid_constant)
        error = value.get("error") if isinstance(value, dict) else None
        message = error.get("message") if isinstance(error, dict) else None
        known = "The query parameter changesNotSentForReview must not be set"
        if (isinstance(error, dict) and type(error.get("code")) is int and error["code"] == 400
                and isinstance(message, str) and message.strip() in {known, known + "."}):
            return COMMIT_FLAG_DIAGNOSTIC
    except (ValueError, UnicodeError, RecursionError):
        pass
    return None


class Transport:
    """One bounded request; redirects and caller-supplied URLs are forbidden."""
    def __init__(self, token: str | None = None):
        self._token = token
        self._opener = urllib.request.build_opener(NoRedirect())

    def request(self, method: str, path: str, payload: bytes | None = None, *, bundle: bool = False) -> dict:
        identifier = r"/[A-Za-z0-9_-]{1,200}"
        if bundle:
            valid = method == "POST" and re.fullmatch(re.escape("/upload" + API_PATH) + identifier + r"/bundles\?uploadType=media", path)
        else:
            valid = ((method == "POST" and path == API_PATH)
                     or method == "DELETE" and re.fullmatch(re.escape(API_PATH) + identifier, path)
                     or method == "GET" and re.fullmatch(re.escape(API_PATH) + identifier + r"/(?:bundles|tracks/internal)", path)
                     or method == "PUT" and re.fullmatch(re.escape(API_PATH) + identifier + r"/tracks/internal", path)
                     or method == "POST" and re.fullmatch(re.escape(API_PATH) + identifier + ":validate", path)
                     or method == "POST" and re.fullmatch(re.escape(API_PATH) + identifier + re.escape(":commit" + COMMIT_QUERY), path)
                     or method == "POST" and VERSION == 17 and re.fullmatch(re.escape(API_PATH) + identifier + re.escape(":commit" + COMMIT_COMPAT_QUERY), path))
        if not valid:
            raise UploadError("RESPONSE_INVALID")
        if self._token is None:
            raise UploadError("TOKEN_MISSING")
        headers = {"Authorization": "Bearer " + self._token, "Accept": "application/json", "User-Agent": "Anker-Code17-Draft-Uploader/1"}
        if payload is not None:
            headers["Content-Type"] = "application/octet-stream" if bundle else "application/json; charset=utf-8"
        request = urllib.request.Request("https://" + HOST + path, data=payload, headers=headers, method=method)
        return self._read(request, MAX_JSON_BYTES)

    def _read(self, request: urllib.request.Request, maximum: int) -> dict:
        try:
            with self._opener.open(request, timeout=TIMEOUT_SECONDS) as response:
                if response.status < 200 or response.status >= 300:
                    raise UploadError(http_code(response.status), response.status)
                raw = response.read(maximum + 1)
                if len(raw) > maximum:
                    raise UploadError("RESPONSE_TOO_LARGE")
                if not raw:
                    if request.method == "DELETE":
                        return {}
                    raise UploadError("RESPONSE_INVALID")
                value = json.loads(raw)
                if not isinstance(value, dict):
                    raise UploadError("RESPONSE_INVALID")
                return value
        except urllib.error.HTTPError as error:
            # Never log, print or propagate Google's response body, URL or headers.
            status = error.code
            diagnostic = None
            try:
                if (status == 400 and request.method == "POST" and re.fullmatch(
                        "https://" + re.escape(HOST + API_PATH) + r"/[A-Za-z0-9_-]{1,200}" + re.escape(":commit" + COMMIT_QUERY), request.full_url)):
                    diagnostic = commit_error_diagnostic(error.read(MAX_GOOGLE_ERROR_BYTES))
            except Exception:
                pass
            finally:
                try:
                    error.close()
                except Exception:
                    pass
            raise UploadError(http_code(status), status, diagnostic_code=diagnostic) from None
        except (urllib.error.URLError, TimeoutError, socket.timeout, ssl.SSLError, ConnectionError, OSError, http.client.HTTPException):
            raise UploadError("NETWORK_ERROR") from None
        except (ValueError, UnicodeError):
            raise UploadError("RESPONSE_INVALID") from None

    def download(self) -> bytes:
        # Public immutable artifact only. No Google/GitHub token is used here.
        request = urllib.request.Request(ARTIFACT_URL, headers={"User-Agent": "Anker-Code17-Draft-Uploader/1"}, method="GET")
        try:
            with self._opener.open(request, timeout=TIMEOUT_SECONDS) as response:
                if response.status != 200:
                    raise UploadError(http_code(response.status), response.status)
                data = response.read(BUNDLE_BYTES + 1)
        except urllib.error.HTTPError as error:
            status = error.code
            error.close()
            raise UploadError("REDIRECT_BLOCKED" if 300 <= status < 400 else "ARTIFACT_DOWNLOAD_FAILED", status) from None
        except (urllib.error.URLError, TimeoutError, socket.timeout, ssl.SSLError, ConnectionError, OSError, http.client.HTTPException):
            raise UploadError("ARTIFACT_DOWNLOAD_FAILED") from None
        if len(data) != BUNDLE_BYTES or hashlib.sha256(data).hexdigest() != BUNDLE_SHA256:
            raise UploadError("BUNDLE_INVALID")
        return data


def token_from_env() -> str:
    token = os.environ.get(TOKEN_ENV, "")
    if not 20 <= len(token) <= 8192 or not re.fullmatch(r"[A-Za-z0-9._~+/-]+=*", token):
        raise UploadError("TOKEN_MISSING")
    return token


def new_report() -> dict:
    """Keep the approved preference distinct from the flag of the actual request."""
    return {"schemaVersion": 1, "recordedAt": datetime.now(timezone.utc).isoformat(), "packageName": PACKAGE, "versionCode": VERSION,
            "sourceCommit": SOURCE, "sourceFingerprint": FINGERPRINT, "bundleSha256": BUNDLE_SHA256, "ciRunId": CI_RUN,
            "track": "internal", "requestedReleaseStatus": "draft", "changesNotSentForReview": True,
            "changesNotSentForReviewMeaning": "approved-preference",
            "changesNotSentForReviewPreferred": True, "changesNotSentForReviewEffective": "not-attempted",
            "commitCompatibilityAttempts": 0, "commitPhase": "not-started",
            "changesInReviewBehavior": "ERROR_IF_IN_REVIEW",
            "status": "failed", "bundleUploadConfirmed": False, "bundleUploadState": "not-attempted", "versionReservationUnknown": False,
            "bundleReused": False, "draftVerified": False, "activeReleaseVerified": False,
            "commitAttempted": False, "commitAcknowledged": False, "publishedByThisRun": False,
            "editCleanup": "not-needed", "steps": []}


def json_body(value: dict) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def edit_id(value: dict) -> str:
    candidate = value.get("id")
    if not isinstance(candidate, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,200}", candidate):
        raise UploadError("RESPONSE_INVALID")
    return candidate


def matching_bundle(value: object) -> bool:
    return isinstance(value, dict) and type(value.get("versionCode")) is int and value["versionCode"] == VERSION and isinstance(value.get("sha256"), str) and value["sha256"].lower() == BUNDLE_SHA256


def known_bundle(response: dict) -> bool:
    rows = response.get("bundles", [])
    if not isinstance(rows, list) or len(rows) > 1000 or response.get("nextPageToken"):
        raise UploadError("RESPONSE_INVALID")
    hits = []
    for row in rows:
        if not isinstance(row, dict) or type(row.get("versionCode")) is not int or row["versionCode"] < 1:
            raise UploadError("RESPONSE_INVALID")
        if row["versionCode"] == VERSION:
            hits.append(row)
    if len(hits) > 1 or hits and not matching_bundle(hits[0]):
        raise UploadError("ARTIFACT_CONFLICT")
    return bool(hits)


def track_observation(response: dict) -> dict:
    """Public structural facts only; this summary never authorizes a mutation."""
    observation = {"trackMatches": response.get("track") == "internal", "releasesShape": "list", "releases": [], "truncated": False}
    releases = response.get("releases", [])
    if not isinstance(releases, list):
        observation.update(releasesShape="invalid", truncated=True)
        return observation
    observation["truncated"] = len(releases) > 6
    for release in releases[:6]:
        status, versions = "unknown", []
        if not isinstance(release, dict):
            observation["truncated"] = True
        else:
            raw_status = release.get("status")
            if isinstance(raw_status, str) and raw_status in {"draft", "completed", "inProgress", "halted"}:
                status = raw_status
            else:
                observation["truncated"] = True
            raw_versions = release.get("versionCodes")
            if not isinstance(raw_versions, list) or not raw_versions:
                observation["truncated"] = True
            else:
                if len(raw_versions) > 6:
                    observation["truncated"] = True
                for value in raw_versions[:6]:
                    if isinstance(value, str) and re.fullmatch(r"[1-9][0-9]{0,9}", value) and int(value) <= 2100000000:
                        versions.append(int(value))
                    else:
                        observation["truncated"] = True
                if len(set(versions)) != len(versions):
                    observation["truncated"] = True
        observation["releases"].append({"status": status, "versionCodes": versions})
    return observation


def inspect_track(response: dict) -> tuple[list[dict], bool]:
    if response.get("track") != "internal":
        raise UploadError("EXISTING_RELEASE_CONFLICT")
    releases = response.get("releases", [])
    if not isinstance(releases, list) or len(releases) > 100:
        raise UploadError("EXISTING_RELEASE_CONFLICT")
    found = False
    retained_code16 = False
    draft_contains_code16 = False
    for release in releases:
        if not isinstance(release, dict):
            raise UploadError("EXISTING_RELEASE_CONFLICT")
        # Only the specifically observed Code16 release may accompany a future
        # Code17 draft. Its complete dictionary is retained, without any rewrite.
        if VERSION == 17 and release.get("status") == "completed" and release.get("versionCodes") == ["16"]:
            if retained_code16:
                raise UploadError("EXISTING_RELEASE_CONFLICT")
            retained_code16 = True
            continue
        if release.get("status") != "draft":
            raise UploadError("EXISTING_RELEASE_CONFLICT")
        versions = release.get("versionCodes")
        if not isinstance(versions, list) or not versions or not all(isinstance(v, str) and re.fullmatch(r"[1-9][0-9]{0,9}", v) for v in versions) or len(set(versions)) != len(versions):
            raise UploadError("EXISTING_RELEASE_CONFLICT")
        if VERSION == 17 and "16" in versions:
            draft_contains_code16 = True
        if str(VERSION) in versions:
            if found or versions != [str(VERSION)]:
                raise UploadError("EXISTING_RELEASE_CONFLICT")
            found = True
    if retained_code16 and draft_contains_code16:
        raise UploadError("EXISTING_RELEASE_CONFLICT")
    return copy.deepcopy(releases), found


def delete_own_edit(api: Transport, own_edit: str, report: dict, field: str = "editCleanup") -> None:
    try:
        api.request("DELETE", API_PATH + "/" + own_edit)
        report[field] = "deleted"
    except Exception:
        report[field] = "unconfirmed"


def perform_upload(api: Transport, data: bytes, report: dict) -> None:
    own_edit = None
    commit_started = False
    try:
        own_edit = edit_id(api.request("POST", API_PATH, json_body({})))
        report["steps"].append("edit-created")
        base = API_PATH + "/" + own_edit
        reused = known_bundle(api.request("GET", base + "/bundles"))
        report["bundleReused"] = reused
        # Inspect before uploading: unexpected live/foreign releases cause no bundle mutation.
        track = api.request("GET", base + "/tracks/internal")
        report["trackObservation"] = track_observation(track)
        active_releases = track.get("releases")
        if (reused is True and track.get("track") == "internal" and isinstance(active_releases, list) and len(active_releases) == 1
                and isinstance(active_releases[0], dict) and active_releases[0].get("status") == "completed"
                and active_releases[0].get("versionCodes") == [str(VERSION)]):
            # Observe the exact already-distributed bundle; never downgrade it to a draft.
            report.update(status="already-active", activeReleaseVerified=True, existingReleaseStatus="completed")
            report["steps"].append("existing-exact-active-release-read")
            return
        releases, existing_draft = inspect_track(track)
        if existing_draft:
            if not reused:
                raise UploadError("DRAFT_RESPONSE_MISMATCH")
            report.update(status="already-draft", draftVerified=True)
            report["steps"].append("existing-exact-draft-read")
            return
        if not reused:
            report["bundleUploadState"] = "unknown"
            report["versionReservationUnknown"] = True
            report["steps"].append("bundle-upload-requested")
            result = api.request("POST", "/upload" + base + "/bundles?uploadType=media", data, bundle=True)
            if not matching_bundle(result):
                raise UploadError("UPLOAD_RESPONSE_MISMATCH")
            report["bundleUploadConfirmed"] = True
            report["bundleUploadState"] = "confirmed"
            report["steps"].append("bundle-upload-confirmed")
        else:
            report["steps"].append("matching-bundle-reused")
        desired = {"track": "internal", "releases": [*releases, {"name": RELEASE_NAME, "versionCodes": [str(VERSION)], "status": "draft"}]}
        updated = api.request("PUT", base + "/tracks/internal", json_body(desired))
        actual_releases, actual_draft = inspect_track(updated)
        if not actual_draft or actual_releases != desired["releases"]:
            raise UploadError("DRAFT_RESPONSE_MISMATCH")
        report["steps"].append("draft-confirmed-in-edit")
        if edit_id(api.request("POST", base + ":validate")) != own_edit:
            raise UploadError("RESPONSE_INVALID")
        report["steps"].append("edit-validated")
        commit_started = True
        report["commitAttempted"] = True
        report["changesNotSentForReviewEffective"] = "true"
        report["commitPhase"] = "preferred-commit"
        try:
            try:
                committed = api.request("POST", base + ":commit" + COMMIT_QUERY)
            except UploadError as refused:
                if refused.diagnostic_code is not None:
                    report["googleDiagnosticCode"] = refused.diagnostic_code
                compatible = (VERSION == 17 and len(releases) == 1 and releases[0].get("status") == "completed"
                              and releases[0].get("versionCodes") == ["16"]
                              and actual_releases == [releases[0], {"name": RELEASE_NAME, "versionCodes": ["17"], "status": "draft"}])
                if refused.http_status != 400 or refused.diagnostic_code != COMMIT_FLAG_DIAGNOSTIC or not compatible:
                    raise
                # Google explicitly refused the first commit. During these read/
                # validation calls there is no possibly effective commit in flight.
                commit_started = False
                report["commitPhase"] = "compatibility-revalidation"
                fresh = api.request("GET", base + "/tracks/internal")
                fresh_releases, fresh_draft = inspect_track(fresh)
                if not fresh_draft or fresh_releases != desired["releases"]:
                    raise UploadError("DRAFT_RESPONSE_MISMATCH")
                if edit_id(api.request("POST", base + ":validate")) != own_edit:
                    raise UploadError("RESPONSE_INVALID")
                report["steps"].append("commit-flag-compatibility-requested")
                report["commitCompatibilityAttempts"] = 1
                report["changesNotSentForReviewEffective"] = "omitted"
                report["commitPhase"] = "compatible-commit"
                commit_started = True
                # Same edit, no upload/track rewrite. ERROR_IF_IN_REVIEW prevents
                # cancelling a review; retained16/draft17 and full readback bind
                # the release effect, not a claim about Google's review process.
                committed = api.request("POST", base + ":commit" + COMMIT_COMPAT_QUERY)
            if edit_id(committed) != own_edit:
                raise UploadError("COMMIT_RESULT_UNKNOWN")
        except UploadError as error:
            if not commit_started:
                raise
            if error.http_status is not None and 400 <= error.http_status < 500 and error.http_status != 408:
                # Explicit refusal is not a successful commit; cleanup the still-own edit.
                commit_started = False
                raise
            raise UploadError("COMMIT_RESULT_UNKNOWN", error.http_status) from None
        except Exception:
            if not commit_started:
                raise UploadError("UNEXPECTED_ERROR") from None
            raise UploadError("COMMIT_RESULT_UNKNOWN") from None
        report["commitAcknowledged"] = True
        report["commitPhase"] = "persisted-readback"
        report["steps"].append("commit-acknowledged")
        report["editCleanup"] = "not-applicable-after-commit"
        # A commit response is only AppEdit metadata. Read the persisted draft in a new edit.
        verification_edit = None
        try:
            next_edit = edit_id(api.request("POST", API_PATH, json_body({})))
            if next_edit == own_edit:
                raise UploadError("POST_COMMIT_UNVERIFIED")
            verification_edit = next_edit
            observed = api.request("GET", API_PATH + "/" + verification_edit + "/tracks/internal")
            observed_releases, observed_draft = inspect_track(observed)
            if not observed_draft or observed_releases != desired["releases"]:
                raise UploadError("POST_COMMIT_UNVERIFIED")
            report.update(status="draft-committed", draftVerified=True, versionReservationUnknown=False)
            report["steps"].append("persisted-draft-verified")
        except Exception:
            raise UploadError("POST_COMMIT_UNVERIFIED") from None
        finally:
            if verification_edit is not None:
                delete_own_edit(api, verification_edit, report, "verificationEditCleanup")
    finally:
        if own_edit is not None and not commit_started:
            delete_own_edit(api, own_edit, report)
        elif own_edit is not None and not report["commitAcknowledged"]:
            report["editCleanup"] = "not-attempted-after-ambiguous-commit"


def write_report(path: Path, report: dict) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(path.name + ".tmp")
        temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(path)
    except OSError:
        raise UploadError("LOCAL_IO_ERROR") from None


def main(argv: list[str] | None = None) -> int:
    parser = SafeArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ["prepare", "upload"]:
        command = commands.add_parser(name)
        command.add_argument("--manifest", type=Path, required=True)
        command.add_argument("--report", type=Path, required=True)
        if name == "prepare":
            command.add_argument("--output-dir", type=Path, required=True)
        else:
            command.add_argument("--bundle", type=Path, required=True)
    args = parser.parse_args(argv)
    report = new_report()
    result = 0
    try:
        read_manifest(args.manifest)
        if args.command == "prepare":
            data = Transport().download()
            args.output_dir.mkdir(parents=True, exist_ok=True)
            target = args.output_dir / "Anker.aab"
            if target.exists() and read_bundle(target) != data:
                raise UploadError("BUNDLE_INVALID")
            temporary = target.with_name(target.name + ".tmp")
            temporary.write_bytes(data)
            temporary.replace(target)
            report.update(status="prepared", bundleBytes=len(data), googleRequestsMade=False)
        else:
            data = read_bundle(args.bundle)
            api = Transport(token_from_env())
            perform_upload(api, data, report)
    except UploadError as error:
        report["status"] = "inconclusive" if error.code in {"COMMIT_RESULT_UNKNOWN", "POST_COMMIT_UNVERIFIED"} else "failed"
        report.update(reason=error.code, instructions=MESSAGES[error.code])
        if error.diagnostic_code is not None:
            report["googleDiagnosticCode"] = error.diagnostic_code
        if error.http_status is not None:
            report["httpStatus"] = error.http_status
        result = 3 if report["status"] == "inconclusive" else 2
    except OSError:
        report.update(status="inconclusive" if report["commitAttempted"] else "failed", reason="LOCAL_IO_ERROR", instructions=MESSAGES["LOCAL_IO_ERROR"])
        result = 3 if report["status"] == "inconclusive" else 2
    except Exception:
        report.update(status="inconclusive" if report["commitAttempted"] else "failed", reason="UNEXPECTED_ERROR", instructions=MESSAGES["UNEXPECTED_ERROR"])
        result = 3 if report["status"] == "inconclusive" else 2
    try:
        write_report(args.report, report)
    except UploadError:
        # Bounded static text only; never echo exception arguments or local paths.
        print(MESSAGES["LOCAL_IO_ERROR"], file=sys.stderr)
        return 3 if report["commitAttempted"] else 2
    print(json.dumps(report, ensure_ascii=False))
    return result


if __name__ == "__main__":
    sys.exit(main())
