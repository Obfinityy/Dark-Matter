/**
 * setCookieAttributeFingerprint.js — Set-Cookie attribute fingerprinting for autonomous bug bounty.
 *
 * Implements idea-bank item 00421: fingerprint web frameworks, application
 * servers, and platform components from Set-Cookie naming conventions,
 * name prefixes, and attribute patterns.
 *
 * A server's session and infrastructure cookies are often the most honest
 * fingerprint it leaks: PHP's PHPSESSID, Java's JSESSIONID, ASP.NET's
 * ASP.NET_SessionId, Django's sessionid/csrftoken, Express's connect.sid,
 * and Rails' _session_id each name their stack outright. Infrastructure
 * markers (Cloudflare's __cf_bm, AWS ALB's AWSALB, F5's BIGipServer) name
 * the edge. Attribute combinations (Secure/HttpOnly/SameSite/Domain/Path,
 * persistence, prefixes) add a second fingerprint dimension and double as
 * session-security posture signals for an authorized engagement.
 *
 * All functions are pure and side-effect free: they parse Set-Cookie
 * header strings the caller observed through legitimate HTTP responses
 * during an authorized engagement. No requests are made here.
 */

/**
 * Well-known cookie-name -> technology mappings. Confidence reflects how
 * uniquely the name identifies the stack.
 * @type {Array<{pattern: RegExp, technology: string, component: string, confidence: string, note: string}>}
 */
