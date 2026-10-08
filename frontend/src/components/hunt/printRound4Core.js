/**
 * printRound4Core.js — wave 24 (ideas 50921–50960): print round 4 pure logic
 * + the full wave-24 registry.
 *
 * Ideas 50921–50929 are the print round 4 suite: prepared-by line, duplex
 * friendly layout with mirrored margins, scope appendix, full-list print
 * rendering (no missing virtualized rows), printable shortcut cheat sheet,
 * cross-browser print CSS targets, compliance-history print, printer-icon
 * print buttons, and a print-stylesheet fallback note.
 * Ideas 50930–50960 (optimistic / performance suite) live in optimisticCore.js.
 *
 * Pure functions only — no DOM, no window access — so every rule below is
 * unit-testable with node:test.
 */

export const WAVE24_IDEAS = [
  [50921, 'Prepared-by line', 'new'],
  [50922, 'Duplex-friendly layout', 'new'],
  [50923, 'Scope appendix', 'new'],
  [50924, 'Full-list print rendering', 'new'],
  [50925, 'Shortcut cheat-sheet printout', 'new'],
  [50926, 'Cross-browser print CSS', 'new'],
  [50927, 'Compliance-history print', 'new'],
  [50928, 'Printer-icon print buttons', 'new'],
  [50929, 'Print-stylesheet fallback note', 'new'],
  [50930, 'Optimistic status changes', 'new'],
  [50931, 'Instant hunt creation', 'new'],
  [50932, 'Optimistic comments', 'new'],
  [50933, 'Instant cached filtering', 'new'],
  [50934, 'Skeleton-first rendering', 'new'],
  [50935, 'Hover prefetch', 'new'],
  [50936, 'Debounced local search', 'new'],
  [50937, 'Virtualized findings list', 'new'],
  [50938, 'Virtualized timeline', 'new'],
  [50939, 'Lazy evidence images', 'new'],
  [50940, 'Progressive report preview', 'new'],
  [50941, 'Optimistic bookmarks', 'new'],
  [50942, 'Route code splitting', 'new'],
  [50943, 'Cached hunt snapshots', 'new'],
  [50944, 'Stale-while-revalidate widgets', 'new'],
  [50945, 'Optimistic widget reorder', 'new'],
  [50946, 'Instant theme switching', 'new'],
  [50947, 'Background PDF prefetch', 'new'],
  [50948, 'Optimistic bulk review', 'new'],
  [50949, 'Client-side filter/sort', 'new'],
  [50950, '100ms acknowledgment budget', 'new'],
  [50951, 'Batched detail fetches', 'new'],
  [50952, 'Optimistic pause/resume', 'new'],
  [50953, 'Skeletons over spinners', 'new'],
  [50954, 'Priority content loading', 'new'],
  [50955, 'Idle-time preloading', 'new'],
  [50956, 'Optimistic dismissal', 'new'],
  [50957, 'Worker-thread search index', 'new'],
  [50958, 'Streaming step log', 'new'],
  [50959, 'Optimistic FP dismissal', 'new'],
  [50960, 'Deferred non-critical JS', 'new'],
];

