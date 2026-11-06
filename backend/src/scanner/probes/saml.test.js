// Tests for the SAML ACS probe — envelope encoding, bundle hints, the
// no-follow POST oracle, and the unsigned-acceptance differential against a
// local stub ACS. No real IdP is ever touched; all identities are canaries.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {
  probeSaml,
  postSamlResponse,
  buildSamlResponse,
  buildXswResponse,
  buildXxeSamlResponse,
  matchSamlBundleHints,
  discoverSamlMetadata,
  sessionGranted,
} from './saml.js';
import { createOobCollaborator } from '../oobCollaborator.js';

describe('saml probe', () => {
  let server;
  let port;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, `http://127.0.0.1:${port}`);
      if (u.pathname === '/saml/metadata' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/xml' });
        res.end(
          `<EntityDescriptor entityID="http://127.0.0.1:${port}/sp" ` +
          `xmlns="urn:oasis:names:tc:SAML:2.0:metadata">` +
          `<SPSSODescriptor><AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" ` +
          `Location="http://127.0.0.1:${port}/saml/acs" index="1"/></SPSSODescriptor></EntityDescriptor>`
        );
        return;
      }
      if (u.pathname === '/saml/acs' && req.method === 'POST') {
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => {
          const params = new URLSearchParams(raw);
          // RelayState evil → 302 to it (vulnerable stub).
          const relay = params.get('RelayState') || '';
          if (relay.includes('evil.example')) {
            res.writeHead(302, { Location: relay });
            res.end();
            return;
          }
          // Decode the assertion and check the audience.
          let nameId = '';
          let audience = '';
          try {
            const xml = zlib.inflateRawSync(Buffer.from(params.get('SAMLResponse') || '', 'base64')).toString('utf8');
            nameId = (xml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/) || [])[1] || '';
            audience = (xml.match(/<saml:Audience>([^<]+)<\/saml:Audience>/) || [])[1] || '';
          } catch { /* malformed */ }
          // Vulnerable stub: accepts unsigned iff audience matches our SP.
          if (nameId && audience.startsWith(`http://127.0.0.1:${port}`)) {
            res.writeHead(302, {
              'Set-Cookie': `session=stub-${nameId}; Path=/; HttpOnly`,
              Location: '/dashboard',
            });
            res.end(`welcome ${nameId}`);
            return;
          }
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('rejected');
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('returns empty array when no ACS endpoint found', async () => {
    const findings = await probeSaml('http://127.0.0.1:1/', { timeoutMs: 800, depth: 'quick' });
    assert.deepEqual(findings, []);
  });

  it('buildSamlResponse emits decodable deflate+base64 with the canary NameID', () => {
    const b64 = buildSamlResponse({ nameId: 'CanaryXYZ', audience: 'http://x/' });
    const xml = zlib.inflateRawSync(Buffer.from(b64, 'base64')).toString('utf8');
    assert.ok(xml.includes('CanaryXYZ'), 'NameID missing from envelope');
    assert.ok(xml.includes('<saml:Audience>http://x/</saml:Audience>'));
    assert.ok(!xml.includes('<ds:Signature'), 'v1 envelope must be unsigned');
  });

  it('postSamlResponse does NOT follow redirects', async () => {
    const sr = buildSamlResponse({ nameId: 'n', audience: 'a' });
    const r = await postSamlResponse(`http://127.0.0.1:${port}/saml/acs`, sr, {
      relayState: 'https://evil.example/cb', timeoutMs: 2000,
    });
    assert.equal(r.status, 302);
    assert.ok(r.location.includes('evil.example'));
  });

  it('discoverSamlMetadata parses the ACS location', async () => {
    const m = await discoverSamlMetadata(`http://127.0.0.1:${port}/`, { timeoutMs: 2000 });
    assert.ok(m);
    assert.equal(m.acsUrl, `http://127.0.0.1:${port}/saml/acs`);
  });

  it('confirms unsigned acceptance on a vulnerable stub (differential holds)', async () => {
    const findings = await probeSaml(`http://127.0.0.1:${port}/`, { timeoutMs: 2000, depth: 'standard' });
    const classes = findings.map((f) => f.class);
    assert.ok(classes.includes('saml_unsigned_accepted'), `expected saml_unsigned_accepted, got ${classes}`);
    assert.ok(classes.includes('saml_metadata_exposed'), `expected saml_metadata_exposed, got ${classes}`);
    assert.ok(classes.includes('saml_relaystate_redirect'), `expected saml_relaystate_redirect, got ${classes}`);
    const crit = findings.find((f) => f.class === 'saml_unsigned_accepted');
    assert.equal(crit.severity, 'critical');
    // Every finding carries verdict-grade evidence + parameter.
    for (const f of findings) {
      assert.ok(f.evidence && typeof f.evidence === 'object');
      assert.ok(f.evidence.request && f.evidence.response);
      assert.ok(f.parameter, `finding ${f.class} missing parameter`);
      assert.ok(f.evidence.signalCorrelated === true);
    }
  });

  it('matches SAML bundle hints', () => {
    const hits = matchSamlBundleHints('form SAMLResponse RelayState urn:oasis:names:tc:SAML:2.0');
    assert.ok(hits.length >= 2, `expected >=2 hints, got ${hits.length}`);
  });

  it('sessionGranted ignores non-session cookies (tautology-free gate)', () => {
    // A cookie with no session-like name must not grant a session, even
    // when long; a session-named cookie or the canary in body/location does.
    assert.equal(sessionGranted({ setCookie: 'foo=barbarbarbarbar', body: '', location: '' }, 'CANARY'), false);
    assert.equal(sessionGranted({ setCookie: 'session=abc1234567890', body: '', location: '' }, 'CANARY'), true);
    assert.equal(sessionGranted({ setCookie: 'auth_token=0123456789abcdef', body: '', location: '' }, 'CANARY'), true);
    assert.equal(sessionGranted({ setCookie: 'sid=x', body: '', location: '' }, 'CANARY'), false);
    assert.equal(sessionGranted({ setCookie: '', body: 'welcome CANARY', location: '' }, 'CANARY'), true);
  });

  it('returns no hits on plain HTML', () => {
    assert.deepEqual(matchSamlBundleHints('<html><body>hello</body></html>'), []);
  });
});

