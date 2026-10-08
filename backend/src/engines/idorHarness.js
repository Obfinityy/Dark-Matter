/**
 * idorHarness.js — Two-Account IDOR / BOLA Harness.
 *
 * Elite-hunter authenticated IDOR testing (CWE-639). The existing
 * `detectIDORParams()` in vulnDetector.js only *flags* sequential IDs in
 * URLs; it never proves anything. Real IDOR requires two authenticated
 * accounts: can Account A read Account B's objects?
 *
 * Probe matrix (per endpoint + ID location):
 *   baseline — A reads A's own resource        → must succeed (sanity)
 *   attack   — A reads B's resource (ID swapped) → must FAIL (403/401/404/redirect)
 *   control  — B reads B's own resource        → must succeed (sanity)
 *
 * The attack is only a finding when it returns B's *data* — response-body
 * comparison guards against the classic false positives (error pages with
 * HTTP 200, ID-ignored echo of the caller's own record, public resources).
 *
 * Supports numeric IDs, UUIDs, and ID placement in path segments, query
 * parameters, request headers (e.g. X-User-Id), and request bodies
 * (via a {{ID}} template — enables write-IDOR on PUT/PATCH/POST).
 *
 * The HTTP layer is injected (`httpClient`) so unit tests never touch the
 * network. Contract:
 *   httpClient({ url, method, headers, body }) -> Promise<{ status, headers?, body }>
 * where `body` may be a string, Buffer, or already-parsed object.
 */

const ERROR_BODY_PATTERNS = [
  /unauthori[sz]ed/i,
  /forbidden/i,
  /access\s*denied/i,
  /not\s+permitted/i,
  /permission\s+denied/i,
  /insufficient\s+privileg/i,
  /please\s+(log\s*in|sign\s*in)/i,
  /login\s+required/i,
  /invalid\s+(token|session|credentials)/i,
  /session\s+expired/i,
  /not\s+found/i,
  /no\s+such\s+(user|account|record|resource|order|file)/i,
  /does\s+not\s+exist/i,
];

const REDIRECT_TO_LOGIN_PATTERNS = [/\/login/i, /\/signin/i, /\/auth/i, /\/sso/i];

/**
 * Normalize an ID location spec into { in, name }.
 * Accepts: 'path' | 'query:id' | 'header:X-User-Id' | { in, name }.
 */
export function parseIdLocation(idParam) {
  if (!idParam) return { in: 'path', name: null };
  if (typeof idParam === 'object') {
    const loc = { in: String(idParam.in || 'path').toLowerCase(), name: idParam.name || null };
    assertLocation(loc);
    return loc;
  }
  const s = String(idParam).trim();
  if (s === 'path') return { in: 'path', name: null };
  const q = s.match(/^query:(.+)$/i);
  if (q) return { in: 'query', name: q[1] };
  const h = s.match(/^header:(.+)$/i);
  if (h) return { in: 'header', name: h[1] };
  throw new Error(
    `idorHarness: unrecognized idParam "${s}" (use 'path', 'query:<name>' or 'header:<name>')`
  );
}

function assertLocation(loc) {
  if (!['path', 'query', 'header', 'body'].includes(loc.in)) {
    throw new Error(`idorHarness: idParam.in must be path|query|header|body, got "${loc.in}"`);
  }
  if ((loc.in === 'query' || loc.in === 'header') && !loc.name) {
    throw new Error(`idorHarness: idParam.name is required for in="${loc.in}"`);
  }
}

/**
 * Build the three probes for a two-account IDOR test.
 *
 * @param {object} opts
 * @param {string} opts.url        Endpoint URL containing Account A's ID
 *                                 (path segment, query param, or neither for header/body).
 * @param {string} [opts.method='GET']
 * @param {object} [opts.headers={}]  Base headers merged under each account's auth headers.
 * @param {object} opts.accountA   { id, email?, headers: { Authorization|Cookie... } }
 * @param {object} opts.accountB   { id, email?, headers: { Authorization|Cookie... } }
 * @param {string|object} [opts.idParam='path']  Where the object ID lives.
 * @param {string|object} [opts.bodyTemplate]    Optional body with {{ID}} placeholder (write-IDOR).
 * @returns {{ probes: Array, idLocation: object }}
 */
