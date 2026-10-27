// HTTP error-page gate tests (27 Oct 2026, 404-verified audit).
//
// The live DVWA hunt's 5 false "verified" findings all carry a 404
// page in evidence.response — curl exits 0 on a 404, the 404 body
// contains the signal word "admin", and a 404 reproduces
// deterministically. The gate must reject error pages at every limb
// that could stamp verified.
import test from 'node:test';
import assert from 'node:assert/strict';

import { httpErrorStatus, isHttpErrorPage, assessContentRelevance } from './hunt-intel/differential.js';

// Real evidence excerpts from the live DVWA hunt h_830317bdc184
// (27 Oct 2026) — the exact strings the verifier stamped.
const APACHE_404_HEADERS = 'HTTP/1.1 404 Not Found\r\nDate: Tue, 27 Oct 2026 15:28:22 GMT\r\nServer: Apache/2.4.25 (Debian)\r\nContent-Length: 306\r\nContent-Type: text/html; charset=iso-8859-1\r\n\r\n<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">';
const BODY_ONLY_404 = '<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<html><head>\n<title>404 Not Found</title>\n</head><body>\n<h1>Not Found</h1>\n<p>The requested URL /rest/admin/application-configuration was not found on this server.</p>';
const OK_200 = 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"admin": true, "token": "abc"}';
const BODY_200 = '<html><head><title>Admin panel</title></head><body>Welcome admin</body></html>';

test('httpErrorStatus detects a 404 status line', () => {
  assert.equal(httpErrorStatus(APACHE_404_HEADERS), 404);
});

test('httpErrorStatus detects a body-only 404 page (title + Apache body)', () => {
  assert.equal(httpErrorStatus(BODY_ONLY_404), 404);
});

test('httpErrorStatus detects other error codes', () => {
  assert.equal(httpErrorStatus('HTTP/1.1 500 Internal Server Error\r\n\r\nerror'), 500);
  assert.equal(httpErrorStatus('<title>403 Forbidden</title>'), 403);
});

test('httpErrorStatus returns 0 for 200 responses', () => {
  assert.equal(httpErrorStatus(OK_200), 0);
  assert.equal(httpErrorStatus(BODY_200), 0);
  assert.equal(httpErrorStatus(''), 0);
  assert.equal(httpErrorStatus(null), 0);
});

test('isHttpErrorPage mirrors httpErrorStatus', () => {
  assert.equal(isHttpErrorPage(APACHE_404_HEADERS), true);
  assert.equal(isHttpErrorPage(OK_200), false);
});

test('assessContentRelevance rejects an error page even when it carries signal words', () => {
  const rel = assessContentRelevance({
    command: "curl -sk 'http://172.17.0.1:3100/rest/admin/application-version'",
    target: 'http://172.17.0.1:3100/',
    output: BODY_ONLY_404,
    baselines: [],
  });
  assert.equal(rel.relevant, false);
  assert.match(rel.reason, /404/);
});

test('assessContentRelevance still accepts a real 200 page with signals', () => {
  const rel = assessContentRelevance({
    command: "curl -sk 'http://172.17.0.1:3100/admin'",
    target: 'http://172.17.0.1:3100/',
    output: BODY_200,
    baselines: [],
  });
  assert.equal(rel.relevant, true);
});
