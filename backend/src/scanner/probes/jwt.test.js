// Tests for the JWT probe — verifies decoding, weak secret cracking,
// and claim hygiene detection without network calls.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeJwt,
  findJwts,
  b64urlDecode,
  b64urlEncode,
  WEAK_SECRETS,
  probeJwt,
} from './jwt.js';

// Helper: create a test JWT with HS256 and a known secret
import crypto from 'node:crypto';
import http from 'node:http';
function makeJwtSync(header, payload, secret) {
  const h = b64urlEncode(JSON.stringify(header));
  const p = b64urlEncode(JSON.stringify(payload));
  const signingInput = `${h}.${p}`;
  const sig = crypto.createHmac('sha256', secret).update(signingInput).digest();
  const s = b64urlEncode(sig);
  return `${h}.${p}.${s}`;
}

describe('jwt probe helpers', () => {
  it('b64urlDecode decodes base64url correctly', () => {
    const encoded = b64urlEncode(Buffer.from('hello world'));
    assert.equal(b64urlDecode(encoded), 'hello world');
  });

  it('b64urlEncode produces URL-safe output', () => {
    const encoded = b64urlEncode(Buffer.from([0xfb, 0xff, 0xfe]));
    assert.ok(!encoded.includes('+'));
    assert.ok(!encoded.includes('/'));
    assert.ok(!encoded.includes('='));
  });

  it('decodeJwt parses a valid JWT', () => {
    const token = makeJwtSync(
      { alg: 'HS256', typ: 'JWT' },
      { sub: '123', name: 'test', iat: 1234567890 },
      'secret'
    );
    const decoded = decodeJwt(token);
    assert.ok(decoded);
    assert.equal(decoded.header.alg, 'HS256');
    assert.equal(decoded.payload.sub, '123');
    assert.equal(decoded.payload.name, 'test');
  });

  it('decodeJwt returns null for invalid JWT', () => {
    assert.equal(decodeJwt('not.a.jwt'), null);
    assert.equal(decodeJwt('invalid'), null);
    assert.equal(decodeJwt(''), null);
  });

  it('findJwts extracts JWTs from text', () => {
    const token = makeJwtSync({ alg: 'HS256' }, { sub: '1' }, 'secret');
    const text = `Here is a token: ${token} and some other text`;
    const found = findJwts(text);
    assert.equal(found.length, 1);
    assert.equal(found[0].token, token);
  });

  it('findJwts deduplicates tokens', () => {
    const token = makeJwtSync({ alg: 'HS256' }, { sub: '1' }, 'secret');
    const text = `${token} and again ${token}`;
    const found = findJwts(text);
    assert.equal(found.length, 1);
  });

  it('findJwts ignores non-JWT strings', () => {
    const text = 'eyJ not a real jwt here';
    const found = findJwts(text);
    assert.equal(found.length, 0);
  });

  it('WEAK_SECRETS contains expected entries', () => {
    assert.ok(WEAK_SECRETS.includes('secret'));
    assert.ok(WEAK_SECRETS.includes('password'));
    assert.ok(WEAK_SECRETS.includes('123456'));
    assert.ok(WEAK_SECRETS.length >= 30);
  });
});

describe('jwt probe weak secret detection', () => {
  it('detects weak secret "secret" via offline crack', async () => {
    // Create a JWT signed with weak secret 'secret'
    const token = makeJwtSync(
      { alg: 'HS256', typ: 'JWT' },
      { sub: 'user1', exp: Math.floor(Date.now() / 1000) + 3600 },
      'secret'
    );
    
    // Mock fetch to return a page containing the JWT
    const origFetch = global.fetch;
    global.fetch = async (url, opts) => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => `<html>Token: ${token}</html>`,
    });
    
    try {
      const findings = await probeJwt('http://test.example/', { timeoutMs: 5000 });
      const weakSecret = findings.find(f => f.class === 'jwt_weak_secret');
      assert.ok(weakSecret, 'Should detect weak secret');
      assert.equal(weakSecret.severity, 'critical');
      assert.ok(weakSecret.title.includes('secret'));
    } finally {
      global.fetch = origFetch;
    }
  });

  it('does not flag strong secrets', async () => {
    const token = makeJwtSync(
      { alg: 'HS256', typ: 'JWT' },
      { sub: 'user1', exp: Math.floor(Date.now() / 1000) + 3600 },
      'xJ8#mK2$pL9@nQ4$vR7&wT1!'
    );
    
    const origFetch = global.fetch;
    global.fetch = async (url, opts) => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => `<html>Token: ${token}</html>`,
    });
    
    try {
      const findings = await probeJwt('http://test.example/', { timeoutMs: 5000 });
      const weakSecret = findings.find(f => f.class === 'jwt_weak_secret');
      assert.equal(weakSecret, undefined, 'Should not flag strong secret');
    } finally {
      global.fetch = origFetch;
    }
  });
});

