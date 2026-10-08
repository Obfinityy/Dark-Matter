/**
 * frameworkDebugRecon.js — Web-framework debug-surface detection.
 *
 * Implements idea 00449 (Django debug-toolbar detection) and
 * idea 00450 (Rails info-route detection):
 * detects debug tooling left enabled on production hosts — the Django debug
 * toolbar, which leaks SQL queries and settings, and Rails info routes, which
 * expose the route table and application metadata.
 *
 * Signature matching against HTTP responses only — no payloads, no exploits.
 */

/** Django debug toolbar fingerprints. */
const DJANGO_TOOLBAR_SIGNATURES = [
  {
    marker: 'djDebug container',
    pattern: /<div[^>]*id="djDebug"/i,
    confidence: 'high',
    detail: 'Debug toolbar DOM container injected into the page',
  },
  {
    marker: '__debug__ asset path',
    pattern: /__debug__\/(?:toolbar|render_panel|history)/i,
    confidence: 'high',
    detail: 'Toolbar static/media or panel-render URL referenced',
  },
  {
    marker: 'djdt cookie',
    pattern: /djdt/i,
    confidence: 'medium',
    detail: 'Debug-toolbar cookie name present in Set-Cookie',
    header: true,
  },
  {
    marker: 'SQL panel query text',
    pattern: /djdt-panel[^>]*>[\s\S]{0,200}?SELECT\s/i,
    confidence: 'high',
    detail: 'Toolbar SQL panel with captured query text',
  },
  {
    marker: 'toolbar settings leak',
    pattern: /DEBUG_TOOLBAR_CONFIG|INTERCEPT_REDIRECTS/i,
    confidence: 'medium',
    detail: 'Toolbar configuration constants visible',
  },
];

/** Rails info-route paths shipped by default in development mode. */
export const RAILS_INFO_PATHS = [
  { path: '/rails/info/routes', note: 'full route table' },
  { path: '/rails/info/properties', note: 'app properties: versions, paths' },
  { path: '/rails/info', note: 'info index (redirects to properties)' },
];

/** Rails info-page fingerprints. */
const RAILS_INFO_SIGNATURES = [
  {
    marker: 'Rails info heading',
    pattern: /<h1[^>]*>Rails Info/i,
    confidence: 'high',
    detail: 'Rails info page title present',
  },
  {
    marker: 'routes table',
    pattern: /Routes.*<table|Prefix.*Verb.*URI Pattern/is,
    confidence: 'high',
    detail: 'Route-table layout on the info page',
  },
  {
    marker: 'rails version property',
    pattern: /Rails version<\/td>\s*<td[^>]*>\d+\.\d+/i,
    confidence: 'high',
    detail: 'Properties table leaks the Rails version',
  },
  {
    marker: 'ruby version property',
    pattern: /Ruby version<\/td>\s*<td[^>]*>\d+\.\d+\.\d+/i,
    confidence: 'high',
    detail: 'Properties table leaks the Ruby version',
  },
  {
    marker: 'application root property',
    pattern: /Application root<\/td>/i,
    confidence: 'high',
    detail: 'Properties table leaks the deployment path',
  },
  {
    marker: 'database adapter property',
    pattern: /Database adapter<\/td>/i,
    confidence: 'medium',
    detail: 'Properties table names the database adapter',
  },
];

/** Normalize headers into a lower-cased map. */
function normalizeHeaders(headers = {}) {
  const out = {};
  if (Array.isArray(headers)) {
    for (const [k, v] of headers) out[String(k).toLowerCase()] = v;
  } else {
    for (const k of Object.keys(headers)) out[k.toLowerCase()] = headers[k];
  }
  return out;
}

/**
 * Detect the Django debug toolbar in an HTTP response.
 * @param {{url, status, headers, body}} input
 */
export function detectDjangoDebugToolbar({ url, status = 0, headers = {}, body = '' } = {}) {
  const text = String(body || '');
  const norm = normalizeHeaders(headers);
  const rawCookies = norm['set-cookie'];
  const cookieText = Array.isArray(rawCookies) ? rawCookies.join(' ') : String(rawCookies || '');
  const haystack = text + '\n' + cookieText;

  const matches = DJANGO_TOOLBAR_SIGNATURES.filter(s => s.pattern.test(haystack));
  const detected = status >= 200 && status < 400 && matches.length > 0;

  return {
    detected,
    idea: '00449',
    url,
    status,
    framework: 'Django',
    surface: 'debug toolbar',
    matchedSignatures: matches.map(m => ({ marker: m.marker, detail: m.detail })),
    confidence:
      matches.some(m => m.confidence === 'high') && matches.length >= 2
        ? 'high'
        : matches.length > 0
          ? 'medium'
          : 'low',
    severity: detected ? 'Medium' : 'Info',
    cwe: 'CWE-200',
    evidence: detected
      ? `Django debug toolbar markers found at ${url}: ${matches.map(m => m.marker).join(', ')}. The toolbar exposes SQL queries, settings, and request data.`
      : 'No Django debug toolbar markers found.',
  };
}

/**
 * Detect Rails info routes from an HTTP response.
 * @param {{url, status, headers, body}} input
 */
export function detectRailsInfoRoutes({ url, status = 0, headers = {}, body = '' } = {}) {
  const text = String(body || '');
  const matches = RAILS_INFO_SIGNATURES.filter(s => s.pattern.test(text));
  const detected = status >= 200 && status < 400 && matches.length > 0;

  // Extract just the version tokens (metadata, never secrets).
  const railsVersion =
    (text.match(/Rails version<\/td>\s*<td[^>]*>(\d+\.\d+[\w.]*)/i) || [])[1] || null;
  const rubyVersion =
    (text.match(/Ruby version<\/td>\s*<td[^>]*>(\d+\.\d+\.\d+[\w.]*)/i) || [])[1] || null;

  return {
    detected,
    idea: '00450',
    url,
    status,
    framework: 'Ruby on Rails',
    surface: 'info routes',
    matchedSignatures: matches.map(m => ({ marker: m.marker, detail: m.detail })),
    railsVersion,
    rubyVersion,
    confidence:
      matches.some(m => m.confidence === 'high') && matches.length >= 2
        ? 'high'
        : matches.length > 0
          ? 'medium'
          : 'low',
    severity: detected ? 'Medium' : 'Info',
    cwe: 'CWE-200',
    evidence: detected
      ? `Rails info route live at ${url}: ${matches.map(m => m.marker).join(', ')}.` +
        (railsVersion ? ` Rails ${railsVersion}` : '') +
        (rubyVersion ? `, Ruby ${rubyVersion}` : '') +
        '. The page exposes the route table and application metadata.'
      : 'No Rails info-route markers found.',
  };
}

export const FRAMEWORK_DEBUG_RECON = {
  detectDjangoDebugToolbar,
  detectRailsInfoRoutes,
  RAILS_INFO_PATHS,
};
export default FRAMEWORK_DEBUG_RECON;
