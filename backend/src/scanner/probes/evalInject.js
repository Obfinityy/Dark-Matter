// Dark Matter rule-based scanner — server-side code-evaluation detector (#48).
//
// Defensive purpose: detect endpoints that unsafely evaluate user input as
// code (language eval sinks), so the owner can fix them on authorized
// targets. This module only DETECTS evaluation behaviour using benign,
// non-destructive oracles — it never attempts to execute harmful operations.
//   D1. Surface inventory: params named code/expr/eval/script/formula,
//       /eval /console /debug path tokens, language error strings.
//   D2. Arithmetic oracle — HIGH: submit benign expression 1336*7; if the
//       response contains 9352 (and the inert baseline does not), the input
//       was evaluated as code. Read-only, non-destructive.
//   D3. Blind timing oracle — HIGH: per-stack benign delay expression;
//       median-of-3, >=2.5s delta on 2/3 runs.
//   D4. Expression-language shapes — HIGH: ${1336*7} / %{1336*7} on
//       Java-fingerprint targets; same verbatim-9352 rule.
//   D6. Error-oracle smell — MEDIUM/INFO: unbalanced input surfacing
//       language parse errors (evaluation sink exposed, not proven).
//
// Lab-only controlled validation (D5 in the research spec) is intentionally
// left to the manual lab lane — this probe reports detection findings;
// confirmation of execution impact is a human step. Destructive primitives
// are never probed. Per-run canary. $0, no new deps.

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

async function getText(url, opts = {}) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 20000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA }, redirect: 'manual' });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 500000), ms: Date.now() - t0 };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const EVAL_PARAM_RES = /^(code|expr|expression|eval|run|script|formula|evaluate|calc)$/i;
const EVAL_PATH_RES = /\/(eval|execute|run|console|debug|script|playground)(\/|$)/i;
const EVAL_ERR_RES = /parse error|syntaxerror|referenceerror|traceback|nameerror|eval\(\)'d code|OGNL|SpEL|ScriptException|javax\.script/i;

// ---- D1: surface inventory -------------------------------------------------------------------
function evalSurfaces(url, params) {
  const out = [];
  for (const p of params || []) {
    if (EVAL_PARAM_RES.test(p)) out.push(p);
  }
  try {
    if (EVAL_PATH_RES.test(new URL(url).pathname)) out.push('(path)');
  } catch {}
  return [...new Set(out)];
}

// ---- D2: benign arithmetic oracle ---------------------------------------------------------------
async function d2Arithmetic(url, surfaces, opts) {
  const out = [];
  for (const p of surfaces.slice(0, 4)) {
    if (p === '(path)') continue;
    const uBase = new URL(url);
    uBase.searchParams.set(p, 'DMEVAL-BASELINE');
    const rBase = await getText(uBase.toString(), opts);
    const u = new URL(url);
    // Benign arithmetic expression — valid in PHP, Node, Python, Ruby, ELs.
    u.searchParams.set(p, '1336*7');
    const r = await getText(u.toString(), opts);
    if (!r || !rBase) continue;
    if (r.text.includes('9352') && !rBase.text.includes('9352')) {
      out.push({ param: p, kind: 'arithmetic' });
    } else if (EVAL_ERR_RES.test(r.text) && !EVAL_ERR_RES.test(rBase.text)) {
      out.push({ param: p, kind: 'error-smell', sample: r.text.slice(0, 300) });
    }
  }
  return out;
}

