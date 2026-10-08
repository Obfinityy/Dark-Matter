/**
 * wave14.test.js — Forge wave 14 (ideas 50521–50560).
 * Node tests for the pure logic in a11yRound3Core.js.
 * Run: node --test frontend/src/components/hunt/wave14.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE14_IDEAS,
  huntSummaryText,
  ariaHiddenProps,
  statusAnnouncement,
  makeProgressAnnouncer,
  formatProgress,
  sortableHeaderProps,
  sortableAnnouncement,
  readMediaPreference,
  REDUCED_TRANSPARENCY_QUERY,
  REDUCED_DATA_QUERY,
  transparencyClass,
  reducedDataClass,
  checkCodeBlockFocus,
  screenshotAltText,
  avatarCaptionText,
  SPEAKABLE_ACTIONS,
  speakableActionName,
  shouldExitTerminal,
  LANDMARKS,
  landmarkProps,
  headingLevelIssues,
  checkLinkText,
  AUTOCOMPLETE_MAP,
  autocompleteFor,
  dualTimestamp,
  disabledButtonProps,
  testSeverityTints,
  rovingTabIndexes,
  filterAnnouncement,
  sliderStep,
  sliderSpokenValue,
  describeChart,
  LOW_VISION_SPACING,
  spacing,
  LINK_UNDERLINE_POLICY,
  destructiveConfirmCopy,
  graphToNestedList,
  typingAnnouncementText,
  KEYBOARD_DRAG_EQUIVALENTS,
  dragKeyboardEquivalent,
  formErrorSummary,
  timeoutAnnouncementCopy,
  SESSION_EXTEND_COPY,
  keyboardDateProps,
  parseDateInput,
  READABILITY_DEFAULTS,
  readabilityStyle,
  DYSLEXIA_FONT_STACK,
  dyslexiaClass,
  ACRONYM_MAP,
  expandAcronyms,
  scrollMarginFor,
  bulkResultAnnouncement,
  A11Y_STATEMENT,
  NEW_CARD_SLIDE_SPEC,
} from './a11yRound3Core.js';

const ideas = list => list.map(e => e.idea).sort((a, b) => a - b);

test('wave-14 registry covers 50521–50560 exactly once (40 ideas)', () => {
  const all = ideas(WAVE14_IDEAS);
  assert.equal(all.length, 40);
  assert.deepEqual(
    all,
    Array.from({ length: 40 }, (_, i) => 50521 + i)
  );
});

test('every registry entry names a real implementation (no SKIPs)', () => {
  for (const e of WAVE14_IDEAS) {
    assert.ok(e.in && e.in.length > 10, `idea ${e.idea} has no implementation note`);
  }
  const skips = WAVE14_IDEAS.filter(e => e.in.startsWith('SKIP'));
  assert.equal(skips.length, 0);
});

test('huntSummaryText announces hunt + phase + finding count (50521)', () => {
  assert.equal(
    huntSummaryText({ target: 'example.com', phase: 'Testing', findings: 12 }),
    'Hunt on example.com, phase Testing, 12 findings.'
  );
  assert.equal(huntSummaryText({ findings: 1 }), 'Hunt, 1 finding.');
});

test('ariaHiddenProps hides decorative animation from AT (50522)', () => {
  assert.deepEqual(ariaHiddenProps(true), { 'aria-hidden': 'true' });
  assert.deepEqual(ariaHiddenProps(false), {});
});

test('statusAnnouncement covers pause / resume / completion (50523)', () => {
  assert.ok(statusAnnouncement('paused').includes('paused'));
  assert.ok(statusAnnouncement('resumed').includes('resumed'));
  assert.ok(statusAnnouncement('completed').includes('completed'));
  assert.ok(statusAnnouncement('weird').includes('weird'));
});

test('makeProgressAnnouncer throttles to 10% steps (50531)', () => {
  const a = makeProgressAnnouncer(10);
  assert.equal(a.update(3), '3%'); // first announcement always fires
  assert.equal(a.update(9), null); // same step — silent
  assert.equal(a.update(11), '11%'); // next 10% step
  assert.equal(a.update(19), null);
  assert.equal(a.update(100, 'scanning'), '100% — scanning');
  a.reset();
  assert.equal(a.update(2), '2%');
});

test('formatProgress always renders text alongside animation (50536)', () => {
  assert.equal(formatProgress(40, 'scanning'), '40% — scanning');
  assert.equal(formatProgress(150), '100%');
  assert.equal(formatProgress(-5), '0%');
});

test('sortableHeaderProps carries scope + aria-sort (50524)', () => {
  const col = { id: 'sev', label: 'Severity', sortable: true };
  const sorted = sortableHeaderProps(col, { id: 'sev', direction: 'desc' });
  assert.equal(sorted.scope, 'col');
  assert.equal(sorted['aria-sort'], 'descending');
  assert.ok(sorted['aria-label'].includes('Severity'));
  const plain = sortableHeaderProps({ id: 'x', label: 'X' }, {});
  assert.equal(plain['aria-sort'], undefined);
  assert.equal(sortableAnnouncement(col, 'asc'), 'Findings sorted by Severity, ascending.');
});

test('media preference readers + class resolvers (50525/50549)', () => {
  assert.equal(REDUCED_TRANSPARENCY_QUERY, '(prefers-reduced-transparency: reduce)');
  assert.equal(REDUCED_DATA_QUERY, '(prefers-reduced-data: reduce)');
  const mm = q => ({ matches: q.includes('transparency') });
  assert.equal(readMediaPreference(REDUCED_TRANSPARENCY_QUERY, mm), true);
  assert.equal(readMediaPreference(REDUCED_DATA_QUERY, mm), false);
  assert.equal(readMediaPreference(REDUCED_DATA_QUERY), false); // no matcher → false
  assert.equal(transparencyClass(true), 'a11y3-reduced-transparency');
  assert.equal(transparencyClass(false), '');
  assert.equal(reducedDataClass(true), 'a11y3-reduced-data');
  assert.equal(reducedDataClass(false), '');
});

test('checkCodeBlockFocus enforces 3:1 non-text contrast (50526)', () => {
  const good = checkCodeBlockFocus('#ffffff', '#0d1117');
  assert.equal(good.required, 3.0);
  assert.equal(good.passes, true);
  const bad = checkCodeBlockFocus('#0d1117', '#0d1117');
  assert.equal(bad.passes, false);
});

test('screenshotAltText is generated from finding metadata (50527)', () => {
  const alt = screenshotAltText({
    title: 'SQLi',
    target: 'example.com/login',
    severity: 'critical',
  });
  assert.ok(alt.includes('SQLi') && alt.includes('example.com/login') && alt.includes('critical'));
});

test('avatarCaptionText captions every spoken response (50528)', () => {
  assert.equal(avatarCaptionText('Found 3 issues'), 'Infinity AI: Found 3 issues');
  assert.equal(avatarCaptionText(''), 'Infinity AI: (no speech)');
});

test('speakableActionName covers every action (50529)', () => {
  assert.ok(Object.keys(SPEAKABLE_ACTIONS).length >= 10);
  assert.equal(speakableActionName('export-pdf'), 'Export findings as PDF');
  assert.equal(speakableActionName('some-new_thing'), 'some new thing');
});

test('shouldExitTerminal: Esc always exits terminal focus (50530)', () => {
  assert.equal(shouldExitTerminal('Escape'), true);
  assert.equal(shouldExitTerminal('Esc'), true);
  assert.equal(shouldExitTerminal('Enter'), false);
});

test('LANDMARKS covers header/nav/main/complementary/contentinfo (50532)', () => {
  assert.deepEqual(Object.keys(LANDMARKS).sort(), [
    'complementary',
    'contentinfo',
    'header',
    'main',
    'nav',
  ]);
  assert.equal(landmarkProps('main')['aria-label'], 'Main content');
  assert.deepEqual(landmarkProps('nope'), {});
});

test('headingLevelIssues flags skipped levels (50533)', () => {
  const ok = headingLevelIssues([
    { level: 1, text: 'A' },
    { level: 2, text: 'B' },
    { level: 3, text: 'C' },
  ]);
  assert.deepEqual(ok, []);
  const bad = headingLevelIssues([
    { level: 1, text: 'A' },
    { level: 3, text: 'C' },
  ]);
  assert.equal(bad.length, 1);
  assert.ok(bad[0].reason.includes('h1 to h3'));
  const firstBad = headingLevelIssues([{ level: 2, text: 'A' }]);
  assert.ok(firstBad[0].reason.includes('h1'));
});

test('checkLinkText rejects "click here" (50534)', () => {
  assert.equal(checkLinkText('Download PDF report').ok, true);
  assert.equal(checkLinkText('click here').ok, false);
  assert.equal(checkLinkText('').ok, false);
  assert.equal(checkLinkText('x').ok, false);
});

test('autocompleteFor maps auth fields (50535)', () => {
  assert.equal(autocompleteFor('email'), 'email');
  assert.equal(autocompleteFor('new-password'), 'new-password');
  assert.equal(autocompleteFor('current-password'), 'current-password');
  assert.equal(autocompleteFor('whatever'), 'off');
  assert.ok(AUTOCOMPLETE_MAP.email);
});

test('dualTimestamp pairs relative text with absolute title (50537)', () => {
  const now = Date.now();
  const threeMin = dualTimestamp(new Date(now - 3 * 60000).toISOString(), now);
  assert.equal(threeMin.relative, '3 minutes ago');
  assert.ok(threeMin.title.length > 0);
  assert.equal(dualTimestamp(new Date(now - 10000).toISOString(), now).relative, 'just now');
  assert.equal(dualTimestamp('garbage').relative, 'unknown time');
});

test('disabledButtonProps keeps the button focusable with a reason (50538)', () => {
  const p = disabledButtonProps('Hunt is still running');
  assert.equal(p['aria-disabled'], 'true');
  assert.equal(p.title, 'Hunt is still running');
  assert.ok(p['data-disabled-reason']);
});

test('testSeverityTints checks dark + light themes at 3:1 (50539)', () => {
  const report = testSeverityTints();
  assert.equal(report.length, 5);
  for (const r of report) {
    assert.ok(r.severity && r.color);
    assert.equal(r.dark.required, 3.0);
    assert.equal(r.light.required, 3.0);
    assert.ok(typeof r.dark.passes === 'boolean' && typeof r.light.passes === 'boolean');
  }
});

test('rovingTabIndexes keeps exactly one tabbable item (50540)', () => {
  assert.deepEqual(rovingTabIndexes(4, 2), [-1, -1, 0, -1]);
  assert.deepEqual(rovingTabIndexes(0, 0), []);
});

test('filterAnnouncement reads "Showing 7 of 42 findings" (50541)', () => {
  assert.equal(filterAnnouncement(7, 42), 'Showing 7 of 42 findings');
  assert.equal(filterAnnouncement(1, 1), 'Showing 1 of 1 finding');
});

test('sliderStep clamps + sliderSpokenValue reads aloud (50542)', () => {
  assert.equal(sliderStep(50, 'up', { step: 5 }), 55);
  assert.equal(sliderStep(50, 'down', { step: 5 }), 45);
  assert.equal(sliderStep(98, 'up', { max: 100, step: 5 }), 100);
  assert.equal(sliderStep(2, 'down', { min: 0, step: 5 }), 0);
  assert.equal(sliderSpokenValue(75), 'Confidence 75 percent');
});

test('describeChart generates a textual chart summary (50543)', () => {
  const d = describeChart({
    type: 'bar',
    title: 'Findings by severity',
    series: [
      { label: 'Critical', value: 3 },
      { label: 'High', value: 2 },
    ],
  });
  assert.ok(d.includes('Critical: 3') && d.includes('Total 5') && d.includes('Highest: Critical'));
  assert.equal(describeChart({ title: 'Empty' }), 'Empty: no data.');
});

test('LOW_VISION_SPACING is an 8px rhythm (50544)', () => {
  assert.equal(LOW_VISION_SPACING, 8);
  assert.equal(spacing(2), '16px');
  assert.equal(spacing(0), '0px');
});

test('LINK_UNDERLINE_POLICY forbids color-alone links (50545)', () => {
  assert.ok(LINK_UNDERLINE_POLICY.includes('underlined'));
  assert.ok(LINK_UNDERLINE_POLICY.includes('never'));
});

test('destructiveConfirmCopy gives visual + text confirmation (50546)', () => {
  const c = destructiveConfirmCopy('Delete hunt');
  assert.ok(c.title.includes('Delete hunt'));
  assert.ok(c.body.includes('cannot be undone'));
  assert.ok(c.confirmLabel && c.cancelLabel);
  assert.ok(c.announced.includes('Delete hunt'));
});

test('graphToNestedList converts the chain graph to a nested list (50547)', () => {
  const g = {
    nodes: [
      { id: 'a', label: 'XSS' },
      { id: 'b', label: 'Session theft' },
      { id: 'c', label: 'ATO' },
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ],
  };
  const tree = graphToNestedList(g);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].label, 'XSS');
  assert.equal(tree[0].children[0].children[0].label, 'ATO');
  // cycle-safe
  const cyclic = graphToNestedList({
    nodes: [{ id: 'a', label: 'A' }],
    edges: [{ from: 'a', to: 'a' }],
  });
  assert.equal(cyclic[0].children[0].cyclic, true);
});

test('typingAnnouncementText announces agent typing (50548)', () => {
  assert.equal(typingAnnouncementText(), 'Infinity AI is typing.');
  assert.equal(typingAnnouncementText('Scout'), 'Scout is typing.');
});

test('dragKeyboardEquivalent maps every drag to keys (50550)', () => {
  assert.ok(Object.keys(KEYBOARD_DRAG_EQUIVALENTS).length >= 4);
  const eq = dragKeyboardEquivalent('reorder-finding');
  assert.ok(eq.keys.includes('Ctrl'));
  assert.ok(eq.description.length > 5);
  assert.equal(dragKeyboardEquivalent('nope'), null);
});

test('formErrorSummary lists errors with anchors (50551)', () => {
  const s = formErrorSummary([
    { fieldId: 'target', label: 'Target URL', message: 'Enter a valid URL' },
    { fieldId: 'email', label: 'Email', message: 'Required' },
  ]);
  assert.equal(s.count, 2);
  assert.ok(s.heading.includes('2 errors'));
  assert.equal(s.items[0].anchor, '#field-target');
  assert.equal(formErrorSummary([]).count, 0);
  const one = formErrorSummary([{ fieldId: 'x', message: 'bad' }]);
  assert.ok(one.heading.includes('1 error needs'));
});

test('timeoutAnnouncementCopy announces with an extend option (50552)', () => {
  const c = timeoutAnnouncementCopy(2);
  assert.equal(c.announcement, 'Your session expires in 2 minutes.');
  assert.equal(c.extendLabel, SESSION_EXTEND_COPY.extendLabel);
  assert.equal(timeoutAnnouncementCopy(0).announcement, SESSION_EXTEND_COPY.expired);
  assert.equal(timeoutAnnouncementCopy(1).announcement, 'Your session expires in 1 minute.');
});

test('keyboard date entry validates YYYY-MM-DD (50553)', () => {
  const props = keyboardDateProps();
  assert.equal(props.inputMode, 'numeric');
  assert.ok(props.placeholder.includes('YYYY'));
  assert.deepEqual(parseDateInput('2026-10-07'), { ok: true, iso: '2026-10-07' });
  assert.equal(parseDateInput('2026-02-30').ok, false);
  assert.equal(parseDateInput('10/07/2026').ok, false);
});

test('readability settings default to 1.5 line-height (50554)', () => {
  assert.equal(READABILITY_DEFAULTS.lineHeight, 1.5);
  const style = readabilityStyle({});
  assert.equal(style.lineHeight, 1.5);
  assert.ok(style.letterSpacing);
  const custom = readabilityStyle({ lineHeight: 1.8 });
  assert.equal(custom.lineHeight, 1.8);
});

test('dyslexia toggle resolves a real font stack (50555)', () => {
  assert.ok(DYSLEXIA_FONT_STACK.includes('OpenDyslexic'));
  assert.equal(dyslexiaClass(true), 'a11y3-dyslexia');
  assert.equal(dyslexiaClass(false), '');
});

test('expandAcronyms expands on first use (50556)', () => {
  const { text, expanded } = expandAcronyms('Found an SSRF and an XSS issue');
  assert.ok(text.includes('SSRF (server-side request forgery)'));
  assert.ok(text.includes('XSS (cross-site scripting)'));
  assert.deepEqual(expanded.sort(), ['SSRF', 'XSS']);
  assert.ok(Object.keys(ACRONYM_MAP).length >= 8);
  const twice = expandAcronyms('SSRF then SSRF');
  assert.equal(twice.text.match(/server-side request forgery/g).length, 1); // first use only
});

test('scrollMarginFor clears the sticky header + gap (50557)', () => {
  assert.equal(scrollMarginFor(64, 8), '72px');
  assert.equal(scrollMarginFor(0, 0), '0px');
});

test('bulkResultAnnouncement reads "24 findings marked reviewed" (50558)', () => {
  assert.equal(bulkResultAnnouncement('marked reviewed', 24), '24 findings marked reviewed');
  assert.equal(bulkResultAnnouncement('dismissed', 1), '1 finding dismissed');
});

test('A11Y_STATEMENT names WCAG 2.2 AA + a feedback channel (50559)', () => {
  assert.equal(A11Y_STATEMENT.conformance, 'WCAG 2.2 AA');
  assert.ok(A11Y_STATEMENT.commitments.length >= 5);
  assert.ok(A11Y_STATEMENT.feedbackChannel.href.startsWith('https://'));
});

test('NEW_CARD_SLIDE_SPEC is 300ms ease-out (50560)', () => {
  assert.equal(NEW_CARD_SLIDE_SPEC.durationMs, 300);
  assert.equal(NEW_CARD_SLIDE_SPEC.easing, 'ease-out');
  assert.equal(NEW_CARD_SLIDE_SPEC.severityFlash, true);
  assert.equal(NEW_CARD_SLIDE_SPEC.disabledUnderReducedMotion, true);
});
