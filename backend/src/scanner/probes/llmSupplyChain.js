// Dark Matter rule-based scanner — LLM supply-chain probe
// (coverage rows #15 [High] AI Supply Chain Vulnerability,
// LLM03:2025, and #377 [High] LLM — Supply chain (poisoned models
// / plugins), OWASP LLM03:2025; phase 'llm-supply-chain').
//
// VERDICT ON THIS LAB: TRUE NEGATIVE BY DESIGN, WITH EVIDENCE.
// A supply-chain attack needs a supply chain: a downloaded model,
// a third-party plugin, an external dataset or registry. The stub
// has none: server.js is Node stdlib only (there is no
// package.json in labs/llm-lab at all), the model card answers
// type 'deterministic-stub', and the index page lists exactly 8
// text endpoints with no plugin / model-download / registry
// surface. The probe verifies that over HTTP instead of assuming
// it:
//   (1) Read the model card: record type + version; a
//       third-party model would not be a deterministic stub.
//   (2) INVENTORY the endpoint surface: GET / and scan for plugin
//       / model-download / registry / hub markers.
// An endpoint inventory with zero supply-chain markers on a
// deterministic stub is a true negative. This probe carries no
// finding branch by design — presence of an endpoint alone would
// not prove a poisoned artifact, and a poisoned artifact cannot
// be shown without one. The phase record carries the evidence
// (modelType, thirdPartyModel, supplyChainEndpoints, verdict) so
// a live proof can tell "no surface" from "oracle uncalibrated"
// without re-running the scan.
//
// GATES: llmGate (labCreds + allowWrite + lab host + depth !==
// 'quick') + the /health fingerprint. BOUND: 1 health + 1 model
// GET + 1 index GET = 3 requests, all non-mutating.

import {
  llmGate,
  isLlmLab,
  llmModelCard,
  llmIndex,
} from './llmLab.js';

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Scan the model card + index page for a supply-chain surface:
 * plugin endpoints, model downloads, registries / hubs, external
 * model sources. Returns the matched markers (empty on this lab).
 * Pure.
 */
export function findSupplyChainSurface(indexHtml, modelCard) {
  const markers = [
    /\/api\/plugins/i,
    /\/api\/models/i,
    /\/api\/tools\/install/i,
    /huggingface/i,
    /model\s+hub/i,
    /model\s+registry/i,
    /download\s+model/i,
    /install\s+plugin/i,
  ];
  const hay = `${String(indexHtml || '')}\n${JSON.stringify(modelCard || {})}`;
  return markers.filter((re) => re.test(hay)).map((re) => String(re));
}

/**
 * Judge the supply-chain surface: a deterministic stub with zero
 * markers is a true negative by design. Pure.
 */
export function assessSupplyChain(modelCard, surfaceCount) {
  if (!modelCard) {
    return { verdict: 'uncalibrated', reason: 'the model card did not answer — no surface to judge' };
  }
  const isStub = modelCard.type === 'deterministic-stub';
  if (isStub && surfaceCount === 0) {
    return {
      verdict: 'rejected',
      reason: 'deterministic stub, no third-party model, no plugin / download / registry endpoint — there is no supply chain to poison on this lab',
    };
  }
  if (surfaceCount > 0) {
    return { verdict: 'uncalibrated', reason: 'a supply-chain-shaped endpoint exists — a poisoned artifact would need separate proof' };
  }
  return { verdict: 'uncalibrated', reason: 'the model is not a deterministic stub — its provenance is unknown' };
}

// ---- the probe ---------------------------------------------------------------

export async function probeLlmSupplyChain(url, opts = {}) {
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

  const card = await llmModelCard(origin, fetchFn);
  if (!card) return findings;
  setDiag('modelType', card.type || null);
  setDiag('thirdPartyModel', card.type !== 'deterministic-stub');

  const index = await llmIndex(origin, fetchFn);
  const surface = findSupplyChainSurface(index || '', card);
  setDiag('supplyChainEndpoints', surface.length);
  const verdict = assessSupplyChain(card, surface.length);
  setDiag('verdict', verdict.verdict === 'rejected' ? 'no-supply-chain-surface' : verdict.verdict);
  // No finding branch by design: no supply chain exists to poison
  // on this lab, and an endpoint alone would not prove a poisoned
  // artifact.
  return findings;
}

export const __llmSupplyChainMeta = { phases: ['llm-supply-chain'], depth: ['standard', 'deep'] };