const COOKIE_SIGNATURES = [
  {
    pattern: /^PHPSESSID$/i,
    technology: 'PHP',
    component: 'session handler',
    confidence: 'high',
    note: 'Default PHP session cookie name',
  },
  {
    pattern: /^JSESSIONID$/i,
    technology: 'Java servlet container',
    component: 'Tomcat / Jetty / app server',
    confidence: 'high',
    note: 'JSESSIONID is the Java EE standard session cookie',
  },
  {
    pattern: /^ASP\.NET_SessionId$/i,
    technology: 'ASP.NET',
    component: 'IIS / ASP.NET session state',
    confidence: 'high',
    note: 'Classic ASP.NET session identifier',
  },
  {
    pattern: /^ARRAffinity$/i,
    technology: 'Microsoft Azure',
    component: 'Azure App Service affinity',
    confidence: 'high',
    note: 'Azure load-balancer affinity cookie',
  },
  {
    pattern: /^sessionid$/i,
    technology: 'Django',
    component: 'Django session framework',
    confidence: 'high',
    note: 'Django default session cookie',
  },
  {
    pattern: /^csrftoken$/i,
    technology: 'Django',
    component: 'Django CSRF middleware',
    confidence: 'high',
    note: 'Django default CSRF cookie',
  },
  {
    pattern: /^connect\.sid$/i,
    technology: 'Express (Node.js)',
    component: 'express-session middleware',
    confidence: 'high',
    note: 'Default express-session cookie name',
  },
  {
    pattern: /^laravel_session$/i,
    technology: 'Laravel (PHP)',
    component: 'Laravel session manager',
    confidence: 'high',
    note: 'Default Laravel session cookie',
  },
  {
    pattern: /^XSRF-TOKEN$/i,
    technology: 'Laravel (PHP)',
    component: 'Laravel CSRF protection',
    confidence: 'medium',
    note: 'Laravel encrypted XSRF cookie; also used by Angular apps',
  },
  {
    pattern: /_session_id$/i,
    technology: 'Ruby on Rails',
    component: 'ActionDispatch::Cookies',
    confidence: 'high',
    note: 'Rails default cookie-store session name suffix',
  },
  {
    pattern: /^_csrf$/i,
    technology: 'NestJS / Express',
    component: 'csurf-compatible middleware',
    confidence: 'low',
    note: 'Common CSRF cookie name in Node stacks',
  },
  {
    pattern: /^ci_session$/i,
    technology: 'CodeIgniter (PHP)',
    component: 'CodeIgniter session library',
    confidence: 'high',
    note: 'Default CodeIgniter session cookie',
  },
  {
    pattern: /^CAKEPHP$/i,
    technology: 'CakePHP',
    component: 'CakePHP session',
    confidence: 'high',
    note: 'Default CakePHP session cookie',
  },
  {
    pattern: /^MoodleSession$/i,
    technology: 'Moodle',
    component: 'Moodle LMS session',
    confidence: 'high',
    note: 'Moodle session cookie',
  },
  {
    pattern: /^SESS[a-f0-9]{32}$/i,
    technology: 'Drupal',
    component: 'Drupal session',
    confidence: 'high',
    note: 'Drupal anonymous/authenticated session pattern',
  },
  {
    pattern: /^fe_typo_user$/i,
    technology: 'TYPO3',
    component: 'TYPO3 frontend session',
    confidence: 'high',
    note: 'TYPO3 frontend user session',
  },
  {
    pattern: /^wordpress_(logged_in|sec)_/i,
    technology: 'WordPress',
    component: 'WordPress auth cookies',
    confidence: 'high',
    note: 'WordPress authentication cookies',
  },
  {
    pattern: /^wp-settings-/i,
    technology: 'WordPress',
    component: 'WordPress admin UI',
    confidence: 'high',
    note: 'WordPress editor preferences',
  },
  {
    pattern: /^cf_clearance$/i,
    technology: 'Cloudflare',
    component: 'Cloudflare bot management',
    confidence: 'high',
    note: 'Cloudflare clearance cookie (bot mitigation passed)',
  },
  {
    pattern: /^__cf_bm$/i,
    technology: 'Cloudflare',
    component: 'Cloudflare bot management',
    confidence: 'high',
    note: 'Cloudflare bot-management cookie',
  },
  {
    pattern: /^__cflb$/i,
    technology: 'Cloudflare',
    component: 'Cloudflare load balancer',
    confidence: 'high',
    note: 'Cloudflare LB affinity cookie',
  },
  {
    pattern: /^AWSALB(TG)?$/i,
    technology: 'Amazon Web Services',
    component: 'AWS ALB stickiness',
    confidence: 'high',
    note: 'AWS Application Load Balancer stickiness',
  },
  {
    pattern: /^GCLB$/i,
    technology: 'Google Cloud',
    component: 'Google Cloud load balancer',
    confidence: 'high',
    note: 'Google Cloud LB session affinity',
  },
  {
    pattern: /^BIGipServer/i,
    technology: 'F5 BIG-IP',
    component: 'F5 load balancer',
    confidence: 'high',
    note: 'F5 persistence cookie',
  },
  {
    pattern: /^dtCookie$/i,
    technology: 'Dynatrace',
    component: 'Dynatrace RUM',
    confidence: 'high',
    note: 'Dynatrace real-user-monitoring cookie',
  },
  {
    pattern: /^ak_bmsc$/i,
    technology: 'Akamai',
    component: 'Akamai Bot Manager',
    confidence: 'high',
    note: 'Akamai bot-manager sensor cookie',
  },
  {
    pattern: /^_abck$/i,
    technology: 'Akamai',
    component: 'Akamai Bot Manager',
    confidence: 'high',
    note: 'Akamai bot-manager cookie',
  },
  {
    pattern: /^bm_sz$/i,
    technology: 'Akamai',
    component: 'Akamai Bot Manager',
    confidence: 'high',
    note: 'Akamai bot-manager sizing cookie',
  },
  {
    pattern: /^OAMAuthnHint$/i,
    technology: 'Oracle',
    component: 'Oracle Access Manager',
    confidence: 'high',
    note: 'Oracle Access Management hint cookie',
  },
  {
    pattern: /^_ga$/i,
    technology: 'Google Analytics',
    component: 'analytics',
    confidence: 'high',
    note: 'Google Analytics client ID',
  },
  {
    pattern: /^datr$/i,
    technology: 'Meta',
    component: 'Facebook browser identification',
    confidence: 'high',
    note: 'Facebook datr cookie',
  },
  {
    pattern: /^_hjSessionUser_/i,
    technology: 'Hotjar',
    component: 'Hotjar analytics',
    confidence: 'high',
    note: 'Hotjar session cookie',
  },
  {
    pattern: /^ajs_/i,
    technology: 'Segment',
    component: 'Segment analytics.js',
    confidence: 'medium',
    note: 'Segment anonymous/user cookies',
  },
];

/**
 * Parse one Set-Cookie header value into name, value, and attributes.
 * Handles quoted values, flag attributes (Secure/HttpOnly/Partitioned),
 * and key=value attributes (SameSite, Domain, Path, Max-Age, Expires).
 * @param {string} headerValue Raw Set-Cookie header value.
 * @returns {{name: string, value: string, attributes: object, raw: string}|null}
 */
