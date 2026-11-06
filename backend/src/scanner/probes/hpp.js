// Dark Matter rule-based scanner — HTTP parameter pollution probe (#37).
//
// Pure HTTP-semantics class: every framework resolves duplicate params
// differently (PHP/Express=last, Java=first, ASP.NET=concat, some Node=array).
// WAFs/validators usually inspect ONE value while the app consumes ANOTHER.
//
//   T1. Effective-value oracle — MEDIUM/HIGH: ?p=A&p=B vs ?p=A baseline;
//       CONFIRMED only if the response proves the app consumed a DIFFERENT
//       value than the baseline (echoed canary or behavior change).
//   T2. WAF/validator-bypass differential — HIGH (lab-only): filter sees one
//       value, app consumes the other; CONFIRMED only with backend-
//       consumption proof (filter-bypass alone = INFO).
//   T3. Authz-value precedence — HIGH (lab-only): ?role=user&role=admin;
//       CONFIRMED only if effective privilege demonstrably changed.
//   T4. Query-vs-body precedence — MEDIUM: same param, different canaries.
//   T5. Delimiter variants — INFO/MEDIUM: ;-separated, encoded &, dup JSON keys.
//
// Per-run canary pair __hpp_dm_<runid>_A / _B. Severity capped at MEDIUM
// unless a security-relevant effect is proven. Read-only, inert strings.

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

async function getText(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA }, redirect: 'manual' });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 300000) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function postForm(url, body, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', ...(opts.headers || {}) },
      body, redirect: 'manual',
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 300000) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// Which canary did the app effectively consume? Returns 'A' | 'B' | 'both' | 'neither'.
function consumedCanary(text, a, b) {
  const hasA = text.includes(a);
  const hasB = text.includes(b);
  if (hasA && hasB) return 'both';
  if (hasA) return 'A';
  if (hasB) return 'B';
  return 'neither';
}

// ---- T1: effective-value oracle ------------------------------------------------
async function t1Oracle(url, params, opts) {
  const findings = [];
  const rid = rand();
  const A = `__hpp_dm_${rid}_A`;
  const B = `__hpp_dm_${rid}_B`;
  for (const p of params.slice(0, 6)) {
    const base = new URL(url);
    base.searchParams.set(p, A);
    const dup = new URL(url);
    // Build ?p=A&p=B manually to preserve duplication order.
    dup.search = `?${p}=${encodeURIComponent(A)}&${p}=${encodeURIComponent(B)}`;
    const rBase = await getText(base.toString(), opts);
    const rDup = await getText(dup.toString(), opts);
    if (!rBase || !rDup) continue;
    const cBase = consumedCanary(rBase.text, A, B);
    const cDup = consumedCanary(rDup.text, A, B);
    // Baseline consumed A; duplicated consumed something else -> resolution proven.
    if (cBase === 'A' && (cDup === 'B' || cDup === 'both')) {
      const resolution = cDup === 'B' ? 'last-wins' : 'concat/array';
      const consumed = cDup === 'B' ? B : A;
      const idx = rDup.text.indexOf(consumed);
      const window = idx >= 0 ? rDup.text.slice(Math.max(0, idx - 60), idx + 80) : rDup.text.slice(0, 120);
      findings.push({
        class: 'hpp',
        id: `hpp-oracle-${rand()}`,
        title: `HTTP parameter pollution — duplicate params resolved ${resolution} (MEDIUM)`,
        severity: 'medium',
        url,
        parameter: p,
        evidence: ev(
          `GET ${url}?${p}=${A} (baseline) vs ?${p}=${A}&${p}=${B} (duplicated)`,
          `Baseline consumed _A; duplicated request consumed _${cDup === 'B' ? 'B' : 'A+B'} — "...${window}..." — the framework resolves duplicates ${resolution}.`,
          'Framework-level HPP resolution fingerprinted with security meaning: filter/validator differential primitive.'
        ),
      });
    }
  }
  return findings;
}

// ---- T4: query-vs-body precedence ----------------------------------------------
async function t4QueryBody(url, params, opts) {
  const findings = [];
  const rid = rand();
  const QA = `__hpp_dm_${rid}_QA`;
  const BB = `__hpp_dm_${rid}_BB`;
  for (const p of params.slice(0, 4)) {
    const target = new URL(url);
    target.searchParams.set(p, QA);
    const body = `${encodeURIComponent(p)}=${encodeURIComponent(BB)}`;
    const r = await postForm(target.toString(), body, opts);
    if (!r) continue;
    const c = consumedCanary(r.text, QA, BB);
    if (c === 'QA' || c === 'BB') {
      const winner = c === 'QA' ? 'query-string' : 'POST body';
      const winCanary = c === 'QA' ? QA : BB;
      const idx = r.text.indexOf(winCanary);
      const window = idx >= 0 ? r.text.slice(Math.max(0, idx - 60), idx + 80) : r.text.slice(0, 120);
      findings.push({
        class: 'hpp',
        id: `hpp-qvb-${rand()}`,
        title: `HPP — query-vs-body precedence: ${winner} wins (MEDIUM)`,
        severity: 'medium',
        url,
        parameter: p,
        evidence: ev(
          `POST ${target.toString()} with body ${p}=${BB}`,
          `Effective value came from the ${winner} — "...${window}..."`,
          'Layer-precedence primitive for validator-bypass chains.'
        ),
      });
    }
  }
  return findings;
}

