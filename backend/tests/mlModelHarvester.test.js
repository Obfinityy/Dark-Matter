/**
 * mlModelHarvester.test.js — Tests for the ML model / chat-widget engine.
 *
 * Ideas 851-853: ONNX-runtime model discovery (851), WASM ML-inference
 * mapping (852), chat-widget backend discovery (853). All fixtures are
 * synthetic client-side JS shaped like real-world snippets.
 *
 * Run: cd backend && node --test tests/mlModelHarvester.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  findOnnxModelUrls,
  mapWasmInferenceModules,
  discoverChatWidgetBackend,
  harvestMlAndChatSurface,
} from '../src/engines/mlModelHarvester.js';

// ---------------------------------------------------------------- 851
describe('findOnnxModelUrls (851)', () => {
  const src = `
    import * as ort from 'onnxruntime-web';
    const session = await ort.InferenceSession.create('/models/nudity-detector.onnx', {
      executionProviders: ['wasm']
    });
    const weights = "https://cdn.example.com/ai/embeddings/model.onnx?rev=3";
    session.run({ input: tensor });
  `;

  it('finds absolute and relative .onnx URLs', () => {
    const r = findOnnxModelUrls(src);
    assert.ok(r.modelUrls.includes('https://cdn.example.com/ai/embeddings/model.onnx?rev=3'));
    assert.ok(r.modelUrls.includes('/models/nudity-detector.onnx'));
  });

  it('captures InferenceSession.create arguments', () => {
    const r = findOnnxModelUrls(src);
    assert.deepEqual(r.sessionCreations, ['/models/nudity-detector.onnx']);
    assert.equal(r.runsDetected, true);
  });

  it('returns empty results for non-ML code', () => {
    const r = findOnnxModelUrls('function add(a,b){return a+b;}');
    assert.deepEqual(r.modelUrls, []);
    assert.deepEqual(r.sessionCreations, []);
    assert.equal(r.runsDetected, false);
  });

  it('ignores image files with .onnx-like substrings in comments only', () => {
    const r = findOnnxModelUrls('// no onnx here\nvar x = "logo.png";');
    assert.deepEqual(r.modelUrls, []);
  });
});

// ---------------------------------------------------------------- 852
describe('mapWasmInferenceModules (852)', () => {
  const src = `
    const wasmUrl = "https://cdn.example.com/ai/ort-wasm-simd-threaded.wasm";
    await WebAssembly.instantiateStreaming(fetch(wasmUrl), imports);
    tf.setBackend('wasm');
    const s2 = await ort.InferenceSession.create('seg.onnx', { executionProviders: ['wasm'] });
  `;

  it('maps wasm module names and urls', () => {
    const r = mapWasmInferenceModules(src);
    assert.ok(r.wasmModules.includes('onnxruntime-web'));
    assert.ok(r.wasmUrls.includes('https://cdn.example.com/ai/ort-wasm-simd-threaded.wasm'));
  });

  it('maps tfjs backend and execution providers', () => {
    const r = mapWasmInferenceModules(src);
    assert.ok(r.backends.includes('wasm'));
    assert.ok(r.executionProviders.includes('wasm'));
  });

  it('detects tfjs-backend-wasm from bundle file names', () => {
    const r = mapWasmInferenceModules('import "tfjs-backend-wasm/dist/tf-backend-wasm.js";');
    assert.ok(r.wasmModules.includes('tfjs-backend-wasm'));
  });

  it('returns empty arrays for plain code', () => {
    const r = mapWasmInferenceModules('console.log("hello");');
    assert.deepEqual(r.wasmModules, []);
    assert.deepEqual(r.wasmUrls, []);
    assert.deepEqual(r.backends, []);
  });
});

// ---------------------------------------------------------------- 853
describe('discoverChatWidgetBackend (853)', () => {
  const src = `
    window.$crisp = [];
    CRISP_WEBSITE_ID = "abc-123-def";
    s.src = "https://client.crisp.chat/l.js";
    fetch("https://chat.example.com/api/v2/conversations", { method: "POST" });
    const cfg = { appId: "ACMEAPPID99", widgetId: "wid-77", theme: "dark" };
    Intercom('boot', { app_id: 'intercom-app-42' });
  `;

  it('identifies chat widget vendors', () => {
    const r = discoverChatWidgetBackend(src);
    assert.ok(r.vendors.includes('crisp'));
    assert.ok(r.vendors.includes('intercom'));
  });

  it('extracts chat backend urls while skipping static assets', () => {
    const r = discoverChatWidgetBackend('const a = "https://static.example.com/x.png"; const b = "https://chat.example.com/api/messages";');
    assert.ok(r.backendUrls.includes('https://chat.example.com/api/messages'));
    assert.ok(!r.backendUrls.includes('https://static.example.com/x.png'));
  });

  it('reports key reference names with redacted values', () => {
    const r = discoverChatWidgetBackend(src);
    const appId = r.keyReferences.find((k) => k.name === 'appId');
    assert.ok(appId, 'appId reference reported');
    assert.ok(!appId.valuePrefix.includes('ACMEAPPID99'), 'secret value not exposed');
    assert.ok(appId.valuePrefix.includes('redacted'));
  });

  it('skips placeholder values', () => {
    const r = discoverChatWidgetBackend('const cfg = { apiKey: "your_api_key" };');
    assert.equal(r.keyReferences.length, 0);
  });
});

// ------------------------------------------------------- combined pass
describe('harvestMlAndChatSurface', () => {
  it('aggregates counts across sources', () => {
    const r = harvestMlAndChatSurface([
      'ort.InferenceSession.create("a.onnx")',
      'tf.setBackend("wasm"); import "ort-wasm";',
      'window.$crisp=[]; fetch("https://chat.example.com/socket")',
    ]);
    assert.equal(r.summary.onnxModelCount, 1);
    assert.ok(r.summary.wasmModuleCount >= 1);
    assert.ok(r.summary.chatVendorCount >= 1);
    assert.equal(r.onnx.length, 3);
    assert.equal(r.wasm.length, 3);
    assert.equal(r.chat.length, 3);
  });

  it('handles empty input', () => {
    const r = harvestMlAndChatSurface([]);
    assert.deepEqual(r.summary, { onnxModelCount: 0, wasmModuleCount: 0, chatVendorCount: 0 });
  });
});
