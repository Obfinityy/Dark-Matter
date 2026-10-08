/**
 * chainService.js
 *
 * Vulnerability chaining: single findings are worth a payout; chained
 * findings are worth a career. This service finds pairs of confirmed
 * findings that an elite hunter would combine into one higher-impact
 * attack, and proposes them as chain candidates with escalated severity.
 *
 * Two sources of chains:
 *   1. Auto-suggested — heuristic analysis over confirmed findings:
 *      same asset + complementary weakness classes.
 *   2. Brain-proposed — the agent files a finding with category
 *      'vulnerability-chain' and chainOf: [findingIds]; validated here.
 *
 * A chain is stored as a finding (category 'vulnerability-chain') so it
 * flows through the same lifecycle, evidence, and report pipeline.
 */

import { randomUUID } from 'node:crypto';

// Pairs of weakness classes that combine into something bigger than the sum.
// Keep this curated: every pair here is a classic real-world chain.
const COMPLEMENTARY = [
  ['xss', 'csrf'],
  ['xss', 'open-redirect'],
  ['xss', 'clickjacking'],
  ['idor', 'broken-access-control'],
  ['idor', 'auth-bypass'],
  ['sqli', 'auth-bypass'],
  ['sqli', 'idor'],
  ['ssrf', 'info-disclosure'],
  ['ssrf', 'idor'],
  ['csrf', 'idor'],
  ['open-redirect', 'xss'],
  ['xxe', 'ssrf'],
  ['lfi', 'rce'],
  ['ssti', 'rce'],
  ['auth-bypass', 'broken-access-control'],
  ['idor', 'csrf'],
  ['xss', 'idor'],
];

const SEVERITY_RANK = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
const RANK_SEVERITY = ['info', 'low', 'medium', 'high', 'critical'];

function normalizeCategory(category) {
  return String(category || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isComplementary(catA, catB) {
  const a = normalizeCategory(catA);
  const b = normalizeCategory(catB);
  if (!a || !b || a === b) return false;
  return COMPLEMENTARY.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

function assetOf(finding) {
  return (
    finding.target || finding.endpoint || (finding.metadata && finding.metadata.asset) || 'target'
  );
}

function escalate(severityA, severityB) {
  const rank = Math.max(SEVERITY_RANK[severityA] ?? 0, SEVERITY_RANK[severityB] ?? 0);
  return RANK_SEVERITY[Math.min(4, rank + 1)];
}

function chainNarrative(a, b, asset) {
  return (
    `Chained attack on ${asset}: ` +
    `"${a.title || a.category}" combined with "${b.title || b.category}". ` +
    `On its own each finding has limited impact, but together they form a complete attack path — ` +
    `the first weakness provides the foothold and the second turns it into real impact. ` +
    `This is the kind of chain that earns higher bounties because it demonstrates end-to-end compromise rather than an isolated issue.`
  );
}

/**
 * Analyze confirmed findings and propose chain candidates.
 *
 * @param {Array} findings - confirmed findings for one job
 * @param {Array} existingChains - already-recorded chains (avoid duplicates)
 * @returns {Array} chain candidate objects (not yet persisted)
 */
function suggestChains(findings, existingChains = []) {
  const confirmed = (findings || []).filter(
    f => f.status === 'confirmed' && f.category !== 'vulnerability-chain'
  );
  const seen = new Set(
    (existingChains || []).flatMap(c => (c.metadata && c.metadata.chainOf) || [])
  );

  const candidates = [];
  for (let i = 0; i < confirmed.length; i += 1) {
    for (let j = i + 1; j < confirmed.length; j += 1) {
      const a = confirmed[i];
      const b = confirmed[j];
      if (seen.has(a.id) || seen.has(b.id)) continue;
      if (assetOf(a) !== assetOf(b)) continue;
      if (!isComplementary(a.category, b.category)) continue;

      const severity = escalate(a.severity, b.severity);
      candidates.push({
        id: randomUUID(),
        category: 'vulnerability-chain',
        title: `Chained: ${a.title || a.category} → ${b.title || b.category}`,
        severity,
        description: chainNarrative(a, b, assetOf(a)),
        target: a.target || b.target || null,
        endpoint: a.endpoint || b.endpoint || null,
        metadata: {
          chainOf: [a.id, b.id],
          autoSuggested: true,
          componentSeverities: [a.severity, b.severity],
        },
        reproductionSteps: [
          `Exploit "${a.title || a.category}" as described in its report to gain the initial foothold.`,
          `From that position, exploit "${b.title || b.category}" as described in its report.`,
          'Observe the combined impact: the full attack path is now complete.',
        ],
        impact: `Combined impact exceeds either finding alone — rated ${severity.toUpperCase()} because the chain demonstrates end-to-end compromise.`,
        remediation:
          'Fixing either finding breaks this chain, but both should be remediated: patch each weakness per its individual report.',
      });
    }
  }
  return candidates;
}

/**
 * Validate a brain-proposed chain: every referenced finding must exist on
 * the same job and be confirmed. Returns the chain finding object, or
 * throws with a clear reason.
 */
function buildBrainChain({ jobId, chain, findingsById }) {
  const ids = Array.isArray(chain.chainOf) ? chain.chainOf : [];
  if (ids.length < 2) {
    throw new Error('A chain must reference at least two findings (chainOf).');
  }
  const parts = ids.map(id => {
    const f = findingsById.get(id);
    if (!f) throw new Error(`Chain references unknown finding: ${id}`);
    if (String(f.jobId || f.assessmentId) !== String(jobId)) {
      throw new Error(`Chain references a finding from another hunt: ${id}`);
    }
    if (f.status !== 'confirmed') {
      throw new Error(`Chain references an unconfirmed finding: ${id}`);
    }
    return f;
  });

  const severity = parts.map(p => p.severity).reduce((acc, s) => escalate(acc, s), 'low');

  return {
    id: randomUUID(),
    category: 'vulnerability-chain',
    title: chain.title || `Chained: ${parts.map(p => p.title || p.category).join(' → ')}`,
    severity,
    description: chain.description || chainNarrative(parts[0], parts[1], assetOf(parts[0])),
    target: chain.target || parts[0].target || null,
    endpoint: chain.endpoint || parts[0].endpoint || null,
    reproductionSteps: chain.reproductionSteps || parts.flatMap(p => p.reproductionSteps || []),
    impact:
      chain.impact ||
      `Combined impact of ${parts.length} chained findings — rated ${severity.toUpperCase()}.`,
    remediation:
      chain.remediation ||
      'Remediate each chained finding per its individual report; fixing any one link breaks the chain.',
    metadata: {
      chainOf: ids,
      autoSuggested: false,
      componentSeverities: parts.map(p => p.severity),
    },
  };
}

export { suggestChains, buildBrainChain, isComplementary, escalate, COMPLEMENTARY };