// ---------------------------------------------------------------------------
// Advanced tests: XSW (#67/#441), issuer confusion (#445), XXE (#443).
// Each stub reproduces one REAL-WORLD vulnerable ACS pattern. The probe's
// differential oracle (control rejected, attack grants a canary session) is
// what turns stub behavior into a CONFIRMED verdict. No live backend touched.

function decodeSamlBody(raw) {
  const params = new URLSearchParams(raw);
  try {
    return zlib.inflateRawSync(Buffer.from(params.get('SAMLResponse') || '', 'base64')).toString('utf8');
  } catch { return ''; }
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => resolve(raw));
  });
}

async function startStub() {
  let handler = (req, res) => { res.writeHead(404); res.end(); };
  const server = http.createServer((req, res) => handler(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return { server, port, setHandler: (h) => { handler = h; } };
}

function grantSession(res, nameId) {
  res.writeHead(302, {
    'Set-Cookie': `session=stub-${nameId}; Path=/; HttpOnly`,
    Location: '/dashboard',
  });
  res.end(`welcome ${nameId}`);
}

// Stub A — XSW-vulnerable ACS: rejects unsigned assertions, but when a
// ds:Signature is present it resolves the Reference URI, verifies the digest
// over the referenced assertion bytes, then consumes the LAST assertion's
// NameID (the classic "validated X, trusted Y" wrap mistake).
function xswVulnHandler() {
  return async (req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname !== '/saml/acs' || req.method !== 'POST') { res.writeHead(404); res.end(); return; }
    const xml = decodeSamlBody(await readBody(req));
    if (!xml.includes('<ds:Signature')) { res.writeHead(400); res.end('rejected: unsigned'); return; }
    const refId = (xml.match(/<ds:Reference URI="#([^"]+)"/) || [])[1];
    const digestVal = (xml.match(/<ds:DigestValue>([^<]+)<\/ds:DigestValue>/) || [])[1];
    const aBlock = (xml.match(new RegExp(`<saml:Assertion[^>]*ID="${refId}"[\\s\\S]*?</saml:Assertion>`)) || [])[0];
    let ok = false;
    if (refId && digestVal && aBlock) {
      const unsigned = aBlock.replace(/<ds:Signature[\s\S]*?<\/ds:Signature>/, '');
      ok = crypto.createHash('sha256').update(unsigned, 'utf8').digest('base64') === digestVal;
    }
    if (!ok) { res.writeHead(400); res.end('rejected: bad signature'); return; }
    const nameIds = [...xml.matchAll(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/g)].map((m) => m[1]);
    grantSession(res, nameIds[nameIds.length - 1] || 'unknown');
  };
}

// Stub B — strict ACS: rejects everything (no signature trust at all).
function strictHandler() {
  return async (req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname === '/saml/acs' && req.method === 'POST') {
      res.writeHead(400); res.end('rejected');
      return;
    }
    res.writeHead(404); res.end();
  };
}

