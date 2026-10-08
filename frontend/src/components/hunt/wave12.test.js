/**
 * wave12.test.js — Forge wave 12, ideas 50441–50480.
 *
 * Node-runnable checks (pure logic + registry honesty + export presence).
 * Run: node --test frontend/src/components/hunt/wave12.test.js
 * (Must be run from repo root; resolves via relative paths.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const core = await import('./shortcutsCore.js');

function extractIdeas(src, varName) {
  const block = src.match(new RegExp(`export const ${varName} = \\[([\\s\\S]*?)\\];`));
  assert.ok(block, `${varName} registry not found in source`);
  return [...block[1].matchAll(/\{\s*idea:\s*(\d+),\s*name:\s*'([^']+)',\s*in:\s*'([^']+)'/g)].map(
    m => ({ idea: Number(m[1]), name: m[2], in: m[3] })
  );
}

/* Registry honesty: all 40 ideas 50441–50480 mapped exactly once ----------- */

test('registry covers ideas 50441–50480 exactly', () => {
  const ideas = extractIdeas(
    fs.readFileSync(path.join(here, 'shortcutsCore.js'), 'utf8'),
    'WAVE12_IDEAS'
  );
  assert.equal(ideas.length, 40);
  const nums = ideas.map(i => i.idea).sort((a, b) => a - b);
  for (let n = 50441; n <= 50480; n++) assert.ok(nums.includes(n), `missing idea ${n}`);
  assert.equal(new Set(nums).size, 40, 'duplicate idea numbers');
  for (const i of ideas)
    assert.ok(i.in && i.in.length > 3, `idea ${i.idea} has no implementation mapping`);
});

test('exactly 3 ideas are SKIP-marked as already-live in wave 6', () => {
  const ideas = extractIdeas(
    fs.readFileSync(path.join(here, 'shortcutsCore.js'), 'utf8'),
    'WAVE12_IDEAS'
  );
  const skips = ideas.filter(i => i.in.startsWith('SKIP:'));
  assert.deepEqual(skips.map(i => i.idea).sort(), [50449, 50464, 50469]);
  const rest = ideas.filter(i => !i.in.startsWith('SKIP:'));
  assert.equal(rest.length, 37);
  for (const i of rest) assert.ok(!/SKIP/.test(i.in), `idea ${i.idea} wrongly marked SKIP`);
});

/* Shortcut registry sanity ------------------------------------------------- */

test('SHORTCUTS: unique ids, valid idea numbers, existing flags honest', () => {
  const ids = core.SHORTCUTS.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate shortcut ids');
  for (const s of core.SHORTCUTS) {
    assert.ok(s.keys && s.keys.length, `${s.id} has no keys`);
    assert.ok(s.idea >= 50441 && s.idea <= 50480, `${s.id} idea out of range`);
    assert.ok(s.label && s.group, `${s.id} missing label/group`);
  }
  const existing = core.SHORTCUTS.filter(s => s.existing);
  assert.deepEqual(existing.map(s => s.idea).sort(), [50449, 50464, 50469]);
});

test('every keyboard-driven idea 50441–50480 has at least one fresh binding', () => {
  // Component-only ideas (no keystroke of their own) are exempt — they are
  // still implemented, just not as bindings:
  const COMPONENT_ONLY = new Set([50441, 50442, 50443, 50444, 50465, 50466, 50467, 50468]);
  const fresh = core.SHORTCUTS.filter(s => !s.existing);
  const covered = new Set(fresh.map(s => s.idea));
  for (let n = 50441; n <= 50480; n++) {
    if ([50449, 50464, 50469].includes(n)) continue; // covered by `existing` entries
    if (COMPONENT_ONLY.has(n)) continue; // covered by components, verified in registry test
    assert.ok(covered.has(n), `idea ${n} has no fresh binding`);
  }
});

/* Key normalization --------------------------------------------------------- */

