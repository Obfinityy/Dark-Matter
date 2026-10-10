/**
 * backendAsServiceRecon.js — Backend-as-a-service metadata surface detection.
 *
 * Covers ideas 01202–01210: managed backends (Hasura, Supabase, PostgREST,
 * Firebase Realtime Database, Firestore, AWS AppSync, API Gateway) expose
 * consoles, metadata APIs, event webhooks, edge functions and REST surfaces
 * that are frequently reachable on authorized targets without authentication.
 *
 * Each idea gets one exported builder that produces a deterministic probing
 * plan (method, path, headers, body, expected indicators) plus a pure
 * analyzer that maps an HTTP response {status, headers, body} to a finding
 * verdict (exposed / not-exposed / uncertain) with evidence. Detection and
 * surface mapping only: no credential brute-forcing, no destructive writes,
 * no raw exploit payloads.
 */

/* ------------------------------------------------------------------ */
/* 01202 — Hasura console exposure                                     */
/* ------------------------------------------------------------------ */

const HASURA_CONSOLE_MARKERS = [
  /Hasura Console/i,
  /hasura-console/i,
  /__hasura/i,
  /Hasura GraphQL Engine/i,
];

const HASURA_CONSOLE_HEADER_HINTS = ['x-hasura-'];

/**
 * Build probes for an exposed Hasura console (idea 01202).
 *
 * @param {string} baseUrl - Target origin, e.g. "https://api.example.com".
 * @param {{timeoutMs?: number}} [options]
 * @returns {{idea: string, title: string, baseUrl: string, probes: object[]}}
 */
export function detectHasuraConsole(baseUrl = '', options = {}) {
  const origin = String(baseUrl || '').replace(/\/+$/, '');
  const probes = [
    {
      id: 'hasura-console-root',
      name: 'Probe Hasura console at /console',
      method: 'GET',
      url: `${origin}/console`,
      path: '/console',
      timeoutMs: options.timeoutMs ?? 10000,
      expect: 'Hasura console HTML or 404',
    },
    {
      id: 'hasura-console-assets',
      name: 'Probe Hasura console assets at /console/assets',
      method: 'GET',
      url: `${origin}/console/assets`,
      path: '/console/assets',
      timeoutMs: options.timeoutMs ?? 10000,
      expect: 'Directory listing / 404 — confirms console presence',
    },
  ];
  return { idea: '01202', title: 'Hasura console exposure', baseUrl: origin, probes };
}

/**
 * Classify a Hasura console probe response.
 *
 * @param {object} probe
 * @param {{status: number, headers?: object, body?: string}} response
 * @returns {{idea: string, path: string, verdict: 'exposed'|'not-exposed'|'uncertain', confidence: number, evidence: string[], note: string}}
 */
export function analyzeHasuraConsoleResponse(probe = {}, response = {}) {
  const status = Number(response.status) || 0;
  const headers = {};
  for (const [k, v] of Object.entries(response.headers || {})) headers[k.toLowerCase()] = String(v);
  const body = String(response.body || '');
  const evidence = [];
  for (const marker of HASURA_CONSOLE_MARKERS) {
    const m = body.match(marker);
    if (m) {
      evidence.push(`body marker: ${m[0].slice(0, 80)}`);
      break;
    }
  }
  for (const hint of HASURA_CONSOLE_HEADER_HINTS) {
    const hit = Object.keys(headers).find((h) => h.startsWith(hint));
    if (hit) evidence.push(`header: ${hit}`);
  }

  let verdict = 'uncertain';
  let confidence = 0.4;
  let note = `HTTP ${status} at ${probe.path}: inconclusive for a Hasura console.`;
  if (status === 200 && evidence.length > 0) {
    verdict = 'exposed';
    confidence = 0.9;
    note = 'Hasura console is publicly reachable; it allows browsing the GraphQL schema and metadata. Check whether admin actions are gated (console may be read-only without x-hasura-admin-secret).';
  } else if (status === 404) {
    verdict = 'not-exposed';
    confidence = 0.85;
    note = `No Hasura console at ${probe.path} (HTTP 404).`;
  } else if (status === 401 || status === 403) {
    verdict = 'not-exposed';
    confidence = 0.75;
    note = `Console path returns HTTP ${status}; not publicly readable.`;
  }
  return { idea: '01202', path: probe.path || '', verdict, confidence, evidence, note };
}

/* ------------------------------------------------------------------ */
/* 01203 — Hasura metadata API test                                    */
/* ------------------------------------------------------------------ */

