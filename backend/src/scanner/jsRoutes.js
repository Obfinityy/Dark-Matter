// Dark Matter rule-based scanner — JS-bundle API route mining.
//
// DIAGNOSIS (7 Nov 2026, Juice spec survey, parent-verified): Juice
// Shop publishes NO standalone OpenAPI spec — its only spec is an
// inline B2B object with 0 GET operations — so the openapi-targets
// phase can never unlock the battery there. But Juice's real API
// surface (/rest/*, /api/*) IS reachable: the SPA's served JS bundle
// (main.js, 458,398 bytes live) contains every route the frontend
// calls, as string literals in http.<method>(...) first arguments and
// as service-base assignments (`host = this.hostServer + "/rest/..."`)
// with this.host calls. Mining those literals statically (never
// executing the JS) recovers the route inventory a spec would have
// given.
//
// EVIDENCE (live, read-only GETs from EC2, 7 Nov 2026): 50 distinct
// route literals in main.js; 89 HttpClient calls (48 get / 25 post /
// 11 put / 4 delete / 1 patch); 27 service bases (hostServer is '.',
// so the base literal IS the path). 12 mined GET routes probed live,
// 12/12 respond (200/400/401/404/500 — all prove the route exists):
// /rest/products/search?q=test 200, /api/Products 200, /rest/languages
// 200, /rest/admin/application-version 200, /rest/chatbot/status 200,
// /rest/user/whoami 200, /api/Challenges 200, /rest/deluxe-membership
// 400, /rest/basket/1 401, /rest/2fa/status 401, /snippets/fixes/1
// 404, /rest/country-mapping 500.
//
// (7 Nov 2026, template-literal fix): host-prefixed template
// literals are mined too — http.get(`${this.hostServer}/rest/...`)
// and the service-relative http.get(`${this.host}/${e}`) — which
// the quoted-literal branches missed, stranding the Juice search
// route (and its q param) as a param-less orphan outside the cap.
//
// (8 Nov 2026, hostServer+literal fix): the QUOTED hostServer form
// http.post(this.hostServer+"/rest/user/login",e) is mined too
// (branch (a2)) — it is the form live Juice actually uses, and
// without it /rest/user/login and /rest/user/whoami never reached
// apiRoutes. Login/check routes also sort first before the 20-cap
// in both synthesisers, so the T4b oracle pair can never lose the
// cap race to param-bearing list routes.
//
// (8 Nov 2026, miner extension): TEMPLATE SERVICE BASES and
// INTERPOLATION-NAMED QUERY PARAMS. A service base is no longer
// only `host = this.hostServer + "literal"` — the base itself may
// be a template literal (`host = this.hostServer + `/rest/...``,
// `host = `${this.hostServer}/rest/...``) or a variable
// (`host = API_BASE + "/rest/..."`, `host = API_BASE`) resolved
// from the bundle's own single-assignment string literals
// (branches (a3)/(a4)/(a5)). Query-param NAMES may be interpolated
// (`?${name}=v`, `?${qs}`) — resolved the same way when the
// variable is bound to a valid name or a prebuilt query string;
// unbound interpolations are left unmined, never guessed. A
// reassigned, concatenated, or interpolated assignment never
// binds. Existing branches are untouched.
//
// (8 Nov 2026, chained-concat bases): a service base may be a CHAIN
// of `+` segments — `host = this.hostServer + "/rest" + "/admin"`,
// `host = API_BASE + "/rest" + "/admin"`, or a template base
// followed by `+ "/seg"`. The chain resolves only when EVERY
// segment is a plain string literal starting with '/'
// (concatChainTail); a variable, interpolated, escaped, or
// non-'/'-starting segment breaks the whole chain and the base is
// left unmined — never guessed, not even the prefix before the
// break. Existing branches, caps, and sort-first rules are
// untouched.
//
// MECHANISM: when the pasted page yielded zero param-bearing targets
// (after static + DOM + form synthesis + openapi-targets), fetch the
// page's same-origin <script> bundles (read-only GET, max 5) and mine
// GET-usable routes from them. A route is GET-usable when the bundle
// shows a GET call for it — or when it shows NO method evidence at
// all (an orphan service base: a GET probe is safe, a 404/405 is an
// honest no-op). A route with ONLY non-GET evidence (POST/PUT/DELETE/
// PATCH) is excluded — it is a write endpoint, never a GET target.
// Query params in the literal (e.g. ?q=${e}, ?email=, ?key=...) and
// template path params (${name}, :name) become probe points exactly
// like openapi.js: path params are templated with a UNIQUE safe
// filler, mirrored as query params with the same filler, and recorded
// as { name, segment } descriptors so the battery ALSO mutates the
// segment itself (probePoints.js). Cap 20 targets, param-bearing
// routes first — a param-less list endpoint (GET /api/Products)
// adds no battery value and must not crowd out a param route.
//
// SCOPE: GET targets only, same origin only, read-only GETs only.
// The bundle is parsed with regexes, never executed. A page with no
// scripts (or no mineable routes) is an honest no-op — the step
// records ok:true with 0 targets and the battery's skipped records
// still describe the gap.
import { randomBytes } from 'node:crypto';
import { fetchPage } from './fingerprint.js';

