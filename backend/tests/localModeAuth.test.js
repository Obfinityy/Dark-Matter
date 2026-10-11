/**
 * localModeAuth.test.js — DM_LOCAL_MODE=true bypasses auth on the user's
 * own machine: attachAuth attaches the local owner identity without calling
 * the auth service, and requireAuth passes through with no user attached.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.DM_LOCAL_MODE = 'true';

const { attachAuth, requireAuth } = await import('../src/middleware/auth.js');

function fakeRes() {
  return {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe('DM_LOCAL_MODE auth bypass', () => {
  test('attachAuth sets the local owner without calling authService', async () => {
    let resolveCalls = 0;
    const authService = {
      async resolveAny() {
        resolveCalls += 1;
        return { id: 'someone-else' };
      },
    };
    const middleware = attachAuth(authService);
    const req = {};
    let nextCalled = false;
    await middleware(req, fakeRes(), () => {
      nextCalled = true;
    });
    assert.equal(resolveCalls, 0, 'authService must not be consulted in local mode');
    assert.equal(nextCalled, true);
    assert.deepEqual(req.user, { id: 'local', email: 'local@device', role: 'owner' });
  });

  test('requireAuth passes through with no user attached', () => {
    const res = fakeRes();
    let nextCalled = false;
    requireAuth({}, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 0, 'must not 401 in local mode');
  });
});
