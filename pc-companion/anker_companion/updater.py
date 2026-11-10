"""Opt-in, B4-authenticated source updates. Importing performs no I/O or effects."""
from __future__ import annotations

import base64
from datetime import datetime, timezone
import hashlib
import io
import json
import math
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from uuid import uuid4
import zipfile

from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from . import __version__

CHANNEL_URL = 'https://raw.githubusercontent.com/frnkrm/anker/main/pc-companion/update-channel.json'
DOMAIN = b'ANKER_PC_UPDATE_CHANNEL_V1\x00'
CERTIFICATE_SHA256 = 'b47ffffebe137cf15129961de43a27e3ec811acffe4542b6324e11768995b13a'
CERTIFICATE_PEM = b'''-----BEGIN CERTIFICATE-----
MIIEHjCCAoagAwIBAgIJAIsf9gtX3e/aMA0GCSqGSIb3DQEBCwUAMDwxCzAJBgNV
BAYTAkRFMQ4wDAYDVQQKEwVBbmtlcjEdMBsGA1UEAxMUQW5rZXIgTW9iaWxlIFJl
bGVhc2UwIBcNMjYxMTA3MTYzMDA0WhgPMjA1NDAzMjUxNjMwMDRaMDwxCzAJBgNV
BAYTAkRFMQ4wDAYDVQQKEwVBbmtlcjEdMBsGA1UEAxMUQW5rZXIgTW9iaWxlIFJl
bGVhc2UwggGiMA0GCSqGSIb3DQEBAQUAA4IBjwAwggGKAoIBgQCx6To5BV4sFgvW
lHojvjcd/Ik2FdywF/1itb2+Dwzkr/M49qvXAyiqXPHxX+BkY8K1/ouRJwUe1aAv
FLRwEqMjtwbP37a1tW9FQwQnIoi2+cqjrqm82WeAe06xUTE1gMTeZnb5g5PmLgUq
eEPLgpdIFe8BLPxpWnn0oJvBKWBflxci3BblgNa2pp1ao93DY+1TFTn9/G7zpnRs
w0AqATrrWu262/koGz5MelSYuLO0wJ+R0r8+T0+/1UaO4IhzUKL+X2of2NQ1eZvb
5LhRR/FQ+OuRfJ+gS6eRYwGNa8vGPrKdGVDrs9PkuurCfPoNU18AT3HPxCfplT3P
yaN0+L3bHHfX5G7teD0M34f3JjHHWe0FCKJjOjww9Jk4Edb7kc9lWMi7ciiCMeWE
gM1QpeBNrTSJtnwatrieBPsUNKwo3Uh43iikFeWFVTXxvE26e0TpuxihmGZ9T3sc
QigxMlGsFhg0FWHks9ii7crBCkWfg7/uqL4L7O+XME14v9cRPwUCAwEAAaMhMB8w
HQYDVR0OBBYEFD+SiMVdnKkljJkSTG61RisD8QMHMA0GCSqGSIb3DQEBCwUAA4IB
gQAV8SgWLZkeeq4J/o7L+dBJOclVzhRfb4xvtid6Mxi+CKZbyT/Qm1RQeeOybbPL
mm6qbvuM2dnzrabhNv/VN+zR/az6OO02C/idYn7BhIWN1HOQECUUbqM8YUnBlYPQ
onJ4+QgBzxI0CxgvVk/5nfwXTg2TO/ktfz8oFsLd1+26S2YjOSgF1yO+JlPqmfPe
GnJT+r3bJKBAeR52dDj4W2mh1GIyjaIwo8c8LEBrrIFeXtZK6dyjaCDaUhdInjan
GbL7kYCu3XmHevm6K/MZXJdwzrX90SiHECTv67Qk5BSm0fJF53HTJ/ZHxQlfOjeR
y8uH32FsiG0ZzXf+X9rZ3l42F5ugoGRUJTFcit61z2nehwObjKMMaHxfbkUFMht/
/TBvmVKD3UToPOURO7M4Iuw49kf20Tv/qEjUSv62H7V5rzsy0IbsCzEvpvgPgGPf
ZqIHFoqix6Z5BkZ0Til5s554xDEMqDB4FvzK7UNV6tswNcOLqZlYcpOMCBzFnB9h
TKI=
-----END CERTIFICATE-----
'''
MAX_CHANNEL = 64 * 1024
MAX_ARCHIVE = 16 * 1024 * 1024
MAX_FILE = 8 * 1024 * 1024
MAX_EXPANDED = 32 * 1024 * 1024
MODULES = ('__init__', '__main__', 'desktop_settings', 'engine', 'protocol', 'relay',
           'server', 'storage', 'tray', 'ui', 'updater', 'vault', 'widgets', 'windows')