export function buildIdorProbes({
  url,
  method = 'GET',
  headers = {},
  accountA,
  accountB,
  idParam = 'path',
  bodyTemplate = null,
}) {
  if (!url || typeof url !== 'string') throw new Error('idorHarness: url is required');
  if (!accountA?.id) throw new Error('idorHarness: accountA.id is required');
  if (!accountB?.id) throw new Error('idorHarness: accountB.id is required');
  if (!accountA?.headers || !accountB?.headers) {
    throw new Error(
      'idorHarness: both accounts need auth headers (accountA.headers / accountB.headers)'
    );
  }
  if (String(accountA.id) === String(accountB.id)) {
    throw new Error('idorHarness: accountA.id and accountB.id must differ');
  }

  const loc = parseIdLocation(idParam);
  const aId = String(accountA.id);
  const bId = String(accountB.id);

  const swapInUrl = targetId => {
    const u = new URL(url);
    if (loc.in === 'path') {
      const segs = u.pathname.split('/');
      const idx = segs.findIndex(s => s === aId);
      if (idx === -1) {
        throw new Error(
          `idorHarness: no path segment equals accountA.id ("${aId}") in ${u.pathname} — ` +
            'pass the URL as seen by Account A, or use query:/header: idParam'
        );
      }
      segs[idx] = targetId;
      u.pathname = segs.join('/');
    } else if (loc.in === 'query') {
      u.searchParams.set(loc.name, targetId);
    }
    // header/body locations leave the URL untouched
    return u.toString();
  };

  const applyBody = targetId => {
    if (bodyTemplate == null) return undefined;
    const raw = typeof bodyTemplate === 'string' ? bodyTemplate : JSON.stringify(bodyTemplate);
    const swapped = raw.split('{{ID}}').join(targetId);
    if (typeof bodyTemplate === 'string') return swapped;
    try {
      return JSON.parse(swapped);
    } catch {
      return swapped;
    }
  };

  const mkProbe = (label, actor, targetId, expectBlocked) => {
    const probeHeaders = { ...headers, ...actor.headers };
    if (loc.in === 'header') probeHeaders[loc.name] = targetId;
    return {
      label,
      url: swapInUrl(targetId),
      method: String(method).toUpperCase(),
      headers: probeHeaders,
      body: applyBody(targetId),
      actorId: String(actor.id),
      targetId,
      idLocation: loc.in,
      expectBlocked,
    };
  };

  const probes = [
    mkProbe('baseline', accountA, aId, false), // A reads A's object — must work
    mkProbe('attack', accountA, bId, true), // A reads B's object — must be blocked
    mkProbe('control', accountB, bId, false), // B reads B's object — must work
  ];
  return { probes, idLocation: loc };
}

