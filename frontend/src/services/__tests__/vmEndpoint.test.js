/**
 * vmEndpoint.test.js — Infinity AI VM endpoint configuration.
 *
 * Covers: getVmEndpoint defaults, setVmEndpoint persistence (mode + custom
 * URL only — never tokens), local vs custom URL construction, http→ws /
 * https→wss derivation, corrupt-storage resilience, isVmConnectable.
 *
 * Pure logic only: localStorage is mocked in-memory. No VM, no network.
 * Run: node --test frontend/src/services/__tests__/vmEndpoint.test.js
 * (from the repo root)
 */
import { test, describe, beforeEach } from 'node:test';
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

// Dynamic import: guarantees the storage mock is installed before the
// module is evaluated.
const { getVmEndpoint, setVmEndpoint, isVmConnectable, STORAGE_KEY } =
  await import('../vmEndpoint.js');

beforeEach(() => storage.clear());

describe('defaults', () => {
  test('STORAGE_KEY is dm.vmEndpoint', () => {
    assert.equal(STORAGE_KEY, 'dm.vmEndpoint');
  });

  test('fresh install resolves to the local runner', () => {
    assert.deepEqual(getVmEndpoint(), {
      mode: 'local',
      baseUrl: 'http://127.0.0.1:4100',
      wsUrl: 'ws://127.0.0.1:4100',
      cloudComingSoon: false,
      customUrl: '',
    });
  });

  test('local mode is connectable', () => {
    assert.equal(isVmConnectable(), true);
  });
});

describe('setVmEndpoint persistence', () => {
  test('cloud mode persists and is not connectable', () => {
    const cfg = setVmEndpoint({ mode: 'cloud' });
    assert.equal(cfg.mode, 'cloud');
    assert.equal(cfg.cloudComingSoon, true);
    assert.equal(isVmConnectable(), false);
    // Cloud is not live: the runner address stays the local default.
    assert.equal(cfg.baseUrl, 'http://127.0.0.1:4100');
    const stored = JSON.parse(storage.getItem(STORAGE_KEY));
    assert.deepEqual(stored, { mode: 'cloud', customUrl: '' });
  });

  test('unknown modes are coerced to local', () => {
    assert.equal(setVmEndpoint({ mode: 'prod' }).mode, 'local');
    assert.equal(setVmEndpoint({ mode: '' }).mode, 'local');
    assert.equal(isVmConnectable(), true);
  });

  test('custom URL overrides the local runner address', () => {
    const cfg = setVmEndpoint({ customUrl: '192.168.1.10:4100' });
    assert.equal(cfg.baseUrl, 'http://192.168.1.10:4100');
    assert.equal(cfg.wsUrl, 'ws://192.168.1.10:4100');
    assert.equal(cfg.customUrl, 'http://192.168.1.10:4100');
    assert.equal(cfg.mode, 'local');
    assert.equal(isVmConnectable(), true);
  });

  test('https custom URL derives a wss websocket URL', () => {
    const cfg = setVmEndpoint({ customUrl: 'https://runner.example.com/' });
    assert.equal(cfg.baseUrl, 'https://runner.example.com');
    assert.equal(cfg.wsUrl, 'wss://runner.example.com');
  });

  test('URL paths and trailing slashes are stripped', () => {
    const cfg = setVmEndpoint({ customUrl: 'http://host:4100/some/path/' });
    assert.equal(cfg.baseUrl, 'http://host:4100');
    assert.equal(cfg.wsUrl, 'ws://host:4100');
  });

  test('empty or blank custom URL falls back to the default runner', () => {
    setVmEndpoint({ customUrl: 'http://10.0.0.5:4100' });
    const cfg = setVmEndpoint({ customUrl: '   ' });
    assert.equal(cfg.baseUrl, 'http://127.0.0.1:4100');
    assert.equal(cfg.customUrl, '');
  });

  test('unparseable custom URL falls back without throwing', () => {
    const cfg = setVmEndpoint({ customUrl: 'http://[::1' });
    assert.equal(cfg.baseUrl, 'http://127.0.0.1:4100');
    assert.equal(cfg.customUrl, '');
  });

  test('partial patches merge with previously stored values', () => {
    setVmEndpoint({ mode: 'cloud' });
    const cfg = setVmEndpoint({ customUrl: 'http://10.9.9.9:4100' });
    assert.equal(cfg.mode, 'cloud');
    assert.equal(cfg.customUrl, 'http://10.9.9.9:4100');
    assert.equal(isVmConnectable(), false);
  });

  test('setVmEndpoint returns the full resolved config', () => {
    const cfg = setVmEndpoint({ mode: 'local', customUrl: '' });
    assert.deepEqual(Object.keys(cfg).sort(),
      ['baseUrl', 'cloudComingSoon', 'customUrl', 'mode', 'wsUrl']);
  });

  test('tokens are never persisted to storage', () => {
    setVmEndpoint({ mode: 'local', customUrl: '', token: 'sekret', sessionToken: 'abc' });
    const raw = storage.getItem(STORAGE_KEY);
    assert.ok(raw && !raw.includes('sekret') && !raw.includes('abc'),
      'storage must not contain tokens');
    const stored = JSON.parse(raw);
    assert.deepEqual(Object.keys(stored).sort(), ['customUrl', 'mode']);
  });
});

describe('corrupt storage resilience', () => {
  test('invalid JSON falls back to defaults', () => {
    storage.setItem(STORAGE_KEY, 'not json {{{');
    assert.equal(getVmEndpoint().baseUrl, 'http://127.0.0.1:4100');
    assert.equal(getVmEndpoint().mode, 'local');
  });

  test('non-object JSON falls back to defaults', () => {
    for (const raw of ['"just a string"', '42', '[1,2,3]', 'null']) {
      storage.setItem(STORAGE_KEY, raw);
      assert.equal(getVmEndpoint().mode, 'local', `raw=${raw}`);
    }
  });

  test('storage errors are swallowed (private-mode browsers)', () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    };
    const prev = globalThis.localStorage;
    globalThis.localStorage = broken;
    try {
      assert.equal(getVmEndpoint().mode, 'local');
      assert.equal(setVmEndpoint({ mode: 'cloud' }).mode, 'local');
    } finally {
      globalThis.localStorage = prev;
    }
  });
});
