// UPI payment-claim routes — replaces Razorpay billing (owner order 25 Oct 2026).
//
//   GET  /api/v1/payments/upi                 -> UPI pay details (PUBLIC: the UPI ID is a public payment address)
//   GET  /api/v1/payments/status             -> {ok, balanceUsd, txns, accessUntil, accessActive} (login)
//   POST /api/v1/payments/claims             -> submit a claim (login, OR username+password for pending users)
//   GET  /api/v1/payments/claims/mine        -> own claims (login)
//   GET  /api/v1/payments/claims             -> all claims, pending first (admin)
//   POST /api/v1/payments/claims/:id/verify  -> admin Verify: activates the account for 1 day
//   POST /api/v1/payments/claims/:id/reject  -> admin Reject: no activation
//
// Flow: the user pays Rs 10,000 to the Obfinity UPI ID from ANY UPI app,
// then submits phone + WhatsApp + account details + UTR. NO OTP anywhere.
// The claim waits in the admin portal; the admin verifies the money arrived
// in the bank and activates the account WITHIN 24 HOURS. If the money did
// not arrive he does nothing. A claim NEVER auto-activates an account.
//
// A pending user cannot log in (403 pending_approval), so claim submission
// also accepts {username, password} in the body — the password proves
// ownership of the pending account, exactly like a login attempt. Logged-in
// users submit with their Bearer token (renewal path).

import { Router } from 'express';
import { requireAuth, requireAdmin, verifyToken, verifyPassword, createIpRateLimiter } from './auth.js';
import { readUsers } from '../store.js';
import { getBalanceUsd, recentTxns } from '../billing/credits.js';
import { upiPayDetails, UPI_AMOUNT_INR } from '../upiPay.js';
import { hasActiveAccess } from '../access.js';
import {
  submitClaim,
  listClaimsFor,
  verifyClaim,
  rejectClaim,
  ClaimValidationError,
} from '../paymentClaims.js';
import { notifyAccount } from '../notifications.js';

const router = Router();

/** Populate req.user when a valid Bearer token is present; never rejects. */
// Exported for the Razorpay router (routes/razorpay.js), which resolves the
// paying user the same way (auth header, else username+password).
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const m = /^Bearer (.+)$/.exec(header.trim());
  if (m) {
    const payload = verifyToken(m[1]);
    if (payload) {
      req.user = {
        id: payload.sub,
        username: payload.username,
        role: payload.role || 'user',
        control: payload.control || 'minimal',
      };
    }
  }
  next();
}

router.get('/upi', (_req, res) => {
  res.json({ ok: true, ...upiPayDetails() });
});

router.get('/status', requireAuth, (req, res) => {
  const users = readUsers();
  const user = Object.values(users).find((u) => u && u.id === req.user.id);
  res.json({
    ok: true,
    balanceUsd: getBalanceUsd(req.user.id),
    txns: recentTxns(req.user.id, 10),
    accessUntil: (user && user.accessUntil) || null,
    accessActive: hasActiveAccess(user),
  });
});

// Resolve the claiming user: Bearer token first, else username+password
// (pending users cannot log in, so they prove ownership this way).
// Exported for the Razorpay router (routes/razorpay.js).
export function resolveClaimUser(req) {
  if (req.user) {
    const users = readUsers();
    const user = Object.values(users).find((u) => u && u.id === req.user.id);
    return user || null;
  }
  const { username, password } = req.body || {};
  const cleanUsername = String(username || '').trim().toLowerCase();
  if (!cleanUsername || typeof password !== 'string') return { error: 'missing_credentials' };
  const users = readUsers();
  const user = users[cleanUsername];
  if (!user || !verifyPassword(password, user.salt, user.passHash)) return { error: 'invalid_login' };
  return user;
}

function isBlocked(user) {
  return user.blockedUntil === null || (user.blockedUntil && new Date(user.blockedUntil) > new Date());
}

// FIX (#325): POST /claims burns a synchronous scrypt per credential
// guess (resolveClaimUser -> verifyPassword) and had no limiter, so it
// was an unbounded password-guessing endpoint. Same budget as login.
const limitClaimAttempts = createIpRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });

router.post('/claims', limitClaimAttempts, optionalAuth, (req, res) => {
  try {
    const user = resolveClaimUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'auth_required', message: 'Log in, or provide your signup username and password.' });
    }
    if (user.error) {
      const status = user.error === 'missing_credentials' ? 400 : 401;
      return res.status(status).json({
        ok: false,
        error: user.error,
        message: user.error === 'missing_credentials' ? 'Provide {username} and {password}.' : 'Incorrect username or password.',
      });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ ok: false, error: 'admin_no_claim', message: 'Admin accounts hunt free and cannot submit payment claims.' });
    }
    if (isBlocked(user)) {
      return res.status(403).json({ ok: false, error: 'account_blocked', message: 'This account is blocked. Contact the administrator.' });
    }
    const { phone, whatsapp, accountDetails, utr } = req.body || {};
    const result = submitClaim({
      userId: user.id,
      username: user.username,
      amountInr: UPI_AMOUNT_INR,
      utr,
      phone,
      whatsapp,
      accountDetails,
    });
    const status = result.duplicate || result.updated ? 200 : 201;
    res.status(status).json({
      ok: true,
      claim: result.claim,
      duplicate: !!result.duplicate,
      updated: !!result.updated,
      message: 'Payment claim submitted. Your account will be activated within 24 hours after verification.',
    });
  } catch (err) {
    if (err instanceof ClaimValidationError) {
      return res.status(400).json({ ok: false, error: err.code, message: err.message });
    }
    console.error('[payments] claim failed:', err.message);
    res.status(502).json({ ok: false, error: 'claim_failed', message: err.message || 'Could not submit the claim.' });
  }
});

router.get('/claims/mine', requireAuth, (req, res) => {
  res.json({ ok: true, claims: listClaimsFor(req.user) });
});

router.get('/claims', requireAdmin, (req, res) => {
  res.json({ ok: true, claims: listClaimsFor(req.user) });
});

router.post('/claims/:id/verify', requireAdmin, (req, res) => {
  try {
    const result = verifyClaim(req.params.id, req.user);
    if (!result) return res.status(404).json({ ok: false, error: 'not_found', message: 'Claim not found.' });
    if (!result.alreadyHandled) {
      // Instant in-app notification to the user (same bell as findings).
      try {
        const until = new Date(result.accessUntil).toLocaleString('en-GB', {
          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        });
        notifyAccount({
          ownerId: result.claim.userId,
          title: `Account activated — access until ${until}`,
          kind: 'activation',
        });
      } catch { /* notification is best-effort; the activation already happened */ }
      console.log(`[payments] VERIFIED claim ${req.params.id} for ${result.claim.username}, access until ${result.accessUntil}`);
    }
    res.json({ ok: true, claim: result.claim, accessUntil: result.accessUntil, alreadyHandled: !!result.alreadyHandled });
  } catch (err) {
    if (err.message === 'user_not_found') {
      return res.status(410).json({ ok: false, error: 'user_gone', message: 'The claim user no longer exists.' });
    }
    console.error('[payments] verify failed:', err.message);
    res.status(502).json({ ok: false, error: 'verify_failed', message: err.message || 'Could not verify the claim.' });
  }
});

router.post('/claims/:id/reject', requireAdmin, (req, res) => {
  try {
    const result = rejectClaim(req.params.id, req.user);
    if (!result) return res.status(404).json({ ok: false, error: 'not_found', message: 'Claim not found.' });
    if (!result.alreadyHandled) {
      console.log(`[payments] REJECTED claim ${req.params.id} for ${result.claim.username}`);
    }
    res.json({ ok: true, claim: result.claim, alreadyHandled: !!result.alreadyHandled });
  } catch (err) {
    console.error('[payments] reject failed:', err.message);
    res.status(502).json({ ok: false, error: 'reject_failed', message: err.message || 'Could not reject the claim.' });
  }
});

export default router;