export function parseSetCookie(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  // Split on semicolons that are not inside double quotes (Expires dates contain commas, not semicolons).
  const parts = [];
  let current = '';
  let inQuotes = false;
  for (const ch of headerValue) {
    if (ch === '"') inQuotes = !inQuotes;
    if (ch === ';' && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  const [pair, ...attrParts] = parts.map(p => p.trim()).filter(Boolean);
  if (!pair) return null;
  const eq = pair.indexOf('=');
  const name = (eq === -1 ? pair : pair.slice(0, eq)).trim();
  let value = eq === -1 ? '' : pair.slice(eq + 1).trim();
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  if (!name) return null;

  const attributes = {};
  for (const attr of attrParts) {
    const aeq = attr.indexOf('=');
    const key = (aeq === -1 ? attr : attr.slice(0, aeq)).trim().toLowerCase();
    const val = aeq === -1 ? true : attr.slice(aeq + 1).trim();
    if (key === 'max-age') {
      attributes.maxAge = /^-?\d+$/.test(val) ? parseInt(val, 10) : null;
    } else if (key === 'expires') {
      attributes.expires = val;
    } else if (key === 'samesite') {
      attributes.sameSite = String(val).replace(/^"|"$/g, '');
    } else if (key === 'domain') {
      attributes.domain = String(val).replace(/^\./, '').toLowerCase();
    } else if (key === 'path') {
      attributes.path = val;
    } else if (key === 'secure') {
      attributes.secure = true;
    } else if (key === 'httponly') {
      attributes.httpOnly = true;
    } else if (key === 'partitioned') {
      attributes.partitioned = true;
    } else if (key === 'priority') {
      attributes.priority = val;
    } else if (key) {
      attributes[`x_${key}`] = val === true ? true : val;
    }
  }
  return { name, value, attributes, raw: headerValue };
}

/**
 * Match a cookie name against known technology signatures.
 * @param {string} name Cookie name.
 * @returns {Array<{technology: string, component: string, confidence: string, note: string}>}
 */
export function matchFrameworkByCookieName(name) {
  if (!name || typeof name !== 'string') return [];
  const hits = [];
  for (const sig of COOKIE_SIGNATURES) {
    if (sig.pattern.test(name)) {
      hits.push({
        technology: sig.technology,
        component: sig.component,
        confidence: sig.confidence,
        note: sig.note,
      });
    }
  }
  // Reserved-prefix heuristic (RFC 6265bis): __Host- / __Secure- imply a
  // security-conscious stack that follows modern cookie standards.
  if (/^__Host-/i.test(name)) {
    hits.push({
      technology: 'unknown (prefix-aware stack)',
      component: 'cookie-prefix hygiene',
      confidence: 'low',
      note: '__Host- prefix requires Secure + Path=/ + no Domain',
    });
  } else if (/^__Secure-/i.test(name)) {
    hits.push({
      technology: 'unknown (prefix-aware stack)',
      component: 'cookie-prefix hygiene',
      confidence: 'low',
      note: '__Secure- prefix requires the Secure attribute',
    });
  }
  return hits;
}

/**
 * Normalize Set-Cookie input into an array of header strings.
 * Accepts an array of strings, a headers object (with `set-cookie` key),
 * or a single string.
 * @param {*} input
 * @returns {string[]}
 */
export function extractSetCookieHeaders(input) {
  if (!input) return [];
  if (typeof input === 'string') return [input];
  if (Array.isArray(input)) return input.filter(v => typeof v === 'string');
  if (typeof input === 'object') {
    const out = [];
    for (const key of Object.keys(input)) {
      if (key.toLowerCase() === 'set-cookie') {
        const v = input[key];
        if (Array.isArray(v)) out.push(...v.filter(x => typeof x === 'string'));
        else if (typeof v === 'string') out.push(v);
      }
    }
    return out;
  }
  return [];
}

/**
 * Fingerprint the stack from a full Set-Cookie observation.
 * @param {*} input Array of Set-Cookie strings, a headers object, or a single string.
 * @returns {{
 *   cookies: Array<{name: string, valueLength: number, persistent: boolean, attributes: object, frameworks: Array}>,
 *   fingerprints: Array<{technology: string, component: string, confidence: string, note: string, via: string}>,
 *   attributeSummary: {secure: number, httpOnly: number, sameSiteStrict: number, sameSiteLax: number, sameSiteNone: number, persistent: number, total: number}
 * }}
 */
export function fingerprintCookies(input) {
  const headers = extractSetCookieHeaders(input);
  const cookies = [];
  const fingerprints = [];
  const summary = {
    secure: 0,
    httpOnly: 0,
    sameSiteStrict: 0,
    sameSiteLax: 0,
    sameSiteNone: 0,
    persistent: 0,
    total: 0,
  };

  for (const h of headers) {
    const parsed = parseSetCookie(h);
    if (!parsed) continue;
    const { name, value, attributes } = parsed;
    const persistent = attributes.maxAge != null || attributes.expires != null;
    if (attributes.secure) summary.secure += 1;
    if (attributes.httpOnly) summary.httpOnly += 1;
    const ss = (attributes.sameSite || '').toLowerCase();
    if (ss === 'strict') summary.sameSiteStrict += 1;
    else if (ss === 'lax') summary.sameSiteLax += 1;
    else if (ss === 'none') summary.sameSiteNone += 1;
    if (persistent) summary.persistent += 1;
    summary.total += 1;

    const frameworks = matchFrameworkByCookieName(name);
    for (const f of frameworks) fingerprints.push({ ...f, via: name });
    cookies.push({ name, valueLength: value.length, persistent, attributes, frameworks });
  }

  return { cookies, fingerprints, attributeSummary: summary };
}
