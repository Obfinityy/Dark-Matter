/**
 * wave27.test.js — wave 27 (ideas 51041–51080): chat session persistence +
 * live hunt-status transparency suite pure logic.
 *
 * node:test checks for sessionCore pure logic and the wave-27 registry
 * completeness (40/40, zero skips).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE27_IDEAS,
  WAVE27_START,
  WAVE27_END,
  serializeSession,
  restoreSession,
  markRead,
  unreadAlerts,
  pinMemoryNote,
  unpinMemoryNote,
  compareHunts,
  detectStopPhrase,
  STOP_PHRASE_DEFAULT,
  pacingLevel,
  shouldReduceProactivity,
  PACING_NORMAL,
  PACING_REDUCED,
  PACING_QUIET,
  handoffBrief,
  QUESTION_TEMPLATES,
  applyTemplate,
  REPLY_LENGTHS,
  REPLY_TERSE,
  REPLY_BALANCED,
  REPLY_DETAILED,
  applyReplyLength,
  unfurlUrl,
  pushHistory,
  recallHistory,
  appendWorkingNote,
  parseTriageCommand,
  TRIAGE_FALSE_POSITIVE,
  TRIAGE_CONFIRMED,
  CHECKIN_INTERVALS_MIN,
  nextCheckin,
  escalateAnswer,
  resolveEscalation,
  ESCALATION_OPEN,
  ESCALATION_RESOLVED,
  TECH_MODE,
  PLAIN_MODE,
  toggleTechMode,
  footnoteEvidence,
  agentTabs,
  routeToAgentTab,
  COORDINATOR_TAB,
  fnv1a,
  auditLogAppend,
  verifyAuditLog,
  HUNT_TONES,
  HUNT_TONE_PROFESSIONAL,
  HUNT_TONE_LIGHT,
  withHuntTone,
  instantStatus,
  narrateAction,
  phaseBreadcrumb,
  activeToolBadge,
  phaseProgress,
  subStepChecklist,
  tickSubStep,
  timeInPhase,
  lastActionStamp,
  nextActionPreview,
  STATUS_LANGS,
  statusInLanguage,
  statusCard,
  appendStatus,
  digestSchedule,
  explainAction,
  reportBlocker,
  BLOCKER_NONE,
  BLOCKER_STUCK,
  waitingOnYou,
  planVsReality,
  shareStatusLink,
  spokenStatus,
  dashboardWidget,
} from './sessionCore.js';

describe('wave 27 registry', () => {
  it('covers 40/40 ideas, zero skips, ids 51041–51080 in order', () => {
    assert.equal(WAVE27_IDEAS.length, 40);
    assert.equal(WAVE27_START, 51041);
    assert.equal(WAVE27_END, 51080);
    const ids = WAVE27_IDEAS.map(([id]) => id);
    assert.deepEqual(
      ids,
      Array.from({ length: 40 }, (_, i) => 51041 + i)
    );
    for (const [id, name, desc] of WAVE27_IDEAS) {
      assert.ok(name && name.length > 0, `idea ${id} missing name`);
      assert.ok(desc && desc.length > 0, `idea ${id} missing description`);
    }
  });
});

describe('51041 persistent chat sessions', () => {
  it('serializes and restores a session', () => {
    const snap = serializeSession({
      huntId: 'h-1',
      savedAtMs: 5000,
      scrollTop: 120,
      messages: [{ id: 'm1', role: 'user', text: 'hi', ts: 1000 }],
    });
    assert.equal(snap.version, 1);
    assert.equal(snap.messages.length, 1);
    const restored = restoreSession(snap);
    assert.ok(restored.restored);
    assert.equal(restored.scrollTop, 120);
    assert.equal(restored.messages[0].text, 'hi');
  });
  it('rejects invalid snapshots', () => {
    assert.equal(restoreSession(null), null);
    assert.equal(restoreSession({ version: 2, messages: [] }), null);
    assert.equal(restoreSession({ version: 1 }), null);
  });
});

describe('51042 read receipts', () => {
  it('marks read and counts unread alerts', () => {
    const msgs = [
      { id: 'm1', alert: true },
      { id: 'm2', alert: true },
      { id: 'm3', alert: false },
    ];
    let read = markRead([], 'm1');
    assert.deepEqual(read, ['m1']);
    read = markRead(read, 'm1');
    assert.deepEqual(read, ['m1']);
    assert.equal(unreadAlerts(msgs, read).length, 1);
    assert.equal(unreadAlerts(msgs, []).length, 2);
  });
});

describe('51043 agent memory notes', () => {
  it('pins and unpins notes', () => {
    let notes = pinMemoryNote([], 'remember: admin at /admin', 1000);
    assert.equal(notes.length, 1);
    assert.ok(notes[0].pinned);
    notes = pinMemoryNote(notes, '   ', 1000);
    assert.equal(notes.length, 1);
    notes = unpinMemoryNote(notes, notes[0].id);
    assert.equal(notes.length, 0);
  });
});

describe('51044 cross-hunt comparison', () => {
  it('computes deltas and a summary', () => {
    const r = compareHunts(
      { findings: 14, criticals: 3, coverage: 72, durationMin: 95 },
      { findings: 11, criticals: 2, coverage: 64, durationMin: 110 }
    );
    assert.equal(r.findingsDelta, 3);
    assert.equal(r.criticalsDelta, 1);
    assert.equal(r.coverageDelta, 8);
    assert.equal(r.durationDeltaMin, -15);
    assert.ok(r.summary.includes('14 findings'));
  });
});

describe('51045 emergency stop phrase', () => {
  it('detects the phrase case-insensitively', () => {
    assert.ok(detectStopPhrase('please STOP THE HUNT now'));
    assert.ok(!detectStopPhrase('keep going'));
    assert.ok(detectStopPhrase('halt!', 'halt!'));
    assert.equal(STOP_PHRASE_DEFAULT, 'stop the hunt');
  });
});

describe('51046 pacing awareness', () => {
  it('derives pacing from reply lengths', () => {
    assert.equal(pacingLevel([]), PACING_NORMAL);
    assert.equal(pacingLevel(['ok', 'k', 'yes']), PACING_QUIET);
    assert.equal(pacingLevel(['ok', 'detailed analysis of the auth flow here']), PACING_REDUCED);
    assert.equal(pacingLevel(['here is a detailed analysis of everything']), PACING_NORMAL);
    assert.ok(shouldReduceProactivity(PACING_QUIET));
    assert.ok(!shouldReduceProactivity(PACING_NORMAL));
  });
});

describe('51047 handoff brief generator', () => {
  it('builds a markdown brief', () => {
    const brief = handoffBrief({
      huntId: 'h-9',
      phase: 'exploitation',
      findings: 5,
      openBlockers: ['WAF'],
      memoryNotes: [{ text: 'note' }],
      nextSteps: ['verify'],
    });
    assert.ok(brief.includes('# Handoff brief — hunt h-9'));
    assert.ok(brief.includes('WAF'));
    assert.ok(brief.includes('verify'));
  });
});

describe('51048 saved question templates', () => {
  it('applies templates by id', () => {
    assert.ok(QUESTION_TEMPLATES.length >= 4);
    const p = applyTemplate('qt-criticals');
    assert.ok(p.includes('critical'));
    assert.equal(applyTemplate('nope'), '');
  });
});

describe('51049 reply-length slider', () => {
  it('terse/balanced/detailed trims sentences', () => {
    const text = 'One. Two. Three. Four.';
    assert.equal(applyReplyLength(text, REPLY_TERSE), 'One.');
    assert.equal(applyReplyLength(text, REPLY_BALANCED), 'One. Two.');
    assert.equal(applyReplyLength(text, REPLY_DETAILED), text);
    assert.ok(REPLY_LENGTHS.includes(REPLY_TERSE));
  });
});

describe('51050 URL unfurling', () => {
  it('extracts host and checks scope', () => {
    const inScope = unfurlUrl('https://app.example.com/login', ['example.com']);
    assert.equal(inScope.host, 'app.example.com');
    assert.ok(inScope.valid && inScope.inScope);
    const out = unfurlUrl('https://evil.com/x', ['example.com']);
    assert.ok(out.valid && !out.inScope);
    const bad = unfurlUrl('not a url', []);
    assert.ok(!bad.valid);
  });
});

describe('51051 command history recall', () => {
  it('pushes and recalls with up-arrow semantics', () => {
    let h = pushHistory([], 'status');
    h = pushHistory(h, '/pause');
    assert.equal(recallHistory(h, 0), '/pause');
    assert.equal(recallHistory(h, 1), 'status');
    assert.equal(recallHistory(h, 9), '');
    h = pushHistory(h, '   ');
    assert.equal(h.length, 2);
  });
});

describe('51052 working-notes channel', () => {
  it('appends read-only notes', () => {
    const notes = appendWorkingNote([], 'reasoning trace', 100);
    assert.equal(notes.length, 1);
    assert.equal(appendWorkingNote(notes, '  ').length, 1);
  });
});

describe('51053 chat triage commands', () => {
  it('parses triage intents', () => {
    assert.equal(parseTriageCommand('mark as false positive'), TRIAGE_FALSE_POSITIVE);
    assert.equal(parseTriageCommand('Mark Confirmed'), TRIAGE_CONFIRMED);
    assert.equal(parseTriageCommand('hello there'), null);
  });
});

describe('51054 scheduled chat check-ins', () => {
  it('computes due state', () => {
    assert.ok(CHECKIN_INTERVALS_MIN.includes(15));
    const due = nextCheckin(0, 15, 16 * 60000);
    assert.ok(due.due);
    const notDue = nextCheckin(0, 15, 5 * 60000);
    assert.ok(!notDue.due);
    assert.equal(notDue.nextAtMs, 15 * 60000);
  });
});

describe('51055 answer escalation', () => {
  it('escalates once and resolves', () => {
    let list = escalateAnswer([], 'm1', 'needs expert');
    assert.equal(list[0].state, ESCALATION_OPEN);
    list = escalateAnswer(list, 'm1');
    assert.equal(list.length, 1);
    list = resolveEscalation(list, 'm1', 'confirmed');
    assert.equal(list[0].state, ESCALATION_RESOLVED);
  });
});

describe('51056 technical/plain toggle', () => {
  it('toggles modes', () => {
    assert.equal(toggleTechMode(TECH_MODE), PLAIN_MODE);
    assert.equal(toggleTechMode(PLAIN_MODE), TECH_MODE);
  });
});

describe('51057 evidence footnotes', () => {
  it('numbers claims and lists footnotes', () => {
    const { body, footnotes } = footnoteEvidence([
      { text: 'Claim A', label: 'Evidence A', url: 'https://x/1' },
      { text: 'Claim B', label: 'Evidence B', url: 'https://x/2' },
    ]);
    assert.ok(body.includes('Claim A[1]'));
    assert.equal(footnotes.length, 2);
    assert.equal(footnotes[1].n, 2);
  });
});

describe('51058 sub-agent chat tabs', () => {
  it('builds tabs and routes messages', () => {
    assert.deepEqual(agentTabs(['a1', 'a2']), [COORDINATOR_TAB, 'a1', 'a2']);
    assert.equal(routeToAgentTab({ agentId: 'a1' }), 'a1');
    assert.equal(routeToAgentTab({}), COORDINATOR_TAB);
  });
});

describe('51059 immutable chat audit log', () => {
  it('hash-chains entries and verifies', () => {
    let log = auditLogAppend([], { actor: 'user', action: 'start', ts: 1 });
    log = auditLogAppend(log, { actor: 'agent', action: 'scan', ts: 2 });
    assert.equal(log[1].prev, log[0].hash);
    const v = verifyAuditLog(log);
    assert.ok(v.ok && v.entries === 2);
    const tampered = log.map((e, i) => (i === 0 ? { ...e, action: 'evil' } : e));
    assert.ok(!verifyAuditLog(tampered).ok);
  });
  it('fnv1a is deterministic', () => {
    assert.equal(fnv1a('abc'), fnv1a('abc'));
    assert.notEqual(fnv1a('abc'), fnv1a('abd'));
  });
});

describe('51060 long-hunt personality', () => {
  it('applies light tone optionally', () => {
    assert.ok(HUNT_TONES.includes(HUNT_TONE_PROFESSIONAL));
    assert.equal(withHuntTone('Done.', HUNT_TONE_PROFESSIONAL), 'Done.');
    assert.ok(withHuntTone('Done.', HUNT_TONE_LIGHT).length > 'Done.'.length);
  });
});

describe('51061 instant status command', () => {
  it('builds a one-line status', () => {
    const s = instantStatus({ phase: 'Scan', action: 'fuzzing', progressPct: 64.4 });
    assert.ok(s.includes('Scan') && s.includes('64%'));
  });
});

describe('51062 plain-language narration', () => {
  it('maps tool actions to sentences', () => {
    assert.ok(narrateAction('subdomain enumeration').includes('subdomains'));
    assert.ok(narrateAction('xss testing').includes('cross-site scripting'));
    assert.ok(narrateAction('mystery').includes('mystery'));
  });
});

describe('51063 phase breadcrumb trail', () => {
  it('marks done/current/upcoming', () => {
    const plan = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const crumbs = phaseBreadcrumb(plan, 'b');
    assert.deepEqual(
      crumbs.map(c => c.state),
      ['done', 'current', 'upcoming']
    );
  });
});

describe('51064 active-tool indicator', () => {
  it('badges live tool or idle', () => {
    assert.ok(activeToolBadge('miner').live);
    assert.ok(!activeToolBadge('').live);
  });
});

describe('51065 in-phase progress bar', () => {
  it('computes pct and remaining', () => {
    const p = phaseProgress(6, 10);
    assert.deepEqual([p.pct, p.remaining], [60, 4]);
    const clamped = phaseProgress(99, 10);
    assert.equal(clamped.pct, 100);
  });
});

describe('51066 sub-step checklist', () => {
  it('ticks steps off', () => {
    let steps = subStepChecklist([{ id: 's1', label: 'One' }]);
    assert.ok(!steps[0].done);
    steps = tickSubStep(steps, 's1');
    assert.ok(steps[0].done);
  });
});

describe('51067 time-in-phase readout', () => {
  it('compares elapsed vs budget', () => {
    const t = timeInPhase(0, 60, 45 * 60000);
    assert.equal(t.elapsedMin, 45);
    assert.ok(!t.overBudget);
    assert.ok(timeInPhase(0, 60, 90 * 60000).overBudget);
  });
});

describe('51068 last-action timestamp', () => {
  it('distinguishes silence from stalling', () => {
    const fresh = lastActionStamp(0, 30000);
    assert.ok(!fresh.stalled && fresh.label === 'just now');
    const old = lastActionStamp(0, 10 * 60000);
    assert.ok(old.stalled);
  });
});

describe('51069 next-action preview', () => {
  it('peeks at the queue head', () => {
    const p = nextActionPreview(['a', 'b']);
    assert.equal(p.action, 'a');
    assert.equal(p.remaining, 1);
    assert.equal(nextActionPreview([]).action, null);
  });
});

describe('51070 status in your language', () => {
  it('matches chat language', () => {
    assert.ok(STATUS_LANGS.includes('hinglish'));
    assert.ok(statusInLanguage('ok', 'hi').includes('स्थिति'));
    assert.ok(statusInLanguage('ok', 'hinglish').includes('sab theek'));
    assert.ok(statusInLanguage('ok', 'en').startsWith('Status:'));
  });
});

describe('51071 visual status card', () => {
  it('composites phase/action/progress/ETA', () => {
    const c = statusCard({ phase: 'Scan', action: 'fuzz', progressPct: 64, etaMin: 22 });
    assert.equal(c.progressPct, 64);
    assert.ok(c.eta.includes('22m'));
    assert.equal(statusCard({}).eta, 'calculating…');
  });
});

describe('51072 status history timeline', () => {
  it('appends statuses', () => {
    const h = appendStatus([], { text: 'started', ts: 0 });
    assert.equal(h.length, 1);
    assert.equal(appendStatus(h, { text: '  ' }).length, 1);
  });
});

describe('51073 scheduled status digests', () => {
  it('computes due state', () => {
    assert.ok(digestSchedule(0, 30, 40 * 60000).due);
    assert.ok(!digestSchedule(0, 30, 10 * 60000).due);
  });
});

describe('51074 ask-about-this-action', () => {
  it('explains why and what is expected', () => {
    const e = explainAction('port scan');
    assert.ok(e.why.length > 0 && e.expects.length > 0);
    assert.equal(e.action, 'port scan');
  });
});

describe('51075 self-reported blockers', () => {
  it('flags blockers explicitly', () => {
    const b = reportBlocker(BLOCKER_STUCK, 'WAF');
    assert.ok(b.selfReported && b.detail === 'WAF');
    assert.ok(!reportBlocker(BLOCKER_NONE).selfReported);
  });
});

describe('51076 waiting-on-you flag', () => {
  it('marks paused-awaiting-input distinctly', () => {
    const w = waitingOnYou('approve?');
    assert.ok(w.waiting && w.reason === 'approve?');
    assert.ok(!waitingOnYou('').waiting);
  });
});

describe('51077 plan-vs-reality view', () => {
  it('highlights deviations', () => {
    const rows = planVsReality([{ id: 'a' }, { id: 'b' }], [{ id: 'a' }, { id: 'x' }]);
    assert.equal(rows[0].deviation, 'on-track');
    assert.equal(rows[1].deviation, 'out-of-order');
  });
});

describe('51078 shareable status link', () => {
  it('builds a read-only link', () => {
    const link = shareStatusLink('hunt-1', 'tok');
    assert.ok(link.includes('hunt-1') && link.includes('tok'));
    assert.equal(shareStatusLink('', ''), '');
  });
});

describe('51079 spoken status readout', () => {
  it('produces speakable text', () => {
    const t = spokenStatus({ phase: 'Scan', action: 'fuzz', progressPct: 50 });
    assert.ok(t.includes('50 percent'));
  });
});

describe('51080 dashboard status widget', () => {
  it('builds a mini status card', () => {
    const w = dashboardWidget({ huntId: 'h1', phase: 'Scan', progressPct: 64, criticals: 2 });
    assert.ok(w.attention);
    assert.ok(!dashboardWidget({ huntId: 'h1', criticals: 0 }).attention);
  });
});
