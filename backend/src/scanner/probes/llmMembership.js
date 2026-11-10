// Dark Matter rule-based scanner — LLM membership-inference probe
// (coverage row #514 [Low] LLM — membership inference attack,
// CWE-200; phase 'llm-membership-inference').
//
// VERDICT ON THIS LAB: UNPROVABLE — NO CONFIDENCE SIGNAL EXISTS.
// Classical membership inference probes a model with confidence
// queries (logprobs, loss, perplexity) to infer whether a given
// record was in its training set. The stub offers no such signal:
// runStub is a pure function of the input text (same prompt ->
// byte-identical completion, no sampling, no temperature), and its
// chat replies carry no confidence / logprob / score / perplexity
// field at all — only model, completion, leaked, trigger,
// retrieved, toolCall, toolResult. The probe verifies all three
// legs instead of assuming them:
//   (1) DETERMINISM: the same benign prompt twice -> completions
//       must be identical.
//   (2) CONFIDENCE SIGNAL: the chat reply must carry no
//       confidence-shaped field.
//   (3) MEMBERSHIP ORACLE SHAPE: GET /api/rag for a planted-doc
//       keyword returns the doc, and for a nonsense keyword returns
//       nothing — membership of the RAG store is DIRECTLY
//       observable through the retrieval endpoint, which is a data
//       exposure property, not a membership-inference attack: there
//       is no confidence query to run and nothing to infer.
// With no confidence signal and full determinism there is no
// membership-inference attack to confirm on this lab, and this
// probe carries no finding branch by design — it records the
// signals (deterministic, confidenceSignal, memberRetrievable,
// nonMemberEmpty, verdict) in the phase record so a live proof can
// tell "no surface" from "oracle uncalibrated" without re-running
// the scan.
//
// GATES: llmGate (labCreds + allowWrite + lab host + depth !==
// 'quick') + the /health fingerprint. BOUND: 1 health + 2 chat
// POSTs + 2 rag GETs = 5 requests, all non-mutating.

import {
  llmGate,
  isLlmLab,
  llmChat,
  llmRag,
} from './llmLab.js';

const CONTROL_PROMPT = 'hello, what can you help with?';
const MEMBER_QUERY = 'customer record';
const NON_MEMBER_QUERY = 'zzzqqqxxyy';

// ---- pure helpers (exported for unit tests) ---------------------------------

/** True when two completions are byte-identical. Pure. */
export function assessDeterminism(first, second) {
  return String(first || '') === String(second || '') && String(first || '').length > 0;
}

/**
 * Does a chat reply carry a confidence-shaped field (confidence,
 * logprobs, logProb, score, perplexity)? Pure.
 */
export function hasConfidenceSignal(chatJson) {
  if (!chatJson || typeof chatJson !== 'object') return false;
  const keys = Object.keys(chatJson).map((k) => k.toLowerCase());
  return keys.some((k) => ['confidence', 'logprobs', 'logprob', 'score', 'perplexity', 'loss'].includes(k));
}

/**
 * Judge the membership signals: the attack is unprovable when the
 * model is deterministic and carries no confidence signal. Pure.
 */
export function assessMembership({ deterministic, confidenceSignal, memberRetrievable, nonMemberEmpty }) {
  if (!deterministic) {
    return { verdict: 'uncalibrated', reason: 'identical prompts answered differently — determinism not established' };
  }
  if (confidenceSignal) {
    return { verdict: 'uncalibrated', reason: 'the model exposes a confidence signal — a real inference comparison would be needed, out of scope for this probe' };
  }
  if (!memberRetrievable || !nonMemberEmpty) {
    return { verdict: 'uncalibrated', reason: 'the retrieval oracle did not answer both legs' };
  }
  return {
    verdict: 'rejected',
    reason: 'deterministic model, no confidence signal; RAG membership is directly observable via /api/rag, not inferable — no membership-inference attack exists on this lab',
  };
}

// ---- the probe ---------------------------------------------------------------

export async function probeLlmMembership(url, opts = {}) {
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

  // (1) DETERMINISM: the same prompt twice.
  const first = await llmChat(origin, CONTROL_PROMPT, fetchFn);
  const second = await llmChat(origin, CONTROL_PROMPT, fetchFn);
  if (!first || !second || typeof first.completion !== 'string' || typeof second.completion !== 'string') {
    return findings;
  }
  const deterministic = assessDeterminism(first.completion, second.completion);
  setDiag('deterministic', deterministic);

  // (2) CONFIDENCE SIGNAL: none on this stub.
  const confidenceSignal = hasConfidenceSignal(first) || hasConfidenceSignal(second);
  setDiag('confidenceSignal', confidenceSignal);

  // (3) RETRIEVAL ORACLE SHAPE: member vs non-member keyword.
  const member = await llmRag(origin, MEMBER_QUERY, fetchFn);
  const nonMember = await llmRag(origin, NON_MEMBER_QUERY, fetchFn);
  const memberRetrievable = Boolean(member && Array.isArray(member.results) && member.results.length > 0);
  const nonMemberEmpty = Boolean(nonMember && Array.isArray(nonMember.results) && nonMember.results.length === 0);
  setDiag('memberRetrievable', memberRetrievable);
  setDiag('nonMemberEmpty', nonMemberEmpty);

  const verdict = assessMembership({ deterministic, confidenceSignal, memberRetrievable, nonMemberEmpty });
  setDiag('verdict', verdict.verdict === 'rejected' ? 'unprovable-no-confidence-signal' : verdict.verdict);
  // No finding branch by design: with no confidence signal and
  // full determinism there is no membership-inference attack to
  // confirm on this lab.
  return findings;
}

export const __llmMembershipMeta = { phases: ['llm-membership-inference'], depth: ['standard', 'deep'] };