// Stub C — issuer-trusting ACS: trusts the Issuer STRING without ever
// checking a signature (issuer confusion). Only the SP's own entityID is
// "trusted".
function issuerTrustHandler(port) {
  const trusted = `http://127.0.0.1:${port}/sp`;
  return async (req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname === '/saml/metadata' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(
        `<EntityDescriptor entityID="${trusted}" xmlns="urn:oasis:names:tc:SAML:2.0:metadata">` +
        `<SPSSODescriptor><AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" ` +
        `Location="http://127.0.0.1:${port}/saml/acs" index="1"/></SPSSODescriptor></EntityDescriptor>`
      );
      return;
    }
    if (u.pathname === '/saml/acs' && req.method === 'POST') {
      const xml = decodeSamlBody(await readBody(req));
      const issuer = (xml.match(/<saml:Issuer>([^<]+)<\/saml:Issuer>/) || [])[1] || '';
      const nameId = (xml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/) || [])[1] || '';
      if (issuer === trusted && nameId) { grantSession(res, nameId); return; }
      res.writeHead(400); res.end('rejected');
      return;
    }
    res.writeHead(404); res.end();
  };
}

// Stub D — entity-expanding ACS: rejects plain assertions, but when a
// DOCTYPE is present it resolves internal entities and echoes the parsed
// NameID (mimics an XXE-capable parser path).
function xxeExpandHandler() {
  return async (req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname !== '/saml/acs' || req.method !== 'POST') { res.writeHead(404); res.end(); return; }
    const xml = decodeSamlBody(await readBody(req));
    if (!xml.includes('<!DOCTYPE')) { res.writeHead(400); res.end('rejected'); return; }
    const defs = {};
    for (const m of xml.matchAll(/<!ENTITY\s+(\w+)\s+"([^"]*)">/g)) defs[m[1]] = m[2];
    let nameId = (xml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/) || [])[1] || '';
    nameId = nameId.replace(/&(\w+);/g, (s, n) => (n in defs ? defs[n] : s));
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`processed nameid: ${nameId}`);
  };
}

