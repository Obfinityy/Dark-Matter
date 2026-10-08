/**
 * grafanaSnapshotMiner.js — Grafana public snapshot mining engine.
 *
 * Covers idea-bank item 00254:
 *  - 00254 Grafana public snapshot mining — read public Grafana snapshots
 *    whose legends and queries name hosts.
 *
 * Pure functions only: callers fetch the public Grafana snapshot JSON
 * (`/api/snapshots/<key>` payload) themselves (respecting provider rate
 * limits) and pass the parsed object in. Functions extract Prometheus-style
 * query expressions, `instance`/`host` label values, legend aliases, and
 * series names to recover monitored hostnames, then score relevance to the
 * target brand. No live HTTP here.
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
 * Extract hostnames from a Prometheus-style query expression.
 *
 * Recognizes label matchers such as `instance="web-01:9100"`,
 * `host="db.internal"`, `hostname=~"api-.*"`, plus bare hostnames and URLs
 * in the expression text.
 *
 * @param {string} expr query expression
 * @returns {{host: string, label: string}[]}
 */
export function extractHostsFromExpr(expr) {
  const e = String(expr || '');
  if (!e) return [];
  const found = new Map(); // host -> label

  // Label matchers: instance="...", host="...", hostname=~"...", nodename="...".
  for (const m of e.matchAll(
    /\b(instance|host|hostname|node|nodename|server|target)\s*=~\s*"([^"]*)"/gi
  )) {
    const label = m[1].toLowerCase();
    for (const alt of m[2].split('|')) {
      const h = normalizeHostname(alt.replace(/[.\\^$*+?()|[\]{}]/g, ''));
      if (h.includes('.')) found.set(h, label);
    }
  }
  for (const m of e.matchAll(
    /\b(instance|host|hostname|node|nodename|server|target)\s*=\s*"([^"]*)"/gi
  )) {
    const label = m[1].toLowerCase();
    const h = normalizeHostname(m[2]);
    if (h.includes('.')) found.set(h, label);
  }
  // Bare hostnames / URLs in the expression.
  for (const m of e.matchAll(HOSTNAME_RE)) {
    const h = normalizeHostname(m[0]);
    if (h.includes('.') && !found.has(h)) found.set(h, 'bare');
  }
  return [...found.entries()].map(([host, label]) => ({ host, label }));
}

/**
 * Extract hostnames from a panel legend alias / series name.
 *
 * Legends like `{{instance}}`, `web-01 : cpu`, or `api.example.com — p99`
 * are common; this recovers the embedded hostname.
 *
 * @param {string} legend legend string or series name
 * @returns {string[]}
 */
export function extractHostsFromLegend(legend) {
  const l = String(legend || '');
  if (!l) return [];
  const found = new Set();
  for (const m of l.matchAll(HOSTNAME_RE)) {
    const h = normalizeHostname(m[0]);
    if (h.includes('.')) found.add(h);
  }
  // Short machine names in legends (web-01, db-2) without dots are kept raw.
  for (const m of l.matchAll(/\b([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\b/gi)) {
    found.add(normalizeHostname(m[1]));
  }
  return [...found];
}

/**
 * Walk a Grafana snapshot payload and collect every query expression,
 * legend alias, series name, annotation, and templating variable that may
 * name a host.
 *
 * @param {object} snapshot parsed `/api/snapshots/<key>` JSON
 * @returns {{expressions: {expr: string, panel: string}[], legends: string[], variables: {name: string, values: string[]}[], hosts: {host: string, label: string, source: string}[]}}
 */
export function extractSnapshotRefs(snapshot) {
  const expressions = [];
  const legends = new Set();
  const variables = [];
  const hosts = new Map(); // host -> { label, source }

  const note = (host, label, source) => {
    const h = normalizeHostname(host);
    if (!h) return;
    if (!hosts.has(h)) hosts.set(h, { host: h, label, source });
  };

  const dashboard = snapshot?.dashboard || snapshot;
  const panels = [];
  const collectPanels = rows => {
    for (const p of rows || []) {
      if (p?.panels) collectPanels(p.panels); // old row layout
      if (p?.targets || p?.title) panels.push(p);
    }
  };
  collectPanels(dashboard?.panels);

  for (const panel of panels) {
    const title = String(panel?.title || 'panel');
    for (const target of panel?.targets || []) {
      for (const key of ['expr', 'query', 'rawQuery']) {
        const expr = target?.[key];
        if (typeof expr === 'string' && expr) {
          expressions.push({ expr, panel: title });
          for (const { host, label } of extractHostsFromExpr(expr))
            note(host, label, `expr:${title}`);
        }
      }
      const alias = target?.legendFormat || target?.alias;
      if (typeof alias === 'string' && alias) {
        legends.add(alias);
        for (const h of extractHostsFromLegend(alias)) note(h, 'legend', `legend:${title}`);
      }
    }
    // Snapshot-embedded series data carries metric labels with real values.
    for (const series of panel?.snapshotData || []) {
      const name = series?.name;
      if (typeof name === 'string' && name) {
        legends.add(name);
        for (const h of extractHostsFromLegend(name)) note(h, 'series', `series:${title}`);
      }
    }
  }

  for (const v of dashboard?.templating?.list || []) {
    const values = [];
    for (const opt of v?.options || []) {
      const val = String(opt?.value ?? opt?.text ?? '');
      if (!val || /^\$|^All$/i.test(val)) continue;
      values.push(val);
      for (const h of extractHostsFromLegend(val)) note(h, 'variable', `var:${v?.name}`);
    }
    if (v?.name) variables.push({ name: String(v.name), values: [...new Set(values)] });
  }

  return {
    expressions,
    legends: [...legends],
    variables,
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
 * Mine a public Grafana snapshot for brand-relevant hostnames.
 *
 * @param {object} snapshot parsed snapshot JSON
 * @param {string} rootDomain
 * @returns {{hosts: {host: string, label: string, source: string, score: number}[], expressions: {expr: string, panel: string}[], legends: string[], variables: {name: string, values: string[]}[]}}
 */
export function mineSnapshot(snapshot, rootDomain) {
  const refs = extractSnapshotRefs(snapshot);
  const hosts = refs.hosts
    .map(e => ({ ...e, score: scoreHostRelevance(e.host, rootDomain) }))
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score || a.host.localeCompare(b.host));
  return { hosts, expressions: refs.expressions, legends: refs.legends, variables: refs.variables };
}
