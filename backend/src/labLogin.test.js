// Lab login-first (zero-genuine lane, 27 Oct 2026) — the human loop
// logs into DVWA BEFORE hunting its modules, deterministically, via
// the self-auth chain. Asserted here against a fake browser + fake
// vault (no network, no container, no Meta):
//   - needsLabLogin: only DVWA, only when not logged in, never after
//     a recorded login failure.
//   - happy path: login page opened in the visible browser, the DVWA
//     default vaulted, fields filled from the vault, Login clicked,
//     session verified from the served page, security set to low,
//     auth persisted to meta + recorded.
//   - login-not-verified: no Logout link on the post-login page —
//     an auth_block is recorded and meta.auth.dvwa.loginFailed is
//     set; the gate never retries it.
//   - security-not-set: login verified but the level-set fails —
//     the login still counts (partial), securityLevel 'not-set'.
//   - the password never appears in any recorded event or note.
import test from 'node:test';
import assert from 'node:assert/strict';
import { needsLabLogin, runLabLoginFirst } from './labLogin.js';
import { resolveClickTarget } from './guiTools.js';

const TARGET = 'http://172.17.0.1:3100/';
const LOGIN_SNAP = 'Page: Login :: Damn Vulnerable Web Application\nUsername\nPassword\nLogin';
const LOGGED_IN_SNAP = 'Page: Welcome :: Damn Vulnerable Web Application\nHome Instructions Setup Vulnerabilities\nLogout';
const SECURITY_SNAP = 'Page: DVWA Security\nSecurity Level\nlow medium high impossible\nSubmit';
const SECURITY_DONE_SNAP = 'Page: DVWA Security\nSecurity level set to low';
const SNAP = { url: TARGET, title: 'dvwa', text: 'dvwa', elements: [] };

function stubVault() {
  const store = new Map();
  let n = 0;
  return {
    saveCredential({ site, username, password, huntId }) {
      const handle = `cred:172.17.0.1:${String(++n).padStart(12, '0')}`;
      store.set(handle, { handle, site, username, password, huntId });
      return { handle, site, username };
    },
    getCredential(handle) {
      return store.get(handle) || null;
    },
    get size() {
      return store.size;
    },
  };
}

// A fake visible browser: snapshots change with the page the driver
// opened, exactly like the real DVWA flow (login -> welcome ->
// security -> security-done).
function stubDvwaGui({ verifyLogin = true, verifySecurity = true } = {}) {
  const calls = [];
  let stage = 'login';
  const snapFor = () => {
    if (stage === 'login') return { ok: true, observation: LOGIN_SNAP, snapshot: SNAP };
    if (stage === 'loggedin') return { ok: true, observation: verifyLogin ? LOGGED_IN_SNAP : 'Page: Login :: Damn Vulnerable Web Application\nUsername\nPassword\nLogin', snapshot: SNAP };
    if (stage === 'security') return { ok: true, observation: SECURITY_SNAP, snapshot: SNAP };
    return { ok: true, observation: verifySecurity ? SECURITY_DONE_SNAP : SECURITY_SNAP, snapshot: SNAP };
  };
  return {
    calls,
    open: async (h, url) => {
      calls.push(['open', url]);
      if (String(url).includes('/security.php')) stage = 'security';
      else if (String(url).includes('/login.php')) stage = 'login';
      return { ok: true, observation: `opened ${url}`, snapshot: SNAP };
    },
    snapshot: async () => {
      calls.push(['snapshot', stage]);
      return snapFor();
    },
    click: async (h, text) => {
      calls.push(['click', text]);
      if (text === 'Login') stage = 'loggedin';
      if (text === 'Submit' && stage === 'security') stage = 'security-done';
      return { ok: true, observation: `clicked ${text}`, snapshot: SNAP };
    },
    type: async () => {
      calls.push(['type']);
      return { ok: true, observation: 'Typed.', snapshot: SNAP };
    },
  };
}

function stubRun({ meta = {}, gui = null, vault = null } = {}) {
  const v = vault || stubVault();
  const g = gui || stubDvwaGui();
  let stored = { ...meta };
  const recorded = [];
  const notes = [];
  const secrets = new Set();
  const said = [];
  return {
    vault: v,
    gui: g,
    recorded,
    notes,
    secrets,
    said,
    get meta() {
      return stored;
    },
    deps: {
      gui: g,
      saveCredential: (a) => v.saveCredential(a),
      getCredential: (h) => v.getCredential(h),
      readMeta: () => stored,
      writeMeta: (h, patch) => {
        stored = { ...stored, ...patch };
        return stored;
      },
      record: (h, e) => {
        recorded.push(e);
      },
      note: (e) => {
        notes.push(e);
      },
      addSecret: (s) => secrets.add(s),
      say: (t) => said.push(t),
    },
  };
}

