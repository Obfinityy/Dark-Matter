/**
 * modelRunnerDownload.test.js — PROOF that the Models download → Run flow
 * works end to end (with a fixture, not multi-GB weights).
 *
 * A local HTTP server on :4563 serves a 5MB fixture GGUF with Range support.
 * The test then asserts, against the REAL production code paths:
 *   1. POST /models/:id/download (controller.downloadById) → 202 started
 *   2. GET  /models/:id/progress (controller.progressById, real SSE code)
 *      emits percent 0 → 100 and a terminal done at 100%
 *   3. the file lands byte-identical (sha256) to the fixture
 *   4. resume works: a 2MB partial file is continued via Range, not restarted
 *   5. POST /models/:id/run (controller.run, with the llama-server spawn
 *      stubbed — no binary in this sandbox) sets the ACTIVE localhost brain:
 *      brainProviderModel selection { provider:'local', modelId } persists and
 *      active-brain.json is written on disk
 *
 * Honest scope: real 8B–70B weight downloads happen on the USER's machine.
 * Everything the sandbox CAN run is proven here.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { ModelRunnerService } from '../src/services/modelRunner/modelRunnerService.js';
import { createModelRunnerController } from '../src/controllers/modelRunnerController.js';

const PORT = 4563;
const FIXTURE_BYTES = 5 * 1024 * 1024; // 5MB
const fixture = crypto.randomBytes(FIXTURE_BYTES);
const fixtureHash = crypto.createHash('sha256').update(fixture).digest('hex');

let server;
let lastRangeHeader = null;

function fixtureUrl(p = '/fixture.gguf') {
  return `http://127.0.0.1:${PORT}${p}`;
}

function startFixtureServer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      if (req.url !== '/fixture.gguf') {
        res.writeHead(404);
        res.end();
        return;
      }
      if (req.method === 'HEAD') {
        res.writeHead(200, { 'content-length': fixture.length, 'accept-ranges': 'bytes' });
        res.end();
        return;
      }
      const range = req.headers.range;
      lastRangeHeader = range || null;
      if (range) {
        const m = /^bytes=(\d+)-$/.exec(range);
        const start = m ? Number(m[1]) : 0;
        const slice = fixture.subarray(start);
        res.writeHead(206, {
          'content-range': `bytes ${start}-${fixture.length - 1}/${fixture.length}`,
          'content-length': slice.length,
          'accept-ranges': 'bytes'
        });
        // Throttle: 64KB chunks with a tiny delay so multiple progress
        // events fire and the SSE test observes a real 0→100 ramp.
        let offset = 0;
        const pump = () => {
          if (offset >= slice.length) return res.end();
          const end = Math.min(offset + 65536, slice.length);
          res.write(slice.subarray(offset, end));
          offset = end;
          setTimeout(pump, 5);
        };
        pump();
        return;
      }
      res.writeHead(200, { 'content-length': fixture.length, 'accept-ranges': 'bytes' });
      let offset = 0;
      const pump = () => {
        if (offset >= fixture.length) return res.end();
        const end = Math.min(offset + 65536, fixture.length);
        res.write(fixture.subarray(offset, end));
        offset = end;
        setTimeout(pump, 5);
      };
      pump();
    });
    server.listen(PORT, '127.0.0.1', resolve);
  });
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function makeService() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-w2-'));
  const service = new ModelRunnerService({ dataDir, logger: { info() {}, warn() {}, error() {} } });
  const fixtureModel = (id) => ({
    id,
    name: `Fixture ${id}`,
    params: 'fixture',
    quant: 'Q4_K_M',
    tier: 'test',
    sizeGB: 0.0047,
    sizeBytes: FIXTURE_BYTES,
    uncensored: true,
    custom: true,
    requirements: { ramGB: 1, vramGB: 0, gpuRequired: false },
    description: 'Test fixture'
  });
  service.customModels.push(fixtureModel('fixture-5mb'), fixtureModel('fixture-resume'), fixtureModel('fixture-ctrl'));
  // Point the download URL at the local fixture server (production code
  // reads it through this method — the override is test-only).
  service.resolveDownloadUrl = () => fixtureUrl();
  return service;
}

function waitForDownloadDone(service, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const s = service.describeDownload();
      if (s.status === 'done') return resolve(s);
      if (s.status === 'error' || s.status === 'cancelled') {
        return reject(new Error(`download failed: ${s.error || s.status}`));
      }
      if (Date.now() - start > timeoutMs) return reject(new Error('download timed out'));
      setTimeout(tick, 50);
    };
    tick();
  });
}

/** Minimal express-like mocks for controller handlers. */
function mockReqRes({ params = {}, body = {}, user = null } = {}) {
  const chunks = [];
  const closeHandlers = {};
  const req = {
    params,
    body,
    user,
    on: (event, fn) => { closeHandlers[event] = fn; }
  };
  const res = {
    chunks,
    statusCode: null,
    status(code) { this.statusCode = code; return this; },
    set() { return this; },
    jsonPayload: null,
    json(payload) { this.jsonPayload = payload; return this; },
    flushHeaders() {},
    write(chunk) { chunks.push(String(chunk)); }
  };
  return { req, res, closeHandlers };
}

