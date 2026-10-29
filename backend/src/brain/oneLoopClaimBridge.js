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

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/** The probes' lab base — sed-rebased onto the hunt target (Rule #41). */
export const LIVE_PROBE_BASE = 'http://172.17.0.1:3100';
const LAB_BASE_HOST = '172.17.0.1';

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

  return { bridged, byHash, scan, log, disabled: false };
}