/**
 * Build probes for the Hasura metadata API (idea 01203).
 * The metadata API exports tables, relationships and permissions; without
 * an admin secret it should reject with 401/400 — a 200 export is the signal.
 *
 * @param {string} baseUrl
 * @param {{timeoutMs?: number, adminSecret?: string}} [options] - pass adminSecret ONLY when the engagement authorizes authenticated testing.
 * @returns {{idea: string, title: string, baseUrl: string, probes: object[]}}
 */
export function probeHasuraMetadata(baseUrl = '', options = {}) {
  const origin = String(baseUrl || '').replace(/\/+$/, '');
  const headers = { 'content-type': 'application/json' };
  if (options.adminSecret) headers['x-hasura-admin-secret'] = options.adminSecret;
  const body = JSON.stringify({ type: 'export_metadata', version: 2, args: {} });
  const probes = [
    {
      id: 'hasura-metadata-export',
      name: 'POST /v1/metadata export_metadata (no auth first)',
      method: 'POST',
      url: `${origin}/v1/metadata`,
      path: '/v1/metadata',
      headers,
      body,
      timeoutMs: options.timeoutMs ?? 10000,
      expect: '401/400 when locked down; 200 JSON export when exposed',
    },
    {
      id: 'hasura-metadata-version',
      name: 'GET /v1/version (engine fingerprint)',
      method: 'GET',
      url: `${origin}/v1/version`,
      path: '/v1/version',
      timeoutMs: options.timeoutMs ?? 10000,
      expect: 'JSON {"version": ...} on Hasura hosts',
    },
  ];
  return { idea: '01203', title: 'Hasura metadata API test', baseUrl: origin, probes };
}

/**
 * Classify a Hasura metadata API response.
 *
 * @param {object} probe
 * @param {{status: number, headers?: object, body?: string}} response
 * @returns {{idea: string, path: string, verdict: 'exposed'|'not-exposed'|'uncertain', confidence: number, evidence: string[], note: string}}
 */
export function analyzeHasuraMetadataResponse(probe = {}, response = {}) {
  const status = Number(response.status) || 0;
  const body = String(response.body || '');
  const evidence = [];
  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }
  let verdict = 'uncertain';
  let confidence = 0.4;
  let note = `HTTP ${status} at ${probe.path}: inconclusive.`;
  if (parsed && typeof parsed === 'object') {
    const keys = Object.keys(parsed);
    if (keys.includes('tables') || keys.includes('metadata') || keys.includes('sources')) {
      verdict = 'exposed';
      confidence = 0.95;
      evidence.push(`metadata export keys: ${keys.slice(0, 8).join(', ')}`);
      note = 'Hasura metadata exported WITHOUT admin authentication: tables, relationships and permissions are visible. Treat as high-value surface mapping and report with scope context.';
    } else if (parsed.error || parsed.message) {
      const msg = String(parsed.error || parsed.message).slice(0, 120);
      evidence.push(`api message: ${msg}`);
      if (/admin-secret|unauthorized|not authorized/i.test(msg) || status === 401) {
        verdict = 'not-exposed';
        confidence = 0.85;
        note = 'Metadata API demands admin authentication (expected locked-down behaviour).';
      } else {
        note = `Metadata API answered with an error (${msg}); behaviour differs from locked-down default — review.`;
      }
    } else if (parsed.version && probe.path === '/v1/version') {
      verdict = 'exposed';
      confidence = 0.8;
      evidence.push(`engine version: ${String(parsed.version).slice(0, 40)}`);
      note = 'Hasura engine version endpoint is reachable; use the version to map known hardening defaults, then test /v1/metadata separately.';
    }
  }
  if (verdict === 'uncertain' && status === 404) {
    verdict = 'not-exposed';
    confidence = 0.8;
    note = `No Hasura metadata surface at ${probe.path} (HTTP 404).`;
  }
  return { idea: '01203', path: probe.path || '', verdict, confidence, evidence, note };
}

/* ------------------------------------------------------------------ */
/* 01204 — Hasura event-trigger webhook map                            */
/* ------------------------------------------------------------------ */

/**
 * Build probes to enumerate Hasura event triggers and their webhook targets
 * (idea 01204). Event triggers reveal internal webhook URLs; mapping uses the
 * same metadata export as 01203 and parses trigger definitions.
 *
 * @param {string} baseUrl
 * @param {{timeoutMs?: number, adminSecret?: string}} [options]
 * @returns {{idea: string, title: string, baseUrl: string, probes: object[]}}
 */