const DVWA_META = { recon: { knownApp: 'dvwa' } };

// --- needsLabLogin ----------------------------------------------------------

test('needsLabLogin fires only for DVWA, only while unauthenticated', () => {
  assert.ok(needsLabLogin(DVWA_META, TARGET));
  assert.equal(needsLabLogin({ recon: { knownApp: 'juice-shop' } }, TARGET), null);
  assert.equal(needsLabLogin({}, TARGET), null);
  assert.equal(needsLabLogin({ recon: { knownApp: 'dvwa' }, auth: { dvwa: { loggedIn: true } } }, TARGET), null);
  assert.equal(needsLabLogin({ recon: { knownApp: 'dvwa' }, auth: { dvwa: { loginFailed: true } } }, TARGET), null);
  assert.equal(needsLabLogin({ knownApp: { app: 'dvwa' } }, TARGET) !== null, true);
});

// --- happy path ---------------------------------------------------------------

test('happy path: vaults the default, fills from the vault, verifies, sets low', async () => {
  const run = stubRun({ meta: DVWA_META });
  const res = await runLabLoginFirst('h_test', TARGET, run.deps);
  assert.equal(res.ok, true);
  assert.equal(res.securityLevel, 'low');
  assert.equal(run.vault.size, 1);
  const handle = run.meta.auth.dvwa.handle;
  assert.ok(handle);
  assert.equal(run.vault.getCredential(handle).username, 'admin');
  assert.equal(run.meta.auth.dvwa.loggedIn, true);
  assert.equal(run.meta.auth.dvwa.securityLevel, 'low');
  assert.equal(run.meta.auth.dvwa.via, 'gui');
  assert.ok(run.meta.auth.dvwa.verifiedAt);
  assert.ok(run.recorded.some((e) => e.type === 'status' && e.state === 'dvwa_logged_in'));
  assert.ok(run.gui.calls.some(([k, v]) => k === 'open' && String(v).endsWith('/login.php')));
  assert.ok(run.gui.calls.some(([k, v]) => k === 'click' && v === 'Login'));
  assert.ok(run.gui.calls.some(([k, v]) => k === 'click' && v === 'low'));
  assert.ok(run.gui.calls.some(([k, v]) => k === 'click' && v === 'Submit'));
  // The password never reaches any recorded surface.
  const recordedText = JSON.stringify(run.recorded) + JSON.stringify(run.notes) + JSON.stringify(run.said);
  assert.equal(recordedText.includes('password'), false);
  assert.ok(run.secrets.has('password'));
});

// --- failure paths ------------------------------------------------------------

test('login-not-verified: no Logout link — auth_block recorded, never retried', async () => {
  const run = stubRun({ meta: DVWA_META, gui: stubDvwaGui({ verifyLogin: false }) });
  const res = await runLabLoginFirst('h_test', TARGET, run.deps);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'login-not-verified');
  assert.equal(run.meta.auth.dvwa.loggedIn, false);
  assert.equal(run.meta.auth.dvwa.loginFailed, true);
  assert.ok(run.recorded.some((e) => e.type === 'auth_block' && e.reason === 'login-not-verified'));
  // The gate now refuses to try again on this hunt.
  assert.equal(needsLabLogin(run.meta, TARGET), null);
});

test('security-not-set: login verified but the level-set fails — partial success', async () => {
  const run = stubRun({ meta: DVWA_META, gui: stubDvwaGui({ verifySecurity: false }) });
  const res = await runLabLoginFirst('h_test', TARGET, run.deps);
  assert.equal(res.ok, true);
  assert.equal(res.securityLevel, 'not-set');
  assert.equal(run.meta.auth.dvwa.loggedIn, true);
  assert.equal(run.meta.auth.dvwa.securityLevel, 'not-set');
});

test('login-page-not-seen: snapshot without fields — auth_block, no vault write', async () => {
  const gui = stubDvwaGui();
  gui.snapshot = async () => ({ ok: true, observation: 'Page: blank', snapshot: SNAP });
  const run = stubRun({ meta: DVWA_META, gui });
  const res = await runLabLoginFirst('h_test', TARGET, run.deps);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'login-page-not-seen');
  assert.equal(run.vault.size, 0);
  assert.ok(run.recorded.some((e) => e.type === 'auth_block'));
});

// --- OCR-mangled labels (27 Oct 2026, live 22:50 failure) ------------------

