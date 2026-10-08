/**
 * wave22.test.js — wave 22 (ideas 50841–50880): clipboard / copy-everywhere.
 *
 * node:test checks for clipboardCore pure logic + registry completeness.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE22_IDEAS,
  wave22IdeaIds,
  createCopyState,
  copyStart,
  copyResolve,
  copyReset,
  COPY_STATES,
  buildCurlCommand,
  findingDeepLink,
  cvssCopyText,
  normalizeTargetUrl,
  stripTimestamps,
  terminalCopyText,
  rowsToCsv,
  reportSectionCopy,
  shareText,
  maskToken,
  isRevealWindowOpen,
  TOKEN_REVEAL_WINDOW_MS,
  diagnosticsBundle,
  searchAsUrl,
  webhookExample,
  findingAsTicket,
  filteredSetText,
  huntSummaryText,
  checksumCopyText,
  timelineEventLine,
  historyPush,
  CLIPBOARD_HISTORY_MAX,
  COPY_FORMATS,
  formatCopyText,
  citationAppend,
  assetListText,
  retestDiffText,
  shortcutText,
  statusUpdateText,
  modelConfigJson,
  filterAsUrl,
  createAutoCopyState,
  toggleAutoCopy,
  lineCountToast,
  blockedFallbackState,
  copyAriaLabel,
  encodePayload,
  PAYLOAD_VARIANTS,
  dualTimestamps,
  inviteLinkText,
  widgetConfigJson,
  verifyRegex,
  escapeRegex,
  multiBlockCombine,
  accessibleTableText,
  copyRateGuard,
  COPY_RATE_LIMIT,
  prefersShareSheet,
} from './clipboardCore.js';

describe('wave 22 registry', () => {
  it('covers all 40 ideas 50841–50880, all marked new', () => {
    assert.equal(WAVE22_IDEAS.length, 40);
    const ids = wave22IdeaIds();
    for (let i = 0; i < 40; i++) assert.equal(ids[i], 50841 + i);
    for (const [, , status] of WAVE22_IDEAS) assert.equal(status, 'new');
    assert.deepEqual(new Set(ids).size, 40);
  });
});

describe('copy state machine (50841)', () => {
  it('transitions idle → copying → success → idle', () => {
    let s = createCopyState();
    assert.equal(s.status, 'idle');
    s = copyStart(s);
    assert.equal(s.status, 'copying');
    s = copyResolve(s, true, 1000);
    assert.equal(s.status, 'success');
    assert.equal(s.lastCopiedAt, 1000);
    assert.equal(s.successCount, 1);
    s = copyReset(s);
    assert.equal(s.status, 'idle');
  });
  it('failed path does not bump successCount', () => {
    const s = copyResolve(copyStart(createCopyState()), false);
    assert.equal(s.status, 'failed');
    assert.equal(s.successCount, 0);
  });
  it('COPY_STATES covers the machine', () => {
    assert.deepEqual([...COPY_STATES].sort(), ['copying', 'failed', 'idle', 'success'].sort());
  });
});

describe('copy-as-cURL (50842)', () => {
  it('builds a replayable command with headers and body', () => {
    const cmd = buildCurlCommand({
      method: 'post',
      url: 'https://example.com/login',
      headers: { 'Content-Type': 'application/json' },
      body: { user: 'a' },
    });
    assert.match(cmd, /^curl -X POST 'https:\/\/example\.com\/login'/);
    assert.ok(cmd.includes("-H 'Content-Type: application/json'"));
    assert.ok(cmd.includes('--data-raw'));
  });
  it('escapes single quotes in values', () => {
    const cmd = buildCurlCommand({ url: "https://x/?a=b'c" });
    assert.ok(cmd.includes("'\\''"));
  });
});

describe('deep link + CVSS + target URL (50843–50845)', () => {
  it('builds an expanded finding link', () => {
    const link = findingDeepLink({
      baseUrl: 'https://app.example/',
      huntId: 'h1',
      findingId: 'f 1',
    });
    assert.equal(link, 'https://app.example/hunts/h1?finding=f%201');
  });
  it('trims CVSS vectors', () => {
    assert.equal(cvssCopyText('  CVSS:3.1/AV:N  '), 'CVSS:3.1/AV:N');
  });
  it('normalizes target URLs with a note', () => {
    const { text, note } = normalizeTargetUrl('example.com');
    assert.equal(text, 'https://example.com/');
    assert.ok(note.includes('trailing slash'));
  });
});

describe('terminal copy (50846)', () => {
  it('strips bracketed timestamps when toggled off', () => {
    const out = stripTimestamps('[2026-10-07 18:00:01] hunt started\nplain line');
    assert.equal(out, 'hunt started\nplain line');
  });
  it('terminalCopyText respects the toggle', () => {
    const log = '[2026-10-07 18:00:01] hi';
    assert.equal(terminalCopyText(log, true), log);
    assert.equal(terminalCopyText(log, false), 'hi');
  });
});

describe('CSV (50847)', () => {
  it('produces well-formed CSV with quoting', () => {
    const csv = rowsToCsv(
      [
        { a: 'x', b: 'y,z' },
        { a: 'p"q', b: 'r' },
      ],
      ['a', 'b']
    );
    assert.equal(csv, 'a,b\r\nx,"y,z"\r\n"p""q",r');
  });
});

describe('report section + share text (50848–50849)', () => {
  it('prefixes section titles', () => {
    assert.equal(reportSectionCopy({ title: 'Findings', body: 'two' }), '# Findings\n\ntwo');
  });
  it('formats the share line', () => {
    const t = shareText({
      severity: 'Critical',
      title: 'SQLi',
      host: 'example.com',
      path: '/login',
      link: 'L',
    });
    assert.equal(t, 'Critical: SQLi on example.com/login — details: L');
  });
});

describe('masked token (50850)', () => {
  it('masks while keeping a 4-char prefix', () => {
    const m = maskToken('sk-live-1234567890');
    assert.ok(m.startsWith('sk-l'));
    assert.ok(!m.includes('1234567890'));
  });
  it('reveal window closes after 30s', () => {
    const revealed = 1000;
    assert.equal(isRevealWindowOpen(revealed, revealed + TOKEN_REVEAL_WINDOW_MS - 1), true);
    assert.equal(isRevealWindowOpen(revealed, revealed + TOKEN_REVEAL_WINDOW_MS), false);
    assert.equal(isRevealWindowOpen(null), false);
  });
});

describe('diagnostics + search URL + webhook (50851–50853)', () => {
  it('bundles id + stack excerpt + env', () => {
    const b = diagnosticsBundle({ errorId: 'E1', stack: 'a\nb\nc\nd\ne\nf', env: { A: '1' } });
    assert.ok(b.includes('error-id: E1'));
    assert.ok(b.includes('env: A=1'));
    assert.ok(!b.includes('\nf')); // 5-line excerpt
  });
  it('encodes search queries as URLs', () => {
    assert.equal(searchAsUrl('https://app.example/', 'a b'), 'https://app.example/search?q=a%20b');
  });
  it('emits a sample webhook payload', () => {
    const parsed = JSON.parse(webhookExample('finding.created'));
    assert.equal(parsed.event, 'finding.created');
    assert.ok(parsed.data.hunt_id);
  });
});

describe('ticket (50854)', () => {
  it('renders GitHub markdown', () => {
    const t = findingAsTicket({ severity: 'High', title: 'XSS', target: 'x.com' }, 'github');
    assert.ok(t.startsWith('# [High] XSS'));
  });
  it('renders Jira wiki markup', () => {
    const t = findingAsTicket({ severity: 'High', title: 'XSS' }, 'jira');
    assert.ok(t.includes('h2.'));
    assert.ok(!t.includes('# [High]'));
  });
});

describe('filtered set + hunt summary + checksum (50855–50857)', () => {
  it('exports filters as JSON or CSV', () => {
    const f = { severity: 'critical' };
    assert.ok(filteredSetText(f, 'json').includes('critical'));
    assert.ok(filteredSetText(f, 'csv').includes('severity'));
  });
  it('writes the standup paragraph', () => {
    const t = huntSummaryText({
      name: 'nightly',
      findings: [{ severity: 'Critical' }, { severity: 'high' }],
    });
    assert.ok(t.startsWith('Hunt nightly: 2 findings'));
    assert.ok(t.includes('1 critical'));
  });
  it('labels the checksum', () => {
    assert.equal(checksumCopyText('abc'), 'SHA-256: abc');
  });
});

describe('timeline event + history (50858–50859)', () => {
  it('formats timestamped log lines', () => {
    const line = timelineEventLine({ timestamp: 'T', huntId: 'h1', label: 'done' });
    assert.equal(line, '[T] [hunt:h1] done');
  });
  it('caps history at 20, newest first', () => {
    let h = [];
    for (let i = 0; i < 25; i++) h = historyPush(h, { text: `t${i}`, label: 'x' });
    assert.equal(h.length, CLIPBOARD_HISTORY_MAX);
    assert.equal(h[0].text, 't24');
  });
});

describe('format chooser (50860)', () => {
  it('lists plain/rich/markdown', () => {
    assert.deepEqual(COPY_FORMATS, ['plain', 'rich', 'markdown']);
  });
  it('wraps markdown in code fences', () => {
    assert.equal(formatCopyText('hi', 'markdown'), '```\nhi\n```');
    assert.equal(formatCopyText('hi', 'plain'), 'hi');
  });
});

describe('citation + assets + diff + shortcut (50861–50864)', () => {
  it('appends hunt id and timestamp', () => {
    const t = citationAppend('evidence', { huntId: 'h1', at: 'now' });
    assert.ok(t.includes('source: hunt h1'));
    assert.ok(t.includes('captured: now'));
  });
  it('joins assets newline-delimited', () => {
    assert.equal(assetListText(['a', 'b']), 'a\nb');
  });
  it('renders before/after diff lines', () => {
    const d = retestDiffText({ before: 'a\nb', after: 'a\nc' });
    assert.ok(d.includes('- b'));
    assert.ok(d.includes('+ c'));
  });
  it('normalizes shortcut text', () => {
    assert.equal(shortcutText(' ctrl + shift + e '), 'ctrl+shift+e');
  });
});

describe('status update + model config + filter URL (50865–50867)', () => {
  it('pre-writes status updates', () => {
    const t = statusUpdateText({ kind: 'hunt', summary: '3 new', link: 'L' });
    assert.ok(t.startsWith('Update (hunt): 3 new.'));
    assert.ok(t.endsWith(' L'));
  });
  it('serializes model configs', () => {
    assert.deepEqual(JSON.parse(modelConfigJson({ a: 1 })), { a: 1 });
  });
  it('encodes filter state as a URL', () => {
    const url = filterAsUrl('https://app.example', {
      severity: ['critical', 'high'],
      sort: 'risk',
    });
    assert.ok(url.includes('severity=critical%2Chigh'));
    assert.ok(url.includes('sort=risk'));
  });
});

describe('auto-copy + line-count + fallback + labels (50868–50871)', () => {
  it('toggles auto-copy', () => {
    assert.equal(toggleAutoCopy(createAutoCopyState(false)).enabled, true);
  });
  it('counts lines in the toast', () => {
    assert.equal(lineCountToast('a\nb\nc'), 'copied 3 lines');
    assert.equal(lineCountToast('a'), 'copied 1 line');
  });
  it('opens the fallback modal state', () => {
    assert.deepEqual(blockedFallbackState('x'), { open: true, text: 'x' });
  });
  it('labels copy buttons accessibly', () => {
    assert.equal(copyAriaLabel('PoC', 'markdown'), 'Copy PoC as markdown');
    assert.equal(copyAriaLabel('PoC', 'plain'), 'Copy PoC');
  });
});

describe('payload encoding + timestamps + invite (50872–50874)', () => {
  it('encodes base64 and URL variants', () => {
    assert.equal(encodePayload('a b', 'base64'), 'YSBi');
    assert.equal(encodePayload('a b', 'url'), 'a%20b');
  });
  it('lists the three variants', () => {
    assert.deepEqual(PAYLOAD_VARIANTS, ['base64', 'url', 'raw']);
  });
  it('produces ISO + relative timestamps', () => {
    const now = new Date('2026-10-07T18:00:00Z').getTime();
    const { iso, relative, combined } = dualTimestamps('2026-10-07T17:00:00Z', now);
    assert.equal(iso, '2026-10-07T17:00:00.000Z');
    assert.equal(relative, '1h ago');
    assert.ok(combined.includes(iso));
  });
  it('shows role and expiry before the link', () => {
    const t = inviteLinkText({ link: 'L', role: 'analyst', expiresAt: '2026-10-14' });
    assert.ok(t.includes('role: analyst'));
    assert.ok(t.includes('expires: 2026-10-14'));
  });
});

describe('widget config + regex (50875–50876)', () => {
  it('serializes widget layouts', () => {
    assert.deepEqual(JSON.parse(widgetConfigJson([{ id: 'w1' }])), { widgets: [{ id: 'w1' }] });
  });
  it('verifies regex validity', () => {
    assert.equal(verifyRegex('^/admin').valid, true);
    const bad = verifyRegex('([');
    assert.equal(bad.valid, false);
    assert.ok(bad.error);
  });
  it('escapes literals for safe copy', () => {
    assert.equal(escapeRegex('a.b'), 'a\\.b');
  });
});

describe('multi-block + accessible table (50877–50878)', () => {
  it('combines only selected blocks', () => {
    const t = multiBlockCombine([
      { text: 'one', selected: true },
      { text: 'two', selected: false },
      { text: 'three', selected: true },
    ]);
    assert.ok(t.includes('one'));
    assert.ok(!t.includes('two'));
    assert.ok(t.includes('three'));
  });
  it('includes header rows for screen readers', () => {
    const t = accessibleTableText([{ a: '1' }], ['a']);
    assert.ok(t.startsWith('headers: a'));
    assert.ok(t.includes('a: 1'));
  });
});

describe('rate guard (50879)', () => {
  it('allows up to 10 copies per second', () => {
    const now = 10_000;
    const stamps = Array.from({ length: 10 }, (_, i) => now - 500 + i);
    const blocked = copyRateGuard(stamps, now);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.note.includes('Slow down'));
    const ok = copyRateGuard(stamps.slice(1), now);
    assert.equal(ok.allowed, true);
    assert.equal(ok.remaining, 1);
  });
  it('exports the limit constant', () => {
    assert.equal(COPY_RATE_LIMIT, 10);
  });
});

describe('mobile share-sheet detection (50880)', () => {
  it('detects mobile user agents', () => {
    assert.equal(prefersShareSheet('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), true);
    assert.equal(prefersShareSheet('Mozilla/5.0 (Windows NT 10.0) Chrome/120'), false);
    assert.equal(prefersShareSheet(''), false);
  });
});
