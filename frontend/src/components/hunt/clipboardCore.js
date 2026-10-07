/**
 * clipboardCore.js — wave 22 (ideas 50841–50880): clipboard / copy-everywhere
 * pure logic.
 *
 * Pure, framework-free logic for every copy interaction in the product:
 * cURL replay commands, deep links, CVSS strings, target-URL normalization,
 * terminal copies with/without timestamps, CSV tables, per-section report
 * copies, share text, masked-token reveal windows, diagnostics bundles,
 * search/filter-as-URL encoding, webhook examples, Jira/GitHub ticket
 * markdown, filtered-set export, hunt summaries, checksum text, timeline
 * log lines, clipboard history (last 20), copy-format chooser state,
 * citations, asset lists, retest diffs, shortcut text, status updates,
 * model configs, auto-copy toggle, line-count toasts, blocked-clipboard
 * fallback state, accessible labeled copy buttons, encoded payload variants,
 * dual timestamps, invite links, widget configs, verified regex, multi-block
 * combine, accessible tables, 10-copies/sec rate guard, mobile share-sheet
 * detection, and the copy-state machine (idle → copying → success → idle).
 *
 * No skips — all 40 ideas are new in this wave.
 */

export const WAVE22_IDEAS = [
  [50841, 'Evidence copy feedback', 'new'],
  [50842, 'Copy-as-cURL', 'new'],
  [50843, 'Copy finding deep link', 'new'],
  [50844, 'Copy CVSS vector', 'new'],
  [50845, 'Copy target URL', 'new'],
  [50846, 'Terminal copy toggle', 'new'],
  [50847, 'Copy table as CSV', 'new'],
  [50848, 'Per-section report copy', 'new'],
  [50849, 'Copy share text', 'new'],
  [50850, 'Masked token copy', 'new'],
  [50851, 'Copy diagnostics bundle', 'new'],
  [50852, 'Copy search as URL', 'new'],
  [50853, 'Copy webhook example', 'new'],
  [50854, 'Copy remediation as ticket', 'new'],
  [50855, 'Copy filtered set', 'new'],
  [50856, 'Copy hunt summary', 'new'],
  [50857, 'Copy report checksum', 'new'],
  [50858, 'Copy timeline event', 'new'],
  [50859, 'Clipboard history panel', 'new'],
  [50860, 'Copy-format chooser', 'new'],
  [50861, 'Copy with citation', 'new'],
  [50862, 'Copy asset list', 'new'],
  [50863, 'Copy retest diff', 'new'],
  [50864, 'Copy shortcut text', 'new'],
  [50865, 'Copy status update', 'new'],
  [50866, 'Copy model config', 'new'],
  [50867, 'Copy filter as URL', 'new'],
  [50868, 'Auto-copy selection', 'new'],
  [50869, 'Copy line-count toast', 'new'],
  [50870, 'Clipboard-blocked fallback', 'new'],
  [50871, 'Labeled copy buttons', 'new'],
  [50872, 'Encoded-payload copy', 'new'],
  [50873, 'Copy dual timestamps', 'new'],
  [50874, 'Copy invite link', 'new'],
  [50875, 'Copy widget config', 'new'],
  [50876, 'Copy verified regex', 'new'],
  [50877, 'Multi-block copy', 'new'],
  [50878, 'Accessible table copy', 'new'],
  [50879, 'Copy rate guard', 'new'],
  [50880, 'Mobile share-sheet fallback', 'new'],
];

/* ------------------------------------------------------------------ */
/* Copy state machine (idea 50841)                                     */
/*                                                                     */
/* idle --start--> copying --success--> success(checkmark) --reset-->  */
/*   idle                                                              */
/* ------------------------------------------------------------------ */

export const COPY_STATES = ['idle', 'copying', 'success', 'failed'];

export function createCopyState() {
  return { status: 'idle', lastCopiedAt: null, successCount: 0 };
}

export function copyStart(state) {
  if (state.status === 'copying') return state;
  return { ...state, status: 'copying' };
}

export function copyResolve(state, ok, now = Date.now()) {
  if (state.status !== 'copying') return state;
  return {
    ...state,
    status: ok ? 'success' : 'failed',
    lastCopiedAt: ok ? now : state.lastCopiedAt,
    successCount: ok ? state.successCount + 1 : state.successCount,
  };
}

