"""Manual Code18 delivery from the verified Actions artifact; never changes Code17 policy."""
from __future__ import annotations

import copy
from datetime import datetime, timezone
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(file))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


p = module('code18proof', 'android-aab-proof.py')
legacy = module('playtransport', 'google-play-upload.py')
WORKFLOW = '.github/workflows/google-play-code18.yml'
NAME = 'Anker 1.5.0-rc.4 · Code18'
RETAINED_NAME = 'Anker 1.5.0-rc.3 · Code17'
EARLIEST = datetime(2026, 11, 18, 21, 41, tzinfo=timezone.utc)
FIELDS = ('mode', 'confirmation', 'expected_workflow_commit', 'sign_workflow_commit',
          'sign_run_id', 'sign_run_attempt', 'artifact_id', 'bundle_sha256', 'proof_sha256')


def invocation(env):
    p.require(env.get('GITHUB_ACTIONS') == 'true' and env.get('GITHUB_REPOSITORY') == p.REPO
              and env.get('GITHUB_REF') == 'refs/heads/main'
              and env.get('GITHUB_EVENT_NAME') == 'workflow_dispatch'
              and env.get('GITHUB_WORKFLOW_REF') == p.REPO + '/' + WORKFLOW + '@refs/heads/main', 'MANUAL_MAIN_ONLY')
    data = p.json_load(env.get('PLAY18_INPUTS', '{}'))
    p.exact(data, FIELDS)
    p.require(data['mode'] in ('draft', 'internal')
              and data['confirmation'] == ('UPLOAD_CODE18_DRAFT' if data['mode'] == 'draft' else 'RELEASE_CODE18_INTERNAL'), 'CONFIRMATION')
    for field in ('expected_workflow_commit', 'sign_workflow_commit'):
        p.require(p.hex_value(data[field], 40), 'WORKFLOW_SHA')
    p.require(env.get('GITHUB_SHA') == data['expected_workflow_commit']
              and env.get('GITHUB_WORKFLOW_SHA') == data['expected_workflow_commit']
              and env.get('GITHUB_RUN_ATTEMPT') == '1', 'WORKFLOW_SHA')
    for field in ('bundle_sha256', 'proof_sha256'):
        p.require(p.hex_value(data[field]), 'HASH')
    for field in ('sign_run_id', 'sign_run_attempt', 'artifact_id'):
        p.number(data[field])
    return data


def check_ci(api, commit):
    rows = api.get('/actions/workflows/ci.yml/runs?head_sha=' + commit + '&event=push&status=success&per_page=100').get('workflow_runs')
    p.require(isinstance(rows, list) and bool(rows), 'EXACT_MAIN_CI_REQUIRED')
    p.require(any(valid_ci(row, commit) for row in rows), 'EXACT_MAIN_CI_REQUIRED')
    comparison = api.get('/compare/' + commit + '...main')
    p.require(comparison.get('status') in ('ahead', 'identical')
              and comparison.get('merge_base_commit', {}).get('sha') == commit, 'NOT_MAIN_ANCESTOR')


def valid_ci(row, commit):
    try:
        p.check_run(row, commit, 'push', p.CI)
        return True
    except p.ProofError:
        return False


def verify_files(folder, data, cp, classes):
    proof = p.json_load(p.regular(folder / 'proof.json', p.JSON_LIMIT))
    body = p.regular(folder / 'Anker-Code18-SIGNIERT.aab')
    p.require(p.sha(p.regular(folder / 'proof.json', p.JSON_LIMIT)) == data['proof_sha256']
              and p.sha(body) == data['bundle_sha256'], 'ARTIFACT_HASH')
    ctx = proof.get('context', {})
    p.require(proof.get('schemaVersion') == 1 and proof.get('kind') == 'anker-code18-signed-verified'
              and proof.get('signedSHA256') == data['bundle_sha256'] and proof.get('signedBytes') == len(body)
              and proof.get('certificateSHA256') == p.CERT and proof.get('payloadUnchanged') is True
              and proof.get('uploadedToPlay') is False and ctx.get('sourceCommit') == p.SOURCE
              and ctx.get('sourceFingerprint') == p.FINGERPRINT and ctx.get('workflowCommit') == data['sign_workflow_commit']
              and ctx.get('mode') == 'sign'
              and ctx.get('run') == {'id': p.number(data['sign_run_id']), 'attempt': p.number(data['sign_run_attempt'])}, 'SIGNED_PROOF')
    p.validate_ci_proof(ctx.get('sourceCI'), p.SOURCE)
    p.validate_ci_proof(ctx.get('workflowCI'), data['sign_workflow_commit'])
    p.inspect_bundle(folder / 'Anker-Code18-SIGNIERT.aab', cp)
    p.native_and_identity(folder / 'Anker-Code18-SIGNIERT.aab')
    with tempfile.TemporaryDirectory(prefix='anker-play18-public-') as tmp:
        certificate = Path(tmp) / 'public.der'
        report = p.jar_report(folder / 'Anker-Code18-SIGNIERT.aab', classes, signed=True, certificate=certificate)
        p.require(p.sha(p.regular(certificate)) == p.CERT, 'SIGNER_CERTIFICATE')
        trust = Path(tmp) / 'public-trust.p12'
        p.tool(['keytool', '-importcert', '-noprompt', '-alias', 'anker-upload', '-file', str(certificate),
                '-keystore', str(trust), '-storetype', 'PKCS12', '-storepass', 'public-verification-only'])
        p.tool(['jarsigner', '-verify', '-strict', '-keystore', str(trust), '-storepass', 'public-verification-only', str(folder / 'Anker-Code18-SIGNIERT.aab')])
    p.require(report == proof.get('jarVerification'), 'JAR_PROOF')
    return body