export function mapHasuraEventTriggers(baseUrl = '', options = {}) {
  const origin = String(baseUrl || '').replace(/\/+$/, '');
  const headers = { 'content-type': 'application/json' };
  if (options.adminSecret) headers['x-hasura-admin-secret'] = options.adminSecret;
  const probes = [
    {
      id: 'hasura-event-triggers-export',
      name: 'POST /v1/metadata export_metadata (parse event_triggers)',
      method: 'POST',
      url: `${origin}/v1/metadata`,
      path: '/v1/metadata',
      headers,
      body: JSON.stringify({ type: 'export_metadata', version: 2, args: {} }),
      timeoutMs: options.timeoutMs ?? 10000,
      expect: '200 JSON export containing event_triggers',
    },
  ];
  return { idea: '01204', title: 'Hasura event-trigger webhook map', baseUrl: origin, probes };
}

/**
 * Parse a metadata export body into a webhook map. Webhook URLs are reduced
 * to origin + trigger name; query strings and embedded credentials are
 * redacted to keep findings safe to store and share.
 *
 * @param {{status: number, headers?: object, body?: string}} response
 * @returns {{idea: string, verdict: 'exposed'|'not-exposed'|'uncertain', confidence: number, triggers: object[], evidence: string[], note: string}}
 */
export function analyzeHasuraEventTriggersResponse(response = {}) {
  const status = Number(response.status) || 0;
  const body = String(response.body || '');
  const evidence = [];
  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }
  const triggers = [];
  if (parsed && typeof parsed === 'object') {
    const list = Array.isArray(parsed.event_triggers) ? parsed.event_triggers : [];
    for (const t of list) {
      const raw = String((t && t.webhook) || '');
      let origin = '';
      try {
        origin = raw ? new URL(raw).origin : '';
      } catch {
        origin = '[unparseable]';
      }
      triggers.push({
        name: String((t && t.name) || 'unnamed'),
        table: String((t && (t.table?.name || t.table)) || ''),
        webhookOrigin: origin,
        redacted: raw.includes('?') || /token|secret|key|auth/i.test(raw),
      });
    }
    evidence.push(`event_triggers in export: ${list.length}`);
  }
  let verdict = 'uncertain';
  let confidence = 0.4;
  let note = `HTTP ${status}: could not parse an event-trigger map.`;
  if (triggers.length > 0) {
    verdict = 'exposed';
    confidence = 0.9;
    note = `${triggers.length} event trigger(s) mapped. Webhook origins are listed (query strings redacted) — review whether any point at internal-only hosts or third parties outside the engagement scope.`;
  } else if (parsed && typeof parsed === 'object' && status === 200) {
    verdict = 'exposed';
    confidence = 0.7;
    note = 'Metadata export is readable but defines no event triggers — the surface is open, the map is empty.';
  } else if (status === 401 || status === 403) {
    verdict = 'not-exposed';
    confidence = 0.85;
    note = 'Metadata API requires admin authentication; event triggers cannot be enumerated anonymously.';
  }
  return { idea: '01204', verdict, confidence, triggers, evidence, note };
}

/* ------------------------------------------------------------------ */
/* 01205 — Supabase edge-function enumeration                          */
/* ------------------------------------------------------------------ */

const SUPABASE_FUNCTION_CANDIDATES = [
  'webhook',
  'stripe-webhook',
  'send-email',
  'send-sms',
  'image-proxy',
  'resize-image',
  'generate-thumbnail',
  'pdf-export',
  'health',
  'status',
  'callback',
  'oauth-callback',
  'payment-callback',
  'notify',
  'search',
  'proxy',
  'upload',
  'import',
  'export',
  'sync',
];

/**
 * Build probes to enumerate Supabase edge functions (idea 01205).
 * GET /functions/v1/<name>: a 200/401 means the function exists (401 =
 * exists but requires auth); a Supabase-shaped 404 means it does not.
 *
 * @param {string} baseUrl - Supabase project URL, e.g. "https://xyz.supabase.co".
 * @param {{timeoutMs?: number, extraNames?: string[]}} [options]
 * @returns {{idea: string, title: string, baseUrl: string, probes: object[]}}
 */
export function enumerateSupabaseEdgeFunctions(baseUrl = '', options = {}) {
  const origin = String(baseUrl || '').replace(/\/+$/, '');
  const names = [...SUPABASE_FUNCTION_CANDIDATES, ...(options.extraNames || [])];
  const probes = names.map((name) => ({
    id: `supabase-fn-${name}`,
    name: `Probe edge function "${name}"`,
    method: 'GET',
    url: `${origin}/functions/v1/${name}`,
    path: `/functions/v1/${name}`,
    functionName: name,
    timeoutMs: options.timeoutMs ?? 10000,
    expect: '200/401 = exists; Supabase 404 = absent',
  }));
  return { idea: '01205', title: 'Supabase edge-function enumeration', baseUrl: origin, probes };
}

