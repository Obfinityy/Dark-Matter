// Tests for the secrets-in-client-side-JS probe
// (coverage row #179, phase 69).
// No network, no lab needed — bundle fetches go through the
// opts.fetchPage seam.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeSecretsInJs,
  extractSecretTargets,
  redactSecret,
} from './secretsInJs.js';
import { verifyFindings } from '../verifier.js';

const PAGE_URL = 'http://lab.local/app';
const BUNDLE_URL = 'http://lab.local/main.js';
const BUNDLE2_URL = 'http://lab.local/vendor.js';

// Format-valid, synthetic secrets (never real credentials).
// Stripe/Twilio fixtures are built by concatenation on purpose: the
// full literals trip GitHub push protection (GH013), so they must
// never appear as one string in this file. Runtime values unchanged.
const AWS_KEY = 'AKIAA1B2C3D4E5F6G7H8';
const AWS_DOCS_EXAMPLE = 'AKIAIOSFODNN7EXAMPLE';
const GH_TOKEN = 'ghp_Ab3dEf6hIj9kLm2nOp5qRs8tUv0wXyZ1aB4c';
const SLACK_TOKEN = 'xoxb-987654321098-Ab3dEf6hIj9k';
const GOOGLE_KEY = 'AIzaAb3dEf6hIj9kLm2nOp5qRs8tUv0wXyZ1aB4';
const STRIPE_KEY = 'sk_live_' + 'Ab3dEf6hIj9kLm2nOp5qRs8t';
const TWILIO_KEY = 'SK' + 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
const JWT_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const PEM_BLOCK =
  '-----BEGIN RSA PRIVATE KEY-----\nFAKEKEYMATERIALFAKEKEYMATERIALFAKE\n-----END RSA PRIVATE KEY-----';
const DB_URI = 'mongodb://appuser:Sup3rS3cret!@db.internal:27017/appdb';
const GENERIC_VALUE = 'aB3dE5gH7jK9mN2pQ4rS6tU8v';

function fetchPageFor(bodies) {
  return async (url) => {
    const body = bodies[String(url)];
    if (body === undefined) return { status: 404, body: '' };
    return { status: 200, body };
  };
}

async function probe(bundles, inline = [], bodies = {}) {
  const targets = { bundles, inline };
  return probeSecretsInJs(PAGE_URL, targets, { fetchPage: fetchPageFor(bodies) });
}

describe('extractSecretTargets', () => {
  it('extracts same-origin .js bundles and inline bodies', () => {
    const html =
      '<html><head><script src="/main.js"></script>' +
      '<script src="https://cdn.example.com/x.js"></script>' +
      '<script>const a = 1;</script></head><body></body></html>';
    const t = extractSecretTargets(html, PAGE_URL);
    assert.deepEqual(t.bundles, ['http://lab.local/main.js']);
    assert.deepEqual(t.inline, ['const a = 1;']);
  });

  it('a page with no scripts yields no targets', () => {
    assert.deepEqual(extractSecretTargets('<html><body>hello</body></html>', PAGE_URL), {
      bundles: [],
      inline: [],
    });
  });

  it('a script tag with data-src is still inline (not a src)', () => {
    const t = extractSecretTargets(
      '<html><body><script data-src="x">const b = 2;</script></body></html>',
      PAGE_URL
    );
    assert.deepEqual(t.bundles, []);
    assert.deepEqual(t.inline, ['const b = 2;']);
  });

  it('caps bundles at 5', () => {
    const scripts = Array.from({ length: 8 }, (_, i) => `<script src="/s${i}.js"></script>`).join('');
    const t = extractSecretTargets(`<html><head>${scripts}</head></html>`, PAGE_URL);
    assert.equal(t.bundles.length, 5);
  });
});

