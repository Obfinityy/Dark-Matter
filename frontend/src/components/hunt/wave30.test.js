/**
 * wave30.test.js — wave 30 (ideas 51161–51200): steering round 2 +
 * approval/governance suite. Tests governCore.js pure logic, the
 * WAVE30_IDEAS registry completeness, and the Governance.css audit
 * (scoped classes, zero keyframes).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WAVE30_IDEAS, WAVE30_START, WAVE30_END,
  HUNT_PERSONAS, RISK_LEVELS, APPROVAL_TEMPLATES,
  deemphasizeFindingsClass, steerFromFindings, switchPersona,
  addCheckpoint, reachCheckpoint, steeringAnalytics, emergencyRescope,
  defineAlias, expandAlias, scheduleSteering, dueSteering,
  resolveSteeringConflict, setAutonomy, pushSteeringEvent, postSteeringSummary,
  toApprovalCard, riskLabel, requiresExplicitApproval, approvalDetail,
  decideApproval, bulkDecide, applyApprovalTimeouts, approveWithLimits,
  addStandingRule, checkStandingRules, delegateApprovals, stepUpAuthorized,
  auditApproval, pendingCountdowns, gracefulWaitTasks, applyApprovalTemplate,
  sandboxPreview, reversibleBadge, mobileApprovalPayload, parseVoiceApproval,
  approvalScopeNote, requestMoreInfo, approvalAnalytics, emergencyDenyAll,
  approvalChatThread, estimateSideEffects, rollbackPlan,
  approvalNotifications, batchApprovals,
} from './governCore.js';

const here = dirname(fileURLToPath(import.meta.url));

// --- registry completeness ------------------------------------------------
test('registry covers all 40 ideas, 51161–51200, zero skips', () => {
  assert.equal(WAVE30_START, 51161);
  assert.equal(WAVE30_END, 51200);
  assert.equal(WAVE30_IDEAS.length, 40);
  const ids = WAVE30_IDEAS.map(([id]) => id);
  for (let i = 51161; i <= 51200; i++) assert.ok(ids.includes(i), `missing ${i}`);
  assert.equal(new Set(ids).size, 40, 'duplicate ids');
  for (const [id, slug, desc] of WAVE30_IDEAS) {
    assert.ok(slug && slug.length > 3, `bad slug ${id}`);
    assert.ok(desc && desc.length > 10, `bad desc ${id}`);
  }
});

// --- 51161 de-emphasize findings class --------------------------------------
test('deemphasizeFindingsClass adds category with adaptation', () => {
  const r = deemphasizeFindingsClass([], 'Informational');
  assert.deepEqual(r.deemphasized, ['informational']);
  assert.equal(r.adaptation.action, 'reduce-effort');
  assert.equal(r.adaptation.effortShare, 0.05);
});
test('deemphasizeFindingsClass ignores blanks and duplicates', () => {
  assert.equal(deemphasizeFindingsClass([], '  ').adaptation, null);
  const r = deemphasizeFindingsClass(['xss'], 'XSS');
  assert.deepEqual(r.deemphasized, ['xss']);
  assert.equal(r.adaptation, null);
});

// --- 51162 steering via findings feed ---------------------------------------
test('steerFromFindings builds directive from majority attributes', () => {
  const fs = [
    { category: 'injection', severity: 'high' },
    { category: 'injection', severity: 'critical' },
    { category: 'xss', severity: 'high' },
  ];
  const d = steerFromFindings(fs);
  assert.equal(d.directive, 'find-more-like-these');
  assert.equal(d.targetCategory, 'injection');
  assert.equal(d.basedOn, 3);
});
test('steerFromFindings returns null for empty selection', () => {
  assert.equal(steerFromFindings([]), null);
});

// --- 51163 hunt persona switch ----------------------------------------------
test('switchPersona retunes profile for valid personas', () => {
  const r = switchPersona('balanced', 'aggressive-hunter');
  assert.equal(r.changed, true);
  assert.equal(r.profile.rps, 25);
  assert.equal(r.profile.noise, 'high');
});
test('switchPersona rejects unknown persona', () => {
  const r = switchPersona('balanced', 'nope');
  assert.equal(r.changed, false);
  assert.equal(r.persona, 'balanced');
});

// --- 51164 checkpoint steering ------------------------------------------------
test('addCheckpoint + reachCheckpoint lifecycle', () => {
  let cps = addCheckpoint([], 'recon', 'review targets');
  assert.equal(cps[0].status, 'pending');
  cps = reachCheckpoint(cps, 'recon');
  assert.equal(cps[0].status, 'awaiting-checkin');
});

// --- 51165 steering analytics --------------------------------------------------
test('steeringAnalytics attributes findings to commands', () => {
  const rows = steeringAnalytics(
    [{ id: 'c1', label: 'go deep' }],
    [{ foundAfter: 'c1', severity: 'high' }, { foundAfter: 'c1', severity: 'low' }],
  );
  assert.equal(rows[0].findingsAttributed, 2);
  assert.equal(rows[0].topSeverity, 'high');
});

// --- 51166 emergency re-scope ---------------------------------------------------
test('emergencyRescope narrows scope to one asset', () => {
  const plan = { scope: ['a.com', 'b.com'], modules: ['recon', 'critical-path'] };
  const r = emergencyRescope(plan, 'a.com');
  assert.deepEqual(r.scope, ['a.com']);
  assert.equal(r.mode, 'emergency-focus');
  assert.deepEqual(r.pausedModules, ['recon']);
});

// --- 51167 aliases ----------------------------------------------------------------
test('defineAlias + expandAlias round-trip', () => {
  const a = defineAlias({}, 'gw', 'go wide on api');
  assert.equal(expandAlias(a, 'gw'), 'go wide on api');
  assert.equal(expandAlias(a, 'unknown'), 'unknown');
});

// --- 51168 scheduled steering -------------------------------------------------------
test('scheduleSteering queues and dueSteering fires', () => {
  const q = scheduleSteering([], 'pause recon', 10);
  assert.equal(q[0].status, 'scheduled');
  assert.equal(dueSteering(q, 10).length, 1);
  assert.equal(dueSteering(q, 5).length, 0);
});

// --- 51169 conflict resolver ------------------------------------------------------------
test('resolveSteeringConflict merges shared fields, flags conflicts', () => {
  const r = resolveSteeringConflict(
    { author: 'a', command: { scope: ['x'], rps: 5 } },
    { author: 'b', command: { scope: ['x'], rps: 20 } },
  );
  assert.deepEqual(r.merged, { scope: ['x'] });
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.conflicts[0].field, 'rps');
  assert.equal(r.needsHuman, true);
});

// --- 51170 autonomy slider ------------------------------------------------------------------
test('setAutonomy maps levels to envelopes', () => {
  assert.equal(setAutonomy(10).label, 'supervised');
  assert.equal(setAutonomy(50).label, 'collaborative');
  assert.equal(setAutonomy(90).label, 'autonomous');
  assert.equal(setAutonomy(90).maySelfRedirect, true);
  assert.equal(setAutonomy(10).mustAskBeforeDestructive, true);
  assert.equal(setAutonomy(150).level, 100);
});

// --- 51171 + 51172 feed + summary --------------------------------------------------------------
test('pushSteeringEvent caps feed at 50', () => {
  let feed = [];
  for (let i = 0; i < 60; i++) feed = pushSteeringEvent(feed, { text: `e${i}` });
  assert.equal(feed.length, 50);
  assert.equal(feed[0].text, 'e59');
});
test('postSteeringSummary builds one-liner', () => {
  const s = postSteeringSummary({ scope: ['a.com'], mode: 'aggressive' });
  assert.ok(s.includes('scope → 1 target(s)'));
  assert.ok(s.includes('mode: aggressive'));
  assert.equal(postSteeringSummary({}), 'Plan updated.');
});

// --- 51173 + 51174 cards + risk ----------------------------------------------------------------------
test('toApprovalCard normalizes risk', () => {
  const c = toApprovalCard({ id: 'x', title: 't', risk: 'bogus' });
  assert.equal(c.risk, 'cautious');
  assert.equal(c.status, 'pending');
});
test('riskLabel falls back to cautious; requiresExplicitApproval', () => {
  assert.equal(riskLabel('safe'), 'safe');
  assert.equal(riskLabel('nope'), 'cautious');
  assert.equal(requiresExplicitApproval('safe'), false);
  assert.equal(requiresExplicitApproval('destructive'), true);
});

// --- 51175 detail drawer ---------------------------------------------------------------------------------
test('approvalDetail exposes requests/targets/side effects', () => {
  const d = approvalDetail({ id: 'x', title: 't', risk: 'safe', requests: ['GET /'], targets: ['a.com'], sideEffects: ['none'], reversible: true });
  assert.deepEqual(d.targets, ['a.com']);
  assert.equal(d.reversible, true);
});

// --- 51176 one-tap ----------------------------------------------------------------------------------------------
test('decideApproval resolves pending cards', () => {
  const c = decideApproval({ id: 'x', status: 'pending' }, 'approved', 'you');
  assert.equal(c.status, 'approved');
  assert.equal(c.decidedBy, 'you');
  const bad = decideApproval({ id: 'x', status: 'pending' }, 'maybe');
  assert.equal(bad.status, 'pending');
});

// --- 51177 bulk queue ------------------------------------------------------------------------------------------------
test('bulkDecide counts outcomes', () => {
  const cards = [{ id: 'a', status: 'pending' }, { id: 'b', status: 'pending' }, { id: 'c', status: 'approved' }];
  const r = bulkDecide(cards, { a: 'approved', b: 'denied' });
  assert.equal(r.approved, 1);
  assert.equal(r.denied, 1);
  assert.equal(r.remaining, 0);
});

// --- 51178 timeouts -------------------------------------------------------------------------------------------------------
test('applyApprovalTimeouts auto-denies stale cards', () => {
  const cards = [{ id: 'a', status: 'pending', requestedAt: 0 }, { id: 'b', status: 'pending', requestedAt: 590000 }];
  const r = applyApprovalTimeouts(cards, 600000, 120000, 'auto-deny');
  assert.equal(r[0].status, 'denied');
  assert.equal(r[1].status, 'pending');
});

// --- 51179 approve with limits -------------------------------------------------------------------------------------------------
test('approveWithLimits attaches caps', () => {
  const c = approveWithLimits({ id: 'x', status: 'pending' }, { maxRps: 5, durationMinutes: 10 });
  assert.equal(c.status, 'approved');
  assert.equal(c.limits.maxRps, 5);
});

// --- 51180/51181 standing rules ------------------------------------------------------------------------------------------------------
test('standing rules allow/deny/neutral', () => {
  let rules = addStandingRule([], 'deny', 'Fuzz');
  rules = addStandingRule(rules, 'allow', 'recon');
  assert.equal(checkStandingRules(rules, 'fuzz'), 'deny');
  assert.equal(checkStandingRules(rules, 'recon'), 'allow');
  assert.equal(checkStandingRules(rules, 'other'), null);
  assert.equal(addStandingRule(rules, 'bogus', 'x').length, rules.length);
});

// --- 51182 delegation -------------------------------------------------------------------------------------------------------------------
test('delegateApprovals routes types to teammates', () => {
  const d = delegateApprovals({}, 'fuzz', 'ana');
  assert.equal(d.fuzz, 'ana');
});

// --- 51183 step-up --------------------------------------------------------------------------------------------------------------------------------
test('stepUpAuthorized needs 2 factors for destructive', () => {
  assert.equal(stepUpAuthorized({ risk: 'destructive' }, ['pw']), false);
  assert.equal(stepUpAuthorized({ risk: 'destructive' }, ['pw', 'totp']), true);
  assert.equal(stepUpAuthorized({ risk: 'safe' }, []), true);
});

// --- 51184 audit trail --------------------------------------------------------------------------------------------------------------------------------------
test('auditApproval appends frozen records', () => {
  const t = auditApproval([], { who: 'you', decision: 'approved', cardId: 'a1' });
  assert.equal(t[0].seq, 1);
  assert.ok(Object.isFrozen(t[0]));
});

// --- 51185 countdowns ------------------------------------------------------------------------------------------------------------------------------------
test('pendingCountdowns reports waits', () => {
  const cs = pendingCountdowns([{ id: 'a', status: 'pending', requestedAt: 1000 }], 61000, { a: 'scanning' });
  assert.equal(cs[0].waitedMs, 60000);
  assert.equal(cs[0].agentMeanwhile, 'scanning');
});

// --- 51186 graceful wait ----------------------------------------------------------------------------------------------------------------------------------
test('gracefulWaitTasks filters to safe tasks', () => {
  const t = gracefulWaitTasks([{ safe: true }, { safe: false }, { safe: true, needsApproval: true }]);
  assert.equal(t.length, 1);
});

// --- 51187 templates ------------------------------------------------------------------------------------------------------------------------------------------------
test('applyApprovalTemplate returns known policies', () => {
  const p = applyApprovalTemplate('paranoid');
  assert.deepEqual(p.autoDeny, ['destructive']);
  assert.equal(applyApprovalTemplate('nope'), null);
});

// --- 51188 sandbox preview ----------------------------------------------------------------------------------------------------------------------------------------------
test('sandboxPreview estimates without executing', () => {
  const p = sandboxPreview({ id: 'x', risk: 'destructive', targets: ['a'], estimatedRps: 10, estimatedSeconds: 30, reversible: false });
  assert.equal(p.simulated, true);
  assert.equal(p.estimatedRequests, 300);
  assert.ok(p.warning);
});

// --- 51189 reversible badge --------------------------------------------------------------------------------------------------------------------------------------------
test('reversibleBadge tones', () => {
  assert.equal(reversibleBadge({ reversible: true }).tone, 'good');
  assert.equal(reversibleBadge({}).tone, 'warn');
});

// --- 51190 mobile ----------------------------------------------------------------------------------------------------------------------------------------------------------
test('mobileApprovalPayload keeps full context', () => {
  const m = mobileApprovalPayload({ id: 'x', title: 't', risk: 'safe' });
  assert.equal(m.fullContext, true);
  assert.equal(m.channel, 'mobile');
});

// --- 51191 voice ----------------------------------------------------------------------------------------------------------------------------------------------------------------
test('parseVoiceApproval needs verification', () => {
  assert.equal(parseVoiceApproval('approved', true), 'approved');
  assert.equal(parseVoiceApproval('approved', false), null);
  assert.equal(parseVoiceApproval('hello', true), null);
});

// --- 51192 expiry ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
test('approvalScopeNote binds to instance', () => {
  const n = approvalScopeNote({ id: 'a1', title: 'scan' });
  assert.ok(n.includes('a1'));
  assert.ok(n.includes('does not pre-approve'));
});

// --- 51193 more info ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
test('requestMoreInfo flags card', () => {
  const c = requestMoreInfo({ id: 'x', status: 'pending' }, 'why?');
  assert.equal(c.status, 'needs-info');
  assert.equal(c.infoQuestion, 'why?');
});

// --- 51194 analytics --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
test('approvalAnalytics suggests standing rules', () => {
  const a = approvalAnalytics([
    { category: 'recon', decision: 'approved' }, { category: 'recon', decision: 'approved' }, { category: 'recon', decision: 'approved' },
    { category: 'fuzz', decision: 'denied' }, { category: 'fuzz', decision: 'denied' }, { category: 'fuzz', decision: 'denied' },
  ]);
  const recon = a.find((x) => x.category === 'recon');
  const fuzz = a.find((x) => x.category === 'fuzz');
  assert.equal(recon.suggestion, 'always-allow candidate');
  assert.equal(fuzz.suggestion, 'always-deny candidate');
});

// --- 51195 deny-all --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
test('emergencyDenyAll denies pending and pauses', () => {
  const r = emergencyDenyAll([{ id: 'a', status: 'pending' }, { id: 'b', status: 'approved' }]);
  assert.equal(r.cards[0].status, 'denied');
  assert.equal(r.cards[1].status, 'approved');
  assert.equal(r.huntPaused, true);
});

// --- 51196 chat thread ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
test('approvalChatThread appends non-empty messages', () => {
  const t = approvalChatThread([], 'you', 'why this target?');
  assert.equal(t.length, 1);
  assert.equal(approvalChatThread(t, 'you', '   ').length, 1);
});

// --- 51197 + 51198 side effects + rollback ----------------------------------------------------------------------------------------------------------------------------------------------------------
test('estimateSideEffects lists effects', () => {
  const e = estimateSideEffects({ targets: ['a', 'b'], writesData: true, estimatedRps: 50, risk: 'destructive' });
  assert.ok(e.length >= 4);
  assert.deepEqual(estimateSideEffects({}), ['no significant side effects expected']);
});
test('rollbackPlan notes reversibility', () => {
  assert.ok(rollbackPlan({ id: 'x', targets: ['a'], reversible: true }).note.includes('verified'));
  assert.ok(rollbackPlan({ id: 'x', targets: ['a'] }).note.includes('not guaranteed'));
});

// --- 51199 notifications ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
test('approvalNotifications filters channels', () => {
  const n = approvalNotifications({ id: 'a1', title: 'scan', risk: 'safe' }, ['push', 'carrier-pigeon']);
  assert.equal(n.length, 1);
  assert.equal(n[0].channel, 'push');
});

// --- 51200 quiet batching ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
test('batchApprovals splits urgent vs digest', () => {
  const cards = [
    { id: 'a', status: 'pending', risk: 'destructive' },
    { id: 'b', status: 'pending', risk: 'safe' },
    { id: 'c', status: 'approved', risk: 'safe' },
  ];
  const b = batchApprovals(cards);
  assert.equal(b.interruptNow.length, 1);
  assert.equal(b.digest.length, 1);
});

// --- CSS audit --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
test('Governance.css is scoped and animation-free', () => {
  const raw = readFileSync(join(here, 'Governance.css'), 'utf8');
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/@keyframes/.test(css), 'no @keyframes allowed');
  const classSelectors = css.match(/\.[a-zA-Z][\w-]*/g) || [];
  const unscoped = classSelectors.filter((s) => !s.startsWith('.gov30'));
  assert.equal(unscoped.length, 0, `unscoped selectors: ${unscoped.slice(0, 5).join(', ')}`);
});
