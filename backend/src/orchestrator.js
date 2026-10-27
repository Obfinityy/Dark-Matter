// Hunt Orchestrator — the "head" of the hunt team.
//
// Architecture: ONE head (orchestrator) + MULTIPLE specialist workers.
// The head thinks like an elite human hacker: it studies the target,
// breaks the hunt into missions, assigns each to the right specialist,
// reviews their work, and writes the final report.
//
//   Head (this file)         — strategy, delegation, synthesis, reporting
//   Worker: recon            — mapping, enumeration, fingerprinting
//   Worker: exploiter        — vulnerability testing like a human would
//   Worker: verifier         — independent confirmation of findings
//   Worker: reporter         — professional report generation
//
// Workers run INSIDE the Kali container (the "computer") via docker exec.
// The head runs on the host and drives everything through the container —
// like a human hacker's brain directing their hands on the keyboard.

import { execInHuntContainer } from './huntRunner.js';
import { appendHuntEvent, readHuntMeta, writeHuntMetaCheckpoint } from './store.js';
import { think } from './huntAgent.js';

/**
 * Merge persisted orchestrator state with this instance's — UNION,
 * never replace. A fresh orchestrator (resume, backend restart, mode
 * conversion) starts with findings: [] — persisting that over the
 * stored list wiped verified findings from meta.json (observed live:
 * 2 → 0 between 21:19 and 21:28 IST, 27 Oct 2026). Pure, for tests.
 * Dedupes by (title, url) for findings and (worker, mission) for
 * missions; the first copy wins on a key collision.
 */
export function mergeOrchestratorState(prev, next) {
  const p = (prev && typeof prev === 'object') ? prev : {};
  const n = (next && typeof next === 'object') ? next : {};
  const union = (list, keyFn) => {
    const seen = new Map();
    for (const item of Array.isArray(list) ? list : []) {
      if (!item || typeof item !== 'object') continue;
      const k = keyFn(item);
      if (k && !seen.has(k)) seen.set(k, item);
    }
    return [...seen.values()];
  };
  return {
    missions: union([...(p.missions || []), ...(n.missions || [])], (m) => `${m.worker || ''}|${m.mission || ''}`),
    findings: union([...(p.findings || []), ...(n.findings || [])], (f) => `${f.title || ''}|${f.url || ''}`),
    updatedAt: new Date().toISOString(),
  };
}

export const WORKER_ROLES = {
  recon: {
    title: 'Reconnaissance Specialist',
    desc: 'Maps the target like a human: ports, services, tech stack, endpoints, subdomains.',
  },
  exploiter: {
    title: 'Exploitation Specialist',
    desc: 'Tests vulnerabilities manually-style: tries payloads, observes, adapts — not just scanner output.',
  },
  verifier: {
    title: 'Verification Specialist',
    desc: 'Independently re-tests every finding. Only reproducible issues become confirmed vulnerabilities.',
  },
  reporter: {
    title: 'Report Specialist',
    desc: 'Writes professional bug-bounty reports: summary, impact, reproduction steps, remediation.',
  },
};

/**
 * A worker is a focused task runner inside the Kali container.
 * The head gives it a mission; it reports back with evidence.
 */
export class HuntWorker {
  constructor(huntId, role, mission) {
    this.huntId = huntId;
    this.role = role;
    this.mission = mission;
    this.id = `${role}-${Date.now().toString(36)}`;
    this.status = 'spawned';
    this.result = null;
  }

