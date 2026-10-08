/**
 * Business Logic Testing Engine — the elite hunter's money-maker.
 *
 * Technical scanners (nuclei, nikto) find KNOWN vulnerabilities. But the
 * biggest bounties come from BUSINESS LOGIC flaws — things only a thinking
 * attacker finds:
 *
 *   - Price manipulation (negative price, zero price, currency swap)
 *   - Auth bypass (parameter pollution, JWT alg=none, forced browsing)
 *   - Workflow bypass (skip payment step, skip verification)
 *   - Race conditions (double-spend, coupon reuse)
 *   - IDOR in business context (change user_id, order_id)
 *   - Mass assignment (is_admin=true, role=admin)
 *   - Password reset flaws (token leak, host header poisoning)
 *
 * HOW IT WORKS:
 * 1. The brain identifies the app's workflows from recon (forms, APIs, flows)
 * 2. This engine generates targeted test cases for each workflow
 * 3. Tests run through the stealth HTTP client (rate-limited, WAF-aware)
 * 4. Responses are analyzed for logic flaws (not just status codes)
 * 5. Confirmed flaws become findings with business impact
 *
 * Every test is NON-DESTRUCTIVE: we never complete real purchases, never
 * modify real data, never spam. We test with obviously-fake values and
 * abort before any irreversible action.
 */

export const WORKFLOW_TYPES = Object.freeze([
  'checkout', // cart → payment → order
  'auth', // login, register, session
  'password_reset', // forgot password flow
  'profile', // update profile, change email
  'coupon', // discount/promo codes
  'api_crud', // create/read/update/delete resources
  'upload', // file upload
  'search', // search/filter
  'comment', // comments, reviews, posts
  'payment', // payment processing
]);

/**
 * Test case generators — each returns { name, description, severity,
 *   mutate(request), detect(baseline, mutated), impact }.
 *
 * mutate() takes a captured request and returns a modified version.
 * detect() compares baseline vs mutated response and returns
 *   { vulnerable: boolean, evidence: string }.
 */
