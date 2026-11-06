// Dark Matter — scanner hunt runner.
// When a hunt is created with brainMode='scanner', this runs the rule-based
// vulnerability scanner (no AI, no API spend) and records findings as hunt
// events, instead of launching the AI agent loop.
import { runScan, buildPhaseRollup } from './scanner/index.js';
import { appendHuntEvent, readHuntMeta, writeHuntMeta } from './store.js';
import { notifyFinding } from './notifications.js';

function record(huntId, event) {
  try {
    appendHuntEvent(huntId, {
      ...event,
      at: new Date().toISOString(),
    });
  } catch {
    // best-effort
  }
}

// CONTAINER CLEANUP (6 Nov 2026): a scanner hunt's isolated container
// (dm-hunt-<huntId>) used to linger forever after the scan ended —
// five orphans from finished lab hunts were still on EC2. Destroy it
// on BOTH terminal paths. teardownHuntContainer is idempotent
// (`docker rm -f`; an already-gone container is a no-op) and never
// throws, and this runs AFTER findings + meta are recorded, so a
// destroy failure can never lose findings or fail the hunt.
// opts.teardownContainer is a test seam only (same pattern as
// opts.drainQueue); production callers never pass it.
async function destroyHuntContainer(huntId, opts) {
  try {
    const teardown =
      (opts && opts.teardownContainer) || (await import('./huntRunner.js')).teardownHuntContainer;
    const removed = await teardown(huntId);
    if (removed) record(huntId, { type: 'status', state: 'container_destroyed' });
  } catch {
    // best-effort
  }
}

// QUEUE DRAIN (5 Nov 2026): a hunt reaching a terminal state frees a
// concurrency slot — start the next queued hunt, if any. Best-effort:
// a drain failure must never break this hunt's finished/failed record.
// opts.drainQueue is a test seam only (same pattern as runScan's
// opts.nucleiRunner); production callers never pass it.
async function drainNextQueuedHunt(opts) {
  try {
    const drainQueue =
      (opts && opts.drainQueue) || (await import('./huntCreator.js')).drainQueue;
    await drainQueue();
  } catch {
    // best-effort
  }
}

/**
 * Run the rule-based scanner for a hunt.
 * @param {string} huntId
 * @param {string} target
 * @param {object} opts - { scope, userId, scanDepth }
 *
 * scanDepth (3 Nov 2026, owner order): 'quick' | 'standard' | 'deep'.
 * Every depth runs the full predefined battery — depth only changes how
 * far the crawler goes and how long each probe may take.
 */
/**
 * Build the two hunt events recorded per scanner finding (3 Nov 2026).
 * Pure — exported for unit tests. The raw `scanner_finding` record carries
 * the machine-readable payload; the standard `finding` event carries the
 * product surface fields (verified only when the differential verifier
 * confirmed it, so the 100% truth rule holds for the panel/report/chat).
 */
export function buildScannerFindingRecords(f) {
  const ev = (f && f.evidence) || {};
  const verified = f && f.confirmation === 'confirmed';
  const verificationBits = [
    ev.request ? String(ev.request) : null,
    ev.response ? String(ev.response) : null,
  ].filter(Boolean);
  const verification = verified
    ? `Confirmed by the rule-based differential verifier (no AI): ${verificationBits.join(' → ').slice(0, 300) || (f && f.title)}`
    : `Not confirmed — lead under investigation: ${f && f.title}`;
  const detailBits = [
    f && f.url ? `Observed at ${f.url}` : null,
    f && f.param ? `parameter "${f.param}"` : null,
    ev.impact_demo ? String(ev.impact_demo).slice(0, 300) : null,
  ].filter(Boolean);
  return [
    {
      type: 'scanner_finding',
      finding: {
        class: (f && f.class) || null,
        title: (f && f.title) || 'Finding',
        severity: (f && f.severity) || 'low',
        url: (f && f.url) || null,
        param: (f && f.param) || null,
        evidence: (f && f.evidence) || null,
        confirmation: (f && f.confirmation) || 'confirmed',
      },
    },
    {
      type: 'finding',
      title: (f && f.title) || 'Finding',
      severity: (f && f.severity) || 'low',
      verified,
      verification,
      detail: detailBits.join('. ') || (f && f.title) || 'Finding',
      evidence: (f && f.evidence) || null,
      url: (f && f.url) || null,
      class: (f && f.class) || null,
      source: 'scanner',
    },
  ];
}

