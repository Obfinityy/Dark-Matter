/**
 * programScopeService.test.js — bounty program URL detection + scope extraction.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectProgramUrl, resolveProgramScope } from '../src/services/programScopeService.js';

describe('detectProgramUrl', () => {
  it('detects HackerOne program pages', () => {
    const r = detectProgramUrl('https://hackerone.com/shopify');
    assert.equal(r?.platform, 'hackerone');
    assert.equal(r?.program, 'shopify');
  });

  it('detects Bugcrowd engagements', () => {
    const r = detectProgramUrl('https://bugcrowd.com/engagements/acme-corp');
    assert.equal(r?.platform, 'bugcrowd');
    assert.equal(r?.program, 'acme-corp');
  });

  it('returns null for ordinary target URLs', () => {
    assert.equal(detectProgramUrl('https://example.com/login'), null);
    assert.equal(detectProgramUrl('https://hackerone.com/'), null);
    assert.equal(detectProgramUrl('not a url'), null);
  });

  it('does not confuse hackerone.com subpaths', () => {
    // /reports/123 is not a program page
    assert.equal(detectProgramUrl('https://hackerone.com/reports/123'), null);
  });
});

describe('resolveProgramScope (mocked fetch)', () => {
  it('extracts in-scope domains and rules from program HTML', async () => {
    const html = `
      <html><body>
      <h2>In Scope</h2>
      <p>Targets: https://app.example.com, https://api.example.com</p>
      <h2>Out of Scope</h2>
      <p>Do not test https://internal.example.com</p>
      <h2>Rules</h2>
      <p>Automated scanning with nuclei is not allowed. No social engineering.</p>
      </body></html>`;
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode(html).buffer,
    });
    try {
      const r = await resolveProgramScope('https://hackerone.com/example');
      assert.equal(r.platform, 'hackerone');
      assert.ok(r.included.includes('app.example.com'), `included: ${r.included}`);
      assert.ok(r.included.includes('api.example.com'), `included: ${r.included}`);
      assert.ok(r.excluded.includes('internal.example.com'), `excluded: ${r.excluded}`);
      assert.ok(!r.included.includes('internal.example.com'));
      assert.equal(r.primaryTarget, 'https://app.example.com');
      assert.ok(Array.isArray(r.rules.forbidden), 'rules parsed');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('throws a helpful error when no targets found', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('<html><body><p>hello</p></body></html>').buffer,
    });
    try {
      await assert.rejects(() => resolveProgramScope('https://hackerone.com/empty'), /in-scope targets/);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('rejects non-program URLs', async () => {
    await assert.rejects(() => resolveProgramScope('https://example.com/'), /Not a recognized/);
  });
});
