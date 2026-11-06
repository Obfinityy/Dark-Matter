// Dark Matter rule-based scanner — OGNL injection probe (#425, Struts2).
//
// Defensive purpose: detect Struts2 endpoints that evaluate OGNL in user
// input, so the owner can remediate on authorized targets. Detection uses
// benign math-evaluation oracles ONLY — the differential is
// control-literal vs evaluated-9352, identical in spirit to the SSTI/EL
// probes.
//
// ⚠️ RCE-confirmation payloads (e.g.
// `%{#context['xwork.MethodAccessor.denyMethodExecution']=false}` and any
// static-method / command-execution shape) are NEVER sent — they can lead
// to remote code execution on a real Struts2 app. Full OGNL exploit
// confirmation is manual-lab-only (see docs/scanner/el-ognl-injection.md).
// Detection = math-evaluation differential only. Read-only GET.

import { randomBytes } from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return randomBytes(3).toString('hex');
}

async function getText(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
      redirect: 'manual',
    });
    const text = await res.text().catch(() => '');
    const headers = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    return { status: res.status, text: text.slice(0, 500000), headers };
  } finally {
    clearTimeout(t);
  }
}

function withParam(url, name, value) {
  const u = new URL(url);
  u.searchParams.set(name, value);
  return u.toString();
}

// Targeting: Struts2 action URLs, or a Struts marker in the baseline
// response (headers or body). Keeps the math tests honest — no blind
// OGNL-shaped traffic at non-Struts targets.
const STRUTS_ACTION_RE = /\.(action|do)(\?|#|;|$)/i;
const STRUTS_PATH_RE = /struts/i;
const STRUTS_MARKER_RE = /struts|org\.apache\.struts/i;
const STRUTS_BODY_RE = /Welcome to Struts2|struts\.tags|struts-tags|org\.apache\.struts|Struts Problem Report/i;

const OGNL_PAYLOADS = [
  { payload: '%{1336*7}', expect: '9352' },
  { payload: '${1336*7}', expect: '9352' },
];

export async function probeOgnlInject(url, params, opts = {}) {
  const findings = [];
  let u;
  try {
    u = new URL(url);
  } catch {
    return findings;
  }
  const pathHit = STRUTS_ACTION_RE.test(u.pathname) || STRUTS_PATH_RE.test(u.pathname);

  // One baseline GET: powers the Struts fingerprint AND the targeting call.
  let base = null;
  try {
    base = await getText(url, opts);
  } catch {
    base = null;
  }
  let markerSource = '';
  if (base) {
    markerSource = `${base.headers['x-powered-by'] || ''} ${base.headers['server'] || ''} ${base.text.slice(0, 30000)}`;
  }
  const markerHit = STRUTS_MARKER_RE.test(markerSource) || STRUTS_BODY_RE.test(markerSource);

  // Struts version/identity disclosure — info only, supports targeting honesty.
  if (markerHit) {
    const sample = (base.headers['x-powered-by'] || '').slice(0, 120) ||
      markerSource.match(STRUTS_BODY_RE)?.[0] || 'struts marker';
    findings.push({
      class: 'ognl_injection',
      id: `struts-fingerprint-${rand()}`,
      title: 'Struts2 fingerprint disclosed',
      severity: 'low',
      url,
      evidence: {
        request: `GET ${url}`,
        response: `Struts marker observed: ${sample}`,
        impact_demo: 'framework identity/version disclosure narrows targeting — feeds the OGNL math differential below',
        signalCorrelated: true,
      },
    });
  }

  if (!pathHit && !markerHit) return findings; // not a Struts target — stop

  const depth = opts.depth || 'standard';
  const payloads = depth === 'quick' ? OGNL_PAYLOADS.slice(0, 1) : OGNL_PAYLOADS;
  for (const param of (params || []).slice(0, 10)) {
    // Control: OGNL-shaped but non-evaluating literal (unknown identifier).
    let control;
    try {
      control = await getText(withParam(url, param, `%{dm_${rand()}}`), opts);
    } catch {
      continue;
    }
    for (const { payload, expect } of payloads) {
      let r;
      try {
        r = await getText(withParam(url, param, payload), opts);
      } catch {
        continue;
      }
      // Fire ONLY on the evaluation differential: 9352 present, literal
      // payload absent, 9352 absent from the control response.
      if (r.text.includes(expect) && !r.text.includes(payload) && !control.text.includes(expect)) {
        const idx = r.text.indexOf(expect);
        const window = r.text.slice(Math.max(0, idx - 60), idx + 60);
        findings.push({
          class: 'ognl_injection',
          id: `ognl-injection-${param}`,
          title: `OGNL injection in parameter '${param}'`,
          severity: 'critical',
          url,
          parameter: param,
          evidence: {
            request: `GET ${withParam(url, param, payload)}`,
            response: `payload evaluated to '9352' (literal '${payload}' absent; oracle absent in control) — "...${window}..."`,
            impact_demo: `OGNL expression ${payload} executed server-side — Struts2 OGNL evaluates user input; RCE-confirmation is manual-lab-only and was not attempted`,
            signalCorrelated: true,
          },
        });
        break; // one finding per param at highest severity
      }
    }
  }
  return findings;
}