PAYLOAD_FILES = frozenset(('Einrichten.cmd', 'Start.cmd', 'install.ps1', 'uninstall.ps1',
    'update-helper.ps1', 'requirements.txt', 'README.md', 'PROTOCOL.md',
    *(f'anker_companion/{module}.py' for module in MODULES)))
MANIFEST_KEYS = frozenset(('schemaVersion', 'version', 'protocolVersion', 'stateSchemaVersion',
    'sourceCommit', 'downloadCommit', 'url', 'sha256', 'bytes', 'createdAt', 'expiresAt'))


class UpdateError(ValueError):
    """Only fixed, non-sensitive codes cross the UI boundary."""

    def __init__(self, code):
        self.code = code if code in {'channel-invalid', 'signature-invalid', 'certificate-invalid',
            'expired', 'not-newer', 'network-unavailable', 'response-too-large', 'archive-invalid',
            'package-invalid', 'path-unsafe', 'check-required', 'stage-invalid',
            'confirmation-required', 'handoff-unavailable', 'busy', 'updater-closed'} else 'stage-invalid'
        super().__init__(self.code)


def _json(raw: bytes, limit=MAX_CHANNEL):
    if not isinstance(raw, bytes) or len(raw) > limit:
        raise UpdateError('response-too-large')
    def pairs(entries):
        result = {}
        for key, value in entries:
            if key in result:
                raise ValueError()
            result[key] = value
        return result
    try:
        return json.loads(raw.decode('utf-8'), object_pairs_hook=pairs,
                          parse_constant=lambda _value: (_ for _ in ()).throw(ValueError()))
    except (ValueError, UnicodeError, RecursionError):
        raise UpdateError('channel-invalid') from None


def signature_payload(manifest: dict) -> bytes:
    return DOMAIN + json.dumps(manifest, sort_keys=True, separators=(',', ':'),
                               ensure_ascii=False, allow_nan=False).encode('utf-8')


def _version(value):
    if not isinstance(value, str) or len(value) > 32 or not re.fullmatch(r'(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)', value):
        raise UpdateError('channel-invalid')
    result = tuple(int(part) for part in value.split('.'))
    if any(part > 2147483647 for part in result):
        raise UpdateError('channel-invalid')
    return result


def _timestamp(value):
    if not isinstance(value, str) or not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,3})?Z', value):
        raise UpdateError('channel-invalid')
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()
    except (ValueError, OverflowError, OSError):
        raise UpdateError('channel-invalid') from None


