/**
 * Tests for the triple-brain orchestrator (hunt/control think → see → act):
 * backend/src/services/tripleBrainOrchestrator.js
 *
 * Boundary convention (same as huntTripleBrain.test.js): the LLM providers
 * are scripted fakes — no network, no binaries, no model downloads. The
 * ModelRunnerService itself is REAL (temp data dir) for the slot-status
 * queries, so "which brains are running" is exercised against real code.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  TripleBrainOrchestrator,
  createTripleBrainOrchestrator,
  BRAIN_SLOTS,
  GROUNDING_SPACE
} from '../src/services/tripleBrainOrchestrator.js';
import { ModelRunnerService } from '../src/services/modelRunner/modelRunnerService.js';

const quiet = { log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

function recordingLogger() {
  const records = { info: [], warn: [], error: [] };
  return {
    records,
    info: (m) => records.info.push(String(m)),
    warn: (m) => records.warn.push(String(m)),
    error: (m) => records.error.push(String(m)),
    log: () => {}
  };
}

async function tempDataDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'triple-brain-test-'));
}

/** Scripted provider: plays canned generate/generateStructured responses. */
function scriptedProvider({ text = '', structured = {}, health = null } = {}) {
  return {
    calls: [],
    async generate(messages, _opts) {
      this.calls.push({ kind: 'generate', messages });
      return text;
    },
    async generateStructured(messages, _schema, _opts) {
      this.calls.push({ kind: 'structured', messages });
      return JSON.parse(JSON.stringify(structured));
    },
    async healthCheck() {
      return health || { reachable: true, model: 'scripted' };
    }
  };
}

const STRATEGY = {
  hypothesis: 'Reflected XSS in ?q may chain with missing CSRF on /profile',
  nextAction: { kind: 'tool', tool: 'nuclei', targetElement: 'the search box', rationale: 'confirm XSS' },
  vulnChains: [{ chain: 'XSS → session ride', steps: ['inject', 'steal'], impact: 'account takeover' }],
  done: false
};

// ---------------------------------------------------------------- construction

describe('TripleBrainOrchestrator construction', () => {
  it('exposes the three brain slots in order', () => {
    assert.deepEqual([...BRAIN_SLOTS], ['vision', 'grounding', 'hacker']);
    assert.equal(GROUNDING_SPACE, 1000);
  });

  it('factory builds an orchestrator instance', () => {
    const o = createTripleBrainOrchestrator({ logger: quiet });
    assert.ok(o instanceof TripleBrainOrchestrator);
  });

  it('rejects unknown slots in resolveSlot', () => {
    const o = new TripleBrainOrchestrator({ logger: quiet });
    assert.throws(() => o.resolveSlot('nope'), /Unknown brain slot/);
  });
});

// ---------------------------------------------------------------- slot status (REAL ModelRunnerService)

describe('local slot status via real ModelRunnerService', () => {
  let dir;
  let runner;
  beforeEach(async () => {
    dir = await tempDataDir();
    runner = new ModelRunnerService({ dataDir: dir, logger: quiet });
  });
  afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });

  it('reports all slots down when nothing is running', () => {
    const o = new TripleBrainOrchestrator({ runner, logger: quiet });
    const status = o.localSlotStatus();
    for (const slot of BRAIN_SLOTS) {
      assert.equal(status[slot].running, false, `${slot} should be down`);
    }
  });

  it('resolveSlot returns null provider when the slot server is absent', () => {
    const o = new TripleBrainOrchestrator({ runner, logger: quiet });
    for (const slot of BRAIN_SLOTS) {
      const { provider, source } = o.resolveSlot(slot);
      assert.equal(provider, null, `${slot} provider`);
      assert.equal(source, null, `${slot} source`);
    }
  });

  it('injected providers win over the (absent) runner', () => {
    const hacker = scriptedProvider({ structured: STRATEGY });
    const o = new TripleBrainOrchestrator({ runner, providers: { hacker }, logger: quiet });
    const { provider, source } = o.resolveSlot('hacker');
    assert.equal(provider, hacker);
    assert.equal(source, 'injected');
    assert.equal(o.resolveSlot('vision').provider, null);
  });

  it('describeSlotServers on the real runner matches localSlotStatus', () => {
    const o = new TripleBrainOrchestrator({ runner, logger: quiet });
    const described = runner.describeSlotServers();
    const status = o.localSlotStatus();
    for (const slot of BRAIN_SLOTS) {
      assert.equal(!!described[slot], status[slot].running);
    }
  });
});

// ---------------------------------------------------------------- missing-brain handling

