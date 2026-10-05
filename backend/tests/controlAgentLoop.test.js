/**
 * Tests for the Infinity control agent loop (see → think → act):
 * backend/src/control/agentLoop.js + backend/src/control/actions.js.
 *
 * Everything is mocked — planner, grounder and bridge are injected, so no
 * screen, model or desktop is needed.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  runControlAgent,
  normalizePlannerDecision,
  actionLabel,
  STATUS
} from '../src/control/agentLoop.js';
import {
  CONTROL_ACTIONS,
  validateControlAction,
  executeControlAction,
  coordsToPixels,
  adaptLegacyBridge
} from '../src/control/actions.js';
import { MockComputerAdapter } from '../src/computer/mockComputerAdapter.js';

/** Minimal bridge mock: records execute() calls, serves a fixed screenshot. */
function makeBridge({ width = 1920, height = 1080 } = {}) {
  const calls = [];
  return {
    calls,
    async screenshot() {
      return { width, height, imageBase64: null };
    },
    async execute(action) {
      calls.push(action);
      return { ok: true, action, output: {}, observation: { summary: 'mock ok' }, error: null };
    }
  };
}

function collectEvents() {
  const events = [];
  return { events, onEvent: (e) => events.push(e) };
}

describe('control agent loop', () => {
  it('completes a 2-step task: ground → click → done', async () => {
    const bridge = makeBridge();
    const { events, onEvent } = collectEvents();
    const grounded = [];
    const planner = {
      async plan({ stepIndex }) {
        if (stepIndex === 0) {
          return { decision: 'act', action: { type: 'click', description: 'the address bar' } };
        }
        return { decision: 'done', summary: 'Clicked the address bar.' };
      }
    };
    const grounder = {
      async ground({ description }) {
        grounded.push(description);
        return { x: 500, y: 120 };
      }
    };

    const result = await runControlAgent('focus the browser address bar', {
      planner, grounder, bridge, onEvent, maxSteps: 10
    });

    assert.equal(result.ok, true);
    assert.equal(result.summary, 'Clicked the address bar.');
    assert.equal(result.steps.length, 1);
    assert.equal(result.steps[0].ok, true);
    assert.deepEqual(grounded, ['the address bar']);
    // 500/1000 of 1920 → 960; 120/1000 of 1080 → 130
    assert.equal(bridge.calls.length, 1);
    assert.equal(bridge.calls[0].type, 'click');
    assert.deepEqual(bridge.calls[0].params, { x: 960, y: 130 });
    // Infinity AI branded status events, suitable for SSE.
    const messages = events.map((e) => e.message);
    assert.ok(messages.includes(STATUS.LOOKING), 'expected a looking status event');
    assert.ok(messages.some((m) => m.startsWith('Infinity is clicking')), 'expected a clicking status event');
    assert.ok(messages.includes(STATUS.DONE));
    assert.ok(messages.every((m) => !/midscene|agent s|ui-tars/i.test(m)), 'no third-party names in UI copy');
  });

  it('replans when grounding fails (element not visible)', async () => {
    const bridge = makeBridge();
    const { events, onEvent } = collectEvents();
    let plans = 0;
    const planner = {
      async plan({ history }) {
        plans += 1;
        if (plans === 1) {
          return { decision: 'act', action: { type: 'click', description: 'the save button' } };
        }
        // Second plan sees the grounding failure in history and wraps up.
        assert.ok(history.some((s) => !s.ok && /Grounding failed/.test(s.error)));
        return { decision: 'done', summary: 'Save button was not visible; stopped safely.' };
      }
    };
    const grounder = { async ground() { return null; } }; // element not on screen

    const result = await runControlAgent('click save', { planner, grounder, bridge, onEvent, maxSteps: 5 });

    assert.equal(result.ok, true);
    assert.equal(result.steps.length, 1);
    assert.equal(result.steps[0].ok, false);
    assert.match(result.steps[0].error, /Grounding failed/);
    assert.equal(bridge.calls.length, 0, 'no click may fire without coordinates');
    assert.ok(events.some((e) => /could not find "the save button"/.test(e.message)));
  });

  it('stops at the max-steps guard instead of looping forever', async () => {
    const bridge = makeBridge();
    const planner = {
      async plan() {
        return { decision: 'act', action: { type: 'wait', params: { ms: 10 } } };
      }
    };
    const grounder = { async ground() { return { x: 1, y: 1 }; } };

    const result = await runControlAgent('do something endless', {
      planner, grounder, bridge, maxSteps: 3, onEvent: () => {}
    });

    assert.equal(result.ok, false);
    assert.equal(result.maxStepsHit, true);
    assert.equal(result.steps.length, 3);
    assert.match(result.summary, /3 steps/);
  });

  it('aborts cleanly on an empty instruction', async () => {
    const result = await runControlAgent('   ', {
      planner: {}, grounder: {}, bridge: makeBridge(), onEvent: () => {}
    });
    assert.equal(result.ok, false);
  });

  it('works through adaptLegacyBridge with the real MockComputerAdapter', async () => {
    const adapter = new MockComputerAdapter();
    const planner = {
      calls: 0,
      async plan() {
        this.calls += 1;
        return this.calls === 1
          ? { decision: 'act', action: { type: 'type', params: { text: 'hello' } } }
          : { decision: 'done', summary: 'Typed hello.' };
      }
    };
    const grounder = { async ground() { return { x: 10, y: 10 }; } };

    const result = await runControlAgent('type hello', {
      planner, grounder, bridge: adaptLegacyBridge(adapter), onEvent: () => {}
    });

    assert.equal(result.ok, true);
    assert.equal(adapter.typedText, 'hello');
  });
});