describe('saml XSW builder', () => {
  it('is self-consistent: digest binds assertion-1, RSA signature verifies, canary assertion unsigned', () => {
    const { xml, publicKeyPem, signedAssertionId, canaryAssertionId } = buildXswResponse({
      canary: 'CANARY1', issuer: 'https://idp.test/', audience: 'https://sp.test/', signedFirst: false,
    });
    assert.notEqual(signedAssertionId, canaryAssertionId);
    // Reference URI points at the SIGNED (dummy) assertion — never the canary.
    const refId = (xml.match(/<ds:Reference URI="#([^"]+)"/) || [])[1];
    assert.equal(refId, signedAssertionId);
    // The canary assertion carries NO signature element.
    const canaryBlock = (xml.match(new RegExp(`<saml:Assertion[^>]*ID="${canaryAssertionId}"[\\s\\S]*?</saml:Assertion>`)) || [])[0];
    assert.ok(canaryBlock, 'canary assertion block missing');
    assert.ok(!canaryBlock.includes('<ds:Signature'), 'canary assertion must be unsigned');
    assert.ok(canaryBlock.includes('CANARY1'), 'canary NameID missing');
    // Digest recomputed over assertion-1 minus the signature matches DigestValue.
    const signedBlock = (xml.match(new RegExp(`<saml:Assertion[^>]*ID="${signedAssertionId}"[\\s\\S]*?</saml:Assertion>`)) || [])[0];
    const digestVal = (xml.match(/<ds:DigestValue>([^<]+)<\/ds:DigestValue>/) || [])[1];
    const recomputed = crypto.createHash('sha256')
      .update(signedBlock.replace(/<ds:Signature[\s\S]*?<\/ds:Signature>/, ''), 'utf8')
      .digest('base64');
    assert.equal(recomputed, digestVal, 'digest does not bind assertion-1 bytes');
    // RSA signature over SignedInfo verifies with the exported public key.
    const signedInfo = (xml.match(/<ds:SignedInfo[\s\S]*?<\/ds:SignedInfo>/) || [])[0];
    const sigVal = Buffer.from((xml.match(/<ds:SignatureValue>([^<]+)<\/ds:SignatureValue>/) || [])[1], 'base64');
    assert.ok(
      crypto.verify('sha256', Buffer.from(signedInfo, 'utf8'), crypto.createPublicKey(publicKeyPem), sigVal),
      'RSA signature over SignedInfo does not verify'
    );
  });

  it('buildXxeSamlResponse embeds the DOCTYPE with the entity definition', () => {
    const xml = buildXxeSamlResponse({ nameId: '&dmxxe;', audience: 'http://x/', entityName: 'dmxxe', entityValue: 'VAL123' });
    assert.ok(xml.includes('<!DOCTYPE samlp:Response [<!ENTITY dmxxe "VAL123">]>'));
    assert.ok(xml.includes('<saml:NameID') && xml.includes('&dmxxe;'));
  });
});

describe('saml XSW differential (vulnerable stub)', () => {
  let stub;
  before(async () => { stub = await startStub(); stub.setHandler(xswVulnHandler()); });
  after(async () => { await new Promise((r) => stub.server.close(r)); });

  it('CONFIRMS saml_xsw when the ACS validates the signature but consumes the wrapped assertion', async () => {
    const findings = await probeSaml(`http://127.0.0.1:${stub.port}/`, { timeoutMs: 3000, depth: 'standard' });
    const classes = findings.map((f) => f.class);
    assert.ok(classes.includes('saml_xsw'), `expected saml_xsw, got ${classes}`);
    assert.ok(!classes.includes('saml_unsigned_accepted'), 'unsigned must be rejected for XSW to be meaningful');
    const f = findings.find((x) => x.class === 'saml_xsw');
    assert.equal(f.severity, 'critical');
    assert.equal(f.parameter, 'SAMLResponse');
    assert.ok(f.evidence.signalCorrelated === true);
    assert.ok(f.evidence.response.includes('rejected'), 'evidence must show the control was rejected');
  });
});

