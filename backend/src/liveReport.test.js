// Live-report fixes (27 Oct 2026, feat/live-report-fix).
//
// The Reports page showed "No report generated yet" forever for the
// running DVWA hunt, while the hunt panel showed 0 verified / 6
// leads and the chat summary could still say "5 confirmed
// vulnerabilities". Root causes, all fixed on this lane:
//   1. The report endpoint returns text/markdown, but the frontend
//      fetched it through the JSON-only request() — the markdown
//      parsed to null, so fetchReportMarkdown always returned ''.
//   2. buildReportMarkdown rendered RAW finding events — every
//      stamp a finding, including the 5 "verified" 404-page stamps
//      and their "PoC confirmed:" duplicates, with no confirmed /
//      lead distinction, contradicting the panel.
//   3. panelFindings copied ANY stamp's verification onto a row, so
//      a demoted lead kept the 'confirmed (all 4 steps passed)'
//      note as its badge tooltip.
//   4. chat.js confirmedTitles counted f.verified raw — the
//      deterministic summary path could still quote the false 5.
// The frontend half (text fetch + surfaced refresh errors) is
// guarded by frontend/scripts/check-live-report.mjs and by the lab
// repro ~/workspace/dm-v2/probes/live-report-repro.mjs against the
// real backend; these tests guard the backend half.
import test from 'node:test';
import assert from 'node:assert/strict';
import { panelFindings } from './huntMemory.js';
import { confirmedTitles, summaryReply } from './routes/chat.js';
import { buildReportMarkdown } from './routes/hunts.js';

const err404 = (url) => [
  'HTTP/1.1 404 Not Found',
  'Content-Type: text/html; charset=iso-8859-1',
  '',
  '<!DOCTYPE HTML><html><head><title>404 Not Found</title></head>',
  `<body><h1>Not Found</h1><p>The requested URL ${url} was not found on this server.</p>`,
  '<p>admin panel</p></body></html>',
].join('\n');

const ok200 = [
  'HTTP/1.1 200 OK',
  'Content-Type: text/html',
  '',
  '<html><body><h1>DVWA login</h1><form>username password</form></body></html>',
].join('\n');

const FALSE_TITLES = [
  'admin panel unauthenticated disclosure',
  'admin config variant sweep',
  'encryption keys client disclosure',
  'admin application-version variant sweep',
  'admin security-config variant sweep',
];

// The live DVWA hunt's finding shape (h_830317bdc184, 27 Oct 2026):
// 5 "verified" stamps on 404 pages + 5 "PoC confirmed:" duplicates
// + 1 genuine verified finding + 1 unverified lead.
function liveShapeFindings() {
  const list = [];
  for (const t of FALSE_TITLES) {
    list.push({
      type: 'finding', title: t, severity: 'medium', verified: true,
      verification: 'confirmed (all 4 steps passed)',
      url: 'http://172.17.0.1:3100/rest/admin/x',
      cachedAt: '2026-10-27T15:58:00.000Z',
      evidence: { request: 'GET /rest/admin/x', response: err404('/rest/admin/x'), impact_demo: 'signal: admin' },
    });
  }
  for (const t of FALSE_TITLES) {
    list.push({
      type: 'finding', title: `PoC confirmed: ${t}`, severity: 'medium',
      verified: true, verification: null, cachedAt: '2026-10-27T16:00:00.000Z',
      evidence: { poc_command: 'curl ...', poc_output: err404('/rest/admin/x') },
    });
  }
  list.push({
    type: 'finding', title: 'reflected xss in search parameter', class: 'xss',
    severity: 'medium', verified: true, verification: 'confirmed (all 4 steps passed)',
    url: 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=test',
    cachedAt: '2026-10-27T16:05:00.000Z',
    evidence: { request: 'GET /vulnerabilities/xss_r/?name=<script>', response: ok200, impact_demo: 'script reflected' },
  });
  list.push({
    type: 'finding', title: 'possible sqli in login form', severity: 'medium',
    verified: false, verification: 'false_positive (reachability: Target endpoint is reachable and responds — FAILED)',
    url: 'http://172.17.0.1:3100/login.php',
    cachedAt: '2026-10-27T16:06:00.000Z',
    evidence: { request: "POST /login.php user=' OR 1=1--", response: ok200 },
  });
  return list;
}

