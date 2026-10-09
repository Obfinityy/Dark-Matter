/**
 * Wave 108D tests — notes & collaboration workspace (ideas 54311-54320).
 * Run: node --test frontend/src/components/hunt/wave108D.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const corePath = join(here, 'wave108DCores.js');
const jsxPath = join(here, 'Wave108D.jsx');
const cssPath = join(here, 'Wave108D.css');

import {
  WAVE108_D_IDEAS,
  ATTACHMENT_ALLOWLIST,
  MAX_ATTACHMENT_BYTES,
  createNote,
  attachFile,
  canAccess,
  createSnippet,
  escapeHtml,
  tokenizeSnippet,
  checklistFromLines,
  toggleChecklistItem,
  checklistProgress,
  parseMentions,
  buildMentionNotifications,
  addComment,
  resolveComment,
  saveRevision,
  restoreRevision,
  revisionDiff,
  searchNotes,
  tagNote,
  untagNote,
  filterNotesByTag,
  normalizeTag,
  setVisibility,
  canView,
  relativeTime,
  authorshipLine,
} from './wave108DCores.js';

const EXPECTED_TITLES = {
  54311: 'File attachments',
  54312: 'Code snippet blocks',
  54313: 'Checklists inside notes',
  54314: '@mentions in notes',
  54315: 'Note comment threads',
  54316: 'Note version history',
  54317: 'Full-text note search',
  54318: 'Note tags',
  54319: 'Private vs shared notes',
  54320: 'Note authorship display',
};

function sampleNote(overrides = {}) {
  return createNote({
    id: 'note-t1',
    title: 'Scope letter',
    body: 'In scope: *.acme.example\nOut of scope: payments.',
    authorId: 'u-ana',
    authorName: 'Ana',
    now: '2026-10-09T10:00:00.000Z',
    ...overrides,
  });
}

const ANA = { id: 'u-ana', handle: 'ana', name: 'Ana', roles: ['analyst'] };
const RAJ = { id: 'u-raj', handle: 'raj', name: 'Raj', roles: ['analyst', 'lead'] };
const GUEST = { id: 'u-guest', handle: 'guest', name: 'Guest', roles: [] };

/* ---------- idea registry ---------- */
test('WAVE108_D_IDEAS has exactly 10 entries, ids 54311-54320, titles matching the idea bank', () => {
  assert.equal(WAVE108_D_IDEAS.length, 10);
  const ids = WAVE108_D_IDEAS.map((i) => i.id);
  for (let id = 54311; id <= 54320; id += 1) {
    assert.ok(ids.includes(id), `missing id ${id}`);
  }
  for (const idea of WAVE108_D_IDEAS) {
    assert.equal(idea.title, EXPECTED_TITLES[idea.id], `title mismatch for ${idea.id}`);
  }
});

/* ---------- 54311 file attachments ---------- */
test('54311: attachFile accepts allowlisted types and rejects .exe', () => {
  const note = sampleNote();
  const { note: withPdf, attachment } = attachFile(note, { name: 'scope-letter.pdf', mime: 'application/pdf', size: 1024 });
  assert.equal(withPdf.attachments.length, 1);
  assert.equal(attachment.ext, 'pdf');
  assert.equal(attachment.name, 'scope-letter.pdf');
  const { note: withConf } = attachFile(withPdf, { name: 'client.ovpn', size: 900 });
  assert.equal(withConf.attachments.length, 2);
  assert.throws(() => attachFile(note, { name: 'payload.exe', size: 100 }), /not allowed/);
  assert.throws(() => attachFile(note, { name: 'run.sh', size: 100 }), /not allowed/);
  assert.throws(() => attachFile(note, { name: 'noextension', size: 100 }), /not allowed/);
});

test('54311: attachFile enforces the size guard', () => {
  const note = sampleNote();
  assert.throws(
    () => attachFile(note, { name: 'big.pdf', size: MAX_ATTACHMENT_BYTES + 1 }),
    /too large/
  );
  const { attachment } = attachFile(note, { name: 'ok.pdf', size: MAX_ATTACHMENT_BYTES });
  assert.equal(attachment.size, MAX_ATTACHMENT_BYTES);
});