describe('saml XSW negative (strict stub)', () => {
  let stub;
  before(async () => { stub = await startStub(); stub.setHandler(strictHandler()); });
  after(async () => { await new Promise((r) => stub.server.close(r)); });

  it('emits no saml_xsw and no saml_unsigned_accepted when the ACS rejects everything', async () => {
    const findings = await probeSaml(`http://127.0.0.1:${stub.port}/`, { timeoutMs: 3000, depth: 'standard' });
    const classes = findings.map((f) => f.class);
    assert.ok(!classes.includes('saml_xsw'), `unexpected saml_xsw in ${classes}`);
    assert.ok(!classes.includes('saml_unsigned_accepted'), `unexpected saml_unsigned_accepted in ${classes}`);
  });
});

describe('saml issuer confusion (issuer-trusting stub)', () => {
  let stub;
  before(async () => { stub = await startStub(); stub.setHandler(issuerTrustHandler(stub.port)); });
  after(async () => { await new Promise((r) => stub.server.close(r)); });

  it('CONFIRMS saml_issuer_spoof when the trusted-issuer string grants a session but random does not', async () => {
    const findings = await probeSaml(`http://127.0.0.1:${stub.port}/`, { timeoutMs: 3000, depth: 'standard' });
    const classes = findings.map((f) => f.class);
    assert.ok(classes.includes('saml_issuer_spoof'), `expected saml_issuer_spoof, got ${classes}`);
    assert.ok(!classes.includes('saml_unsigned_accepted'), 'generic unsigned must stay rejected');
    assert.ok(!classes.includes('saml_xsw'), 'XSW must not fire on this stub');
    const f = findings.find((x) => x.class === 'saml_issuer_spoof');
    assert.equal(f.severity, 'high');
    assert.equal(f.parameter, 'Issuer');
    assert.ok(f.evidence.signalCorrelated === true);
  });
});

describe('saml XXE entity expansion (entity-expanding stub)', () => {
  let stub;
  before(async () => { stub = await startStub(); stub.setHandler(xxeExpandHandler()); });
  after(async () => { await new Promise((r) => stub.server.close(r)); });

  it('reports saml_xxe_entities when the parser expands the internal entity', async () => {
    const findings = await probeSaml(`http://127.0.0.1:${stub.port}/`, { timeoutMs: 3000, depth: 'standard' });
    const classes = findings.map((f) => f.class);
    assert.ok(classes.includes('saml_xxe_entities'), `expected saml_xxe_entities, got ${classes}`);
    assert.ok(!classes.includes('saml_xsw'), 'XSW must not fire on this stub');
    const f = findings.find((x) => x.class === 'saml_xxe_entities');
    assert.equal(f.parameter, 'SAMLResponse');
    assert.ok(f.evidence.response.includes('EXPANDED'), 'evidence must show expansion was observed');
  });

  it('emits no saml_xxe_entities on the strict stub (no expansion)', async () => {
    const s2 = await startStub(); s2.setHandler(strictHandler());
    try {
      const findings = await probeSaml(`http://127.0.0.1:${s2.port}/`, { timeoutMs: 3000, depth: 'standard' });
      assert.ok(!findings.map((f) => f.class).includes('saml_xxe_entities'));
    } finally {
      await new Promise((r) => s2.server.close(r));
    }
  });
});

// ---------------------------------------------------------------------------
// SAML XXE OOB collaborator (#443b). The stub ACS mimics a vulnerable XML
// parser: when the DOCTYPE carries an external parameter entity it fetches
// the SYSTEM URL, then rejects the assertion. The fetch landing on the
// collaborator is the blind-XXE signal — the probe confirms it in-scan
// (saml_xxe_oob, high) only when the waiter sees the hit.

// Stub E — OOB-fetching ACS: fetches any SYSTEM url in the DOCTYPE, then 400s.
function oobFetchHandler() {
  return async (req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname !== '/saml/acs' || req.method !== 'POST') { res.writeHead(404); res.end(); return; }
    const xml = decodeSamlBody(await readBody(req));
    const sysUrl = (xml.match(/<!ENTITY\s+%\s+\w+\s+SYSTEM\s+"([^"]+)"/) || [])[1];
    if (sysUrl) {
      // The fetch IS the signal; its success/failure changes nothing.
      try { await fetch(sysUrl, { signal: AbortSignal.timeout(2000) }); } catch { /* ignore */ }
    }
    res.writeHead(400); res.end('rejected');
  };
}