export async function runScannerHunt(huntId, target, opts = {}) {
  const startedAt = new Date().toISOString();
  const scanDepth = opts.scanDepth === 'quick' || opts.scanDepth === 'deep' ? opts.scanDepth : 'standard';
  // Depth → real runScan knobs. Quick trims the slowest phases (blind
  // SQLi / nuclei) and the crawl budget; deep widens both. Standard is
  // the full battery at the default budget.
  const depthOpts =
    scanDepth === 'quick'
      ? {
          timeoutMs: 8000,
          maxUrls: 8,
          phases: [
            'fingerprint', 'crawl', 'page-analyze', 'headers', 'sqli-error', 'xss', 'cmdi',
            'traversal', 'redirect', 'csrf', 'post-forms', 'cors', 'cookies',
          ],
        }
      : scanDepth === 'deep'
        ? { timeoutMs: 30000, maxUrls: 40 }
        : { timeoutMs: 15000, maxUrls: 15 };
  record(huntId, {
    type: 'status',
    state: 'scanner_started',
    message: `Rule-based automation scan started (no AI) — depth: ${scanDepth}.`,
    scanDepth,
  });

  // Mark the hunt as running in scanner mode.
  try {
    const meta = readHuntMeta(huntId) || {};
    writeHuntMeta(huntId, {
      ...meta,
      huntId,
      brainMode: 'scanner',
      state: 'running',
      scannerStartedAt: startedAt,
    });
  } catch {
    // best-effort
  }

  try {
    const result = await runScan(
      {
        target,
        scope: opts.scope || null,
        confirmedAuthorized: true,
        // LAB_TARGETS (env): the deployment's explicit opt-in list of
        // authorised lab hosts (same source the hunt route uses for its
        // SSRF lab exception). runScan gates its write/OOB behaviour on
        // it — without this the SAML-XXE OOB collaborator never starts.
        labTargets: process.env.LAB_TARGETS || '',
        ...(depthOpts.phases ? { phases: depthOpts.phases } : {}),
      },
      {
        timeoutMs: depthOpts.timeoutMs,
        maxUrls: depthOpts.maxUrls,
        // Nuclei phase gets its own dedicated timeout (default 300s in
        // nuclei.js). The generic timeoutMs above is for fast HTTP probes;
        // without this, the nuclei phase inherited 15s/30s and died silently
        // on every standard/deep scan before any template completed.
        nucleiTimeoutMs: 300000,
        // PHASE VISIBILITY (5 Nov 2026): stream each phase into the hunt's
        // events.jsonl as it finishes, so a 300s nuclei phase does not wait
        // until scan end to appear. record() is best-effort (never throws)
        // and runScan wraps the listener in try/catch, so a listener
        // failure can never break the scan.
        onPhase: (phase) => record(huntId, { type: 'phase', ...phase }),
      }
    );

    // Record each confirmed finding as a hunt event.
    //
    // SURFACING FIX (3 Nov 2026): the scanner used to record findings ONLY
    // as `scanner_finding` events, which the entire product findings surface
    // (panel rows, live report, finding detail, chat confirmed counts, live
    // WS stream) ignores — it only reads `type: 'finding'` events. The
    // first product acceptance test (3 Nov) found 2 genuine findings on the
    // backend while the frontend showed "0 confirmed". Every confirmed
    // scanner finding now ALSO emits the standard `finding` event shape the
    // AI pipeline uses, so it flows through applyRetractions →
    // panelFindings → report → panel → chat unchanged. The 100% truth rule
    // holds: `verified` is true ONLY when the scanner's own differential
    // verifier confirmed the finding (`confirmation === 'confirmed'`) —
    // nothing unconfirmed can ever render as Confirmed.
    for (const f of result.findings || []) {
      const verified = f && f.confirmation === 'confirmed';
      for (const evt of buildScannerFindingRecords(f)) record(huntId, evt);
      // INSTANT NOTIFICATION (full-human vision order, 24 Oct): a verified
      // finding notifies the hunt owner + admins instantly, same as the AI
      // pipeline's emitFinding does. Best-effort — never breaks the scan.
      try {
        if (verified) {
          notifyFinding({
            huntId,
            ownerId: opts.userId || null,
            title: f.title,
            severity: f.severity,
            target: f.url || null,
          });
        }
      } catch { /* notifications are best-effort */ }
    }

    // Record the summary.
    // Phase rollup (5 Nov 2026, phase visibility; 35/63 fix: skipped
    // phases count separately — a 35-ok / 28-skipped run must never again
    // read as a clean 35/35 pass). The per-phase records stream into
    // events.jsonl as type:'phase' events via onPhase above; the finished
    // summary carries only the counts (total/ok/failed/skipped/timedOut)
    // so the panel can show scan coverage at a glance.
    const phaseList = result.phases || [];
    const phaseRollup = buildPhaseRollup(phaseList);
    record(huntId, {
      type: 'status',
      state: 'scanner_finished',
      message: `Scan complete: ${result.findings?.length || 0} confirmed findings, ${result.unconfirmed?.length || 0} unconfirmed.`,
      summary: {
        confirmed: result.findings?.length || 0,
        unconfirmed: result.unconfirmed?.length || 0,
        errors: result.errors || [],
        fingerprint: result.fingerprint || null,
        pagesCrawled: result.pagesCrawled || 0,
        durationMs: result.durationMs || null,
        phases: phaseRollup,
      },
    });

    // Mark hunt as finished — but NEVER overwrite a terminal 'failed'
    // state (e.g. egress fail-closed recorded by the reconciler) with
    // 'finished'. The UI must show the failure, not "finished, 0 findings".
    // Fixed 3 Nov 2026 (an external-target scan hid its egress failure
    // behind a finished meta).
    try {
      const meta = readHuntMeta(huntId) || {};
      writeHuntMeta(huntId, {
        ...meta,
        huntId,
        state: meta.state === 'failed' ? 'failed' : 'finished',
        scannerFinishedAt: new Date().toISOString(),
        scannerSummary: {
          confirmed: result.findings?.length || 0,
          unconfirmed: result.unconfirmed?.length || 0,
          scanDepth,
        },
      });
    } catch {
      // best-effort
    }

    // Container cleanup: the scan is done and findings + meta are
    // recorded — destroy the hunt's container before freeing the slot.
    await destroyHuntContainer(huntId, opts);

    // A finished scan frees a concurrency slot — drain the queue.
    await drainNextQueuedHunt(opts);

    return { ok: true, findings: result.findings?.length || 0 };
  } catch (err) {
    record(huntId, {
      type: 'status',
      state: 'scanner_failed',
      error: err.message || String(err),
    });
    try {
      const meta = readHuntMeta(huntId) || {};
      writeHuntMeta(huntId, { ...meta, huntId, state: 'failed' });
    } catch {
      // best-effort
    }
    // Container cleanup: the scan failed — destroy the hunt's
    // container too, so a failed scan never leaves an orphan either.
    await destroyHuntContainer(huntId, opts);

    // A failed scan frees its slot too — drain the queue.
    await drainNextQueuedHunt(opts);
    return { ok: false, error: err.message || String(err) };
  }
}
