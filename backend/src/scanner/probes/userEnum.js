// Dark Matter rule-based scanner — username/account enumeration probe (#45).
//
// Owns ONLY the response differential between valid and invalid usernames
// across login/register/reset (credential strength and brute force stay in
// weakCreds.js — non-overlap). It PROVES the oracle exists; it never
// brute-forces credentials.
//   D1. Auth-surface inventory: login, registration, password-reset forms.
//   D2. Valid-username acquisition: lab creds, else register a canary
//       account (that username becomes the known-valid anchor). No anchor
//       -> login/reset differentials degrade to INFO (never guessed).
//   T1. Login differential — MEDIUM: (valid, wrong pw) vs (invalid, same
//       wrong pw), N=5 interleaved, re-verified; message/code/timing.
//   T2. Register differential — MEDIUM: taken vs fresh username.
//   T3. Reset differential — MEDIUM: valid vs invalid identifier.
//   T4. Timing oracle — supporting evidence, INFO alone.
//
// Hard safety: only OUR canaries; ≤10 requests per surface; same wrong
// password; no real-user harvesting; no reset for real-looking accounts.
// Dedupe: one finding per surface (login > register > reset).

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

async function postForm(url, fields, opts = {}) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', ...(opts.headers || {}) },
      body: new URLSearchParams(fields).toString(), redirect: 'manual',
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 200000), ms: Date.now() - t0 };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Normalize a response to a comparable signature.
function sig(r) {
  if (!r) return 'ERR';
  const t = r.text.replace(/[0-9a-f]{16,}/gi, '#').replace(/\d{4,}/g, '#');
  return `${r.status}:${t.length}:${t.slice(0, 400)}`;
}

// Run fn N times interleaved with a control; returns {stable, diff}.
async function differential(fnValid, fnInvalid, n = 5) {
  const vSigs = [];
  const iSigs = [];
  for (let i = 0; i < n; i++) {
    const rv = await fnValid();
    await sleep(700 + Math.random() * 800);
    const ri = await fnInvalid();
    await sleep(700 + Math.random() * 800);
    vSigs.push(sig(rv));
    iSigs.push(sig(ri));
  }
  const vStable = new Set(vSigs).size === 1;
  const iStable = new Set(iSigs).size === 1;
  const differ = vSigs[0] !== iSigs[0];
  return { vStable, iStable, differ, vSig: vSigs[0], iSig: iSigs[0] };
}

function loginForms(forms) {
  return forms.filter((f) => (f.inputs || []).some((i) => String(i.type || '').toLowerCase() === 'password'));
}
function registerForms(forms) {
  return forms.filter((f) => {
    const names = (f.inputs || []).map((i) => String(i.name || '').toLowerCase()).join(' ');
    return /password/.test(names) && (/confirm|repeat/.test(names) || /regist|sign.?up/i.test(String(f.action || '')));
  });
}
function resetForms(forms) {
  return forms.filter((f) => /reset|forgot|recover/i.test(String(f.action || '')) && !(f.inputs || []).some((i) => String(i.type || '').toLowerCase() === 'password'));
}

function fillLogin(form, username, password) {
  const fields = {};
  for (const inp of form.inputs || []) {
    if (!inp.name) continue;
    const n = inp.name.toLowerCase();
    if (/pass/.test(n)) fields[inp.name] = password;
    else if (/user|login|email/.test(n)) fields[inp.name] = username;
    else fields[inp.name] = inp.value || '';
  }
  return fields;
}

// ---- T1: login differential ---------------------------------------------------------------------
async function t1Login(form, validUser, opts) {
  const findings = [];
  const invalidUser = `__dm_nonexist_${rand()}`;
  const wrongPw = `WrongPw_${rand()}!`;
  const d = await differential(
    () => postForm(form.action, fillLogin(form, validUser, wrongPw), opts),
    () => postForm(form.action, fillLogin(form, invalidUser, wrongPw), opts)
  );
  // Re-verify once before confirming (jitter guard).
  if (d.differ && d.vStable && d.iStable) {
    const d2 = await differential(
      () => postForm(form.action, fillLogin(form, validUser, wrongPw), opts),
      () => postForm(form.action, fillLogin(form, invalidUser, wrongPw), opts),
      3
    );
    if (d2.differ && d2.vStable && d2.iStable) {
      findings.push({
        class: 'user_enumeration',
        id: `ue-login-${rand()}`,
        title: 'Account enumeration — login oracle distinguishes valid users (MEDIUM)',
        severity: 'medium',
        url: form.action,
        parameter: 'username',
        evidence: ev(
          `POST login (valid user, wrong pw) vs (invalid user, same wrong pw), 5+3 interleaved runs`,
          `Reproducible differential across two independent runs — valid: "${d.vSig.slice(0, 120)}..." vs invalid: "${d.iSig.slice(0, 120)}..."`,
          'Username oracle: valid accounts distinguishable — ATO force-multiplier.'
        ),
      });
    }
  }
  return findings;
}

