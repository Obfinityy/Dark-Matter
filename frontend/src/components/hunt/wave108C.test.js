/**
 * Wave 108C tests — target scoring factors + analyst notes (ideas 54301-54310).
 * Run: node --test frontend/src/components/hunt/wave108C.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const corePath = join(here, 'wave108CCores.js');
const jsxPath = join(here, 'Wave108C.jsx');
const cssPath = join(here, 'Wave108C.css');

import {
  WAVE108_C_IDEAS,
  SCORE_MODEL_VERSION,
  scoreBand,
  portExposureScore,
  listRecalcTriggers,
  registerRecalcTrigger,
  shouldRecalc,
  resetRecalcTriggers,
  buildScoreApiResponse,
  scoreApiToJson,
  provisionalScore,
  ONBOARDING_SIGNALS,
  createRichDoc,
  addHeading,
  addParagraph,
  addList,
  addCallout,
  addLink,
  richDocToMarkdown,
  markdownToHtmlLite,
  pinNote,
  unpinNote,
  isNotePinned,
  sortNotesPinnedFirst,
  listNoteTemplates,
  noteFromTemplate,
  annotateTimelineEvent,
  annotationsForEvent,
  attachScreenshot,
  removeScreenshot,
  screenshotCount,
  MAX_SCREENSHOT_DATAURL_BYTES,
} from './wave108CCores.js';

const EXPECTED_TITLES = {
  54301: 'Port exposure factor',
  54302: 'Score recalculation triggers',
  54303: 'Score API',
  54304: 'New-target provisional scoring',
  54305: 'Rich-text notes editor',
  54306: 'Markdown support',
  54307: 'Note pinning',
  54308: 'Note templates',
  54309: 'Timestamped annotations',
  54310: 'Screenshot attachments',
};

/* ---------- idea registry ---------- */
test('WAVE108_C_IDEAS has exactly 10 entries, ids 54301-54310, titles matching the idea bank', () => {
  assert.equal(WAVE108_C_IDEAS.length, 10);
  const ids = WAVE108_C_IDEAS.map((i) => i.id);
  for (let id = 54301; id <= 54310; id += 1) {
    assert.ok(ids.includes(id), `missing id ${id}`);
  }
  for (const idea of WAVE108_C_IDEAS) {
    assert.equal(idea.title, EXPECTED_TITLES[idea.id], `title mismatch for ${idea.id}`);
  }
});

/* ---------- score bands ---------- */
test('scoreBand maps 0-100 to critical/high/medium/low/info', () => {
  assert.equal(scoreBand(95), 'critical');
  assert.equal(scoreBand(80), 'critical');
  assert.equal(scoreBand(70), 'high');
  assert.equal(scoreBand(50), 'medium');
  assert.equal(scoreBand(30), 'low');
  assert.equal(scoreBand(10), 'info');
  assert.equal(scoreBand(0), 'info');
});

/* ---------- 54301 port exposure factor ---------- */
test('54301: unexpected database port raises the factor vs expected HTTP only', () => {
  const withDb = portExposureScore(
    [{ port: 80 }, { port: 443 }, { port: 3306 }],
    [80, 443, 'HTTP', 'HTTPS']
  );
  assert.ok(withDb.factor > 0, 'factor should rise for unexpected MySQL');
  assert.equal(withDb.unexpected.length, 1);
  assert.equal(withDb.unexpected[0].port, 3306);
  assert.equal(withDb.unexpected[0].risk, 'critical');

  const expectedOnly = portExposureScore([{ port: 80 }, { port: 443 }], [80, 443]);
  assert.equal(expectedOnly.factor, 0);
  assert.equal(expectedOnly.unexpected.length, 0);
  assert.equal(expectedOnly.expected.length, 2);

  assert.ok(
    withDb.factor > expectedOnly.factor,
    'unexpected DB port must score higher than expected HTTP alone'
  );
});

test('54301: multiple unexpected services stack weights, capped at 100', () => {
  const r = portExposureScore([{ port: 3306 }, { port: 6379 }, { port: 2375 }, { port: 23 }], []);
  assert.ok(r.factor <= 100);
  assert.ok(r.factor >= 90, `expected heavy stacking, got ${r.factor}`);
  // Sorted heaviest first (Docker API 36 on top)
  assert.equal(r.unexpected[0].port, 2375);
  assert.ok(r.unexpected.every((u) => u.reason && u.risk));
});

/* ---------- 54302 recalculation triggers ---------- */
test('54302: recalc fires on hunt-completed / change-detected / scope-edited, skips others', () => {
  resetRecalcTriggers();
  for (const type of ['hunt-completed', 'change-detected', 'scope-edited']) {
    const verdict = shouldRecalc(type);
    assert.equal(verdict.recalc, true, `${type} should trigger a recompute`);
    assert.equal(verdict.eventType, type);
    assert.ok(verdict.reason);
  }
  const quiet = shouldRecalc('note-saved');
  assert.equal(quiet.recalc, false);
  assert.equal(quiet.reason, null);
  const fromObj = shouldRecalc({ type: 'scope-edited' });
  assert.equal(fromObj.recalc, true);
});