describe('control action schema', () => {
  it('rejects out-of-range coordinates', () => {
    for (const bad of [
      { x: 1500, y: 10 }, { x: -5, y: 10 }, { x: 10, y: 1001 },
      { x: NaN, y: 10 }, { x: '500', y: 10 }, { y: 10 }, {}
    ]) {
      const r = validateControlAction({ type: 'click', params: bad });
      assert.equal(r.valid, false, `expected rejection for ${JSON.stringify(bad)}`);
      assert.ok(r.errors.length > 0);
      assert.equal(r.action, null);
    }
  });

  it('accepts the full 0–1000 normalized range', () => {
    for (const good of [{ x: 0, y: 0 }, { x: 1000, y: 1000 }, { x: 42.7, y: 900 }]) {
      const r = validateControlAction({ type: CONTROL_ACTIONS.CLICK, params: good });
      assert.equal(r.valid, true, `expected acceptance for ${JSON.stringify(good)}`);
      assert.deepEqual([r.action.params.x, r.action.params.y],
        [Math.round(good.x), Math.round(good.y)]);
    }
  });

  it('executeControlAction never reaches the bridge for invalid actions', async () => {
    const bridge = makeBridge();
    const result = await executeControlAction(
      { type: 'click', params: { x: 1500, y: 10 } },
      bridge,
      { width: 1920, height: 1080 }
    );
    assert.equal(result.ok, false);
    assert.equal(result.rejected, true);
    assert.equal(bridge.calls.length, 0);
  });

  it('rejects oversized text and unsupported keys', () => {
    const long = validateControlAction({ type: 'type', params: { text: 'a'.repeat(2001) } });
    assert.equal(long.valid, false);
    const key = validateControlAction({ type: 'press', params: { keys: ['definitely-not-a-key'] } });
    assert.equal(key.valid, false);
    const okKey = validateControlAction({ type: 'press', params: { keys: ['ctrl', 'c'] } });
    assert.equal(okKey.valid, true);
    assert.deepEqual(okKey.action.params.keys, ['ctrl', 'c']);
  });

  it('rejects unknown action types', () => {
    const r = validateControlAction({ type: 'rm -rf', params: {} });
    assert.equal(r.valid, false);
  });

  it('coordsToPixels clamps to the visible screen', () => {
    assert.deepEqual(coordsToPixels(1000, 1000, 1920, 1080), { x: 1919, y: 1079 });
    assert.deepEqual(coordsToPixels(0, 0, 1920, 1080), { x: 0, y: 0 });
    assert.deepEqual(coordsToPixels(500, 500, 1920, 1080), { x: 960, y: 540 });
  });
});

describe('planner decision normalization', () => {
  it('passes through well-formed decisions', () => {
    assert.deepEqual(
      normalizePlannerDecision({ decision: 'done', summary: 'All good.' }),
      { decision: 'done', summary: 'All good.' }
    );
  });

  it('turns malformed replies into aborts, never actions', () => {
    for (const raw of [null, 'click the thing', { decision: 'act' }, { decision: 'maybe' }, {}]) {
      const d = normalizePlannerDecision(raw);
      assert.equal(d.decision, 'abort', `expected abort for ${JSON.stringify(raw)}`);
    }
  });

  it('action labels stay Infinity-branded', () => {
    assert.equal(actionLabel({ type: 'click' }), 'clicking');
    assert.equal(actionLabel({ type: 'type' }), 'typing');
    assert.equal(actionLabel({ type: 'bogus' }), 'working');
  });
});
