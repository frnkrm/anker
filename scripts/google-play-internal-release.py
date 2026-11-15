#!/usr/bin/env python3
"""Activate only the existing approved Code17 bundle in internal; never upload."""
from __future__ import annotations

import argparse
import copy
import importlib.util
import json
from pathlib import Path
import re
import sys

SPEC = importlib.util.spec_from_file_location('anker_draft', Path(__file__).with_name('google-play-upload.py'))
assert SPEC and SPEC.loader
draft = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(draft)
CONFIRMATION = 'RELEASE_CODE17_INTERNAL'
COMMIT_QUERY = draft.COMMIT_COMPAT_QUERY


class ReleaseTransport:
    """Allow only internal metadata operations; no upload/production/tester endpoint."""
    def __init__(self, token):
        self.client = draft.Transport(token)

    def request(self, method, path, payload=None):
        base = re.escape(draft.API_PATH)
        edit = base + r'/[A-Za-z0-9_-]{1,200}'
        allowed = (method == 'POST' and path == draft.API_PATH
                   or method == 'GET' and re.fullmatch(edit + r'/(bundles|tracks/internal)', path)
                   or method == 'DELETE' and re.fullmatch(edit, path)
                   or method == 'POST' and re.fullmatch(edit + ':validate', path)
                   or method == 'POST' and re.fullmatch(edit + re.escape(':commit' + COMMIT_QUERY), path))
        if method == 'PUT' and re.fullmatch(edit + '/tracks/internal', path):
            try:
                value = json.loads(payload)
                allowed = set(value) == {'track', 'releases'} and value['track'] == 'internal' and len(value['releases']) == 1 and active(value['releases'][0])
            except (ValueError, TypeError, KeyError):
                allowed = False
        if not allowed:
            raise draft.UploadError('EXISTING_RELEASE_CONFLICT')
        return self.client.request(method, path, payload)


def active(row):
    return (isinstance(row, dict) and row.get('status') == 'completed'
            and row.get('name') == draft.RELEASE_NAME
            and row.get('versionCodes') in [['16', '17'], ['17', '16']]
            and 'userFraction' not in row)


def releases(response):
    if not isinstance(response, dict) or response.get('track') != 'internal' or not isinstance(response.get('releases'), list):
        raise draft.UploadError('EXISTING_RELEASE_CONFLICT')
    return response['releases']


def same_release(observed, desired):
    if not active(observed):
        return False
    normalized = copy.deepcopy(observed)
    normalized['versionCodes'] = desired['versionCodes']
    return normalized == desired


