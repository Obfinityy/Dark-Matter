/**
 * configKeySandboxRecon.js — Config, key, sandbox and docs recon analyzers.
 *
 * Analyzes observed HTTP responses, bundles and documentation artifacts from
 * AUTHORIZED targets to surface defensive findings:
 *  - Maintenance-mode bypass signals (ideas 1191)
 *  - Config endpoint exposure (1192)
 *  - API keys embedded in JS bundles (1193)
 *  - Publicly documented demo keys working in production (1194)
 *  - Sandbox-vs-production parity gaps (1195)
 *  - Sandbox data leakage of real-looking PII (1196)
 *  - Demo-tenant / production datastore overlap (1197)
 *  - Elevated demo-credential scope (1198)
 *  - Retired-but-reachable API spec versions (1199)
 *  - API-docs auth bypass via direct paths (1200)
 *
 * All findings are analyzer output — classification, redaction and verdicts.
 * Never echo full secrets, keys, tokens or PII in any result.
 */

export const WAVE1191_COVERAGE = [
  1191, 1192, 1193, 1194, 1195, 1196, 1197, 1198, 1199, 1200,
];

/** Redact a secret-like value: keep type + a short fingerprint, never the value. */
function redact(value = '') {
  const s = String(value);
  return `${s.slice(0, 4)}…[redacted, ${s.length} chars]`;
}

/**
 * 1191 — Maintenance-mode bypass test.
 *
 * Analyzes observed maintenance-mode behavior for spoofable bypass signals:
 * header-triggered bypasses, IP-allowlist rules inferred from probes, and a
 * bypass probe response that returned live content.
 *
 * @param {object} args
 * @param {object} args.headers — observed maintenance response headers (lowercased keys)
 * @param {Array} args.ipRulesObserved — observed allow/deny IP behaviors [{ ip, outcome }]
 * @param {object} args.bypassResponse — probe result { status, servedLiveContent }
 * @returns {{ spoofableSignals: string[], risk: string, notes: string[] }}
 */
export function assessMaintenanceBypass({
  headers = {},
  ipRulesObserved = [],
  bypassResponse = {},
} = {}) {
  const spoofableSignals = [];
  const notes = [];
  const h = headers || {};

  const bypassHeaders = [
    'x-bypass-maintenance',
    'x-maintenance-bypass',
    'x-skip-maintenance',
    'x-dev-mode',
    'x-internal-bypass',
  ];
  for (const bh of bypassHeaders) {
    if (h[bh] !== undefined) {
      spoofableSignals.push(`maintenance bypass header present: ${bh}`);
    }
  }

  const rules = Array.isArray(ipRulesObserved) ? ipRulesObserved : [];
  const allowed = rules.filter((r) => r && r.outcome === 'allowed');
  const denied = rules.filter((r) => r && r.outcome === 'denied');
  if (allowed.length > 0 && denied.length > 0) {
    spoofableSignals.push(
      `IP-allowlist gate observed (${allowed.length} allowed / ${denied.length} denied) — spoofable via X-Forwarded-For if not validated`,
    );
  }

  if (bypassResponse && bypassResponse.servedLiveContent === true) {
    spoofableSignals.push('bypass probe served live application content during maintenance');
  }

  if (h['x-maintenance-mode'] || h['x-site-offline']) {
    notes.push('maintenance mode banner confirmed via response headers');
  } else {
    notes.push('no maintenance-mode headers observed');
  }

  const risk =
    spoofableSignals.length >= 2
      ? 'High'
      : spoofableSignals.length === 1
        ? 'Medium'
        : 'Low';

  return { spoofableSignals, risk, notes };
}

/**
 * 1192 — Config endpoint discovery.
 *
 * Assesses a config-like response body for leaked internals. Reports the
 * presence and TYPE of API hosts, feature toggles and secret-like values —
 * never the full values.
 *
 * @param {object} args
 * @param {string} args.path — endpoint path that served the body
 * @param {object|string} args.body — parsed JSON or raw text of the config body
 * @returns {{ path: string, exposure: string[], risk: string, redactedSummary: string[] }}
 */