def verify_channel(raw: bytes, installed_version=__version__, now=None) -> dict:
    now = time.time() if now is None else now
    document = _json(raw)
    if not isinstance(document, dict) or set(document) != {'manifest', 'signature'}:
        raise UpdateError('channel-invalid')
    manifest = document['manifest']
    if not isinstance(manifest, dict) or set(manifest) != MANIFEST_KEYS:
        raise UpdateError('channel-invalid')
    if any(type(manifest[key]) is not int or manifest[key] != value for key, value in
           [('schemaVersion', 1), ('protocolVersion', 3), ('stateSchemaVersion', 1)]):
        raise UpdateError('channel-invalid')
    for key, length in [('sourceCommit', 40), ('downloadCommit', 40), ('sha256', 64)]:
        if not isinstance(manifest[key], str) or not re.fullmatch('[a-f0-9]{' + str(length) + '}', manifest[key]):
            raise UpdateError('channel-invalid')
    if manifest['url'] != 'https://codeload.github.com/frnkrm/anker/zip/' + manifest['downloadCommit']:
        raise UpdateError('channel-invalid')
    if type(manifest['bytes']) is not int or not 1 <= manifest['bytes'] <= MAX_ARCHIVE:
        raise UpdateError('channel-invalid')
    incoming, installed = _version(manifest['version']), _version(installed_version)
    created, expires = _timestamp(manifest['createdAt']), _timestamp(manifest['expiresAt'])
    if type(now) not in (int, float) or not math.isfinite(now) or not 0 < expires - created <= 30 * 86400:
        raise UpdateError('channel-invalid')
    try:
        certificate = x509.load_pem_x509_certificate(CERTIFICATE_PEM)
        if certificate.fingerprint(hashes.SHA256()).hex() != CERTIFICATE_SHA256:
            raise UpdateError('certificate-invalid')
        key = certificate.public_key()
        if not isinstance(key, rsa.RSAPublicKey) or key.key_size < 2048:
            raise UpdateError('certificate-invalid')
        signature = document['signature']
        if not isinstance(signature, str) or not re.fullmatch(r'[A-Za-z0-9_-]+', signature) or len(signature) > 1024:
            raise UpdateError('signature-invalid')
        decoded = base64.b64decode(signature + '=' * (-len(signature) % 4), altchars=b'-_', validate=True)
        if base64.urlsafe_b64encode(decoded).decode().rstrip('=') != signature or len(decoded) != key.key_size // 8:
            raise UpdateError('signature-invalid')
        key.verify(decoded, signature_payload(manifest), padding.PKCS1v15(), hashes.SHA256())
    except UpdateError:
        raise
    except Exception:
        raise UpdateError('signature-invalid') from None
    if created > now + 300 or expires <= now:
        raise UpdateError('expired')
    if incoming <= installed:
        raise UpdateError('not-newer')
    return dict(manifest)


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _http_get(url: str, limit: int) -> bytes:
    if url != CHANNEL_URL and not re.fullmatch(r'https://codeload\.github\.com/frnkrm/anker/zip/[a-f0-9]{40}', url):
        raise UpdateError('channel-invalid')
    deadline = time.monotonic() + 45
    try:
        request = urllib.request.Request(url, method='GET', headers={'Accept': 'application/json' if url == CHANNEL_URL else 'application/zip', 'User-Agent': 'Anker-PC-Updater/1'})
        with urllib.request.build_opener(_NoRedirect()).open(request, timeout=10) as response:
            if response.status != 200 or response.geturl() != url:
                raise UpdateError('network-unavailable')
            length = response.headers.get('Content-Length')
            if length is not None and (not re.fullmatch(r'[0-9]+', length) or int(length) > limit):
                raise UpdateError('response-too-large')
            chunks, total = [], 0
            reader = getattr(response, 'read1', response.read)
            while True:
                if time.monotonic() >= deadline:
                    raise UpdateError('network-unavailable')
                chunk = reader(min(64 * 1024, limit + 1 - total))
                if not chunk:
                    break
                total += len(chunk)
                if total > limit:
                    raise UpdateError('response-too-large')
                chunks.append(chunk)
            if length is not None and int(length) != total:
                raise UpdateError('network-unavailable')
            return b''.join(chunks)
    except UpdateError:
        raise
    except Exception:
        raise UpdateError('network-unavailable') from None


