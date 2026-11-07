"""Verify a fresh unsigned Android build. This script never receives signing secrets."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import re
import shutil
import struct
import subprocess
import xml.etree.ElementTree as ET
import zipfile

APPLICATION_ID = 'de.frnkrm.anker.mobile'


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def source_version(package, gradle):
    name = package.get('version', '')
    code = re.search(r"versionCode\(\(System.getenv\('VERSION_CODE'\) \?: '(\d+)'\)", gradle)
    native_name = re.search(r"versionName\(System.getenv\('VERSION_NAME'\) \?: '([^']+)'\)", gradle)
    if not re.fullmatch(r'\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?', name) or not code or not native_name or native_name[1] != name:
        raise ValueError('Package and Android version defaults do not match.')
    if not 0 < int(code[1]) <= 2147483647:
        raise ValueError('Invalid Android version code.')
    return name, code[1]


def apk_metadata(text):
    first = text.splitlines()[0] if text else ''
    result = {}
    for field in ['name', 'versionCode', 'versionName', 'compileSdkVersion']:
        match = re.search(r"\b" + field + r"='([^']*)'", first)
        if not match:
            raise ValueError('APK metadata is incomplete.')
        result[field] = match[1]
    for field in ['sdkVersion', 'targetSdkVersion']:
        match = re.search(r"^" + field + r":'(\d+)'", text, re.M)
        if not match:
            raise ValueError('APK API metadata is incomplete.')
        result[field] = int(match[1])
    return result


def ci_proof(data, commit):
    if not re.fullmatch('[a-f0-9]{40}', commit):
        raise ValueError('An exact source commit is required.')
    if data.get('headSha') != commit or data.get('headBranch') != 'main' or data.get('conclusion') != 'success' or data.get('event') != 'push' or data.get('workflow') != 'ci.yml':
        raise ValueError('Successful CI for the exact source commit is required.')
    return data


def native_results(folder, started, sources=None):
    rows = []
    for file in sorted(Path(folder).glob('TEST-*.xml')):
        if file.stat().st_mtime < started:
            raise ValueError('Native test results predate this build.')
        xml = ET.parse(file).getroot()
        rows.append({'suite': xml.attrib['name'], **{key: int(xml.attrib.get(key, '0')) for key in ['tests', 'failures', 'errors', 'skipped']}})
    totals = {key: sum(row[key] for row in rows) for key in ['tests', 'failures', 'errors', 'skipped']}
    if not rows or not totals['tests'] or any(totals[key] for key in ['failures', 'errors', 'skipped']):
        raise ValueError('Fresh native tests must pass without skipped cases.')
    if sources is not None:
        required = {file.stem for file in Path(sources).rglob('*Test.*') if file.suffix in ['.kt', '.java']}
        actual = {row['suite'].split('.')[-1].split('$')[0] for row in rows}
        if not required or required - actual:
            raise ValueError('Fresh native results do not cover every checked-in test class.')
    return {'totals': totals, 'suites': rows, 'freshRerun': True}


def apk_contents(apk, dist, identity):
    assets = {p.relative_to(dist).as_posix(): sha256(p) for p in dist.rglob('*') if p.is_file()}
    if not assets or not re.fullmatch('[a-f0-9]{64}', identity):
        raise ValueError('Production build identity or assets are missing.')
    elf64 = []
    with zipfile.ZipFile(apk) as archive:
        if archive.testzip() is not None:
            raise ValueError('APK ZIP contents are corrupt.')
        names = {name.removeprefix('assets/public/') for name in archive.namelist() if name.startswith('assets/public/') and not name.endswith('/')}
        if names - set(assets) - {'cordova.js', 'cordova_plugins.js'}:
            raise ValueError('APK contains unexpected web assets.')
        for name, digest in assets.items():
            if hashlib.sha256(archive.read('assets/public/' + name)).hexdigest() != digest:
                raise ValueError('APK web assets differ from the tested production build.')
        if not any(identity.encode() in archive.read('assets/public/' + name) for name in assets if name.endswith('.js')):
            raise ValueError('APK production source identity is missing.')
        if 'viewport-fit=contain' not in archive.read('assets/public/index.html').decode():
            raise ValueError('Android viewport configuration changed.')
        for name in archive.namelist():
            if not name.startswith('lib/') or not name.endswith('.so'):
                continue
            data = archive.read(name)
            if archive.getinfo(name).compress_type != zipfile.ZIP_STORED:
                raise ValueError('Native APK library is compressed.')
            if data[:6] != b'\x7fELF\x02\x01':
                continue
            phoff = struct.unpack_from('<Q', data, 32)[0]
            phentsize, phnum = struct.unpack_from('<HH', data, 54)
            loads = 0
            for index in range(phnum):
                p_type, _flags, offset, vaddr, _paddr, _filesz, _memsz, alignment = struct.unpack_from('<IIQQQQQQ', data, phoff + index * phentsize)
                if p_type == 1:
                    loads += 1
                    if alignment < 16384 or (vaddr - offset) % 16384:
                        raise ValueError('Native library does not support 16 KB page alignment.')
            if not loads:
                raise ValueError('Native ELF load segments are missing.')
            elf64.append(name)
    if not elf64:
        raise ValueError('Native library verification found no 64-bit ELF files.')
    return {'count': len(assets), 'sha256ByPath': assets, 'elf64With16kbLoadSegments': elf64}


def execute(args, *, check=True, binary=False):
    result = subprocess.run(args, capture_output=True, text=not binary)
    if check and result.returncode:
        raise RuntimeError('An Android verification tool failed.')
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apk', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--ci-proof', type=Path, required=True)
    parser.add_argument('--native-start', type=Path, required=True)
    parser.add_argument('--native-log', type=Path, required=True)
    args = parser.parse_args()
    root = Path.cwd()
    commit = os.environ.get('ANKER_SOURCE_COMMIT', '')
    proof = ci_proof(json.loads(args.ci_proof.read_text()), commit)
    actual_commit = execute(['git', '-C', str(root), 'rev-parse', 'HEAD']).stdout.strip()
    if actual_commit != commit:
        raise ValueError('Checkout does not match the approved source commit.')
    if (root / 'android/keystore.properties').exists():
        raise ValueError('A local signing configuration must not enter the unsigned build.')
    version, code = source_version(json.loads((root / 'package.json').read_text()), (root / 'android/app/build.gradle').read_text())
    sdk = Path(os.environ['ANDROID_HOME']) / 'build-tools/35.0.0'
    metadata = apk_metadata(execute([str(sdk / 'aapt'), 'dump', 'badging', str(args.apk)]).stdout)
    expected = {'name': APPLICATION_ID, 'versionName': version, 'versionCode': code, 'compileSdkVersion': '36', 'sdkVersion': 26, 'targetSdkVersion': 36}
    if metadata != expected:
        raise ValueError('APK package, version or API does not match the selected source.')
    if execute([str(sdk / 'apksigner'), 'verify', str(args.apk)], check=False).returncode == 0:
        raise ValueError('Build job must supply an unsigned APK.')
    execute([str(sdk / 'zipalign'), '-c', '-P', '16', '4', str(args.apk)])
    node = """import { loadConfigFromFile } from 'vite';
