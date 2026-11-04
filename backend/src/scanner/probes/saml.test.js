// Tests for the SAML ACS probe — envelope encoding, bundle hints, the
// no-follow POST oracle, and the unsigned-acceptance differential against a
// local stub ACS. No real IdP is ever touched; all identities are canaries.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import zlib from 'node:zlib';
import {
  probeSaml,
  postSamlResponse,
  buildSamlResponse,
  matchSamlBundleHints,
  discoverSamlMetadata,
} from './saml.js';

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

  it('returns no hits on plain HTML', () => {
    assert.deepEqual(matchSamlBundleHints('<html><body>hello</body></html>'), []);
  });
});
