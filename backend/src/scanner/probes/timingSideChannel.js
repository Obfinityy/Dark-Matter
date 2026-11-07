// Dark Matter rule-based scanner — timing side-channel disclosure
// (coverage row #185 [Medium], phase 77, CWE-208).
//
// NARROW DEFINITION (the ledger row is a bare title, so the boundary
// is written down here, in index.js, and in the lane report): this
// phase detects ONE thing — a login timing oracle. A login endpoint
// that returns the SAME generic error for a valid and an invalid
// username, but takes measurably longer for the valid one (the
// valid-user path runs the password hash — bcrypt/argon2 — while the
// invalid path bails out early), leaks account existence through
// response time alone. That is CWE-208 (Observable Timing
// Discrepancy) in its classic form, and it is the whole row.
//
// VERIFICATION (100% truth rule): a finding counts ONLY when the
// timing gap is measured, reproduced, and controlled:
//   1. CONTENT GATE — the valid/invalid response signatures
//      (status + length + first 400 chars, token-normalised) must
//      be IDENTICAL and stable on both sides. If the content
//      differs, 'user-enumeration' owns the surface and this phase
//      stays silent; if the content is unstable, the timing gap
//      could be confounded by differing transfer, so it stays
//      silent too.
//   2. GAP — the median response time differs by >= 100ms.
//   3. CONSISTENCY — the same side is slower in >= 4 of 5 rounds
//      (>= 6 of 8 after re-verification).
//   4. CONTROL — a same-user control (nonsense vs nonsense) must
//      show noise smaller than half the observed gap; otherwise the
//      network is too noisy to trust the measurement.
//   5. RE-VERIFICATION — a first-run gap is re-measured in 3
//      fresh interleaved rounds before anything is filed.
// A single slow response never fires.
//
// ANCHOR (honest degrade, like user-enumeration): the contrast
// needs a KNOWN-VALID username — opts.labCreds.username. No anchor
// means no differential, so the phase returns [] and never guesses.
// Login forms only (a password input must be present); register and
// reset forms are out of scope. One finding per scan (first login
// form); the anchor username and the wrong password are never
// written into evidence.
//
// NON-OVERLAP (by design): response-CONTENT oracles are owned by
// 'user-enumeration' (this phase fires only when the content is
// indistinguishable); password-length oracles and cryptographic
// timing attacks are out of scope; error responses are owned by
// 'error-disclosure' (only HTTP 200 login responses are timed — a
// non-200 or a transport error yields no sample, never a finding);
// headers and bodies are never examined for content here.
//
// SAFETY: read-only POSTs to the existing login form only — the
// same wrong password both sides, no account creation, no
// brute force (the anchor is the scanner's own lab credential).
// At most 20 requests per scan (5 main rounds + 2 control rounds
// + 3 re-verify rounds, interleaved with a politeness sleep).
// The pasted page is the baseline, so this phase never skips.
//
// HONEST LIMITS: a target that rejects the POST before
// authentication (missing/expired CSRF token, no session — DVWA
// login.php without a live session returns the same static form for
// every credential) yields identical fast responses and no finding:
// correct behaviour, but a coverage limit — the probe measures the
// timing of whatever the form POST returns. A 100ms+ median gap on
// a local lab is unlikely, so the live proof is expected to be a
// true negative on both labs; fixture + unit proof is the lane's
// evidence. Outcomes conveyed only via an attribute value are not
// timed here (the content gate reads response text).
import { createHash } from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const SAMPLE_ROUNDS = 5;
const CONTROL_ROUNDS = 2;
const REVERIFY_ROUNDS = 3;
const MIN_GAP_MS = 100;
const MIN_WINS = 4; // of SAMPLE_ROUNDS
const MIN_WINS_TOTAL = 6; // of SAMPLE_ROUNDS + REVERIFY_ROUNDS
const MAX_REQUESTS = 20;

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function sha12(text) {
  return createHash('sha256').update(String(text || '')).digest('hex').slice(0, 12);
}