  async execute(command, timeoutMs = 120000) {
    this.status = 'working';
    appendHuntEvent(this.huntId, {
      type: 'worker',
      worker: this.id,
      role: this.role,
      status: 'working',
      command: String(command).slice(0, 200),
      at: new Date().toISOString(),
    });
    try {
      const res = await execInHuntContainer(this.huntId, String(command).slice(0, 1000), timeoutMs);
      this.status = 'done';
      const output = (res.stdout + '\n' + res.stderr).slice(0, 5000);
      appendHuntEvent(this.huntId, {
        type: 'worker',
        worker: this.id,
        role: this.role,
        status: 'done',
        outputLength: output.length,
        at: new Date().toISOString(),
      });
      return { ok: true, output, code: res.code };
    } catch (err) {
      this.status = 'failed';
      appendHuntEvent(this.huntId, {
        type: 'worker',
        worker: this.id,
        role: this.role,
        status: 'failed',
        error: err.message || String(err),
        at: new Date().toISOString(),
      });
      return { ok: false, error: err.message || String(err), output: '' };
    }
  }
}

/**
 * The Head — elite hacker brain. Plans, delegates, reviews, reports.
 */
export class HuntOrchestrator {
  constructor(huntId, target, mode = 'normal') {
    this.huntId = huntId;
    this.target = target;
    this.mode = mode;
    this.workers = [];
    this.missions = [];
    this.findings = [];
  }

  /** Head spawns a worker for a mission. */
  spawnWorker(role, mission) {
    if (!WORKER_ROLES[role]) throw new Error(`Unknown worker role: ${role}`);
    const worker = new HuntWorker(this.huntId, role, mission);
    this.workers.push(worker);
    this.missions.push({ worker: worker.id, role, mission, at: new Date().toISOString() });
    think(this.huntId, `Head: spawning ${WORKER_ROLES[role].title} — mission: ${mission.slice(0, 120)}`);
    appendHuntEvent(this.huntId, {
      type: 'orchestrator',
      action: 'spawn_worker',
      role,
      mission: mission.slice(0, 300),
      at: new Date().toISOString(),
    });
    return worker;
  }

  /** Head reviews a worker's result and decides: accept, retry, or escalate. */
  review(worker, result, criteria) {
    const accepted = result.ok && criteria(result);
    appendHuntEvent(this.huntId, {
      type: 'orchestrator',
      action: 'review',
      worker: worker.id,
      accepted,
      at: new Date().toISOString(),
    });
    think(this.huntId, accepted
      ? `Head: ${worker.role} delivered — accepted.`
      : `Head: ${worker.role} result rejected — re-tasking.`);
    return accepted;
  }

  /** Head's report: called on-demand via the report button. */
  async generateReport() {
    const reporter = this.spawnWorker('reporter', `Write a professional bug bounty report for ${this.target} covering ${this.findings.length} confirmed findings.`);
    think(this.huntId, `Head: compiling final report from ${this.findings.length} confirmed findings.`);
    // The actual markdown/PDF rendering happens in routes/hunts.js buildReportMarkdown.
    // Here the head structures the data the reporter needs.
    return {
      target: this.target,
      mode: this.mode,
      huntId: this.huntId,
      generatedAt: new Date().toISOString(),
      findings: this.findings,
      missions: this.missions,
      workerCount: this.workers.length,
    };
  }

  /** Persist orchestrator state to the hunt meta for resume.
   * Merges via writeHuntMetaCheckpoint (27 Oct 2026, 404-verified
   * audit): the old wholesale writeHuntMeta spread a snapshot read
   * before long awaited work and wrote the whole stale object back —
   * on resume that clobbered meta.orchestrator.findings (2 → 0) and
   * could clobber any field set in the meantime. The checkpoint
   * writer merges over the meta as it exists at write time. */
  saveState() {
    try {
      const meta = readHuntMeta(this.huntId) || {};
      // MERGE, never replace (zero-genuine lane): a fresh instance's
      // empty findings must never wipe the persisted list — and the
      // guarded checkpoint writer (not wholesale writeHuntMeta) keeps
      // an owner-set pause/stop hold intact.
      const merged = mergeOrchestratorState(meta.orchestrator, {
        missions: this.missions,
        findings: this.findings,
      });
      writeHuntMetaCheckpoint(this.huntId, { orchestrator: merged });
    } catch { /* best-effort */ }
  }
}
