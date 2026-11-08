// Authenticated DOM render (CDP authenticated-DOM-render lane, 8 Nov 2026;
// host-network repair lane, 8 Nov 2026).
//
// renderDomAuthenticated starts a detached headless chromium with a
// remote-debugging port, drives it through the standalone CDP client,
// injects the lab session, and returns the rendered DOM. Docker and
// CDP are both stubbed here — unit tests must never spawn a real
// browser. The container command itself is proven live on EC2, not
// in this file: --network host, fixed http://127.0.0.1:9222. There
// is NO `docker port` call anywhere in the production path (the
// bridge-gateway repair parsed `docker port <id> 9222` output from
// an assumed shape and failed on every live run — see
// authDomRender.js header), so the fake runner below throws on a
// 'port' call: any test that triggers one fails loudly.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderDomAuthenticated,
  buildCdpContainerRunArgs,
  buildCdpContainerRmArgs,
  mergeAuthAnalysis,
  AUTH_RENDER_DEBUG_HOST,
  AUTH_RENDER_DEBUG_ENDPOINT,
  AUTH_RENDER_CDP_PORT,
} from './authDomRender.js';
import { DOM_RENDER_IMAGE } from './domRender.js';

const SESSION = {
  token: 'jwt-test-123',
  cookies: [{ name: 'PHPSESSID', value: 'sess-1', domain: '172.17.0.1', path: '/' }],
};

