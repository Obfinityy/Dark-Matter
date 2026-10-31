// Dark Matter — STRUCTURED ACTION PLAN (Mission Stage 3).
//
// The brain may attach a structured plan to any action JSON:
//
//   {
//     "action": "browser_click",
//     "text": "Login",
//     "expect": "url contains /dashboard",
//     "plan": {
//       "objective": "log in to DVWA with the vaulted lab credential",
//       "state": "on the login page; credential cred:dvwa:ab12 is vaulted",
//       "expected": "dashboard loads after submit",
//       "risk": "low — lab target, in scope, non-destructive",
//       "fallback": "if the login fails, read the error text and retry with the password re-typed"
//     }
//   }
//
// All plan fields are optional. The plan is validated, recorded with the
// turn's reasoning note (auditable), and its `fallback` is surfaced to the
// brain when the action's expectation verification fails — closing the
// Plan → Act → Verify → Fallback loop.
//
// The machine-checkable part of the plan is `expect` (Stage 2,
// actionVerify.js); `plan.expected` is the human-readable twin. If both
// are present they should agree; the loop checks `expect`.
//
// Design rules: pure, deterministic, never throws.

const PLAN_FIELDS = ['objective', 'state', 'expected', 'risk', 'fallback'];
const MAX_FIELD_CHARS = 500;

/**
 * Validate and normalise a plan object from the brain's action JSON.
 * @param {*} plan
 * @returns {{valid:boolean, plan:Object|null, errors:string[]}}
 */
export function parsePlan(plan) {
  try {
    if (plan === undefined || plan === null) {
      return { valid: true, plan: null, errors: [] };
    }
    if (typeof plan !== 'object' || Array.isArray(plan)) {
      return { valid: false, plan: null, errors: ['plan must be an object'] };
    }
    const out = {};
    const errors = [];
    for (const f of PLAN_FIELDS) {
      const v = plan[f];
      if (v === undefined || v === null || v === '') continue;
      if (typeof v !== 'string') {
        errors.push(`plan.${f} must be a string`);
        continue;
      }
      out[f] = v.slice(0, MAX_FIELD_CHARS);
    }
    // Unknown fields are ignored (forward-compatible), not errors.
    return { valid: errors.length === 0, plan: Object.keys(out).length > 0 ? out : null, errors };
  } catch {
    return { valid: false, plan: null, errors: ['plan parse error'] };
  }
}

/**
 * Build the fallback line appended to the observation when an action's
 * expectation verification fails and the plan declares a fallback.
 * @param {Object|null} plan — normalised plan from parsePlan()
 * @returns {string} '' when no fallback applies
 */
export function fallbackLine(plan) {
  try {
    const fb = plan && typeof plan.fallback === 'string' ? plan.fallback.trim() : '';
    return fb ? `[FALLBACK] ${fb}` : '';
  } catch {
    return '';
  }
}
