// Standalone CDP client (CDP authenticated-DOM-render lane, 8 Nov 2026).
//
// The client speaks the Chrome DevTools Protocol over the global
// fetch + WebSocket — zero repo imports, so tests stub the
// transport entirely: a fake fetch for the /json HTTP endpoints and
// a FakeWebSocket that records sent frames and answers from a
// script. No real browser, no docker, no network in this file.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { connectCdp, CDP_DEFAULT_TIMEOUT_MS } from './cdpClient.js';

const VERSION_INFO = { Browser: 'Chrome/120.0.0.0', 'Protocol-Version': '1.3' };

function makeFetch({ versionOk = true, target = null } = {}) {
  const calls = [];
  const fetchFn = async (url, opts) => {
    calls.push({ url, opts });
    if (String(url).endsWith('/json/version')) {
      if (!versionOk) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => VERSION_INFO };
    }
    if (String(url).includes('/json/new')) {
      if (!target) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => target };
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  return { fetchFn, calls };
}

class FakeWebSocket {
  constructor(url) {
    this.url = url;
    this.sent = [];
    this.readyState = 1;
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => {
      if (this.onopen) this.onopen();
    });
  }
  send(data) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose();
  }
  receive(obj) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) });
  }
}
FakeWebSocket.instances = [];
FakeWebSocket.reset = () => {
  FakeWebSocket.instances = [];
};

const TARGET = {
  id: 'ABC123',
  type: 'page',
  url: 'about:blank',
  webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/ABC123',
};

async function attachedClient() {
  FakeWebSocket.reset();
  const { fetchFn } = makeFetch({ target: TARGET });
  const { ok, client } = await connectCdp('http://127.0.0.1:9222', { fetchFn, WebSocketCtor: FakeWebSocket });
  assert.equal(ok, true);
  const target = await client.newTarget('about:blank');
  assert.equal(target.webSocketDebuggerUrl, TARGET.webSocketDebuggerUrl);
  await client.attach(target.webSocketDebuggerUrl);
  const ws = FakeWebSocket.instances[0];
  assert.ok(ws, 'a websocket must have been opened');
  return { client, ws };
}

describe('connectCdp (endpoint probe)', () => {
  test('CDP-1: a live endpoint yields a client; version() returns the browser info', async () => {
    const { fetchFn, calls } = makeFetch();
    const { ok, client } = await connectCdp('http://127.0.0.1:9222', { fetchFn, WebSocketCtor: FakeWebSocket });
    assert.equal(ok, true);
    assert.equal(calls[0].url, 'http://127.0.0.1:9222/json/version');
    assert.deepEqual(await client.version(), VERSION_INFO);
  });

  test('CDP-2: dead endpoint, failed probe, and missing endpoint all fail closed — never throw', async () => {
    const { fetchFn } = makeFetch({ versionOk: false });
    const dead = await connectCdp('http://127.0.0.1:9222', { fetchFn, WebSocketCtor: FakeWebSocket });
    assert.equal(dead.ok, false);
    assert.match(dead.error, /500/);

    const threw = await connectCdp('http://127.0.0.1:9222', {
      fetchFn: async () => { throw new Error('ECONNREFUSED'); },
      WebSocketCtor: FakeWebSocket,
    });
    assert.equal(threw.ok, false);
    assert.match(threw.error, /ECONNREFUSED/);

    const empty = await connectCdp('', { fetchFn, WebSocketCtor: FakeWebSocket });
    assert.equal(empty.ok, false);
    assert.match(empty.error, /no cdp endpoint/);
  });
});

