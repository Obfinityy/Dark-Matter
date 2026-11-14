// Dark Matter rule-based scanner — crypto token harvester (rows #124/#261/#369).
//
// PROBLEM: crypto.js T2 (predictable session-token structure) needs
// opts.cryptoTokens, and nothing in the scan supplied it — the leg was
// dead in production. This module is the supplier: it harvests tokens
// the scan ALREADY saw, zero extra requests:
//   (1) Set-Cookie values on responses the scan already fetched
//       (fingerprint page / crawl root — read from the full
//       .setCookies list fetchPage now returns; the collapsed
//       headers object keeps only ONE cookie (last wins) and is
//       used only as a fallback, split here Expires-aware);
//   (2) hidden token/CSRF inputs in forms the scan already discovered;
//   (3) the lab session's bearer token + cookies (lab targets only,
//       with the lab username attached so the T2 username-derived
//       signal can fire).
//
// The harvester is deliberately permissive about WHAT is a candidate
// token; the T2 oracle is the gate (it needs >=2 independent
// structural signals across >=2 tokens before anything confirms).
// Tracking cookies are excluded by name; anything else needs a
// session-like name or a token-shaped (>=16 char) value. Token VALUES
// never leave the scan in logs or diagnostics — phase extras carry
// only counts. Never throws: malformed input yields [] for that
// source, never a broken scan.

export const MAX_HARVESTED_TOKENS = 12;
export const MIN_TOKEN_LENGTH = 8;
export const MIN_LONG_VALUE_LENGTH = 16;

// Mirrors labSession.js SESSION_COOKIE_RE, plus the token/csrf/jwt
// names a Set-Cookie value can carry. A bare 'sid' substring also
// matches JSESSIONID / connect.sid style names.
const SESSION_TOKEN_NAME_RE =
  /session|sid|token|auth|csrf|xsrf|jwt|phpsessid|jsessionid|connect\.sid/i;
const TOKEN_INPUT_NAME_RE = /token|csrf|xsrf/i;

