/**
 * resilienceCore.js — Forge wave 10, ideas 50361–50400.
 *
 * Pure, DOM-free logic behind the resilience/recovery states (50361–50394)
 * and the explainability helpers (50395–50400):
 * - semver drift detection (50361)
 * - retry countdowns, timeline-gap labels, stale-index age text
 * - expected-vs-actual diff rows for failed PoC replays (50367)
 * - RegExp syntax-error position parsing (50393)
 * - bulk-action / CSV-import failure aggregation (50375, 50381)
 * - timezone-mismatch detection (50382), offline-queue labels (50364)
 * - disk-quota advice with size breakdowns (50389)
 * - RESILIENCE_STATE_IDEAS registry used by honesty checks.
 *
 * Node-importable (no JSX, no CSS). Run: node --test
 * frontend/src/components/hunt/resilienceCore.test.js
 */

/* ---------- idea registry ------------------------------------------ */

export const RESILIENCE_STATE_IDEAS = [
  { idea: 50361, name: 'VersionMismatchBanner' },
  { idea: 50362, name: 'MaintenanceModePage' },
  { idea: 50363, name: 'Friendly500Fallback' },
  { idea: 50364, name: 'OfflineQueueBanner' },
  { idea: 50365, name: 'CardErrorBoundary' },
  { idea: 50366, name: 'TimelineGapMarker' },
  { idea: 50367, name: 'PocReplayFailureDiff' },
  { idea: 50368, name: 'ScreenshotCapturePlaceholder' },
  { idea: 50369, name: 'MicBlockedError' },
  { idea: 50370, name: 'AvatarFallbackPortrait' },
  { idea: 50371, name: 'StaleIndexNotice' },
  { idea: 50372, name: 'ImpossibleFilterCombination' },
  { idea: 50373, name: 'ScheduledHuntFailure' },
  { idea: 50374, name: 'WebhookFailureLog' },
  { idea: 50375, name: 'BulkActionPartialFailure' },
  { idea: 50376, name: 'CommentDraftPreservation' },
  { idea: 50377, name: 'ThemeAssetFallback' },
  { idea: 50378, name: 'PrintFallback' },
  { idea: 50379, name: 'ClipboardDeniedFallback' },
  { idea: 50380, name: 'ShortcutConflictWarning' },
  { idea: 50381, name: 'CsvImportErrors' },
  { idea: 50382, name: 'TimezoneWarning' },
  { idea: 50383, name: 'AriaLabelDevOverlay' },
  { idea: 50384, name: 'DeletedFindingDeepLink' },
  { idea: 50385, name: 'ConcurrentEditMergeUI' },
  { idea: 50386, name: 'SnapshotRestoreFailure' },
  { idea: 50387, name: 'DesktopBridgeDisconnect' },
  { idea: 50388, name: 'InferenceTimeoutOption' },
  { idea: 50389, name: 'DiskQuotaWarning' },
  { idea: 50390, name: 'CorsBlockedPreview' },
  { idea: 50391, name: 'ExpiredShareLink' },
  { idea: 50392, name: 'DuplicateHuntDetection' },
  { idea: 50393, name: 'InvalidRegexNotice' },
  { idea: 50394, name: 'WebglDegradedBanner' },
];

/* ---------- formatting ------------------------------------------------ */

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  return `${n >= 100 || u === 0 ? Math.round(n) : n.toFixed(1)} ${units[u]}`;
}