test('normalizeKeyEvent: single keys, modifiers, special keys', () => {
  const n = core.normalizeKeyEvent;
  assert.equal(n({ key: 'j' }), 'j');
  assert.equal(n({ key: 'R', shiftKey: true }), 'shift+r');
  assert.equal(n({ key: '?', shiftKey: true }), 'shift+?'); // Shift+? opens the cheat sheet
  assert.equal(n({ key: ' ' }), 'space');
  assert.equal(n({ key: 'Escape' }), 'esc');
  assert.equal(n({ key: 'Enter' }), 'enter');
  assert.equal(n({ key: 'k', ctrlKey: true }), 'ctrl+k');
  assert.equal(n({ key: 'k', metaKey: true }), 'ctrl+k'); // Cmd counts as Ctrl
  assert.equal(n({ key: 'F', ctrlKey: true, shiftKey: true }), 'ctrl+shift+f');
  assert.equal(n({ key: '1', altKey: true }), 'alt+1');
  assert.equal(n({ key: 'd', ctrlKey: true }), 'ctrl+d');
  assert.equal(n({ key: '.' }), '.');
});

test('matchBinding matches registry bindings incl. cmd+k alias', () => {
  const palette = core.SHORTCUTS.find(s => s.id === 'command-palette');
  assert.ok(core.matchBinding(palette, { key: 'k', ctrlKey: true }));
  assert.ok(core.matchBinding(palette, { key: 'k', metaKey: true }));
  const sheet = core.SHORTCUTS.find(s => s.id === 'cheat-sheet');
  assert.ok(core.matchBinding(sheet, { key: '?', shiftKey: true }));
  assert.ok(!core.matchBinding(sheet, { key: '?' })); // plain ? is wave-6's
  const dup = core.SHORTCUTS.find(s => s.id === 'duplicate-hunt');
  assert.ok(core.matchBinding(dup, { key: 'd', ctrlKey: true }));
  assert.ok(!core.matchBinding(dup, { key: 'd' })); // plain d toggles density instead
});

test('isTypingTarget detects text-editing surfaces', () => {
  assert.ok(core.isTypingTarget({ tagName: 'INPUT' }));
  assert.ok(core.isTypingTarget({ tagName: 'TEXTAREA' }));
  assert.ok(core.isTypingTarget({ tagName: 'SELECT' }));
  assert.ok(core.isTypingTarget({ tagName: 'DIV', isContentEditable: true }));
  assert.ok(!core.isTypingTarget({ tagName: 'DIV' }));
  assert.ok(!core.isTypingTarget({ tagName: 'BUTTON' }));
  assert.ok(!core.isTypingTarget(null));
});

/* Sequence tracker (50450) --------------------------------------------------- */

test('SequenceTracker: g-prefix sequences match, timeout resets', async () => {
  const t = new core.SequenceTracker(30);
  let r = t.feed('g');
  assert.ok(r.pending && !r.id);
  r = t.feed('h');
  assert.equal(r.id, 'go-hunt');
  r = t.feed('g');
  assert.ok(r.pending);
  r = t.feed('x');
  assert.equal(r.id, null); // unknown second key
  // timeout clears a pending prefix
  t.feed('g');
  await new Promise(res => setTimeout(res, 50));
  r = t.feed('h');
  assert.equal(r.id, null); // prefix expired — plain 'h' is not a sequence
  t.dispose();
});

/* Tips rotation (50441) ------------------------------------------------------ */

test('TIPS non-empty and pickTip cycles deterministically', () => {
  assert.ok(core.TIPS.length >= 10, 'need a healthy tip pool');
  assert.equal(core.pickTip(0), core.TIPS[0]);
  assert.equal(core.pickTip(core.TIPS.length), core.TIPS[0]);
  assert.equal(core.pickTip(-1), core.TIPS[core.TIPS.length - 1]);
});

test('tip state round-trips through injected storage', () => {
  const mem = new Map();
  const store = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const s0 = core.getTipState(store);
  assert.deepEqual(s0, { visits: 0, dismissed: false, neverShow: false });
  core.setTipState(store, { visits: 3, dismissed: false, neverShow: true });
  const s1 = core.getTipState(store);
  assert.equal(s1.visits, 3);
  assert.equal(s1.neverShow, true);
});

/* Copy helpers (50442/50443/50444/50455/50473) -------------------------------- */

test('verifiedCheckmarkText names verifier + date, handles unverified', () => {
  const t = core.verifiedCheckmarkText('Aarav', '2026-10-06T10:00:00Z');
  assert.ok(t.includes('Aarav'), 'names the verifier');
  assert.ok(/2026/.test(t), 'includes the date');
  assert.ok(core.verifiedCheckmarkText(null).toLowerCase().includes('not yet verified'));
});

