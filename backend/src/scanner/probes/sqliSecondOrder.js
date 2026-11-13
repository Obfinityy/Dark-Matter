// Dark Matter rule-based scanner — second-order SQL injection probe.
// Coverage rows #208 [High] + #281 [High] (the same concept filed twice —
// this one leg covers both rows; see the batch-3 re-proof overlap flag).
//
// First-order SQLi injects and reads the IMMEDIATE response. Second-order
// SQLi is different: the payload is STORED by one request (a profile /
// registration field) and executed only when a LATER request re-uses the
// stored value in a query. None of sqliError / sqliBlind / sqliOob tests
// that — they never store anything.
//
//   Step 0 (baseline): GET the trigger page(s) — they must NOT already
//     carry a DB error (else the oracle is void).
//   Step 1 (benign control): store a benign value via the form, re-GET
//     the trigger page(s) — they must stay clean (else storing anything
//     breaks the page and the oracle is void).
//   Step 2 (store): submit a canary SQLi payload (an unbalanced quote)
//     into a text input.
//   Step 3 (trigger): re-GET the trigger page(s). If a genuine DB error
//     signature (detectDbError — the same strict matcher as sqliError,
//     Zerodha FP fix 9 Nov 2026) now appears — present on the
//     malicious-stored value, absent on the benign-stored value — the
//     stored value was executed in a later query: second-order SQLi,
//     confirmed.
//
// Oracle: evidence.errorCorrelated=true (the specific signal) AND
// evidence.diverged=true (the trigger response diverged between the
// malicious-stored and benign-stored values). Both flags are needed:
// protocolFor routes class 'sqli_second_order' to the sqli_boolean
// protocol, judged on `diverged` — errorCorrelated alone would land
// 'unconfirmed' (see differential.test.js, 14 Nov 2026).
//
// LAB-GATED (safety requirement): the store step WRITES to the target,
// so the probe returns [] without a single request on a non-lab host
// (isLabTargetHost, labCreds.js — the same gate as sqliOob and
// file-upload). index.js plans this phase only when allowWrite; the
// probe re-checks the gate itself, defence in depth.
//
// SCOPE: error-based leg only in v1 — the time-based and OOB second-order
// legs (store a SLEEP / callback payload, read the delay / hit on the
// trigger request) are the same two-step shape and can extend this file.
// One confirmed finding per form: a confirmed malicious store poisons
// the trigger page for every later input in the same form, so later
// inputs could not be attributed honestly.
import { randomBytes } from 'node:crypto';
import { detectDbError, engineForTech } from '../fingerprint.js';
import { isLabTargetHost } from '../../labCreds.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const MAX_FORMS = 5;
const MAX_INPUTS_PER_FORM = 3;

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

function triggerUrls(form, url) {
  const urls = [form.action];
  const root = siteRoot(url);
  if (root !== form.action) urls.push(root);
  return urls;
}

// Read every trigger page; return the DB family of the first genuine
// error found, or null when all trigger pages are clean.
async function triggerError(urls, opts) {
  for (const checkUrl of urls) {
    let body = '';
    try {
      body = await get(checkUrl, opts);
    } catch {
      continue;
    }
    const family = detectDbError(body);
    if (family) return { family, at: checkUrl, body };
  }
  return null;
}

async function submit(form, params, opts) {
  if (String(form.method || 'get').toLowerCase() === 'post') {
    await post(form.action, params, opts);
  } else {
    await get(`${form.action}${form.action.includes('?') ? '&' : '?'}${params.toString()}`, opts);
  }
}

export async function probeSqliSecondOrder(forms, url, opts = {}) {
  const findings = [];
  // Lab gate, checked BEFORE any request: without a lab host the probe
  // returns [] and sends nothing — a store step on a non-lab target
  // would write attacker-controlled data to a real application.
  if (!isLabTargetHost(url, opts.labTargets)) return findings;
  const stackEngine = engineForTech(opts.tech);
  for (const form of (forms || []).slice(0, MAX_FORMS)) {
    const targets = (form.inputs || []).filter((i) => i.name && !isSubmittish(i.name)).slice(0, MAX_INPUTS_PER_FORM);
    const triggers = triggerUrls(form, url);
    for (const input of targets) {
      const inputName = input.name;
      const rand = randomBytes(8).toString('hex');
      // Step 0 (baseline): the trigger pages must be clean before
      // anything is stored — a pre-existing error voids the oracle.
      let baseline;
      try {
        baseline = await triggerError(triggers, opts);
      } catch {
        continue;
      }
      if (baseline) continue;
      // Step 1 (benign control): store a benign value; the trigger
      // pages must stay clean — if storing anything breaks the page,
      // an error after the malicious store proves nothing.
      const benign = `dmprobe_benign_${rand}`;
      try {
        await submit(form, fillParams(form.inputs, inputName, benign), opts);
      } catch {
        continue;
      }
      let benignErr;
      try {
        benignErr = await triggerError(triggers, opts);
      } catch {
        continue;
      }
      if (benignErr) continue;
      // Step 2 (store): the canary SQLi payload — an unbalanced quote
      // inside the stored value. When the application later builds a
      // query with it unescaped, the quote breaks the query.
      const payload = `dmprobe'${rand}`;
      try {
        await submit(form, fillParams(form.inputs, inputName, payload), opts);
      } catch {
        continue;
      }
      // Step 3 (trigger): re-read the trigger pages. A genuine DB
      // error here — present on the malicious-stored value, absent on
      // the benign-stored value — is the second-order confirmation.
      let triggered;
      try {
        triggered = await triggerError(triggers, opts);
      } catch {
        continue;
      }
      if (!triggered) continue;
      // Stack gate (same as sqli-error): an engine-specific error
      // that contradicts the fingerprinted stack never confirms. A
      // 'generic' (SQLSTATE-only) signature contradicts no engine.
      const { family } = triggered;
      if (family && family !== 'generic' && stackEngine && family !== stackEngine) continue;
      findings.push({
        class: 'sqli_second_order',
        id: `sqli-second-order-${form.action}-${inputName}`.slice(0, 120),
        title: `Second-order SQL injection via stored form input '${inputName}'`,
        severity: 'high',
        url: form.action,
        param: inputName,
        parameter: inputName, // dedup key: one finding per sink input, not per page
        evidence: {
          request: `${String(form.method || 'get').toUpperCase()} ${form.action} (${inputName}=${payload})`,
          response: `DB error signature (${family}) on the trigger request after storing the payload — "...${triggered.body.slice(0, 200)}..." — absent in the pre-store baseline and after storing a benign value`,
          impact_demo: 'attacker-controlled value persisted server-side and executed in a later SQL query — the stored quote breaks the query on read-back',
          errorCorrelated: true,
          diverged: true,
          signalCorrelated: true,
        },
        dbFamily: family,
      });
      // One confirmed finding per form (see header): the confirmed
      // store poisons the trigger page for later inputs.
      break;
    }
  }
  return findings;
}
