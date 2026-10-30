// Dark Matter — RULE #43 (30 Oct 2026): BACKEND CLAIM BRIDGE.
//
// The one-loop brain files claims LOCAL-ONLY (claims.json, Rule #32 state
// machine). This bridge files newly FILED loop claims through the REAL
// claim pipeline — claimGateCheck + assessResult — so CONFIRMED modules
// become pipeline-verified findings instead of eternal leads.
//
// Flow per claim (fail-closed at every step; a skip leaves the claim
// FILED and the session surfaces it as a lead, exactly like Rule #42):
//   1. buildClaimAction: the claim record must carry the verifier-facing
//      proof package (command/evidence/counterevidence/confidence,
//      persisted by record_filed since Rule #43). Missing -> skip, never
//      re-derived, never invented.
//   2. claimGateCheckFn: the same completeness gate the AI/brain paths
//      use. Bounced -> skip (leave FILED).
//   3. Stage the probe: parse the probe filename + marker out of the
//      stored probe command, sed-rebase the probe onto the hunt target
//      (the same rebase the loop applies, Rule #41), copy the rebased
//      probe into the hunt container. Any failure -> skip: the verifier
//      must re-run the EXACT probe for independent reproduction.
//   4. assessFn(huntId, target, plan, result): the real pipeline verifier
//      (evidenceReproduced + 4-step verifyPipeline + 404 error-page
//      protection). It records its validation event into the hunt's
//      events.jsonl itself.
//   5. After all claims: run the terminal scan
//      (brain-apiloop-v1.py --scan-validation) once against the hunt's
//      events.jsonl, folding accepted/rejected back into the loop's
//      claims.json + dead ends (Rule #21/32 machinery, Rule #43 verdict
//      vocabulary: the pipeline's 'verified' maps to accepted).
//
// The bridge NEVER writes claims.json itself and never marks a claim
// terminal on its own authority — only the pipeline's validation events,
// applied by the scan, move a claim out of FILED. The 100% TRUTH RULE
// holds: unverified claims stay leads (verified:false).
//
// RULE #53 (30 Oct 2026): REHEARSAL RECORD IN THE SESSION MEMDIR.
// Rule #52's flip checklist reads rehearsal evidence from
// <memdir>/rehearsal.json, but the bridge never wrote it — the Rule #48
// re-run evidence lived as a probe-lab sidecar, so the checklist had
// nothing to read on a real session (sidecar gap). The bridge now
// persists the rehearsal record itself (buildRehearsalRecord +
// recordRehearsal, fail-closed, hash-keyed merge across batched bridge
// calls). Evidence-only: the checklist reads it read-only; the record
// never influences bridging, and a failed write never breaks bridging.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/** The probes' lab base — sed-rebased onto the hunt target (Rule #41). */
export const LIVE_PROBE_BASE = 'http://172.17.0.1:3100';
const LAB_BASE_HOST = '172.17.0.1';

/**
 * Rehearsal evidence file inside a hunt's one-loop memdir (Rule #53).
 * Read read-only by the Rule #52 flip checklist (oneLoopFlipcheck.js
 * re-exports this constant); written by recordRehearsal below.
 */
export const REHEARSAL_FILE = 'rehearsal.json';

/**
 * Terminal validation verdicts — the pipeline vocabulary the Rule #52
 * checklist accepts (kept in sync with its TERMINAL_VERDICTS; this
 * module never invents a verdict, only records observed ones).
 */
const TERMINAL_VERDICTS = new Set([
  'verified', 'accepted', 'rejected', 'gate-rejected', 'not-interesting',
]);

/**
 * Parse the loop's stored probe command for the probe filename and the
 * fixed marker: `PF=<file>; MK=<marker>; TB=<target>; ...` (shlex-quoted).
 * Returns { probeFile, marker } or null (fail-closed: unparseable).
 */
export function parseProbeCommand(cmd) {
  const s = String(cmd || '');
  const pf = /([A-Za-z0-9_]+\.(?:py|sh))\b/.exec(s);
  let m = /MK='((?:[^'\\]|\\.)*)'/.exec(s);
  let marker = m ? m[1].replace(/\\'/g, "'") : null;
  if (!marker) {
    m = /MK=([^\s;]+)/.exec(s);
    marker = m ? m[1] : null;
  }
  if (!pf || !marker) return null;
  return { probeFile: pf[1], marker };
}

/**
 * Sed-rebase a probe's source text onto the hunt target (mirrors the
 * loop's _probe_cmd, Rule #41 fix included): the leak check only fires
 * when the target differs from the lab base. Returns { text } or
 * { leak: true } (fail-closed: refuse to stage a probe that would phone
 * the lab box on a different target).
 */
