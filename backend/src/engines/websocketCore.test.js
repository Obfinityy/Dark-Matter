/**
 * websocketCore.test.js — node:test coverage for the WebSocket / realtime
 * recon engine (ideas 01041–01050). All tests are offline: they feed
 * operator-supplied fixtures into pure probe builders and analyzers.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  handshakeFuzzVariants,
  analyzeHandshakeResponse,
  detectTokenInUrl,
  subprotocolProbeList,
  analyzeSubprotocolResponse,
  websocketPathCandidates,
  analyzePathProbe,
  socketIoNamespaces,
  analyzeNamespaceReply,
  socketIoEventNames,
  analyzeEventReply,
  pollingFallbackDescriptor,
  analyzePollingAuth,
  actionCableChannels,
  analyzeActionCableFrame,
  signalRHubProbes,
  analyzeHubReply,
  analyzeNegotiateResponse,
  websocketReconFinding,
  WEBSOCKET_CORE,
} from './websocketCore.js';

describe('01041 — handshake fuzzing', () => {
  it('produces benign mutation specs covering Origin, protocol and extensions', () => {
    const variants = handshakeFuzzVariants({ origin: 'https://app.example.com' });
    assert.ok(variants.length >= 8);
    const ids = variants.map(v => v.id);
    assert.ok(ids.some(i => i.startsWith('origin-')));
    assert.ok(ids.some(i => i.startsWith('protocol-')));
    assert.ok(ids.some(i => i.startsWith('extension-')));
    for (const v of variants) {
      assert.ok(v.title && v.mutate && v.expectation, 'variant must have title, mutate and expectation');
    }
  });

  it('flags a 101 that accepted a mutated Origin', () => {
    const res = analyzeHandshakeResponse(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n',
      101,
      { id: 'origin-null' },
    );
    assert.equal(res.accepted, true);
    assert.equal(res.originAccepted, true);
    assert.equal(res.findings.length, 1);
    assert.equal(res.findings[0].kind, 'weak-handshake-validation');
  });

  it('does not flag a rejected handshake (403)', () => {
    const res = analyzeHandshakeResponse('HTTP/1.1 403 Forbidden\r\n', 403, { id: 'origin-arbitrary' });
    assert.equal(res.accepted, false);
    assert.deepEqual(res.findings, []);
  });

  it('flags a server echoing an unknown subprotocol', () => {
    const res = analyzeHandshakeResponse(
      { upgrade: 'websocket', 'sec-websocket-protocol': 'x-nonexistent-proto-9' },
      101,
      { id: 'protocol-unknown' },
    );
    assert.equal(res.echoedProtocol, 'x-nonexistent-proto-9');
    assert.equal(res.findings.length, 1);
    assert.equal(res.findings[0].kind, 'weak-subprotocol-negotiation');
  });
});

describe('01042 — token-in-URL detection', () => {
  it('flags ?token= and ?auth= on a ws:// URL', () => {
    const res = detectTokenInUrl('ws://target.example.com/ws?token=abc123def456&auth=xyz');
    assert.equal(res.hasCredentials, true);
    assert.deepEqual(res.flaggedParams.map(p => p.name).sort(), ['auth', 'token']);
    assert.equal(res.findings.length, 1);
    assert.equal(res.findings[0].kind, 'token-in-url');
  });

  it('does not flag benign query params and masks the token value', () => {
    const res = detectTokenInUrl('wss://target.example.com/ws?room=general&page=2');
    assert.equal(res.hasCredentials, false);
    assert.deepEqual(res.findings, []);
    const secret = detectTokenInUrl('ws://t/ws?token=supersecretvalue');
    assert.ok(!secret.flaggedParams[0].valuePreview.includes('supersecretvalue'));
    assert.ok(secret.flaggedParams[0].valuePreview.includes('…'));
  });
});

describe('01043 — subprotocol negotiation test', () => {
  it('lists deprecated protocols for alternating offers', () => {
    const list = subprotocolProbeList();
    assert.ok(list.length >= 8);
    const protos = list.map(p => p.protocol);
    assert.ok(protos.includes('graphql-ws'));
    assert.ok(protos.includes('subscriptions-transport-ws'));
    assert.equal(list.find(p => p.protocol === 'subscriptions-transport-ws').status, 'deprecated');
  });

  it('flags acceptance of the deprecated legacy protocol', () => {
    const res = analyzeSubprotocolResponse(
      ['graphql-ws'],
      'HTTP/1.1 101\r\nUpgrade: websocket\r\nSec-WebSocket-Protocol: subscriptions-transport-ws\r\n',
    );
    assert.equal(res.accepted, 'subscriptions-transport-ws');
    const kinds = res.findings.map(f => f.kind).sort();
    assert.deepEqual(kinds, ['deprecated-subprotocol', 'protocol-confusion']);
  });

  it('flags a negotiated protocol the client never offered', () => {
    const res = analyzeSubprotocolResponse(['graphql-ws'], { 'sec-websocket-protocol': 'chat' });
    assert.equal(res.acceptedDeprecated, true);
    assert.equal(res.findings[0].kind, 'protocol-confusion');
  });

  it('stays quiet when the offered protocol is accepted normally', () => {
    const res = analyzeSubprotocolResponse(['graphql-ws'], { 'sec-websocket-protocol': 'graphql-ws' });
    assert.equal(res.accepted, 'graphql-ws');
    assert.equal(res.acceptedDeprecated, false);
    assert.deepEqual(res.findings, []);
  });
});

describe('01044 — WebSocket path fuzzing', () => {
  it('covers common paths and framework defaults', () => {
    const paths = websocketPathCandidates();
    const names = paths.map(p => p.path);
    for (const expected of ['/ws', '/socket.io/', '/realtime', '/cable', '/graphql-ws', '/hub']) {
      assert.ok(names.includes(expected), `missing ${expected}`);
    }
  });

  it('marks 101 + Upgrade header as an open socket endpoint', () => {
    const res = analyzePathProbe('/ws', 101, { upgrade: 'websocket' });
    assert.equal(res.state, 'open');
    assert.equal(res.findings.length, 1);
    assert.equal(res.findings[0].kind, 'socket-endpoint-found');
  });

  it('marks 426 as upgrade-capable and 404 as absent', () => {
    assert.equal(analyzePathProbe('/ws', 426, {}, 'upgrade required').state, 'upgrade-capable');
    assert.equal(analyzePathProbe('/ws', 404, {}, 'not found').state, 'absent');
  });
});

describe('01045 — Socket.IO namespace enumeration', () => {
  it('includes privileged-looking namespace candidates', () => {
    const ns = socketIoNamespaces();
    const names = ns.map(n => n.namespace);
    assert.ok(names.includes('/admin'));
    assert.ok(names.includes('/notifications'));
  });

  it('flags a non-default namespace that accepted connect', () => {
    const res = analyzeNamespaceReply('/admin', '40');
    assert.equal(res.state, 'connected');
    assert.equal(res.findings.length, 1);
    assert.equal(res.findings[0].kind, 'namespace-accessible');
  });

  it('does not flag the default namespace or connect errors', () => {
    assert.deepEqual(analyzeNamespaceReply('/', '40').findings, []);
    const err = analyzeNamespaceReply('/admin', '44{"message":"unauthorized"}');
    assert.equal(err.state, 'error');
    assert.deepEqual(err.findings, []);
  });
});

describe('01046 — Socket.IO event-name brute force', () => {
  it('emits benign candidate events with empty arguments', () => {
    const events = socketIoEventNames();
    assert.ok(events.length >= 30);
    for (const e of events) {
      assert.deepEqual(e.args, []);
      assert.ok(typeof e.event === 'string' && e.event.length > 0);
    }
  });

  it('flags a data packet reply as a live handler', () => {
    const res = analyzeEventReply('admin', '42["admin",{"ok":true}]');
    assert.equal(res.handled, true);
    assert.equal(res.kind, 'response');
    assert.equal(res.findings.length, 1);
    assert.equal(res.findings[0].kind, 'live-event');
  });

  it('treats error packets as unhandled', () => {
    const res = analyzeEventReply('admin', '44{"message":"unknown event"}');
    assert.equal(res.handled, false);
    assert.deepEqual(res.findings, []);
  });
});

describe('01047 — polling fallback abuse', () => {
  it('builds a polling transport descriptor with the EIO/transport params', () => {
    const d = pollingFallbackDescriptor({ host: 'target.example.com', sid: 'abc' });
    assert.equal(d.transport, 'polling');
    assert.ok(d.pollUrl.includes('transport=polling'));
    assert.ok(d.pollUrl.includes('EIO=4'));
    assert.ok(d.pollUrl.includes('sid=abc'));
    assert.ok(d.cycle.length >= 3);
  });

  it('flags divergence when polling yields a session but upgrade is rejected', () => {
    const res = analyzePollingAuth({
      pollingStatus: 200,
      pollingBody: '0{"sid":"abc123","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":20000}',
      upgradeStatus: 403,
    });
    assert.equal(res.divergent, true);
    assert.equal(res.findings.length, 1);
    assert.equal(res.findings[0].kind, 'transport-auth-divergence');
  });

  it('stays quiet when both paths behave alike', () => {
    const res = analyzePollingAuth({ pollingStatus: 401, pollingBody: '', upgradeStatus: 401 });
    assert.equal(res.divergent, false);
    assert.deepEqual(res.findings, []);
  });
});

describe('01048 — ActionCable channel enumeration', () => {
  it('builds benign subscribe payloads for guessed channels', () => {
    const channels = actionCableChannels();
    assert.ok(channels.length >= 15);
    const chat = channels.find(c => c.channel === 'ChatChannel');
    assert.ok(chat);
    assert.equal(chat.payload.command, 'subscribe');
    assert.ok(chat.payload.identifier.includes('ChatChannel'));
  });

  it('flags confirm_subscription frames', () => {
    const res = analyzeActionCableFrame('AdminChannel', '{"identifier":"{\\"channel\\":\\"AdminChannel\\"}","type":"confirm_subscription"}');
    assert.equal(res.state, 'confirmed');
    assert.equal(res.findings.length, 1);
    assert.equal(res.findings[0].kind, 'channel-subscribed');
  });

  it('parses reject, welcome and ping frames without findings', () => {
    assert.equal(analyzeActionCableFrame('X', '{"type":"reject_subscription"}').state, 'rejected');
    assert.equal(analyzeActionCableFrame('X', '{"type":"welcome"}').state, 'welcome');
    assert.equal(analyzeActionCableFrame('X', '{"type":"ping","message":123}').state, 'ping');
    assert.deepEqual(analyzeActionCableFrame('X', '{"type":"reject_subscription"}').findings, []);
  });
});

describe('01049 — SignalR hub-method enumeration', () => {
  it('lists negotiate paths and common hub method invocation templates', () => {
    const probes = signalRHubProbes();
    assert.ok(probes.negotiatePaths.some(p => p.path === '/negotiate'));
    const methods = probes.hubMethods;
    assert.ok(methods.length >= 15);
    const echo = methods.find(m => m.hub === 'Hub' && m.method === 'Echo');
    assert.ok(echo);
    assert.equal(echo.payload.type, 1);
    assert.deepEqual(echo.payload.arguments, []);
  });

  it('flags a completed invocation as an executable method', () => {
    const res = analyzeHubReply('Hub', 'Echo', '{"type":3,"invocationId":"probe-7","result":"ok"}\x1e');
    assert.equal(res.state, 'executed');
    assert.equal(res.findings.length, 1);
    assert.equal(res.findings[0].kind, 'hub-method-callable');
  });

  it('distinguishes unknown-hub, unknown-method and auth-guarded errors', () => {
    assert.equal(analyzeHubReply('Nope', 'Ping', '{"type":3,"error":"Unknown hub."}').state, 'unknown-hub');
    assert.equal(analyzeHubReply('Hub', 'Nope', '{"type":3,"error":"Unknown method."}').state, 'unknown-method');
    const guarded = analyzeHubReply('AdminHub', 'GetConfig', '{"type":3,"error":"Unauthorized."}');
    assert.equal(guarded.state, 'auth-guarded');
    assert.equal(guarded.findings[0].kind, 'hub-method-guarded');
  });
});

describe('01050 — SignalR negotiate analysis', () => {
  const goodBody = JSON.stringify({
    connectionId: 'abcd-1234',
    connectionToken: 'dGhpcyBpcyBhIGxvbmcgc2VjdXJlIHRva2VuIHdpdGggZW5vdWdoIGVudHJvcHkgZm9yIHN0cmVuZ3Ro',
    negotiateVersion: 1,
    availableTransports: [
      { transport: 'WebSockets', transferFormats: ['Text', 'Binary'] },
      { transport: 'ServerSentEvents', transferFormats: ['Text'] },
      { transport: 'LongPolling', transferFormats: ['Text', 'Binary'] },
    ],
  });

  it('parses connectionToken and availableTransports from /negotiate', () => {
    const res = analyzeNegotiateResponse(goodBody);
    assert.equal(res.connectionId, 'abcd-1234');
    assert.ok(res.connectionToken);
    assert.ok(res.tokenLength > 40);
    assert.equal(res.tokenStrength, 'strong');
    assert.deepEqual(res.availableTransports, ['WebSockets', 'ServerSentEvents', 'LongPolling']);
    assert.equal(res.negotiateVersion, 1);
    assert.deepEqual(res.findings, []);
  });

  it('flags a weak low-entropy connectionToken', () => {
    const res = analyzeNegotiateResponse(JSON.stringify({ connectionId: 'x', connectionToken: 'abc123' }));
    assert.equal(res.tokenStrength, 'weak');
    assert.equal(res.findings.length, 1);
    assert.equal(res.findings[0].kind, 'weak-session-token');
  });

  it('flags a /negotiate body with no connectionToken', () => {
    const res = analyzeNegotiateResponse('{"connectionId":"x","availableTransports":[]}');
    assert.equal(res.tokenStrength, 'absent');
    assert.ok(res.findings.some(f => f.kind === 'missing-session-token'));
  });

  it('handles invalid JSON without throwing', () => {
    const res = analyzeNegotiateResponse('not json at all');
    assert.equal(res.connectionToken, null);
    assert.equal(res.tokenStrength, 'absent');
  });
});

describe('finding builder and registry', () => {
  it('builds a uniform finding with a remediation recommendation', () => {
    const f = websocketReconFinding({ title: 'sample', kind: 'recon', evidence: 'e', confidence: 'high' });
    assert.equal(f.title, 'WebSocket recon — sample');
    assert.equal(f.severity, 'Info');
    assert.equal(f.confidence, 'high');
    assert.ok(f.recommendation.length > 50);
  });

  it('exposes every function through the named registry and default export', () => {
    const names = [
      'handshakeFuzzVariants', 'analyzeHandshakeResponse', 'detectTokenInUrl',
      'subprotocolProbeList', 'analyzeSubprotocolResponse', 'websocketPathCandidates',
      'analyzePathProbe', 'socketIoNamespaces', 'analyzeNamespaceReply',
      'socketIoEventNames', 'analyzeEventReply', 'pollingFallbackDescriptor',
      'analyzePollingAuth', 'actionCableChannels', 'analyzeActionCableFrame',
      'signalRHubProbes', 'analyzeHubReply', 'analyzeNegotiateResponse',
      'websocketReconFinding',
    ];
    for (const name of names) {
      assert.equal(typeof WEBSOCKET_CORE[name], 'function', `missing ${name}`);
    }
  });
});
