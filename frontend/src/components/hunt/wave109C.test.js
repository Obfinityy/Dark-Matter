/**
 * Wave 109C tests — note collaboration (ideas 54341-54350).
 * Run: node --test frontend/src/components/hunt/wave109C.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const corePath = join(here, 'wave109CCore.js');
const jsxPath = join(here, 'Wave109C.jsx');
const cssPath = join(here, 'Wave109C.css');

import {
  WAVE109_C_IDEAS,
  wordCount,
  readingTimeSec,
  noteStats,
  isRecentlyEdited,
  recentlyEdited,
  createSession,
  joinSession,
  leaveSession,
  activeCursors,
  hasConflict,
  resolveConflict,
  apiCreateNote,
  parseApiFilters,
  apiNoteList,
  apiNoteToResponse,
  logActivity,
  activitySummary,
  translateNote,
  bestText,
  pinnedDigest,
  createTemplate,
  applyTemplate,
  bumpTemplateVersion,
  staleNotePrompts,
  nextPromptDate,
} from './wave109CCore.js';

const EXPECTED_TITLES = {
  54341: 'Note word count',
  54342: 'Last-edited indicator',
  54343: 'Collaborative editing',
  54344: 'Edit conflict resolution',
  54345: 'Notes API',
  54346: 'Note activity log',
  54347: 'Note translation',
  54348: 'Pinned-note digest',
  54349: 'Note templates library',
  54350: 'Scheduled note prompts',
};

test('registry covers all 10 ideas with exact titles', () => {
  assert.equal(WAVE109_C_IDEAS.length, 10);
  for (const idea of WAVE109_C_IDEAS) {
    assert.equal(idea.title, EXPECTED_TITLES[idea.id], `title mismatch for ${idea.id}`);
  }
});

test('JSX and CSS companions exist, branded, no keyframes', () => {
  assert.ok(existsSync(jsxPath));
  assert.ok(existsSync(cssPath));
  assert.ok(readFileSync(jsxPath, 'utf8').includes('Infinity AI'));
  assert.ok(!/Muse/i.test(readFileSync(jsxPath, 'utf8')));
  assert.ok(!/Muse/i.test(readFileSync(corePath, 'utf8')));
  assert.ok(!/@keyframes/.test(readFileSync(cssPath, 'utf8')));
});

test('54341: word count, reading time, stats', () => {
  assert.equal(wordCount('one two three'), 3);
  assert.equal(wordCount('  '), 0);
  assert.equal(wordCount('abc 123 !@#'), 2);
  assert.equal(readingTimeSec('x'.repeat(10)), 1);
  const s = noteStats({ body: 'one two three four' });
  assert.deepEqual(s, { words: 4, chars: 18, readingSec: 2 });
});

test('54342: recent-edited detection with 24h window', () => {
  const now = new Date('2026-10-10T12:00:00.000Z');
  const fresh = { updatedAt: '2026-10-10T06:00:00.000Z' };
  const stale = { updatedAt: '2026-10-08T06:00:00.000Z' };
  assert.ok(isRecentlyEdited(fresh, now));
  assert.ok(!isRecentlyEdited(stale, now));
  const ordered = recentlyEdited([stale, fresh], now);
  assert.deepEqual(ordered.map((n) => n.updatedAt), [fresh.updatedAt, stale.updatedAt].slice(0, 1));
});

test('54343: presence join/update/leave and cursor visibility', () => {
  const s = createSession('n1');
  joinSession(s, { userId: 'u1', userName: 'Ana', cursor: { line: 3, col: 7 } });
  joinSession(s, { userId: 'u2', userName: 'Bob' });
  assert.equal(activeCursors(s, 'u1').length, 1);
  assert.equal(activeCursors(s, 'u1')[0].userName, 'Bob');
  assert.throws(() => joinSession(s, {}), /userId/);
  assert.ok(leaveSession(s, 'u2'));
  assert.equal(activeCursors(s).length, 1);
  assert.equal(leaveSession(s, 'ghost'), false);
});

test('54344: conflict detection and resolution strategies', () => {
  const base = { body: 'A', rev: 1 };
  const local = { body: 'A edited by me', rev: 2, author: 'ana', updatedAt: '2026-10-10T10:00:00.000Z' };
  const remote = { body: 'A edited by peer', rev: 2, author: 'bob', updatedAt: '2026-10-10T11:00:00.000Z' };
  assert.ok(hasConflict(base, local, remote));
  assert.ok(!hasConflict(base, { body: 'x', rev: 1 }, remote));
  const nw = resolveConflict(base, local, remote, 'newest-wins');
  assert.equal(nw.body, 'A edited by peer');
  assert.equal(nw.conflict, false);
  const mm = resolveConflict(base, local, remote, 'manual-merge');
  assert.ok(mm.body.includes('<<<<<<< local'));
  assert.ok(mm.body.includes('>>>>>>> remote'));
  assert.equal(mm.conflict, true);
});

test('54345: Notes API payload validation, filters, response shape', () => {
  const p = apiCreateNote({ targetId: 't1', title: 'T', body: 'B', tags: ['x'] });
  assert.equal(p.author, 'api');
  assert.throws(() => apiCreateNote({ targetId: 't1', title: 'T' }), /body/);
  const f = parseApiFilters({ targetId: 't1', limit: '5', status: 'bogus' });
  assert.deepEqual(f, { targetId: 't1', tag: null, status: null, limit: 5 });
  const notes = [
    { id: '1', targetId: 't1', title: 'A', body: 'a', tags: ['x'], status: 'active', pinned: false, createdAt: 'c', updatedAt: 'u' },
    { id: '2', targetId: 't2', title: 'B', body: 'b', tags: [], status: 'active', pinned: false, createdAt: 'c', updatedAt: 'u' },
  ];
  assert.equal(apiNoteList(notes, { targetId: 't1', limit: 50 }).length, 1);
  assert.deepEqual(Object.keys(apiNoteToResponse(notes[0])).sort(), ['author', 'body', 'createdAt', 'id', 'pinned', 'status', 'tags', 'targetId', 'title', 'updatedAt'].sort());
});

test('54346: activity log entries and summary counts', () => {
  const note = {};
  logActivity(note, { action: 'view', actor: 'ana' });
  logActivity(note, { action: 'edit', actor: 'ana' });
  logActivity(note, { action: 'view', actor: 'bob' });
  assert.deepEqual(activitySummary(note), { view: 2, edit: 1, share: 0 });
  assert.throws(() => logActivity(note, { action: 'nuke' }), /action must be/);
});

test('54347: translation stored beside original, bestText falls back', () => {
  const note = { body: 'Rotate creds monthly.' };
  assert.equal(bestText(note, 'hi'), 'Rotate creds monthly.');
  translateNote(note, { lang: 'hi', text: 'क्रेडेंशियल मासिक घुमाएँ।', translator: 'auto' });
  assert.equal(bestText(note, 'hi'), 'क्रेडेंशियल मासिक घुमाएँ।');
  assert.equal(bestText(note, 'HI'), 'क्रेडेंशियल मासिक घुमाएँ।');
  assert.equal(note.translations.hi.translator, 'auto');
  assert.throws(() => translateNote(note, { lang: '', text: 'x' }), /lang/);
});

test('54348: pinned digest filters by recency and recipients', () => {
  const notes = [
    { pinned: true, status: 'active', title: 'A', body: 'aaa', targetId: 't1', updatedAt: '2026-10-09T00:00:00.000Z' },
    { pinned: true, status: 'active', title: 'B', body: 'bbb', targetId: 't2', updatedAt: '2026-09-01T00:00:00.000Z' },
    { pinned: false, status: 'active', title: 'C', body: 'ccc', targetId: 't1', updatedAt: '2026-10-09T00:00:00.000Z' },
  ];
  const d = pinnedDigest(notes, { since: '2026-10-01T00:00:00.000Z', recipients: ['owner@x'] });
  assert.equal(d.noteCount, 1);
  assert.ok(d.body.includes('A [t1]'));
  assert.deepEqual(d.recipients, ['owner@x']);
  const empty = pinnedDigest([], {});
  assert.equal(empty.noteCount, 0);
  assert.ok(empty.body.includes('No pinned notes'));
});

test('54349: templates apply {{vars}}, missing vars stay, version bumps', () => {
  const t = createTemplate({ name: 'Handoff', body: 'Target: {{target}}\nOwner: {{owner}}' });
  assert.equal(t.version, 1);
  assert.equal(applyTemplate(t, { target: 'acme' }), 'Target: acme\nOwner: {{owner}}');
  const t2 = bumpTemplateVersion(t, 'Target: {{target}}');
  assert.equal(t2.version, 2);
  assert.equal(t.version, 1);
  assert.throws(() => createTemplate({ name: '  ' }), /name/);
});

test('54350: stale prompts sorted stalest-first, next date math', () => {
  const now = new Date('2026-10-10T00:00:00.000Z');
  const notes = [
    { id: '1', status: 'active', title: 'Old', author: 'ana', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: '2', status: 'active', title: 'New', author: 'bob', updatedAt: '2026-10-09T00:00:00.000Z' },
    { id: '3', status: 'archived', title: 'Arch', author: 'ana', updatedAt: '2026-01-01T00:00:00.000Z' },
  ];
  const prompts = staleNotePrompts(notes, now, 30);
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].title, 'Old');
  assert.ok(prompts[0].daysStale > 30);
  const next = nextPromptDate('2026-10-10T00:00:00.000Z', 30);
  assert.equal(next.slice(0, 10), '2026-11-09');
});