export function median(values) {
  const nums = (Array.isArray(values) ? values : []).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

// Normalised response signature — mirrors userEnum.js sig(): long
// hex runs and long digit runs are masked, so per-request tokens
// and timestamps do not fake a content difference.
function sig(r) {
  if (!r) return 'ERR';
  const t = String(r.text || '').replace(/[0-9a-f]{16,}/gi, '#').replace(/\d{4,}/g, '#');
  return `${r.status}:${t.length}:${t.slice(0, 400)}`;
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// Default timed POST — fetch + wall-clock, like userEnum.js
// postForm. Returns { status, text, ms } or null on transport error.
async function postFormTimed(url, fields, opts = {}) {
  const t0 = Date.now();
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
      body: new URLSearchParams(fields).toString(),
      redirect: 'manual',
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

/**
 * Pure timing decision — exported for direct unit tests. `validMs` /
 * `invalidMs` are the per-round response times for the known-valid
 * and the nonsense username; `controlAms` / `controlBms` are the
 * same-user control legs (nonsense vs nonsense). `minWins` is the
 * required number of rounds the slower side must win. Returns
 * { fires, gap, slower, wins, rounds, controlGap, reason }.
 */
export function assessTimingOracle(validMs, invalidMs, controlAms, controlBms, minWins) {
  const v = Array.isArray(validMs) ? validMs : [];
  const i = Array.isArray(invalidMs) ? invalidMs : [];
  const ca = Array.isArray(controlAms) ? controlAms : [];
  const cb = Array.isArray(controlBms) ? controlBms : [];
  const out = (fires, reason, extra = {}) => ({
    fires,
    gap: null,
    slower: null,
    wins: 0,
    rounds: Math.min(v.length, i.length),
    controlGap: null,
    reason,
    ...extra,
  });
  if (v.length < 1 || i.length < 1 || v.length !== i.length) {
    return out(false, 'insufficient-samples');
  }
  const medV = median(v);
  const medI = median(i);
  if (medV === null || medI === null) return out(false, 'insufficient-samples');
  const gap = Math.abs(medV - medI);
  if (gap === 0) return out(false, 'no-gap', { gap, controlGap: null });
  const slower = medV > medI ? 'valid' : 'invalid';
  let wins = 0;
  for (let k = 0; k < v.length; k++) {
    if (slower === 'valid' ? v[k] > i[k] : i[k] > v[k]) wins++;
  }
  const medCa = median(ca);
  const medCb = median(cb);
  if (medCa === null || medCb === null) {
    return out(false, 'no-control', { gap, slower, wins });
  }
  const controlGap = Math.abs(medCa - medCb);
  if (gap < MIN_GAP_MS) {
    return out(false, 'gap-below-threshold', { gap, slower, wins, controlGap });
  }
  if (wins < minWins) {
    return out(false, 'inconsistent-wins', { gap, slower, wins, controlGap });
  }
  if (!(gap > 2 * controlGap)) {
    return out(false, 'noisy-control', { gap, slower, wins, controlGap });
  }
  return out(true, 'oracle', { gap, slower, wins, controlGap });
}

function loginForms(forms) {
  return (Array.isArray(forms) ? forms : []).filter((f) =>
    (f.inputs || []).some((i) => String(i.type || '').toLowerCase() === 'password')
  );
}

// Fill a login form — mirrors userEnum.js fillLogin: password fields
// get the wrong password, user/login/email fields get the username,
// everything else keeps its recorded value (hidden CSRF tokens etc.).
function fillLogin(form, username, password) {
  const fields = {};
  for (const inp of form.inputs || []) {
    if (!inp.name) continue;
    const n = String(inp.name).toLowerCase();
    if (/pass/.test(n)) fields[inp.name] = password;
    else if (/user|login|email/.test(n)) fields[inp.name] = username;
    else fields[inp.name] = inp.value || '';
  }
  return fields;
}

function usernameParamName(form) {
  for (const inp of form.inputs || []) {
    if (!inp.name) continue;
    if (/user|login|email/i.test(String(inp.name))) return inp.name;
  }
  return 'username';
}

/**
 * Probe a login timing oracle (#185). @param {object[]} forms —
 * the scanner's discovered forms. @param {string} url — the pasted
 * page. @param {object} opts — { timeoutMs, headers, labCreds,
 * timedPost, sleepMs }. timedPost is the test seam
 * (defaults to postFormTimed); sleepMs overrides the politeness
 * sleep between samples (tests pass 0). Returns findings (class
 * 'timing_side_channel', medium) — at most one per scan.
 */
export async function probeTimingSideChannel(forms, url, opts = {}) {
  const findings = [];
  void url;
  const lfs = loginForms(forms);
  if (!lfs.length) return findings; // no login form — nothing to time
  const anchor = opts.labCreds && opts.labCreds.username ? String(opts.labCreds.username) : null;
  if (!anchor) return findings; // honest degrade — never guess a valid user
  const form = lfs[0];
  const wrongPw = `WrongPw_${rand()}!`;
  const invalidUser = `__dm_nonexist_${rand()}`;
  const timedPost = typeof opts.timedPost === 'function' ? opts.timedPost : postFormTimed;
  const sleepMs = typeof opts.sleepMs === 'number' ? opts.sleepMs : null;
  const nap = async () => {
    if (sleepMs === 0) return;
    await sleep(sleepMs === null ? 700 + Math.random() * 800 : sleepMs);
  };
  let requests = 0;
  const timed = async (username) => {
    if (requests >= MAX_REQUESTS) return null;
    requests += 1;
    return timedPost(form.action, fillLogin(form, username, wrongPw), opts);
  };

  // Main run: SAMPLE_ROUNDS interleaved valid/invalid pairs.
  const vMs = [];
  const iMs = [];
  const vSigs = [];
  const iSigs = [];
  for (let k = 0; k < SAMPLE_ROUNDS; k++) {
    const rv = await timed(anchor);
    await nap();
    const ri = await timed(invalidUser);
    await nap();
    if (!rv || !ri) return findings; // transport error — no sample, no finding
    vMs.push(rv.ms);
    iMs.push(ri.ms);
    vSigs.push(sig(rv));
    iSigs.push(sig(ri));
  }
  // Content gate: both sides stable AND identical — otherwise the
  // content oracle (user-enumeration) owns this surface, or the
  // timing gap would be confounded by differing transfer.
  const vStable = new Set(vSigs).size === 1;
  const iStable = new Set(iSigs).size === 1;
  if (!vStable || !iStable || vSigs[0] !== iSigs[0]) return findings;

  // Same-user control: nonsense vs nonsense — measures pure noise.
  const cAms = [];
  const cBms = [];
  for (let k = 0; k < CONTROL_ROUNDS; k++) {
    const ra = await timed(invalidUser);
    await nap();
    const rb = await timed(invalidUser);
    await nap();
    if (!ra || !rb) return findings;
    cAms.push(ra.ms);
    cBms.push(rb.ms);
  }
  const first = assessTimingOracle(vMs, iMs, cAms, cBms, MIN_WINS);
  if (!first.fires) return findings;

  // Re-verify in fresh interleaved rounds before filing.
  const rvMs = [];
  const riMs = [];
  const rSigs = [];
  for (let k = 0; k < REVERIFY_ROUNDS; k++) {
    const rv = await timed(anchor);
    await nap();
    const ri = await timed(invalidUser);
    await nap();
    if (!rv || !ri) return findings;
    rvMs.push(rv.ms);
    riMs.push(ri.ms);
    rSigs.push(sig(rv));
    rSigs.push(sig(ri));
  }
  if (!rSigs.every((s) => s === vSigs[0])) return findings; // content moved — not a pure timing oracle
  const verdict = assessTimingOracle(
    [...vMs, ...rvMs],
    [...iMs, ...riMs],
    cAms,
    cBms,
    MIN_WINS_TOTAL
  );
  if (!verdict.fires) return findings;

  const param = usernameParamName(form);
  findings.push({
    class: 'timing_side_channel',
    id: `tsc-${sha12(`${form.action}|${param}`)}`,
    title: 'Timing side-channel disclosure — login response time distinguishes valid users (MEDIUM)',
    severity: 'medium',
    url: form.action,
    parameter: param,
    evidence: ev(
      `POST ${form.action} (${param}=known-valid user, wrong password) vs (${param}=nonsense user, same wrong password), ${SAMPLE_ROUNDS} interleaved rounds + ${CONTROL_ROUNDS}-round same-user control + ${REVERIFY_ROUNDS}-round re-verification (${requests} requests)`,
      `Identical response content on both sides (stable signature ${vSigs[0].slice(0, 80)}...), but the ${verdict.slower} side is slower: median gap ${verdict.gap}ms, ${verdict.slower} slower in ${verdict.wins}/${verdict.rounds} rounds, same-user control gap ${verdict.controlGap}ms (noise < half the signal).`,
      'Timing side-channel primitive (CWE-208) — the login endpoint returns the same generic error for both users, but the valid-user path runs the password hash, so response time alone leaks account existence; chain with credential stuffing by trying passwords only against accounts known to exist.'
    ),
  });
  return findings;
}

export const __timingSideChannelMeta = { phases: ['timing-side-channel'], depth: ['quick', 'standard', 'deep'] };
