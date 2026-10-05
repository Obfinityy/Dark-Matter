/**
 * graphqlIntrospector.js — GraphQL introspection host discoverer.
 *
 * Parses fetched GraphQL introspection results (the standard __schema query
 * response an endpoint itself returns) for:
 *  - type/field/enum names that reference other services or hosts
 *  - description text that names backend hosts, URLs, or internal endpoints
 *  - schema shape statistics to scope further manual review
 *
 * Pure functions: takes a parsed introspection JSON object, returns intel.
 */

const HOST_RE = /https?:\/\/((?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d{1,5})?/gi;
const SERVICE_HINT_RE = /\b(service|svc|endpoint|host|url|uri|gateway|microservice|backend|worker|queue|topic|bucket|table|cluster|node|proxy|upstream)\b/i;
const SERVICE_SUFFIX_RE = /(Service|Gateway|Endpoint|Backend|Worker|Proxy|Upstream|Client|Microservice|Host|Url|Uri)$/;

/** Walk every type/field/argument/description node in the schema. */
export function walkSchema(schema, visit) {
  if (!schema || !Array.isArray(schema.types)) return;
  for (const t of schema.types) {
    if (!t || t.name.startsWith('__')) continue; // skip introspection meta-types
    visit({ kind: 'type', name: t.name, description: t.description });
    for (const f of t.fields || []) {
      if (!f) continue;
      visit({ kind: 'field', parent: t.name, name: f.name, description: f.description });
      for (const a of f.args || []) {
        if (a) visit({ kind: 'arg', parent: `${t.name}.${f.name}`, name: a.name, description: a.description });
      }
    }
    for (const v of t.enumValues || []) {
      if (v) visit({ kind: 'enum', parent: t.name, name: v.name, description: v.description });
    }
    for (const v of t.inputFields || []) {
      if (v) visit({ kind: 'input', parent: t.name, name: v.name, description: v.description });
    }
  }
}

/** Extract URLs named inside schema descriptions. */
export function extractHostsFromDescriptions(schema) {
  const hits = [];
  walkSchema(schema, node => {
    if (!node.description) return;
    HOST_RE.lastIndex = 0;
    let m;
    while ((m = HOST_RE.exec(node.description))) {
      hits.push({
        host: m[1].toLowerCase(),
        url: m[0],
        location: `${node.kind}:${node.parent ? node.parent + '.' : ''}${node.name}`,
        confidence: 'high',
      });
    }
  });
  const seen = new Map();
  for (const h of hits) {
    const key = h.host + '|' + h.location;
    if (!seen.has(key)) seen.set(key, h);
  }
  return [...seen.values()];
}

/** Find type/field names that hint at related services or infrastructure. */
export function findServiceHints(schema) {
  const hints = [];
  const seen = new Set();
  walkSchema(schema, node => {
    const label = `${node.parent ? node.parent + '.' : ''}${node.name}`;
    if (SERVICE_HINT_RE.test(node.name) && !seen.has(label)) {
      seen.add(label);
      hints.push({
        location: label,
        kind: node.kind,
        name: node.name,
        description: node.description || '',
        confidence: 'medium',
        note: 'Name references service/host/infrastructure concepts — may map to related backends.',
      });
    } else if (SERVICE_SUFFIX_RE.test(node.name) && !seen.has(label)) {
      seen.add(label);
      hints.push({
        location: label,
        kind: node.kind,
        name: node.name,
        description: node.description || '',
        confidence: 'low',
        note: 'CamelCase suffix suggests a service/gateway role — may map to related backends.',
      });
    }
  });
  return hints;
}

/** Summarize schema shape: type counts, query/mutation/subscription roots. */
export function summarizeSchema(schema) {
  if (!schema || !Array.isArray(schema.types)) return { error: 'Not a valid introspection schema' };
  const counts = {};
  for (const t of schema.types) {
    if (!t || t.name.startsWith('__')) continue;
    counts[t.kind] = (counts[t.kind] || 0) + 1;
  }
  return {
    typeCounts: counts,
    queryType: schema.queryType ? schema.queryType.name : null,
    mutationType: schema.mutationType ? schema.mutationType.name : null,
    subscriptionType: schema.subscriptionType ? schema.subscriptionType.name : null,
    directives: (schema.directives || []).map(d => d.name),
  };
}

/**
 * Analyze a fetched GraphQL introspection result for host discovery.
 * @param {object} input
 * @param {string} input.url - endpoint the introspection was fetched from
 * @param {object} input.introspection - parsed introspection response ({ data: { __schema } })
 * @returns structured findings
 */
export function introspectHosts({ url = '', introspection = null } = {}) {
  const schema = introspection && introspection.data && introspection.data.__schema;
  if (!schema) {
    return { url, type: 'GraphQL Introspection Host Discovery', confidence: 'none', error: 'No __schema found — introspection may be disabled' };
  }
  const hosts = extractHostsFromDescriptions(schema);
  const hints = findServiceHints(schema);
  const summary = summarizeSchema(schema);

  return {
    url,
    type: 'GraphQL Introspection Host Discovery',
    confidence: hosts.length ? 'high' : (hints.length ? 'medium' : 'low'),
    evidence: `${hosts.length} host URL(s) in schema descriptions, ${hints.length} service-hint name(s) found.`,
    hosts,
    serviceHints: hints.slice(0, 200),
    schemaSummary: summary,
  };
}

export const GRAPHQL_INTROSPECTOR = {
  walkSchema, extractHostsFromDescriptions, findServiceHints, summarizeSchema, introspectHosts,
};
export default GRAPHQL_INTROSPECTOR;