// Split a comma-joined Set-Cookie header value into one string per
// cookie. The split fires ONLY on a comma followed by a token name
// and '=' — the comma inside an Expires date ("Wed, 21 Oct ...") is
// followed by a day number, never by 'name=', so it never splits.
// Cookie values containing a literal ", name=" sequence would split
// wrongly; no standard cookie value does that (Expires is the known
// comma case and is handled).
export function splitSetCookieHeader(value) {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(/,\s*(?=[A-Za-z0-9_!#$%&'*+\-.^`|~]+=)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Parse the leading `name=value` segment of one Set-Cookie header.
// Returns { name, value } or null. Attributes (Path, Expires, ...)
// are ignored — harvesting needs only the cookie itself. This is a
// minimal pair parser, not labSession.parseSetCookie (which also
// parses attributes); the two agree on the name/value segment.
export function parseCookiePair(header) {
  if (!header || typeof header !== 'string') return null;
  const first = header.split(';')[0].trim();
  const eq = first.indexOf('=');
  if (eq <= 0) return null;
  const name = first.slice(0, eq).trim();
  const value = first.slice(eq + 1).trim();
  if (!name || !value) return null;
  return { name, value };
}

function isTokenCookie(name, value) {
  if (!value || value.length < MIN_TOKEN_LENGTH) return false;
  if (SESSION_TOKEN_NAME_RE.test(name)) return true;
  // Long value under an unrecognised name: token-shaped only when it
  // is ONE opaque string. Dotted values (GA1.2.x.y tracking cookies
  // and other compound values) are excluded — a tracking cookie must
  // never enter the T2 sample set, where its trailing digits can
  // poison the oracle's monotonic check (one huge delta silences a
  // genuine predictable pair) and its segments add noise.
  return value.length >= MIN_LONG_VALUE_LENGTH && !value.includes('.');
}

function pushToken(out, seen, token) {
  if (!token || typeof token.value !== 'string') return;
  if (seen.has(token.value)) return;
  if (out.length >= MAX_HARVESTED_TOKENS) return;
  seen.add(token.value);
  out.push(token);
}

// Harvest from response headers. Accepts a plain headers object
// (fetchPage shape: lowercase keys, 'set-cookie' a comma-joined
// string), a bare string / string array, or a Headers-like with
// getSetCookie(). Returns [{ value, name, source }].
export function harvestTokensFromHeaders(headers, source) {
  const out = [];
  const seen = new Set();
  let rawValues = [];
  if (!headers) return out;
  if (typeof headers === 'string') rawValues = [headers];
  else if (Array.isArray(headers)) rawValues = headers;
  else if (typeof headers.getSetCookie === 'function') {
    try {
      rawValues = headers.getSetCookie() || [];
    } catch {
      rawValues = [];
    }
  } else if (typeof headers === 'object') {
    const sc = headers['set-cookie'];
    if (typeof sc === 'string') rawValues = [sc];
    else if (Array.isArray(sc)) rawValues = sc;
  }
  for (const raw of rawValues) {
    for (const part of splitSetCookieHeader(raw)) {
      const pair = parseCookiePair(part);
      if (!pair) continue;
      if (!isTokenCookie(pair.name, pair.value)) continue;
      pushToken(out, seen, { value: pair.value, name: pair.name, source });
    }
  }
  return out;
}

// Harvest hidden token/CSRF inputs from discovered forms. A visible
// text input named 'token' is user input, not a server-issued token,
// so only hidden (or type-less) inputs qualify. Returns
// [{ value, name, source }] with source `form:<action>`.
export function harvestTokensFromForms(forms) {
  const out = [];
  const seen = new Set();
  for (const form of Array.isArray(forms) ? forms : []) {
    if (!form) continue;
    const action = typeof form.action === 'string' ? form.action : '';
    const inputs = Array.isArray(form.inputs) ? form.inputs : [];
    for (const inp of inputs) {
      if (!inp || typeof inp.name !== 'string') continue;
      const type = typeof inp.type === 'string' ? inp.type.toLowerCase() : '';
      if (type && type !== 'hidden') continue;
      if (!TOKEN_INPUT_NAME_RE.test(inp.name)) continue;
      const value = typeof inp.value === 'string' ? inp.value : '';
      if (value.length < MIN_TOKEN_LENGTH) continue;
      pushToken(out, seen, { value, name: inp.name, source: `form:${action}` });
    }
  }
  return out;
}

// Assemble the scan's token supply from everything it already saw.
// opts: { fingerprint, crawled, forms, authSession, labUsername,
// targetUrl }. fingerprint/crawled carry .headers + .setCookies (+
// .url); forms is the scan's discovered-form list; authSession is
// the lab login result ({ ok, session: { token, cookies } }) or
// null. Returns at most MAX_HARVESTED_TOKENS entries, deduplicated
// by value, in first-seen order: fingerprint cookies, crawl-root
// cookies, form tokens, lab-session bearer token, lab-session
// cookies. Lab-session tokens carry `username` (the lab account)
// so the T2 username-derived signal can fire; anonymous tokens
// carry none. Cookie sources prefer the full .setCookies list and
// fall back to the collapsed headers object (older callers /
// test seams that never set .setCookies).
export function harvestScanTokens(opts = {}) {
  const out = [];
  const seen = new Set();
  const targetUrl = typeof opts.targetUrl === 'string' ? opts.targetUrl : '';
  const fp = opts.fingerprint || null;
  const crawled = opts.crawled || null;
  const fpUrl = (fp && fp.url) || targetUrl;
  const crawlUrl = (crawled && crawled.url) || targetUrl;
  const harvestCookies = (holder, url) => {
    if (!holder) return;
    if (Array.isArray(holder.setCookies) && holder.setCookies.length) {
      for (const t of harvestTokensFromHeaders(holder.setCookies, `set-cookie:${url}`)) {
        pushToken(out, seen, t);
      }
    } else if (holder.headers) {
      for (const t of harvestTokensFromHeaders(holder.headers, `set-cookie:${url}`)) {
        pushToken(out, seen, t);
      }
    }
  };
  harvestCookies(fp, fpUrl);
  harvestCookies(crawled, crawlUrl);
  for (const t of harvestTokensFromForms(opts.forms)) pushToken(out, seen, t);
  const session = opts.authSession && opts.authSession.ok ? opts.authSession.session : null;
  if (session) {
    const username =
      typeof opts.labUsername === 'string' && opts.labUsername ? opts.labUsername : undefined;
    if (typeof session.token === 'string' && session.token.length >= MIN_TOKEN_LENGTH) {
      pushToken(out, seen, {
        value: session.token,
        name: 'Authorization',
        source: `lab-session:${targetUrl}`,
        ...(username ? { username } : {}),
      });
    }
    for (const c of Array.isArray(session.cookies) ? session.cookies : []) {
      if (!c || typeof c.value !== 'string') continue;
      if (!isTokenCookie(c.name || '', c.value)) continue;
      pushToken(out, seen, {
        value: c.value,
        name: c.name || 'cookie',
        source: `lab-session:${targetUrl}`,
        ...(username ? { username } : {}),
      });
    }
  }
  return out;
}
