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
 * @returns {{appType, invariants, abuseCases, blModules}}
 */
export function generateLogicTests(paths) {
  const appType = classifyTarget(paths);
  const profile = APP_PROFILES[appType];
  return {
    appType,
    invariants: profile.invariants,
    abuseCases: profile.abuseCases,
    blModules: blModulesFor(appType),
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

// ---------------------------------------------------------------------------
// BLFinder 21-module business-logic taxonomy (integrated by technique, MIT).
// Each module: detection strategy + canary verification to kill false positives.
// ---------------------------------------------------------------------------

export const BL_MODULES = [
  {
    id: 'BL-01', title: 'Price manipulation',
    strategy: 'Tamper price/total with 10 values: 0, 0.01, -1, 0.001, 999999, null, "free", 1e10, NaN, empty. Compare charged amount vs expected.',
    canary: 'Send a valid price first — if the tampered price is accepted but the valid one is rejected, the endpoint is broken (not vulnerable).',
    severity: 'high',
  },
  {
    id: 'BL-02', title: 'Blind IDOR via oracle detection',
    strategy: 'Swap object IDs across 5 oracles: response size delta, timing delta, status code change, error message difference, redirect target.',
    canary: 'Request your OWN object with a tampered ID format — if oracles fire on your own data, the oracle is unreliable.',
    severity: 'high',
  },
  {
    id: 'BL-03', title: 'Race conditions',
    strategy: '15 concurrent requests on: coupon apply, transfer, vote, claim, redeem. Fintech keywords: transfer, withdraw, payout, refund, credit.',
    canary: 'Single request first — must succeed exactly once. If single request already double-applies, it is a logic bug not a race.',
    severity: 'critical',
  },
  {
    id: 'BL-04', title: 'Mass assignment',
    strategy: 'Auto-discover privilege fields (role, admin, isAdmin, plan, quota) from JS/source-maps; inject into profile/update requests.',
    canary: 'Inject a nonsense field (zz_darkmatter_123) — if it is echoed/stored, the endpoint reflects input (informational only).',
    severity: 'high',
  },
  {
    id: 'BL-05', title: 'State machine abuse',
    strategy: 'Skip workflow steps: call step 3 without step 2; replay completed steps; reverse transitions (cancelled -> active).',
    canary: 'Complete the workflow legitimately once — record the valid transition graph first.',
    severity: 'medium',
  },
  {
    id: 'BL-06', title: 'JWT alg:none / weak key',
    strategy: 'Strip signature (alg:none); try empty secret, "secret", "password"; swap RS256->HS256 with public key as HMAC secret.',
    canary: 'Send a random invalid token — if the server accepts EVERYTHING, auth is disabled (misconfig, not JWT flaw).',
    severity: 'critical',
  },
  {
    id: 'BL-07', title: 'BFLA (Broken Function Level Authorization)',
    strategy: 'Replay admin-only endpoints as low-priv user: user list, config, export, delete. Compare status codes admin vs user.',
    canary: 'Call a public endpoint as both roles — responses must match. If they differ on public endpoints, the comparator is broken.',
    severity: 'high',
  },
  {
    id: 'BL-08', title: 'SSRF (4-tier)',
    strategy: 'Tier 1: basic http://169.254.169.254. Tier 2: redirects. Tier 3: DNS rebinding shapes. Tier 4: cloud metadata paths per provider.',
    canary: 'Request your own collaborator URL first — proves outbound requests work before claiming SSRF.',
    severity: 'critical',
  },
  {
    id: 'BL-09', title: 'CSRF forged-replay',
    strategy: 'Replay state-changing requests without CSRF token, with wrong token, with token from another session.',
    canary: 'Replay a GET (safe method) — must not change state. If it does, the app has bigger problems than CSRF.',
    severity: 'medium',
  },
  {
    id: 'BL-10', title: 'Source-map reconstruction',
    strategy: 'Fetch .js.map files; reconstruct original source; mine for secrets, endpoints, privilege fields.',
    canary: 'None needed — source maps are either exposed or not.',
    severity: 'medium',
  },
  {
    id: 'BL-11', title: 'OTP rate-limit',
    strategy: 'Brute-force OTP with 1000 requests; test resend limits; test OTP reuse after success.',
    canary: 'One valid OTP attempt first — confirms the OTP flow works at all.',
    severity: 'high',
  },
  {
    id: 'BL-12', title: 'Coupon/reward double-spend',
    strategy: 'Apply same coupon concurrently; stack multiple coupons; apply expired coupons by date tampering.',
    canary: 'Apply coupon once legitimately — record the valid discount first.',
    severity: 'high',
  },
  {
    id: 'BL-13', title: 'Quantity tampering',
    strategy: 'Negative, zero, fractional, huge quantities; check stock enforcement and total calculation.',
    canary: 'Add qty=1 first — baseline behavior.',
    severity: 'medium',
  },
  {
    id: 'BL-14', title: 'Currency manipulation',
    strategy: 'Switch currency codes (USD->JPY, ->VND); decimal truncation (0.001); null currency.',
    canary: 'Complete one purchase in default currency first.',
    severity: 'high',
  },
  {
    id: 'BL-15', title: 'Trial/subscription re-arm',
    strategy: 'Re-register with +aliases; create new workspace/org; manipulate trial_end dates.',
    canary: 'None — trial state is server-side.',
    severity: 'medium',
  },
  {
    id: 'BL-16', title: 'IDOR on file/object access',
    strategy: 'Enumerate /files/{id}, /invoices/{id}, /reports/{id} across user boundaries.',
    canary: 'Access your own file with a malformed ID — error shape baseline.',
    severity: 'high',
  },
  {
    id: 'BL-17', title: 'Password reset poisoning',
    strategy: 'Host header injection on reset links; token predictability; token reuse; user enumeration via reset.',
    canary: 'Request reset for your own account — observe the legitimate flow first.',
    severity: 'high',
  },
  {
    id: 'BL-18', title: '2FA bypass',
    strategy: 'Skip 2FA step by direct navigation; replay 2FA token; brute-force 6-digit; null/empty token.',
    canary: 'Complete 2FA legitimately once.',
    severity: 'critical',
  },
  {
    id: 'BL-19', title: 'API version downgrade',
    strategy: 'Call /v1/ endpoints when /v2/ is current — old versions often lack new auth checks.',
    canary: 'Call /v2/ as baseline first.',
    severity: 'medium',
  },
  {
    id: 'BL-20', title: 'Webhook/event forgery',
    strategy: 'Forge payment-webhook callbacks (stripe-signature bypass); replay webhooks for double-credit.',
    canary: 'Observe one legitimate webhook first if possible.',
    severity: 'critical',
  },
  {
    id: 'BL-21', title: 'Invitation/role escalation',
    strategy: 'Invite self as admin; tamper role parameter; accept expired invites; invite enumeration.',
    canary: 'Send a legitimate invite first — observe the flow.',
    severity: 'high',
  },
];

/** Get BL modules relevant to an app type. */
export function blModulesFor(appType) {
  const relevance = {
    ecommerce: ['BL-01', 'BL-12', 'BL-13', 'BL-14', 'BL-03', 'BL-09', 'BL-17'],
    fintech: ['BL-03', 'BL-06', 'BL-18', 'BL-20', 'BL-11', 'BL-02', 'BL-16'],
    saas: ['BL-04', 'BL-07', 'BL-15', 'BL-21', 'BL-05', 'BL-19', 'BL-10'],
    generic: ['BL-02', 'BL-08', 'BL-10', 'BL-16', 'BL-05'],
  };
  const ids = relevance[appType] || relevance.generic;
  return BL_MODULES.filter((m) => ids.includes(m.id));
}

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
