// Test for Lane AI (24 Oct 2026) — agent credential vault + persona.
//
// Asserts the security invariants, not just the happy path:
//   - passwords + inbox tokens live in exactly one file (0600,
//     atomic write) and in NO serialized form anywhere else;
//   - the public serializer strips both secrets;
//   - handle-only references are safe to print;
//   - the record scrubber redacts exact secrets and nothing else.
//
// Run: node backend/scripts/test-agent-credentials.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-lane-ai-vault-'));
process.env.DATA_DIR = tmp;

const {
  generatePassword,
  generatePersonaUsername,
  hostOf,
  makeHandle,
  saveCredential,
  getCredential,
  publicCredential,
  listCredentials,
  revealCredential,
  markVerified,
  touchCredential,
  replaceCredential,
  scrubSecrets,
  vaultFile,
} = await import('../src/credentials.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

// ---- password generation ---------------------------------------------------
const pw = generatePassword();
check('password: default length 20', pw.length === 20);
check('password: has lower, upper, digit, symbol',
  /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[!@#$%^&*()\-_=+]/.test(pw));
check('password: two calls differ', generatePassword() !== generatePassword());
check('password: min length enforced at 16', generatePassword(4).length === 16);

// ---- persona + handles ------------------------------------------------------
const user = generatePersonaUsername();
check('persona username: obfinity-<8>', /^obfinity-[a-z0-9]{8}$/.test(user));
check('hostOf: url', hostOf('https://open.ys7.com/view/x') === 'open.ys7.com');
check('hostOf: bare host', hostOf('example.com') === 'example.com');
const handle = makeHandle('https://open.ys7.com');
check('handle: cred:<host>:<12 hex>', /^cred:open\.ys7\.com:[0-9a-f]{12}$/.test(handle));

// ---- vault round-trip -------------------------------------------------------
const rec = saveCredential({
  site: 'https://open.ys7.com',
  username: 'obfinity-test01',
  password: 'VaultSecret123!x',
  huntId: 'h_test',
  inbox: { provider: 'mail.tm', address: 'obfinity-x@maxxspace.com', token: 'TOKEN-SECRET-123' },
});
check('vault: handle issued', /^cred:open\.ys7\.com:[0-9a-f]{12}$/.test(rec.handle));
check('vault: get round-trips password (server-side only)', getCredential(rec.handle).password === 'VaultSecret123!x');
const pub = publicCredential(rec);
check('public: no password', !('password' in pub) && !JSON.stringify(pub).includes('VaultSecret123'));
check('public: no inbox token', !('token' in pub) && !JSON.stringify(pub).includes('TOKEN-SECRET-123'));
check('public: keeps handle/site/username/inbox address',
  pub.handle === rec.handle && pub.site === 'https://open.ys7.com' && pub.username === 'obfinity-test01' && pub.inboxAddress === 'obfinity-x@maxxspace.com');
const listed = listCredentials();
check('list: public form only', listed.length === 1 && !JSON.stringify(listed).includes('VaultSecret123') && !JSON.stringify(listed).includes('TOKEN-SECRET-123'));
check('reveal: returns password on explicit request', revealCredential(rec.handle).password === 'VaultSecret123!x');
check('reveal: unknown handle -> null', revealCredential('cred:nope:000000000000') === null);
check('markVerified + touch', markVerified(rec.handle) && touchCredential(rec.handle) && getCredential(rec.handle).verified === true && !!getCredential(rec.handle).lastUsedAt);
const rotated = replaceCredential(rec.handle, 'RotatedPass456!y');
check('replace: password swapped, handle kept', rotated.password === 'RotatedPass456!y' && rotated.handle === rec.handle);

// ---- file permissions -------------------------------------------------------
const stat = fs.statSync(vaultFile());
check('vault file: mode 0600', (stat.mode & 0o777) === 0o600);
check('vault file: contains the secret (it is the one allowed place)',
  fs.readFileSync(vaultFile(), 'utf8').includes('RotatedPass456!y'));

// ---- scrubber ---------------------------------------------------------------
check('scrub: exact password redacted', scrubSecrets('typed VaultSecret123!x here', ['VaultSecret123!x']) === 'typed [redacted] here');
check('scrub: code redacted everywhere', scrubSecrets('code 482917 then 482917', ['482917']) === 'code [redacted] then [redacted]');
check('scrub: short secrets (<4) NOT scrubbed (collision safety)', scrubSecrets('year 123', ['123']) === 'year 123');
check('scrub: ordinary text untouched', scrubSecrets('nothing secret here', ['zzz-no-match']) === 'nothing secret here');
check('scrub: empty safe', scrubSecrets('', ['x']) === '' && scrubSecrets(null, []) === '');

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
