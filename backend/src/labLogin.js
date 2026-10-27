// Dark Matter — LAB LOGIN-FIRST (zero-genuine lane, 27 Oct 2026).
//
// ROOT CAUSE (live evidence, DVWA hunt h_830317bdc184): the brain never
// logged into DVWA, so every real module (SQLi, XSS, upload, file
// inclusion) sat behind auth, unreachable — while the loop burned ~160
// Meta calls on unauthenticated 404s. The self-auth chain existed
// (save_credential → use_saved_credential) and the ACCOUNTS prompt
// told the brain to use it, but a prompt is not a gate: the brain
// never chose it.
//
// The rule, enforced in code: on a known lab app, the human loop
// logs in FIRST — deterministically, before the first brain turn —
// with the lab's public default via the SAME self-auth chain the
// brain would use (vault the credential, fill the form from the
// vault, submit in the visible browser), sets the security level to
// low, verifies the session from the served page, and records the
// auth state. Only then does the hunt start. A failed login is a
// recorded auth_block blocker, never a silent skip — and the gate
// never retries a failed login by itself (the brain owns the retry).
//
// All side effects arrive as injectable deps, so the whole flow runs
// in tests against a fake browser + fake vault. The password never
// touches any recorded surface: it goes to the vault and to the
// session-secret set (so the scrubber strips it everywhere), and
// only the credential handle is ever recorded.
import { dvwaLoginSpec, knownAppOf } from './knownApps.js';

/**
 * The login spec when this hunt still needs its lab login, else null.
 * Needs it exactly when: the hunt's known app is DVWA, it is not
 * already logged in, and a login has not already failed on this hunt.
 */
export function needsLabLogin(meta, target) {
  if (knownAppOf(meta, target) !== 'dvwa') return null;
  const auth = (meta && meta.auth && meta.auth.dvwa && typeof meta.auth.dvwa === 'object') ? meta.auth.dvwa : {};
  if (auth.loggedIn === true) return null;
  if (auth.loginFailed === true) return null;
  return dvwaLoginSpec(target);
}

function readAuth(meta) {
  const m = (meta && typeof meta === 'object') ? meta : {};
  return (m.auth && typeof m.auth === 'object') ? m.auth : {};
}

/**
 * Run the deterministic DVWA login-first flow.
 * deps: { gui, saveCredential, getCredential, readMeta, writeMeta,
 *   record, note, addSecret, say } — gui is { open, snapshot, click,
 *   type } (the same guiTools the brain's browser actions use).
 * Returns { ok, handle?, securityLevel?, observation?, reason? }.
 * Never throws: every failure is recorded (auth_block) + persisted
 * (meta.auth.dvwa.loginFailed) and returned as { ok: false }.
 */
