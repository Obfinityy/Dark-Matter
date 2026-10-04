/**
 * puppetForgeIntel.js — Puppet Forge module host mining (idea 00236).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses Puppet module metadata.json and manifest text for master,
 * fileserver, puppetdb, and report-processor hostnames the module
 * references, mapping the module author's Puppet infrastructure.
 */

/**
 * Build the Puppet Forge module page URL.
 * @param {string} user
 * @param {string} name
 */
export function forgeModuleUrl(user, name) {
  return `https://forge.puppet.com/modules/${encodeURIComponent(String(user || ''))}/${encodeURIComponent(String(name || ''))}`;
}

/**
 * Build the Puppet Forge API URL for a module.
 * @param {string} user
 * @param {string} name
 */
export function forgeApiUrl(user, name) {
  return `https://forgeapi.puppet.com/v3/modules/${encodeURIComponent(String(user || ''))}-${encodeURIComponent(String(name || ''))}`;
}

function hostFromUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.hostname.toLowerCase();
  } catch { return null; }
}

/**
 * Parse a Puppet module metadata.json document into host findings.
 * @param {Object} metadataJson - Parsed JSON of metadata.json.
 * @returns {{ name, author, hosts: Array<{host, kind, provenance}> }}
 */
export function parseModuleMetadataJson(metadataJson) {
  const meta = metadataJson || {};
  const hosts = [];
  const seen = new Set();
  const add = (value, kind, provenance) => {
    const host = hostFromUrl(value);
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind, provenance }); }
  };

  add(meta.source, 'source-repo', 'metadata.source');
  add(meta.project_page, 'project-page', 'metadata.project_page');
  add(meta.issues_url, 'issue-tracker', 'metadata.issues_url');

  for (const dep of meta.dependencies || []) {
    if (dep && dep.name && dep.name.includes('/')) {
      const user = dep.name.split('/')[0];
      add(forgeModuleUrl(user, dep.name.split('/')[1]), 'dependency-module-host', `metadata.dependencies[${dep.name}]`);
    }
  }

  return { name: meta.name || null, author: meta.author || null, hosts };
}

const MANIFEST_HOST_RE = /\b(server|master|fileserver|puppetdb_server|report_server|ca_server|node_terminus|storeconfigs_backend)\s*=>\s*['"]([^'"]+)['"]/gi;
const URL_RE = /(https?:\/\/[^\s"'<>()]+)/g;
const PUPPET_URL_RE = /puppet:\/\/\/([^'"\s]+)/gi;
const PUPPET_HOST_URL_RE = /puppet:\/\/([^/'"\s]+)/gi;

/**
 * Parse Puppet manifest text (.pp) for master/fileserver host references.
 * @param {string} manifestText
 * @returns {{ hosts: Array<{host, kind, provenance}>, puppetPaths: string[] }}
 */
export function parseManifestText(manifestText) {
  const text = String(manifestText || '');
  const hosts = [];
  const seen = new Set();
  let m;

  MANIFEST_HOST_RE.lastIndex = 0;
  while ((m = MANIFEST_HOST_RE.exec(text))) {
    const value = m[2].trim();
    const host = hostFromUrl(value) || (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value) ? value.toLowerCase() : null);
    if (host && !seen.has(host)) {
      seen.add(host);
      hosts.push({ host, kind: 'puppet-config-host', provenance: `manifest.${m[1]}` });
    }
  }

  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text))) {
    const host = hostFromUrl(m[1]);
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind: 'manifest-url', provenance: 'manifest/url' }); }
  }

  PUPPET_HOST_URL_RE.lastIndex = 0;
  while ((m = PUPPET_HOST_URL_RE.exec(text))) {
    const host = m[1].toLowerCase();
    if (!seen.has(host)) { seen.add(host); hosts.push({ host, kind: 'fileserver-host', provenance: 'puppet://host' }); }
  }

  const puppetPaths = [];
  PUPPET_URL_RE.lastIndex = 0;
  while ((m = PUPPET_URL_RE.exec(text))) puppetPaths.push(m[1]);

  return { hosts, puppetPaths: [...new Set(puppetPaths)] };
}

/**
 * Combined module analysis: metadata.json + manifest text.
 * @param {Object} metadataJson
 * @param {string} manifestText
 */
export function analyzePuppetModule(metadataJson, manifestText) {
  const meta = parseModuleMetadataJson(metadataJson);
  const manifest = parseManifestText(manifestText);
  const merged = [...meta.hosts];
  const seen = new Set(meta.hosts.map(h => h.host));
  for (const h of manifest.hosts) {
    if (!seen.has(h.host)) { seen.add(h.host); merged.push(h); }
  }
  return { name: meta.name, author: meta.author, puppetPaths: manifest.puppetPaths, hosts: merged };
}