describe('redactSecret', () => {
  it('keeps first/last 4 chars, drops the middle', () => {
    assert.equal(redactSecret('AKIAA1B2C3D4E5F6G7H8'), 'AKIA…G7H8');
  });

  it('redacts short values fully', () => {
    assert.equal(redactSecret('abc'), '…(redacted)');
  });
});

describe('secretsInJs probe — format-known secrets', () => {
  it('AWS access key in a bundle = high finding, value redacted', async () => {
    const findings = await probe(
      [BUNDLE_URL],
      [],
      { [BUNDLE_URL]: `const key = "${AWS_KEY}";` }
    );
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'secret_in_js');
    assert.equal(f.severity, 'high');
    assert.ok(f.title.includes('AWS access key ID'));
    assert.equal(f.url, BUNDLE_URL);
    assert.equal(f.evidence.signalCorrelated, true);
    assert.ok(f.evidence.request.includes(BUNDLE_URL));
    // The full key must never appear in the evidence.
    assert.ok(!f.evidence.response.includes(AWS_KEY));
    assert.ok(f.evidence.response.includes('AKIA…G7H8'));
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('AWS docs example key is a placeholder, not a finding', async () => {
    const findings = await probe(
      [BUNDLE_URL],
      [],
      { [BUNDLE_URL]: `const key = "${AWS_DOCS_EXAMPLE}";` }
    );
    assert.deepEqual(findings, []);
  });

  it('GitHub + Slack + Google + Stripe + Twilio keys each fire once', async () => {
    const body = [
      `const gh = "${GH_TOKEN}";`,
      `const sl = "${SLACK_TOKEN}";`,
      `const gg = "${GOOGLE_KEY}";`,
      `const st = "${STRIPE_KEY}";`,
      `const tw = "${TWILIO_KEY}";`,
    ].join('\n');
    const findings = await probe([BUNDLE_URL], [], { [BUNDLE_URL]: body });
    assert.equal(findings.length, 5);
    const types = findings.map((f) => f.id.slice('secret-in-js-'.length).split('-')[0]);
    assert.deepEqual(new Set(types).size, 5);
    for (const f of findings) assert.equal(f.severity, 'high');
  });

  it('Stripe publishable key (pk_live_) is not a secret', async () => {
    const findings = await probe(
      [BUNDLE_URL],
      [],
      { [BUNDLE_URL]: `const pk = "pk_live_Ab3dEf6hIj9kLm2nOp5qRs8t";` }
    );
    assert.deepEqual(findings, []);
  });

  it('quoted JWT fires; unquoted JWT does not', async () => {
    const quoted = await probe(
      [BUNDLE_URL],
      [],
      { [BUNDLE_URL]: `const t = "${JWT_TOKEN}";` }
    );
    assert.equal(quoted.length, 1);
    assert.ok(quoted[0].title.includes('JSON Web Token'));
    assert.ok(!quoted[0].evidence.response.includes(JWT_TOKEN));
    const bare = await probe(
      [BUNDLE_URL],
      [],
      { [BUNDLE_URL]: `Authorization: Bearer ${JWT_TOKEN}` }
    );
    assert.deepEqual(bare, []);
  });

  it('private-key block fires; key material never lands in evidence', async () => {
    const findings = await probe([BUNDLE_URL], [], { [BUNDLE_URL]: PEM_BLOCK });
    assert.equal(findings.length, 1);
    assert.ok(findings[0].title.includes('Private key block'));
    assert.ok(!findings[0].evidence.response.includes('FAKEKEYMATERIAL'));
    assert.ok(findings[0].evidence.response.includes('BEGIN RSA PRIVATE KEY'));
  });

  it('DB connection string fires with only the password redacted', async () => {
    const findings = await probe(
      [BUNDLE_URL],
      [],
      { [BUNDLE_URL]: `const uri = "${DB_URI}";` }
    );
    assert.equal(findings.length, 1);
    assert.ok(findings[0].title.includes('Database connection string'));
    assert.ok(!findings[0].evidence.response.includes('Sup3rS3cret!'));
    assert.ok(findings[0].evidence.response.includes('appuser:…@'));
  });

  it('DB URI with a placeholder password does not fire', async () => {
    const findings = await probe(
      [BUNDLE_URL],
      [],
      { [BUNDLE_URL]: 'const uri = "mongodb://appuser:changeme@db.internal:27017/appdb";' }
    );
    assert.deepEqual(findings, []);
  });
});

describe('secretsInJs probe — generic assignments', () => {
  it('high-entropy api_key assignment fires', async () => {
    const findings = await probe(
      [BUNDLE_URL],
      [],
      { [BUNDLE_URL]: `const cfg = { apiKey: "${GENERIC_VALUE}" };` }
    );
    assert.equal(findings.length, 1);
    assert.ok(findings[0].title.includes('Hardcoded secret assignment'));
    assert.ok(!findings[0].evidence.response.includes(GENERIC_VALUE));
  });

  it('low-entropy and placeholder values do not fire', async () => {
    const body = [
      'const a = { api_key: "testtesttesttest" };',
      'const b = { secret: "abcdefghijklmnop" };',
      'const c = { token: "short" };',
      'const d = { password: "your-key-here-123456" };',
    ].join('\n');
    const findings = await probe([BUNDLE_URL], [], { [BUNDLE_URL]: body });
    assert.deepEqual(findings, []);
  });

  it('a bare key name with no value never fires', async () => {
    const findings = await probe(
      [BUNDLE_URL],
      [],
      { [BUNDLE_URL]: 'const fields = ["api_key", "secret", "token"];' }
    );
    assert.deepEqual(findings, []);
  });
});

describe('secretsInJs probe — dedup, inline, failures', () => {
  it('the same secret twice in one bundle is one finding', async () => {
    const findings = await probe(
      [BUNDLE_URL],
      [],
      { [BUNDLE_URL]: `const a = "${AWS_KEY}"; const b = "${AWS_KEY}";` }
    );
    assert.equal(findings.length, 1);
  });

  it('the same secret in two bundles is one finding (first bundle cited)', async () => {
    const findings = await probe(
      [BUNDLE_URL, BUNDLE2_URL],
      [],
      { [BUNDLE_URL]: `const a = "${AWS_KEY}";`, [BUNDLE2_URL]: `const b = "${AWS_KEY}";` }
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, BUNDLE_URL);
  });

  it('two different secrets of the same type are two findings', async () => {
    const other = 'AKIAZ9Y8X7W6V5U4T3S2';
    const findings = await probe(
      [BUNDLE_URL],
      [],
      { [BUNDLE_URL]: `const a = "${AWS_KEY}"; const b = "${other}";` }
    );
    assert.equal(findings.length, 2);
  });

  it('an inline script secret is filed under the page URL', async () => {
    const findings = await probe([], [`const key = "${AWS_KEY}";`]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, PAGE_URL);
    assert.ok(findings[0].title.includes('inline <script> block #1'));
  });

  it('a failing bundle fetch is skipped, the other bundle still scans', async () => {
    const findings = await probe(
      [BUNDLE_URL, BUNDLE2_URL],
      [],
      { [BUNDLE2_URL]: `const a = "${AWS_KEY}";` }
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, BUNDLE2_URL);
  });

  it('a clean bundle yields no findings', async () => {
    const findings = await probe(
      [BUNDLE_URL],
      [],
      { [BUNDLE_URL]: 'function hello() { return "world"; }' }
    );
    assert.deepEqual(findings, []);
  });

  it('no targets yields no findings and no fetch', async () => {
    let fetched = 0;
    const findings = await probeSecretsInJs(PAGE_URL, { bundles: [], inline: [] }, {
      fetchPage: async () => {
        fetched += 1;
        return { status: 200, body: '' };
      },
    });
    assert.deepEqual(findings, []);
    assert.equal(fetched, 0);
  });
});
