/**
 * ansibleGalaxyIntel.js — Ansible Galaxy role host mining (idea 00234).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses Ansible role meta/main.yml text and inventory text for hostnames,
 * callback/webhook URLs, and role dependency hosts that map the role
 * author's infrastructure.
 */

/**
 * Build the Ansible Galaxy role page URL.
 * @param {string} namespace
 * @param {string} name
 */
export function galaxyRoleUrl(namespace, name) {
  return `https://galaxy.ansible.com/ui/standalone/roles/${encodeURIComponent(String(namespace || ''))}/${encodeURIComponent(String(name || ''))}/`;
}

/**
 * Build the Galaxy API v3 role URL.
 * @param {string} namespace
 * @param {string} name
 */
export function galaxyApiUrl(namespace, name) {
  return `https://galaxy.ansible.com/api/v3/plugin/ansible/content/published/roles/roles/${encodeURIComponent(String(namespace || ''))}--${encodeURIComponent(String(name || ''))}/`;
}

function hostFromUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.hostname.toLowerCase();
  } catch { return null; }
}

function simpleYamlMap(text) {
  const map = {};
  for (const line of String(text || '').split('\n')) {
    const m = /^([A-Za-z0-9_]+)\s*:\s*(.+?)\s*$/.exec(line);
    if (m) map[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return map;
}

const URL_RE = /(https?:\/\/[^\s"'<>()]+)/g;

/**
 * Parse an Ansible role meta/main.yml text for author/org hosts and dependencies.
 * @param {string} metaYaml
 * @returns {{ roleName, author, company, namespace, hosts: Array<{host, kind, provenance}> }}
 */
export function parseRoleMetaYaml(metaYaml) {
  const text = String(metaYaml || '');
  const info = simpleYamlMap(text);
  const hosts = [];
  const seen = new Set();
  const add = (value, kind, provenance) => {
    const host = hostFromUrl(value);
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind, provenance }); }
  };

  add(info.homepage, 'role-homepage', 'galaxy_info.homepage');
  add(info.repository, 'role-repository', 'galaxy_info.repository');
  add(info.issue_tracker_url, 'issue-tracker', 'galaxy_info.issue_tracker_url');
  add(info.company, 'company-host', 'galaxy_info.company');

  // Role dependencies like "geerlingguy.apache" → galaxy namespace search URLs.
  for (const line of text.split('\n')) {
    const dep = /^\s*-\s*(?:role\s*:\s*)?([a-z0-9_.-]+\.[a-z0-9_.-]+)/i.exec(line);
    if (dep) {
      const ns = dep[1].split('.')[0];
      add(galaxyRoleUrl(ns, dep[1].split('.')[1]), 'dependency-role-host', 'dependencies[]');
    }
  }

  let u;
  URL_RE.lastIndex = 0;
  while ((u = URL_RE.exec(text))) {
    const host = hostFromUrl(u[1]);
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind: 'meta-url', provenance: 'meta/url' }); }
  }

  return {
    roleName: info.role_name || null,
    author: info.author || null,
    company: info.company || null,
    namespace: info.namespace || null,
    hosts,
  };
}

const CALLBACK_RE = /(https?:\/\/[^\s"'<>()]+(?:callback|webhook|notify|hook)[^\s"'<>()]*)/gi;
const HOSTNAME_RE = /^\s*([a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9])(\s|$|:|\[)/;

/**
 * Parse Ansible inventory text (INI or YAML) for inventory hostnames.
 * @param {string} inventoryText
 * @returns {Array<{host, kind, provenance}>}
 */
export function parseInventoryText(inventoryText) {
  const hosts = [];
  const seen = new Set();
  for (const rawLine of String(inventoryText || '').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('[') || line.startsWith('-') || line.includes(':')) continue;
    const m = HOSTNAME_RE.exec(rawLine);
    if (m && m[1].includes('.')) {
      const h = m[1].toLowerCase();
      if (!seen.has(h) && !/^(ansible_|localhost)/.test(h)) {
        seen.add(h);
        hosts.push({ host: h, kind: 'inventory-host', provenance: 'inventory' });
      }
    }
  }
  return hosts;
}

/**
 * Extract callback/webhook/notification URLs from playbooks, handlers, or configs.
 * @param {string} text
 * @returns {Array<{host, url, kind, provenance}>}
 */
export function extractCallbackUrls(text) {
  const out = [];
  const seen = new Set();
  let m;
  CALLBACK_RE.lastIndex = 0;
  while ((m = CALLBACK_RE.exec(String(text || '')))) {
    const host = hostFromUrl(m[1]);
    if (host && !seen.has(host)) {
      seen.add(host);
      out.push({ host, url: m[1], kind: 'callback-url', provenance: 'callback/webhook' });
    }
  }
  return out;
}

/**
 * Combined role analysis: meta + inventory + playbook/callback text.
 * @param {string} metaYaml
 * @param {string} inventoryText
 * @param {string} [extraText='']
 */
export function analyzeAnsibleRole(metaYaml, inventoryText, extraText = '') {
  const meta = parseRoleMetaYaml(metaYaml);
  const merged = [...meta.hosts];
  const seen = new Set(meta.hosts.map(h => h.host));
  for (const h of parseInventoryText(inventoryText)) {
    if (!seen.has(h.host)) { seen.add(h.host); merged.push(h); }
  }
  for (const h of extractCallbackUrls(extraText)) {
    if (!seen.has(h.host)) { seen.add(h.host); merged.push({ host: h.host, kind: h.kind, provenance: h.provenance }); }
  }
  return { roleName: meta.roleName, author: meta.author, company: meta.company, hosts: merged };
}
