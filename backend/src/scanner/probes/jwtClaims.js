// Dark Matter rule-based scanner — JWT sensitive-data-in-claims probe
// (coverage row #481 [Medium] JWT — sensitive data in claims
// (unencrypted payload), CWE-359 / CWE-200; phase 103, 'jwt-claims'.)
//
// ORACLE (deterministic, no judge, no LLM, $0): a JWT payload is
// only base64url-encoded, not encrypted — anyone holding the token
// can read every claim in it. The probe (1) logs in with the lab
// credentials and takes the token the server itself issues, (2)
// decodes the payload (base64url, no key needed), and (3) walks the
// claims for sensitive fields. CONFIRM only when at least one claim
// carries a credential/secret field (password, secret, API key,
// private key, nested token, payment / national-id field) or a
// personal-data field (email, phone, address, date of birth) with a
// non-empty value. A token whose payload holds only standard
// identifiers (sub, iss, aud, iat, exp, role, id, username) is a
// proven true negative — an identifier is not data, and flagging
// every token that carries a subject would fire on every IdP token
// in the world. Evidence quotes FIELD NAMES only; claim values are
// never copied into the report (a password hash or an email address
// must not leak through the finding itself).
//
// WHY THIS IS NOT jwt.js: the existing 'jwt' phase (rows #27,
// #56–#60, #312–#315 — alg:none, alg confusion, kid injection,
// missing signature/expiry, weak secret, RS256→HS256, kid SQLi,
// kid traversal, missing exp) attacks the token's AUTHENTICATION
// properties, and its one payload check is a shallow static regex
// over JWT-shaped strings found in the landing page / Set-Cookie
// headers — it never logs in and never inspects the token the
// server issues to an authenticated session. None of the 9 JWT rows
// covers sensitive data in the issued token's claims (verified
// first-hand 9 Nov 2026 against the spreadsheet rows 60–64 and
// 316–319). This probe closes exactly that gap: the issued token,
// decoded, claims inspected.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// basket-logic / workflow-skip / bfla / coupon-abuse — logging in
// against a non-lab target would be inappropriate); depth 'quick'
// skips the probe. BOUND: at most 4 POSTs (one login sequence) and
// zero further requests — the decode and the claim walk are fully
// offline. Max 1 finding. Findings are class
// 'jwt_sensitive_claims' — the default confirmation protocol judges
// them on signalCorrelated (see differential.js; same pattern as
// business_logic).

import { isLabTargetHost } from '../../labCreds.js';
import { loginCandidates } from './sessionFixation.js';
import { extractBearerTokenFromJson } from '../labSession.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_LOGIN_CANDIDATES = 3;
const MAX_LOGIN_POSTS = 4;
const MAX_WALK_DEPTH = 3;
// A nested field literally named '*token' is only sensitive when
// its value looks like a credential (a long opaque string) — a
// short token-shaped value is a flag or a placeholder, not a leak.
const MIN_TOKEN_VALUE_LEN = 20;

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// ---- pure helpers (exported for unit tests) ---------------------------------

