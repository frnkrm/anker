#!/usr/bin/env python3
"""Validate the pinned internal17 change in an abandoned edit; no commit route."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import urllib.error

SPEC = importlib.util.spec_from_file_location('internal17_release', Path(__file__).with_name('google-play-internal-release.py'))
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)
d = release.draft


def safe_failure(raw):
    result = {'googleStatus': 'unknown', 'googleReason': 'unknown', 'messageKind': 'unclassified'}
    try:
        value = json.loads(raw)
        error = value['error']
        status = error.get('status')
        if status in ['PERMISSION_DENIED', 'UNAUTHENTICATED', 'FAILED_PRECONDITION', 'INVALID_ARGUMENT', 'NOT_FOUND']:
            result['googleStatus'] = status
        rows = error.get('errors', [])
        allowed = {'forbidden', 'insufficientPermissions', 'accessNotConfigured', 'notFound', 'badRequest', 'conditionNotMet'}
        for row in rows if isinstance(rows, list) else []:
            reason = row.get('reason') if isinstance(row, dict) else None
            if reason in allowed:
                result['googleReason'] = reason
                break
        message = error.get('message')
        known = {'The caller does not have permission': 'caller-permission-denied',
                 'The caller does not have permission.': 'caller-permission-denied',
                 'Only releases with status draft may be created on draft app.': 'app-still-draft',
                 'You do not have permission to access this app.': 'app-access-denied'}
        if isinstance(message, str):
            result['messageKind'] = known.get(message, 'unclassified')
    except Exception:
        pass
    return result


class CaptureErrors:
    def __init__(self, opener): self.opener = opener
    def open(self, request, **kwargs):
        try:
            return self.opener.open(request, **kwargs)
        except urllib.error.HTTPError as error:
            info = {}
            try:
                raw = error.read(65537)
                if len(raw) <= 65536: info = safe_failure(raw)
            except Exception:
                pass
            finally:
                error.close()
            failure = d.UploadError(d.http_code(error.code), error.code)
            failure.safe_info = info
            raise failure from None


class DiagnosticApi:
    def __init__(self, token, report):
        self.client = release.ReleaseTransport(token)
        self.client.client._opener = CaptureErrors(self.client.client._opener)
        self.report = report

    def request(self, method, path, payload=None):
        base = re.escape(d.API_PATH)
        own = base + r'/[A-Za-z0-9_-]{1,200}'
        if method == 'POST' and path == d.API_PATH: stage = 'create-empty-edit'
        elif method == 'GET' and re.fullmatch(own + '/bundles', path): stage = 'read-bundles'
        elif method == 'GET' and re.fullmatch(own + '/tracks/internal', path): stage = 'read-internal-track'
        elif method == 'PUT' and re.fullmatch(own + '/tracks/internal', path): stage = 'stage-internal-change'
        elif method == 'POST' and re.fullmatch(own + ':validate', path): stage = 'validate-uncommitted-edit'
        elif method == 'DELETE' and re.fullmatch(own, path): stage = 'discard-own-edit'
        else:
            raise d.UploadError('EXISTING_RELEASE_CONFLICT')
        self.report['lastOperation'] = stage
        try:
            return self.client.request(method, path, payload)
        except d.UploadError as error:
            self.report['failedOperation'] = stage
            self.report.update(getattr(error, 'safe_info', {}))
            raise


def diagnose(api, report):
    own = None
    try:
        own = d.edit_id(api.request('POST', d.API_PATH, d.json_body({})))
        base = d.API_PATH + '/' + own
        if not d.known_bundle(api.request('GET', base+'/bundles')):
            raise d.UploadError('ARTIFACT_CONFLICT')
        rows = release.releases(api.request('GET', base+'/tracks/internal'))
        checked, found = d.inspect_track({'track': 'internal', 'releases': rows})
        if not found or len(checked) != 2 or sum(r.get('status') == 'completed' and r.get('versionCodes') == ['16'] for r in checked) != 1:
            raise d.UploadError('EXISTING_RELEASE_CONFLICT')
        target = next(r for r in checked if r.get('status') == 'draft' and r.get('versionCodes') == ['17'])
        if target.get('name') != d.RELEASE_NAME or 'userFraction' in target:
            raise d.UploadError('EXISTING_RELEASE_CONFLICT')
        target.update(status='completed', versionCodes=['16','17'])
        changed = release.releases(api.request('PUT', base+'/tracks/internal', d.json_body({'track':'internal','releases':[target]})))
        if len(changed) != 1 or not release.same_release(changed[0], target):
            raise d.UploadError('DRAFT_RESPONSE_MISMATCH')
        if d.edit_id(api.request('POST', base+':validate')) != own:
            raise d.UploadError('RESPONSE_INVALID')
        report['status'] = 'validated-not-committed'
    finally:
        if own is not None:
            d.delete_own_edit(api, own, report)


def main(argv=None):
    parser = d.SafeArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args(argv)
    report = {'schemaVersion':1, 'diagnosticOnly':True, 'track':'internal', 'versionCode':17,
              'status':'not-started', 'commitAttempted':False, 'publishedByThisRun':False}
    code = 0
    try:
        d.read_manifest(args.manifest)
        diagnose(DiagnosticApi(d.token_from_env(), report), report)
    except d.UploadError as error:
        report.update(status='failed', reason=error.code)
        if error.http_status is not None: report['httpStatus'] = error.http_status
        code = 2
    except Exception:
        report.update(status='failed', reason='UNEXPECTED_ERROR'); code = 2
    try:
        d.write_report(args.report, report)
    except d.UploadError:
        print('Diagnosebericht konnte nicht gespeichert werden.', file=sys.stderr); return 2
    print(json.dumps(report, ensure_ascii=True))
    return code


if __name__ == '__main__': sys.exit(main())