/** Retry/backoff countdown rendered as mm:ss (50364, 50387). */
export function formatRetryCountdown(msRemaining) {
  const total = Math.max(0, Math.ceil(msRemaining / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Short HH:MM clock label used by the timeline-gap marker (50366). */
export function clockLabel(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '??:??';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ---------- 50361: version-mismatch ---------------------------------- */

function parseSemver(v) {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(String(v || '').trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

/**
 * Detect frontend/backend version drift. Returns { drift, behind, message }.
 * drift is true when the two sides disagree on major.minor.
 */
export function compareVersions(frontendVersion, backendVersion) {
  const f = parseSemver(frontendVersion);
  const b = parseSemver(backendVersion);
  if (!f || !b) {
    return {
      drift: false,
      behind: null,
      message: 'Could not compare versions — one side reported an unparsable version.',
    };
  }
  const sameLine = f[0] === b[0] && f[1] === b[1];
  if (sameLine) return { drift: false, behind: null, message: '' };
  const behind = f[0] > b[0] || (f[0] === b[0] && f[1] > b[1]) ? 'backend' : 'frontend';
  const min = `${f[0]}.${f[1]}`;
  return {
    drift: true,
    behind,
    message:
      behind === 'backend'
        ? `Frontend v${frontendVersion} needs backend ≥${min}, but the server reports v${backendVersion}. Ask an admin to update the backend.`
        : `Backend v${backendVersion} is newer than this frontend v${frontendVersion}. Refresh to load the matching frontend build.`,
  };
}

/* ---------- 50363: friendly 500 --------------------------------------- */

export function makeErrorId() {
  const rand = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, '0');
  return `ERR-${Date.now().toString(36).toUpperCase()}-${rand.toUpperCase()}`;
}

export function buildDiagnosticsText({ errorId, route, statusCode, timestamp }) {
  return [
    `error_id: ${errorId || 'n/a'}`,
    `route: ${route || 'n/a'}`,
    `status: ${statusCode || 'n/a'}`,
    `time: ${timestamp || new Date().toISOString()}`,
    `frontend: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a'}`,
  ].join('\n');
}

/* ---------- 50364: offline queue -------------------------------------- */

export function offlineQueueLabel(count) {
  const n = Math.max(0, count | 0);
  if (n === 0) return 'Queue is empty — nothing waiting to sync.';
  return `${n} action${n === 1 ? '' : 's'} will sync when you're back online.`;
}

/* ---------- 50366: timeline gap --------------------------------------- */

export function timelineGapLabel({ gapStart, gapEnd }) {
  return `events missing ${clockLabel(gapStart)}–${clockLabel(gapEnd)}`;
}

/* ---------- 50367: PoC replay diff ------------------------------------ */

/**
 * Align expected vs actual output line-by-line for the failure diff view.
 * Returns [{ line, expected, actual, same }].
 */
export function diffLinesToView(expectedText, actualText) {
  const e = String(expectedText ?? '').split('\n');
  const a = String(actualText ?? '').split('\n');
  const rows = [];
  const n = Math.max(e.length, a.length);
  for (let i = 0; i < n; i += 1) {
    const expected = e[i] ?? '';
    const actual = a[i] ?? '';
    rows.push({ line: i + 1, expected, actual, same: expected === actual });
  }
  return rows;
}

export function diffSummary(rows) {
  const changed = rows.filter(r => !r.same).length;
  return `${changed} of ${rows.length} line${rows.length === 1 ? '' : 's'} differ`;
}

/* ---------- 50371: stale index ---------------------------------------- */

export function staleIndexMessage(minutesOld) {
  const m = Math.max(0, Math.round(minutesOld));
  if (m < 1) return 'Results are fresh — indexed just now.';
  return `Results may be up to ${m} min old.`;
}

/* ---------- 50372: impossible filter combination ----------------------- */

export function buildFilterConflictMessage({ filters = [], conflictingPair, suggestion }) {
  const pair =
    conflictingPair && conflictingPair.length === 2
      ? `"${conflictingPair[0]}" + "${conflictingPair[1]}"`
      : 'the selected filters';
  return {
    title: 'No findings can match this combination',
    detail: `Filters ${pair} contradict each other — nothing in the index satisfies both.`,
    suggestion:
      suggestion ||
      (filters.length
        ? `Try removing "${filters[filters.length - 1]}" and searching again.`
        : 'Try removing one filter and searching again.'),
  };
}

/* ---------- 50375: bulk-action partial failure ------------------------- */

/**
 * results: [{ id, label, ok, reason? }]
 * Returns headline "X of Y updated — Z failed" plus per-item failure reasons.
 */
export function summarizeBulkResult(results, actionVerb = 'updated') {
  const list = Array.isArray(results) ? results : [];
  const ok = list.filter(r => r.ok).length;
  const failed = list.filter(r => !r.ok);
  return {
    updated: ok,
    failed: failed.length,
    total: list.length,
    headline: `${ok} of ${list.length} ${actionVerb} — ${failed.length} failed`,
    failures: failed.map(r => ({
      id: r.id,
      label: r.label || r.id,
      reason: r.reason || 'Unknown error',
    })),
  };
}

/* ---------- 50381: CSV import errors ----------------------------------- */

/**
 * rows: [{ row, column, value, message }]
 * Returns grouped errors plus a plain-text error report for download.
 */
export function aggregateCsvErrors(rows, fileName = 'import.csv') {
  const errors = (Array.isArray(rows) ? rows : []).map(r => ({
    row: r.row,
    column: r.column || '—',
    value: r.value ?? '',
    message: r.message || 'Invalid value',
  }));
  const byColumn = {};
  for (const e of errors) byColumn[e.column] = (byColumn[e.column] || 0) + 1;
  const reportText = [
    `CSV import error report — ${fileName}`,
    `Generated: ${new Date().toISOString()}`,
    `${errors.length} row${errors.length === 1 ? '' : 's'} failed validation.`,
    '',
    ...errors.map(
      e =>
        `Row ${e.row}, column "${e.column}": ${e.message}${e.value !== '' ? ` (got "${e.value}")` : ''}`
    ),
  ].join('\n');
  return { count: errors.length, errors, byColumn, reportText };
}

/* ---------- 50382: timezone warning ------------------------------------ */

export function detectTimezoneMismatch({ userTimezone, detectedTimezone }) {
  const user = String(userTimezone || '');
  const detected = String(detectedTimezone || '');
  if (!user || !detected || user === detected) {
    return { mismatched: false, message: '' };
  }
  return {
    mismatched: true,
    message: `This hunt's timestamps are in ${detected}, but your profile uses ${user}. Schedule times may look wrong.`,
  };
}

/* ---------- 50387: desktop-bridge reconnect backoff --------------------- */

/** Exponential backoff for the reconnect wizard: 2s, 4s, 8s … capped at 60s. */
export function reconnectDelayMs(attempt) {
  const a = Math.max(0, attempt | 0);
  return Math.min(60000, 2000 * 2 ** a);
}

/* ---------- 50389: disk-quota advice ----------------------------------- */

/**
 * breakdown: [{ label, bytes }]
 * Returns usage percent plus cleanup advice ordered by biggest consumer.
 */
export function diskQuotaAdvice({ usedBytes, quotaBytes, breakdown = [] }) {
  const pct = quotaBytes > 0 ? Math.round((usedBytes / quotaBytes) * 100) : 100;
  const sorted = [...breakdown].sort((a, b) => b.bytes - a.bytes);
  const biggest = sorted[0];
  const lines = [
    `Evidence storage is ${pct}% full — ${formatBytes(usedBytes)} of ${formatBytes(quotaBytes)} used.`,
  ];
  if (sorted.length) {
    lines.push(`Breakdown: ${sorted.map(b => `${b.label} ${formatBytes(b.bytes)}`).join(' · ')}.`);
  }
  if (biggest) {
    lines.push(
      `Biggest consumer is "${biggest.label}" — deleting old ${biggest.label.toLowerCase()} frees the most space.`
    );
  }
  return { pct, message: lines.join(' '), biggest: biggest || null };
}

/* ---------- 50391: expired share link ---------------------------------- */

export function shareLinkStatus({ expiresAt, now = Date.now() }) {
  const exp = new Date(expiresAt).getTime();
  if (Number.isNaN(exp)) return { expired: false, message: '' };
  const expired = now >= exp;
  return {
    expired,
    message: expired
      ? `This share link expired on ${new Date(exp).toLocaleString()}.`
      : `This share link expires on ${new Date(exp).toLocaleString()}.`,
  };
}

/* ---------- 50392: duplicate hunt -------------------------------------- */

export function duplicateHuntMessage({ existingHunt }) {
  const h = existingHunt || {};
  return {
    title: 'This URL was already hunted',
    detail: h.title
      ? `"${h.title}" already covers ${h.target || 'this target'}${h.finishedAt ? ` (finished ${h.finishedAt})` : ''}.`
      : 'This target already has a hunt on record.',
  };
}

/* ---------- 50393: invalid regex --------------------------------------- */

/**
 * Parse a RegExp SyntaxError into a position + snippet for the notice.
 * V8 messages look like: "Invalid regular expression: /(/: Unterminated group"
 * Some engines append "at position N" / "column N".
 */
export function parseRegexError(error) {
  const raw = error instanceof Error ? error.message : String(error || '');
  const posMatch = /(?:at\s+)?(?:position|index|column|char(?:acter)?)\s*[:#]?\s*(\d+)/i.exec(raw);
  const position = posMatch ? Number(posMatch[1]) : null;
  const patternMatch = /^Invalid regular expression:\s*(\/.*\/[a-z]*)\s*:\s*(.+)$/i.exec(raw);
  return {
    raw,
    position,
    pattern: patternMatch ? patternMatch[1] : null,
    reason: patternMatch ? patternMatch[2].trim() : raw.replace(/^.*?error:\s*/i, '').trim() || raw,
  };
}

export default RESILIENCE_STATE_IDEAS;
