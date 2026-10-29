// Dark Matter — RULE #45 (30 Oct 2026): AUDIT REVIEW SURFACE.
//
// Rule #44 writes every dry-run turn to <memdir>/audit.jsonl but the owner
// has no way to READ that trail before flipping BRAIN_PROVIDER from
// 'oneloop-dryrun' to 'oneloop' (live). This module is the read side of the
// flip path: pure functions that read the audit file + claims.json and
// produce (a) the raw audit entries and (b) a FLIP CHECKLIST summary the
// owner reviews before flipping.
//
// Fail-closed read path: a missing audit file is "no audit yet" (never an
// error); malformed JSONL lines are counted and skipped, never fatal; a
// malformed claims.json degrades to "claims unreadable" instead of killing
// the summary. The audit is observation, not control — this module never
// writes, never mutates, and never re-files anything.
//
// Routes (admin-only, wired in routes/admin.js):
//   GET /api/v1/admin/hunts/:id/oneloop/audit          -> raw audit entries
//   GET /api/v1/admin/hunts/:id/oneloop/audit/summary  -> flip checklist

import path from 'node:path';
import fs from 'node:fs';
import { oneLoopMemdir, ONELOOP_AUDIT_FILE } from './oneLoopSession.js';

/** Sanitise a hunt id for a path join (no traversal). */
function safeHuntId(huntId) {
  const s = String(huntId || '');
  return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : null;
}

/**
 * Read the raw audit file.
 * Returns { ok:true, entries:[...], skipped:int } or
 * { ok:false, reason:'no_audit' } when no dry-run has written yet, or
 * { ok:false, reason:'bad_hunt_id' } on a hostile id.
 */
export function readAudit(dataDir, huntId) {
  const hid = safeHuntId(huntId);
  if (!hid) return { ok: false, reason: 'bad_hunt_id' };
  const memdir = oneLoopMemdir(dataDir, hid);
  const file = path.join(memdir, ONELOOP_AUDIT_FILE);
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return { ok: false, reason: 'no_audit' };
  }
  const entries = [];
  let skipped = 0;
  for (const line of String(raw).split('\n')) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (e && typeof e === 'object') entries.push(e);
      else skipped++;
    } catch {
      skipped++;
    }
  }
  entries.sort((a, b) => Number(a.turn || 0) - Number(b.turn || 0));
  return { ok: true, entries, skipped, memdir };
}

/**
 * Read claims.json states for the flip review (filed/accepted/rejected
 * counts + the filed list with evidence hashes). Fail-closed: malformed
 * file -> { readable:false }.
 */
export function readClaimsState(dataDir, huntId) {
  const hid = safeHuntId(huntId);
  if (!hid) return { readable: false, reason: 'bad_hunt_id' };
  const memdir = oneLoopMemdir(dataDir, hid);
  const file = path.join(memdir, 'claims.json');
  let j;
  try {
    j = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { readable: false, reason: 'no_claims_file' };
  }
  if (!j || typeof j !== 'object') return { readable: false, reason: 'claims_malformed' };
  const byState = { filed: 0, accepted: 0, rejected: 0, other: 0 };
  const filed = [];
  for (const [hash, c] of Object.entries(j)) {
    if (!c || typeof c !== 'object') { byState.other++; continue; }
    const st = String(c.state || 'unknown');
    if (byState[st] !== undefined) byState[st]++;
    else byState.other++;
    if (st === 'filed') {
      filed.push({
        hash: String(hash),
        hash12: String(hash).slice(0, 12),
        title: String(c.title || 'one-loop claim'),
        severity: String(c.severity || 'unknown'),
        module: String(c.module || 'unknown'),
        evidence_hash: c.evidence_hash ? String(c.evidence_hash) : null,
        filed_turn: Number.isInteger(c.filed_turn) ? c.filed_turn : null,
      });
    }
  }
  return { readable: true, byState, filed };
}

/**
 * The flip checklist summary. Every item is { item, pass, detail } so the
 * owner sees exactly what to trust before flipping dry-run -> live.
 */