def verify_archive(raw: bytes, manifest: dict) -> dict[str, bytes]:
    if not isinstance(raw, bytes) or len(raw) != manifest['bytes'] or hashlib.sha256(raw).hexdigest() != manifest['sha256']:
        raise UpdateError('archive-invalid')
    root = 'anker-' + manifest['downloadCommit'] + '/'
    contents, names, expanded = {}, set(), 0
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            if len(archive.infolist()) > len(PAYLOAD_FILES) + 4:
                raise UpdateError('package-invalid')
            for info in archive.infolist():
                name = info.filename
                mode = (info.external_attr >> 16) & 0xFFFF
                if ('\\' in name or '\x00' in name or ':' in name or name.casefold() in names
                    or not name.startswith(root) or any(part in ('.', '..') for part in PurePosixPath(name).parts)
                    or info.flag_bits & 1 or info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)
                    or stat.S_ISLNK(mode) or stat.S_IFMT(mode) not in (0, stat.S_IFREG, stat.S_IFDIR)):
                    raise UpdateError('package-invalid')
                names.add(name.casefold())
                relative = name[len(root):]
                if info.is_dir():
                    if relative not in ('', 'anker_companion/'):
                        raise UpdateError('package-invalid')
                    continue
                if relative not in PAYLOAD_FILES | {'package-manifest.json'} or info.file_size > MAX_FILE:
                    raise UpdateError('package-invalid')
                expanded += info.file_size
                if expanded > MAX_EXPANDED:
                    raise UpdateError('package-invalid')
                content = archive.read(info)
                if len(content) != info.file_size:
                    raise UpdateError('package-invalid')
                contents[relative] = content
    except UpdateError:
        raise
    except Exception:
        raise UpdateError('archive-invalid') from None
    if set(contents) != PAYLOAD_FILES | {'package-manifest.json'}:
        raise UpdateError('package-invalid')
    package = _json(contents['package-manifest.json'])
    if (not isinstance(package, dict) or set(package) != {'schemaVersion', 'artifact', 'version', 'protocolVersion', 'stateSchemaVersion', 'pythonMinimum', 'sourceCommit', 'files'}
        or type(package['schemaVersion']) is not int or package['schemaVersion'] != 1
        or package['artifact'] != 'anker-pc-companion-source' or package['version'] != manifest['version']
        or type(package['protocolVersion']) is not int or package['protocolVersion'] != 3
        or type(package['stateSchemaVersion']) is not int or package['stateSchemaVersion'] != 1
        or package['pythonMinimum'] != '3.11' or package['sourceCommit'] != manifest['sourceCommit']
        or not isinstance(package['files'], list) or len(package['files']) != len(PAYLOAD_FILES)):
        raise UpdateError('package-invalid')
    found = set()
    for entry in package['files']:
        if not isinstance(entry, dict) or set(entry) != {'path', 'bytes', 'sha256'} or not isinstance(entry['path'], str) or entry['path'] not in PAYLOAD_FILES or entry['path'] in found:
            raise UpdateError('package-invalid')
        name = entry['path']; found.add(name)
        if (type(entry['bytes']) is not int or entry['bytes'] != len(contents[name])
                or entry['sha256'] != hashlib.sha256(contents[name]).hexdigest()):
            raise UpdateError('package-invalid')
    version = re.search(rb'__version__\s*=\s*["\']([0-9]+\.[0-9]+\.[0-9]+)["\']', contents['anker_companion/__init__.py'])
    if version is None or version[1].decode() != manifest['version']:
        raise UpdateError('package-invalid')
    return contents


def _plain_path(path: Path, directory=False, missing=False):
    for parent in (path, *path.parents):
        try:
            details = parent.lstat()
        except FileNotFoundError:
            if missing or parent != path:
                continue
            raise UpdateError('path-unsafe') from None
        if stat.S_ISLNK(details.st_mode) or getattr(details, 'st_file_attributes', 0) & 0x400:
            raise UpdateError('path-unsafe')
    if not missing and (not path.is_dir() if directory else not path.is_file()):
        raise UpdateError('path-unsafe')


def _read_file(path: Path, limit: int) -> bytes:
    _plain_path(path)
    if path.stat().st_size > limit or path.stat().st_nlink != 1:
        raise UpdateError('stage-invalid')
    with path.open('rb') as source:
        result = source.read(limit + 1)
    if len(result) > limit:
        raise UpdateError('stage-invalid')
    return result


def _write_new(path: Path, content: bytes):
    _plain_path(path, missing=True)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    with os.fdopen(descriptor, 'wb') as output:
        output.write(content)
        output.flush(); os.fsync(output.fileno())


