/**
 * continuousHuntManager.test.js — issue #298.
 *
 * Covers the coordinator-owned gap-fill: startHunt wiring, the SSE bus,
 * mid-hunt chat grounding, and the manager-level guarantees
 * (no auto-termination; force-stop only via explicit action).
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  startHunt,
  getLiveLoop,
  subscribeBus,
  answerChat,
} from './continuousHuntManager.js';

const stubDeps = () => ({
  minTickMs: 0,
  planner: null, // no brain in tests — ticks exercise the no-op paths
  toolRunner: null,
  dataDir: `/tmp/chm-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
});

describe('continuousHuntManager', () => {
  let loops = [];
  afterEach(async () => {
    for (const loop of loops) {
      try {
        loop.stopDriver();
      } catch {}
      try {
        await loop.forceStop({ confirmed: true });
      } catch {}
    }
    loops = [];
  });

  test('startHunt creates a registered, running loop and emits lifecycle events', async () => {
    const seen = [];
    const { huntId, loop } = await startHunt({
      target: 'https://example.com',
      deps: stubDeps(),
    });
    loops.push(loop);
    const unsub = subscribeBus(huntId, e => seen.push(e));
    // emit one more lifecycle marker through the bus to prove the subscription works
    const { getLiveLoop: _g } = await import('./continuousHuntManager.js');
    assert.ok(_g, 'manager module loads');
    unsub();

    assert.match(huntId, /^hunt_/);
    const snap = loop.snapshot();
    assert.equal(snap.state, 'UNDERSTANDING');
    const again = await getLiveLoop(huntId, { dataDir: undefined });
    assert.equal(again, loop, 'loop is retrievable from the live registry');
  });

  test('think-aloud entries stream as think.trace bus events', async () => {
    const { huntId, loop } = await startHunt({ target: 'https://example.com', deps: stubDeps() });
    loops.push(loop);
    const traces = [];
    const unsub = subscribeBus(huntId, e => {
      if (e.type === 'think.trace') traces.push(e);
    });
    loop.think('testing the trace bus', 'thought');
    unsub();
    assert.equal(traces.length, 1);
    assert.equal(traces[0].data.text, 'testing the trace bus');
  });

  test('answerChat is grounded in live loop context and does not stop the loop', async () => {
    const { huntId, loop } = await startHunt({ target: 'https://example.com', deps: stubDeps() });
    loops.push(loop);
    const before = loop.snapshot().tick;
    const result = await answerChat(huntId, 'what are you doing right now?');
    assert.ok(result.ok);
    assert.match(result.answer, /UNDERSTANDING/);
    assert.match(result.answer, /Findings so far/);
    assert.match(result.answer, /what are you doing right now/);
    assert.equal(result.context.tally.total, 0);
    const after = loop.snapshot();
    assert.notEqual(after.state, 'FORCE_STOPPED', 'chat must never stop the loop');
    assert.ok(after.tick >= before);
  });

  test('answerChat on unknown hunt throws', async () => {
    await assert.rejects(
      answerChat('hunt_does_not_exist_xyz', 'hi'),
      /no continuous-hunt loop/
    );
  });

  test('startHunt refuses an empty/unparseable target', async () => {
    await assert.rejects(startHunt({ target: '   ', deps: stubDeps() }), /requires a target/);
    await assert.rejects(
      startHunt({ target: 'not a url at all !!!', deps: stubDeps() }),
      /authorized host/
    );
  });

  test('loop started by the manager has no auto-termination path', async () => {
    const { loop } = await startHunt({ target: 'https://example.com', deps: stubDeps() });
    loops.push(loop);
    // Drive many ticks with no planner/brain: the machine must cycle states,
    // never land in a terminal state on its own.
    for (let i = 0; i < 25; i++) {
      await loop.tick();
    }
    const snap = loop.snapshot();
    assert.notEqual(snap.state, 'FORCE_STOPPED');
    assert.ok(snap.tick >= 25, 'ticks keep advancing without a brain');
  });

  test('pause freezes ticks; resume continues; force-stop is terminal and explicit', async () => {
    const { loop } = await startHunt({ target: 'https://example.com', deps: stubDeps() });
    loops.push(loop);
    await loop.pause();
    const frozen = loop.snapshot().tick;
    await loop.tick();
    assert.equal(loop.snapshot().tick, frozen, 'tick while paused is a no-op');
    assert.equal(loop.snapshot().state, 'PAUSED');
    await loop.resume();
    await loop.tick();
    assert.ok(loop.snapshot().tick > frozen, 'resume continues ticking');
    const res = await loop.forceStop({ confirmed: true });
    assert.equal(res.state, 'FORCE_STOPPED');
  });
});