describe('jwt probe claim hygiene', () => {
  it('flags JWT without exp claim as medium', async () => {
    const token = makeJwtSync(
      { alg: 'HS256', typ: 'JWT' },
      { sub: 'user1' }, // No exp!
      'strong-secret-not-in-list-xyz123'
    );
    
    const origFetch = global.fetch;
    global.fetch = async (url, opts) => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => `<html>Token: ${token}</html>`,
    });
    
    try {
      const findings = await probeJwt('http://test.example/', { timeoutMs: 5000 });
      const noExp = findings.find(f => f.class === 'jwt_claim_hygiene' && f.parameter === 'exp');
      assert.ok(noExp, 'Should flag missing exp');
      assert.equal(noExp.severity, 'medium');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('does not flag JWT with exp claim', async () => {
    const token = makeJwtSync(
      { alg: 'HS256', typ: 'JWT' },
      { sub: 'user1', exp: Math.floor(Date.now() / 1000) + 3600 },
      'strong-secret-not-in-list-xyz123'
    );
    
    const origFetch = global.fetch;
    global.fetch = async (url, opts) => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => `<html>Token: ${token}</html>`,
    });
    
    try {
      const findings = await probeJwt('http://test.example/', { timeoutMs: 5000 });
      const noExp = findings.find(f => f.class === 'jwt_claim_hygiene' && f.parameter === 'exp');
      assert.equal(noExp, undefined, 'Should not flag when exp present');
    } finally {
      global.fetch = origFetch;
    }
  });
});

describe('jwt probe returns empty for no JWTs', () => {
  it('returns empty array when no JWT found', async () => {
    const origFetch = global.fetch;
    global.fetch = async (url, opts) => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => '<html>No tokens here</html>',
    });
    
    try {
      const findings = await probeJwt('http://test.example/', { timeoutMs: 5000 });
      assert.deepEqual(findings, []);
    } finally {
      global.fetch = origFetch;
    }
  });
});

// --- Mock JWT lab server -------------------------------------------------
// A tiny protected-resource server that validates Bearer JWTs according to
// the configured vulnerability flags, so the T1/T2/T3/T5/T6 differential
// legs can be tested against a real listener (no fetch mocking).
// Flags: algNone, emptySig, confusion, kidTraversal, kidSqli,
// embeddedJwk, jku, ignoreExpiry. Every mode accepts the ORIGINAL token
// (baseline 200) and rejects a garbage signature (control ≠200); only the
// flagged forgery is accepted. That is the differential oracle, live.
const LAB_HMAC_SECRET = 'lab-hmac-secret-not-weak-7f3a';

