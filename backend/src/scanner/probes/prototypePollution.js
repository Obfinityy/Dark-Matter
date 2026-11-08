// Dark Matter rule-based scanner — prototype pollution probe (#35).
//
// First LANGUAGE-RUNTIME class: the payload is a property NAME, not a value.
//   T1. __proto__ via JSON merge sink — HIGH/CRITICAL
//   T2. constructor.prototype chain — HIGH (denylist bypass when T1 neg)
//   T3. Query-string parser pollution — MEDIUM/HIGH
//   T4. Pollution -> client gadget chain — HIGH (one predefined shape)
//   T5. Logic bypass via polluted key — CRITICAL (lab-only, differential)
//
// SAFETY (hard): LAB-GATED — the entire probe returns [] unless the target
// host is in opts.labTargets (pollution is process-global by nature).
// Per-run unique canary (__pp_dm_<runid>), never a real app key, never an
// `isAdmin`-named canary. No exploit development: T4 uses exactly one
// predefined gadget shape; T5 uses the lab's own account only.
// Oracles: benign-nested-key control FIRST (a merge that won't merge the
// benign key is NOT VULNERABLE); canary reflection in a later response;
// merge-sink library fingerprint (vulnerable lodash/jQuery/deepmerge).
// Severity stays honest: pollution without a reachable gadget = INFO/LOW.

import { isLabTargetHost } from '../../labCreds.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

async function postJson(url, obj, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Content-Type': 'application/json', ...(opts.headers || {}) },
      body: JSON.stringify(obj),
      redirect: 'manual',
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 300000) };
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

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Whole-word match for T5 decision keywords: a bare substring match fires
// on error/help pages that merely mention the word ("not allowed" matches
// allowKeyword "allow").
function wordMatch(text, keyword) {
  return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i').test(String(text || ''));
}

function windowAround(text, needle, before = 60, after = 80) {
  const idx = String(text || '').indexOf(needle);
  if (idx < 0) return String(text || '').slice(0, 120);
  return String(text || '').slice(Math.max(0, idx - before), idx + needle.length + after);
}

// Build `{ __proto__: {...} }` as a REAL own property. An object literal
// `{ __proto__: X }` sets the PROTOTYPE instead — JSON.stringify then emits
// `{}` and the payload never leaves the process (the original T1/T5 bodies
// were silently dropped this way; T1 could never fire).
function protoBody(entries) {
  const obj = {};
  Object.defineProperty(obj, '__proto__', {
    value: entries, enumerable: true, configurable: true, writable: true,
  });
  return obj;
}

