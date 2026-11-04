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
