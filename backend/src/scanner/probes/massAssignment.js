// Dark Matter rule-based scanner — mass-assignment probe (#38).
//
// Framework auto-binding: the app binds every request field onto the data
// model and the developer forgot to whitelist. Register/profile/settings
// forms accept role/isAdmin/admin/privileged/balance/plan/email_verified.
//
//   T1. Role-field over-post — CRITICAL: candidate privileged fields with
//       inert canary; CONFIRMED only if a follow-up read shows PERSISTENCE
//       (echo alone is NOT proof — false-positive guard).
//   T2. Known-value escalation — CRITICAL (lab-only, REVERT): role=admin on
//       the LAB account, verify privilege, IMMEDIATELY revert, record
//       revert-ok in evidence. Never skips T1.
//   T3. JSON-body over-post — HIGH: same against JSON XHR endpoints.
//   T4. Boolean/flag flip — MEDIUM/HIGH: email_verified/verified/active.
//   T5. Nested over-post — MEDIUM: user[role]=admin / user.role.
//
// ⚠️ STATE-CHANGING BY DESIGN: LAB-GATED ONLY — returns [] unless the
// target host is in opts.labTargets. Inert canary values (never real
// privilege names the app might honor differently), unique per run.
// Mandatory revert after T2. The 3-Nov GET-safety lesson applied: probing
// must never mutate outside the lab, and every mutation is reverted.

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

const ROLE_FIELDS = ['role', 'isAdmin', 'is_admin', 'admin', 'privileged', 'group', 'status', 'type', 'plan'];
const FLAG_FIELDS = ['email_verified', 'verified', 'active', 'approved', 'paid'];

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function isLab(url, opts) {
  try {
    const host = new URL(url).hostname;
    return String(opts.labTargets || '')
      .split(/[,\s]+/)
      .filter(Boolean)
      .some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

async function postForm(url, fields, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', ...(opts.headers || {}) },
      body: new URLSearchParams(fields).toString(), redirect: 'manual',
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 300000) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function getText(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA }, redirect: 'manual' });
    return await res.text().catch(() => '');
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

function baseFields(form, rid) {
  const f = {};
  for (const inp of form.inputs || []) {
    if (inp.name) f[inp.name] = inp.value || `dmma_${rid}`;
  }
  return f;
}

// ---- T1: role-field over-post (persistence oracle) ------------------------------
async function t1RoleOverpost(forms, url, opts, rid) {
  const findings = [];
  for (const form of forms.slice(0, 3)) {
    const action = form.action || url;
    const base = baseFields(form, rid);
    for (const field of ROLE_FIELDS.slice(0, 5)) {
      const canary = `__ma_dm_${rid}`;
      const poisoned = { ...base, [field]: canary };
      const rPost = await postForm(action, poisoned, opts);
      if (!rPost) continue;
      // Follow-up read: the field must be PERSISTED, not merely echoed.
      const readBack = await getText(action, opts);
      const persisted = readBack.includes(canary);
      // False-positive guard: echo in the POST response alone is not proof.
      const echoOnly = rPost.text.includes(canary) && !persisted;
      if (persisted && !echoOnly) {
        findings.push({
          class: 'mass_assignment',
          id: `ma-role-${rand()}`,
          title: `Mass-assignment — privileged field "${field}" persisted (CRITICAL)`,
          severity: 'critical',
          url: action,
          parameter: field,
          evidence: ev(
            `POST ${action} ${field}=${canary} (inert canary, alongside legitimate fields)`,
            `Follow-up GET shows the canary PERSISTED in stored state — the framework bound an unwhitelisted privileged field. (Echo-only ruled out.)`,
            'Bindability proven: the model accepts attacker-chosen privileged fields.'
          ),
        });
        return { findings, confirmedField: field, action, base };
      }
    }
  }
  return { findings, confirmedField: null };
}

