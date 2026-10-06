/**
 * tripleBrainHuntAdapter.test.js — hunt-loop wiring for the three LOCAL
 * brain slots (overnight mission ②).
 *
 * The adapter implements the hunt loop's brain interface
 * (health / decide / statusLabel) on top of the TripleBrainOrchestrator,
 * and AgentWorker.tripleBrainFallbackFor() engages it when the resilient
 * brain chain is down — before the deterministic fallback.
 *
 * Run: cd backend && node --test tests/tripleBrainHuntAdapter.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TripleBrainHuntAdapter } from '../src/agent/tripleBrainHuntAdapter.js';
import { AgentWorker } from '../src/jobs/agentWorker.js';

const quiet = { log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

function fakeOrchestrator({ checks, strategy, thinkError = null, thinkOk = true, missing = [] } = {}) {
  const warnings = [];
  return {
    warnings,
    logger: { warn: (m) => warnings.push(m), info: () => {} },
    async healthCheck() { return checks; },
    logBrainStatus() { return missing; },
    async think() {
      if (thinkError) throw thinkError;
      return { ok: thinkOk, degraded: false, source: 'local', strategy, reason: thinkOk ? null : 'no thinking brain' };
    },
  };
}

const ALL_DOWN = {
  vision: { ok: false, source: null, reason: 'no provider — slot has no running model' },
  grounding: { ok: false, source: null, reason: 'no provider — slot has no running model' },
  hacker: { ok: false, source: null, reason: 'no provider — slot has no running model' },
};

const HACKER_UP = {
  vision: { ok: true, source: 'local', port: 1111 },
  grounding: { ok: false, source: null, reason: 'no provider' },
  hacker: { ok: true, source: 'local', port: 2222 },
};

const VISION_ONLY = {
  vision: { ok: true, source: 'local', port: 1111 },
  grounding: { ok: false, source: null, reason: 'no provider' },
  hacker: { ok: false, source: null, reason: 'no provider' },
};

function toolStrategy(tool = 'nuclei') {
  return {
    hypothesis: 'Target runs a JavaScript-heavy app — scan for known vulns.',
    nextAction: { kind: 'tool', tool, rationale: 'template scan for known CVEs' },
    vulnChains: [{ chain: 'xss → session theft', steps: ['steal cookie'], impact: 'ATO' }],
    done: false,
  };
}

describe('TripleBrainHuntAdapter.health', () => {
  it('is available in triple mode when the hacker slot is up', async () => {
    const a = new TripleBrainHuntAdapter({ orchestrator: fakeOrchestrator({ checks: HACKER_UP }), logger: quiet });
    const h = await a.health();
    assert.equal(h.available, true);
    assert.equal(h.provider, 'triple-brain');
    assert.equal(h.mode, 'triple');
  });

  it('degrades honestly to vision reasoning when the hacker slot is missing', async () => {
    const a = new TripleBrainHuntAdapter({ orchestrator: fakeOrchestrator({ checks: VISION_ONLY }), logger: quiet });
    const h = await a.health();
    assert.equal(h.available, true);
    assert.equal(h.mode, 'triple-degraded');
    assert.match(h.detail.note, /Hacker brain MISSING/);
  });

  it('is unavailable with a clear reason naming every missing slot', async () => {
    const a = new TripleBrainHuntAdapter({ orchestrator: fakeOrchestrator({ checks: ALL_DOWN }), logger: quiet });
    const h = await a.health();
    assert.equal(h.available, false);
    assert.match(h.reason, /vision/);
    assert.match(h.reason, /grounding/);
    assert.match(h.reason, /hacker/);
  });
});

describe('TripleBrainHuntAdapter.decide', () => {
  const ctx = (over = {}) => ({
    job: { id: 'j1', target: 'https://target.test', phase: 'recon', ...over.job },
    recentObservations: [],
    findings: [],
    recentCycles: [],
    ...over,
  });

  it('translates a hacker tool strategy into a loop tool action', async () => {
    const a = new TripleBrainHuntAdapter({
      orchestrator: fakeOrchestrator({ checks: HACKER_UP, strategy: toolStrategy('nuclei') }),
      logger: quiet,
    });
    const { decision } = await a.decide(ctx());
    assert.equal(decision.nextAction.type, 'tool');
    assert.equal(decision.nextAction.name, 'nuclei');
    assert.equal(decision.nextAction.target, 'https://target.test');
    assert.match(decision.reason, /Triple-brain \(hacker slot/);
    assert.equal(decision.hypotheses.length, 1);
    assert.match(decision.hypotheses[0].hypothesis, /xss → session theft/);
  });

  it('sanitizes an unknown hacker tool pick to web_probe', async () => {
    const warned = [];
    const a = new TripleBrainHuntAdapter({
      orchestrator: fakeOrchestrator({ checks: HACKER_UP, strategy: toolStrategy('rm -rf /') }),
      logger: { ...quiet, warn: (m) => warned.push(m) },
    });
    const { decision } = await a.decide(ctx());
    assert.equal(decision.nextAction.name, 'web_probe');
    assert.ok(warned.some((w) => w.includes('unknown tool')), 'must log the sanitization');
  });

  it('maps done:true to a complete action', async () => {
    const a = new TripleBrainHuntAdapter({
      orchestrator: fakeOrchestrator({ checks: HACKER_UP, strategy: { ...toolStrategy(), done: true } }),
      logger: quiet,
    });
    const { decision } = await a.decide(ctx());
    assert.equal(decision.nextAction.type, 'complete');
  });

  it('maps click strategies to computer actions', async () => {
    const a = new TripleBrainHuntAdapter({
      orchestrator: fakeOrchestrator({
        checks: HACKER_UP,
        strategy: {
          hypothesis: 'Login form is the way in.',
          nextAction: { kind: 'click', targetElement: 'the Sign in button', rationale: 'open the login form' },
          done: false,
        },
      }),
      logger: quiet,
    });
    const { decision } = await a.decide(ctx());
    assert.equal(decision.nextAction.type, 'computer_action');
    assert.equal(decision.nextAction.action.type, 'click');
  });

  it('delegates to the deterministic brain when think() throws', async () => {
    const deterministic = {
      async decide() {
        return { decision: { nextAction: { type: 'tool', name: 'web_probe' }, reason: 'deterministic' } };
      },
    };
    const a = new TripleBrainHuntAdapter({
      orchestrator: fakeOrchestrator({ checks: HACKER_UP, thinkError: new Error('slot died') }),
      deterministic,
      logger: quiet,
    });
    const { decision } = await a.decide(ctx());
    assert.equal(decision.nextAction.name, 'web_probe');
    assert.equal(decision.brainSource, 'triple-degraded-deterministic');
    assert.equal(a.degradedDecisions, 1);
  });

  it('delegates to the deterministic brain when no thinking slot answers', async () => {
    const deterministic = {
      async decide() {
        return { decision: { nextAction: { type: 'tool', name: 'web_probe' }, reason: 'deterministic' } };
      },
    };
    const a = new TripleBrainHuntAdapter({
      orchestrator: fakeOrchestrator({ checks: VISION_ONLY, thinkOk: false }),
      deterministic,
      logger: quiet,
    });
    const { decision } = await a.decide(ctx());
    assert.equal(decision.nextAction.name, 'web_probe');
  });

  it('throws a clear error when think() fails and no deterministic brain is wired', async () => {
    const a = new TripleBrainHuntAdapter({
      orchestrator: fakeOrchestrator({ checks: HACKER_UP, thinkError: new Error('slot died') }),
      logger: quiet,
    });
    await assert.rejects(() => a.decide(ctx()), /no deterministic fallback is wired/);
  });

  it('statusLabel names the brain source', () => {
    assert.match(
      TripleBrainHuntAdapter.statusLabel({ nextAction: { type: 'tool', name: 'nuclei' } }),
      /Triple-brain \(hacker slot\): running nuclei/
    );
    assert.match(
      TripleBrainHuntAdapter.statusLabel({ nextAction: { type: 'tool', name: 'nuclei' }, brainSource: 'triple-degraded' }),
      /vision covering hacker/
    );
  });
});

describe('AgentWorker.tripleBrainFallbackFor', () => {
  function workerWith(getCached) {
    const w = Object.create(AgentWorker.prototype);
    w.brainProviderModel = { getSelection: async () => ({ provider: 'local' }) };
    w.modelRunnerService = null;
    w.appConfig = {};
    w.logger = quiet;
    w.config = { deterministicFallback: false };
    if (getCached) w.getCachedTripleBrainOrchestrator = getCached;
    return w;
  }

  it('returns null when no slot server is usable (real orchestrator, empty runner)', async () => {
    const w = workerWith();
    const out = await w.tripleBrainFallbackFor({ id: 'j1', userId: 'u1' });
    assert.equal(out, null, 'no slots up → fall through to deterministic');
  });

  it('engages the adapter when at least one slot is usable', async () => {
    const orch = fakeOrchestrator({ checks: HACKER_UP, strategy: toolStrategy(), missing: ['grounding'] });
    const w = workerWith(async () => orch);
    const out = await w.tripleBrainFallbackFor({ id: 'j1', userId: 'u1' });
    assert.ok(out, 'expected the triple-brain fallback to engage');
    assert.ok(out.adapter instanceof TripleBrainHuntAdapter);
    assert.deepEqual(out.live, ['vision', 'hacker']);
    assert.deepEqual(out.missing, ['grounding']);
    assert.equal(out.mode, 'triple-brain');
    const h = await out.adapter.health();
    assert.equal(h.available, true);
  });

  it('returns null without a user on the job', async () => {
    const w = workerWith();
    assert.equal(await w.tripleBrainFallbackFor({ id: 'j1' }), null);
  });
});
