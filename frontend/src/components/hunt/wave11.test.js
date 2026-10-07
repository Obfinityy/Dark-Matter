/**
 * wave11.test.js — Forge wave 11, ideas 50401–50440.
 *
 * Node-runnable checks (pure logic + registry honesty + export presence).
 * Run: node --test frontend/src/components/hunt/wave11.test.js
 * (Must be run from repo root; resolves via relative paths.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const core = await import('./microcopyCore.js');

function extractIdeas(src, varName) {
  const block = src.match(new RegExp(`export const ${varName} = \\[([\\s\\S]*?)\\];`));
  assert.ok(block, `${varName} registry not found in source`);
  return [...block[1].matchAll(/\{\s*idea:\s*(\d+),\s*name:\s*'([^']+)',\s*in:\s*'([^']+)'/g)].map(
    (m) => ({ idea: Number(m[1]), name: m[2], in: m[3] })
  );
}

/* Registry honesty: all 40 ideas 50401–50440 mapped exactly once ----------- */

test('registry covers ideas 50401–50440 exactly', () => {
  const ideas = extractIdeas(
    fs.readFileSync(path.join(here, 'microcopyCore.js'), 'utf8'),
    'WAVE11_IDEAS'
  );
  assert.equal(ideas.length, 40);
  const nums = ideas.map((i) => i.idea).sort((a, b) => a - b);
  for (let n = 50401; n <= 50440; n++) assert.ok(nums.includes(n), `missing idea ${n}`);
  assert.equal(new Set(nums).size, 40, 'duplicate idea numbers');
  for (const i of ideas) assert.ok(i.in && i.in.length > 3, `idea ${i.idea} has no implementation mapping`);
});

/* 50403 shortcut tooltips --------------------------------------------------- */

test('shortcutTooltip appends the key', () => {
  assert.equal(core.shortcutTooltip('Mark reviewed', 'R'), 'Mark reviewed (R)');
  assert.equal(core.shortcutTooltip('Save'), 'Save');
});

/* 50406 ETA basis -------------------------------------------------------------- */