function makeRs256Jwt(header, payload, privateKeyPem) {
  const h = b64urlEncode(JSON.stringify(header));
  const p = b64urlEncode(JSON.stringify(payload));
  const signingInput = `${h}.${p}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKeyPem);
  return `${h}.${p}.${b64urlEncode(sig)}`;
}

function verifyHs256(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
    const actual = Buffer.from(parts[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function verifyRs256(token, publicKey) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const sig = Buffer.from(parts[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    return crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, sig);
  } catch {
    return false;
  }
}

async function startJwtLab({ flags = {}, tokenAlg = 'HS256', tokenSecret = LAB_HMAC_SECRET, tokenExp = null, authMarker = true } = {}) {
  const serverKeys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const attackerKeys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const serverJwk = { ...crypto.createPublicKey(serverKeys.publicKey).export({ format: 'jwk' }), kid: 'server-key-1' };
  const attackerJwk = crypto.createPublicKey(attackerKeys.publicKey).export({ format: 'jwk' });
  // SPKI DER bytes of the RS256 public key — the confusion secret.
  const serverPubDer = crypto.createPublicKey(serverKeys.publicKey).export({ type: 'spki', format: 'der' });

  const exp = tokenExp ?? Math.floor(Date.now() / 1000) + 3600;
  const payload = { sub: 'user1', exp };
  let token;
  if (tokenAlg === 'RS256') {
    token = makeRs256Jwt({ alg: 'RS256', typ: 'JWT', kid: 'server-key-1' }, payload, serverKeys.privateKey);
  } else {
    token = makeJwtSync({ alg: 'HS256', typ: 'JWT' }, payload, tokenSecret);
  }

  let base = '';
  let attackerJwksUrl = '';

  function validate(auth) {
    if (!auth || !auth.startsWith('Bearer ')) return 401;
    const t = auth.slice(7);
    const decoded = decodeJwt(t);
    if (!decoded) return 401;
    const { header, payload: pl } = decoded;
    const alg = (header.alg || '').toUpperCase();
    const now = Math.floor(Date.now() / 1000);
    const checkExpiry = () => !(pl.exp && pl.exp < now && !flags.ignoreExpiry);
    if (alg === 'NONE') {
      return (decoded.signature === '' && flags.algNone && checkExpiry()) ? 200 : 401;
    }
    if (decoded.signature === '') {
      return (flags.emptySig && checkExpiry()) ? 200 : 401;
    }
    if (alg === 'HS256') {
      const kid = String(header.kid || '');
      if (/dev\/null|\.\./.test(kid)) {
        return (flags.kidTraversal && verifyHs256(t, '') && checkExpiry()) ? 200 : 401;
      }
      if (/union|select/i.test(kid)) {
        return (flags.kidSqli && verifyHs256(t, 'attacker_secret') && checkExpiry()) ? 200 : 401;
      }
      if (verifyHs256(t, serverPubDer)) {
        return (flags.confusion && checkExpiry()) ? 200 : 401;
      }
      if (verifyHs256(t, LAB_HMAC_SECRET) || verifyHs256(t, 'secret')) {
        return checkExpiry() ? 200 : 401;
      }
      return 401;
    }
    if (alg === 'RS256') {
      if (header.jwk) {
        let ok = false;
        try {
          ok = verifyRs256(t, crypto.createPublicKey({ key: header.jwk, format: 'jwk' }));
        } catch { ok = false; }
        return (flags.embeddedJwk && ok && checkExpiry()) ? 200 : 401;
      }
      if (header.jku) {
        if (header.jku !== attackerJwksUrl) return 401;
        return (flags.jku && verifyRs256(t, attackerKeys.publicKey) && checkExpiry()) ? 200 : 401;
      }
      return (verifyRs256(t, serverKeys.publicKey) && checkExpiry()) ? 200 : 401;
    }
    return 401;
  }

  const server = http.createServer((req, res) => {
    const u = new URL(req.url || '/', 'http://lab.invalid');
    if (u.pathname === '/.well-known/jwks.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keys: [serverJwk] }));
      return;
    }
    if (u.pathname === '/.well-known/openid-configuration') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ issuer: base, jwks_uri: `${base}/.well-known/jwks.json` }));
      return;
    }
    if (u.pathname === '/attacker-jwks.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keys: [attackerJwk] }));
      return;
    }
    if (u.pathname === '/protected' || (req.headers.authorization && u.pathname === '/')) {
      const status = validate(req.headers.authorization || '');
      res.writeHead(status, { 'Content-Type': 'text/plain' });
      res.end(status === 200 ? 'protected content' : 'unauthorized');
      return;
    }
    const marker = authMarker
      ? '<p>Send Authorization: Bearer &lt;token&gt; to access the API.</p>'
      : '<p>Welcome to the lab app.</p>';
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<html><body>${marker}<p>Session token: ${token}</p></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  base = `http://127.0.0.1:${port}`;
  attackerJwksUrl = `${base}/attacker-jwks.json`;
  return {
    base,
    pageUrl: base,
    protectedUrl: `${base}/protected`,
    attackerJwksUrl,
    attackerPrivatePem: attackerKeys.privateKey,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

describe('jwt probe T1/T2 differential legs (mock listener)', () => {
  it('T1: flags alg:none accepted on a vulnerable server (explicit testEndpoint)', async () => {
    const lab = await startJwtLab({ flags: { algNone: true, emptySig: true } });
    try {
      const findings = await probeJwt(lab.pageUrl, { timeoutMs: 5000, testEndpoint: lab.protectedUrl });
      const hit = findings.find((f) => f.class === 'jwt_alg_none');
      assert.ok(hit, 'Should flag alg:none');
      assert.equal(hit.severity, 'critical');
    } finally {
      await lab.close();
    }
  });

  it('T1: does not flag alg:none on a secure server', async () => {
    const lab = await startJwtLab({ flags: {} });
    try {
      const findings = await probeJwt(lab.pageUrl, { timeoutMs: 5000, testEndpoint: lab.protectedUrl });
      assert.equal(findings.find((f) => f.class === 'jwt_alg_none'), undefined);
    } finally {
      await lab.close();
    }
  });

  it('T1: uses the URL the JWT came from when no testEndpoint is given (#56 fix)', async () => {
    const lab = await startJwtLab({ flags: { algNone: true, emptySig: true } });
    try {
      // No testEndpoint — the differential must run against the page URL itself.
      const findings = await probeJwt(lab.pageUrl, { timeoutMs: 5000 });
      const hit = findings.find((f) => f.class === 'jwt_alg_none');
      assert.ok(hit, 'Should flag alg:none via the default test endpoint');
      assert.equal(hit.severity, 'critical');
    } finally {
      await lab.close();
    }
  });

  it('T1/T2: no differential legs fire without an auth context', async () => {
    const lab = await startJwtLab({ flags: { algNone: true, emptySig: true }, authMarker: false });
    try {
      const findings = await probeJwt(lab.pageUrl, { timeoutMs: 5000, testEndpoint: lab.protectedUrl });
      assert.equal(findings.find((f) => f.class === 'jwt_alg_none'), undefined);
      assert.equal(findings.find((f) => f.class === 'jwt_empty_signature'), undefined);
    } finally {
      await lab.close();
    }
  });

  it('T2: flags empty signature accepted', async () => {
    const lab = await startJwtLab({ flags: { algNone: true, emptySig: true } });
    try {
      const findings = await probeJwt(lab.pageUrl, { timeoutMs: 5000, testEndpoint: lab.protectedUrl });
      const hit = findings.find((f) => f.class === 'jwt_empty_signature');
      assert.ok(hit, 'Should flag empty signature');
      assert.equal(hit.severity, 'high');
    } finally {
      await lab.close();
    }
  });

  it('T2: does not flag empty signature on a secure server', async () => {
    const lab = await startJwtLab({ flags: {} });
    try {
      const findings = await probeJwt(lab.pageUrl, { timeoutMs: 5000, testEndpoint: lab.protectedUrl });
      assert.equal(findings.find((f) => f.class === 'jwt_empty_signature'), undefined);
    } finally {
      await lab.close();
    }
  });
});

describe('jwt probe T3 algorithm confusion (mock listener)', () => {
  it('T3: flags RS256→HS256 confusion when the public key verifies as HMAC secret', async () => {
    const lab = await startJwtLab({ flags: { confusion: true }, tokenAlg: 'RS256' });
    try {
      const findings = await probeJwt(lab.pageUrl, { timeoutMs: 5000, testEndpoint: lab.protectedUrl });
      const hit = findings.find((f) => f.class === 'jwt_alg_confusion');
      assert.ok(hit, 'Should flag algorithm confusion');
      assert.equal(hit.severity, 'critical');
    } finally {
      await lab.close();
    }
  });

  it('T3: does not flag confusion on a secure server', async () => {
    const lab = await startJwtLab({ flags: {}, tokenAlg: 'RS256' });
    try {
      const findings = await probeJwt(lab.pageUrl, { timeoutMs: 5000, testEndpoint: lab.protectedUrl });
      assert.equal(findings.find((f) => f.class === 'jwt_alg_confusion'), undefined);
    } finally {
      await lab.close();
    }
  });

  it('T3: skipped for HS256 tokens (nothing to confuse)', async () => {
    const lab = await startJwtLab({ flags: { confusion: true }, tokenAlg: 'HS256' });
    try {
      const findings = await probeJwt(lab.pageUrl, { timeoutMs: 5000, testEndpoint: lab.protectedUrl });
      assert.equal(findings.find((f) => f.class === 'jwt_alg_confusion'), undefined);
    } finally {
      await lab.close();
    }
  });
});

describe('jwt probe T5 kid injection (mock listener)', () => {
  it('T5: flags kid path traversal via /dev/null + empty-key signature', async () => {
    const lab = await startJwtLab({ flags: { kidTraversal: true } });
    try {
      const findings = await probeJwt(lab.pageUrl, { timeoutMs: 5000, testEndpoint: lab.protectedUrl });
      const hit = findings.find((f) => f.class === 'jwt_kid_traversal');
      assert.ok(hit, 'Should flag kid traversal');
      assert.equal(hit.severity, 'critical');
    } finally {
      await lab.close();
    }
  });

  it('T5: flags kid SQLi via UNION SELECT + attacker_secret signature', async () => {
    const lab = await startJwtLab({ flags: { kidSqli: true } });
    try {
      const findings = await probeJwt(lab.pageUrl, { timeoutMs: 5000, testEndpoint: lab.protectedUrl });
      const hit = findings.find((f) => f.class === 'jwt_kid_sqli');
      assert.ok(hit, 'Should flag kid SQLi');
      assert.equal(hit.severity, 'critical');
    } finally {
      await lab.close();
    }
  });

  it('T5: does not flag kid legs on a secure server', async () => {
    const lab = await startJwtLab({ flags: {} });
    try {
      const findings = await probeJwt(lab.pageUrl, { timeoutMs: 5000, testEndpoint: lab.protectedUrl });
      assert.equal(findings.find((f) => f.class === 'jwt_kid_traversal'), undefined);
      assert.equal(findings.find((f) => f.class === 'jwt_kid_sqli'), undefined);
    } finally {
      await lab.close();
    }
  });
});

describe('jwt probe T6 embedded jwk / jku (mock listener)', () => {
  it('T6: flags embedded jwk accepted', async () => {
    const lab = await startJwtLab({ flags: { embeddedJwk: true }, tokenAlg: 'RS256' });
    try {
      const findings = await probeJwt(lab.pageUrl, { timeoutMs: 5000, testEndpoint: lab.protectedUrl });
      const hit = findings.find((f) => f.class === 'jwt_embedded_jwk');
      assert.ok(hit, 'Should flag embedded jwk');
      assert.equal(hit.severity, 'critical');
    } finally {
      await lab.close();
    }
  });

  it('T6: flags jku trust when a caller-supplied key server is given', async () => {
    const lab = await startJwtLab({ flags: { jku: true }, tokenAlg: 'RS256' });
    try {
      const findings = await probeJwt(lab.pageUrl, {
        timeoutMs: 5000,
        testEndpoint: lab.protectedUrl,
        jkuUrl: lab.attackerJwksUrl,
        jkuKey: lab.attackerPrivatePem,
      });
      const hit = findings.find((f) => f.class === 'jwt_jku_trust');
      assert.ok(hit, 'Should flag jku trust');
      assert.equal(hit.severity, 'critical');
    } finally {
      await lab.close();
    }
  });

  it('T6: jku leg is skipped without a caller-supplied key server', async () => {
    const lab = await startJwtLab({ flags: { jku: true }, tokenAlg: 'RS256' });
    try {
      const findings = await probeJwt(lab.pageUrl, { timeoutMs: 5000, testEndpoint: lab.protectedUrl });
      assert.equal(findings.find((f) => f.class === 'jwt_jku_trust'), undefined);
    } finally {
      await lab.close();
    }
  });

  it('T6: does not flag embedded jwk on a secure server', async () => {
    const lab = await startJwtLab({ flags: {}, tokenAlg: 'RS256' });
    try {
      const findings = await probeJwt(lab.pageUrl, { timeoutMs: 5000, testEndpoint: lab.protectedUrl });
      assert.equal(findings.find((f) => f.class === 'jwt_embedded_jwk'), undefined);
    } finally {
      await lab.close();
    }
  });
});

describe('jwt probe expired-token acceptance (mock listener)', () => {
  it('expired: flags a captured token whose exp is already past but accepted', async () => {
    const lab = await startJwtLab({
      flags: { ignoreExpiry: true },
      tokenExp: Math.floor(Date.now() / 1000) - 3600,
    });
    try {
      const findings = await probeJwt(lab.pageUrl, { timeoutMs: 5000, testEndpoint: lab.protectedUrl });
      const hit = findings.find((f) => f.class === 'jwt_expired_accepted');
      assert.ok(hit, 'Should flag an accepted expired token');
      assert.equal(hit.severity, 'high');
    } finally {
      await lab.close();
    }
  });

  it('expired: flags a re-signed past-exp token when the weak secret is cracked', async () => {
    const lab = await startJwtLab({ flags: { ignoreExpiry: true }, tokenSecret: 'secret' });
    try {
      const findings = await probeJwt(lab.pageUrl, { timeoutMs: 5000, testEndpoint: lab.protectedUrl });
      assert.ok(findings.find((f) => f.class === 'jwt_weak_secret'), 'T4 should crack the weak secret first');
      const hit = findings.find((f) => f.class === 'jwt_expired_accepted');
      assert.ok(hit, 'Should flag expiry not enforced via the cracked secret');
      assert.equal(hit.severity, 'high');
    } finally {
      await lab.close();
    }
  });

  it('expired: does not flag expiry on a secure server', async () => {
    const lab = await startJwtLab({ flags: {} });
    try {
      const findings = await probeJwt(lab.pageUrl, { timeoutMs: 5000, testEndpoint: lab.protectedUrl });
      assert.equal(findings.find((f) => f.class === 'jwt_expired_accepted'), undefined);
    } finally {
      await lab.close();
    }
  });
});
