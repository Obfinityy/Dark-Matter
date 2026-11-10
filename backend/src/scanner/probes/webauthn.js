// Dark Matter rule-based scanner — WebAuthn origin / challenge
// validation probe (coverage row #502 [High] WebAuthn origin /
// challenge validation missing, CWE-347 | phase 'webauthn').
//
// WebAuthn security rests on the relying party verifying, on every
// finish call, that the challenge matches one it issued for this
// ceremony, that the origin matches its own, and that the signature
// verifies against the registered credential (with the signature
// counter advancing). When the finish endpoints check none of that,
// any caller can register a credential and log in with a stale or
// never-issued challenge from any origin — the ceremony is theatre.
//
// ORACLE (differential, forged ceremony vs unknown credential):
//   PROBE — register/finish with a NEVER-ISSUED challenge, then
//   authenticate/finish with a STALE challenge, origin
//   https://evil.example.com and a fake signature. Both must return
//   200 (register: challengeChecked:false; authenticate: a session
//   token with originChecked:false, challengeChecked:false,
//   signatureChecked:false), and the minted session must resolve
//   via /api/auth/me.
//   CONTROL — authenticate/finish with an UNKNOWN credentialId must
//   be rejected (404), proving the endpoint does look credentials
//   up — the 200s are not blanket accepts.
// A finding fires only when the forged ceremony logs in AND the
// unknown-credential control is rejected. The response flags are
// quoted as corroboration; the session that resolves is the proof.
//
// GATES: lab-only. Registration and authentication ceremonies are
// state-changing, so a non-lab target returns nothing. Depth quick
// is skipped.
//
// HONEST LIMITS: lab-provable only — the probe uses the lab's fake
// credential material (no real authenticator, no real signature).
// It proves the RP performs no challenge/origin/signature/counter
// check; it does not test real attestation formats, resident keys,
// or counter rollback on a genuine authenticator.

import {
  LAB_SEED_EMAIL,
  originOf,
  jsonRequest,
  oauthFinding,
  randSuffix,
  tokenRef,
  labGated,
  getDiag,
} from './oauthShared.js';

const TIMEOUT_MS = 15000;
const EVIL_ORIGIN = 'https://evil.example.com';
const STALE_CHALLENGE = 'dm-stale-challenge-never-issued';

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Judge the WebAuthn matrix. 'confirmed' only when the forged
 * authenticate/finish returned a session with the evil origin
 * accepted and the validation flags reported absent, the minted
 * session resolves to the user, and the unknown-credential control
 * was rejected. Pure.
 */
export function assessWebauthn({ authFinish, sessionMe, bogusCred, registerFinish }) {
  if (!authFinish || authFinish.status !== 200 || !authFinish.json || !authFinish.json.sessionToken) {
    return { verdict: 'rejected', reason: 'forged authenticate/finish did not return a session — ceremony is guarded' };
  }
  if (bogusCred && bogusCred.status === 200 && bogusCred.json && bogusCred.json.sessionToken) {
    return { verdict: 'unconfirmed', reason: 'unknown credential also returned a session — endpoint cannot be trusted' };
  }
  if (!sessionMe || sessionMe.status !== 200 || !sessionMe.json || !sessionMe.json.email) {
    return { verdict: 'unconfirmed', reason: 'minted session did not resolve — login cannot be confirmed' };
  }
  const flags = authFinish.json;
  const unchecked = flags.originChecked === false && flags.challengeChecked === false && flags.signatureChecked === false;
  if (!unchecked && flags.originAccepted !== EVIL_ORIGIN) {
    return { verdict: 'unconfirmed', reason: 'finish response does not show the missing checks or the evil origin' };
  }
  if (registerFinish && registerFinish.status !== 200) {
    return { verdict: 'unconfirmed', reason: 'register/finish with a never-issued challenge was rejected — registration is guarded' };
  }
  return { verdict: 'confirmed', reason: 'stale challenge + wrong origin + fake signature accepted; session resolves' };
}

// ---- the probe ---------------------------------------------------------------