export const LOGIC_TESTS = Object.freeze([
  // ── Price Manipulation ──────────────────────────────────────────────
  {
    id: 'price_negative',
    name: 'Negative price',
    workflows: ['checkout', 'payment'],
    severity: 'high',
    description: 'Set price/amount to a negative value — the app may credit instead of charge.',
    mutate: req => mutateParam(req, ['price', 'amount', 'total', 'cost'], '-1'),
    detect: (base, mutated) => detectLogicChange(base, mutated, 'negative price accepted'),
    impact: 'Financial loss — attacker gets paid instead of paying.',
  },
  {
    id: 'price_zero',
    name: 'Zero price',
    workflows: ['checkout', 'payment'],
    severity: 'high',
    description: 'Set price/amount to zero — the app may process a free order.',
    mutate: req => mutateParam(req, ['price', 'amount', 'total', 'cost'], '0'),
    detect: (base, mutated) => detectLogicChange(base, mutated, 'zero price accepted'),
    impact: 'Financial loss — free products/orders.',
  },
  {
    id: 'price_decimal',
    name: 'Decimal truncation',
    workflows: ['checkout', 'payment'],
    severity: 'medium',
    description: 'Send 99.999 — truncation may round down the charge.',
    mutate: req => mutateParam(req, ['price', 'amount', 'total'], '99.999'),
    detect: (base, mutated) =>
      detectLogicChange(base, mutated, 'decimal price handled unexpectedly'),
    impact: 'Financial loss through rounding.',
  },
  {
    id: 'currency_swap',
    name: 'Currency swap',
    workflows: ['checkout', 'payment'],
    severity: 'high',
    description: 'Change currency from USD to a weaker one (e.g. INR, JPY) — price stays numeric.',
    mutate: req => mutateParam(req, ['currency', 'curr'], 'INR'),
    detect: (base, mutated) =>
      detectLogicChange(base, mutated, 'currency changed without price adjustment'),
    impact: 'Financial loss — pay 1/80th of the price.',
  },
  {
    id: 'quantity_overflow',
    name: 'Quantity overflow',
    workflows: ['checkout'],
    severity: 'medium',
    description: 'Extreme quantity (999999999) — integer overflow may wrap to negative/small.',
    mutate: req => mutateParam(req, ['quantity', 'qty', 'count'], '999999999'),
    detect: (base, mutated) => detectLogicChange(base, mutated, 'extreme quantity accepted'),
    impact: 'Inventory/financial logic break.',
  },

  // ── Auth Bypass ─────────────────────────────────────────────────────
  {
    id: 'auth_param_pollution',
    name: 'Parameter pollution on auth',
    workflows: ['auth'],
    severity: 'high',
    description: 'Duplicate auth params (user=admin&user=victim) — backend may pick the wrong one.',
    mutate: req => duplicateParam(req, ['username', 'user', 'email']),
    detect: (base, mutated) =>
      detectLogicChange(base, mutated, 'duplicate auth param changed behavior'),
    impact: 'Authentication bypass — log in as another user.',
  },
  {
    id: 'auth_forced_browse',
    name: 'Forced browsing',
    workflows: ['auth'],
    severity: 'medium',
    description: 'Access authenticated endpoints without session — missing auth check.',
    mutate: req => stripAuth(req),
    detect: (base, mutated) => detectAuthBypass(base, mutated),
    impact: 'Unauthorized access to protected functionality.',
  },

  // ── Workflow Bypass ─────────────────────────────────────────────────
  {
    id: 'workflow_skip_step',
    name: 'Skip workflow step',
    workflows: ['checkout', 'password_reset'],
    severity: 'high',
    description:
      'Jump directly to the final step (e.g. /checkout/confirm) without completing earlier steps.',
    mutate: req => skipToFinalStep(req),
    detect: (base, mutated) => detectLogicChange(base, mutated, 'workflow step skipped'),
    impact: 'Bypass payment, verification, or approval steps.',
  },

  // ── Race Conditions ─────────────────────────────────────────────────
  {
    id: 'race_coupon',
    name: 'Coupon race',
    workflows: ['coupon', 'checkout'],
    severity: 'high',
    description: 'Apply the same single-use coupon in parallel requests — both may succeed.',
    mutate: req => markParallel(req, 5),
    detect: (base, mutated) => detectRaceWin(base, mutated),
    impact: 'Single-use coupon/discount used multiple times.',
  },
  {
    id: 'race_withdraw',
    name: 'Balance race',
    workflows: ['payment'],
    severity: 'critical',
    description: 'Parallel withdrawal/spend requests — balance check may race.',
    mutate: req => markParallel(req, 5),
    detect: (base, mutated) => detectRaceWin(base, mutated),
    impact: 'Double-spend — withdraw more than the balance.',
  },

  // ── IDOR (business context) ─────────────────────────────────────────
  {
    id: 'idor_increment',
    name: 'IDOR via increment',
    workflows: ['api_crud', 'profile', 'checkout'],
    severity: 'high',
    description: "Increment IDs (order_id 1001→1002) — access another user's resource.",
    mutate: req => incrementIdParam(req),
    detect: (base, mutated) => detectIdor(base, mutated),
    impact: "Access/modify another user's data.",
  },

  // ── Mass Assignment ─────────────────────────────────────────────────
  {
    id: 'mass_assign_role',
    name: 'Mass assignment: role',
    workflows: ['profile', 'auth', 'api_crud'],
    severity: 'critical',
    description: 'Add role=admin / is_admin=true to update requests.',
    mutate: req => addParams(req, { role: 'admin', is_admin: 'true', isAdmin: 'true' }),
    detect: (base, mutated) => detectLogicChange(base, mutated, 'privileged field accepted'),
    impact: 'Privilege escalation to admin.',
  },

  // ── Password Reset ──────────────────────────────────────────────────
  {
    id: 'reset_token_leak',
    name: 'Reset token in response',
    workflows: ['password_reset'],
    severity: 'high',
    description: 'The reset token may leak in the API response body.',
    mutate: req => req, // no mutation — inspect response
    detect: (base, mutated) => detectTokenLeak(mutated),
    impact: 'Account takeover via leaked reset token.',
  },
  {
    id: 'reset_host_poison',
    name: 'Host header poisoning on reset',
    workflows: ['password_reset'],
    severity: 'high',
    description: 'Poison Host header — reset link may point to attacker domain.',
    mutate: req => setHeader(req, 'Host', 'evil.example.com'),
    detect: (base, mutated) => detectHostReflection(base, mutated, 'evil.example.com'),
    impact: 'Account takeover via poisoned reset link.',
  },
]);

// ── Mutation helpers ──────────────────────────────────────────────────

function cloneRequest(req) {
  return JSON.parse(JSON.stringify(req));
}

function mutateParam(req, names, value) {
  const r = cloneRequest(req);
  r.params = r.params || {};
  for (const n of names) {
    if (n in r.params) r.params[n] = value;
  }
  // Also try body
  r.body = r.body || {};
  for (const n of names) {
    if (n in r.body) r.body[n] = value;
  }
  r._testNote = `set ${names.join('/')} = ${value}`;
  return r;
}

function duplicateParam(req, names) {
  const r = cloneRequest(req);
  r._duplicateParams = names.filter(n => r.params?.[n] || r.body?.[n]);
  r._testNote = `duplicate params: ${r._duplicateParams.join(',')}`;
  return r;
}

function stripAuth(req) {
  const r = cloneRequest(req);
  r._stripAuth = true;
  if (r.headers) {
    delete r.headers['Authorization'];
    delete r.headers['Cookie'];
  }
  r._testNote = 'removed auth headers';
  return r;
}

function skipToFinalStep(req) {
  const r = cloneRequest(req);
  r._skipToFinal = true;
  r._testNote = 'jump to final workflow step';
  return r;
}

function markParallel(req, count) {
  const r = cloneRequest(req);
  r._parallel = count;
  r._testNote = `${count}x parallel requests`;
  return r;
}

