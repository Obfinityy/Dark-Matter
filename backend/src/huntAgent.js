// Dark Matter — autonomous hunt agent loop.
//
// THIS is the "replace the elite hunter" engine. An elite hunter works in a
// tight iterative loop: observe → hypothesize → test → verify → chain → repeat.
// This module implements exactly that, with the Bedrock model as the brain
// and the per-hunt container as the hands.
//
//   1. RECON    — container tools (nmap, nuclei) + JS mining + target profile
//   2. PLAN     — Bedrock picks the highest-value next test from intel modules
//   3. EXECUTE  — run the test in the isolated container
//   4. VERIFY   — evidenceGate (no proof = no finding) + 4-step verifyPipeline
//   5. CHAIN    — beamSearchChains: escalate confirmed findings to max impact
//   6. REPEAT   — until mode budget, cost cap, or goal reached
//
// Every step is defensive: a failed tool/LLM call degrades to the next test,
// never kills the hunt. Cost guard stops runaway Bedrock spend.
//
// The phases live in ./huntAgent/ (P3 split); this module is the public
// facade — it re-exports the names callers used, so no caller changes.
export { iterationPriceCents, resumeInterruptedHunt, runAutonomousHunt } from './huntAgent/run.js';
export { assessResult, isInterestingEvidence } from './huntAgent/verification.js';
export { executeWithEvasion } from './huntAgent/exec.js';
export { getOrchestrator, isDriverActive, releaseDriverLock, tryAcquireDriverLock } from './huntAgent/driver.js';
export { repairShellQuoting, think } from './huntAgent/text.js';

// REMOVED (owner directive 15 Oct 2026): iteration budgets are gone.
// Hunts run unlimited until the user stops them or the wallet runs out.
// Money is the only limit. This constant is kept for reference only.
const MODE_ITERATIONS = null;
