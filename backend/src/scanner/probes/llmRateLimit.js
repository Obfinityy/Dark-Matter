// Dark Matter rule-based scanner — LLM unbounded-consumption probe
// (coverage rows #26 [High] Unbounded LLM Consumption / Denial of
// Wallet, LLM10:2025, and #382 [Medium] LLM — Unbounded consumption
// (model DoS / cost), OWASP LLM10:2025; phase 'llm-rate-limit').
//
// ORACLE (deterministic, no judge, no LLM, $0): a model endpoint
// that lacks rate limiting answers volume with success. The lab's
// own README documents the planted absence ("no rate limiting on
// any endpoint", 25 rapid chat calls all 200), and server.js carries
// no throttle code at all — no counters, no 429 path anywhere. The
// probe runs a CONTROL-FIRST burst against the stub:
//   (1) CONTROL: one POST /api/chat with a benign prompt — it must
//       answer 200 + a JSON body with a completion string. Without
//       a working control the burst cannot be judged.
//   (2) BURST: the same chat POST 12 times in rapid succession,
//       then the same tool POST 4 times (runCommand 'echo hello' —
//       the lab's allowlist, side-effect-free, no state created or
//       mutated), no delay between calls. Volume in a short window
//       is the measurement the rows ask for.
//   (3) CONFIRM only when every burst answer is granted (2xx +
//       JSON) with no throttle signal anywhere: no HTTP 429, no
//       Retry-After header, no rate-limit refusal text in any body.
//       A single throttle signal proves the limit EXISTS — that is
//       a proven true negative, never a finding. A burst that
//       degrades into 5xx or non-JSON answers is uncalibrated
//       (inconclusive), never a finding.
// BOUND: 1 health (fingerprint) + 1 control + 16 burst = 18
// requests, all non-mutating. deleteUser is NEVER called by this
// probe (or any probe in this lane). Latency-based throttling
// (progressive slowdown with 2xx answers) is NOT judged — status
// codes and throttle signals only.
//
// GATES: llmGate (labCreds + allowWrite + lab host + depth !==
// 'quick') + the /health fingerprint (service 'llm-lab', model
// 'shopassist-stub-1.0'). Findings are class
// 'llm_unbounded_consumption' — the default confirmation protocol
// judges them on signalCorrelated (see differential.js).

import {
  ev,
  llmGate,
  isLlmLab,
  postJson,
  assessLlmResponse,
} from './llmLab.js';

const CHAT_BURST = 12;
const TOOL_BURST = 4;
const CONTROL_PROMPT = 'hello, what can you help with?';
const TOOL_CMD = 'echo hello';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Judge the LLM burst: confirmed only when the control was granted
 * AND every burst answer was granted. A single throttled burst
 * answer proves the limit exists (rejected — a proven true
 * negative). A burst that degrades into non-granted, non-throttled
 * answers is uncalibrated (inconclusive), never a finding. Pure.
 */
export function assessLlmBurst(controlKind, burstKinds) {
  if (controlKind !== 'granted') {
    return { verdict: 'uncalibrated', reason: 'the control chat did not grant — no valid control' };
  }
  if (!Array.isArray(burstKinds) || burstKinds.length === 0) {
    return { verdict: 'uncalibrated', reason: 'the burst ran no requests' };
  }
  if (burstKinds.some((k) => k === 'throttled')) {
    return {
      verdict: 'rejected',
      reason: 'the server throttled the burst (HTTP 429 / Retry-After / refusal text) — a rate limit exists on this endpoint',
    };
  }
  if (burstKinds.some((k) => k !== 'granted')) {
    return {
      verdict: 'uncalibrated',
      reason: 'burst answers were inconclusive (non-2xx / non-JSON) — neither a limit nor its absence is proven',
    };
  }
  return {
    verdict: 'confirmed',
    reason: `all ${burstKinds.length} burst requests answered 2xx with no throttle signal — the model endpoint accepted the full burst without throttling`,
  };
}

// ---- the probe ---------------------------------------------------------------

export async function probeLlmRateLimit(url, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : globalThis.fetch;
  const gate = llmGate(url, opts);
  if (!gate) return findings;
  const origin = gate.origin;
  if (!(await isLlmLab(origin, fetchFn))) {
    setDiag('llmLab', false);
    return findings;
  }
  setDiag('llmLab', true);

  // THE CONTROL: one chat POST must grant with a JSON completion.
  const rControl = await postJson(fetchFn, `${origin}/api/chat`, { prompt: CONTROL_PROMPT });
  if (!rControl) return findings;
  const control = assessLlmResponse(rControl.status, rControl.text, rControl.headers);
  if (control.kind !== 'granted' || !rControl.json || typeof rControl.json.completion !== 'string') {
    return findings;
  }
  setDiag('controlOk', true);

  // THE BURST: the same chat POST CHAT_BURST times, then the same
  // tool POST TOOL_BURST times, no delay. A throttle signal stops
  // the burst early — the limit is proven and this is a true
  // negative, never a finding.
  const kinds = [];
  let attempts = 0;
  let throttled = false;
  for (let i = 0; i < CHAT_BURST; i += 1) {
    const r = await postJson(fetchFn, `${origin}/api/chat`, { prompt: CONTROL_PROMPT });
    attempts += 1;
    setDiag('attempts', attempts);
    if (!r) {
      kinds.push('other');
      continue;
    }
    const judged = assessLlmResponse(r.status, r.text, r.headers);
    kinds.push(judged.kind);
    if (judged.kind === 'throttled') {
      throttled = true;
      setDiag('throttled', true);
      break;
    }
  }
  if (!throttled) {
    for (let i = 0; i < TOOL_BURST; i += 1) {
      const r = await postJson(fetchFn, `${origin}/api/tool`, { action: 'runCommand', cmd: TOOL_CMD });
      attempts += 1;
      setDiag('attempts', attempts);
      if (!r) {
        kinds.push('other');
        continue;
      }
      const judged = assessLlmResponse(r.status, r.text, r.headers);
      kinds.push(judged.kind);
      if (judged.kind === 'throttled') {
        setDiag('throttled', true);
        break;
      }
    }
  }
  setDiag('chatAttempts', kinds.slice(0, CHAT_BURST).length);
  setDiag('toolAttempts', Math.max(0, kinds.length - CHAT_BURST));
  const verdict = assessLlmBurst(control.kind, kinds);
  if (verdict.verdict !== 'confirmed') return findings;
  setDiag('burstKind', 'no-rate-limit');
  findings.push({
    class: 'llm_unbounded_consumption',
    id: `llm-nolimit-${rand()}`,
    title: 'LLM endpoint accepts repeated requests without rate limiting (HIGH)',
    severity: 'high',
    url: `${origin}/api/chat`,
    parameter: 'rate-limit',
    evidence: ev(
      `POST ${origin}/api/chat once (control, HTTP 200) -> 12 identical chat POSTs + 4 identical tool POSTs (runCommand 'echo hello') in rapid succession -> all 16 answered HTTP 200`,
      `No throttle signal in the whole burst: no HTTP 429, no Retry-After header, no rate-limit refusal text. ${verdict.reason}. The model endpoint applies no rate limiting, quota, or cost guard.`,
      'An attacker drives the model endpoint at volume to exhaust compute or run up inference cost (denial of wallet).',
    ),
  });
  return findings;
}

export const __llmRateLimitMeta = { phases: ['llm-rate-limit'], depth: ['standard', 'deep'] };
