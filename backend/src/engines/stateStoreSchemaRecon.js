/**
 * stateStoreSchemaRecon.js — Client-asset surface recon: state stores & validation schemas.
 *
 * For the Dark-Matter autonomous bug-bounty agent. During an authorized hunt the
 * agent collects the target's own publicly served HTML/JS/CSS. Modern frontends
 * encode their backend API surface inside client state-management wiring
 * (Redux middleware, SWR/React-Query cache keys, Apollo/Urql/Relay GraphQL
 * plumbing, tRPC routers) and inside client-side validation schemas
 * (Zod/Yup/Joi), which name the exact fields an API accepts.
 *
 * This engine extracts that surface deterministically from provided page/asset
 * text — pure functions, no network calls, no side effects:
 *
 *  Idea 00951  analyzeReduxMiddlewareChains — Redux applyMiddleware chains and
 *               the API calls made inside middleware bodies.
 *  Idea 00952  enumerateSwrKeys            — useSWR cache keys that encode URLs.
 *  Idea 00953  mapReactQueryKeys           — React Query query keys → endpoints.
 *  Idea 00954  extractApolloCacheShapes    — InMemoryCache type policies + gql
 *               documents for GraphQL field mapping.
 *  Idea 00955  mapUrqlExchanges            — Urql client exchange pipelines.
 *  Idea 00956  mineRelayArtifacts          — Relay graphql`` documents + generated
 *               artifact references.
 *  Idea 00957  extractTRpcRouterShapes     — tRPC router procedure definitions.
 *  Idea 00958  inferApiShapesFromZod       — z.object() schemas → API shapes.
 *  Idea 00959  harvestYupFormFields        — yup schemas → form field inventory.
 *  Idea 00960  mapApisFromJoi              — Joi schemas → API shape mapping.
 *
 * Defensive/product framing only: the input is the target's own publicly served
 * client code, gathered during an authorized engagement. Findings are endpoint
 * and field hints for further in-scope testing — never exploit payloads.
 */

/**
 * Split a comma-separated list at the top level only (commas inside (), {},
 * [] or template/string literals do not split). Used to separate fields of
 * schema object literals without a full parser.
 * @param {string} s
 * @returns {string[]} trimmed top-level segments
 */
