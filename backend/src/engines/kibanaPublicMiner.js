/**
 * kibanaPublicMiner.js — Kibana public dashboard host-leak mining engine.
 *
 * Covers idea-bank item 00255:
 *  - 00255 Kibana public dashboard host leaks — extract index patterns and
 *    host fields from publicly shared Kibana dashboards.
 *
 * Pure functions only: callers fetch the publicly shared Kibana dashboard
 * (saved-object export, share snapshot JSON, or short-URL resolved payload)
 * themselves (respecting provider rate limits) and pass the parsed object in.
 * Functions extract index patterns, host-named fields, KQL/Lucene queries,
 * and filters to recover hostnames and host-bearing field values relevant to
 * the target brand. No live HTTP here.
 */

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;
const SCHEMED_HOST_RE = /^(?:[a-z][a-z0-9+.-]*:\/\/)?([^/:?\s"'<>]+)/i;

/** Field names that conventionally carry host identity in Kibana/Beats data. */
export const HOST_FIELD_NAMES = [
  'host.name',
  'host.hostname',
  'hostname',
  'host',
  'beat.hostname',
  'agent.hostname',
  'server.name',
  'server.host',
  'container.hostname',
  'kubernetes.node.name',
  'destination.domain',
  'source.domain',
  'url.domain',
  'http.host',
  'host.ip',
];

/**
 * Normalize a hostname: lowercase, strip scheme/userinfo/port/trailing dot.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHostname(host) {
  if (!host) return '';
  return String(host)
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/^[^@\s]+@/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Extract the hostname from a URL or bare host string.
 * @param {string} url
 * @returns {string}
 */
export function hostFromUrl(url) {
  if (!url) return '';
  const m = String(url).trim().match(SCHEMED_HOST_RE);
  return normalizeHostname(m ? m[1] : '');
}

/**
 * True when a host belongs to the target brand: equals the root domain, is a
 * subdomain of it, or contains the root's registrable label.
 * @param {string} host
 * @param {string} rootDomain
 * @returns {boolean}
 */
export function isTargetHost(host, rootDomain) {
  const h = normalizeHostname(host);
  const root = normalizeHostname(rootDomain);
  if (!h || !root) return false;
  if (h === root || h.endsWith(`.${root}`)) return true;
  const label = root.split('.')[0];
  return label.length > 2 && h.includes(label);
}

/**
 * Extract hostnames from a KQL/Lucene query string.
 *
 * Handles `host.name: "web-01.example.com"`, `hostname: db-02`,
 * `url.domain: example.com`, wildcard values (`api-*`), and bare hostnames.
 *
 * @param {string} query KQL or Lucene query string
 * @returns {{host: string, field: string}[]}
 */
export function extractHostsFromQuery(query) {
  const q = String(query || '');
  if (!q) return [];
  const found = new Map(); // host -> field

  // field: value / field:"value" pairs where the value looks like a host.
  for (const m of q.matchAll(/([\w.]+)\s*:\s*("([^"]*)"|'([^']*)'|([^\s()]+))/g)) {
    const field = m[1].toLowerCase();
    const rawValue = (m[3] ?? m[4] ?? m[5] ?? '').trim();
    if (!rawValue || rawValue === '*') continue;
    const value = normalizeHostname(rawValue.replace(/\*/g, ''));
    if (!value) continue;
    const isHostField = HOST_FIELD_NAMES.some(f => field === f || field.endsWith(`.${f}`));
    if (isHostField || value.includes('.')) {
      if (!found.has(value)) found.set(value, field);
    }
  }
  // Bare hostnames elsewhere in the query.
  for (const m of q.matchAll(HOSTNAME_RE)) {
    const h = normalizeHostname(m[0]);
    if (h.includes('.') && !found.has(h)) found.set(h, 'bare');
  }
  return [...found.entries()].map(([host, field]) => ({ host, field }));
}

/**
 * Extract hostnames from a Kibana filter clause (phrase/match/range filters).
 *
 * @param {object} filter Kibana filter object
 * @returns {{host: string, field: string}[]}
 */
export function extractHostsFromFilter(filter) {
  const out = [];
  const push = (field, value) => {
    const v = normalizeHostname(String(value ?? '').replace(/\*/g, ''));
    if (!v || !v.includes('.')) return;
    const f = String(field || '').toLowerCase();
    const isHostField = HOST_FIELD_NAMES.some(hf => f === hf || f.endsWith(`.${hf}`));
    if (isHostField || HOSTNAME_RE.test(v)) out.push({ host: v, field: f || 'filter' });
  };

  const meta = filter?.meta || {};
  const key = meta?.key || meta?.field;
  const params = meta?.params || {};
  if (key && params?.query !== undefined) push(key, params.query);
  if (key && filter?.query?.match_phrase?.[key] !== undefined)
    push(key, filter.query.match_phrase[key]);
  if (key && filter?.query?.match?.[key] !== undefined) {
    const mv = filter.query.match[key];
    push(key, typeof mv === 'object' ? mv?.query : mv);
  }
  // Exists filters on host fields are worth noting (field exists, no value).
  if (
    filter?.exists &&
    HOST_FIELD_NAMES.some(hf =>
      String(filter.exists.field || '')
        .toLowerCase()
        .endsWith(hf)
    )
  ) {
    out.push({ host: '', field: String(filter.exists.field) });
  }
  return out;
}

/**
 * Walk a public Kibana dashboard payload (saved-object export or share
 * payload) and collect index patterns, host fields, queries, and filters.
 *
 * @param {object} dashboard parsed dashboard JSON
 * @returns {{
 *   indexPatterns: string[],
 *   hostFields: string[],
 *   queries: string[],
 *   hosts: {host: string, field: string, source: string}[]
 * }}
 */
export function extractDashboardRefs(dashboard) {
  const indexPatterns = new Set();
  const hostFields = new Set();
  const queries = new Set();
  const hosts = new Map(); // host -> { field, source }

  const note = (host, field, source) => {
    const h = normalizeHostname(host);
    if (!h || !h.includes('.')) return;
    if (!hosts.has(h)) hosts.set(h, { host: h, field, source });
  };

  const panels = dashboard?.panelsJSON
    ? (() => {
        try {
          return JSON.parse(dashboard.panelsJSON);
        } catch {
          return [];
        }
      })()
    : dashboard?.panels || [];
  const kibanaSaved = dashboard?.attributes || dashboard;

  for (const panel of panels) {
    const title = String(panel?.title || panel?.panelRefName || 'panel');
    const embeddable = panel?.embeddableConfig || {};
    for (const key of ['query', 'savedSearch']) {
      const q = embeddable?.[key];
      const text = typeof q === 'string' ? q : q?.query;
      if (typeof text === 'string' && text) {
        queries.add(text);
        for (const { host, field } of extractHostsFromQuery(text))
          note(host, field, `panel:${title}`);
      }
    }
    for (const filter of embeddable?.filters || []) {
      for (const { host, field } of extractHostsFromFilter(filter)) {
        if (host) note(host, field, `filter:${title}`);
        else hostFields.add(field);
      }
    }
    // Saved-search / visualization references carry index pattern ids.
    for (const ref of dashboard?.references || []) {
      if (ref?.type === 'index-pattern' && typeof ref?.name === 'string') {
        indexPatterns.add(ref.name);
      }
    }
  }

  // Top-level dashboard query + filters.
  const rootSearch = kibanaSaved?.kibanaSavedObjectMeta?.searchSourceJSON;
  if (typeof rootSearch === 'string') {
    try {
      const ss = JSON.parse(rootSearch);
      const q = ss?.query?.query;
      if (typeof q === 'string' && q) {
        queries.add(q);
        for (const { host, field } of extractHostsFromQuery(q))
          note(host, field, 'dashboard-query');
      }
      if (typeof ss?.index === 'string') indexPatterns.add(ss.index);
      for (const filter of ss?.filter || []) {
        for (const { host, field } of extractHostsFromFilter(filter)) {
          if (host) note(host, field, 'dashboard-filter');
          else hostFields.add(field);
        }
      }
    } catch {
      /* malformed searchSourceJSON: ignore */
    }
  }

  // Column/field lists on saved searches may name host fields directly.
  const columns = kibanaSaved?.columns || kibanaSaved?.attributes?.columns;
  for (const col of columns || []) {
    const c = String(col || '').toLowerCase();
    if (HOST_FIELD_NAMES.some(hf => c === hf || c.endsWith(`.${hf}`))) hostFields.add(String(col));
  }

  return {
    indexPatterns: [...indexPatterns].sort(),
    hostFields: [...hostFields].sort(),
    queries: [...queries],
    hosts: [...hosts.values()].sort((a, b) => a.host.localeCompare(b.host)),
  };
}

/**
 * Score a hostname's relevance to the target brand (0-100).
 * @param {string} host
 * @param {string} rootDomain
 * @returns {number} 0-100
 */
export function scoreHostRelevance(host, rootDomain) {
  const h = normalizeHostname(host);
  const root = normalizeHostname(rootDomain);
  if (!h || !root) return 0;
  if (h === root) return 100;
  if (h.endsWith(`.${root}`)) return 90;
  const label = root.split('.')[0];
  if (label.length > 2 && h.includes(label)) return 55;
  return 0;
}

/**
 * Mine a public Kibana dashboard for brand-relevant host leaks.
 *
 * @param {object} dashboard parsed dashboard JSON
 * @param {string} rootDomain
 * @returns {{hosts: {host: string, field: string, source: string, score: number}[], indexPatterns: string[], hostFields: string[], queries: string[]}}
 */
export function mineDashboard(dashboard, rootDomain) {
  const refs = extractDashboardRefs(dashboard);
  const hosts = refs.hosts
    .map(e => ({ ...e, score: scoreHostRelevance(e.host, rootDomain) }))
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score || a.host.localeCompare(b.host));
  return {
    hosts,
    indexPatterns: refs.indexPatterns,
    hostFields: refs.hostFields,
    queries: refs.queries,
  };
}
