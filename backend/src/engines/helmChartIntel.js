/**
 * helmChartIntel.js — Helm chart values host extraction (idea 00233).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses Chart.yaml + values.yaml text (key: value YAML, without a YAML
 * dependency) for ingress hosts, service endpoints, and image registry
 * hosts that reveal where the chart author runs workloads.
 */

/**
 * Build the Artifact Hub package URL for a Helm chart (public chart index).
 * @param {string} repo
 * @param {string} chart
 */
export function chartPackageUrl(repo, chart) {
  return `https://artifacthub.io/packages/helm/${encodeURIComponent(String(repo || ''))}/${encodeURIComponent(String(chart || ''))}`;
}

function hostFromUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.hostname.toLowerCase();
  } catch { return null; }
}

// Very small "key: value" YAML reader for flat-ish chart metadata.
function simpleYamlMap(text) {
  const map = {};
  for (const line of String(text || '').split('\n')) {
    const m = /^([A-Za-z0-9_.-]+)\s*:\s*(.+?)\s*$/.exec(line);
    if (m) map[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return map;
}

/**
 * Parse Chart.yaml text for project hosts (home, sources, icon, annotations).
 * @param {string} chartYaml
 * @returns {{ name, version, hosts: Array<{host, kind, provenance}> }}
 */
export function parseChartYaml(chartYaml) {
  const meta = simpleYamlMap(chartYaml);
  const hosts = [];
  const seen = new Set();
  const add = (value, kind, provenance) => {
    const host = hostFromUrl(value);
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind, provenance }); }
  };

  add(meta.home, 'project-home', 'Chart.home');
  add(meta.icon, 'project-icon-host', 'Chart.icon');

  for (const line of String(chartYaml || '').split('\n')) {
    const s = /^\s*-\s*(https?:\/\/\S+)/.exec(line);
    if (s) add(s[1], 'chart-source', 'Chart.sources[]');
  }

  return { name: meta.name || null, version: meta.version || null, hosts };
}

const INGRESS_HOST_RE = /^\s*(?:-\s*)?host\s*:\s*["']?([a-z0-9.-]+)["']?\s*$/gim;
const TLS_HOST_RE = /^\s*-\s*["']?([a-z0-9.-]+)["']?\s*$/gim;
const IMAGE_RE = /^\s*(?:repository|image)\s*:\s*["']?([^"'\s]+)["']?\s*$/gim;
const URL_RE = /(https?:\/\/[^\s"'<>()]+)/g;

function pushHostUniq(hosts, seen, host, kind, provenance) {
  host = String(host || '').toLowerCase().replace(/\.$/, '');
  if (!host || host.includes('{{') || host.includes('}')) return;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (!seen.has(host)) { seen.add(host); hosts.push({ host, kind: 'ip-literal', provenance }); }
    return;
  }
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || seen.has(host)) return;
  seen.add(host);
  hosts.push({ host, kind, provenance });
}

/**
 * Parse values.yaml text for ingress hosts, TLS hosts, service endpoints,
 * external URLs and container image registry hosts.
 * @param {string} valuesYaml
 * @returns {{ hosts: Array<{host, kind, provenance}> }}
 */
export function parseValuesYaml(valuesYaml) {
  const text = String(valuesYaml || '');
  const hosts = [];
  const seen = new Set();

  let m;
  INGRESS_HOST_RE.lastIndex = 0;
  while ((m = INGRESS_HOST_RE.exec(text))) pushHostUniq(hosts, seen, m[1], 'ingress-host', 'ingress.hosts[]');

  TLS_HOST_RE.lastIndex = 0;
  while ((m = TLS_HOST_RE.exec(text))) {
    // Only keep lines inside a tls: section — heuristic: line near "tls:" context.
    const ctx = text.slice(Math.max(0, m.index - 160), m.index);
    if (/tls\s*:/i.test(ctx)) pushHostUniq(hosts, seen, m[1], 'ingress-tls-host', 'ingress.tls[].hosts[]');
  }

  IMAGE_RE.lastIndex = 0;
  while ((m = IMAGE_RE.exec(text))) {
    const ref = m[1].trim();
    const parts = ref.split('/');
    if (parts.length > 1 && parts[0].includes('.')) {
      pushHostUniq(hosts, seen, parts[0], 'image-registry', 'image.repository');
    }
  }

  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text))) {
    const host = hostFromUrl(m[1]);
    if (host) pushHostUniq(hosts, seen, host, 'service-endpoint', 'values.url');
  }

  return { hosts };
}

/**
 * Combined chart analysis: Chart.yaml + values.yaml.
 * @param {string} chartYaml
 * @param {string} valuesYaml
 */
export function analyzeHelmChart(chartYaml, valuesYaml) {
  const chart = parseChartYaml(chartYaml);
  const values = parseValuesYaml(valuesYaml);
  const merged = [...chart.hosts];
  const seen = new Set(chart.hosts.map(h => h.host));
  for (const h of values.hosts) {
    if (!seen.has(h.host)) { seen.add(h.host); merged.push(h); }
  }
  return { name: chart.name, version: chart.version, hosts: merged };
}
