// Dark Matter rule-based scanner — LDAP boolean-blind deep probe (coverage row #203 [High] LDAP Injection).
//
// Closes the gap left by ldapi.js (error-based wildcards only):
//   T1. Boolean oracle inventory — differential baseline matrix. A finding is
//       filed ONLY if wildcard payloads move the login outcome vs the
//       wrong-user baseline in a filter-logic-consistent way.
//   T2. Boolean-blind attribute extraction of OUR OWN canary record —
//       self-verifying: CONFIRMED only if >=3 extracted chars match the KNOWN
//       canary value (never touches another user's data).
//
// Honest limit (documented in docs/scanner/ldap-blind.md): LDAP has NO
// SLEEP()/benchmark primitive — time-based blind LDAP is not a reliable
// class. Any delay must reproduce under a control filter before being cited;
// otherwise it is a documented skip, never a finding.
//
// Token-noise guard (7 Nov 2026 — DVWA false positive, hunt h_fb007db4d145):
//   DVWA login.php embeds a per-request random 32-hex-char CSRF token
//   (hidden input user_token). triple() used to keyword-match the WHOLE
//   response body, and "bad" is a hex-compatible deny keyword, so a baseline
//   token containing "bad" flipped the baseline to deny while the probe
//   tokens did not — a spurious 2/3 fire on a page with no LDAP backend.
//   Signal matching now reads VISIBLE TEXT ONLY (visibleText strips markup,
//   so hidden-input values, nonces and other attribute noise can never flip
//   the signal). The length bucket still uses the raw body length.
// Negative-control veto (same incident): the nonsense wildcard zzz* is a
//   REQUIRED control — if it moves the outcome vs baseline, the oracle is
//   not LDAP-specific and NO finding is filed, however star/paren behave.
//   (In the DVWA incident zzz* moved too and the old 2/3 threshold fired
//   anyway.)
//
// Zerodha guards (9 Nov 2026 — hunt h_6b5942052353, zerodha.com):
//   A Cloudflare "Just a moment..." challenge page made the T1 matrix
//   fire twice on a WordPress site with no LDAP backend at all:
//     /open-account: baseline err:other:15, star err:other:14 — the ONLY
//       difference was the length bucket (challenge page, same outcome
//       words); /varsity/wp-comments-post.php: baseline err:other:17,
//       star err:deny:16 — the moved response WAS the challenge page.
//   Three system-level fixes, all in this file plus oracleGuards.js:
//     (a) SIGNAL-only moves: a wildcard counts as "moved" only when the
//         outcome SIGNAL (allow/deny/other) changes — a length-bucket
//         wobble with identical outcome words is noise, not LDAP logic.
//     (b) BOT-CHALLENGE INVALIDATION: if either baseline is a challenge
//         page the parameter is skipped; a challenged probe leg voids
//         only its own differential (matrix 'challenge') and its text
//         never supplies evidence. If the nonsense control itself is
//         challenged, the finding is blocked — LDAP-specificity cannot
//         be established without it.
//     (c) FP3 double baseline: the wrong-user baseline must reproduce
//         itself (identical triple on a second identical request) or
//         the parameter is skipped — a wobbling baseline confirms nothing.
//   Plus a stack gate: PHP/WordPress stacks skip the probe entirely
//   (no LDAP filter backend exists there).
//
// Depth gating: Quick = T1 only; Standard/Deep = T1 + T2 (T2 needs
// opts.ldapCanary = { user, attr, value }; skipped gracefully when absent).
// Every CONFIRMED verdict sits behind a differential oracle per the 100%
// truth rule. Read-only HTTP, per-run canary values, redirects never followed.
import { probePointName, probePointParameter, noteAttemptedPoints } from '../probePoints.js';
import { isBotChallengePage, isPhpWordpressStack } from './oracleGuards.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

async function postForm(url, fields, opts = {}) {
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
    return {
      status: res.status,
      text: text.slice(0, 200000),
      setCookie: res.headers.get('set-cookie') || '',
      location: res.headers.get('location') || '',
    };
  } finally {
    clearTimeout(t);
  }
}

// Visible text only: strip markup (tags + attribute values) so the outcome
// signal comes from human-readable words, never from per-request random
// values hidden in the page (CSRF tokens, nonces, session ids). Tags are
// replaced with a space so adjacent words do not fuse. Exported for tests.
export function visibleText(text) {
  return String(text || '').replace(/<[^>]*>/g, ' ');
}

