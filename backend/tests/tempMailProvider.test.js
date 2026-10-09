/**
 * Tests for tempMailProvider.js (disposable email for hunter test accounts).
 * Network is fully mocked — no real calls to mail.tm.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createAccount,
  listMessages,
  getMessage,
  extractVerificationCode,
  extractLinks,
  waitForMessage,
} from '../src/engines/tempMailProvider.js';

function mockFetch(handler) {
  return async (url, init) => handler(url, init);
}

function jsonResponse(obj, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => obj,
    text: async () => JSON.stringify(obj),
  };
}

describe('tempMailProvider.createAccount', () => {
  it('creates account and returns address + token', async () => {
    const calls = [];
    const fetchImpl = mockFetch((url, init) => {
      calls.push(url);
      if (url.endsWith('/accounts')) return jsonResponse({ address: 'hunter1@maxxspace.com' });
      if (url.endsWith('/token')) return jsonResponse({ token: 'jwt-abc' });
      throw new Error('unexpected url ' + url);
    });
    const res = await createAccount({ address: 'hunter1@maxxspace.com', password: 'x' }, fetchImpl);
    assert.equal(res.address, 'hunter1@maxxspace.com');
    assert.equal(res.token, 'jwt-abc');
    assert.equal(calls.length, 2);
  });

  it('generates a random address when none given', async () => {
    const fetchImpl = mockFetch((url) => {
      if (url.endsWith('/accounts')) return jsonResponse({ address: 'x' });
      return jsonResponse({ token: 't' });
    });
    const res = await createAccount({}, fetchImpl);
    assert.match(res.address, /^hunter.+@maxxspace\.com$/);
    assert.equal(res.token, 't');
  });

  it('throws a clear error when account creation fails', async () => {
    const fetchImpl = mockFetch(() => jsonResponse({ message: 'bad' }, false, 400));
    await assert.rejects(
      () => createAccount({ address: 'a@b.c', password: 'x' }, fetchImpl),
      /account creation failed.*HTTP 400/
    );
  });

  it('throws a clear error when token is missing', async () => {
    const fetchImpl = mockFetch((url) => {
      if (url.endsWith('/accounts')) return jsonResponse({ address: 'x' });
      return jsonResponse({}); // no token field
    });
    await assert.rejects(
      () => createAccount({ address: 'a@b.c', password: 'x' }, fetchImpl),
      /missing token/
    );
  });

  it('throws a clear error on network failure', async () => {
    const fetchImpl = mockFetch(() => {
      throw new Error('boom');
    });
    await assert.rejects(
      () => createAccount({ address: 'a@b.c', password: 'x' }, fetchImpl),
      /network/
    );
  });
});

describe('tempMailProvider.listMessages', () => {
  it('maps hydra:member to a clean array', async () => {
    const fetchImpl = mockFetch(() =>
      jsonResponse({
        'hydra:member': [
          {
            id: 'm1',
            from: { address: 'noreply@vfs.test' },
            subject: 'Verify your account',
            intro: 'Your code is 482910',
            createdAt: '2026-10-09T00:00:00Z',
          },
        ],
      })
    );
    const msgs = await listMessages({ token: 't' }, fetchImpl);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].id, 'm1');
    assert.equal(msgs[0].from, 'noreply@vfs.test');
    assert.equal(msgs[0].subject, 'Verify your account');
  });

  it('requires a token', async () => {
    await assert.rejects(() => listMessages({}, mockFetch(() => jsonResponse({}))), /needs a token/);
  });
});

describe('tempMailProvider.getMessage', () => {
  it('returns subject, text and html', async () => {
    const fetchImpl = mockFetch(() =>
      jsonResponse({ subject: 'Hi', text: ['line1', 'line2'], html: ['<b>x</b>'] })
    );
    const m = await getMessage({ token: 't', id: 'm1' }, fetchImpl);
    assert.equal(m.text, 'line1\nline2');
    assert.equal(m.html, '<b>x</b>');
  });

  it('requires token and id', async () => {
    await assert.rejects(() => getMessage({ token: 't' }, mockFetch(() => jsonResponse({}))), /needs an id/);
  });
});

describe('tempMailProvider.extractVerificationCode', () => {
  it('finds 4-8 digit codes', () => {
    assert.equal(extractVerificationCode('Your code is 482910'), '482910');
    assert.equal(extractVerificationCode('code: 1234.'), '1234');
    assert.equal(extractVerificationCode('OTP 98765432 expires soon'), '98765432');
  });

  it('returns null when no code', () => {
    assert.equal(extractVerificationCode('no digits here'), null);
    assert.equal(extractVerificationCode(''), null);
    assert.equal(extractVerificationCode(null), null);
  });

  it('ignores long numbers', () => {
    assert.equal(extractVerificationCode('ref 1234567890123'), null);
  });
});

describe('tempMailProvider.extractLinks', () => {
  it('extracts unique http(s) links', () => {
    const html = 'go <a href="https://a.test/x">a</a> and https://a.test/x and http://b.test/y.';
    const links = extractLinks(html);
    assert.deepEqual(links, ['https://a.test/x', 'http://b.test/y']);
  });

  it('filters by domain substring', () => {
    const html = 'https://vfs.test/verify https://other.test/z';
    assert.deepEqual(extractLinks(html, { domain: 'vfs.test' }), ['https://vfs.test/verify']);
  });

  it('returns [] for empty input', () => {
    assert.deepEqual(extractLinks(''), []);
  });
});

describe('tempMailProvider.waitForMessage', () => {
  it('returns the first message matching the predicate', async () => {
    let calls = 0;
    const pollFn = async () => {
      calls += 1;
      return calls < 3 ? [] : [{ id: 'm9', subject: 'Verify' }];
    };
    const msg = await waitForMessage({
      token: 't',
      pollFn,
      timeoutMs: 5000,
      intervalMs: 5,
      predicate: (m) => m.subject.includes('Verify'),
    });
    assert.equal(msg.id, 'm9');
    assert.ok(calls >= 3);
  });

  it('returns null on timeout', async () => {
    const msg = await waitForMessage({
      token: 't',
      pollFn: async () => [],
      timeoutMs: 30,
      intervalMs: 10,
    });
    assert.equal(msg, null);
  });
});