// A fake visible browser whose CLICKABLE labels come from the REAL
// click resolver (resolveClickTarget) against a mangled label list —
// exactly the live failure: the OCR map reads "Username" as
// "u ername" and "Password" as "pa word". The snapshot TEXT stays
// correct DOM text (the live step-2 check passed; only the element
// labels were mangled).
function stubMangledGui({ loginLabels, securityLabels = ['low', 'medium', 'high', 'impossible', 'Submit'] } = {}) {
  const calls = [];
  let stage = 'login';
  let lowSelected = false;
  const snapFor = () => {
    if (stage === 'login') return { ok: true, observation: LOGIN_SNAP, snapshot: SNAP };
    if (stage === 'loggedin') return { ok: true, observation: LOGGED_IN_SNAP, snapshot: SNAP };
    if (stage === 'security') return { ok: true, observation: SECURITY_SNAP, snapshot: SNAP };
    return { ok: true, observation: SECURITY_DONE_SNAP, snapshot: SNAP };
  };
  return {
    calls,
    open: async (h, url) => {
      calls.push(['open', url]);
      if (String(url).includes('/security.php')) stage = 'security';
      else if (String(url).includes('/login.php')) stage = 'login';
      return { ok: true, observation: `opened ${url}`, snapshot: SNAP };
    },
    snapshot: async () => {
      calls.push(['snapshot', stage]);
      return snapFor();
    },
    click: async (h, text) => {
      calls.push(['click', text]);
      const labels = (stage === 'security' || stage === 'security-done') ? securityLabels : loginLabels;
      const verdict = resolveClickTarget(text, labels);
      if (verdict.status === 'none' || !labels[verdict.index]) {
        return { ok: false, observation: `Click failed: no clickable element matches "${text}" — clickable labels on this page: ${labels.map((l) => `"${l}"`).join(', ')}`, snapshot: SNAP };
      }
      const hit = labels[verdict.index];
      if (hit === 'Login') stage = 'loggedin';
      if (hit === 'low' && stage === 'security') lowSelected = true;
      if (hit === 'Submit' && stage === 'security' && lowSelected) stage = 'security-done';
      return { ok: true, observation: `clicked ${hit}`, snapshot: SNAP };
    },
    type: async () => {
      calls.push(['type']);
      return { ok: true, observation: 'Typed.', snapshot: SNAP };
    },
  };
}

test('OCR-mangled labels: "u ername"/"pa word" still log in (fuzzy tier), via gui', async () => {
  const gui = stubMangledGui({ loginLabels: ['u ername', 'pa word', 'Login'] });
  const run = stubRun({ meta: DVWA_META, gui });
  const res = await runLabLoginFirst('h_test', TARGET, run.deps);
  assert.equal(res.ok, true);
  assert.equal(res.securityLevel, 'low');
  assert.equal(run.meta.auth.dvwa.loggedIn, true);
  assert.equal(run.meta.auth.dvwa.via, 'gui');
  assert.ok(run.gui.calls.some(([k, v]) => k === 'click' && v === 'Username'));
  assert.ok(run.gui.calls.some(([k, v]) => k === 'click' && v === 'Password'));
  assert.ok(run.gui.calls.some(([k, v]) => k === 'click' && v === 'Login'));
});

test('coordinates fallback: a label too mangled for fuzzy still logs in via the map', async () => {
  // 'uname' is distance 3 from 'Username' — past the fuzzy
  // threshold (2) — so the label click misses, and the login must
  // fall back to the screen map's coordinates for that field.
  const gui = stubMangledGui({ loginLabels: ['uname', 'pa word', 'Login'] });
  const run = stubRun({ meta: DVWA_META, gui });
  const mapLines = [
    { text: 'uname', x: 640, y: 300 },
    { text: 'pa word', x: 640, y: 340 },
    { text: 'Login', x: 640, y: 380 },
  ];
  const clickAts = [];
  run.deps.screenMap = async () => ({ ok: true, lines: mapLines });
  run.deps.clickAt = async (x, y) => {
    clickAts.push([x, y]);
    return { ok: true };
  };
  const res = await runLabLoginFirst('h_test', TARGET, run.deps);
  assert.equal(res.ok, true);
  assert.equal(res.securityLevel, 'low');
  assert.equal(run.meta.auth.dvwa.loggedIn, true);
  assert.equal(run.meta.auth.dvwa.via, 'gui');
  assert.deepEqual(clickAts, [[640, 300]], 'the Username field was clicked at its map coordinates');
});

test('coordinates fallback absent: a too-mangled label still fails honestly (fill-failed)', async () => {
  // Without screenMap/clickAt deps there is no second chance — the
  // login fails exactly as before, with the original click error.
  const gui = stubMangledGui({ loginLabels: ['uname', 'pa word', 'Login'] });
  const run = stubRun({ meta: DVWA_META, gui });
  const res = await runLabLoginFirst('h_test', TARGET, run.deps);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'fill-failed');
  assert.match(res.detail, /click Username/);
  assert.equal(run.meta.auth.dvwa.loginFailed, true);
  assert.equal(run.meta.auth.dvwa.via, 'gui');
});
