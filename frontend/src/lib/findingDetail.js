// Finding detail — pure helpers (28 Oct 2026, finding-detail lane).
//
// The panel list rows carry only {title, severity, verified, detail,
// verification, stamps}. The full detail comes from
// GET /api/v1/hunts/:id/findings/:title (see getFindingDetail in
// lib/api.js). These helpers turn that payload into what the modal
// renders — without ever inventing a field the backend did not send.
// Missing evidence / command / timestamp renders as "not available",
// never as a guessed value.

export const EVIDENCE_MISSING = 'Evidence not yet available';
export const REPRO_MISSING = 'Not yet available';
export const RECORDED_MISSING = 'Not yet available';

/**
 * Evidence as safe display text. A string renders as-is; an object
 * renders one `key: value` line per field (the verified stamp stores
 * {request, response}); anything else stringifies. Missing/empty
 * evidence returns '' — the component decides the fallback text.
 */
export function evidenceText(evidence) {
  if (evidence === null || evidence === undefined) return '';
  if (typeof evidence === 'string') return evidence;
  if (typeof evidence === 'object') {
    const entries = Object.entries(evidence);
    if (entries.length === 0) return '';
    return entries
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join('\n');
  }
  return String(evidence);
}

/** The reproduction command: evidence.request when present, else ''. */
export function reproductionCommand(finding) {
  const req = finding && finding.evidence && finding.evidence.request;
  return typeof req === 'string' && req.trim() !== '' ? req : '';
}

/**
 * The recorded date/time: `at`, else firstSeen, else lastSeen — the
 * first one the backend actually recorded. Returns '' when none is.
 */
export function findingRecordedAt(finding) {
  if (!finding) return '';
  return finding.at || finding.firstSeen || finding.lastSeen || '';
}

/** Human-readable recorded time, or the honest fallback. */
export function formatRecordedAt(value) {
  if (!value) return RECORDED_MISSING;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

/** Status line for the modal header. */
// P0 (31 Oct 2026): probe/test names are never "verified" — even if the
// backend stamped them. A probe name is a note, not a vulnerability.
const isProbeName = (t) => {
  const s = String(t || '').trim().toLowerCase();
  return /^probe[_-]/.test(s) || /[_-]probe([_-]|$)/.test(s) || /[_-]test([_-]|$)/.test(s) || /^test[_-]/.test(s);
};
export function findingStatus(finding) {
  if (finding && finding.verified === true && !isProbeName(finding.title)) {
    return {
      label: '✓ verified',
      note: finding.verification || 'Verified',
    };
  }
  if (finding && finding.verified === true && isProbeName(finding.title)) {
    return {
      label: 'probe note',
      note: 'This is a probe/test note, not a verified vulnerability. It was recorded for investigation only.',
    };
  }
  return {
    label: 'under investigation',
    note: (finding && finding.verification) || 'Under investigation',
  };
}
