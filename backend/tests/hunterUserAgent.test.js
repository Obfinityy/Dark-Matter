/**
 * Regression test: bounty programs (e.g. YesWeHack) REQUIRE the hunter's
 * username appended to the User-Agent — without it the program's security
 * blocks the hunt's traffic. The hunt pipeline must thread a caller-supplied
 * `userAgent` from POST /hunts all the way to the recon HTTP requests.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { fetchPageHtml, understandPage } from '../src/hunt/humanRecon.js';

describe('hunter User-Agent threading', () => {
  it('fetchPageHtml uses the default browser UA when no override is given', async () => {
    let seenUa = null;
    const fetchFn = async (url, opts) => {
      seenUa = opts?.headers?.['User-Agent'];
      return {
        ok: true,
        headers: { get: () => 'text/html' },
        arrayBuffer: async () => new TextEncoder().encode('<html><body>hi</body></html>').buffer,
      };
    };
    await fetchPageHtml('https://example.test/', { fetchFn });
    assert.ok(seenUa && seenUa.includes('Chrome/'), `default UA kept, got: ${seenUa}`);
    assert.ok(!seenUa.includes('hunter'), 'no hunter tag in the default UA');
  });

  it('fetchPageHtml sends the caller-supplied hunter UA verbatim', async () => {
    let seenUa = null;
    const fetchFn = async (url, opts) => {
      seenUa = opts?.headers?.['User-Agent'];
      return {
        ok: true,
        headers: { get: () => 'text/html' },
        arrayBuffer: async () => new TextEncoder().encode('<html><body>hi</body></html>').buffer,
      };
    };
    const hunterUa =
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 hunter_username';
    await fetchPageHtml('https://example.test/', { fetchFn, userAgent: hunterUa });
    assert.equal(seenUa, hunterUa);
  });

  it('understandPage threads userAgent through to the fetch', async () => {
    let seenUa = null;
    const fetchFn = async (url, opts) => {
      seenUa = opts?.headers?.['User-Agent'];
      return {
        ok: true,
        headers: { get: () => 'text/html' },
        arrayBuffer: async () =>
          new TextEncoder().encode('<html><head><title>T</title></head><body>hello world</body></html>').buffer,
      };
    };
    await understandPage({ url: 'https://example.test/', fetchFn, userAgent: 'custom-hunter-ua/1.0' });
    assert.equal(seenUa, 'custom-hunter-ua/1.0');
  });
});