test('54311: canAccess honors role-based access controls', () => {
  const note = sampleNote();
  const { attachment: open } = attachFile(note, { name: 'a.pdf', size: 10, access: { level: 'anyone' } });
  const { attachment: restricted } = attachFile(note, { name: 'b.pdf', size: 10, access: { level: 'roles', roles: ['lead'] } });
  assert.equal(canAccess(open, GUEST), true);
  assert.equal(canAccess(open, null), true);
  assert.equal(canAccess(restricted, RAJ), true);
  assert.equal(canAccess(restricted, ANA), false);
  assert.equal(canAccess(restricted, null), false);
  assert.ok(ATTACHMENT_ALLOWLIST.includes('ovpn'));
});

/* ---------- 54312 code snippet blocks ---------- */
test('54312: createSnippet escapes HTML so injected markup cannot execute', () => {
  const snippet = createSnippet('curl', 'curl https://x.example/?q=<script>alert(1)</script>');
  assert.equal(snippet.language, 'curl');
  assert.ok(!snippet.escapedHtml.includes('<script>'));
  assert.ok(snippet.escapedHtml.includes('&lt;script&gt;'));
  assert.equal(escapeHtml('<a href="x">&\'y\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;y&#39;&lt;/a&gt;');
  assert.throws(() => createSnippet('cobol', 'code'), /unsupported language/);
  assert.throws(() => createSnippet('bash', ''), /code is required/);
});

test('54312: tokenizeSnippet tags comments, strings, flags and keywords', () => {
  const tokens = tokenizeSnippet('curl --data \'{"a":1}\' # send it', 'curl');
  const kinds = tokens.map((t) => t.kind);
  assert.ok(kinds.includes('keyword'), 'expected a keyword token');
  assert.ok(kinds.includes('flag'), 'expected a flag token');
  assert.ok(kinds.includes('string'), 'expected a string token');
  assert.ok(kinds.includes('comment'), 'expected a comment token');
  const joined = tokens.map((t) => t.text).join('');
  assert.equal(joined, 'curl --data \'{"a":1}\' # send it');
});

/* ---------- 54313 checklists ---------- */
test('54313: checklistFromLines skips blanks; toggle flips; progress math is exact', () => {
  const list = checklistFromLines(['Provision VPN', '', '  ', 'Create accounts', 'Rotate keys']);
  assert.equal(list.length, 3);
  assert.equal(list[0].id, 'item:1');
  assert.equal(list[0].done, false);
  let toggled = toggleChecklistItem(list, 'item:1');
  toggled = toggleChecklistItem(toggled, 'item:2');
  assert.equal(toggled[0].done, true);
  assert.equal(checklistProgress(toggled), 67); // 2 of 3
  assert.equal(checklistProgress(list), 0);
  assert.equal(checklistProgress([]), 0);
  assert.equal(checklistProgress(toggleChecklistItem(toggleChecklistItem(list, 'item:1'), 'item:3')), 67);
  assert.throws(() => toggleChecklistItem(list, 'item:99'), /not found/);
});

test('54313: checklistProgress hits 100 when every item is done', () => {
  let list = checklistFromLines(['a', 'b', 'c', 'd']);
  for (const item of list) list = toggleChecklistItem(list, item.id);
  assert.equal(checklistProgress(list), 100);
});

/* ---------- 54314 @mentions ---------- */
test('54314: parseMentions extracts unique handles in order', () => {
  assert.deepEqual(parseMentions('ping @ana and @raj-2, also @ana.'), ['@ana', '@raj-2']);
  assert.deepEqual(parseMentions('no mentions here'), []);
  assert.deepEqual(parseMentions('@lead: kickoff at 10'), ['@lead']);
});

test('54314: buildMentionNotifications links mentions to teammate inboxes', () => {
  const note = sampleNote({ body: 'Please review this, @raj — @ana already approved.' });
  const notifications = buildMentionNotifications(note, [ANA, RAJ, GUEST]);
  assert.equal(notifications.length, 2);
  const ids = notifications.map((n) => n.userId);
  assert.ok(ids.includes('u-raj'));
  assert.ok(ids.includes('u-ana'));
  const forRaj = notifications.find((n) => n.userId === 'u-raj');
  assert.equal(forRaj.noteId, 'note-t1');
  assert.ok(forRaj.message.includes('mentioned'));
  assert.ok(forRaj.excerpt.includes('@raj'));
});

/* ---------- 54315 comment threads ---------- */
test('54315: addComment appends to the thread; resolveComment marks it resolved', () => {
  let note = sampleNote();
  note = addComment(note, { author: 'Ana', body: 'Tunnel is up.' });
  note = addComment(note, { author: 'Raj', body: 'Ack.', parentId: note.comments[0].id });
  assert.equal(note.comments.length, 2);
  assert.equal(note.comments[1].parentId, note.comments[0].id);
  assert.equal(note.comments[0].resolved, false);
  note = resolveComment(note, note.comments[0].id, 'Raj');
  assert.equal(note.comments[0].resolved, true);
  assert.equal(note.comments[0].resolvedBy, 'Raj');
  assert.ok(note.comments[0].resolvedAt);
  assert.throws(() => resolveComment(note, 'comment:nope', 'Raj'), /not found/);
  assert.throws(() => addComment(note, { author: '', body: 'x' }), /author is required/);
});

/* ---------- 54316 version history ---------- */
test('54316: saveRevision archives the old body and records authorship', () => {
  let note = sampleNote();
  note = saveRevision(note, 'Line one\nLine two edited', 'Raj');
  assert.equal(note.body, 'Line one\nLine two edited');
  assert.equal(note.revisions.length, 1);
  assert.equal(note.revisions[0].body, 'In scope: *.acme.example\nOut of scope: payments.');
  assert.equal(note.lastEditedBy, 'Raj');
  assert.throws(() => saveRevision(note, 42, 'Raj'), /newBody must be a string/);
});

test('54316: restoreRevision returns the old body and stays reversible', () => {
  let note = sampleNote();
  note = saveRevision(note, 'new body here', 'Raj');
  const revId = note.revisions[0].id;
  const { note: restored, restored: target } = restoreRevision(note, revId, 'Ana');
  assert.equal(target.id, revId);
  assert.equal(restored.body, 'In scope: *.acme.example\nOut of scope: payments.');
  assert.equal(restored.restoredFrom, revId);
  // the pre-restore body is archived, so the restore itself can be undone
  assert.equal(restored.revisions.length, 2);
  assert.equal(restored.revisions[1].body, 'new body here');
  assert.throws(() => restoreRevision(note, 'rev:nope', 'Ana'), /revision not found/);
});

test('54316: revisionDiff reports added and removed lines', () => {
  const diff = revisionDiff('a\nb\nc', 'a\nB\nc\nd');
  assert.deepEqual(diff.removed, ['b']);
  assert.deepEqual(diff.added, ['B', 'd']);
  assert.equal(diff.addedCount, 2);
  assert.equal(diff.removedCount, 1);
  assert.ok(diff.segments.some((s) => s.type === 'same' && s.line === 'a'));
  const identical = revisionDiff('x\ny', 'x\ny');
  assert.equal(identical.addedCount, 0);
  assert.equal(identical.removedCount, 0);
});

/* ---------- 54317 full-text search ---------- */
test('54317: searchNotes ranks title matches first and wraps hits in <<markers>>', () => {
  const notes = [
    sampleNote({ id: 'n1', title: 'VPN hunt', body: 'nothing relevant here' }),
    sampleNote({ id: 'n2', title: 'Other', body: 'the vpn config lives in this note body' }),
  ];
  const hits = searchNotes(notes, 'vpn');
  assert.equal(hits.length, 2);
  assert.equal(hits[0].note.id, 'n1'); // title match outranks body match
  assert.equal(hits[0].field, 'title');
  assert.ok(hits[0].snippet.includes('<<VPN>>'), `snippet was: ${hits[0].snippet}`);
  assert.ok(hits[1].snippet.includes('<<vpn>>'));
  assert.deepEqual(searchNotes(notes, ''), []);
  assert.deepEqual(searchNotes(notes, 'zzz-no-match'), []);
});

test('54317: searchNotes also matches tags', () => {
  const note = tagNote(sampleNote({ id: 'n3', title: 'Creds', body: 'body' }), 'credential');
  const hits = searchNotes([note], 'credential');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].field, 'tags');
});