// Response triple: status class + outcome keyword signal + length bucket.
// Two responses "match" when their triples are equal — the differential oracle.
// The signal is read from visibleText (see above); the length bucket uses
// the RAW body length (tokens are fixed-length, so the bucket is stable).
// Exported for tests (regression: a token containing "bad" must not flip
// the signal to deny).
export function triple(r) {
  const t = visibleText(r.text).toLowerCase();
  const sig = /welcome|dashboard|successfully|logged in|log out|sign out/i.test(t)
    ? 'allow'
    : /invalid|wrong|incorrect|denied|fail|not found|unknown|does not exist|bad/i.test(t)
      ? 'deny'
      : 'other';
  return `${r.status < 400 ? 'ok' : 'err'}:${sig}:${Math.floor(r.text.length / 400)}`;
}

// Outcome-signal component of a triple ('allow' | 'deny' | 'other').
// A wildcard "moves" the outcome only when this changes — the length
// bucket alone never counts (Zerodha guard (a) above).
function tripleSignal(t) {
  return String(t || '').split(':')[1] || '';
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// Heuristic: which params look like a username/login identifier.
function userParams(params) {
  const re = /user|login|name|mail|uid|account/i;
  const hits = params.filter((p) => re.test(probePointName(p)));
  return hits.length ? hits.slice(0, 3) : params.slice(0, 2);
}

// T1 — boolean oracle inventory. Returns { oracle: bool, matrix, userParam }.
async function t1Oracle(url, params, opts) {
  noteAttemptedPoints(opts, userParams(params));
  const findings = [];
  for (const up of userParams(params)) {
    const wrongUser = `zz_no_such_${rand()}`;
    const base = {};
    base[probePointName(up)] = wrongUser;
    base['password'] = `wrong_${rand()}`;
    let rBase;
    let rBase2;
    try {
      rBase = await postForm(url, base, opts);
      // FP3: the baseline must reproduce itself. Same fields, second
      // request — if the two baselines disagree, the page is noisy and
      // no differential from it can confirm anything.
      rBase2 = await postForm(url, base, opts);
    } catch {
      continue;
    }
    // Bot-challenge invalidation: a challenge page is not the
    // application answering. If either baseline is one, skip the param.
    if (isBotChallengePage(rBase.text) || isBotChallengePage(rBase2.text)) continue;
    if (triple(rBase2) !== triple(rBase)) continue;
    const tBase = triple(rBase);
    // Wildcard battery: each must be filter-logic-consistent.
    const probes = {
      star: '*',
      adminStar: 'admin*',
      zzzStar: `zzz${rand()}*`,
      paren: '*)(uid=*',
    };
    const matrix = { baseline_wrong_user: tBase };
    let consistent = 0;
    let zzzMoved = false; // nonsense-wildcard control: MUST stay at baseline.
    // If zzz* moves the outcome, the oracle is not LDAP-specific (any
    // '*' in the input changes the response) and NO finding may fire,
    // however star/paren behave. This is a veto, not a vote.
    let zzzUnknown = false; // nonsense control challenged: specificity unknown.
    let movedText = null; // response text of the first probe that moved the outcome
    for (const [k, v] of Object.entries(probes)) {
      const f = { ...base, [probePointName(up)]: v };
      let r;
      try {
        r = await postForm(url, f, opts);
      } catch {
        matrix[k] = 'error';
        continue;
      }
      // Bot-challenge invalidation (per leg): a challenged leg voids
      // only its own differential — it counts as neither a move nor a
      // stay, and its text never supplies evidence.
      if (isBotChallengePage(r.text)) {
        matrix[k] = 'challenge';
        if (k === 'zzzStar') zzzUnknown = true;
        continue;
      }
      const t = triple(r);
      matrix[k] = t;
      if (t !== tBase && !movedText) movedText = r.text;
      // Filter-logic consistency, SIGNAL-only: a TRUE wildcard ('*')
      // widening the match should move the OUTCOME; a nonsense wildcard
      // ('zzz*') should not. A length-bucket wobble with the same
      // outcome words is noise, not LDAP logic.
      if (k === 'star' || k === 'paren') {
        if (tripleSignal(t) !== tripleSignal(tBase)) consistent++;
      } else if (k === 'zzzStar') {
        if (t === tBase) consistent++;
        else zzzMoved = true;
      }
    }
    const matrixText = Object.entries(matrix)
      .map(([k, v]) => `${k}=${v}`)
      .join(' | ');
    if (!zzzMoved && !zzzUnknown && consistent >= 2) {
      // Evidence window from VISIBLE text only, so the cited words are the
      // ones that drove the verdict — never a token value.
      const movedVisible = visibleText(movedText || '');
      const m = movedVisible.match(/welcome|dashboard|successfully|logged in|log out|sign out|invalid|wrong|incorrect|denied|fail|not found|unknown|does not exist|bad/i);
      const idx = m ? movedVisible.indexOf(m[0]) : -1;
      const window = idx >= 0 ? movedVisible.slice(Math.max(0, idx - 60), idx + 120) : movedVisible.slice(0, 200);
      findings.push({
        class: 'ldap_injection',
        id: `ldap-oracle-${rand()}`,
        title: 'LDAP injection — boolean oracle detected (filter logic responds to wildcards)',
        severity: 'medium',
        url,
        parameter: probePointParameter(up),
        evidence: ev(
          `POST ${url} ${probePointName(up)}=* / admin* / zzz* / *)(  (vs wrong-user baseline; redirects NOT followed)`,
          `Baseline(wrong user): ${tBase}. Matrix: ${matrixText}. Wildcards moved the outcome in a filter-logic-consistent way (${consistent}/3 checks); nonsense-wildcard control zzz* stayed at baseline. The moved response reads: "...${window.trim()}..."`,
          'Differential oracle established: LDAP filter syntax reaches the directory query. Enables boolean-blind extraction (T2).'
        ),
      });
      return { findings, oracle: true, matrix, userParam: up };
    }
  }
  return { findings, oracle: false, matrix: null, userParam: null };
}

// T2 — boolean-blind extraction of OUR OWN canary attribute.
// opts.ldapCanary = { user, attr, value }. CONFIRMED only if >=3 extracted
// chars match the known canary value (self-verifying oracle).
async function t2Extract(url, userParam, canary, opts) {
  const findings = [];
  const { user, attr, value } = canary;
  const charset = 'abcdefghijklmnopqrstuvwxyz0123456789@._-'.split('');
  const maxLen = Math.min(8, value.length);
  let extracted = '';
  const trueBase = { [probePointName(userParam)]: user, password: `wrong_${rand()}` };
  let rTrue;
  try {
    rTrue = await postForm(url, trueBase, opts);
  } catch {
    return findings;
  }
  // Bot-challenge invalidation: a challenged known-good baseline makes
  // the whole extraction channel unusable.
  if (isBotChallengePage(rTrue.text)) return findings;
  const tTrue = triple(rTrue);
  for (let i = 0; i < maxLen; i++) {
    let hit = null;
    for (const ch of charset) {
      const guess = extracted + ch;
      // Truth leg: filter matches iff the prefix is right.
      const fTrue = {
        [probePointName(userParam)]: `(&(uid=${user})(${attr}=${guess}*))`,
        password: `wrong_${rand()}`,
      };
      // False control: same shape, impossible value.
      const fFalse = {
        [probePointName(userParam)]: `(&(uid=${user})(${attr}=${guess}zzz${rand()}*))`,
        password: `wrong_${rand()}`,
      };
      let rT, rF;
      try {
        rT = await postForm(url, fTrue, opts);
        rF = await postForm(url, fFalse, opts);
      } catch {
        break;
      }
      // Bot-challenge invalidation: a challenged leg voids this guess.
      if (isBotChallengePage(rT.text) || isBotChallengePage(rF.text)) break;
      // Decision: true leg must differ from the false control in the same
      // direction as the known-good baseline differs from wrong-user.
      if (triple(rT) !== triple(rF) && triple(rT) === tTrue) {
        hit = ch;
        break;
      }
    }
    if (!hit) break;
    extracted += hit;
  }
  // Self-verify against the KNOWN canary value.
  let match = 0;
  for (let i = 0; i < extracted.length; i++) {
    if (value[i] === extracted[i]) match++;
  }
  if (match >= 3 && extracted.length >= 3) {
    findings.push({
      class: 'ldap_injection',
      id: `ldap-blind-${rand()}`,
      title: 'LDAP injection — boolean-blind attribute extraction (HIGH)',
      severity: 'high',
      url,
      parameter: probePointParameter(userParam),
      evidence: ev(
        `POST ${url} ${probePointName(userParam)}=(&(uid=${user})(${attr}=<prefix>*)) char-by-char, false-control per guess (redirects NOT followed)`,
        `Extracted "${extracted}" from our OWN canary record; ${match}/${extracted.length} chars match the known canary value "${value}". Self-verifying oracle: the boolean channel is proven without touching another user's data.`,
        'Proves attacker-controlled LDAP filter logic with a working boolean oracle — full directory attribute extraction primitive.'
      ),
    });
  }
  return findings;
}

export async function probeLdapBlind(url, params, opts = {}) {
  const findings = [];
  // Stack gate: no LDAP filter backend exists on PHP/WordPress stacks.
  if (isPhpWordpressStack(opts.stack)) return findings;
  const depth = opts.depth || 'standard';
  if (!params || params.length === 0) return findings;
  const { findings: f1, oracle, userParam } = await t1Oracle(url, params, opts);
  findings.push(...f1);
  if (depth === 'quick') return findings;
  if (oracle && opts.ldapCanary && opts.ldapCanary.user) {
    findings.push(...(await t2Extract(url, userParam, opts.ldapCanary, opts)));
  }
  return findings;
}

export const __ldapBlindMeta = { phases: ['ldap-blind'], depth: ['quick', 'standard', 'deep'] };
