/**
 * chefCookbookIntel.js — Chef Supermarket cookbook mining (idea 00235).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses cookbook metadata.rb and recipe/attribute text for node and server
 * references: source/issue URLs, download endpoints, and hostnames the
 * cookbook author points recipes at (package repos, APIs, webhooks).
 */

/**
 * Build the Chef Supermarket cookbook page URL.
 * @param {string} name
 */
export function supermarketCookbookUrl(name) {
  return `https://supermarket.chef.io/cookbooks/${encodeURIComponent(String(name || ''))}`;
}

/**
 * Build the Chef Supermarket API URL for a cookbook.
 * @param {string} name
 */
export function supermarketApiUrl(name) {
  return `https://supermarket.chef.io/api/v1/cookbooks/${encodeURIComponent(String(name || ''))}`;
}

function hostFromUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.hostname.toLowerCase();
  } catch { return null; }
}

const META_RE = /^\s*(name|maintainer|maintainer_email|description|version|source_url|issues_url|chef_version|supports)\s+["']?([^"'\n]+)["']?\s*$/gim;
const URL_RE = /(https?:\/\/[^\s"'<>()]+)/g;
const HOSTNAME_ATTR_RE = /\b(?:server|host|hostname|domain|endpoint|api_url|base_url|download_url|repo_url|mirror)\s*=\s*["']([a-z0-9][a-z0-9.-]*\.[a-z]{2,})["']/gi;

/**
 * Parse cookbook metadata.rb text into fields and host findings.
 * @param {string} metadataRb
 * @returns {{ name, maintainer, version, urls: Object, hosts: Array<{host, kind, provenance}> }}
 */
export function parseMetadataRb(metadataRb) {
  const text = String(metadataRb || '');
  const fields = {};
  let m;
  META_RE.lastIndex = 0;
  while ((m = META_RE.exec(text))) fields[m[1].toLowerCase()] = m[2].trim();

  const hosts = [];
  const seen = new Set();
  const add = (value, kind, provenance) => {
    const host = hostFromUrl(value);
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind, provenance }); }
  };

  add(fields.source_url, 'source-repo', 'metadata.source_url');
  add(fields.issues_url, 'issue-tracker', 'metadata.issues_url');

  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text))) {
    const host = hostFromUrl(m[1]);
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind: 'metadata-url', provenance: 'metadata.rb' }); }
  }

  return {
    name: fields.name || null,
    maintainer: fields.maintainer || null,
    version: fields.version || null,
    urls: { source_url: fields.source_url || null, issues_url: fields.issues_url || null },
    hosts,
  };
}

/**
 * Parse recipe and attribute text for node/server host references.
 * @param {string} recipeText - Concatenation of recipe/attribute files.
 * @returns {Array<{host, kind, provenance}>}
 */
export function parseRecipeText(recipeText) {
  const text = String(recipeText || '');
  const hosts = [];
  const seen = new Set();
  let m;

  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text))) {
    const host = hostFromUrl(m[1]);
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind: 'recipe-url', provenance: 'recipe/url' }); }
  }

  HOSTNAME_ATTR_RE.lastIndex = 0;
  while ((m = HOSTNAME_ATTR_RE.exec(text))) {
    const host = m[1].toLowerCase();
    if (!seen.has(host)) { seen.add(host); hosts.push({ host, kind: 'node-attribute-host', provenance: `attribute.${m[0].split('=')[0].trim()}` }); }
  }

  // node['fqdn'] / node['hostname'] style attribute usage — flags server coupling.
  const nodeRefs = (text.match(/node\[['"](?:fqdn|hostname|domain|ipaddress)['"]\]/g) || []).length;

  return { hosts, nodeAttributeReferences: nodeRefs };
}

/**
 * Parse a Chef Supermarket API cookbook JSON document.
 * @param {Object} apiJson - Parsed JSON from /api/v1/cookbooks/:name.
 * @returns {{ name, maintainer, hosts: Array<{host, kind, provenance}> }}
 */
export function parseSupermarketApiJson(apiJson) {
  const cb = apiJson || {};
  const hosts = [];
  const seen = new Set();
  const add = (value, kind, provenance) => {
    const host = hostFromUrl(value);
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind, provenance }); }
  };
  add(cb.source_url, 'source-repo', 'api.source_url');
  add(cb.issues_url, 'issue-tracker', 'api.issues_url');
  return { name: cb.name || null, maintainer: cb.maintainer || null, hosts };
}

/**
 * Combined cookbook analysis.
 * @param {string} metadataRb
 * @param {string} recipeText
 */
export function analyzeChefCookbook(metadataRb, recipeText) {
  const meta = parseMetadataRb(metadataRb);
  const recipe = parseRecipeText(recipeText);
  const merged = [...meta.hosts];
  const seen = new Set(meta.hosts.map(h => h.host));
  for (const h of recipe.hosts) {
    if (!seen.has(h.host)) { seen.add(h.host); merged.push(h); }
  }
  return {
    name: meta.name,
    maintainer: meta.maintainer,
    urls: meta.urls,
    nodeAttributeReferences: recipe.nodeAttributeReferences,
    hosts: merged,
  };
}
