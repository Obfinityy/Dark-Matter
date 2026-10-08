/**
 * Tests for the Dark Matter Engine one-click launcher
 * (backend/src/services/engineLauncher.js and
 *  backend/src/controllers/engineLauncherController.js).
 *
 * The launcher is what Step 0 on the Models page offers when the user's
 * local backend is not running: one download, run it, everything starts
 * automatically — no "start the backend yourself" dead end.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLauncher,
  LAUNCHER_FILES,
} from '../src/services/engineLauncher.js';
import {
  createEngineLauncherController,
  isLoopbackAddress,
  sanitizeSiteOrigin,
  DEFAULT_SITE,
} from '../src/controllers/engineLauncherController.js';

const SITE = 'https://hack.thebhavesh.online';

/** Minimal mock of an Express response object. */
function mockResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    set(h) { Object.assign(this.headers, h); return this; },
    json(obj) { this.body = obj; return this; },
    send(text) { this.body = text; return this; },
  };
  return res;
}

describe('buildLauncher — Windows batch', () => {
  const script = buildLauncher('windows', { site: SITE });

  it('replaces the __SITE__ placeholder with the real site', () => {
    assert.ok(!script.includes('__SITE__'), 'placeholder must be fully replaced');
    assert.ok(script.includes(`${SITE}/agent/models`));
  });

  it('drives the local backend on localhost:4000', () => {
    assert.ok(script.includes('http://localhost:4000/api/v1/health'));
    assert.ok(script.includes('node src/server.js'));
  });

  it('triggers the engine download via the loopback bootstrap endpoint', () => {
    assert.ok(script.includes('http://localhost:4000/api/v1/engine/bootstrap'));
  });

  it('fetches the backend from the public GitHub repo', () => {
    assert.ok(script.includes('codeload.github.com/Obfinityy/Dark-Matter'));
  });

  it('handles a missing Node.js with an automatic winget install', () => {
    assert.ok(script.includes('winget install'));
    assert.ok(script.includes('nodejs.org'));
  });

  it('has no unreplaced template markers', () => {
    assert.ok(!script.includes('${'), 'no JS template leftovers');
  });
});

describe('buildLauncher — macOS / Linux shell', () => {
  for (const os of ['macos', 'linux']) {
    const script = buildLauncher(os, { site: SITE });
    it(`${os}: starts with a sh shebang`, () => {
      assert.ok(script.startsWith('#!/bin/sh'));
    });
    it(`${os}: replaces __SITE__ and opens the Models page`, () => {
      assert.ok(!script.includes('__SITE__'));
      // POSIX script keeps the site in a SITE variable, then uses $SITE/...
      assert.ok(script.includes(`SITE="${SITE}"`));
      assert.ok(script.includes('$SITE/agent/models'));
    });
    it(`${os}: starts the backend in the background and bootstraps the engine`, () => {
      assert.ok(script.includes('nohup node src/server.js'));
      assert.ok(script.includes('http://localhost:4000/api/v1/engine/bootstrap'));
    });
    it(`${os}: has no JS template leftovers`, () => {
      assert.ok(!script.includes('${'));
      assert.ok(!script.includes('`'));
    });
  }
});

describe('LAUNCHER_FILES — download metadata', () => {
  it('covers windows, macos and linux with the right filenames', () => {
    assert.equal(LAUNCHER_FILES.windows.filename, 'dark-matter-engine.bat');
    assert.equal(LAUNCHER_FILES.macos.filename, 'dark-matter-engine.sh');
    assert.equal(LAUNCHER_FILES.linux.filename, 'dark-matter-engine.sh');
  });
});