/** After the checkmark has shown, return to idle. */
export function copyReset(state) {
  if (state.status !== 'success' && state.status !== 'failed') return state;
  return { ...state, status: 'idle' };
}

/* ------------------------------------------------------------------ */
/* Copy-as-cURL (idea 50842)                                           */
/* ------------------------------------------------------------------ */

function shellQuote(value) {
  // POSIX single-quote with embedded-quote escaping.
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

export function buildCurlCommand({ method = 'GET', url, headers = {}, body } = {}) {
  if (!url) return '';
  const parts = ['curl', '-X', method.toUpperCase(), shellQuote(url)];
  for (const [name, value] of Object.entries(headers)) {
    parts.push('-H', shellQuote(`${name}: ${value}`));
  }
  if (body !== undefined && body !== null) {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    parts.push('--data-raw', shellQuote(payload));
  }
  return parts.join(' ');
}

/* ------------------------------------------------------------------ */
/* Finding deep link (idea 50843)                                      */
/* ------------------------------------------------------------------ */

export function findingDeepLink({ baseUrl, huntId, findingId } = {}) {
  if (!baseUrl || !huntId || !findingId) return '';
  const base = String(baseUrl).replace(/\/+$/, '');
  return `${base}/hunts/${encodeURIComponent(huntId)}?finding=${encodeURIComponent(findingId)}`;
}

/* ------------------------------------------------------------------ */
/* CVSS vector copy (idea 50844)                                       */
/* ------------------------------------------------------------------ */

export function cvssCopyText(vector) {
  return String(vector || '').trim();
}

/* ------------------------------------------------------------------ */
/* Target URL copy (idea 50845)                                        */
/* ------------------------------------------------------------------ */

export function normalizeTargetUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return { text: '', note: '' };
  let note = '';
  let out = raw;
  if (!/^https?:\/\//i.test(out)) {
    out = 'https://' + out;
    note = 'scheme added';
  }
  if (!/\/$/.test(out) && !/[?#]/.test(out)) {
    out += '/';
    note = note ? note + '; trailing slash added' : 'trailing slash added';
  }
  return { text: out, note };
}

/* ------------------------------------------------------------------ */
/* Terminal copy toggle (idea 50846)                                   */
/* ------------------------------------------------------------------ */

export function stripTimestamps(logText) {
  // Removes leading "[2026-10-07 18:00:00] " style timestamps.
  return String(logText || '')
    .split('\n')
    .map((line) => line.replace(/^\[[^\]]{8,32}\]\s*/, ''))
    .join('\n');
}

export function terminalCopyText(logText, withTimestamps) {
  return withTimestamps ? String(logText || '') : stripTimestamps(logText);
}

/* ------------------------------------------------------------------ */
/* Table as CSV (idea 50847)                                           */
/* ------------------------------------------------------------------ */

function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function rowsToCsv(rows, headers) {
  const head = headers && headers.length ? headers : rows.length ? Object.keys(rows[0]) : [];
  const lines = [head.map(csvCell).join(',')];
  for (const row of rows) {
    const obj = Array.isArray(row) ? Object.fromEntries(head.map((h, i) => [h, row[i]])) : row;
    lines.push(head.map((h) => csvCell(obj[h])).join(','));
  }
  return lines.join('\r\n');
}

/* ------------------------------------------------------------------ */
/* Per-section report copy (idea 50848)                                */
/* ------------------------------------------------------------------ */

export function reportSectionCopy(section) {
  if (!section) return '';
  const title = section.title ? `# ${section.title}\n\n` : '';
  return title + String(section.body || '');
}

/* ------------------------------------------------------------------ */
/* Share text (idea 50849)                                             */
/* ------------------------------------------------------------------ */

export function shareText({ severity, title, host, path, link } = {}) {
  const sev = severity ? String(severity) : 'Finding';
  const what = title || 'issue';
  const where = [host, path].filter(Boolean).join('');
  const base = `${sev}: ${what}${where ? ' on ' + where : ''}`;
  return link ? `${base} — details: ${link}` : base;
}

/* ------------------------------------------------------------------ */
/* Masked token copy (idea 50850)                                      */
/* ------------------------------------------------------------------ */

export const TOKEN_REVEAL_WINDOW_MS = 30_000;

export function maskToken(token) {
  const t = String(token || '');
  if (t.length <= 8) return '••••••••';
  return t.slice(0, 4) + '…' + '•'.repeat(Math.min(12, t.length - 4));
}

