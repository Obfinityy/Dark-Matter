/**
 * clientApiMapper.test.js — unit tests for the client-side web API
 * feature mapping engine (ideas 841-850).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapBarcodeFormats,
  mapShapeDetection,
  mapWebXRSessionModes,
  mapGamepadFeatures,
  enumerateWebMidiPorts,
  mapAudioWorkletProcessors,
  mapWebCodecsEncoders,
  mapWebTransportStreams,
  extractWebNNModelUrls,
  harvestTensorFlowModelUrls,
  mapClientApiFootprint,
} from '../src/engines/clientApiMapper.js';

describe('841 — mapBarcodeFormats', () => {
  it('maps declared formats and detects usage', () => {
    const js = `
      const detector = new BarcodeDetector({ formats: ['qr_code', 'ean_13', 'pdf417'] });
      const supported = await BarcodeDetector.getSupportedFormats();
    `;
    const r = mapBarcodeFormats(js);
    assert.equal(r.used, true);
    assert.deepEqual([...r.formats].sort(), ['ean_13', 'pdf417', 'qr_code']);
    assert.equal(r.formatCount, 3);
  });

  it('returns empty result when no barcode API is present', () => {
    const r = mapBarcodeFormats('console.log("hello");');
    assert.equal(r.used, false);
    assert.deepEqual(r.formats, []);
  });
});

describe('842 — mapShapeDetection', () => {
  it('maps detectors to media-processing endpoints', () => {
    const js = `
      const face = new FaceDetector({ fastMode: true });
      const text = new TextDetector();
      const res = await fetch('/api/v1/face/detect', { method: 'POST' });
      await fetch('/static/logo.png');
    `;
    const r = mapShapeDetection(js);
    assert.deepEqual([...r.detectors].sort(), ['FaceDetector', 'TextDetector']);
    assert.deepEqual(r.endpoints, ['/api/v1/face/detect']);
  });

  it('handles no detectors', () => {
    const r = mapShapeDetection('');
    assert.deepEqual(r.detectors, []);
    assert.deepEqual(r.endpoints, []);
  });
});

describe('843 — mapWebXRSessionModes', () => {
  it('maps requested session modes to immersive routes', () => {
    const js = `
      const session = await navigator.xr.requestSession('immersive-ar');
      await fetch('/xr/scenes/lobby.glb');
      await fetch('/api/users');
    `;
    const r = mapWebXRSessionModes(js);
    assert.deepEqual(r.modes, ['immersive-ar']);
    assert.deepEqual(r.routes, ['/xr/scenes/lobby.glb']);
  });

  it('ignores unsupported session mode strings', () => {
    const r = mapWebXRSessionModes(`navigator.xr.requestSession('room-scale');`);
    assert.deepEqual(r.modes, []);
  });
});

describe('844 — mapGamepadFeatures', () => {
  it('detects gamepad usage and maps gaming features', () => {
    const js = `
      window.addEventListener('gamepadconnected', onPad);
      const pads = navigator.getGamepads();
      await fetch('/api/multiplayer/lobby');
    `;
    const r = mapGamepadFeatures(js);
    assert.equal(r.used, true);
    assert.ok(r.signals.length >= 2);
    assert.deepEqual(r.gamingFeatures, ['/api/multiplayer/lobby']);
  });

  it('returns used=false without gamepad signals', () => {
    const r = mapGamepadFeatures('fetch("/api/health");');
    assert.equal(r.used, false);
  });
});

describe('845 — enumerateWebMidiPorts', () => {
  it('enumerates MIDI port references', () => {
    const js = `
      const midi = await navigator.requestMIDIAccess();
      const cfg = { midi_port: 'UM-ONE-input', midi_port: 'UM-ONE-output' };
      for (const input of midi.inputs.values()) { console.log(input); }
    `;
    const r = enumerateWebMidiPorts(js);
    assert.equal(r.midiAccessRequested, true);
    assert.deepEqual([...r.ports].sort(), ['UM-ONE-input', 'UM-ONE-output']);
    assert.ok(r.portSources.includes('inputs'));
  });

  it('handles code without MIDI', () => {
    const r = enumerateWebMidiPorts('let x = 1;');
    assert.equal(r.midiAccessRequested, false);
    assert.deepEqual(r.ports, []);
  });
});

describe('846 — mapAudioWorkletProcessors', () => {
  it('maps processors to module URLs', () => {
    const js = `
      await ctx.audioWorklet.addModule('/audio/noise-gate.js');
      const node = new AudioWorkletNode(ctx, 'noise-gate-processor');
    `;
    const r = mapAudioWorkletProcessors(js);
    assert.deepEqual(r.processors, ['noise-gate-processor']);
    assert.deepEqual(r.moduleUrls, ['/audio/noise-gate.js']);
  });

  it('handles no worklet usage', () => {
    const r = mapAudioWorkletProcessors('');
    assert.deepEqual(r.processors, []);
    assert.deepEqual(r.moduleUrls, []);
  });
});

describe('847 — mapWebCodecsEncoders', () => {
  it('maps encoder configs and codec strings', () => {
    const js = `
      const enc = new VideoEncoder({ output: handleChunk, error: onErr });
      await enc.configure({ codec: 'avc1.640028', width: 1280, height: 720 });
      const audio = new AudioEncoder({});
      await audio.configure({ codec: 'mp4a.40.2' });
    `;
    const r = mapWebCodecsEncoders(js);
    assert.deepEqual([...r.encoders].sort(), ['AudioEncoder', 'VideoEncoder']);
    assert.deepEqual([...r.codecs].sort(), ['avc1.640028', 'mp4a.40.2']);
  });
});

describe('848 — mapWebTransportStreams', () => {
  it('maps endpoints and stream types', () => {
    const js = `
      const wt = new WebTransport('https://realtime.example.com/quic');
      const bidi = await wt.createBidirectionalStream();
      wt.datagrams.writeable.getWriter();
    `;
    const r = mapWebTransportStreams(js);
    assert.deepEqual(r.endpoints, ['https://realtime.example.com/quic']);
    assert.ok(r.streamTypes.includes('createBidirectionalStream'));
    assert.ok(r.streamTypes.includes('datagrams'));
  });
});

describe('849 — extractWebNNModelUrls', () => {
  it('extracts model URLs referenced by WebNN code', () => {
    const js = `
      const builder = new MLGraphBuilder(context);
      const cfg = { modelUrl: '/models/segmenter.onnx' };
      const weights = await fetch('/models/segmenter-weights.bin');
    `;
    const r = extractWebNNModelUrls(js);
    assert.equal(r.webNNUsed, true);
    assert.ok(r.modelUrls.includes('/models/segmenter.onnx'));
    assert.ok(r.modelUrls.includes('/models/segmenter-weights.bin'));
  });

  it('returns no URLs without WebNN usage', () => {
    const r = extractWebNNModelUrls('fetch("/data.json");');
    assert.equal(r.webNNUsed, false);
    assert.deepEqual(r.modelUrls, []);
  });
});

describe('850 — harvestTensorFlowModelUrls', () => {
  it('harvests model.json URLs and maps hosts', () => {
    const js = `
      const model = await tf.loadGraphModel('https://models.example.com/v1/model.json');
      const other = await tf.loadLayersModel('/local/model.json');
    `;
    const r = harvestTensorFlowModelUrls(js);
    assert.ok(r.modelUrls.includes('https://models.example.com/v1/model.json'));
    assert.ok(r.modelUrls.includes('/local/model.json'));
    assert.deepEqual(r.hosts, ['models.example.com']);
    assert.equal(r.loadCalls, 2);
  });

  it('deduplicates repeated model URLs', () => {
    const js = `await tf.loadGraphModel('https://a.example/x/model.json'); await tf.loadGraphModel('https://a.example/x/model.json');`;
    const r = harvestTensorFlowModelUrls(js);
    assert.deepEqual(r.modelUrls, ['https://a.example/x/model.json']);
  });
});

describe('mapClientApiFootprint (all 10 ideas)', () => {
  it('aggregates every mapping in one pass', () => {
    const js = `
      new BarcodeDetector({ formats: ['qr_code'] });
      new FaceDetector();
      navigator.xr.requestSession('immersive-vr');
      window.addEventListener('gamepadconnected', () => {});
      await navigator.requestMIDIAccess();
      await ctx.audioWorklet.addModule('/w/reverb.js');
      new VideoEncoder({});
      new WebTransport('https://rt.example.com/');
      new MLGraphBuilder(ctx);
      await tf.loadGraphModel('https://ml.example.com/m/model.json');
    `;
    const r = mapClientApiFootprint({ js });
    for (const id of [841, 842, 843, 844, 845, 846, 847, 848, 849, 850]) {
      assert.ok(r[id] !== undefined, `idea ${id} missing`);
    }
    assert.ok(r[841].formats.includes('qr_code'));
    assert.ok(r[842].detectors.includes('FaceDetector'));
    assert.deepEqual(r[843].modes, ['immersive-vr']);
    assert.equal(r[844].used, true);
    assert.equal(r[845].midiAccessRequested, true);
    assert.deepEqual(r[846].moduleUrls, ['/w/reverb.js']);
    assert.ok(r[847].encoders.includes('VideoEncoder'));
    assert.deepEqual(r[848].endpoints, ['https://rt.example.com/']);
    assert.equal(r[849].webNNUsed, true);
    assert.ok(r[850].hosts.includes('ml.example.com'));
  });
});
