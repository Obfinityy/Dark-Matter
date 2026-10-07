/**
 * wave13.test.js — Forge wave 13 (ideas 50481–50520).
 * Node tests for the pure logic in advancedShortcutsCore.js and a11yCore.js.
 * Run: node --test frontend/src/components/hunt/wave13.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE13_SHORTCUTS_IDEAS,
  ADVANCED_SHORTCUTS,
  NEW_WAVE13_SHORTCUTS,
  F6_REGIONS,
  resolveEscAction,
  findRemapConflicts,
  recordMouseUse,
  shouldShowHint,
  movePhaseIndex,
  pickSuggestion,
  buildDeepLink,
  findingPdfPayload,
  ONBOARDING_STEPS,
} from './advancedShortcutsCore.js';
import {
  WAVE13_A11Y_IDEAS,
  phaseNarrationText,
  newFindingAnnouncement,
  severityTriple,
  contrastRatio,
  meetsWCAG,
  listboxAriaProps,
  findingOptionProps,
  timelineStepStatusText,
  assertiveErrorText,
  toastLiveProps,
  SEVERITY_PALETTE_CVD,
  chartDataTableRows,
  graphArrowNav,
  focusOrderMatchesVisual,
  TOUCH_TARGET_MIN,
  PREFERS_CONTRAST_QUERY,
} from './a11yCore.js';

const ideas = (list) => list.map((e) => e.idea).sort((a, b) => a - b);

test('wave-13 registries cover 50481–50520 exactly once (40 ideas)', () => {
  const all = [...ideas(WAVE13_SHORTCUTS_IDEAS), ...ideas(WAVE13_A11Y_IDEAS)];
  assert.equal(all.length, 40);
  assert.deepEqual(all, Array.from({ length: 40 }, (_, i) => 50481 + i));
});

test('every registry entry names a real implementation or an honest SKIP', () => {
  for (const e of [...WAVE13_SHORTCUTS_IDEAS, ...WAVE13_A11Y_IDEAS]) {
    assert.ok(e.in && e.in.length > 10, `idea ${e.idea} has no implementation note`);
  }
  const skips = [...WAVE13_SHORTCUTS_IDEAS, ...WAVE13_A11Y_IDEAS].filter((e) => e.in.startsWith('SKIP'));
  assert.equal(skips.length, 2); // 50483, 50508
});

test('resolveEscAction follows the menu → card → search → blur ladder', () => {
  assert.equal(resolveEscAction({ menuOpen: true, cardOpen: true }), 'close-menu');
  assert.equal(resolveEscAction({ cardOpen: true, searchActive: true }), 'collapse-card');
  assert.equal(resolveEscAction({ searchActive: true, inputFocused: true }), 'clear-search');
  assert.equal(resolveEscAction({ inputFocused: true }), 'blur-input');
  assert.equal(resolveEscAction({}), null);
});

test('findRemapConflicts catches collisions with existing bindings', () => {
  const conflicts = findRemapConflicts({ 'finding-first': 'ctrl+k' }); // wave-12 Ctrl+K palette
  assert.ok(conflicts.length >= 1);
  assert.equal(conflicts[0].actionId, 'finding-first');
  const clean = findRemapConflicts({ 'finding-first': 'ctrl+alt+home' });
  assert.equal(clean.length, 0);
});

test('adaptive hints appear after 3 mouse uses (50486)', () => {
  const store = new Map();
  const fake = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(shouldShowHint(fake, 'x'), false);
  recordMouseUse(fake, 'x'); recordMouseUse(fake, 'x');
  assert.equal(shouldShowHint(fake, 'x'), false);
  assert.equal(recordMouseUse(fake, 'x'), 3);
  assert.equal(shouldShowHint(fake, 'x'), true);
});

test('movePhaseIndex clamps to the pipeline bounds (50495)', () => {
  assert.equal(movePhaseIndex(0, -1, 5), 0);
  assert.equal(movePhaseIndex(4, 1, 5), 4);
  assert.equal(movePhaseIndex(2, 1, 5), 3);
  assert.equal(movePhaseIndex(2, -1, 5), 1);
  assert.equal(movePhaseIndex(0, 1, 0), 0);
});

test('pickSuggestion maps number badges 1–5 (50492)', () => {
  const s = ['a', 'b', 'c'];
  assert.equal(pickSuggestion(s, '2'), 'b');
  assert.equal(pickSuggestion(s, '5'), null);
  assert.equal(pickSuggestion(s, '0'), null);
  assert.equal(pickSuggestion([], '1'), null);
});

test('buildDeepLink produces an encoded finding URL (50498)', () => {
  assert.equal(buildDeepLink('f1', 'https://x.io'), 'https://x.io/#/findings/f1');
  assert.equal(buildDeepLink('a b', 'https://x.io/'), 'https://x.io/#/findings/a%20b');
  assert.equal(buildDeepLink(null), null);
});

test('findingPdfPayload carries the fields the exporter needs (50489)', () => {
  const p = findingPdfPayload({ title: 'SQLi', severity: 'critical', target: 'x.io/login', cwe: 'CWE-89' });
  assert.equal(p.title, 'SQLi');
  assert.equal(p.severity, 'critical');
  assert.ok(p.exportedAt);
});

test('ONBOARDING_STEPS is a 5-step sequence with real combos (50499)', () => {
  assert.equal(ONBOARDING_STEPS.length, 5);
  assert.deepEqual(ONBOARDING_STEPS.map((s) => s.n), [1, 2, 3, 4, 5]);
  for (const s of ONBOARDING_STEPS) assert.ok(s.combo && s.hint);
});

test('F6_REGIONS cycles nav → main → sidebar → chat (50488)', () => {
  assert.deepEqual(F6_REGIONS.map((r) => r.id), ['nav', 'main', 'sidebar', 'chat']);
});

test('NEW_WAVE13_SHORTCUTS lists only bound wave-13 additions (50491)', () => {
  assert.ok(NEW_WAVE13_SHORTCUTS.length >= 10);
  for (const s of NEW_WAVE13_SHORTCUTS) assert.ok(s.keys.length > 0 && s.label);
});

test('ADVANCED_SHORTCUTS ids are unique', () => {
  const ids = ADVANCED_SHORTCUTS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('phaseNarrationText builds the SR announcement (50500)', () => {
  const t = phaseNarrationText('Testing', { findings: 12, target: 'example.com' });
  assert.ok(t.includes('Testing') && t.includes('12 findings') && t.includes('example.com'));
});

test('newFindingAnnouncement names severity + title (50506)', () => {
  assert.equal(newFindingAnnouncement({ severity: 'critical', title: 'SQL injection', target: '/login' }),
    'New critical finding: SQL injection on /login.');
});

test('severityTriple never leaves severity as color-alone (50501)', () => {
  for (const sev of ['critical', 'high', 'medium', 'low', 'info', 'weird']) {
    const t = severityTriple(sev);
    assert.ok(t.label && t.icon && t.color, sev);
  }
});

test('contrastRatio computes WCAG ratios (50504)', () => {
  assert.ok(contrastRatio('#000000', '#ffffff') > 20.9);
  assert.ok(Math.abs(contrastRatio('#777777', '#777777') - 1) < 0.01);
  assert.equal(contrastRatio('nope', '#fff'), null);
  const body = meetsWCAG('#e6edf3', '#0d1117');
  assert.equal(body.required, 4.5);
  assert.equal(body.passes, true);
  const low = meetsWCAG('#8b949e', '#ffffff', 'large');
  assert.equal(low.required, 3.0);
});

test('listbox + option props carry ARIA semantics (50505)', () => {
  const box = listboxAriaProps({ activeDescendant: 'finding-option-1', expanded: true, multi: true });
  assert.equal(box.role, 'listbox');
  assert.equal(box['aria-activedescendant'], 'finding-option-1');
  assert.equal(box['aria-multiselectable'], 'true');
  const opt = findingOptionProps({ id: '7', severity: 'high', title: 'XSS' }, { active: true });
  assert.equal(opt.role, 'option');
  assert.ok(opt['aria-label'].includes('high'));
});

test('timelineStepStatusText narrates steps (50507)', () => {
  const t = timelineStepStatusText({ n: 2, label: 'Scanning', status: 'running', at: '10:01' });
  assert.ok(t.includes('Step 2') && t.includes('Scanning') && t.includes('running'));
});

test('assertiveErrorText links the field to its message (50511)', () => {
  assert.equal(assertiveErrorText('Target', 'Enter a valid URL'), 'Error in Target: Enter a valid URL');
});

test('toastLiveProps declares a polite live region (50513)', () => {
  const p = toastLiveProps();
  assert.equal(p['aria-live'], 'polite');
  assert.equal(p.role, 'status');
});

test('SEVERITY_PALETTE_CVD covers all severities with notes (50514)', () => {
  assert.equal(SEVERITY_PALETTE_CVD.length, 5);
  for (const p of SEVERITY_PALETTE_CVD) assert.ok(p.color && p.note);
});

test('chartDataTableRows converts series to rows (50515)', () => {
  assert.deepEqual(chartDataTableRows([{ label: 'Critical', value: 3 }]), [{ n: 1, label: 'Critical', value: 3 }]);
});

test('graphArrowNav walks edges with arrow keys (50516)', () => {
  const g = { nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }] };
  assert.equal(graphArrowNav(g, 'a', 'arrowright'), 'b');
  assert.equal(graphArrowNav(g, 'b', 'arrowleft'), 'a');
  assert.equal(graphArrowNav(g, 'c', 'arrowdown'), 'c'); // dead end stays
  assert.equal(graphArrowNav(g, 'zzz', 'arrowright'), null);
});

test('focusOrderMatchesVisual compares DOM vs visual order (50519)', () => {
  assert.equal(focusOrderMatchesVisual(['a', 'b'], ['a', 'b']), true);
  assert.equal(focusOrderMatchesVisual(['a', 'b'], ['b', 'a']), false);
  assert.equal(focusOrderMatchesVisual(['a'], ['a', 'b']), false);
});

test('a11y constants hold the required minima (50518/50520)', () => {
  assert.equal(TOUCH_TARGET_MIN, 44);
  assert.equal(PREFERS_CONTRAST_QUERY, '(prefers-contrast: more)');
});
