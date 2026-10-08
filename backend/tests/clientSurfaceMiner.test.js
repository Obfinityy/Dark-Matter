/**
 * clientSurfaceMiner.test.js — tests for the client-surface mining engine
 * (idea-bank wave 21, ideas 811-820).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  planDotSegmentProbes,
  analyzeDotSegmentResponses,
  normalizeDotSegments,
  planUnicodePathProbes,
  analyzeUnicodePathResponses,
  planParameterPollutionProbes,
  analyzeParameterPollutionResponses,
  planArrayParamProbes,
  analyzeArrayParamResponses,
  inferJsonSchemaFromClientCode,
  analyzeMultipartForms,
  planMultipartProbes,
  discoverChunkedUploadEndpoints,
  extractSignalingUrls,
  harvestIceServers,
  catalogDataChannelLabels,
  mineClientSurface,
  extractBalanced,
  HPP_MARK_FIRST,
  HPP_MARK_SECOND,
} from '../src/engines/clientSurfaceMiner.js';

describe('shared helpers', () => {
  it('extractBalanced returns balanced braces and skips strings', () => {
    assert.equal(extractBalanced('a{"k":"v"}e', 1), '{"k":"v"}');
    assert.equal(extractBalanced('x[1,[2]]y', 1), '[1,[2]]');
    assert.equal(extractBalanced('a{b', 1), null);
    assert.equal(extractBalanced('nope', 0), null);
    assert.equal(extractBalanced(null, 0), null);
  });

  it('normalizeDotSegments resolves RFC 3986 dot segments', () => {
    assert.equal(normalizeDotSegments('/a/b/../c'), '/a/c');
    assert.equal(normalizeDotSegments('/a/./b'), '/a/b');
    assert.equal(normalizeDotSegments('/a/%2e%2e/b'), '/b');
    assert.equal(normalizeDotSegments('/a/b/../../c'), '/c');
    assert.equal(normalizeDotSegments('/'), '/');
    assert.equal(normalizeDotSegments('a/b'), '/a/b');
    assert.equal(normalizeDotSegments(null), '/');
  });
});

describe('idea 811 — dot-segment probes', () => {
  it('plans unique dot-segment variants with expected normalization', () => {
    const probes = planDotSegmentProbes('/api/users/123');
    assert.ok(probes.length >= 6);
    const labels = probes.map((p) => p.label);
    assert.ok(labels.includes('dotdot-trailing'));
    assert.ok(labels.includes('double-encoded-dotdot-trailing'));
    assert.ok(labels.includes('dotdot-mid'));
    assert.equal(new Set(probes.map((p) => p.url)).size, probes.length);
    const mid = probes.find((p) => p.label === 'dotdot-mid');
    assert.equal(mid.expectedNormalized, '/api/123'); // /api/users/../123 resolves up one level
  });

  it('handles shallow paths and bad input', () => {
    const shallow = planDotSegmentProbes('/api');
    assert.ok(shallow.length > 0);
    assert.ok(!shallow.some((p) => p.label === 'dotdot-mid'));
    assert.deepEqual(planDotSegmentProbes(''), []);
    assert.deepEqual(planDotSegmentProbes(null), []);
  });

  it('classifies responses and flags differentials', () => {
    const result = analyzeDotSegmentResponses('/api/users', 200, [
      { url: '/api/users/..', status: 200 },
      { url: '/api/users/%2e%2e', status: 403 },
      { url: '/api/users/%252e%252e', status: 404 },
    ]);
    assert.equal(result.variants.length, 3);
    assert.equal(result.variants[1].behavior, 'differential-status');
    assert.equal(result.variants[2].behavior, 'not-found');
    assert.ok(result.findings.length >= 1);
    assert.equal(result.findings[0].type, 'path-normalization-differential');
    // No differential when everything matches the baseline
    const clean = analyzeDotSegmentResponses('/api/users', 200, [{ url: '/api/users/.', status: 200 }]);
    assert.equal(clean.findings.length, 0);
  });
});

describe('idea 812 — unicode path probes', () => {
  it('plans unicode variants with distinct techniques', () => {
    const probes = planUnicodePathProbes('/api/users');
    assert.ok(probes.length >= 5);
    const techniques = new Set(probes.map((p) => p.technique));
    assert.ok(techniques.has('overlong-utf8'));
    assert.ok(techniques.has('unicode-escape'));
    assert.ok(techniques.has('fullwidth'));
    assert.equal(new Set(probes.map((p) => p.url)).size, probes.length);
    assert.deepEqual(planUnicodePathProbes('  '), []);
  });

  it('flags unicode normalization differentials', () => {
    const result = analyzeUnicodePathResponses('/api/users', 404, [
      { url: '/api%c0%afusers', status: 404 },
      { url: '/api%u002fusers', status: 200 },
    ]);
    assert.equal(result.variants[0].differential, false);
    assert.equal(result.variants[1].differential, true);
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].type, 'unicode-normalization-differential');
    assert.equal(result.findings[0].severity, 'medium');
  });
});

describe('idea 813 — parameter pollution', () => {
  it('plans baseline + pollution variants with reversed duplicate', () => {
    const probes = planParameterPollutionProbes('https://t.example/search?q=x', 'q');
    assert.equal(probes.length, 5);
    assert.ok(probes[0].url.includes(`q=${HPP_MARK_FIRST}`));
    assert.ok(probes[1].url.includes(`${HPP_MARK_FIRST}&q=${HPP_MARK_SECOND}`));
    assert.ok(probes[2].url.includes(`${HPP_MARK_SECOND}&q=${HPP_MARK_FIRST}`));
    assert.deepEqual(planParameterPollutionProbes('', 'q'), []);
    assert.deepEqual(planParameterPollutionProbes('https://t.example/', ''), []);
  });

  it('detects first-wins merge behavior', () => {
    const r = analyzeParameterPollutionResponses('https://t.example/', 'q', [
      { label: 'baseline', variant: 'baseline', status: 200, observed: HPP_MARK_FIRST },
      { label: 'duplicate', variant: 'duplicate', status: 200, observed: HPP_MARK_FIRST },
      { label: 'duplicate-reversed', variant: 'duplicate-reversed', status: 200, observed: HPP_MARK_SECOND },
    ]);
    assert.equal(r.mergeBehavior, 'first-wins');
    assert.equal(r.confidence, 'high');
  });

  it('detects last-wins, comma-joined, array, and rejects', () => {
    const mk = (obs, status = 200) => [
      { label: 'duplicate', variant: 'duplicate', status, observed: obs },
      { label: 'duplicate-reversed', variant: 'duplicate-reversed', status, observed: obs },
    ];
    const lastWins = [
      { label: 'duplicate', variant: 'duplicate', status: 200, observed: HPP_MARK_SECOND },
      { label: 'duplicate-reversed', variant: 'duplicate-reversed', status: 200, observed: HPP_MARK_FIRST },
    ];
    assert.equal(analyzeParameterPollutionResponses('u', 'p', lastWins).mergeBehavior, 'last-wins');
    assert.equal(analyzeParameterPollutionResponses('u', 'p', mk(`${HPP_MARK_FIRST},${HPP_MARK_SECOND}`)).mergeBehavior, 'comma-joined');
    assert.equal(
      analyzeParameterPollutionResponses('u', 'p', mk([HPP_MARK_FIRST, HPP_MARK_SECOND])).mergeBehavior,
      'array'
    );
    assert.equal(analyzeParameterPollutionResponses('u', 'p', mk(null, 400)).mergeBehavior, 'rejects-duplicates');
    assert.equal(analyzeParameterPollutionResponses('u', 'p', []).mergeBehavior, 'unknown');
  });
});

describe('idea 814 — array parameter syntax', () => {
  it('plans bracket/indexed/named/duplicate probes', () => {
    const probes = planArrayParamProbes('https://t.example/list', 'tag');
    assert.deepEqual(probes.map((p) => p.syntax), ['bracket', 'indexed', 'named-index', 'duplicate']);
    assert.ok(probes[0].url.includes('tag[]=dmx1'));
    assert.deepEqual(planArrayParamProbes(null, 'tag'), []);
  });

  it('fingerprints PHP-style backends from bracket support', () => {
    const r = analyzeArrayParamResponses('https://t.example/', 'tag', [
      { label: 'bracket', syntax: 'bracket', status: 200, parsedAs: 'array' },
      { label: 'named-index', syntax: 'named-index', status: 200, parsedAs: 'array' },
      { label: 'indexed', syntax: 'indexed', status: 200, parsedAs: 'scalar' },
    ]);
    assert.deepEqual(r.supportedSyntaxes, ['bracket', 'named-index']);
    const php = r.likelyBackends.find((b) => b.name === 'PHP');
    assert.ok(php);
    assert.equal(php.confidence, 'medium');
  });

  it('returns empty fingerprint when nothing is honored', () => {
    const r = analyzeArrayParamResponses('u', 'p', [
      { label: 'bracket', syntax: 'bracket', status: 200, parsedAs: 'ignored' },
    ]);
    assert.deepEqual(r.supportedSyntaxes, []);
    assert.deepEqual(r.likelyBackends, []);
  });
});

describe('idea 815 — JSON body inference', () => {
  it('infers schema from fetch JSON bodies', () => {
    const src = `
      fetch("https://t.example/api/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ email: "", password: "", remember: false, age: 0 })
      });`;
    const schemas = inferJsonSchemaFromClientCode(src);
    assert.equal(schemas.length, 1);
    assert.equal(schemas[0].method, 'POST');
    assert.equal(schemas[0].url, 'https://t.example/api/login');
    const byName = Object.fromEntries(schemas[0].fields.map((f) => [f.name, f.type]));
    assert.equal(byName.email, 'string');
    assert.equal(byName.remember, 'boolean');
    assert.equal(byName.age, 'number');
    assert.equal(schemas[0].source, 'fetch-body');
  });

  it('parses zod schemas with required/optional and constraints', () => {
    const src = `const s = z.object({ name: z.string().min(2).max(40), email: z.string().email().optional(), age: z.number().int() });`;
    const schemas = inferJsonSchemaFromClientCode(src);
    const zod = schemas.find((s) => s.source === 'zod-schema');
    assert.ok(zod);
    const byName = Object.fromEntries(zod.fields.map((f) => [f.name, f]));
    assert.equal(byName.name.required, true);
    assert.deepEqual(byName.name.constraints, ['min:2', 'max:40']);
    assert.equal(byName.email.required, false);
    assert.ok(byName.email.constraints.includes('email'));
  });

  it('parses axios bodies and manual presence checks', () => {
    const src = `
      axios.put("/api/profile", { displayName: "x", tags: [] });
      if (!body.email) throw new Error("missing");
      if (payload.token === undefined) return;`;
    const schemas = inferJsonSchemaFromClientCode(src);
    const axios = schemas.find((s) => s.source === 'axios-body');
    assert.ok(axios);
    assert.equal(axios.method, 'PUT');
    const manual = schemas.find((s) => s.source === 'manual-checks');
    assert.ok(manual);
    assert.deepEqual(manual.fields.map((f) => f.name).sort(), ['email', 'token']);
  });

  it('handles empty and non-string input', () => {
    assert.deepEqual(inferJsonSchemaFromClientCode(''), []);
    assert.deepEqual(inferJsonSchemaFromClientCode(null), []);
    assert.deepEqual(inferJsonSchemaFromClientCode('const x = 1;'), []);
  });
});

describe('idea 816 — multipart analysis', () => {
  const HTML = `
    <form action="/upload" method="post" enctype="multipart/form-data">
      <input type="text" name="title" />
      <input type="file" name="avatar" accept="image/*" multiple />
      <input type="file" name="doc" />
      <textarea name="notes"></textarea>
    </form>
    <form action="/login" method="post">
      <input type="text" name="user" />
    </form>`;

  it('extracts only multipart forms with their fields', () => {
    const forms = analyzeMultipartForms(HTML);
    assert.equal(forms.length, 1);
    assert.equal(forms[0].action, '/upload');
    assert.equal(forms[0].method, 'POST');
    assert.equal(forms[0].fileInputCount, 2);
    const avatar = forms[0].fields.find((f) => f.name === 'avatar');
    assert.equal(avatar.accept, 'image/*');
    assert.equal(avatar.multiple, true);
  });

  it('handles missing forms and bad input', () => {
    assert.deepEqual(analyzeMultipartForms('<p>no forms</p>'), []);
    assert.deepEqual(analyzeMultipartForms(''), []);
    assert.deepEqual(analyzeMultipartForms(null), []);
  });

  it('plans parser-strictness probes for a form', () => {
    const [form] = analyzeMultipartForms(HTML);
    const probes = planMultipartProbes(form);
    assert.equal(probes.length, 5);
    const labels = probes.map((p) => p.label);
    assert.ok(labels.includes('quoted-boundary'));
    assert.ok(labels.includes('rfc5987-filename'));
    assert.ok(probes.every((p) => p.contentTypeHeader.includes('multipart/form-data')));
    assert.deepEqual(planMultipartProbes(null), []);
  });
});

describe('idea 817 — chunked upload discovery', () => {
  it('discovers tus and content-range upload endpoints', () => {
    const src = `
      const up = new tus.Upload(file, { endpoint: "/files/upload", chunkSize: 5242880 });
      fetch("/api/videos", { method: "PATCH", headers: { "Content-Range": "bytes 0-99/100" } });`;
    const found = discoverChunkedUploadEndpoints(src);
    assert.ok(found.length >= 2);
    const tus = found.find((f) => f.url === '/files/upload');
    assert.ok(tus);
    assert.equal(tus.protocol, 'tus');
    const cr = found.find((f) => f.url === '/api/videos');
    assert.ok(cr);
    assert.equal(cr.protocol, 'content-range');
  });

  it('ignores plain URLs without upload context', () => {
    assert.deepEqual(discoverChunkedUploadEndpoints('fetch("/api/users");'), []);
    assert.deepEqual(discoverChunkedUploadEndpoints(''), []);
  });
});

describe('idea 818 — signaling URL extraction', () => {
  it('extracts websocket signaling URLs near keywords', () => {
    const src = `
      const ws = new WebSocket("wss://signal.example.com/socket");
      ws.onmessage = (e) => handleSignal(JSON.parse(e.data));
      fetch("/api/health");`;
    const found = extractSignalingUrls(src);
    assert.equal(found.length, 1);
    assert.equal(found[0].url, 'wss://signal.example.com/socket');
    assert.equal(found[0].kind, 'websocket');
    assert.ok(found[0].keywords.includes('signal'));
  });

  it('detects socket.io endpoints', () => {
    const src = `const s = io("https://rtc.example.com", { path: "/socket.io/" }); // webrtc peer`;
    const found = extractSignalingUrls(src);
    assert.ok(found.some((f) => f.kind === 'socket.io'));
  });

  it('returns empty for irrelevant code', () => {
    assert.deepEqual(extractSignalingUrls('const x = 1;'), []);
    assert.deepEqual(extractSignalingUrls(null), []);
  });
});

describe('idea 819 — ICE server harvesting', () => {
  it('harvests stun/turn lists and flags exposed credentials', () => {
    const src = `
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.example.com:3478" },
          { urls: ["turn:turn.example.com:3478", "turns:turn.example.com:5349"], username: "user1", credential: "s3cret" }
        ]
      });`;
    const configs = harvestIceServers(src);
    assert.equal(configs.length, 1);
    assert.deepEqual(configs[0].stunUrls, ['stun:stun.example.com:3478']);
    assert.deepEqual(configs[0].turnUrls, ['turn:turn.example.com:3478', 'turns:turn.example.com:5349']);
    assert.equal(configs[0].exposesCredentials, true);
  });

  it('handles configs without credentials and bad input', () => {
    const src = `new RTCPeerConnection({ iceServers: [{ urls: ["stun:a.example", "stun:b.example"] }] });`;
    const [cfg] = harvestIceServers(src);
    assert.equal(cfg.exposesCredentials, false);
    assert.equal(cfg.urls.length, 2);
    assert.deepEqual(harvestIceServers('no webrtc here'), []);
    assert.deepEqual(harvestIceServers(''), []);
  });
});

describe('idea 820 — datachannel cataloging', () => {
  it('catalogs labels with options and feature hints', () => {
    const src = `
      const chat = pc.createDataChannel("chat", { ordered: true });
      const files = pc.createDataChannel("file-transfer", { ordered: false, maxRetransmits: 3 });`;
    const labels = catalogDataChannelLabels(src);
    assert.equal(labels.length, 2);
    const chat = labels.find((l) => l.label === 'chat');
    assert.equal(chat.options.ordered, true);
    assert.equal(chat.likelyFeature, 'chat');
    const files = labels.find((l) => l.label === 'file-transfer');
    assert.equal(files.options.maxRetransmits, 3);
    assert.equal(files.likelyFeature, 'file');
  });

  it('dedupes labels and handles bad input', () => {
    const src = `pc.createDataChannel("x"); pc.createDataChannel("x");`;
    assert.equal(catalogDataChannelLabels(src).length, 1);
    assert.deepEqual(catalogDataChannelLabels(''), []);
    assert.deepEqual(catalogDataChannelLabels(null), []);
  });
});

describe('aggregator', () => {
  it('mineClientSurface runs all miners over sources', () => {
    const js = `
      fetch("/api/login", { method: "POST", body: JSON.stringify({ email: "" }) });
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:s.example" }] });
      pc.createDataChannel("chat");
      new WebSocket("wss://sig.example/signal"); // signaling peer
      const up = new tus.Upload(f, { endpoint: "/files/up" });`;
    const html = `<form action="/u" enctype="multipart/form-data"><input type="file" name="f"/></form>`;
    const out = mineClientSurface({ jsSources: [js], htmlSources: [html] });
    assert.ok(out.jsonSchemas.length >= 1);
    assert.ok(out.iceServers.length >= 1);
    assert.ok(out.dataChannels.length >= 1);
    assert.ok(out.signalingUrls.length >= 1);
    assert.ok(out.chunkedUploads.length >= 1);
    assert.ok(out.multipartForms.length >= 1);
  });

  it('mineClientSurface tolerates missing sources', () => {
    const out = mineClientSurface();
    assert.deepEqual(out.jsonSchemas, []);
    assert.deepEqual(out.multipartForms, []);
  });
});
