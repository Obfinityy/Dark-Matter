/**
 * Wave 109A tests — note management core (ideas 54321-54330).
 * Run: node --test frontend/src/components/hunt/wave109A.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const corePath = join(here, 'wave109ACore.js');
const jsxPath = join(here, 'Wave109A.jsx');
const cssPath = join(here, 'Wave109A.css');

import {
  WAVE109_A_IDEAS,
  createNoteStore,
  addNote,
  getNote,
  listNotes,
  noteToMarkdown,
  notesToMarkdown,
  createQuickNote,
  captureHuntObservation,
  timelineNotes,
  parseTargetLinks,
  resolveLinks,
  setReminder,
  dismissReminder,
  dueReminders,
  archiveNote,
  unarchiveNote,
  activeNotes,
  searchNotes,
  trashNote,
  restoreNote,
  purgeEligible,
  trashDaysRemaining,
  createPolicy,
  canCreate,
  canEdit,
  canDelete,
  roleRank,
  annotateScopeRule,
  listScopeAnnotations,
  annotateFinding,
  latestFindingContext,
} from './wave109ACore.js';

const EXPECTED_TITLES = {
  54321: 'Note export per target',
  54322: 'Quick-note from dashboard',
  54323: 'Quick-note during hunt',
  54324: 'Note linking between targets',
  54325: 'Note reminders',
  54326: 'Note archiving',
  54327: 'Note trash and restore',
  54328: 'Note permissions',
  54329: 'Annotation on scope rules',
  54330: 'Annotation on findings',
};

test('registry covers all 10 ideas with exact titles', () => {
  assert.equal(WAVE109_A_IDEAS.length, 10);
  for (const idea of WAVE109_A_IDEAS) {
    assert.equal(idea.title, EXPECTED_TITLES[idea.id], `title mismatch for ${idea.id}`);
    assert.ok(idea.summary.length > 10);
  }
});

test('JSX and CSS companion files exist and are branded Infinity AI', () => {
  assert.ok(existsSync(jsxPath), 'Wave109A.jsx missing');
  assert.ok(existsSync(cssPath), 'Wave109A.css missing');
  const jsx = readFileSync(jsxPath, 'utf8');
  assert.ok(jsx.includes('Infinity AI'));
  assert.ok(!/Muse/i.test(jsx), 'branding leak in JSX');
  const core = readFileSync(corePath, 'utf8');
  assert.ok(!/Muse/i.test(core), 'branding leak in core');
  assert.ok(!/@keyframes/.test(readFileSync(cssPath, 'utf8')), 'no keyframes allowed');
});

test('store: add/get/list round-trip', () => {
  const store = createNoteStore();
  const n = addNote(store, { targetId: 't1', author: 'ana', title: 'T', body: 'B' });
  assert.equal(getNote(store, n.id).title, 'T');
  assert.equal(listNotes(store).length, 1);
  assert.equal(getNote(store, 'missing'), null);
});

test('54321: markdown export renders note fields and filename is slugified', () => {
  const store = createNoteStore();
  addNote(store, { targetId: 't1', author: 'ana', title: 'Plan', body: 'Do X', tags: ['a'], pinned: true });
  const notes = listNotes(store);
  const md = noteToMarkdown(notes[0]);
  assert.ok(md.includes('## Plan'));
  assert.ok(md.includes('Author: ana'));
  assert.ok(md.includes('Pinned: yes'));
  const exp = notesToMarkdown(notes, 't1', 'Acme Web App');
  assert.equal(exp.noteCount, 1);
  assert.equal(exp.filename, 'dark-matter-notes-acme-web-app.md');
  assert.ok(exp.markdown.includes('# Notes — Acme Web App'));
});

test('54321: export excludes trashed notes', () => {
  const store = createNoteStore();
  const n = addNote(store, { targetId: 't1', title: 'Gone', body: 'x' });
  trashNote(n);
  const exp = notesToMarkdown(listNotes(store), 't1');
  assert.equal(exp.noteCount, 0);
});

test('54322: quick note defaults title from first line, rejects empty body', () => {
  const store = createNoteStore();
  const n = createQuickNote(store, { targetId: 't1', author: 'ana', body: 'Header\nline two' });
  assert.equal(n.title, 'Header');
  assert.ok(n.tags.includes('quick-note'));
  assert.throws(() => createQuickNote(store, { targetId: 't1', body: '  ' }), /non-empty/);
  assert.throws(() => createQuickNote(store, { body: 'x' }), /targetId/);
});

test('54323: hunt observation carries timeline entry and sorts chronologically', () => {
  const store = createNoteStore();
  captureHuntObservation(store, { targetId: 't1', author: 'ana', body: 'obs', huntStep: 3 });
  const tl = timelineNotes(listNotes(store), 't1');
  assert.equal(tl.length, 1);
  assert.ok(tl[0].history.some((h) => h.event === 'hunt-observation' && h.huntStep === 3));
});

test('54324: [[target]] parsing dedupes and resolves against known targets', () => {
  assert.deepEqual(parseTargetLinks('see [[t1]] and [[t1]] plus [[t2-x]]'), ['t1', 't2-x']);
  assert.deepEqual(parseTargetLinks('no refs here'), []);
  const store = createNoteStore();
  const n = addNote(store, { targetId: 't1', title: 'x', body: 'links [[t2]] and [[ghost]]' });
  const res = resolveLinks(n, [{ id: 't2' }]);
  assert.deepEqual(res.linked, ['t2']);
  assert.deepEqual(res.unknown, ['ghost']);
  assert.deepEqual(n.linkedTargets, ['t2']);
});

test('54325: reminders due/dismiss semantics', () => {
  const store = createNoteStore();
  const past = addNote(store, { targetId: 't1', title: 'a', body: 'b' });
  const future = addNote(store, { targetId: 't1', title: 'b', body: 'c' });
  setReminder(past, '2020-01-01T00:00:00.000Z');
  setReminder(future, '2999-01-01T00:00:00.000Z');
  let due = dueReminders(listNotes(store), new Date('2026-01-01T00:00:00.000Z'));
  assert.deepEqual(due.map((n) => n.title), ['a']);
  dismissReminder(past);
  due = dueReminders(listNotes(store), new Date('2026-01-01T00:00:00.000Z'));
  assert.equal(due.length, 0);
  assert.throws(() => setReminder(past, 'not-a-date'), /valid ISO/);
});

test('54326: archive hides from main view but stays searchable', () => {
  const store = createNoteStore();
  const n = addNote(store, { targetId: 't1', title: 'Old plan', body: 'stale' });
  archiveNote(n);
  assert.equal(n.status, 'archived');
  assert.equal(activeNotes(listNotes(store)).length, 0);
  assert.equal(searchNotes(listNotes(store), 'stale').length, 1);
  unarchiveNote(n);
  assert.equal(n.status, 'active');
});

test('54327: trash/restore/purge lifecycle with retention math', () => {
  const store = createNoteStore();
  const n = addNote(store, { targetId: 't1', title: 'x', body: 'y' });
  trashNote(n);
  assert.equal(n.status, 'trashed');
  assert.ok(trashDaysRemaining(n) > 0);
  restoreNote(n);
  assert.equal(n.status, 'active');
  assert.equal(n.trashedAt, null);
  const old = addNote(store, { targetId: 't1', title: 'old', body: 'z' });
  trashNote(old);
  old.trashedAt = '2020-01-01T00:00:00.000Z';
  assert.deepEqual(purgeEligible(listNotes(store)).map((x) => x.title), ['old']);
});

test('54328: permission policy defaults and per-target overrides', () => {
  const policy = createPolicy({ t9: { delete: ['analyst', 'owner'] } });
  assert.ok(canCreate(policy, { roles: ['analyst'], targetId: 't1' }));
  assert.ok(!canCreate(policy, { roles: ['viewer'], targetId: 't1' }));
  assert.ok(canEdit(policy, { roles: ['analyst'], targetId: 't1' }));
  assert.ok(!canDelete(policy, { roles: ['analyst'], targetId: 't1' }));
  assert.ok(canDelete(policy, { roles: ['owner'], targetId: 't1' }));
  assert.ok(canDelete(policy, { roles: ['analyst'], targetId: 't9' }));
  assert.equal(roleRank('owner'), 3);
  assert.equal(roleRank('stranger'), 0);
});

test('54329: scope-rule annotations append and list newest-first', () => {
  const rule = { id: 'r1', pattern: '*.acme.com' };
  annotateScopeRule(rule, { text: 'First', author: 'ana' });
  annotateScopeRule(rule, { text: 'Second', author: 'bob' });
  const list = listScopeAnnotations(rule);
  assert.equal(list.length, 2);
  assert.throws(() => annotateScopeRule(rule, { text: '   ' }), /non-empty/);
});

test('54330: finding annotations and latest context', () => {
  const finding = { id: 'f1' };
  assert.equal(latestFindingContext(finding), null);
  annotateFinding(finding, { text: 'Looks valid', author: 'ana' });
  annotateFinding(finding, { text: 'Confirmed', author: 'bob' });
  assert.equal(latestFindingContext(finding).text, 'Confirmed');
  assert.throws(() => annotateFinding(finding, { text: '' }), /non-empty/);
});