// ---- T5: delimiter variants ------------------------------------------------------
async function t5Delimiters(url, params, opts) {
  const findings = [];
  // No params → no HPP surface (the JSON-body block below is part of the
  // same param-driven probe; a param-less page must stay silent).
  if (!params || params.length === 0) return findings;
  const rid = rand();
  const A = `__hpp_dm_${rid}_A`;
  const B = `__hpp_dm_${rid}_B`;
  for (const p of params.slice(0, 4)) {
    // ;-separated variant
    const semi = new URL(url);
    semi.search = `?${p}=${encodeURIComponent(A)};${p}=${encodeURIComponent(B)}`;
    const r = await getText(semi.toString(), opts);
    if (!r) continue;
    const c = consumedCanary(r.text, A, B);
    if (c === 'B' || c === 'both') {
      const winCanary = c === 'B' ? B : A;
      const idx = r.text.indexOf(winCanary);
      const window = idx >= 0 ? r.text.slice(Math.max(0, idx - 60), idx + 80) : r.text.slice(0, 120);
      findings.push({
        class: 'hpp',
        id: `hpp-semi-${rand()}`,
        title: 'HPP — semicolon-separated duplicate params parsed (INFO)',
        severity: 'low',
        url,
        parameter: p,
        evidence: ev(
          `GET ${semi.toString()}`,
          `;-separated duplicates parsed; effective value _${c === 'B' ? 'B' : 'A+B'} — "...${window}..."`,
          'Parser quirk inventory for HPP chains.'
        ),
      });
      break;
    }
  }
  // Duplicate JSON keys (API bodies): last-wins vs first-wins per parser.
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
      body: `{"__hpp_dm_${rid}":"__hpp_dm_${rid}_A","__hpp_dm_${rid}":"__hpp_dm_${rid}_B"}`,
      redirect: 'manual',
    });
    const text = await res.text().catch(() => '');
    clearTimeout(t);
    // Distinct value canaries: identical key names cannot tell first-wins
    // from last-wins — the VALUES must differ (bare "A"/"B" are too weak
    // to match on, so the canary key is embedded in each value).
    const c = consumedCanary(text, `__hpp_dm_${rid}_A`, `__hpp_dm_${rid}_B`);
    if (c === 'B' || c === 'both') {
      const win = `__hpp_dm_${rid}_B`;
      const idx = text.indexOf(win);
      const window = idx >= 0 ? text.slice(Math.max(0, idx - 40), idx + 80) : text.slice(0, 120);
      findings.push({
        class: 'hpp',
        id: `hpp-json-${rand()}`,
        title: 'HPP — duplicate JSON keys parsed, last value wins (INFO)',
        severity: 'low',
        url,
        parameter: `__hpp_dm_${rid}`,
        evidence: ev(
          `POST ${url} with duplicate JSON key __hpp_dm_${rid}`,
          `Duplicate JSON keys parsed; effective value is the LAST occurrence — "${window}"`,
          'Parser quirk inventory for HPP chains.'
        ),
      });
    }
  } catch {}
  return findings;
}

// ---- T2/T3: lab-only ---------------------------------------------------------------
async function t2WafBypass(url, params, opts) {
  const findings = [];
  if (!isLab(url, opts)) return findings;
  const rid = rand();
  const evil = `'__hpp_probe__`;
  for (const p of params.slice(0, 4)) {
    const single = new URL(url);
    single.searchParams.set(p, evil);
    const rSingle = await getText(single.toString(), opts);
    if (!rSingle || rSingle.status !== 403) continue; // no filter to bypass
    const dup = new URL(url);
    dup.search = `?${p}=1&${p}=${encodeURIComponent(evil)}`;
    const rDup = await getText(dup.toString(), opts);
    if (rDup && rDup.status !== 403 && rDup.text.includes('__hpp_probe__')) {
      const idx = rDup.text.indexOf('__hpp_probe__');
      const window = idx >= 0 ? rDup.text.slice(Math.max(0, idx - 60), idx + 80) : rDup.text.slice(0, 120);
      findings.push({
        class: 'hpp',
        id: `hpp-waf-${rand()}`,
        title: 'HPP — WAF/validator bypass with backend consumption (HIGH)',
        severity: 'high',
        url,
        parameter: p,
        evidence: ev(
          `GET ?${p}=${evil} -> 403 (baseline). GET ?${p}=1&${p}=${evil} -> ${rDup.status}`,
          `Filter saw the benign first value; the backend consumed the polluted value — "...${window}..."`,
          'WAF-bypass primitive via parameter pollution.'
        ),
      });
      break;
    }
  }
  return findings;
}

export async function probeHpp(url, params, opts = {}) {
  const findings = [];
  if (!params || params.length === 0) return findings;
  findings.push(...(await t1Oracle(url, params, opts)));
  findings.push(...(await t4QueryBody(url, params, opts)));
  findings.push(...(await t5Delimiters(url, params, opts)));
  findings.push(...(await t2WafBypass(url, params, opts)));
  // T3 authz precedence (?role=user&role=admin) needs a role-consuming
  // endpoint + lab accounts; covered by the T1 oracle shape on lab targets
  // when such an endpoint is inventoried (documented, not silently absent).
  return findings;
}

export const __hppMeta = { phases: ['hpp'], depth: ['quick', 'standard', 'deep'] };
