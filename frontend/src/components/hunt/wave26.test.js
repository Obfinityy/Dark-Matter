/**
 * wave26.test.js — wave 26 (ideas 51001–51040): mid-hunt chat /
 * conversational UX suite pure logic.
 *
 * node:test checks for chatCore pure logic and the wave-26 registry
 * completeness (40/40, zero skips).
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE26_IDEAS,
  WAVE26_START,
  WAVE26_END,
  nextMessageId,
  resetMessageIds,
  optimisticShareLink,
  confirmShareLink,
  SHARE_PENDING,
  SHARE_ACTIVE,
  shouldRecalcResize,
  resizePlan,
  RESIZE_DEBOUNCE_MS,
  instantFocus,
  latencyStats,
  latencyGrade,
  latencySelfTestReport,
  DOCK_PINNED,
  DOCK_COLLAPSED,
  toggleDock,
  dockLayout,
  messageContext,
  withMessageContext,
  questionChips,
  tuneFromReactions,
  searchConversation,
  threadReply,
  threadMessages,
  presenceBadge,
  PRESENCE_LABELS,
  switchChatLanguage,
  voiceNoteToMessage,
  attachFile,
  exportTranscript,
  pinAnswer,
  unpinAnswer,
  pinnedRail,
  suggestFollowUps,
  condenseAnswer,
  parseSlashCommand,
  SLASH_COMMANDS,
  extractFindingIds,
  findingInlineCard,
  enqueueOfflineMessage,
  flushOfflineQueue,
  typingState,
  splitChatPanes,
  routeToPane,
  selectTone,
  withTone,
  parseMentions,
  chatToReportNote,
  citeClaim,
  answerWithCitations,
  filterMessages,
  quietHoursActive,
  shouldDeliverMessage,
  testRequestWizard,
  confidenceLevel,
  confidenceMeter,
  timelineReplay,
  inviteTeammate,
  annotateScreenshot,
  needsClarification,
  clarifyingQuestion,
  chatKeybindings,
  translationJob,
  approvalCard,
  resolveApproval,
  parseScopeEdit,
  scopeEditConfirmation,
  chatDigest,
} from './chatCore.js';

beforeEach(() => resetMessageIds());

describe('wave 26 registry', () => {
  it('covers all 40 ideas 51001–51040 with zero skips', () => {
    assert.equal(WAVE26_IDEAS.length, 40);
    const ids = WAVE26_IDEAS.map(([id]) => id).sort((a, b) => a - b);
    for (let i = 0; i < 40; i++) assert.equal(ids[i], WAVE26_START + i);
    assert.equal(WAVE26_START, 51001);
    assert.equal(WAVE26_END, 51040);
    for (const [id, slug, desc] of WAVE26_IDEAS) {
      assert.ok(Number.isInteger(id));
      assert.ok(slug && slug.length > 3, `slug for ${id}`);
      assert.ok(desc && desc.length > 10, `desc for ${id}`);
    }
  });

  it('message ids are deterministic', () => {
    assert.equal(nextMessageId(), 'msg-1');
    assert.equal(nextMessageId('share'), 'share-2');
  });
});

describe('51001 optimistic share links', () => {
  it('link appears instantly as pending, then confirms', () => {
    const link = optimisticShareLink('hunt-9', 1000);
    assert.equal(link.status, SHARE_PENDING);
    assert.equal(link.permissionsSynced, false);
    assert.ok(link.url.includes('hunt-9'));
    const done = confirmShareLink(link, 2000);
    assert.equal(done.status, SHARE_ACTIVE);
    assert.equal(done.permissionsSynced, true);
    assert.equal(done.syncedAt, 2000);
  });
  it('rejects empty hunt id', () => assert.equal(optimisticShareLink('', 1), null));
});

describe('51002 debounced resize', () => {
  it('recalcs only after the debounce window', () => {
    assert.equal(shouldRecalcResize(1000, 1100), false);
    assert.equal(shouldRecalcResize(1000, 1000 + RESIZE_DEBOUNCE_MS), true);
  });
  it('classifies breakpoints', () => {
    assert.equal(resizePlan(500, 800).breakpoint, 'sm');
    assert.equal(resizePlan(800, 600).breakpoint, 'md');
    assert.equal(resizePlan(1400, 900).breakpoint, 'lg');
  });
});

describe('51003 instant focus', () => {
  it('moves focus immediately while detail loads', () => {
    const f = instantFocus('card-7', false);
    assert.equal(f.moved, 'immediate');
    assert.equal(f.followUp, 'announce-when-ready');
    assert.equal(instantFocus('card-7', true).followUp, 'none');
  });
});

describe('51004 latency self-test', () => {
  it('computes honest percentiles', () => {
    const s = latencyStats([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    assert.equal(s.count, 10);
    assert.equal(s.p50, 50);
    assert.equal(s.p95, 100);
    assert.equal(s.max, 100);
  });
  it('grades p95 honestly', () => {
    assert.equal(latencyGrade(30), 'excellent');
    assert.equal(latencyGrade(80), 'good');
    assert.equal(latencyGrade(150), 'fair');
    assert.equal(latencyGrade(500), 'poor');
  });
  it('empty samples stay honest', () => {
    const r = latencySelfTestReport([]);
    assert.equal(r.count, 0);
    assert.equal(r.honest, true);
  });
});

describe('51005 pinned dock', () => {
  it('toggles pinned/collapsed', () => {
    assert.equal(toggleDock(DOCK_PINNED), DOCK_COLLAPSED);
    assert.equal(toggleDock(DOCK_COLLAPSED), DOCK_PINNED);
  });
  it('never overlays the findings feed', () => {
    const l = dockLayout(DOCK_PINNED, 1280);
    assert.equal(l.overlaysFeed, false);
    assert.ok(l.feedWidth > 0 && l.dockWidth > 0);
    assert.equal(l.feedWidth + l.dockWidth, 1280);
  });
});

describe('51006 context-aware replies', () => {
  it('stamps phase + scope on messages', () => {
    const m = withMessageContext({ id: 'm1', text: 'hi' }, 'scanning', 'example.com');
    assert.equal(m.context.phase, 'scanning');
    assert.equal(m.context.scope, 'example.com');
    assert.equal(messageContext().phase, 'unknown');
  });
});

describe('51007 dynamic question chips', () => {
  it('chips follow the hunt phase', () => {
    assert.ok(questionChips('recon').length >= 3);
    assert.ok(questionChips('nope').length >= 2);
    assert.notDeepEqual(questionChips('recon'), questionChips('reporting'));
  });
});

describe('51008 reply reactions tune verbosity/depth', () => {
  it('thumbs-down shortens, eyes deepen', () => {
    assert.deepEqual(tuneFromReactions([]), { verbosity: 1, depth: 1 });
    const t = tuneFromReactions(['thumbs-down']);
    assert.ok(t.verbosity < 1 && t.depth < 1);
    assert.equal(tuneFromReactions(['eyes']).depth, 2);
  });
});

describe('51009 conversation search', () => {
  it('finds matches with snippets', () => {
    const msgs = [
      { id: 'a', text: 'the subdomain scan finished' },
      { id: 'b', text: 'nothing here' },
    ];
    const r = searchConversation(msgs, 'subdomain');
    assert.equal(r.length, 1);
    assert.equal(r[0].messageId, 'a');
    assert.ok(r[0].snippet.includes('subdomain'));
    assert.deepEqual(searchConversation(msgs, ''), []);
  });
});

describe('51010 threaded follow-ups', () => {
  it('threads nest under the parent', () => {
    const r = threadReply('p1', 'drill deeper', 'you', 5);
    assert.equal(r.parentId, 'p1');
    assert.equal(threadMessages([r, { id: 'z' }], 'p1').length, 1);
    assert.equal(threadReply('', 'x', 'you', 1), null);
  });
});

describe('51011 presence badge', () => {
  it('maps execution states to presence', () => {
    assert.equal(presenceBadge('reasoning'), 'thinking');
    assert.equal(presenceBadge('tool-call'), 'acting');
    assert.equal(presenceBadge('awaiting-user'), 'waiting');
    assert.equal(presenceBadge('zzz'), 'idle');
    assert.ok(PRESENCE_LABELS.thinking);
  });
});

describe('51012 language switch', () => {
  it('switches without restarting', () => {
    const s = switchChatLanguage({ language: 'en', hunt: 1 }, 'hi');
    assert.equal(s.language, 'hi');
    assert.equal(s.restarted, false);
    assert.equal(s.hunt, 1);
  });
});

describe('51013 voice notes', () => {
  it('transcript becomes the message record', () => {
    const m = voiceNoteToMessage('check the api', 9000, 42);
    assert.equal(m.kind, 'voice-note');
    assert.equal(m.text, 'check the api');
    assert.equal(voiceNoteToMessage('  ', 1, 1), null);
  });
});

describe('51014 attachments', () => {
  it('marks files referenced in reasoning', () => {
    const f = attachFile('shot.png', 'screenshot', 100, 7);
    assert.equal(f.referencedInReasoning, true);
    assert.equal(attachFile('', 'x', 1, 1), null);
  });
});

describe('51015 transcript export', () => {
  it('produces markdown with timestamps + phase markers', () => {
    const md = exportTranscript(
      [{ author: 'agent', text: 'hi', at: 0, context: { phase: 'recon' } }],
      { huntId: 'h1', phase: 'recon', scope: 'ex.com' }
    );
    assert.ok(md.includes('# Hunt chat transcript — h1'));
    assert.ok(md.includes('[recon]'));
  });
});

describe('51016 pinned rail', () => {
  it('pins and unpins answers', () => {
    const m = { id: 'a', text: 'key' };
    assert.equal(pinnedRail([pinAnswer(m)]).length, 1);
    assert.equal(pinnedRail([unpinAnswer(pinAnswer(m))]).length, 0);
  });
});

describe('51017 follow-up prompts', () => {
  it('suggests next questions from answer keywords', () => {
    const s = suggestFollowUps({ text: 'found a finding on the scope' });
    assert.ok(s.length >= 2 && s.length <= 3);
  });
});

describe('51018 auto-condense', () => {
  it('shortens only under high volume', () => {
    const t = 'One. Two. Three. Four.';
    assert.equal(condenseAnswer(t, false), t);
    assert.ok(condenseAnswer(t, true).endsWith('…'));
  });
});

describe('51019 slash commands', () => {
  it('parses known commands with args', () => {
    assert.deepEqual(parseSlashCommand('/pause'), {
      command: '/pause',
      action: 'pause',
      arg: null,
    });
    assert.deepEqual(parseSlashCommand('/focus F-123'), {
      command: '/focus',
      action: 'focus',
      arg: 'F-123',
    });
    assert.equal(parseSlashCommand('/nope').action, 'unknown');
    assert.equal(parseSlashCommand('hello'), null);
    assert.ok(SLASH_COMMANDS['/status']);
  });
});

describe('51020 finding deep links', () => {
  it('extracts ids and builds inline cards', () => {
    assert.deepEqual(extractFindingIds('see F-101 and finding-abc-9'), ['F-101', 'finding-abc-9']);
    assert.deepEqual(extractFindingIds('nothing'), []);
    const card = findingInlineCard('F-101', 'https://app/x', 'h1');
    assert.ok(card.href.includes('finding=F-101'));
  });
});

describe('51021 offline queue', () => {
  it('queues offline and flushes in order', () => {
    let q = enqueueOfflineMessage([], 'one', 1);
    q = enqueueOfflineMessage(q, 'two', 2);
    const { deliverable, queue } = flushOfflineQueue(q);
    assert.deepEqual(
      deliverable.map(m => m.text),
      ['one', 'two']
    );
    assert.ok(queue.every(m => m.delivered));
  });
});

describe('51022 typing indicator', () => {
  it('composing vs idle', () => {
    assert.equal(typingState(true), 'composing');
    assert.equal(typingState(false), 'idle');
  });
});

describe('51023 split panes', () => {
  it('routes messages to the right pane', () => {
    const panes = routeToPane(splitChatPanes(), 'findings', { id: 'm1' });
    assert.equal(panes[1].messages.length, 1);
    assert.equal(panes[0].messages.length, 0);
  });
});

describe('51024 tone selector', () => {
  it('accepts known tones only', () => {
    assert.equal(selectTone('explainer'), 'explainer');
    assert.equal(selectTone('nope'), 'concise');
    assert.equal(withTone('hi', 'explainer').tone, 'explainer');
  });
});

describe('51025 mentions', () => {
  it('parses @finding/@tool/@phase mentions', () => {
    const ms = parseMentions('check @finding:F-12 with @tool:nuclei in @phase:recon');
    assert.deepEqual(ms, [
      { kind: 'finding', ref: 'F-12' },
      { kind: 'tool', ref: 'nuclei' },
      { kind: 'phase', ref: 'recon' },
    ]);
    assert.deepEqual(parseMentions('plain'), []);
  });
});

describe('51026 chat-to-report notes', () => {
  it('appends selected messages as annotated notes', () => {
    const note = chatToReportNote([{ author: 'agent', text: 'critical RCE' }], 'h9');
    assert.ok(note.includes('## Chat notes — hunt h9'));
    assert.ok(note.includes('critical RCE'));
    assert.equal(chatToReportNote([], 'h9'), '');
  });
});

describe('51027 cited answers', () => {
  it('links claims to sources', () => {
    const a = answerWithCitations('x', [citeClaim('input reflected', 'log:412'), null]);
    assert.equal(a.citations.length, 1);
    assert.equal(citeClaim('', 's'), null);
  });
});

describe('51028 message filters', () => {
  it('filters by kind', () => {
    const msgs = [{ kind: 'question' }, { kind: 'command' }, { kind: 'explanation' }, {}];
    assert.equal(filterMessages(msgs, 'questions').length, 1);
    assert.equal(filterMessages(msgs, 'commands').length, 1);
    assert.equal(filterMessages(msgs, 'explanations').length, 1);
    assert.equal(filterMessages(msgs, 'all').length, 4);
  });
});

describe('51029 quiet hours', () => {
  it('wraps past midnight and spares critical alerts', () => {
    assert.equal(quietHoursActive(23 * 60, 22 * 60, 7 * 60), true);
    assert.equal(quietHoursActive(12 * 60, 22 * 60, 7 * 60), false);
    assert.equal(quietHoursActive(12 * 60, 8 * 60, 8 * 60), false);
    const crit = { text: 'x', proactive: true, priority: 'critical' };
    const normal = { text: 'y', proactive: true, priority: 'normal' };
    assert.equal(shouldDeliverMessage(crit, true), true);
    assert.equal(shouldDeliverMessage(normal, true), false);
    assert.equal(shouldDeliverMessage(normal, false), true);
  });
});

describe('51030 test-request wizard', () => {
  it('validates "try X on Y"', () => {
    const ok = testRequestWizard('try sqli on api.example.com/login');
    assert.equal(ok.valid, true);
    assert.equal(ok.action, 'sqli');
    assert.equal(ok.target, 'api.example.com/login');
    const bad = testRequestWizard('do something');
    assert.equal(bad.valid, false);
    assert.ok(bad.errors.length > 0);
  });
});

describe('51031 confidence meter', () => {
  it('shows the meter only when uncertain', () => {
    assert.equal(confidenceLevel(0.9), 'high');
    assert.equal(confidenceLevel(0.6), 'medium');
    assert.equal(confidenceLevel(0.2), 'low');
    assert.equal(confidenceMeter(0.9).show, false);
    assert.equal(confidenceMeter(0.4).show, true);
  });
});

describe('51032 timeline replay', () => {
  it('merges chat + events chronologically', () => {
    const items = timelineReplay([{ at: 5, id: 'm' }], [{ at: 2, label: 'scan' }]);
    assert.equal(items[0].kind, 'event');
    assert.equal(items[1].kind, 'message');
  });
});

describe('51033 teammate invites', () => {
  it('validates email and role', () => {
    const ok = inviteTeammate('a@b.co', 'operator');
    assert.equal(ok.ok, true);
    assert.equal(ok.invite.role, 'operator');
    assert.equal(inviteTeammate('a@b.co', 'boss').invite.role, 'viewer');
    assert.equal(inviteTeammate('nope', 'viewer').ok, false);
  });
});

describe('51034 screenshot annotation', () => {
  it('clamps regions to 0..1 and drops empties', () => {
    const a = annotateScreenshot([
      { x: -1, y: 0.5, w: 2, h: 0.2, label: 'btn' },
      { x: 0.1, y: 0.1, w: 0, h: 0.1 },
    ]);
    assert.equal(a.regionCount, 1);
    assert.equal(a.regions[0].x, 0);
    assert.equal(a.regions[0].w, 1);
  });
});

describe('51035 clarification-first', () => {
  it('flags vague requests and asks precisely', () => {
    assert.equal(needsClarification('do it'), true);
    assert.equal(
      needsClarification('run nuclei with the sqli template against api.example.com/login'),
      false
    );
    assert.ok(clarifyingQuestion('expand the scope').length > 10);
  });
});

describe('51036 keyboard shortcuts', () => {
  it('covers send/search/pin/react/thread', () => {
    const actions = chatKeybindings().map(b => b.action);
    for (const a of ['send', 'search', 'pin', 'react', 'thread']) assert.ok(actions.includes(a));
  });
});

describe('51037 translation job', () => {
  it('queues a job descriptor', () => {
    const j = translationJob('m1', 'hi');
    assert.equal(j.status, 'queued');
    assert.equal(translationJob('', 'hi'), null);
  });
});

describe('51038 approval cards', () => {
  it('approve/deny resolves the card', () => {
    const c = approvalCard('intrusive scan', 'may alert WAF');
    assert.equal(c.status, 'pending');
    assert.equal(resolveApproval(c, true, 9).status, 'approved');
    assert.equal(resolveApproval(c, false, 9).status, 'denied');
    assert.equal(approvalCard('', 'x'), null);
  });
});

describe('51039 scope edits', () => {
  it('parses edits but always requires confirmation', () => {
    const e = parseScopeEdit('also include the API subdomain');
    assert.ok(e.add.length > 0);
    assert.equal(e.needsConfirmation, true);
    assert.ok(scopeEditConfirmation(e).startsWith('Confirm scope change'));
    assert.equal(parseScopeEdit('hello world'), null);
  });
});

describe('51040 chat digest', () => {
  it('summarizes the window: phases, tests, findings', () => {
    const now = 3600000 * 2;
    const msgs = [
      { text: 'see F-101', at: now - 1000, context: { phase: 'recon' } },
      { text: 'run the test suite', at: now - 2000, context: { phase: 'scanning' } },
      { text: 'old news', at: 1, context: { phase: 'recon' } },
    ];
    const d = chatDigest(msgs, 3600000, now);
    assert.equal(d.messageCount, 2);
    assert.deepEqual(d.findingsMentioned, ['F-101']);
    assert.equal(d.testsMentioned, 1);
    assert.ok(d.summary.includes('2 messages'));
  });
});
