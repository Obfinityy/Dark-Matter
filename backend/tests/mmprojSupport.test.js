/**
 * mmprojSupport.test.js — vision projector (.mmproj) support for multimodal brains.
 *
 * Multimodal GGUFs (Qwen2.5-VL, OS-Atlas, UI-TARS) ship their vision encoder
 * as a separate projector file. Without it the runner loads the brain
 * text-only and screenshots are invisible to it. These tests cover:
 *  - library entries carry the verified projector filename
 *  - buildSpawnArgs passes --mmproj only when a projector path is given
 *  - service helpers (path / URL / readiness) behave for both
 *    multimodal and text-only models
 *  - _downloadVisionProjector downloads the file against a local fixture
 *    server and leaves the download state in 'done'; failures throw and
 *    leave an error state.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { DEFAULT_SLOT_MODELS, getDefaultModelForSlot } from '../src/services/modelRunner/modelLibrary.js';
import { buildSpawnArgs } from '../src/services/modelRunner/infinityRunner.js';
import { ModelRunnerService } from '../src/services/modelRunner/modelRunnerService.js';

const quietLogger = { info() {}, warn() {} };

function makeSvc() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmproj-test-'));
  return { svc: new ModelRunnerService({ dataDir, logger: quietLogger }), dataDir };
}

describe('library: multimodal defaults carry a vision projector', () => {
  test('vision + grounding defaults have hfMmproj; hacker default has none', () => {
    const vision = getDefaultModelForSlot('vision');
    const grounding = getDefaultModelForSlot('grounding');
    const hacker = getDefaultModelForSlot('hacker');
    assert.ok(vision.hfMmproj, 'vision default must declare hfMmproj');
    assert.ok(grounding.hfMmproj, 'grounding default must declare hfMmproj');
    assert.equal(hacker.hfMmproj, undefined, 'hacker brain is text-only');
    assert.match(vision.hfMmproj, /\.gguf$|\.mmproj$/, 'projector filename must be a model file');
    assert.match(grounding.hfMmproj, /\.gguf$|\.mmproj$/, 'projector filename must be a model file');
  });

  test('UI-TARS grounding entry also carries its projector', () => {
    const svc = new ModelRunnerService({ dataDir: '/tmp/mmproj-lib-test', logger: quietLogger });
    const uitars = svc.findModel('uitars-grounding-7b');
    assert.ok(uitars, 'UI-TARS entry must exist');
    assert.ok(uitars.hfMmproj, 'UI-TARS needs its vision projector too');
  });

  test('projector filenames match the verified HF repos', () => {
    const vision = getDefaultModelForSlot('vision');
    const grounding = getDefaultModelForSlot('grounding');
    assert.equal(vision.hfRepo, 'mradermacher/Qwen2.5-VL-7B-Instruct-abliterated-GGUF');
    assert.equal(vision.hfMmproj, 'Qwen2.5-VL-7B-Instruct-abliterated.mmproj-Q8_0.gguf');
    assert.equal(grounding.hfRepo, 'mradermacher/OS-Atlas-Base-7B-GGUF');
    assert.equal(grounding.hfMmproj, 'OS-Atlas-Base-7B.mmproj-fp16.gguf');
  });
});

describe('buildSpawnArgs: --mmproj flag', () => {
  test('appends --mmproj when a projector path is given', () => {
    const args = buildSpawnArgs({
      binaryPath: '/bin/runner', modelPath: '/m/model.gguf', port: 4001,
      mmprojPath: '/m/model.mmproj.gguf'
    });
    const i = args.indexOf('--mmproj');
    assert.ok(i > 0, 'must include --mmproj');
    assert.equal(args[i + 1], '/m/model.mmproj.gguf');
  });

  test('omits --mmproj for text-only models', () => {
    const args = buildSpawnArgs({ binaryPath: '/bin/runner', modelPath: '/m/model.gguf', port: 4001 });
    assert.ok(!args.includes('--mmproj'), 'text-only models must not get --mmproj');
  });
});

describe('service: projector path / URL / readiness', () => {
  test('text-only model: null path/URL, readiness true', () => {
    const { svc } = makeSvc();
    const hacker = getDefaultModelForSlot('hacker');
    assert.equal(svc.mmprojFilePath(hacker), null);
    assert.equal(svc.mmprojDownloadUrl(hacker), null);
    assert.equal(svc.isMmprojDownloaded(hacker), true);
  });

  test('multimodal model: URL shape and readiness lifecycle', () => {
    const { svc } = makeSvc();
    const vision = getDefaultModelForSlot('vision');
    const url = svc.mmprojDownloadUrl(vision);
    assert.equal(
      url,
      `https://huggingface.co/${vision.hfRepo}/resolve/main/${vision.hfMmproj}`
    );
    const dest = svc.mmprojFilePath(vision);
    assert.ok(dest.endsWith('.mmproj.gguf'), 'projector stored beside the model');
    assert.equal(svc.isMmprojDownloaded(vision), false, 'missing file → not downloaded');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, ''); // empty file must not count
    assert.equal(svc.isMmprojDownloaded(vision), false, 'empty file → not downloaded');
    fs.writeFileSync(dest, Buffer.alloc(16));
    assert.equal(svc.isMmprojDownloaded(vision), true, 'non-empty file → downloaded');
  });

  test('isModelReady requires GGUF + projector', () => {
    const { svc } = makeSvc();
    const vision = getDefaultModelForSlot('vision');
    svc.preferredQuant = () => 'Q4_K_M'; // pretend the GGUF is on disk
    assert.equal(svc.isModelReady(vision), false, 'GGUF present but projector missing → not ready');
    const dest = svc.mmprojFilePath(vision);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.alloc(16));
    assert.equal(svc.isModelReady(vision), true, 'GGUF + projector → ready');
    const hacker = getDefaultModelForSlot('hacker');
    assert.equal(svc.isModelReady(hacker), true, 'text-only model needs no projector');
  });
});

describe('_downloadVisionProjector: fixture-server download', () => {
  let server, baseUrl;
  const PROJECTOR_BYTES = Buffer.from('fake-mmproj-bytes-'.repeat(64));

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/mmproj-ok') {
        res.writeHead(200, {
          'content-type': 'application/octet-stream',
          'content-length': PROJECTOR_BYTES.length
        });
        res.end(PROJECTOR_BYTES);
      } else {
        res.writeHead(404);
        res.end('nope');
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('downloads the projector and leaves a done state', async () => {
    const { svc } = makeSvc();
    const vision = getDefaultModelForSlot('vision');
    svc.mmprojDownloadUrl = () => `${baseUrl}/mmproj-ok`;
    await svc._downloadVisionProjector(vision);
    const dest = svc.mmprojFilePath(vision);
    assert.ok(fs.existsSync(dest), 'projector file must exist on disk');
    assert.deepEqual(fs.readFileSync(dest), PROJECTOR_BYTES);
    assert.equal(svc.isMmprojDownloaded(vision), true);
    const state = svc.describeDownload();
    assert.equal(state.status, 'done');
    assert.equal(state.quant, 'mmproj');
    assert.match(state.name, /vision projector/);
  });

  test('failure throws and leaves an error state', async () => {
    const { svc } = makeSvc();
    const vision = getDefaultModelForSlot('vision');
    svc.mmprojDownloadUrl = () => `${baseUrl}/mmproj-missing`;
    await assert.rejects(() => svc._downloadVisionProjector(vision), /404/);
    const state = svc.describeDownload();
    assert.equal(state.status, 'error');
    assert.match(state.error, /Vision projector download failed/);
    assert.equal(svc.isMmprojDownloaded(vision), false);
  });

  test('text-only model is a no-op', async () => {
    const { svc } = makeSvc();
    const hacker = getDefaultModelForSlot('hacker');
    await svc._downloadVisionProjector(hacker); // must not throw
    assert.equal(svc.isMmprojDownloaded(hacker), true);
  });
});