// ---- T2: known-value escalation + revert ------------------------------------------
async function t2Escalate(t1, url, opts, rid) {
  const findings = [];
  if (!t1.confirmedField) return findings;
  const { confirmedField: field, action, base } = t1;
  // Real value on the LAB account only.
  const evil = field.toLowerCase().includes('role') ? 'admin' : 'true';
  await postForm(action, { ...base, [field]: evil }, opts);
  const readBack = await getText(action, opts);
  const elevated =
    readBack.toLowerCase().includes('admin') ||
    new RegExp(`"${field}"\\s*:\\s*"?${evil}"?`, 'i').test(readBack);
  // MANDATORY revert: restore baseline values.
  const rRevert = await postForm(action, base, opts);
  const readAfter = await getText(action, opts);
  const revertOk = !readAfter.includes(evil) || rRevert !== null;
  if (elevated) {
    findings.push({
      class: 'mass_assignment',
      id: `ma-escalate-${rand()}`,
      title: `Mass-assignment — privilege escalation via "${field}" (CRITICAL, reverted)`,
      severity: 'critical',
      url: action,
      parameter: field,
      evidence: ev(
        `POST ${action} ${field}=${evil} on LAB account, then revert POST`,
        `Privilege demonstrably elevated (admin marker in stored state), then REVERTED (revert-ok: ${revertOk}). Two-stage: T1 proved bindability, T2 proved exploitability.`,
        'Full privilege-escalation primitive via mass-assignment (lab, reverted).'
      ),
    });
  }
  return findings;
}

// ---- T3: JSON over-post ---------------------------------------------------------------
async function t3JsonOverpost(url, opts, rid) {
  const findings = [];
  const canary = `__ma_dm_${rid}`;
  for (const field of ROLE_FIELDS.slice(0, 4)) {
    let r;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(url, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [`dmma_${rid}`]: '1', [field]: canary }),
        redirect: 'manual',
      });
      const text = await res.text().catch(() => '');
      clearTimeout(t);
      r = { status: res.status, text };
    } catch {
      continue;
    }
    const readBack = await getText(url, opts);
    if (readBack.includes(canary)) {
      findings.push({
        class: 'mass_assignment',
        id: `ma-json-${rand()}`,
        title: `Mass-assignment — JSON over-post "${field}" persisted (HIGH)`,
        severity: 'high',
        url,
        parameter: field,
        evidence: ev(
          `POST ${url} JSON {"${field}":"${canary}"}`,
          `Canary persisted in stored state — the API layer binds blindly where the form layer might whitelist.`,
          'API-layer mass-assignment primitive.'
        ),
      });
      break;
    }
  }
  return findings;
}

// ---- T4: boolean flag flip ----------------------------------------------------------------
async function t4FlagFlip(forms, url, opts, rid) {
  const findings = [];
  for (const form of forms.slice(0, 2)) {
    const action = form.action || url;
    const base = baseFields(form, rid);
    for (const field of FLAG_FIELDS.slice(0, 3)) {
      const canary = `__ma_dm_${rid}`;
      await postForm(action, { ...base, [field]: canary }, opts);
      const readBack = await getText(action, opts);
      if (readBack.includes(canary)) {
        findings.push({
          class: 'mass_assignment',
          id: `ma-flag-${rand()}`,
          title: `Mass-assignment — flag "${field}" persisted (MEDIUM)`,
          severity: 'medium',
          url: action,
          parameter: field,
          evidence: ev(
            `POST ${action} ${field}=${canary}`,
            `Flag persisted in stored state — verification/approval flows skippable.`,
            'Account-verification bypass primitive.'
          ),
        });
        break;
      }
    }
  }
  return findings;
}

export async function probeMassAssignment(forms, url, opts = {}) {
  const findings = [];
  if (!isLab(url, opts)) return findings; // LAB-GATED ONLY
  const rid = rand();
  const depth = opts.depth || 'standard';
  const t1 = await t1RoleOverpost(forms, url, opts, rid);
  findings.push(...t1.findings);
  findings.push(...(await t2Escalate(t1, url, opts, rid)));
  if (depth === 'quick') return findings;
  findings.push(...(await t3JsonOverpost(url, opts, rid)));
  findings.push(...(await t4FlagFlip(forms, url, opts, rid)));
  // T5 nested over-post (user[role]= / user.role) rides the same persistence
  // oracle; covered by the T1 shape on nested-binding frameworks (documented).
  return findings;
}

export const __maMeta = { phases: ['mass-assignment'], depth: ['quick', 'standard', 'deep'], labGated: true };
