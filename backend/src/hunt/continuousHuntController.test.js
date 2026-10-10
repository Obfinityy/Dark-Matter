/**
 * continuousHuntController.test.js — controller tests for the continuous
 * hunt loop endpoints (issue #298).
 *
 * Run: cd backend && node --test src/hunt/continuousHuntController.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createContinuousHuntController,
  registerLoop,
  unregisterLoop,
} from '../controllers/continuousHuntController.js';
import { ContinuousHuntLoop } from './continuousHuntLoop.js';
import { startHunt, getLiveLoop } from './continuousHuntManager.js';

const quiet = { info() {}, warn() {}, error() {} };

let dataDir;
let controller;
beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ch-ctl-'));
  controller = createContinuousHuntController({ dataDir, logger: quiet });
});
afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

/** Minimal express-ish res mock. */
function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    sent: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    setHeader(k, v) {
      res.headers[k.toLowerCase()] = v;
    },
    json(obj) {
      res.body = obj;
      return res;
    },
    send(buf) {
      res.sent = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || '');
      return res;
    },
  };
  return res;
}

function mockReq({ params = {}, body = {} } = {}) {
  return { params, body };
}

/** asyncHandler forwards errors to next — surface them in tests. */
function next() {
  return err => {
    if (err) throw err;
  };
}

async function liveLoopWithFindings() {
  const loop = await ContinuousHuntLoop.start({
    huntId: `h-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    target: 'example.com',
    deps: { dataDir, minTickMs: 0, logger: quiet },
    logger: quiet,
  });
  await loop.recordFinding({ title: 'SQLi in login', severity: 'critical', target: 'example.com', description: 'd', evidence: 'e' });
  await loop.recordFinding({ title: 'Missing HSTS', severity: 'low', target: 'example.com', description: 'd', evidence: 'e' });
  registerLoop(loop);
  return loop;
}

describe('tally', () => {
  it('returns the current severity tally', async () => {
    const loop = await liveLoopWithFindings();
    const res = mockRes();
    await controller.tally(mockReq({ params: { id: loop.huntId } }), res, next());
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.tally, {
      critical: 1, high: 0, medium: 0, low: 1, informational: 0, total: 2,
    });
    assert.equal(res.body.state, loop.state.state);
  });

  it('404s for an unknown hunt', async () => {
    const res = mockRes();
    await controller.tally(mockReq({ params: { id: 'nope' } }), res, next());
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error.code, 'LOOP_NOT_FOUND');
  });
});

describe('reportSnapshot', () => {
  it('returns a PDF built from current findings WITHOUT touching the loop', async () => {
    const loop = await liveLoopWithFindings();
    await loop.tick(); // UNDERSTANDING → RECON
    const tickBefore = loop.state.tick;
    const stateBefore = loop.state.state;

    const res = mockRes();
    await controller.reportSnapshot(mockReq({ params: { id: loop.huntId } }), res, next());

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.ok(res.sent.length > 100, 'non-trivial PDF body');
    assert.equal(res.sent.slice(0, 5).toString('latin1'), '%PDF-');

    // The snapshot was read-only: loop state untouched by the snapshot itself…
    assert.equal(loop.state.tick, tickBefore);
    assert.equal(loop.state.state, stateBefore);
    // …and the loop keeps ticking afterwards.
    const r = await loop.tick();
    assert.equal(r.ticked, true);
    assert.ok(loop.state.tick > tickBefore);
    unregisterLoop(loop.huntId);
  });

  it('404s for an unknown hunt', async () => {
    const res = mockRes();
    await controller.reportSnapshot(mockReq({ params: { id: 'nope' } }), res, next());
    assert.equal(res.statusCode, 404);
  });
});

describe('pause / resume / force-stop', () => {
  it('pauses and resumes through the controller', async () => {
    const loop = await liveLoopWithFindings();
    let res = mockRes();
    await controller.pause(mockReq({ params: { id: loop.huntId } }), res, next());
    assert.equal(res.body.state, 'PAUSED');
    assert.equal(loop.state.state, 'PAUSED');

    res = mockRes();
    await controller.resume(mockReq({ params: { id: loop.huntId } }), res, next());
    assert.notEqual(res.body.state, 'PAUSED');
    assert.notEqual(loop.state.state, 'PAUSED');
    unregisterLoop(loop.huntId);
  });

  it('force-stop requires explicit confirmation', async () => {
    const loop = await liveLoopWithFindings();
    let res = mockRes();
    await controller.forceStop(mockReq({ params: { id: loop.huntId }, body: {} }), res, next());
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'CONFIRMATION_REQUIRED');
    assert.notEqual(loop.state.state, 'FORCE_STOPPED');

    res = mockRes();
    await controller.forceStop(
      mockReq({ params: { id: loop.huntId }, body: { confirmed: true } }),
      res,
      next()
    );
    assert.equal(res.body.state, 'FORCE_STOPPED');
    assert.equal(loop.state.state, 'FORCE_STOPPED');
    unregisterLoop(loop.huntId);
  });

  it('pause hits the REAL loop even when the controller registry missed it', async () => {
    // Regression: the manager once failed to register the loop with the
    // controller (bad dynamic-import path, swallowed by try/catch), so
    // pause/resume/force-stop acted on a driverless disk-loaded phantom while
    // the real hunt kept ticking. The controller must fall back to the
    // manager's live registry instead of serving a phantom.
    const started = await startHunt({
      target: 'example.com',
      deps: { dataDir, minTickMs: 0 },
      logger: quiet,
    });
    const huntId = started.huntId;
    unregisterLoop(huntId); // simulate the missed registration: controller map empty
    const live = await getLiveLoop(huntId, { dataDir, logger: quiet });
    assert.ok(live, 'manager holds the live loop');
    assert.notEqual(live.state.state, 'PAUSED');

    const res = mockRes();
    await controller.pause(mockReq({ params: { id: huntId } }), res, next());
    assert.equal(res.body.state, 'PAUSED');
    assert.equal(
      live.state.state,
      'PAUSED',
      'the REAL running loop must pause — not a disk-loaded phantom'
    );

    const tallyRes = mockRes();
    await controller.tally(mockReq({ params: { id: huntId } }), tallyRes, next());
    assert.equal(tallyRes.body.state, 'PAUSED', 'tally must report the live loop state');
    live.stopDriver();
    unregisterLoop(huntId);
  });

  it('404s for unknown hunts on all controls', async () => {
    for (const handler of ['pause', 'resume', 'forceStop']) {
      const res = mockRes();      await controller[handler](
        mockReq({ params: { id: 'nope' }, body: { confirmed: true } }),
        res,
        next()
      );
      assert.equal(res.statusCode, 404, handler);
    }
  });
});
