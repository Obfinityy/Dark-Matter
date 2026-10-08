/**
 * certTimingAnalyzer.js — TLS certificate issuance timing analysis.
 *
 * Correlates certificate issuance timestamps with deployment events to
 * fingerprint automated (ACME/Let's Encrypt style, fixed renewal intervals)
 * versus manual PKI pipelines, and to detect out-of-band re-issuance events
 * that may indicate infrastructure changes worth re-scoping.
 * Pure analysis: takes already-collected certificate metadata, no network I/O.
 */

const DAY_MS = 86400000;

/**
 * Compute issuance intervals (in days) between consecutive certificates.
 */
function issuanceIntervals(certs) {
  const times = certs
    .map(c => new Date(c.notBefore).getTime())
    .filter(t => Number.isFinite(t))
    .sort((a, b) => a - b);
  const intervals = [];
  for (let i = 1; i < times.length; i++) intervals.push((times[i] - times[i - 1]) / DAY_MS);
  return intervals;
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) * (x - m), 0) / (xs.length - 1));
}

/** Distribution of issuance across days of week: 0=Sunday..6=Saturday. */
function weekdayDistribution(certs) {
  const dist = [0, 0, 0, 0, 0, 0, 0];
  for (const c of certs) {
    const d = new Date(c.notBefore);
    if (!isNaN(d)) dist[d.getUTCDay()]++;
  }
  return dist;
}

/**
 * Analyze a certificate issuance history for one host or organization.
 *
 * @param {Object} args
 * @param {Array<Object>} args.certs - Certificate metadata, newest last (or any order).
 *   Each: { notBefore, notAfter, issuer, subject, sanCount }
 * @param {number} [args.expectedValidityDays] - e.g. 90 for ACME CAs
 * @returns {{intervals: Array, stats: Object, automation: Object, events: Array, summary: Object}}
 */
export function analyzeCertTiming({ certs = [], expectedValidityDays = 90 } = {}) {
  const clean = certs.filter(c => c && c.notBefore && !isNaN(new Date(c.notBefore)));
  const intervals = issuanceIntervals(clean);
  const avg = mean(intervals);
  const sd = stdev(intervals);

  // Automated pipelines renew on a tight, regular cadence (e.g. 60 days for
  // Let's Encrypt's recommended 30-day-before-expiry renewal).
  const regularCadence =
    intervals.length >= 2 && sd < 7 && Math.abs(avg - (expectedValidityDays - 30)) <= 14;
  const veryRegular = intervals.length >= 2 && sd < 2;
  // Manual issuance shows irregular gaps and human scheduling (weekdays, office hours).
  const irregular = intervals.length >= 2 && sd > avg * 0.5;

  const dist = weekdayDistribution(clean);
  const weekendShare = clean.length ? (dist[0] + dist[6]) / clean.length : 0;
  // Automated renewals happen on weekends too; manual issuance rarely does.
  const humanScheduling = clean.length >= 3 && weekendShare < 0.05 && intervals.length >= 1;

  const issuers = [...new Set(clean.map(c => String(c.issuer || 'unknown')))];
  const shortLived = clean.filter(c => {
    const nb = new Date(c.notBefore).getTime(),
      na = new Date(c.notAfter).getTime();
    return Number.isFinite(nb) && Number.isFinite(na) && (na - nb) / DAY_MS <= 95;
  }).length;

  let automation;
  if (
    regularCadence ||
    veryRegular ||
    (shortLived === clean.length && clean.length >= 2 && sd < 14)
  ) {
    automation = { level: 'automated', confidence: veryRegular ? 'high' : 'medium' };
  } else if (humanScheduling || irregular) {
    automation = { level: 'manual', confidence: humanScheduling ? 'high' : 'medium' };
  } else if (clean.length < 2) {
    automation = { level: 'insufficient-data', confidence: 'low' };
  } else {
    automation = { level: 'mixed', confidence: 'low' };
  }

  // Out-of-band events: re-issuance much sooner than the cadence implies.
  const events = [];
  if (intervals.length >= 2) {
    const cadence = avg;
    const sorted = clean
      .map(c => ({ ...c, ts: new Date(c.notBefore).getTime() }))
      .sort((a, b) => a.ts - b.ts);
    for (let i = 1; i < sorted.length; i++) {
      const gap = (sorted[i].ts - sorted[i - 1].ts) / DAY_MS;
      if (cadence > 7 && gap < cadence * 0.25) {
        events.push({
          type: 'out-of-band-reissuance',
          at: sorted[i].notBefore,
          previous: sorted[i - 1].notBefore,
          gapDays: Math.round(gap * 10) / 10,
          note: 'Certificate replaced far ahead of renewal cadence — possible infrastructure change, compromise response, or key rotation.',
        });
      }
    }
  }

  // Issuer churn: switching CAs between renewals suggests pipeline migration.
  const issuerChurn = issuers.length > 1 && clean.length >= 2;

  return {
    intervals: intervals.map(d => Math.round(d * 100) / 100),
    stats: {
      certCount: clean.length,
      meanIntervalDays: Math.round(avg * 100) / 100,
      stdevDays: Math.round(sd * 100) / 100,
      weekendIssuanceShare: Math.round(weekendShare * 100) / 100,
      issuers,
      issuerChurn,
    },
    automation,
    events,
    summary: {
      pipeline: automation.level,
      confidence: automation.confidence,
      evidence:
        automation.level === 'automated'
          ? `Renewals every ~${Math.round(avg)}d (stdev ${Math.round(sd)}d) with ${issuers.join('/')} — consistent with automated ACME-style PKI.`
          : automation.level === 'manual'
            ? `Irregular intervals (stdev ${Math.round(sd)}d) and weekday-only issuance — consistent with manual certificate management.`
            : 'Not enough signal to classify the issuance pipeline.',
      outOfBandEvents: events.length,
    },
  };
}

export const CERT_TIMING_ANALYZER = { analyzeCertTiming };
export default CERT_TIMING_ANALYZER;
