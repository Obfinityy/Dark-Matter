/**
 * Wave 109D tests — target organization (ideas 54351-54360).
 * Run: node --test frontend/src/components/hunt/wave109D.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const corePath = join(here, 'wave109DCore.js');
const jsxPath = join(here, 'Wave109D.jsx');
const cssPath = join(here, 'Wave109D.css');

import {
  WAVE109_D_IDEAS,
  normalizeUrl,
  anchorNote,
  unanchorNote,
  notesForUrl,
  setSeverity,
  sortBySeverity,
  severityCounts,
  snippet,
  searchAllNotes,
  presentNoteTypes,
  suggestNoteTypes,
  completenessScore,
  createClientFolder,
  assignTargetToClient,
  removeTargetFromClient,
  clientDashboard,
  createProgramFolder,
  assignTargetToProgram,
  effectiveRules,
  createGroup,
  addToGroup,
  removeFromGroup,
  reorderGroup,
  createNode,
  addChild,
  breadcrumbs,
  flattenHierarchy,
  createSmartGroup,
  matchesQuery,
  evaluateSmartGroup,
  createTagGroup,
  syncTagGroups,
} from './wave109DCore.js';

const EXPECTED_TITLES = {
  54351: 'Note anchoring to URLs',
  54352: 'Note severity flags',
  54353: 'Cross-target note search',
  54354: 'Note completeness suggestions',
  54355: 'Client folders',
  54356: 'Program folders',
  54357: 'Custom groups',
  54358: 'Nested group hierarchy',
  54359: 'Smart groups by query',
  54360: 'Smart groups by tag',
};

test('registry covers all 10 ideas with exact titles', () => {
  assert.equal(WAVE109_D_IDEAS.length, 10);
  for (const idea of WAVE109_D_IDEAS) {
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

test('54351: URL anchoring normalizes and dedupes', () => {
  assert.equal(normalizeUrl('HTTPS://Acme.test/a?x=1#frag'), 'https://acme.test/a?x=1');
  const note = {};
  anchorNote(note, 'https://acme.test/login');
  anchorNote(note, 'https://acme.test/login#frag');
  assert.equal(note.urlAnchors.length, 1);
  const notes = [note, { urlAnchors: [] }];
  assert.equal(notesForUrl(notes, 'https://acme.test/login').length, 1);
  assert.ok(unanchorNote(note, 'https://acme.test/login'));
  assert.equal(unanchorNote(note, 'https://acme.test/login'), false);
  assert.throws(() => anchorNote({}, '  '), /non-empty/);
});

test('54352: severity flags set, sort, count', () => {
  const notes = [
    { title: 'a', severity: 'info' },
    { title: 'b', severity: 'blocker' },
    { title: 'c', severity: 'warning' },
  ];
  assert.deepEqual(sortBySeverity(notes).map((n) => n.title), ['b', 'c', 'a']);
  assert.deepEqual(severityCounts(notes), { info: 1, warning: 1, blocker: 1 });
  const n = {};
  setSeverity(n, 'blocker');
  assert.equal(n.severity, 'blocker');
  assert.throws(() => setSeverity({}, 'critical'), /severity must be/);
});

test('54353: cross-target search returns snippets ordered by target', () => {
  const notes = [
    { id: '1', targetId: 't2', title: 'T', body: 'found creds here', status: 'active' },
    { id: '2', targetId: 't1', title: 'U', body: 'creds rotated', status: 'active' },
    { id: '3', targetId: 't3', title: 'V', body: 'nothing', status: 'trashed' },
  ];
  const r = searchAllNotes(notes, 'creds');
  assert.equal(r.length, 2);
  assert.equal(r[0].targetId, 't1');
  assert.ok(r[0].snippet.toLowerCase().includes('creds'));
  assert.equal(searchAllNotes(notes, '   ').length, 0);
  assert.ok(snippet('short', 'xyz').length <= 80);
});

test('54354: completeness suggestions and score', () => {
  const notes = [
    { targetId: 't1', status: 'active', tags: ['credentials', 'contacts'] },
    { targetId: 't1', status: 'trashed', tags: ['handoff'] },
  ];
  const s = suggestNoteTypes(notes, 't1');
  assert.deepEqual(s.map((x) => x.type), ['scope-caveats', 'access-notes', 'handoff']);
  assert.ok(s[0].hint.length > 10);
  assert.equal(completenessScore(notes, 't1'), 40);
  assert.deepEqual(presentNoteTypes(notes, 't1').sort(), ['contacts', 'credentials']);
});

test('54355: client folders assign and dashboard rollup', () => {
  const f = createClientFolder({ name: 'Acme' });
  assignTargetToClient(f, 't1');
  assignTargetToClient(f, 't1');
  assert.deepEqual(f.targetIds, ['t1']);
  assert.ok(removeTargetFromClient(f, 't1'));
  assert.equal(removeTargetFromClient(f, 't1'), false);
  assignTargetToClient(f, 't1');
  const dash = clientDashboard(f, [{ id: 't1', findings: 5 }], [{ targetId: 't1', status: 'active' }, { targetId: 't2', status: 'active' }]);
  assert.deepEqual(dash, { clientId: f.id, clientName: 'Acme', targetCount: 1, noteCount: 1, findingCount: 5 });
  assert.throws(() => createClientFolder({ name: ' ' }), /name/);
});

test('54356: program folders inherit rules downward, target overrides win', () => {
  const p = createProgramFolder({ name: 'Acme BBP', rules: [{ key: 'scope', value: 'in-scope only' }] });
  assignTargetToProgram(p, 't1');
  const rules = effectiveRules(p, [{ key: 'scope', value: 'staging excluded', inherited: false }]);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].value, 'staging excluded');
  assert.equal(rules[0].inherited, false);
  const inh = effectiveRules(p, []);
  assert.equal(inh[0].inherited, true);
  assert.throws(() => createProgramFolder({}), /name/);
});

test('54357: custom groups add/remove/reorder', () => {
  const g = createGroup({ name: 'Q4 focus' });
  addToGroup(g, 't1');
  addToGroup(g, 't2');
  addToGroup(g, 't3');
  reorderGroup(g, 't3', 0);
  assert.deepEqual(g.memberIds, ['t3', 't1', 't2']);
  assert.ok(removeFromGroup(g, 't1'));
  assert.deepEqual(g.memberIds, ['t3', 't2']);
  assert.throws(() => reorderGroup(g, 'ghost', 0), /not in group/);
  assert.throws(() => createGroup({}), /name/);
});

test('54358: nested hierarchy breadcrumbs and flatten', () => {
  const root = createNode({ name: 'Acme', type: 'client' });
  const prog = createNode({ name: 'BBP', type: 'program' });
  const env = createNode({ name: 'Prod', type: 'environment' });
  addChild(root, prog);
  addChild(prog, env);
  const byId = new Map([root, prog, env].map((n) => [n.id, n]));
  assert.deepEqual(breadcrumbs(env.id, byId), ['Acme', 'BBP', 'Prod']);
  const flat = flattenHierarchy(root);
  assert.deepEqual(flat.map((f) => f.depth), [0, 1, 2]);
  assert.throws(() => createNode({ name: 'x', type: 'bogus' }), /invalid type/);
});

test('54359: smart groups by query match and re-evaluate', () => {
  const g = createSmartGroup({ name: 'High risk', query: { field: 'score', op: 'gte', value: 80 } });
  const targets = [
    { id: 't1', score: 90, name: 'Acme Web' },
    { id: 't2', score: 40, name: 'Acme Docs' },
  ];
  assert.ok(matchesQuery(targets[0], g.query));
  assert.ok(!matchesQuery(targets[1], g.query));
  evaluateSmartGroup(g, targets);
  assert.deepEqual(g.memberIds, ['t1']);
  const g2 = createSmartGroup({ name: 'Web', query: { field: 'name', op: 'contains', value: 'web' } });
  evaluateSmartGroup(g2, targets);
  assert.deepEqual(g2.memberIds, ['t1']);
  assert.throws(() => createSmartGroup({ name: 'x', query: { field: 'a', op: 'bogus' } }), /op must be/);
});

test('54360: tag groups sync as tags change', () => {
  const groups = [createTagGroup({ name: 'APAC', tag: 'apac' })];
  const targets = [
    { id: 't1', tags: ['apac', 'retail'] },
    { id: 't2', tags: ['emea'] },
  ];
  syncTagGroups(groups, targets);
  assert.deepEqual(groups[0].memberIds, ['t1']);
  targets[1].tags.push('apac');
  syncTagGroups(groups, targets);
  assert.deepEqual(groups[0].memberIds, ['t1', 't2']);
  assert.throws(() => createTagGroup({}), /tag/);
});