// Vulnerable merge-sink library fingerprints (version-pinned, cited).
const MERGE_SINKS = [
  { re: /lodash[^"']*?(\d+\.\d+\.\d+)/i, name: 'lodash', vuln: (v) => cmpVer(v, '4.17.11') < 0 },
  { re: /jquery[^"']*?(\d+\.\d+\.\d+)/i, name: 'jQuery', vuln: (v) => cmpVer(v, '3.4.0') < 0 },
  { re: /deepmerge/i, name: 'deepmerge', vuln: () => true },
  { re: /merge-deep/i, name: 'merge-deep', vuln: () => true },
];

function cmpVer(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

async function fingerprintMergeSinks(url, opts) {
  const text = await getText(url, opts);
  const hits = [];
  for (const s of MERGE_SINKS) {
    const m = text.match(s.re);
    if (m && s.vuln(m[1] || '')) hits.push(`${s.name}${m[1] ? '@' + m[1] : ''}`);
  }
  return hits;
}

// ---- T1: __proto__ JSON merge ------------------------------------------------
async function t1Proto(url, canary, opts) {
  const findings = [];
  let protoBlocked = false;
  // Control: benign nested key must merge first — proven on the FOLLOW GET,
  // not the POST response (an echo endpoint returns the key in the POST
  // response without merging anything).
  const ctrl = await postJson(url, { a: { b: { [`ctrl_${canary}`]: '1' } } }, opts).catch(() => null);
  const ctrlFollow = ctrl ? await getText(url, opts) : '';
  const ctrlMerged = !!ctrl && ctrlFollow.includes(`ctrl_${canary}`);
  const bodies = [
    protoBody({ [`__pp_dm_${canary}`]: 't1' }),
    { a: protoBody({ [`__pp_dm_${canary}`]: 't1n' }) },
  ];
  for (const body of bodies) {
    const r = await postJson(url, body, opts).catch(() => null);
    if (!r) continue;
    // Oracle: the canary must appear as a DEFAULT in a fresh GET — never in
    // the POST response alone (echo is not merge).
    const follow = await getText(url, opts);
    const reflected = follow.includes(`__pp_dm_${canary}`);
    if (reflected && ctrlMerged) {
      findings.push({
        class: 'prototype_pollution',
        id: `pp-proto-${rand()}`,
        title: 'Prototype pollution — __proto__ merge sink accepts attacker keys (HIGH)',
        severity: 'high',
        url,
        parameter: '__proto__',
        evidence: ev(
          `POST ${url} JSON {"__proto__":{"__pp_dm_${canary}":"t1"}} (control benign key merged: ${ctrlMerged})`,
          `Canary __pp_dm_${canary} is a default on a fresh object — "...${windowAround(follow, `__pp_dm_${canary}`)}..."`,
          'Prototype pollution root cause: attacker keys reach Object.prototype merge path.'
        ),
      });
      break;
    }
    // Positive blocking proof: the __proto__ POST returned 2xx and the
    // fresh GET shows no merge — the server received it and did not merge.
    // A failed POST (r null) is inconclusive, never "blocked".
    if (r.status >= 200 && r.status < 300 && !reflected) protoBlocked = true;
  }
  return { findings, confirmed: findings.length > 0, protoBlocked };
}

// ---- T2: constructor.prototype chain ----------------------------------------
async function t2Ctor(url, canary, opts, protoBlocked) {
  const findings = [];
  const body = { constructor: { prototype: { [`__pp_dm_${canary}`]: 't2' } } };
  const r = await postJson(url, body, opts).catch(() => null);
  if (!r) return findings;
  // Same read-back rule as T1: the canary must be a default on a fresh GET.
  const follow = await getText(url, opts);
  if (follow.includes(`__pp_dm_${canary}`)) {
    findings.push({
      class: 'prototype_pollution',
      id: `pp-ctor-${rand()}`,
      title: protoBlocked
        ? 'Prototype pollution — constructor.prototype denylist bypass (MEDIUM)'
        : 'Prototype pollution — constructor.prototype chain (HIGH)',
      severity: protoBlocked ? 'medium' : 'high',
      url,
      parameter: 'constructor.prototype',
      evidence: ev(
        `POST ${url} JSON {"constructor":{"prototype":{"__pp_dm_${canary}":"t2"}}}`,
        `Canary __pp_dm_${canary} is a default on a fresh object — "...${windowAround(follow, `__pp_dm_${canary}`)}..."${protoBlocked ? ' (__proto__ positively blocked, constructor chain still merges)' : ''}.`,
        'Prototype pollution via constructor chain.'
      ),
    });
  }
  return findings;
}

// ---- T3: query-string parser pollution --------------------------------------
async function t3Query(url, canary, opts) {
  const findings = [];
  // Control: a benign key with no __proto__ — if the canary reflects, the
  // page echoes query strings and T3 must stay silent.
  const ctrlTarget = url + (url.includes('?') ? '&' : '?') + `__pp_dm_${canary}=t3ctrl`;
  const ctrlText = await getText(ctrlTarget, opts);
  if (ctrlText.includes(`__pp_dm_${canary}`)) return findings;
  const variants = [
    `__proto__[__pp_dm_${canary}]=t3`,
    `a[__proto__][__pp_dm_${canary}]=t3`,
  ];
  for (const q of variants) {
    const target = url + (url.includes('?') ? '&' : '?') + q;
    await getText(target, opts);
    // Read-back: the canary must appear as a DEFAULT in a fresh GET with
    // no query — an echo of the query string cannot produce that.
    const follow = await getText(url, opts);
    if (follow.includes(`__pp_dm_${canary}`)) {
      findings.push({
        class: 'prototype_pollution',
        id: `pp-query-${rand()}`,
        title: 'Prototype pollution — query parser merges __proto__ keys (MEDIUM)',
        severity: 'medium',
        url: target,
        parameter: '__proto__',
        evidence: ev(
          `GET ${target}`,
          `Canary __pp_dm_${canary} is a default on a fresh object — "...${windowAround(follow, `__pp_dm_${canary}`)}..."`,
          'Request-scoped or global pollution via query-string parser.'
        ),
      });
      break;
    }
  }
  return findings;
}

// ---- T4: gadget chain (one predefined shape) ---------------------------------
async function t4Gadget(url, canary, opts, polluted) {
  const findings = [];
  if (!polluted) return findings;
  // Predefined shape only: polluted key consumed into a script/src-ish sink.
  const text = await getText(url, opts);
  const gadget = new RegExp(
    `(src|href)\\s*=\\s*["'][^"']*__pp_dm_${canary}[^"']*["']|<script[^>]*__pp_dm_${canary}`,
    'i'
  );
  const m = text.match(gadget);
  if (m) {
    findings.push({
      class: 'prototype_pollution',
      id: `pp-gadget-${rand()}`,
      title: 'Prototype pollution — polluted key reaches script/src sink (HIGH)',
      severity: 'high',
      url,
      parameter: `__pp_dm_${canary}`,
      evidence: ev(
        `GET ${url} after pollution`,
        `Canary appears inside a src/href/script sink — "...${windowAround(text, m[0])}..."`,
        'Pollution -> client gadget chain: root cause + chained impact recorded as one finding.'
      ),
    });
  }
  return findings;
}

// ---- T5: logic bypass (lab-only, differential) -------------------------------
async function t5LogicBypass(url, canary, opts) {
  const findings = [];
  const lab = opts.ppLab; // { actionUrl, denyKeyword, allowKeyword }
  if (!lab || !lab.actionUrl) return findings;
  const before = await getText(lab.actionUrl, opts);
  // Empty `before` is inconclusive (getText returns '' on ANY error) —
  // never count it as denial.
  if (!before) return findings;
  const deniedBefore =
    lab.denyKeyword && wordMatch(before, lab.denyKeyword);
  if (!deniedBefore) return findings;
  // Control: a second GET with NO pollution — if it also flips, the flip
  // is coincidental (session expiry, token rotation), not pollution.
  const control = await getText(lab.actionUrl, opts);
  if (lab.allowKeyword && wordMatch(control, lab.allowKeyword)) return findings;
  // Pollute; require the POST to have actually landed (2xx) before any
  // CRITICAL claim — a fire-and-forget POST proves nothing.
  const pol = await postJson(url, protoBody({ [`__pp_dm_${canary}`]: '1' }), opts).catch(() => null);
  if (!pol || pol.status < 200 || pol.status >= 300) return findings;
  const after = await getText(lab.actionUrl, opts);
  const allowedAfter =
    lab.allowKeyword && wordMatch(after, lab.allowKeyword);
  if (allowedAfter) {
    findings.push({
      class: 'prototype_pollution',
      id: `pp-logic-${rand()}`,
      title: 'Prototype pollution — logic bypass via polluted key (CRITICAL)',
      severity: 'critical',
      url: lab.actionUrl,
      parameter: `__pp_dm_${canary}`,
      evidence: ev(
        `POST ${url} __proto__ pollution, then GET ${lab.actionUrl} (lab-owned session)`,
        `Denied before pollution — "...${windowAround(before, lab.denyKeyword)}..." — allowed after, control stayed denied — "...${windowAround(after, lab.allowKeyword)}..."`,
        'Authorization-logic bypass via prototype pollution.'
      ),
    });
  }
  return findings;
}

export async function probePrototypePollution(url, opts = {}) {
  const findings = [];
  if (!isLabTargetHost(url, opts.labTargets)) return findings;
  const canary = rand();
  const sinks = await fingerprintMergeSinks(url, opts);
  if (sinks.length) {
    findings.push({
      class: 'prototype_pollution',
      id: `pp-sink-${rand()}`,
      title: `Vulnerable merge library fingerprinted: ${sinks.join(', ')} (INFO)`,
      severity: 'low',
      url,
      parameter: 'js-bundle',
      evidence: ev(
        `GET ${url} (bundle fingerprint)`,
        `Merge-sink libraries with known pollution CVEs: ${sinks.join(', ')}.`,
        'Library-level pollution exposure — version-pinned, cited.'
      ),
    });
  }
  const depth = opts.depth || 'standard';
  const { findings: f1, confirmed, protoBlocked } = await t1Proto(url, canary, opts);
  findings.push(...f1);
  findings.push(...(await t2Ctor(url, canary, opts, protoBlocked)));
  // Distinct canary for T3: if T1 already polluted the store, T3's GET
  // could reflect T1's canary and be misattributed to query parsing.
  findings.push(...(await t3Query(url, rand(), opts)));
  if (depth === 'deep') {
    findings.push(...(await t4Gadget(url, canary, opts, confirmed)));
    findings.push(...(await t5LogicBypass(url, canary, opts)));
  }
  return findings;
}

export const __ppMeta = { phases: ['prototype-pollution'], depth: ['quick', 'standard', 'deep'], labGated: true };
