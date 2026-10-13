// Dark Matter hunt-intel — analysis pipeline.
//
// Takes raw engine findings and runs the infinity-level pipeline:
//   1. dedupe      — collapse duplicates by (class + sink + trigger)
//   2. confirm     — differential confirmation verdict per finding
//   3. score       — exploitability rubric (LIKELY_EXPLOITABLE / MEDIUM / BENIGN)
//   4. chain       — exploit-chain graph: turn mediums into criticals
//   5. variants    — suggest patch-gap variant probes for the next hunt phase
//   6. learn       — record experience; pull playbook lessons for the target
//   7. logic       — business-logic test cases for the target's app type
//
// Pure logic, no network. Safe to run on every report and on demand.

import { findChains, planToGoal } from './chainEngine.js';
import { assessConfirmation, scoreExploitability, dedupeFindings } from './differential.js';
import { suggestVariants } from './variantDb.js';
import { getPlaybook } from './learning.js';
import { generateLogicTests } from './logicTester.js';

export { getPlaybook, playbookSummary, recordHuntExperience, reflectHunt } from './learning.js';
export { generateLogicTests, checkInvariants, classifyTarget, BL_MODULES, blModulesFor } from './logicTester.js';
export { HUNT_MODES, MODE_ORDER, TIERS, getMode, modesForTier, canUseMode } from './modes.js';
export { evidenceGate, verifyPipeline, VERIFY_STEPS } from './differential.js';
export { createTaskTree, addTask, findNode, setTaskStatus, attachFinding, summarizeTree, serializeTree, deserializeTree } from './taskTree.js';
export { TECHNIQUE_CATALOG, techniquesByTactic, searchTechniques } from './attackCatalog.js';
export { beamSearchChains, SSRF_CHAINS, SSRF_CONFIRM_LADDER, inferProducerConsumer } from './chainEngine.js';
export { mineJsEndpoints, semanticUrlUsage, findSourceMaps, rankEndpoints } from './jsIntel.js';
export { verdictBAC, findCapabilityMarkers, BAC_CONFIDENCE } from './accessControl.js';
export { fingerprintWaf, recordEvasionResult, isKnownBlocked, encodePayload, ENCODERS } from './wafIntel.js';
export { scoreSilentPatch, silentPatchToVariant, fingerprintConfidence } from './variantWatch.js';
export { OAUTH_ATTACKS, oauthAttacksFor } from './oauthAttacks.js';

export function analyzeFindings(rawFindings, goal = 'rce') {
  const deduped = dedupeFindings(rawFindings || []);
  const enriched = deduped.map((f) => {
    const { verdict } = assessConfirmation(f, f.evidence || {});
    const { level, reason } = scoreExploitability(f, verdict);
    return { ...f, confirmation: verdict, exploitability: level, exploitReason: reason };
  });
  const confirmed = enriched.filter((f) => f.confirmation === 'confirmed');
  const chains = findChains(confirmed.length ? confirmed : enriched);
  const plan = planToGoal(enriched, goal);
  const classes = [...new Set(enriched.map((f) => String(f.class || f.type || '')))];
  const variants = suggestVariants(classes).slice(0, 6);

  return {
    summary: {
      raw: (rawFindings || []).length,
      unique: deduped.length,
      confirmed: confirmed.length,
      likelyExploitable: enriched.filter((f) => f.exploitability === 'LIKELY_EXPLOITABLE').length,
      chains: chains.length,
      criticalChains: chains.filter((c) => c.impact === 'critical').length,
    },
    findings: enriched,
    chains,
    nextSteps: plan,
    variantProbes: variants.map((v) => ({
      id: v.id,
      title: v.title,
      severity: v.severity,
      probes: v.huntFor.slice(0, 4),
    })),
  };
}

/** Markdown section for hunt reports: chains first (bounty order). */
export function chainsMarkdown(analysis) {
  const lines = [];
  const s = analysis.summary;
  lines.push('## Infinity analysis');
  lines.push('');
  lines.push(`- **Findings:** ${s.raw} raw → ${s.unique} unique → ${s.confirmed} confirmed → ${s.likelyExploitable} likely exploitable`);
  lines.push(`- **Exploit chains:** ${s.chains} (${s.criticalChains} critical)`);
  lines.push('');
  if (analysis.chains.length) {
    lines.push('### Exploit chains (chained impact)');
    for (const c of analysis.chains) {
      lines.push(`- **[${c.impact.toUpperCase()}] ${c.title}**`);
      lines.push(`  - Needs: ${c.needs.join(' + ')}`);
      lines.push(`  - From: ${c.findings.map((f) => f.title).join('; ')}`);
      lines.push(`  - How: ${c.how}`);
    }
    lines.push('');
  }
  const unconfirmed = analysis.findings.filter((f) => f.confirmation === 'unconfirmed');
  if (unconfirmed.length) {
    lines.push('### Needs confirmation');
    for (const f of unconfirmed.slice(0, 10)) {
      lines.push(`- ${f.title || f.class || 'finding'} — run a differential control probe.`);
    }
    lines.push('');
  }
  if (analysis.variantProbes.length) {
    lines.push('### Suggested variant probes (patch-gap mining)');
    for (const v of analysis.variantProbes) {
      lines.push(`- **${v.title}** [${v.severity}] — try: ${v.probes.join(', ')}`);
    }
    lines.push('');
  }
  if (analysis.nextSteps.length) {
    lines.push('### Next hunt objectives (goal-driven)');
    for (const n of analysis.nextSteps.slice(0, 3)) {
      lines.push(`- **${n.title}** — have: ${n.have.join(', ') || 'none'}; missing: ${n.missing.join(', ')}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
