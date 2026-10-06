/**
 * vulnChainReasoner.test.js — multi-hop vulnerability chain reasoning.
 *
 * Run: cd backend && node --test tests/vulnChainReasoner.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  reasonChains,
  explainChain,
  classifyFinding,
} from '../src/engines/vulnChainReasoner.js';

function finding(overrides = {}) {
  return {
    id: overrides.id || `f-${Math.random().toString(36).slice(2, 8)}`,
    title: overrides.title || 'finding',
    category: overrides.category || 'misc',
    severity: overrides.severity || 'medium',
    status: overrides.status || 'confirmed',
    target: overrides.target || 'https://target.test',
    confidence: overrides.confidence ?? 0.9,
    ...overrides,
  };
}

describe('classifyFinding', () => {
  it('maps alias spellings to canonical classes', () => {
    assert.equal(classifyFinding(finding({ title: 'Stored XSS in comment field' })), 'xss');
    assert.equal(classifyFinding(finding({ title: 'Cross-Site Scripting (reflected)' })), 'xss');
    assert.equal(classifyFinding(finding({ category: 'sqli', title: 'login' })), 'sqli');
    assert.equal(classifyFinding(finding({ title: 'JWT alg=none accepted' })), 'jwt-weakness');
    assert.equal(classifyFinding(finding({ title: 'Missing rate limiting on /api/users' })), 'rate-limit');
    assert.equal(classifyFinding(finding({ title: 'Verbose stack trace leaks paths' })), 'info-disclosure');
  });

  it('prefers the most specific alias', () => {
    // "dom-based xss" is more specific than bare "xss" — still xss either way,
    // but a distinct class must not steal it.
    assert.equal(classifyFinding(finding({ title: 'DOM-based XSS via location.hash' })), 'xss');
  });

  it('returns null when nothing matches', () => {
    assert.equal(classifyFinding(finding({ title: 'TLS certificate expires soon' })), null);
    assert.equal(classifyFinding({}), null);
  });
});

describe('reasonChains — multi-hop reasoning', () => {
  it('finds a 2-hop XSS + weak-session → account-takeover chain', () => {
    const chains = reasonChains([
      finding({ id: 'f1', title: 'Stored XSS in profile bio', severity: 'high' }),
      finding({ id: 'f2', title: 'Session cookie missing HttpOnly', severity: 'medium' }),
    ]);
    const ato = chains.find((c) => c.outcome === 'account-takeover');
    assert.ok(ato, 'expected an account-takeover chain');
    assert.equal(ato.severity, 'critical');
    assert.equal(ato.hops, 2);
    assert.ok(ato.steps.length >= 4, 'narrative steps should be ordered per hop');
    assert.ok(
      ato.assumptions.some((a) => a.includes('victim interaction')),
      'XSS chains must flag the user-interaction assumption'
    );
    assert.deepEqual(
      ato.findings.map((f) => f.id).sort(),
      ['f1', 'f2']
    );
  });

  it('finds a 3-hop info-disclosure → auth-bypass → IDOR → exfiltration chain', () => {
    const chains = reasonChains([
      finding({ id: 'f1', title: 'Verbose errors disclose usernames', severity: 'low' }),
      finding({ id: 'f2', title: 'Authentication bypass on /admin/login', severity: 'high' }),
      finding({ id: 'f3', title: 'IDOR on /api/users/{id}', severity: 'high' }),
    ]);
    const exfil = chains.find((c) => c.outcome === 'data-exfiltration');
    assert.ok(exfil, 'expected a data-exfiltration chain');
    assert.equal(exfil.hops, 3);
    assert.equal(exfil.severity, 'critical');
    assert.ok(exfil.findings.length === 3);
    // Intermediate capabilities must not appear as "findings".
    assert.ok(exfil.findings.every((f) => f.id.startsWith('f')));
  });

  it('returns nothing for a single isolated finding', () => {
    const chains = reasonChains([
      finding({ id: 'f1', title: 'Missing X-Frame-Options header', severity: 'low' }),
    ]);
    assert.equal(chains.length, 0);
  });

  it('does not chain findings across different assets', () => {
    const chains = reasonChains([
      finding({ id: 'f1', title: 'Stored XSS', target: 'https://a.test', severity: 'high' }),
      finding({ id: 'f2', title: 'Session cookie missing HttpOnly', target: 'https://b.test', severity: 'medium' }),
    ]);
    assert.equal(chains.length, 0, 'cross-asset chains are noise');
  });

  it('escalates severity above the strongest single input', () => {
    const chains = reasonChains([
      finding({ id: 'f1', title: 'Open redirect on /go', severity: 'low' }),
      finding({ id: 'f2', title: 'OAuth flow allows wildcard redirect', severity: 'medium' }),
    ]);
    const ato = chains.find((c) => c.outcome === 'account-takeover');
    assert.ok(ato);
    assert.equal(ato.severity, 'critical', 'low+medium inputs must escalate to critical');
  });

  it('discounts confidence for longer chains', () => {
    const three = reasonChains([
      finding({ id: 'f1', title: 'Verbose errors disclose usernames', confidence: 1 }),
      finding({ id: 'f2', title: 'Authentication bypass', confidence: 1 }),
      finding({ id: 'f3', title: 'IDOR on /api/users/{id}', confidence: 1 }),
    ]).find((c) => c.outcome === 'data-exfiltration');
    const two = reasonChains([
      finding({ id: 'f1', title: 'Stored XSS', confidence: 1 }),
      finding({ id: 'f2', title: 'Session cookie missing HttpOnly', confidence: 1 }),
    ]).find((c) => c.outcome === 'account-takeover' && c.hops === 2);
    assert.ok(three && two);
    assert.ok(three.confidence < two.confidence, 'more hops → lower confidence');
    assert.ok(three.confidence > 0.7, 'but still high when every link is certain');
  });

  it('ranks critical outcomes above medium ones', () => {
    const chains = reasonChains([
      finding({ id: 'f1', title: 'Stored XSS', severity: 'high' }),
      finding({ id: 'f2', title: 'Session cookie missing HttpOnly', severity: 'medium' }),
      finding({ id: 'f3', title: 'Clickjacking: no X-Frame-Options', severity: 'low' }),
      finding({ id: 'f4', title: 'Missing CSRF token on /transfer', severity: 'medium' }),
    ]);
    assert.ok(chains.length >= 2);
    assert.ok(chains[0].score >= chains[1].score, 'chains must be score-ordered');
    assert.equal(chains[0].severity, 'critical');
  });

  it('never invents links — every hop needs a real finding', () => {
    const chains = reasonChains([
      finding({ id: 'f1', title: 'Stored XSS', severity: 'high' }),
      // session-weakness deliberately absent: no session-theft hop possible
    ]);
    assert.ok(
      chains.every((c) => c.findings.length > 0),
      'no chain may reference zero findings'
    );
    assert.ok(
      !chains.some((c) => c.id === 'chain-stolen-session-ato' && c.findings.length === 1 && c.findings[0].id === 'f1'),
      'stolen-session hop must not fire without the session finding'
    );
  });

  it('flags unconfirmed links as an assumption', () => {
    const chains = reasonChains([
      finding({ id: 'f1', title: 'Stored XSS', status: 'open', severity: 'high' }),
      finding({ id: 'f2', title: 'Session cookie missing HttpOnly', status: 'confirmed', severity: 'medium' }),
    ]);
    const ato = chains.find((c) => c.outcome === 'account-takeover');
    assert.ok(ato);
    assert.ok(ato.assumptions.some((a) => a.includes('not yet confirmed')));
  });

  it('respects maxHops and maxChains options', () => {
    const findings = [
      finding({ id: 'f1', title: 'Verbose errors disclose usernames' }),
      finding({ id: 'f2', title: 'Authentication bypass' }),
      finding({ id: 'f3', title: 'IDOR on /api/users/{id}' }),
    ];
    const shallow = reasonChains(findings, { maxHops: 2 });
    assert.ok(
      shallow.every((c) => c.hops <= 2),
      'no chain may exceed maxHops'
    );
    const one = reasonChains(findings, { maxChains: 1 });
    assert.equal(one.length, 1);
  });
});

describe('explainChain', () => {
  it('produces a report-ready one-paragraph narrative', () => {
    const chains = reasonChains([
      finding({ id: 'f1', title: 'Stored XSS in profile bio', severity: 'high' }),
      finding({ id: 'f2', title: 'Session cookie missing HttpOnly', severity: 'medium' }),
    ]);
    const text = explainChain(chains[0]);
    assert.ok(text.includes('Account takeover'), 'names the outcome');
    assert.ok(text.includes('CRITICAL'), 'states the rating');
    assert.ok(text.includes('Stored XSS in profile bio'), 'cites the findings');
    assert.ok(text.includes('confidence'), 'states confidence');
  });

  it('returns empty string for no chain', () => {
    assert.equal(explainChain(null), '');
    assert.equal(explainChain(undefined), '');
  });
});
