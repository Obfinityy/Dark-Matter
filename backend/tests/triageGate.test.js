/**
 * Tests for the Triage Gate (backend/src/engines/triageGate.js):
 * the 5-check validation pipeline every finding must pass.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  triageFinding,
  triageFindingAsync,
  triageBatch,
  triageBatchAsync,
} from '../src/engines/triageGate.js';

const STRONG_FINDING = {
  type: 'SQL Injection',
  url: 'https://app.example.com/api/users?id=1',
  param: 'id',
  confidence: 'high',
  evidence:
    "HTTP/1.1 500 Internal Server Error. Response body contains " +
    "'You have an error in your SQL syntax; check the manual that corresponds " +
    "to your MySQL server version' after injecting id=1'. Database error " +
    "disclosed table names: users, sessions. status: 500 vs 200 baseline.",
  impact: 'high',
  reproduced: true,
};

const CTX = {
  scope: { allowedDomains: ['example.com'] },
  existingFindings: [],
};

function checkByName(result, name) {
  return result.checks.find((c) => c.name === name);
}

describe('triageFinding — happy path', () => {
  it('passes a strong, in-scope, reproduced finding with score 100', () => {
    const r = triageFinding(STRONG_FINDING, CTX);
    assert.equal(r.passed, true);
    assert.equal(r.checks.length, 5);
    assert.ok(r.checks.every((c) => c.passed));
    assert.equal(r.score, 100);
  });

  it('each check carries name, passed, reason', () => {
    const r = triageFinding(STRONG_FINDING, CTX);
    for (const c of r.checks) {
      assert.ok(typeof c.name === 'string' && c.name.length > 0);
      assert.equal(typeof c.passed, 'boolean');
      assert.ok(typeof c.reason === 'string' && c.reason.length > 0);
    }
  });
});

describe('scope check', () => {
  it('fails out-of-scope hosts', () => {
    const r = triageFinding({ ...STRONG_FINDING, url: 'https://evil.com/x' }, CTX);
    assert.equal(r.passed, false);
    const c = checkByName(r, 'scope');
    assert.equal(c.passed, false);
    assert.match(c.reason, /not in allowed scope/);
  });

  it('matches subdomains of an allowed domain', () => {
    const r = triageFinding({ ...STRONG_FINDING, url: 'https://sub.app.example.com/x' }, CTX);
    assert.equal(checkByName(r, 'scope').passed, true);
  });

  it('rejects suffix-spoofed domains (evilexample.com)', () => {
    const r = triageFinding({ ...STRONG_FINDING, url: 'https://evilexample.com/x' }, CTX);
    assert.equal(checkByName(r, 'scope').passed, false);
  });

  it('rejects forbidden paths', () => {
    const ctx = { scope: { allowedDomains: ['example.com'], forbiddenPaths: [/^\/logout/] } };
    const r = triageFinding({ ...STRONG_FINDING, url: 'https://app.example.com/logout' }, ctx);
    assert.equal(checkByName(r, 'scope').passed, false);
  });

  it('enforces allowedPaths when configured', () => {
    const ctx = { scope: { allowedDomains: ['example.com'], allowedPaths: [/^\/api\//] } };
    const bad = triageFinding({ ...STRONG_FINDING, url: 'https://app.example.com/admin' }, ctx);
    assert.equal(checkByName(bad, 'scope').passed, false);
    const good = triageFinding({ ...STRONG_FINDING, url: 'https://app.example.com/api/users' }, ctx);
    assert.equal(checkByName(good, 'scope').passed, true);
  });

  it('fails when the finding has no parseable URL', () => {
    const r = triageFinding({ ...STRONG_FINDING, url: undefined }, CTX);
    assert.equal(checkByName(r, 'scope').passed, false);
  });

  it('passes with a note when no scope is configured', () => {
    const r = triageFinding(STRONG_FINDING, {});
    const c = checkByName(r, 'scope');
    assert.equal(c.passed, true);
    assert.match(c.reason, /assumed in scope/);
  });
});

describe('duplicate check', () => {
  it('rejects the same type + location + parameter', () => {
    const ctx = { ...CTX, existingFindings: [STRONG_FINDING] };
    const r = triageFinding({ ...STRONG_FINDING }, ctx);
    const c = checkByName(r, 'duplicate');
    assert.equal(c.passed, false);
    assert.match(c.reason, /duplicate/);
  });

  it('accepts the same type at a different parameter', () => {
    const ctx = { ...CTX, existingFindings: [STRONG_FINDING] };
    const r = triageFinding({ ...STRONG_FINDING, param: 'q' }, ctx);
    assert.equal(checkByName(r, 'duplicate').passed, true);
  });

  it('accepts a different vuln type at the same location', () => {
    const ctx = { ...CTX, existingFindings: [STRONG_FINDING] };
    const r = triageFinding({ ...STRONG_FINDING, type: 'Cross-Site Scripting (XSS)' }, ctx);
    assert.equal(checkByName(r, 'duplicate').passed, true);
  });

  it('normalizes host case and trailing slashes when deduping', () => {
    const ctx = { ...CTX, existingFindings: [{ ...STRONG_FINDING, url: 'https://APP.example.com/api/users/' }] };
    const r = triageFinding({ ...STRONG_FINDING, url: 'https://app.example.com/api/users' }, ctx);
    assert.equal(checkByName(r, 'duplicate').passed, false);
  });
});

describe('evidence check', () => {
  it('fails thin evidence', () => {
    const r = triageFinding({ ...STRONG_FINDING, evidence: 'xss found' }, CTX);
    const c = checkByName(r, 'evidence');
    assert.equal(c.passed, false);
    assert.match(c.reason, /too thin/);
  });

  it('fails generic pattern-matching labels', () => {
    const r = triageFinding({ ...STRONG_FINDING, evidence: 'SQL error signature' }, CTX);
    assert.equal(checkByName(r, 'evidence').passed, false);
  });

  it('passes strong evidence with full weight', () => {
    const c = checkByName(triageFinding(STRONG_FINDING, CTX), 'evidence');
    assert.equal(c.passed, true);
    assert.equal(c.score, 30);
  });

  it('passes thin-but-real evidence with partial weight', () => {
    const f = { ...STRONG_FINDING, evidence: 'Response changed from 200 to 500 with database error text shown.' };
    const c = checkByName(triageFinding(f, CTX), 'evidence');
    assert.equal(c.passed, true);
    assert.equal(c.score, 15);
  });
});

describe('impact check', () => {
  it('kills theoretical findings fast', () => {
    const f = {
      type: 'SSRF candidate',
      url: 'https://app.example.com/fetch?url=x',
      evidence: 'The url parameter looks like it could be used for SSRF — it accepts URLs.',
      reproduced: true,
    };
    const r = triageFinding(f, CTX);
    assert.equal(checkByName(r, 'impact').passed, false);
  });

  it('kills self-XSS and missing-header hardening notes', () => {
    const selfXss = {
      type: 'Cross-Site Scripting (XSS)',
      url: 'https://app.example.com/profile',
      evidence: 'Payload executes only for the attacker in their own profile — self-XSS, no other user affected. Confirmed in response body with 200 status.',
      reproduced: true,
    };
    assert.equal(checkByName(triageFinding(selfXss, CTX), 'impact').passed, false);

    const headers = {
      type: 'Missing security headers',
      url: 'https://app.example.com/',
      evidence: 'Response is missing X-Frame-Options and Content-Security-Policy headers. Verified on HTTP/1.1 200 response across three page loads.',
      reproduced: true,
    };
    assert.equal(checkByName(triageFinding(headers, CTX), 'impact').passed, false);
  });

  it('passes demonstrated real-user impact with full weight', () => {
    const c = checkByName(triageFinding(STRONG_FINDING, CTX), 'impact');
    assert.equal(c.passed, true);
    assert.equal(c.score, 25);
  });

  it('respects an explicit theoretical impact declaration', () => {
    const f = { ...STRONG_FINDING, impact: 'theoretical' };
    assert.equal(checkByName(triageFinding(f, CTX), 'impact').passed, false);
  });

  it('scores plausible impact below demonstrated impact', () => {
    const f = {
      ...STRONG_FINDING,
      impact: undefined,
      evidence:
        'Time-based blind injection confirmed: SLEEP(5) delays response by 5120ms ' +
        'consistently across 5 runs. HTTP/1.1 200. No data extracted yet.',
    };
    const c = checkByName(triageFinding(f, CTX), 'impact');
    assert.equal(c.passed, true);
    assert.equal(c.score, 15);
  });
});

describe('reproducibility check', () => {
  it('passes when reproduction is already recorded', () => {
    const c = checkByName(triageFinding(STRONG_FINDING, CTX), 'reproducibility');
    assert.equal(c.passed, true);
    assert.equal(c.score, 25);
  });

  it('passes with a replay artifact (curl/steps)', () => {
    const f = { ...STRONG_FINDING, reproduced: undefined, replay: { curl: "curl 'https://app.example.com/api/users?id=1%27'" } };
    const c = checkByName(triageFinding(f, CTX), 'reproducibility');
    assert.equal(c.passed, true);
    assert.equal(c.score, 20);
  });

  it('defers honestly when no hook and no artifact', () => {
    const f = { ...STRONG_FINDING, reproduced: undefined, replay: undefined };
    const c = checkByName(triageFinding(f, CTX), 'reproducibility');
    assert.equal(c.passed, true);
    assert.equal(c.deferred, true);
    assert.match(c.reason, /replay pipeline/);
  });

  it('uses a sync reproduce hook verdict', () => {
    const okCtx = { ...CTX, reproduce: () => true };
    assert.equal(checkByName(triageFinding(STRONG_FINDING, okCtx), 'reproducibility').passed, true);

    const noCtx = { ...CTX, reproduce: () => ({ reproduced: false }) };
    const r = triageFinding(STRONG_FINDING, noCtx);
    assert.equal(checkByName(r, 'reproducibility').passed, false);
    assert.equal(r.passed, false);
  });

  it('fails when the reproduce hook throws', () => {
    const ctx = { ...CTX, reproduce: () => { throw new Error('network down'); } };
    const r = triageFinding(STRONG_FINDING, ctx);
    assert.equal(checkByName(r, 'reproducibility').passed, false);
  });
});

describe('triageBatch', () => {
  it('splits passed and rejected with failed checks', () => {
    const good = { ...STRONG_FINDING };
    const bad = { ...STRONG_FINDING, url: 'https://evil.com/x' };
    const r = triageBatch([good, bad], CTX);
    assert.equal(r.passed.length, 1);
    assert.equal(r.rejected.length, 1);
    assert.equal(r.rejected[0].finding.url, 'https://evil.com/x');
    assert.ok(r.rejected[0].failedChecks.some((c) => c.name === 'scope'));
  });

  it('catches intra-batch duplicates progressively', () => {
    const a = { ...STRONG_FINDING };
    const b = { ...STRONG_FINDING }; // identical
    const r = triageBatch([a, b], CTX);
    assert.equal(r.passed.length, 1);
    assert.equal(r.rejected.length, 1);
    assert.ok(r.rejected[0].failedChecks.some((c) => c.name === 'duplicate'));
  });

  it('handles empty and invalid input', () => {
    assert.deepEqual(triageBatch([], CTX), { passed: [], rejected: [] });
    assert.deepEqual(triageBatch(null, CTX), { passed: [], rejected: [] });
  });
});

describe('async variants', () => {
  it('triageFindingAsync awaits an async reproduce hook', async () => {
    const okCtx = { ...CTX, reproduce: async () => ({ reproduced: true, note: 'clean session' }) };
    const ok = await triageFindingAsync(STRONG_FINDING, okCtx);
    assert.equal(ok.passed, true);
    assert.equal(checkByName(ok, 'reproducibility').score, 25);

    const noCtx = { ...CTX, reproduce: async () => false };
    const no = await triageFindingAsync(STRONG_FINDING, noCtx);
    assert.equal(no.passed, false);
  });

  it('triageBatchAsync processes a batch', async () => {
    const ctx = { ...CTX, reproduce: async () => true };
    const r = await triageBatchAsync([{ ...STRONG_FINDING }], ctx);
    assert.equal(r.passed.length, 1);
    assert.equal(r.rejected.length, 0);
  });
});

describe('score semantics', () => {
  it('perfect finding scores 100, weak-but-passing scores below 100', () => {
    assert.equal(triageFinding(STRONG_FINDING, CTX).score, 100);
    const weakish = {
      ...STRONG_FINDING,
      reproduced: undefined,
      replay: undefined, // deferred reproducibility: 10 instead of 25
      impact: 'low',     // low impact: 8 instead of 25
    };
    const r = triageFinding(weakish, CTX);
    assert.equal(r.passed, true);
    assert.ok(r.score < 100);
    assert.equal(r.score, 10 + 10 + 30 + 8 + 10); // scope+dup+evidence+impact+repro
  });

  it('score is clamped to 0-100', () => {
    const r = triageFinding({}, {});
    assert.ok(r.score >= 0 && r.score <= 100);
  });
});
