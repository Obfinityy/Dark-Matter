#!/usr/bin/env node
/**
 * index.js — Infinity AI agent poller (headless).
 *
 * Runs on the agent machine (owner's dedicated box or Oracle free-tier VM).
 * The poller PULLS hunt jobs from the backend every ~30s:
 *
 *   list jobs → claim executor='agent' jobs → fetch the account's brain
 *   links → run the hunt loop on the local Kali VM (via vm-runner) →
 *   stream progress events back → post completion.
 *
 * The backend NEVER pushes commands and NEVER routes computer-control.
 * It is pure orchestration: job queue + results. All execution stays on
 * this machine.
 *
 * Setup: `npm run login` once (stores a JWT in ~/.infinity-ai/poller.json),
 * then `node src/index.js` (keep running — systemd/pm2 recommended).
 */
import { loadConfig } from './config.js';
import { createBackendClient } from './backendClient.js';
import { createJobRunner } from './jobRunner.js';
import { createStateStore } from './state.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString(), '[poller]', ...a);

async function main() {
  const config = loadConfig();
  if (!config.token) {
    console.error(
      '[poller] No token configured. Run `npm run login` first (or set POLLER_TOKEN).'
    );
    process.exit(1);
  }

  const backend = createBackendClient({ backendUrl: config.backendUrl, token: config.token });
  const state = createStateStore(config.stateDir);
  const runner = createJobRunner({ backend, vmRunnerUrl: config.vmRunnerUrl, state });

  log(`starting — backend=${config.backendUrl} poller=${config.pollerId} every=${config.pollIntervalMs}ms`);

  // On restart: if we died mid-hunt, the job is still 'running' with our
  // lease. Re-check its backend state; if still running, resume the loop.
  const active = state.activeJob;
  if (active?.jobId) {
    log(`recovering active job ${active.jobId} from previous run`);
    try {
      const job = await backend.getJob(active.jobId);
      if (job && !['completed', 'failed', 'cancelled'].includes(job.status)) {
        await runOneJob(backend, runner, state, config, job);
      } else {
        state.clearActiveJob();
      }
    } catch (err) {
      log(`recovery check failed: ${err.message} — will re-poll`);
      state.clearActiveJob();
    }
  }

  // Main poll loop.
  for (;;) {
    try {
      // One-way presence signal every tick: the Hunt console reads it via
      // GET /api/v1/agent/status. Failures here must never break polling.
      try {
        await backend.heartbeat({ pollerId: config.pollerId, runner: config.runner });
      } catch (hbErr) {
        if (hbErr.status === 401) {
          log('AUTH FAILED (401) — token expired or revoked. Run `npm run login` again to refresh it.');
        } else {
          log(`heartbeat failed (non-fatal): ${hbErr.message}`);
        }
      }
      await pollOnce(backend, runner, state, config);
    } catch (err) {
      if (err.status === 401) {
        log('AUTH FAILED (401) — token expired or revoked. Run `npm run login` again to refresh it.');
      } else {
        log(`poll error: ${err.message}`);
      }
    }
    await sleep(config.pollIntervalMs);
  }
}

/** One poll tick: find a claimable job and run it (one at a time). */
async function pollOnce(backend, runner, state, config) {
  if (state.activeJob) return; // already running something
  const jobs = await backend.listJobs();
  const claimable = jobs.filter(
    (j) => j.executor === 'agent' && j.status === 'queued'
  );
  if (!claimable.length) return;
  // Oldest first.
  claimable.sort((a, b) => new Date(a.startedAt || 0) - new Date(b.startedAt || 0));
  const job = claimable[0];
  log(`claiming job ${job.id} (${job.target})`);
  const claim = await backend.claimJob(job.id, config.pollerId);
  log(`claimed: ${JSON.stringify(claim)}`);
  state.setActiveJob({ jobId: job.id, lease: claim.lease, startedAt: new Date().toISOString() });
  await runOneJob(backend, runner, state, config, job);
}

async function runOneJob(backend, runner, state, config, job) {
  const jobId = job.id;
  let stopRequested = false;

  // Watch for user pause/cancel from anywhere (browser, etc.).
  const watcher = setInterval(async () => {
    try {
      const fresh = await backend.getJob(jobId);
      if (fresh?.pauseRequested || fresh?.status === 'paused') stopRequested = 'paused';
      if (fresh?.status === 'cancelled') stopRequested = 'cancelled';
    } catch {
      /* network blip — keep going */
    }
  }, 5000);

  try {
    const brainLinks = await backend.getBrainLinks();
    const outcome = await runner.run(job, brainLinks, async () => stopRequested);
    if (stopRequested === 'paused') {
      log(`job ${jobId} paused — snapshot saved, will resume when continued`);
      await backend.postEvent(jobId, {
        type: 'agent.paused',
        message: 'Hunt paused by user — VM snapshot saved. Continue anytime to resume exactly here.',
      });
      state.setActiveJob(null); // release; a later poll will re-claim on continue
    } else if (stopRequested === 'cancelled') {
      log(`job ${jobId} cancelled by user`);
      state.markJobDone(jobId, 'cancelled');
    } else {
      log(`job ${jobId} finished: ${outcome.outcome}`);
      state.markJobDone(jobId, outcome.outcome);
    }
  } catch (err) {
    log(`job ${jobId} failed: ${err.message}`);
    try {
      await backend.postEvent(jobId, {
        type: 'agent.failed',
        level: 'ERROR',
        message: `Hunt failed on agent machine: ${err.message}`,
      });
    } catch {
      /* ignore */
    }
    state.markJobDone(jobId, 'failed');
  } finally {
    clearInterval(watcher);
    if (state.activeJob?.jobId === jobId) state.setActiveJob(null);
  }
}

main().catch((err) => {
  console.error('[poller] fatal:', err);
  process.exit(1);
});
