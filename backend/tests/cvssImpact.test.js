/**
 * Tests for the CVSS + Impact Engine (backend/src/engines/cvssImpact.js).
 *
 * Includes known-answer CVSS 3.1 vectors to prove the formula is the real
 * FIRST specification — not an approximation.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  scoreCVSS,
  cvssRoundUp,
  parseVector,
  describeMetrics,
  suggestMetrics,
  buildImpactStatement,
  impactMultipliers,
  buildSeverityRequest,
  assessFinding,
  SEVERITY_BANDS,
} from '../src/engines/cvssImpact.js';

describe('cvssRoundUp — spec Roundup (not Math.ceil)', () => {
  it('rounds 4.02 up to 4.1', () => {
    assert.equal(cvssRoundUp(4.02), 4.1);
  });

  it('leaves exact values alone (4.0 stays 4.0)', () => {
    assert.equal(cvssRoundUp(4.0), 4.0);
  });

  it('rounds 7.48224278 up to 7.5', () => {
    assert.equal(cvssRoundUp(7.48224278), 7.5);
  });

  it('keeps 10.0 at 10.0', () => {
    assert.equal(cvssRoundUp(10.0), 10.0);
  });
});

describe('scoreCVSS — known-answer vectors (FIRST CVSS 3.1 spec)', () => {
  it('CVE-2021-44228 Log4Shell -> 10.0 Critical', () => {
    const r = scoreCVSS({
      attackVector: 'N', attackComplexity: 'L', privilegesRequired: 'N',
      userInteraction: 'N', scope: 'C', confidentiality: 'H', integrity: 'H', availability: 'H',
    });
    assert.equal(r.score, 10.0);
    assert.equal(r.severity, 'Critical');
    assert.equal(r.vector, 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H');
  });

  it('CVE-2014-3566 POODLE -> 3.4 Low', () => {
    const r = scoreCVSS({
      attackVector: 'N', attackComplexity: 'H', privilegesRequired: 'N',
      userInteraction: 'R', scope: 'C', confidentiality: 'L', integrity: 'N', availability: 'N',
    });
    assert.equal(r.score, 3.4);
    assert.equal(r.severity, 'Low');
  });

  it('IDOR read of PII -> 7.5 High (research reference case)', () => {
    const r = scoreCVSS({
      attackVector: 'N', attackComplexity: 'L', privilegesRequired: 'N',
      userInteraction: 'N', scope: 'U', confidentiality: 'H', integrity: 'N', availability: 'N',
    });
    assert.equal(r.score, 7.5);
    assert.equal(r.severity, 'High');
  });

  it('all-None metrics -> 0.0 None', () => {
    const r = scoreCVSS({
      attackVector: 'N', attackComplexity: 'L', privilegesRequired: 'N',
      userInteraction: 'N', scope: 'U', confidentiality: 'N', integrity: 'N', availability: 'N',
    });
    assert.equal(r.score, 0.0);
    assert.equal(r.severity, 'None');
  });

  it('applies the Scope-Changed PR weighting (PR:L -> 0.68)', () => {
    // Same metrics except Scope: S:C must score 7.7 (not 6.5) because
    // PR:L weighs 0.68 when scope changes.
    const changed = scoreCVSS({
      attackVector: 'N', attackComplexity: 'L', privilegesRequired: 'L',
      userInteraction: 'N', scope: 'C', confidentiality: 'H', integrity: 'N', availability: 'N',
    });
    const unchanged = scoreCVSS({
      attackVector: 'N', attackComplexity: 'L', privilegesRequired: 'L',
      userInteraction: 'N', scope: 'U', confidentiality: 'H', integrity: 'N', availability: 'N',
    });
    assert.equal(changed.score, 7.7);
    assert.equal(unchanged.score, 6.5);
    assert.ok(changed.score > unchanged.score);
  });

  it('SSRF to cloud metadata -> 9.3 Critical', () => {
    const r = scoreCVSS({
      attackVector: 'N', attackComplexity: 'L', privilegesRequired: 'N',
      userInteraction: 'N', scope: 'C', confidentiality: 'H', integrity: 'L', availability: 'N',
    });
    assert.equal(r.score, 9.3);
    assert.equal(r.severity, 'Critical');
  });

  it('SQLi with write access -> 9.1 Critical', () => {
    const r = scoreCVSS({
      attackVector: 'N', attackComplexity: 'L', privilegesRequired: 'N',
      userInteraction: 'N', scope: 'U', confidentiality: 'H', integrity: 'H', availability: 'N',
    });
    assert.equal(r.score, 9.1);
    assert.equal(r.severity, 'Critical');
  });

  it('severity bands follow the CVSS 3.1 scale', () => {
    const labels = SEVERITY_BANDS.map((b) => b.label);
    assert.deepEqual(labels, ['Critical', 'High', 'Medium', 'Low', 'None']);
  });

  it('round-trips through parseVector', () => {
    const metrics = {
      attackVector: 'N', attackComplexity: 'L', privilegesRequired: 'N',
      userInteraction: 'N', scope: 'U', confidentiality: 'H', integrity: 'N', availability: 'N',
    };
    const { vector } = scoreCVSS(metrics);
    assert.deepEqual(parseVector(vector), metrics);
  });

  it('parseVector rejects garbage', () => {
    assert.equal(parseVector('not-a-vector'), null);
    assert.equal(parseVector('CVSS:3.1/AV:N'), null);
  });
});

describe('describeMetrics', () => {
  it('produces human-readable metric lines', () => {
    const lines = describeMetrics({ attackVector: 'N', scope: 'C', confidentiality: 'H' });
    assert.ok(lines.some((l) => l.includes('Network')));
    assert.ok(lines.some((l) => l.includes('Changed')));
    assert.ok(lines.some((l) => l.includes('High')));
  });
});

describe('suggestMetrics', () => {
  it('suggests stored XSS metrics in the research range (5.4-8.8)', () => {
    const s = suggestMetrics({ type: 'Stored XSS' });
    assert.equal(s.cwe, 'CWE-79');
    assert.equal(s.metrics.scope, 'C');
    assert.ok(s.computed.score >= 5.4 && s.computed.score <= 8.8,
      `stored XSS score ${s.computed.score} should be within 5.4-8.8`);
    assert.ok(s.rationale.length > 20);
  });

  it('suggests IDOR read PII at ~6.5 Medium', () => {
    const s = suggestMetrics({ type: 'IDOR' });
    assert.equal(s.cwe, 'CWE-639');
    assert.equal(s.computed.score, 6.5);
    assert.equal(s.computed.severity, 'Medium');
  });

  it('suggests auth bypass at Critical', () => {
    const s = suggestMetrics({ type: 'Authentication Bypass' });
    assert.equal(s.computed.severity, 'Critical');
    assert.ok(s.computed.score >= 9.0);
  });

  it('suggests SSRF metrics with Scope Changed', () => {
    const s = suggestMetrics({ type: 'SSRF' });
    assert.equal(s.cwe, 'CWE-918');
    assert.equal(s.metrics.scope, 'C');
    assert.equal(s.computed.severity, 'Critical');
  });

  it('suggests SQLi with CWE-89 and High severity', () => {
    const s = suggestMetrics({ type: 'SQL Injection' });
    assert.equal(s.cwe, 'CWE-89');
    assert.equal(s.computed.severity, 'High');
  });

  it('falls back conservatively for unknown types', () => {
    const s = suggestMetrics({ type: 'Something Nobody Has Named' });
    assert.equal(s.cwe, 'CWE-200');
    assert.ok(s.computed.score <= 6.0, 'unknown types must not score high');
    assert.match(s.rationale, /conservatively/i);
  });

  it('matches type variants (sql_injection, XSS-STORED)', () => {
    assert.equal(suggestMetrics({ type: 'sql_injection' }).cwe, 'CWE-89');
    assert.equal(suggestMetrics({ type: 'xss-stored' }).cwe, 'CWE-79');
  });
});

describe('buildImpactStatement', () => {
  it('builds a full 4-sentence statement from all slots', () => {
    const text = buildImpactStatement({
      vulnType: 'SQL Injection',
      affectedUsers: 120000,
      dataExposed: 'names, email addresses and password hashes',
      businessContext: 'the checkout flow of a live e-commerce store',
    });
    assert.match(text, /attacker can execute arbitrary SQL/i);
    assert.match(text, /120,000/);
    assert.match(text, /names, email addresses and password hashes/);
    assert.match(text, /regulatory exposure|GDPR/i);
    assert.ok(text.split('.').filter(Boolean).length >= 3);
  });

  it('degrades gracefully with missing slots', () => {
    const text = buildImpactStatement({ vulnType: 'Open Redirect' });
    assert.match(text, /attacker can redirect victims/i);
    assert.ok(text.length > 50);
  });

  it('uses the client-side consequence for XSS', () => {
    const text = buildImpactStatement({ vulnType: 'Stored XSS', affectedUsers: 5000 });
    assert.match(text, /account takeover|session theft/i);
  });

  it('uses the foothold consequence for RCE classes', () => {
    const text = buildImpactStatement({ vulnType: 'SSTI' });
    assert.match(text, /lateral movement|foothold/i);
  });
});

describe('impactMultipliers', () => {
  it('detects chained findings', () => {
    const ms = impactMultipliers({ type: 'XSS', partOfChain: true });
    assert.ok(ms.some((m) => m.id === 'chained' && m.range === '2–5×'));
  });

  it('detects high-value admin targets', () => {
    const ms = impactMultipliers({ type: 'IDOR', url: 'https://target.com/admin/users/123' });
    assert.ok(ms.some((m) => m.id === 'high_value_target' && m.range === '3–10×'));
  });

  it('detects mass user impact at 10k+', () => {
    const ms = impactMultipliers({ type: 'IDOR', affectedUsers: 50000 });
    assert.ok(ms.some((m) => m.id === 'mass_impact'));
    assert.ok(!impactMultipliers({ type: 'IDOR', affectedUsers: 500 }).some((m) => m.id === 'mass_impact'));
  });

  it('detects regulated data exposure', () => {
    const ms = impactMultipliers({ type: 'Sensitive Exposure', dataExposed: 'user PII including health records' });
    assert.ok(ms.some((m) => m.id === 'regulated_data'));
  });

  it('detects RCE classes', () => {
    const ms = impactMultipliers({ type: 'SSTI' });
    assert.ok(ms.some((m) => m.id === 'rce' && m.range === '3–10×'));
  });

  it('detects auth bypass', () => {
    const ms = impactMultipliers({ type: 'Authentication Bypass' });
    assert.ok(ms.some((m) => m.id === 'auth_bypass'));
  });

  it('detects financial transaction impact', () => {
    const ms = impactMultipliers({ type: 'Business Logic', url: 'https://shop.com/checkout' });
    assert.ok(ms.some((m) => m.id === 'financial_tx'));
  });

  it('detects zero-interaction unauthenticated flaws', () => {
    const ms = impactMultipliers({
      type: 'SSRF',
      suggestedMetrics: { metrics: { privilegesRequired: 'N', userInteraction: 'N' } },
    });
    assert.ok(ms.some((m) => m.id === 'zero_interaction_wormable'));
  });

  it('returns an empty list when nothing applies', () => {
    const ms = impactMultipliers({ type: 'Verbose Error', url: 'https://t.com/about' });
    assert.deepEqual(ms, []);
  });
});

describe('buildSeverityRequest', () => {
  it('drafts a vector-grounded severity paragraph', () => {
    const cvss = scoreCVSS({
      attackVector: 'N', attackComplexity: 'L', privilegesRequired: 'N',
      userInteraction: 'N', scope: 'U', confidentiality: 'H', integrity: 'N', availability: 'N',
    });
    const text = buildSeverityRequest({
      cvss,
      platformDefault: 'P4/Medium',
      businessAnchor: 'Confidentiality:High applies to cross-tenant data exposure of 120,000 users',
    });
    assert.match(text, /CVSS:3\.1\/AV:N\/AC:L\/PR:N\/UI:N\/S:U\/C:H\/I:N\/A:N/);
    assert.match(text, /7\.5 High/);
    assert.match(text, /P4\/Medium/);
    assert.match(text, /cross-tenant data exposure/);
  });

  it('throws without a cvss object', () => {
    assert.throws(() => buildSeverityRequest({}), /requires a cvss/);
  });
});

describe('assessFinding — one-call pipeline', () => {
  it('returns cvss, cwe, impact statement, and multipliers together', () => {
    const a = assessFinding({
      type: 'SSRF',
      url: 'https://target.com/admin/fetch?url=',
      affectedUsers: 20000,
      dataExposed: 'cloud credentials',
      businessContext: 'the admin panel',
    });
    assert.equal(a.cvss.severity, 'Critical');
    assert.equal(a.cwe, 'CWE-918');
    assert.ok(a.impactStatement.length > 100);
    assert.ok(a.multipliers.some((m) => m.id === 'high_value_target'));
    assert.ok(a.multipliers.some((m) => m.id === 'mass_impact'));
    assert.ok(a.metricRationale.length > 20);
  });
});
