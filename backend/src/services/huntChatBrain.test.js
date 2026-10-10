/**
 * huntChatBrain.test.js — mid-hunt chat is answered by the HACKING brain,
 * never by templates.
 *
 *  - stub the brain → the reply contains the brain's own words AND the live
 *    context (tick/state, findings) was inside the prompt sent to the brain;
 *  - brain unreachable / unconfigured → the honest BRAIN_UNAVAILABLE_REPLY,
 *    with NONE of the old template phrases;
 *  - slotBrainStatus / brainStatusesForUser drive the agent-status contract,
 *    including grounding 'vision-driven' when only vision is present.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GradioProvider } from '../agent/providers/gradioProvider.js';
import {
  BrainUnreachableError,
  BRAIN_UNAVAILABLE_REPLY,
  slotBrainStatus,
  brainStatusesForUser,
  resolveHackingBrain,
  buildHuntChatPrompt,
  buildJobChatContext,
  answerWithHackingBrain,
} from './huntChatBrain.js';

// Distinctive phrases from the REMOVED template builders
// (askAgentService.js replyDoing/replyStatus/... — deleted). The honest
// unavailable message must never contain any of these.
const TEMPLATE_PHRASES = [
  'ka hunt chal raha hai',
  'Abhi phase:',
  'recon kar raha',
  'queue mein hai',
  'Main ruka nahi hun',
  'Findings so far',
  'Ab tak kul',
  'Sabse serious',
  'Filhaal ye chal raha hai',
  'intezaar kar raha hun',
  'band ho gaya hai',
  'kaam shuru nahi kiya',
];

function assertNoTemplatePhrases(text, label) {
  for (const phrase of TEMPLATE_PHRASES) {
    assert.ok(
      !String(text).includes(phrase),
      `${label}: reply must not contain template phrase "${phrase}"`
    );
  }
}

const KAGGLE_SELECTION = {
  slotSources: {
    hacker: {
      source: 'kaggle',
      kaggleUrl: 'https://abc123.gradio.live',
      kaggleName: 'Hacking Brain',
    },
    vision: { source: 'kaggle', kaggleUrl: 'https://vision1.gradio.live' },
  },
  slotAssignments: {},
};

// Stub the Gradio network layer at the prototype: no HTTP in tests.
let captured = [];
let generateImpl = null;
const origGenerate = GradioProvider.prototype.generate;

function stubBrainGenerate(impl) {
  captured = [];
  generateImpl =
    impl ||
    (async messages => {
      captured.push(messages);
      return 'BRAIN SAYS: recon abhi chal raha hai, 3 endpoints mile hain.';
    });
  GradioProvider.prototype.generate = async function (messages, opts) {
    return generateImpl.call(this, messages, opts);
  };
}

beforeEach(() => stubBrainGenerate());
afterEach(() => {
  GradioProvider.prototype.generate = origGenerate;
  generateImpl = null;
});

const brainProviderModelFor = selection => ({
  getSelection: async () => selection,
});

describe('answerWithHackingBrain', () => {
  test('routes the question to the hacking brain with live context', async () => {
    const context = buildJobChatContext({
      job: {
        target: 'https://target.example',
        status: 'running',
        phase: 'probing',
        stepCount: 42,
        currentAction: 'testing the login form',
        activity: [{ message: 'started probing the login form' }],
      },
      findings: [
        { severity: 'high', title: 'Reflected XSS in search box' },
        { severity: 'medium', title: 'Verbose server header' },
      ],
      recentCycles: [{ summary: 'mapped 12 endpoints so far' }],
    });

    const { reply, brainSource } = await answerWithHackingBrain({
      userId: 'user_1',
      question: 'kya kar rahe ho?',
      context,
      brainProviderModel: brainProviderModelFor(KAGGLE_SELECTION),
    });

    assert.equal(brainSource, 'kaggle');
    assert.match(reply, /BRAIN SAYS/, 'reply contains the brain’s own words');
    assert.equal(captured.length, 1, 'brain was called exactly once');
    const [systemMsg, userMsg] = captured[0];
    assert.match(systemMsg.content, /Hinglish/, 'system prompt demands Hinglish');
    assert.match(systemMsg.content, /Never invent findings/, 'system prompt forbids invention');
    assert.ok(userMsg.content.includes('kya kar rahe ho?'), 'question reaches the brain');
    assert.ok(userMsg.content.includes('42'), 'live tick reaches the brain');
    assert.ok(userMsg.content.includes('running'), 'live status reaches the brain');
    assert.ok(
      userMsg.content.includes('Reflected XSS in search box'),
      'top finding reaches the brain'
    );
    assert.ok(
      userMsg.content.includes('mapped 12 endpoints so far'),
      'think-aloud trace reaches the brain'
    );
    assertNoTemplatePhrases(reply, 'brain reply');
  });

  test('brain unreachable → honest message, no template phrases', async () => {
    stubBrainGenerate(async () => {
      throw new Error('fetch failed: ECONNREFUSED');
    });
    const context = buildJobChatContext({
      job: { target: 'https://target.example', status: 'running', stepCount: 7 },
      findings: [],
    });
    await assert.rejects(
      answerWithHackingBrain({
        userId: 'user_1',
        question: 'kya mila?',
        context,
        brainProviderModel: brainProviderModelFor(KAGGLE_SELECTION),
      }),
      err => err instanceof BrainUnreachableError
    );
    // The caller-facing contract: the honest message itself.
    assertNoTemplatePhrases(BRAIN_UNAVAILABLE_REPLY, 'unavailable reply');
    assert.match(BRAIN_UNAVAILABLE_REPLY, /hacking brain.*reachable nahi hai/);
    assert.match(BRAIN_UNAVAILABLE_REPLY, /Models page/);
  });

  test('no brain configured → BrainUnreachableError (honest path)', async () => {
    await assert.rejects(
      answerWithHackingBrain({
        userId: 'user_1',
        question: 'status?',
        context: buildJobChatContext({ job: { status: 'queued' } }),
        brainProviderModel: brainProviderModelFor({ slotSources: {}, slotAssignments: {} }),
      }),
      err => err instanceof BrainUnreachableError && /not configured/.test(err.message)
    );
    assert.equal(captured.length, 0, 'no brain call attempted when none configured');
  });

  test('empty brain reply → BrainUnreachableError', async () => {
    stubBrainGenerate(async () => '   ');
    await assert.rejects(
      answerWithHackingBrain({
        userId: 'user_1',
        question: 'hi',
        context: buildJobChatContext({ job: {} }),
        brainProviderModel: brainProviderModelFor(KAGGLE_SELECTION),
      }),
      BrainUnreachableError
    );
  });
});

describe('resolveHackingBrain', () => {
  test('kaggle slot source → GradioProvider (FIFO queue included)', () => {
    const resolved = resolveHackingBrain({ selection: KAGGLE_SELECTION });
    assert.ok(resolved);
    assert.equal(resolved.source, 'kaggle');
    assert.ok(resolved.provider instanceof GradioProvider);
    assert.equal(resolved.provider.baseUrl, 'https://abc123.gradio.live');
  });

  test('local slot source without runner → null (honest missing)', () => {
    const resolved = resolveHackingBrain({
      selection: { slotSources: { hacker: { source: 'local', modelId: 'qwen3-8b' } } },
      runner: null,
    });
    assert.equal(resolved, null);
  });

  test('missing slot → null', () => {
    assert.equal(resolveHackingBrain({ selection: {} }), null);
    assert.equal(resolveHackingBrain({}), null);
  });
});

describe('slotBrainStatus / brainStatusesForUser', () => {
  test('kaggle / local / missing per slot', () => {
    const statuses = brainStatusesForUser({ selection: KAGGLE_SELECTION });
    assert.equal(statuses.vision, 'kaggle');
    assert.equal(statuses.hacking, 'kaggle');
  });

  test("grounding is 'vision-driven' when vision exists but grounding is missing", () => {
    const statuses = brainStatusesForUser({
      selection: {
        slotSources: {
          vision: { source: 'kaggle', kaggleUrl: 'https://v.gradio.live' },
          hacker: { source: 'kaggle', kaggleUrl: 'https://h.gradio.live' },
        },
      },
    });
    assert.equal(statuses.grounding, 'vision-driven');
  });

  test("grounding is 'missing' when vision is also missing", () => {
    const statuses = brainStatusesForUser({ selection: { slotSources: {} } });
    assert.equal(statuses.grounding, 'missing');
    assert.equal(statuses.vision, 'missing');
    assert.equal(statuses.hacking, 'missing');
  });

  test("grounding is 'kaggle' when its own link is configured", () => {
    const statuses = brainStatusesForUser({
      selection: {
        slotSources: {
          vision: { source: 'kaggle', kaggleUrl: 'https://v.gradio.live' },
          grounding: { source: 'kaggle', kaggleUrl: 'https://g.gradio.live' },
          hacker: { source: 'kaggle', kaggleUrl: 'https://h.gradio.live' },
        },
      },
    });
    assert.equal(statuses.grounding, 'kaggle');
  });

  test('slotBrainStatus handles a null runner without throwing', () => {
    assert.equal(slotBrainStatus('hacker', { selection: {}, runner: null }), 'missing');
  });
});

describe('buildHuntChatPrompt', () => {
  test('prompt carries question + live snapshot, no invented content', () => {
    const prompt = buildHuntChatPrompt({
      question: 'aage kya karoge?',
      context: {
        target: 'https://target.example',
        status: 'running',
        tick: 9,
        currentActivity: 'probing search params',
        findings: {
          total: 2,
          critical: 1,
          high: 1,
          medium: 0,
          low: 0,
          top: [{ severity: 'critical', title: 'SQLi in id param' }],
        },
        trace: ['found an interesting error message'],
      },
    });
    assert.ok(prompt.includes('aage kya karoge?'));
    assert.ok(prompt.includes('https://target.example'));
    assert.ok(prompt.includes('SQLi in id param'));
    assert.ok(prompt.includes('found an interesting error message'));
    assert.ok(prompt.includes('2 total'));
  });
});
