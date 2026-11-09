// Split out of humanLoop.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; humanLoop.js re-exports the public names so callers are unchanged.

import { evidenceSignalIds, isHttpErrorPage } from '../hunt-intel/index.js';
import { PROBE_TOPICS, buildMemoryBriefing, clipLine, coverageObservation, discoveredEndpoints, findingsFromEvents, mergeLeadsWithCoverage, reconcileSessionResearch, researchedNotProbedLines, researchedTopicStats, systemPromptFor, unprobedLeadLines } from './research.js';

// COMPLETE-THE-PROOF GATE (Lane N, 22 Oct 2026 — Lane K's Strix P3,
// re-implemented by reference; no Strix code copied)
//
// Strix's report tool refuses to file a vulnerability until the proof
// package is complete (PoC + evidence + counterevidence + confidence),
// because a verifier handed prose has to re-argue the claim instead of
// checking artefacts. Our claim path had the same hole: claim_finding
// recorded (or sent to assessResult) whatever title/evidence/command
// the brain supplied, so half-proved claims reached the verifier as
// assertions. This gate is the deterministic completeness half of
// that contract, applied at the recording point in the claim_finding
// branch — BEFORE the verifier is invoked and before any finding is
// recorded. It judges COMPLETENESS ONLY, never truth: assessResult
// remains the sole judge of whether a complete claim is real.
//
// A claim is complete when it carries ALL of:
//   - title — one line naming the vulnerability;
//   - class — the vuln class ("class" field, normalised through the
//     coverage ledger's class normaliser; when the field is absent,
//     a PROBE_TOPICS match on the title supplies it);
//   - a runnable reproduction — the exact "command" (the claim path's
//     existing last-shell-command fallback counts, exactly as the
//     recording path has always used it) OR "poc" naming an artefact
//     that exists in this hunt's own artifacts (checked through
//     deps.pocExists, so a fabricated handle bounces);
//   - evidence — the exact output that proves it, at least
//     CLAIM_EVIDENCE_MIN chars: a real response excerpt, not a bare
//     assertion like "it worked";
//   - counterevidence — what the hunter checked that could have
//     disproved the claim (for a differential class, the baseline /
//     control result beside the trigger result);
//   - confidence — high | medium | low; when not high, a
//     confidence_rationale is required.
//
// An incomplete claim is NOT recorded and the verifier never sees
// it. The brain gets ONE observation naming every missing piece and
// the field that supplies it, and the refusal is recorded as a
// claim_bounce event (the dedup_block pattern: countable by
// monitors, so the bounce rate is measurable). The gate injects no
// actions and adds no stages — it only shapes a filing the hunter
// chose to make.

export const CLAIM_EVIDENCE_MIN = 30; // chars of real output, not an assertion

export const CLAIM_COUNTER_MIN = 10; // chars — more than "n/a" or "checked"

export const CLAIM_COMMAND_MIN = 8; // chars — a real probe command, not a word

/** Vuln class from a claim title via PROBE_TOPICS (deterministic). */
export function claimClassFromTitle(title) {
  const t = String(title || '');
  if (!t.trim()) return '';
  for (const topic of PROBE_TOPICS) if (topic.re.test(t)) return topic.id;
  return '';
}

/**
 * The completeness check. Pure: artefact existence arrives as the
 * caller-computed `pocExists` boolean. Returns
 * { ok, missing: [{ field, hint }], cls } — every missing piece is
 * named with the field that supplies it, so the bounce observation
 * can be assembled without further logic.
 */
