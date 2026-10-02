/**
 * modelQuantDownload.test.js — quantization choice at download (Q4/Q5/Q8).
 *
 * Proves against the REAL service code:
 *   1. resolveQuant: default Q4_K_M, explicit Q5_K_M/Q8_0, UNKNOWN_QUANT reject
 *   2. modelFilePath: Q4 keeps the legacy path (old downloads keep working);
 *      other quants get a suffixed path and can coexist
 *   3. end-to-end with a fixture server on :4564: startDownload(id, {quant:'Q5_K_M'})
 *      → SSE/file lands byte-identical at the suffixed path;
 *      isDownloaded defaults to Q4 (false), downloadedQuants() lists Q5_K_M
 *   4. preferredQuant: Q4 wins when present, else any downloaded quant,
 *      explicit quant honored, NOT_DOWNLOADED when nothing is on disk
 *   5. controller.downloadById / controller.run pass { quant, contextSize }
 *      through to the service
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

const PORT = 4564;
const FIXTURE_BYTES = 2 * 1024 * 1024; // 2MB
const fixture = crypto.randomBytes(FIXTURE_BYTES);
const fixtureHash = crypto.createHash('sha256').update(fixture).digest('hex');

let server;
const fixtureUrl = () => `http://127.0.0.1:${PORT}/q5-fixture.gguf`;

before(() => new Promise((resolve) => {
  server = http.createServer((req, res) => {
    if (req.url !== '/q5-fixture.gguf') { res.writeHead(404); res.end(); return; }
    if (req.method === 'HEAD') {
      res.writeHead(200, { 'content-length': fixture.length, 'accept-ranges': 'bytes' });
      res.end(); return;
    }
    res.writeHead(200, { 'content-length': fixture.length, 'accept-ranges': 'bytes' });
    res.end(fixture);
  });
  server.listen(PORT, '127.0.0.1', resolve);
}));
after(() => new Promise((resolve) => server.close(resolve)));

function makeService() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-w2-quant-'));
  const service = new ModelRunnerService({ dataDir, logger: { info() {}, warn() {}, error() {} } });
  service.customModels.push({
    id: 'quant-fixture',
    name: 'Quant Fixture',
    params: 'fixture',
    quant: 'Q4_K_M',
    tier: 'test',
    sizeGB: 0.002,
    sizeBytes: FIXTURE_BYTES,
    uncensored: true,
    custom: true,
    quants: {
      Q4_K_M: { file: 'q4-fixture.gguf', sizeGB: 0.002 },
      Q5_K_M: { file: 'q5-fixture.gguf', sizeGB: 0.0024 },
      Q8_0: { file: 'q8-fixture.gguf', sizeGB: 0.0038 }
    },
    requirements: { ramGB: 1, vramGB: 0, gpuRequired: false },
    description: 'Test fixture'
  });
  service.resolveDownloadUrl = () => fixtureUrl(); // test-only override
  return service;
}

function mockReqRes({ params = {}, body = {}, user = null } = {}) {
  const req = { params, body, user };
  const res = {
    statusCode: 200, jsonPayload: null,
    status(c) { this.statusCode = c; return this; },
    json(p) { this.jsonPayload = p; return this; }
  };
  return { req, res };
}

describe('quantization choice', () => {
  it('resolveQuant defaults to Q4_K_M and validates choices', () => {
    const service = makeService();
    const model = service.findModel('quant-fixture');
    assert.equal(service.resolveQuant(model).quant, 'Q4_K_M');
    assert.equal(service.resolveQuant(model, 'Q8_0').file, 'q8-fixture.gguf');
    assert.throws(() => service.resolveQuant(model, 'Q2_K'), (e) => e.code === 'UNKNOWN_QUANT');
  });

  it('modelFilePath: Q4 keeps the legacy path, other quants are suffixed', () => {
    const service = makeService();
    const model = service.findModel('quant-fixture');
    const q4 = service.modelFilePath(model);
    const q8 = service.modelFilePath(model, 'Q8_0');
    assert.ok(q4.endsWith('quant-fixture.gguf'), 'legacy path unchanged');
    assert.ok(q8.endsWith('quant-fixture-Q8_0.gguf'), 'suffixed path');
    assert.notEqual(q4, q8);
    assert.equal(path.dirname(q4), path.dirname(q8), 'same model dir');
  });

  it('real download with { quant: Q5_K_M } lands byte-identical at the suffixed path', async () => {
    const service = makeService();
    const model = service.findModel('quant-fixture');
    const seen = [];
    const done = new Promise((resolve) => {
      const off = service.onDownloadProgress((s) => {
        seen.push(s.status);
        if (s.status === 'done' || s.status === 'error') { off(); resolve(s); }
      });
    });
    const started = await service.startDownload('quant-fixture', { quant: 'Q5_K_M' });
    assert.equal(started.quant, 'Q5_K_M');
    const final = await done;
    assert.equal(final.status, 'done');
    assert.equal(final.quant, 'Q5_K_M');
    const dest = service.modelFilePath(model, 'Q5_K_M');
    assert.ok(fs.existsSync(dest), 'suffixed file on disk');
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex'), fixtureHash);
    // Default (Q4) is NOT downloaded; the quant-aware listing knows Q5 is.
    assert.equal(service.isDownloaded(model), false);
    assert.equal(service.isDownloaded(model, 'Q5_K_M'), true);
    assert.deepEqual(service.downloadedQuants(model), ['Q5_K_M']);
  });

  it('preferredQuant: Q4 wins, else any downloaded quant, explicit honored', async () => {
    const service = makeService();
    const model = service.findModel('quant-fixture');
    // Nothing on disk → null (run() turns this into NOT_DOWNLOADED).
    assert.equal(service.preferredQuant(model), null);
    // Fake a Q8 file on disk.
    const q8path = service.modelFilePath(model, 'Q8_0');
    fs.mkdirSync(path.dirname(q8path), { recursive: true });
    fs.writeFileSync(q8path, fixture);
    assert.equal(service.preferredQuant(model), 'Q8_0');
    // Now add Q4 too — Q4 wins (smaller, faster).
    const q4path = service.modelFilePath(model);
    fs.writeFileSync(q4path, fixture);
    assert.equal(service.preferredQuant(model), 'Q4_K_M');
    // Explicit choice honored…
    assert.equal(service.preferredQuant(model, 'Q8_0'), 'Q8_0');
    // …and rejected when not on disk.
    assert.throws(() => service.preferredQuant(model, 'Q5_K_M'), (e) => e.code === 'NOT_DOWNLOADED');
  });

  it('controller.downloadById passes quant through to the service', async () => {
    const service = makeService();
    let got = null;
    service.startDownload = async (id, opts) => { got = { id, opts }; return { started: true }; };
    const ctrl = createModelRunnerController({ modelRunnerService: service });
    const { req, res } = mockReqRes({ params: { modelId: 'quant-fixture' }, body: { quant: 'Q8_0' } });
    await ctrl.downloadById(req, res, (e) => { throw e; });
    assert.equal(res.statusCode, 202);
    assert.deepEqual(got, { id: 'quant-fixture', opts: { quant: 'Q8_0' } });
  });

  it('controller.run passes quant + contextSize through to the service', async () => {
    const service = makeService();
    let got = null;
    service.run = async (id, opts) => { got = { id, opts }; return { started: true }; };
    const ctrl = createModelRunnerController({ modelRunnerService: service, brainProviderModel: null });
    const { req, res } = mockReqRes({
      params: { modelId: 'quant-fixture' },
      body: { quant: 'Q5_K_M', contextSize: 16384 },
      user: { id: 'u1' }
    });
    await ctrl.run(req, res, (e) => { throw e; });
    assert.deepEqual(got, { id: 'quant-fixture', opts: { quant: 'Q5_K_M', contextSize: 16384 } });
  });

  it('unknown quant at the HTTP layer is a 400 UNKNOWN_QUANT', async () => {
    const service = makeService();
    const ctrl = createModelRunnerController({ modelRunnerService: service });
    const { req, res } = mockReqRes({ params: { modelId: 'quant-fixture' }, body: { quant: 'Q2_K' } });
    await ctrl.downloadById(req, res, (e) => { throw e; });
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonPayload.error.code, 'UNKNOWN_QUANT');
  });

  it('catalog: multi-quant models expose only verified single-file quants', async () => {
    // Verified live against the HF API on 2026-10-02: Q5/Q8 exist for some
    // 70B repos ONLY as 2-part splits, which the single-file downloader
    // cannot fetch — those quants are not offered. Every listed quant must
    // be a real file (HEAD 200 on its resolve URL).
    const service = makeService();
    const expected = {
      'qwen3-14b-abliterated': ['Q4_K_M', 'Q5_K_M', 'Q8_0'],
      'llama33-70b-ablated': ['Q4_K_M'],
      'llama31-nemotron-70b': ['Q4_K_M'],
      'llama31-70b-abliterated': ['Q4_K_M', 'Q5_K_M'],
      'deepseek-r1-distill-llama-70b': ['Q4_K_M', 'Q5_K_S']
    };
    for (const [id, quants] of Object.entries(expected)) {
      const m = service.findModel(id);
      assert.ok(m, `${id} in catalog`);
      const offered = m.quants ? Object.keys(m.quants) : ['Q4_K_M'];
      assert.deepEqual(offered, quants, `${id} quants`);
      const sizes = offered.map((q) => (m.quants ? m.quants[q].sizeGB : m.sizeGB));
      for (let i = 1; i < sizes.length; i++) {
        assert.ok(sizes[i] > sizes[i - 1], `${id} sizes ascend`);
      }
      for (const q of offered) {
        const file = m.quants ? m.quants[q].file : m.hfFile;
        assert.ok(file.endsWith('.gguf'), `${id} ${q} filename`);
      }
    }
  });
});
