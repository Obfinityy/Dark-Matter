/**
 * Auth tests — username/ID + password login with JWT, integrated into the
 * existing session-cookie system (not a duplicate auth system).
 *
 * Covers: registration with/without username, login by email OR username,
 * JWT issue/verify round-trip, JWT expiry + tamper rejection, and resolveAny
 * accepting BOTH the stateless JWT and the stateful session token.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryDatabase } from '../src/models/database.js';
import { UserModel } from '../src/models/userModel.js';
import { SessionModel } from '../src/models/sessionModel.js';
import { AuthService } from '../src/services/authService.js';

function makeAuth({ jwtSecret = 'test-secret-for-auth-tests' } = {}) {
  const database = new MemoryDatabase();
  const userModel = new UserModel(database);
  const sessionModel = new SessionModel(database);
  const auth = new AuthService({ userModel, sessionModel, sessionDays: 30, jwtSecret, jwtDays: 7 });
  return { database, userModel, auth };
}

const USER = { email: 'hunter@example.com', username: 'nightowl', name: 'Night Owl', password: 's3cret-pass' };

test('register: accepts a username and returns session token + JWT', async () => {
  const { auth } = makeAuth();
  const result = await auth.register(USER);
  assert.equal(result.user.email, 'hunter@example.com');
  assert.equal(result.user.username, 'nightowl');
  assert.ok(result.token, 'session token issued');
  assert.ok(result.jwt, 'JWT issued');
  assert.ok(result.jwtExpiresAt, 'JWT expiry returned');
  assert.equal(result.jwt.split('.').length, 3, 'JWT has header.payload.signature shape');
  assert.ok(!('passwordHash' in result.user), 'password hash never leaks');
});

test('register: username is optional (email-only accounts keep working)', async () => {
  const { auth } = makeAuth();
  const result = await auth.register({ email: 'a@b.co', name: 'AB', password: 'password1' });
  assert.equal(result.user.username, null);
  assert.ok(result.jwt);
});

test('register: rejects duplicate usernames and bad formats', async () => {
  const { auth } = makeAuth();
  await auth.register(USER);
  await assert.rejects(
    () => auth.register({ email: 'other@example.com', username: 'NightOwl', name: 'Other', password: 'password1' }),
    /already taken/
  );
  await assert.rejects(
    () => auth.register({ email: 'x@y.co', username: 'ab', name: 'X Y', password: 'password1' }),
    /Username must be/
  );
  await assert.rejects(
    () => auth.register({ email: 'x@y.co', username: 'has space', name: 'X Y', password: 'password1' }),
    /Username must be/
  );
});

test('login: works with username OR email, rejects wrong passwords', async () => {
  const { auth } = makeAuth();
  await auth.register(USER);

  const byUsername = await auth.login({ login: 'nightowl', password: 's3cret-pass' });
  assert.equal(byUsername.user.username, 'nightowl');
  assert.ok(byUsername.jwt);

  const byEmail = await auth.login({ login: 'Hunter@Example.com', password: 's3cret-pass' });
  assert.equal(byEmail.user.id, byUsername.user.id, 'same account either way');

  await assert.rejects(() => auth.login({ login: 'nightowl', password: 'wrong' }), /incorrect/);
  await assert.rejects(() => auth.login({ login: 'nosuchuser', password: 's3cret-pass' }), /incorrect/);
});

test('JWT: verifyJwt round-trips the user; tampered/expired tokens rejected', async () => {
  const { auth } = makeAuth();
  const { user, jwt } = await auth.register(USER);

  const verified = await auth.verifyJwt(jwt);
  assert.equal(verified.id, user.id);
  assert.equal(verified.username, 'nightowl');

  // Tampered signature
  const parts = jwt.split('.');
  const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -2)}xx`;
  assert.equal(await auth.verifyJwt(tampered), null);

  // Garbage
  assert.equal(await auth.verifyJwt('not-a-jwt'), null);
  assert.equal(await auth.verifyJwt(null), null);

  // Wrong secret
  const { auth: other } = makeAuth({ jwtSecret: 'different-secret' });
  assert.equal(await other.verifyJwt(jwt), null);
});

test('JWT: expired tokens are rejected', async () => {
  const database = new MemoryDatabase();
  const auth = new AuthService({
    userModel: new UserModel(database),
    sessionModel: new SessionModel(database),
    sessionDays: 30,
    jwtSecret: 'test-secret',
    jwtDays: -1 // already expired
  });
  const { jwt } = await auth.register(USER);
  assert.equal(await auth.verifyJwt(jwt), null, 'expired JWT must not verify');
});

test('resolveAny: accepts BOTH the JWT and the legacy session token', async () => {
  const { auth } = makeAuth();
  const { user, token, jwt } = await auth.register(USER);

  const viaJwt = await auth.resolveAny(jwt);
  assert.equal(viaJwt.id, user.id);

  const viaSession = await auth.resolveAny(token);
  assert.equal(viaSession.id, user.id);

  assert.equal(await auth.resolveAny('garbage'), null);
});

test('logout: revokes the session token; JWT stays valid until expiry (stateless)', async () => {
  const { auth } = makeAuth();
  const { user, token, jwt } = await auth.register(USER);

  await auth.logout(token);
  assert.equal(await auth.resolve(token), null, 'session revoked');
  // JWTs are stateless by design — short-lived, verified by signature only.
  assert.equal((await auth.verifyJwt(jwt)).id, user.id);
});