export function claimGateCheck({
  title = '',
  cls = '',
  command = '',
  poc = '',
  pocExists = false,
  evidence = '',
  counterevidence = '',
  confidence = '',
  rationale = '',
} = {}) {
  const missing = [];
  if (!String(title).trim()) {
    missing.push({ field: 'title', hint: '"title" — one line naming the vulnerability' });
  }
  if (!String(cls).trim()) {
    missing.push({ field: 'class', hint: '"class" — the vuln class (e.g. "sqli", "xss"); or name the class in the title so it can be matched' });
  }
  if (String(command).trim().length < CLAIM_COMMAND_MIN && !pocExists) {
    missing.push(poc
      ? { field: 'poc', hint: `"poc" — the artefact "${String(poc).slice(0, 80)}" is not in this hunt's artifacts; save the proof script with write_file first, or give the exact "command" instead` }
      : { field: 'command', hint: '"command" — the exact command that reproduces it (the verifier re-runs it), or "poc" naming a proof script you saved in this hunt' });
  }
  if (String(evidence).trim().length < CLAIM_EVIDENCE_MIN) {
    missing.push({ field: 'evidence', hint: '"evidence" — the exact output that proves it: a real excerpt of the response/output, not a summary or an assertion' });
  }
  if (String(counterevidence).trim().length < CLAIM_COUNTER_MIN) {
    missing.push({ field: 'counterevidence', hint: '"counterevidence" — what you checked that could have disproved this: the control/baseline result beside the trigger (e.g. the \' OR 1=2 response next to \' OR 1=1), or the strongest false-positive explanation and what ruled it out' });
  }
  const conf = String(confidence || '').trim().toLowerCase();
  if (!['high', 'medium', 'low'].includes(conf)) {
    missing.push({ field: 'confidence', hint: '"confidence" — "high", "medium" or "low" (add "confidence_rationale" whenever it is not high)' });
  } else if (conf !== 'high' && !String(rationale).trim()) {
    missing.push({ field: 'confidence_rationale', hint: '"confidence_rationale" — confidence is not high, so say why: what is still uncertain about this claim' });
  }
  return { ok: missing.length === 0, missing, cls: String(cls || '') };
}

