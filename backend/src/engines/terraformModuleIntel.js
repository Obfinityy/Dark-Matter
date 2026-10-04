/**
 * terraformModuleIntel.js — Terraform registry module mining (idea 00232).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses Terraform registry module JSON (source, root inputs) and module
 * `.tf` text for provider endpoints and backend hosts (S3/GCS/Azure/custom
 * backends, provider endpoint overrides) that reveal the module author's
 * cloud and API footprint.
 */

/**
 * Build the Terraform registry module web URL.
 * @param {string} namespace
 * @param {string} name
 * @param {string} [provider='aws']
 */
export function registryModuleUrl(namespace, name, provider = 'aws') {
  const n = encodeURIComponent(String(namespace || ''));
  const m = encodeURIComponent(String(name || ''));
  const p = encodeURIComponent(String(provider || 'aws'));
  return `https://registry.terraform.io/modules/${n}/${m}/${p}/latest`;
}

/**
 * Build the Terraform registry API URL for module versions.
 * @param {string} namespace
 * @param {string} name
 * @param {string} [provider='aws']
 */
export function registryApiUrl(namespace, name, provider = 'aws') {
  const n = encodeURIComponent(String(namespace || ''));
  const m = encodeURIComponent(String(name || ''));
  const p = encodeURIComponent(String(provider || 'aws'));
  return `https://registry.terraform.io/v1/modules/${n}/${m}/${p}/versions`;
}

function hostFromUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.hostname.toLowerCase();
  } catch { return null; }
}

/**
 * Parse a Terraform registry module version JSON document into host findings.
 * Inspects `source`, root `inputs`/`outputs` descriptions, and any `root`
 * metadata for provider endpoints and backend host references.
 * @param {Object} versionJson - Parsed JSON from the registry module API.
 * @returns {{ source, hosts: Array<{host, kind, provenance}> }}
 */
export function parseModuleVersionJson(versionJson) {
  const mods = (versionJson && versionJson.modules) || [];
  const root = mods.find(m => (m.root && (m.root.path === '' || m.root.path === undefined)) || mods.length === 1 && m.path === '') || mods[0] || {};
  const r = root.root || root;
  const hosts = [];
  const seen = new Set();
  const add = (value, kind, provenance) => {
    if (value == null) return;
    const str = String(value);
    const host = hostFromUrl(str);
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind, provenance }); return; }
    // Bare hostnames inside descriptions (e.g. "API at api.example.com").
    for (const m of str.matchAll(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi)) {
      const h = m[0].toLowerCase();
      if (!seen.has(h) && !/^(example|test|localhost|internal)\./i.test(h)) {
        seen.add(h); hosts.push({ host: h, kind, provenance });
      }
    }
  };

  const source = r.source || null;
  if (source) {
    // github.com/org/repo style source
    const m = /^github\.com\/([^/]+)/i.exec(source) || /^(gitlab\.com)\/[^/]+/i.exec(source);
    if (m && !seen.has(m[1].toLowerCase()) && /^[a-z.]+$/.test(m[1])) {
      seen.add(m[1].toLowerCase());
      hosts.push({ host: m[1].toLowerCase(), kind: 'vcs-host', provenance: 'module.source' });
    } else {
      add(source, 'module-source', 'module.source');
    }
  }

  for (const input of r.inputs || []) {
    if (input && input.description) add(input.description, 'input-description-host', `input.${input.name}.description`);
  }
  for (const output of r.outputs || []) {
    if (output && output.description) add(output.description, 'output-description-host', `output.${output.name}.description`);
  }

  return { source, hosts };
}

const PROVIDER_RE = /\bprovider\s+"([^"]+)"\s*\{([\s\S]*?)\n\}/g;
const BACKEND_RE = /\bbackend\s+"([^"]+)"\s*\{([\s\S]*?)\n\}/g;
const ENDPOINT_RE = /\b(endpoint|endpoints?|server|host|hostname|url|api_url|base_url|management_url|identity_endpoint|storage_endpoint)\s*=\s*"([^"]+)"/gi;
const URL_IN_STRING_RE = /"(https?:\/\/[^"\s]+)"/g;

/**
 * Parse Terraform `.tf` text for provider endpoint overrides and backend hosts.
 * @param {string} tfText - Raw HCL text.
 * @returns {{ providers: Array<{type, endpoints: string[]}>, backends: Array<{type, hosts: Array<{host, kind, provenance}>}>, urls: Array<{url, provenance}> }}
 */
export function parseTerraformText(tfText) {
  const text = String(tfText || '');
  const hosts = [];
  const seen = new Set();
  const pushHost = (value, kind, provenance) => {
    if (!value) return;
    const str = String(value).replace(/\$[{\(]/, '');
    const host = hostFromUrl(str);
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind, provenance }); }
  };

  const providers = [];
  let m;
  PROVIDER_RE.lastIndex = 0;
  while ((m = PROVIDER_RE.exec(text))) {
    const endpoints = [];
    let e;
    ENDPOINT_RE.lastIndex = 0;
    while ((e = ENDPOINT_RE.exec(m[2]))) {
      endpoints.push(e[2]);
      pushHost(e[2], 'provider-endpoint', `provider."${m[1]}".${e[1]}`);
    }
    providers.push({ type: m[1], endpoints });
  }

  const backends = [];
  BACKEND_RE.lastIndex = 0;
  while ((m = BACKEND_RE.exec(text))) {
    const bHosts = [];
    let e;
    ENDPOINT_RE.lastIndex = 0;
    while ((e = ENDPOINT_RE.exec(m[2]))) {
      const host = hostFromUrl(e[2]);
      if (host && !seen.has(host)) {
        seen.add(host);
        bHosts.push({ host, kind: 'backend-host', provenance: `backend."${m[1]}".${e[1]}` });
        hosts.push(bHosts[bHosts.length - 1]);
      }
    }
    backends.push({ type: m[1], hosts: bHosts });
  }

  const urls = [];
  let u;
  URL_IN_STRING_RE.lastIndex = 0;
  while ((u = URL_IN_STRING_RE.exec(text))) {
    const host = hostFromUrl(u[1]);
    if (host && !seen.has(host)) {
      seen.add(host);
      urls.push({ url: u[1], provenance: 'tf-string-url' });
      hosts.push({ host, kind: 'string-url', provenance: 'tf-string-url' });
    }
  }

  return { providers, backends, urls, hosts };
}
