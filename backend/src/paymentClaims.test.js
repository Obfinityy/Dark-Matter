// UPI payment claims — unit tests (node --test).
// DATA_DIR is pointed at a temp dir BEFORE importing the module, because
// config.js reads it at module-eval time.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-claims-test-'));
process.env.DATA_DIR = tmp;
const { submitClaim, listClaimsFor, verifyClaim, rejectClaim, getClaim, ClaimValidationError } =
  await import('./paymentClaims.js');
const { writeUsers, readUsers } = await import('./store.js');
const { UPI_AMOUNT_INR } = await import('./upiPay.js');

const DAY = 24 * 3600 * 1000;
const admin = { id: 'admin-1', username: 'bhavesh189', role: 'admin' };
const owner = { id: 'user-1', role: 'user' };
const other = { id: 'user-2', role: 'user' };

function seedUsers() {
  writeUsers({
    alice: { id: 'user-1', username: 'alice', salt: 'aa', passHash: 'bb', role: 'user', control: 'minimal', approved: false },
    bob: { id: 'user-2', username: 'bob', salt: 'aa', passHash: 'bb', role: 'user', control: 'minimal', approved: false },
  });
}

const good = {
  userId: 'user-1',
  username: 'alice',
  amountInr: UPI_AMOUNT_INR,
  utr: '123456789012',
  phone: '916376411796',
  whatsapp: '916376411796',
  accountDetails: 'Alice Sharma, HDFC Bank',
};

test('submit creates a pending claim and never activates the account', () => {
  seedUsers();
  const { claim, duplicate, updated } = submitClaim(good);
  assert.ok(claim && claim.id);
  assert.equal(claim.status, 'pending');
  assert.equal(claim.amountInr, 10000);
  assert.equal(claim.utr, '123456789012');
  assert.equal(duplicate, false);
  assert.equal(updated, false);
  // The account is untouched: still unapproved, no access window.
  const user = readUsers().alice;
  assert.equal(user.approved, false);
  assert.equal(user.accessUntil, undefined);
});

test('validation rejects wrong amount, missing UTR, bad phone/WhatsApp, missing details', () => {
  assert.throws(() => submitClaim({ ...good, userId: 'user-2', amountInr: 9999 }), (e) => e instanceof ClaimValidationError && e.code === 'bad_amount');
  assert.throws(() => submitClaim({ ...good, userId: 'user-2', amountInr: 10001 }), (e) => e.code === 'bad_amount');
  assert.throws(() => submitClaim({ ...good, userId: 'user-2', utr: '' }), (e) => e.code === 'missing_utr');
  assert.throws(() => submitClaim({ ...good, userId: 'user-2', utr: '  ' }), (e) => e.code === 'missing_utr');
  assert.throws(() => submitClaim({ ...good, userId: 'user-2', phone: 'abc' }), (e) => e.code === 'bad_phone');
  assert.throws(() => submitClaim({ ...good, userId: 'user-2', whatsapp: '' }), (e) => e.code === 'bad_whatsapp');
  assert.throws(() => submitClaim({ ...good, userId: 'user-2', accountDetails: '' }), (e) => e.code === 'missing_account_details');
  assert.throws(() => submitClaim({ ...good, userId: '' }), (e) => e.code === 'missing_user');
});

test('same UTR resubmission is a duplicate; a different UTR updates the pending claim', () => {
  const first = submitClaim(good);
  assert.equal(first.duplicate, true); // alice already has a pending claim from the earlier test
  const again = submitClaim({ ...good, utr: '987654321098', phone: '919999999999' });
  assert.equal(again.duplicate, false);
  assert.equal(again.updated, true);
  assert.equal(again.claim.id, first.claim.id);
  assert.equal(again.claim.utr, '987654321098');
  assert.equal(again.claim.phone, '919999999999');
  assert.equal(listClaimsFor(owner).length, 1); // still exactly one claim for alice
});

test('verify activates the account for 1 day from now', () => {
  const [claim] = listClaimsFor(owner);
  const before = Date.now();
  const result = verifyClaim(claim.id, admin);
  const after = Date.now();
  assert.equal(result.alreadyHandled, false);
  assert.equal(result.claim.status, 'verified');
  assert.equal(result.claim.verifiedBy, 'bhavesh189');
  assert.ok(result.claim.verifiedAt);
  const untilMs = new Date(result.accessUntil).getTime();
  assert.ok(untilMs >= before + DAY && untilMs <= after + DAY);
  assert.equal(result.claim.accessUntil, result.accessUntil);
  const user = readUsers().alice;
  assert.equal(user.approved, true);
  assert.equal(user.accessUntil, result.accessUntil);
  assert.ok(user.approvedAt);
});

test('verify is idempotent: a second verify does not extend access', () => {
  const [claim] = listClaimsFor(owner);
  const firstUntil = claim.accessUntil;
  const result = verifyClaim(claim.id, admin);
  assert.equal(result.alreadyHandled, true);
  assert.equal(result.accessUntil, firstUntil);
  assert.equal(readUsers().alice.accessUntil, firstUntil);
});

test('reject does not activate and cannot touch a verified claim', () => {
  const [verified] = listClaimsFor(owner);
  const r1 = rejectClaim(verified.id, admin);
  assert.equal(r1.alreadyHandled, true);
  assert.equal(r1.claim.status, 'verified');
  // bob submits, then the admin rejects: account stays unapproved, no window.
  submitClaim({ ...good, userId: 'user-2', username: 'bob', utr: '555566667777' });
  const [pending] = listClaimsFor(other);
  const r2 = rejectClaim(pending.id, admin);
  assert.equal(r2.alreadyHandled, false);
  assert.equal(r2.claim.status, 'rejected');
  assert.ok(r2.claim.rejectedAt);
  assert.equal(r2.claim.rejectedBy, 'bhavesh189');
  const bob = readUsers().bob;
  assert.equal(bob.approved, false);
  assert.equal(bob.accessUntil, undefined);
  assert.equal(rejectClaim(pending.id, admin).alreadyHandled, true);
});

test('verify of a missing claim returns null; of a claim whose user is gone throws', () => {
  assert.equal(verifyClaim('no-such-id', admin), null);
  assert.equal(rejectClaim('no-such-id', admin), null);
  assert.equal(getClaim('no-such-id'), null);
  submitClaim({ userId: 'ghost-1', username: 'ghost', amountInr: UPI_AMOUNT_INR, utr: '111122223333', phone: '911111111111', whatsapp: '911111111111', accountDetails: 'Ghost' });
  const ghost = listClaimsFor(admin).find((c) => c.username === 'ghost');
  assert.throws(() => verifyClaim(ghost.id, admin), /user_not_found/);
});

test('listClaimsFor: admin sees all pending-first, users see only their own', () => {
  const all = listClaimsFor(admin);
  assert.ok(all.length >= 3);
  assert.equal(all[0].status, 'pending'); // pending first (ghost's claim)
  assert.equal(listClaimsFor(owner).length, 1);
  assert.equal(listClaimsFor(owner)[0].username, 'alice');
  assert.equal(listClaimsFor(other).length, 1);
  assert.equal(listClaimsFor(other)[0].username, 'bob');
  // PII travels only with the owning user / admin — another user sees nothing.
  assert.equal(listClaimsFor({ id: 'user-3', role: 'user' }).length, 0);
  assert.equal(getClaim(listClaimsFor(owner)[0].id).utr, '987654321098');
});