/** Normalize a response body to a string for comparison. */
export function bodyToString(body) {
  if (body == null) return '';
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

/** Collapse whitespace/case for fuzzy body equality. */
function normalized(s) {
  return bodyToString(s).replace(/\s+/g, ' ').trim().toLowerCase();
}

function isErrorBody(body) {
  const s = bodyToString(body);
  if (!s) return true;
  return ERROR_BODY_PATTERNS.some(re => re.test(s));
}

function isLoginRedirect(res) {
  const status = res?.status;
  if (status !== 301 && status !== 302 && status !== 303 && status !== 307 && status !== 308)
    return false;
  const loc = res?.headers?.location || res?.headers?.Location || '';
  return REDIRECT_TO_LOGIN_PATTERNS.some(re => re.test(String(loc)));
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Does `body` contain the account's identifying marker?
 * Short markers (< 3 chars) require word boundaries to avoid matching
 * coincidental substrings (e.g. id "7" inside "17").
 */
function containsMarker(body, marker) {
  const m = String(marker);
  if (!m) return false;
  const s = bodyToString(body);
  if (m.length < 3) return new RegExp(`\\b${escapeRegExp(m)}\\b`).test(s);
  return s.includes(m);
}

function accountMarkers(account) {
  return [account.id, account.email, account.username, account.name]
    .map(v => (v == null ? '' : String(v).trim()))
    .filter(Boolean);
}

const ok2xx = s => s >= 200 && s < 300;

/**
 * Analyze the three probe responses and decide whether IDOR exists.
 *
 * @param {object} baselineRes  { status, headers?, body } — A reading A's object
 * @param {object} attackRes    { status, headers?, body } — A reading B's object
 * @param {object} controlRes  { status, headers?, body } — B reading B's object
 * @param {object} ctx         { accountA, accountB }
 * @returns {{ vulnerable: boolean, verdict: 'vulnerable'|'not_vulnerable'|'inconclusive',
 *             confidence: 'high'|'medium'|'low', evidence: string,
 *             details: object }}
 */
export function analyzeIdor(baselineRes, attackRes, controlRes, { accountA, accountB } = {}) {
  const details = {
    baseline: summarize(baselineRes),
    attack: summarize(attackRes),
    control: summarize(controlRes),
  };
  const inconclusive = (evidence, confidence = 'low') => ({
    vulnerable: false,
    verdict: 'inconclusive',
    confidence,
    evidence,
    details,
  });
  const clean = (evidence, confidence = 'high') => ({
    vulnerable: false,
    verdict: 'not_vulnerable',
    confidence,
    evidence,
    details,
  });

  // ── Sanity: control (B reads B) must work, else we proved nothing ──
  if (!ok2xx(controlRes?.status)) {
    return inconclusive(
      `Control failed: Account B could not read its own resource (HTTP ${controlRes?.status}). ` +
        'Cannot distinguish blocking from breakage — re-check credentials/endpoint.'
    );
  }
  if (!ok2xx(baselineRes?.status)) {
    return inconclusive(
      `Baseline failed: Account A could not read its own resource (HTTP ${baselineRes?.status}). ` +
        'The endpoint may be down or the auth headers invalid.'
    );
  }

  const aMarkers = accountMarkers(accountA || {});
  const bMarkers = accountMarkers(accountB || {});
  const bBody = bodyToString(controlRes.body);
  const aBody = bodyToString(baselineRes.body);
  const atkBody = bodyToString(attackRes.body);

  // ── Guard: if both accounts see identical data, the resource isn't user-scoped ──
  if (normalized(aBody) && normalized(aBody) === normalized(bBody)) {
    return clean(
      'Baseline and control responses are identical — the resource is not user-scoped ' +
        '(public or shared object). No IDOR signal possible here.',
      'medium'
    );
  }

  const atk = attackRes?.status;

  // ── Explicit server-side blocking ──
  if (atk === 401 || atk === 403) {
    return clean(
      `Attack blocked with HTTP ${atk} — server enforces object-level authorization.`,
      'high'
    );
  }
  if (isLoginRedirect(attackRes)) {
    return clean('Attack redirected to a login page — session/authorization enforced.', 'high');
  }
  if (atk === 404) {
    return clean(
      'Attack returned HTTP 404 while the control read the same object successfully — ' +
        'the server hides or blocks cross-account objects.',
      'medium'
    );
  }
  if (atk >= 500) {
    return inconclusive(
      `Attack returned HTTP ${atk} — server error, no authorization signal.`,
      'low'
    );
  }

  // ── HTTP 200: the dangerous case — but 200 alone proves nothing ──
  if (ok2xx(atk)) {
    // (a) Soft-block: 200 with an error page and none of B's data → not vulnerable.
    if (isErrorBody(atkBody) && !bMarkers.some(m => containsMarker(atkBody, m))) {
      return clean(
        'Attack returned HTTP 200 but the body is an error/denied page with none of ' +
          "Account B's data — soft-blocked, not vulnerable.",
        'medium'
      );
    }
    // (b) ID ignored: server returned the caller's OWN record despite the swapped ID.
    if (normalized(atkBody) === normalized(aBody)) {
      return clean(
        "Attack returned HTTP 200 but the body matches Account A's own record — the ID " +
          'parameter was ignored server-side. No cross-account data disclosed.',
        'medium'
      );
    }
    // (c) Cross-account data: attack body carries B's markers, or mirrors B's control body.
    const attackHasB = bMarkers.some(m => containsMarker(atkBody, m));
    const mirrorsControl =
      normalized(atkBody) === normalized(bBody) && normalized(bBody).length > 0;
    const controlHasB = bMarkers.some(m => containsMarker(bBody, m));
    if ((attackHasB || mirrorsControl) && !isErrorBody(atkBody)) {
      const how = attackHasB
        ? `response contains Account B's identifier (${bMarkers.find(m => containsMarker(atkBody, m))})`
        : "response body is identical to Account B's own control response";
      const conf = attackHasB && controlHasB ? 'high' : 'medium';
      return {
        vulnerable: true,
        verdict: 'vulnerable',
        confidence: conf,
        evidence:
          `IDOR CONFIRMED (CWE-639): Account A retrieved Account B's object — ${how}. ` +
          `Baseline (A→A) and control (B→B) both succeeded, ruling out breakage.`,
        details,
      };
    }
    // (d) 200, no B data, no error text, differs from both — ambiguous.
    return inconclusive(
      'Attack returned HTTP 200 with an unrecognized body (neither an error page nor ' +
        "Account B's data). Manual review required.",
      'low'
    );
  }

  return inconclusive(
    `Attack returned unexpected HTTP ${atk} — no clear authorization signal.`,
    'low'
  );
}

function summarize(res) {
  if (!res) return { status: null, bodyPreview: '' };
  const s = bodyToString(res.body);
  return {
    status: res.status ?? null,
    bodyPreview: s.length > 220 ? `${s.slice(0, 220)}…` : s,
    bodyLength: s.length,
  };
}

/**
 * Run the full two-account IDOR test: build probes → execute → analyze.
 *
 * @param {object} opts  Same options as buildIdorProbes.
 * @param {Function} httpClient  Injected request function (no default — tests must inject a mock).
 * @returns {Promise<object>} analyzeIdor() result plus probes and raw responses.
 */
export async function testIdor(opts, httpClient) {
  if (typeof httpClient !== 'function') {
    throw new Error(
      'idorHarness.testIdor: httpClient is required (inject a mock in tests; no implicit network)'
    );
  }
  const {
    url,
    method = 'GET',
    headers = {},
    accountA,
    accountB,
    idParam = 'path',
    bodyTemplate = null,
  } = opts;
  const { probes, idLocation } = buildIdorProbes({
    url,
    method,
    headers,
    accountA,
    accountB,
    idParam,
    bodyTemplate,
  });

  const run = async probe => {
    const res = await httpClient({
      url: probe.url,
      method: probe.method,
      headers: probe.headers,
      body: probe.body,
    });
    return {
      status: res?.status,
      headers: res?.headers || {},
      body: res?.body,
    };
  };

  const [baselineRes, attackRes, controlRes] = await Promise.all(probes.map(run));
  const analysis = analyzeIdor(baselineRes, attackRes, controlRes, { accountA, accountB });
  return {
    ...analysis,
    idLocation: idLocation.in,
    probes: probes.map(p => ({
      label: p.label,
      url: p.url,
      method: p.method,
      actorId: p.actorId,
      targetId: p.targetId,
    })),
    responses: { baseline: baselineRes, attack: attackRes, control: controlRes },
  };
}
