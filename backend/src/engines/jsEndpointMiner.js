/**
 * jsEndpointMiner.js — endpoint discovery from client-side JavaScript bundles.
 *
 * A production JS bundle is a map of the server's API surface: WebSocket
 * channels, SSE streams, fetch/XHR targets, Axios instances, jQuery AJAX
 * calls, GraphQL endpoints and service-worker registrations all ship in
 * plain text to every visitor. For an authorized bug-bounty hunt this engine
 * turns observed bundle text into a deduplicated endpoint inventory —
 * purely passive string/config parsing. Nothing is requested, executed or
 * attacked; category-D testing (actually connecting to sockets, streams or
 * GraphQL endpoints) is a separate concern.
 *
 * Ideas covered:
 *  - 691 WebSocket URL extraction from JS (ws:// and wss:// discovery)
 *  - 692 EventSource URL harvesting (server-sent event streams)
 *  - 693 Fetch-call endpoint aggregation (endpoint inventory across bundles)
 *  - 694 Axios baseURL resolution (baseURL merged with relative paths)
 *  - 695 jQuery AJAX URL extraction ($.ajax / $.get / $.post / $.getJSON)
 *  - 696 GraphQL-in-JS endpoint discovery (Apollo / Urql configs)
 *  - 697 GraphQL query-name cataloging (operation names, never executed)
 *  - 698 Service-worker script mining (cached routes + push endpoints)
 *  - 699 Service-worker cache-key enumeration (precached app routes)
 *
 * All functions are pure: they parse observed text and return structured
 * findings. `bundleText` is a single bundle string; helpers accept an array
 * of bundle strings where noted.
 */

/** De-duplicate while preserving first-seen order. */
function unique(list) {
  return [...new Set(list)];
}

/** Match a JS string literal (single, double or template — without nesting). */
const STRING_LITERAL = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;

/**
 * Strip JS comments so matches inside dead/commented code are ignored.
 *
 * Implemented as a small tokenizer: string literals (including template
 * literals and escapes) are preserved verbatim so `//` inside URLs like
 * "https://…" is never mistaken for a comment.
 *
 * @param {string} js bundle text
 * @returns {string} text without // and block comments
 */
export function stripJsComments(js) {
  const text = String(js || '');
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      out += ch;
      i++;
      while (i < text.length) {
        const c = text[i];
        out += c;
        if (c === '\\') {
          out += text[i + 1] ?? '';
          i += 2;
          continue;
        }
        i++;
        if (c === quote) break;
      }
      continue;
    }
    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * Idea 691 — Extract ws:// and wss:// URLs from bundle text.
 *
 * Finds bare ws(s) URLs in string literals as well as `new WebSocket(url)`
 * call sites. Template concatenations like "wss://" + host + "/socket"
 * are reassembled when the parts are adjacent literals.
 *
 * @param {string} js bundle text
 * @returns {Array<{url:string, secure:boolean, callSite:boolean}>}
 */
