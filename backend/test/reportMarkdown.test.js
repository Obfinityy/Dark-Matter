/**
 * Hunt report Markdown renderer tests.
 *
 * The archived final report must be submission-quality and HONEST:
 * validated (evidence-backed) findings are separated from unverified
 * observations, and the honesty section must never be faked away.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHuntReportMarkdown } from '../src/services/vulnerabilityReportBuilder.js';

function sampleReport() {
  return {
    title: 'Bug Bounty Assessment Report',
    targetHostname: 'example.com',
    generatedAt: '2026-09-30T00:00:00.000Z',
    executiveSummary: 'One critical finding was validated with evidence.',
    findingsSummary: { critical: 1, high: 0, medium: 1, low: 0, info: 0, total: 2, potential: 1 },
    validatedFindings: [], // not a real report field — see detailedFindings below
    detailedFindings: [
      {
        id: 'f1', title: 'Stored XSS in comment field', severity: 'critical',
        category: 'stored-xss', affectedEndpoint: '/comments',
        description: 'Payload executes in admin panel.',
        evidence: [{ kind: 'http', summary: 'POST /comments returned the payload unescaped', endpoint: '/comments', sha256: 'abc123def4567890' }],
        reproductionSteps: ['Post comment with payload', 'Open admin panel'],
        impact: 'Full admin session theft.',
        remediation: 'Context-appropriate output encoding.',
        cvssMetrics: { baseScore: 9.1, vector: 'CVSS:3.1/AV:N/AC:L/...' }
      },
      {
        id: 'f2', title: 'Verbose server header', severity: 'medium',
        category: 'info-disclosure', affectedEndpoint: '/',
        description: 'Server header leaks version.',
        evidence: [], // edge case: a validated finding without captured evidence
        reproductionSteps: ['curl -I /'],
        remediation: 'Suppress version banner.'
      }
    ],
    unverifiedObservations: [
      { title: 'Possible open redirect', description: 'The ?next= parameter reflects input but was not exploited.' }
    ],
    coverage: { endpointsVisited: 12, formsTested: 3 },
    limitations: 'Rate-limited paths were not brute-forced.'
  };
}

test('renderHuntReportMarkdown: produces a complete, honest report', async () => {
  const md = renderHuntReportMarkdown(sampleReport());

  // Structure
  assert.ok(md.startsWith('# Bug Bounty Assessment Report'));
  assert.ok(md.includes('**Target:** example.com'));
  assert.ok(md.includes('## Executive summary'));
  assert.ok(md.includes('## Findings summary'));
  assert.ok(md.includes('| Critical | 1 |'));

  // Validated findings carry evidence + remediation
  assert.ok(md.includes('### CRITICAL — Stored XSS in comment field'));
  assert.ok(md.includes('POST /comments returned the payload unescaped'), 'evidence summary preserved');
  assert.ok(md.includes('sha256: `abc123def4567890'), 'evidence hash fingerprint preserved');
  assert.ok(md.includes('Context-appropriate output encoding.'));
  assert.ok(md.includes('**CVSS:** 9.1 (Critical)'), 'CVSS auto-rating line present');
  assert.ok(md.includes('**CVSS:** n/a (Medium)'), 'severity-derived rating when no metrics');

  // Unverified observations are separated and labeled honestly — never
  // presented as confirmed vulnerabilities.
  assert.ok(md.includes('Unverified observations'), 'honesty section exists');
  const unverifiedIdx = md.indexOf('Unverified observations');
  const findingIdx = md.indexOf('### CRITICAL — Stored XSS');
  assert.ok(unverifiedIdx > findingIdx, 'observations come after validated findings');
  assert.ok(md.includes('Possible open redirect'));
  assert.ok(md.includes('**Potential (unverified):** 1'));

  // Coverage + limitations
  assert.ok(md.includes('12'), 'coverage numbers present');
  assert.ok(md.includes('Rate-limited paths were not brute-forced.'));
});

test('renderHuntReportMarkdown: degrades gracefully on empty reports', async () => {
  const md = renderHuntReportMarkdown({});
  assert.ok(md.startsWith('# '));
  assert.ok(md.includes('| Critical | 0 |'));
  // No findings → no unverified-observations section header noise, but the
  // document stays valid markdown.
  assert.ok(md.length > 100);
});

test('renderHuntReportMarkdown: pipes in titles do not break tables', async () => {
  const report = sampleReport();
  report.detailedFindings[0].title = 'XSS in a | b field';
  const md = renderHuntReportMarkdown(report);
  // Pipes are legal outside tables — the heading keeps the raw title, and the
  // findings-summary table keeps exactly its 5 severity rows, well-formed.
  assert.ok(md.includes('### CRITICAL — XSS in a | b field'));
  const summaryRows = md.split('\n').filter((line) => /^\| (Critical|High|Medium|Low|Informational) \|/.test(line));
  assert.equal(summaryRows.length, 5, 'summary table intact despite the pipe in a heading');
});