test('panelFindings: 404-stamped "verified" findings are leads, with no confirmed note', () => {
  const rows = panelFindings(liveShapeFindings());
  // 5 false + 1 genuine + 1 lead = 7 unique rows ("PoC confirmed:" collapses).
  assert.equal(rows.length, 7);
  const confirmed = rows.filter((r) => r.verified);
  assert.deepEqual(confirmed.map((r) => r.title), ['reflected xss in search parameter']);
  for (const r of rows.filter((x) => !x.verified)) {
    assert.equal(r.verification || '', '', `lead "${r.title}" must not carry a verification note`);
    assert.doesNotMatch(r.detail || '', /confirmed/i, `lead "${r.title}" detail must not claim confirmation`);
  }
  // The genuine finding keeps its real verification.
  assert.equal(confirmed[0].verification, 'confirmed (all 4 steps passed)');
});

test('confirmedTitles: error-page stamps never count as confirmed', () => {
  const titles = confirmedTitles(liveShapeFindings());
  assert.deepEqual(titles, ['reflected xss in search parameter']);
});

test('summaryReply: the deterministic chat summary cannot quote the false 5', () => {
  const findings = liveShapeFindings();
  const reply = summaryReply({
    ctx: 'Hunting http://172.17.0.1:3100/ — actively hunting. 6 lead(s), 0 confirmed so far.',
    live: null, liveError: false, cached: findings, findings,
    reasoningRows: [], message: 'what are you doing right now', meta: { state: 'running' }, huntId: 'h_lab',
  });
  assert.doesNotMatch(reply, /5 confirmed/, 'must never say "5 confirmed" for the 404 stamps');
  assert.match(reply, /Found 1 confirmed vulnerability: reflected xss in search parameter/);
});

test('buildReportMarkdown: reconciled rows — 1 confirmed, 6 leads, no duplicates', () => {
  const events = liveShapeFindings();
  const md = buildReportMarkdown({
    huntId: 'h_lab_report',
    meta: { target: 'http://172.17.0.1:3100/', createdAt: '2026-10-27T15:00:00.000Z' },
    events,
  });
  assert.match(md, /7 unique findings: 1 confirmed, 6 under investigation/);
  const confirmedSection = (md.split('### Confirmed vulnerabilities')[1] || '').split('### Leads under investigation')[0];
  const leadsSection = (md.split('### Leads under investigation')[1] || '').split('## Tool activity')[0];
  assert.match(confirmedSection, /reflected xss in search parameter/);
  for (const t of FALSE_TITLES) {
    assert.doesNotMatch(confirmedSection, new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `false title "${t}" must not be in the Confirmed section`);
    assert.match(leadsSection, new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `false title "${t}" must be listed as a lead`);
  }
  assert.match(leadsSection, /possible sqli in login form/);
  assert.doesNotMatch(md, /PoC confirmed:/, '"PoC confirmed:" duplicates must collapse to one row each');
  assert.doesNotMatch(leadsSection, /confirmed \(all 4 steps passed\)/, 'no false confirmed verdict in the Leads section');
  // The genuine finding's real verdict appears exactly once (its own line).
  assert.equal((md.match(/confirmed \(all 4 steps passed\)/g) || []).length, 1);
});

test('buildReportMarkdown: a retraction removes the finding from the report', () => {
  const events = [
    ...liveShapeFindings(),
    { type: 'retraction', findingTitle: 'reflected xss in search parameter', at: '2026-10-27T16:10:00.000Z' },
  ];
  const md = buildReportMarkdown({
    huntId: 'h_lab_report',
    meta: { target: 'http://172.17.0.1:3100/', createdAt: '2026-10-27T15:00:00.000Z' },
    events,
  });
  assert.match(md, /6 unique findings: 0 confirmed, 6 under investigation/);
  assert.match(md, /_No confirmed vulnerabilities yet\._/);
  assert.doesNotMatch(md, /reflected xss in search parameter/);
});

test('buildReportMarkdown: a hunt with no findings yet still renders', () => {
  const md = buildReportMarkdown({
    huntId: 'h_lab_empty',
    meta: { target: 'http://172.17.0.1:3100/', createdAt: '2026-10-27T15:00:00.000Z' },
    events: [{ type: 'thinking', text: 'Starting recon.', at: '2026-10-27T15:00:00.000Z' }],
  });
  assert.match(md, /_No findings recorded yet\._/);
  assert.match(md, /0 unique findings: 0 confirmed, 0 under investigation/);
});