export function extractWebSocketUrls(js) {
  const text = stripJsComments(js);
  const found = [];
  const seen = new Set();

  const push = (url, callSite) => {
    const u = String(url).trim();
    if (!/^wss?:\/\//i.test(u)) return;
    const key = u.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ url: u, secure: /^wss:/i.test(u), callSite: !!callSite });
  };

  // new WebSocket("...") call sites FIRST (so callSite flags survive dedupe),
  // including simple concatenations: new WebSocket("wss://" + host + "/socket")
  const ctor = /new\s+(?:window\.)?WebSocket\s*\(\s*([\s\S]{0,400}?)\s*\)/g;
  let m;
  while ((m = ctor.exec(text)) !== null) {
    const parts = m[1].split(/\s*\+\s*/).map(p => {
      const lm = p.match(/^(['"`])((?:\\.|(?!\1)[^\\])*)\1$/);
      if (lm) return lm[2];
      const ident = p.match(/^[A-Za-z_$][\w$]*$/);
      return ident ? ident[0] : null; // keep variable names as placeholders
    });
    if (parts.length > 0 && parts.every(p => p !== null)) {
      push(parts.join(''), true);
    }
  }

  // Bare ws(s):// URLs anywhere in string literals.
  const bare = /wss?:\/\/[^\s"'`<>(){}[\]\\|^]+/gi;
  while ((m = bare.exec(text)) !== null) push(m[0], false);

  return found;
}

/**
 * Idea 692 — Harvest EventSource (server-sent events) URLs.
 *
 * Matches `new EventSource(url)` call sites and common config keys
 * (`eventSourceUrl`, `sseUrl`, `streamUrl`) in client config objects.
 *
 * @param {string} js bundle text
 * @returns {Array<{url:string, source:'constructor'|'config', evidence:string}>}
 */
export function harvestEventSourceUrls(js) {
  const text = stripJsComments(js);
  const found = [];
  const seen = new Set();

  const push = (url, source, evidence) => {
    const u = String(url).trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    found.push({ url: u, source, evidence });
  };

  // new EventSource("https://host/events")
  const ctor = /new\s+(?:window\.)?EventSource\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = ctor.exec(text)) !== null) {
    push(m[2], 'constructor', 'new EventSource()');
  }

  // Config keys: eventSourceUrl: "/sse", sseUrl: "…"
  const cfg =
    /(eventSourceUrl|sseUrl|sseEndpoint|eventStreamUrl|streamUrl)\s*[:=]\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/gi;
  while ((m = cfg.exec(text)) !== null) {
    push(m[3], 'config', m[1]);
  }

  return found;
}

/**
 * Idea 693 — Aggregate every fetch() call target across bundles.
 *
 * Matches `fetch(url)`, `window.fetch(url)`, `new Request(url)` and the
 * common `Request` second-argument-less call shape. Only static string
 * literals are collected (dynamic URLs are reported separately).
 *
 * @param {string|string[]} bundles one bundle string or an array of them
 * @returns {Array<{url:string, kind:'fetch'|'Request', occurrences:number, dynamicCalls:number}>}
 */
export function aggregateFetchEndpoints(bundles) {
  const texts = Array.isArray(bundles) ? bundles : [bundles];
  const counts = new Map();
  let dynamicCalls = 0;

  const callRe =
    /(?:\bwindow\.)?fetch\s*\(\s*([\s\S]{0,240}?)\s*[,)]|new\s+Request\s*\(\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/g;

  for (const raw of texts) {
    const text = stripJsComments(raw);
    let m;
    while ((m = callRe.exec(text)) !== null) {
      // `new Request("literal")` shape
      if (m[2] !== undefined) {
        const url = m[3];
        const key = `Request|${url}`;
        counts.set(key, (counts.get(key) || 0) + 1);
        continue;
      }
      // fetch(arg) shape — classify the argument
      const arg = m[1];
      const lit = arg.match(/^(['"`])((?:\\.|(?!\1)[^\\])*)\1$/);
      if (lit && !(lit[1] === '`' && lit[2].includes('${'))) {
        const key = `fetch|${lit[2]}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      } else if (arg.trim()) {
        dynamicCalls += 1; // template literal with ${}, expression or variable
      }
    }
  }

  const inventory = [];
  for (const [key, occurrences] of counts) {
    const [kind, url] = key.split('|');
    inventory.push({ url, kind, occurrences, dynamicCalls: 0 });
  }
  inventory.sort((a, b) => b.occurrences - a.occurrences);
  if (dynamicCalls > 0) {
    inventory.push({
      url: '(dynamic — template/variable)',
      kind: 'fetch',
      occurrences: dynamicCalls,
      dynamicCalls,
    });
  }
  return inventory;
}

/**
 * Idea 694 — Resolve Axios instances' baseURLs and merge with relative paths.
 *
 * Finds `axios.create({ baseURL })`, `axios.defaults.baseURL = …`,
 * `instance.defaults.baseURL = …` and per-instance `.get/.post/.put/…`
 * calls, then joins each relative path with every discovered baseURL.
 *
 * @param {string} js bundle text
 * @returns {{ baseUrls: string[], endpoints: Array<{method:string, path:string, baseUrl:string, fullUrl:string}> }}
 */
export function resolveAxiosBaseUrls(js) {
  const text = stripJsComments(js);
  const baseUrls = unique(
    [
      ...text.matchAll(/baseURL\s*:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g),
      ...text.matchAll(
        /(?:axios|[a-zA-Z_$][\w$]*)\.defaults\.baseURL\s*=\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g
      ),
    ].map(m => m[2])
  ).filter(Boolean);

  const endpoints = [];
  const seen = new Set();
  const callRe =
    /([a-zA-Z_$][\w$]*)\.(get|post|put|patch|delete|head|options|request)\s*\(\s*(['"`])((?:\\.|(?!\3)[^\\])*)\3/g;
  let m;
  while ((m = callRe.exec(text)) !== null) {
    const [, , method, , path] = m;
    // Skip axios.<method> when it looks like an axios call only if it is
    // the axios object or a plausible instance variable (heuristic: accept).
    const bases = baseUrls.length > 0 ? baseUrls : [''];
    for (const baseUrl of bases) {
      const fullUrl = baseUrl ? joinUrl(baseUrl, path) : path;
      const key = `${method}|${fullUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      endpoints.push({ method: method.toUpperCase(), path, baseUrl, fullUrl });
    }
  }

  return { baseUrls, endpoints };
}

/** Join a base URL with a relative path without double slashes. */
function joinUrl(base, path) {
  const b = String(base).replace(/\/+$/, '');
  const p = String(path).replace(/^\/+/, '');
  return `${b}/${p}`;
}

/**
 * Idea 695 — Extract $.ajax / $.get / $.post / $.getJSON URLs (legacy jQuery).
 *
 * Matches `$.ajax({ url })`, `$.get(url)`, `$.post(url)`,
 * `$.getJSON(url)` and `.load(url)` shorthands.
 *
 * @param {string} js bundle text
 * @returns {Array<{url:string, method:string, source:string}>}
 */
export function extractJqueryAjaxUrls(js) {
  const text = stripJsComments(js);
  const found = [];
  const seen = new Set();

  const push = (url, method, source) => {
    const u = String(url).trim();
    if (!u || seen.has(`${method}|${u}`)) return;
    seen.add(`${method}|${u}`);
    found.push({ url: u, method, source });
  };

  // $.ajax({ url: "/api/x", method: "post" })
  const ajaxBlock = /\$\s*\.\s*ajax\s*\(\s*\{([\s\S]{0,600}?)\}\s*\)/g;
  let m;
  while ((m = ajaxBlock.exec(text)) !== null) {
    const body = m[1];
    const urlM = body.match(/\burl\s*:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/);
    if (!urlM) continue;
    const methodM = body.match(/\b(?:method|type)\s*:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/i);
    push(urlM[2], methodM ? methodM[2].toUpperCase() : 'GET', '$.ajax');
  }

  // $.get(url) / $.post(url) / $.getJSON(url) / $.getScript(url)
  const short = /\$\s*\.\s*(get|post|getJSON|getScript)\s*\(\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/g;
  while ((m = short.exec(text)) !== null) {
    const method =
      m[1].toLowerCase() === 'post' ? 'POST' : m[1].toLowerCase() === 'getscript' ? 'GET' : 'GET';
    push(m[3], method, `$.${m[1]}`);
  }

  // $(…).load("url")
  const loadRe = /\.load\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  while ((m = loadRe.exec(text)) !== null) {
    push(m[2], 'GET', '.load');
  }

  return found;
}

/**
 * Idea 696 — Discover GraphQL endpoints from client configs.
 *
 * Finds Apollo `uri:` / `new HttpLink({ uri })` configs, urql `url:` configs
 * and bare `/graphql` path references that sit near GraphQL client code.
 * Query execution is out of scope (category D) — this returns endpoints only.
 *
 * @param {string} js bundle text
 * @returns {Array<{endpoint:string, source:string}>}
 */
export function discoverGraphQLEndpoints(js) {
  const text = stripJsComments(js);
  const found = [];
  const seen = new Set();

  const push = (endpoint, source) => {
    const e = String(endpoint).trim();
    if (!e || seen.has(e)) return;
    seen.add(e);
    found.push({ endpoint: e, source });
  };

  // uri: "https://api.example.com/graphql"  (Apollo)
  const uriRe = /\buri\s*:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = uriRe.exec(text)) !== null) {
    if (/graphql/i.test(m[2]) || looksLikeEndpoint(m[2])) {
      push(m[2], 'apollo uri');
    }
  }

  // urql: createClient({ url: "…" }) / exchange config url
  const urlRe = /\burl\s*:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  while ((m = urlRe.exec(text)) !== null) {
    if (/graphql/i.test(m[2])) push(m[2], 'urql url');
  }

  // Bare "/graphql" (or full URLs ending in /graphql) referenced in code
  // that mentions graphql tooling nearby.
  if (/graphql/i.test(text)) {
    const bare =
      /(['"`])((?:https?:\/\/[^\s"'`]+)?\/[a-zA-Z0-9_./-]*(?:graphql|gql)[a-zA-Z0-9_./-]*)(\1)/gi;
    while ((m = bare.exec(text)) !== null) {
      push(m[2], 'path reference');
    }
  }

  return found;
}

/** Heuristic: does a string look like an API endpoint path or URL? */
function looksLikeEndpoint(s) {
  return /^https?:\/\//i.test(s) || /^\//.test(s) || /\/(api|v\d|graphql)/i.test(s);
}

/**
 * Idea 697 — Catalog GraphQL operation names without executing them.
 *
 * Parses `query|mutation|subscription Name`, `fragment Name on Type`,
 * `gql`…`` / `graphql`…`` tagged templates and anonymous operations.
 * The catalog maps API capabilities purely from client code.
 *
 * @param {string} js bundle text
 * @returns {Array<{kind:'query'|'mutation'|'subscription'|'fragment'|'anonymous', name:string|null, source:string}>}
 */
export function catalogGraphQLOperations(js) {
  const text = stripJsComments(js);
  const found = [];
  const seen = new Set();

  const push = (kind, name, source) => {
    const key = `${kind}|${name || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ kind, name, source });
  };

  // Named operations: query GetUser { … }
  const opRe = /\b(query|mutation|subscription)\s+([A-Za-z_][\w$]*)\s*(?:\([^)]*\))?\s*\{/g;
  let m;
  while ((m = opRe.exec(text)) !== null) {
    push(m[1].toLowerCase(), m[2], 'operation definition');
  }

  // Fragments: fragment UserFields on User { … }
  const fragRe = /\bfragment\s+([A-Za-z_][\w$]*)\s+on\s+[A-Za-z_][\w$]*/g;
  while ((m = fragRe.exec(text)) !== null) {
    push('fragment', m[1], 'fragment definition');
  }

  // Anonymous operations inside gql/graphql tagged templates.
  const tagged = /\b(?:gql|graphql)\s*`([\s\S]*?)`/g;
  while ((m = tagged.exec(text)) !== null) {
    const body = m[1];
    const anon = /\b(query|mutation|subscription)\s*(\([^)]*\))?\s*\{/.exec(body);
    if (anon && !seen.has(`${anon[1]}|`)) {
      push(anon[1].toLowerCase(), null, 'anonymous operation');
    }
  }

  return found;
}

/**
 * Idea 698 — Mine a service-worker script for cached routes and push config.
 *
 * Parses precache manifests (workbox `precacheAndRoute([...])` or plain
 * `CACHE.addAll([...])` arrays), `registerRoute(pattern)` registrations,
 * push subscription config (`pushManager.subscribe`, `applicationServerKey`)
 * and `self.skipWaiting()`-style lifecycle hints. Pure text parsing — the
 * script is read from the target's own published assets, never fetched here.
 *
 * @param {string} swJs service-worker script text
 * @returns {{ precache: string[], routes: Array<{pattern:string, strategy:string|null}>, push: {applicationServerKey:boolean, subscribeCall:boolean}, cacheNames: string[] }}
 */
export function mineServiceWorker(swJs) {
  const text = stripJsComments(swJs);
  const precache = [];
  const routes = [];
  const cacheNames = [];

  // Workbox precacheAndRoute([{url:"/index.html",revision:"…"}, …])
  const wb = /precacheAndRoute\s*\(\s*\[([\s\S]{0,4000}?)\]\s*\)/g;
  let m;
  while ((m = wb.exec(text)) !== null) {
    const urlRe = /url\s*:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    let um;
    while ((um = urlRe.exec(m[1])) !== null) precache.push(um[2]);
  }

  // Plain string arrays inside precache helpers / cache.addAll([...])
  const addAll = /(?:precache|addAll)\s*\(\s*\[([\s\S]{0,3000}?)\]\s*\)/g;
  while ((m = addAll.exec(text)) !== null) {
    let lm;
    const litRe = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    while ((lm = litRe.exec(m[1])) !== null) {
      if (/^\//.test(lm[2]) || /\.html?$|\.js$|\.css$/i.test(lm[2])) {
        precache.push(lm[2]);
      }
    }
  }

  // registerRoute(/pattern/ or "/path", new StaleWhileRevalidate())
  const rr =
    /registerRoute\s*\(\s*(\/(?:\\.|[^/\\])+\/[a-z]*|(['"`])((?:\\.|(?!\2)[^\\])*)\2)\s*(?:,\s*new\s+([A-Za-z_][\w$]*))?/g;
  while ((m = rr.exec(text)) !== null) {
    routes.push({
      pattern: m[1],
      strategy: m[4] || null,
    });
  }

  // Push config evidence (presence only — no keys are extracted)
  const push = {
    applicationServerKey: /applicationServerKey\s*:/.test(text),
    subscribeCall: /pushManager\s*\.\s*subscribe\s*\(/.test(text),
  };

  // caches.open("name") / const CACHE_NAME = "…"
  const cn = /(?:caches\s*\.\s*open\s*\(\s*|CACHE_NAME\s*=\s*)(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  while ((m = cn.exec(text)) !== null) cacheNames.push(m[2]);

  return {
    precache: unique(precache),
    routes,
    push,
    cacheNames: unique(cacheNames),
  };
}

/**
 * Idea 699 — Enumerate service-worker cache keys to list precached routes.
 *
 * Workbox build output embeds a manifest of `{url, revision}` pairs plus
 * `self.__WB_MANIFEST` entries; older hand-rolled workers keep a plain
 * `FILES_TO_CACHE` array. This enumerator normalizes all of them.
 *
 * @param {string} swJs service-worker script text
 * @returns {Array<{url:string, revision:string|null, source:string}>}
 */
export function enumerateServiceWorkerCacheKeys(swJs) {
  const text = stripJsComments(swJs);
  const entries = [];
  const seen = new Set();

  const push = (url, revision, source) => {
    const u = String(url).trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    entries.push({ url: u, revision: revision || null, source });
  };

  // {url:"/app.js", revision:"abc123"} pairs (workbox manifest entries)
  const pair =
    /\{\s*url\s*:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1\s*(?:,\s*revision\s*:\s*(['"`])((?:\\.|(?!\3)[^\\])*)\3\s*)?\}/g;
  let m;
  while ((m = pair.exec(text)) !== null) {
    push(m[2], m[4] || null, 'workbox manifest');
  }

  // self.__WB_MANIFEST; (injected placeholder — recorded as a marker)
  if (/self\s*\.\s*__WB_MANIFEST/.test(text)) {
    push('(self.__WB_MANIFEST — build-injected)', null, 'wb manifest placeholder');
  }

  // FILES_TO_CACHE = ["/", "/index.html", …]
  const ftc =
    /(?:FILES_TO_CACHE|CACHE_URLS|PRECACHE_URLS|ASSETS_TO_CACHE)\s*=\s*\[([\s\S]{0,3000}?)\]/g;
  while ((m = ftc.exec(text)) !== null) {
    let lm;
    const litRe = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    while ((lm = litRe.exec(m[1])) !== null) push(lm[2], null, 'cache array');
  }

  return entries;
}

/**
 * Idea 691-699 — Run the full JS endpoint mining pipeline over bundles.
 *
 * @param {string|string[]} bundles one or more bundle texts
 * @param {string} [swJs] optional service-worker script text
 * @returns {{ websockets, eventSources, fetchEndpoints, axios, jquery, graphqlEndpoints, graphqlOperations, serviceWorker, cacheKeys }}
 */
export function mineJsEndpoints(bundles, swJs) {
  const texts = Array.isArray(bundles) ? bundles : [bundles];
  const combined = texts.join('\n');

  return {
    websockets: extractWebSocketUrls(combined),
    eventSources: harvestEventSourceUrls(combined),
    fetchEndpoints: aggregateFetchEndpoints(texts),
    axios: resolveAxiosBaseUrls(combined),
    jquery: extractJqueryAjaxUrls(combined),
    graphqlEndpoints: discoverGraphQLEndpoints(combined),
    graphqlOperations: catalogGraphQLOperations(combined),
    serviceWorker: swJs ? mineServiceWorker(swJs) : null,
    cacheKeys: swJs ? enumerateServiceWorkerCacheKeys(swJs) : [],
  };
}