const sseEvents = (chunks) =>
  chunks
    .join('')
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const eventLine = block.split('\n').find((l) => l.startsWith('event:'));
      const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
      return {
        event: eventLine ? eventLine.slice(7).trim() : null,
        data: dataLine ? JSON.parse(dataLine.slice(5).trim()) : null
      };
    })
    .filter((e) => e.event && e.data);

describe('model download → progress → run (fixture proof)', () => {
  let service;
  let controller;

  before(async () => {
    await startFixtureServer();
    service = makeService();
    controller = createModelRunnerController({ modelRunnerService: service });
  });

  after(() => {
    server.close();
    fs.rmSync(service.dataDir, { recursive: true, force: true });
  });

  it('POST /models/:id/download starts a real streaming download (202)', async () => {
    const { req, res } = mockReqRes({ params: { modelId: 'fixture-ctrl' } });
    await controller.downloadById(req, res, (e) => { throw e; });
    assert.equal(res.statusCode, 202);
    assert.equal(res.jsonPayload.started, true);
    const done = await waitForDownloadDone(service);
    assert.equal(done.modelId, 'fixture-ctrl');
    const model = service.findModel('fixture-ctrl');
    assert.ok(service.isDownloaded(model), 'file must be complete on disk');
    assert.equal(sha256(service.modelFilePath(model)), fixtureHash, 'byte-identical to fixture');
  });

  it('GET /models/:id/progress SSE emits a real 0% → 100% ramp', async () => {
    const { req, res, closeHandlers } = mockReqRes({ params: { modelId: 'fixture-5mb' } });
    const handlerPromise = controller.progressById(req, res, (e) => { throw e; });
    await new Promise((r) => setTimeout(r, 100)); // let the SSE subscribe
    await service.startDownload('fixture-5mb');
    await waitForDownloadDone(service);
    await new Promise((r) => setTimeout(r, 200)); // let the terminal event flush
    closeHandlers.close?.();
    await handlerPromise;

    const events = sseEvents(res.chunks).filter((e) => e.event === 'progress');
    assert.ok(events.length >= 3, `expected several progress events, got ${events.length}`);
    const percents = events.map((e) => e.data.percent);
    assert.equal(percents[0], 0, 'first event is 0%');
    assert.equal(percents[percents.length - 1], 100, 'last event is 100%');
    for (let i = 1; i < percents.length; i++) {
      assert.ok(percents[i] >= percents[i - 1], 'percent never goes backwards');
    }
    const terminal = events[events.length - 1].data;
    assert.equal(terminal.status, 'done');
    assert.equal(terminal.receivedBytes, terminal.totalBytes);
    assert.equal(terminal.totalBytes, FIXTURE_BYTES);

    const model = service.findModel('fixture-5mb');
    assert.equal(sha256(service.modelFilePath(model)), fixtureHash, 'byte-identical to fixture');
  });

  it('resume: a 2MB partial file continues via Range, not from zero', async () => {
    lastRangeHeader = null;
    const model = service.findModel('fixture-resume');
    const dest = service.modelFilePath(model);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, fixture.subarray(0, 2 * 1024 * 1024)); // 2MB partial

    await service.startDownload('fixture-resume');
    const done = await waitForDownloadDone(service);
    assert.equal(done.modelId, 'fixture-resume');
    assert.equal(lastRangeHeader, 'bytes=2097152-', 'server must see the Range resume header');
    assert.equal(sha256(dest), fixtureHash, 'resumed file is byte-identical');
    assert.ok(service.isDownloaded(model));
  });

  it('POST /models/:id/run sets the ACTIVE localhost brain (persisted)', async () => {
    // Stub only the llama-server spawn (no binary/GPU in this sandbox);
    // everything after it — the real activation path — runs for real.
    service.run = async (modelId) => ({ started: true, modelId, baseUrl: 'http://127.0.0.1:9', port: 9 });
    const selections = new Map();
    const brainProviderModel = {
      async setSelection(userId, sel) {
        selections.set(userId, { userId, ...sel });
        return selections.get(userId);
      }
    };
    const ctrl = createModelRunnerController({ modelRunnerService: service, brainProviderModel });

    const { req, res } = mockReqRes({ params: { modelId: 'fixture-5mb' }, user: { id: 'user-1' } });
    await ctrl.run(req, res, (e) => { throw e; });

    assert.equal(res.jsonPayload.started, true);
    assert.equal(res.jsonPayload.brainSwitched, true);
    const sel = selections.get('user-1');
    assert.equal(sel.provider, 'local');
    assert.equal(sel.modelId, 'fixture-5mb');
    const record = service.readActiveBrain();
    assert.equal(record.modelId, 'fixture-5mb');
    assert.ok(fs.existsSync(service.activeBrainPath()), 'active-brain.json on disk');
  });

  it('unknown model id is a 400, not a crash', async () => {
    const { req, res } = mockReqRes({ params: { modelId: 'nope-not-real' } });
    await controller.downloadById(req, res, (e) => { throw e; });
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonPayload.error.code, 'UNKNOWN_MODEL');
  });
});
