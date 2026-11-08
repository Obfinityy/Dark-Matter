// Authenticated DOM render (CDP authenticated-DOM-render lane, 8 Nov 2026).
//
// renderDomAuthenticated starts a detached headless chromium with a
// remote-debugging port, drives it through the standalone CDP client,
// injects the lab session, and returns the rendered DOM. Docker and
// CDP are both stubbed here — unit tests must never spawn a real
// browser. The container command itself is proven live on EC2, not
// in this file.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderDomAuthenticated,
  buildCdpContainerRunArgs,
  buildCdpContainerPortArgs,
  buildCdpContainerRmArgs,
  parseDockerPortOutput,
  mergeAuthAnalysis,
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

// Fake docker runner: run -d starts a container, port publishes a
// loopback debug port, rm -f removes it. Records every call.
function makeRunner({ runOk = true } = {}) {
  const calls = [];
  const runner = async (file, args) => {
    calls.push({ file, args });
    if (args[0] === 'run') {
      if (!runOk) return { ok: false, code: 1, stdout: '', stderr: 'Cannot connect to the Docker daemon', timedOut: false };
      return { ok: true, code: 0, stdout: 'abc123def456\n', stderr: '', timedOut: false };
    }
    if (args[0] === 'port') return { ok: true, code: 0, stdout: '9222/tcp -> 127.0.0.1:49153\n', stderr: '', timedOut: false };
    if (args[0] === 'rm') return { ok: true, code: 0, stdout: 'abc123def456\n', stderr: '', timedOut: false };
    throw new Error(`unexpected docker call ${args.join(' ')}`);
  };
  return { runner, calls };
}

describe('container command builders (pure)', () => {
  test('AUTH-1: the detached-browser command publishes a random loopback debug port and overrides the entrypoint', () => {
    assert.deepEqual(buildCdpContainerRunArgs('img:test'), [
      'run',
      '-d',
      '--rm',
      '-p',
      '127.0.0.1:0:9222',
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
    assert.deepEqual(buildCdpContainerPortArgs('abc123'), ['port', 'abc123', '9222']);
    assert.deepEqual(buildCdpContainerRmArgs('abc123'), ['rm', '-f', 'abc123']);
  });

  test('AUTH-2: docker port output parses to the host port; garbage yields null', () => {
    assert.equal(parseDockerPortOutput('9222/tcp -> 127.0.0.1:49153\n'), 49153);
    assert.equal(parseDockerPortOutput('9222/tcp -> 0.0.0.0:9222'), 9222);
    assert.equal(parseDockerPortOutput(''), null);
    assert.equal(parseDockerPortOutput('no port here'), null);
    assert.equal(parseDockerPortOutput('9222/tcp -> 127.0.0.1:99999'), null);
  });
});

describe('renderDomAuthenticated (stubbed docker + CDP)', () => {
  test('AUTH-3: success — container starts, session injects before navigation, container is removed', async () => {
    const { runner, calls: dockerCalls } = makeRunner();
    const fakeClient = makeFakeCdp();
    const cdpConnect = async (endpoint) => {
      assert.match(endpoint, /^http:\/\/127\.0\.0\.1:49153$/);
      return { ok: true, client: fakeClient };
    };
    const r = await renderDomAuthenticated('http://172.17.0.1:3000/#/account', SESSION, {
      runner,
      cdpConnect,
      connectDelayMs: 0,
    });
    assert.equal(r.ok, true);
    assert.equal(r.html, '<html><body>authed</body></html>');
    // Docker lifecycle: run -d, port, rm -f — in that order.
    assert.deepEqual(
      dockerCalls.map((c) => c.args[0]),
      ['run', 'port', 'rm'],
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
    assert.deepEqual(calls.map((c) => c.args[0]), ['run', 'port', 'rm']);
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
    assert.deepEqual(calls.map((c) => c.args[0]), ['run', 'port', 'rm']);
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
