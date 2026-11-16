"""Manual Code18 proof pipeline. Importing this module has no side effects.

Runtime commands require the exact Actions/main invocation. Tests inject transports
and process runners; this module never treats an unsigned fallback as success.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import struct
import subprocess
import tempfile
from datetime import datetime, timezone
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

REPO = 'frnkrm/anker'
SOURCE = '0c31179be780e0bb6359dee79c3502d4e6e8ba4d'
# Fixed app source after the workflow's Capacitor sync (generated config.xml included).
FINGERPRINT = 'fff132db9c3e7f1654081665551ecabef096717d022bf1588c1d99a2362773df'
# Historical unsigned U1 from 10cc894; never a replacement for a fresh fix-source artifact.
REFERENCE = {'sha256': '74e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50', 'bytes': 54264632}
CERT = 'b47ffffebe137cf15129961de43a27e3ec811acffe4542b6324e11768995b13a'
WORKFLOW = '.github/workflows/android-aab-pruefstand.yml'
CI = '.github/workflows/ci.yml'
# Full manifest pin retained: fix source changes no Android/config/version/permission inputs.
MANIFEST_SHA256 = 'ac65d6fa7ac889229ccaf921d16119d3cde43c2d1df75bb94441c1ea1a9742d4'
ROOT = Path(__file__).resolve().parent
LIMIT = 100 * 1024 * 1024
JSON_LIMIT = 1024 * 1024
SECRETS = ('ANKER_ANDROID_KEYSTORE_BASE64', 'ANKER_ANDROID_STORE_PASSWORD',
           'ANKER_ANDROID_KEY_ALIAS', 'ANKER_ANDROID_KEY_PASSWORD')
SIGNATURE_FILES = {'META-INF/MANIFEST.MF', 'META-INF/ANKER.SF', 'META-INF/ANKER.RSA', 'META-INF/ANKER.EC'}
SIGN_FIELDS = ('prepare_run_id', 'prepare_run_attempt', 'unsigned_artifact_id',
               'expected_unsigned_sha256', 'expected_proof_sha256')


class ProofError(Exception):
    """Only fixed public error codes may cross the CLI boundary."""


def require(ok, code):
    if not ok:
        raise ProofError(code)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def hex_value(value, length=64):
    return isinstance(value, str) and re.fullmatch('[a-f0-9]{' + str(length) + '}', value) is not None


def number(value):
    require(isinstance(value, str) and re.fullmatch('[1-9][0-9]{0,19}', value), 'INVALID_ID')
    return int(value)


def positive(value):
    return type(value) is int and value > 0


def exact(value, fields):
    require(isinstance(value, dict) and set(value) == set(fields), 'INVALID_SCHEMA')


def json_load(raw):
    require(isinstance(raw, (bytes, str)) and len(raw) <= JSON_LIMIT, 'JSON_SIZE')
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'DUPLICATE_JSON_KEY')
            result[key] = value
        return result
    def invalid(_):
        raise ProofError('INVALID_JSON')
    try:
        return json.loads(raw, object_pairs_hook=unique, parse_constant=invalid)
    except (ValueError, UnicodeError):
        raise ProofError('INVALID_JSON') from None


def regular(path, limit=LIMIT):
    path = Path(path)
    require(not path.is_symlink() and stat.S_ISREG(path.stat().st_mode), 'NOT_REGULAR_FILE')
    require(0 < path.stat().st_size <= limit, 'FILE_SIZE')
    return path.read_bytes()


def write_json(path, value):
    body = (json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n').encode()
    require(len(body) <= JSON_LIMIT, 'JSON_SIZE')
    with Path(path).open('xb') as stream:
        stream.write(body)


def invocation(env):
    require(env.get('GITHUB_ACTIONS') == 'true' and env.get('GITHUB_REPOSITORY') == REPO
            and env.get('GITHUB_EVENT_NAME') == 'workflow_dispatch'
            and env.get('GITHUB_REF') == 'refs/heads/main', 'MANUAL_MAIN_ONLY')
    inputs = json_load(env.get('AAB_INPUTS', '{}'))
    if isinstance(inputs, dict) and inputs.get('mode') == 'prepare':
        # Apply only absent optional workflow defaults; explicit values stay strict.
        inputs = {**dict.fromkeys(SIGN_FIELDS, ''), **inputs}
    exact(inputs, ('mode', 'source_commit', 'expected_workflow_commit', *SIGN_FIELDS))
    w = inputs['expected_workflow_commit']
    require(inputs['source_commit'] == SOURCE and hex_value(w, 40)
            and env.get('GITHUB_WORKFLOW_SHA') == w and env.get('GITHUB_SHA') == w, 'SOURCE_WORKFLOW_MISMATCH')
    require(inputs['mode'] in ('prepare', 'sign'), 'INVALID_MODE')
    binding = None
    if inputs['mode'] == 'prepare':
        require(all(inputs[k] == '' for k in SIGN_FIELDS), 'AMBIGUOUS_PREPARE')
    else:
        binding = {k: number(inputs[k]) for k in SIGN_FIELDS[:3]}
        for k in SIGN_FIELDS[3:]:
            require(hex_value(inputs[k]), 'INVALID_HASH')
            binding[k] = inputs[k]
    current = {'id': number(env.get('GITHUB_RUN_ID')), 'attempt': number(env.get('GITHUB_RUN_ATTEMPT'))}
    require(inputs['mode'] != 'sign' or current['attempt'] == 1, 'SIGN_REDISPATCH_REQUIRED')
    return {'schemaVersion': 1, 'mode': inputs['mode'], 'sourceCommit': SOURCE,
            'sourceFingerprint': FINGERPRINT, 'workflowCommit': w,
            'run': current,
            'binding': binding}


def context(env):
    ctx = json_load(env.get('AAB_CONTEXT', '{}'))
    expected = invocation(env)
    exact(ctx, (*expected, 'sourceCI', 'workflowCI'))
    require(all(ctx[k] == v for k, v in expected.items()), 'CONTEXT_MISMATCH')
    validate_ci_proof(ctx['sourceCI'], SOURCE)
    validate_ci_proof(ctx['workflowCI'], ctx['workflowCommit'])
    return ctx


def validate_ci_proof(proof, commit):
    exact(proof, ('id', 'attempt', 'headSha', 'branch', 'event', 'status', 'conclusion', 'workflow'))
    require(positive(proof['id']) and positive(proof['attempt']) and proof['headSha'] == commit
            and proof['branch'] == 'main' and proof['event'] == 'push'
            and proof['status'] == 'completed' and proof['conclusion'] == 'success'
            and proof['workflow'] == CI, 'EXACT_MAIN_CI_REQUIRED')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class GitHub:
    def __init__(self, token):
        require(isinstance(token, str) and bool(token.strip()), 'API_TOKEN_UNAVAILABLE')
        self.token = token
        self.opener = urllib.request.build_opener(NoRedirect())

    def _api(self, path, archive=False):
        require(path.startswith('/') and not any(c in path for c in ['\r', '\n', '#']), 'API_PATH')
        req = urllib.request.Request('https://api.github.com/repos/' + REPO + path,
              headers={'Authorization': 'Bearer ' + self.token, 'Accept': 'application/vnd.github+json',
                       'X-GitHub-Api-Version': '2022-11-28'}, method='GET')
        try:
            with self.opener.open(req, timeout=40) as response:
                require(not archive and response.status == 200, 'API_RESPONSE')
                return json_load(response.read(JSON_LIMIT + 1))
        except urllib.error.HTTPError as error:
            if archive and error.code == 302:
                url = error.headers.get('Location', '')
                parsed = urllib.parse.urlsplit(url)
                require(parsed.scheme == 'https' and not parsed.username and not parsed.password
                        and parsed.port in (None, 443) and (parsed.hostname or '').endswith('.blob.core.windows.net'), 'ARTIFACT_REDIRECT')
                # Never forward GitHub Authorization to the signed storage URL.
                try:
                    with self.opener.open(urllib.request.Request(url, method='GET'), timeout=60) as response:
                        require(response.status == 200, 'ARTIFACT_DOWNLOAD')
                        body = response.read(LIMIT + 1)
                        require(0 < len(body) <= LIMIT, 'ARTIFACT_SIZE')
                        return body
                except ProofError:
                    raise
                except Exception:
                    raise ProofError('ARTIFACT_DOWNLOAD') from None
            raise ProofError('API_ACCESS_FAILED') from None
        except ProofError:
            raise
        except Exception:
            raise ProofError('API_ACCESS_FAILED') from None

    def get(self, path):
        return self._api(path)

    def archive(self, artifact_id):
        return self._api('/actions/artifacts/' + str(artifact_id) + '/zip', archive=True)


def check_run(run, commit, event, workflow, completed=True):
    require(isinstance(run, dict) and run.get('repository', {}).get('full_name') == REPO
            and run.get('head_repository', {}).get('full_name') == REPO
            and run.get('head_sha') == commit and run.get('head_branch') == 'main'
            and run.get('event') == event and run.get('path') == workflow
            and positive(run.get('id')) and positive(run.get('run_attempt'))
            and positive(run.get('repository', {}).get('id'))
            and run.get('head_repository', {}).get('id') == run['repository']['id'], 'RUN_IDENTITY')
    if completed:
        require(run.get('status') == 'completed' and run.get('conclusion') == 'success', 'RUN_NOT_SUCCESSFUL')


def ci_from_run(run, commit):
    check_run(run, commit, 'push', CI)
    return {'id': run['id'], 'attempt': run['run_attempt'], 'headSha': commit, 'branch': 'main',
            'event': 'push', 'status': 'completed', 'conclusion': 'success', 'workflow': CI}


def resolve(env, api):
    ctx = invocation(env)
    for commit in (SOURCE, ctx['workflowCommit']):
        comparison = api.get('/compare/' + commit + '...main')
        require(comparison.get('status') in ('ahead', 'identical')
                and comparison.get('merge_base_commit', {}).get('sha') == commit, 'NOT_MAIN_ANCESTOR')
    ctx['sourceCI'] = ci_from_run(api.get('/actions/runs/43873584133'), SOURCE)
    rows = api.get('/actions/workflows/ci.yml/runs?head_sha=' + ctx['workflowCommit'] + '&event=push&status=success&per_page=100').get('workflow_runs')
    require(isinstance(rows, list), 'CI_LIST')
    candidates = []
    for run in rows:
        try:
            check_run(run, ctx['workflowCommit'], 'push', CI)
            candidates.append(run['id'])
        except ProofError:
            continue
    require(bool(candidates), 'WORKFLOW_MAIN_CI_REQUIRED')
    ctx['workflowCI'] = ci_from_run(api.get('/actions/runs/' + str(max(candidates))), ctx['workflowCommit'])
    return ctx


def timestamp(raw):
    try:
        t = datetime.fromisoformat(raw.replace('Z', '+00:00'))
        require(t.tzinfo is not None, 'ARTIFACT_TIME')
        return t
    except (ValueError, AttributeError):
        raise ProofError('ARTIFACT_TIME') from None


def artifact_metadata(api, artifact_id, run_id, attempt, w, name, completed=True):
    run = api.get('/actions/runs/' + str(run_id))
    check_run(run, w, 'workflow_dispatch', WORKFLOW, completed)
    require(run['id'] == run_id and run['run_attempt'] == attempt, 'STALE_RUN_ATTEMPT')
    specific = api.get('/actions/runs/' + str(run_id) + '/attempts/' + str(attempt))
    check_run(specific, w, 'workflow_dispatch', WORKFLOW, completed)
    require(specific['id'] == run_id and specific['run_attempt'] == attempt, 'STALE_RUN_ATTEMPT')
    info = api.get('/actions/artifacts/' + str(artifact_id))
    origin = info.get('workflow_run', {})
    require(positive(info.get('id')) and info['id'] == artifact_id and info.get('name') == name and info.get('expired') is False
            and positive(info.get('size_in_bytes')) and info['size_in_bytes'] <= LIMIT
            and origin.get('id') == run_id and origin.get('head_sha') == w and origin.get('head_branch') == 'main'
            and origin.get('repository_id') == run['repository'].get('id')
            and origin.get('head_repository_id') == run['repository'].get('id'), 'ARTIFACT_ORIGIN')
    digest = info.get('digest', '')
    require(isinstance(digest, str) and digest.startswith('sha256:') and hex_value(digest[7:]), 'ARTIFACT_DIGEST')
    require(timestamp(specific['run_started_at']) <= timestamp(info.get('created_at')) <= (timestamp(run['updated_at']) if completed else datetime.now(timezone.utc)), 'STALE_ARTIFACT')
    return info


def safe_zip(path, limit=512 * 1024 * 1024):
    regular(path)
    result = {}
    with zipfile.ZipFile(path) as archive:
        require(len(archive.infolist()) <= 4096, 'ZIP_ENTRY_LIMIT')
        total = 0
        seen = set()
        for info in archive.infolist():
            name = info.filename
            require(name and name not in seen and '\\' not in name and not any(ord(c) < 32 for c in name)
                    and not name.startswith('/') and not re.match(r'^[A-Za-z]:', name)
                    and all(x not in ('', '.', '..') for x in name.rstrip('/').split('/')), 'ZIP_PATH')
            seen.add(name)
            mode = stat.S_IFMT(info.external_attr >> 16)
            require(not info.flag_bits & 1 and mode in ((0, stat.S_IFDIR) if info.is_dir() else (0, stat.S_IFREG)), 'ZIP_TYPE')
            total += info.file_size
            require(total <= limit, 'ZIP_EXPANSION_LIMIT')
            if info.is_dir():
                continue
            body = archive.read(info)
            require(len(body) == info.file_size, 'ZIP_SIZE')
            result[name] = {'sha256': sha(body), 'bytes': len(body)}
    return result


def extract_data(body, destination, expected):
    destination = Path(destination)
    require(not destination.exists(), 'OUTPUT_EXISTS')
    with tempfile.TemporaryDirectory() as tmp:
        zipped = Path(tmp) / 'data.zip'
        zipped.write_bytes(body)
        entries = safe_zip(zipped, LIMIT)
        require(set(entries) == set(expected), 'ARTIFACT_FILES')
        destination.mkdir(parents=True)
        with zipfile.ZipFile(zipped) as archive:
            for name in expected:
                require(PurePosixPath(name).name == name, 'ARTIFACT_FILES')
                with (destination / name).open('xb') as stream:
                    stream.write(archive.read(name))


def signature_names(entries, signed):
    reserved = {n for n in entries if n.upper() == 'META-INF/MANIFEST.MF'
                or (n.upper().startswith('META-INF/') and re.search(r'\.(SF|RSA|EC|DSA)$', n, re.I))
                or n.upper().startswith('META-INF/SIG-')}
    if not signed:
        require(not reserved, 'EXPECTED_UNSIGNED')
    else:
        require(reserved in ({'META-INF/MANIFEST.MF', 'META-INF/ANKER.SF', 'META-INF/ANKER.RSA'},
                             {'META-INF/MANIFEST.MF', 'META-INF/ANKER.SF', 'META-INF/ANKER.EC'}), 'SIGNATURE_CONTAINER')
    return reserved


def public_env(env):
    return {k: v for k, v in env.items() if k in ('PATH', 'HOME', 'JAVA_HOME', 'TMPDIR', 'RUNNER_TEMP', 'LANG', 'LC_ALL', 'SYSTEMROOT')}


def tool(args, *, env=None):
    try:
        p = subprocess.run(args, capture_output=True, env=public_env(os.environ) if env is None else env, timeout=180)
        require(p.returncode == 0, 'TOOL_FAILED')
        return p.stdout
    except ProofError:
        raise
    except Exception:
        raise ProofError('TOOL_FAILED') from None


def tools_lock():
    data = json_load(regular(ROOT / 'android-aab-tools.json', JSON_LIMIT))
    require(data['schemaVersion'] == 1 and data['bundletoolVersion'] == '1.18.1', 'TOOL_LOCK')
    return data


def tooling(directory, fetch=False):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    require(not directory.is_symlink(), 'TOOL_PATH')
    jars = []
    opener = urllib.request.build_opener(NoRedirect())
    for item in tools_lock()['jars']:
        name = item['file']
        require(Path(name).name == name and name.endswith('.jar') and hex_value(item['sha256']), 'TOOL_LOCK')
        file = directory / name
        if not file.exists():
            require(fetch, 'TOOL_UNAVAILABLE')
            for url in item['urls']:
                require(url.startswith(('https://dl.google.com/dl/android/maven2/', 'https://repo.maven.apache.org/maven2/')), 'TOOL_URL')
                try:
                    with opener.open(urllib.request.Request(url, method='GET'), timeout=40) as response:
                        body = response.read(32 * 1024 * 1024 + 1)
                    require(len(body) <= 32 * 1024 * 1024 and sha(body) == item['sha256'], 'TOOL_HASH')
                    with file.open('xb') as stream:
                        stream.write(body)
                    break
                except urllib.error.HTTPError:
                    continue
            require(file.exists(), 'TOOL_UNAVAILABLE')
        require(sha(regular(file, 32 * 1024 * 1024)) == item['sha256'], 'TOOL_HASH')
        jars.append(str(file.resolve()))
    classes = directory / 'verifier'
    source = ROOT / 'AnkerAabVerifier.java'
    marker = classes / 'source.sha256'
    if not marker.exists() or marker.read_text() != sha(regular(source)):
        classes.mkdir(exist_ok=True)
        tool(['javac', '-d', str(classes), str(source)])
        marker.write_text(sha(regular(source)))
    return os.pathsep.join(jars), str(classes)


def jar_report(file, classes, signed=False, certificate=None):
    args = ['java', '-cp', classes, 'AnkerAabVerifier', 'signed' if signed else 'unsigned', str(file)]
    if signed:
        args.extend([CERT, str(certificate)])
    data = json_load(tool(args))
    require(data.get('signed') is signed and data.get('certificateSha256') == (CERT if signed else None)
            and positive(data.get('payloadEntries'))
            and type(data.get('minSigners')) is int and type(data.get('maxSigners')) is int
            and data['minSigners'] == data['maxSigners'] == (1 if signed else 0)
            and (data.get('publicKeyAlgorithm') in ('RSA', 'EC') if signed else data.get('publicKeyAlgorithm') is None), 'JAR_VERIFICATION')
    return data


def inspect_bundle(file, cp):
    base = ['java', '-cp', cp, 'com.android.tools.build.bundletool.BundleToolMain']
    tool(base + ['validate', '--bundle=' + str(file)])
    raw = tool(base + ['dump', 'manifest', '--bundle=' + str(file), '--module=base'])
    require(len(raw) <= JSON_LIMIT and b'<!DOCTYPE' not in raw.upper() and b'<!ENTITY' not in raw.upper(), 'MANIFEST_XML')
    root = ET.fromstring(raw)
    a = '{http://schemas.android.com/apk/res/android}'
    require(root.get('package') == 'de.frnkrm.anker.mobile' and root.get(a + 'versionCode') == '18'
            and root.get(a + 'versionName') == '1.5.0-rc.4' and root.get(a + 'compileSdkVersion') == '36', 'PACKAGE_VERSION')
    sdk, app = root.find('uses-sdk'), root.find('application')
    require(sdk is not None and sdk.get(a + 'minSdkVersion') == '26' and sdk.get(a + 'targetSdkVersion') == '36'
            and app is not None and app.get(a + 'allowBackup') == 'false'
            and app.get(a + 'debuggable', 'false') == 'false', 'SDK_BACKUP')
    require(any(x.get(a + 'name') == 'android.hardware.nfc' and x.get(a + 'required') == 'false' for x in root.findall('uses-feature')), 'NFC_OPTIONAL')
    def canonical(e):
        return [e.tag, sorted(e.attrib.items()), [canonical(c) for c in e]]
    require(sha(json.dumps(canonical(root), separators=(',', ':')).encode()) == MANIFEST_SHA256, 'MANIFEST_SOURCE_CHANGED')
    permissions = sorted([x.tag, sorted([list(v) for v in x.attrib.items()])] for x in root if x.tag.startswith('uses-permission'))
    require(len(permissions) == 31 and any(x.get(a + 'name') == 'android.permission.NFC' for x in root.findall('uses-permission')), 'PERMISSIONS')
    return {'applicationId': 'de.frnkrm.anker.mobile', 'versionCode': 18, 'versionName': '1.5.0-rc.4',
            'sdk': {'min': 26, 'target': 36, 'compile': 36}, 'manifestSHA256': sha(raw), 'permissions': permissions}


def native_and_identity(file):
    elf = 0
    fingerprint = False
    with zipfile.ZipFile(file) as archive:
        names = archive.namelist()
        require(all(n in names for n in ('BundleConfig.pb', 'base/manifest/AndroidManifest.xml', 'base/resources.pb')), 'BUNDLE_STRUCTURE')
        require(b'viewport-fit=contain' in archive.read('base/assets/public/index.html'), 'VIEWPORT')
        for name in names:
            if name.startswith('base/assets/public/') and name.endswith('.js'):
                fingerprint |= FINGERPRINT.encode() in archive.read(name)
            if not (name.startswith('base/lib/') and name.endswith('.so')):
                continue
            body = archive.read(name)
            if body[:6] != b'\x7fELF\x02\x01':
                continue
            offset = struct.unpack_from('<Q', body, 32)[0]
            size, count = struct.unpack_from('<HH', body, 54)
            loads = 0
            for i in range(count):
                kind, _, start, addr, _, _, _, alignment = struct.unpack_from('<IIQQQQQQ', body, offset + i * size)
                if kind == 1:
                    require(alignment >= 16384 and (addr - start) % 16384 == 0, 'ELF_ALIGNMENT')
                    loads += 1
            require(loads > 0, 'ELF_SEGMENTS')
            elf += 1
    require(fingerprint, 'FINGERPRINT_MISMATCH')
    require(elf > 0, 'NATIVE_MISSING')
    return elf


def prepared_proof(ctx, bundle, app_root, cp, classes):
    require(ctx['mode'] == 'prepare', 'PREPARE_ONLY')
    root = Path(app_root)
    require(tool(['git', '-C', str(root), 'rev-parse', 'HEAD']).decode().strip() == SOURCE
            and not tool(['git', '-C', str(root), 'status', '--porcelain=v1', '--untracked-files=all']), 'DIRTY_SOURCE')
    entries = safe_zip(bundle)
    signature_names(entries, False)
    jar_report(bundle, classes)
    app = inspect_bundle(bundle, cp)
    elf = native_and_identity(bundle)
    dist = root / 'dist'
    assets = root / 'android/app/src/main/assets'
    files = [p for p in assets.rglob('*') if p.is_file()]
    require(bool(files), 'ASSETS_MISSING')
    with zipfile.ZipFile(bundle) as archive:
        for path in files:
            require(not path.is_symlink() and archive.read('base/assets/' + path.relative_to(assets).as_posix()) == path.read_bytes(), 'ASSET_MISMATCH')
        for path in dist.rglob('*'):
            if path.is_file():
                require(archive.read('base/assets/public/' + path.relative_to(dist).as_posix()) == path.read_bytes(), 'WEB_ASSET_MISMATCH')
        actual = {n.removeprefix('base/assets/public/') for n in entries if n.startswith('base/assets/public/')}
        expected = {p.relative_to(assets / 'public').as_posix() for p in (assets / 'public').rglob('*') if p.is_file()}
        require(actual == expected, 'OLD_WEB_ASSETS')
    return {'schemaVersion': 1, 'kind': 'anker-code18-unsigned', 'sourceCommit': SOURCE,
            'sourceFingerprint': FINGERPRINT, 'workflowCommit': ctx['workflowCommit'],
            'sourceCI': ctx['sourceCI'], 'workflowCI': ctx['workflowCI'], 'prepareRun': ctx['run'],
            'reference': REFERENCE, 'application': app, 'bundle': {'sha256': sha(regular(bundle)),
            'bytes': Path(bundle).stat().st_size, 'entries': entries},
            'checks': {'bundletool': True, 'jarUnsigned': True, 'assets': True, 'elf64': elf},
            'tools': {'bundletool': '1.18.1', 'toolLockSHA256': sha(regular(ROOT / 'android-aab-tools.json'))}}


def validate_unsigned(proof, bundle, ctx, cp, classes):
    exact(proof, ('schemaVersion', 'kind', 'sourceCommit', 'sourceFingerprint', 'workflowCommit', 'sourceCI',
                  'workflowCI', 'prepareRun', 'reference', 'application', 'bundle', 'checks', 'tools'))
    require(type(proof['schemaVersion']) is int and proof['schemaVersion'] == 1 and proof['kind'] == 'anker-code18-unsigned'
            and proof['sourceCommit'] == SOURCE and proof['sourceFingerprint'] == FINGERPRINT
            and proof['workflowCommit'] == ctx['workflowCommit'] and proof['reference'] == REFERENCE, 'PROOF_IDENTITY')
    validate_ci_proof(proof['sourceCI'], SOURCE)
    validate_ci_proof(proof['workflowCI'], ctx['workflowCommit'])
    require(proof['sourceCI'] == ctx['sourceCI'] and proof['workflowCI'] == ctx['workflowCI'], 'CI_ATTEMPT_CHANGED')
    exact(proof['prepareRun'], ('id', 'attempt'))
    require(all(positive(v) for v in proof['prepareRun'].values()), 'PREPARE_RUN_MISMATCH')
    binding = ctx['binding']
    require(proof['prepareRun'] == {'id': binding['prepare_run_id'], 'attempt': binding['prepare_run_attempt']}, 'PREPARE_RUN_MISMATCH')
    exact(proof['bundle'], ('sha256', 'bytes', 'entries'))
    data = regular(bundle)
    require(sha(data) == binding['expected_unsigned_sha256'] == proof['bundle']['sha256']
            and type(proof['bundle']['bytes']) is int and proof['bundle']['bytes'] == len(data), 'UNSIGNED_HASH')
    entries = safe_zip(bundle)
    require(entries == proof['bundle']['entries'], 'PAYLOAD_PROOF')
    signature_names(entries, False)
    jar_report(bundle, classes)
    require(inspect_bundle(bundle, cp) == proof['application'], 'MANIFEST_PROOF')
    exact(proof['checks'], ('bundletool', 'jarUnsigned', 'assets', 'elf64'))
    require(all(proof['checks'][k] is True for k in ('bundletool', 'jarUnsigned', 'assets'))
            and positive(proof['checks']['elf64'])
            and proof['checks'] == {'bundletool': True, 'jarUnsigned': True, 'assets': True, 'elf64': native_and_identity(bundle)}
            and proof['tools'] == {'bundletool': '1.18.1', 'toolLockSHA256': sha(regular(ROOT / 'android-aab-tools.json'))}, 'CHECKS_PROOF')
    return proof


def download_unsigned(ctx, api, target, cp, classes):
    b = ctx['binding']
    info = artifact_metadata(api, b['unsigned_artifact_id'], b['prepare_run_id'], b['prepare_run_attempt'],
                             ctx['workflowCommit'], f"anker-code18-unsigned-{b['prepare_run_id']}-{b['prepare_run_attempt']}")
    body = api.archive(b['unsigned_artifact_id'])
    require(sha(body) == info['digest'][7:], 'ARCHIVE_HASH')
    extract_data(body, target, ('unsigned.aab', 'proof.json'))
    proof_raw = regular(Path(target) / 'proof.json', JSON_LIMIT)
    require(sha(proof_raw) == b['expected_proof_sha256'], 'PROOF_HASH')
    proof = validate_unsigned(json_load(proof_raw), Path(target) / 'unsigned.aab', ctx, cp, classes)
    receipt = {'context': ctx, 'artifactId': info['id'], 'archiveDigest': info['digest'],
               'validatedAt': datetime.now(timezone.utc).isoformat(), 'proofSHA256': sha(proof_raw)}
    write_json(Path(target) / 'validated.json', receipt)
    return proof


def validate_receipt(folder, ctx, cp, classes):
    folder = Path(folder)
    require(not folder.is_symlink() and {p.name for p in folder.iterdir()} == {'unsigned.aab', 'proof.json', 'validated.json'}, 'INPUT_FILES')
    receipt = json_load(regular(folder / 'validated.json', JSON_LIMIT))
    exact(receipt, ('context', 'artifactId', 'archiveDigest', 'validatedAt', 'proofSHA256'))
    age = (datetime.now(timezone.utc) - timestamp(receipt['validatedAt'])).total_seconds()
    require(receipt['context'] == ctx and 0 <= age <= 600 and positive(receipt['artifactId'])
            and receipt['artifactId'] == ctx['binding']['unsigned_artifact_id']
            and isinstance(receipt['archiveDigest'], str) and receipt['archiveDigest'].startswith('sha256:')
            and hex_value(receipt['archiveDigest'][7:]), 'STALE_VALIDATION')
    raw = regular(folder / 'proof.json', JSON_LIMIT)
    require(sha(raw) == ctx['binding']['expected_proof_sha256'] == receipt['proofSHA256'], 'PROOF_HASH')
    return validate_unsigned(json_load(raw), folder / 'unsigned.aab', ctx, cp, classes)


def sign(ctx, folder, output, cp, classes, env):
    require(ctx['mode'] == 'sign', 'SIGN_ONLY')
    proof = validate_receipt(folder, ctx, cp, classes)
    require(all(isinstance(env.get(n), str) and env[n] for n in SECRETS), 'SIGNING_VALUES_UNAVAILABLE')
    require(len(env[SECRETS[0]]) <= 49152 and re.fullmatch('[A-Za-z0-9_.-]{1,128}', env[SECRETS[2]])
            and not env[SECRETS[2]].startswith('-'), 'SIGNING_VALUES_INVALID')
    output = Path(output)
    require(not output.exists(), 'OUTPUT_EXISTS')
    key_bytes = bytearray()
    private = {}
    try:
        try:
            key_bytes = bytearray(base64.b64decode(env[SECRETS[0]], validate=True))
        except ValueError:
            raise ProofError('SIGNING_VALUES_INVALID') from None
        require(0 < len(key_bytes) <= 36864, 'SIGNING_VALUES_INVALID')
        output.mkdir(parents=True)
        private = dict(public_env(env), AAB_STORE_PASSWORD=env[SECRETS[1]], AAB_KEY_PASSWORD=env[SECRETS[3]])
        with tempfile.TemporaryDirectory(prefix='anker-private-', dir=env['RUNNER_TEMP']) as tmp:
            os.chmod(tmp, 0o700)
            key = Path(tmp) / 'existing.keystore'
            fd = os.open(key, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'wb') as stream:
                stream.write(key_bytes)
            der = tool(['keytool', '-exportcert', '-keystore', str(key), '-alias', env[SECRETS[2]],
                        '-storepass:env', 'AAB_STORE_PASSWORD'], env=private)
            require(sha(der) == CERT, 'UPLOAD_CERTIFICATE_MISMATCH')
            public = Path(tmp) / 'public.der'
            public.write_bytes(der)
            cert_info = json_load(tool(['java', '-cp', classes, 'AnkerAabVerifier', 'certificate', str(public), CERT]))
            algorithm = cert_info.get('algorithm')
            require(algorithm in ('RSA', 'EC'), 'CERTIFICATE_ALGORITHM')
            requested_algorithm = 'SHA256withRSA' if algorithm == 'RSA' else 'SHA256withECDSA'
            tool(['jarsigner', '-keystore', str(key), '-storepass:env', 'AAB_STORE_PASSWORD', '-keypass:env', 'AAB_KEY_PASSWORD',
                  '-digestalg', 'SHA-256', '-sigalg', requested_algorithm,
                  '-sigfile', 'ANKER', '-signedjar', str(output / 'signed.aab'), str(Path(folder) / 'unsigned.aab'), env[SECRETS[2]]], env=private)
    finally:
        for i in range(len(key_bytes)):
            key_bytes[i] = 0
        private.clear()
    signed = output / 'signed.aab'
    # A successful signing process is not the final success/download gate.
    write_json(output / 'sign-proof.json', {'schemaVersion': 1, 'kind': 'anker-code18-signed-pending',
               'context': ctx, 'unsignedSHA256': proof['bundle']['sha256'],
               'proofSHA256': ctx['binding']['expected_proof_sha256'], 'signedSHA256': sha(regular(signed)),
               'signedBytes': signed.stat().st_size, 'certificateSHA256': CERT,
               'requestedSignatureAlgorithm': requested_algorithm, 'verified': False})


def verify_signed(unsigned, signed, classes, cp, app):
    before, after = safe_zip(unsigned), safe_zip(signed)
    signature_names(before, False)
    signatures = signature_names(after, True)
    require({k: v for k, v in after.items() if k not in signatures} == before, 'SIGNED_PAYLOAD_CHANGED')
    with tempfile.TemporaryDirectory() as tmp:
        cert = Path(tmp) / 'public.der'
        report = jar_report(signed, classes, True, cert)
        require(sha(regular(cert)) == CERT, 'SIGNER_CERTIFICATE')
        # Trust only the public pinned Android certificate in this disposable store.
        trust = Path(tmp) / 'public-trust.p12'
        tool(['keytool', '-importcert', '-noprompt', '-alias', 'anker-upload-b4', '-file', str(cert),
              '-keystore', str(trust), '-storetype', 'PKCS12', '-storepass', 'public-verification-only'])
        tool(['jarsigner', '-verify', '-strict', '-keystore', str(trust), '-storepass', 'public-verification-only', str(signed)])
    require(inspect_bundle(signed, cp) == app, 'SIGNED_MANIFEST_CHANGED')
    native_and_identity(signed)
    return report


def verify(ctx, folder, signed_folder, output, cp, classes, signed_artifact_id):
    proof = validate_receipt(folder, ctx, cp, classes)
    signed_folder = Path(signed_folder)
    require(not signed_folder.is_symlink() and {p.name for p in signed_folder.iterdir()} == {'signed.aab', 'sign-proof.json', 'transfer.json'}, 'SIGNED_FILES')
    transfer = json_load(regular(signed_folder / 'transfer.json', JSON_LIMIT))
    exact(transfer, ('context', 'artifactId', 'archiveDigest'))
    require(positive(signed_artifact_id) and positive(transfer['artifactId']) and transfer['artifactId'] == signed_artifact_id
            and transfer['context'] == ctx and isinstance(transfer['archiveDigest'], str)
            and transfer['archiveDigest'].startswith('sha256:') and hex_value(transfer['archiveDigest'][7:]), 'SIGNED_TRANSFER')
    receipt = json_load(regular(signed_folder / 'sign-proof.json', JSON_LIMIT))
    exact(receipt, ('schemaVersion', 'kind', 'context', 'unsignedSHA256', 'proofSHA256', 'signedSHA256', 'signedBytes', 'certificateSHA256', 'requestedSignatureAlgorithm', 'verified'))
    signed = signed_folder / 'signed.aab'
    body = regular(signed)
    require(type(receipt['schemaVersion']) is int and receipt['schemaVersion'] == 1
            and receipt['kind'] == 'anker-code18-signed-pending' and receipt['context'] == ctx
            and receipt['verified'] is False and receipt['certificateSHA256'] == CERT
            and receipt['unsignedSHA256'] == proof['bundle']['sha256']
            and receipt['proofSHA256'] == ctx['binding']['expected_proof_sha256']
            and receipt['signedSHA256'] == sha(body) and type(receipt['signedBytes']) is int
            and receipt['signedBytes'] == len(body), 'SIGNED_RECEIPT')
    report = verify_signed(Path(folder) / 'unsigned.aab', signed, classes, cp, proof['application'])
    require(report.get('publicKeyAlgorithm') in ('RSA', 'EC') and receipt['requestedSignatureAlgorithm'] ==
            ('SHA256withRSA' if report['publicKeyAlgorithm'] == 'RSA' else 'SHA256withECDSA'), 'SIGNED_ALGORITHM')
    original = json_load(regular(Path(folder) / 'validated.json', JSON_LIMIT))
    output = Path(output)
    require(not output.exists(), 'OUTPUT_EXISTS')
    output.mkdir(parents=True)
    shutil.copyfile(signed, output / 'Anker-Code18-SIGNIERT.aab')
    write_json(output / 'proof.json', {'schemaVersion': 1, 'kind': 'anker-code18-signed-verified', 'context': ctx,
               'reference': REFERENCE, 'unsignedSHA256': proof['bundle']['sha256'], 'signedSHA256': sha(body),
               'signedBytes': len(body), 'certificateSHA256': CERT, 'jarVerification': report,
               'requestedSignatureAlgorithm': receipt['requestedSignatureAlgorithm'], 'verifiedPayloadDigestAlgorithm': 'SHA-256',
               'payloadUnchanged': True, 'unsignedArtifact': {'id': original['artifactId'], 'archiveDigest': original['archiveDigest']},
               'signedInputArtifact': {'id': transfer['artifactId'], 'archiveDigest': transfer['archiveDigest']},
               'uploadedToPlay': False, 'deviceVerified': False})


def output(name, value):
    require(re.fullmatch('[a-z_]+', name), 'OUTPUT_NAME')
    text = json.dumps(value, sort_keys=True, separators=(',', ':')) if not isinstance(value, str) else value
    require('\n' not in text and '\r' not in text, 'OUTPUT_VALUE')
    with open(os.environ['GITHUB_OUTPUT'], 'a') as stream:
        stream.write(name + '=' + text + '\n')


class SafeParser(argparse.ArgumentParser):
    def error(self, _message):
        self.exit(2, 'AAB-Prüfung abgebrochen: INVALID_ARGUMENTS\n')


def main(argv=None):
    parser = SafeParser(description='Manual Code18 AAB proof helper; no local default execution.')
    parser.add_argument('command', choices=['resolve', 'tools', 'prepare', 'input', 'sign', 'verify'])
    parser.add_argument('--tools', type=Path)
    parser.add_argument('--bundle', type=Path)
    parser.add_argument('--app', type=Path)
    parser.add_argument('--input', type=Path)
    parser.add_argument('--signed-input', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--signed-artifact-id')
    args = parser.parse_args(argv)
    if args.command == 'resolve':
        invocation(os.environ)  # reject local/PR/push invocations before even requiring a token
        ctx = resolve(os.environ, GitHub(os.environ.get('GH_TOKEN')))
        output('context', ctx)
        output('mode', ctx['mode'])
        output('workflow', ctx['workflowCommit'])
        return
    ctx = context(os.environ)
    require(args.tools is not None, 'TOOLS_ARGUMENT')
    cp, classes = tooling(args.tools, fetch=args.command == 'tools')
    if args.command == 'tools':
        return
    if args.command == 'prepare':
        proof = prepared_proof(ctx, args.bundle, args.app, cp, classes)
        require(args.output is not None and not args.output.exists(), 'OUTPUT_EXISTS')
        args.output.mkdir(parents=True)
        shutil.copyfile(args.bundle, args.output / 'unsigned.aab')
        write_json(args.output / 'proof.json', proof)
        output('unsigned_sha', proof['bundle']['sha256'])
        output('proof_sha', sha(regular(args.output / 'proof.json', JSON_LIMIT)))
    elif args.command == 'input':
        require(ctx['mode'] == 'sign', 'SIGN_ONLY')
        # Fresh source/workflow CI before reading the actual prepare handoff.
        fresh = resolve(os.environ, GitHub(os.environ.get('GH_TOKEN')))
        require(fresh == ctx, 'CI_ATTEMPT_CHANGED')
        api = GitHub(os.environ.get('GH_TOKEN'))
        download_unsigned(ctx, api, args.input, cp, classes)
        if args.signed_artifact_id:
            artifact_id = number(args.signed_artifact_id)
            info = artifact_metadata(api, artifact_id, ctx['run']['id'], ctx['run']['attempt'], ctx['workflowCommit'],
                                     f"anker-code18-signed-pending-{ctx['run']['id']}-{ctx['run']['attempt']}", completed=False)
            body = api.archive(artifact_id)
            require(sha(body) == info['digest'][7:], 'ARCHIVE_HASH')
            extract_data(body, args.signed_input, ('signed.aab', 'sign-proof.json'))
            write_json(args.signed_input / 'transfer.json', {'context': ctx, 'artifactId': artifact_id, 'archiveDigest': info['digest']})
    elif args.command == 'sign':
        sign(ctx, args.input, args.output, cp, classes, os.environ)
    elif args.command == 'verify':
        require(ctx['mode'] == 'sign', 'SIGN_ONLY')
        require(args.signed_artifact_id is not None, 'SIGNED_ARTIFACT_REQUIRED')
        verify(ctx, args.input, args.signed_input, args.output, cp, classes, number(args.signed_artifact_id))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # No raw tool/API/credential/URL error or private stdout/stderr is emitted.
        print('AAB-Prüfung abgebrochen: ' + (str(error) if isinstance(error, ProofError) else 'PROOF_FAILED'))
        raise SystemExit(1) from None
