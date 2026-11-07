// Known-app fingerprint (zero-genuine lane, 27 Oct 2026).
//
// Asserted here (pure helpers):
//   - (a) DVWA is detected from its own served pages: the login-page
//     title, and the /login.php path WITH a DVWA marker in the body —
//     the page wins over any tech guess, and a Juice Shop page is
//     never DVWA (and vice versa). The bare /login.php path alone is
//     NOT evidence: bWAPP logs in at /login.php too (7 Nov 2026,
//     h_ece75df668b2 was mislabelled DVWA on a bare path).
//   - (a2) bWAPP is detected from its own brand on the served page,
//     and a bWAPP page is never DVWA — including the live DB-error
//     body that was mislabelled ("Connection failed: Unknown
//     database 'bWAPP'" names the app).
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
const BWAPP_LOGIN_HTML = '<html><head><title>bWAPP - an extremely buggy web app !</title></head><body><div id="top"><a href="portal.php">bWAPP</a></div><form action="login.php" method="post"><label>Login</label><input name="login"><label>Password</label><input name="password" type="password"><input type="submit" value="Login"></form><div id="footer">bWAPP v2.2</div></body></html>';
// Live bytes served by the bWAPP lab when its DB is gone (7 Nov 2026):
// the login endpoint returns only this error string, HTTP 200.
const BWAPP_DB_ERROR = "Connection failed: Unknown database 'bWAPP'";
const JUICE_HTML = '<html><head><title>OWASP Juice Shop</title></head><body><div id="juice-shop">Welcome</div></body></html>';
const PLAIN_HTML = '<html><head><title>Welcome</title></head><body><h1>Hello</h1></body></html>';

// --- (a) fingerprint from the served page ---------------------------------

test('DVWA is detected from its login-page title', () => {
  const found = detectKnownApp({ url: 'http://172.17.0.1:3100/', html: DVWA_LOGIN_HTML });
  assert.equal(found && found.app, 'dvwa');
  assert.equal(found && found.confidence, 'high');
});

test('a bare /login.php path with no DVWA markers detects as no known app', () => {
  // 7 Nov 2026 regression (h_ece75df668b2): the bare path alone
  // mislabelled bWAPP as DVWA — bWAPP logs in at /login.php too.
  const found = detectKnownApp({ url: 'http://172.17.0.1:3300/login.php', html: PLAIN_HTML });
  assert.equal(found, null);
});

test('DVWA is still detected from /login.php WITH a DVWA marker in the body', () => {
  const found = detectKnownApp({ url: 'http://172.17.0.1:3100/login.php', html: '<html><body>DVWA login</body></html>' });
  assert.equal(found && found.app, 'dvwa');
  assert.equal(found && found.confidence, 'high');
});

// --- (a2) bWAPP ------------------------------------------------------------

test('bWAPP is detected from its own brand on the login page', () => {
  const found = detectKnownApp({ url: 'http://172.17.0.1:3300/login.php', html: BWAPP_LOGIN_HTML });
  assert.equal(found && found.app, 'bwapp');
  assert.equal(found && found.confidence, 'high');
  // The brand wins over the shared /login.php path, at any URL.
  assert.equal(detectKnownApp({ url: 'http://172.17.0.1:3300/', html: BWAPP_LOGIN_HTML }).app, 'bwapp');
});

test('the live bWAPP DB-error body is bWAPP, never DVWA', () => {
  // Exact bytes the lab served for hunt h_ece75df668b2 (DB gone):
  // "Connection failed: Unknown database 'bWAPP'" — names the app.
  const found = detectKnownApp({ url: 'http://172.17.0.1:3300/login.php', html: BWAPP_DB_ERROR });
  assert.equal(found && found.app, 'bwapp');
  assert.equal(found && found.confidence, 'high');
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

test('DVWA and Juice Shop paths are wrong-target on bWAPP, its own paths are not', () => {
  for (const p of ['/vulnerabilities/sqli/', '/security.php', '/setup.php', '/instructions.php', '/rest/user/login', '/api/Products', '/ftp/coupons_2013.md.bak', '/file-upload']) {
    assert.equal(isWrongTargetEndpoint('bwapp', p), true, p);
  }
  // /login.php is bWAPP's own login page — never wrong-target here.
  assert.equal(isWrongTargetEndpoint('bwapp', '/login.php'), false);
  assert.equal(isWrongTargetEndpoint('bwapp', 'http://172.17.0.1:3300/login.php'), false);
  for (const p of ['/portal.php', '/bugs/xss_1/', '/info.php', '/secret.php']) {
    assert.equal(isWrongTargetEndpoint('bwapp', p), false, p);
  }
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
  assert.equal(knownAppOf({ knownApp: { app: 'bwapp' } }), 'bwapp');
  assert.equal(knownAppOf({ recon: { knownApp: 'bwapp' } }), 'bwapp');
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
  const bwapp = knownAppSOMLines({ knownApp: 'bwapp' });
  assert.ok(bwapp.some((l) => l.includes('TARGET IS bWAPP')));
  assert.ok(bwapp.some((l) => l.includes('/bugs/')));
  assert.ok(bwapp.some((l) => l.includes('/vulnerabilities/*')));
});
