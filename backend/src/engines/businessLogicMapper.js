/**
 * businessLogicMapper.js — reconstruct the DEVELOPER'S intended business flows,
 * then attack each assumption.
 *
 * Elite-hunter doctrine (10 Oct 2026): "business logic > scanners". Scanners
 * cannot comprehend logic; the most severe bugs are logic flaws. Before testing,
 * the agent must write down the app's intended flows (as the developer designed
 * them), extract the trust assumptions in each step, then attack each one.
 *
 * Pure functions — no network needed.
 */

// Fields that indicate the client is supplying identity (mass-assignment /
// parameter-tampering surface when the server trusts them).
const IDENTITY_FIELDS = [
  'name', 'email', 'userid', 'user_id', 'applicantname', 'applicant_name',
  'applicantid', 'applicant_id', 'username', 'accountid', 'account_id',
  'profileid', 'profile_id', 'customerid', 'customer_id',
];

// Words that indicate a scarce resource (race-condition surface).
const INVENTORY_WORDS = [
  'slot', 'inventory', 'stock', 'seat', 'ticket', 'appointment', 'booking',
  'reservation', 'capacity',
];

// Words that indicate money movement (payment-tampering surface).
const PAYMENT_WORDS = [
  'payment', 'price', 'amount', 'fee', 'cost', 'total', 'charge', 'pay',
  'checkout', 'order',
];

const PRIORITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1, informational: 0 };

function normalizeStep(step, index) {
  const s = step && typeof step === 'object' ? step : {};
  return {
    index,
    actor: String(s.actor || 'user'),
    action: String(s.action || ''),
    input: Array.isArray(s.input) ? s.input.map(String) : [],
    expectedState: String(s.expectedState || ''),
    // Optional: mark steps where a security control exists (e.g. facial
    // verification, OTP). Used for the inconsistent-control heuristic.
    verification: s.verification ? String(s.verification) : null,
  };
}

/**
 * Define a business flow the way the developer intended it.
 * @param {object} args - { name, steps: [{actor, action, input[], expectedState, verification?}] }
 * @returns {object} normalized flow { name, steps[], verificationCoverage }
 */
export function defineFlow({ name = 'unnamed', steps = [] } = {}) {
  const normalized = (Array.isArray(steps) ? steps : []).map(normalizeStep);
  const verifiedCount = normalized.filter((s) => s.verification).length;
  return {
    name: String(name),
    steps: normalized,
    verificationCoverage: {
      total: normalized.length,
      verified: verifiedCount,
      // True when SOME steps verify but not all — the inconsistent-control smell.
      partial: verifiedCount > 0 && verifiedCount < normalized.length,
    },
  };
}

function lower(s) {
  return String(s || '').toLowerCase().replace(/[_\-\s]/g, '');
}

function stepText(step) {
  return `${step.action} ${step.input.join(' ')}`.toLowerCase();
}

/**
 * Extract attackable assumptions from a defined flow.
 * @param {object} flow - from defineFlow().
 * @returns {Array} [{step, assumption, attackIdea, priority}]
 */
export function extractAssumptions(flow) {
  if (!flow || !Array.isArray(flow.steps)) return [];
  const assumptions = [];

  for (const step of flow.steps) {
    const text = stepText(step);
    const inputsLower = step.input.map(lower);

    // 1. Client-controlled identity: the client supplies identity fields that
    // the server may trust instead of binding to the session.
    const identityHits = inputsLower.filter((f) =>
      IDENTITY_FIELDS.some((id) => f.includes(id))
    );
    if (identityHits.length > 0) {
      assumptions.push({
        step: step.index,
        action: step.action,
        assumption: 'client-controlled identity',
        detail: `Step accepts identity fields from the client (${identityHits.join(', ')}) — server may trust them instead of the session.`,
        attackIdea:
          'Tamper identity parameters (name/email/id) and check whether the action applies to a different identity.',
        priority: 'high',
      });
    }

    // 2. Concurrency: scarce resources booked without atomic reservation.
    if (INVENTORY_WORDS.some((w) => text.includes(w)) &&
        /book|reserve|select|claim|hold|schedule|reschedule/i.test(step.action)) {
      assumptions.push({
        step: step.index,
        action: step.action,
        assumption: 'concurrency',
        detail: 'Scarce resource (slot/inventory) allocated in this step — reservation may not be atomic.',
        attackIdea:
          'Race two sessions for the same slot; also test holding slots without completing the flow (slot-blocking).',
        priority: 'high',
      });
    }

    // 3. Client-trusted payment state: money movement where the client may
    // control amount/status.
    if (PAYMENT_WORDS.some((w) => text.includes(w))) {
      assumptions.push({
        step: step.index,
        action: step.action,
        assumption: 'client-trusted payment state',
        detail: 'Payment step — amount/status may be client-controlled or confirmed client-side.',
        attackIdea:
          'Tamper amount, currency, or payment-status parameters; replay/skipped-payment transitions.',
        priority: 'high',
      });
    }
  }

  // 4. Inconsistent control: verification exists on SOME paths but not all.
  // An attacker picks the unverified path for the same action.
  if (flow.verificationCoverage && flow.verificationCoverage.partial) {
    const verified = flow.steps.filter((s) => s.verification).map((s) => s.action);
    const unverified = flow.steps.filter((s) => !s.verification).map((s) => s.action);
    assumptions.push({
      step: -1,
      action: '(cross-step)',
      assumption: 'inconsistent control',
      detail: `Verification present on [${verified.join(', ')}] but missing on [${unverified.join(', ')}].`,
      attackIdea:
        'Perform the same sensitive action via an unverified path/country/flow and check whether the control is skipped.',
      priority: 'medium',
    });
  }

  return assumptions;
}

