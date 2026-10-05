/**
 * csrfTokenFormatId.js — CSRF-token format identification for autonomous bug bounty.
 *
 * Implements idea-bank item 00423: identify web frameworks from CSRF token
 * structure (length, alphabet, encoding) and from delivery mechanics
 * (cookie/header/meta-tag/form-field names).
 *
 * CSRF tokens are framework fingerprints: Django mints 64-char alphanumerics
 * delivered via the csrftoken cookie and X-CSRFToken header, Laravel mints
 * 40-char tokens paired with XSRF-TOKEN, Rails emits ~86-char base64url
 * authenticity_tokens, Spring Security issues UUID-shaped tokens, and
 * ASP.NET pairs __RequestVerificationToken cookies with long hidden fields.
 * Delivery patterns further classify the defense model: synchronizer token,
 * double-submit cookie, or encrypted token.
 *
 * All functions are pure and side-effect free: they classify token strings
 * and delivery metadata the caller observed during an authorized
 * engagement. Tokens are never replayed, forged, or submitted here.
 */

/**
 * Known CSRF token format signatures.
 * @type {Array<{framework: string, test: RegExp, confidence: string, note: string}>}
 */
const TOKEN_SIGNATURES = [
  { framework: 'Django', test: /^[A-Za-z0-9]{64}$/, confidence: 'high', note: 'Django CSRF tokens are 64 alphanumerics (SECRET_KEY-salted)' },
  { framework: 'Laravel', test: /^[A-Za-z0-9]{40}$/, confidence: 'medium', note: 'Laravel _token values are 40 alphanumerics' },
  { framework: 'Ruby on Rails', test: /^[A-Za-z0-9_-]{86,88}$/, confidence: 'high', note: 'Rails authenticity_token is ~86-char base64url (masked)' },
  { framework: 'Spring Security', test: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, confidence: 'medium', note: 'Spring default CsrfToken repository issues UUID tokens' },
  { framework: 'ASP.NET', test: /^[A-Za-z0-9+/=_-]{100,}$/, confidence: 'medium', note: '__RequestVerificationToken values are long base64 blobs' },
  { framework: 'Angular (double-submit)', test: /^[A-Za-z0-9+/=_-]{20,}$/, confidence: 'low', note: 'Angular XSRF-TOKEN cookies are base64-ish; confirm via delivery names' },
  { framework: 'Play Framework', test: /^[0-9a-f]{64}$/, confidence: 'low', note: 'Play CSRF tokens are often 64 hex chars' },
];

/**
 * Known CSRF delivery-name signatures.
 * @type {Array<{framework: string, names: string[], channel: string, confidence: string}>}
 */
const DELIVERY_SIGNATURES = [
  { framework: 'Django', names: ['csrftoken', 'x-csrftoken'], channel: 'cookie+header', confidence: 'high' },
  { framework: 'Django', names: ['csrfmiddlewaretoken'], channel: 'form-field', confidence: 'high' },
  { framework: 'Laravel', names: ['xsrf-token', 'x-xsrf-token'], channel: 'cookie+header', confidence: 'high' },
  { framework: 'Laravel', names: ['_token'], channel: 'form-field', confidence: 'high' },
  { framework: 'Ruby on Rails', names: ['authenticity_token'], channel: 'form-field', confidence: 'high' },
  { framework: 'Ruby on Rails', names: ['csrf-token', 'csrf-param'], channel: 'meta-tag', confidence: 'high' },
  { framework: 'Ruby on Rails', names: ['x-csrf-token'], channel: 'header', confidence: 'high' },
  { framework: 'Spring Security', names: ['_csrf', 'x-csrf-token'], channel: 'form-field+header', confidence: 'high' },
  { framework: 'ASP.NET', names: ['__requestverificationtoken'], channel: 'cookie+form-field', confidence: 'high' },
  { framework: 'Angular', names: ['xsrf-token', 'x-xsrf-token'], channel: 'cookie+header (double-submit)', confidence: 'high' },
  { framework: 'Express (csurf)', names: ['_csrf', 'x-csrf-token', 'xsrf-token'], channel: 'cookie+header', confidence: 'medium' },
  { framework: 'Play Framework', names: ['csrf-token', 'play_session'], channel: 'header+cookie', confidence: 'medium' },
];

/**
 * Identify the likely framework from a raw token value's shape.
 * @param {string} token Token string.
 * @returns {Array<{framework: string, confidence: string, note: string}>}
 */
export function identifyTokenFormat(token) {
  if (!token || typeof token !== 'string') return [];
  return TOKEN_SIGNATURES
    .filter((sig) => sig.test.test(token))
    .map((sig) => ({ framework: sig.framework, confidence: sig.confidence, note: sig.note }));
}