const c = await loadConfigFromFile({command:'build',mode:'production'},'vite.config.ts');
const p = c.config.plugins.flat(Infinity).find(v=>v?.name==='anker-device-test-catalog');
const s = await p.load.call({addWatchFile(){}},'\\0anker-device-tests');
const f = /BUILD_FINGERPRINT = \"([a-f0-9]{64})\"/.exec(s)?.[1];
if (!f) throw Error('Source identity missing'); process.stdout.write(f);"""
    identity = execute(['node', '--input-type=module', '-e', node]).stdout.strip()
    assets = apk_contents(args.apk, root / 'dist', identity)
    results = native_results(root / 'android/app/build/test-results/testDebugUnitTest', float(args.native_start.read_text()), root / 'android/app/src/test')
    log = args.native_log.read_text()
    tasks = ['checkDebugAarMetadata', 'checkReleaseAarMetadata', 'compileDebugKotlin', 'compileReleaseKotlin', 'testDebugUnitTest', 'assembleRelease']
    if 'BUILD SUCCESSFUL' not in log or any(not re.search(r'^> Task :app:' + task + r'\s*$', log, re.M) for task in tasks):
        raise ValueError('Required fresh native build checks are missing.')
    receipt = {'schemaVersion': 1, 'applicationId': APPLICATION_ID, 'versionName': version, 'versionCode': code, 'sourceCommit': commit, 'sourceIdentity': identity, 'unsignedApkSha256': sha256(args.apk), 'ci': proof, 'api': {'min': 26, 'target': 36, 'compile': 36}, 'webAssets': assets, 'nativeTests': results, 'freshNativeTasks': tasks, 'signing': 'unsigned', 'realAndroidDeviceTest': 'not run', 'windowsSigning': 'not run'}
    args.output.mkdir(parents=True, exist_ok=True)
    shutil.copy2(args.apk, args.output / 'unsigned.apk')
    metadata_path = args.output / 'build-proof.json'
    metadata_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            output.write('metadata_sha256=' + sha256(metadata_path) + '\n')
            output.write('unsigned_apk_sha256=' + receipt['unsignedApkSha256'] + '\n')
    print('Unsigned package, source identity, production assets, fresh native tests and 16 KB alignment verified.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        raise SystemExit('Android-Update-Prüfung fehlgeschlagen: ' + str(error)) from None