function boostPriority(priority) {
  const order = ['low', 'medium', 'high', 'critical'];
  const i = order.indexOf(priority);
  return order[Math.min(i + 1, order.length - 1)];
}

/**
 * Sort assumptions by bounty relevance. bountyHints are keywords from the
 * program page (e.g. ['reschedule','payment','tamper']) — assumptions matching
 * them get boosted one priority level.
 * @param {Array} assumptions - from extractAssumptions().
 * @param {object} opts - { bountyHints: string[] }
 * @returns {Array} sorted highest-first, each with matchedHints[].
 */
export function prioritizeAssumptions(assumptions = [], { bountyHints = [] } = {}) {
  const hints = bountyHints.map((h) => String(h).toLowerCase());
  const scored = (Array.isArray(assumptions) ? assumptions : []).map((a) => {
    const haystack = `${a.assumption} ${a.action} ${a.attackIdea} ${a.detail}`.toLowerCase();
    const matchedHints = hints.filter((h) => h && haystack.includes(h));
    const priority = matchedHints.length > 0 ? boostPriority(a.priority) : a.priority;
    return { ...a, priority, matchedHints };
  });
  return scored.sort((x, y) => {
    const prioDiff = (PRIORITY_ORDER[y.priority] || 0) - (PRIORITY_ORDER[x.priority] || 0);
    if (prioDiff !== 0) return prioDiff;
    // Tie-break: more bounty-hint matches rank higher (most program-relevant first).
    return y.matchedHints.length - x.matchedHints.length;
  });
}

/**
 * Turn one assumption into concrete, executable test steps.
 * @param {object} assumption - one entry from extractAssumptions().
 * @returns {Array} [{action, method, expected, note}]
 */
export function planTests(assumption = {}) {
  const kind = String(assumption.assumption || '');
  const base = { note: `Target step: ${assumption.action || 'unknown'} (#${assumption.step ?? '?'})` };

  if (kind === 'client-controlled identity') {
    return [
      { action: 'Capture the request for this step in a proxy', method: 'intercept', expected: 'Full parameter list visible', ...base },
      { action: 'Replay with a tampered identity field (name/email/id of a second test account)', method: 'parameter-tamper', expected: 'Server rejects or binds to session', note: 'If the action applies to the tampered identity → IDOR/mass-assignment. Program rule: only counts if the victim record was NOT previously known (blind IDOR).' },
      { action: 'Try omitting the identity field entirely', method: 'parameter-remove', expected: 'Server derives identity from session', ...base },
    ];
  }
  if (kind === 'concurrency') {
    return [
      { action: 'Open two sessions (A and B) and navigate both to the allocation step', method: 'setup', ...base },
      { action: 'Submit the allocation simultaneously from both sessions', method: 'race', expected: 'Exactly one succeeds', note: 'Double-allocation → race condition. Also test: hold a slot with session A, abandon the flow, check whether the slot stays blocked (slot-blocking primitive).' },
    ];
  }
  if (kind === 'client-trusted payment state') {
    return [
      { action: 'Capture the payment request/response', method: 'intercept', ...base },
      { action: 'Tamper amount/currency/status parameters', method: 'parameter-tamper', expected: 'Server re-validates against its own records', note: 'Also test skipped-payment: jump directly to the post-payment step URL and check whether the flow continues.' },
    ];
  }
  if (kind === 'inconsistent control') {
    return [
      { action: 'List every path/flow that reaches the same sensitive action', method: 'enumerate', ...base },
      { action: 'Perform the action via a path WITHOUT the verification control', method: 'path-swap', expected: 'Control enforced everywhere', note: 'If the control is skipped on the alternate path → inconsistent-control bypass.' },
    ];
  }
  return [{ action: 'Manual review', method: 'manual', expected: 'n/a', ...base }];
}

export const BUSINESS_LOGIC_MAPPER = {
  defineFlow,
  extractAssumptions,
  prioritizeAssumptions,
  planTests,
};
export default BUSINESS_LOGIC_MAPPER;