def _install_destination(base: Path):
    app = base / 'app'
    _plain_path(app, directory=True)
    # Pip and the source installer also touch the existing isolated runtime.
    # Inspect it without following links before permitting either operation.
    for folder, directories, files in os.walk(app, followlinks=False):
        for name in directories:
            _plain_path(Path(folder) / name, directory=True)
        for name in files:
            path = Path(folder) / name
            _plain_path(path)
            if path.stat().st_nlink != 1:
                raise UpdateError('path-unsafe')
    for name in PAYLOAD_FILES | {'package-manifest.json'}:
        _plain_path(app / name, missing=True)


def _process_filetime():
    if sys.platform != 'win32':
        raise UpdateError('handoff-unavailable')
    import ctypes
    from ctypes import wintypes
    creation, exit_, kernel, user = (wintypes.FILETIME() for _ in range(4))
    api = ctypes.WinDLL('kernel32', use_last_error=True)
    api.GetCurrentProcess.restype = wintypes.HANDLE
    api.GetProcessTimes.argtypes = [wintypes.HANDLE, *([ctypes.POINTER(wintypes.FILETIME)] * 4)]
    api.GetProcessTimes.restype = wintypes.BOOL
    if not api.GetProcessTimes(api.GetCurrentProcess(), *[ctypes.byref(value) for value in (creation, exit_, kernel, user)]):
        raise UpdateError('handoff-unavailable')
    return (creation.dwHighDateTime << 32) | creation.dwLowDateTime


def _operation(function):
    def call(self, *args, **kwargs):
        if not self._lock.acquire(blocking=False):
            raise UpdateError('busy')
        try:
            if self._disposed:
                raise UpdateError('updater-closed')
            return function(self, *args, **kwargs)
        except UpdateError:
            raise
        except Exception:
            raise UpdateError('stage-invalid') from None
        finally:
            self._lock.release()
    return call


def _fixed_failures(function):
    def call(*args, **kwargs):
        try:
            return function(*args, **kwargs)
        except UpdateError:
            raise
        except Exception:
            raise UpdateError('stage-invalid') from None
    return call