describe('missing brains degrade gracefully', () => {
  it('missingBrains lists every empty slot', () => {
    const o = new TripleBrainOrchestrator({ logger: quiet });
    assert.deepEqual(o.missingBrains(), ['vision', 'grounding', 'hacker']);
  });

  it('logBrainStatus returns the missing list and warns once per slot', () => {
    const logger = recordingLogger();
    const o = new TripleBrainOrchestrator({ logger });
    const missing = o.logBrainStatus();
    assert.deepEqual(missing, ['vision', 'grounding', 'hacker']);
    assert.equal(logger.records.warn.length, 3, 'one loud warning per missing brain');
    assert.ok(logger.records.warn[0].includes('vision'), 'names the missing brain');
    o.logBrainStatus();
    assert.equal(logger.records.warn.length, 3, 'no repeat warnings');
  });

  it('think() with no brains at all returns ok:false and an idle strategy', async () => {
    const o = new TripleBrainOrchestrator({ logger: quiet });
    const res = await o.think({ target: 'example.com' });
    assert.equal(res.ok, false);
    assert.match(res.reason, /no hacker brain/i);
    assert.equal(res.strategy.nextAction.kind, 'observe');
  });

  it('think() falls back to the vision brain when hacker is missing', async () => {
    const vision = scriptedProvider({ structured: STRATEGY });
    const logger = recordingLogger();
    const o = new TripleBrainOrchestrator({ providers: { vision }, logger });
    const res = await o.think({ target: 'example.com' });
    assert.equal(res.ok, true);
    assert.equal(res.degraded, true, 'marked as degraded');
    assert.match(res.source, /fallback/);
    assert.equal(vision.calls.length, 1, 'vision brain was consulted');
  });

  it('see() reports the missing vision brain instead of throwing', async () => {
    const o = new TripleBrainOrchestrator({ logger: quiet });
    const res = await o.see({ imageBase64: 'aGVsbG8=' });
    assert.equal(res.ok, false);
    assert.match(res.reason, /vision brain missing/i);
  });

  it('act() reports the missing grounding brain instead of throwing', async () => {
    const o = new TripleBrainOrchestrator({ logger: quiet });
    const res = await o.act({ element: 'the login button' });
    assert.equal(res.ok, false);
    assert.match(res.reason, /grounding brain missing/i);
  });
});

// ---------------------------------------------------------------- think (hacker brain)

describe('think() — hacker brain strategy', () => {
  it('returns a normalized strategy from the hacker brain', async () => {
    const hacker = scriptedProvider({ structured: STRATEGY });
    const o = new TripleBrainOrchestrator({ providers: { hacker }, logger: quiet });
    const res = await o.think({
      target: 'https://example.com',
      stage: 'vuln',
      findings: [{ severity: 'low', title: 'Verbose banner', description: 'nginx/1.18' }]
    });
    assert.equal(res.ok, true);
    assert.equal(res.degraded, false);
    assert.equal(res.source, 'injected');
    assert.match(res.strategy.hypothesis, /XSS/);
    assert.equal(res.strategy.nextAction.kind, 'tool');
    assert.equal(res.strategy.nextAction.targetElement, 'the search box');
    assert.equal(res.strategy.vulnChains.length, 1);
    assert.equal(res.strategy.done, false);
    // The prompt carries target + findings context.
    const userMsg = hacker.calls[0].messages.find((m) => m.role === 'user').content;
    assert.match(userMsg, /example\.com/);
    assert.match(userMsg, /Verbose banner/);
  });

  it('normalizes partial/malformed strategy responses', async () => {
    const hacker = scriptedProvider({ structured: { hypothesis: 42 } });
    const o = new TripleBrainOrchestrator({ providers: { hacker }, logger: quiet });
    const res = await o.think({ target: 'example.com' });
    assert.equal(res.ok, true);
    assert.equal(res.strategy.hypothesis, '', 'non-string hypothesis coerced');
    assert.equal(res.strategy.nextAction.kind, 'observe', 'default action kind');
    assert.deepEqual(res.strategy.vulnChains, []);
    assert.equal(res.strategy.done, false);
  });

  it('propagates provider errors', async () => {
    const hacker = { async generateStructured() { throw new Error('llama-server exploded'); } };
    const o = new TripleBrainOrchestrator({ providers: { hacker }, logger: quiet });
    await assert.rejects(() => o.think({ target: 'example.com' }), /llama-server exploded/);
  });
});

// ---------------------------------------------------------------- see (vision brain)