function incrementIdParam(req) {
  const r = cloneRequest(req);
  const idNames = ['id', 'user_id', 'userId', 'order_id', 'orderId', 'account_id'];
  for (const n of idNames) {
    const v = r.params?.[n] ?? r.body?.[n];
    if (v != null && /^\d+$/.test(String(v))) {
      const nv = String(Number(v) + 1);
      if (r.params?.[n] != null) r.params[n] = nv;
      if (r.body?.[n] != null) r.body[n] = nv;
      r._testNote = `incremented ${n}: ${v} → ${nv}`;
      break;
    }
  }
  return r;
}

function addParams(req, extra) {
  const r = cloneRequest(req);
  r.body = { ...(r.body || {}), ...extra };
  r._testNote = `added params: ${Object.keys(extra).join(',')}`;
  return r;
}

function setHeader(req, name, value) {
  const r = cloneRequest(req);
  r.headers = { ...(r.headers || {}), [name]: value };
  r._testNote = `set header ${name}: ${value}`;
  return r;
}

// ── Detection helpers ─────────────────────────────────────────────────

function detectLogicChange(base, mutated, what) {
  // Vulnerable if the mutated request succeeded differently than baseline.
  // Baseline should fail or behave normally; mutated succeeding = flaw.
  if (!mutated || mutated.error) return { vulnerable: false, evidence: '' };
  const baseOk = base && base.status >= 200 && base.status < 300;
  const mutOk = mutated.status >= 200 && mutated.status < 300;
  if (!baseOk && mutOk) {
    return {
      vulnerable: true,
      evidence: `${what}: baseline rejected (${base?.status}), mutated accepted (${mutated.status})`,
    };
  }
  // Both succeed but responses differ meaningfully
  if (baseOk && mutOk && JSON.stringify(base.body) !== JSON.stringify(mutated.body)) {
    const diff = diffBodies(base.body, mutated.body);
    if (diff) {
      return { vulnerable: true, evidence: `${what}: response changed — ${diff}` };
    }
  }
  return { vulnerable: false, evidence: '' };
}

function detectAuthBypass(base, mutated) {
  // Stripped-auth request should be rejected (401/403/redirect to login).
  if (!mutated || mutated.error) return { vulnerable: false, evidence: '' };
  if (mutated.status >= 200 && mutated.status < 300) {
    return {
      vulnerable: true,
      evidence: `Authenticated endpoint returned ${mutated.status} without credentials`,
    };
  }
  return { vulnerable: false, evidence: '' };
}

function detectRaceWin(base, responses) {
  // Multiple parallel responses — if more than one succeeded, race won.
  if (!Array.isArray(responses)) return { vulnerable: false, evidence: '' };
  const wins = responses.filter(r => r && r.status >= 200 && r.status < 300);
  if (wins.length > 1) {
    return {
      vulnerable: true,
      evidence: `Race condition: ${wins.length}/${responses.length} parallel requests succeeded`,
    };
  }
  return { vulnerable: false, evidence: '' };
}

function detectIdor(base, mutated) {
  if (!mutated || mutated.error) return { vulnerable: false, evidence: '' };
  if (mutated.status >= 200 && mutated.status < 300) {
    // Got someone else's data — check it's not our own
    const bodyStr = JSON.stringify(mutated.body || {});
    const baseStr = JSON.stringify(base?.body || {});
    if (bodyStr !== baseStr && bodyStr.length > 10) {
      return {
        vulnerable: true,
        evidence: `IDOR: incremented ID returned different data (HTTP ${mutated.status})`,
      };
    }
  }
  return { vulnerable: false, evidence: '' };
}

function detectTokenLeak(response) {
  if (!response || response.error) return { vulnerable: false, evidence: '' };
  const bodyStr = JSON.stringify(response.body || {});
  if (/token|reset/i.test(bodyStr) && /[a-f0-9]{16,}/i.test(bodyStr)) {
    return {
      vulnerable: true,
      evidence: 'Password reset token leaked in response body',
    };
  }
  return { vulnerable: false, evidence: '' };
}

function detectHostReflection(base, mutated, evilHost) {
  if (!mutated || mutated.error) return { vulnerable: false, evidence: '' };
  const bodyStr = JSON.stringify(mutated.body || {});
  if (bodyStr.includes(evilHost)) {
    return {
      vulnerable: true,
      evidence: `Host header reflected: response contains ${evilHost}`,
    };
  }
  return { vulnerable: false, evidence: '' };
}

function diffBodies(a, b) {
  try {
    const sa = JSON.stringify(a),
      sb = JSON.stringify(b);
    if (sa === sb) return null;
    return `baseline ${sa.slice(0, 80)}… vs mutated ${sb.slice(0, 80)}…`;
  } catch {
    return 'bodies differ';
  }
}

/**
 * Get logic tests applicable to a workflow type.
 */
export function getTestsForWorkflow(workflowType) {
  return LOGIC_TESTS.filter(t => t.workflows.includes(workflowType));
}

/**
 * Get all logic tests (for full sweep).
 */
export function getAllLogicTests() {
  return [...LOGIC_TESTS];
}
