/**
 * wave31.test.js — wave 31 (ideas 51201–51240): approval governance round 2
 * + live log observability suite. node:test checks for pure logic in
 * governanceCore.js and registry completeness.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE31_START,
  WAVE31_END,
  WAVE31_IDEAS,
  searchApprovals,
  inheritPolicies,
  scopeAllows,
  pendingApprovalsCount,
  dualControlStatus,
  slaStatus,
  buildHint,
  parseChatDecision,
  inApprovalWindow,
  fatigueLevel,
  checkTargetLists,
  validateReasonCode,
  filterSelfDenials,
  isSimulationMode,
  isApprovalExpired,
  canRevoke,
  applyCrossHuntRules,
  buildDigest,
  needsLegalSignoff,
  confidenceBand,
  suggestAlternative,
  shortcutMap,
  queueOfflineDecision,
  flushOfflineQueue,
  predictDecision,
  insurancePlan,
  ceremonyEntry,
  monitoringState,
  formatLogLine,
  filterByLevel,
  groupByModule,
  searchLogs,
  expandLine,
  redactPayloads,
  applyHighlightRules,
  errorOnlyView,
  exportLogs,
  inspectRequest,
  formatResponse,
  playbackSpeeds,
  playbackSchedule,
} from './governanceCore.js';

const T0 = 1728220000000;

// --- registry completeness -------------------------------------------------

test('registry covers all 40 ideas 51201–51240, zero skips', () => {
  assert.equal(WAVE31_START, 51201);
  assert.equal(WAVE31_END, 51240);
  assert.equal(WAVE31_IDEAS.length, 40);
  const ids = WAVE31_IDEAS.map(([id]) => id).sort((a, b) => a - b);
  for (let i = 0; i < 40; i++) assert.equal(ids[i], 51201 + i, `missing idea ${51201 + i}`);
  for (const [id, name, desc] of WAVE31_IDEAS) {
    assert.ok(name && name.length > 3, `idea ${id} needs a name`);
    assert.ok(desc && desc.length > 10, `idea ${id} needs a description`);
  }
});

// --- 51201 approval history search -------------------------------------------

test('searchApprovals finds by action/target/decider/reason', () => {
  const h = [
    {
      id: '1',
      action: 'active-scan',
      target: '/api/users',
      decision: 'approve',
      decider: 'Asha',
      reasonCode: 'recon',
    },
    {
      id: '2',
      action: 'exploit',
      target: '/api/admin',
      decision: 'deny',
      decider: 'Ravi',
      reasonCode: 'risky',
    },
  ];
  assert.equal(searchApprovals(h, 'exploit').length, 1);
  assert.equal(searchApprovals(h, 'ASHA').length, 1);
  assert.equal(searchApprovals(h, 'risky')[0].id, '2');
  assert.equal(searchApprovals(h, '').length, 2);
  assert.equal(searchApprovals(h, 'zzz').length, 0);
});

// --- 51202 policy inheritance -------------------------------------------------

test('inheritPolicies tags inherited policies as overridable', () => {
  const out = inheritPolicies([{ name: 'p1' }]);
  assert.equal(out[0].inherited, true);
  assert.equal(out[0].overridden, false);
  assert.deepEqual(inheritPolicies([]), []);
});

// --- 51203 granular scopes ----------------------------------------------------

test('scopeAllows matches exact scope and sub-paths only', () => {
  assert.ok(scopeAllows({ scope: '/api/users' }, '/api/users'));
  assert.ok(scopeAllows({ scope: '/api/users' }, '/api/users/42'));
  assert.ok(!scopeAllows({ scope: '/api/users' }, '/api/orders'));
  assert.ok(!scopeAllows({ scope: '/api/users' }, '/api/users2'));
  assert.ok(!scopeAllows({}, '/api/users'));
});

// --- 51204 watermark ----------------------------------------------------------

test('pendingApprovalsCount counts only pending', () => {
  assert.equal(
    pendingApprovalsCount([{ status: 'pending' }, { status: 'approved' }, { status: 'pending' }]),
    2
  );
  assert.equal(pendingApprovalsCount([]), 0);
});

// --- 51205 dual control -------------------------------------------------------

test('dualControlStatus needs two distinct approvers', () => {
  let s = dualControlStatus({ approvals: [{ by: 'A' }] });
  assert.equal(s.approved, false);
  assert.equal(s.approvalsNeeded, 1);
  s = dualControlStatus({ approvals: [{ by: 'A' }, { by: 'A' }, { by: 'B' }] });
  assert.equal(s.approved, true);
  assert.deepEqual(s.approvers, ['A', 'B']);
});

// --- 51206 SLA ----------------------------------------------------------------

test('slaStatus tracks on-track / at-risk / breached', () => {
  const r = { requestedAt: T0, slaMs: 100000 };
  assert.equal(slaStatus(r, T0 + 10000), 'on-track');
  assert.equal(slaStatus(r, T0 + 80000), 'at-risk');
  assert.equal(slaStatus(r, T0 + 120000), 'breached');
});

// --- 51207 hints ---------------------------------------------------------------

test('buildHint produces plain-words explanation', () => {
  const h = buildHint({ verb: 'scan', target: '/api', why: 'open endpoint found', risk: 'low' });
  assert.ok(h.includes('/api') && h.includes('open endpoint found') && h.includes('low'));
});

// --- 51208 chat decisions ------------------------------------------------------

test('parseChatDecision parses approve/deny/info', () => {
  assert.equal(parseChatDecision('yes, go ahead'), 'approve');
  assert.equal(parseChatDecision('No, stop'), 'deny');
  assert.equal(parseChatDecision('why is this needed?'), 'info');
  assert.equal(parseChatDecision('hello there'), null);
});

// --- 51209 approval windows ----------------------------------------------------

test('inApprovalWindow honors windows and midnight wrap', () => {
  const noon = Date.UTC(2026, 9, 7, 12, 0, 0);
  const night = Date.UTC(2026, 9, 7, 23, 30, 0);
  assert.ok(inApprovalWindow(noon, [{ startHour: 9, endHour: 18 }]));
  assert.ok(!inApprovalWindow(night, [{ startHour: 9, endHour: 18 }]));
  assert.ok(inApprovalWindow(night, [{ startHour: 22, endHour: 2 }])); // wraps midnight
  assert.ok(inApprovalWindow(noon, [])); // no windows = always
});

// --- 51210 fatigue -------------------------------------------------------------

test('fatigueLevel escalates with decision density', () => {
  const many = Array.from({ length: 11 }, (_, i) => ({ at: T0 - i * 60000 }));
  const some = Array.from({ length: 6 }, (_, i) => ({ at: T0 - i * 60000 }));
  assert.equal(fatigueLevel(many, T0), 'fatigued');
  assert.equal(fatigueLevel(some, T0), 'warming');
  assert.equal(fatigueLevel([], T0), 'fresh');
});

// --- 51211/51212 target lists ---------------------------------------------------

test('checkTargetLists: forbidden wins over pre-approved', () => {
  assert.equal(
    checkTargetLists('prod-db.internal', ['prod-db.internal'], ['prod-db.internal']),
    'forbidden'
  );
  assert.equal(checkTargetLists('staging.internal', ['staging.internal'], []), 'pre-approved');
  assert.equal(checkTargetLists('other.io', [], []), 'needs-approval');
});

// --- 51213 reason codes ---------------------------------------------------------

test('validateReasonCode checks the allowed set', () => {
  assert.ok(validateReasonCode('recon', ['recon', 'risky']));
  assert.ok(!validateReasonCode('zzz', ['recon']));
});

// --- 51214 self-denials ----------------------------------------------------------

test('filterSelfDenials keeps only self-denied entries', () => {
  const log = [{ outcome: 'self-denied' }, { outcome: 'requested' }];
  assert.equal(filterSelfDenials(log).length, 1);
});

// --- 51215 simulation ------------------------------------------------------------

test('isSimulationMode detects practice hunts', () => {
  assert.ok(isSimulationMode({ simulation: true }));
  assert.ok(!isSimulationMode({}));
  assert.ok(!isSimulationMode(null));
});

// --- 51216 time-limited -----------------------------------------------------------

test('isApprovalExpired honors the minute grant', () => {
  const g = { grantedAt: T0, minutes: 30 };
  assert.ok(!isApprovalExpired(g, T0 + 10 * 60000));
  assert.ok(isApprovalExpired(g, T0 + 31 * 60000));
});

// --- 51217 revocation ---------------------------------------------------------------

test('canRevoke only while approved and running', () => {
  assert.ok(canRevoke({ status: 'approved', actionState: 'running' }));
  assert.ok(!canRevoke({ status: 'approved', actionState: 'done' }));
  assert.ok(!canRevoke({ status: 'pending', actionState: 'running' }));
});

// --- 51218 cross-hunt rules ------------------------------------------------------------

test('applyCrossHuntRules first match wins', () => {
  const rules = [{ action: 'exploit', decision: 'deny' }, { decision: 'allow' }];
  assert.equal(applyCrossHuntRules({ type: 'exploit', target: '/x' }, rules), 'deny');
  assert.equal(applyCrossHuntRules({ type: 'scan', target: '/x' }, rules), 'allow');
  assert.equal(applyCrossHuntRules({ type: 'scan', target: '/x' }, []), 'needs-approval');
});

// --- 51219 digest -----------------------------------------------------------------------

test('buildDigest counts and lists decisions', () => {
  const d = buildDigest([
    { decision: 'approve', action: 'scan', target: '/a', reasonCode: 'r1' },
    { decision: 'deny', action: 'exploit', target: '/b' },
  ]);
  assert.equal(d.total, 2);
  assert.equal(d.approve, 1);
  assert.equal(d.deny, 1);
  assert.equal(d.lines.length, 2);
});

// --- 51220 legal hold ---------------------------------------------------------------------

test('needsLegalSignoff when flagged and not signed', () => {
  assert.ok(needsLegalSignoff({ legalHold: true }));
  assert.ok(!needsLegalSignoff({ legalHold: true, legalSignedOff: true }));
  assert.ok(!needsLegalSignoff({}));
});

// --- 51221 confidence -----------------------------------------------------------------------

test('confidenceBand maps score to band', () => {
  assert.equal(confidenceBand(90), 'high');
  assert.equal(confidenceBand(65), 'medium');
  assert.equal(confidenceBand(20), 'low');
});

// --- 51222 alternatives ------------------------------------------------------------------------

test('suggestAlternative offers safer options', () => {
  assert.ok(suggestAlternative({ type: 'active-scan' }).type === 'passive-scan');
  assert.equal(suggestAlternative({ type: 'passive-scan' }), null);
});

// --- 51223 shortcuts ------------------------------------------------------------------------------

test('shortcutMap has approve/deny/info/snooze', () => {
  const m = shortcutMap();
  assert.ok(m.approve && m.deny && m.info && m.snooze);
});

// --- 51224 offline queue -------------------------------------------------------------------------------

test('offline queue queues and flushes in order', () => {
  let q = queueOfflineDecision([], { id: 'b', decision: 'deny', queuedAt: 2 });
  q = queueOfflineDecision(q, { id: 'a', decision: 'approve', queuedAt: 1 });
  const { applied, remaining } = flushOfflineQueue(q);
  assert.deepEqual(
    applied.map(d => d.id),
    ['a', 'b']
  );
  assert.ok(applied.every(d => d.synced));
  assert.deepEqual(remaining, []);
});

// --- 51225 streaks ------------------------------------------------------------------------------------------------

test('predictDecision returns most common past decision', () => {
  const h = [
    { action: 'scan', decision: 'approve' },
    { action: 'scan', decision: 'approve' },
    { action: 'scan', decision: 'deny' },
  ];
  assert.equal(predictDecision(h, 'scan'), 'approve');
  assert.equal(predictDecision([], 'scan'), null);
});

// --- 51226 insurance -----------------------------------------------------------------------------------------------------

test('insurancePlan covers snapshot items', () => {
  const p = insurancePlan({ target: '/api', approvedAt: T0 });
  assert.equal(p.target, '/api');
  assert.ok(p.items.includes('database'));
  assert.ok(p.rollbackNote.includes('/api'));
});

// --- 51227 ceremony ----------------------------------------------------------------------------------------------------------------

test('ceremonyEntry formats a formal record', () => {
  const e = ceremonyEntry({
    id: 'c1',
    action: 'scan',
    target: '/a',
    decision: 'approve',
    decider: 'X',
    at: T0,
    reasonCode: 'r',
  });
  assert.ok(e.includes('CEREMONY c1') && e.includes('decision=approve') && e.includes('reason=r'));
});

// --- 51228 post-approval monitoring ----------------------------------------------------------------------------------------------------------------

test('monitoringState arms kill switch for destructive running actions', () => {
  const s = monitoringState({
    type: 'exploit',
    target: '/a',
    actionState: 'running',
    risk: 'destructive',
  });
  assert.ok(s.watching && s.killSwitchArmed);
  const s2 = monitoringState({ type: 'scan', target: '/a', actionState: 'done', risk: 'safe' });
  assert.ok(!s2.watching && !s2.killSwitchArmed);
});

// --- 51229 log formatting --------------------------------------------------------------------------------------------------------------------------------

test('formatLogLine includes ms timestamp, level, module', () => {
  const line = formatLogLine({ at: T0, level: 'info', module: 'recon', message: 'hi' });
  assert.ok(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] \[INFO\] \[recon\] hi/.test(line));
});

// --- 51230 level filter ----------------------------------------------------------------------------------------------------------------------------------------

test('filterByLevel keeps at-or-above severity', () => {
  const lines = [{ level: 'debug' }, { level: 'info' }, { level: 'warning' }, { level: 'error' }];
  assert.equal(filterByLevel(lines, 'warning').length, 2);
  assert.equal(filterByLevel(lines, 'debug').length, 4);
});

// --- 51231 module tabs ------------------------------------------------------------------------------------------------------------------------------------------------

test('groupByModule groups lines by module', () => {
  const g = groupByModule([{ module: 'recon' }, { module: 'recon' }, { module: 'scan' }]);
  assert.equal(g.recon.length, 2);
  assert.equal(g.scan.length, 1);
});

// --- 51232 log search --------------------------------------------------------------------------------------------------------------------------------------------------------

test('searchLogs matches across fields, case-insensitive', () => {
  const lines = [{ message: 'Subdomain found', module: 'recon', detail: '' }];
  assert.equal(searchLogs(lines, 'SUBDOMAIN').length, 1);
  assert.equal(searchLogs(lines, 'zzz').length, 0);
  assert.equal(searchLogs(lines, '').length, 1);
});

// --- 51233 line details ----------------------------------------------------------------------------------------------------------------------------------------------------------------

test('expandLine exposes request/response/reasoning', () => {
  const d = expandLine({ at: T0, level: 'info', module: 'm', message: 'x', request: { u: 1 } });
  assert.ok(d.hasDetails);
  assert.deepEqual(d.request, { u: 1 });
  const d2 = expandLine({ at: T0, level: 'info', module: 'm', message: 'x' });
  assert.ok(!d2.hasDetails);
});

// --- 51234 redaction ------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('redactPayloads masks secrets and counts them', () => {
  const r = redactPayloads('login password=hunter2 token=abc ok=1');
  assert.equal(r.redactedCount, 2);
  assert.ok(!r.text.includes('hunter2') && r.text.includes('•••'));
  assert.ok(r.text.includes('ok=1'));
});

// --- 51235 highlighting -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('applyHighlightRules annotates matching lines', () => {
  const out = applyHighlightRules(
    [{ message: 'connection timeout' }, { message: 'all good' }],
    [{ pattern: 'timeout', label: 'net' }]
  );
  assert.deepEqual(out[0].highlights, ['net']);
  assert.deepEqual(out[1].highlights, []);
});

// --- 51236 error-only -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('errorOnlyView keeps warnings and errors', () => {
  const lines = [{ level: 'info' }, { level: 'warning' }, { level: 'error' }, { level: 'debug' }];
  assert.equal(errorOnlyView(lines).length, 2);
});

// --- 51237 export ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('exportLogs supports json and text', () => {
  const lines = [{ at: T0, level: 'info', module: 'm', message: 'x' }];
  const j = exportLogs(lines, 'json');
  assert.equal(j.format, 'json');
  assert.ok(j.content.includes('"message"'));
  const t = exportLogs(lines, 'text');
  assert.equal(t.format, 'text');
  assert.ok(t.content.includes('[INFO]'));
  assert.equal(t.lineCount, 1);
});

// --- 51238 request inspector -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('inspectRequest summarizes outgoing requests', () => {
  const r = inspectRequest({
    method: 'POST',
    url: 'https://x.test/a',
    headers: { a: 'b' },
    body: 'y'.repeat(500),
    at: T0,
  });
  assert.equal(r.method, 'POST');
  assert.equal(r.bodyPreview.length, 200);
});

// --- 51239 response viewer --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('formatResponse truncates long bodies', () => {
  const v = formatResponse({ status: 200, body: 'z'.repeat(5000) });
  assert.ok(v.truncated);
  assert.equal(v.preview.length, 4000);
  const v2 = formatResponse({ status: 200, body: 'short' });
  assert.ok(!v2.truncated);
});

// --- 51240 playback -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('playbackSpeeds are 1x/4x/16x and schedule scales delays', () => {
  assert.deepEqual(playbackSpeeds(), [1, 4, 16]);
  const lines = [{ at: T0 }, { at: T0 + 16000 }, { at: T0 + 32000 }];
  const s1 = playbackSchedule(lines, 1);
  const s4 = playbackSchedule(lines, 4);
  assert.deepEqual(
    s1.map(s => s.delayMs),
    [0, 16000, 32000]
  );
  assert.deepEqual(
    s4.map(s => s.delayMs),
    [0, 4000, 8000]
  );
  assert.deepEqual(playbackSchedule([], 4), []);
});

// --- no-debris audit --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('core file has no TODO/FIXME/mock debris', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('./governanceCore.js', import.meta.url), 'utf8');
  assert.ok(!/\bTODO\b|\bFIXME\b|\bMOCK\b/i.test(src), 'debris found in governanceCore.js');
});