export const JS_ROUTES_MAX_TARGETS = 20;
export const JS_ROUTES_MAX_BUNDLES = 5;

// Route-literal prefixes the miner recognises. /snippets is Juice's
// challenge-snippet API (GET /snippets/fixes/${id}); /b2b/v2 is the
// B2B API root. Anything else (e.g. /login, /assets) is page/app
// routing, not an API route.
const ROUTE_PREFIXES = '(?:rest|api|b2b/v2|snippets)';
const ROUTE_PATH_RE = new RegExp(`/(?:rest|api|b2b/v2|snippets)/[A-Za-z0-9_/$\\{\\}.?=&-]*`, 'g');

// Login/check routes sort first before the 20-cap (re-proof fix,
// 8 Nov 2026): a param-less /rest/user/login or /rest/2fa/status
// must never lose the cap race to a param-bearing list route — the
// session-fixation step needs both to test logout invalidation.
// Mirrors the probe's LOGIN_PATH_RE + CHECK_PATH_RE (sessionFixation.js).
const LOGIN_CHECK_PATH_RE = /login|signin|authenticate|auth\/token|whoami|\/me$|\/profile$|\/user\/whoami|basket|2fa\/status|\/Users\//i;

/** Unique safe filler per param — same never-empty/never-equal rule as openapi.js. */
function filler(n) {
  return `dmprobe${n}_${randomBytes(2).toString('hex')}`;
}

/**
 * Extract same-origin <script src> bundle URLs from an HTML page.
 * Pure — exported for unit tests. Returns absolute URLs, deduplicated,
 * same origin as baseUrl, .js only (query strings stripped for the
 * extension check but kept on the URL), capped at JS_ROUTES_MAX_BUNDLES.
 * A page with no scripts yields [].
 */
export function extractScriptSrcs(html, baseUrl) {
  const out = [];
  if (typeof html !== 'string' || !html) return out;
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return out;
  }
  const seen = new Set();
  for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    let u;
    try {
      u = new URL(m[1], base);
    } catch {
      continue;
    }
    if (u.protocol !== base.protocol || u.host !== base.host) continue;
    if (!u.pathname.toLowerCase().endsWith('.js')) continue;
    const url = u.toString().split('#')[0];
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= JS_ROUTES_MAX_BUNDLES) break;
  }
  return out;
}

// Scan the first argument of an http.<method>( call starting just
// after the '('. Quote/depth aware: a string/template literal's
// closing quote ends the arg, a top-level comma or ')' ends it.
// Returns { arg, end } — arg is the raw first-argument text.
function firstArg(text, start) {
  let depth = 0;
  let quote = null;
  let esc = false;
  let j = start;
  while (j < text.length) {
    const ch = text[j];
    if (quote) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
    } else if (ch === '(' || ch === '[' || ch === '{') {
      depth += 1;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) return { arg: text.slice(start, j), end: j };
      depth -= 1;
    } else if (ch === ',' && depth === 0) {
      return { arg: text.slice(start, j), end: j };
    }
    j += 1;
  }
  return { arg: text.slice(start, j), end: j };
}