// Fake CDP client: records every call, answers from a script.
function makeFakeCdp({ navigateThrows = false } = {}) {
  const calls = [];
  const client = {
    calls,
    async newTarget(url) {
      calls.push({ method: 'newTarget', url });
      return { id: 'T1', webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/T1' };
    },
    async attach(wsUrl) {
      calls.push({ method: 'attach', wsUrl });
      return true;
    },
    async send(method, params) {
      calls.push({ method, params });
      return {};
    },
    async setCookie(cookie) {
      calls.push({ method: 'setCookie', cookie });
      return { success: true };
    },
    async addInitScript(source) {
      calls.push({ method: 'addInitScript', source });
      return { identifier: '1' };
    },
    async navigate(url) {
      calls.push({ method: 'navigate', url });
      if (navigateThrows) throw new Error('navigation failed');
      return true;
    },
    async outerHTML() {
      calls.push({ method: 'outerHTML' });
      return '<html><body>authed</body></html>';
    },
    async close() {
      calls.push({ method: 'close' });
      return true;
    },
  };
  return client;
}

// Fake docker runner: run -d starts a container, rm -f removes it.
// Records every call. There is deliberately NO 'port' branch: the
// production path never calls `docker port`, so a runner that
// answers one would hide a regression — an unexpected call throws.
function makeRunner({ runOk = true } = {}) {
  const calls = [];
  const runner = async (file, args) => {
    calls.push({ file, args });
    if (args[0] === 'run') {
      if (!runOk) return { ok: false, code: 1, stdout: '', stderr: 'Cannot connect to the Docker daemon', timedOut: false };
      return { ok: true, code: 0, stdout: 'abc123def456\n', stderr: '', timedOut: false };
    }
    if (args[0] === 'rm') return { ok: true, code: 0, stdout: 'abc123def456\n', stderr: '', timedOut: false };
    throw new Error(`unexpected docker call ${args.join(' ')}`);
  };
  return { runner, calls };
}

describe('container command builders (pure)', () => {
  test('AUTH-1: the detached-browser command shares the host network and overrides the entrypoint — nothing is published', () => {
    assert.deepEqual(buildCdpContainerRunArgs('img:test'), [
      'run',
      '-d',
      '--rm',
      '--network',
      'host',
      '--entrypoint',
      'chromium',
      'img:test',
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--remote-debugging-port=9222',
      '--remote-debugging-address=0.0.0.0',
      'about:blank',
    ]);
    assert.ok(buildCdpContainerRunArgs().includes(DOM_RENDER_IMAGE));
    assert.ok(!buildCdpContainerRunArgs('img:test').includes('-p'), 'no port is ever published');
    assert.deepEqual(buildCdpContainerRmArgs('abc123'), ['rm', '-f', 'abc123']);
  });

  test('AUTH-2: the CDP endpoint is the fixed host loopback — never parsed from docker output', () => {
    assert.equal(AUTH_RENDER_CDP_PORT, 9222);
    assert.equal(AUTH_RENDER_DEBUG_HOST, '127.0.0.1');
    assert.equal(AUTH_RENDER_DEBUG_ENDPOINT, 'http://127.0.0.1:9222');
  });
});

describe('renderDomAuthenticated (stubbed docker + CDP)', () => {
  test('AUTH-3: success — container starts, session injects before navigation, container is removed', async () => {
    const { runner, calls: dockerCalls } = makeRunner();
    const fakeClient = makeFakeCdp();
    const cdpConnect = async (endpoint) => {
      assert.match(endpoint, /^http:\/\/127\.0\.0\.1:9222$/);
      return { ok: true, client: fakeClient };
    };
    const r = await renderDomAuthenticated('http://172.17.0.1:3000/#/account', SESSION, {
      runner,
      cdpConnect,
      connectDelayMs: 0,
    });
    assert.equal(r.ok, true);
    assert.equal(r.html, '<html><body>authed</body></html>');
    // Docker lifecycle: run -d, rm -f — in that order. No `docker
    // port` call exists in the production path anymore.
    assert.deepEqual(
      dockerCalls.map((c) => c.args[0]),
      ['run', 'rm'],
    );
    assert.equal(dockerCalls[0].args[1], '-d');
    // Session injection precedes navigation: the cookie and the
    // token init-script are both in place before Page.navigate.
    const methods = fakeClient.calls.map((c) => c.method);
    assert.ok(methods.indexOf('setCookie') < methods.indexOf('navigate'), 'cookie must be set before navigation');
    assert.ok(methods.indexOf('addInitScript') < methods.indexOf('navigate'), 'token script must be set before navigation');
    const cookieCall = fakeClient.calls.find((c) => c.method === 'setCookie');
    assert.equal(cookieCall.cookie.name, 'PHPSESSID');
    assert.equal(cookieCall.cookie.value, 'sess-1');
    const scriptCall = fakeClient.calls.find((c) => c.method === 'addInitScript');
    assert.ok(scriptCall.source.includes('jwt-test-123'), 'the token must reach localStorage');
    assert.ok(scriptCall.source.includes("localStorage.setItem('token'"));
    const navCall = fakeClient.calls.find((c) => c.method === 'navigate');
    assert.equal(navCall.url, 'http://172.17.0.1:3000/#/account');
    assert.ok(methods.includes('close'), 'the client must be closed');
  });

  test('AUTH-4: no session (or an empty one) is refused before any docker call', async () => {
    const { runner, calls } = makeRunner();
    const neverCdp = async () => { throw new Error('cdp must not run without a session'); };
    for (const bad of [null, undefined, {}, { token: null, cookies: [] }, { token: '', cookies: [] }]) {
      const r = await renderDomAuthenticated('http://example.com/', bad, { runner, cdpConnect: neverCdp });
      assert.equal(r.ok, false);
      assert.match(r.error, /no session/);
    }
    assert.equal(calls.length, 0, 'docker must never start without a session');
  });

  test('AUTH-5: a failed container start fails honestly and removes nothing (no container exists)', async () => {
    const { runner, calls } = makeRunner({ runOk: false });
    const fakeClient = makeFakeCdp();
    const r = await renderDomAuthenticated('http://example.com/', SESSION, {
      runner,
      cdpConnect: async () => ({ ok: true, client: fakeClient }),
    });
    assert.equal(r.ok, false);
    assert.match(r.error, /Docker daemon/);
    assert.deepEqual(calls.map((c) => c.args[0]), ['run']);
    assert.equal(fakeClient.calls.length, 0, 'CDP must never run when the container failed to start');
  });

  test('AUTH-6: an unreachable CDP endpoint fails honestly AND the container is still removed', async () => {
    const { runner, calls } = makeRunner();
    let connects = 0;
    const r = await renderDomAuthenticated('http://example.com/', SESSION, {
      runner,
      cdpConnect: async () => {
        connects += 1;
        return { ok: false, error: 'connection refused' };
      },
      connectAttempts: 3,
      connectDelayMs: 0,
    });
    assert.equal(r.ok, false);
    assert.match(r.error, /connection refused/);
    assert.equal(connects, 3, 'the connect must be retried, bounded');
    assert.deepEqual(calls.map((c) => c.args[0]), ['run', 'rm']);
  });

  test('AUTH-7: a navigation failure fails honestly and still removes the container', async () => {
    const { runner, calls } = makeRunner();
    const fakeClient = makeFakeCdp({ navigateThrows: true });
    const r = await renderDomAuthenticated('http://example.com/', SESSION, {
      runner,
      cdpConnect: async () => ({ ok: true, client: fakeClient }),
      connectDelayMs: 0,
    });
    assert.equal(r.ok, false);
    assert.match(r.error, /navigation failed/);
    assert.deepEqual(calls.map((c) => c.args[0]), ['run', 'rm']);
  });
});

describe('host-network connect target (8 Nov 2026 host-network repair lane)', () => {
  test('AUTH-9: the builder shares the host network and never publishes a port — no loopback or gateway publish exists to get wrong', () => {
    assert.equal(AUTH_RENDER_DEBUG_HOST, '127.0.0.1');
    const args = buildCdpContainerRunArgs('img:test');
    assert.deepEqual(args.slice(args.indexOf('--network'), args.indexOf('--network') + 2), ['--network', 'host']);
    assert.ok(!args.includes('-p'), 'the run args must contain no -p publish');
    assert.ok(!args.join(' ').includes('172.17.0.1'), 'no bridge-gateway publish remains');
    // The builder takes the image only now: a stale second
    // positional arg (the old publishHost) changes nothing.
    assert.deepEqual(
      buildCdpContainerRunArgs('img:test', '172.17.0.1'),
      buildCdpContainerRunArgs('img:test'),
    );
  });

  test('AUTH-10: the production path never calls `docker port` — the endpoint is fixed, not parsed', async () => {
    // The fake runner throws on a 'port' call, so reaching success
    // here proves the render never asks docker for a port. This
    // pins the proof-#14 root cause: `docker port <id> 9222`
    // prints the BARE form `172.17.0.1:32769`, which the old
    // parser (requiring `9222/tcp -> ...`) rejected on every run.
    const { runner, calls: dockerCalls } = makeRunner();
    const fakeClient = makeFakeCdp();
    let seenEndpoint = null;
    const cdpConnect = async (endpoint) => {
      seenEndpoint = endpoint;
      return { ok: true, client: fakeClient };
    };
    const r = await renderDomAuthenticated('http://172.17.0.1:3000/', SESSION, {
      runner,
      cdpConnect,
      connectDelayMs: 0,
    });
    assert.equal(r.ok, true);
    assert.equal(seenEndpoint, 'http://127.0.0.1:9222', 'the endpoint must be the fixed host loopback');
    assert.deepEqual(dockerCalls.map((c) => c.args[0]), ['run', 'rm']);
  });

  test('AUTH-11: the removed publishHost seam cannot resurrect the old path — it is ignored', async () => {
    const { runner, calls: dockerCalls } = makeRunner();
    const fakeClient = makeFakeCdp();
    let seenEndpoint = null;
    const r = await renderDomAuthenticated('http://example.com/', SESSION, {
      runner,
      cdpConnect: async (endpoint) => {
        seenEndpoint = endpoint;
        return { ok: true, client: fakeClient };
      },
      publishHost: '172.17.0.1',
      connectDelayMs: 0,
    });
    assert.equal(r.ok, true);
    assert.equal(seenEndpoint, 'http://127.0.0.1:9222');
    assert.ok(!dockerCalls[0].args.includes('-p'), 'a stale publishHost must not re-add a publish');
    assert.deepEqual(dockerCalls.map((c) => c.args[0]), ['run', 'rm']);
  });
});

describe('mergeAuthAnalysis (dedupe merge, pure)', () => {
  test('AUTH-8: only what login reveals is added — duplicates by name+form+page are skipped', () => {
    const base = {
      forms: [{ action: '/login', method: 'post', inputs: [] }],
      inputs: [{ name: 'email', type: 'text', form: null, page: 'http://x/#/login' }],
      textareas: [],
      selects: [],
      buttons: [{ label: 'Login', page: 'http://x/#/login' }],
      params: ['email'],
    };
    const auth = {
      forms: [
        { action: '/login', method: 'post', inputs: [] },
        { action: '/basket', method: 'post', inputs: [] },
      ],
      inputs: [
        { name: 'email', type: 'text', form: null, page: 'http://x/#/login' },
        { name: 'account', type: 'text', form: null, page: 'http://x/' },
      ],
      textareas: [{ name: 'notes', form: null, page: 'http://x/' }],
      selects: [],
      buttons: [{ label: 'Login', page: 'http://x/#/login' }, { label: 'Checkout', page: 'http://x/' }],
      params: ['email', 'account'],
    };
    const added = mergeAuthAnalysis(base, auth);
    assert.equal(added.forms.length, 1);
    assert.equal(added.forms[0].action, '/basket');
    assert.equal(added.inputs.length, 1);
    assert.equal(added.inputs[0].name, 'account');
    assert.equal(added.textareas.length, 1);
    assert.equal(added.buttons.length, 1);
    assert.equal(added.buttons[0].label, 'Checkout');
    assert.equal(base.inputs.length, 2);
    assert.deepEqual(base.params, ['email', 'account']);
    assert.deepEqual(mergeAuthAnalysis(null, auth), { forms: [], inputs: [], textareas: [], selects: [], buttons: [] });
  });
});