export function rebaseProbeText(text, targetBase) {
  const tb = String(targetBase || '').trim().replace(/\/+$/, '');
  const rebased = String(text || '').split(LIVE_PROBE_BASE).join(tb);
  const sameBase = tb.toLowerCase() === LIVE_PROBE_BASE.toLowerCase();
  if (!sameBase && new RegExp(LAB_BASE_HOST.replace(/\./g, '\\.')).test(rebased)) {
    return { leak: true };
  }
  return { text: rebased };
}

/**
 * Build the claim_finding-shaped proof package the pipeline expects.
 * Returns null when any verifier-facing field is missing — the bridge
 * never re-derives or invents proof (fail-closed).
 */
export function buildClaimAction(rec) {
  if (!rec || typeof rec !== 'object') return null;
  const str = (v) => String(v || '').trim();
  const title = str(rec.title);
  const cls = str(rec.class);
  const command = str(rec.command);
  const evidence = str(rec.evidence);
  const counterevidence = str(rec.counterevidence);
  const confidence = str(rec.confidence);
  if (!title || !cls || !command || !evidence || !counterevidence || !confidence) {
    return null;
  }
  return {
    title: title.slice(0, 200),
    class: cls,
    severity: str(rec.severity) || 'unknown',
    module: str(rec.module) || 'unknown',
    command: command.slice(0, 4000),
    evidence,
    counterevidence,
    confidence,
    evidence_hash: rec.evidence_hash ? String(rec.evidence_hash) : null,
  };
}

function shQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

/**
 * RULE #53 — build the rehearsal record from a bridgeClaims run.
 * Pure (no IO). Only OBSERVED verdicts become validations:
 *   - claims.json state after the scan fold, when it is in the terminal
 *     vocabulary (accepted/rejected/...) -> that verdict
 *   - bridged + pipeline-verified but no terminal state observed -> 'verified'
 *   - bridged but neither -> unresolved (fail-closed: the Rule #52
 *     checklist must NOT count it as rehearsal evidence)
 * Skipped claims are recorded under skips with their reason, never as
 * validations — they stay FILED and the checklist must fail S2/S3.
 */
export function buildRehearsalRecord({ huntId, target, byHash = {}, claims = [], bridged = 0, disabled = false }) {
  const meta = {};
  for (const c of (claims || [])) {
    if (c && typeof c === 'object' && c.hash) {
      meta[String(c.hash)] = {
        module: c.module ? String(c.module) : null,
        title: c.title ? String(c.title).slice(0, 200) : null,
      };
    }
  }
  const at = new Date().toISOString();
  const validations = [];
  const skips = [];
  const unresolved = [];
  for (const [hash, b] of Object.entries(byHash || {})) {
    if (!b || typeof b !== 'object') continue;
    const m = meta[hash] || {};
    if (b.skip) {
      skips.push({ hash, module: m.module, title: m.title, reason: String(b.skip).slice(0, 500) });
      continue;
    }
    if (!b.bridged) {
      unresolved.push({ hash, module: m.module, title: m.title, note: 'not bridged, no skip recorded' });
      continue;
    }
    const terminal = b.terminal ? String(b.terminal).toLowerCase() : null;
    if (terminal && TERMINAL_VERDICTS.has(terminal)) {
      validations.push({ hash, module: m.module, title: m.title, verdict: terminal, observed_at: at });
    } else if (b.verified) {
      validations.push({ hash, module: m.module, title: m.title, verdict: 'verified', observed_at: at });
    } else {
      unresolved.push({
        hash, module: m.module, title: m.title, bridged: true, verified: false,
        terminal: b.terminal || null,
        note: 'no terminal verdict observed (fail-closed: not rehearsal evidence)',
      });
    }
  }
  return {
    rule: 53,
    huntId: String(huntId),
    target: String(target || ''),
    recorded_at: at,
    pipeline: 'claimGateCheck + assessResult (Rule #43)',
    bridged_count: bridged,
    bridge_disabled: Boolean(disabled),
    validations,
    skips,
    unresolved,
  };
}

/**
 * RULE #53 — persist the rehearsal record into the session memdir.
 * Merges hash-keyed across batched bridge calls (a claim skipped in one
 * batch and bridged in a later one ends up validated, not skipped).
 * Atomic write (tmp + rename). Fail-closed: returns { ok:false, error },
 * never throws — a failed write must never break bridging.
 */
