/**
 * vmRunnerApi.test.js — Infinity AI VM Runner client, pure logic.
 *
 * Covers: VmRunnerError (code/message/doctor/hint), WS URL builders for the
 * noVNC + terminal sockets, session-token memory handling (set on start,
 * cleared on stop — never persisted to localStorage), Authorization header
 * injection, HTTP-error mapping, and the /doctor failure path.
 *
 * Pure logic only: fetch and localStorage are mocked. No real runner, no
 * real WebSocket connections.
 * Run (from the repo root):
 *   node --test --import ./frontend/src/services/__tests__/register-node-hooks.mjs \
 *     frontend/src/services/__tests__/vmRunnerApi.test.js
 * The --import hook is test-only infrastructure: vmRunnerApi.js imports
 * './vmEndpoint' without a file extension (Vite resolves it; plain node does
 * not), so the hook maps that one specifier to ./vmEndpoint.js. The tests
 * still exercise the REAL vmRunnerApi.js file.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => { map.clear(); },
    _dump: () => Object.fromEntries(map),
  };
}

const storage = makeStorage();
globalThis.localStorage = storage;

const realFetch = globalThis.fetch;
function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return handler(url, opts, calls);
  };
  return calls;
}

function jsonRes(data, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null),
    },
    json: async () => data,
  };
}

const api = await import('../vmRunnerApi.js');
const ep = await import('../vmEndpoint.js');

beforeEach(() => storage.clear());
afterEach(() => { globalThis.fetch = realFetch; });

describe('VmRunnerError', () => {
  test('carries code, message, doctor and hint', () => {
    const doctor = { problems: ['qemu missing'] };
    const err = new api.VmRunnerError('unreachable', 'runner down', { doctor, hint: 'start it' });
    assert.ok(err instanceof Error);
    assert.equal(err.name, 'VmRunnerError');
    assert.equal(err.code, 'unreachable');
    assert.equal(err.message, 'runner down');
    assert.deepEqual(err.doctor, doctor);
    assert.equal(err.hint, 'start it');
  });

  test('doctor and hint default to null / empty string', () => {
    const err = new api.VmRunnerError('bad_token', 'expired');
    assert.equal(err.doctor, null);
    assert.equal(err.hint, '');
  });
});

describe('session-token memory handling', () => {
  const TOKEN = 'tok-memory-only-1';

  async function startSession(id) {
    mockFetch(async (url) => {
      if (String(url).endsWith('/vm/start')) {
        return jsonRes({ ok: true, sessionToken: TOKEN, state: 'running' });
      }
      return jsonRes({ ok: true });
    });
    return api.startVm(id);
  }

  test('startVm stores the token in module memory only', async () => {
    const data = await startSession('mem-1');
    assert.equal(data.sessionToken, TOKEN);
    assert.equal(api.hasVmToken('mem-1'), true);
    assert.equal(api.hasVmToken('mem-unknown'), false);
    // Never persisted to localStorage.
    assert.ok(!JSON.stringify(storage._dump()).includes(TOKEN),
      'session token must not reach localStorage');
    await api.stopVm('mem-1');
  });

  test('the token is sent as a Bearer Authorization header', async () => {
    await startSession('mem-2');
    const calls = mockFetch(async () => jsonRes({ state: 'running' }));
    await api.vmStatus('mem-2');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].opts.headers.Authorization, `Bearer ${TOKEN}`);
    await api.stopVm('mem-2');
  });

  test('sessions without a token send no Authorization header', async () => {
    const calls = mockFetch(async () => jsonRes({ state: 'running' }));
    await api.vmStatus('mem-no-token');
    assert.ok(!('Authorization' in calls[0].opts.headers));
  });

  test('stopVm clears the token even when the runner call fails', async () => {
    await startSession('mem-3');
    assert.equal(api.hasVmToken('mem-3'), true);
    mockFetch(async () => { throw new Error('ECONNREFUSED'); });
    await assert.rejects(() => api.stopVm('mem-3'), (err) => {
      assert.ok(err instanceof api.VmRunnerError);
      assert.equal(err.code, 'unreachable');
      return true;
    });
    assert.equal(api.hasVmToken('mem-3'), false);
  });

  test('vmExecStart posts the command body for the session', async () => {
    await startSession('mem-4');
    const calls = mockFetch(async () => jsonRes({ ok: true, execId: 'exec-9' }));
    const res = await api.vmExecStart('mem-4', 'nmap -sV 10.0.2.15', { cwd: '/home/kali' });
    assert.equal(res.execId, 'exec-9');
    assert.ok(calls[0].url.endsWith('/vm/exec/start'));
    const body = JSON.parse(calls[0].opts.body);
    assert.equal(body.sessionId, 'mem-4');
    assert.equal(body.command, 'nmap -sV 10.0.2.15');
    assert.equal(body.cwd, '/home/kali');
    assert.equal(calls[0].opts.headers.Authorization, `Bearer ${TOKEN}`);
    await api.stopVm('mem-4');
  });
});

describe('websocket URL builders', () => {
  const TOKEN = 'tok-ws-1';

  async function startSession(id) {
    mockFetch(async () => jsonRes({ ok: true, sessionToken: TOKEN, state: 'running' }));
    await api.startVm(id);
  }

  test('noVNC and terminal URLs carry sessionId + token', async () => {
    await startSession('ws-1');
    assert.equal(
      api.vncSocketUrl('ws-1'),
      'ws://127.0.0.1:4100/vm/vnc?sessionId=ws-1&token=tok-ws-1');
    assert.equal(
      api.terminalSocketUrl('ws-1'),
      'ws://127.0.0.1:4100/vm/terminal?sessionId=ws-1&token=tok-ws-1');
    await api.stopVm('ws-1');
  });

  test('token query param is omitted when the session has no token', () => {
    assert.equal(api.vncSocketUrl('ws-unknown'),
      'ws://127.0.0.1:4100/vm/vnc?sessionId=ws-unknown');
    assert.equal(api.terminalSocketUrl('ws-unknown'),
      'ws://127.0.0.1:4100/vm/terminal?sessionId=ws-unknown');
  });

  test('session ids are URL-encoded', () => {
    assert.equal(api.vncSocketUrl('a b/c'),
      'ws://127.0.0.1:4100/vm/vnc?sessionId=a+b%2Fc');
  });

  test('custom runner endpoint changes the WS host', async () => {
    ep.setVmEndpoint({ customUrl: 'http://192.168.1.20:4100' });
    await startSession('ws-2');
    assert.equal(api.vncSocketUrl('ws-2'),
      'ws://192.168.1.20:4100/vm/vnc?sessionId=ws-2&token=tok-ws-1');
    await api.stopVm('ws-2');
    ep.setVmEndpoint({ customUrl: '' });
  });

  test('runnerEndpointInfo mirrors the endpoint config', () => {
    assert.deepEqual(api.runnerEndpointInfo(), {
      mode: 'local',
      baseUrl: 'http://127.0.0.1:4100',
      wsUrl: 'ws://127.0.0.1:4100',
      cloudComingSoon: false,
      customUrl: '',
    });
  });
});

describe('error mapping', () => {
  test('HTTP JSON errors become VmRunnerError with the server code', async () => {
    const calls = mockFetch(async (url) => {
      assert.ok(!String(url).endsWith('/doctor'), '/doctor must not be consulted for HTTP errors');
      return jsonRes({ ok: false, code: 'bad_token', message: 'Session token expired' }, { status: 401 });
    });
    await assert.rejects(() => api.vmStatus('err-1'), (err) => {
      assert.ok(err instanceof api.VmRunnerError);
      assert.equal(err.code, 'bad_token');
      assert.match(err.message, /Session token expired/);
      return true;
    });
    assert.equal(calls.filter((c) => String(c.url).endsWith('/doctor')).length, 0);
  });

  test('non-JSON HTTP errors fall back to http_<status>', async () => {
    mockFetch(async () => ({
      ok: false,
      status: 500,
      headers: { get: () => 'text/plain' },
      json: async () => { throw new Error('no json'); },
    }));
    await assert.rejects(() => api.vmStatus('err-2'), (err) => {
      assert.ok(err instanceof api.VmRunnerError);
      assert.equal(err.code, 'http_500');
      return true;
    });
  });

  test('connection failure consults /doctor for the root cause', async () => {
    mockFetch(async (url) => {
      if (String(url).endsWith('/doctor')) {
        return jsonRes({ problems: ['QEMU not found on this PC', 'Kali image missing'] });
      }
      throw new Error('ECONNREFUSED');
    });
    await assert.rejects(() => api.vmHealth(), (err) => {
      assert.ok(err instanceof api.VmRunnerError);
      assert.equal(err.code, 'unreachable');
      assert.match(err.message, /Could not reach the Infinity VM Runner/);
      assert.match(err.message, /QEMU not found on this PC/);
      assert.match(err.hint, /Start Infinity VM Runner/);
      assert.deepEqual(err.doctor, { problems: ['QEMU not found on this PC', 'Kali image missing'] });
      return true;
    });
  });

  test('connection failure with no doctor yields a plain unreachable error', async () => {
    mockFetch(async () => { throw new Error('ECONNREFUSED'); });
    await assert.rejects(() => api.vmHealth(), (err) => {
      assert.ok(err instanceof api.VmRunnerError);
      assert.equal(err.code, 'unreachable');
      assert.equal(err.message, 'Could not reach the Infinity VM Runner on your PC.');
      assert.equal(err.doctor, null);
      return true;
    });
  });

  test('screenshot failure maps to VmRunnerError without a doctor call', async () => {
    const calls = mockFetch(async (url) => {
      assert.ok(String(url).endsWith('/vm/screenshot'));
      return { ok: false, status: 500, blob: async () => { throw new Error('unreachable'); } };
    });
    await assert.rejects(() => api.vmScreenshot('shot-1'), (err) => {
      assert.ok(err instanceof api.VmRunnerError);
      assert.equal(err.code, 'http_500');
      return true;
    });
    assert.equal(calls.length, 1);
  });

  test('screenshot success returns the image blob', async () => {
    mockFetch(async () => ({ ok: true, blob: async () => 'FAKE-JPEG-BYTES' }));
    const blob = await api.vmScreenshot('shot-2');
    assert.equal(blob, 'FAKE-JPEG-BYTES');
  });
});
