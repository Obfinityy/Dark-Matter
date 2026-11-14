// Tests for the in-process OOB collaborator — the $0 listener that proves
// blind out-of-band resolution (SAML-XXE OOB). All servers bind loopback
// only; no external service, no lab needed.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createOobCollaborator } from './oobCollaborator.js';

function loopbackCollab() {
  return createOobCollaborator({ listenHost: '127.0.0.1', callbackHost: '127.0.0.1' });
}

describe('oobCollaborator', () => {
  it('starts on an ephemeral loopback port and urlFor builds the token URL', async () => {
    const collab = loopbackCollab();
    try {
      const base = await collab.start();
      assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(base), `bad baseUrl: ${base}`);
      assert.equal(collab.urlFor('tok-abc'), `${base}/tok-abc`);
      assert.equal(collab.baseUrl(), base);
      // urlFor before start returns null.
      const fresh = loopbackCollab();
      assert.equal(fresh.urlFor('x'), null);
      assert.equal(fresh.baseUrl(), null);
    } finally {
      await collab.stop();
    }
  });

  it('POSITIVE: a fetch of the token URL resolves waitFor with the hit record', async () => {
    const collab = loopbackCollab();
    try {
      const base = await collab.start();
      const waiting = collab.waitFor('tok-hit', 3000);
      const res = await fetch(`${base}/tok-hit`);
      assert.equal(res.status, 200);
      const hit = await waiting;
      assert.ok(hit, 'waitFor should resolve a hit');
      assert.equal(hit.token, 'tok-hit');
      assert.equal(hit.method, 'GET');
      assert.equal(hit.path, '/tok-hit');
      assert.ok(hit.at, 'hit must carry a timestamp');
      assert.equal(collab.hasHit('tok-hit')?.token, 'tok-hit');
      assert.equal(collab.hits.length, 1);
      // The answer is a well-formed DTD fragment for a parser fetching an
      // external parameter entity.
      const body = await res.text();
      assert.ok(body.includes('<!ENTITY dm-oob-hit'), `unexpected body: ${body}`);
    } finally {
      await collab.stop();
    }
  });

  it('waitFor resolves immediately when the hit already arrived', async () => {
    const collab = loopbackCollab();
    try {
      const base = await collab.start();
      await fetch(`${base}/tok-early`);
      const hit = await collab.waitFor('tok-early', 500);
      assert.ok(hit, 'already-arrived hit must resolve at once');
      assert.equal(hit.token, 'tok-early');
    } finally {
      await collab.stop();
    }
  });

  it('NEGATIVE: waitFor resolves null on timeout when nothing calls back', async () => {
    const collab = loopbackCollab();
    try {
      await collab.start();
      const hit = await collab.waitFor('tok-never', 300);
      assert.equal(hit, null);
      assert.equal(collab.hasHit('tok-never'), null);
      assert.equal(collab.hits.length, 0);
    } finally {
      await collab.stop();
    }
  });

  it('two concurrent waiters for the same token both resolve on one hit', async () => {
    const collab = loopbackCollab();
    try {
      const base = await collab.start();
      const w1 = collab.waitFor('tok-shared', 3000);
      const w2 = collab.waitFor('tok-shared', 3000);
      await fetch(`${base}/tok-shared`);
      const [h1, h2] = await Promise.all([w1, w2]);
      assert.ok(h1 && h2, 'both waiters must resolve');
      assert.equal(h1.token, 'tok-shared');
      assert.equal(h2.token, 'tok-shared');
      assert.equal(collab.hits.length, 1, 'one request = one hit');
    } finally {
      await collab.stop();
    }
  });

  it('records hits for arbitrary paths (token = first path segment)', async () => {
    const collab = loopbackCollab();
    try {
      const base = await collab.start();
      await fetch(`${base}/some-token/extra?x=1`);
      const hit = collab.hasHit('some-token');
      assert.ok(hit, 'hit must be recorded under the first segment');
      assert.equal(hit.path, '/some-token/extra');
    } finally {
      await collab.stop();
    }
  });

  it('stop() resolves pending waiters with null and closes the listener', async () => {
    const collab = loopbackCollab();
    const base = await collab.start();
    const waiting = collab.waitFor('tok-pending', 10000);
    await collab.stop();
    assert.equal(await waiting, null);
    // Listener closed: a new fetch must fail.
    await assert.rejects(fetch(`${base}/tok-pending`));
    // waitFor after stop resolves null at once.
    assert.equal(await collab.waitFor('tok-late', 5000), null);
  });

  it('redir path 302s to the decoded target and records the hit', async () => {
    const collab = loopbackCollab();
    try {
      const base = await collab.start();
      const target = 'http://127.0.0.1:9/latest/meta-data/';
      const res = await fetch(`${base}/redir/${encodeURIComponent(target)}`, { redirect: 'manual' });
      assert.equal(res.status, 302);
      assert.equal(res.headers.get('location'), target);
      const hit = collab.hasHit('redir');
      assert.ok(hit, 'the redirect must still be recorded');
      assert.equal(hit.path, `/redir/${encodeURIComponent(target)}`);
    } finally {
      await collab.stop();
    }
  });

  it('redir to a benign target 302s the same way (no metadata involved)', async () => {
    const collab = loopbackCollab();
    try {
      const base = await collab.start();
      const target = 'https://example.com/';
      const res = await fetch(`${base}/redir/${encodeURIComponent(target)}`, { redirect: 'manual' });
      assert.equal(res.status, 302);
      assert.equal(res.headers.get('location'), target);
    } finally {
      await collab.stop();
    }
  });

  it('a malformed redir target answers 400, not a redirect', async () => {
    const collab = loopbackCollab();
    try {
      const base = await collab.start();
      const res = await fetch(`${base}/redir/%E0%A4%A`, { redirect: 'manual' });
      assert.equal(res.status, 400);
    } finally {
      await collab.stop();
    }
  });
});