def prepare(api, data, folder, cp, classes):
    for commit in {p.SOURCE, data['sign_workflow_commit'], data['expected_workflow_commit']}:
        check_ci(api, commit)
    run, attempt, artifact = (p.number(data[k]) for k in ('sign_run_id', 'sign_run_attempt', 'artifact_id'))
    info = p.artifact_metadata(api, artifact, run, attempt, data['sign_workflow_commit'],
                              f'Anker-Code18-AAB-Pruefstand-{run}-{attempt}')
    raw = api.archive(artifact)
    p.require('sha256:' + p.sha(raw) == info['digest'] and len(raw) == info['size_in_bytes'], 'ARCHIVE_DIGEST')
    p.extract_data(raw, folder, {'Anker-Code18-SIGNIERT.aab', 'proof.json'})
    verify_files(folder, data, cp, classes)


def known_bundle(response, digest):
    rows = response.get('bundles', [])
    p.require(isinstance(rows, list) and len(rows) <= 1000 and not response.get('nextPageToken'), 'BUNDLE_LIST')
    hits = []
    for row in rows:
        p.require(isinstance(row, dict) and type(row.get('versionCode')) is int and row['versionCode'] > 0, 'BUNDLE_LIST')
        if row['versionCode'] == 18:
            p.require(row.get('sha256', '').lower() == digest, 'CODE18_CONFLICT')
            hits.append(row)
    p.require(len(hits) <= 1, 'CODE18_CONFLICT')
    return bool(hits)


def track(response):
    p.require(response.get('track') == 'internal' and isinstance(response.get('releases'), list), 'TRACK_CONFLICT')
    rows = response['releases']
    p.require(1 <= len(rows) <= 2, 'TRACK_CONFLICT')
    # Play retains earlier binaries by including their codes in the new release,
    # not by submitting two competing completed releases on the same track.
    if len(rows) == 1:
        row = rows[0]
        if (isinstance(row, dict) and row.get('name') == NAME and row.get('status') == 'completed'
                and isinstance(row.get('versionCodes'), list) and len(row['versionCodes']) == 1
                and set(row['versionCodes']) == {'18'} and 'userFraction' not in row):
            return [], [copy.deepcopy(row)]
    retained = [r for r in rows if isinstance(r, dict) and r.get('status') == 'completed'
                and r.get('name') == RETAINED_NAME and r.get('versionCodes') == ['17'] and 'userFraction' not in r]
    target = [r for r in rows if isinstance(r, dict) and r.get('versionCodes') == ['18']
              and r.get('name') == NAME and r.get('status') == 'draft' and 'userFraction' not in r]
    p.require(len(retained) == 1 and len(target) <= 1 and len(rows) == len(retained) + len(target), 'TRACK_CONFLICT')
    return copy.deepcopy(retained), copy.deepcopy(target)