export async function probeWebauthn(url, params, opts = {}) {
  const findings = [];
  const diag = getDiag(opts);
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : globalThis.fetch;
  const timeoutMs = opts.timeoutMs || TIMEOUT_MS;
  let attempts = 0;
  const req = async (u, init) => {
    attempts += 1;
    return jsonRequest(fetchFn, u, { ...init, timeoutMs });
  };

  setDiag('gated', labGated(url, opts));
  if (!labGated(url, opts)) {
    setDiag('attempts', 0);
    return findings;
  }
  if (opts.depth === 'quick') {
    setDiag('skippedQuick', true);
    setDiag('attempts', 0);
    return findings;
  }
  const origin = originOf(url);
  if (!origin) return findings;
  const email = LAB_SEED_EMAIL;
  const credentialId = `cred-dm-${randSuffix()}`;

  // Register a credential with a NEVER-ISSUED challenge.
  await req(`${origin}/webauthn/register/begin`, { method: 'POST', body: { email } });
  const registerFinish = await req(`${origin}/webauthn/register/finish`, {
    method: 'POST',
    body: { email, credentialId, publicKey: 'dm-fake-public-key', challenge: 'dm-never-issued-challenge' },
  });
  if (!registerFinish || registerFinish.status !== 200) {
    setDiag('attempts', attempts);
    return findings;
  }

  // Authenticate with a STALE challenge, a WRONG origin and a fake signature.
  await req(`${origin}/webauthn/authenticate/begin`, { method: 'POST', body: { email } });
  const authFinish = await req(`${origin}/webauthn/authenticate/finish`, {
    method: 'POST',
    body: {
      email,
      credentialId,
      challenge: STALE_CHALLENGE,
      origin: EVIL_ORIGIN,
      signature: 'dm-fake-signature',
    },
  });
  // CONTROL: an unknown credential must be rejected.
  const bogusCred = await req(`${origin}/webauthn/authenticate/finish`, {
    method: 'POST',
    body: {
      email,
      credentialId: 'cred-dm-unknown',
      challenge: STALE_CHALLENGE,
      origin: EVIL_ORIGIN,
      signature: 'dm-fake-signature',
    },
  });
  setDiag('attempts', attempts);

  // The minted session must actually resolve.
  let sessionMe = null;
  if (authFinish && authFinish.status === 200 && authFinish.json && authFinish.json.sessionToken) {
    sessionMe = await req(`${origin}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authFinish.json.sessionToken}` },
    });
  }
  setDiag('attempts', attempts);

  const verdict = assessWebauthn({ authFinish, sessionMe, bogusCred, registerFinish });
  setDiag('verdict', verdict.verdict);
  if (verdict.verdict !== 'confirmed') return findings;

  findings.push(
    oauthFinding({
      findingClass: 'webauthn_validation_missing',
      id: `webauthn-validation-${credentialId}`,
      title: 'WebAuthn origin / challenge / signature validation missing — forged ceremony logs in',
      severity: 'high',
      url: `${origin}/webauthn/authenticate/finish`,
      parameter: 'origin',
      request: `POST /webauthn/register/finish {challenge:"dm-never-issued-challenge"} → 200; POST /webauthn/authenticate/finish {challenge:"${STALE_CHALLENGE}", origin:"${EVIL_ORIGIN}", signature:"dm-fake-signature"}`,
      response: `Authenticate/finish → 200, session ${tokenRef(authFinish.json.sessionToken)}, originAccepted="${authFinish.json.originAccepted}", originChecked=${authFinish.json.originChecked}, challengeChecked=${authFinish.json.challengeChecked}, signatureChecked=${authFinish.json.signatureChecked}, signCountChecked=${authFinish.json.signCountChecked}; session resolves via /api/auth/me to ${sessionMe.json.email}; unknown credential → ${bogusCred ? bogusCred.status : 'no response'} (rejected).`,
      impact: 'Anyone can register a fake credential and log in as any user with a stale challenge from any origin and a fabricated signature — WebAuthn adds no authentication at all.',
    })
  );
  return findings;
}

export const __webauthnMeta = { phases: ['webauthn'], depth: ['standard', 'deep'] };
