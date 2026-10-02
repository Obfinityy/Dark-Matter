/**
 * browserDeviceDetect.test.js — verifies the Models page device logic.
 *
 * The Models page ranks with specs detected from the BROWSER ONLY
 * (navigator.hardwareConcurrency, navigator.deviceMemory, WebGL renderer).
 * These tests stub those three signals for three fake devices and assert
 * the compat sorting the page renders:
 *   1. 8GB laptop   — 8B ready on top, 70B blocked at the bottom
 *   2. 32GB desktop — 32B tight near the top, 70B blocked
 *   3. 4GB phone    — nothing fits; everything listed, still downloadable
 *
 * Also unit-tests the backend rankModelForDevice rules against the same
 * three devices so frontend and backend verdicts agree.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectBrowserDevice,
  browserBudget,
  rankModelForBrowser,
  sortModelsByBrowserCompat,
  estimateVramFit as estimateVramFitBrowser
} from '../../frontend/src/services/deviceDetect.js';
import { rankModelForDevice, estimateVramFit as estimateVramFitBackend } from '../src/services/modelRunner/deviceInfo.js';
import { MODEL_LIBRARY } from '../src/services/modelRunner/modelLibrary.js';

// ── Fake devices ─────────────────────────────────────────────────────

const laptop8 = {
  nav: { hardwareConcurrency: 8, deviceMemory: 8 }, // capped at 8 by Chrome
  gpu: () => 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)'
};
const desktop32 = {
  nav: { hardwareConcurrency: 16, deviceMemory: 8 }, // Chrome still reports 8!
  gpu: () => 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)'
};
const phone4 = {
  nav: { hardwareConcurrency: 8, deviceMemory: 4 },
  gpu: () => 'Adreno (TM) 610'
};

const noGpu = {
  nav: { hardwareConcurrency: 4, deviceMemory: 8 },
  gpu: () => null
};

function model8B() { return MODEL_LIBRARY.find((m) => m.id === 'qwen3-8b-abliterated'); }
function model70B() { return MODEL_LIBRARY.find((m) => m.id === 'llama33-70b-ablated'); }
function model32B() { return MODEL_LIBRARY.find((m) => m.id === 'deepseek-r1-distill-qwen-32b'); }

describe('detectBrowserDevice (stubbed navigator)', () => {
  it('reads cores, RAM and GPU string from the stubbed browser', () => {
    const d = detectBrowserDevice(laptop8.nav, laptop8.gpu);
    assert.equal(d.source, 'browser');
    assert.equal(d.cores, 8);
    assert.equal(d.ramGB, 8);
    assert.equal(d.ramCapped, true); // Chrome caps deviceMemory at 8
    assert.equal(d.hasGpu, true);
    assert.match(d.gpu, /Iris/);
  });

  it('detects a 4GB phone honestly', () => {
    const d = detectBrowserDevice(phone4.nav, phone4.gpu);
    assert.equal(d.ramGB, 4);
    assert.equal(d.ramCapped, false);
    assert.equal(d.hasGpu, true);
  });

  it('handles missing signals without throwing', () => {
    const d = detectBrowserDevice({}, () => null);
    assert.equal(d.cores, null);
    assert.equal(d.ramGB, null);
    assert.equal(d.gpu, null);
    assert.equal(d.hasGpu, false);
  });
});

describe('browserBudget one-line verdict', () => {
  it('is honest about the 8GB browser cap', () => {
    const d = detectBrowserDevice(laptop8.nav, laptop8.gpu);
    const { maxModelGB, verdict } = browserBudget(d);
    assert.equal(maxModelGB, 4); // floor(8*0.8-1.5)
    assert.match(verdict, /cap/i);
  });

  it('gives a usable budget for a 32GB desktop', () => {
    const d = detectBrowserDevice({ hardwareConcurrency: 16, deviceMemory: 32 }, desktop32.gpu);
    const { maxModelGB, verdict } = browserBudget(d);
    assert.equal(maxModelGB, 24); // floor(32*0.8-1.5)
    assert.match(verdict, /32B/);
  });

  it('warns on a 4GB phone', () => {
    const d = detectBrowserDevice(phone4.nav, phone4.gpu);
    const { verdict } = browserBudget(d);
    assert.match(verdict, /limited RAM/i);
  });
});

describe('rankModelForBrowser verdicts', () => {
  it('8GB laptop: 8B is a tight fit, 70B is blocked', () => {
    const d = detectBrowserDevice(laptop8.nav, laptop8.gpu);
    // 8B "needs 8GB" on an 8GB machine: runs, but heavy — tight is honest.
    assert.equal(rankModelForBrowser(model8B(), d).verdict, 'tight');
    const heavy = rankModelForBrowser(model70B(), d);
    assert.equal(heavy.verdict, 'blocked');
    assert.ok(heavy.reasons[0].includes('cannot be loaded'));
  });

  it('32GB desktop: 32B is tight, 70B still blocked (weights cannot fit)', () => {
    const d = detectBrowserDevice({ hardwareConcurrency: 16, deviceMemory: 32 }, desktop32.gpu);
    assert.equal(rankModelForBrowser(model32B(), d).verdict, 'tight');
    assert.equal(rankModelForBrowser(model70B(), d).verdict, 'blocked');
  });

  it('4GB phone: even 8B is blocked, with an honest reason', () => {
    const d = detectBrowserDevice(phone4.nav, phone4.gpu);
    const r = rankModelForBrowser(model8B(), d);
    assert.equal(r.verdict, 'blocked');
    assert.ok(r.reasons.length > 0);
  });

  it('no GPU detected: a GPU-built model is tight (CPU fallback), not blocked', () => {
    // 32GB RAM, no GPU: the 32B model still runs via CPU fallback — slower,
    // not a crash. Both rankers must agree on 'tight'.
    const d = detectBrowserDevice({ hardwareConcurrency: 16, deviceMemory: 32 }, noGpu.gpu);
    const r = rankModelForBrowser(model32B(), d);
    assert.equal(r.verdict, 'tight');
    assert.ok(r.reasons[0].includes('CPU'));
  });
});

describe('sortModelsByBrowserCompat (the catalog order)', () => {
  it('8GB laptop: compatible on top, incompatible below; all 14 still listed', () => {
    const d = detectBrowserDevice(laptop8.nav, laptop8.gpu);
    const sorted = sortModelsByBrowserCompat(MODEL_LIBRARY, d);
    assert.equal(sorted.length, MODEL_LIBRARY.length);
    assert.ok(MODEL_LIBRARY.length >= 12, 'catalog must hold 12+ models');

    const firstIncompat = sorted.findIndex((m) => !m.browserCompatible);
    assert.ok(firstIncompat > 0, 'some models must be compatible');
    // Everything after the first incompatible model is incompatible.
    for (let i = firstIncompat; i < sorted.length; i++) {
      assert.equal(sorted[i].browserCompatible, false, `${sorted[i].id} should be below the fold`);
    }
    // The 8B models lead the compatible section (tight, biggest first).
    assert.ok(['qwen3-8b-abliterated', 'dolphin-llama31-8b'].includes(sorted[0].id));
    // The incompatible section starts with the 70B class (heaviest first).
    const belowFold = sorted.slice(firstIncompat, firstIncompat + 5);
    assert.ok(belowFold.every((m) => m.params === '70B'), 'heaviest models sit at the bottom');
    assert.ok(belowFold.some((m) => m.id === 'llama33-70b-ablated'));
  });

  it('32GB desktop: 32B-class models are compatible', () => {
    const d = detectBrowserDevice({ hardwareConcurrency: 16, deviceMemory: 32 }, desktop32.gpu);
    const sorted = sortModelsByBrowserCompat(MODEL_LIBRARY, d);
    const m32 = sorted.find((m) => m.id === 'deepseek-r1-distill-qwen-32b');
    assert.equal(m32.browserCompatible, true);
    const m70 = sorted.find((m) => m.id === 'llama33-70b-ablated');
    assert.equal(m70.browserCompatible, false);
  });

  it('4GB phone: nothing compatible, but everything still listed (runnable)', () => {
    const d = detectBrowserDevice(phone4.nav, phone4.gpu);
    const sorted = sortModelsByBrowserCompat(MODEL_LIBRARY, d);
    assert.equal(sorted.filter((m) => m.browserCompatible).length, 0);
    assert.equal(sorted.length, MODEL_LIBRARY.length);
  });
});

describe('backend rankModelForDevice agrees with the browser ranking', () => {
  const backendDevice = (ramGB, gpus) => ({ totalRamGB: ramGB, gpus: gpus || [] });

  it('8GB laptop: backend says the same as the browser', () => {
    const d = backendDevice(8, [{ vendor: 'intel', name: 'Iris Xe', vramGB: null }]);
    assert.equal(rankModelForDevice(model8B(), d).verdict, 'tight');
    assert.equal(rankModelForDevice(model70B(), d).verdict, 'blocked');
  });

  it('32GB desktop: backend says the same as the browser', () => {
    const d = backendDevice(32, [{ vendor: 'nvidia', name: 'RTX 4070', vramGB: 12 }]);
    assert.equal(rankModelForDevice(model32B(), d).verdict, 'tight');
    assert.equal(rankModelForDevice(model70B(), d).verdict, 'blocked');
  });

  it('32GB, no GPU: backend agrees with the browser (tight, CPU fallback)', () => {
    const d = backendDevice(32, []);
    assert.equal(rankModelForDevice(model32B(), d).verdict, 'tight');
  });

  it('4GB phone: backend says the same as the browser', () => {
    const d = backendDevice(4, [{ vendor: 'other', name: 'Adreno 610', vramGB: null }]);
    assert.equal(rankModelForDevice(model8B(), d).verdict, 'blocked');
  });

  it('gpuRequired with no GPU is blocked', () => {
    const model = { ...model8B(), requirements: { ramGB: 8, vramGB: 8, gpuRequired: true } };
    const d = backendDevice(64, []);
    assert.equal(rankModelForDevice(model, d).verdict, 'blocked');
  });
});

describe('model catalog integrity', () => {
  it('every model has a real Hugging Face URL, size and uncensored flag', () => {
    for (const m of MODEL_LIBRARY) {
      assert.ok(m.hfRepo && m.hfRepo.includes('/'), `${m.id} needs hfRepo`);
      assert.ok(/\.gguf$/i.test(m.hfFile), `${m.id} needs a .gguf hfFile`);
      assert.ok(m.sizeGB > 0, `${m.id} needs sizeGB`);
      assert.equal(m.uncensored, true, `${m.id} must be uncensored`);
      assert.ok(m.requirements?.ramGB > 0, `${m.id} needs requirements.ramGB`);
      const url = `https://huggingface.co/${m.hfRepo}/resolve/main/${m.hfFile}`;
      assert.ok(url.length < 300, `${m.id} URL looks sane`);
    }
  });

  it('spans 8B to 70B', () => {
    const params = MODEL_LIBRARY.map((m) => m.params);
    assert.ok(params.includes('8B'));
    assert.ok(params.includes('70B'));
  });

  it('quantized models expose ascending sizes (Q4 < Q5 < Q8)', () => {
    // Catalog policy: single-file quants only — split-file quants were removed
    // because the downloader streams one file. Three models keep multiple
    // verified quants.
    const multi = MODEL_LIBRARY.filter((m) => m.quants && Object.keys(m.quants).length > 1);
    assert.ok(multi.length >= 3, 'at least the 3 verified multi-quant models');
    for (const m of multi) {
      const qs = Object.entries(m.quants).sort((a, b) => a[1].sizeGB - b[1].sizeGB);
      for (let i = 1; i < qs.length; i++) {
        assert.ok(qs[i][1].sizeGB > qs[i - 1][1].sizeGB,
          `${m.id}: ${qs[i][0]} (${qs[i][1].sizeGB}GB) should exceed ${qs[i - 1][0]} (${qs[i - 1][1].sizeGB}GB)`);
      }
      for (const [qname, q] of qs) {
        assert.ok(/\.gguf$/i.test(q.file), `${m.id} ${qname} file ${q.file} must be a .gguf`);
      }
    }
    // The flagship 14B keeps the full Q4/Q5/Q8 ladder.
    const qwen14 = MODEL_LIBRARY.find((m) => m.id === 'qwen3-14b-abliterated');
    assert.ok(qwen14?.quants?.Q4_K_M && qwen14?.quants?.Q5_K_M && qwen14?.quants?.Q8_0,
      'qwen3-14b-abliterated keeps Q4_K_M/Q5_K_M/Q8_0');
  });
});

describe('VRAM-fit estimator (frontend ↔ backend agreement)', () => {
  const model = (vramGB) => ({ requirements: { ramGB: 16, vramGB } });

  it('full offload when VRAM covers the need', () => {
    for (const fn of [estimateVramFitBrowser, estimateVramFitBackend]) {
      const fit = fn(model(10), 12);
      assert.equal(fit.mode, 'full');
      assert.equal(fit.offloadPct, 100);
    }
  });

  it('partial offload percentage agrees between frontend and backend', () => {
    const cases = [
      [model(10), 6],   // 6GB VRAM, needs 10 → ~55%
      [model(40), 24],  // 24GB VRAM, needs 40 → ~58%
      [model(40), 8]    // 8GB VRAM, needs 40 → ~18%
    ];
    for (const [m, vram] of cases) {
      const a = estimateVramFitBrowser(m, vram);
      const b = estimateVramFitBackend(m, vram);
      assert.deepEqual(a, b, `estimator agreement for need=${m.requirements.vramGB} vram=${vram}`);
      assert.equal(a.mode, 'partial');
      assert.ok(a.offloadPct > 0 && a.offloadPct < 100);
    }
  });

  it('CPU mode when no VRAM or no GPU need', () => {
    assert.equal(estimateVramFitBrowser(model(10), null).mode, 'cpu');
    assert.equal(estimateVramFitBackend(model(0), 12).mode, 'cpu');
  });

  it('backend ranking carries the vramFit estimate on tight verdicts', () => {
    const m = {
      ...MODEL_LIBRARY.find((x) => x.id === 'llama33-70b-ablated'),
      requirements: { ramGB: 64, vramGB: 40, gpuRequired: false }
    };
    const device = { totalRamGB: 128, gpus: [{ vendor: 'nvidia', name: 'RTX 3090', vramGB: 24 }] };
    const r = rankModelForDevice(m, device);
    assert.equal(r.verdict, 'tight');
    assert.equal(r.vramFit.mode, 'partial');
    assert.ok(r.vramFit.offloadPct > 0 && r.vramFit.offloadPct < 100);
    assert.match(r.reasons.join(' '), new RegExp(`${r.vramFit.offloadPct}%`));
  });
});
