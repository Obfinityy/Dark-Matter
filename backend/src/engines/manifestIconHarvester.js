/**
 * manifestIconHarvester.js — Web-app manifest icon harvesting engine.
 *
 * Parses web app manifests (observed on authorized targets) and extracts the
 * icon set for visual service identification: icon purpose (any / maskable /
 * monochrome), sizes, and density hints. Comparing harvested icons across
 * subdomains helps identify related properties and rebranded deployments.
 */

/**
 * Parse a web app manifest JSON string.
 * @param {string} manifestJson raw manifest text
 * @returns {{name: string|null, shortName: string|null, startUrl: string|null, icons: Array}|null}
 */
export function parseManifest(manifestJson = '') {
  let data;
  try {
    data = JSON.parse(manifestJson);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  return {
    name: data.name || null,
    shortName: data.short_name || data.shortName || null,
    startUrl: data.start_url || data.startUrl || null,
    display: data.display || null,
    themeColor: data.theme_color || data.themeColor || null,
    icons: Array.isArray(data.icons) ? data.icons : [],
  };
}

/**
 * Normalize a manifest icon entry into a fingerprintable record.
 * @param {object} icon raw icon entry
 * @param {string} manifestUrl URL the manifest was served from (for resolving relative src)
 * @returns {{src: string, sizes: string, type: string|null, purpose: string, pixelSize: number}}
 */
export function harvestIcon(icon = {}, manifestUrl = '') {
  const rawSrc = String(icon.src || '');
  let src = rawSrc;
  try {
    src = new URL(rawSrc, manifestUrl).href;
  } catch {
    /* keep raw */
  }
  const sizes = String(icon.sizes || '').trim();
  const purpose = String(icon.purpose || 'any')
    .toLowerCase()
    .trim();
  let pixelSize = 0;
  const m = /(\d+)\s*x\s*(\d+)/i.exec(sizes);
  if (m) pixelSize = Math.min(parseInt(m[1], 10), parseInt(m[2], 10));
  return {
    src,
    sizes: sizes || 'unknown',
    type: icon.type || null,
    purpose,
    pixelSize,
  };
}

/**
 * Harvest and summarize all icons from a manifest for service identification.
 * @param {string} manifestJson raw manifest text
 * @param {string} manifestUrl URL the manifest was served from
 * @returns {{identity: object, icons: Array, largest: object|null, maskable: boolean}|null}
 */
export function harvestManifestIcons(manifestJson = '', manifestUrl = '') {
  const manifest = parseManifest(manifestJson);
  if (!manifest) return null;
  const icons = manifest.icons.map(i => harvestIcon(i, manifestUrl));
  const largest = icons.reduce(
    (best, cur) => (cur.pixelSize > (best?.pixelSize || 0) ? cur : best),
    null
  );
  return {
    identity: {
      name: manifest.name,
      shortName: manifest.shortName,
      startUrl: manifest.startUrl,
      themeColor: manifest.themeColor,
    },
    icons,
    largest,
    maskable: icons.some(i => i.purpose.includes('maskable')),
    count: icons.length,
  };
}

export const MANIFEST_ICON_HARVESTER = {
  parseManifest,
  harvestIcon,
  harvestManifestIcons,
};

export default MANIFEST_ICON_HARVESTER;