describe('newTarget + send (JSON-RPC over the fake socket)', () => {
  test('CDP-3: newTarget PUTs /json/new and returns the target; a target without a websocket URL throws', async () => {
    const { fetchFn, calls } = makeFetch({ target: TARGET });
    const { client } = await connectCdp('http://127.0.0.1:9222', { fetchFn, WebSocketCtor: FakeWebSocket });
    const target = await client.newTarget('about:blank');
    assert.equal(target.id, 'ABC123');
    assert.equal(calls[1].opts.method, 'PUT');
    assert.match(calls[1].url, /\/json\/new\?about%3Ablank/);

    const { fetchFn: noWsFetch } = makeFetch({ target: { id: 'X' } });
    const { client: client2 } = await connectCdp('http://127.0.0.1:9222', { fetchFn: noWsFetch, WebSocketCtor: FakeWebSocket });
    await assert.rejects(() => client2.newTarget('about:blank'), /no websocket URL/);
  });

  test('CDP-4: send round-trips — the reply resolves with the result, ids increment', async () => {
    const { client, ws } = await attachedClient();
    const p1 = client.send('Page.enable');
    const p2 = client.send('Runtime.enable');
    assert.equal(ws.sent.length, 2);
    assert.equal(ws.sent[0].method, 'Page.enable');
    assert.equal(ws.sent[1].method, 'Runtime.enable');
    assert.notEqual(ws.sent[0].id, ws.sent[1].id);
    ws.receive({ id: ws.sent[1].id, result: { ok: 1 } });
    assert.deepEqual(await p2, { ok: 1 });
    ws.receive({ id: ws.sent[0].id, result: {} });
    assert.deepEqual(await p1, {});
  });

  test('CDP-5: a CDP error reply rejects with the protocol message', async () => {
    const { client, ws } = await attachedClient();
    const p = client.send('Network.setCookie', { name: 'x', value: 'y' });
    ws.receive({ id: ws.sent[0].id, error: { code: -32602, message: 'Invalid cookie fields' } });
    await assert.rejects(() => p, /CDP error: Invalid cookie fields/);
  });

  test('CDP-6: a send with no reply rejects on timeout, never hangs', async () => {
    const { client } = await attachedClient();
    await assert.rejects(
      () => client.send('Page.enable', {}, 25),
      /CDP timeout: Page\.enable/,
    );
  });

  test('CDP-7: evaluate returns the value; a page JS exception throws', async () => {
    const { client, ws } = await attachedClient();
    const p = client.evaluate('1 + 1');
    assert.equal(ws.sent[0].method, 'Runtime.evaluate');
    assert.equal(ws.sent[0].params.returnByValue, true);
    assert.equal(ws.sent[0].params.awaitPromise, true);
    ws.receive({ id: ws.sent[0].id, result: { result: { type: 'number', value: 2 } } });
    assert.equal(await p, 2);

    const bad = client.evaluate('throw new Error("boom")');
    ws.receive({
      id: ws.sent[1].id,
      result: { exceptionDetails: { text: 'Uncaught', exception: { description: 'Error: boom' } } },
    });
    await assert.rejects(() => bad, /page JS error: Error: boom/);
  });
});

describe('session injection + navigation', () => {
  test('CDP-8: setCookie sends Network.setCookie with exactly the cookie fields', async () => {
    const { client, ws } = await attachedClient();
    const p = client.setCookie({ name: 'PHPSESSID', value: 'abc123', domain: '172.17.0.1', path: '/', secure: false, httpOnly: true });
    assert.deepEqual(ws.sent[0], {
      id: ws.sent[0].id,
      method: 'Network.setCookie',
      params: { name: 'PHPSESSID', value: 'abc123', domain: '172.17.0.1', path: '/', secure: false, httpOnly: true },
    });
    ws.receive({ id: ws.sent[0].id, result: { success: true } });
    await p;
    await assert.rejects(() => client.setCookie({ value: 'x' }), /needs \{name, value\}/);
  });

  test('CDP-9: addInitScript sends Page.addScriptToEvaluateOnNewDocument with the source verbatim', async () => {
    const { client, ws } = await attachedClient();
    const source = `try { localStorage.setItem('token', "tok"); } catch (e) {}`;
    const p = client.addInitScript(source);
    assert.equal(ws.sent[0].method, 'Page.addScriptToEvaluateOnNewDocument');
    assert.equal(ws.sent[0].params.source, source);
    ws.receive({ id: ws.sent[0].id, result: { identifier: '1' } });
    await p;
  });

  test('CDP-10: navigate sends Page.navigate and resolves only after the load event; outerHTML evaluates the DOM', async () => {
    const { client, ws } = await attachedClient();
    let resolved = false;
    const p = client.navigate('http://172.17.0.1:3000/', { timeoutMs: 5000, settleMs: 0 }).then((v) => {
      resolved = true;
      return v;
    });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(ws.sent[0].method, 'Page.navigate');
    assert.equal(ws.sent[0].params.url, 'http://172.17.0.1:3000/');
    assert.equal(resolved, false, 'navigate must not resolve before the load event');
    ws.receive({ id: ws.sent[0].id, result: { frameId: 'F1' } });
    ws.receive({ method: 'Page.loadEventFired', params: { timestamp: 1 } });
    assert.equal(await p, true);

    const htmlP = client.outerHTML();
    await new Promise((r) => setTimeout(r, 10));
    const evalFrame = ws.sent.find((s) => s.method === 'Runtime.evaluate');
    assert.equal(evalFrame.params.expression, 'document.documentElement.outerHTML');
    ws.receive({ id: evalFrame.id, result: { result: { type: 'string', value: '<html>authed</html>' } } });
    assert.equal(await htmlP, '<html>authed</html>');
  });

  test('CDP-11: navigate with no load event still resolves after its timeout (no hang)', async () => {
    const { client, ws } = await attachedClient();
    const started = Date.now();
    const p = client.navigate('http://example.com/', { timeoutMs: 30, settleMs: 0 });
    await new Promise((r) => setTimeout(r, 10));
    ws.receive({ id: ws.sent[0].id, result: {} });
    assert.equal(await p, true);
    assert.ok(Date.now() - started < CDP_DEFAULT_TIMEOUT_MS, 'navigate must not wait out the default timeout');
  });
});