export function assessConfigExposure({ path = '', body = '' } = {}) {
  const exposure = [];
  const redactedSummary = [];
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
  let parsed = null;
  try {
    parsed = typeof body === 'string' ? JSON.parse(body) : body;
  } catch {
    parsed = null;
  }

  const hostMatches = text.match(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
  const apiHosts = [...new Set(hostMatches)].filter((u) => /api|staging|internal|admin|svc|service/i.test(u));
  if (apiHosts.length > 0) {
    exposure.push('internal/api hostnames');
    redactedSummary.push(`apiHosts: ${apiHosts.length} distinct host(s)`);
  }

  const toggleMatches = text.match(/["']?[a-z0-9_.-]*?(feature|flag|toggle|beta)[a-z0-9_.-]*?["']?\s*[:=]\s*(true|false|"[^"]*")/gi) || [];
  if (toggleMatches.length > 0) {
    exposure.push('feature toggles / flags');
    redactedSummary.push(`toggles: ${toggleMatches.length} flag assignment(s)`);
  }

  const secretLike = text.match(
    /["']?[a-z0-9_.-]*?(secret|token|private[_-]?key|api[_-]?key|passwd|password)["']?\s*[:=]\s*["'][^"']{8,}["']/gi,
  ) || [];
  if (secretLike.length > 0) {
    exposure.push('secret-like values');
    redactedSummary.push(
      `secrets: ${secretLike.length} secret-like field(s) — ${redact(secretLike[0] || '')}`,
    );
  }

  if (parsed && typeof parsed === 'object' && (parsed.debug === true || parsed.verbose === true)) {
    exposure.push('debug/verbose config enabled');
  }

  const risk = exposure.includes('secret-like values')
    ? 'High'
    : exposure.length >= 2
      ? 'Medium'
      : exposure.length === 1
        ? 'Low'
        : 'None';

  return { path, exposure, risk, redactedSummary };
}

/**
 * 1193 — API key in JS bundle.
 *
 * Scans bundle text for common API-key patterns. Returns the pattern type and
 * match position only — the key VALUE is never returned, only a short
 * redacted fingerprint.
 *
 * @param {string} bundleText — raw JS bundle text
 * @returns {Array<{ type: string, position: number, fingerprint: string, context: string }>}
 */
export function scanBundleForKeys(bundleText = '') {
  const text = String(bundleText);
  const patterns = [
    { type: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
    { type: 'Google API Key', pattern: /AIza[0-9A-Za-z_-]{35}/ },
    { type: 'Stripe Live Secret', pattern: /sk_live_[0-9a-zA-Z]{24,}/ },
    { type: 'Stripe Live Publishable', pattern: /pk_live_[0-9a-zA-Z]{24,}/ },
    { type: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/ },
    {
      type: 'Generic API Key Assignment',
      pattern: /["']?(api[_-]?key|apikey)["']?\s*[:=]\s*["'][A-Za-z0-9_-]{20,}["']/i,
    },
    {
      type: 'Firebase Database URL',
      pattern: /[a-z0-9-]+\.firebaseio\.com/,
    },
  ];

  const hits = [];
  for (const { type, pattern } of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags?.includes('g') ? pattern.flags : pattern.flags + 'g');
    let m;
    while ((m = regex.exec(text)) !== null) {
      const start = Math.max(0, m.index - 40);
      const end = Math.min(text.length, m.index + m[0].length + 40);
      let context = text.slice(start, end).replace(/[\r\n]+/g, ' ');
      context = context.replace(m[0], '[KEY-REDACTED]');
      hits.push({
        type,
        position: m.index,
        fingerprint: redact(m[0]),
        context,
      });
    }
  }
  return hits;
}

/**
 * 1194 — Public demo-key harvesting.
 *
 * Evaluates whether publicly documented demo/sample keys are usable against
 * the production API surface — a finding when docs claim "demo only" but the
 * key works on prod or carries quota.
 *
 * @param {object} args
 * @param {string[]} args.docsKeys — key labels documented in public docs (labels, not values)
 * @param {boolean} args.worksOnProd — whether a documented key authorized a prod call
 * @param {number} args.quota — observed quota/rate allowance on the key
 * @returns {{ verdict: string, risk: string, details: string[] }}
 */
export function evaluateDemoKeys({ docsKeys = [], worksOnProd = false, quota = 0 } = {}) {
  const details = [];
  const keys = Array.isArray(docsKeys) ? docsKeys : [];
  details.push(`documented key label(s): ${keys.length}`);
  if (quota > 0) details.push(`observed quota: ${quota} request(s) allowed`);
  if (worksOnProd) details.push('documented demo key authorized a production API call');

  let verdict;
  let risk;
  if (worksOnProd && quota > 0) {
    verdict = 'exposed: demo key valid on production with quota';
    risk = 'High';
  } else if (worksOnProd) {
    verdict = 'exposed: demo key valid on production';
    risk = 'High';
  } else if (quota > 0) {
    verdict = 'partial: key carries quota but prod use unconfirmed';
    risk = 'Medium';
  } else {
    verdict = 'clean: documented demo keys not usable against production';
    risk = 'Low';
  }

  return { verdict, risk, details };
}

/**
 * 1195 — Sandbox-vs-production parity check.
 *
 * Diffs sandbox and production API observations to find endpoints reachable
 * in production that are absent or undocumented in sandbox/docs, plus
 * response-shape differences.
 *
 * @param {object} args
 * @param {object} args.sandbox — { endpoints: string[], shapes: { path: object } }
 * @param {object} args.prod — { endpoints: string[], shapes: { path: object } }
 * @returns {{ undocumentedInProd: string[], shapeDiffs: Array<{ path: string, diff: string[] }>, summary: string }}
 */
export function diffSandboxProd({ sandbox = {}, prod = {} } = {}) {
  const sandboxEndpoints = new Set(sandbox.endpoints || []);
  const prodEndpoints = prod.endpoints || [];
  const undocumentedInProd = prodEndpoints.filter((p) => !sandboxEndpoints.has(p));

  const sandboxShapes = sandbox.shapes || {};
  const prodShapes = prod.shapes || {};
  const shapeDiffs = [];
  for (const [path, shape] of Object.entries(prodShapes)) {
    const sandboxShape = sandboxShapes[path];
    if (!sandboxShape) continue;
    const diff = [];
    const prodKeys = new Set(Object.keys(shape || {}));
    const sandboxKeys = new Set(Object.keys(sandboxShape || {}));
    for (const k of prodKeys) {
      if (!sandboxKeys.has(k)) diff.push(`prod-only field: ${k}`);
    }
    for (const k of sandboxKeys) {
      if (!prodKeys.has(k)) diff.push(`sandbox-only field: ${k}`);
    }
    for (const k of prodKeys) {
      if (sandboxKeys.has(k) && JSON.stringify(shape[k]) !== JSON.stringify(sandboxShape[k])) {
        diff.push(`field changed: ${k}`);
      }
    }
    if (diff.length > 0) shapeDiffs.push({ path, diff });
  }

  const summary =
    undocumentedInProd.length === 0 && shapeDiffs.length === 0
      ? 'parity: sandbox mirrors production surface'
      : `drift: ${undocumentedInProd.length} prod endpoint(s) not in sandbox, ${shapeDiffs.length} response-shape diff(s)`;

  return { undocumentedInProd, shapeDiffs, summary };
}

/**
 * 1196 — Sandbox data-leakage test.
 *
 * Assesses sandbox/test response bodies for real-PII-shaped data (emails,
 * phone numbers, SSN-shaped, card-shaped values). Reports shape counts and
 * examples redacted — never the values themselves.
 *
 * @param {string|object} sandboxBody — sandbox response body
 * @returns {{ piiShapes: string[], risk: string, redactedEvidence: string[] }}
 */
export function assessSandboxLeakage(sandboxBody = '') {
  const text = typeof sandboxBody === 'string' ? sandboxBody : JSON.stringify(sandboxBody ?? '');
  const piiShapes = [];
  const redactedEvidence = [];

  const checks = [
    { shape: 'email addresses', pattern: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi },
    { shape: 'phone numbers', pattern: /\b\+?[0-9][0-9()\s.-]{7,16}\b/g },
    { shape: 'SSN-shaped values', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
    { shape: 'card-shaped values', pattern: /\b(?:\d[ -]?){13,19}\b/g },
    { shape: 'dob-shaped values', pattern: /\b\d{4}-\d{2}-\d{2}\b/g },
  ];

  for (const { shape, pattern } of checks) {
    const matches = text.match(pattern) || [];
    if (matches.length > 0) {
      piiShapes.push(shape);
      redactedEvidence.push(`${shape}: ${matches.length} match(es), e.g. ${redact(matches[0])}`);
    }
  }

  const risk =
    piiShapes.length >= 3
      ? 'High'
      : piiShapes.length >= 1
        ? 'Medium'
        : 'Low';

  return { piiShapes, risk, redactedEvidence };
}

/**
 * 1197 — Demo-tenant API access.
 *
 * Analyzes demo-tenant observations for shared-datastore risk with
 * production: record IDs appearing in both, shared resource references, or
 * cross-tenant object references.
 *
 * @param {object} args
 * @param {object} args.demoData — { tenantId, recordIds: string[] }
 * @param {object} args.prodOverlapSignals — { sharedResourceRefs: string[], crossTenantRefs: string[] }
 * @returns {{ sharedDatastoreRisk: string[], risk: string, details: string[] }}
 */
export function assessDemoTenantScope({ demoData = {}, prodOverlapSignals = {} } = {}) {
  const flags = [];
  const details = [];
  const recordIds = demoData.recordIds || [];
  const sharedRefs = prodOverlapSignals.sharedResourceRefs || [];
  const crossRefs = prodOverlapSignals.crossTenantRefs || [];

  details.push(`demo tenant id label observed: ${demoData.tenantId ? 'yes' : 'no'}`);
  details.push(`demo record id count: ${recordIds.length}`);

  if (sharedRefs.length > 0) {
    flags.push('shared resource references appear in both demo and production contexts');
    details.push(`shared reference(s): ${sharedRefs.length}`);
  }
  if (crossRefs.length > 0) {
    flags.push('cross-tenant object references observed from demo scope');
    details.push(`cross-tenant reference(s): ${crossRefs.length}`);
  }
  if (flags.length === 0) {
    details.push('no datastore-overlap signals observed');
  }

  const risk = crossRefs.length > 0 ? 'High' : flags.length > 0 ? 'Medium' : 'Low';

  return { sharedDatastoreRisk: flags, risk, details };
}

/**
 * 1198 — Public demo-credential test.
 *
 * Evaluates publicly documented demo credentials against the observed scope
 * of access to flag elevated scopes (admin, billing, user-data export) that
 * should never be demo-reachable.
 *
 * @param {object} args
 * @param {Array} args.documentedCreds — [{ label, role }] (labels only, no passwords)
 * @param {string[]} args.observedScope — scopes the documented creds actually reached
 * @returns {{ elevatedScope: string[], risk: string, details: string[] }}
 */
export function evaluateDemoCredentials({ documentedCreds = [], observedScope = [] } = {}) {
  const elevated = [];
  const details = [];
  const scopes = Array.isArray(observedScope) ? observedScope : [];

  const elevatedSignals = [
    'admin',
    'superuser',
    'billing',
    'payments',
    'user-data-export',
    'pii',
    'config-write',
    'deploy',
    'impersonate',
  ];

  for (const scope of scopes) {
    if (elevatedSignals.some((s) => String(scope).toLowerCase().includes(s))) {
      elevated.push(String(scope));
    }
  }

  details.push(`documented credential label(s): ${documentedCreds.length}`);
  details.push(`observed scope(s): ${scopes.length}`);
  if (elevated.length > 0) {
    details.push(`elevated scope(s) reached by demo creds: ${elevated.length}`);
  }

  const risk = elevated.length > 0 ? 'High' : scopes.length > 0 ? 'Medium' : 'Low';

  return { elevatedScope: elevated, risk, details };
}

/**
 * 1199 — API docs version-history mining.
 *
 * From spec-version observations (changelog, old doc URLs), flags retired
 * spec versions whose endpoints remain reachable — an undocumented attack
 * surface.
 *
 * @param {Array<{ version: string, url: string, reachable: boolean }>} versions
 * @returns {{ retiredButReachable: Array<{ version: string, url: string }>, risk: string, summary: string }}
 */
export function mineSpecVersions(versions = []) {
  const list = Array.isArray(versions) ? versions : [];
  const retiredButReachable = list
    .filter((v) => v && v.reachable === true)
    .map((v) => ({ version: v.version, url: v.url }));

  const risk = retiredButReachable.length > 0 ? 'Medium' : 'Low';
  const summary =
    retiredButReachable.length > 0
      ? `${retiredButReachable.length} retired spec version(s) still reachable: ${retiredButReachable
          .map((v) => v.version)
          .join(', ')}`
      : 'no retired spec versions reachable';

  return { retiredButReachable, risk, summary };
}

/**
 * 1200 — API docs auth-bypass via path.
 *
 * From path-probe observations, determines whether API documentation is
 * reachable via direct (guessed/legacy) paths while the linked URL requires
 * authentication — a docs auth bypass.
 *
 * @param {object} args
 * @param {object} args.linkedUrl — { url, requiresAuth: boolean }
 * @param {Array} args.directPaths — [{ path, status, requiresAuth }] probe results
 * @returns {{ bypassed: boolean, openPaths: string[], risk: string, details: string[] }}
 */
export function assessDocsPathBypass({ linkedUrl = {}, directPaths = [] } = {}) {
  const probes = Array.isArray(directPaths) ? directPaths : [];
  const openPaths = probes
    .filter((p) => p && p.status >= 200 && p.status < 400 && p.requiresAuth === false)
    .map((p) => p.path);

  const linkedNeedsAuth = linkedUrl.requiresAuth === true;
  const bypassed = linkedNeedsAuth && openPaths.length > 0;

  const details = [
    `linked docs URL requires auth: ${linkedNeedsAuth ? 'yes' : 'no'}`,
    `direct path probes: ${probes.length}`,
    `open direct path(s): ${openPaths.length}`,
  ];

  const risk = bypassed ? 'Medium' : openPaths.length > 0 ? 'Low' : 'Low';

  return { bypassed, openPaths, risk, details };
}

export const CONFIG_KEY_SANDBOX_RECON = {
  assessMaintenanceBypass,
  assessConfigExposure,
  scanBundleForKeys,
  evaluateDemoKeys,
  diffSandboxProd,
  assessSandboxLeakage,
  assessDemoTenantScope,
  evaluateDemoCredentials,
  mineSpecVersions,
  assessDocsPathBypass,
};

/**
 * Map idea numbers 1191–1200 to their exported function names.
 */
export function ideaFunctions() {
  return {
    1191: 'assessMaintenanceBypass',
    1192: 'assessConfigExposure',
    1193: 'scanBundleForKeys',
    1194: 'evaluateDemoKeys',
    1195: 'diffSandboxProd',
    1196: 'assessSandboxLeakage',
    1197: 'assessDemoTenantScope',
    1198: 'evaluateDemoCredentials',
    1199: 'mineSpecVersions',
    1200: 'assessDocsPathBypass',
  };
}

export default CONFIG_KEY_SANDBOX_RECON;
