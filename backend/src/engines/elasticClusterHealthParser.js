/**
 * elasticClusterHealthParser.js — Elasticsearch cluster-health analyzer (idea 00366).
 *
 * Parses captured `GET /_cluster/health` (and optionally `GET /`) responses
 * from an in-scope Elasticsearch node to fingerprint the cluster: name,
 * version, health status, node/shard topology, and signs of an anonymously
 * reachable, unsecured cluster.
 *
 * Offline analyzer: callers supply captured response bodies plus a flag
 * recording whether the request succeeded without credentials. This module
 * never sends HTTP requests itself.
 */

/** Elasticsearch releases that are end-of-life (no security fixes) as of 2026. */
export function isElasticEol(version) {
  const m = /^(\d+)\.(\d+)/.exec(String(version || ''));
  if (!m) return null;
  const major = parseInt(m[1], 10);
  const minor = parseInt(m[2], 10);
  if (major < 7) return true;
  if (major === 7 && minor < 17) return true;
  return false;
}

/**
 * Parse a `GET /` root response (carries version + build info).
 * @param {string|object} input JSON string or object.
 * @returns {{version: string|null, distribution: string|null, tagline: string|null, clusterName: string|null, clusterUuid: string|null}}
 */
export function parseElasticRootInfo(input) {
  let obj = input;
  if (typeof input === 'string') {
    try { obj = JSON.parse(input); } catch { return { version: null, distribution: null, tagline: null, clusterName: null, clusterUuid: null }; }
  }
  obj = obj || {};
  return {
    version: obj.version?.number ?? null,
    distribution: obj.version?.distribution ?? null,
    tagline: obj.tagline ?? null,
    clusterName: obj.cluster_name ?? null,
    clusterUuid: obj.cluster_uuid ?? null,
  };
}

/**
 * Analyze a captured `/_cluster/health` response.
 * @param {{health: string|object, rootInfo?: string|object, anonymousAccess?: boolean}} input
 * @returns {{cluster, topology, findings, confidence}}
 */
export function analyzeClusterHealth({ health, rootInfo = null, anonymousAccess = false } = {}) {
  let h = health;
  if (typeof h === 'string') {
    try { h = JSON.parse(h); } catch { return { cluster: null, topology: null, findings: ['Response body was not valid JSON.'], confidence: 'low' }; }
  }
  h = h || {};
  const findings = [];
  const root = rootInfo ? parseElasticRootInfo(rootInfo) : { version: null, distribution: null, tagline: null, clusterName: null, clusterUuid: null };

  const status = String(h.status || 'unknown');
  const clusterName = h.cluster_name || root.clusterName || 'unknown';
  findings.push(`Cluster "${clusterName}" reports status "${status}".`);
  if (root.version) {
    findings.push(`Elasticsearch ${root.version}${root.distribution && root.distribution !== 'elasticsearch' ? ` (${root.distribution})` : ''}.`);
    const eol = isElasticEol(root.version);
    if (eol === true) findings.push(`HIGH: Elasticsearch ${root.version} is end-of-life and receives no security fixes.`);
  }

  const nodes = parseInt(h.number_of_nodes ?? '0', 10);
  const dataNodes = parseInt(h.number_of_data_nodes ?? '0', 10);
  const activeShards = parseInt(h.active_shards ?? '0', 10);
  const unassigned = parseInt(h.unassigned_shards ?? '0', 10);
  const initializing = parseInt(h.initializing_shards ?? '0', 10);
  const relocating = parseInt(h.relocating_shards ?? '0', 10);
  const delayed = parseInt(h.delayed_unassigned_shards ?? '0', 10);
  const activePct = h.active_shards_percent_as_number ?? null;

  findings.push(`Topology: ${nodes} node(s), ${dataNodes} data node(s); ${activeShards} active shard(s)` +
    (activePct !== null ? ` (${activePct}% active)` : '') + '.');
  if (dataNodes === 1 && nodes >= 1) findings.push('Single data node — no replica failover; a node loss takes data offline.');
  if (unassigned > 0) findings.push(`MEDIUM: ${unassigned} unassigned shard(s)${delayed ? ` (${delayed} delayed)` : ''} — data redundancy is degraded.`);
  if (initializing > 0 || relocating > 0) findings.push(`Cluster is rebalancing (${initializing} initializing, ${relocating} relocating).`);

  if (status === 'red') findings.push('HIGH: cluster health is RED — primary shards are missing; data may already be unavailable.');
  else if (status === 'yellow') findings.push('MEDIUM: cluster health is YELLOW — replica shards are unassigned; redundancy reduced.');
  else if (status === 'green') findings.push('Cluster health is GREEN.');

  const pending = parseInt(h.number_of_pending_tasks ?? '0', 10);
  if (pending > 0) findings.push(`${pending} pending cluster task(s) — the master may be under load.`);
  if (h.timed_out === true) findings.push('Health request timed out — the cluster is slow or overloaded.');

  if (anonymousAccess) {
    findings.push('CRITICAL: /_cluster/health was reachable WITHOUT credentials — the cluster has no authentication in front of it. Any index data is exposed.');
  }

  return {
    cluster: { name: clusterName, status, version: root.version, distribution: root.distribution, anonymousAccess },
    topology: { nodes, dataNodes, activeShards, unassignedShards: unassigned, initializingShards: initializing, relocatingShards: relocating, activeShardsPercent: activePct },
    findings,
    confidence: status !== 'unknown' ? 'high' : 'low',
  };
}

export const ELASTIC_CLUSTER_HEALTH_PARSER = { parseElasticRootInfo, analyzeClusterHealth, isElasticEol };
export default ELASTIC_CLUSTER_HEALTH_PARSER;
