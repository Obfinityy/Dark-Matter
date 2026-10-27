// Dark Matter — KNOWN-APP FINGERPRINT (zero-genuine lane, 27 Oct 2026).
//
// ROOT CAUSE (live evidence, DVWA hunt h_830317bdc184): the brain hunted
// the WRONG app. Recon guessed "PHP, no DB" from a negative probe, the
// prompt then FORBADE SQL injection, the app model guessed "ecommerce"
// from Juice Shop endpoints that leaked in through shared per-host intel
// (172.17.0.1 serves DVWA on :3100 AND Juice Shop on :3000), and the
// brain spent ~160 Meta calls probing /rest/* endpoints that 404 on
// DVWA — while DVWA's real modules sat behind a login nobody attempted.
//
// The fix, in one place: identify a KNOWN lab app from the pages the
// target ITSELF serves (the served page wins over every tech guess),
// then let that identity drive the prompt, the tool chain, the app
// model, the login gate, and the wrong-target guard. Pure functions —
// no I/O, no network — so every rule here is unit-testable.
//
// A "known app" is only ever a LAB app with public defaults (DVWA,
// Juice Shop). Nothing here fingerprints or special-cases a real,
// arbitrary target: an unknown target gets exactly the old behaviour.
export const KNOWN_APPS = {
  dvwa: {
    id: 'dvwa',
    name: 'Damn Vulnerable Web Application',
    loginPath: '/login.php',
    securityPath: '/security.php',
    modulesPath: '/vulnerabilities/',
    // DVWA's stack, by fingerprint — the app IS MySQL-backed by
    // definition, even when no DB error was ever observed. A missing
    // error string is not evidence of no database.
    database: 'mysql',
    // DVWA's PUBLIC default credential for the lab target only.
    // Never used on any other host/app; the vault holds it, the
    // record keeps the handle only (see labLogin.js).
    defaultUsername: 'admin',
    defaultPassword: 'password',
  },
  'juice-shop': {
    id: 'juice-shop',
    name: 'OWASP Juice Shop',
    loginPath: '/#/login',
    securityPath: null,
    modulesPath: null,
    database: null,
  },
};

