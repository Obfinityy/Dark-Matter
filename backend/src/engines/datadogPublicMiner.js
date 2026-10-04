/**
 * datadogPublicMiner.js — Datadog public dashboard mining engine.
 *
 * Covers idea-bank item 00253:
 *  - 00253 Datadog public dashboard mining — parse public Datadog dashboards
 *    for host and service names.
 *
 * Pure functions only: callers fetch the public Datadog dashboard JSON (the
 * shared-dashboard payload) themselves (respecting provider rate limits) and
 * pass the parsed object in. Functions walk widgets, metric queries (`q`),
 * template variables, and host/service tags to extract hostnames and service
 * names relevant to the target brand. No live HTTP here.
 */

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;
const SCHEMED_HOST_RE = /^(?:[a-z][a-z0-9+.-]*:\/\/)?([^/:?\s"'<>]+)/i;

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
 * Parse hostnames out of a Datadog metric query string (`q` field).
 *
 * Handles `host:name`, `host_name:name`, bare hostnames in IN clauses, and
 * URLs embedded in notes/formulas. Returns unique normalized hostnames.
 *
 * @param {string} query Datadog query string
 * @returns {string[]}
 */
export function parseQueryHosts(query) {
  const q = String(query || '');
  if (!q) return [];
  const found = new Set();

  // host:web-01.example.com / host_name:db-02 — bare or dotted names.
  for (const m of q.matchAll(/(?:\bhost(?:_name)?\s*:\s*)([a-z0-9][a-z0-9.-]*)/gi)) {
    const candidate = normalizeHostname(m[1]);
    if (candidate.includes('.')) found.add(candidate);
  }
  // host IN (a.example.com, b.example.com)
  for (const m of q.matchAll(/\bhost(?:_name)?\s+IN\s*\(([^)]*)\)/gi)) {
    for (const part of m[1].split(',')) {
      const candidate = normalizeHostname(part.replace(/["']/g, ''));
      if (candidate.includes('.')) found.add(candidate);
    }
  }
  // Bare hostnames / URLs anywhere else in the query.
  for (const m of q.matchAll(HOSTNAME_RE)) {
    const candidate = normalizeHostname(m[0]);
    if (candidate.includes('.')) found.add(candidate);
  }
  return [...found];
}

/**
 * Extract hostnames and service names from Datadog tag strings.
 *
 * Recognizes `host:<name>` tags, `service:<name>` tags, and any tag value
 * that is itself a hostname.
 *
 * @param {string[]} tags array of "key:value" strings
 * @returns {{hosts: string[], services: string[]}}
 */
export function extractHostsFromTags(tags = []) {
  const hosts = new Set();
  const services = new Set();
  for (const tag of tags || []) {
    const t = String(tag || '');
    const m = t.match(/^(host|host_name|service)\s*:\s*(.+)$/i);
    if (!m) {
      const candidate = normalizeHostname(t);
      if (candidate.includes('.') && HOSTNAME_RE.test(candidate)) hosts.add(candidate);
      continue;
    }
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'service') {
      if (value) services.add(value);
    } else {
      const candidate = normalizeHostname(value);
      if (candidate) hosts.add(candidate);
    }
  }
  return { hosts: [...hosts], services: [...services] };
}

/**
 * Walk a public Datadog dashboard payload and collect every host/service
 * reference: widget queries, formulas, annotations, template variables, and
 * free-text titles/notes that mention hostnames.
 *
 * @param {object} dashboard parsed shared-dashboard JSON
 * @returns {{hosts: string[], services: string[], queries: string[], variables: {name: string, values: string[]}[]}}
 */
export function extractDashboardRefs(dashboard) {
  const hosts = new Set();
  const services = new Set();
  const queries = new Set();
  const variables = [];

  const noteHost = (h) => { const n = normalizeHostname(h); if (n && n.includes('.')) hosts.add(n); };
  const walkQueries = (requests) => {
    for (const req of requests || []) {
      for (const key of ['q', 'query']) {
        const q = req?.[key];
        if (typeof q === 'string' && q) {
          queries.add(q);
          for (const h of parseQueryHosts(q)) noteHost(h);
        }
      }
      // APM/trace-style queries carry tags directly.
      if (Array.isArray(req?.tags)) {
        const { hosts: th, services: ts } = extractHostsFromTags(req.tags);
        th.forEach(noteHost); ts.forEach((s) => services.add(s));
      }
      if (typeof req?.service === 'string' && req.service) services.add(req.service);
      if (typeof req?.service_name === 'string' && req.service_name) services.add(req.service_name);
    }
  };

  for (const widget of dashboard?.widgets || []) {
    const def = widget?.definition || {};
    walkQueries(def?.requests);
    // Hostmap / geomap widgets name hosts explicitly.
    for (const key of ['host', 'hostname', 'node', 'scope']) {
      if (typeof def?.[key] === 'string' && def[key]) noteHost(def[key]);
    }
    // Note widgets and titles may embed hostnames in prose.
    for (const key of ['content', 'title']) {
      const text = def?.[key];
      if (typeof text === 'string') {
        for (const m of text.matchAll(HOSTNAME_RE)) noteHost(m[0]);
      }
    }
  }

  for (const v of dashboard?.template_variables || []) {
    const values = [...new Set(
      [v?.default, ...(v?.values || []), ...(v?.prefix ? [] : [])]
        .filter((x) => typeof x === 'string' && x)
        .flatMap((x) => parseQueryHosts(x).concat([normalizeHostname(x)]))
        .filter((x) => x.includes('.'))
    )];
    if (v?.name) {
      variables.push({ name: String(v.name), values });
      values.forEach(noteHost);
    }
  }

  // Dashboard-level title/description prose.
  for (const key of ['title', 'description']) {
    const text = dashboard?.[key];
    if (typeof text === 'string') {
      for (const m of text.matchAll(HOSTNAME_RE)) noteHost(m[0]);
    }
  }

  return {
    hosts: [...hosts].sort(),
    services: [...services].sort(),
    queries: [...queries],
    variables,
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
 * Mine a public Datadog dashboard for brand-relevant hosts and services.
 *
 * @param {object} dashboard parsed shared-dashboard JSON
 * @param {string} rootDomain
 * @returns {{hosts: {host: string, score: number}[], services: string[], queries: string[], variables: {name: string, values: string[]}[]}}
 */
export function mineDashboard(dashboard, rootDomain) {
  const refs = extractDashboardRefs(dashboard);
  const hosts = refs.hosts
    .map((h) => ({ host: h, score: scoreHostRelevance(h, rootDomain) }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score || a.host.localeCompare(b.host));
  const services = refs.services.filter((s) => {
    const label = normalizeHostname(rootDomain).split('.')[0];
    return label.length > 2 && s.toLowerCase().includes(label);
  });
  return { hosts, services, queries: refs.queries, variables: refs.variables };
}
