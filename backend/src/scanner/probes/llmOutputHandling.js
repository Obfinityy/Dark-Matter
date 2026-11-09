// Dark Matter rule-based scanner — LLM insecure-output-handling
// probe (coverage row #18 [High] Improper LLM Output Handling,
// OWASP LLM05:2025; phase 113, 'llm-output-handling').
//
// ORACLE (deterministic, no judge, no LLM, $0): model output
// shown to a user must be escaped for its rendering context. The
// probe (1) fingerprints the chat endpoint (see llmSurface.js —
// the surface whose output is rendered), then (2) GETs the
// output page with a benign markup marker
// (<b>dmprobe-llm-output</b> — a marker, not an attack payload:
// it proves the escaping property without executing anything)
// and confirms ONLY when the response body carries the marker
// VERBATIM and does NOT carry its escaped form (&lt;b&gt;…) —
// the renderer emitted the markup raw. A page that echoes the
// marker escaped, or does not echo it at all, is a proven true
// negative — the output is handled.
//
// CONTROL: the same page is what renders model output; the
// marker stands in for model output text. There is no second
// request to the model — the escaping property is a property of
// the renderer, and one verbatim reflection proves it.
//
// GATES: isLabTargetHost + depth !== 'quick'. Read-only (one
// benign GET) — no allowWrite gate, no labCreds: the LLM lab
// has no login. BOUND: at most 4 requests (≤3 fingerprint + 1
// page GET). Max 1 finding. Findings are class
// 'llm_output_handling' — the default confirmation protocol
// judges them on signalCorrelated (see differential.js; same
// pattern as business_logic).

import { isLabTargetHost } from '../../labCreds.js';
import {
  findLlmChatEndpoint,
  hasUnescapedMarker,
  escapeHtml,
  LLM_PAGE_PATH,
} from './llmSurface.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_FINDINGS = 1;

// Benign markup marker: proves the escaping property without
// executing anything. A <b> tag is markup, not a script — the
// oracle is verbatim reflection, not execution.
export const OUTPUT_MARKER = '<b>dmprobe-llm-output</b>';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Judge one page response against the marker. 'confirmed' only
 * when the marker is present verbatim AND its escaped form is
 * absent — the renderer emitted the markup raw. 'rejected' when
 * the marker is escaped (output handled) or not echoed at all.
 * Pure.
 */
export function assessOutputHandling(body, marker) {
  const b = String(body || '');
  if (!b.includes(marker)) {
    return { verdict: 'rejected', reason: 'the page did not echo the marker' };
  }
  if (b.includes(escapeHtml(marker))) {
    return { verdict: 'rejected', reason: 'the page echoed the marker escaped — output is handled' };
  }
  return { verdict: 'confirmed', reason: 'the page rendered the marker as raw HTML without escaping' };
}

// ---- network (fetchFn seam, defaults to global fetch) -----------------------

async function req(fetchFn, url, { method = 'GET', timeoutMs = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { method, signal: ctrl.signal, headers: { 'User-Agent': UA } });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 200000) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---- the probe ---------------------------------------------------------------

export async function probeLlmOutputHandling(url, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : globalThis.fetch;
  if (!isLabTargetHost(url, opts.labTargets)) return findings;
  if ((opts.depth || 'standard') === 'quick') return findings;
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return findings;
  }

  // THE FINGERPRINT — the chat endpoint whose output this page
  // renders. No LLM surface, no probe (true negative).
  const fp = await findLlmChatEndpoint(fetchFn, origin, opts.apiRoutes || [], opts);
  setDiag('llmEndpoints', fp.llmEndpoints);
  if (!fp.chatUrl) return findings;

  // THE TEST — one benign GET carrying the markup marker.
  const pageUrl = origin.replace(/\/+$/, '') + LLM_PAGE_PATH + '?text=' + encodeURIComponent(OUTPUT_MARKER);
  const page = await req(fetchFn, pageUrl);
  if (!page || page.status !== 200) return findings;
  const judged = assessOutputHandling(page.text, OUTPUT_MARKER);
  setDiag('pageReflects', page.text.includes(OUTPUT_MARKER));
  setDiag('markerEscaped', page.text.includes(escapeHtml(OUTPUT_MARKER)));
  if (judged.verdict !== 'confirmed') return findings;

  findings.push({
    class: 'llm_output_handling',
    id: `llm-output-handling-${rand()}`,
    title: 'LLM output rendered as raw HTML without escaping (HIGH)',
    severity: 'high',
    url: pageUrl,
    parameter: 'text',
    evidence: ev(
      `GET ${pageUrl}`,
      `The output page echoed the markup marker verbatim ('${OUTPUT_MARKER}') with no escaping — model output shown through this page renders as raw HTML.`,
      'Escape model output for its rendering context (HTML-encode before inserting into the page) — unescaped output lets model text execute as markup/script in the user browser.',
    ),
  });
  return findings.slice(0, MAX_FINDINGS);
}

export const __llmOutputHandlingMeta = { phases: ['llm-output-handling'], depth: ['standard', 'deep'] };