/** Endpoint patterns that belong to ANOTHER known app, not this one. */
export const WRONG_TARGET_PATTERNS = {
  // Juice Shop's API surface — every one of these 404s on DVWA.
  dvwa: [/^\/rest\//i, /^\/api\//i, /^\/ftp\//i, /^\/b2b\//i, /^\/file-upload/i],
  // DVWA's PHP surface — none of these exist on Juice Shop.
  'juice-shop': [/^\/login\.php/i, /^\/vulnerabilities\//i, /^\/security\.php/i, /^\/setup\.php/i, /^\/instructions\.php/i],
};

/** Path part of a URL or a bare path ('' when the input has no path). */
export function pathOf(urlOrPath) {
  const s = String(urlOrPath || '').trim();
  if (!s) return '';
  try {
    return new URL(s).pathname || '';
  } catch {
    if (!s.startsWith('/')) return '';
    return s.split('?')[0].split('#')[0];
  }
}

/**
 * Identify a known app from what the target ITSELF served: the final
 * URL (after redirects) and the page HTML. The served page wins over
 * any header/tech guess — a PHP page titled "Damn Vulnerable Web
 * Application" IS DVWA even if no DB error was ever seen.
 * Returns { app, confidence, markers } or null.
 */
export function detectKnownApp({ url = '', html = '', headers = {} } = {}) {
  const u = String(url || '');
  const body = String(html || '');
  let pathname = '';
  try {
    pathname = new URL(u).pathname.toLowerCase();
  } catch {
    pathname = u.split('?')[0].toLowerCase();
  }
  // DVWA: its own login page, or its own title on any served page.
  if (pathname === '/login.php' || /Damn Vulnerable Web Application/i.test(body)) {
    return { app: 'dvwa', confidence: 'high', markers: [pathname === '/login.php' ? 'login.php path' : 'DVWA title'] };
  }
  if (/\/vulnerabilities\//i.test(body) && /DVWA/i.test(body)) {
    return { app: 'dvwa', confidence: 'high', markers: ['DVWA modules page'] };
  }
  // Juice Shop: its own title, or its own brand in the served page.
  if (/OWASP Juice Shop/i.test(body) || /juice-shop/i.test(body)) {
    return { app: 'juice-shop', confidence: 'high', markers: ['Juice Shop title'] };
  }
  return null;
}

/** True when this path belongs to another known app, not `app`. */
export function isWrongTargetEndpoint(app, urlOrPath) {
  const patterns = WRONG_TARGET_PATTERNS[app];
  if (!patterns) return false;
  const p = pathOf(urlOrPath);
  if (!p) return false;
  return patterns.some((re) => re.test(p));
}

/**
 * Scan free text (a shell command, a plan's test + command) for
 * endpoint paths that belong to another app. Returns the distinct
 * wrong paths found ('' when none).
 */
export function findWrongTargetPaths(app, text) {
  const hits = new Set();
  const s = String(text || '');
  if (!WRONG_TARGET_PATTERNS[app]) return [];
  for (const m of s.matchAll(/https?:\/\/[^\s"'`]+/gi)) {
    const p = pathOf(m[0]);
    if (p && isWrongTargetEndpoint(app, m[0])) hits.add(p);
  }
  for (const m of s.matchAll(/\/[A-Za-z0-9._~%/-]+/g)) {
    const p = pathOf(m[0]);
    if (p && isWrongTargetEndpoint(app, p)) hits.add(p);
  }
  return [...hits];
}

/**
 * The hunt's known app, from every place recon may have recorded it:
 * meta.knownApp (set by understandTarget), meta.recon.knownApp (set
 * by reconPhase and persisted to meta), or the app fingerprint's
 * appType (set by the curiosity model when the app is known).
 * Returns 'dvwa' | 'juice-shop' | null.
 */
export function knownAppOf(meta, target) {
  const m = (meta && typeof meta === 'object') ? meta : {};
  const direct = m.knownApp && typeof m.knownApp.app === 'string' ? m.knownApp.app : null;
  if (direct && KNOWN_APPS[direct]) return direct;
  const fromRecon = m.recon && typeof m.recon.knownApp === 'string' ? m.recon.knownApp : null;
  if (fromRecon && KNOWN_APPS[fromRecon]) return fromRecon;
  const fromFp = m.appFingerprint && typeof m.appFingerprint.appType === 'string' ? m.appFingerprint.appType : null;
  if (fromFp && KNOWN_APPS[fromFp]) return fromFp;
  return null;
}

/** Deterministic login spec for a known lab app (DVWA only for now). */
export function dvwaLoginSpec(target) {
  const base = String(target || '').replace(/\/+$/, '');
  const dvwa = KNOWN_APPS.dvwa;
  return {
    loginUrl: base + dvwa.loginPath,
    securityUrl: base + dvwa.securityPath,
    indexUrl: base + '/index.php',
    username: dvwa.defaultUsername,
    password: dvwa.defaultPassword,
  };
}

/**
 * State-of-mind lines for a known app: what the target IS, whether
 * the lab login is done, and the wrong-app boundary — so the brain
 * never has to re-derive any of it from keyword guesses.
 */
export function knownAppSOMLines({ knownApp = null, auth = null } = {}) {
  if (knownApp === 'dvwa') {
    const a = (auth && auth.dvwa && typeof auth.dvwa === 'object') ? auth.dvwa : {};
    const lines = [
      'TARGET IS DVWA (Damn Vulnerable Web Application) — a deliberately vulnerable lab, NOT a shop. Its real modules live behind /login.php.',
    ];
    if (a.loggedIn === true) {
      lines.push(`LOGGED IN as admin, security level ${a.securityLevel || 'unknown'} (verified ${a.verifiedAt || 'unknown'}). Hunt the /vulnerabilities/* modules — SQLi first.`);
    } else if (a.loginFailed === true) {
      lines.push('LOGIN FAILED (blocker recorded) — do not silently hunt unauthenticated; the login wall is the problem to solve, not the modules.');
    } else {
      lines.push('NOT LOGGED IN YET — log in first with the vaulted DVWA default (admin), set security to low, verify the session, then hunt the modules.');
    }
    lines.push('WRONG APP: /rest/*, /api/*, /ftp/* and /file-upload belong to Juice Shop, NOT DVWA — they 404 here. Never probe them on this target.');
    return lines;
  }
  if (knownApp === 'juice-shop') {
    return ['TARGET IS OWASP Juice Shop — hunt its /rest/* API surface; DVWA paths (/login.php, /vulnerabilities/*) do not exist here.'];
  }
  return [];
}