export function recordRehearsal(memdir, record) {
  try {
    const md = String(memdir || '');
    if (!md) return { ok: false, error: 'no memdir' };
    const file = path.join(md, REHEARSAL_FILE);
    let existing = null;
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (j && typeof j === 'object') existing = j;
    } catch { /* absent or corrupt -> start fresh */ }
    const keyed = (arr) => {
      const m = {};
      for (const v of (arr || [])) {
        if (v && typeof v === 'object' && v.hash) m[String(v.hash)] = v;
      }
      return m;
    };
    const valMap = keyed(existing && existing.validations);
    const skipMap = keyed(existing && existing.skips);
    const unrMap = keyed(existing && existing.unresolved);
    for (const v of (record.validations || [])) {
      if (v && v.hash) {
        valMap[String(v.hash)] = v;
        delete skipMap[String(v.hash)]; // later bridge wins over an earlier skip
        delete unrMap[String(v.hash)];
      }
    }
    for (const s of (record.skips || [])) {
      if (s && s.hash && !valMap[String(s.hash)]) skipMap[String(s.hash)] = s;
    }
    for (const u of (record.unresolved || [])) {
      if (u && u.hash && !valMap[String(u.hash)]) unrMap[String(u.hash)] = u;
    }
    const merged = {
      rule: 53,
      huntId: record.huntId,
      target: record.target,
      pipeline: record.pipeline,
      recorded_batches: ((existing && Number.isInteger(existing.recorded_batches)
        ? existing.recorded_batches : 0) + 1),
      first_recorded_at: (existing && existing.first_recorded_at) || record.recorded_at,
      recorded_at: record.recorded_at,
      validations: Object.values(valMap),
      skips: Object.values(skipMap),
      unresolved: Object.values(unrMap),
    };
    const tmp = file + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(merged, null, 1), 'utf8');
    fs.renameSync(tmp, file);
    return { ok: true, file, validations: merged.validations.length };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/**
 * Bridge newly FILED loop claims through the real claim pipeline.
 *
 * @param {object} args
 *   huntId, target, memdir — the hunt, its explicit target, the loop memdir
 *   claims — [{ hash, title, severity, module, evidence_hash, filed_turn,
 *     command, evidence, counterevidence, confidence }] — only FILED ones
 *   deps — { claimGateCheckFn, assessFn, copyToContainerFn, probeDir,
 *     pythonBin, apiloopScript, eventsPath }
 * @returns {Promise<object>} { bridged, byHash, scan, log, disabled }
 *   byHash[hash] = { bridged, verified, verification, rec, terminal, skip? }
 */