/**
 * Classify one Supabase edge-function probe response.
 *
 * @param {object} probe
 * @param {{status: number, headers?: object, body?: string}} response
 * @returns {{idea: string, functionName: string, verdict: 'exposed'|'not-exposed'|'uncertain', confidence: number, evidence: string[], note: string}}
 */
export function analyzeSupabaseFunctionResponse(probe = {}, response = {}) {
  const status = Number(response.status) || 0;
  const body = String(response.body || '');
  const evidence = [];
  let verdict = 'uncertain';
  let confidence = 0.4;
  let note = `HTTP ${status} for "${probe.functionName}": inconclusive.`;
  if (status === 200) {
    verdict = 'exposed';
    confidence = 0.9;
    evidence.push('HTTP 200 without credentials');
    note = `Edge function "${probe.functionName}" responds publicly. Map its inputs/outputs and confirm the behaviour is in scope before deeper testing.`;
  } else if (status === 401 || status === 403) {
    verdict = 'exposed';
    confidence = 0.75;
    evidence.push(`HTTP ${status}: function exists, auth enforced`);
    note = `Edge function "${probe.functionName}" exists but requires authentication — per-function auth gap NOT present here.`;
  } else if (status === 404 && /function not found|not found/i.test(body)) {
    verdict = 'not-exposed';
    confidence = 0.85;
    evidence.push('Supabase "not found" response');
    note = `No edge function named "${probe.functionName}".`;
  } else if (status === 404) {
    verdict = 'not-exposed';
    confidence = 0.6;
    note = `HTTP 404 for "${probe.functionName}" (no Supabase signature — may not be a Supabase host).`;
  }
  return { idea: '01205', functionName: probe.functionName || '', verdict, confidence, evidence, note };
}

/* ------------------------------------------------------------------ */
/* 01206 — PostgREST auto-API detection                                 */
/* ------------------------------------------------------------------ */

/**
 * Build probes to detect a PostgREST auto-generated API (idea 01206).
 * PostgREST serves OpenAPI from GET / and answers table-style paths with
 * its distinctive error shape; query params like ?select= are the tell.
 *
 * @param {string} baseUrl
 * @param {{timeoutMs?: number}} [options]
 * @returns {{idea: string, title: string, baseUrl: string, probes: object[]}}
 */
export function detectPostgrestApi(baseUrl = '', options = {}) {
  const origin = String(baseUrl || '').replace(/\/+$/, '');
  const probes = [
    {
      id: 'postgrest-openapi-root',
      name: 'GET / (PostgREST OpenAPI document)',
      method: 'GET',
      url: `${origin}/`,
      path: '/',
      timeoutMs: options.timeoutMs ?? 10000,
      expect: 'OpenAPI JSON mentioning PostgREST',
    },
    {
      id: 'postgrest-rpc-probe',
      name: 'GET /rpc/ (function namespace listing)',
      method: 'GET',
      url: `${origin}/rpc/`,
      path: '/rpc/',
      timeoutMs: options.timeoutMs ?? 10000,
      expect: '404 with PostgREST error shape, or function list',
    },
    {
      id: 'postgrest-select-probe',
      name: 'GET /<unlikely-table>?select=* (error-shape fingerprint)',
      method: 'GET',
      url: `${origin}/zz_no_such_table_xyz?select=*`,
      path: '/zz_no_such_table_xyz',
      timeoutMs: options.timeoutMs ?? 10000,
      expect: '404 JSON {code, details, hint, message} on PostgREST',
    },
    {
      id: 'postgrest-options',
      name: 'OPTIONS / (Allow header on PostgREST)',
      method: 'OPTIONS',
      url: `${origin}/`,
      path: '/',
      timeoutMs: options.timeoutMs ?? 10000,
      expect: 'Allow header listing GET/POST/PATCH/DELETE',
    },
  ];
  return { idea: '01206', title: 'PostgREST auto-API detection', baseUrl: origin, probes };
}

/**
 * Classify a PostgREST probe response.
 *
 * @param {object} probe
 * @param {{status: number, headers?: object, body?: string}} response
 * @returns {{idea: string, path: string, verdict: 'exposed'|'not-exposed'|'uncertain', confidence: number, evidence: string[], note: string}}
 */