/** True while the 30s reveal window after revealedAt is still open. */
export function isRevealWindowOpen(revealedAt, now = Date.now()) {
  if (!revealedAt) return false;
  return now - revealedAt < TOKEN_REVEAL_WINDOW_MS;
}

/* ------------------------------------------------------------------ */
/* Diagnostics bundle (idea 50851)                                     */
/* ------------------------------------------------------------------ */

export function diagnosticsBundle({ errorId, stack, env } = {}) {
  const stackExcerpt = String(stack || '').split('\n').slice(0, 5).join('\n');
  const envText = env
    ? Object.entries(env)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')
    : '';
  return [
    `error-id: ${errorId || 'unknown'}`,
    stackExcerpt ? `stack:\n${stackExcerpt}` : '',
    envText ? `env: ${envText}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/* ------------------------------------------------------------------ */
/* Search as URL (idea 50852)                                          */
/* ------------------------------------------------------------------ */

export function searchAsUrl(baseUrl, query) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  return `${base}/search?q=${encodeURIComponent(String(query || ''))}`;
}

/* ------------------------------------------------------------------ */
/* Webhook example (idea 50853)                                        */
/* ------------------------------------------------------------------ */

export function webhookExample(event = 'finding.created') {
  return JSON.stringify(
    {
      event,
      id: 'evt_123456',
      occurred_at: '2026-10-07T18:00:00+05:30',
      data: { hunt_id: 'hunt_001', finding_id: 'f_001', severity: 'high' },
    },
    null,
    2
  );
}

/* ------------------------------------------------------------------ */
/* Remediation as ticket (idea 50854)                                  */
/* ------------------------------------------------------------------ */

export function findingAsTicket(finding = {}, flavor = 'github') {
  const title = `[${finding.severity || 'n/a'}] ${finding.title || 'Untitled finding'}`;
  const body = [
    `**Target:** ${finding.target || 'unknown'}`,
    `**Severity:** ${finding.severity || 'unknown'}`,
    '',
    '## Description',
    finding.description || 'No description provided.',
    '',
    '## Remediation',
    finding.remediation || 'No remediation steps provided.',
  ].join('\n');
  if (flavor === 'jira') {
    // Jira wiki-markup flavor.
    return [
      `h2. ${title}`,
      `*Target:* ${finding.target || 'unknown'}`,
      `*Severity:* ${finding.severity || 'unknown'}`,
      '',
      'h3. Description',
      finding.description || 'No description provided.',
      '',
      'h3. Remediation',
      finding.remediation || 'No remediation steps provided.',
    ].join('\n');
  }
  return `# ${title}\n\n${body}`;
}

/* ------------------------------------------------------------------ */
/* Filtered set (idea 50855)                                           */
/* ------------------------------------------------------------------ */

export function filteredSetText(filters, format = 'json') {
  if (format === 'csv') {
    return rowsToCsv([filters], Object.keys(filters));
  }
  return JSON.stringify(filters, null, 2);
}

/* ------------------------------------------------------------------ */
/* Hunt summary (idea 50856)                                           */
/* ------------------------------------------------------------------ */

export function huntSummaryText({ name, findings = [], duration } = {}) {
  const counts = findings.reduce((acc, f) => {
    const s = String(f.severity || 'unknown').toLowerCase();
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const parts = Object.entries(counts).map(([sev, n]) => `${n} ${sev}`);
  const crit = findings.filter((f) => String(f.severity).toLowerCase() === 'critical').length;
  const head = `Hunt ${name || 'unnamed'}: ${findings.length} findings${parts.length ? ` (${parts.join(', ')})` : ''}`;
  const tail = crit > 0 ? ` — ${crit} critical need attention.` : '.';
  return head + tail + (duration ? ` Duration: ${duration}.` : '');
}

/* ------------------------------------------------------------------ */
/* Report checksum (idea 50857)                                        */
/* ------------------------------------------------------------------ */

export function checksumCopyText(hash, algorithm = 'SHA-256') {
  return `${algorithm}: ${String(hash || '')}`;
}

/* ------------------------------------------------------------------ */
/* Timeline event (idea 50858)                                         */
/* ------------------------------------------------------------------ */

export function timelineEventLine({ timestamp, huntId, label } = {}) {
  const ts = timestamp || new Date().toISOString();
  return `[${ts}]${huntId ? ` [hunt:${huntId}]` : ''} ${label || 'event'}`;
}

/* ------------------------------------------------------------------ */
/* Clipboard history (idea 50859)                                      */
/* ------------------------------------------------------------------ */

export const CLIPBOARD_HISTORY_MAX = 20;

export function historyPush(history, entry) {
  const next = [
    { text: entry.text, label: entry.label || 'copy', at: entry.at || Date.now() },
    ...history,
  ];
  return next.slice(0, CLIPBOARD_HISTORY_MAX);
}

/* ------------------------------------------------------------------ */
/* Copy-format chooser (idea 50860)                                    */
/* ------------------------------------------------------------------ */

export const COPY_FORMATS = ['plain', 'rich', 'markdown'];

export function formatCopyText(text, format) {
  if (format === 'markdown') {
    return `\`\`\`\n${String(text)}\n\`\`\``;
  }
  // 'rich' keeps structure; 'plain' strips nothing — clipboard handles it.
  return String(text);
}

/* ------------------------------------------------------------------ */
/* Copy with citation (idea 50861)                                     */
/* ------------------------------------------------------------------ */

export function citationAppend(text, { huntId, at } = {}) {
  const parts = [String(text || '')];
  if (huntId) parts.push(`source: hunt ${huntId}`);
  if (at) parts.push(`captured: ${at}`);
  return parts.join('\n');
}

/* ------------------------------------------------------------------ */
/* Asset list (idea 50862)                                             */
/* ------------------------------------------------------------------ */

export function assetListText(assets) {
  return (assets || []).map((a) => String(a)).join('\n');
}

/* ------------------------------------------------------------------ */
/* Retest diff (idea 50863)                                            */
/* ------------------------------------------------------------------ */

export function retestDiffText({ before, after, context = 3 } = {}) {
  const b = String(before || '').split('\n');
  const a = String(after || '').split('\n');
  const lines = ['--- before', '+++ after'];
  const max = Math.max(b.length, a.length);
  let shown = 0;
  for (let i = 0; i < max && shown < context * 2 + 1; i++) {
    if (b[i] !== a[i]) {
      if (b[i] !== undefined) lines.push(`- ${b[i]}`);
      if (a[i] !== undefined) lines.push(`+ ${a[i]}`);
      shown++;
    }
  }
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Shortcut text (idea 50864)                                          */
/* ------------------------------------------------------------------ */

export function shortcutText(binding) {
  return String(binding || '')
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
    .join('+');
}

/* ------------------------------------------------------------------ */
/* Status update (idea 50865)                                          */
/* ------------------------------------------------------------------ */

export function statusUpdateText({ kind, summary, link } = {}) {
  const base = `Update (${kind || 'hunt'}): ${summary || 'no changes'}.`;
  return link ? `${base} ${link}` : base;
}

/* ------------------------------------------------------------------ */
/* Model config (idea 50866)                                           */
/* ------------------------------------------------------------------ */

export function modelConfigJson(config) {
  return JSON.stringify(config || {}, null, 2);
}

/* ------------------------------------------------------------------ */
/* Filter as URL (idea 50867)                                          */
/* ------------------------------------------------------------------ */

export function filterAsUrl(baseUrl, filterState) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filterState || {})) {
    params.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  return `${base}/findings?${params.toString()}`;
}

/* ------------------------------------------------------------------ */
/* Auto-copy selection (idea 50868)                                    */
/* ------------------------------------------------------------------ */

export function createAutoCopyState(enabled = false) {
  return { enabled };
}

export function toggleAutoCopy(state) {
  return { enabled: !state.enabled };
}

/* ------------------------------------------------------------------ */
/* Line-count toast (idea 50869)                                       */
/* ------------------------------------------------------------------ */

export function lineCountToast(text) {
  const lines = String(text || '').split('\n').length;
  return `copied ${lines} line${lines === 1 ? '' : 's'}`;
}

/* ------------------------------------------------------------------ */
/* Clipboard-blocked fallback (idea 50870)                             */
/* ------------------------------------------------------------------ */

export function blockedFallbackState(text) {
  return { open: true, text: String(text || '') };
}

/* ------------------------------------------------------------------ */
/* Labeled copy buttons (idea 50871)                                   */
/* ------------------------------------------------------------------ */

export function copyAriaLabel(action, format) {
  const what = action || 'content';
  return format && format !== 'plain' ? `Copy ${what} as ${format}` : `Copy ${what}`;
}

/* ------------------------------------------------------------------ */
/* Encoded-payload copy (idea 50872)                                   */
/* ------------------------------------------------------------------ */

export function encodePayload(payload, variant = 'base64') {
  const s = String(payload || '');
  if (variant === 'url') return encodeURIComponent(s);
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf8').toString('base64');
  // Browser fallback.
  return btoa(unescape(encodeURIComponent(s)));
}

export const PAYLOAD_VARIANTS = ['base64', 'url', 'raw'];

/* ------------------------------------------------------------------ */
/* Dual timestamps (idea 50873)                                        */
/* ------------------------------------------------------------------ */

export function dualTimestamps(ts, now = Date.now()) {
  const date = new Date(ts);
  const iso = date.toISOString();
  const diffMs = now - date.getTime();
  const mins = Math.round(diffMs / 60000);
  let relative;
  if (mins < 1) relative = 'just now';
  else if (mins < 60) relative = `${mins}m ago`;
  else if (mins < 1440) relative = `${Math.round(mins / 60)}h ago`;
  else relative = `${Math.round(mins / 1440)}d ago`;
  return { iso, relative, combined: `${iso} (${relative})` };
}

/* ------------------------------------------------------------------ */
/* Invite link (idea 50874)                                            */
/* ------------------------------------------------------------------ */

export function inviteLinkText({ link, role, expiresAt } = {}) {
  const parts = [link || ''];
  const meta = [];
  if (role) meta.push(`role: ${role}`);
  if (expiresAt) meta.push(`expires: ${expiresAt}`);
  return meta.length ? `${parts[0]}\n(${meta.join(' · ')})` : parts[0];
}

/* ------------------------------------------------------------------ */
/* Widget config (idea 50875)                                          */
/* ------------------------------------------------------------------ */

export function widgetConfigJson(layout) {
  return JSON.stringify({ widgets: layout || [] }, null, 2);
}

/* ------------------------------------------------------------------ */
/* Verified regex (idea 50876)                                         */
/* ------------------------------------------------------------------ */

export function verifyRegex(pattern) {
  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern);
    return { valid: true, pattern: String(pattern) };
  } catch (err) {
    return { valid: false, pattern: String(pattern), error: err.message };
  }
}