export async function runLabLoginFirst(huntId, target, deps) {
  const spec = needsLabLogin((deps.readMeta(huntId) || {}), target);
  if (!spec) return { ok: false, reason: 'not-needed' };
  const gui = deps.gui;
  const record = deps.record || (() => {});
  const note = deps.note || (() => {});
  const say = deps.say || (() => {});

  const fail = (reason, detail) => {
    try {
      record(huntId, { type: 'auth_block', tool: 'dvwa-login', detail: String(detail || reason).slice(0, 200), reason, via: 'lab-login-first' });
    } catch { /* recording is best-effort */ }
    try {
      const meta = deps.readMeta(huntId) || {};
      deps.writeMeta(huntId, { auth: { ...readAuth(meta), dvwa: { loggedIn: false, loginFailed: true, failedAt: new Date().toISOString(), reason } } });
    } catch { /* persisting the blocker is best-effort */ }
    try {
      note({ action: 'dvwa-login-first', why: 'DVWA modules sit behind the login', result: `login failed (${reason})`, learned: 'The login wall is the blocker — fix it before hunting modules.' });
    } catch { /* best-effort */ }
    return { ok: false, reason, detail: String(detail || reason).slice(0, 200) };
  };

  // 1. Open the login page in the VISIBLE browser — the owner watches.
  let opened = null;
  try {
    opened = await gui.open(huntId, spec.loginUrl);
  } catch (err) {
    return fail('browser-open-failed', String((err && err.message) || err));
  }
  if (!opened || opened.ok === false) {
    return fail('browser-open-failed', (opened && (opened.observation || opened.error)) || 'browser refused the open');
  }

  // 2. Confirm the login page is actually on screen before typing.
  let snap = null;
  try {
    snap = await gui.snapshot(huntId);
  } catch { snap = null; }
  const snapText = String((snap && snap.observation) || '');
  if (!/username/i.test(snapText) || !/password/i.test(snapText)) {
    return fail('login-page-not-seen', 'snapshot shows no username/password fields');
  }

  // 3. Vault the lab default via the self-auth chain (the password
  //    joins the session-secret set; the record keeps the handle only).
  let rec = null;
  try {
    if (typeof deps.addSecret === 'function') deps.addSecret(spec.password);
    rec = deps.saveCredential({ site: target, username: spec.username, password: spec.password, huntId });
  } catch (err) {
    return fail('vault-failed', String((err && err.message) || err));
  }
  if (!rec || !rec.handle) return fail('vault-failed', 'no credential handle returned');

  // 4. Fill + submit exactly like use_saved_credential does: click
  //    each field, type from the vault, click the submit button.
  //    Each step is checked — the first refusal stops the chain.
  const saved = (() => {
    try {
      return deps.getCredential ? deps.getCredential(rec.handle) : null;
    } catch {
      return null;
    }
  })();
  const username = (saved && saved.username) || spec.username;
  const password = (saved && saved.password) || spec.password;
  const steps = [
    ['click', 'Username'],
    ['type', username],
    ['click', 'Password'],
    ['type', password],
    ['click', 'Login'],
  ];
  for (const [how, value] of steps) {
    let res = null;
    try {
      res = how === 'click' ? await gui.click(huntId, value) : await gui.type(huntId, value, false);
    } catch (err) {
      return fail('fill-failed', `${how} ${value}: ${String((err && err.message) || err)}`);
    }
    if (res && res.ok === false) {
      return fail('fill-failed', `${how} ${value}: ${(res.observation || res.error || 'browser refused')}`);
    }
  }

  // 5. Verify the session from the served page: the logged-in DVWA
  //    page shows a Logout link. A login that cannot be verified
  //    did not happen — record it as failed, never assume it.
  let after = null;
  try {
    after = await gui.snapshot(huntId);
  } catch { after = null; }
  const afterText = String((after && after.observation) || '');
  if (!/logout/i.test(afterText)) {
    return fail('login-not-verified', 'post-login page shows no Logout link');
  }

  // 6. Set the security level to low, and verify the served page
  //    says so. A failed level-set is a PARTIAL result, not a
  //    failed login: logged-in hunting still beats unauthenticated
  //    404s, and the brain is told the level is not low.
  let securityLevel = 'not-set';
  try {
    const secOpen = await gui.open(huntId, spec.securityUrl);
    if (secOpen && secOpen.ok !== false) {
      const secSnap = await gui.snapshot(huntId);
      const secText = String((secSnap && secSnap.observation) || '');
      if (/security level/i.test(secText)) {
        const clickLow = await gui.click(huntId, 'low');
        const clickSubmit = (clickLow && clickLow.ok !== false) ? await gui.click(huntId, 'Submit') : null;
        if (clickSubmit && clickSubmit.ok !== false) {
          const secAfter = await gui.snapshot(huntId);
          if (/security level set to low/i.test(String((secAfter && secAfter.observation) || ''))) {
            securityLevel = 'low';
          }
        }
      }
    }
  } catch { /* a level-set failure is partial — handled below */ }

  // 7. Persist the auth state (checkpoint-merged, never wholesale)
  //    and record the login for the monitors + the DOSSIER.
  const verifiedAt = new Date().toISOString();
  try {
    const meta = deps.readMeta(huntId) || {};
    deps.writeMeta(huntId, {
      auth: {
        ...readAuth(meta),
        dvwa: { loggedIn: true, loginFailed: false, securityLevel, verifiedAt, handle: rec.handle },
      },
    });
  } catch { /* persisting is best-effort */ }
  try {
    record(huntId, { type: 'status', state: 'dvwa_logged_in', securityLevel, via: 'lab-login-first', at: verifiedAt });
  } catch { /* best-effort */ }
  try {
    note({ action: 'dvwa-login-first', why: 'DVWA modules sit behind the login', result: `logged in as admin, security ${securityLevel}`, learned: 'Authenticated DVWA session verified; hunt the modules.' });
  } catch { /* best-effort */ }
  try {
    say(`Logged into DVWA as admin (security ${securityLevel}) — hunting the real modules now.`);
  } catch { /* best-effort */ }
  return {
    ok: true,
    handle: rec.handle,
    securityLevel,
    observation: `Logged into DVWA as admin; security level ${securityLevel}. The vulnerability modules are reachable now.`,
  };
}