export function analyzePostgrestResponse(probe = {}, response = {}) {
  const status = Number(response.status) || 0;
  const headers = {};
  for (const [k, v] of Object.entries(response.headers || {})) headers[k.toLowerCase()] = String(v);
  const body = String(response.body || '');
  const evidence = [];
  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }
  const serverHeader = headers.server || '';
  if (/postgrest/i.test(serverHeader)) evidence.push(`server header: ${serverHeader}`);
  if (parsed && typeof parsed === 'object') {
    if (/postgrest/i.test(JSON.stringify(parsed).slice(0, 400)) && parsed.openapi) {
      evidence.push('OpenAPI document references PostgREST');
    }
    if (parsed.code && parsed.message && 'details' in parsed && 'hint' in parsed) {
      evidence.push(`PostgREST error shape (code ${String(parsed.code).slice(0, 20)})`);
    }
  }
  const allow = headers.allow || '';
  if (/get/i.test(allow) && /post/i.test(allow)) evidence.push(`Allow: ${allow}`);

  let verdict = 'uncertain';
  let confidence = 0.4;
  let note = `HTTP ${status} at ${probe.path}: inconclusive for PostgREST.`;
  if (evidence.length > 0) {
    verdict = 'exposed';
    confidence = 0.85;
    note = 'PostgREST auto-API detected. Enumerate exposed tables/RPC functions from the OpenAPI document and review row-level-security assumptions — table names themselves are in-scope surface, not data to exfiltrate.';
  } else if (status === 404 && parsed === null) {
    verdict = 'not-exposed';
    confidence = 0.6;
    note = `HTTP 404 with no PostgREST signature at ${probe.path}; unlikely to be PostgREST.`;
  }
  return { idea: '01206', path: probe.path || '', verdict, confidence, evidence, note };
}

/* ------------------------------------------------------------------ */
/* 01207 — Firebase REST discovery probe                               */
/* ------------------------------------------------------------------ */

/**
 * Build Firebase Realtime Database REST discovery probes (idea 01207).
 * Appending /.json to a Firebase host returns the database when rules are
 * misconfigured; "Permission denied" means rules hold.
 *
 * @param {string} baseUrl - e.g. "https://project-id.firebaseio.com".
 * @param {{timeoutMs?: number}} [options]
 * @returns {{idea: string, title: string, baseUrl: string, probes: object[]}}
 */
export function probeFirebaseRest(baseUrl = '', options = {}) {
  const origin = String(baseUrl || '').replace(/\/+$/, '');
  const probes = [
    {
      id: 'firebase-json-root',
      name: 'GET /.json (Realtime Database read test)',
      method: 'GET',
      url: `${origin}/.json`,
      path: '/.json',
      timeoutMs: options.timeoutMs ?? 10000,
      expect: '200 JSON dump when rules misconfigured; 401 "Permission denied" when locked',
    },
    {
      id: 'firebase-shallow',
      name: 'GET /.json?shallow=true (key listing without values)',
      method: 'GET',
      url: `${origin}/.json?shallow=true`,
      path: '/.json',
      timeoutMs: options.timeoutMs ?? 10000,
      expect: 'key map when readable — confirms exposure with minimal data transfer',
    },
  ];
  return { idea: '01207', title: 'Firebase REST discovery probe', baseUrl: origin, probes };
}

/**
 * Classify a Firebase REST probe response. Values are NEVER echoed into
 * findings — only key names and sizes, to keep reports data-safe.
 *
 * @param {object} probe
 * @param {{status: number, headers?: object, body?: string}} response
 * @returns {{idea: string, path: string, verdict: 'exposed'|'not-exposed'|'uncertain', confidence: number, evidence: string[], keyCount: number|null, note: string}}
 */
export function analyzeFirebaseRestResponse(probe = {}, response = {}) {
  const status = Number(response.status) || 0;
  const headers = {};
  for (const [k, v] of Object.entries(response.headers || {})) headers[k.toLowerCase()] = String(v);
  const body = String(response.body || '');
  const evidence = [];
  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }
  let verdict = 'uncertain';
  let confidence = 0.4;
  let keyCount = null;
  let note = `HTTP ${status} at ${probe.path}: inconclusive for Firebase REST.`;

  if (parsed && typeof parsed === 'object' && parsed.error) {
    const err = String(parsed.error).slice(0, 120);
    evidence.push(`firebase error: ${err}`);
    if (/permission denied/i.test(err) || status === 401 || status === 403) {
      verdict = 'not-exposed';
      confidence = 0.9;
      note = 'Firebase security rules deny anonymous reads (expected locked-down behaviour).';
    } else if (/no firebase app|not found/i.test(err) || status === 404) {
      verdict = 'not-exposed';
      confidence = 0.7;
      note = 'Host does not appear to serve a Firebase Realtime Database.';
    }
  } else if (status === 200 && parsed !== null) {
    verdict = 'exposed';
    confidence = 0.95;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      keyCount = Object.keys(parsed).length;
      evidence.push(`readable database root: ${keyCount} top-level key(s)`);
    } else {
      evidence.push('readable database root (JSON body returned)');
    }
    note = 'Realtime Database is WORLD-READABLE via REST. Report immediately with only key names and counts — do not copy, store or further traverse user data.';
  } else if (status === 200 && body.length > 0) {
    verdict = 'exposed';
    confidence = 0.7;
    evidence.push(`HTTP 200 with ${body.length}-byte non-JSON body`);
    note = 'Unexpected 200 response on /.json — verify manually whether this is database content.';
  }
  if (/x-firebase/i.test(Object.keys(headers).join(' '))) evidence.push('x-firebase-* response headers present');
  return { idea: '01207', path: probe.path || '', verdict, confidence, evidence, keyCount, note };
}

