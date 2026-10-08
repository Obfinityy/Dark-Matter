/**
 * state.js — the poller's durable local state.
 *
 * Survives poller restarts: which job is currently claimed, per-job
 * checkpoints (phase, completed steps), and the vm-runner session token.
 * Stored as JSON under the state dir (default ~/.infinity-ai/poller-state).
 * Atomic writes (temp + rename) so a crash never corrupts it.
 */
import fs from 'node:fs';
import path from 'node:path';

const STATE_FILE = 'poller-state.json';

export function createStateStore(stateDir) {
  const filePath = path.join(stateDir, STATE_FILE);
  let state = load();

  function load() {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Missing or corrupt — start fresh.
    }
    return { activeJob: null, jobs: {} };
  }

  function persist() {
    fs.mkdirSync(stateDir, { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, filePath);
  }

  return {
    /** The currently claimed job ({ jobId, lease, startedAt, vmSession }) or null. */
    get activeJob() {
      return state.activeJob;
    },

    setActiveJob(info) {
      state.activeJob = info;
      persist();
    },

    clearActiveJob() {
      state.activeJob = null;
      persist();
    },

    /** Per-job checkpoint: { phase, stepCount, completedSteps[], updatedAt }. */
    getCheckpoint(jobId) {
      return state.jobs?.[jobId]?.checkpoint || null;
    },

    setCheckpoint(jobId, checkpoint) {
      state.jobs[jobId] = state.jobs[jobId] || {};
      state.jobs[jobId].checkpoint = { ...checkpoint, updatedAt: new Date().toISOString() };
      persist();
    },

    /** Remember the vm-runner session for a job (sessionId + token). */
    getVmSession(jobId) {
      return state.jobs?.[jobId]?.vmSession || null;
    },

    setVmSession(jobId, vmSession) {
      state.jobs[jobId] = state.jobs[jobId] || {};
      state.jobs[jobId].vmSession = vmSession;
      persist();
    },

    markJobDone(jobId, outcome) {
      state.jobs[jobId] = state.jobs[jobId] || {};
      state.jobs[jobId].finishedAt = new Date().toISOString();
      state.jobs[jobId].outcome = outcome;
      if (state.activeJob?.jobId === jobId) state.activeJob = null;
      persist();
    },

    reload() {
      state = load();
    },
  };
}
