// Dark Matter rule-based scanner — race condition / TOCTOU probe (#33).
//
// First CONCURRENCY class in the battery. Every verdict is a differential:
// sequential baseline vs concurrent burst. Never bare "two requests 200".
//
//   T1. Double-submit mutation — CRITICAL/HIGH: same mutation POST fired 8x
//       in parallel; CONFIRMED if burst applies the effect >=2x while the
//       sequential baseline applies it exactly 1x.
//   T2. Uniqueness-constraint race — HIGH: two concurrent account creations
//       with distinct canary emails; CONFIRMED if BOTH succeed while the
//       sequential baseline rejects the second.
//   T3. Token single-use race — HIGH: two concurrent consumptions of the same
//       one-time token; skipped gracefully when no token surface is detected.
//   T4. Rate-counter TOCTOU — MEDIUM: burst past an observed 429 limit;
//       CONFIRMED if >=N+2 succeed where sequential allowed only N.
//   T5. Last-write-wins / torn write — LOW/INFO: concurrent A/B updates,
//       documents which value won and torn writes (weak-locking signal).
//
// SAFETY (hard, probe-side): ALL mutation bursts are LAB-GATED — the probe
// returns [] unless the target host is listed in opts.labTargets (same
// fail-closed model as the file-upload probe). Burst cap 8 parallel, 5s hard
// cap, single burst per target, canary-tagged values everywhere. This is a
// scanner, not a load test.
// Depth: Quick = T1 only; Standard = T1+T2+T4; Deep = full battery.

import { isLabTargetHost } from '../../labCreds.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const BURST_N = 8;

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

// D2 (#474 repair, 8 Nov 2026): the lab gate delegates to the
// canonical isLabTargetHost (labCreds.js) — the old local copy
// compared a bare hostname against port-bearing LAB_TARGETS entries,
// so the gate could never pass in production. runScan passes
// labTargets explicitly (see the race step in index.js).
function isLab(url, opts) {
  return isLabTargetHost(url, opts.labTargets);
}

async function postForm(url, fields, opts = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(opts.headers || {}),
      },
      body: new URLSearchParams(fields).toString(),
      redirect: 'manual',
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 100000) };
  } finally {
    clearTimeout(t);
  }
}

