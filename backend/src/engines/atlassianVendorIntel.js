/**
 * atlassianVendorIntel.js — Atlassian Marketplace vendor mining (idea 00240).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses Atlassian app descriptors (atlassian-connect.json / Forge manifest
 * YAML) vendor links to map an app vendor's web properties: vendor URLs,
 * base URLs, module iframes, webhooks, and support links.
 */

/**
 * Build the Atlassian Marketplace app listing URL.
 * @param {string} appKey
 */
export function marketplaceAppUrl(appKey) {
  return `https://marketplace.atlassian.com/apps/${encodeURIComponent(String(appKey || ''))}`;
}

/**
 * Build the Atlassian Marketplace vendor apps URL (vendor pivot).
 * @param {string} vendorId
 */
export function marketplaceVendorUrl(vendorId) {
  return `https://marketplace.atlassian.com/vendors/${encodeURIComponent(String(vendorId || ''))}`;
}

function hostFromUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Parse an Atlassian Connect descriptor (atlassian-connect.json) into host findings.
 * @param {Object} descriptorJson - Parsed atlassian-connect.json.
 * @returns {{ key, name, vendor: Object, hosts: Array<{host, kind, provenance}> }}
 */
export function parseConnectDescriptor(descriptorJson) {
  const d = descriptorJson || {};
  const hosts = [];
  const seen = new Set();
  const add = (value, kind, provenance) => {
    const host = hostFromUrl(value);
    if (host && !seen.has(host)) {
      seen.add(host);
      hosts.push({ host, kind, provenance });
    }
  };

  add(d.baseUrl, 'app-base-url', 'descriptor.baseUrl');

  const vendor = d.vendor || {};
  add(vendor.url, 'vendor-website', 'descriptor.vendor.url');

  // Module iframes / webhooks: each module type may carry a url or function endpoint.
  const walkModules = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => walkModules(item, `${path}[${i}]`));
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if ((k === 'url' || k === 'webhookUrl' || k === 'location') && typeof v === 'string') {
        const kind = /webhook/i.test(k)
          ? 'app-webhook-host'
          : /location/i.test(k)
            ? 'app-module-location'
            : 'app-module-url';
        add(v, kind, `descriptor.modules.${path}.${k}`);
      } else if (typeof v === 'object') {
        walkModules(v, path ? `${path}.${k}` : k);
      }
    }
  };
  walkModules(d.modules, 'modules');

  for (const lh of d.lifecycle || d.lifeCycle || []) {
    if (lh && lh.url)
      add(lh.url, 'lifecycle-webhook', `descriptor.lifecycle.${lh.event || 'event'}`);
  }

  return {
    key: d.key || null,
    name: d.name || null,
    vendor: { name: vendor.name || null, url: vendor.url || null },
    hosts,
  };
}

const FORGE_KEY_RE =
  /^\s{0,12}(id|name|key|homepage|website|url)\s*:\s*["']?([^"'\n]+)["']?\s*$/gim;
const URL_RE = /(https?:\/\/[^\s"'<>()]+)/g;

/**
 * Parse a Forge app manifest (manifest.yml text) into host findings.
 * @param {string} forgeManifestYaml - Raw manifest.yml text.
 * @returns {{ appId, name, hosts: Array<{host, kind, provenance}> }}
 */
export function parseForgeManifest(forgeManifestYaml) {
  const text = String(forgeManifestYaml || '');
  const hosts = [];
  const seen = new Set();
  const add = (value, kind, provenance) => {
    const host = hostFromUrl(value);
    if (host && !seen.has(host)) {
      seen.add(host);
      hosts.push({ host, kind, provenance });
    }
  };

  let m;
  FORGE_KEY_RE.lastIndex = 0;
  const fields = {};
  while ((m = FORGE_KEY_RE.exec(text))) {
    if (!fields[m[1].toLowerCase()]) fields[m[1].toLowerCase()] = m[2].trim();
  }

  add(fields.homepage || fields.website, 'forge-homepage', 'manifest.homepage');

  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text))) {
    const host = hostFromUrl(m[1]);
    if (host && !seen.has(host)) {
      seen.add(host);
      hosts.push({ host, kind: 'manifest-url', provenance: 'manifest/url' });
    }
  }

  // Remotes: `remotes: - key: name url: https://...`
  const remoteRe = /url\s*:\s*(https?:\/\/\S+)/gi;
  let r;
  while ((r = remoteRe.exec(text))) {
    const host = hostFromUrl(r[1]);
    if (host && !seen.has(host)) {
      seen.add(host);
      hosts.push({ host, kind: 'forge-remote', provenance: 'manifest.remotes' });
    }
  }

  return { appId: fields.id || null, name: fields.name || null, hosts };
}

/**
 * Parse an Atlassian Marketplace vendor JSON snippet (vendor profile) into hosts.
 * @param {Object} vendorJson
 * @returns {{ name, hosts: Array<{host, kind, provenance}> }}
 */
export function parseVendorProfile(vendorJson) {
  const v = vendorJson || {};
  const hosts = [];
  const seen = new Set();
  const add = (value, kind, provenance) => {
    const host = hostFromUrl(value);
    if (host && !seen.has(host)) {
      seen.add(host);
      hosts.push({ host, kind, provenance });
    }
  };
  add(v.website, 'vendor-website', 'vendor.website');
  add(v.supportUrl || v.support_url, 'vendor-support', 'vendor.supportUrl');
  add(v.logo && v.logo.url, 'vendor-logo-host', 'vendor.logo');
  return { name: v.name || null, hosts };
}