export function escapeRegex(literal) {
  return String(literal).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ------------------------------------------------------------------ */
/* Multi-block copy (idea 50877)                                       */
/* ------------------------------------------------------------------ */

export function multiBlockCombine(blocks) {
  return (blocks || [])
    .filter((b) => b && b.selected)
    .map((b) => b.text)
    .join('\n\n---\n\n');
}

/* ------------------------------------------------------------------ */
/* Accessible table copy (idea 50878)                                  */
/* ------------------------------------------------------------------ */

export function accessibleTableText(rows, headers) {
  const head = headers && headers.length ? headers : rows.length ? Object.keys(rows[0]) : [];
  const lines = [`headers: ${head.join(' | ')}`];
  for (const row of rows) {
    const obj = Array.isArray(row) ? Object.fromEntries(head.map((h, i) => [h, row[i]])) : row;
    lines.push(head.map((h) => `${h}: ${obj[h] ?? ''}`).join(' | '));
  }
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Copy rate guard (idea 50879)                                        */
/* ------------------------------------------------------------------ */

export const COPY_RATE_LIMIT = 10; // copies per second
export const COPY_RATE_WINDOW_MS = 1000;

export function copyRateGuard(timestamps, now = Date.now()) {
  const recent = (timestamps || []).filter((t) => now - t < COPY_RATE_WINDOW_MS);
  const allowed = recent.length < COPY_RATE_LIMIT;
  return {
    allowed,
    remaining: Math.max(0, COPY_RATE_LIMIT - recent.length),
    note: allowed ? '' : 'Slow down — 10 copies per second is the limit.',
  };
}

/* ------------------------------------------------------------------ */
/* Mobile share-sheet fallback (idea 50880)                            */
/* ------------------------------------------------------------------ */

export function prefersShareSheet(userAgent = '') {
  // Pure: caller passes navigator.userAgent; mobile UAs get the share sheet.
  return /android|iphone|ipad|ipod|mobile/i.test(String(userAgent));
}

/* ------------------------------------------------------------------ */
/* Registry completeness helper                                        */
/* ------------------------------------------------------------------ */

export function wave22IdeaIds() {
  return WAVE22_IDEAS.map(([id]) => id);
}
