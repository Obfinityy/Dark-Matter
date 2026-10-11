/**
 * gradioApiKey.test.js — when a GradioProvider is constructed with an
 * apiKey, EVERY request carries `Authorization: Bearer <key>`; without one,
 * no Authorization header is sent. The key must never appear in logs or URLs.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const { GradioProvider } = await import('../src/agent/providers/gradioProvider.js');

const seen = []; // { url, headers }
const realFetch = globalThis.fetch;

function mockFetch(handler) {
  globalThis.fetch = async (url, opts = {}) => {
    seen.push({ url: String(url), headers: { ...(opts.headers || {}) } });
    return handler(String(url), opts);
  };
}

function okJson(payload) {
  return { ok: true, status: 200, json: async () => payload, text: async () => JSON.stringify(payload) };
}

function okText(text) {
  return { ok: true, status: 200, json: async () => { throw new Error('no json'); }, text: async () => text };
}

beforeEach(() => {
  seen.length = 0;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('GradioProvider apiKey', () => {
  test('healthCheck sends Authorization when apiKey is set', async () => {
    mockFetch(() => okJson({ mode: 'chat' }));
    const p = new GradioProvider({ baseUrl: 'https://brain.example.com', apiKey: 'aws-key-1' });
    const res = await p.healthCheck();
    assert.equal(res.reachable, true);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].headers.Authorization, 'Bearer aws-key-1');
    assert.ok(!seen[0].url.includes('aws-key-1'), 'key must not leak into the URL');
  });

  test('healthCheck sends no Authorization when no apiKey', async () => {
    mockFetch(() => okJson({ mode: 'chat' }));
    const p = new GradioProvider({ baseUrl: 'https://brain.example.com' });
    await p.healthCheck();
    assert.ok(!('Authorization' in seen[0].headers));
  });

  test('predict POST + poll GET both carry Authorization', async () => {
    mockFetch(url => {
      if (url.endsWith('/gradio_api/call/predict')) return okJson({ event_id: 'ev1' });
      return okText('event: complete\ndata: ["hello"]');
    });
    const p = new GradioProvider({ baseUrl: 'https://brain.example.com', apiKey: 'aws-key-2' });
    const reply = await p.chatOnce('hi');
    assert.equal(reply, 'hello');
    assert.ok(seen.length >= 2, 'expected POST + poll');
    for (const call of seen) {
      assert.equal(call.headers.Authorization, 'Bearer aws-key-2', `missing on ${call.url}`);
    }
  });

  test('legacy /gradio_api/api/chat fallback carries Authorization', async () => {
    mockFetch(url => {
      if (url.endsWith('/gradio_api/call/predict')) return { ok: false, status: 404, text: async () => 'nope' };
      if (url.endsWith('/gradio_api/api/chat')) return okJson({ data: ['legacy-reply', null] });
      return okText('');
    });
    const p = new GradioProvider({ baseUrl: 'https://brain.example.com', apiKey: 'aws-key-3' });
    const reply = await p.chatOnce('hi');
    assert.equal(reply, 'legacy-reply');
    const legacyCall = seen.find(c => c.url.endsWith('/gradio_api/api/chat'));
    assert.ok(legacyCall, 'legacy chat endpoint must have been hit');
    assert.equal(legacyCall.headers.Authorization, 'Bearer aws-key-3');
  });

  test('apiKey is never logged', async () => {
    const lines = [];
    const origLog = console.log;
    console.log = (...args) => lines.push(args.map(String).join(' '));
    try {
      mockFetch(url => {
        if (url.endsWith('/gradio_api/call/predict')) return { ok: false, status: 404, text: async () => 'nope' };
        return okJson({ data: ['ok', null] });
      });
      const p = new GradioProvider({ baseUrl: 'https://brain.example.com', apiKey: 'never-log-this-key' });
      await p.healthCheck();
      await p.chatOnce('ping');
    } finally {
      console.log = origLog;
    }
    assert.ok(!lines.join('\n').includes('never-log-this-key'), 'key leaked into logs');
  });
});