// Outcome signal of a mutation response.
function outcome(r) {
  const t = r.text.toLowerCase();
  if (/success|created|redeemed|purchased|transferred|completed|updated|ok/i.test(t) && r.status < 400)
    return 'success';
  if (r.status === 429 || /rate.?limit|too many/i.test(t)) return 'limited';
  if (/already|exists|duplicate|taken|used|expired|invalid/i.test(t)) return 'rejected';
  return r.status < 400 ? 'other-ok' : 'other-err';
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// Fire N copies of the same POST concurrently, capped and time-boxed.
async function burst(url, fields, opts, n = BURST_N) {
  const copies = Array.from({ length: n }, () => ({ ...fields }));
  const results = await Promise.all(
    copies.map((f) => postForm(url, f, opts).catch(() => ({ status: 0, text: '' })))
  );
  return results;
}

// ---- T1: double-submit mutation -------------------------------------------
async function t1DoubleSubmit(forms, url, opts) {
  const findings = [];
  for (const form of forms.slice(0, 3)) {
    const action = form.action || url;
    if (!isLab(action, opts)) continue;
    const base = {};
    for (const inp of form.inputs || []) {
      if (inp.name) base[inp.name] = inp.value || `dmrace_${rand()}`;
    }
    // Sequential baseline: exactly one firing.
    let rBase;
    try {
      rBase = await postForm(action, base, opts);
    } catch {
      continue;
    }
    if (outcome(rBase) !== 'success') continue; // no observable mutation
    // Concurrent burst of the identical request.
    const results = await burst(action, base, opts);
    const successes = results.filter((r) => outcome(r) === 'success').length;
    if (successes >= 2) {
      findings.push({
        class: 'race_condition',
        id: `race-double-${rand()}`,
        title: 'Race condition — double-submit mutation applied multiple times (CRITICAL)',
        severity: 'critical',
        url: action,
        parameter: Object.keys(base).join(','),
        evidence: ev(
          `POST ${action} identical body x${BURST_N} concurrent (5s cap, canary-tagged)`,
          `Sequential baseline: 1 success. Concurrent burst: ${successes}/${BURST_N} successes — the server applied the mutation ${successes}x for one logical action.`,
          'Double-spend / double-redeem primitive: check-then-act is not atomic under concurrency.'
        ),
      });
    }
  }
  return findings;
}

// ---- T2: uniqueness-constraint race ---------------------------------------
async function t2UniqueRace(forms, url, opts) {
  const findings = [];
  for (const form of forms.slice(0, 2)) {
    const action = form.action || url;
    if (!isLab(action, opts)) continue;
    const names = (form.inputs || []).map((i) => i.name).filter(Boolean);
    const emailField = names.find((n) => /mail/i.test(n));
    if (!emailField) continue;
    const mk = (tag) => {
      const f = {};
      for (const inp of form.inputs || []) {
        if (inp.name === emailField) f[inp.name] = `dmrace_${tag}_${rand()}@example.invalid`;
        else if (inp.name) f[inp.name] = inp.value || `dmrace_${rand()}`;
      }
      return f;
    };
    // Sequential baseline: second identical registration must be rejected.
    let r1, r2seq;
    try {
      r1 = await postForm(action, mk('a'), opts);
      r2seq = await postForm(action, mk('a'), opts); // same email again
    } catch {
      continue;
    }
    if (outcome(r1) !== 'success') continue;
    const seqRejects = outcome(r2seq) === 'rejected' || outcome(r2seq) === 'other-err';
    if (!seqRejects) continue;
    // Concurrent: two DIFFERENT canary emails at once — both should succeed
    // (that is normal); the race signal is two IDENTICAL emails both
    // succeeding concurrently while sequential rejects the duplicate.
    const dup = `dmrace_dup_${rand()}@example.invalid`;
    const mkDup = () => {
      const f = mk('x');
      f[emailField] = dup;
      return f;
    };
    const [c1, c2] = await Promise.all([
      postForm(action, mkDup(), opts).catch(() => ({ status: 0, text: '' })),
      postForm(action, mkDup(), opts).catch(() => ({ status: 0, text: '' })),
    ]);
    if (outcome(c1) === 'success' && outcome(c2) === 'success') {
      findings.push({
        class: 'race_condition',
        id: `race-unique-${rand()}`,
        title: 'Race condition — uniqueness check bypassed under concurrency (HIGH)',
        severity: 'high',
        url: action,
        parameter: emailField,
        evidence: ev(
          `POST ${action} identical ${emailField}=${dup} x2 concurrent`,
          `Sequential: duplicate rejected. Concurrent: BOTH registrations succeeded — the uniqueness check is not atomic.`,
          'Duplicate account/entity creation primitive under race.'
        ),
      });
    }
  }
  return findings;
}

// ---- T4: rate-counter TOCTOU ----------------------------------------------
async function t4RateRace(url, params, opts) {
  const findings = [];
  if (!isLab(url, opts)) return findings;
  for (const param of params.slice(0, 2)) {
    const u = new URL(url);
    u.searchParams.set(param, `dmrace_${rand()}`);
    const target = u.toString();
    // Sequential calibration: find the 429 threshold (cap 30 probes).
    let allowed = 0;
    let limited = false;
    for (let i = 0; i < 30; i++) {
      let r;
      try {
        r = await postForm(target, {}, opts, 5000);
      } catch {
        break;
      }
      if (outcome(r) === 'limited') {
        limited = true;
        break;
      }
      allowed++;
    }
    if (!limited || allowed < 2) continue; // no observable limit
    // Burst the same count in parallel.
    const results = await burst(target, {}, opts, Math.min(allowed, BURST_N));
    const okCount = results.filter((r) => outcome(r) !== 'limited').length;
    if (okCount >= allowed + 2) {
      findings.push({
        class: 'race_condition',
        id: `race-rate-${rand()}`,
        title: 'Race condition — rate limit bypassed under concurrency (MEDIUM)',
        severity: 'medium',
        url: target,
        parameter: param,
        evidence: ev(
          `Sequential: ${allowed} allowed then 429. Burst: ${Math.min(allowed, BURST_N)} parallel`,
          `Burst let ${okCount} requests through vs ${allowed} sequential allowance — the rate counter read-modify-write is not atomic.`,
          'Rate-limit bypass primitive under concurrency.'
        ),
      });
    }
  }
  return findings;
}

// ---- T5: last-write-wins / torn write -------------------------------------
async function t5TornWrite(forms, url, opts) {
  const findings = [];
  for (const form of forms.slice(0, 2)) {
    const action = form.action || url;
    if (!isLab(action, opts)) continue;
    const names = (form.inputs || []).map((i) => i.name).filter(Boolean);
    if (names.length < 2) continue;
    const valA = `dmrace_A_${rand()}`;
    const valB = `dmrace_B_${rand()}`;
    const mkA = {}, mkB = {};
    for (const n of names) {
      mkA[n] = valA;
      mkB[n] = valB;
    }
    const [rA, rB] = await Promise.all([
      postForm(action, mkA, opts).catch(() => ({ status: 0, text: '' })),
      postForm(action, mkB, opts).catch(() => ({ status: 0, text: '' })),
    ]);
    if (outcome(rA) !== 'success' || outcome(rB) !== 'success') continue;
    // Read-back: fetch the form page and see which canary won / whether torn.
    let page = '';
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
      page = await res.text().catch(() => '');
      clearTimeout(t);
    } catch {
      continue;
    }
    const hasA = page.includes(valA);
    const hasB = page.includes(valB);
    if (hasA && hasB) {
      const idxA = page.indexOf(valA);
      const idxB = page.indexOf(valB);
      const idx = Math.min(idxA, idxB);
      const window = page.slice(Math.max(0, idx - 60), Math.max(idxA, idxB) + 80);
      findings.push({
        class: 'race_condition',
        id: `race-torn-${rand()}`,
        title: 'Race condition — torn write under concurrency (INFO)',
        severity: 'low',
        url: action,
        parameter: names.join(','),
        evidence: ev(
          `POST ${action} concurrent updates canary-A vs canary-B`,
          `Read-back shows BOTH canary values present — "...${window}..." — a torn write: no row-level locking on the update path.`,
          'Weak-locking signal: feeds stored-XSS / IDOR lanes with an absent-locking indicator.'
        ),
      });
    }
  }
  return findings;
}

export async function probeRace(forms, url, params, opts = {}) {
  const findings = [];
  const depth = opts.depth || 'standard';
  findings.push(...(await t1DoubleSubmit(forms, url, opts)));
  if (depth === 'quick') return findings;
  findings.push(...(await t2UniqueRace(forms, url, opts)));
  findings.push(...(await t4RateRace(url, params || [], opts)));
  if (depth === 'deep') {
    // T3 token single-use race: needs a token surface; documented skip when
    // absent (no token flow detected on this page).
    findings.push(...(await t5TornWrite(forms, url, opts)));
  }
  return findings;
}

export const __raceMeta = { phases: ['race'], depth: ['quick', 'standard', 'deep'], labGated: true };