/* ------------------------------------------------------------------ */
/* 01208 — Firestore REST probing                                      */
/* ------------------------------------------------------------------ */

/**
 * Build Firestore REST probing plans (idea 01208).
 * Weak IAM lets the REST API bypass client-SDK rules; the documents
 * collection endpoint is the read test.
 *
 * @param {string} baseUrl - Firestore REST base, e.g. "https://firestore.googleapis.com".
 * @param {{projectId?: string, timeoutMs?: number}} [options]
 * @returns {{idea: string, title: string, baseUrl: string, probes: object[]}}
 */
export function probeFirestoreRest(baseUrl = 'https://firestore.googleapis.com', options = {}) {
  const origin = String(baseUrl || 'https://firestore.googleapis.com').replace(/\/+$/, '');
  const project = options.projectId || '{projectId}';
  const docsPath = `/v1/projects/${project}/databases/(default)/documents`;
  const probes = [
    {
      id: 'firestore-documents-list',
      name: 'GET documents collection (Firestore REST read test)',
      method: 'GET',
      url: `${origin}${docsPath}`,
      path: docsPath,
      timeoutMs: options.timeoutMs ?? 10000,
      expect: '200 {documents:[...]} when IAM allows; 403 PERMISSION_DENIED when locked; 400/401 without project/key',
    },
    {
      id: 'firestore-single-doc',
      name: 'GET documents/{unlikely-id} (error-shape fingerprint)',
      method: 'GET',
      url: `${origin}${docsPath}/zz_no_such_doc_xyz`,
      path: `${docsPath}/zz_no_such_doc_xyz`,
      timeoutMs: options.timeoutMs ?? 10000,
      expect: 'Firestore error envelope {error:{code,message,status}}',
    },
  ];
  return { idea: '01208', title: 'Firestore REST probing', baseUrl: origin, probes };
}

/**
 * Classify a Firestore REST probe response. Document contents are never
 * echoed — only collection/document counts.
 *
 * @param {object} probe
 * @param {{status: number, headers?: object, body?: string}} response
 * @returns {{idea: string, path: string, verdict: 'exposed'|'not-exposed'|'uncertain', confidence: number, evidence: string[], documentCount: number|null, note: string}}
 */
export function analyzeFirestoreRestResponse(probe = {}, response = {}) {
  const status = Number(response.status) || 0;
  const body = String(response.body || '');
  const evidence = [];
  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }
  let verdict = 'uncertain';
  let confidence = 0.4;
  let documentCount = null;
  let note = `HTTP ${status}: inconclusive for Firestore REST.`;

  const errStatus = parsed && parsed.error ? String(parsed.error.status || '') : '';
  if (errStatus) evidence.push(`firestore error status: ${errStatus}`);
  if (/PERMISSION_DENIED/.test(errStatus) || status === 403) {
    verdict = 'not-exposed';
    confidence = 0.85;
    note = 'Firestore REST denies the read (PERMISSION_DENIED) — IAM rules hold for this identity.';
  } else if (/NOT_FOUND/.test(errStatus) && status === 404) {
    verdict = 'exposed';
    confidence = 0.6;
    evidence.push('NOT_FOUND envelope: project/database exists, this document does not');
    note = 'Firestore endpoint reachable; single-document probe hit NOT_FOUND (identity can reach the API). List collections cautiously and only within scope.';
  } else if (status === 200 && parsed && Array.isArray(parsed.documents)) {
    verdict = 'exposed';
    confidence = 0.95;
    documentCount = parsed.documents.length;
    evidence.push(`documents listed: ${documentCount} (contents not echoed)`);
    note = 'Firestore collection is READABLE via REST. Report with counts only — do not store document contents.';
  } else if (status === 400 || status === 401) {
    note = `HTTP ${status}: request malformed or missing credentials — supply the in-scope project ID / API key and re-probe before concluding.`;
  }
  return { idea: '01208', path: probe.path || '', verdict, confidence, evidence, documentCount, note };
}

/* ------------------------------------------------------------------ */
/* 01209 — AppSync endpoint discovery                                   */
/* ------------------------------------------------------------------ */