function splitTopLevel(s) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let cur = '';
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quote) {
      cur += ch;
      if (ch === quote && s[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '(' || ch === '{' || ch === '[') depth += 1;
    if (ch === ')' || ch === '}' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

/**
 * Extract the body of a call like name(...) starting at the opening paren,
 * honouring nesting and string literals.
 * @param {string} text full source text
 * @param {number} openIdx index of the opening '('
 * @returns {{body: string, end: number}|null}
 */
function extractParenBody(text, openIdx) {
  let depth = 0;
  let quote = null;
  for (let i = openIdx; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(') depth += 1;
    if (ch === ')') {
      depth -= 1;
      if (depth === 0) return { body: text.slice(openIdx + 1, i), end: i };
    }
  }
  return null;
}

/**
 * Guess an HTTP method from a fetch/axios call context.
 * @param {string} callText the source of the call expression
 * @returns {string} upper-case method guess
 */
function guessMethod(callText) {
  const m = /\bmethod\s*:\s*['"`]([A-Za-z]+)['"`]/.exec(callText);
  if (m) return m[1].toUpperCase();
  if (/\.post\s*\(|\.put\s*\(/i.test(callText)) return 'POST';
  if (/\.delete\s*\(/i.test(callText)) return 'DELETE';
  if (/\.patch\s*\(/i.test(callText)) return 'PATCH';
  return 'GET';
}

/**
 * Return true when a string literal looks like an API endpoint path or URL.
 * @param {string} s
 * @returns {boolean}
 */
function looksLikeEndpoint(s) {
  return /^(https?:\/\/|\/)[\w\-./{}:$?=&%]*$/i.test(s) || /^\/api\//i.test(s);
}

/**
 * Find fetch/axios style calls with string-literal URLs inside a source region.
 * @param {string} region source text to scan
 * @returns {{url: string, method: string, via: string}[]}
 */
function findApiCalls(region) {
  const out = [];
  const seen = new Set();
  const callRe =
    /(fetch|axios\.(get|post|put|patch|delete|head|options)|axios)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = callRe.exec(region)) !== null) {
    const url = m[3];
    if (!looksLikeEndpoint(url)) continue;
    // Grab a small window after the call for an options object (method guess).
    const window = region.slice(m.index, m.index + 400);
    const via = m[1].toLowerCase().includes('axios') ? 'axios' : 'fetch';
    const method =
      via === 'axios' && m[2] ? m[2].toUpperCase() : guessMethod(window);
    const key = `${method} ${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url, method, via });
  }
  return out;
}

/**
 * Idea 00951 — Analyze Redux middleware for API call patterns.
 *
 * Finds applyMiddleware(...) composition, counts store=>next=>action middleware
 * definitions, and extracts API calls (fetch/axios) made inside middleware
 * bodies, which reveal background/side-effect request patterns.
 *
 * @param {string} js page or bundle text
 * @returns {{middlewares: string[], chainDefinitions: number, apiCalls: {url: string, method: string, via: string, middleware: string|null}[]}}
 */
export function analyzeReduxMiddlewareChains(js) {
  if (typeof js !== 'string' || !js) {
    return { middlewares: [], chainDefinitions: 0, apiCalls: [] };
  }
  const middlewares = [];
  const seenMw = new Set();
  const applyRe = /applyMiddleware\s*\(/g;
  let m;
  while ((m = applyRe.exec(js)) !== null) {
    const open = js.indexOf('(', m.index);
    const body = extractParenBody(js, open);
    if (!body) continue;
    for (const seg of splitTopLevel(body.body)) {
      const name = seg.trim().split(/[^A-Za-z0-9_$]/)[0];
      if (name && !seenMw.has(name)) {
        seenMw.add(name);
        middlewares.push(name);
      }
    }
  }

  // Middleware factory shape: (store) => (next) => (action) => {...}
  const chainDefinitions = (
    js.match(/\(\s*store\s*\)\s*=>\s*\(\s*next\s*\)\s*=>\s*\(\s*action\s*\)/g) || []
  ).length;

  // Attribute API calls to the enclosing middleware function when possible.
  const apiCalls = [];
  const seenCall = new Set();
  const mwDefRe =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\(\s*store\s*\)\s*=>\s*\(\s*next\s*\)\s*=>\s*\(\s*action\s*\)\s*=>\s*\{/g;
  let def;
  while ((def = mwDefRe.exec(js)) !== null) {
    const open = js.indexOf('{', def.index + def[0].length - 1);
    let depth = 0;
    let quote = null;
    let end = -1;
    for (let i = open; i < js.length; i += 1) {
      const ch = js[i];
      if (quote) {
        if (ch === quote && js[i - 1] !== '\\') quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    const region = js.slice(open, end + 1);
    for (const call of findApiCalls(region)) {
      const key = `${def[1]} ${call.method} ${call.url}`;
      if (seenCall.has(key)) continue;
      seenCall.add(key);
      apiCalls.push({ ...call, middleware: def[1] });
    }
  }
  // Calls not attributable to a named middleware still matter.
  for (const call of findApiCalls(js)) {
    const key = `* ${call.method} ${call.url}`;
    const already = apiCalls.some(
      (c) => c.method === call.method && c.url === call.url
    );
    if (already || seenCall.has(key)) continue;
    seenCall.add(key);
    apiCalls.push({ ...call, middleware: null });
  }
  return { middlewares, chainDefinitions, apiCalls };
}

/**
 * Idea 00952 — Enumerate SWR cache keys that encode API URLs.
 *
 * useSWR(key) treats string/array keys as the request identity; string keys
 * are almost always the request URL itself. Returns the distinct keys with a
 * flag for URL-like ones.
 *
 * @param {string} js page or bundle text
 * @returns {{key: string, isUrl: boolean, kind: 'string'|'array'}[]}
 */
export function enumerateSwrKeys(js) {
  if (typeof js !== 'string' || !js) return [];
  const out = [];
  const seen = new Set();
  const push = (key, kind) => {
    const k = `${kind}:${key}`;
    if (seen.has(k) || !key) return;
    seen.add(k);
    out.push({ key, isUrl: looksLikeEndpoint(key), kind });
  };
  let m;
  const strRe = /useSWR\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((m = strRe.exec(js)) !== null) push(m[1], 'string');
  const arrRe = /useSWR\s*\(\s*\[\s*['"`]([^'"`]+)['"`]/g;
  while ((m = arrRe.exec(js)) !== null) push(m[1], 'array');
  // Template-literal keys: useSWR(`/api/users/${id}`)
  const tplRe = /useSWR\s*\(\s*`([^`$]+)(?:\$\{[^}]*\}[^`]*)*`/g;
  while ((m = tplRe.exec(js)) !== null) {
    const raw = js.slice(m.index, js.indexOf('`', m.index + 7) + 1);
    const normalized = raw
      .replace(/^useSWR\s*\(\s*`/, '')
      .replace(/`\s*$/, '')
      .replace(/\$\{[^}]*\}/g, '{param}');
    push(normalized, 'string');
  }
  return out;
}

/**
 * Idea 00953 — Map React Query keys to backend endpoints.
 *
 * useQuery(queryKey, ...) and useMutation keys are usually arrays whose
 * members include the endpoint path. Returns each distinct key tuple with the
 * members that look like endpoints pulled out.
 *
 * @param {string} js page or bundle text
 * @returns {{hook: string, key: string[], endpoints: string[]}[]}
 */
export function mapReactQueryKeys(js) {
  if (typeof js !== 'string' || !js) return [];
  const out = [];
  const seen = new Set();
  const hookRe = /(useQuery|useMutation|useInfiniteQuery)\s*\(\s*\[/g;
  let m;
  while ((m = hookRe.exec(js)) !== null) {
    const open = js.indexOf('[', m.index);
    let depth = 0;
    let quote = null;
    let end = -1;
    for (let i = open; i < js.length; i += 1) {
      const ch = js[i];
      if (quote) {
        if (ch === quote && js[i - 1] !== '\\') quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '[') depth += 1;
      if (ch === ']') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    const inner = js.slice(open + 1, end);
    const members = [];
    const litRe = /['"`]([^'"`]+)['"`]/g;
    let lit;
    while ((lit = litRe.exec(inner)) !== null) members.push(lit[1]);
    const keyStr = JSON.stringify(members);
    const sig = `${m[1]}:${keyStr}`;
    if (seen.has(sig) || members.length === 0) continue;
    seen.add(sig);
    out.push({
      hook: m[1],
      key: members,
      endpoints: members.filter(looksLikeEndpoint),
    });
  }
  // queryKey: [...] object-form declarations
  const qkRe = /queryKey\s*:\s*\[/g;
  while ((m = qkRe.exec(js)) !== null) {
    const open = js.indexOf('[', m.index);
    const close = js.indexOf(']', open);
    if (close === -1 || close - open > 500) continue;
    const inner = js.slice(open + 1, close);
    const members = [];
    const litRe = /['"`]([^'"`]+)['"`]/g;
    let lit;
    while ((lit = litRe.exec(inner)) !== null) members.push(lit[1]);
    const sig = `queryKey:${JSON.stringify(members)}`;
    if (seen.has(sig) || members.length === 0) continue;
    seen.add(sig);
    out.push({
      hook: 'queryKey',
      key: members,
      endpoints: members.filter(looksLikeEndpoint),
    });
  }
  return out;
}

/**
 * Idea 00954 — Extract Apollo cache shapes for GraphQL field mapping.
 *
 * Reads InMemoryCache typePolicies (entity type names + keyFields) and parses
 * gql`` documents into operations with their top-level selected fields, giving
 * the agent a GraphQL field map without querying the server.
 *
 * @param {string} js page or bundle text
 * @returns {{types: {name: string, keyFields: string[]}[], operations: {kind: string, name: string|null, fields: string[]}[]}}
 */
export function extractApolloCacheShapes(js) {
  const result = { types: [], operations: [] };
  if (typeof js !== 'string' || !js) return result;
  // InMemoryCache type policies: TypeName: { keyFields: [...] }
  const tpRe = /typePolicies\s*:\s*\{/g;
  let m;
  const seenTypes = new Set();
  while ((m = tpRe.exec(js)) !== null) {
    const open = js.indexOf('{', m.index);
    let depth = 0;
    let quote = null;
    let end = -1;
    for (let i = open; i < js.length && i < open + 20000; i += 1) {
      const ch = js[i];
      if (quote) {
        if (ch === quote && js[i - 1] !== '\\') quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    const region = js.slice(open, end + 1);
    const typeRe = /([A-Z][\w]*)\s*:\s*\{\s*keyFields\s*:\s*\[([^\]]*)\]/g;
    let t;
    while ((t = typeRe.exec(region)) !== null) {
      if (seenTypes.has(t[1])) continue;
      seenTypes.add(t[1]);
      const kf = [];
      const kfRe = /['"`]([^'"`]+)['"`]/g;
      let k;
      while ((k = kfRe.exec(t[2])) !== null) kf.push(k[1]);
      result.types.push({ name: t[1], keyFields: kf });
    }
  }
  // gql documents
  const gqlRe = /gql\s*`([\s\S]*?)`/g;
  const seenOps = new Set();
  while ((m = gqlRe.exec(js)) !== null) {
    const doc = m[1];
    const opRe =
      /\b(query|mutation|subscription)\s*(\w+)?\s*(\([^)]*\))?\s*\{([\s\S]*?)\}\s*$/m;
    const op = opRe.exec(doc.trim());
    if (!op) continue;
    const sig = `${op[1]}:${op[2] || 'anonymous'}`;
    if (seenOps.has(sig)) continue;
    seenOps.add(sig);
    const body = op[4] || '';
    const fields = [];
    const seenF = new Set();
    for (const line of body.split('\n')) {
      const fm = /^\s*([A-Za-z_][\w]*)(\s*\(|\s*\{|\s*$)/.exec(line);
      if (fm && !seenF.has(fm[1]) && fm[1] !== 'on') {
        seenF.add(fm[1]);
        fields.push(fm[1]);
      }
    }
    result.operations.push({
      kind: op[1],
      name: op[2] || null,
      fields,
    });
  }
  return result;
}

/**
 * Idea 00955 — Map Urql exchanges to request pipelines.
 *
 * createClient({ url, exchanges: [...] }) declares the client's ordered request
 * pipeline (dedup, cache, auth, fetch...). Returns the endpoint URL plus the
 * ordered exchange list with a plain-English role for each known exchange.
 *
 * @param {string} js page or bundle text
 * @returns {{url: string|null, exchanges: string[], pipeline: {exchange: string, role: string}[]}[]}
 */
export function mapUrqlExchanges(js) {
  if (typeof js !== 'string' || !js) return [];
  const EXCHANGE_ROLES = {
    dedupExchange: 'deduplicates identical in-flight operations',
    cacheExchange: 'normalized document cache',
    fetchExchange: 'terminal network fetch',
    authExchange: 'injects auth headers / handles auth errors',
    retryExchange: 'retries failed operations',
    subscriptionExchange: 'routes subscriptions over websocket/SSE',
    multipartFetchExchange: 'supports file-upload multipart requests',
    persistedExchange: 'persisted-query (hash) exchange',
    requestPolicyExchange: 'overrides request policies per operation',
    debugExchange: 'logs operations for debugging',
  };
  const out = [];
  const seen = new Set();
  const clientRe = /createClient\s*\(\s*\{/g;
  let m;
  while ((m = clientRe.exec(js)) !== null) {
    const open = js.indexOf('{', m.index);
    let depth = 0;
    let quote = null;
    let end = -1;
    for (let i = open; i < js.length && i < open + 5000; i += 1) {
      const ch = js[i];
      if (quote) {
        if (ch === quote && js[i - 1] !== '\\') quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    const region = js.slice(open, end + 1);
    const urlM = /\burl\s*:\s*['"`]([^'"`]+)['"`]/.exec(region);
    const url = urlM ? urlM[1] : null;
    const exM = /exchanges\s*:\s*\[([^\]]*)\]/.exec(region);
    const exchanges = [];
    if (exM) {
      const idRe = /([A-Za-z_$][\w$]*)\s*\(?/g;
      let id;
      while ((id = idRe.exec(exM[1])) !== null) {
        if (!exchanges.includes(id[1])) exchanges.push(id[1]);
      }
    }
    const sig = `${url}|${exchanges.join(',')}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({
      url,
      exchanges,
      pipeline: exchanges.map((e) => ({
        exchange: e,
        role: EXCHANGE_ROLES[e] || 'custom exchange (client-defined behaviour)',
      })),
    });
  }
  return out;
}

/**
 * Idea 00956 — Mine Relay artifacts for GraphQL documents.
 *
 * Relay codebases ship graphql`` tagged documents plus generated artifacts
 * (imports from __generated__/...). Returns operations with names, kinds and
 * selected root fields, plus the referenced artifact module paths.
 *
 * @param {string} js page or bundle text
 * @returns {{documents: {kind: string, name: string|null, fields: string[]}[], artifacts: string[]}}
 */
export function mineRelayArtifacts(js) {
  const result = { documents: [], artifacts: [] };
  if (typeof js !== 'string' || !js) return result;
  const seenDocs = new Set();
  const gqlRe = /graphql\s*`([\s\S]*?)`/g;
  let m;
  while ((m = gqlRe.exec(js)) !== null) {
    const doc = m[1].trim();
    const opM = /\b(query|mutation|subscription)\s+(\w+)/.exec(doc);
    const fragM = /\bfragment\s+(\w+)\s+on\s+(\w+)/.exec(doc);
    const kind = opM ? opM[1] : fragM ? `fragment on ${fragM[2]}` : 'document';
    const name = opM ? opM[2] : fragM ? fragM[1] : null;
    const sig = `${kind}:${name}`;
    if (seenDocs.has(sig)) continue;
    seenDocs.add(sig);
    const fields = [];
    const seenF = new Set();
    const firstBrace = doc.indexOf('{');
    const lastBrace = doc.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const inner = doc.slice(firstBrace + 1, lastBrace);
      for (const line of inner.split('\n')) {
        const fm = /^\s*([A-Za-z_][\w]*)(\s*\(|\s*\{|\s*$|\s)/.exec(line);
        if (
          fm &&
          !seenF.has(fm[1]) &&
          !['on', 'fragment', 'query', 'mutation', 'subscription'].includes(
            fm[1]
          )
        ) {
          seenF.add(fm[1]);
          fields.push(fm[1]);
        }
      }
    }
    result.documents.push({ kind, name, fields });
  }
  const artRe =
    /(?:import|require)\s*(?:[\w${}\s*,]*from\s*)?['"`]([^'"`]*__generated__[^'"`]*)['"`]/g;
  const seenArt = new Set();
  while ((m = artRe.exec(js)) !== null) {
    if (seenArt.has(m[1])) continue;
    seenArt.add(m[1]);
    result.artifacts.push(m[1]);
  }
  return result;
}

/**
 * Idea 00957 — Extract tRPC router shapes for procedure mapping.
 *
 * tRPC routers declare procedures as name: publicProcedure[.input(...)].query|
 * mutation|subscription(...). Returns each procedure's name, visibility,
 * operation kind and any input-schema reference, which maps 1:1 to API
 * endpoints (/api/trpc/<router>.<procedure> by convention).
 *
 * @param {string} js page or bundle text
 * @returns {{router: string|null, procedures: {name: string, visibility: string, kind: string, inputSchema: string|null, endpointHint: string}[]}[]}
 */
export function extractTRpcRouterShapes(js) {
  if (typeof js !== 'string' || !js) return [];
  const out = [];
  const seenRouters = new Set();
  const routerRe =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*router\s*\(\s*\{/g;
  let m;
  while ((m = routerRe.exec(js)) !== null) {
    const open = js.indexOf('{', m.index);
    let depth = 0;
    let quote = null;
    let end = -1;
    for (let i = open; i < js.length && i < open + 30000; i += 1) {
      const ch = js[i];
      if (quote) {
        if (ch === quote && js[i - 1] !== '\\') quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    if (seenRouters.has(m[1])) continue;
    seenRouters.add(m[1]);
    const region = js.slice(open, end + 1);
    const procedures = [];
    const procRe =
      /([A-Za-z_$][\w$]*)\s*:\s*(publicProcedure|protectedProcedure|privateProcedure|adminProcedure)((?:\.\w+\([^)]*\))*)?\s*\.\s*(query|mutation|subscription)\s*\(/g;
    let p;
    while ((p = procRe.exec(region)) !== null) {
      const chain = p[3] || '';
      const inputM = /\.input\(\s*([A-Za-z_$][\w$]*)/.exec(chain);
      procedures.push({
        name: p[1],
        visibility: p[2],
        kind: p[4],
        inputSchema: inputM ? inputM[1] : null,
        endpointHint: `/api/trpc/${m[1]}.${p[1]}`,
      });
    }
    out.push({ router: m[1], procedures });
  }
  return out;
}

/**
 * Parse fields from a validation-schema object body: name: lib.type(...).flags.
 * @param {string} body object literal body
 * @param {string} libNs library namespace ('z', 'yup', 'Joi')
 * @returns {{field: string, type: string, required: boolean, flags: string[]}[]}
 */
function parseSchemaFields(body, libNs) {
  const fields = [];
  // Bodies arrive wrapped in their object-literal braces; strip them so
  // splitTopLevel sees depth-0 commas between fields.
  let inner = body.trim();
  if (inner.startsWith('{') && inner.endsWith('}')) {
    inner = inner.slice(1, -1);
  }
  const typeRe = new RegExp(`^([A-Za-z_$][\\w$]*)\\s*:\\s*${libNs}\\.(\\w+)\\s*\\(`);
  for (const seg of splitTopLevel(inner)) {
    const tm = typeRe.exec(seg.trim());
    if (!tm) continue;
    const [, field, type] = tm;
    const rest = seg.slice(tm[0].length);
    const flags = [];
    const flagRe = /\.(\w+)\s*\(/g;
    let f;
    while ((f = flagRe.exec(rest)) !== null) {
      if (!flags.includes(f[1])) flags.push(f[1]);
    }
    const required =
      libNs === 'z'
        ? !flags.includes('optional') && !flags.includes('nullable')
        : flags.includes('required');
    fields.push({ field, type, required, flags });
  }
  return fields;
}

/**
 * Idea 00958 — Infer API shapes from Zod validation schemas.
 *
 * z.object({...}) schemas name the exact fields (and their types) the client
 * validates — i.e. the fields the backend API accepts. Returns each schema
 * with its field inventory.
 *
 * @param {string} js page or bundle text
 * @returns {{schema: string, fields: {field: string, type: string, required: boolean, flags: string[]}[]}[]}
 */
export function inferApiShapesFromZod(js) {
  if (typeof js !== 'string' || !js) return [];
  const out = [];
  const seen = new Set();
  const schemaRe =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*z\.object\s*\(/g;
  let m;
  while ((m = schemaRe.exec(js)) !== null) {
    const open = js.indexOf('(', m.index);
    const body = extractParenBody(js, open);
    if (!body || seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({ schema: m[1], fields: parseSchemaFields(body.body, 'z') });
  }
  return out;
}

/**
 * Idea 00959 — Harvest form fields from Yup schemas.
 *
 * yup.object().shape({...}) / yup.object({...}) declarations enumerate form
 * fields with constraints (required, min, email...), i.e. the fields the
 * backing endpoint expects.
 *
 * @param {string} js page or bundle text
 * @returns {{schema: string, fields: {field: string, type: string, required: boolean, flags: string[]}[]}[]}
 */
export function harvestYupFormFields(js) {
  if (typeof js !== 'string' || !js) return [];
  const out = [];
  const seen = new Set();
  const schemaRe =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*yup\.object\s*\(\s*(?:\)\.shape\s*)?\(/g;
  let m;
  while ((m = schemaRe.exec(js)) !== null) {
    const open = js.lastIndexOf('(', m.index + m[0].length - 1);
    const body = extractParenBody(js, open);
    if (!body || seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({ schema: m[1], fields: parseSchemaFields(body.body, 'yup') });
  }
  return out;
}

/**
 * Idea 00960 — Map APIs from Joi validation schemas.
 *
 * Joi.object({...}) schemas name request-body fields with types and
 * required-ness. Returns each schema with its field inventory, usable as an
 * API-shape map for the owning endpoint.
 *
 * @param {string} js page or bundle text
 * @returns {{schema: string, fields: {field: string, type: string, required: boolean, flags: string[]}[]}[]}
 */
export function mapApisFromJoi(js) {
  if (typeof js !== 'string' || !js) return [];
  const out = [];
  const seen = new Set();
  const schemaRe =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*Joi\.object\s*\(/g;
  let m;
  while ((m = schemaRe.exec(js)) !== null) {
    const open = js.indexOf('(', m.index);
    const body = extractParenBody(js, open);
    if (!body || seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({ schema: m[1], fields: parseSchemaFields(body.body, 'Joi') });
  }
  return out;
}

/**
 * Run all ten idea extractors over one page/asset text and return a summary.
 * Convenience wrapper for the hunt pipeline.
 *
 * @param {string} pageText HTML/JS/CSS text collected from the target
 * @returns {{redux: object, swr: object[], reactQuery: object[], apollo: object, urql: object[], relay: object, trpc: object[], zod: object[], yup: object[], joi: object[], endpointHints: string[]}}
 */
export function analyzeStateStoreSchemaSurface(pageText) {
  const redux = analyzeReduxMiddlewareChains(pageText);
  const swr = enumerateSwrKeys(pageText);
  const reactQuery = mapReactQueryKeys(pageText);
  const apollo = extractApolloCacheShapes(pageText);
  const urql = mapUrqlExchanges(pageText);
  const relay = mineRelayArtifacts(pageText);
  const trpc = extractTRpcRouterShapes(pageText);
  const zod = inferApiShapesFromZod(pageText);
  const yup = harvestYupFormFields(pageText);
  const joi = mapApisFromJoi(pageText);

  const hintSet = new Set();
  for (const c of redux.apiCalls) hintSet.add(`${c.method} ${c.url}`);
  for (const k of swr) if (k.isUrl) hintSet.add(`GET ${k.key}`);
  for (const q of reactQuery)
    for (const e of q.endpoints) hintSet.add(`GET ${e}`);
  for (const u of urql) if (u.url) hintSet.add(`GRAPHQL ${u.url}`);
  for (const r of trpc)
    for (const p of r.procedures) hintSet.add(`${p.kind.toUpperCase()} ${p.endpointHint}`);

  return {
    redux,
    swr,
    reactQuery,
    apollo,
    urql,
    relay,
    trpc,
    zod,
    yup,
    joi,
    endpointHints: [...hintSet].sort(),
  };
}

export const STATE_STORE_SCHEMA_RECON = {
  analyzeReduxMiddlewareChains,
  enumerateSwrKeys,
  mapReactQueryKeys,
  extractApolloCacheShapes,
  mapUrqlExchanges,
  mineRelayArtifacts,
  extractTRpcRouterShapes,
  inferApiShapesFromZod,
  harvestYupFormFields,
  mapApisFromJoi,
  analyzeStateStoreSchemaSurface,
};

export default STATE_STORE_SCHEMA_RECON;
