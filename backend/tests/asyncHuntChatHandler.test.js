/**
 * Handler-level regression test: POST /hunts/:id/chat must return 202
 * immediately and answer in the background over the SSE bus.
 *
 * Uses a fake loop registered in the controller registry. The manager's own
 * registry has no such loop, so the background answerChat takes the
 * "no loop" failure path — which must STILL surface as a hunt.chat event
 * (the console's "thinking…" state must always resolve).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import {
  createContinuousHuntController,
  registerLoop,
} from '../src/controllers/continuousHuntController.js';
import { subscribeBus } from '../src/hunt/continuousHuntManager.js';

const tick = (ms = 25) => new Promise(r => setTimeout(r, ms));

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('POST /hunts/:id/chat async contract', () => {
  it('returns 202 immediately and emits a hunt.chat event in the background', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-chat-test-'));
    const quiet = { info() {}, warn() {}, error() {}, debug() {} };
    const controller = createContinuousHuntController({ dataDir, logger: quiet, brainDeps: {} });

    const huntId = `hunt_chat_handler_${Date.now()}`;
    // Fake live loop: satisfies the controller's ownership gate.
    registerLoop({
      huntId,
      state: { userId: 'user_test', state: 'RECON', tick: 3 },
      snapshot: () => ({ state: 'RECON', tick: 3, tally: {}, findings: [], trace: [] }),
    });

    const seen = [];
    const unsubscribe = subscribeBus(huntId, evt => seen.push(evt));
    try {
      const req = {
        params: { id: huntId },
        body: { message: 'what are you doing?' },
        user: { id: 'user_test' },
      };
      const res = mockRes();
      const started = Date.now();
      await controller.chat(req, res);
      const elapsed = Date.now() - started;

      assert.equal(res.statusCode, 202, 'chat must be accepted, not awaited');
      assert.equal(res.body?.ok, true);
      assert.equal(res.body?.accepted, true);
      assert.ok(res.body?.chatId, '202 must carry a chatId for SSE matching');
      assert.ok(elapsed < 2000, `handler must not block on the brain (took ${elapsed}ms)`);

      // The background answerChat resolves (here: failure path) and the
      // failure is STILL pushed to the SSE bus with the same chatId.
      for (let i = 0; i < 40 && !seen.some(e => e.type === 'hunt.chat'); i++) await tick();
      const chatEvt = seen.find(e => e.type === 'hunt.chat');
      assert.ok(chatEvt, 'a hunt.chat event must reach the SSE stream');
      assert.equal(String(chatEvt.data?.chatId), String(res.body.chatId));
    } finally {
      unsubscribe?.();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('400s on a missing message without touching the loop', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-chat-test-'));
    const quiet = { info() {}, warn() {}, error() {}, debug() {} };
    const controller = createContinuousHuntController({ dataDir, logger: quiet, brainDeps: {} });
    try {
      const res = mockRes();
      await controller.chat({ params: { id: 'hunt_nope' }, body: {}, user: { id: 'u' } }, res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.error?.code, 'MISSING_MESSAGE');
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
