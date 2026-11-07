// Tests for the credential disclosure in URL / logs probe
// (coverage row #41 [High], phase 82).
// No network, no lab needed — pure URL + HTML inspection.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeCredentialDisclosure,
  isSecretLike,
  maskCredential,
  extractCredentialParams,
  isPlaceholder,
  extractBodyCredentials,
  isTargetEmittedTarget,
  TARGET_EMITTED_SOURCES,
  PASSWORD_PARAM_NAMES,
  SECRET_PARAM_NAMES,
} from './credentialDisclosure.js';
import { verifyFindings } from '../verifier.js';

const PAGE = 'http://lab.local/app/index.html';
const ORIGIN = 'http://lab.local';

// Token fixtures are built by concatenation, never as single
// literals — a single high-entropy literal trips GitHub push
// protection (GH013). Password fixtures are short obvious
// synthetics (hunter2-style).
const KEY20 = 'AKIA' + 'IOSFODNN7' + 'EXAMPLE';
const TOK16 = 'a1b2c3d4' + 'e5f6a7b8';
// Scanner filler values, built by concatenation like the other
// fixtures — obvious synthetics, never real credentials.
const DM_USER = 'dmprobe' + '1_ab12';
const DM_PASS = 'dmprobe' + '2_cd34';
const DM_LOGIN = 'dmprobe' + '3_ef56';
const DM_TOKEN = 'dmprobe' + '4_7890';
const HTML_CLEAN = '<html><head><script src="/app.js"></script></head><body></body></html>';
const HTML_PRE =
  '<html><body><pre>2026-11-07 login failed\npassword: hunter2\nuser: admin</pre></body></html>';
const HTML_INPUT =
  '<html><body><form><input type="password" name="password" value="hunter2">' +
  '<input type="text" name="user" value="admin"></form></body></html>';
const HTML_PLACEHOLDER =
  '<html><body><pre>password: ***\napi_key: redacted</pre></body></html>';
const HTML_SCRIPT =
  '<html><head><script>const api_key = "' + KEY20 + '";</script></head>' +
  '<body>welcome</body></html>';

describe('isSecretLike', () => {
  it('accepts a 20-char AWS-style key', () => {
    assert.equal(isSecretLike(KEY20), true);
  });
  it('accepts a 16-char mixed token', () => {
    assert.equal(isSecretLike(TOK16), true);
  });
  it('accepts exactly 8 chars', () => {
    assert.equal(isSecretLike('Ab3dEf6h'), true);
  });
  it('rejects short values', () => {
    assert.equal(isSecretLike('none'), false);
    assert.equal(isSecretLike('test'), false);
    assert.equal(isSecretLike('abc'), false);
    assert.equal(isSecretLike('Ab3dEf6'), false);
  });
  it('rejects values with spaces or non-token characters', () => {
    assert.equal(isSecretLike('hello world 123456'), false);
    assert.equal(isSecretLike('abc123<>def4567890'), false);
  });
});

describe('maskCredential', () => {
  it('shows first 4 + last 2 chars and the length, never the full value', () => {
    assert.equal(maskCredential(KEY20), 'AKIA…LE (20 chars)');
    assert.ok(!maskCredential(KEY20).includes(KEY20.slice(4, 18)));
  });
});

describe('extractCredentialParams', () => {
  it('matches all four password param names case-insensitively', () => {
    for (const name of PASSWORD_PARAM_NAMES) {
      const found = extractCredentialParams(`${ORIGIN}/x?${name}=hunter2`);
      assert.equal(found.length, 1, name);
      assert.equal(found[0].kind, 'password');
    }
    assert.equal(extractCredentialParams(`${ORIGIN}/x?PASSWORD=hunter2`).length, 1);
    assert.equal(extractCredentialParams(`${ORIGIN}/x?Pass=hunter2`).length, 1);
  });
  it('matches all seven secret/key param names case-insensitively', () => {
    for (const name of SECRET_PARAM_NAMES) {
      const found = extractCredentialParams(`${ORIGIN}/x?${name}=${KEY20}`);
      assert.equal(found.length, 1, name);
      assert.equal(found[0].kind, 'secret');
    }
    assert.equal(extractCredentialParams(`${ORIGIN}/x?API_KEY=${KEY20}`).length, 1);
    assert.equal(extractCredentialParams(`${ORIGIN}/x?Client_Secret=${KEY20}`).length, 1);
  });
  it('ignores non-credential params including CSRF/session/token/auth/user', () => {
    const found = extractCredentialParams(
      `${ORIGIN}/x?page=2&id=12&csrf_token=${KEY20}&_token=${KEY20}&authenticity_token=${KEY20}` +
      `&token=${KEY20}&auth=${KEY20}&user=admin&username=admin&email=a@b.c&PHPSESSID=${KEY20}&sid=${KEY20}`
    );
    assert.deepEqual(found, []);
  });
  it('extracts ;password= path params', () => {
    const found = extractCredentialParams(`${ORIGIN}/app;password=hunter2/home`);
    assert.equal(found.length, 1);
    assert.equal(found[0].param, 'password');
    assert.equal(found[0].value, 'hunter2');
    assert.equal(found[0].kind, 'password');
  });
  it('ignores params in the fragment (never sent to the server)', () => {
    assert.deepEqual(extractCredentialParams(`${ORIGIN}/x#password=hunter2`), []);
  });
  it('returns [] for a malformed URL', () => {
    assert.deepEqual(extractCredentialParams('not-a-url'), []);
  });
});