const APPSYNC_HOST_PATTERN = /^[a-z0-9]+\.appsync-api\.[a-z0-9-]+\.amazonaws\.com$/i;
const APPSYNC_ERROR_MARKERS = [
  /x-amzn-errortype/i,
  /BadRequestException/i,
  /Missing Authentication Token/i,
  /\"message\"\s*:\s*\"Unauthorized\"/i,
];

/**
 * Build AWS AppSync endpoint discovery probes (idea 01209).
 * AppSync GraphQL endpoints answer POST /graphql with auth-mode-specific
 * errors; the error shape maps which auth modes are configured.
 *
 * @param {string} baseUrl - e.g. "https://xxxx.appsync-api.eu-west-1.amazonaws.com".
 * @param {{timeoutMs?: number}} [options]
 * @returns {{idea: string, title: string, baseUrl: string, probes: object[]}}
 */
export function discoverAppSyncEndpoints(baseUrl = '', options = {}) {
  const origin = String(baseUrl || '').replace(/\/+$/, '');
  let host = '';
  try {
    host = new URL(origin).hostname;
  } catch {
    host = '';
  }
  const probes = [
    {
      id: 'appsync-graphql-post',
      name: 'POST /graphql with empty body (auth-mode fingerprint)',
      method: 'POST',
      url: `${origin}/graphql`,
      path: '/graphql',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
      timeoutMs: options.timeoutMs ?? 10000,
      expect: '400 BadRequestException / 401 Unauthorized envelope on AppSync',
    },
    {
      id: 'appsync-graphql-get',
      name: 'GET /graphql (method behaviour)',
      method: 'GET',
      url: `${origin}/graphql`,
      path: '/graphql',
      timeoutMs: options.timeoutMs ?? 10000,
      expect: '405/400 on AppSync; HTML elsewhere',
    },
  ];
  return {
    idea: '01209',
    title: 'AppSync endpoint discovery',
    baseUrl: origin,
    hostLooksLikeAppSync: APPSYNC_HOST_PATTERN.test(host),
    probes,
  };
}

/**
 * Classify an AppSync probe response and map the implied auth mode.
 *
 * @param {object} probe
 * @param {{status: number, headers?: object, body?: string}} response
 * @returns {{idea: string, path: string, verdict: 'exposed'|'not-exposed'|'uncertain', confidence: number, authModeHint: string|null, evidence: string[], note: string}}
 */