export async function bridgeClaims({ huntId, target, memdir, claims = [], deps = {} }) {
  const log = [];
  const byHash = {};
  const note = (msg) => log.push(msg);
  const {
    claimGateCheckFn, assessFn, copyToContainerFn,
    probeDir, pythonBin, apiloopScript, eventsPath,
  } = deps;

  if (typeof claimGateCheckFn !== 'function' || typeof assessFn !== 'function') {
    note('bridge disabled: no pipeline verifier wired (claims stay FILED, leads as Rule #42)');
    return { bridged: 0, byHash, scan: null, log, disabled: true };
  }

  const hid = String(huntId);
  const tb = String(target || '').trim();
  let bridged = 0;

  // One claim at a time; every skip is fail-closed (claim stays FILED)
  // and the loop moves on to the next claim — never throws.
  const bridgeOne = async (c) => {
    const tag = `claim ${String(c.hash || '').slice(0, 12)} (${c.module || '?'})`;

    const action = buildClaimAction(c);
    if (!action) return { skip: 'no verifier-facing proof package on the claim record' };

    let gate;
    try {
      gate = claimGateCheckFn({
        title: action.title,
        cls: action.class,
        command: action.command,
        poc: '',
        pocExists: false,
        evidence: action.evidence,
        counterevidence: action.counterevidence,
        confidence: action.confidence,
        rationale: '',
      });
    } catch (e) {
      return { skip: 'claim gate threw: ' + ((e && e.message) || e) };
    }
    if (!gate || !gate.ok) {
      const missing = gate && Array.isArray(gate.missing)
        ? gate.missing.map((x) => (x && x.field) || x).join(',')
        : 'unknown';
      return { skip: 'pipeline completeness gate bounced: ' + missing };
    }

    const parsed = parseProbeCommand(action.command);
    if (!parsed) return { skip: 'stored probe command unparseable (no probe file/marker)' };
    const { probeFile, marker } = parsed;

    if (!probeDir) return { skip: 'no probeDir wired' };
    const srcPath = path.join(String(probeDir), probeFile);
    let srcText;
    try {
      srcText = fs.readFileSync(srcPath, 'utf8');
    } catch {
      return { skip: 'probe file not found in bundle: ' + probeFile };
    }
    const rebased = rebaseProbeText(srcText, tb);
    if (rebased.leak) return { skip: 'rebase leak: lab base survived the rebase' };

    if (typeof copyToContainerFn !== 'function') {
      return { skip: 'no container copy wired — verifier cannot re-run the probe' };
    }
    const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), `oneloop-bridge-${hid}-`));
    const hostPath = path.join(stageDir, probeFile);
    const destPath = `/tmp/oneloop-probes/${probeFile}`;
    try {
      fs.writeFileSync(hostPath, rebased.text, 'utf8');
      const cp = await copyToContainerFn(hid, hostPath, destPath);
      if (!cp || !cp.ok) return { skip: 'container stage failed: ' + ((cp && cp.error) || 'unknown') };
    } catch (e) {
      return { skip: 'container stage threw: ' + ((e && e.message) || e) };
    } finally {
      try { fs.rmSync(stageDir, { recursive: true, force: true }); } catch { /* best-effort */ }
    }

    const runner = probeFile.endsWith('.sh') ? 'bash' : 'python3';
    const containerCmd = `${runner} ${destPath} ${shQuote(marker)}`;
    const plan = {
      test: action.title,
      command: containerCmd,
      why: 'One-loop brain claim — the deterministic brain reproduced this itself; the bridge re-runs the same probe in the hunt container for independent pipeline verification.',
      hypothesis: action.title,
    };
    const result = { stdout: action.evidence, stderr: '', code: 0 };

    let rec = null;
    try {
      rec = await assessFn(hid, tb, plan, result);
    } catch (e) {
      return { skip: 'pipeline verifier threw: ' + ((e && e.message) || e) };
    }
    const verified = Boolean(rec && rec.verified);
    return {
      bridged: true,
      verified,
      verification: rec ? rec.verification : null,
      rec: rec || null,
    };
  };

  for (const c of claims) {
    const tag = `claim ${String(c.hash || '').slice(0, 12)} (${c.module || '?'})`;
    let out;
    try {
      out = await bridgeOne(c);
    } catch (e) {
      out = { skip: 'bridge threw: ' + ((e && e.message) || e) };
    }
    if (out.skip) {
      note(`${tag}: BRIDGE-SKIP — ${out.skip} (stays FILED)`);
      byHash[c.hash] = { bridged: false, skip: out.skip };
      continue;
    }
    bridged += 1;
    note(`${tag}: PIPELINE ${out.verified ? 'VERIFIED' : 'NOT verified'} — ` +
      (out.verified ? 'counts as a finding'
        : 'dead end, never re-claimed: ' + (out.verification || 'rejected')));
    byHash[c.hash] = { ...out, terminal: null }; // filled by the scan fold below
  }

  // Fold the pipeline's validation events back into the loop's
  // claims.json + dead ends via the proven terminal scan (Rule #21/32).
  // The bridge never marks claims terminal on its own authority.
  let scan = null;
  if (bridged > 0 && eventsPath && apiloopScript) {
    try {
      const r = spawnSync(String(pythonBin || 'python3'),
        [String(apiloopScript), '--scan-validation', String(eventsPath), '--memdir', String(memdir)],
        { encoding: 'utf8', timeout: 60000 });
      scan = {
        exit: r.status,
        stdout: String(r.stdout || '').slice(0, 2000),
        stderr: String(r.stderr || '').slice(0, 500),
      };
      note(`terminal scan exit=${r.status}`);
    } catch (e) {
      scan = { exit: null, error: String((e && e.message) || e) };
      note('terminal scan threw: ' + scan.error);
    }
    // Re-read claims.json: confirm the scan actually folded the verdicts.
    try {
      const claimsNow = JSON.parse(fs.readFileSync(path.join(String(memdir), 'claims.json'), 'utf8'));
      for (const [hash, b] of Object.entries(byHash)) {
        if (b && b.bridged && claimsNow[hash]) {
          b.terminal = claimsNow[hash].state || null;
          note(`claim ${hash.slice(0, 12)}: claims.json state=${b.terminal}`);
        }
      }
    } catch (e) {
      note('claims.json re-read failed: ' + ((e && e.message) || e));
    }
  }

  // RULE #53 — persist the rehearsal record into the session memdir so
  // the Rule #52 flip checklist reads real evidence, not a sidecar.
  // Reached only when the bridge ran (the disabled case returned early
  // above). Evidence-only: a failed write is noted and never breaks
  // bridging.
  try {
    const rec = buildRehearsalRecord({ huntId: hid, target: tb, byHash, claims, bridged, disabled: false });
    const rr = recordRehearsal(memdir, rec);
    note(rr.ok
      ? `rehearsal recorded: ${rr.file} (${rr.validations} validations)`
      : `rehearsal write failed (fail-closed, bridging unaffected): ${rr.error}`);
  } catch (e) {
    note('rehearsal record threw (fail-closed, bridging unaffected): ' + ((e && e.message) || e));
  }

  return { bridged, byHash, scan, log, disabled: false };
}