describe('isPlaceholder', () => {
  it('treats stars, x-runs, null, undefined, redacted as placeholders', () => {
    for (const v of ['***', '****', 'xxx', 'xxxx', 'null', 'undefined', 'redacted', 'NULL', '***']) {
      assert.equal(isPlaceholder(v), true, v);
    }
  });
  it('treats real values as non-placeholders', () => {
    assert.equal(isPlaceholder('hunter2'), false);
    assert.equal(isPlaceholder(KEY20), false);
  });
});

describe('extractBodyCredentials', () => {
  it('finds password: hunter2 in a <pre> block', () => {
    const found = extractBodyCredentials(HTML_PRE);
    assert.equal(found.length, 1);
    assert.equal(found[0].param, 'password');
    assert.equal(found[0].value, 'hunter2');
  });
  it('finds api_key = KEY in a log-like line', () => {
    const html = `<html><body><pre>2026-11-07T10:00:00Z INFO api_key = ${KEY20}</pre></body></html>`;
    const found = extractBodyCredentials(html);
    assert.equal(found.length, 1);
    assert.equal(found[0].param, 'api_key');
    assert.equal(found[0].value, KEY20);
  });
  it('does not fire on an <input type="password" value="..."> form field', () => {
    assert.deepEqual(extractBodyCredentials(HTML_INPUT), []);
  });
  it('does not fire on placeholder values', () => {
    assert.deepEqual(extractBodyCredentials(HTML_PLACEHOLDER), []);
  });
  it('does not fire on secrets inside <script> blocks (secrets-in-js surface)', () => {
    assert.deepEqual(extractBodyCredentials(HTML_SCRIPT), []);
  });
  it('returns [] with no html or an empty body', () => {
    assert.deepEqual(extractBodyCredentials(''), []);
    assert.deepEqual(extractBodyCredentials(HTML_CLEAN), []);
  });
});

describe('probeCredentialDisclosure', () => {
  it('returns [] on clean URLs', () => {
    const findings = probeCredentialDisclosure(PAGE, [`${ORIGIN}/x?page=2`, `${ORIGIN}/y?id=12`], {});
    assert.deepEqual(findings, []);
  });
  it('fires on a password param in the page URL — any non-empty value, even short', () => {
    const findings = probeCredentialDisclosure(`${ORIGIN}/app?password=hunter2`, [], {});
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'credential_disclosure');
    assert.equal(f.severity, 'high');
    assert.equal(f.parameter, 'password');
    assert.ok(f.title.includes('password'), f.title);
    assert.ok(f.evidence.request.includes(`${ORIGIN}/app?password=`));
    assert.ok(!f.evidence.response.includes('hunter2'), 'full value must never be published');
    assert.equal(f.evidence.signalCorrelated, true);
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
    // Even a 1-char password fires; an empty value does not.
    assert.equal(probeCredentialDisclosure(`${ORIGIN}/app?password=x`, [], {}).length, 1);
    assert.deepEqual(probeCredentialDisclosure(`${ORIGIN}/app?password=`, [], {}), []);
  });
  it('fires on a secret param with a token-like value', () => {
    const findings = probeCredentialDisclosure(`${ORIGIN}/app?api_key=${KEY20}`, [], {});
    assert.equal(findings.length, 1);
    assert.equal(findings[0].parameter, 'api_key');
    assert.ok(!findings[0].evidence.response.includes(KEY20), 'full key must never be published');
  });
  it('does not fire on placeholder secret values', () => {
    const findings = probeCredentialDisclosure(
      `${ORIGIN}/app?secret=none&api_key=test&access_token=abc`,
      [],
      {}
    );
    assert.deepEqual(findings, []);
  });
  it('fires once per param (two params → two findings)', () => {
    const findings = probeCredentialDisclosure(
      `${ORIGIN}/app?password=hunter2&api_key=${KEY20}`,
      [],
      {}
    );
    assert.equal(findings.length, 2);
    assert.ok(findings.some((f) => f.parameter === 'password'));
    assert.ok(findings.some((f) => f.parameter === 'api_key'));
  });
  it('dedupes the same url+param across page and targets', () => {
    const url = `${ORIGIN}/app?password=hunter2`;
    const findings = probeCredentialDisclosure(url, [url, url], {});
    assert.equal(findings.length, 1);
  });
  it('fires on a ;password= path param', () => {
    const findings = probeCredentialDisclosure(`${ORIGIN}/app;password=hunter2/home`, [], {});
    assert.equal(findings.length, 1);
    assert.equal(findings[0].parameter, 'password');
  });
  it('does not fire on token/auth/user/csrf/session params', () => {
    const findings = probeCredentialDisclosure(
      `${ORIGIN}/app?token=${KEY20}&auth=${KEY20}&user=admin&csrf_token=${KEY20}&PHPSESSID=${KEY20}`,
      [],
      {}
    );
    assert.deepEqual(findings, []);
  });
  it('fires the body variant when the page echoes a credential, URL-only without html', () => {
    const withHtml = probeCredentialDisclosure(PAGE, [], { html: HTML_PRE });
    assert.equal(withHtml.length, 1);
    assert.equal(withHtml[0].parameter, 'password');
    assert.ok(withHtml[0].title.includes('page body'), withHtml[0].title);
    assert.ok(!withHtml[0].evidence.response.includes('hunter2'), 'full value must never be published');
    const { confirmed } = verifyFindings(withHtml);
    assert.equal(confirmed.length, 1);
    const noHtml = probeCredentialDisclosure(PAGE, [], {});
    assert.deepEqual(noHtml, []);
  });
  it('caps URL findings at 5', () => {
    const targets = [];
    for (let i = 0; i < 6; i += 1) targets.push(`${ORIGIN}/p${i}?password=hunter2`);
    const findings = probeCredentialDisclosure(PAGE, targets, {});
    assert.equal(findings.length, 5);
  });
  it('skips the body half when the landing page is a log file (#180 surface)', () => {
    const findings = probeCredentialDisclosure(`${ORIGIN}/app.log`, [], { html: HTML_PRE });
    assert.deepEqual(findings, []);
    const viewer = probeCredentialDisclosure(`${ORIGIN}/logs`, [], { html: HTML_PRE });
    assert.deepEqual(viewer, []);
  });
  it('returns [] for an invalid page URL', () => {
    assert.deepEqual(probeCredentialDisclosure('not-a-url', [], {}), []);
  });
});