test('etaBasisText cites hunt history', () => {
  assert.match(core.etaBasisText(12), /last 12 hunts/);
  assert.match(core.etaBasisText(1), /last 1 hunt'/);
  assert.match(core.etaBasisText(0), /typical hunt phase speeds/);
});

/* 50407 FP explainer ------------------------------------------------------------ */

test('fpTagExplainer expands signals', () => {
  const r = core.fpTagExplainer(['low-confidence', 'mystery-signal']);
  assert.equal(r.signals.length, 2);
  assert.match(r.signals[0].text, /auto-confirm threshold/);
  assert.match(r.signals[1].text, /false-positive filter/);
});

/* 50408 CVSS 3.1 — verify against FIRST spec examples ---------------------------- */

test('cvss31Score matches known vectors', () => {
  // AV:N/AC:H/PR:N/UI:N/S:C/C:H/I:H/A:H -> 9.0 Critical (hand-verified:
  // ISCBase 0.9148, impact 6.047, exploitability 2.224, roundup(1.08*8.271))
  const r1 = core.cvss31Score({ AV: 'N', AC: 'H', PR: 'N', UI: 'N', S: 'C', C: 'H', I: 'H', A: 'H' });
  assert.equal(r1.score, 9.0);
  assert.equal(r1.severity, 'Critical');
  // Classic worst case -> 10.0 Critical
  const r2 = core.cvss31Score({ AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'C', C: 'H', I: 'H', A: 'H' });
  assert.equal(r2.score, 10.0);
  assert.equal(r2.severity, 'Critical');
  // Scope-unchanged partial -> 7.5 High (hand-verified: roundup(7.4823))
  const r3 = core.cvss31Score({ AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'H', I: 'N', A: 'N' });
  assert.equal(r3.score, 7.5);
  assert.equal(r3.severity, 'High');
  // All none -> 0.0 None
  const r4 = core.cvss31Score({ AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'N', I: 'N', A: 'N' });
  assert.equal(r4.score, 0.0);
  assert.equal(r4.severity, 'None');
});

test('parseCvss31Vector round-trips through cvss31Vector', () => {
  const v = 'CVSS:3.1/AV:A/AC:H/PR:L/UI:R/S:U/C:L/I:N/A:N';
  const m = core.parseCvss31Vector(v);
  assert.equal(core.cvss31Vector(m), v);
  const bad = core.parseCvss31Vector('garbage');
  assert.deepEqual(bad, { AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'N', I: 'N', A: 'N' });
});

/* 50412 why-links ------------------------------------------------------------------ */

test('triggerRuleText explains rules', () => {
  assert.match(core.triggerRuleText('hunt-stalled'), /no progress for 10 minutes/);
  assert.match(core.triggerRuleText('nope'), /rule on your account/);
});

/* 50413 snapshot labels ---------------------------------------------------------------- */

test('snapshotLabel renders relative time', () => {
  const now = Date.now();
  assert.match(core.snapshotLabel(now - 30_000, now), /just now/);
  assert.match(core.snapshotLabel(now - 2 * 60_000, now), /2 min ago/);
  assert.match(core.snapshotLabel(now - 3 * 3_600_000, now), /3 h ago/);
});

/* 50414 cron helper ---------------------------------------------------------------------- */

test('cronToEnglish decodes common schedules', () => {
  assert.equal(core.cronToEnglish('*/15 * * * *'), 'Every 15 minutes.');
  assert.equal(core.cronToEnglish('30 * * * *'), 'Every hour at :30.');
  assert.equal(core.cronToEnglish('0 9 * * *'), 'Every day at 09:00.');
  assert.equal(core.cronToEnglish('0 9 * * 1'), 'Every Monday at 09:00.');
  assert.equal(core.cronToEnglish('0 9 * * 1,3,5'), 'Every Monday, Wednesday, Friday at 09:00.');
  assert.equal(core.cronToEnglish('0 9 1 * *'), 'On day 1 of every month at 09:00.');
  assert.equal(core.cronToEnglish('not a cron'), 'Custom schedule — expression kept as-is.');
});

/* 50415 dedup ----------------------------------------------------------------------------- */

test('dedupText counts merges', () => {
  assert.match(core.dedupText(2, 'sig-match'), /Merged with 2 similar findings/);
  assert.match(core.dedupText(2, 'sig-match'), /rule: sig-match/);
  assert.match(core.dedupText(1), /Merged with 1 similar finding\./);
});

/* 50418 tracking params ------------------------------------------------------------------------ */

test('trackingParamHint detects utm params', () => {
  const h = core.trackingParamHint('https://example.com/?utm_source=x&fbclid=y&a=1');
  assert.ok(h && h.includes('2 tracking parameters'));
  assert.equal(core.trackingParamHint('https://example.com/?a=1'), null);
  assert.equal(core.trackingParamHint('not a url'), null);
});

/* 50420 fix-oriented validation --------------------------------------------------------------------- */

test('validateTargetInput explains the fix', () => {
  assert.deepEqual(core.validateTargetInput(''), { ok: false, error: 'Target is empty.', fix: 'Paste a full URL, e.g. https://example.com' });
  const noScheme = core.validateTargetInput('example.com');
  assert.equal(noScheme.ok, false);
  assert.match(noScheme.fix, /Add https:\/\//);
  const badScheme = core.validateTargetInput('ftp://example.com');
  assert.match(badScheme.fix, /http:\/\/ or https:\/\//);
  const spaces = core.validateTargetInput('https://exa mple.com');
  assert.match(spaces.error, /spaces/);
  assert.equal(core.validateTargetInput('https://example.com/admin').ok, true);
});

/* 50423 collaborators ------------------------------------------------------------------------------- */

test('collaboratorLine formats name, role, action', () => {
  assert.equal(core.collaboratorLine({ name: 'Ava', role: 'editor', lastAction: 'flagged FP' }), 'Ava (editor) — last: flagged FP');
  assert.equal(core.collaboratorLine({}), 'Unknown (viewer)');
});

/* 50424 confidence slider ------------------------------------------------------------------------------- */

test('confidenceSliderHelp warns below 60', () => {
  assert.match(core.confidenceSliderHelp(40), /needs human review/);
  assert.match(core.confidenceSliderHelp(70), /balanced/);
  assert.match(core.confidenceSliderHelp(95), /high-confidence/);
});

/* 50425 findings badge ------------------------------------------------------------------------------------- */

test('findingsBadgeText handles counts', () => {
  assert.match(core.findingsBadgeText(12), /12 new findings since/);
  assert.match(core.findingsBadgeText(1), /1 new finding since/);
  assert.match(core.findingsBadgeText(0), /No new findings/);
});

/* 50429 terminal copy ------------------------------------------------------------------------------------------- */

test('terminalCopyText distinguishes timestamp mode', () => {
  assert.match(core.terminalCopyText(true), /including timestamps/);
  assert.match(core.terminalCopyText(false), /without timestamps/);
});

/* 50430 glossary ----------------------------------------------------------------------------------------------------- */

test('glossary defines jargon', () => {
  assert.match(core.glossary('ssrf'), /Server-Side Request Forgery/);
  assert.match(core.glossary('IDOR'), /Insecure Direct Object Reference/);
  assert.equal(core.glossary('nonsense'), null);
});

/* 50432 bulk hint ----------------------------------------------------------------------------------------------------------- */

test('bulkHint counts selection', () => {
  assert.equal(core.bulkHint(7), 'Applies to the 7 selected findings. Nothing else is touched.');
  assert.equal(core.bulkHint(1), 'Applies to the 1 selected finding. Nothing else is touched.');
});

/* 50433 SLA -------------------------------------------------------------------------------------------------------------------------------- */

test('slaPolicyText renders policy', () => {
  assert.match(core.slaPolicyText({}), /critical 24h/);
  assert.match(core.slaPolicyText({ critical: '12h', high: '48h' }), /critical: 12h · high: 48h/);
});

/* 50435 huntability ------------------------------------------------------------------------------------------------------------------------------- */

test('huntabilityScore grades targets', () => {
  const good = core.huntabilityScore('https://app.example.com/login?next=1&utm_source=x');
  assert.ok(good.score >= 75, `expected high score, got ${good.score}`);
  assert.equal(good.label, 'Highly huntable');
  assert.ok(good.reasons.length >= 3);
  const bad = core.huntabilityScore('ftp://example.com');
  assert.equal(bad.label, 'Unsupported');
  assert.equal(bad.score, 10);
  const empty = core.huntabilityScore('');
  assert.equal(empty.score, 0);
  const deep = core.huntabilityScore('http://example.com/a/b/c/d/e');
  assert.ok(deep.score < good.score, 'deep http path should score lower than shallow https');
});

/* 50436 bell --------------------------------------------------------------------------------------------------------------------------------------------- */

test('bellTooltip groups by category', () => {
  const t = core.bellTooltip([
    { category: 'findings' },
    { category: 'findings' },
    { category: 'system' },
  ]);
  assert.match(t, /3 notifications/);
  assert.match(t, /2 findings/);
  assert.match(t, /1 system/);
  assert.equal(core.bellTooltip([]), 'No notifications.');
});

/* 50437 votes ---------------------------------------------------------------------------------------------------------------------------------------------- */

test('recordHelpVote accumulates and voteRatio computes', () => {
  let store = core.recordHelpVote({}, 'doc-a', true);
  store = core.recordHelpVote(store, 'doc-a', true);
  store = core.recordHelpVote(store, 'doc-a', false);
  assert.deepEqual(store['doc-a'], { helpful: 2, notHelpful: 1 });
  assert.equal(core.voteRatio(store['doc-a']), 67);
  assert.equal(core.voteRatio(undefined), null);
});

/* 50439 drop zones ----------------------------------------------------------------------------------------------------------------------------------------------- */

test('dropZoneHint lists types and size', () => {
  assert.match(core.dropZoneHint(['.pdf', '.md'], 10 * 1024 * 1024), /\.pdf, \.md/);
  assert.match(core.dropZoneHint(['.pdf'], 10 * 1024 * 1024), /10\.0 MB/);
  assert.match(core.dropZoneHint([], 0), /any file/);
});

/* 50440 avatar mood ------------------------------------------------------------------------------------------------------------------------------------------------ */

test('avatarMoodText covers moods', () => {
  assert.match(core.avatarMoodText('focused'), /actively working/);
  assert.match(core.avatarMoodText('stuck'), /blocker/);
  assert.match(core.avatarMoodText('unknown'), /idle/);
});

/* 50405 help docs ------------------------------------------------------------------------------------------------------------------------------------------------------- */

test('helpDocsFor returns per-page docs', () => {
  assert.ok(core.helpDocsFor('hunt').length >= 3);
  assert.deepEqual(core.helpDocsFor('nope'), []);
});

/* JSX export presence (parse source; CSS is not node-importable) --------------------------------------------------------------- */

const EXPECTED_COMPONENTS = [
  'SmartTooltip', 'PauseButtonTooltip', 'EmptyPocHint', 'ShortcutTooltip',
  'ChainIconTooltip', 'EtaTooltip', 'FalsePositiveTagExplainer', 'CvssBreakdown',
  'TierBadgeTooltip', 'ScopeInputGuidance', 'WorkerLaneTooltip', 'WhyLink',
  'SnapshotTooltip', 'CronHelper', 'DedupTooltip', 'ScrubberHelpPopover',
  'ModelSlotTooltips', 'TrackingParamHint', 'AskAgentExamples', 'TargetInputWithHelp',
  'ExportFormatTooltip', 'ComplianceBadge', 'CollaboratorAvatar', 'ConfidenceSlider',
  'FindingsBadgeTooltip', 'RegenerateHint', 'ArchivedHuntTooltip', 'WhatHappensNext',
  'TerminalCopyButton', 'GlossaryTerm', 'ThemeHoverPreviews', 'BulkActionHint',
  'SlaBadgeTooltip', 'WidgetHelpAffordance', 'HuntabilityMeter', 'BellTooltip',
  'DiffLegendTooltip', 'DropZoneHints', 'AvatarMoodTooltip',
];

test('MicrocopyTooltips.jsx exports all 40 components (38 idea components + SmartTooltip/HelpPopover base)', () => {
  const src = fs.readFileSync(path.join(here, 'MicrocopyTooltips.jsx'), 'utf8');
  assert.equal(EXPECTED_COMPONENTS.length, 39);
  for (const name of EXPECTED_COMPONENTS) {
    assert.ok(new RegExp(`export function ${name}\\b`).test(src), `missing export ${name}`);
  }
  assert.ok(/export function HelpPopover\b/.test(src), 'missing export HelpPopover');
});

test('HelpPanel.jsx exports HelpPanel and HelpfulVote', () => {
  const src = fs.readFileSync(path.join(here, 'HelpPanel.jsx'), 'utf8');
  assert.ok(/export function HelpPanel\b/.test(src), 'missing HelpPanel');
  assert.ok(/export function HelpfulVote\b/.test(src), 'missing HelpfulVote');
});
