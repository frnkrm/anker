#!/usr/bin/env python3
"""Offline authentication boundary tests. Only freshly generated fake RSA keys."""
from __future__ import annotations

import base64
from email.message import Message
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import types
import unittest
from unittest.mock import patch
import urllib.error
import urllib.parse
import urllib.request
from urllib.response import addinfourl

spec = importlib.util.spec_from_file_location('google_play_auth', Path(__file__).with_name('google-play-auth.py'))
auth = importlib.util.module_from_spec(spec)
spec.loader.exec_module(auth)


class Response:
    def __init__(self, value=None, *, raw=None, status=200, url=auth.TOKEN_URL):
        self.content = raw if raw is not None else json.dumps(value).encode()
        self.status, self.url = status, url
        self.read_sizes = []
    def geturl(self):
        return self.url
    def read(self, size):
        self.read_sizes.append(size)
        return self.content[:size]
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False


class Transport:
    def __init__(self, response=None, error=None):
        self.response, self.error = response, error
        self.calls = []
    def open(self, request, *, timeout):
        self.calls.append((request, timeout))
        if self.error:
            raise self.error
        return self.response


class AuthenticationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture_dir = tempfile.TemporaryDirectory(prefix='anker-fake-rsa-only-')
        cls.fake_key = Path(cls.fixture_dir.name) / 'test-key.pem'
        cls.public_key = Path(cls.fixture_dir.name) / 'test-public.pem'
        subprocess.run([auth.OPENSSL, 'genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:2048',
                        '-out', str(cls.fake_key)], check=True, capture_output=True, timeout=15)
        public = subprocess.run([auth.OPENSSL, 'pkey', '-in', str(cls.fake_key), '-pubout'],
                                check=True, capture_output=True, timeout=10).stdout
        cls.public_key.write_bytes(public)
        cls.pem = cls.fake_key.read_text()
    @classmethod
    def tearDownClass(cls):
        cls.fixture_dir.cleanup()
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='anker-auth-test-runner-')
        self.runner = Path(self.directory.name)
        self.output = self.runner / 'step-output'
        self.output.write_text('')
    def tearDown(self):
        self.directory.cleanup()
    def account(self, **changes):
        return {'type': 'service_account', 'client_email': 'tests@anker-tests.iam.gserviceaccount.com',
                'private_key': self.pem, 'token_uri': auth.TOKEN_URL, **changes}
    def raw(self, **changes):
        return json.dumps(self.account(**changes))
    def environment(self, **changes):
        return {'GITHUB_ACTIONS': 'true', 'RUNNER_TEMP': str(self.runner), 'GITHUB_OUTPUT': str(self.output),
                auth.SECRET_NAME: self.raw(), **changes}
    def token_response(self, **changes):
        return {'access_token': 'ya29.TEST_SECRET_TOKEN', 'token_type': 'Bearer', 'expires_in': 3599, **changes}
    def assertCode(self, expected, action):
        with self.assertRaises(auth.AuthError) as caught:
            action()
        self.assertEqual(expected, str(caught.exception))
    def assertNoTempKey(self):
        self.assertEqual([], list(self.runner.glob('anker-play-auth-*')))

    def test_only_required_service_account_fields_survive_validation(self):
        clean = auth.credentials(self.raw(sub='IGNORED', audience='IGNORED', scope='IGNORED', private_key_id='unused'))
        self.assertEqual({'client_email', 'private_key'}, set(clean))
        self.assertEqual(self.pem, clean['private_key'])

    def test_invalid_json_type_size_and_missing_fields_are_redacted(self):
        cases = ['', '{PRIVATE SECRET', '[]', 'null', self.raw(type='authorized_user'),
                 self.raw(private_key=None), self.raw(client_email='private@example.com'), 'X' * 65537]
        for raw in cases:
            with self.subTest(raw_kind=type(raw).__name__):
                with self.assertRaises(auth.AuthError) as caught:
                    auth.credentials(raw)
                self.assertNotIn('PRIVATE SECRET', str(caught.exception))
                self.assertNotIn('BEGIN PRIVATE KEY', str(caught.exception))

    def test_oauth_uri_is_pinned_and_legacy_uri_is_explicitly_unsupported(self):
        for uri in ['https://attacker.invalid/token', 'http://oauth2.googleapis.com/token',
                    'https://oauth2.googleapis.com/token?evil=1', 'https://accounts.google.com/o/oauth2/token', None]:
            self.assertCode('AUTH_TOKEN_URI_UNSUPPORTED', lambda: auth.credentials(self.raw(token_uri=uri)))

    def test_duplicate_credential_fields_are_rejected(self):
        raw = self.raw()[:-1] + ',"token_uri":"https://attacker.invalid/token"}'
        self.assertCode('AUTH_SECRET_JSON_INVALID', lambda: auth.credentials(raw))

    def test_client_email_and_key_format_cannot_inject_claims_or_arguments(self):
        for email in ['tests@anker-tests.iam.gserviceaccount.com\nsub=bad', 'a@evil.com', '', None]:
            self.assertCode('AUTH_SERVICE_ACCOUNT_EMAIL_INVALID', lambda: auth.credentials(self.raw(client_email=email)))
        for key in ['PRIVATE', '-----BEGIN PRIVATE KEY-----\n!bad!\n-----END PRIVATE KEY-----', None]:
            self.assertCode('AUTH_PRIVATE_KEY_FORMAT_INVALID', lambda: auth.credentials(self.raw(private_key=key)))

    def test_assertion_has_fixed_rs256_claims_and_real_signature(self):
        account = auth.credentials(self.raw(sub='not-used', scope='not-used'))
        assertion = auth.make_assertion(account, self.runner, now=1_700_000_000)
        header, claims, signature = assertion.split('.')
        decode = lambda value: json.loads(base64.urlsafe_b64decode(value + '=' * (-len(value) % 4)))
        self.assertEqual({'alg': 'RS256', 'typ': 'JWT'}, decode(header))
        self.assertEqual({'iss': account['client_email'], 'scope': auth.SCOPE, 'aud': auth.TOKEN_URL,
                          'iat': 1_700_000_000, 'exp': 1_700_000_600}, decode(claims))
        signed = self.runner / 'signature.bin'
        signed.write_bytes(base64.urlsafe_b64decode(signature + '=' * (-len(signature) % 4)))
        result = subprocess.run([auth.OPENSSL, 'dgst', '-sha256', '-verify', str(self.public_key), '-signature', str(signed)],
                                input=(header + '.' + claims).encode(), capture_output=True, timeout=10)
        self.assertEqual(0, result.returncode)
        self.assertNoTempKey()

    def test_key_file_and_directory_permissions_and_child_environment(self):
        seen = []
        def run(arguments, **kwargs):
            key = Path(arguments[arguments.index('-sign') + 1])
            self.assertEqual(0o600, stat.S_IMODE(key.stat().st_mode))
            self.assertEqual(0o700, stat.S_IMODE(key.parent.stat().st_mode))
            self.assertEqual(self.pem, key.read_text())
            self.assertNotIn(self.pem, str(arguments))
            self.assertNotIn(auth.SECRET_NAME, kwargs['env'])
            self.assertNotIn('OPENSSL_CONF', kwargs['env'])
            self.assertNotIn(b'PRIVATE KEY', kwargs['input'])
            self.assertEqual(10, kwargs['timeout'])
            seen.append(key)
            return subprocess.run(arguments, **kwargs)
        with patch.dict(os.environ, {auth.SECRET_NAME: 'PRIVATE_ENV_SHOULD_NOT_REACH_OPENSSL', 'OPENSSL_CONF': 'unsafe'}, clear=False):
            auth.make_assertion(auth.credentials(self.raw()), self.runner, now=1000, run=run)
        self.assertEqual(1, len(seen))
        self.assertFalse(seen[0].exists())
        self.assertFalse(seen[0].parent.exists())

    def test_openssl_failure_is_redacted_and_always_removes_key(self):
        def fail(*args, **kwargs):
            return types.SimpleNamespace(returncode=1, stdout=b'PRIVATE_KEY_LEAK', stderr=b'PRIVATE_JSON_LEAK')
        self.assertCode('AUTH_RSA_SIGNING_FAILED', lambda: auth.make_assertion(auth.credentials(self.raw()), self.runner, now=1000, run=fail))
        self.assertNoTempKey()

    def test_openssl_timeout_always_removes_key(self):
        def timeout(*args, **kwargs):
            raise subprocess.TimeoutExpired('PRIVATE_KEY_LEAK', 10)
        self.assertCode('AUTH_RSA_SIGNING_FAILED', lambda: auth.make_assertion(auth.credentials(self.raw()), self.runner, now=1000, run=timeout))
        self.assertNoTempKey()

    def test_non_rsa_signature_length_is_rejected(self):
        def wrong_algorithm(*args, **kwargs):
            return types.SimpleNamespace(returncode=0, stdout=b'x' * 72, stderr=b'')
        self.assertCode('AUTH_RSA_SIGNING_FAILED', lambda: auth.make_assertion(auth.credentials(self.raw()), self.runner, now=1000, run=wrong_algorithm))
        self.assertNoTempKey()

    def test_invalid_clock_never_creates_temp_key(self):
        for value in [-1, True, 1.2, '1000']:
            self.assertCode('AUTH_CLOCK_INVALID', lambda: auth.make_assertion(auth.credentials(self.raw()), self.runner, now=value))
        self.assertNoTempKey()

    def test_exchange_is_only_fixed_https_form_with_bounded_timeout(self):
        response = Response(self.token_response(scope=auth.SCOPE))
        transport = Transport(response)
        self.assertEqual('ya29.TEST_SECRET_TOKEN', auth.exchange('JWT_PRIVATE_ASSERTION', opener=transport))
        self.assertEqual(1, len(transport.calls))
        request, timeout = transport.calls[0]
        self.assertEqual(auth.TOKEN_URL, request.full_url)
        self.assertEqual('POST', request.get_method())
        self.assertEqual(30, timeout)
        self.assertEqual({'grant_type': [auth.GRANT], 'assertion': ['JWT_PRIVATE_ASSERTION']},
                         urllib.parse.parse_qs(request.data.decode()))
        self.assertEqual([65537], response.read_sizes)

    def test_redirect_is_not_followed_or_forwarded(self):
        calls = []
        class RedirectServer(urllib.request.HTTPSHandler):
            def https_open(self, request):
                calls.append(request.full_url)
                headers = Message(); headers['Location'] = 'https://attacker.invalid/steal-jwt'
                response = addinfourl(io.BytesIO(b'PRIVATE_ERROR_BODY'), headers, request.full_url, code=302)
                response.msg = 'Found'
                return response
        transport = urllib.request.build_opener(urllib.request.ProxyHandler({}), auth.NoRedirect(), RedirectServer())
        self.assertCode('AUTH_OAUTH_HTTP_ERROR', lambda: auth.exchange('PRIVATE_ASSERTION', opener=transport))
        self.assertEqual([auth.TOKEN_URL], calls)

    def test_http_error_body_and_jwt_never_become_error_messages(self):
        body = io.BytesIO(b'PRIVATE_JSON_KEY_ASSERTION_TOKEN')
        error = urllib.error.HTTPError(auth.TOKEN_URL, 403, 'PRIVATE_TOKEN', {}, body)
        self.assertCode('AUTH_OAUTH_HTTP_ERROR', lambda: auth.exchange('PRIVATE_ASSERTION', opener=Transport(error=error)))
        self.assertTrue(body.closed)

    def test_network_error_is_redacted(self):
        self.assertCode('AUTH_OAUTH_NETWORK_ERROR', lambda: auth.exchange('PRIVATE_ASSERTION', opener=Transport(error=OSError('PRIVATE_ASSERTION'))))

    def test_oversized_and_invalid_json_responses_are_rejected(self):
        self.assertCode('AUTH_OAUTH_RESPONSE_TOO_LARGE', lambda: auth.exchange('JWT', opener=Transport(Response(raw=b'x' * 65537))))
        self.assertCode('AUTH_OAUTH_RESPONSE_INVALID', lambda: auth.exchange('JWT', opener=Transport(Response(raw=b'{PRIVATE_TOKEN'))))
        self.assertCode('AUTH_OAUTH_TOKEN_TYPE_INVALID', lambda: auth.exchange('JWT', opener=Transport(Response([]))))

    def test_wrong_response_url_or_status_is_rejected(self):
        for response in [Response(self.token_response(), url='https://attacker.invalid'), Response(self.token_response(), status=201)]:
            self.assertCode('AUTH_OAUTH_RESPONSE_INVALID', lambda: auth.exchange('JWT', opener=Transport(response)))

    def test_token_type_expiry_scope_and_printable_boundaries(self):
        for value in ['bearer', 'MAC', '', None]:
            self.assertCode('AUTH_OAUTH_TOKEN_TYPE_INVALID', lambda: auth.exchange('JWT', opener=Transport(Response(self.token_response(token_type=value)))))
        for value in [None, True, 0, 3601, '3600']:
            self.assertCode('AUTH_OAUTH_EXPIRY_INVALID', lambda: auth.exchange('JWT', opener=Transport(Response(self.token_response(expires_in=value)))))
        self.assertCode('AUTH_OAUTH_SCOPE_MISMATCH', lambda: auth.exchange('JWT', opener=Transport(Response(self.token_response(scope='cloud-platform')))))
        for value in ['', 'x' * 8193, 'TOKEN\naccess_token=ATTACK', 'TOKEN\rINJECT', 'TOKEN SPACE', 'TOKEN\x00', 'TOKEN\u2028', None]:
            self.assertCode('AUTH_OAUTH_TOKEN_INVALID', lambda: auth.exchange('JWT', opener=Transport(Response(self.token_response(access_token=value)))))

    def test_output_is_masked_and_flushed_before_step_output(self):
        output = self.output
        class ObservedStream(io.StringIO):
            def flush(self):
                self.assertion = output.read_text()
                super().flush()
        stream = ObservedStream()
        auth.emit_token('TOKEN%0A%OTHER', self.output, stream)
        self.assertEqual('', stream.assertion)
        self.assertEqual('::add-mask::TOKEN%250A%25OTHER\n', stream.getvalue())
        self.assertEqual('access_token=TOKEN%0A%OTHER\n', self.output.read_text())

    def test_output_newline_injection_is_rejected_before_mask_or_write(self):
        for token in ['TOKEN\nother=INJECT', 'TOKEN\rINJECT', 'TOKEN\u2028INJECT']:
            stream = io.StringIO()
            self.assertCode('AUTH_OAUTH_TOKEN_INVALID', lambda: auth.emit_token(token, self.output, stream))
            self.assertEqual('', stream.getvalue())
            self.assertEqual('', self.output.read_text())

    def test_runner_and_output_paths_are_required_before_secret_read(self):
        environment = self.environment(GITHUB_ACTIONS='false')
        self.assertCode('AUTH_GITHUB_ACTIONS_REQUIRED', lambda: auth.run(environment, io.StringIO()))
        self.assertIn(auth.SECRET_NAME, environment)
        self.assertCode('AUTH_RUNNER_PATHS_MISSING', lambda: auth.runner_paths({'GITHUB_ACTIONS': 'true'}))
        outside = Path(self.fixture_dir.name) / 'outside'
        outside.write_text('')
        self.assertCode('AUTH_OUTPUT_OUTSIDE_RUNNER_TEMP', lambda: auth.runner_paths(self.environment(GITHUB_OUTPUT=str(outside))))
        symlink = self.runner / 'symlink-output'; symlink.symlink_to(self.output)
        self.assertCode('AUTH_RUNNER_PATHS_INVALID', lambda: auth.runner_paths(self.environment(GITHUB_OUTPUT=str(symlink))))

    def test_full_flow_only_uses_fake_key_mock_http_and_step_output(self):
        environment = self.environment()
        stream = io.StringIO()
        owner = self
        class ObservedTransport(Transport):
            def open(self, request, *, timeout):
                owner.assertNoTempKey()
                owner.assertNotIn(auth.SECRET_NAME, environment)
                return super().open(request, timeout=timeout)
        transport = ObservedTransport(Response(self.token_response()))
        auth.run(environment, stream, now=1_700_000_000, opener=transport)
        self.assertNotIn(auth.SECRET_NAME, environment)
        self.assertEqual('::add-mask::ya29.TEST_SECRET_TOKEN\n', stream.getvalue())
        self.assertEqual('access_token=ya29.TEST_SECRET_TOKEN\n', self.output.read_text())
        self.assertNotIn(self.pem, stream.getvalue())
        self.assertNotIn('PRIVATE KEY', self.output.read_text())
        self.assertNoTempKey()

    def test_http_failure_leaves_no_key_no_step_output_and_no_stdout(self):
        environment = self.environment(); stream = io.StringIO()
        transport = Transport(error=urllib.error.URLError('PRIVATE_TOKEN_BODY'))
        self.assertCode('AUTH_OAUTH_NETWORK_ERROR', lambda: auth.run(environment, stream, now=1000, opener=transport))
        self.assertNotIn(auth.SECRET_NAME, environment)
        self.assertEqual('', stream.getvalue())
        self.assertEqual('', self.output.read_text())
        self.assertNoTempKey()

    def test_cli_unexpected_errors_are_fixed_and_redacted(self):
        output, error = io.StringIO(), io.StringIO()
        with (patch.object(auth, 'run', side_effect=RuntimeError('PRIVATE_JSON_PRIVATE_KEY_TOKEN')),
              patch('sys.argv', ['google-play-auth.py', '--run']), patch('sys.stdout', output), patch('sys.stderr', error)):
            self.assertEqual(1, auth.main())
        self.assertEqual('', output.getvalue())
        self.assertEqual('::error::Google Play authentication stopped: AUTH_UNEXPECTED_ERROR\n', error.getvalue())


if __name__ == '__main__':
    unittest.main()
