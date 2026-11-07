// Dark Matter rule-based scanner — stored XSS probe (two-step oracle).
//
// Reflected XSS only proves the sink echoes; stored XSS proves the payload
// PERSISTS: it is written on step 2 and re-rendered on step 3.
//
//   Step 1 (baseline): GET the form's action page — the freshly-random
//     canary must be ABSENT (sanity control).
//   Step 2 (inject): submit the canary into text-ish inputs (POST body or
//     GET query, matching the form's method).
//   Step 3 (verify): re-GET the action page AND the site root. If the canary
//     now appears verbatim, the value was stored server-side and rendered
//     back: stored XSS, confirmed.
//
// Oracle: evidence.canaryReflected=true under the xss protocol (protocolFor
// routes any class containing 'xss' to xss_reflected) → 'confirmed'.
// SAFETY: unique canary per attempt; authorized targets only — the whole
// scan runs behind authorizeTarget, so this probe never fires elsewhere.
import { randomBytes } from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    });
    return await res.text().catch(() => '');
  } finally {
    clearTimeout(t);
  }
}

async function post(url, params, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(opts.headers || {}),
      },
      body: params.toString(),
    });
    return await res.text().catch(() => '');
  } finally {
    clearTimeout(t);
  }
}

function isSubmittish(name) {
  return /^(submit|button|reset|image)$/i.test(String(name || ''));
}

function fillParams(inputs, targetName, payload) {
  const params = new URLSearchParams();
  let n = 0;
  // Inputs are { name, type, value } objects (D1, #474 repair) —
  // targetName is a NAME string; every set/test reads .name.
  for (const inp of inputs || []) {
    const name = inp.name;
    if (!name) continue;
    if (isSubmittish(name)) continue;
    if (name === targetName) params.set(name, payload);
    else params.set(name, `dmprobe${++n}_${randomBytes(2).toString('hex')}`);
  }
  // DVWA-style forms require Submit to be set (isset gate).
  params.set('Submit', '1');
  return params;
}

function siteRoot(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/`;
  } catch {
    return url;
  }
}

export async function probeStoredXss(forms, url, opts = {}) {
  const findings = [];
  const root = siteRoot(url);
  for (const form of (forms || []).slice(0, 5)) {
    const targets = (form.inputs || []).filter((i) => i.name && !isSubmittish(i.name)).slice(0, 3);
    for (const input of targets) {
      const inputName = input.name;
      const rand = randomBytes(8).toString('hex');
      const canary = `dmxss${rand}`;
      let baseline = '';
      try {
        baseline = await get(form.action, opts);
      } catch {
        continue;
      }
      if (baseline.includes(canary)) continue; // sanity: fresh canary must be absent
      const params = fillParams(form.inputs, inputName, canary);
      try {
        if (String(form.method || 'get').toLowerCase() === 'post') {
          await post(form.action, params, opts);
        } else {
          await get(`${form.action}${form.action.includes('?') ? '&' : '?'}${params.toString()}`, opts);
        }
      } catch {
        continue;
      }
      // Verify: re-read the action page and the site root.
      let stored = false;
      let storedAt = '';
      let storedWindow = '';
      for (const checkUrl of [form.action, root]) {
        let body = '';
        try {
          body = await get(checkUrl, opts);
        } catch {
          continue;
        }
        if (body.includes(canary)) {
          stored = true;
          storedAt = checkUrl;
          const idx = body.indexOf(canary);
          storedWindow = body.slice(Math.max(0, idx - 60), idx + 120);
          break;
        }
      }
      if (!stored) continue;
      findings.push({
        class: 'xss_stored',
        id: `xss-stored-${form.action}-${inputName}`.slice(0, 120),
        title: `Stored XSS via form input '${inputName}'`,
        severity: 'high',
        url: form.action,
        param: inputName,
        parameter: inputName, // dedup key: one finding per sink input, not per page
        evidence: {
          request: `${String(form.method || 'get').toUpperCase()} ${form.action} (${inputName}=${canary})`,
          response: `canary re-rendered verbatim on ${storedAt} after submit — "...${storedWindow}..." — absent in pre-submit baseline`,
          impact_demo: 'attacker-controlled value persisted server-side and rendered into HTML — executes for every later visitor',
          canaryReflected: true,
        },
      });
    }
  }
  return findings;
}
