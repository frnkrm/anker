#!/usr/bin/env python3
"""Exchange the selected GitHub service-account secret for a Play-only OAuth token.

Explicit --run, GitHub Actions and runner-owned temporary/output locations are
required. No IAM impersonation, delegation, credential file export or API upload.
Only token_uri=https://oauth2.googleapis.com/token is supported; legacy
accounts.google.com/o/oauth2/token JSON fails with AUTH_TOKEN_URI_UNSUPPORTED.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

TOKEN_URL = 'https://oauth2.googleapis.com/token'
SCOPE = 'https://www.googleapis.com/auth/androidpublisher'
GRANT = 'urn:ietf:params:oauth:grant-type:jwt-bearer'
ASSERTION_LIFETIME = 600
MAX_JSON_BYTES = 65_536
MAX_TOKEN_LENGTH = 8_192
OPENSSL = '/usr/bin/openssl'
SECRET_NAME = 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'


class AuthError(Exception):
    """Fixed codes only; never include credentials, tokens or remote bodies."""


def need(value: bool, code: str) -> None:
    if not value:
        raise AuthError(code)


def credentials(raw: str) -> dict:
    need(isinstance(raw, str) and 0 < len(raw.encode('utf-8')) <= MAX_JSON_BYTES, 'AUTH_SECRET_MISSING_OR_TOO_LARGE')
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            need(key not in result, 'AUTH_SECRET_JSON_INVALID')
            result[key] = value
        return result
    try:
        value = json.loads(raw, object_pairs_hook=unique_object)
    except Exception:
        raise AuthError('AUTH_SECRET_JSON_INVALID') from None
    need(isinstance(value, dict) and value.get('type') == 'service_account', 'AUTH_SERVICE_ACCOUNT_REQUIRED')
    need(value.get('token_uri') == TOKEN_URL, 'AUTH_TOKEN_URI_UNSUPPORTED')
    email = value.get('client_email')
    need(isinstance(email, str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,126}@[A-Za-z0-9][A-Za-z0-9.-]{0,189}\.iam\.gserviceaccount\.com', email) is not None,
         'AUTH_SERVICE_ACCOUNT_EMAIL_INVALID')
    key = value.get('private_key')
    need(isinstance(key, str) and 100 <= len(key) <= 16_384 and re.fullmatch(
        r'-----BEGIN (?:RSA )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]+-----END (?:RSA )?PRIVATE KEY-----\r?\n?', key) is not None,
        'AUTH_PRIVATE_KEY_FORMAT_INVALID')
    # Return only fields used by the fixed JWT flow; unknown metadata never
    # becomes a claim, URL, algorithm, subject or command-line argument.
    return {'client_email': email, 'private_key': key}


def b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode('ascii').rstrip('=')


def valid_token(token: object) -> bool:
    return isinstance(token, str) and 1 <= len(token) <= MAX_TOKEN_LENGTH and all(0x21 <= ord(character) <= 0x7e for character in token)


def make_assertion(account: dict, runner_temp: Path, *, now: int | None = None,
                   run=subprocess.run) -> str:
    issued = int(time.time()) if now is None else now
    need(type(issued) is int and issued >= 0, 'AUTH_CLOCK_INVALID')
    header = {'alg': 'RS256', 'typ': 'JWT'}
    claims = {'iss': account['client_email'], 'scope': SCOPE, 'aud': TOKEN_URL,
              'iat': issued, 'exp': issued + ASSERTION_LIFETIME}
    encode = lambda value: b64url(json.dumps(value, separators=(',', ':'), sort_keys=True).encode('utf-8'))
    signing_input = (encode(header) + '.' + encode(claims)).encode('ascii')
    need(runner_temp.is_absolute() and runner_temp.is_dir(), 'AUTH_RUNNER_TEMP_INVALID')
    try:
        # This key exists only while OpenSSL signs. It is already removed before
        # any network request or GitHub output is attempted.
        with tempfile.TemporaryDirectory(prefix='anker-play-auth-', dir=runner_temp) as directory:
            parent = Path(directory)
            parent.chmod(0o700)
            key_path = parent / 'service-account.pem'
            descriptor = os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, 'w', encoding='ascii', newline='') as stream:
                stream.write(account['private_key'])
            key_path.chmod(0o600)
            need(stat.S_IMODE(parent.stat().st_mode) == 0o700 and stat.S_IMODE(key_path.stat().st_mode) == 0o600,
                 'AUTH_TEMP_PERMISSIONS_INVALID')
            result = run([OPENSSL, 'dgst', '-sha256', '-sign', str(key_path), '-sigopt', 'rsa_padding_mode:pkcs1'],
                         input=signing_input, capture_output=True, timeout=10,
                         env={'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C'})
            need(result.returncode == 0 and isinstance(result.stdout, bytes) and len(result.stdout) in (256, 384, 512),
                 'AUTH_RSA_SIGNING_FAILED')
            return signing_input.decode('ascii') + '.' + b64url(result.stdout)
    except AuthError:
        raise
    except Exception:
        raise AuthError('AUTH_RSA_SIGNING_FAILED') from None


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def exchange(assertion: str, *, opener=None) -> str:
    body = urllib.parse.urlencode({'grant_type': GRANT, 'assertion': assertion}).encode('ascii')
    request = urllib.request.Request(TOKEN_URL, data=body, method='POST',
                                     headers={'Content-Type': 'application/x-www-form-urlencoded',
                                              'Accept': 'application/json'})
    transport = opener if opener is not None else urllib.request.build_opener(NoRedirect())
    try:
        with transport.open(request, timeout=30) as response:
            need(response.geturl() == TOKEN_URL and response.status == 200, 'AUTH_OAUTH_RESPONSE_INVALID')
            content = response.read(MAX_JSON_BYTES + 1)
            need(len(content) <= MAX_JSON_BYTES, 'AUTH_OAUTH_RESPONSE_TOO_LARGE')
    except AuthError:
        raise
    except urllib.error.HTTPError as error:
        error.close()  # Never read or print remote error bodies, which may echo credentials.
        raise AuthError('AUTH_OAUTH_HTTP_ERROR') from None
    except Exception:
        raise AuthError('AUTH_OAUTH_NETWORK_ERROR') from None
    try:
        result = json.loads(content)
    except Exception:
        raise AuthError('AUTH_OAUTH_RESPONSE_INVALID') from None
    need(isinstance(result, dict) and result.get('token_type') == 'Bearer', 'AUTH_OAUTH_TOKEN_TYPE_INVALID')
    token = result.get('access_token')
    need(valid_token(token), 'AUTH_OAUTH_TOKEN_INVALID')
    need(type(result.get('expires_in')) is int and 1 <= result['expires_in'] <= 3600, 'AUTH_OAUTH_EXPIRY_INVALID')
    need('scope' not in result or result['scope'] == SCOPE, 'AUTH_OAUTH_SCOPE_MISMATCH')
    return token


def runner_paths(environment) -> tuple[Path, Path]:
    need(environment.get('GITHUB_ACTIONS') == 'true', 'AUTH_GITHUB_ACTIONS_REQUIRED')
    raw_temp, raw_output = environment.get('RUNNER_TEMP', ''), environment.get('GITHUB_OUTPUT', '')
    need(bool(raw_temp) and bool(raw_output), 'AUTH_RUNNER_PATHS_MISSING')
    temporary, output = Path(raw_temp), Path(raw_output)
    need(temporary.is_absolute() and temporary.is_dir() and output.is_absolute() and not output.is_symlink(),
         'AUTH_RUNNER_PATHS_INVALID')
    temporary = temporary.resolve()
    output = output.resolve()
    need(temporary in output.parents and output.is_file(), 'AUTH_OUTPUT_OUTSIDE_RUNNER_TEMP')
    return temporary, output


def emit_token(token: str, output: Path, stream) -> None:
    need(valid_token(token), 'AUTH_OAUTH_TOKEN_INVALID')
    # GitHub command escaping is required even though CR/LF tokens are rejected.
    escaped = token.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
    stream.write('::add-mask::' + escaped + '\n')
    stream.flush()  # Mask is registered before any output is written.
    try:
        descriptor = os.open(output, os.O_WRONLY | os.O_APPEND | os.O_NOFOLLOW)
        with os.fdopen(descriptor, 'w', encoding='ascii', newline='') as target:
            need(stat.S_ISREG(os.fstat(target.fileno()).st_mode), 'AUTH_OUTPUT_INVALID')
            target.write('access_token=' + token + '\n')
            target.flush()
    except AuthError:
        raise
    except Exception:
        raise AuthError('AUTH_OUTPUT_WRITE_FAILED') from None


def run(environment, stream, *, now: int | None = None, openssl_run=subprocess.run, opener=None) -> None:
    temporary, output = runner_paths(environment)
    raw = environment.pop(SECRET_NAME, '')
    account = credentials(raw)
    raw = None
    try:
        assertion = make_assertion(account, temporary, now=now, run=openssl_run)
    finally:
        account.clear()
    token = exchange(assertion, opener=opener)
    assertion = None
    emit_token(token, output, stream)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', action='store_true', required=True, help='Explicitly perform the authorized GitHub Actions OAuth exchange')
    parser.parse_args()
    try:
        run(os.environ, sys.stdout)
        return 0
    except AuthError as error:
        print('::error::Google Play authentication stopped: ' + str(error), file=sys.stderr)
    except Exception:
        print('::error::Google Play authentication stopped: AUTH_UNEXPECTED_ERROR', file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
