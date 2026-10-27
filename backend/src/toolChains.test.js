// Intelligent tool chaining (zero-genuine lane, 27 Oct 2026).
//
// Asserted here:
//   - (b) A negative DB probe NEVER forbids a class: "no database
//     detected" renders as UNCONFIRMED with an instruction to probe
//     for one — the old "DO NOT suggest SQL injection" wording is
//     gone from the unconfirmed branch (the MongoDB-confirmed
//     branch keeps its wording: that is a positive detection).
//   - (a) DVWA's served login page fingerprints the app AND its
//     MySQL, even with no DB error observed; the prompt names DVWA,
//     the login-first order, and the wrong-app boundary.
//   - The DVWA tool chain opens with a login-form SQLi detection
//     probe; a non-DVWA target gets no such probe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { detectTechnologies, buildIntelligentPrompt, getToolChain } from './toolChains.js';

const DVWA_LOGIN_HTML = '<html><head><title>Login :: Damn Vulnerable Web Application (DVWA) v1.10 *Development*</title></head><body><form action="login.php" method="post"><label>Username</label><input name="username"></form></body></html>';
const PLAIN_HTML = '<html><head><title>Welcome</title></head><body><h1>Hello</h1></body></html>';

test('unconfirmed database never forbids SQL injection', () => {
  const detection = detectTechnologies({ server: 'Apache/2.4.25 (Debian)' }, PLAIN_HTML, 'https://example.com/');
  assert.equal(detection.hasDatabase, false);
  assert.equal(detection.database, null);
  const prompt = buildIntelligentPrompt(detection, 'https://example.com/', []);
  assert.equal(prompt.includes('DO NOT suggest SQL injection'), false);
  assert.ok(prompt.includes('unconfirmed'));
  assert.ok(prompt.includes('probe for a database'));
  assert.ok(prompt.includes('Never rule out a vuln class from a single negative probe'));
});

test('MongoDB-confirmed keeps its NoSQL-only wording', () => {
  const detection = detectTechnologies({}, '<html><body>MongoError: bad $ne operator</body></html>', 'https://example.com/');
  assert.equal(detection.database, 'mongodb');
  const prompt = buildIntelligentPrompt(detection, 'https://example.com/', []);
  assert.ok(prompt.includes('DO NOT suggest SQL injection tests'));
});

test('DVWA login page fingerprints the app and its MySQL', () => {
  const detection = detectTechnologies({ server: 'Apache/2.4.25 (Debian)' }, DVWA_LOGIN_HTML, 'http://172.17.0.1:3100/');
  assert.equal(detection.app, 'dvwa');
  assert.equal(detection.database, 'mysql');
  assert.equal(detection.hasDatabase, true);
  const prompt = buildIntelligentPrompt(detection, 'http://172.17.0.1:3100/', []);
  assert.ok(prompt.includes('This target is DVWA'));
  assert.ok(prompt.includes('log in first'));
  assert.ok(prompt.includes('SQL injection is the FIRST class'));
  assert.ok(prompt.includes('Never probe /rest/*'));
  assert.equal(prompt.includes('DO NOT suggest SQL injection'), false);
});

test('DVWA chain opens with a login-form SQLi detection probe', () => {
  const detection = detectTechnologies({ server: 'Apache/2.4.25 (Debian)' }, DVWA_LOGIN_HTML, 'http://172.17.0.1:3100/');
  const chain = getToolChain(detection, 'http://172.17.0.1:3100/');
  assert.ok(chain.length > 0);
  assert.equal(chain[0].tool, 'sqli');
  assert.ok(chain[0].command.includes('/login.php'));
  assert.ok(chain[0].command.includes('username='));
});

test('a non-DVWA target gets no DVWA login probe', () => {
  const detection = detectTechnologies({ server: 'nginx' }, PLAIN_HTML, 'https://example.com/');
  const chain = getToolChain(detection, 'https://example.com/');
  assert.equal(chain.some((c) => String(c.command || '').includes('/login.php')), false);
});