/**
 * Identify frameworks from observed delivery names (cookie, header,
 * meta-tag, or form-field names carrying the token).
 * @param {object} delivery { cookieName?: string, headerName?: string, metaName?: string, formFieldName?: string }
 * @returns {Array<{framework: string, channel: string, confidence: string, via: string}>}
 */
export function identifyDeliveryFramework(delivery = {}) {
  const hits = [];
  const fields = [
    ['cookieName', delivery.cookieName],
    ['headerName', delivery.headerName],
    ['metaName', delivery.metaName],
    ['formFieldName', delivery.formFieldName],
  ];
  for (const [field, raw] of fields) {
    if (!raw || typeof raw !== 'string') continue;
    const name = raw.toLowerCase();
    for (const sig of DELIVERY_SIGNATURES) {
      if (sig.names.includes(name)) {
        hits.push({ framework: sig.framework, channel: sig.channel, confidence: sig.confidence, via: `${field}=${raw}` });
      }
    }
  }
  return hits;
}

/**
 * Parse one observed CSRF token: format identification plus delivery
 * identification, merged into a ranked framework verdict.
 * @param {object} observation { token?: string, cookieName?: string, headerName?: string, metaName?: string, formFieldName?: string }
 * @returns {{tokenLength: number, formatMatches: Array, deliveryMatches: Array, verdict: Array<{framework: string, confidence: string, evidence: string[]}>}}
 */
export function parseCsrfObservation(observation = {}) {
  const token = typeof observation.token === 'string' ? observation.token : '';
  const formatMatches = identifyTokenFormat(token);
  const deliveryMatches = identifyDeliveryFramework(observation);

  const byFramework = new Map();
  for (const m of formatMatches) {
    if (!byFramework.has(m.framework)) byFramework.set(m.framework, { framework: m.framework, confidence: m.confidence, evidence: [] });
    byFramework.get(m.framework).evidence.push(`token format: ${m.note}`);
  }
  for (const m of deliveryMatches) {
    if (!byFramework.has(m.framework)) byFramework.set(m.framework, { framework: m.framework, confidence: m.confidence, evidence: [] });
    byFramework.get(m.framework).evidence.push(`delivery: ${m.via} (${m.channel})`);
    if (byFramework.get(m.framework).evidence.length > 1 && byFramework.get(m.framework).confidence !== 'high') {
      byFramework.get(m.framework).confidence = 'high';
    }
  }
  const rank = { high: 3, medium: 2, low: 1 };
  return {
    tokenLength: token.length,
    formatMatches,
    deliveryMatches,
    verdict: [...byFramework.values()].sort((a, b) => (rank[b.confidence] || 0) - (rank[a.confidence] || 0)),
  };
}

/**
 * Classify the CSRF defense model from the set of observed tokens.
 * Synchronizer: server-issued token in form/meta + header on submit.
 * Double-submit: same token echoed in cookie and request header.
 * @param {Array<object>} observations Array of parseCsrfObservation inputs.
 * @returns {{model: string, confidence: string, reasons: string[]}}
 */
export function classifyCsrfDelivery(observations = []) {
  const list = Array.isArray(observations) ? observations : [];
  const reasons = [];
  const hasCookie = list.some((o) => o.cookieName);
  const hasHeader = list.some((o) => o.headerName);
  const hasForm = list.some((o) => o.formFieldName);
  const hasMeta = list.some((o) => o.metaName);

  // Double-submit heuristic: cookie name and header name share a root
  // (e.g. XSRF-TOKEN cookie + X-XSRF-TOKEN header).
  const pairs = [];
  for (const o of list) {
    if (o.cookieName && o.headerName) {
      const c = o.cookieName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const h = o.headerName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (h.endsWith(c) || c.endsWith(h.replace(/^x/, ''))) pairs.push(`${o.cookieName} / ${o.headerName}`);
    }
  }
  if (pairs.length > 0) {
    reasons.push(`cookie/header name pairing suggests double-submit: ${pairs.join(', ')}`);
    return { model: 'double-submit cookie', confidence: 'medium', reasons };
  }
  if ((hasForm || hasMeta) && hasHeader) {
    reasons.push('token delivered via form/meta and returned in a custom header — synchronizer pattern');
    return { model: 'synchronizer token', confidence: 'medium', reasons };
  }
  if (hasCookie && hasHeader) {
    reasons.push('token present in both cookie and header without clear name pairing');
    return { model: 'unknown (cookie + header)', confidence: 'low', reasons };
  }
  reasons.push('insufficient delivery metadata to classify the defense model');
  return { model: 'unknown', confidence: 'low', reasons };
}
