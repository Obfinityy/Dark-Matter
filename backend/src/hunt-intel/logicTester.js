// Dark Matter hunt-intel — black-box business-logic test generator
// (ORIGINAL IMPLEMENTATION).
//
// Research verdict (round 2, 13 Oct 2026): NO standalone black-box,
// non-LLM business-logic test generator exists. atlas-llm-redteam is
// LLM-prompt-driven; everything else is white-box. This module is the
// original: app-type profiles + invariant oracles over the RESTler-lite
// sequencer's stateful request chains.
//
// Model:
//   1. PROFILE   — classify the target (ecommerce / fintech / saas / generic)
//                  from observed endpoints.
//   2. INVARIANTS — per-profile business rules that must ALWAYS hold, e.g.
//                  "cart total == sum(items) − discounts".
//   3. GENERATE  — abuse-case test sequences from known logic-flaw patterns.
//   4. ORACLE    — any invariant violation is a HIGH finding (no signature
//                  needed — the app contradicts its own rules).

export const APP_PROFILES = {
  ecommerce: {
    match: [/cart/, /checkout/, /product/, /order/, /coupon/, /payment/],
    invariants: [
      { id: 'INV-EC-1', rule: 'cart total == sum(item price × qty) − discounts', check: 'total_consistency' },
      { id: 'INV-EC-2', rule: 'coupon applies at most once per order', check: 'coupon_reuse' },
      { id: 'INV-EC-3', rule: 'price from client must not override server price', check: 'price_tamper' },
      { id: 'INV-EC-4', rule: 'quantity must be positive and within stock', check: 'quantity_abuse' },
    ],
    abuseCases: [
      { id: 'AB-EC-1', title: 'Coupon double-spend (parallel requests)', steps: ['apply coupon A', 'apply coupon A again concurrently', 'compare totals'] },
      { id: 'AB-EC-2', title: 'Price tampering via client-side total', steps: ['intercept checkout request', 'set total=1', 'complete payment'] },
      { id: 'AB-EC-3', title: 'Negative quantity → credit', steps: ['add item qty=-1', 'checkout', 'check balance increased'] },
      { id: 'AB-EC-4', title: 'Currency/decimal truncation', steps: ['set price=0.001', 'checkout', 'verify charged amount'] },
    ],
  },
  fintech: {
    match: [/transfer/, /wallet/, /balance/, /withdraw/, /deposit/, /kyc/],
    invariants: [
      { id: 'INV-FT-1', rule: 'balance never goes negative', check: 'negative_balance' },
      { id: 'INV-FT-2', rule: 'transfer amount debited == amount credited', check: 'amount_consistency' },
      { id: 'INV-FT-3', rule: 'daily limits enforced per user', check: 'limit_bypass' },
      { id: 'INV-FT-4', rule: 'idempotency: same request twice == once', check: 'replay_double_spend' },
    ],
    abuseCases: [
      { id: 'AB-FT-1', title: 'Race-condition double transfer', steps: ['transfer X concurrently ×2', 'sum debits must equal X'] },
      { id: 'AB-FT-2', title: 'Negative/zero amount transfer', steps: ['transfer amount=-100', 'check balances'] },
      { id: 'AB-FT-3', title: 'Limit bypass via structuring', steps: ['split large transfer under the limit', 'total must still cap'] },
    ],
  },
  saas: {
    match: [/subscription/, /plan/, /quota/, /team/, /invite/, /role/],
    invariants: [
      { id: 'INV-SA-1', rule: 'quota enforced (no over-use)', check: 'quota_bypass' },
      { id: 'INV-SA-2', rule: 'role changes require privilege', check: 'role_escalation' },
      { id: 'INV-SA-3', rule: 'cancelled subscription loses access', check: 'cancel_bypass' },
      { id: 'INV-SA-4', rule: 'trial cannot be re-armed', check: 'trial_reuse' },
    ],
    abuseCases: [
      { id: 'AB-SA-1', title: 'Quota bypass via direct API', steps: ['exhaust quota via UI', 'call API directly', 'must reject'] },
      { id: 'AB-SA-2', title: 'Self role-escalation via invite', steps: ['invite self with role=admin', 'accept', 'check role'] },
      { id: 'AB-SA-3', title: 'Trial re-arm via new workspace', steps: ['expire trial', 'create workspace', 'trial must not reset'] },
    ],
  },
  generic: {
    match: [],
    invariants: [
      { id: 'INV-GN-1', rule: 'state transitions are monotonic (no skipping steps)', check: 'workflow_skip' },
      { id: 'INV-GN-2', rule: 'idempotency keys prevent double-processing', check: 'replay' },
    ],
    abuseCases: [
      { id: 'AB-GN-1', title: 'Workflow step skipping', steps: ['call step 3 without step 2', 'must reject'] },
      { id: 'AB-GN-2', title: 'Replay a completed action', steps: ['capture success request', 'replay verbatim', 'must not double-apply'] },
    ],
  },
};

/** Classify a target from observed endpoint paths. */
export function classifyTarget(paths) {
  const joined = (paths || []).join(' ').toLowerCase();
  for (const [name, profile] of Object.entries(APP_PROFILES)) {
    if (name === 'generic') continue;
    if (profile.match.some((re) => re.test(joined))) return name;
  }
  return 'generic';
}

/**
 * Generate logic-flaw test cases for a target.
 * @param {string[]} paths — observed endpoint paths
 * @returns {{appType, invariants, abuseCases}}
 */
export function generateLogicTests(paths) {
  const appType = classifyTarget(paths);
  const profile = APP_PROFILES[appType];
  return {
    appType,
    invariants: profile.invariants,
    abuseCases: profile.abuseCases,
  };
}

/**
 * Invariant oracle: given before/after observations, flag violations.
 * Each check is a pure function returning a finding or null.
 */
export const INVARIANT_CHECKS = {
  total_consistency: ({ items, discounts, total }) => {
    if (!Array.isArray(items) || typeof total !== 'number') return null;
    const expected = items.reduce((s, i) => s + (i.price || 0) * (i.qty || 0), 0) - (discounts || 0);
    if (Math.abs(expected - total) > 0.01) {
      return { class: 'logic_flaw', title: 'Cart total inconsistent with items', severity: 'high',
               detail: `expected ${expected}, got ${total}` };
    }
    return null;
  },
  negative_balance: ({ before, after }) => {
    if (typeof after === 'number' && after < 0) {
      return { class: 'logic_flaw', title: 'Negative balance allowed', severity: 'critical',
               detail: `balance ${before} -> ${after}` };
    }
    return null;
  },
  replay_double_spend: ({ first, second }) => {
    if (first && second && JSON.stringify(first) !== JSON.stringify(second)) {
      // same request, different outcome — check if it double-applied
      return { class: 'logic_flaw', title: 'Non-idempotent action replayed', severity: 'high',
               detail: 'identical request produced different state — possible double-spend' };
    }
    return null;
  },
};

/** Run all invariant checks over an observation; return violations. */
export function checkInvariants(observation) {
  const out = [];
  for (const [id, fn] of Object.entries(INVARIANT_CHECKS)) {
    try {
      const finding = fn(observation);
      if (finding) out.push({ ...finding, invariant: id });
    } catch { /* a broken check never blocks the hunt */ }
  }
  return out;
}
