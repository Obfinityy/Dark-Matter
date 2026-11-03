// Dark Matter — scanner hunt runner.
// When a hunt is created with brainMode='scanner', this runs the rule-based
// vulnerability scanner (no AI, no API spend) and records findings as hunt
// events, instead of launching the AI agent loop.
import { runScan } from './scanner/index.js';
import { appendHuntEvent, readHuntMeta, writeHuntMeta } from './store.js';

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
            'fingerprint', 'crawl', 'headers', 'sqli-error', 'xss', 'cmdi',
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
        ...(depthOpts.phases ? { phases: depthOpts.phases } : {}),
      },
      {
        timeoutMs: depthOpts.timeoutMs,
        maxUrls: depthOpts.maxUrls,
      }
    );

    // Record each confirmed finding as a hunt event.
    for (const f of result.findings || []) {
      record(huntId, {
        type: 'scanner_finding',
        finding: {
          class: f.class,
          title: f.title,
          severity: f.severity,
          url: f.url,
          param: f.param || null,
          evidence: f.evidence || null,
          confirmation: f.confirmation || 'confirmed',
        },
      });
    }

    // Record the summary.
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
      },
    });

    // Mark hunt as finished.
    try {
      const meta = readHuntMeta(huntId) || {};
      writeHuntMeta(huntId, {
        ...meta,
        huntId,
        state: 'finished',
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
    return { ok: false, error: err.message || String(err) };
  }
}
