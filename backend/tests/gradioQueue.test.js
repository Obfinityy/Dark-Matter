/**
 * gradioQueue.test.js — per-endpoint FIFO message queue for the Gradio brain.
 *
 * The Hacking brain runs on ONE remote GPU (Kaggle/Colab). Concurrent
 * messages must serialize: one inference at a time, first-in-first-out,
 * no overlap, no input/output mixing — even when the hunt loop, mid-hunt
 * chat, and agent poller all talk to the brain at once.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { GradioProvider, gradioQueueDepth } = await import(
  '../src/agent/providers/gradioProvider.js'
);

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Provider with the network layer stubbed — records call order + overlap. */
function stubbedProvider(url, log) {
  const p = new GradioProvider({ baseUrl: url });
  let active = 0;
  p._chatOnceUnqueued = async prompt => {
    active += 1;
    log.push(`start:${prompt}:active=${active}`);
    // Overlap detector: more than 1 active call = queue broken.
    if (active > 1) log.push(`OVERLAP:${prompt}`);
    await sleep(20);
    active -= 1;
    log.push(`end:${prompt}`);
    return `reply:${prompt}`;
  };
  return p;
}

describe('gradio per-endpoint FIFO queue', () => {
  test('concurrent messages to the same endpoint never overlap', async () => {
    const log = [];
    const url = 'https://queue-test-1.gradio.live';
    // Separate instances (like resolveSlot creates per call) sharing one URL.
    const providers = [0, 1, 2, 3, 4].map(() => stubbedProvider(url, log));
    const results = await Promise.all(
      providers.map((p, i) => p.chatOnce(`msg${i}`))
    );
    assert.deepEqual(results, ['reply:msg0', 'reply:msg1', 'reply:msg2', 'reply:msg3', 'reply:msg4']);
    assert.ok(!log.some(l => l.startsWith('OVERLAP')), `overlap detected: ${log.join(' | ')}`);
    // FIFO: starts happen in call order.
    const starts = log.filter(l => l.startsWith('start:'));
    assert.deepEqual(
      starts.map(s => s.split(':')[1]),
      ['msg0', 'msg1', 'msg2', 'msg3', 'msg4']
    );
  });

  test('a failing message does not jam the queue', async () => {
    const log = [];
    const url = 'https://queue-test-2.gradio.live';
    const bad = stubbedProvider(url, log);
    bad._chatOnceUnqueued = async () => {
      await sleep(10);
      throw new Error('simulated GPU failure');
    };
    const good = stubbedProvider(url, log);
    const results = await Promise.allSettled([
      bad.chatOnce('bad'),
      good.chatOnce('good1'),
      good.chatOnce('good2'),
    ]);
    assert.equal(results[0].status, 'rejected');
    assert.equal(results[1].status, 'fulfilled');
    assert.equal(results[1].value, 'reply:good1');
    assert.equal(results[2].status, 'fulfilled');
    assert.equal(results[2].value, 'reply:good2');
  });

  test('different endpoints have independent queues', async () => {
    const logA = [];
    const logB = [];
    const pA = stubbedProvider('https://queue-test-a.gradio.live', logA);
    const pB = stubbedProvider('https://queue-test-b.gradio.live', logB);
    const t0 = Date.now();
    // Each stub sleeps 50ms; serial would take ~100ms, parallel ~50ms.
    await Promise.all([pA.chatOnce('a'), pB.chatOnce('b')]);
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 95, `endpoints should run in parallel, took ${elapsed}ms`);
    assert.equal(gradioQueueDepth('https://queue-test-a.gradio.live'), 0);
  });

  test('queue drains to zero depth after work completes', async () => {
    const log = [];
    const url = 'https://queue-test-3.gradio.live';
    const p = stubbedProvider(url, log);
    await Promise.all([p.chatOnce('x'), p.chatOnce('y'), p.chatOnce('z')]);
    assert.equal(gradioQueueDepth(url), 0);
  });
});
