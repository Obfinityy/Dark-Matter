/**
 * graphqlEndpointFingerprint.js — GraphQL endpoint identification and engine fingerprinting.
 *
 * Implements idea-bank item 00435: identify GraphQL endpoints from
 * introspection-shaped error responses and typical paths, and fingerprint
 * the GraphQL server implementation from observed behavior.
 *
 * All functions are pure and side-effect free: they operate on response
 * observations supplied by the caller (gathered during an authorized
 * engagement). No network requests are performed here.
 */

/** Path patterns commonly used to expose GraphQL. */
export const GRAPHQL_PATH_PATTERNS = [
  /\/graphql\/?$/i,
  /\/gql\/?$/i,
  /\/api\/graphql\/?$/i,
  /\/v\d+\/graphql\/?$/i,
  /\/graphql\/playground\/?$/i,
  /\/graphiql\/?$/i,
  /\/playground\/?$/i,
  /\/console\/?$/i,
  /\/altair\/?$/i,
];

/**
 * Known GraphQL server fingerprints: response markers mapped to products.
 * Each entry carries matchers over body text and headers.
 */
export const GRAPHQL_SERVER_SIGNATURES = [
  {
    server: 'Apollo Server',
    confidence: 'medium',
    markers: [
      'PersistedQueryNotFound',
      'PERSISTED_QUERY_NOT_FOUND',
      'apollo',
      'GraphQL Playground is deprecated',
    ],
    note: 'Apollo emits persisted-query error codes and historically served GraphQL Playground.',
  },
  {
    server: 'Hasura',
    confidence: 'high',
    markers: ['x-hasura', 'hasura', 'field "query" not found'],
    note: 'Hasura advertises x-hasura-* response headers and distinctive error text.',
  },
  {
    server: 'GraphQL Yoga',
    confidence: 'medium',
    markers: ['graphql-yoga', 'yoga', 'Masked Errors'],
    note: 'Yoga masks unexpected errors with "Unexpected error." and identifies itself in dev banners.',
  },
  {
    server: 'WPGraphQL',
    confidence: 'medium',
    markers: ['wpgraphql', 'wp-graphql'],
    note: 'WPGraphQL exposes the WordPress-flavored /graphql endpoint with wp-prefixed markers.',
  },
  {
    server: 'Strawberry (Python)',
    confidence: 'low',
    markers: ['strawberry'],
    note: 'Strawberry GraphQL may surface its name in debug pages.',
  },
];

/**
 * Check whether an observed URL path looks like a GraphQL endpoint.
 * @param {string} url Observed URL or path.
 * @returns {{isGraphqlPath:boolean, matchedPattern:string|null}}
 */
export function matchesGraphqlPath(url) {
  if (!url || typeof url !== 'string') return { isGraphqlPath: false, matchedPattern: null };
  let path;
  try {
    path = new URL(url, 'http://localhost').pathname;
  } catch {
    path = url.split(/[?#]/)[0];
  }
  for (const re of GRAPHQL_PATH_PATTERNS) {
    if (re.test(path)) return { isGraphqlPath: true, matchedPattern: re.source };
  }
  return { isGraphqlPath: false, matchedPattern: null };
}

/**
 * Check whether a response body has GraphQL-shaped error content.
 * @param {string} body Response body text.
 * @returns {{graphqlShaped:boolean, reasons:string[]}}
 */
export function isGraphqlShapedError(body) {
  const reasons = [];
  if (!body || typeof body !== 'string') return { graphqlShaped: false, reasons };
  const text = body.trim();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      reasons.push('top-level "errors" array — the GraphQL error envelope');
    }
    if ('data' in parsed && (parsed.data === null || typeof parsed.data === 'object')) {
      reasons.push('top-level "data" key alongside errors — GraphQL response shape');
    }
    if (
      parsed.errors &&
      parsed.errors.some(
        e => e && /syntax|introspection|field .* not found|validation/i.test(JSON.stringify(e))
      )
    ) {
      reasons.push('GraphQL-typical error message (syntax/validation/introspection)');
    }
  }
  if (/query\s*\{\s*__schema|__typename|Introspection/i.test(text)) {
    reasons.push('introspection keywords in the response');
  }
  return { graphqlShaped: reasons.length > 0, reasons };
}

/**
 * Fingerprint the GraphQL server implementation from body and headers.
 * @param {object} obs { body?: string, headers?: object }
 * @returns {Array<{server:string, confidence:string, note:string, matchedMarkers:string[]}>}
 */
export function fingerprintGraphqlServer(obs) {
  const o = obs || {};
  const haystack = `${o.body || ''}\n${Object.entries(o.headers || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')}`.toLowerCase();
  const hits = [];
  for (const sig of GRAPHQL_SERVER_SIGNATURES) {
    const matched = sig.markers.filter(m => haystack.includes(m.toLowerCase()));
    if (matched.length > 0) {
      hits.push({
        server: sig.server,
        confidence: sig.confidence,
        note: sig.note,
        matchedMarkers: matched,
      });
    }
  }
  const rank = { high: 3, medium: 2, low: 1 };
  return hits.sort((a, b) => rank[b.confidence] - rank[a.confidence]);
}

/**
 * Full GraphQL detection for one observed response.
 * @param {object} obs { url?: string, status?: number|null, body?: string, headers?: object }
 * @returns {{isGraphql:boolean, confidence:string, path:object, shape:object, servers:Array, notes:string[]}}
 */
export function detectGraphql(obs) {
  const o = obs || {};
  const path = matchesGraphqlPath(o.url || '');
  const shape = isGraphqlShapedError(o.body || '');
  const servers = fingerprintGraphqlServer({ body: o.body, headers: o.headers });
  const notes = [];
  if (path.isGraphqlPath) notes.push(`GraphQL-typical path (${path.matchedPattern})`);
  notes.push(...shape.reasons);
  const signals =
    (path.isGraphqlPath ? 1 : 0) + (shape.graphqlShaped ? 1 : 0) + (servers.length > 0 ? 1 : 0);
  const confidence =
    signals >= 3 ? 'high' : signals === 2 ? 'medium' : signals === 1 ? 'low' : 'none';
  return {
    isGraphql: signals > 0,
    confidence,
    path,
    shape,
    servers,
    notes,
  };
}