def perform(api, report, confirmation):
    if confirmation != CONFIRMATION:
        raise draft.UploadError('MANIFEST_INVALID')
    own = None
    commit_started = False
    try:
        own = draft.edit_id(api.request('POST', draft.API_PATH, draft.json_body({})))
        base = draft.API_PATH + '/' + own
        if not draft.known_bundle(api.request('GET', base + '/bundles')):
            raise draft.UploadError('ARTIFACT_CONFLICT')
        report['bundleVerified'] = True
        rows = releases(api.request('GET', base + '/tracks/internal'))
        if len(rows) == 1 and active(rows[0]):
            report.update(status='already-active', activeReleaseVerified=True)
            return
        checked, found = draft.inspect_track({'track': 'internal', 'releases': rows})
        if (not found or len(checked) != 2
                or sum(r.get('status') == 'completed' and r.get('versionCodes') == ['16'] for r in checked) != 1):
            raise draft.UploadError('EXISTING_RELEASE_CONFLICT')
        target = next(r for r in checked if r.get('status') == 'draft' and r.get('versionCodes') == ['17'])
        if target.get('name') != draft.RELEASE_NAME or 'userFraction' in target:
            raise draft.UploadError('EXISTING_RELEASE_CONFLICT')
        desired = copy.deepcopy(target)
        desired.update(status='completed', versionCodes=['16', '17'])
        changed = releases(api.request('PUT', base + '/tracks/internal', draft.json_body({'track': 'internal', 'releases': [desired]})))
        if len(changed) != 1 or not same_release(changed[0], desired):
            raise draft.UploadError('DRAFT_RESPONSE_MISMATCH')
        if draft.edit_id(api.request('POST', base + ':validate')) != own:
            raise draft.UploadError('RESPONSE_INVALID')
        # No retries, and never cancel an existing review. An ambiguous response
        # leaves the edit untouched and requires a separate read-only inspection.
        commit_started = True
        report['commitAttempted'] = True
        try:
            if draft.edit_id(api.request('POST', base + ':commit' + COMMIT_QUERY)) != own:
                raise draft.UploadError('COMMIT_RESULT_UNKNOWN')
        except draft.UploadError as error:
            if error.code in ['NETWORK_ERROR', 'RESPONSE_INVALID', 'RESPONSE_TOO_LARGE', 'HTTP_SERVER_ERROR']:
                raise draft.UploadError('COMMIT_RESULT_UNKNOWN') from None
            raise
        except Exception:
            raise draft.UploadError('COMMIT_RESULT_UNKNOWN') from None
        report['commitAcknowledged'] = True
        verify = None
        try:
            verify = draft.edit_id(api.request('POST', draft.API_PATH, draft.json_body({})))
            if verify == own:
                verify = None
                raise draft.UploadError('POST_COMMIT_UNVERIFIED')
            fresh = draft.API_PATH + '/' + verify
            if not draft.known_bundle(api.request('GET', fresh + '/bundles')):
                raise draft.UploadError('POST_COMMIT_UNVERIFIED')
            observed = releases(api.request('GET', fresh + '/tracks/internal'))
            if len(observed) != 1 or not same_release(observed[0], desired):
                raise draft.UploadError('POST_COMMIT_UNVERIFIED')
            report.update(status='internal-active', activeReleaseVerified=True)
        except Exception:
            raise draft.UploadError('POST_COMMIT_UNVERIFIED') from None
        finally:
            if verify is not None:
                draft.delete_own_edit(api, verify, report, 'verificationEditCleanup')
    finally:
        if own is not None and not commit_started:
            draft.delete_own_edit(api, own, report)
        elif commit_started:
            report['editCleanup'] = 'not-applicable-after-commit' if report['commitAcknowledged'] else 'not-attempted-after-commit-request'


def main(argv=None):
    parser = draft.SafeArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--confirm', required=True)
    args = parser.parse_args(argv)
    report = {'schemaVersion': 1, 'packageName': draft.PACKAGE, 'track': 'internal', 'versionCode': 17,
              'retainedVersionCode': 16, 'bundleSha256': draft.BUNDLE_SHA256, 'sourceCommit': draft.SOURCE,
              'status': 'not-started', 'bundleVerified': False, 'bundleUploaded': False,
              'commitAttempted': False, 'commitAcknowledged': False, 'activeReleaseVerified': False,
              'productionChanged': False, 'testerListsChanged': False}
    result = 0
    try:
        if args.confirm != CONFIRMATION:
            raise draft.UploadError('MANIFEST_INVALID')
        draft.read_manifest(args.manifest)  # Existing draft approval is immutable;
        # the separate confirmation authorizes this narrowly pinned activation.
        perform(ReleaseTransport(draft.token_from_env()), report, args.confirm)
    except draft.UploadError as error:
        report.update(status='inconclusive' if report['commitAttempted'] else 'failed', reason=error.code)
        result = 3 if report['commitAttempted'] else 2
    except Exception:
        report.update(status='inconclusive' if report['commitAttempted'] else 'failed', reason='UNEXPECTED_ERROR')
        result = 3 if report['commitAttempted'] else 2
    try:
        draft.write_report(args.report, report)
    except draft.UploadError:
        print('Der begrenzte Play-Ergebnisbericht konnte nicht gespeichert werden.', file=sys.stderr)
        return 3 if report['commitAttempted'] else 2
    print(json.dumps(report, ensure_ascii=True))
    return result


if __name__ == '__main__':
    sys.exit(main())
