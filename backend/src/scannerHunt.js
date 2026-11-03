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
 * @param {object} opts - { scope, userId }
 */
export async function runScannerHunt(huntId, target, opts = {}) {
  const startedAt = new Date().toISOString();
  record(huntId, {
    type: 'status',
    state: 'scanner_started',
    message: 'Rule-based automation scan started (no AI).',
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
      },
      {
        timeoutMs: 15000,
        maxUrls: 15,
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