test('shareLinkExplainer covers expiry, permissions, revoke', () => {
  const c = core.shareLinkExplainer();
  assert.ok(c.expiry.length > 20 && c.permissions.length > 20 && c.revoke.length > 10);
});

test('simulateToggleCopy distinguishes mock vs real', () => {
  const c = core.simulateToggleCopy();
  assert.ok(/recorded traffic|no packets/i.test(c.mock));
  assert.ok(/live/i.test(c.real));
});

test('markdownPoC renders a formatted finding document', () => {
  const md = core.markdownPoC({
    title: 'SQLi in search',
    severity: 'high',
    confidence: 92,
    host: 'app.test',
    poc: "' OR 1=1--",
  });
  assert.ok(md.startsWith('## SQLi in search'));
  assert.ok(
    md.includes('Severity: high') && md.includes('Confidence: 92%') && md.includes('Host: app.test')
  );
  assert.ok(md.includes('### Proof of concept') && md.includes("' OR 1=1--"));
  const empty = core.markdownPoC({});
  assert.ok(empty.includes('Untitled finding') && empty.includes('No PoC recorded'));
});

test('undoToastText narrates the revert', () => {
  const t = core.undoToastText({ id: 'f-123', from: 'false-positive', to: 'open' });
  assert.ok(t.includes('false-positive') && t.includes('open'));
});

/* Cheat-sheet search + key display (50445) ----------------------------------- */

test('filterShortcuts finds by label, key, and group', () => {
  assert.ok(core.filterShortcuts('zen').some(s => s.id === 'toggle-zen'));
  assert.ok(core.filterShortcuts('ctrl+shift+f').some(s => s.id === 'global-search'));
  assert.ok(core.filterShortcuts('timeline').every(s => s.group === 'Timeline'));
  assert.equal(core.filterShortcuts('').length, core.SHORTCUTS.length);
  assert.equal(core.filterShortcuts('zzzz-no-match').length, 0);
});

test('keyDisplay renders human labels', () => {
  assert.equal(core.keyDisplay('ctrl+shift+f'), 'Ctrl+Shift+F');
  assert.equal(core.keyDisplay('shift+?'), 'Shift+?');
  assert.equal(core.keyDisplay('space'), 'Space');
  assert.equal(core.keyDisplay('ctrl+k', 'mac'), '⌘+K');
});

/* Component export presence -------------------------------------------------- */

const EXPECTED_EXPORTS = [
  'ShortcutsProvider',
  'useShortcuts',
  'ensureLogicalTabOrder',
  'RotatingTipsBar',
  'VerifiedCheckmark',
  'ShareLinkExplainer',
  'SimulateToggleTip',
  'ShortcutCheatSheet',
  'FocusTrap',
  'SkipLinks',
  'TimelineKeyNav',
  'QuickActionMenu',
  'ExportViewPicker',
  'ToastStack',
];

test('ShortcutsManager.jsx exports all wave-12 components', () => {
  const src = fs.readFileSync(path.join(here, 'ShortcutsManager.jsx'), 'utf8');
  assert.equal(EXPECTED_EXPORTS.length, 14);
  for (const name of EXPECTED_EXPORTS) {
    assert.ok(new RegExp(`export (function|const) ${name}\\b`).test(src), `missing export ${name}`);
  }
});

test('ShortcutsManager.jsx keeps wave-6 bindings untouched (no re-binding)', () => {
  const src = fs.readFileSync(path.join(here, 'ShortcutsManager.jsx'), 'utf8');
  // The provider must exclude existing bindings from its own listener:
  assert.ok(/!s\.existing/.test(src), 'listener must skip existing (wave-6) bindings');
});

test('ShortcutsManager.css has skip-link, zen, and print rules', () => {
  const css = fs.readFileSync(path.join(here, 'ShortcutsManager.css'), 'utf8');
  assert.ok(/\.sc-skip-link:focus/.test(css), 'skip links reveal on focus');
  assert.ok(/\[data-zen="1"\]/.test(css), 'zen mode hides chrome');
  assert.ok(/@media print/.test(css), 'cheat sheet prints cleanly');
});

test('SEVERITY_KEYS maps 1–4 to critical→low', () => {
  assert.deepEqual(core.SEVERITY_KEYS, { 1: 'critical', 2: 'high', 3: 'medium', 4: 'low' });
});
