/**
 * firefoxAddonIntel.js — Firefox add-on host extraction (idea 00238).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses Firefox add-on manifest JSON (homepage_url, update_url, author)
 * and addons.mozilla.org (AMO) listing data for hosts tied to the add-on
 * developer, mapping an org's browser-extension footprint.
 */

/**
 * Build the addons.mozilla.org add-on page URL.
 * @param {string} slugOrId
 */
export function amoAddonUrl(slugOrId) {
  return `https://addons.mozilla.org/en-US/firefox/addon/${encodeURIComponent(String(slugOrId || ''))}/`;
}

/**
 * Build the AMO API URL for an add-on.
 * @param {string} slugOrId
 */
export function amoApiUrl(slugOrId) {
  return `https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(String(slugOrId || ''))}/`;
}

/**
 * Build the AMO developer page URL (developer pivot).
 * @param {string} authorId
 */
export function amoDeveloperUrl(authorId) {
  return `https://addons.mozilla.org/en-US/firefox/user/${encodeURIComponent(String(authorId || ''))}/`;
}

function hostFromUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.hostname.toLowerCase();
  } catch { return null; }
}

/**
 * Parse a Firefox extension manifest JSON into host findings.
 * @param {Object} manifestJson - Parsed manifest.json.
 * @returns {{ name, version, hosts: Array<{host, kind, provenance}> }}
 */
export function parseAddonManifest(manifestJson) {
  const manifest = manifestJson || {};
  const hosts = [];
  const seen = new Set();
  const add = (value, kind, provenance) => {
    const host = hostFromUrl(value);
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind, provenance }); }
  };

  add(manifest.homepage_url, 'addon-homepage', 'manifest.homepage_url');

  const gecko = (manifest.browser_specific_settings && manifest.browser_specific_settings.gecko) || {};
  add(gecko.update_url, 'addon-update-host', 'manifest.browser_specific_settings.gecko.update_url');

  if (manifest.author) {
    const dm = /@([a-z0-9.-]+\.[a-z]{2,})\s*>?/.exec(String(manifest.author));
    if (dm && !seen.has(dm[1].toLowerCase())) {
      seen.add(dm[1].toLowerCase());
      hosts.push({ host: dm[1].toLowerCase(), kind: 'author-domain', provenance: 'manifest.author' });
    }
  }

  for (const p of manifest.permissions || []) {
    if (typeof p !== 'string' || !p.includes('://')) continue;
    const host = hostFromUrl(p.replace(/\*/g, 'www'));
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind: 'permission-host', provenance: 'manifest.permissions' }); }
  }

  return { name: manifest.name || null, version: manifest.version || null, hosts };
}

/**
 * Parse an AMO API add-on JSON document (listing metadata) into host findings.
 * @param {Object} amoJson - Parsed JSON from the AMO add-on API.
 * @returns {{ name, guid, authors: Array<{name, url}>, hosts: Array<{host, kind, provenance}> }}
 */
export function parseAmoListingJson(amoJson) {
  const addon = amoJson || {};
  const hosts = [];
  const seen = new Set();
  const add = (value, kind, provenance) => {
    const host = hostFromUrl(value);
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind, provenance }); }
  };

  add(addon.homepage && addon.homepage.url, 'amo-homepage', 'amo.homepage.url');
  add(addon.support_url && addon.support_url.url, 'amo-support', 'amo.support_url.url');
  add(addon.privacy_policy && addon.privacy_policy.url, 'amo-privacy', 'amo.privacy_policy.url');

  const authors = [];
  for (const a of addon.authors || []) {
    if (!a) continue;
    authors.push({ name: a.name || null, url: a.url || null });
    add(a.url, 'amo-author-page', 'amo.authors[].url');
  }

  return { name: addon.name || null, guid: addon.guid || null, authors, hosts };
}

/**
 * Combined add-on analysis: manifest + AMO listing JSON.
 * @param {Object} manifestJson
 * @param {Object} amoJson
 */
export function analyzeFirefoxAddon(manifestJson, amoJson) {
  const manifest = parseAddonManifest(manifestJson);
  const listing = parseAmoListingJson(amoJson);
  const merged = [...manifest.hosts];
  const seen = new Set(manifest.hosts.map(h => h.host));
  for (const h of listing.hosts) {
    if (!seen.has(h.host)) { seen.add(h.host); merged.push(h); }
  }
  return { name: manifest.name || listing.name, authors: listing.authors, hosts: merged };
}