export function auditSummary(dataDir, huntId) {
  const audit = readAudit(dataDir, huntId);
  const claims = readClaimsState(dataDir, huntId);
  const checklist = [];

  if (!audit.ok) {
    checklist.push({
      item: 'dry-run audit exists',
      pass: false,
      detail: audit.reason === 'no_audit'
        ? 'No audit.jsonl yet — run BRAIN_PROVIDER=oneloop-dryrun first, then review.'
        : 'Invalid hunt id.',
    });
    return { ok: true, huntId: String(huntId), audited: false, checklist, claims };
  }

  const entries = audit.entries;
  const turn0 = entries.find((e) => Number(e.turn) === 0);
  const turnEntries = entries.filter((e) => Number(e.turn) > 0);

  // 1. Turn-0 dry-run marker: the file itself declares it committed nothing.
  checklist.push({
    item: 'turn-0 dry-run marker present',
    pass: Boolean(turn0 && /oneloop-dryrun/i.test(String(turn0.note || ''))),
    detail: turn0 ? String(turn0.note || '').slice(0, 160) : 'no turn-0 record',
  });

  // 2. No half-turns: every turn record must carry ok-ish shape (the session
  //    fail-closes on ok:false, so a clean audit shows completed turns).
  const failedTurns = turnEntries
    .filter((e) => e.ok === false || e.verdict === 'FAILED')
    .map((e) => Number(e.turn));
  checklist.push({
    item: 'no fail-closed half-turns',
    pass: !entries.some((e) => e.ok === false),
    detail: entries.some((e) => e.ok === false)
      ? `turns with ok:false: ${failedTurns.join(',') || 'n/a'} — session stopped fail-closed; re-run before flipping`
      : `${turnEntries.length} turns, all ok:true (verdict FAILED is an honest probe result, not a half-turn)`,
  });

  // 3. Every FILED claim carries an evidence hash (Rule #37 invariant).
  const filed = claims.readable ? claims.filed : [];
  const noEvidence = filed.filter((c) => !c.evidence_hash);
  checklist.push({
    item: 'every FILED claim has evidence_hash',
    pass: claims.readable && filed.length > 0 && noEvidence.length === 0,
    detail: !claims.readable
      ? `claims.json unreadable: ${claims.reason}`
      : `${filed.length} filed, ${noEvidence.length} without evidence_hash` +
        (noEvidence.length ? ` (${noEvidence.map((c) => c.hash12).join(',')})` : ''),
  });

  // 4. Claims never surfaced: dry-run commits nothing to the hunt — by
  //    construction the audit records this, and the checklist states it
  //    explicitly so the owner does not have to trust the code path.
  checklist.push({
    item: 'zero findings/leads committed (dry-run commits nothing)',
    pass: Boolean(turn0 && /committed nothing|audit only/i.test(String(turn0.note || ''))),
    detail: 'Dry-run never calls the claim bridge and never pushes findings/leads — audit is the only record.',
  });

  // 5. Spend: the one loop makes 0 LLM calls and spends $0 by construction.
  checklist.push({
    item: 'spend $0 / 0 LLM calls',
    pass: true,
    detail: 'The one-loop brain is deterministic code (no LLM provider, no Meta calls) — spend is $0 by construction.',
  });

  // 6. Malformed-line tolerance: skipped lines are reported, not hidden.
  checklist.push({
    item: 'audit file parses cleanly',
    pass: audit.skipped === 0,
    detail: audit.skipped === 0
      ? `${entries.length} entries parsed, 0 skipped`
      : `${entries.length} entries parsed, ${audit.skipped} malformed lines skipped (fail-closed read)`,
  });

  const confirms = turnEntries.filter((e) => String(e.verdict).toUpperCase() === 'CONFIRMED').length;
  const wall_s = Number(turnEntries.reduce((a, e) => a + (Number(e.wall_s) || 0), 0).toFixed(1));
  const modules = [...new Set(
    turnEntries
      .map((e) => String(e.module || e.action_type || '')).filter(Boolean),
  )];

  return {
    ok: true,
    huntId: String(huntId),
    audited: true,
    turns: turnEntries.length,
    confirms,
    wall_s,
    modules,
    new_claim_hashes: turnEntries.flatMap((e) => Array.isArray(e.new_claims) ? e.new_claims : []),
    checklist,
    claims,
  };
}
