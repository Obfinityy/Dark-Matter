/**
 * vulnTallyService.js — live finding telemetry for the continuous hunt loop
 * (issue #298).
 *
 * Every time the loop records a finding it publishes two SSE-consumable
 * events through the hunt's eventService (same bus the frontend already
 * subscribes to for /jobs/:id/events):
 *
 *   - `vuln_tally` { critical, high, medium, low, informational, total }
 *   - `activity`    { line, ts }  — human-readable ticker line
 *
 * The service is injectable (eventService is a constructor arg), so tests
 * drive it with a fake. Severity names normalize to the LiveReport set.
 */

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'informational'];

function normalizeSeverity(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'info') return 'informational';
  return SEVERITIES.includes(s) ? s : 'informational';
}

/** Count severities across a findings array. */
export function tallyFor(findings = []) {
  const tally = { critical: 0, high: 0, medium: 0, low: 0, informational: 0, total: 0 };
  for (const f of findings || []) {
    const sev = normalizeSeverity(f?.severity);
    tally[sev] += 1;
    tally.total += 1;
  }
  return tally;
}

/**
 * @param {object} opts
 * @param {object|null} [opts.eventService] — { publish(scanId, {type, level, message, data}) }
 * @param {object} [opts.logger]
 */
export function createVulnTallyService({ eventService = null, logger = console } = {}) {
  return {
    /**
     * Publish `vuln_tally` + `activity` for a newly recorded finding.
     * @param {string} huntId
     * @param {object} finding — the finding just recorded
     * @param {Array} allFindings — full findings list for the tally
     * @returns {Promise<{tally, published}>}
     */
    async emitFinding(huntId, finding, allFindings = []) {
      const tally = tallyFor(allFindings);
      const title = String(finding?.title || 'Untitled finding').slice(0, 160);
      const sev = normalizeSeverity(finding?.severity);
      const ts = new Date().toISOString();
      const line = `[${sev.toUpperCase()}] ${title}`;
      let published = false;
      if (eventService && typeof eventService.publish === 'function') {
        try {
          await eventService.publish(String(huntId), {
            type: 'vuln_tally',
            level: sev === 'critical' || sev === 'high' ? 'WARN' : 'INFO',
            message: `Finding recorded: ${title} [${sev}]`,
            data: { ...tally },
          });
          await eventService.publish(String(huntId), {
            type: 'activity',
            level: 'INFO',
            message: line,
            data: { line, ts },
          });
          published = true;
        } catch (error) {
          logger.warn?.(`[vulnTally] publish failed: ${error.message}`);
        }
      }
      return { tally, published, line, ts };
    },

    /** Recompute the tally without publishing (for GET /tally). */
    tallyFor,
  };
}

export default { createVulnTallyService, tallyFor };