describe('see() — vision brain', () => {
  it('describes a screenshot through the vision brain', async () => {
    const vision = scriptedProvider({ text: '<think>hmm</think>A login form with username and password fields.' });
    const o = new TripleBrainOrchestrator({ providers: { vision }, logger: quiet });
    const res = await o.see({ imageBase64: 'aGVsbG8=', hint: 'login state' });
    assert.equal(res.ok, true);
    assert.match(res.description, /login form/);
    assert.doesNotMatch(res.description, /<think>/, 'thinking tags stripped');
    const userMsg = vision.calls[0].messages.find((m) => m.role === 'user');
    const parts = userMsg.content;
    assert.ok(Array.isArray(parts), 'multimodal content parts');
    assert.ok(parts.some((p) => p.type === 'image_url' && p.image_url.url.startsWith('data:image/png;base64,')), 'image part attached');
    assert.ok(parts.some((p) => p.type === 'text' && p.text.includes('login state')), 'hint included');
  });

  it('requires a screenshot', async () => {
    const vision = scriptedProvider({ text: 'x' });
    const o = new TripleBrainOrchestrator({ providers: { vision }, logger: quiet });
    const res = await o.see({});
    assert.equal(res.ok, false);
    assert.match(res.reason, /no screenshot/i);
    assert.equal(vision.calls.length, 0, 'brain not consulted');
  });
});

// ---------------------------------------------------------------- act (grounding brain)

describe('act() — grounding brain coordinates', () => {
  it('returns clamped 0–1000 coordinates', async () => {
    const grounding = scriptedProvider({ structured: { x: 250, y: 800, confidence: 0.9 } });
    const o = new TripleBrainOrchestrator({ providers: { grounding }, logger: quiet });
    const res = await o.act({ element: 'the search box', imageBase64: 'aGVsbG8=' });
    assert.equal(res.ok, true);
    assert.equal(res.x, 250);
    assert.equal(res.y, 800);
    assert.equal(res.confidence, 0.9);
  });

  it('clamps out-of-range coordinates into 0–1000', async () => {
    const grounding = scriptedProvider({ structured: { x: -50, y: 1400 } });
    const o = new TripleBrainOrchestrator({ providers: { grounding }, logger: quiet });
    const res = await o.act({ element: 'the button' });
    assert.equal(res.ok, true);
    assert.equal(res.x, 0);
    assert.equal(res.y, 1000);
    assert.equal(res.confidence, null, 'missing confidence → null, not NaN');
  });

  it('rejects unusable coordinates instead of returning garbage', async () => {
    const grounding = scriptedProvider({ structured: { x: 'left-ish', y: null } });
    const o = new TripleBrainOrchestrator({ providers: { grounding }, logger: quiet });
    const res = await o.act({ element: 'the button' });
    assert.equal(res.ok, false);
    assert.match(res.reason, /unusable coordinates/i);
  });

  it('requires an element description', async () => {
    const grounding = scriptedProvider({ structured: { x: 1, y: 2 } });
    const o = new TripleBrainOrchestrator({ providers: { grounding }, logger: quiet });
    const res = await o.act({ element: '   ' });
    assert.equal(res.ok, false);
    assert.equal(grounding.calls.length, 0);
  });

  it('works without a screenshot (text-only grounding)', async () => {
    const grounding = scriptedProvider({ structured: { x: 500, y: 500 } });
    const o = new TripleBrainOrchestrator({ providers: { grounding }, logger: quiet });
    const res = await o.act({ element: 'the submit button' });
    assert.equal(res.ok, true);
    assert.equal(res.x, 500);
  });
});

// ---------------------------------------------------------------- full loop