class UpdateManager:
    def __init__(self, base_dir=None, installed_version=__version__, fetch=None, clock=time.time):
        local = os.environ.get('LOCALAPPDATA')
        self.base = Path(base_dir).absolute() if base_dir is not None else Path(local).absolute() / 'AnkerPcCompanion' if local and Path(local).is_absolute() else None
        self.installed_version, self.fetch, self.clock = installed_version, fetch or _http_get, clock
        self._candidate = None
        self._last_auto = None
        self._lock = threading.RLock()
        self._disposed = False
        self._handoff = None

    @_operation
    def check(self, automatic=False, auto_checks_enabled=False):
        if automatic:
            if auto_checks_enabled is not True:
                return {'status': 'disabled'}
            if self._last_auto is not None and self.clock() - self._last_auto < 6 * 3600:
                return {'status': 'not-due'}
            self._last_auto = self.clock()
        self._candidate = None
        try:
            raw = self.fetch(CHANNEL_URL, MAX_CHANNEL)
            manifest = verify_channel(raw, self.installed_version, self.clock())
            self._candidate = (raw, manifest)
            return {'status': 'available', 'version': manifest['version'], 'bytes': manifest['bytes']}
        except UpdateError as error:
            return {'status': 'current' if error.code == 'not-newer' else 'unavailable', 'reason': error.code}
        except Exception:
            return {'status': 'unavailable', 'reason': 'network-unavailable'}

    def _stage(self, stage_id):
        if self.base is None or not isinstance(stage_id, str) or not re.fullmatch(r'stage-[a-f0-9]{32}', stage_id):
            raise UpdateError('stage-invalid')
        path = self.base / 'updates' / stage_id
        _plain_path(path, directory=True)
        return path

    @_operation
    def download(self):
        if self.base is None:
            raise UpdateError('path-unsafe')
        if self._candidate is None:
            raise UpdateError('check-required')
        channel, _ = self._candidate
        manifest = verify_channel(channel, self.installed_version, self.clock())
        try:
            archive = self.fetch(manifest['url'], MAX_ARCHIVE)
            contents = verify_archive(archive, manifest)
            updates = self.base / 'updates'
            _plain_path(updates, missing=True)
            updates.mkdir(parents=True, exist_ok=True, mode=0o700)
            _plain_path(updates, directory=True)
            stage = updates / ('stage-' + uuid4().hex)
            stage.mkdir(mode=0o700)
            package = stage / 'package'
            package.mkdir(mode=0o700)
            (package / 'anker_companion').mkdir(mode=0o700)
            _write_new(stage / 'channel.json', channel)
            _write_new(stage / 'archive.zip', archive)
            for name, content in contents.items():
                _write_new(package / name, content)
            return {'status': 'staged', 'version': manifest['version'], 'stageId': stage.name}
        except UpdateError:
            raise
        except Exception:
            raise UpdateError('stage-invalid') from None

    @_operation
    def verify_stage(self, stage_id):
        try:
            stage = self._stage(stage_id)
            if {entry.name for entry in stage.iterdir()} != {'package', 'channel.json', 'archive.zip'}:
                raise UpdateError('stage-invalid')
            channel = _read_file(stage / 'channel.json', MAX_CHANNEL)
            manifest = verify_channel(channel, self.installed_version, self.clock())
            contents = verify_archive(_read_file(stage / 'archive.zip', MAX_ARCHIVE), manifest)
            package = stage / 'package'
            _plain_path(package, directory=True)
            found = set()
            for folder, directories, files in os.walk(package, followlinks=False):
                for name in directories:
                    item = Path(folder) / name
                    _plain_path(item, directory=True)
                    if item.relative_to(package).as_posix() != 'anker_companion':
                        raise UpdateError('stage-invalid')
                for name in files:
                    item = Path(folder) / name
                    relative = item.relative_to(package).as_posix()
                    if relative not in contents or _read_file(item, MAX_FILE) != contents[relative]:
                        raise UpdateError('stage-invalid')
                    found.add(relative)
            if found != set(contents):
                raise UpdateError('stage-invalid')
            return manifest, stage
        except UpdateError:
            raise
        except Exception:
            raise UpdateError('stage-invalid') from None

    @_operation
    def prepare_install(self, stage_id, confirmed=False):
        if confirmed is not True:
            raise UpdateError('confirmation-required')
        manifest, stage = self.verify_stage(stage_id)
        try:
            if self._handoff is not None and self._handoff[0].poll() is None:
                raise UpdateError('busy')
            app = self.base / 'app'
            if Path(__file__).absolute().parent.parent != app.absolute():
                raise UpdateError('handoff-unavailable')
            _install_destination(self.base)
            helper = app / 'update-helper.ps1'
            _plain_path(helper)
            executable = Path(sys.executable)
            _plain_path(executable)
            if executable.absolute() not in {(app / '.venv' / 'Scripts' / name).absolute() for name in ('python.exe', 'pythonw.exe')}:
                raise UpdateError('handoff-unavailable')
            started = _process_filetime()
            powershell = Path(os.environ.get('SystemRoot', r'C:\Windows')) / 'System32' / 'WindowsPowerShell' / 'v1.0' / 'powershell.exe'
            _plain_path(powershell)
            token = uuid4().hex
            ready = self.base / 'updates' / ('handoff-' + token + '.json')
            _plain_path(ready, missing=True)
            child = subprocess.Popen([str(powershell), '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(helper),
                '-StageRoot', str(stage.absolute()), '-CurrentProcessId', str(os.getpid()),
                '-CurrentStartFileTime', str(started), '-CurrentExecutable', str(executable.absolute()), '-HandoffToken', token],
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                close_fds=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
                env={name: value for name, value in os.environ.items() if name.upper() in {
                    'SYSTEMROOT', 'WINDIR', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
                    'TEMP', 'TMP', 'PATH', 'PATHEXT', 'COMSPEC', 'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY',
                    'SSL_CERT_FILE', 'SSL_CERT_DIR'}})
            self._handoff = (child, token)
            deadline = time.monotonic() + 8
            while not ready.exists():
                if child.poll() is not None or time.monotonic() >= deadline:
                    raise UpdateError('handoff-unavailable')
                time.sleep(.05)
            proof = _json(_read_file(ready, 4096), 4096)
            if proof != {'status': 'ready', 'stageId': stage_id, 'processId': os.getpid(), 'helperPid': child.pid, 'startFileTime': str(started), 'token': token}:
                raise UpdateError('handoff-unavailable')
            return {'status': 'handoff-ready', 'version': manifest['version'], 'stageId': stage_id}
        except UpdateError:
            raise
        except Exception:
            raise UpdateError('handoff-unavailable') from None

    @_fixed_failures
    def dispose(self, cancel_handoff=True):
        # Reset waits for the bounded active operation before deleting any stage.
        with self._lock:
            self._disposed = True
            self._candidate = None
            if cancel_handoff and self._handoff is not None:
                child, token = self._handoff
                if child.poll() is None:
                    cancel = self.base / 'updates' / ('cancel-' + token + '.json')
                    if not cancel.exists():
                        _write_new(cancel, b'{"status":"cancelled"}')
                    try:
                        child.wait(timeout=35)
                    except subprocess.TimeoutExpired:
                        raise UpdateError('busy') from None
                self._handoff = None

    @_fixed_failures
    def clear_staging(self):
        with self._lock:
            if not self._disposed:
                raise UpdateError('busy')
            if self._handoff is not None and self._handoff[0].poll() is None:
                raise UpdateError('busy')
            if self.base is None:
                raise UpdateError('path-unsafe')
            updates = self.base / 'updates'
            if not updates.exists():
                _plain_path(updates, missing=True)
                return {'status': 'cleared'}
            _plain_path(updates, directory=True)
            files, folders = [], []
            allowed = {'channel.json', 'archive.zip', 'package/package-manifest.json', *(f'package/{name}' for name in PAYLOAD_FILES)}
            # Preflight the whole owned tree before the first unlink; never follow
            # links or delete a previously unknown user/program directory.
            for entry in updates.iterdir():
                if re.fullmatch(r'(?:handoff|cancel)-[a-f0-9]{32}\.json', entry.name) or re.fullmatch(r'install-result-[a-f0-9]{32}\.tmp', entry.name) or entry.name == 'install-result.json':
                    _plain_path(entry); files.append(entry); continue
                if not re.fullmatch(r'stage-[a-f0-9]{32}', entry.name):
                    raise UpdateError('path-unsafe')
                _plain_path(entry, directory=True)
                for folder, directories, names in os.walk(entry, followlinks=False):
                    for name in directories:
                        path = Path(folder) / name
                        _plain_path(path, directory=True)
                        if path.relative_to(entry).as_posix() not in ('package', 'package/anker_companion'):
                            raise UpdateError('path-unsafe')
                        folders.append(path)
                    for name in names:
                        path = Path(folder) / name
                        _plain_path(path)
                        if path.relative_to(entry).as_posix() not in allowed:
                            raise UpdateError('path-unsafe')
                        files.append(path)
                folders.append(entry)
            try:
                for path in files:
                    _plain_path(path)
                    path.unlink()
                for path in sorted(folders, key=lambda item: len(item.parts), reverse=True):
                    _plain_path(path, directory=True)
                    path.rmdir()
                _plain_path(updates, directory=True)
                updates.rmdir()
            except UpdateError:
                raise
            except Exception:
                raise UpdateError('stage-invalid') from None
            return {'status': 'cleared'}


@_fixed_failures
def verify_staged_install(stage_root: str):
    """Called by the installed helper using the already trusted installed module."""
    manager = UpdateManager()
    stage = Path(stage_root).absolute()
    if manager.base is None or stage.parent != (manager.base / 'updates').absolute():
        raise UpdateError('stage-invalid')
    manifest, _ = manager.verify_stage(stage.name)
    _install_destination(manager.base)
    return {'status': 'verified', 'version': manifest['version']}