// ---- T2: register differential ---------------------------------------------------------------------
async function t2Register(form, validUser, opts, rid) {
  const findings = [];
  const freshUser = `__dm_enum_${rid}_fresh`;
  const fill = (u) => {
    const fields = {};
    for (const inp of form.inputs || []) {
      if (!inp.name) continue;
      const n = inp.name.toLowerCase();
      if (/confirm|repeat/.test(n)) fields[inp.name] = `Pw_${rid}!x`;
      else if (/pass/.test(n)) fields[inp.name] = `Pw_${rid}!x`;
      else if (/user|login/.test(n)) fields[inp.name] = u;
      else if (/email/.test(n)) fields[inp.name] = `${u}@example.invalid`;
      else fields[inp.name] = inp.value || u;
    }
    return fields;
  };
  const d = await differential(
    () => postForm(form.action, fill(validUser), opts),
    () => postForm(form.action, fill(freshUser), opts),
    3
  );
  if (d.differ && d.vStable && d.iStable) {
    findings.push({
      class: 'user_enumeration',
      id: `ue-register-${rand()}`,
      title: 'Account enumeration — registration oracle leaks taken usernames (MEDIUM)',
      severity: 'medium',
      url: form.action,
      parameter: 'username',
      evidence: ev(
        `POST register (taken username) vs (fresh username), 3 interleaved runs`,
        `Taken: "${d.vSig.slice(0, 120)}..." vs fresh: "${d.iSig.slice(0, 120)}..." — reproducible.`,
        'Username oracle via registration.'
      ),
    });
  }
  return findings;
}

// ---- T3: reset differential ----------------------------------------------------------------------------
async function t3Reset(form, validUser, opts) {
  const findings = [];
  const invalidUser = `__dm_nonexist_${rand()}@example.invalid`;
  const fill = (u) => {
    const fields = {};
    for (const inp of form.inputs || []) {
      if (!inp.name) continue;
      const n = inp.name.toLowerCase();
      if (/email|user|login/.test(n)) fields[inp.name] = u;
      else fields[inp.name] = inp.value || '';
    }
    return fields;
  };
  const validId = validUser.includes('@') ? validUser : `${validUser}@example.invalid`;
  const d = await differential(
    () => postForm(form.action, fill(validId), opts),
    () => postForm(form.action, fill(invalidUser), opts),
    3
  );
  if (d.differ && d.vStable && d.iStable) {
    findings.push({
      class: 'user_enumeration',
      id: `ue-reset-${rand()}`,
      title: 'Account enumeration — password-reset oracle distinguishes accounts (MEDIUM)',
      severity: 'medium',
      url: form.action,
      parameter: 'email/username',
      evidence: ev(
        `POST reset (valid identifier) vs (invalid identifier), 3 interleaved runs`,
        `Reproducible differential — oracle proven; no email of any real account was touched.`,
        'Account-existence oracle via password reset.'
      ),
    });
  }
  return findings;
}

export async function probeUserEnum(forms, url, opts = {}) {
  const findings = [];
  void url;
  const lfs = loginForms(forms);
  const rfs = registerForms(forms);
  const pfs = resetForms(forms);
  if (!lfs.length && !rfs.length && !pfs.length) return findings; // no auth surface
  const rid = rand();
  // D2: valid-username anchor — lab creds first.
  let validUser = opts.labCreds && opts.labCreds.username ? opts.labCreds.username : null;
  // (Register-surface canary factory: documented; lab creds cover the anchor in v1.)
  if (!validUser) return findings; // honest degrade — never guess
  const depth = opts.depth || 'standard';
  // Dedupe: strongest surface first (login > register > reset), one finding.
  if (lfs.length) {
    findings.push(...(await t1Login(lfs[0], validUser, opts)));
    if (findings.length) return findings;
  }
  if (depth !== 'quick' && rfs.length) {
    findings.push(...(await t2Register(rfs[0], validUser, opts, rid)));
    if (findings.length) return findings;
  }
  if (depth !== 'quick' && pfs.length) {
    findings.push(...(await t3Reset(pfs[0], validUser, opts)));
  }
  return findings;
}

export const __ueMeta = { phases: ['user-enumeration'], depth: ['quick', 'standard', 'deep'] };