def deliver(api, data, body, report, now=None):
    p.require((now or datetime.now(timezone.utc)) >= EARLIEST, 'UPLOAD_KEY_NOT_ACTIVE_YET')
    p.require(p.sha(body) == data['bundle_sha256'], 'ARTIFACT_HASH')
    own = None
    commit_started = False
    try:
        own = legacy.edit_id(api.request('POST', legacy.API_PATH, legacy.json_body({})))
        base = legacy.API_PATH + '/' + own
        found = known_bundle(api.request('GET', base + '/bundles'), data['bundle_sha256'])
        retained, existing = track(api.request('GET', base + '/tracks/internal'))
        p.require(not existing or found, 'TRACK_WITHOUT_BUNDLE')
        wanted = 'draft' if data['mode'] == 'draft' else 'completed'
        if existing and existing[0]['status'] == 'completed':
            report.update(status='already-active', activeReleaseVerified=True)
            return
        if not found:
            # After an ambiguous upload never retry automatically: Code18 may be reserved.
            report['bundleUploadAttempted'] = True
            uploaded = api.request('POST', '/upload' + base + '/bundles?uploadType=media', body, bundle=True)
            p.require(known_bundle({'bundles': [uploaded]}, data['bundle_sha256']), 'UPLOAD_RESPONSE')
        target = copy.deepcopy(existing[0]) if existing else {'name': NAME, 'versionCodes': ['18'], 'status': wanted}
        target['status'] = wanted
        if wanted == 'completed':
            target = {**copy.deepcopy(retained[0]), **target}
            # Google rejects a fully shadowed Code17 in the new completed release.
            # Existing bundles and release history are not deleted by this track update.
            target['versionCodes'] = ['18']
        desired = {'track': 'internal', 'releases': retained + [target] if wanted == 'draft' else [target]}
        if not existing or existing[0]['status'] != wanted:
            changed = api.request('PUT', base + '/tracks/internal', legacy.json_body(desired))
            p.require(changed == desired, 'TRACK_RESPONSE')
        p.require(legacy.edit_id(api.request('POST', base + ':validate')) == own, 'VALIDATION_RESPONSE')
        commit_started = True
        report['commitAttempted'] = True
        query = legacy.COMMIT_QUERY if wanted == 'draft' else legacy.COMMIT_COMPAT_QUERY
        p.require(legacy.edit_id(api.request('POST', base + ':commit' + query)) == own, 'COMMIT_RESPONSE')
        report['commitAcknowledged'] = True
        verify = None
        try:
            verify = legacy.edit_id(api.request('POST', legacy.API_PATH, legacy.json_body({})))
            vbase = legacy.API_PATH + '/' + verify
            p.require(known_bundle(api.request('GET', vbase + '/bundles'), data['bundle_sha256']), 'READBACK_BUNDLE')
            observed = api.request('GET', vbase + '/tracks/internal')
            p.require(observed == desired, 'READBACK_TRACK')
            report.update(status='verified', draftVerified=wanted == 'draft', activeReleaseVerified=wanted == 'completed')
        finally:
            if verify:
                legacy.delete_own_edit(api, verify, report, 'verificationEditCleanup')
    finally:
        if own and not commit_started:
            legacy.delete_own_edit(api, own, report)
        elif commit_started:
            report['editCleanup'] = 'not-applicable-after-commit' if report['commitAcknowledged'] else 'not-attempted-after-commit-request'


def main():
    parser = legacy.SafeArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=('prepare', 'deliver'))
    parser.add_argument('--folder', type=Path, required=True)
    parser.add_argument('--tools', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    report = {'versionCode': 18, 'sourceCommit': p.SOURCE, 'track': 'internal', 'status': 'failed',
              'commitAttempted': False, 'commitAcknowledged': False, 'bundleUploadAttempted': False,
              'activeReleaseVerified': False, 'productionChanged': False, 'testerListsChanged': False}
    result = 0
    try:
        data = invocation(os.environ)
        report.update(bundleSha256=data['bundle_sha256'], proofSha256=data['proof_sha256'],
                      mode=data['mode'], signedArtifactId=p.number(data['artifact_id']),
                      signRunId=p.number(data['sign_run_id']), signRunAttempt=p.number(data['sign_run_attempt']),
                      sourceFingerprint=p.FINGERPRINT, previousVersionCodes=[17],
                      retainedVersionCodes=[17] if data['mode'] == 'draft' else [], releaseVersionCodes=[18])
        cp, classes = p.tooling(args.tools)
        if args.phase == 'prepare':
            prepare(p.GitHub(os.environ.get('GH_TOKEN')), data, args.folder, cp, classes)
            report['status'] = 'prepared'
        else:
            body = verify_files(args.folder, data, cp, classes)
            deliver(legacy.Transport(legacy.token_from_env()), data, body, report)
    except (p.ProofError, legacy.UploadError) as error:
        report.update(status='inconclusive' if report['commitAttempted'] or report['bundleUploadAttempted'] else 'failed',
                      reason=error.code if isinstance(error, legacy.UploadError) else str(error))
        result = 3 if report['status'] == 'inconclusive' else 2
    except Exception:
        report.update(status='inconclusive' if report['commitAttempted'] or report['bundleUploadAttempted'] else 'failed', reason='DELIVERY_FAILED')
        result = 3 if report['status'] == 'inconclusive' else 2
    args.report.write_text(json.dumps(report, sort_keys=True) + '\n', encoding='utf-8')
    print('Code18:', report['status'])
    return result


if __name__ == '__main__':
    sys.exit(main())
