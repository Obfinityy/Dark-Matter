// Split out of brainMode.js by the P3 professionalization lane (split-only, no behaviour change).
// Dispatch branches of executeBrainAction, moved verbatim except that
// dispatcher locals are read through the h context object.

import {
  claimGateCheck,
  claimClassFromTitle,
  extractTaskBlock,
  scopeViolation,
  pendingPlannedProbes,
  targetHostsFor,
} from '../../humanLoop.js';
import { normaliseCoverageClass } from '../../coverageLedger.js';
import { guardClaimTitle } from '../../claimTitleGuard.js';
import { COMMAND_CAP, OBS_BUDGET, defaultAssess, defaultExec, defaultGui } from './common.js';

export async function executeClaimAction(huntId, action, h) {
  const rawTitle = String(action.title || '');
  const title = String(rawTitle.trim() ? rawTitle : 'Untitled claim').slice(0, 200);
  // CLAIM-TITLE SANITY + DEDUP GUARD (31 Oct 2026): the brain once
  // filed its own raw-plan test slug ("model_raw_plan") as a MEDIUM
  // finding and verified "sql_injection_login" twice. A bounced title
  // is recorded as claim_bounce (countable) and never reaches the
  // completeness gate or the verifier.
  let titleEvents = [];
  try { titleEvents = h.readEvents(huntId) || []; } catch { titleEvents = []; }
  const titleGuard = guardClaimTitle(title, titleEvents);
  if (!titleGuard.ok) {
    try { h.record(huntId, { type: 'claim_bounce', tool: 'claim_finding', detail: title, reason: titleGuard.error, via: 'be-a-brain' }); } catch { /* best-effort */ }
    h.failProcess(titleGuard.error, titleGuard.message);
    return { ok: false, error: titleGuard.error, output: titleGuard.message };
  }
  const evidence = String(action.evidence || '');
  const command = String(action.command || '').slice(0, COMMAND_CAP);
  let pocExists = false;
  const poc = String(action.poc || '').trim().slice(0, 120);
  if (poc) {
    try {
      if (typeof h.d.pocExists === 'function') pocExists = Boolean(h.d.pocExists(huntId, poc));
      else {
        const { artifactInfo } = await import('../../artifacts.js');
        pocExists = Boolean(artifactInfo(huntId, poc));
      }
    } catch { pocExists = false; }
  }
  // COMPLETE-THE-PROOF GATE — same as the AI loop: an incomplete
  // claim is bounced UNRECORDED (claim_bounce event), the verifier
  // never sees it.
  const gate = claimGateCheck({
    title: rawTitle,
    cls: normaliseCoverageClass(action.class) || claimClassFromTitle(rawTitle),
    command,
    poc,
    pocExists,
    evidence,
    counterevidence: action.counterevidence,
    confidence: action.confidence,
    rationale: action.confidence_rationale,
  });
  if (!gate.ok) {
    try { h.record(huntId, { type: 'claim_bounce', tool: 'claim_finding', detail: title, missing: gate.missing.map((x) => x.field), via: 'be-a-brain' }); } catch { /* best-effort */ }
    h.failProcess('claim_incomplete', 'CLAIM NOT RECORDED — the proof package is incomplete. Missing: ' + gate.missing.map((x) => x.field).join(', ') + '.');
    return {
      ok: false,
      error: 'claim_incomplete',
      missing: gate.missing.map((x) => x.field),
      output: 'CLAIM NOT RECORDED — the proof package is incomplete, so the verifier never saw it. Missing: ' +
        gate.missing.map((x) => x.hint).join('; ') +
        '. Complete every piece and claim again.',
    };
  }
  // The filing itself goes through the SAME verifier as an AI
  // claim: assessResult re-runs the command, applies the evidence
  // gate, evidenceReproduced, the 4-step verifyPipeline and the
  // 404 error-page protection — and records the finding event.
  // The tool_call + note are recorded below, once the verdict is
  // known, so the note carries it.
  const assess = await defaultAssess(h.d);
  if (!assess) {
    // FIX (#367, gap 3): the recorded severity/class used to be
    // hardcoded medium/agent_finding whatever the brain reported.
    // Now they reflect the claim: the brain's severity when it is
    // a valid enum value, else medium; the gate's class resolution
    // (explicit class, else title-matched, else agent_finding).
    const sev = String(action.severity || '').trim().toLowerCase();
    const recordedSeverity = ['critical', 'high', 'medium', 'low'].includes(sev) ? sev : 'medium';
    const recordedClass = normaliseCoverageClass(action.class) || claimClassFromTitle(rawTitle) || 'agent_finding';
    try {
      h.record(huntId, {
        type: 'finding', class: recordedClass, title, severity: recordedSeverity, url: h.target,
        evidence: { request: command, response: evidence.slice(0, 3000) },
        verified: false, verification: 'be-a-brain parent claim — pending pipeline verification', via: 'be-a-brain',
      });
    } catch { /* best-effort */ }
    h.observation = 'Recorded as an UNVERIFIED claim (no pipeline verifier is wired into this session). It does not count as a finding until the verifier confirms it.';
    h.verified = false;
  } else {
    const plan = {
      test: title,
      command,
      why: 'Be-a-Brain parent claim — the owner reproduced this himself and asked for independent verification.',
      hypothesis: title,
    };
    const result = { stdout: evidence, stderr: '', code: 0 };
    let rec = null;
    try {
      rec = await assess(huntId, h.target, plan, result);
    } catch (err) {
      h.observation = `Verification could not run (${String((err && err.message) || err)}). Your claim was NOT verified — reproduce it cleanly and claim again with the exact command + output.`;
      h.verified = false;
    }
    if (rec) {
      h.verified = Boolean(rec.verified);
      h.finding = rec;
      h.observation = rec.verified
        ? `VERIFIED by the independent verifier: "${rec.title}" (${rec.severity}). It counts.`
        : `NOT verified: ${rec.verification || 'the verifier rejected the claim'}. A rejected claim is a dead end, not a finding — either your evidence does not prove it, or the command does not reproduce it. Do not re-claim the same thing; dig for real proof or move on.`;
    } else if (h.observation === '') {
      h.observation = 'Verification returned nothing — the claim was NOT verified.';
      h.verified = false;
    }
  }
  h.recordExecuted();
  return h.finish();
}