export function analyzeAppSyncResponse(probe = {}, response = {}) {
  const status = Number(response.status) || 0;
  const headers = {};
  for (const [k, v] of Object.entries(response.headers || {})) headers[k.toLowerCase()] = String(v);
  const body = String(response.body || '');
  const evidence = [];
  const headerBlob = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n');
  for (const marker of APPSYNC_ERROR_MARKERS) {
    if (marker.test(headerBlob) || marker.test(body)) {
      evidence.push(`appsync marker: ${String(marker).slice(1, 40)}`);
      break;
    }
  }
  let authModeHint = null;
  if (/\"message\"\s*:\s*\"Unauthorized\"/i.test(body) && status === 401) authModeHint = 'API_KEY (or unauthenticated request rejected)';
  else if (status === 403) authModeHint = 'AWS_IAM / Cognito-style deny';
  else if (/BadRequestException/i.test(headerBlob + body)) authModeHint = 'request reached the AppSync engine (auth mode needs a valid signed request to determine)';

  let verdict = 'uncertain';
  let confidence = 0.4;
  let note = `HTTP ${status} at ${probe.path}: inconclusive for AppSync.`;
  if (evidence.length > 0) {
    verdict = 'exposed';
    confidence = 0.85;
    note = 'AppSync GraphQL endpoint confirmed. Map per-field auth behaviour only with in-scope credentials; unauthenticated schema reads here are the finding, not an invitation to bypass auth.';
  } else if (status === 404) {
    verdict = 'not-exposed';
    confidence = 0.7;
    note = `HTTP 404 at ${probe.path} with no AppSync markers — not an AppSync endpoint.`;
  }
  return { idea: '01209', path: probe.path || '', verdict, confidence, authModeHint, evidence, note };
}

/* ------------------------------------------------------------------ */
/* 01210 — API Gateway usage-plan probe                                 */
/* ------------------------------------------------------------------ */

const GATEWAY_ROUTE_CANDIDATES = ['/', '/prod', '/v1', '/v2', '/api', '/api/v1', '/dev', '/stage'];

/**
 * Build API Gateway usage-plan boundary probes (idea 01210).
 * Hitting routes WITHOUT an API key maps which are public, which demand a
 * key (usage-plan protected) and which do not exist: "Forbidden" vs
 * "Missing Authentication Token" is the discriminator.
 *
 * @param {string} baseUrl - e.g. "https://xxxx.execute-api.eu-west-1.amazonaws.com".
 * @param {{timeoutMs?: number, extraRoutes?: string[]}} [options]
 * @returns {{idea: string, title: string, baseUrl: string, probes: object[]}}
 */
export function probeApiGatewayUsagePlans(baseUrl = '', options = {}) {
  const origin = String(baseUrl || '').replace(/\/+$/, '');
  const routes = [...GATEWAY_ROUTE_CANDIDATES, ...(options.extraRoutes || [])];
  const probes = routes.map((route) => ({
    id: `apigw-route-${route.replace(/[^a-z0-9]+/gi, '-') || 'root'}`,
    name: `GET ${route} without API key (plan-boundary probe)`,
    method: 'GET',
    url: `${origin}${route}`,
    path: route,
    headers: {},
    timeoutMs: options.timeoutMs ?? 10000,
    expect: '200 = public; {"message":"Forbidden"} = key-required; {"message":"Missing Authentication Token"} = no such route',
  }));
  return { idea: '01210', title: 'API Gateway usage-plan probe', baseUrl: origin, probes };
}

/**
 * Classify one API Gateway route probe as public / key-required / not-found.
 *
 * @param {object} probe
 * @param {{status: number, headers?: object, body?: string}} response
 * @returns {{idea: string, path: string, routeClass: 'public'|'key-required'|'not-found'|'uncertain', verdict: 'exposed'|'not-exposed'|'uncertain', confidence: number, evidence: string[], note: string}}
 */
export function analyzeApiGatewayRouteResponse(probe = {}, response = {}) {
  const status = Number(response.status) || 0;
  const body = String(response.body || '');
  const evidence = [];
  let routeClass = 'uncertain';
  let verdict = 'uncertain';
  let confidence = 0.4;
  let note = `HTTP ${status} at ${probe.path}: inconclusive for API Gateway.`;

  if (status === 403 && /"message"\s*:\s*"Forbidden"/.test(body)) {
    routeClass = 'key-required';
    verdict = 'not-exposed';
    confidence = 0.9;
    evidence.push('{"message":"Forbidden"} — usage-plan/API-key protected route');
    note = `Route ${probe.path} exists but requires an API key (usage-plan boundary). Do not attempt key guessing; test only with in-scope keys.`;
  } else if (status === 403 && /Missing Authentication Token/.test(body)) {
    routeClass = 'not-found';
    verdict = 'not-exposed';
    confidence = 0.9;
    evidence.push('{"message":"Missing Authentication Token"} — no such resource/method');
    note = `No API Gateway resource at ${probe.path}.`;
  } else if (status === 200) {
    routeClass = 'public';
    verdict = 'exposed';
    confidence = 0.8;
    evidence.push('HTTP 200 without API key');
    note = `Route ${probe.path} is PUBLIC (no key required). Confirm it is intended-public per the usage plan, then map its parameters.`;
  } else if (status === 401) {
    routeClass = 'key-required';
    verdict = 'not-exposed';
    confidence = 0.7;
    evidence.push('HTTP 401 — authorizer-protected route');
    note = `Route ${probe.path} sits behind an authorizer; not anonymously reachable.`;
  }
  return { idea: '01210', path: probe.path || '', routeClass, verdict, confidence, evidence, note };
}

/**
 * Registry for engine chaining: idea number -> builder + analyzer.
 */
export const BACKEND_AS_SERVICE_RECON = {
  '01202': { title: 'Hasura console exposure', build: detectHasuraConsole, analyze: analyzeHasuraConsoleResponse },
  '01203': { title: 'Hasura metadata API test', build: probeHasuraMetadata, analyze: analyzeHasuraMetadataResponse },
  '01204': { title: 'Hasura event-trigger webhook map', build: mapHasuraEventTriggers, analyze: analyzeHasuraEventTriggersResponse },
  '01205': { title: 'Supabase edge-function enumeration', build: enumerateSupabaseEdgeFunctions, analyze: analyzeSupabaseFunctionResponse },
  '01206': { title: 'PostgREST auto-API detection', build: detectPostgrestApi, analyze: analyzePostgrestResponse },
  '01207': { title: 'Firebase REST discovery probe', build: probeFirebaseRest, analyze: analyzeFirebaseRestResponse },
  '01208': { title: 'Firestore REST probing', build: probeFirestoreRest, analyze: analyzeFirestoreRestResponse },
  '01209': { title: 'AppSync endpoint discovery', build: discoverAppSyncEndpoints, analyze: analyzeAppSyncResponse },
  '01210': { title: 'API Gateway usage-plan probe', build: probeApiGatewayUsagePlans, analyze: analyzeApiGatewayRouteResponse },
};
