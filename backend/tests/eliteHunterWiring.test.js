/**
 * eliteHunterWiring.test.js — offline tests for the Elite Hunter wiring:
 * methodology context in think(), brain orders in the strategy schema,
 * and the see→think→act loop obeying the hacking brain's orders.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TripleBrainOrchestrator } from '../src/services/tripleBrainOrchestrator.js';
import { TripleBrainHuntAdapter } from '../src/agent/tripleBrainHuntAdapter.js';

function fakeProvider(responses = {}) {
  return {
    async generateStructured(messages, _schema, _opts) {
      fakeProvider.lastMessages = messages;
      return responses.strategy || {};
    },
    async generate(messages, _opts) {
      fakeProvider.lastSeeMessages = messages;
      return responses.see || 'a login page';
    },
  };
}

function makeOrchestrator(responses) {
  const provider = fakeProvider(responses);
  const o = new TripleBrainOrchestrator({
    logger: { info() {}, warn() {}, error() {} },
    providers: { hacker: provider, vision: provider, grounding: provider },
  });
  // resolveSlot uses runner selection; stub it to return our fake provider.
  o.resolveSlot = (slot) => ({ provider, source: `test-${slot}` });
  o.logBrainStatus = () => [];
  return o;
}

describe('elite methodology in think()', () => {
  test('context includes methodology stage and untried techniques', async () => {
    const o = makeOrchestrator({ strategy: { nextAction: { kind: 'observe' } } });
    await o.think({ target: 'https://example.com', stage: 'probing', findings: [], history: [] });
    const userMsg = fakeProvider.lastMessages.find((m) => m.role === 'user').content;
    assert.match(userMsg, /Elite methodology — current stage: probing/);
    assert.match(userMsg, /Untried techniques for this stage/);
    assert.match(userMsg, /XSS probing|SQL injection probing/);
    const sysMsg = fakeProvider.lastMessages.find((m) => m.role === 'system').content;
    assert.match(sysMsg, /visionInstruction and groundingInstruction/);
  });

  test('tried techniques are filtered out of the suggestions', async () => {
    const o = makeOrchestrator({ strategy: { nextAction: { kind: 'observe' } } });
    await o.think({
      target: 'https://example.com',
      stage: 'recon',
      findings: [],
      history: ['did subdomain enum and js discovery already'],
    });
    const userMsg = fakeProvider.lastMessages.find((m) => m.role === 'user').content;
    assert.doesNotMatch(userMsg, /Subdomain enumeration/);
  });
});

describe('brain orders', () => {
  test('_normalizeStrategy passes vision/grounding instructions through', () => {
    const o = makeOrchestrator({});
    const s = o._normalizeStrategy({
      nextAction: { kind: 'click' },
      visionInstruction: 'Screenshot the login page and list all fields.',
      groundingInstruction: 'Return coordinates for the Submit button.',
    });
    assert.equal(s.visionInstruction, 'Screenshot the login page and list all fields.');
    assert.equal(s.groundingInstruction, 'Return coordinates for the Submit button.');
  });

  test('_normalizeStrategy defaults orders to empty strings', () => {
    const o = makeOrchestrator({});
    const s = o._normalizeStrategy({ nextAction: { kind: 'observe' } });
    assert.equal(s.visionInstruction, '');
    assert.equal(s.groundingInstruction, '');
  });

  test('adapter surfaces brainOrders on the decision', () => {
    const adapter = new TripleBrainHuntAdapter({
      orchestrator: makeOrchestrator({}),
      logger: { info() {}, warn() {} },
    });
    const d = adapter.strategyToDecision(
      {
        hypothesis: 'XSS in search',
        nextAction: { kind: 'tool', tool: 'dalfox', rationale: 'test reflections' },
        visionInstruction: 'Watch the search page for reflections.',
        groundingInstruction: '',
      },
      { job: { target: 'https://example.com' }, findings: [] },
      {}
    );
    assert.deepEqual(d.brainOrders, {
      vision: 'Watch the search page for reflections.',
      grounding: '',
    });
  });

  test('observeThinkAct uses the grounding order as the act target', async () => {
    let actedWith = null;
    const o = makeOrchestrator({
      strategy: {
        nextAction: { kind: 'click', targetElement: 'fallback button' },
        groundingInstruction: 'Return coordinates for the glowing Submit button.',
      },
    });
    o.act = async ({ element }) => { actedWith = element; return { ok: true, x: 1, y: 2 }; };
    await o.observeThinkAct({ target: 'https://example.com' });
    assert.equal(actedWith, 'Return coordinates for the glowing Submit button.');
  });

  test('observeThinkAct passes the previous vision order as the see hint', async () => {
    const o = makeOrchestrator({ strategy: { nextAction: { kind: 'observe' } } });
    await o.observeThinkAct({
      target: 'https://example.com',
      imageBase64: 'fake',
      brainOrders: { vision: 'Focus on the payment form.', grounding: '' },
    });
    const userContent = JSON.stringify(fakeProvider.lastSeeMessages);
    assert.match(userContent, /Focus on the payment form/);
  });
});
