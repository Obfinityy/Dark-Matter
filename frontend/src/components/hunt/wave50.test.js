/**
 * wave50.test.js — Infinity AI · Dark-Matter · Wave 50
 * Run: node --test frontend/src/components/hunt/wave50.test.js
 * Tests the two pure core modules only (no JSX imported here).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

import * as R2 from './mobileRound2Core.js';
import * as MW from './mobileWatchCore.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const NEW_FILES = [
  'mobileRound2Core.js', 'mobileWatchCore.js',
  'MobileRound2.jsx', 'MobileWatch.jsx',
  'Wave50.css', 'wave50.test.js',
];

describe('mobileRound2Core registry', () => {
  test('lists all 20 mobile round-2 ideas 51961–51980, zero skips', () => {
    assert.equal(R2.WAVE50_MR2_IDEAS.length, 20);
    const ids = R2.WAVE50_MR2_IDEAS.map((i) => i.id);
    for (let id = 51961; id <= 51980; id++) assert.ok(ids.includes(id), `missing idea ${id}`);
    assert.equal(new Set(ids).size, 20, 'no duplicate ids');
    assert.ok(R2.WAVE50_MR2_IDEAS.every((i) => i.title && i.title.length > 0), 'every idea has a title');
  });
});

describe('mobileWatchCore registry', () => {
  test('lists all 20 mobile watch ideas 51981–52000, zero skips', () => {
    assert.equal(MW.WAVE50_MW_IDEAS.length, 20);
    const ids = MW.WAVE50_MW_IDEAS.map((i) => i.id);
    for (let id = 51981; id <= 52000; id++) assert.ok(ids.includes(id), `missing idea ${id}`);
    assert.equal(new Set(ids).size, 20, 'no duplicate ids');
    assert.ok(MW.WAVE50_MW_IDEAS.every((i) => i.title && i.title.length > 0), 'every idea has a title');
  });
});

describe('mobileRound2Core spot checks', () => {
  test('51961 normalizeSnapshot compacts findings and counts severity', () => {
    const s = R2.normalizeSnapshot({ huntId: 'h1', status: 'running', findings: [
      { id: 'a', title: 'XSS', severity: 'high' }, { id: 'b', title: 'Open redirect', severity: 'high' },
      { id: 'c', title: 'Info', severity: 'info' },
    ]});
    assert.equal(s.summary.findings, 3);
    assert.equal(s.summary.severity.high, 2);
    assert.equal(s.topFindings.length, 3);
  });
  test('51962 swipe-triage reducer applies confirm/dismiss/escalate', () => {
    const items = [{ id: 'f1', title: 'XSS' }];
    const r = R2.reduceSwipeTriage(items, { findingId: 'f1', swipe: 'swipe-right' });
    assert.equal(r.applied, true);
    assert.equal(r.state[0].triage, 'confirm');
    const bad = R2.reduceSwipeTriage(items, { findingId: 'f1', swipe: 'swipe-down' });
    assert.equal(bad.applied, false);
  });
  test('51963 offline cache store/retrieve flags staleness', () => {
    const now = Date.now();
    const c = R2.storeSnapshotCache([], { huntId: 'h1' }, 30, now);
    const fresh = R2.retrieveSnapshotCache(c, now + 5 * 60000);
    assert.equal(fresh.hit, true);
    assert.equal(fresh.stale, false);
    const stale = R2.retrieveSnapshotCache(c, now + 60 * 60000);
    assert.equal(stale.stale, true);
    assert.equal(R2.retrieveSnapshotCache([]).hit, false);
  });
  test('51964 biometric gate locks when unenrolled', () => {
    const locked = R2.evaluateBiometricGate({ requireBiometric: true, biometricEnrolled: false });
    assert.equal(locked.locked, true);
    const open = R2.evaluateBiometricGate({ requireBiometric: true, biometricEnrolled: true, biometricUnlock: true });
    assert.equal(open.locked, false);
    assert.equal(open.method, 'biometric');
  });
  test('51965 quick actions include pause/status/snapshot', () => {
    const qa = R2.buildQuickActions({ status: 'running', canEscalate: true });
    assert.ok(qa.actions.map((a) => a.id).includes('snapshot'));
    assert.equal(qa.count, 4);
  });
  test('51966 night theme tokens meet contrast floor', () => {
    const t = R2.buildNightThemeTokens();
    assert.ok(t.minContrastRatio >= 4.5);
    assert.ok(t.background.startsWith('#0'));
    assert.ok(t.severity.critical);
  });
  test('51967 data saver redacts secrets and strips evidence', () => {
    const out = R2.applyDataSaver({ title: 'x', token: 'abc', evidence: 'big' }, { redactSecrets: true, stripEvidence: true });
    assert.equal(out.payload.token, '[redacted]');
    assert.ok(!('evidence' in out.payload));
    assert.equal(out.dataSaver, true);
  });
  test('51968 battery saver escalates polling as battery drops', () => {
    assert.equal(R2.scheduleBatterySaver(80).intervalSeconds, 15);
    assert.equal(R2.scheduleBatterySaver(30).mode, 'balanced');
    assert.equal(R2.scheduleBatterySaver(10).intervalSeconds, 300);
    assert.equal(R2.scheduleBatterySaver(10, true).mode, 'normal');
  });
  test('51969 widget stack keeps only valid types', () => {
    const s = R2.buildWidgetStack([{ type: 'status' }, { type: 'bogus' }]);
    assert.equal(s.count, 1);
  });
  test('51970/51971 watch alert payloads are glanceable', () => {
    assert.equal(R2.buildAppleWatchAlert({ severity: 'critical' }).platform, 'watchos');
    assert.equal(R2.buildWearOsAlert({ severity: 'low' }).glanceable, true);
  });
  test('51972 tablet two-pane at 1280px', () => {
    const l = R2.buildTabletLayout({ width: 1280, selectedId: 'f1' });
    assert.equal(l.twoPane, true);
    assert.equal(l.master.widthRatio, 0.38);
    assert.equal(R2.buildTabletLayout({ width: 400 }).twoPane, false);
  });
  test('51973 landscape spec detects orientation', () => {
    assert.equal(R2.buildLandscapeLayout({ width: 844, height: 390 }).orientation, 'landscape');
    assert.equal(R2.buildLandscapeLayout({ width: 390, height: 844 }).columns, 1);
  });
  test('51974 share payload builds text and url', () => {
    const p = R2.buildSharePayload({ title: 'Finding', summary: 'SQLi', url: 'https://x' });
    assert.ok(p.text.includes('SQLi'));
    assert.equal(p.target, 'system-sheet');
  });
  test('51975 markup spec keeps only valid tools', () => {
    const m = R2.buildMarkupSpec([{ tool: 'arrow', x: 1, y: 2 }, { tool: 'crayon' }]);
    assert.equal(m.count, 1);
  });
  test('51976 comment thread appends', () => {
    const t = R2.buildCommentThread('f1', []);
    const t2 = R2.appendComment(t, { author: 'You', body: 'confirmed' });
    assert.equal(t2.count, 1);
    assert.equal(t2.comments[0].body, 'confirmed');
  });
  test('51977 steering command flags approval for escalate-scope', () => {
    const c = R2.buildSteeringCommand('escalate-scope', 'h1');
    assert.equal(c.requiresApproval, true);
    assert.equal(R2.buildSteeringCommand('launch-nukes', 'h1').valid, false);
  });
  test('51978 strategy picker selects valid strategies', () => {
    const opts = R2.listStrategyOptions('stealth');
    assert.equal(opts.filter((o) => o.selected).length, 1);
    assert.equal(R2.selectStrategy('balanced', 'aggressive').selected, 'aggressive');
    assert.equal(R2.selectStrategy('balanced', 'nope').selected, 'balanced');
  });
  test('51979 test request requires hunt/check/target', () => {
    const r = R2.buildTestRequest('h1', 'xss', 'https://a.example/');
    assert.equal(r.valid, true);
    assert.equal(R2.buildTestRequest(null, 'xss', 'https://a.example/').valid, false);
  });
  test('51980 confidence view bands and averages', () => {
    const v = R2.buildConfidenceView([{ id: 'a', title: 'S', confidence: 90 }, { id: 'b', title: 'O', confidence: 30 }]);
    assert.equal(v.findings[0].band, 'high');
    assert.equal(v.findings[1].band, 'low');
    assert.equal(v.average, 60);
  });
});

describe('mobileWatchCore spot checks', () => {
  test('51981 resource monitor flags over-budget and strained cpu', () => {
    const r = MW.buildResourceMonitor({ cpuPercent: 95, memoryMb: 800, costUsd: 12, budgetUsd: 10 });
    assert.equal(r.overBudget, true);
    assert.equal(r.health, 'strained');
  });
  test('51982 hunt switcher marks the active hunt', () => {
    const s = MW.buildHuntSwitcher([{ id: 'h1', name: 'a', status: 'running' }], 'h1');
    assert.equal(s.hunts[0].active, true);
    assert.equal(s.activeId, 'h1');
  });
  test('51983 onboarding tour has 5 ordered steps', () => {
    const t = MW.buildOnboardingTour();
    assert.equal(t.length, 5);
    assert.equal(t[0].step, 1);
  });
  test('51984 a11y spec targets both screen readers', () => {
    const a = MW.buildA11ySpec('Pause', 'Pause the hunt');
    assert.deepEqual(a.screenReaders, ['VoiceOver', 'TalkBack']);
    assert.ok(a.minTouchTargetPx >= 48);
  });
  test('51985 language pack selection', () => {
    const packs = MW.listLanguagePacks('hi');
    assert.ok(packs.find((p) => p.id === 'hi').selected);
    assert.equal(MW.selectLanguage('en', 'ar').language.rtl, true);
    assert.equal(MW.selectLanguage('en', 'xx').changed, false);
  });
  test('51986 quiet hours across midnight', () => {
    const night = MW.evaluateQuietHours(new Date(2026, 9, 8, 23), { enabled: true, startHour: 22, endHour: 7 });
    assert.equal(night.quiet, true);
    const day = MW.evaluateQuietHours(new Date(2026, 9, 8, 12), { enabled: true, startHour: 22, endHour: 7 });
    assert.equal(day.quiet, false);
  });
  test('51987 emergency controls within two taps', () => {
    const e = MW.buildEmergencyControls();
    assert.equal(e.withinTwoTaps, true);
    assert.ok(e.controls.every((c) => c.taps <= 2));
    assert.ok(e.controls.some((c) => c.id === 'kill-switch'));
  });
  test('51988 handoff payload validates hunt id', () => {
    assert.equal(MW.buildHandoffPayload({ huntId: 'h1' }).valid, true);
    assert.equal(MW.buildHandoffPayload({}).valid, false);
  });
  test('51989 deep link encodes view/hunt/params', () => {
    const l = MW.buildDeepLink({ view: 'findings', huntId: 'h1', params: { sev: 'high' } });
    assert.ok(l.url.includes('darkmatter:/findings/h1'));
    assert.ok(l.url.includes('sev=high'));
    assert.equal(MW.buildDeepLink({}).valid, false);
  });
  test('51990 biometric approval requires match', () => {
    const ok = MW.evaluateBiometricApproval({ biometricEnrolled: true, biometricMatch: true, action: 'approve:x' });
    assert.equal(ok.approved, true);
    assert.equal(ok.auditTrail.length, 1);
    assert.equal(MW.evaluateBiometricApproval({ biometricEnrolled: true, biometricMatch: false, action: 'approve:x' }).approved, false);
  });
  test('51991 mobile hunt creation validates target and authorization', () => {
    const r = MW.buildMobileHuntCreation({ target: 'shop.example', authorized: true });
    assert.equal(r.valid, true);
    assert.equal(MW.buildMobileHuntCreation({ target: '', authorized: true }).valid, false);
    assert.equal(MW.buildMobileHuntCreation({ target: 'shop.example', authorized: false }).valid, false);
  });
  test('51992 report export descriptor falls back to pdf', () => {
    const d = MW.buildReportExportDescriptor('h1', 'docx');
    assert.equal(d.format, 'pdf');
    assert.ok(d.filename.endsWith('.pdf'));
  });
  test('51993 team-chat normalizer parses commands and mentions', () => {
    const n = MW.normalizeTeamChatMessage('/pause now @ops-team');
    assert.equal(n.isCommand, true);
    assert.equal(n.command, 'pause');
    assert.deepEqual(n.mentions, ['ops-team']);
    assert.equal(MW.normalizeTeamChatMessage('   ').empty, true);
  });
  test('51994 calendar sync payload counts events', () => {
    const c = MW.buildCalendarSyncPayload([{ title: 'Recon done', startsAt: '2026-10-08T14:00:00Z' }]);
    assert.equal(c.count, 1);
    assert.equal(c.provider, 'system-calendar');
  });
  test('51995 assistant intents match phrases', () => {
    assert.equal(MW.matchShortcutIntent('please pause the hunt').action, 'pause');
    assert.equal(MW.matchShortcutIntent('play music'), null);
    assert.equal(MW.listShortcutIntents().length, 3);
  });
  test('51996 focus mode keeps only urgent/critical items', () => {
    const items = [{ severity: 'critical' }, { severity: 'low' }];
    const r = MW.applyFocusMode(items, { enabled: true });
    assert.equal(r.count, 1);
    assert.equal(r.hiddenCount, 1);
    assert.equal(MW.applyFocusMode(items, { enabled: false }).filtered, false);
  });
  test('51997 complications payload has 3 slots', () => {
    const c = MW.buildComplicationsPayload({ status: 'running', findingsCount: 5, etaMinutes: 20 });
    assert.equal(c.complications.length, 3);
  });
  test('51998 data export descriptor', () => {
    const d = MW.buildDataExportDescriptor('h1', 'csv', 'findings');
    assert.equal(d.format, 'csv');
    assert.equal(d.scope, 'findings');
  });
  test('51999 feedback report clamps rating and requires notes', () => {
    const r = MW.buildFeedbackReport({ huntId: 'h1', rating: 9, notes: 'good' });
    assert.equal(r.rating, 5);
    assert.equal(r.valid, true);
    assert.equal(MW.buildFeedbackReport({ huntId: 'h1', rating: 3, notes: '' }).valid, false);
  });
  test('52000 performance budget fails on slow render', () => {
    const ok = MW.checkPerformanceBudget({ findings: 1000, renderMs: 80, memoryMb: 100, virtualized: true });
    assert.equal(ok.withinBudget, true);
    const bad = MW.checkPerformanceBudget({ findings: 1000, renderMs: 400, memoryMb: 100, virtualized: true });
    assert.equal(bad.withinBudget, false);
    const noVirt = MW.checkPerformanceBudget({ findings: 1000, renderMs: 80, memoryMb: 100, virtualized: false });
    assert.equal(noVirt.withinBudget, false);
  });
});

describe('JSX parse check', () => {
  test('MobileRound2.jsx and MobileWatch.jsx parse as valid JSX via esbuild', () => {
    const require = createRequire(import.meta.url);
    let esbuild = null;
    try {
      esbuild = require('esbuild');
    } catch {
      esbuild = null;
    }
    if (!esbuild) {
      const npxPath = join(HERE, '..', '..', '..', 'node_modules', '.bin', 'esbuild');
      if (!existsSync(npxPath)) {
        console.log('esbuild not available — JSX parse check skipped gracefully');
        return;
      }
      throw new Error('esbuild binary present but require failed');
    }
    for (const f of ['MobileRound2.jsx', 'MobileWatch.jsx']) {
      const code = readFileSync(join(HERE, f), 'utf8');
      esbuild.transformSync(code, { loader: 'jsx' });
    }
  });
});

describe('no-debris audit', () => {
  test('none of the 5 product files contain TODO/FIXME/mock/demo placeholder text', () => {
    const pattern = /\b(todo|fixme|xxx|hack|mock|lorem|demo)\b/i;
    for (const f of NEW_FILES.filter((x) => x !== 'wave50.test.js')) {
      const content = readFileSync(join(HERE, f), 'utf8');
      const hit = content.match(pattern);
      assert.ok(!hit, `${f} contains debris marker: "${hit && hit[0]}"`);
    }
  });
  test('Wave50.css has zero @keyframes, transitions, and animations', () => {
    const css = readFileSync(join(HERE, 'Wave50.css'), 'utf8');
    assert.ok(!css.includes('@keyframes'), 'no @keyframes allowed');
    assert.ok(!/transition\s*:/i.test(css), 'no transitions allowed');
    assert.ok(!/animation\s*:/i.test(css), 'no animations allowed');
  });
  test('Wave50.css uses only scoped prefixes .mr2-* and .mw50-*', () => {
    const css = readFileSync(join(HERE, 'Wave50.css'), 'utf8');
    const classSelectors = css.match(/^\.[a-zA-Z][a-zA-Z0-9_-]*/gm) || [];
    const rogue = classSelectors.filter((c) => !c.startsWith('.mr2-') && !c.startsWith('.mw50-'));
    assert.deepEqual(rogue, [], `unscoped selectors: ${rogue.join(', ')}`);
  });
  test('Infinity AI branding only — no other worker name in product files', () => {
    const productFiles = NEW_FILES.filter((f) => f !== 'wave50.test.js');
    for (const f of productFiles) {
      const content = readFileSync(join(HERE, f), 'utf8');
      assert.ok(!/\b[mM]use\b/.test(content), `${f} mentions the forbidden worker name`);
    }
  });
});