test('54302: registerRecalcTrigger adds a custom trigger that fires', () => {
  resetRecalcTriggers();
  registerRecalcTrigger('credential-leak', 'leaked creds change the risk picture');
  const verdict = shouldRecalc('credential-leak');
  assert.equal(verdict.recalc, true);
  assert.equal(verdict.reason, 'leaked creds change the risk picture');
  const all = listRecalcTriggers();
  assert.ok(all.some((t) => t.eventType === 'credential-leak' && t.custom === true));
  resetRecalcTriggers();
  assert.equal(shouldRecalc('credential-leak').recalc, false, 'reset clears custom triggers');
});

/* ---------- 54303 score API ---------- */
test('54303: buildScoreApiResponse is JSON-serializable with score, band, factors, model version', () => {
  const res = buildScoreApiResponse({
    id: 'acme-web',
    name: 'Acme Web',
    score: 72,
    factors: [
      { name: 'port-exposure', score: 64, weight: 0.35 },
      { name: 'vuln-findings', score: 80, weight: 0.45 },
    ],
  });
  assert.equal(res.target.id, 'acme-web');
  assert.equal(res.score, 72);
  assert.equal(res.band, 'high');
  assert.equal(res.factors.length, 2);
  assert.equal(res.modelVersion, SCORE_MODEL_VERSION);
  assert.ok(res.computedAt);
  // Round-trip through JSON — must be fully serializable.
  const roundTripped = JSON.parse(JSON.stringify(res));
  assert.deepEqual(roundTripped, res);
  const json = scoreApiToJson({ id: 't1', score: 10, factors: [] });
  assert.equal(JSON.parse(json).band, 'info');
});

/* ---------- 54304 provisional scoring ---------- */
test('54304: provisional flag stays set until every onboarding signal is present', () => {
  const partial = provisionalScore({ domainVerified: true, scopeDefined: true });
  assert.equal(partial.provisional, true);
  assert.equal(partial.missingSignals.length, ONBOARDING_SIGNALS.length - 2);
  assert.ok(partial.missingSignals.includes('asset inventory'));
  assert.ok(partial.presentSignals.includes('domain verified'));

  const full = provisionalScore({
    domainVerified: true,
    scopeDefined: true,
    assetInventory: true,
    techStack: true,
    priorReports: true,
  });
  assert.equal(full.provisional, false);
  assert.deepEqual(full.missingSignals, []);
  assert.ok(full.score > partial.score, 'more signals raise the provisional score');
});

test('54304: zero signals still produces a marked provisional score', () => {
  const none = provisionalScore({});
  assert.equal(none.provisional, true);
  assert.equal(none.score, 30);
  assert.equal(none.band, 'low');
});

/* ---------- 54305 rich-text notes editor ---------- */
test('54305: rich-text blocks build a document and render to markdown', () => {
  let doc = createRichDoc('Recon notes');
  doc = addHeading(doc, 2, 'Summary');
  doc = addParagraph(doc, 'Target looks interesting.');
  doc = addList(doc, ['a', 'b']);
  doc = addCallout(doc, 'warning', 'Careful with rate limits.');
  doc = addLink(doc, 'https://example.test', 'Target');
  const md = richDocToMarkdown(doc);
  assert.ok(md.includes('## Summary'));
  assert.ok(md.includes('- a'));
  assert.ok(md.includes('> **WARNING** — Careful with rate limits.'));
  assert.ok(md.includes('[Target](https://example.test)'));
  assert.equal(doc.blocks.length, 5);
  assert.throws(() => addCallout(doc, 'nope', 'x'), /unknown callout tone/);
});

/* ---------- 54306 markdown support ---------- */
test('54306: markdownToHtmlLite renders headings, bold/italic, lists, links, code', () => {
  const html = markdownToHtmlLite(
    '# Title\n\nHello **bold** and *italic* with `code`.\n\n- one\n- two\n\n1. first\n\n[Link](https://example.test)\n\n```js\nconst a = 1;\n```'
  );
  assert.ok(html.includes('<h1>Title</h1>'));
  assert.ok(html.includes('<strong>bold</strong>'));
  assert.ok(html.includes('<em>italic</em>'));
  assert.ok(html.includes('<code>code</code>'));
  assert.ok(html.includes('<ul>') && html.includes('<li>one</li>'));
  assert.ok(html.includes('<ol>') && html.includes('<li>first</li>'));
  assert.ok(html.includes('<a href="https://example.test"'));
  assert.ok(html.includes('<pre><code'));
  assert.ok(html.includes('const a = 1;'));
});

test('54306: raw HTML in markdown is escaped so previews cannot inject markup', () => {
  const html = markdownToHtmlLite('Note: <script>alert("xss")</script> and <img src=x onerror=y>');
  assert.ok(!html.includes('<script>'), 'script tag must not survive');
  assert.ok(html.includes('&lt;script&gt;'), 'script tag must be escaped');
  assert.ok(html.includes('&lt;img'), 'img tag must be escaped');
  const evilLink = markdownToHtmlLite('[click](javascript:alert(1))');
  assert.ok(!evilLink.includes('javascript:'), 'javascript: URLs must be neutralized');
});