// Base64url-decode one segment; null on any malformed input. Pure.
export function b64urlDecodeSegment(segment) {
  try {
    const s = String(segment || '');
    if (!s) return null;
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Decode a JWT's payload (base64url, no key needed). Returns the
 * payload object, or null when the token is not a well-formed JWT
 * (fewer than 2 dot-separated parts, or a header/payload that is
 * not JSON). The header must carry a string alg — a token-shaped
 * string without a JWT header is not a JWT. Pure.
 */
export function decodeJwtPayload(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const header = JSON.parse(b64urlDecodeSegment(parts[0]));
    if (!header || typeof header.alg !== 'string') return null;
    const payload = JSON.parse(b64urlDecodeSegment(parts[1]));
    if (!payload || typeof payload !== 'object') return null;
    return payload;
  } catch {
    return null;
  }
}

// Normalise a claim name for matching: 'api_key' -> 'apikey',
// 'deluxeToken' -> 'deluxetoken'. Pure.
function normKey(key) {
  return String(key || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function hasValue(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return false;
}

/**
 * Classify one claim field. Returns 'secret' (credential / secret /
 * payment / national-id field), 'pii' (personal-data field), or null
 * (not sensitive). Standard identifiers are deliberately excluded:
 * sub, iss, aud, iat, exp, nbf, jti, role, id, user id and username
 * are identifiers, not data — flagging them would fire on every
 * token an IdP ever issued. A bare 'name' is likewise excluded: a
 * display name is a standard OIDC claim. Pure.
 */
export function classifyClaim(key, value) {
  const n = normKey(key);
  if (!n) return null;
  if (!hasValue(value)) return null;
  // SECRET tier — credentials, secrets, payment and national-id data.
  if (n === 'password' || n === 'passwd' || n === 'pwd') return 'secret';
  if (n.includes('secret')) return 'secret';
  if (n.includes('apikey')) return 'secret';
  if (n.includes('privatekey')) return 'secret';
  if (n.includes('accesskey')) return 'secret';
  if (n.includes('creditcard') || n === 'cardnumber') return 'secret';
  if (n === 'ssn' || n.includes('socialsecurity')) return 'secret';
  if (n === 'nationalid' || n === 'passport' || n === 'iban' || n === 'bankaccount') return 'secret';
  if (n.includes('securityanswer')) return 'secret';
  // A nested '*token' field (accessToken, refreshToken, deluxeToken,
  // idToken, ...) holds another credential — sensitive only when the
  // value is long enough to be a real token.
  if (
    (n === 'token' || n.endsWith('token')) &&
    typeof value === 'string' &&
    value.length >= MIN_TOKEN_VALUE_LEN
  ) {
    return 'secret';
  }
  // PII tier — personal data. The value must be a string: a boolean
  // 'emailVerified' / 'addressVerified' flag is not personal data.
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  if (n.includes('email')) return 'pii';
  if (n.includes('phone') || n.includes('mobile') || n.includes('telephone')) return 'pii';
  if (n.includes('address')) return 'pii';
  if (n === 'dob' || n.includes('dateofbirth') || n === 'birthdate' || n.includes('birthday')) return 'pii';
  return null;
}

/**
 * Walk a decoded payload and collect every sensitive claim as
 * { field, tier }, where field is the dot-joined claim path
 * ('data.password' — Juice Shop nests its claims under `data`).
 * Objects are recursed to depth 3; arrays of objects are walked
 * the same way. Only FIELD NAMES are collected — values are never
 * returned. Pure.
 */
export function findSensitiveClaims(payload) {
  const found = [];
  const walk = (node, path, depth) => {
    if (!node || typeof node !== 'object' || depth > MAX_WALK_DEPTH) return;
    for (const [key, value] of Object.entries(node)) {
      const childPath = path ? `${path}.${key}` : key;
      if (value && typeof value === 'object') {
        walk(value, childPath, depth + 1);
        continue;
      }
      const tier = classifyClaim(key, value);
      if (tier) found.push({ field: childPath, tier });
    }
  };
  walk(payload, '', 0);
  return found;
}

/**
 * Count the leaf claim fields in a decoded payload (diagnostic:
 * how many claims the walk actually inspected). Pure.
 */
export function countClaimFields(payload) {
  let count = 0;
  const walk = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > MAX_WALK_DEPTH) return;
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') {
        walk(value, depth + 1);
      } else {
        count += 1;
      }
    }
  };
  walk(payload, 0);
  return count;
}

/**
 * Judge the claim inspection. 'confirmed' only when at least one
 * sensitive claim was found (tier is 'secret' when any secret-tier
 * field is present, else 'pii'); 'rejected' when a decodable token
 * carries no sensitive claim (proven true negative); 'unconfirmed'
 * when there was no decodable token to inspect. Pure.
 */
export function assessJwtClaims(decoded, sensitive) {
  if (!decoded) {
    return { verdict: 'unconfirmed', reason: 'no decodable JWT payload — no token to inspect' };
  }
  if (!sensitive || !sensitive.length) {
    return {
      verdict: 'rejected',
      reason: 'the issued JWT carries no sensitive claim — its payload holds only standard identifiers',
    };
  }
  const tier = sensitive.some((s) => s.tier === 'secret') ? 'secret' : 'pii';
  const names = sensitive.map((s) => s.field).join(', ');
  return {
    verdict: 'confirmed',
    tier,
    reason: `the issued JWT payload carries ${sensitive.length} sensitive claim${sensitive.length === 1 ? '' : 's'} (${tier} tier): ${names}`,
  };
}

