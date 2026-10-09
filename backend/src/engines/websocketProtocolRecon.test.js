/**
 * websocketProtocolRecon.test.js — node:test assertions for websocketProtocolRecon.js.
 * Ideas 01051–01060, at least one test per idea.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeStompHeader,
  stompSubscribeProbes,
  analyzeStompSubscribeResponses,
  mqttTopicCandidates,
  analyzeMqttSubscribeResults,
  sockjsInfoPathCandidates,
  analyzeSockjsInfo,
  clusterFrameShapes,
  binaryFrameMutationSpecs,
  analyzeBinaryFrameResponses,
  permessageDeflateDescriptors,
  analyzeCompressionBehavior,
  maxFrameSizeProbeSpecs,
  analyzeFrameSizeResponses,
  pingPongProbeSpecs,
  analyzePingPongLog,
  analyzeResumeTokens,
  outOfOrderSequenceSpecs,
  analyzeOrderingResponses,
  websocketReconFinding,
  WEBSOCKET_PROTOCOL_RECON,
} from './websocketProtocolRecon.js';

// ---- Idea 01051: STOMP topic sweep ----
test('escapeStompHeader escapes backslash, newline and colon', () => {
  assert.equal(escapeStompHeader('a:b\\c\nd'), 'a\\cb\\\\c\\nd');
});

test('stompSubscribeProbes builds wildcard + guess SUBSCRIBE frames', () => {
  const probes = stompSubscribeProbes(['/topic/news', '/queue/user-9']);
  assert.ok(probes.length >= 10);
  assert.ok(probes.some(p => p.wildcard && p.destination === '/topic/#'));
  assert.ok(probes.some(p => !p.wildcard && p.destination === '/topic/news'));
  const frame = probes.find(p => p.destination === '/queue/user-9').frame;
  assert.ok(frame.startsWith('SUBSCRIBE\n'));
  assert.ok(frame.includes('destination:/queue/user-9'));
  assert.ok(frame.endsWith('\x00'));
  // Deduplicates exact repeats.
  assert.equal(stompSubscribeProbes(['/topic/#']).filter(p => p.destination === '/topic/#').length, 1);
});

test('analyzeStompSubscribeResponses flags accepted subs and foreign destinations', () => {
  const findings = analyzeStompSubscribeResponses({
    sent: [{ label: 'x', destination: '/topic/#' }],
    received: [
      'RECEIPT\nreceipt-id:1\n\n\x00',
      'MESSAGE\ndestination:/topic/other-user\n\nhello\x00',
    ],
  });
  const types = findings.map(f => f.type);
  assert.ok(types.includes('stomp-subscribe-accepted'));
  assert.ok(types.includes('stomp-cross-destination-messages'));
  assert.ok(findings.every(f => ['high', 'medium', 'low'].includes(f.confidence)));
});

test('analyzeStompSubscribeResponses reports rejected subscriptions', () => {
  const findings = analyzeStompSubscribeResponses({
    sent: [{ label: 'x', destination: '/queue/#' }],
    received: ['ERROR\nmessage:access denied\n\n\x00'],
  });
  assert.ok(findings.some(f => f.type === 'stomp-subscribe-rejected'));
});

// ---- Idea 01052: MQTT topic brute force ----
test('mqttTopicCandidates includes # and + wildcards with expansions', () => {
  const c = mqttTopicCandidates(['devices/123/status']);
  const topics = c.map(x => x.topic);
  assert.ok(topics.includes('#'));
  assert.ok(topics.includes('+'));
  assert.ok(topics.includes('devices/123/#'));
  assert.ok(topics.includes('devices/+/status'));
  assert.ok(topics.includes('devices/#'));
  assert.ok(c.every(x => x.wildcard === (x.wildcardType !== null)));
  assert.equal(new Set(topics).size, topics.length, 'no duplicate candidates');
});

test('analyzeMqttSubscribeResults flags granted multi-level wildcard', () => {
  const findings = analyzeMqttSubscribeResults([
    { topic: '#', granted: true, grantedQos: 1, wildcardType: 'multi' },
    { topic: 'devices/123/status', granted: false, wildcardType: null },
  ]);
  assert.ok(findings.some(f => f.type === 'mqtt-broad-multilevel-subscribe' && f.confidence === 'high'));
});

test('analyzeMqttSubscribeResults reports full denial', () => {
  const findings = analyzeMqttSubscribeResults([
    { topic: '#', granted: false, wildcardType: 'multi' },
  ]);
  assert.ok(findings.some(f => f.type === 'mqtt-subscribe-denied'));
});

// ---- Idea 01053: SockJS info probe ----
test('sockjsInfoPathCandidates builds /info paths per prefix', () => {
  assert.deepEqual(sockjsInfoPathCandidates(['/sockjs', '/ws/']), ['/sockjs/info', '/ws/info']);
});

test('analyzeSockjsInfo flags websocket support, permissive origins and low entropy', () => {
  const findings = analyzeSockjsInfo(JSON.stringify({
    websocket: true,
    origins: ['*:*'],
    entropy: 16,
    cookie_needed: true,
  }));
  const types = findings.map(f => f.type);
  assert.ok(types.includes('sockjs-websocket-enabled'));
  assert.ok(types.includes('sockjs-permissive-origins'));
  assert.ok(types.includes('sockjs-entropy-disclosed'));
  assert.ok(types.includes('sockjs-cookie-required'));
  assert.equal(findings.find(f => f.type === 'sockjs-permissive-origins').confidence, 'high');
});

test('analyzeSockjsInfo ignores non-JSON bodies', () => {
  assert.deepEqual(analyzeSockjsInfo('<html>not sockjs</html>'), []);
});

// ---- Idea 01054: message-schema inference ----
test('clusterFrameShapes clusters pairs by structure', () => {
  const pairs = [
    { request: '{"type":"ping"}', response: '{"type":"pong"}' },
    { request: '{"type":"ping"}', response: '{"type":"pong"}' },
    { request: '{"type":"subscribe","channel":"news"}', response: '{"type":"ack","id":1}' },
  ];
  const { clusters, totalPairs, undocumentedTypes } = clusterFrameShapes(pairs);
  assert.equal(totalPairs, 3);
  assert.equal(clusters.length, 2);
  assert.equal(clusters[0].count, 2);
  assert.equal(undocumentedTypes, 1);
  assert.ok(clusters.every(c => typeof c.shape === 'string' && Array.isArray(c.samples)));
});

test('clusterFrameShapes handles non-JSON text payloads', () => {
  const { clusters } = clusterFrameShapes([{ request: 'hello', response: 'world' }]);
  assert.equal(clusters.length, 1);
  assert.ok(clusters[0].requestShape.startsWith('text'));
});

// ---- Idea 01055: binary-frame handling ----
test('binaryFrameMutationSpecs builds text/binary pairs per payload', () => {
  const specs = binaryFrameMutationSpecs(['{"a":1}']);
  assert.equal(specs.filter(s => s.opcode === 1).length, 1);
  assert.equal(specs.filter(s => s.opcode === 2).length, 2); // same-bytes + empty
  assert.ok(specs.every(s => typeof s.description === 'string'));
});

test('analyzeBinaryFrameResponses flags binary-parsed-as-text gap', () => {
  const findings = analyzeBinaryFrameResponses([
    { label: 'frame-mutation:text', outcome: 'echoed' },
    { label: 'frame-mutation:binary-same-bytes', outcome: 'echoed' },
  ]);
  assert.ok(findings.some(f => f.type === 'binary-frame-parsed-as-text'));
});

test('analyzeBinaryFrameResponses flags connection close on binary', () => {
  const findings = analyzeBinaryFrameResponses([
    { label: 'frame-mutation:binary-same-bytes', outcome: 'close', detail: 'code 1003' },
  ]);
  assert.ok(findings.some(f => f.type === 'binary-frame-connection-close'));
});

// ---- Idea 01056: compression abuse ----
test('permessageDeflateDescriptors offers deflate and builds compressible payloads', () => {
  const d = permessageDeflateDescriptors({ repeatUnits: 500, patterns: ['A'] });
  assert.equal(d.negotiation.extension, 'permessage-deflate');
  assert.equal(d.payloads.length, 1);
  assert.ok(d.payloads[0].approxBytes >= 500);
  assert.ok(d.payloads[0].label.startsWith('compressible-payload:'));
});

test('analyzeCompressionBehavior flags memory amplification', () => {
  const findings = analyzeCompressionBehavior({
    deflateAccepted: true,
    memoryBeforeBytes: 1000,
    memoryAfterBytes: 100000,
    payloadBytes: 1000,
    connectionCount: 1,
  });
  assert.ok(findings.some(f => f.type === 'compression-memory-amplification' && f.confidence === 'high'));
});

test('analyzeCompressionBehavior reports rejected deflate', () => {
  const findings = analyzeCompressionBehavior({ deflateAccepted: false });
  assert.ok(findings.some(f => f.type === 'permessage-deflate-rejected'));
});

// ---- Idea 01057: max-frame-size probe ----
test('maxFrameSizeProbeSpecs builds a geometric size series', () => {
  const specs = maxFrameSizeProbeSpecs({ startBytes: 1024, factor: 2, steps: 4 });
  assert.deepEqual(specs.map(s => s.frameBytes), [1024, 2048, 4096, 8192]);
  assert.ok(specs.every(s => s.payload.length === s.frameBytes));
});

test('analyzeFrameSizeResponses locates the truncation point', () => {
  const findings = analyzeFrameSizeResponses([
    { frameBytes: 1024, outcome: 'ok', receivedBytes: 1024 },
    { frameBytes: 2048, outcome: 'ok', receivedBytes: 2048 },
    { frameBytes: 4096, outcome: 'truncated', receivedBytes: 2048 },
  ]);
  const t = findings.find(f => f.type === 'frame-truncation-point');
  assert.ok(t && t.confidence === 'high');
  assert.ok(t.evidence.includes('4096'));
});

test('analyzeFrameSizeResponses flags enforced limit on close', () => {
  const findings = analyzeFrameSizeResponses([
    { frameBytes: 1024, outcome: 'ok' },
    { frameBytes: 8192, outcome: 'close' },
  ]);
  assert.ok(findings.some(f => f.type === 'frame-size-limit-enforced'));
});

// ---- Idea 01058: ping/pong behavior map ----
test('pingPongProbeSpecs builds keepalive probes plus unsolicited pong', () => {
  const probes = pingPongProbeSpecs({ intervalsSec: [5, 30], payloadSize: 4 });
  assert.equal(probes.length, 3);
  assert.ok(probes.some(p => p.label === 'unsolicited-pong' && p.action === 'pong-without-ping'));
  assert.ok(probes.every(p => p.payload.length === 4));
});

test('analyzePingPongLog maps idle timeout and flags required pongs', () => {
  const findings = analyzePingPongLog([
    { at: 0, event: 'ping-received' },
    { at: 45, event: 'closed' },
  ]);
  assert.ok(findings.some(f => f.type === 'idle-timeout-mapped' && f.evidence.includes('45')));
  assert.ok(findings.some(f => f.type === 'pong-required-for-survival'));
});

test('analyzePingPongLog flags unreliable pong responses', () => {
  const findings = analyzePingPongLog([
    { at: 0, event: 'ping-sent' },
    { at: 5, event: 'ping-sent' },
    { at: 10, event: 'ping-sent' },
    { at: 11, event: 'pong-received' },
  ]);
  assert.ok(findings.some(f => f.type === 'pong-unreliable'));
});

// ---- Idea 01059: reconnection-token analysis ----
test('analyzeResumeTokens detects sequential hex tokens with real math', () => {
  const r = analyzeResumeTokens(['a1b2c3d4', 'a1b2c3d5', 'a1b2c3d6', 'a1b2c3d7']);
  assert.equal(r.verdict, 'predictable-sequential');
  assert.equal(r.sequential, true);
  assert.equal(r.sequentialBase, 16);
  assert.equal(r.sequentialStep, 1);
  assert.ok(r.findings.some(f => f.type === 'resume-token-sequential' && f.confidence === 'high'));
});

test('analyzeResumeTokens flags constant tokens', () => {
  const r = analyzeResumeTokens(['same-token', 'same-token', 'same-token']);
  assert.equal(r.verdict, 'predictable-constant');
  assert.ok(r.findings.some(f => f.type === 'resume-token-constant'));
});

test('analyzeResumeTokens rates strong random tokens', () => {
  const r = analyzeResumeTokens([
    '9f2c7a1e4b6d8f0a3c5e7b9d1f3a5c7',
    '1a3c5e7b9d1f3a5c79f2c7a1e4b6d80',
    'b6d8f0a3c5e7b9d1f3a5c79f2c7a1e',
    '4b6d8f0a3c5e7b9d1f3a5c79f2c7a1',
  ]);
  assert.equal(r.verdict, 'strong');
  assert.ok(r.totalEntropyBits > 64, `entropy ${r.totalEntropyBits} should exceed 64 bits`);
  assert.equal(r.charsetSize, 16);
});

test('analyzeResumeTokens flags low-entropy tokens', () => {
  const r = analyzeResumeTokens(['xk3m', 'qq7p', '9zz2', 'ab99']);
  assert.ok(['weak-low-entropy', 'weak-small-charset'].includes(r.verdict));
  assert.ok(r.findings.some(f => f.type === 'resume-token-low-entropy'));
});

test('analyzeResumeTokens handles empty input', () => {
  const r = analyzeResumeTokens([]);
  assert.equal(r.tokenCount, 0);
  assert.equal(r.verdict, 'no-tokens');
  assert.deepEqual(r.findings, []);
});

// ---- Idea 01060: message-ordering assumption test ----
test('outOfOrderSequenceSpecs builds in-order and reversed pairs', () => {
  const specs = outOfOrderSequenceSpecs([
    { label: 'transfer', first: '{"op":"debit","amt":5}', second: '{"op":"credit","amt":5}', dependsOn: 'account balance' },
  ]);
  assert.equal(specs.length, 2);
  assert.ok(specs.some(s => s.sendOrder === 'in-order'));
  assert.ok(specs.some(s => s.sendOrder === 'reversed'));
  assert.deepEqual(specs.find(s => s.sendOrder === 'reversed').frames, ['{"op":"credit","amt":5}', '{"op":"debit","amt":5}']);
});

test('analyzeOrderingResponses flags order-dependent state divergence', () => {
  const findings = analyzeOrderingResponses([
    { label: 'ordering:in-order:transfer', sendOrder: 'in-order', finalState: 'balance=100' },
    { label: 'ordering:reversed:transfer', sendOrder: 'reversed', finalState: 'balance=-50' },
  ]);
  assert.ok(findings.some(f => f.type === 'order-dependent-state-divergence' && f.confidence === 'high'));
});

test('analyzeOrderingResponses flags reversed-only errors', () => {
  const findings = analyzeOrderingResponses([
    { label: 'ordering:in-order:x', sendOrder: 'in-order', finalState: 'ok' },
    { label: 'ordering:reversed:x', sendOrder: 'reversed', finalState: 'partial', error: 'missing dependency' },
  ]);
  assert.ok(findings.some(f => f.type === 'reversed-order-error'));
});

// ---- Finding builder + registry ----
test('websocketReconFinding builds a uniform finding', () => {
  const f = websocketReconFinding({ title: 'sample', evidence: 'e', confidence: 'high' });
  assert.ok(f.title.startsWith('WebSocket recon —'));
  assert.equal(f.severity, 'Info');
  assert.equal(f.confidence, 'high');
  assert.ok(f.recommendation.length > 0);
});

test('WEBSOCKET_PROTOCOL_RECON registry exposes every builder and analyzer', () => {
  const expected = [
    'escapeStompHeader', 'stompSubscribeProbes', 'analyzeStompSubscribeResponses',
    'mqttTopicCandidates', 'analyzeMqttSubscribeResults',
    'sockjsInfoPathCandidates', 'analyzeSockjsInfo',
    'clusterFrameShapes',
    'binaryFrameMutationSpecs', 'analyzeBinaryFrameResponses',
    'permessageDeflateDescriptors', 'analyzeCompressionBehavior',
    'maxFrameSizeProbeSpecs', 'analyzeFrameSizeResponses',
    'pingPongProbeSpecs', 'analyzePingPongLog',
    'analyzeResumeTokens',
    'outOfOrderSequenceSpecs', 'analyzeOrderingResponses',
    'websocketReconFinding',
  ];
  for (const name of expected) {
    assert.equal(typeof WEBSOCKET_PROTOCOL_RECON[name], 'function', name);
  }
});
