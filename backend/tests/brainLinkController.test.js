/**
 * brainLinkController.test.js — per-account brain links API.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { createBrainLinkController } = await import(
  '../src/controllers/brainLinkController.js'
);

function mockStore() {
  const data = {};
  return {
    data,
    getLinks: (userId) => data[String(userId)] || {},
    saveLinks: (userId, links) => {
      if (!links || typeof links !== 'object') throw new Error('Invalid links payload');
      for (const [slot, entry] of Object.entries(links)) {
        if (entry?.url && !/^https?:\/\//i.test(entry.url)) {
          throw new Error(`Invalid URL for brain slot "${slot}"`);
        }
      }
      data[String(userId)] = links;
      return links;
    },
    deleteSlot: (userId, slot) => {
      const u = data[String(userId)] || {};
      if (!u[slot]) return false;
      delete u[slot];
      return true;
    },
  };
}

function reqRes({ user = { id: 'user1' }, body = {}, params = {} } = {}) {
  const res = {
    statusCode: 200,
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  return { req: { user, body, params }, res };
}

describe('brainLinkController', () => {
  test('list returns the caller\'s links', async () => {
    const store = mockStore();
    store.data.user1 = { vision: { url: 'https://a.gradio.live' } };
    const c = createBrainLinkController({ brainLinkStore: store });
    const { req, res } = reqRes();
    await c.list(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.links.vision.url, 'https://a.gradio.live');
  });

  test('users only see their own links', async () => {
    const store = mockStore();
    store.data.alice = { vision: { url: 'https://alice.gradio.live' } };
    const c = createBrainLinkController({ brainLinkStore: store });
    const { req, res } = reqRes({ user: { id: 'bob' } });
    await c.list(req, res);
    assert.deepEqual(res.body.links, {});
  });

  test('save stores links; invalid URLs → 400', async () => {
    const c = createBrainLinkController({ brainLinkStore: mockStore() });
    const { req, res } = reqRes({ body: { links: { hacker: { url: 'https://h.gradio.live' } } } });
    await c.save(req, res);
    assert.equal(res.body.ok, true);

    const bad = reqRes({ body: { links: { hacker: { url: 'nope' } } } });
    await c.save(bad.req, bad.res);
    assert.equal(bad.res.statusCode, 400);
  });

  test('remove deletes a slot; unknown slot → 400', async () => {
    const store = mockStore();
    store.data.user1 = { vision: { url: 'https://a.gradio.live' } };
    const c = createBrainLinkController({ brainLinkStore: store });
    const { req, res } = reqRes({ params: { slot: 'vision' } });
    await c.remove(req, res);
    assert.equal(res.body.removed, true);

    const bad = reqRes({ params: { slot: 'nope' } });
    await c.remove(bad.req, bad.res);
    assert.equal(bad.res.statusCode, 400);
  });
});
