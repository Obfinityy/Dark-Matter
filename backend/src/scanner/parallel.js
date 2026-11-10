// Dark Matter rule-based scanner — bounded-concurrency phase runner.
//
// The scanner's probe phases are independent given the setup inputs
// (fingerprint, crawl, page analysis, scan targets, forms): no probe
// reads another probe's findings and none mutates the shared inputs
// (audit 10 Nov 2026 — the probe block in index.js only reads them).
// Running them one-by-one wastes the scan's wall time on sequential
// network round-trips (a standard Juice scan measured ~611s), so the
// probe block runs here instead: a fixed worker pool pulls phase tasks
// off a queue with a bounded concurrency cap.
//
// Determinism contract (this is the whole point of the module):
// - Results merge back in TASK order, never completion order. The
//   confirmed-finding set — and the dedup first-wins winner, since
//   dedupeFindings keeps the first occurrence per key — is therefore
//   identical to a sequential run: no duplicates, no lost findings.
// - Phase records stream through onSettled in TASK order too, as the
//   frontier advances (in-order streaming): a record is emitted only
//   once every earlier task has settled. The live hunt still sees
//   progress, and result.phases keeps sequential order with the same
//   object identity the onPhase listener received.
// - One task failing (throw or timeout) never kills the scan: the
//   failure is recorded as that task's outcome and the pool carries on.
// - A task's teardown (OOB collaborator stop) runs after the task
//   settles, success or failure, and a teardown failure never masks
//   the task's outcome.
//
// Per-phase timeouts: probes keep their own timeouts (opts.timeoutMs
// per request, NUCLEI_TIMEOUT_MS for the nuclei phase) — those pass
// through untouched. The runner additionally accepts an optional
// timeoutMs: a task that exceeds it is recorded as failed with a
// timeout error and its late result is discarded. runScan leaves it
// unset by default, so production behaviour is unchanged; the option
// exists so a hung phase can be bounded without touching any probe.
// A timed-out task's run() keeps going in the background (a promise
// cannot be cancelled) — only its outcome is dropped.
export const DEFAULT_PHASE_CONCURRENCY = 5;
export const MAX_PHASE_CONCURRENCY = 16;

// Resolve the worker count: explicit opts win, then the
// DM_SCANNER_PHASE_CONCURRENCY env var, then the default. Clamped to
// 1..MAX so a typo can neither serialize the scan to a crawl nor
// flood a target with dozens of concurrent phases. Non-numeric input
// falls back to the default instead of throwing.
export function resolvePhaseConcurrency(opts = {}) {
  const raw =
    opts && opts.phaseConcurrency !== undefined && opts.phaseConcurrency !== null
      ? opts.phaseConcurrency
      : process.env.DM_SCANNER_PHASE_CONCURRENCY !== undefined
        ? process.env.DM_SCANNER_PHASE_CONCURRENCY
        : DEFAULT_PHASE_CONCURRENCY;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_PHASE_CONCURRENCY;
  return Math.min(MAX_PHASE_CONCURRENCY, Math.max(1, Math.floor(n)));
}

function timeoutError(ms) {
  return new Error(`phase timeout after ${ms}ms`);
}

// Race a task's promise against a timer. The timer is always cleared
// so a fast task leaves no handle behind.
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(timeoutError(ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Run phase tasks with bounded concurrency.
//
// tasks: [{ name, run: () => Promise<value>, teardown?: () => Promise|void }]
//   run() must never throw for a probe failure — runScan's step body
//   catches probe errors into its own outcome — but the runner treats a
//   rejection as a task failure anyway, so a bug in a probe cannot
//   wedge the pool either.
// opts: { concurrency, timeoutMs, onSettled }
//   onSettled(outcome, index) is called in TASK order as the frontier
//   advances; it must be synchronous (it runs inside the worker that
//   settled the task). outcome: { index, name, ok, error, value,
//   startedAt, finishedAt, durationMs }.
// Returns the outcomes array in task order. Never rejects because a
// task failed; it rejects only on invalid arguments.
export async function runPhaseTasks(tasks, { concurrency, timeoutMs, onSettled } = {}) {
  if (!Array.isArray(tasks)) throw new TypeError('runPhaseTasks expects an array of tasks');
  const limit = resolvePhaseConcurrency({ phaseConcurrency: concurrency });
  const slots = new Array(tasks.length).fill(null);
  let next = 0;
  let nextEmit = 0;

  const emitReady = () => {
    if (typeof onSettled !== 'function') return;
    while (nextEmit < tasks.length && slots[nextEmit] !== null) {
      onSettled(slots[nextEmit], nextEmit);
      nextEmit += 1;
    }
  };

  const runOne = async (task, index) => {
    const startedAt = new Date().toISOString();
    const startMs = Date.now();
    let outcome;
    try {
      const value =
        timeoutMs !== undefined && timeoutMs !== null
          ? await withTimeout(task.run(), timeoutMs)
          : await task.run();
      outcome = {
        index,
        name: task.name,
        ok: true,
        error: null,
        value,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
      };
    } catch (e) {
      outcome = {
        index,
        name: task.name,
        ok: false,
        error: e && e.message ? String(e.message) : String(e),
        value: undefined,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
      };
    } finally {
      // Teardown is best-effort and never masks the outcome: a
      // collaborator stop that throws is swallowed, exactly like the
      // try/finally stops the sequential runner used.
      if (task && typeof task.teardown === 'function') {
        try {
          await task.teardown();
        } catch {
          // ignore — the task's outcome stands
        }
      }
    }
    slots[index] = outcome;
    emitReady();
    return outcome;
  };

  // Workers pull the next index synchronously (no await between the
  // check and the increment, so two workers can never claim one task).
  const worker = async () => {
    while (next < tasks.length) {
      const index = next;
      next += 1;
      await runOne(tasks[index], index);
    }
  };

  const workers = [];
  for (let i = 0; i < Math.min(limit, tasks.length); i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  // Defensive: every slot is filled once the workers finish, but emit
  // anything left in case onSettled was attached late.
  emitReady();
  return slots;
}