describe('isLoopbackAddress', () => {
  it('accepts IPv4 and IPv6 loopback forms', () => {
    assert.equal(isLoopbackAddress('127.0.0.1'), true);
    assert.equal(isLoopbackAddress('::1'), true);
    assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true);
    assert.equal(isLoopbackAddress('127.0.0.2'), true);
  });
  it('rejects non-loopback addresses', () => {
    assert.equal(isLoopbackAddress('192.168.1.5'), false);
    assert.equal(isLoopbackAddress('8.8.8.8'), false);
    assert.equal(isLoopbackAddress('10.0.0.1'), false);
  });
  it('rejects missing/empty values', () => {
    assert.equal(isLoopbackAddress(null), false);
    assert.equal(isLoopbackAddress(undefined), false);
    assert.equal(isLoopbackAddress(''), false);
  });
});

describe('sanitizeSiteOrigin', () => {
  it('accepts plain http/https origins', () => {
    assert.equal(sanitizeSiteOrigin('https://hack.thebhavesh.online'), 'https://hack.thebhavesh.online');
    assert.equal(sanitizeSiteOrigin('http://localhost:5173'), 'http://localhost:5173');
  });
  it('rejects paths, queries and javascript: URLs (injection safety)', () => {
    assert.equal(sanitizeSiteOrigin('https://x.com/evil'), null);
    assert.equal(sanitizeSiteOrigin('https://x.com/?a=1'), null);
    assert.equal(sanitizeSiteOrigin('javascript:alert(1)'), null);
    assert.equal(sanitizeSiteOrigin('https://x.com"; rm -rf ~'), null);
  });
  it('rejects non-strings', () => {
    assert.equal(sanitizeSiteOrigin(null), null);
    assert.equal(sanitizeSiteOrigin(undefined), null);
  });
});

describe('engineLauncherController.launcher', () => {
  const controller = createEngineLauncherController({ modelRunnerService: {} });

  it('serves the Windows batch as an attachment', () => {
    const res = mockResponse();
    controller.launcher({ query: { os: 'windows', site: SITE } }, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['Content-Disposition'], /attachment; filename="dark-matter-engine\.bat"/);
    assert.ok(res.body.includes(`${SITE}/agent/models`));
  });

  it('serves the macOS shell script', () => {
    const res = mockResponse();
    controller.launcher({ query: { os: 'macos', site: SITE } }, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['Content-Disposition'], /dark-matter-engine\.sh/);
    assert.ok(res.body.startsWith('#!/bin/sh'));
  });

  it('falls back to the default site when the param is missing/invalid', () => {
    const res = mockResponse();
    controller.launcher({ query: { os: 'linux', site: 'javascript:alert(1)' } }, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.includes(DEFAULT_SITE));
  });

  it('rejects an unknown os with 400', () => {
    const res = mockResponse();
    controller.launcher({ query: { os: 'amiga', site: SITE } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'UNKNOWN_OS');
  });
});

describe('engineLauncherController.bootstrap', () => {
  it('rejects non-loopback callers with 403', async () => {
    let serviceCalled = false;
    const controller = createEngineLauncherController({
      modelRunnerService: {
        getDevice: async () => { serviceCalled = true; return {}; },
        engine: { startEngineDownload: () => ({ ready: false, started: true }) },
      },
    });
    const res = mockResponse();
    await controller.bootstrap({ socket: { remoteAddress: '203.0.113.7' } }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
    assert.equal(serviceCalled, false);
  });

  it('starts the engine download for loopback callers (202)', async () => {
    const controller = createEngineLauncherController({
      modelRunnerService: {
        getDevice: async () => ({ hasNvidia: false }),
        engine: { startEngineDownload: () => ({ ready: false, started: true }) },
      },
    });
    const res = mockResponse();
    await controller.bootstrap({ socket: { remoteAddress: '127.0.0.1' } }, res);
    assert.equal(res.statusCode, 202);
    assert.equal(res.body.started, true);
  });

  it('returns 200 when the engine is already downloaded', async () => {
    const controller = createEngineLauncherController({
      modelRunnerService: {
        getDevice: async () => ({}),
        engine: { startEngineDownload: () => ({ ready: true, cached: true }) },
      },
    });
    const res = mockResponse();
    await controller.bootstrap({ socket: { remoteAddress: '::1' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ready, true);
  });
});