// Single-assignment string-literal variable bindings in one bundle:
// `const API_BASE = "/api"`, `let q = "query"`, `qs = "q=test"`.
// Only idents with EXACTLY ONE plain literal assignment count — a
// reassigned ident is never resolved, so the miner never guesses a
// value. The literal must be followed by `,`, `;`, `}` or
// end-of-input (so `x = "a" + "b"` does not bind x to "a"), and a
// value containing a backslash or ${} is never bound (escaped or
// interpolated content is not a plain literal). Pure — exported
// for unit tests.
export function collectLiteralBindings(src) {
  const counts = new Map();
  const values = new Map();
  if (typeof src !== 'string' || !src) return values;
  const re =
    /(?:^|[;{},\n])\s*(?:const\s+|let\s+|var\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`)(?=[\s]*[,;}\]]|$)/g;
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const value = m[2] ?? m[3] ?? m[4];
    if (value === undefined) continue;
    if (value.includes('\\') || value.includes('${')) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
    values.set(name, value);
  }
  for (const [name, count] of counts) {
    if (count !== 1) values.delete(name);
  }
  return values;
}

// Resolve a template-leading expression to a path prefix: a
// hostServer expression is the origin (''), a `.host` expression
// is the nearest preceding service base, a bare identifier resolves
// via literal bindings ('' or a '/'-prefixed value). Anything else
// is unresolvable — the miner never guesses a prefix.
function resolveBaseExpr(expr, bindings, bases) {
  const e = String(expr).trim();
  if (/(?:^|\.)hostServer$/.test(e)) return '';
  if (/\./.test(e)) {
    // Dotted path: only a `.host` property is a service base.
    if (/\.host$/.test(e)) return bases.length > 0 ? bases[bases.length - 1].path : null;
    return null;
  }
  // Bare identifier: literal binding wins; `host` alone is the
  // service base when unbound.
  const value = bindings.get(e);
  if (value !== undefined) {
    if (value === '' || value.startsWith('/')) return value;
    return null;
  }
  if (e === 'host') return bases.length > 0 ? bases[bases.length - 1].path : null;
  return null;
}

// Chained-concat segments after a service-base literal:
// `host = this.hostServer + "/rest" + "/admin"` resolves to
// "/rest/admin" only when EVERY `+ "segment"` is a plain string
// literal starting with '/'. A segment that is a variable, an
// interpolation, an escaped literal, or any non-literal expression
// breaks the chain — the whole base is left unmined, never guessed
// (not even the prefix before the break: "/rest" + dynSeg is not
// the route "/rest"). A plain literal that does not start with '/'
// also breaks the chain — the miner cannot know whether a '/'
// separator was intended, so it never invents one. Returns
// { extra, broke }: extra is the concatenated segments ('' when
// there is no chain); broke is true when a '+' chain was started
// but could not be resolved cleanly.
function concatChainTail(src, pos) {
  let extra = '';
  let j = pos;
  for (;;) {
    let k = j;
    while (k < src.length && /\s/.test(src[k])) k += 1;
    if (src[k] !== '+') return { extra, broke: false };
    k += 1;
    while (k < src.length && /\s/.test(src[k])) k += 1;
    const quote = src[k];
    if (quote !== '"' && quote !== "'" && quote !== '`') return { extra, broke: true };
    k += 1;
    let value = '';
    let closed = false;
    while (k < src.length) {
      const ch = src[k];
      if (ch === '\\') return { extra, broke: true };
      if (ch === quote) {
        closed = true;
        break;
      }
      if (quote === '`' && ch === '$' && src[k + 1] === '{') return { extra, broke: true };
      value += ch;
      k += 1;
    }
    if (!closed) return { extra, broke: true };
    if (!value.startsWith('/')) return { extra, broke: true };
    extra += value;
    j = k + 1;
  }
}

// Interpolation-named query params resolved via literal bindings:
// `?${name}=v` where name is bound to a valid param name, or
// `?${qs}` where qs is bound to a prebuilt query string (parsed
// for its names). Unbound interpolations are skipped — the miner
// never invents a param name.
function interpolationQueryNames(text, bindings) {
  const names = [];
  if (!bindings || bindings.size === 0) return names;
  for (const m of text.matchAll(/[?&]\$\{\s*([A-Za-z_$][\w$]*)\s*\}(?:=|(?![\w$=]))/g)) {
    const value = bindings.get(m[1]);
    if (value === undefined) continue;
    if (/^[A-Za-z_$][\w$-]*$/.test(value)) {
      if (!names.includes(value)) names.push(value);
    } else {
      for (const n of value.matchAll(/[?&]?([A-Za-z_$][\w$-]*)=/g)) {
        if (!names.includes(n[1])) names.push(n[1]);
      }
    }
  }
  return names;
}

// Query-param names appearing in a first-arg expression: every
// `?name=` / `&name=` fragment across all string literals in the
// arg (a concat arg carries the extra params as separate literals,
// e.g. "?current=" + e.current + "&new=" + ...), plus
// interpolation-named params resolved via bindings (see
// interpolationQueryNames). Names only — the values are always
// replaced with fillers at synthesis.
function queryNamesIn(arg, bindings = new Map()) {
  const names = new Set();
  for (const m of arg.matchAll(/[?&]([A-Za-z_$][\w$-]*)=/g)) names.add(m[1]);
  for (const n of interpolationQueryNames(arg, bindings)) names.add(n);
  return [...names];
}

// Path-param descriptors for one route path: ${name} template vars
// and :name segments. Descriptor { name, segment } — segment is the
// index in path.split('/'), matching probePoints.js.
function pathDescriptorsFor(routePath) {
  const descriptors = [];
  const parts = routePath.split('/');
  parts.forEach((part, segment) => {
    const tm = /^\$\{([^}/]+)\}$/.exec(part);
    if (tm) {
      descriptors.push({ name: tm[1], segment });
      return;
    }
    const colon = /^:([A-Za-z_$][\w$]*)$/.exec(part);
    if (colon) descriptors.push({ name: colon[1], segment });
  });
  return descriptors;
}