/* ---------- 54318 note tags ---------- */
test('54318: tagNote normalizes and de-duplicates; filterNotesByTag is case-insensitive', () => {
  let note = sampleNote();
  note = tagNote(note, 'Credential');
  note = tagNote(note, 'credential');
  note = tagNote(note, ' VPN Access ');
  assert.deepEqual(note.tags, ['credential', 'vpn-access']);
  const other = tagNote(sampleNote({ id: 'n4' }), 'scope');
  assert.deepEqual(filterNotesByTag([note, other], 'CREDENTIAL').map((n) => n.id), ['note-t1']);
  assert.deepEqual(filterNotesByTag([note, other], 'missing'), []);
  assert.equal(normalizeTag('  Scope Letter '), 'scope-letter');
  note = untagNote(note, 'credential');
  assert.deepEqual(note.tags, ['vpn-access']);
  assert.throws(() => tagNote(note, '   '), /tag is required/);
});

/* ---------- 54319 private vs shared ---------- */
test('54319: private notes are hidden from other users but visible to the author', () => {
  let note = setVisibility(sampleNote(), 'private');
  assert.equal(note.visibility.mode, 'private');
  assert.equal(canView(note, ANA), true);
  assert.equal(canView(note, RAJ), false);
  assert.equal(canView(note, null), false);
  assert.throws(() => setVisibility(note, 'secret'), /invalid visibility/);
});