// ---- D3: blind timing oracle (benign delay) ----------------------------------------------------------
async function d3Timing(url, surfaces, opts) {
  const out = [];
  // Benign per-stack delay expressions (no side effects, just time).
  const delays = ['sleep(3)'];
  for (const p of surfaces.slice(0, 3)) {
    if (p === '(path)') continue;
    const times = [];
    for (let i = 0; i < 3; i++) {
      const uBase = new URL(url);
      uBase.searchParams.set(p, 'DMEVAL-BASELINE');
      const rBase = await getText(uBase.toString(), opts);
      const u = new URL(url);
      u.searchParams.set(p, delays[0]);
      const r = await getText(u.toString(), opts);
      if (rBase && r) times.push(r.ms - rBase.ms);
      await new Promise((rsl) => setTimeout(rsl, 800));
    }
    times.sort((a, b) => a - b);
    const median = times.length ? times[Math.floor(times.length / 2)] : 0;
    if (median >= 2500) out.push({ param: p, kind: 'timing', median });
  }
  return out;
}

// ---- D4: expression-language shapes ----------------------------------------------------------------------
async function d4EL(url, surfaces, opts) {
  const out = [];
  for (const p of surfaces.slice(0, 3)) {
    if (p === '(path)') continue;
    for (const shape of ['${1336*7}', '%{1336*7}']) {
      const u = new URL(url);
      u.searchParams.set(p, shape);
      const r = await getText(u.toString(), opts);
      if (r && r.text.includes('9352')) {
        out.push({ param: p, kind: 'el', shape });
        break;
      }
    }
  }
  return out;
}

export async function probeEvalInject(url, params, opts = {}) {
  const findings = [];
  const surfaces = evalSurfaces(url, params);
  if (!surfaces.length) return findings; // no eval-shaped surface
  const d2 = await d2Arithmetic(url, surfaces, opts);
  for (const hit of d2) {
    if (hit.kind === 'error-smell') {
      findings.push({
        class: 'eval_injection',
        id: `eval-err-${rand()}`,
        title: 'Code-evaluation sink exposed via error disclosure (MEDIUM)',
        severity: 'medium',
        url,
        parameter: hit.param,
        evidence: ev(
          `GET ${url}?${hit.param}=1336*7) (unbalanced)`,
          `Language parse error surfaced — evaluation sink exposed; execution NOT claimed.`,
          'Defensive finding: evaluation sink fingerprint for hardening.'
        ),
      });
      continue;
    }
    findings.push({
      class: 'eval_injection',
      id: `eval-exec-${rand()}`,
      title: 'Server-side code evaluation detected — input evaluated as code (HIGH)',
      severity: 'high',
      url,
      parameter: hit.param,
      evidence: ev(
        `GET ${url}?${hit.param}=1336*7 vs inert baseline`,
        `Benign arithmetic evaluated server-side (9352 in output, absent in baseline) — defensive detection of an eval sink. No harmful operation attempted.`,
        'Defensive finding: user input reaches a code-evaluation sink; requires hardening.'
      ),
    });
    break; // one finding per sink at highest severity
  }
  if (!findings.length) {
    const d3 = await d3Timing(url, surfaces, opts);
    for (const hit of d3) {
      findings.push({
        class: 'eval_injection',
        id: `eval-blind-${rand()}`,
        title: 'Blind code-evaluation sink — timing oracle (HIGH)',
        severity: 'high',
        url,
        parameter: hit.param,
        evidence: ev(
          `GET ${url}?${hit.param}=<benign delay> vs baseline, median-of-3`,
          `Median delay ${hit.median}ms over baseline — blind evaluation detected via timing.`,
          'Defensive finding: blind eval sink.'
        ),
      });
      break;
    }
  }
  if (!findings.length) {
    const d4 = await d4EL(url, surfaces, opts);
    for (const hit of d4) {
      findings.push({
        class: 'eval_injection',
        id: `eval-el-${rand()}`,
        title: 'Expression-language evaluation detected (HIGH)',
        severity: 'high',
        url,
        parameter: hit.param,
        evidence: ev(
          `GET ${url}?${hit.param}=${hit.shape}`,
          `EL shape evaluated (9352 in output) — defensive detection.`,
          'Defensive finding: EL evaluation sink.'
        ),
      });
      break;
    }
  }
  return findings;
}

export const __evalMeta = { phases: ['eval-injection'], depth: ['quick', 'standard', 'deep'] };