// Split a route literal into its path (before '?') and query names.
// Interpolation-named params in the query part are resolved via
// bindings (see interpolationQueryNames); unbound ones are skipped.
function splitRoute(literal, bindings = new Map()) {
  const q = literal.indexOf('?');
  const path = q >= 0 ? literal.slice(0, q) : literal;
  const queryNames = [];
  if (q >= 0) {
    const qs = literal.slice(q);
    for (const m of qs.matchAll(/[?&]([A-Za-z_$][\w$-]*)=/g)) {
      if (!queryNames.includes(m[1])) queryNames.push(m[1]);
    }
    for (const n of interpolationQueryNames(qs, bindings)) {
      if (!queryNames.includes(n)) queryNames.push(n);
    }
  }
  return { path, queryNames };
}

/**
 * Mine API route records from one JS bundle's text. Pure — exported
 * for unit tests. Returns [{ path, methods, queryNames,
 * pathDescriptors }] — one record per distinct route path; methods
 * is the sorted list of HTTP methods the bundle shows calling it
 * (empty = no method evidence, an orphan service base or a literal
 * never passed to an http call). Records are NOT synthesised URLs —
 * see synthesiseJsTargets. A bundle with no routes yields [].
 */
export function extractJsRouteRecords(bundleText) {
  const src = typeof bundleText === 'string' ? bundleText : '';
  if (!src) return [];
  // path -> { methods:Set, queryNames:Set, pathDescriptors }
  const records = new Map();
  const ensure = (path) => {
    if (!records.has(path)) {
      records.set(path, { path, methods: new Set(), queryNames: new Set(), pathDescriptors: pathDescriptorsFor(path) });
    }
    return records.get(path);
  };

  // Literal variable bindings for this bundle (single-assignment
  // string literals only — see collectLiteralBindings).
  const bindings = collectLiteralBindings(src);

  // Service bases: host = this.hostServer + "/rest/..." — the base
  // literal IS the route; the methods come from this.host calls in
  // the slice up to the next base assignment (services are defined
  // sequentially, methods inside their own class body). The base
  // itself may be a template literal or a variable (branches
  // (a3)/(a4)/(a5), miner extension) — candidates are resolved in
  // source order so a `this.host` template base can build on an
  // earlier base.
  const basePositions = [];
  const baseCandidates = [];
  // (a3) hostServer + quoted/template base literal (existing form,
  // backtick added): the literal IS the base path. A chained-concat
  // tail (`+ "/admin"`) resolves onto it (see concatChainTail); a
  // broken chain drops the whole candidate.
  for (const m of src.matchAll(/host\s*=\s*this\.hostServer\s*\+\s*["'`](\/[^"'`]+)["'`]/g)) {
    const chain = concatChainTail(src, m.index + m[0].length);
    if (chain.broke) continue;
    baseCandidates.push({ pos: m.index, path: m[1] + chain.extra });
  }
  // (a4) template base: host = `${EXPR}/rest/...` — resolve the
  // leading expression (hostServer = origin, .host = nearest base,
  // bare ident = literal binding); the remainder is the base path.
  // A chained-concat tail (`+ "/seg"`) resolves onto it as well.
  for (const m of src.matchAll(/host\s*=\s*`(?:\$\{\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\})([^`]*?)`/g)) {
    if (!m[2].startsWith('/')) continue;
    const chain = concatChainTail(src, m.index + m[0].length);
    if (chain.broke) continue;
    baseCandidates.push({ pos: m.index, templateExpr: m[1], rest: m[2] + chain.extra });
  }
  // (a4b) direct template base: host = `/rest/...` (no interpolation).
  // A chained-concat tail (`+ "/seg"`) resolves onto it as well.
  for (const m of src.matchAll(/host\s*=\s*`(\/[^`]*)`/g)) {
    const chain = concatChainTail(src, m.index + m[0].length);
    if (chain.broke) continue;
    baseCandidates.push({ pos: m.index, path: m[1] + chain.extra });
  }
  // (a5) variable base: host = <ident> + "literal" or host = <ident>.
  // A chained-concat tail (`+ "/admin"`) resolves onto the suffix.
  for (const m of src.matchAll(/host\s*=\s*([A-Za-z_$][\w$]*)\s*\+\s*["'`](\/[^"'`]+)["'`]/g)) {
    const chain = concatChainTail(src, m.index + m[0].length);
    if (chain.broke) continue;
    baseCandidates.push({ pos: m.index, varIdent: m[1], suffix: m[2] + chain.extra });
  }
  for (const m of src.matchAll(/host\s*=\s*([A-Za-z_$][\w$]*)(?=[\s]*[,;}\n]|$)/g)) {
    baseCandidates.push({ pos: m.index, varIdent: m[1], suffix: '' });
  }
  baseCandidates.sort((a, b) => a.pos - b.pos);
  for (const c of baseCandidates) {
    let path = null;
    if (c.path !== undefined) path = c.path;
    else if (c.templateExpr !== undefined) {
      const prefix = resolveBaseExpr(c.templateExpr, bindings, basePositions);
      if (prefix !== null) path = prefix + c.rest;
    } else if (c.varIdent !== undefined) {
      const value = bindings.get(c.varIdent);
      if (value !== undefined && (value === '' || value.startsWith('/'))) {
        path = value + c.suffix;
      }
    }
    if (path === null || path === '') continue;
    // Two regexes can match the same assignment — keep the first
    // candidate per position.
    if (basePositions.some((b) => b.pos === c.pos)) continue;
    basePositions.push({ pos: c.pos, path });
    ensure(path);
  }

  // Every http.<method>( call: attribute its route by first-arg shape.
  let callMatch;
  const callPattern = /http\.(get|post|put|delete|patch)\s*\(/g;
  while ((callMatch = callPattern.exec(src)) !== null) {
    const method = callMatch[1];
    const { arg } = firstArg(src, callPattern.lastIndex);
    const trimmed = arg.trim();
    // (a) this.host — bare, + "suffix", or + `suffix`: resolve via
    // the nearest preceding service base.
    if (/^this\.host\b/.test(trimmed)) {
      let base = null;
      for (const b of basePositions) {
        if (b.pos < callMatch.index) base = b;
        else break;
      }
      if (base) {
        const suffixMatch = /^\s*this\.host\s*\+\s*["'`]([^"'`]*)/.exec(trimmed);
        const suffix = suffixMatch ? suffixMatch[1] : '';
        const { path, queryNames } = splitRoute(base.path + suffix, bindings);
        const rec = ensure(path);
        rec.methods.add(method);
        for (const n of queryNames) rec.queryNames.add(n);
        // A suffix may itself carry template vars (e.g. `/${id}`).
        for (const d of pathDescriptorsFor(path)) {
          if (!rec.pathDescriptors.some((x) => x.name === d.name && x.segment === d.segment)) {
            rec.pathDescriptors.push(d);
          }
        }
      }
      continue;
    }
    // (a2) <host-expr> + "literal" — the hostServer-prefixed call
    // (re-proof fix, 8 Nov 2026): the REAL Juice main.js form is
    // this.http.post(this.hostServer+"/rest/user/login",e) and
    // this.http.get(this.hostServer+"/rest/user/whoami") — branch (a)
    // needs a word boundary after `host` (hostServer has none), (b)
    // needs a bare identifier (not `this.`), (b2) is template-only
    // and (c) needs a leading quote, so both routes survived only as
    // param-less orphans and never reached apiRoutes. The host
    // expression is this.hostServer or any <ident>.hostServer
    // (minified I.c.hostServer); the literal IS the route. `this.host`
    // stays with branch (a): it is the service base, not the origin
    // host, so its literal is a suffix on the nearest base.
    const hostServerPlus =
      /^\s*(?:this|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.hostServer\s*\+\s*["'`](\/[^"'`]+)["'`]/.exec(trimmed);
    if (hostServerPlus) {
      const { path, queryNames } = splitRoute(hostServerPlus[1], bindings);
      const rec = ensure(path);
      rec.methods.add(method);
      for (const n of queryNames) rec.queryNames.add(n);
      for (const n of queryNamesIn(arg, bindings)) rec.queryNames.add(n);
      continue;
    }
    // (b) <ident> + "literal" — the hostServer-prefixed call
    // (minified `Server + "/rest/..."`): the literal is the route.
    const hostPlus = /^\s*[A-Za-z_$][\w$]*\s*\+\s*["'`](\/[^"'`]+)["'`]/.exec(trimmed);
    if (hostPlus) {
      const { path, queryNames } = splitRoute(hostPlus[1], bindings);
      const rec = ensure(path);
      rec.methods.add(method);
      for (const n of queryNames) rec.queryNames.add(n);
      continue;
    }
    // (b2) template literal first arg starting with ${host} — the
    // hostServer/host-prefixed template call (Juice search, 7 Nov
    // 2026): http.get(`${this.hostServer}/rest/products/search?q=${e}`)
    // or the service-relative form http.get(`${this.host}/${e}`).
    // Before this, only templates starting with '/' (branch (c))
    // were mined, so a host-prefixed template fell through to (d)
    // and its route survived only as a param-less orphan (the live
    // /rest/products/search record had methods [] and queryNames [],
    // lost the 20-target cap race, and error-disclosure never saw
    // the SQLITE_ERROR trigger in-scan). The interpolation must be
    // a plain identifier path (this.hostServer, this.host,
    // I.c.hostServer, a minified bare Server); the remainder must
    // start with '/' or be empty. A remainder that IS a full API
    // path is the route (the interpolation is the origin); anything
    // else is a suffix on the nearest preceding service base
    // (branch (a) rule — `${this.host}` alone is the base itself).
    const templateHost =
      /^\s*`(?:\$\{\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\})([\s\S]*)`\s*$/.exec(trimmed);
    if (templateHost) {
      const rest = templateHost[2];
      const { path: restPath, queryNames: restQuery } = splitRoute(rest, bindings);
      if (/^\/(?:rest|api|b2b\/v2|snippets)\//.test(restPath)) {
        const rec = ensure(restPath);
        rec.methods.add(method);
        for (const n of restQuery) rec.queryNames.add(n);
        for (const n of queryNamesIn(arg, bindings)) rec.queryNames.add(n);
        for (const d of pathDescriptorsFor(restPath)) {
          if (!rec.pathDescriptors.some((x) => x.name === d.name && x.segment === d.segment)) {
            rec.pathDescriptors.push(d);
          }
        }
      } else {
        let base = null;
        for (const b of basePositions) {
          if (b.pos < callMatch.index) base = b;
          else break;
        }
        if (base) {
          const { path, queryNames } = splitRoute(base.path + rest, bindings);
          const rec = ensure(path);
          rec.methods.add(method);
          for (const n of queryNames) rec.queryNames.add(n);
          for (const n of queryNamesIn(arg, bindings)) rec.queryNames.add(n);
          for (const d of pathDescriptorsFor(path)) {
            if (!rec.pathDescriptors.some((x) => x.name === d.name && x.segment === d.segment)) {
              rec.pathDescriptors.push(d);
            }
          }
        }
      }
      continue;
    }
    // (c) direct string/template literal first arg starting with '/'.
    const literal = /^\s*["'`](\/[^"'`]+)["'`]/.exec(trimmed);
    if (literal) {
      const { path, queryNames } = splitRoute(literal[1], bindings);
      const rec = ensure(path);
      rec.methods.add(method);
      for (const n of queryNames) rec.queryNames.add(n);
      // Concat args carry extra query params as separate literals
      // ("?current=" + e.current + "&new=" + ...) — harvest them
      // from the whole arg expression.
      for (const n of queryNamesIn(arg, bindings)) rec.queryNames.add(n);
      continue;
    }
    // (d) bare variable / anything else: no route evidence.
  }

  // Bare route literals never passed to an http call (orphans — e.g.
  // a route named in a mapping table) still count as records with
  // empty methods: a GET probe is safe and a 404/405 is an honest
  // no-op. This also catches literals inside non-http contexts.
  ROUTE_PATH_RE.lastIndex = 0;
  for (const m of src.matchAll(ROUTE_PATH_RE)) {
    const { path } = splitRoute(m[0]);
    ensure(path);
  }

  return [...records.values()].map((r) => ({
    path: r.path,
    methods: [...r.methods].sort(),
    queryNames: [...r.queryNames],
    pathDescriptors: r.pathDescriptors,
  }));
}

/**
 * Synthesise GET targets from mined route records. Pure — exported
 * for unit tests. Returns { targets, params, pathParams } in the
 * openapi.js shape: targets are absolute GET URLs (same origin as
 * baseUrl); params counts probeable parameters across them;
 * pathParams maps each target URL to its path-param descriptors
 * [{ name, segment }]. Rules: a record with ONLY non-GET method
 * evidence is excluded (write endpoint); GET evidence OR no evidence
 * is included. Path template vars (${name}, :name) are replaced with
 * UNIQUE safe fillers and mirrored as query params with the same
 * filler; query params get fillers. Param-bearing routes sort first;
 * cap JS_ROUTES_MAX_TARGETS; same-origin only; never throws.
 */
export function synthesiseJsTargets(records, baseUrl) {
  const out = { targets: [], params: 0, pathParams: {} };
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return out;
  }
  const usable = (Array.isArray(records) ? records : []).filter((r) => {
    if (!r || typeof r.path !== 'string' || !r.path.startsWith('/')) return false;
    const methods = Array.isArray(r.methods) ? r.methods : [];
    // Non-empty without 'get' = write-only evidence: exclude.
    if (methods.length > 0 && !methods.includes('get')) return false;
    return true;
  });
  const hasParams = (r) =>
    (Array.isArray(r.queryNames) && r.queryNames.length > 0) ||
    (Array.isArray(r.pathDescriptors) && r.pathDescriptors.length > 0);
  // Login/check routes first (they decide the T4b oracle), then
  // param-bearing routes — both before the cap.
  const isLoginCheck = (r) => LOGIN_CHECK_PATH_RE.test(r.path);
  usable.sort((a, b) => Number(isLoginCheck(b)) - Number(isLoginCheck(a)) || Number(hasParams(b)) - Number(hasParams(a)));
  let n = 0;
  for (const r of usable) {
    if (out.targets.length >= JS_ROUTES_MAX_TARGETS) break;
    const descriptors = [];
    let templated = r.path;
    for (const d of Array.isArray(r.pathDescriptors) ? r.pathDescriptors : []) {
      const value = filler(++n);
      const segment = Number(d.segment);
      const parts = templated.split('/');
      if (!Number.isInteger(segment) || segment < 0 || segment >= parts.length) continue;
      const part = parts[segment];
      if (part !== `\${${d.name}}` && part !== `:${d.name}`) continue;
      parts[segment] = value;
      templated = parts.join('/');
      descriptors.push({ name: d.name, segment });
    }
    // Undeclared template leftovers: never probe a literal-brace URL.
    templated = templated.replace(/\$\{[^/{}]+\}/g, () => filler(++n));
    templated = templated.replace(/\/:[A-Za-z_$][\w$]*/g, () => `/${filler(++n)}`);
    let u;
    try {
      u = new URL(templated, base);
    } catch {
      continue;
    }
    if (u.protocol !== base.protocol || u.host !== base.host) continue;
    // Strip any query the literal carried, then set every known
    // query param to a filler (the battery mutates fillers, never a
    // hardcoded app value like key=nftMintChallenge).
    for (const k of [...u.searchParams.keys()]) u.searchParams.delete(k);
    const queryNames = Array.isArray(r.queryNames) ? r.queryNames : [];
    for (const qn of queryNames) u.searchParams.set(qn, filler(++n));
    // Mirror path params as query params with the SAME filler the
    // segment carries (openapi.js rule — keeps query-only probes
    // running and gives the control for segment findings).
    for (const d of descriptors) {
      const segValue = u.pathname.split('/')[d.segment];
      u.searchParams.set(d.name, segValue);
    }
    const url = u.toString().split('#')[0];
    if (out.targets.includes(url)) continue;
    out.targets.push(url);
    out.params += queryNames.length + descriptors.length;
    if (descriptors.length > 0) out.pathParams[url] = descriptors;
  }
  return out;
}

/**
 * Synthesise WRITE targets from mined route records (D3, #474 repair,
 * 8 Nov 2026). Pure — exported for unit tests. The complement of
 * synthesiseJsTargets: a record is a write target when it carries
 * ONLY non-GET method evidence (POST/PUT/DELETE/PATCH) — a write
 * endpoint that must never become a GET probe target. Returns bare
 * absolute URLs (no query fillers — these are API-login candidates
 * for the session-fixation T4b path, not probe points): path-template
 * vars (${name}, :name) are replaced with safe fillers so no
 * literal-brace URL is ever handed out. Same-origin only,
 * deduplicated, capped at JS_ROUTES_MAX_TARGETS. Never throws.
 */
export function synthesiseJsWriteTargets(records, baseUrl) {
  const out = [];
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return out;
  }
  let n = 0;
  const seen = new Set();
  // Login routes first (the T4b login candidate must survive the cap).
  const sorted = [...(Array.isArray(records) ? records : [])].sort(
    (a, b) => Number(LOGIN_CHECK_PATH_RE.test(b.path || '')) - Number(LOGIN_CHECK_PATH_RE.test(a.path || ''))
  );
  for (const r of sorted) {
    if (!r || typeof r.path !== 'string' || !r.path.startsWith('/')) continue;
    const methods = Array.isArray(r.methods) ? r.methods : [];
    // No method evidence (orphan) or any GET evidence: not write-only.
    if (methods.length === 0 || methods.includes('get')) continue;
    // Template path params with safe fillers (same rule as
    // synthesiseJsTargets — never hand out a literal-brace URL).
    let templated = r.path;
    for (const d of Array.isArray(r.pathDescriptors) ? r.pathDescriptors : []) {
      const segment = Number(d.segment);
      const parts = templated.split('/');
      if (!Number.isInteger(segment) || segment < 0 || segment >= parts.length) continue;
      const part = parts[segment];
      if (part !== `\${${d.name}}` && part !== `:${d.name}`) continue;
      parts[segment] = filler(++n);
      templated = parts.join('/');
    }
    templated = templated.replace(/\$\{[^/{}]+\}/g, () => filler(++n));
    templated = templated.replace(/\/:[A-Za-z_$][\w$]*/g, () => `/${filler(++n)}`);
    let u;
    try {
      u = new URL(templated.split('?')[0], base);
    } catch {
      continue;
    }
    if (u.protocol !== base.protocol || u.host !== base.host) continue;
    const url = u.toString().split('#')[0];
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= JS_ROUTES_MAX_TARGETS) break;
  }
  return out;
}

/**
 * Extract probeable GET targets from one bundle's text. Pure —
 * exported for unit tests. Convenience wrapper: records + synthesis.
 * Returns { targets, routes, params, pathParams, writeTargets } —
 * routes is the count of usable records before the cap; writeTargets
 * are the POST-only routes (D3) for API-login candidates, never GET
 * probe targets.
 */
export function extractJsRoutes(bundleText, baseUrl) {
  const records = extractJsRouteRecords(bundleText);
  const usable = records.filter((r) => {
    const methods = Array.isArray(r.methods) ? r.methods : [];
    return methods.length === 0 || methods.includes('get');
  });
  const { targets, params, pathParams } = synthesiseJsTargets(records, baseUrl);
  return { targets, routes: usable.length, params, pathParams, writeTargets: synthesiseJsWriteTargets(records, baseUrl) };
}

/**
 * Discover JS-bundle API targets for one pasted URL: fetch the page,
 * extract its same-origin <script> bundles (max 5), mine each for
 * GET-usable routes, merge and synthesise targets. Never throws:
 * every failure mode (no page, no scripts, fetch error, no routes)
 * returns { routesFound: false, targets: [], pathParams: {} } with
 * the reason recorded in `errors`, so the caller can record an
 * honest no-op instead of a failure. opts.fetchPage is the test seam
 * (defaults to fingerprint.fetchPage); it must return a
 * fetchPage-shaped { url, status, headers, body }.
 */
export async function discoverJsRoutes(baseUrl, opts = {}) {
  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  const errors = [];
  const empty = (extraErrors = []) => ({
    routesFound: false,
    bundlesFetched: 0,
    bundleUrls: [],
    targets: [],
    params: 0,
    pathParams: {},
    writeTargets: [],
    errors: [...errors, ...extraErrors],
  });
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return empty([`invalid base URL: ${baseUrl}`]);
  }
  let page;
  try {
    page = await fetchFn(base.toString(), opts);
  } catch (e) {
    return empty([`page: ${e && e.message ? String(e.message) : String(e)}`]);
  }
  if (!page || page.status !== 200 || !page.body) {
    return empty([`page: HTTP ${page ? page.status : 'no response'}`]);
  }
  const bundleUrls = extractScriptSrcs(page.body, base.toString());
  if (bundleUrls.length === 0) return empty(['page: no same-origin script bundles']);
  const allRecords = new Map();
  let fetched = 0;
  for (const bundleUrl of bundleUrls) {
    let bundle;
    try {
      bundle = await fetchFn(bundleUrl, opts);
    } catch (e) {
      errors.push(`${bundleUrl}: ${e && e.message ? String(e.message) : String(e)}`);
      continue;
    }
    if (!bundle || bundle.status !== 200 || !bundle.body) {
      errors.push(`${bundleUrl}: HTTP ${bundle ? bundle.status : 'no response'}`);
      continue;
    }
    fetched += 1;
    for (const r of extractJsRouteRecords(bundle.body)) {
      if (!allRecords.has(r.path)) {
        allRecords.set(r.path, { ...r, methods: new Set(r.methods), queryNames: new Set(r.queryNames) });
      } else {
        const cur = allRecords.get(r.path);
        for (const m of r.methods) cur.methods.add(m);
        for (const q of r.queryNames) cur.queryNames.add(q);
        for (const d of r.pathDescriptors) {
          if (!cur.pathDescriptors.some((x) => x.name === d.name && x.segment === d.segment)) {
            cur.pathDescriptors.push(d);
          }
        }
      }
    }
  }
  const records = [...allRecords.values()].map((r) => ({
    path: r.path,
    methods: [...r.methods].sort(),
    queryNames: [...r.queryNames],
    pathDescriptors: r.pathDescriptors,
  }));
  const { targets, params, pathParams } = synthesiseJsTargets(records, base.toString());
  return {
    routesFound: targets.length > 0,
    bundlesFetched: fetched,
    bundleUrls,
    targets,
    params,
    pathParams,
    // D3 (#474 repair): POST-only routes for API-login candidates
    // (T4b) — returned alongside, never merged into targets.
    writeTargets: synthesiseJsWriteTargets(records, base.toString()),
    errors,
  };
}