describe('saml XXE OOB collaborator', () => {
  let collab;
  let baseUrl;

  before(async () => {
    collab = createOobCollaborator({ listenHost: '127.0.0.1', callbackHost: '127.0.0.1' });
    baseUrl = await collab.start();
  });

  after(async () => { await collab.stop(); });

  const oobOpts = (extra = {}) => ({
    timeoutMs: 3000,
    depth: 'standard',
    labTargets: '127.0.0.1',
    oobCallback: baseUrl,
    oobWaitFor: (token, ms) => collab.waitFor(token, ms),
    oobWaitTimeoutMs: 3000,
    ...extra,
  });

  it('CONFIRMS saml_xxe_oob (high) when the ACS parser fetches the canary URL', async () => {
    const stub = await startStub(); stub.setHandler(oobFetchHandler());
    try {
      const findings = await probeSaml(`http://127.0.0.1:${stub.port}/`, oobOpts());
      const classes = findings.map((f) => f.class);
      assert.ok(classes.includes('saml_xxe_oob'), `expected saml_xxe_oob, got ${classes}`);
      assert.ok(!classes.includes('saml_xxe_oob_sent'), 'waiter path must not emit the unconfirmed sent record');
      const f = findings.find((x) => x.class === 'saml_xxe_oob');
      assert.equal(f.severity, 'high');
      assert.equal(f.parameter, 'SAMLResponse');
      assert.equal(f.evidence.oobHit, true);
      assert.ok(f.evidence.signalCorrelated === true);
      assert.ok(f.evidence.response.includes('saml-xxe-'), 'evidence must name the callback token');
      assert.ok(f.evidence.response.includes('collaborator received'), 'evidence must show the callback receipt');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('NEGATIVE: no saml_xxe_oob when the ACS never fetches the canary URL', async () => {
    const stub = await startStub(); stub.setHandler(strictHandler());
    try {
      const findings = await probeSaml(`http://127.0.0.1:${stub.port}/`, oobOpts({ oobWaitTimeoutMs: 500 }));
      const classes = findings.map((f) => f.class);
      assert.ok(!classes.includes('saml_xxe_oob'), `unexpected saml_xxe_oob in ${classes}`);
      assert.ok(!classes.includes('saml_xxe_oob_sent'), 'waiter path must stay silent on a miss');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('lab gate: no OOB finding at all when the host is not lab-gated', async () => {
    const stub = await startStub(); stub.setHandler(oobFetchHandler());
    try {
      const hitsBefore = collab.hits.length;
      const findings = await probeSaml(`http://127.0.0.1:${stub.port}/`, oobOpts({ labTargets: '' }));
      const classes = findings.map((f) => f.class);
      assert.ok(!classes.includes('saml_xxe_oob'), `unexpected saml_xxe_oob in ${classes}`);
      assert.ok(!classes.includes('saml_xxe_oob_sent'), `unexpected saml_xxe_oob_sent in ${classes}`);
      assert.equal(collab.hits.length, hitsBefore, 'gate closed: the probe must not send any OOB URL');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('backward compat: string-only oobCallback (no waiter) still emits saml_xxe_oob_sent', async () => {
    const stub = await startStub(); stub.setHandler(oobFetchHandler());
    try {
      const findings = await probeSaml(`http://127.0.0.1:${stub.port}/`, {
        timeoutMs: 3000, depth: 'standard', labTargets: '127.0.0.1', oobCallback: baseUrl,
      });
      const classes = findings.map((f) => f.class);
      assert.ok(classes.includes('saml_xxe_oob_sent'), `expected saml_xxe_oob_sent, got ${classes}`);
      assert.ok(!classes.includes('saml_xxe_oob'), 'no waiter means no confirmation');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });
});