// ---- network (fetchFn seam, defaults to global fetch) -----------------------

async function req(fetchFn, url, { method = 'GET', body = null, timeoutMs = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      method,
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        ...(body != null ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text().catch(() => '');
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON — json stays null
    }
    return { status: res.status, text: text.slice(0, 200000), json };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// One API login attempt sequence against the login candidates:
// {email, password} first, then {username, password} on 401/400.
// Returns { ok, token, url, spent } — spent counts the POSTs made.
async function apiLogin(fetchFn, loginUrls, creds, budget) {
  let spent = 0;
  for (const loginUrl of loginUrls) {
    for (const body of [
      { email: creds.username, password: creds.password },
      { username: creds.username, password: creds.password },
    ]) {
      if (spent >= budget) return { ok: false, token: null, url: null, spent };
      const r = await req(fetchFn, loginUrl, { method: 'POST', body });
      spent += 1;
      if (!r) return { ok: false, token: null, url: null, spent };
      if (r.status === 401 || r.status === 400) continue;
      if (r.status < 200 || r.status >= 300) return { ok: false, token: null, url: null, spent };
      const token = r.json ? extractBearerTokenFromJson(r.json) : null;
      if (!token) return { ok: false, token: null, url: null, spent };
      return { ok: true, token, url: loginUrl, spent };
    }
  }
  return { ok: false, token: null, url: null, spent };
}

// ---- the probe ---------------------------------------------------------------

export async function probeJwtClaims(url, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : globalThis.fetch;
  const creds = opts.labCreds;
  if (!creds || !creds.username || !creds.password) return findings;
  if (opts.allowWrite !== true) return findings;
  if (!isLabTargetHost(url, opts.labTargets)) return findings;
  if ((opts.depth || 'standard') === 'quick') return findings;
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return findings;
  }
  const routes = (opts.apiRoutes || []).map(String);
  const loginUrls = loginCandidates(routes, origin).slice(0, MAX_LOGIN_CANDIDATES);
  setDiag('loginRoutes', loginUrls.length);
  if (!loginUrls.length) return findings;

  // THE TEST — log in and take the token the server itself issues.
  // Without an issued token there is nothing to decode, so the
  // probe returns [] (uncalibrated, not a finding).
  const login = await apiLogin(fetchFn, loginUrls, creds, MAX_LOGIN_POSTS);
  setDiag('tokenFound', Boolean(login.token));
  if (!login.ok || !login.token) return findings;

  // Decode the payload (base64url, no key needed). An opaque
  // (non-JWT) token carries no readable claims — honest [].
  const decoded = decodeJwtPayload(login.token);
  setDiag('tokenJwt', Boolean(decoded));
  if (!decoded) return findings;
  setDiag('claimsScanned', countClaimFields(decoded));
  const sensitive = findSensitiveClaims(decoded);
  setDiag('sensitiveFields', sensitive.length);
  const verdict = assessJwtClaims(decoded, sensitive);
  if (verdict.verdict !== 'confirmed') return findings;
  setDiag('tier', verdict.tier);
  const names = sensitive.map((s) => s.field).join(', ');
  findings.push({
    class: 'jwt_sensitive_claims',
    id: `jwt-claims-${rand()}`,
    title: 'JWT payload carries sensitive data in its claims (MEDIUM)',
    severity: 'medium',
    url: login.url,
    parameter: 'payload',
    evidence: ev(
      `POST ${login.url} with lab credentials -> decode the issued JWT payload (base64url, no key needed)`,
      `The issued JWT payload carries sensitive claims (${verdict.tier} tier): ${names} (values redacted — the payload is only base64-encoded, not encrypted).`,
      'Anyone holding the token can read these claims — move secrets and personal data out of the token (opaque references / server-side session) and re-issue.',
    ),
  });
  return findings;
}

export const __jwtClaimsMeta = { phases: ['jwt-claims'], depth: ['standard', 'deep'] };