/** Payload class of a typed text, from the PROBE_TOPICS probe shapes. Anything else typed is a credential (a username/password), not an attack. */
export function classifyPayloadClass(text) {
  const t = String(text || '');
  for (const topic of PROBE_TOPICS) {
    if (topic.probes && topic.probes.some((re) => re.test(t))) return topic.id;
  }
  // Encoded variants the probe shapes miss (the live loop's dodge):
  // %3cscript, &lt;script, unicode-escaped <script.
  if (/%3c\s*script|&lt;\s*script|\\u003c\s*script/i.test(t)) return 'xss';
  if (/%27\s*(or|and)\s+|%27\s*(--|#)/i.test(t)) return 'sqli';
  return 'credential';
}

/**
 * The page a URL names, for the exhaustion key: host + pathname.
 * The pathname carries the page — /login.php and
 * /vulnerabilities/sqli/ on the same host are DIFFERENT surfaces
 * (DVWA, live 28 Oct 2026: the host-only key let three login-page
 * auth_blocks close the SQLi page the brain was already logged
 * into, so its baseline '1' and its boolean probes were refused
 * as exhausted_block 18 times). Query + hash are stripped: they
 * name the same page with different input, and keeping them would
 * let each query variant dodge the surface that just closed.
 * Trailing slash stripped so /sqli/ and /sqli are one page.
 */
export function surfacePageOfUrl(u) {
  let host = '';
  let path = '';
  try {
    const parsed = new URL(String(u || ''));
    host = parsed.hostname.toLowerCase();
    path = parsed.pathname || '/';
  } catch {
    return { host: '', path: '' };
  }
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return { host, path: path || '/' };
}

// PROOF-COMPLETE GATE (gate-replay lane, 28 Oct 2026)
//
// The re-proof-without-filing loop (live DVWA hunt h_830317bdc184):
// after the 8th dedup block the brain pivoted to reflected XSS and
// proved the SAME claim over and over — fresh markers ZXSS987654,
// ZXQ9777, QXZ7719 (raw reflection proven 08:35 IST), HXQ/BBT999z,
// RXS2810B — each a NEW marker, so the exact-repeat dedupe gate
// (Lane F, keyed on the identical command) never fired, and the
// brain kept re-proofing instead of filing. No third filing ever
// came; the level proof stayed at 0 while the evidence was in hand.
//
// The dedupe gate cannot catch this: it judges the ACTION, and a
// re-proof varies the action (new marker, new recall, new wording).
// This gate judges the CLAIM: a probe is a proof of (endpoint,
// payload class) when its output is signal-bearing and not an error
// page. After PROOF_THRESHOLD consistent proofs of the same claim,
// the NEXT probe of that claim is blocked — not with "try something
// else", but with the one move that advances the hunt: FILE IT.
// The block is a countable proof_file_nudge event (same shape as
// dedup_block / auth_block / exhausted_block) and the observation
// names the claim, the count, and the filing it must do.
//
// A rejected claim RESETS its count (see the claim_finding branch):
// the brain needs NEW evidence, and the counter must not keep the
// claim blocked. A verified claim needs no further probes at all.
// Script probes (a proof script run by name, no URL and no payload
// in the command itself) carry no endpoint the gate can key on, so
// they are not proof-counted — the verifier (Fix 1) is their
// backstop when filed. This gate is a nudge, not a verdict: it can
// only ever direct the brain to file, and assessResult still
// decides whether the filing is true.

export const PROOF_THRESHOLD = 3; // consistent re-proofs before the loop demands a filing

/** The endpoint a shell probe targets: the first http(s) URL in the command, as host+pathname (no port — the same shape surfacePageOfUrl gives a browser page, so a shell probe and a browser probe of the same page share a key). '' when the command names no URL (a proof script run by name). */
export function proofEndpointOfCommand(command) {
  const m = /https?:\/\/[^\s'"`]+/i.exec(String(command || ''));
  if (!m) return '';
  try {
    const u = new URL(m[0]);
    let p = u.pathname || '/';
    if (p.length > 1) p = p.replace(/\/+$/, '');
    return `${u.hostname.toLowerCase()}${p || '/'}`;
  } catch {
    return '';
  }
}

/**
 * The claim a probe action proves, or null when the action is not a
 * probe the gate can key on. Signature = (endpoint, payload class):
 * the same flaw re-proved with a fresh marker is the same claim.
 * shell keys on the URL in the command; browser_type keys on the
 * page the hunter is typing into. 'credential' typings are not
 * probes. Pure.
 */
export function proofSignatureFor(kind, action, { page = '' } = {}) {
  const k = String(kind || '').toLowerCase();
  let endpoint = '';
  let text = '';
  if (k === 'shell') {
    const command = String((action && action.command) || '');
    endpoint = proofEndpointOfCommand(command);
    text = command;
  } else if (k === 'browser_type') {
    const pg = surfacePageOfUrl(page || '');
    endpoint = pg.host ? pg.host + (pg.path || '/') : '';
    text = String((action && action.text) || '');
  } else {
    return null;
  }
  if (!endpoint) return null;
  const payloadClass = classifyPayloadClass(text);
  if (!payloadClass || payloadClass === 'credential') return null;
  return { key: `${endpoint}|${payloadClass}`, endpoint, payloadClass };
}

/**
 * Did this probe output prove its claim? A proof is signal-bearing
 * output (the verifier's own evidence-signal vocabulary, non-negated,
 * non-framing) that is not an HTTP error page. Pure.
 */
export function probeProvesClaim({ output = '', command = '' } = {}) {
  const out = String(output || '');
  if (!out.trim()) return false;
  if (isHttpErrorPage(out)) return false;
  return evidenceSignalIds(out, command).length > 0;
}

/**
 * The proof-complete verdict for one probe action against the hunt's
 * proof counts (Map signature -> count, or a plain object): the hit
 * when this claim has already been proven PROOF_THRESHOLD times,
 * else null. `sig` may carry a precomputed proofSignatureFor result
 * (the loop captures the signature before execution, so the page a
 * probe navigates to cannot change the key). Pure.
 */
export function proofGateHit(kind, action, proofCounts, { page = '', sig = null } = {}) {
  const s = sig || proofSignatureFor(kind, action, { page });
  if (!s) return null;
  const counts = proofCounts instanceof Map ? proofCounts : new Map(Object.entries(proofCounts || {}));
  const count = Number(counts.get(s.key) || 0);
  if (count < PROOF_THRESHOLD) return null;
  return { tool: String(kind || '').toLowerCase(), endpoint: s.endpoint, payloadClass: s.payloadClass, count, key: s.key };
}

/** The observation a proof-complete probe gets: file the claim now. */
export function proofFileObservation(hit) {
  return `PROOF COMPLETE — FILE IT NOW: you have already proven ${hit.payloadClass.toUpperCase()} on ${hit.endpoint} ${hit.count} times with consistent evidence. A fourth probe of the same claim proves nothing new — it only burns a turn. It was NOT executed. File it now with claim_finding: title the vulnerability, class "${hit.payloadClass}", evidence the exact output that proves it (the reflected marker / dumped rows, pasted raw, not a summary), command the exact reproduction that produced that evidence, and counterevidence the control/baseline result beside it. If the verifier rejects the filing, gather NEW evidence for it — the proof count restarts from the rejection.`;
}
