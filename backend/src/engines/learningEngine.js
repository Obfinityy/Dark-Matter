/**
 * learningEngine.js — The agent learns from every hunt.
 *
 * Tracks per-target and global patterns:
 *  - Which vulnerability classes appear on which tech stacks
 *  - Which payloads worked (and which were filtered)
 *  - False-positive patterns to avoid next time
 *  - Time-to-first-finding per target type
 *
 * Stored in the database; consulted at hunt start to prioritize checks.
 * This is what makes the agent better than a static scanner — it adapts.
 */

/**
 * Record the outcome of a hunt for future learning.
 */
export function recordHuntOutcome(
  store,
  { target, techStack = [], findings = [], durationMs = 0, falsePositives = 0 }
) {
  const entry = {
    target,
    techStack,
    findingTypes: findings.map(f => f.type),
    findingCount: findings.length,
    falsePositives,
    durationMs,
    at: new Date().toISOString(),
  };
  store.push(entry);
  // Keep last 200 hunts.
  while (store.length > 200) store.shift();
  return entry;
}

/**
 * Given a tech stack, suggest which checks to prioritize based on history.
 * Returns ordered list of { check, hitRate }.
 */
export function suggestChecks(store, techStack = []) {
  const relevant = store.filter(h =>
    h.techStack.some(t => techStack.map(x => x.toLowerCase()).includes(t.toLowerCase()))
  );
  if (relevant.length === 0) {
    // No history — default priority order.
    return [
      { check: 'SQL Injection', hitRate: null, reason: 'default priority' },
      { check: 'XSS', hitRate: null, reason: 'default priority' },
      { check: 'SSRF', hitRate: null, reason: 'default priority' },
      { check: 'IDOR', hitRate: null, reason: 'default priority' },
      { check: 'Sensitive Exposure', hitRate: null, reason: 'default priority' },
    ];
  }
  const hits = {};
  const totals = {};
  for (const h of relevant) {
    for (const t of h.findingTypes) {
      hits[t] = (hits[t] || 0) + 1;
    }
    totals.count = (totals.count || 0) + 1;
  }
  return Object.entries(hits)
    .map(([check, count]) => ({
      check,
      hitRate: Math.round((count / relevant.length) * 100) / 100,
      reason: `hit ${count}/${relevant.length} similar targets`,
    }))
    .sort((a, b) => b.hitRate - a.hitRate);
}

/**
 * Learn from a confirmed false positive — remember the pattern.
 */
export function recordFalsePositive(fpStore, { type, urlPattern, reason }) {
  fpStore.push({ type, urlPattern, reason, at: new Date().toISOString() });
  while (fpStore.length > 500) fpStore.shift();
}

/**
 * Check if a finding matches a known FP pattern.
 */
export function isKnownFalsePositive(fpStore, finding = {}) {
  return fpStore.some(
    fp => fp.type === finding.type && String(finding.url || '').includes(fp.urlPattern || '')
  );
}

export const LEARNING_ENGINE = {
  recordHuntOutcome,
  suggestChecks,
  recordFalsePositive,
  isKnownFalsePositive,
};
export default LEARNING_ENGINE;