describe('observeThinkAct() — full think → see → act cycle', () => {
  function fullBrains() {
    return {
      vision: scriptedProvider({ text: 'A search page with a prominent search box.' }),
      hacker: scriptedProvider({ structured: STRATEGY }),
      grounding: scriptedProvider({ structured: { x: 420, y: 210, confidence: 0.95 } })
    };
  }

  it('runs see → think → act in order with all brains present', async () => {
    const providers = fullBrains();
    const o = new TripleBrainOrchestrator({ providers, logger: quiet });
    const res = await o.observeThinkAct({
      imageBase64: 'aGVsbG8=',
      target: 'https://example.com',
      stage: 'recon'
    });
    assert.equal(res.observation.ok, true);
    assert.match(res.observation.description, /search page/);
    assert.equal(res.thought.ok, true);
    assert.equal(res.thought.strategy.nextAction.targetElement, 'the search box');
    assert.equal(res.grounded.ok, true);
    assert.equal(res.grounded.x, 420);
    assert.equal(res.grounded.y, 210);
    assert.deepEqual(res.missingBrains, []);
    assert.deepEqual([...res.brainsUsed].sort(), ['grounding', 'hacker', 'vision']);
    // Order: vision consulted before hacker, grounding last.
    const order = [
      ...providers.vision.calls.map(() => 'see'),
      ...providers.hacker.calls.map(() => 'think'),
      ...providers.grounding.calls.map(() => 'act')
    ];
    assert.deepEqual(order, ['see', 'think', 'act']);
  });

  it('skips grounding when the strategy names no UI target', async () => {
    const providers = fullBrains();
    providers.hacker = scriptedProvider({
      structured: { hypothesis: 'run nuclei', nextAction: { kind: 'tool', tool: 'nuclei' }, vulnChains: [], done: false }
    });
    const o = new TripleBrainOrchestrator({ providers, logger: quiet });
    const res = await o.observeThinkAct({ imageBase64: 'aGVsbG8=', target: 'example.com' });
    assert.equal(res.thought.ok, true);
    assert.equal(res.grounded, null, 'no target element → no grounding call');
    assert.equal(providers.grounding.calls.length, 0);
  });

  it('degrades gracefully when grounding is missing', async () => {
    const providers = fullBrains();
    delete providers.grounding;
    const logger = recordingLogger();
    const o = new TripleBrainOrchestrator({ providers, logger });
    const res = await o.observeThinkAct({ imageBase64: 'aGVsbG8=', target: 'example.com' });
    assert.equal(res.observation.ok, true, 'vision still worked');
    assert.equal(res.thought.ok, true, 'hacker still worked');
    assert.equal(res.grounded.ok, false, 'grounding reports missing');
    assert.deepEqual(res.missingBrains, ['grounding']);
    assert.ok(logger.records.warn.some((w) => w.includes('grounding')), 'loud missing-brain warning');
  });

  it('works with no screenshot (think-only cycle)', async () => {
    const providers = fullBrains();
    const o = new TripleBrainOrchestrator({ providers, logger: quiet });
    const res = await o.observeThinkAct({ target: 'example.com', observations: ['nuclei found nothing'] });
    assert.equal(res.observation.ok, false, 'no screenshot → no observation');
    assert.equal(res.thought.ok, true, 'think still runs on text context');
    const userMsg = providers.hacker.calls[0].messages.find((m) => m.role === 'user').content;
    assert.match(userMsg, /nuclei found nothing/, 'text observations reach the hacker brain');
  });
});

// ---------------------------------------------------------------- health

describe('healthCheck()', () => {
  it('reports per-slot health, marking missing brains', async () => {
    const hacker = scriptedProvider({ health: { reachable: true, model: 'dolphin-llama31-8b' } });
    const o = new TripleBrainOrchestrator({ providers: { hacker }, logger: quiet });
    const h = await o.healthCheck();
    assert.equal(h.hacker.ok, true);
    assert.equal(h.hacker.source, 'injected');
    assert.equal(h.vision.ok, false);
    assert.match(h.vision.reason, /no provider/i);
    assert.equal(h.grounding.ok, false);
  });

  it('surfaces unhealthy providers with reasons', async () => {
    const hacker = scriptedProvider({ health: { reachable: false, reason: 'connection refused' } });
    const o = new TripleBrainOrchestrator({ providers: { hacker }, logger: quiet });
    const h = await o.healthCheck();
    assert.equal(h.hacker.ok, false);
    assert.match(h.hacker.reason, /connection refused/);
  });
});

// ---------------------------------------------------------------- agentWorker wiring

describe('agentWorker wiring', () => {
  it('getTripleBrainOrchestratorForJob builds an orchestrator from job user selection', async () => {
    const { AgentWorker } = await import('../src/jobs/agentWorker.js');
    const fakeSelection = { provider: 'local', slotSources: {} };
    const fakeThis = {
      brainProviderModel: { getSelection: async () => fakeSelection },
      modelRunnerService: null,
      appConfig: {},
      logger: quiet
    };
    const orchestrator = await AgentWorker.prototype.getTripleBrainOrchestratorForJob.call(fakeThis, { userId: 'u1' });
    assert.ok(orchestrator instanceof TripleBrainOrchestrator);
    assert.deepEqual(orchestrator.missingBrains(), ['vision', 'grounding', 'hacker']);
  });

  it('returns null without a brainProviderModel or user', async () => {
    const { AgentWorker } = await import('../src/jobs/agentWorker.js');
    const fakeThis = { brainProviderModel: null, modelRunnerService: null, appConfig: {}, logger: quiet };
    assert.equal(await AgentWorker.prototype.getTripleBrainOrchestratorForJob.call(fakeThis, { userId: 'u1' }), null);
    const fakeThis2 = { brainProviderModel: { getSelection: async () => ({}) }, modelRunnerService: null, appConfig: {}, logger: quiet };
    assert.equal(await AgentWorker.prototype.getTripleBrainOrchestratorForJob.call(fakeThis2, {}), null);
  });
});