describe('probeCredentialDisclosure provenance (7 Nov 2026 FP fix)', () => {
  // The DVWA false positive: a POST login form's GET conversion carried
  // scanner filler values and fired as the 18th finding on proof hunt
  // h_d3c0deb50847. Synthesized URLs must never fire — only URLs the
  // target itself emits (links, GET form actions) can carry a real
  // disclosed credential.
  it('(a) does not fire on a synthesized GET target from a POST login form', () => {
    const target = {
      url: `${ORIGIN}/login.php?username=${DM_USER}&password=${DM_PASS}&Login=${DM_LOGIN}`,
      source: 'post-form',
    };
    assert.deepEqual(probeCredentialDisclosure(PAGE, [target], {}), []);
  });
  it('(d) does not fire on the DVWA-shape synthesized URL with scanner values', () => {
    const target = {
      url: `${ORIGIN}/login.php?username=${DM_USER}&password=${DM_PASS}&Login=${DM_LOGIN}&user_token=${DM_TOKEN}`,
      source: 'post-form',
    };
    assert.deepEqual(probeCredentialDisclosure(PAGE, [target], {}), []);
  });
  it('(b) fires on a real GET form action with a password param', () => {
    const target = { url: `${ORIGIN}/search?password=hunter2`, source: 'get-form' };
    const findings = probeCredentialDisclosure(PAGE, [target], {});
    assert.equal(findings.length, 1);
    assert.equal(findings[0].parameter, 'password');
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });
  it('(c) fires on a link URL carrying a password param', () => {
    const target = { url: `${ORIGIN}/reset?password=hunter2`, source: 'link' };
    const findings = probeCredentialDisclosure(PAGE, [target], {});
    assert.equal(findings.length, 1);
    assert.equal(findings[0].parameter, 'password');
  });
  it('does not fire on synthesized openapi / js-routes / standalone targets', () => {
    for (const source of ['openapi', 'js-routes', 'standalone', 'unknown']) {
      const target = { url: `${ORIGIN}/api?password=hunter2`, source };
      assert.deepEqual(probeCredentialDisclosure(PAGE, [target], {}), [], source);
    }
  });
  it('does not fire on a secret param in a synthesized post-form target', () => {
    const target = { url: `${ORIGIN}/login?api_key=${KEY20}`, source: 'post-form' };
    assert.deepEqual(probeCredentialDisclosure(PAGE, [target], {}), []);
  });
  it('bare-string targets still fire (backward compatibility)', () => {
    const findings = probeCredentialDisclosure(PAGE, [`${ORIGIN}/reset?password=hunter2`], {});
    assert.equal(findings.length, 1);
  });
  it('isTargetEmittedTarget admits only page/link/get-form sources', () => {
    assert.equal(isTargetEmittedTarget(`${ORIGIN}/x`), true);
    for (const source of ['page', 'link', 'get-form']) {
      assert.equal(isTargetEmittedTarget({ url: `${ORIGIN}/x`, source }), true, source);
    }
    for (const source of ['post-form', 'standalone', 'openapi', 'js-routes', 'unknown', '']) {
      assert.equal(isTargetEmittedTarget({ url: `${ORIGIN}/x`, source }), false, source);
    }
    assert.equal(isTargetEmittedTarget({ url: `${ORIGIN}/x` }), false);
    assert.equal(isTargetEmittedTarget(null), false);
    assert.deepEqual([...TARGET_EMITTED_SOURCES].sort(), ['get-form', 'link', 'page']);
  });
});