export function wave24RegistryComplete() {
  if (WAVE24_IDEAS.length !== 40) return false;
  for (let i = 0; i < 40; i++) {
    if (WAVE24_IDEAS[i][0] !== 50921 + i) return false;
    if (!['new', 'skip'].includes(WAVE24_IDEAS[i][2])) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 50921 — Prepared-by line
// ---------------------------------------------------------------------------

/** Build the "Prepared by <name> · <date>" line printed on reports. */
export function preparedByLine({ reviewer, role = '', date = new Date() }) {
  const name = (reviewer || 'Unassigned reviewer').trim();
  const dateStr =
    date instanceof Date
      ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : String(date);
  return `Prepared by ${name}${role ? ` (${role})` : ''} · ${dateStr}`;
}

// ---------------------------------------------------------------------------
// 50922 — Duplex-friendly layout (mirrored margins, no stray blanks)
// ---------------------------------------------------------------------------

export const DUPLEX_MARGINS = {
  narrow: { odd: { left: '2.0cm', right: '1.5cm' }, even: { left: '1.5cm', right: '2.0cm' } },
  normal: { odd: { left: '2.5cm', right: '1.8cm' }, even: { left: '1.8cm', right: '2.5cm' } },
  wide: { odd: { left: '3.0cm', right: '2.0cm' }, even: { left: '2.0cm', right: '3.0cm' } },
};

/** CSS for mirrored odd/even page margins (duplex binding edge on the inside). */
export function duplexMarginCss(marginKey = 'normal', topBottom = '2cm') {
  const m = DUPLEX_MARGINS[marginKey] || DUPLEX_MARGINS.normal;
  return (
    `@page :left { margin: ${topBottom} ${m.even.right} ${topBottom} ${m.even.left}; }\n` +
    `@page :right { margin: ${topBottom} ${m.odd.right} ${topBottom} ${m.odd.left}; }`
  );
}

/** Keep duplex runs even: append a blank page marker when page count is odd. */
export function duplexPadPages(pageCount) {
  const n = Math.max(0, Math.floor(pageCount));
  return n % 2 === 0 ? n : n + 1;
}

// ---------------------------------------------------------------------------
// 50923 — Scope appendix
// ---------------------------------------------------------------------------

/**
 * Build scope-appendix rows: in-scope targets, out-of-scope targets, and
 * testing exclusions with reasons.
 */
export function scopeAppendixData({ inScope = [], outOfScope = [], exclusions = [] }) {
  const rows = [];
  for (const t of inScope)
    rows.push({ kind: 'in-scope', target: t.target || t, note: t.note || '' });
  for (const t of outOfScope)
    rows.push({ kind: 'out-of-scope', target: t.target || t, note: t.note || '' });
  for (const e of exclusions)
    rows.push({ kind: 'exclusion', target: e.rule || e, note: e.reason || '' });
  return rows;
}

export function scopeAppendixTitle(huntName) {
  return `Appendix A — Scope of engagement${huntName ? `: ${huntName}` : ''}`;
}

// ---------------------------------------------------------------------------
// 50924 — Full-list print rendering (defeat virtualization for print)
// ---------------------------------------------------------------------------

/**
 * Virtualized lists only mount the visible window; for print we must render
 * every row. Returns the full row set plus a page estimate.
 */
export function fullListPrint(items, { rowsPerPage = 40 } = {}) {
  const rows = Array.isArray(items) ? items.slice() : [];
  return {
    total: rows.length,
    rows,
    estimatedPages: Math.max(1, Math.ceil(rows.length / Math.max(1, rowsPerPage))),
    fullyRendered: true,
  };
}

// ---------------------------------------------------------------------------
// 50925 — Shortcut cheat-sheet printout (one-page reference card)
// ---------------------------------------------------------------------------

/** Shape shortcuts into a two-column one-page reference card. */
export function cheatSheetPrintout(shortcuts, { columns = 2, maxRows = 30 } = {}) {
  const list = (Array.isArray(shortcuts) ? shortcuts : []).slice(0, maxRows);
  const perCol = Math.ceil(list.length / Math.max(1, columns));
  const cols = [];
  for (let c = 0; c < columns; c++) cols.push(list.slice(c * perCol, (c + 1) * perCol));
  return { title: 'Keyboard shortcut reference', columns: cols, total: list.length };
}

// ---------------------------------------------------------------------------
// 50926 — Cross-browser print CSS
// ---------------------------------------------------------------------------

/** Browsers the print stylesheet is validated against. */
export const PRINT_CSS_TARGETS = ['Chrome 120+', 'Edge 120+', 'Firefox 121+', 'Safari 17+'];

/**
 * Known print-CSS capability gaps per engine (drives the test matrix and
 * graceful fallbacks).
 */
export function printCssSupportNote(engine) {
  const notes = {
    Blink: '@page size + margin boxes supported; use -webkit-print-color-adjust: exact.',
    Gecko:
      '@page margin boxes partially supported; avoid position: fixed footers, use repeating thead.',
    WebKit: 'ignores @page :left/:right; duplex mirrors via manual even-page padding only.',
  };
  return notes[engine] || 'no engine-specific print gaps recorded';
}

// ---------------------------------------------------------------------------
// 50927 — Compliance-history print
// ---------------------------------------------------------------------------

/** Shape notification/audit events into compliance-evidence rows. */
export function complianceHistoryRows(events) {
  return (Array.isArray(events) ? events : []).map(e => ({
    time: e.time || e.timestamp || '',
    actor: e.actor || 'system',
    action: e.action || e.type || '',
    detail: e.detail || '',
  }));
}

// ---------------------------------------------------------------------------
// 50928 — Printer-icon print buttons
// ---------------------------------------------------------------------------

/** Canonical props for print buttons: printer icon + text label, native dialog. */
export function printerButtonProps(label = 'Print report') {
  return { icon: 'printer', label, opensNativeDialog: true, cssClass: 'pr4-print-btn' };
}

// ---------------------------------------------------------------------------
// 50929 — Print-stylesheet fallback note
// ---------------------------------------------------------------------------

/**
 * When print preview fails (e.g. blocked popup/print pipeline), suggest the
 * PDF download instead of leaving the user stuck.
 */
export function printFallbackNote({ browser = 'your browser', failed = true } = {}) {
  if (!failed) return '';
  return (
    `Print preview could not start in ${browser}. ` +
    'Download the PDF instead — it uses the same print layout (A4, page numbers, ' +
    'headers, footers) and opens in any PDF reader.'
  );
}

// ---------------------------------------------------------------------------
// 50921–50929 — print CSS class constants (used by PrintRound4.css)
// ---------------------------------------------------------------------------

export const PR4_PREPARED_BY_CLASS = 'pr4-prepared-by';
export const PR4_SCOPE_APPENDIX_CLASS = 'pr4-scope-appendix';
export const PR4_CHEAT_SHEET_CLASS = 'pr4-cheat-sheet';
export const PR4_COMPLIANCE_CLASS = 'pr4-compliance';
export const PR4_FULL_LIST_CLASS = 'pr4-full-list';
