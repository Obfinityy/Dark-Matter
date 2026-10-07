/**
 * wave29.test.js — wave 29 (ideas 51121–51160): mid-hunt steering suite.
 * Tests steeringCore.js pure logic, WAVE29_IDEAS registry completeness,
 * and the Steering.css audit (scoped classes, zero keyframes).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WAVE29_IDEAS, WAVE29_START, WAVE29_END,
  INTENSITY_LEVELS, STEERING_PRESETS, TARGET_PROFILES,
  addScopeTarget, removeScopeTarget, switchTargetProfile,
  injectWordlist, setRateCap, setIntensity, redirectEndpoint,
  pauseModule, resumeModule, reorderPhases, extendTimeBudget,
  wrapUp, parseSteeringCommand, reorderPriorities, applyPreset,
  undoSteering, previewSteering, estimateImpact, logSteering,
  proposeCoSteering, resolveCoSteering, saveTemplate, applyTemplate,
  addConditionalRule, evaluateRules, setTimeBoxedFocus,
  steerFromFinding, steerFromLog, parseSpokenCommand,
  applyPriorityBoard, buildSteeringApiPayload, validateSteeringApiPayload,
  applyWhilePaused, needsApproval, agentPushback, suggestSteering,
  setBandwidthCap, bandwidthRemaining, setStealthMode, setDepthLimit,
  retestOnChange, dryRun, inheritPriority, setCooldown, cooldownActive,
  toggleModule, setFocusWindow, focusSplit,
} from './steeringCore.js';

const here = dirname(fileURLToPath(import.meta.url));

// --- registry completeness ------------------------------------------------
test('registry covers all 40 ideas, 51121–51160, zero skips', () => {
  assert.equal(WAVE29_START, 51121);
  assert.equal(WAVE29_END, 51160);
  assert.equal(WAVE29_IDEAS.length, 40);
  const ids = WAVE29_IDEAS.map(([id]) => id);
  for (let i = 51121; i <= 51160; i++) assert.ok(ids.includes(i), `missing ${i}`);
  assert.equal(new Set(ids).size, 40, 'duplicate ids');
  for (const [id, slug, desc] of WAVE29_IDEAS) {
    assert.ok(slug && slug.length > 3, `bad slug ${id}`);
    assert.ok(desc && desc.length > 10, `bad desc ${id}`);
  }
});

// --- 51121 scope addition ---------------------------------------------------
test('addScopeTarget adds new target with acknowledgement', () => {
  const r = addScopeTarget(['a.com'], 'b.com');
  assert.deepEqual(r.scope, ['a.com', 'b.com']);
  assert.equal(r.acknowledgement.status, 'acknowledged');
  assert.equal(r.acknowledgement.added, true);
});
test('addScopeTarget ignores duplicates and blanks', () => {
  assert.equal(addScopeTarget(['a.com'], 'a.com').acknowledgement.added, false);
  assert.equal(addScopeTarget(['a.com'], '  ').acknowledgement, null);
});

// --- 51122 scope removal ----------------------------------------------------
test('removeScopeTarget removes and lists graceful halts', () => {
  const inFlight = [{ id: 1, target: 'x.com/api' }, { id: 2, target: 'y.com/' }];
  const r = removeScopeTarget(['x.com', 'y.com'], inFlight, 'x.com');
  assert.deepEqual(r.scope, ['y.com']);
  assert.equal(r.halting.length, 1);
  assert.equal(r.halting[0].halt, 'graceful');
  assert.equal(r.remaining.length, 1);
  assert.equal(r.removed, true);
});

// --- 51123 profile switch ---------------------------------------------------
test('switchTargetProfile retunes module weights for api', () => {
  const r = switchTargetProfile({ profile: 'generic' }, 'api');
  assert.equal(r.profile, 'api');
  assert.equal(r.moduleWeights.apiFuzz, 3);
  assert.equal(r.retuned, true);
});
test('switchTargetProfile rejects unknown profiles', () => {
  const p = { profile: 'generic' };
  assert.deepEqual(switchTargetProfile(p, 'nope'), p);
});

// --- 51124 wordlist injection ------------------------------------------------
test('injectWordlist registers words immediately', () => {
  const r = injectWordlist({}, { name: 'w.txt', words: ['admin', 'test', ''] });
  assert.equal(r.wordlists[0].count, 2);
  assert.equal(r.wordlists[0].active, true);
  assert.deepEqual(r.wordlistWords, ['admin', 'test']);
});

// --- 51125 rate cap ----------------------------------------------------------
test('setRateCap clamps to 1..1000 and flags throttling', () => {
  assert.equal(setRateCap({}, 5).rateCapRps, 5);
  assert.equal(setRateCap({}, 5).throttled, true);
  assert.equal(setRateCap({}, 5000).rateCapRps, 1000);
  assert.equal(setRateCap({}, 100).throttled, false);
});

// --- 51126 intensity ----------------------------------------------------------
test('setIntensity sets payloads per level, rejects bad level', () => {
  assert.equal(setIntensity({}, 'aggressive').payloadsPerCheck, 8);
  assert.equal(setIntensity({}, 'light').payloadsPerCheck, 1);
  assert.deepEqual(setIntensity({ intensity: 'normal' }, 'wild'), { intensity: 'normal' });
  assert.deepEqual(INTENSITY_LEVELS, ['light', 'normal', 'aggressive']);
});

// --- 51127 endpoint redirect ---------------------------------------------------
test('redirectEndpoint queues endpoint next', () => {
  const q = redirectEndpoint([{ endpoint: '/old' }], '/api/v2/admin');
  assert.equal(q[0].endpoint, '/api/v2/admin');
  assert.equal(q[0].priority, 'next');
});

// --- 51128 module pause ---------------------------------------------------------
test('pauseModule/resumeModule toggle one module only', () => {
  const mods = [{ name: 'a', paused: false }, { name: 'b', paused: false }];
  const paused = pauseModule(mods, 'a');
  assert.equal(paused[0].paused, true);
  assert.equal(paused[1].paused, false);
  assert.equal(resumeModule(paused, 'a')[0].paused, false);
});

// --- 51129 phase reorder ----------------------------------------------------------
test('reorderPhases moves items, ignores out-of-range', () => {
  assert.deepEqual(reorderPhases(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(reorderPhases(['a', 'b'], 5, 0), ['a', 'b']);
});

// --- 51130 time budget --------------------------------------------------------------
test('extendTimeBudget scales per-phase minutes', () => {
  const r = extendTimeBudget({ timeBudgetMin: 60, perPhaseMin: { recon: 20 } }, 60);
  assert.equal(r.timeBudgetMin, 120);
  assert.equal(r.perPhaseMin.recon, 40);
  assert.equal(r.expanded, true);
});

// --- 51131 wrap-up --------------------------------------------------------------------
test('wrapUp condenses plan into final sweep', () => {
  const r = wrapUp({}, 15);
  assert.equal(r.mode, 'wrap-up');
  assert.equal(r.wrapUpMinutes, 15);
  assert.ok(r.phases.includes('report-draft'));
});

// --- 51132 NL parser ---------------------------------------------------------------------
test('parseSteeringCommand understands key sentences', () => {
  assert.equal(parseSteeringCommand('spend more time on the API').type, 'boost-area');
  assert.equal(parseSteeringCommand('go deep').type, 'preset');
  assert.equal(parseSteeringCommand('pause the crawler').type, 'pause-module');
  assert.equal(parseSteeringCommand('add evil.com to scope').type, 'add-scope');
  assert.equal(parseSteeringCommand('finish within 20 minutes').type, 'wrap-up');
  assert.equal(parseSteeringCommand('slow down').level, 'light');
  assert.equal(parseSteeringCommand('').type, 'unknown');
  assert.equal(parseSteeringCommand('blargh wibble').type, 'unknown');
});
test('parseSteeringCommand extracts time-boxed focus', () => {
  const c = parseSteeringCommand('focus the API for the next 30 minutes');
  assert.equal(c.type, 'time-boxed-focus');
  assert.equal(c.minutes, 30);
});

// --- 51134 presets -------------------------------------------------------------------------
test('applyPreset reconfigures hunt per mode', () => {
  const wide = applyPreset({}, 'go-wide');
  assert.equal(wide.focus, 'breadth');
  const quiet = applyPreset({}, 'be-quiet');
  assert.equal(quiet.stealth, true);
  assert.equal(quiet.rateCapRps, 5);
  assert.deepEqual(applyPreset({ a: 1 }, 'nope'), { a: 1 });
  assert.deepEqual(STEERING_PRESETS, ['go-wide', 'go-deep', 'be-quiet']);
});

// --- 51135 undo ------------------------------------------------------------------------------
test('undoSteering restores previous snapshot', () => {
  const before = { intensity: 'normal' };
  const r = undoSteering([{ command: { type: 'x', raw: 'x' }, before }]);
  assert.equal(r.restored, true);
  assert.deepEqual(r.state, before);
  assert.equal(r.history.length, 0);
  assert.equal(undoSteering([]).restored, false);
});

// --- 51136 preview -----------------------------------------------------------------------------
test('previewSteering describes changes', () => {
  const p = previewSteering({ intensity: 'normal' }, { type: 'set-intensity', level: 'light' });
  assert.ok(p.changes[0].includes('normal') && p.changes[0].includes('light'));
  assert.equal(previewSteering({}, { type: 'unknown' }).empty, true);
});

// --- 51137 impact ------------------------------------------------------------------------------
test('estimateImpact returns minutes and requests', () => {
  const e = estimateImpact({ intensity: 'normal', rateCapRps: 10 }, { type: 'wrap-up', minutes: 10 });
  assert.equal(e.minutes, 10);
  assert.ok(e.requests > 0);
});

// --- 51138 history -------------------------------------------------------------------------------
test('logSteering appends sequenced entries', () => {
  const h = logSteering([], { by: 'owner', command: { type: 'x' }, summary: 's' });
  assert.equal(h[0].seq, 1);
  assert.equal(logSteering(h, { command: { type: 'y' } })[1].seq, 2);
});

// --- 51139 co-steering -----------------------------------------------------------------------------
test('proposeCoSteering / resolveCoSteering approve flow', () => {
  const ps = proposeCoSteering([], { by: 'sam', command: { type: 'preset', preset: 'go-deep' } });
  assert.equal(ps[0].status, 'pending');
  const r = resolveCoSteering(ps, ps[0].id, true);
  assert.equal(r.proposals[0].status, 'approved');
  assert.deepEqual(r.applied, { type: 'preset', preset: 'go-deep' });
  const d = resolveCoSteering(ps, ps[0].id, false);
  assert.equal(d.applied, null);
});

// --- 51140 templates ---------------------------------------------------------------------------------
test('saveTemplate / applyTemplate round-trip', () => {
  const t = saveTemplate({}, 'api-blitz', { intensity: 'aggressive' });
  const s = applyTemplate({ intensity: 'normal' }, t, 'api-blitz');
  assert.equal(s.intensity, 'aggressive');
  assert.equal(s.activeTemplate, 'api-blitz');
  assert.deepEqual(applyTemplate({ a: 1 }, t, 'missing'), { a: 1 });
});

// --- 51141 conditional rules ----------------------------------------------------------------------------
test('addConditionalRule / evaluateRules triggers on context', () => {
  const rules = addConditionalRule([], { when: 'finding-type', value: 'xss', then: 'go deep' });
  const hit = evaluateRules(rules, { findingType: 'xss' });
  assert.equal(hit.length, 1);
  assert.equal(hit[0].action, 'go deep');
  assert.equal(evaluateRules(rules, { findingType: 'sqli' }).length, 0);
});

// --- 51142 time-boxed focus ----------------------------------------------------------------------------------
test('setTimeBoxedFocus arms focus with resume', () => {
  const r = setTimeBoxedFocus({}, 'api', 30);
  assert.equal(r.focusArea, 'api');
  assert.equal(r.focusMinutes, 30);
  assert.equal(r.resumeAfter, true);
});

// --- 51143 steer-from-finding -------------------------------------------------------------------------------------
test('steerFromFinding builds boost command', () => {
  const c = steerFromFinding({ id: 'F-1', type: 'xss', area: '/search' });
  assert.equal(c.type, 'boost-area');
  assert.equal(c.fromFinding, 'F-1');
});

// --- 51144 steer-from-log --------------------------------------------------------------------------------------------
test('steerFromLog maps log lines to more/stop', () => {
  assert.equal(steerFromLog('[apiFuzz] x', 'more').type, 'boost-area');
  assert.equal(steerFromLog('[apiFuzz] x', 'stop').type, 'pause-module');
  assert.equal(steerFromLog('x', 'zzz').type, 'unknown');
});

// --- 51145 spoken -------------------------------------------------------------------------------------------------------
test('parseSpokenCommand tags via voice', () => {
  const c = parseSpokenCommand('go deep');
  assert.equal(c.via, 'voice');
  assert.equal(c.type, 'preset');
});

// --- 51146 priority board --------------------------------------------------------------------------------------------------
test('applyPriorityBoard keeps unlisted items at end', () => {
  assert.deepEqual(applyPriorityBoard(['a', 'b', 'c'], ['c', 'a']), ['c', 'a', 'b']);
});

// --- 51147 steering API -------------------------------------------------------------------------------------------------------
test('buildSteeringApiPayload / validateSteeringApiPayload', () => {
  const p = buildSteeringApiPayload({ type: 'preset', preset: 'go-deep' }, 'h1');
  assert.equal(p.op, 'steer');
  assert.equal(validateSteeringApiPayload(p).ok, true);
  assert.equal(validateSteeringApiPayload({}).ok, false);
  assert.equal(validateSteeringApiPayload({ op: 'steer' }).error, 'missing-huntId');
});

// --- 51148 steer while paused ----------------------------------------------------------------------------------------------------
test('applyWhilePaused stages strategy for resume', () => {
  const r = applyWhilePaused({ paused: true }, { intensity: 'light' });
  assert.equal(r.resumeWithNewStrategy, true);
  assert.equal(r.intensity, 'light');
});

// --- 51149 approval -----------------------------------------------------------------------------------------------------------------
test('needsApproval flags big changes', () => {
  assert.equal(needsApproval({ type: 'remove-scope' }), true);
  assert.equal(needsApproval({ type: 'wrap-up' }), true);
  assert.equal(needsApproval({ type: 'set-intensity', level: 'aggressive' }), true);
  assert.equal(needsApproval({ type: 'set-intensity', level: 'light' }), false);
  assert.equal(needsApproval(null), false);
});

// --- 51150 pushback ----------------------------------------------------------------------------------------------------------------------
test('agentPushback warns on risky removals', () => {
  const w = agentPushback({ findingCount: 3 }, { type: 'remove-scope', target: 'x.com' });
  assert.ok(w && w.includes('3 finding'));
  assert.equal(agentPushback({}, { type: 'preset', preset: 'go-wide' }), null);
});

// --- 51151 suggestions ----------------------------------------------------------------------------------------------------------------------
test('suggestSteering proposes based on state', () => {
  const s = suggestSteering({ findingCount: 5, intensity: 'normal', idleMinutes: 0, noiseComplaints: 0 });
  assert.ok(s.some((x) => x.level === 'aggressive'));
  assert.equal(suggestSteering({ findingCount: 0, idleMinutes: 0, noiseComplaints: 0 }).length, 0);
});

// --- 51152 bandwidth -----------------------------------------------------------------------------------------------------------------------------
test('setBandwidthCap / bandwidthRemaining', () => {
  const s = setBandwidthCap({ requestsUsed: 9000 }, 10000);
  assert.equal(bandwidthRemaining(s), 1000);
  assert.equal(bandwidthRemaining({}), null);
});

// --- 51153 stealth ------------------------------------------------------------------------------------------------------------------------------------
test('setStealthMode drops to low-noise', () => {
  const s = setStealthMode({ rateCapRps: 50 }, true);
  assert.equal(s.stealth, true);
  assert.equal(s.rateCapRps, 5);
  assert.equal(setStealthMode(s, false).stealth, false);
});

// --- 51154 depth -----------------------------------------------------------------------------------------------------------------------------------------
test('setDepthLimit clamps 0..10', () => {
  assert.equal(setDepthLimit({}, 6).depthLimit, 6);
  assert.equal(setDepthLimit({}, 99).depthLimit, 10);
});

// --- 51155 retest ------------------------------------------------------------------------------------------------------------------------------------------
test('retestOnChange finds affected tested paths', () => {
  const r = retestOnChange({ testedPaths: ['/api/v1', '/web'] }, ['/api']);
  assert.deepEqual(r.retest, ['/api/v1']);
  assert.deepEqual(r.changed, ['/api']);
});

// --- 51156 dry-run ------------------------------------------------------------------------------------------------------------------------------------------
test('dryRun simulates without applying', () => {
  const d = dryRun({ intensity: 'normal' }, { type: 'preset', preset: 'go-deep' });
  assert.equal(d.simulated, true);
  assert.ok(d.wouldChange.length > 0);
  assert.ok(d.estimatedImpact.minutes > 0);
});

// --- 51157 inheritance -----------------------------------------------------------------------------------------------------------------------------------------
test('inheritPriority boosts matching new assets', () => {
  assert.equal(inheritPriority({ boostedAreas: ['api'] }, 'api.example.com/v2').priority, 'high');
  assert.equal(inheritPriority({ boostedAreas: ['api'] }, 'blog.example.com').priority, 'normal');
});

// --- 51158 cooldown ----------------------------------------------------------------------------------------------------------------------------------------------
test('setCooldown / cooldownActive lockout', () => {
  const s = setCooldown({ now: 1000 }, 60);
  assert.equal(cooldownActive(s, 30000), true);
  assert.equal(cooldownActive(s, 70000), false);
  assert.equal(cooldownActive({}, 9999), false);
});

// --- 51159 module toggle ------------------------------------------------------------------------------------------------------------------------------------------
test('toggleModule enables/disables without restart', () => {
  const mods = [{ name: 'a', enabled: true }];
  assert.equal(toggleModule(mods, 'a', false)[0].enabled, false);
  assert.equal(toggleModule(mods, 'a', true)[0].enabled, true);
});

// --- 51160 focus window ----------------------------------------------------------------------------------------------------------------------------------------------
test('setFocusWindow / focusSplit effort math', () => {
  const s = setFocusWindow({}, '/api/*', 70);
  const sp = focusSplit(s);
  assert.equal(sp.inside, 70);
  assert.equal(sp.outside, 30);
  assert.equal(focusSplit({}).unfocused, true);
});

// --- CSS audit -------------------------------------------------------------------------------------------------------------------------------------------------------
test('Steering.css: scoped classes, zero keyframes', () => {
  const css = readFileSync(join(here, 'Steering.css'), 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'no keyframes allowed');
  // allow only `animation: none` (the reduced-motion guard); strip comments first
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const animDecls = [...noComments.matchAll(/animation\s*:\s*([^;]+);/gi)].map((m) => m[1].trim());
  assert.ok(animDecls.every((v) => v === 'none'), `non-none animations found: ${animDecls.join(', ')}`);
  const scoped = (css.match(/\.steer29-/g) || []).length;
  assert.ok(scoped > 10, `expected many scoped selectors, got ${scoped}`);
  assert.ok(/prefers-reduced-motion/.test(css), 'reduced-motion guard present');
});

// --- no TODO debris ------------------------------------------------------------------------------------------------------------------------------------------------------
test('no TODO/FIXME debris in wave 29 source files', () => {
  for (const f of ['steeringCore.js', 'SteeringPanel.jsx', 'SteeringExtras.jsx', 'Steering.css']) {
    const src = readFileSync(join(here, f), 'utf8');
    // strip header comments that merely document "no mocks" policy
    const body = src.replace(/^\/\*\*[\s\S]*?\*\//, '');
    assert.ok(!/\bTODO\b|\bFIXME\b|\bXXX\b|\bHACK\b/i.test(body), `${f} has debris markers`);
  }
});
