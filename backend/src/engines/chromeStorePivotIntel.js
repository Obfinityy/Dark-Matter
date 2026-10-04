/**
 * chromeStorePivotIntel.js — Chrome Web Store developer pivoting (idea 00237).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses extension manifest snippets and Chrome Web Store listing data for
 * update URLs, homepage/support-site hosts, and developer website links so
 * an org's published extensions can be pivoted into its web properties.
 */

/**
 * Build the Chrome Web Store listing URL for an extension.
 * @param {string} extensionId - 32-char extension ID.
 */
export function storeListingUrl(extensionId) {
  return `https://chromewebstore.google.com/detail/${encodeURIComponent(String(extensionId || ''))}`;
}

/**
 * Build the Chrome Web Store update-check URL used by extensions.
 * @param {string} extensionId
 */
export function updateCheckUrl(extensionId) {
  return `https://clients2.google.com/service/update2/crx?x=id%3D${encodeURIComponent(String(extensionId || ''))}%26uc`;
}

/**
 * Build the developer's "more extensions" search URL (developer pivot).
 * @param {string} developerName
 */
export function developerPivotUrl(developerName) {
  return `https://chromewebstore.google.com/search/${encodeURIComponent(String(developerName || ''))}`;
}

function hostFromUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.hostname.toLowerCase();
  } catch { return null; }
}

/**
 * Parse a Chrome extension manifest JSON (or snippet) into host findings.
 * @param {Object} manifestJson - Parsed manifest.json.
 * @returns {{ name, version, updateUrl, hosts: Array<{host, kind, provenance}> }}
 */
export function parseExtensionManifest(manifestJson) {
  const manifest = manifestJson || {};
  const hosts = [];
  const seen = new Set();
  const add = (value, kind, provenance) => {
    const host = hostFromUrl(value);
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind, provenance }); }
  };

  add(manifest.update_url, 'extension-update-host', 'manifest.update_url');
  add(manifest.homepage_url, 'extension-homepage', 'manifest.homepage_url');

  if (manifest.author) {
    const author = typeof manifest.author === 'string' ? manifest.author : manifest.author.email;
    if (author) {
      const dm = /@([a-z0-9.-]+\.[a-z]{2,})\s*>?/.exec(String(author));
      if (dm && !seen.has(dm[1].toLowerCase())) {
        seen.add(dm[1].toLowerCase());
        hosts.push({ host: dm[1].toLowerCase(), kind: 'author-domain', provenance: 'manifest.author' });
      }
    }
  }

  for (const p of manifest.host_permissions || []) {
    const host = hostFromUrl(p.replace(/\*/g, 'www'));
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind: 'permission-host', provenance: 'manifest.host_permissions' }); }
  }

  const extPages = manifest.externally_connectable;
  for (const site of (extPages && extPages.matches) || []) {
    const host = hostFromUrl(site.replace(/\*/g, 'www'));
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind: 'connectable-host', provenance: 'manifest.externally_connectable.matches' }); }
  }

  return {
    name: manifest.name || null,
    version: manifest.version || null,
    updateUrl: manifest.update_url || null,
    hosts,
  };
}

/**
 * Parse Chrome Web Store listing data (HTML snippet or JSON) for developer links.
 * @param {string|Object} listingData - Raw listing HTML or parsed JSON.
 * @returns {{ developer, website, support, hosts: Array<{host, kind, provenance}> }}
 */
export function parseStoreListingData(listingData) {
  const text = typeof listingData === 'string' ? listingData : JSON.stringify(listingData || {});
  const hosts = [];
  const seen = new Set();

  const addUrl = (url, kind, provenance) => {
    const host = hostFromUrl(url);
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind, provenance }); }
  };

  const linkRe = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]{0,80})<\/a>/gi;
  let m;
  while ((m = linkRe.exec(text))) {
    const label = m[2].toLowerCase();
    if (/website|developer|support|privacy|homepage/.test(label)) {
      const kind = /support/.test(label) ? 'support-site' : /privacy/.test(label) ? 'privacy-page' : 'developer-website';
      addUrl(m[1], kind, 'listing.link');
    }
  }

  // JSON listing shape: { developer: { name, website, supportUrl } }
  const data = typeof listingData === 'object' ? (listingData || {}) : {};
  const dev = data.developer || data.author || {};
  addUrl(dev.website || dev.url, 'developer-website', 'listing.developer.website');
  addUrl(dev.supportUrl || dev.support_url, 'support-site', 'listing.developer.supportUrl');
  addUrl(data.website || data.homepage, 'listing-website', 'listing.website');

  const developer = dev.name || data.developerName || data.offeredBy || null;
  const website = dev.website || data.website || null;

  return { developer, website, hosts };
}

/**
 * Combined extension analysis: manifest + listing data.
 * @param {Object} manifestJson
 * @param {string|Object} listingData
 */
export function analyzeChromeExtension(manifestJson, listingData) {
  const manifest = parseExtensionManifest(manifestJson);
  const listing = parseStoreListingData(listingData);
  const merged = [...manifest.hosts];
  const seen = new Set(manifest.hosts.map(h => h.host));
  for (const h of listing.hosts) {
    if (!seen.has(h.host)) { seen.add(h.host); merged.push(h); }
  }
  return { name: manifest.name, developer: listing.developer, updateUrl: manifest.updateUrl, hosts: merged };
}
