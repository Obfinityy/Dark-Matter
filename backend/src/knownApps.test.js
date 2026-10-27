// Known-app fingerprint (zero-genuine lane, 27 Oct 2026).
//
// Asserted here (pure helpers):
//   - (a) DVWA is detected from its own served pages: the login-page
//     title, and the /login.php path — the page wins over any tech
//     guess, and a Juice Shop page is never DVWA (and vice versa).
//   - (d) Juice Shop endpoints are wrong-target on DVWA (and DVWA
//     paths are wrong-target on Juice Shop); DVWA's own paths are
//     never wrong-target; free-text scanning finds the wrong paths
//     inside a shell command.
//   - knownAppOf reads every place recon may have recorded the app.
//   - The SOM lines name the app, the login state, and the boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectKnownApp,
  isWrongTargetEndpoint,
  findWrongTargetPaths,
  knownAppOf,
  dvwaLoginSpec,
  knownAppSOMLines,
} from './knownApps.js';

const DVWA_LOGIN_HTML = '<html><head><title>Login :: Damn Vulnerable Web Application (DVWA) v1.10 *Development*</title></head><body><form action="login.php" method="post"><label>Username</label><input name="username"><label>Password</label><input name="password" type="password"><input type="submit" value="Login"></form></body></html>';
const JUICE_HTML = '<html><head><title>OWASP Juice Shop</title></head><body><div id="juice-shop">Welcome</div></body></html>';
const PLAIN_HTML = '<html><head><title>Welcome</title></head><body><h1>Hello</h1></body></html>';

// --- (a) fingerprint from the served page ---------------------------------

test('DVWA is detected from its login-page title', () => {
  const found = detectKnownApp({ url: 'http://172.17.0.1:3100/', html: DVWA_LOGIN_HTML });
  assert.equal(found && found.app, 'dvwa');
  assert.equal(found && found.confidence, 'high');
});

test('DVWA is detected from the /login.php path alone', () => {
  const found = detectKnownApp({ url: 'http://172.17.0.1:3100/login.php', html: PLAIN_HTML });
  assert.equal(found && found.app, 'dvwa');
});

test('Juice Shop is detected from its title and never reads as DVWA', () => {
  const found = detectKnownApp({ url: 'http://172.17.0.1:3000/', html: JUICE_HTML });
  assert.equal(found && found.app, 'juice-shop');
  assert.equal(detectKnownApp({ url: 'http://172.17.0.1:3000/', html: JUICE_HTML }).app, 'juice-shop');
});

test('an unknown page detects as no known app', () => {
  assert.equal(detectKnownApp({ url: 'https://example.com/', html: PLAIN_HTML }), null);
  assert.equal(detectKnownApp({}), null);
});

// --- (d) wrong-target guard ------------------------------------------------

test('Juice Shop endpoints are wrong-target on DVWA', () => {
  for (const p of ['/rest/user/login', '/rest/admin/application-version', '/api/Products', '/ftp/coupons_2013.md.bak', '/file-upload', '/b2b/v2/orders']) {
    assert.equal(isWrongTargetEndpoint('dvwa', p), true, p);
  }
  assert.equal(isWrongTargetEndpoint('dvwa', 'http://172.17.0.1:3100/rest/user/login'), true);
});

test("DVWA's own paths are never wrong-target on DVWA", () => {
  for (const p of ['/login.php', '/index.php', '/security.php', '/vulnerabilities/sqli/', '/instructions.php']) {
    assert.equal(isWrongTargetEndpoint('dvwa', p), false, p);
  }
});

test('DVWA paths are wrong-target on Juice Shop', () => {
  assert.equal(isWrongTargetEndpoint('juice-shop', '/login.php'), true);
  assert.equal(isWrongTargetEndpoint('juice-shop', '/vulnerabilities/sqli/'), true);
  assert.equal(isWrongTargetEndpoint('juice-shop', '/rest/products/search'), false);
});

test('wrong paths are found inside a shell command', () => {
  const cmd = `curl -sk -X POST "http://172.17.0.1:3100/rest/user/login" -H "Content-Type: application/json" -d '{"email":"admin@juice-sh.op'"'"' OR 1=1--","password":"x"}' | head -c 2000`;
  assert.deepEqual(findWrongTargetPaths('dvwa', cmd), ['/rest/user/login']);
  assert.deepEqual(findWrongTargetPaths('dvwa', 'curl -sk "http://172.17.0.1:3100/login.php"'), []);
  assert.deepEqual(findWrongTargetPaths(null, cmd), []);
});

// --- knownAppOf + login spec + SOM lines ------------------------------------

test('knownAppOf reads meta.knownApp, meta.recon.knownApp, and the fingerprint', () => {
  assert.equal(knownAppOf({ knownApp: { app: 'dvwa' } }), 'dvwa');
  assert.equal(knownAppOf({ recon: { knownApp: 'juice-shop' } }), 'juice-shop');
  assert.equal(knownAppOf({ appFingerprint: { appType: 'dvwa' } }), 'dvwa');
  assert.equal(knownAppOf({ recon: { knownApp: 'dvwa' }, knownApp: { app: 'juice-shop' } }), 'juice-shop');
  assert.equal(knownAppOf({}), null);
  assert.equal(knownAppOf(null), null);
  assert.equal(knownAppOf({ appFingerprint: { appType: 'ecommerce' } }), null);
});

test('dvwaLoginSpec points at the lab login + security pages', () => {
  const spec = dvwaLoginSpec('http://172.17.0.1:3100/');
  assert.equal(spec.loginUrl, 'http://172.17.0.1:3100/login.php');
  assert.equal(spec.securityUrl, 'http://172.17.0.1:3100/security.php');
  assert.equal(spec.username, 'admin');
  assert.equal(typeof spec.password, 'string');
  assert.ok(spec.password.length > 0);
});

test('SOM lines name the app, the login state, and the wrong-app boundary', () => {
  const loggedOut = knownAppSOMLines({ knownApp: 'dvwa', auth: null });
  assert.ok(loggedOut.some((l) => l.includes('TARGET IS DVWA')));
  assert.ok(loggedOut.some((l) => l.includes('NOT LOGGED IN YET')));
  assert.ok(loggedOut.some((l) => l.includes('/rest/*')));
  const loggedIn = knownAppSOMLines({ knownApp: 'dvwa', auth: { dvwa: { loggedIn: true, securityLevel: 'low', verifiedAt: '2026-10-27T00:00:00.000Z' } } });
  assert.ok(loggedIn.some((l) => l.includes('LOGGED IN as admin, security level low')));
  const failed = knownAppSOMLines({ knownApp: 'dvwa', auth: { dvwa: { loggedIn: false, loginFailed: true } } });
  assert.ok(failed.some((l) => l.includes('LOGIN FAILED')));
  assert.deepEqual(knownAppSOMLines({ knownApp: null }), []);
});