/* ---------- 54307 note pinning ---------- */
test('54307: pinned notes sort first, unpin restores order', () => {
  const notes = [
    { id: 'n1', title: 'First' },
    { id: 'n2', title: 'Second' },
    { id: 'n3', title: 'Third' },
  ];
  const pinned = pinNote(notes, 'n3');
  assert.equal(pinned[0].id, 'n3');
  assert.ok(isNotePinned(pinned[0]));
  assert.ok(!isNotePinned(pinned[1]));

  const pinnedTwo = pinNote(pinned, 'n1');
  assert.equal(pinnedTwo[0].id, 'n3', 'earliest-pinned stays on top');
  assert.equal(pinnedTwo[1].id, 'n1');

  const unpinned = unpinNote(pinnedTwo, 'n3');
  assert.ok(!isNotePinned(unpinned.find((n) => n.id === 'n3')));
  assert.equal(unpinned[0].id, 'n1', 'remaining pinned note stays on top');

  const sorted = sortNotesPinnedFirst(notes);
  assert.deepEqual(sorted.map((n) => n.id), ['n1', 'n2', 'n3']);
});

/* ---------- 54308 note templates ---------- */
test('54308: noteFromTemplate produces the correct structure for every template', () => {
  for (const { key, title } of listNoteTemplates()) {
    assert.ok(['access-credentials', 'scope-caveats', 'client-contacts'].includes(key));
    const note = noteFromTemplate(key);
    assert.equal(note.title, title);
    assert.equal(note.format, 'markdown');
    assert.equal(note.template, key);
    assert.equal(note.pinned, false);
    assert.ok(note.body.startsWith(`# ${title}`));
    assert.ok(note.body.includes('## '), 'template body must contain sections');
  }
  assert.equal(noteFromTemplate('access-credentials').body.includes('## Test accounts'), true);
  assert.equal(noteFromTemplate('scope-caveats').body.includes('## Out of scope'), true);
  assert.equal(noteFromTemplate('client-contacts').body.includes('## Primary contact'), true);
  assert.throws(() => noteFromTemplate('nope'), /unknown template/);
});

/* ---------- 54309 timestamped annotations ---------- */
test('54309: annotateTimelineEvent attaches a note to a timeline event row', () => {
  const ann = annotateTimelineEvent('evt-102', 'Old build confirmed', { author: 'analyst', sequence: 7 });
  assert.equal(ann.id, 'annotation:evt-102:7');
  assert.equal(ann.eventId, 'evt-102');
  assert.equal(ann.text, 'Old build confirmed');
  assert.ok(ann.createdAt);
  const list = [ann, annotateTimelineEvent('evt-101', 'other')];
  assert.deepEqual(annotationsForEvent(list, 'evt-102').map((a) => a.id), ['annotation:evt-102:7']);
  assert.throws(() => annotateTimelineEvent('', 'x'), /eventId is required/);
  assert.throws(() => annotateTimelineEvent('e', '  '), /noteText is required/);
});

/* ---------- 54310 screenshot attachments ---------- */
test('54310: attachScreenshot embeds a data URL; oversize shots are rejected', () => {
  const note = { id: 'n1', attachments: [] };
  const small = 'data:image/png;base64,' + 'a'.repeat(100);
  const withShot = attachScreenshot(note, { dataUrl: small, caption: 'login page' });
  assert.equal(screenshotCount(withShot), 1);
  assert.equal(withShot.attachments[0].caption, 'login page');
  assert.equal(withShot.attachments[0].dataUrl, small);
  assert.equal(note.attachments.length, 0, 'original note must not be mutated');

  const huge = 'data:image/png;base64,' + 'a'.repeat(MAX_SCREENSHOT_DATAURL_BYTES + 1);
  assert.throws(() => attachScreenshot(note, { dataUrl: huge }), /too large/);
  assert.throws(() => attachScreenshot(note, { dataUrl: 'https://x/y.png' }), /image data URL/);

  const removed = removeScreenshot(withShot, withShot.attachments[0].id);
  assert.equal(screenshotCount(removed), 0);
});

/* ---------- file existence ---------- */
test('all 4 deliverable files exist', () => {
  for (const p of [corePath, jsxPath, cssPath, join(here, 'wave108C.test.js')]) {
    assert.ok(existsSync(p), `missing file: ${p}`);
  }
});

/* ---------- branding ---------- */
test('no branding leak: forbidden brand string appears in none of the wave 108C files', () => {
  const forbidden = 'Mu' + 'se'; // built without the literal string in source
  for (const p of [corePath, jsxPath, cssPath, join(here, 'wave108C.test.js')]) {
    const text = readFileSync(p, 'utf8');
    assert.ok(!text.includes(forbidden), `forbidden brand string found in ${p}`);
  }
});