test('54319: shared notes honor optional role restrictions', () => {
  const open = setVisibility(sampleNote(), 'shared');
  assert.equal(canView(open, GUEST), true);
  const leadsOnly = setVisibility(sampleNote(), 'shared', ['lead']);
  assert.equal(canView(leadsOnly, RAJ), true);
  assert.equal(canView(leadsOnly, ANA), false);
  assert.equal(canView(leadsOnly, null), false);
});

/* ---------- 54320 authorship ---------- */
test('54320: relativeTime covers the just-now / minutes / hours / days buckets', () => {
  const now = new Date('2026-10-10T12:00:00.000Z');
  assert.equal(relativeTime('2026-10-10T11:59:30.000Z', now), 'just now');
  assert.equal(relativeTime('2026-10-10T11:55:00.000Z', now), '5m ago');
  assert.equal(relativeTime('2026-10-10T10:00:00.000Z', now), '2h ago');
  assert.equal(relativeTime('2026-10-07T12:00:00.000Z', now), '3d ago');
  assert.equal(relativeTime('2026-09-20T12:00:00.000Z', now), '2w ago');
  assert.equal(relativeTime('2026-01-01T00:00:00.000Z', now), '2026-01-01');
});

test('54320: authorshipLine shows writer and last editor with a relative timestamp', () => {
  const now = new Date('2026-10-10T12:00:00.000Z');
  let note = sampleNote();
  assert.equal(
    authorshipLine({ ...note, createdAt: '2026-10-10T10:00:00.000Z', updatedAt: '2026-10-10T10:00:00.000Z' }, now),
    'Written by Ana · 2h ago'
  );
  note = saveRevision(
    { ...note, createdAt: '2026-10-10T10:00:00.000Z', updatedAt: '2026-10-10T10:00:00.000Z' },
    'edited body',
    'Raj'
  );
  assert.equal(
    authorshipLine({ ...note, updatedAt: '2026-10-10T11:55:00.000Z' }, now),
    'Written by Ana · edited by Raj 5m ago'
  );
});

/* ---------- file existence ---------- */
test('all 4 deliverable files exist', () => {
  for (const p of [corePath, jsxPath, cssPath, join(here, 'wave108D.test.js')]) {
    assert.ok(existsSync(p), `missing file: ${p}`);
  }
});

/* ---------- branding ---------- */
test('no branding leak: forbidden brand string appears in none of the wave 108D files', () => {
  const forbidden = 'Mu' + 'se'; // built without the literal string in source
  for (const p of [corePath, jsxPath, cssPath, join(here, 'wave108D.test.js')]) {
    const text = readFileSync(p, 'utf8');
    assert.ok(!text.includes(forbidden), `forbidden brand string found in ${p}`);
  }
});
