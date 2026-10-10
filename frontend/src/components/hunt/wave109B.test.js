/**
 * Wave 109B tests — annotation & capture (ideas 54331-54340).
 * Run: node --test frontend/src/components/hunt/wave109B.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const corePath = join(here, 'wave109BCore.js');
const jsxPath = join(here, 'Wave109B.jsx');
const cssPath = join(here, 'Wave109B.css');

import {
  WAVE109_B_IDEAS,
  annotateChange,
  changeAnnotationSummary,
  recordRootCause,
  incidentPostmortem,
  addShape,
  removeShape,
  serializeShapes,
  createVoiceNote,
  voiceNoteLabel,
  summarizeNotes,
  duplicateNote,
  moveNote,
  bulkExportNotes,
  printableBriefing,
  parseShortcut,
  shortcutLabel,
  isReservedShortcut,
  DEFAULT_NOTE_SHORTCUT,
} from './wave109BCore.js';

const EXPECTED_TITLES = {
  54331: 'Annotation on changes',
  54332: 'Annotation on health incidents',
  54333: 'Drawing on screenshots',
  54334: 'Voice note attachments',
  54335: 'AI note summarization',
  54336: 'Note duplication',
  54337: 'Note move between targets',
  54338: 'Bulk note export',
  54339: 'Note print view',
  54340: 'Note keyboard shortcut',
};

test('registry covers all 10 ideas with exact titles', () => {
  assert.equal(WAVE109_B_IDEAS.length, 10);
  for (const idea of WAVE109_B_IDEAS) {
    assert.equal(idea.title, EXPECTED_TITLES[idea.id], `title mismatch for ${idea.id}`);
  }
});

test('JSX and CSS companions exist, branded, no keyframes', () => {
  assert.ok(existsSync(jsxPath));
  assert.ok(existsSync(cssPath));
  const jsx = readFileSync(jsxPath, 'utf8');
  assert.ok(jsx.includes('Infinity AI'));
  assert.ok(!/Muse/i.test(jsx));
  assert.ok(!/Muse/i.test(readFileSync(corePath, 'utf8')));
  assert.ok(!/@keyframes/.test(readFileSync(cssPath, 'utf8')));
});

test('54331: change annotations validate kind and summarize counts', () => {
  const change = { id: 'c1' };
  annotateChange(change, { kind: 'investigating', text: 'checking', author: 'ana' });
  annotateChange(change, { kind: 'expected-deploy', text: 'v2.1', author: 'bob' });
  annotateChange(change, { kind: 'investigating', text: 'more', author: 'ana' });
  assert.deepEqual(changeAnnotationSummary(change), { 'expected-deploy': 1, investigating: 2, 'false-positive': 0 });
  assert.throws(() => annotateChange(change, { kind: 'nope', text: 'x' }), /kind must be/);
  assert.throws(() => annotateChange(change, { kind: 'investigating', text: '  ' }), /non-empty/);
});

test('54332: root cause + postmortem render action items', () => {
  const incident = { id: 'i1', title: 'API 500s' };
  assert.throws(() => incidentPostmortem(incident), /root cause/);
  recordRootCause(incident, { cause: 'bad deploy', author: 'ana', actionItems: [{ text: 'rollback', owner: 'ops', done: true }, { text: 'add canary' }] });
  const pm = incidentPostmortem(incident);
  assert.ok(pm.includes('# Postmortem — API 500s'));
  assert.ok(pm.includes('- [x] rollback (ops)'));
  assert.ok(pm.includes('- [ ] add canary (unassigned)'));
  assert.throws(() => recordRootCause({ id: 'x' }, { cause: '  ' }), /non-empty/);
});

test('54333: shapes validate coords/type, serialize round-trips', () => {
  const shot = { id: 's1' };
  const s = addShape(shot, { type: 'arrow', x1: 10, y1: 20, x2: 300, y2: 400, label: 'XSS sink' });
  addShape(shot, { type: 'box', x1: 0, y1: 0, x2: 100, y2: 100 });
  assert.equal(shot.shapes.length, 2);
  assert.equal(s.label, 'XSS sink');
  assert.throws(() => addShape(shot, { type: 'star', x1: 1, y1: 1, x2: 2, y2: 2 }), /type must be/);
  assert.throws(() => addShape(shot, { type: 'box', x1: -1, y1: 1, x2: 2, y2: 2 }), /0-1000/);
  const ser = serializeShapes(shot);
  assert.equal(JSON.parse(ser).length, 2);
  assert.ok(removeShape(shot, s.id));
  assert.equal(shot.shapes.length, 1);
  assert.equal(removeShape(shot, 'missing'), false);
});

test('54334: voice notes cap at 120s and label formats mm:ss', () => {
  const vn = createVoiceNote({ noteId: 'n1', author: 'ana', durationSec: 75 });
  assert.equal(vn.durationSec, 75);
  assert.equal(voiceNoteLabel(75), '1:15');
  assert.equal(voiceNoteLabel(9), '0:09');
  assert.throws(() => createVoiceNote({ durationSec: 121 }), /max/);
  assert.throws(() => createVoiceNote({ durationSec: 0 }), /positive/);
});

test('54335: summarizer is deterministic and picks content sentences', () => {
  const notes = [
    { body: 'The login endpoint reflects the username parameter without encoding. This is a reflected XSS.' },
    { body: 'Subdomain enum found 42 hosts. Most returned 403 from the WAF.' },
  ];
  const r1 = summarizeNotes(notes, { maxSentences: 2 });
  const r2 = summarizeNotes(notes, { maxSentences: 2 });
  assert.equal(r1.summary, r2.summary);
  assert.equal(r1.noteCount, 2);
  assert.ok(r1.sentenceCount >= 1 && r1.sentenceCount <= 2);
  assert.equal(summarizeNotes([], {}).summary, '');
});

test('54336/54337: duplicate clones to new target, move preserves history', () => {
  const note = { id: 'n1', targetId: 't1', author: 'ana', title: 'T', body: 'B', status: 'active', history: [{ at: 'x', by: 'a', event: 'created' }] };
  const dup = duplicateNote(note, { targetId: 't2', author: 'bob' });
  assert.notEqual(dup.id, 'n1');
  assert.equal(dup.targetId, 't2');
  assert.equal(dup.author, 'bob');
  assert.equal(dup.body, 'B');
  assert.ok(dup.history.some((h) => h.event === 'duplicated-from' && h.sourceId === 'n1'));
  assert.throws(() => duplicateNote(note, {}), /targetId/);
  const moved = moveNote(note, 't3');
  assert.equal(moved.targetId, 't3');
  assert.ok(moved.history.some((h) => h.event === 'moved' && h.from === 't1' && h.to === 't3'));
  assert.throws(() => moveNote(note), /newTargetId/);
});

test('54338: bulk export filters by targets and supports json', () => {
  const notes = [
    { targetId: 't1', status: 'active', title: 'A', body: 'a' },
    { targetId: 't2', status: 'active', title: 'B', body: 'b' },
    { targetId: 't2', status: 'trashed', title: 'C', body: 'c' },
  ];
  const md = bulkExportNotes(notes, { targetIds: ['t2'] });
  assert.equal(md.count, 1);
  assert.equal(md.filename, 'dark-matter-notes-bulk.md');
  const js = bulkExportNotes(notes, { format: 'json' });
  assert.equal(js.count, 2);
  assert.equal(JSON.parse(js.data).length, 2);
});

test('54339: printable briefing renders title and skips trashed', () => {
  const notes = [
    { targetId: 't1', status: 'active', title: 'A', body: 'a' },
    { targetId: 't1', status: 'trashed', title: 'B', body: 'b' },
  ];
  const b = printableBriefing(notes, { title: 'Weekly brief' });
  assert.equal(b.noteCount, 1);
  assert.ok(b.text.startsWith('Weekly brief'));
  assert.ok(b.text.includes('Infinity AI'));
});

test('54340: shortcut parse/label/reserved behave', () => {
  assert.deepEqual(parseShortcut(DEFAULT_NOTE_SHORTCUT), { ctrl: true, shift: true, alt: false, key: 'n' });
  assert.equal(shortcutLabel({ ctrl: true, shift: false, alt: false, key: 'n' }), 'ctrl+n');
  assert.ok(isReservedShortcut('ctrl+t'));
  assert.ok(!isReservedShortcut(DEFAULT_NOTE_SHORTCUT));
  assert.throws(() => parseShortcut('ctrl'), /no key/);
  assert.throws(() => parseShortcut('ctrl+a+b'), /ambiguous/);
});
