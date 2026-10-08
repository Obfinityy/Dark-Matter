/**
 * mediaAssetMiner.js — Media & CSS asset crawl-surface analysis (ideas 771–780).
 *
 * Rich-media pages hide a large share of their crawl surface inside media
 * elements and stylesheets: date-parameterized calendar links, map-tile
 * endpoints, <video>/<audio> sources, caption tracks, responsive <picture>
 * sets, and CSS url() references (@import chains, @font-face files, and
 * custom-property asset URLs).
 *
 * This engine provides PURE content-analysis helpers used by the Hunt agent's
 * browser-control layer. Every function analyzes GIVEN data (HTML strings or
 * stylesheet text) and harvests the asset URLs that already appear in it.
 *
 * Defensive framing: these are inventory/auditing utilities for an authorized
 * bug-bounty agent. No network fetching, no exploit payloads. Embedded
 * data: URIs are excluded — only crawlable URLs are returned.
 */

/**
 * Read one HTML attribute value from a tag's attribute string.
 * @param {string} attrs Raw attribute text (everything between tag name and >)
 * @param {string} name Attribute name
 * @returns {string} attribute value or ''
 */
function getAttr(attrs = '', name) {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(
    String(attrs)
  );
  return m ? (m[1] ?? m[2] ?? m[3] ?? '').trim() : '';
}

/**
 * Host label for a URL, with placeholders for relative/invalid ones.
 * @param {string} url URL to inspect
 * @returns {string} hostname, '(relative)', or '(invalid)'
 */
function hostOf(url) {
  try {
    const h = new URL(url, 'https://placeholder.local').host;
    return h === 'placeholder.local' ? '(relative)' : h;
  } catch {
    return '(invalid)';
  }
}

/**
 * Decode a query-string value without throwing on malformed escapes.
 * @param {string} s Raw value
 * @returns {string} decoded value or the original
 */
function decodeURIComponentSafe(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/* ------------------------------------------------------------------ */
/* 771 — Calendar widget date-parameter URL mining                     */
/* ------------------------------------------------------------------ */

/**
 * Mine date-parameterized URLs from calendar widget markup and return
 * normalized date-parameter patterns (concrete dates replaced with
 * {date}/{year}/{month}/{day} placeholders) so the crawler can enumerate
 * the whole calendar surface from a single template.
 *
 * Detects named query params (date=, day=, start=, end=, …),
 * year/month/day triples (?year=2026&month=10&day=8), and path segments
 * (/events/2026/10/08, /archive/2026-10-08).
 * @param {string} html Page HTML
 * @returns {{ url: string, pattern: string, dateParams: string[] }[]} normalized date-URL patterns
 */
export function mineCalendarDateUrls(html = '') {
  const text = String(html);
  const results = [];
  const seen = new Set();

  const hrefRe = /\bhref\s*=\s*["']([^"'#\s][^"']*)["']/gi;
  let m;
  while ((m = hrefRe.exec(text)) !== null) {
    const url = m[1].trim();
    if (!url || /^javascript:/i.test(url) || /^data:/i.test(url)) continue;

    let pattern = url;
    const dateParams = [];

    // 1. Path segments: /events/2026/10/08  →  /events/{year}/{month}/{day}
    pattern = pattern.replace(/\/\d{4}\/\d{1,2}\/\d{1,2}(?=\/|$|[?#])/g, () => {
      for (const p of ['year', 'month', 'day']) if (!dateParams.includes(p)) dateParams.push(p);
      return '/{year}/{month}/{day}';
    });

    // 2. Path date: /archive/2026-10-08  →  /archive/{date}
    pattern = pattern.replace(/\d{4}-\d{2}-\d{2}/g, () => {
      if (!dateParams.includes('date')) dateParams.push('date');
      return '{date}';
    });

    // 3. Year/month/day triples first: ?year=2026&month=10&day=8
    //    (runs before the generic named-param pass so day=/month=/year=
    //    keep their granular placeholders).
    for (const [pname, placeholder] of [
      ['year', '{year}'],
      ['y', '{year}'],
      ['month', '{month}'],
      ['m', '{month}'],
      ['day', '{day}'],
      ['d', '{day}'],
    ]) {
      const before = pattern;
      pattern = pattern.replace(
        new RegExp(`([?&]${pname}=)\\d{1,4}(?=[&#]|$)`, 'gi'),
        `$1${placeholder}`
      );
      if (pattern !== before && !dateParams.includes(pname)) dateParams.push(pname);
    }

    // 4. Named query params with date-like values: ?date=2026-10-08, ?start=…, ?end=…
    pattern = pattern.replace(
      /([?&])(date|day|d|start_date|end_date|start|end|from|to|selected_date|on)=([^&#]*)/gi,
      (full, sep, name, value) => {
        const v = decodeURIComponentSafe(value);
        if (!/^\d{4}-\d{2}-\d{2}$|^\d{8}$|^\d{1,2}$|^\d{4}\/\d{1,2}\/\d{1,2}$/.test(v)) return full;
        if (!dateParams.includes(name)) dateParams.push(name);
        return `${sep}${name}={date}`;
      }
    );

    if (pattern !== url && !seen.has(pattern)) {
      seen.add(pattern);
      results.push({ url, pattern, dateParams });
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* 772 — Map-tile URL harvesting with provider identification          */
/* ------------------------------------------------------------------ */

const TILE_PROVIDERS = [
  { provider: 'OpenStreetMap', match: /tile\.openstreetmap\.org/i },
  {
    provider: 'Google Maps',
    match: /(?:mt[01]\.google\.com|maps\.googleapis\.com|\/vt[/?]|khms[01]\.google\.com)/i,
  },
  { provider: 'Mapbox', match: /api\.mapbox\.com/i },
  { provider: 'CartoDB', match: /(?:basemaps\.cartocdn\.com|\.carto\.com)/i },
  { provider: 'Esri', match: /arcgisonline\.com/i },
  { provider: 'Thunderforest', match: /tile\.thunderforest\.com/i },
  {
    provider: 'Bing Maps',
    match: /(?:ecn\.t\d*\.tiles\.virtualearth\.net|dev\.virtualearth\.net)/i,
  },
  { provider: 'HERE', match: /hereapi\.com/i },
  { provider: 'Stamen', match: /stamen-tiles/i },
];

const TILE_HINT_RE = /\{z\}|\{x\}|\{y\}|\{s\}|\{quadkey\}|\/vt[/?]|lyrs=|\/tiles?\//i;

/**
 * Harvest map-tile endpoint URLs (Leaflet/OpenLayers tile layers) from page
 * content and identify the tile provider/host for CDN surface mapping.
 * @param {string} html Page HTML (may include inline scripts with tile-layer configs)
 * @returns {{ url: string, provider: string, host: string }[]} deduplicated tile endpoints
 */
export function harvestMapTileUrls(html = '') {
  const text = String(html);
  const results = [];
  const seen = new Set();

  const consider = raw => {
    const url = String(raw)
      .replace(/[.,;:!?]+$/, '')
      .trim();
    if (!url || !TILE_HINT_RE.test(url) || seen.has(url)) return;
    seen.add(url);
    const host = hostOf(url);
    const hit = TILE_PROVIDERS.find(p => p.match.test(url));
    results.push({ url, provider: hit ? hit.provider : 'Generic tile template', host });
  };

  // Absolute / protocol-relative URLs.
  const urlRe = /(?:https?:)?\/\/[^\s"'<>)\]}]+/gi;
  let m;
  while ((m = urlRe.exec(text)) !== null) consider(m[0]);

  // Relative quoted tile templates, e.g. "/tiles/{z}/{x}/{y}.png".
  const relRe = /["']([^"']*\{z\}[^"']*)["']/gi;
  while ((m = relRe.exec(text)) !== null) consider(m[1]);

  return results;
}

/* ------------------------------------------------------------------ */
/* 773 — <video> source extraction                                      */
/* ------------------------------------------------------------------ */

/**
 * Shared <video>/<audio> source extractor.
 * @param {string} html Page HTML
 * @param {'video'|'audio'} tag Element tag to scan
 * @returns {{ url: string, kind: 'src'|'poster'|'source', type: string, container: string }[]}
 */
function extractMediaSources(html, tag) {
  const text = String(html);
  const out = [];
  const seen = new Set();
  const push = (url, kind, type, container) => {
    url = (url || '').trim();
    if (!url || /^data:/i.test(url) || seen.has(`${kind}:${url}`)) return;
    seen.add(`${kind}:${url}`);
    out.push({ url, kind, type: type || '', container });
  };

  const tagRe = new RegExp(`<${tag}\\b([^>]*?)(?:>([\\s\\S]*?)<\\/${tag}>|\\s*\\/>)`, 'gi');
  let m;
  let n = 0;
  while ((m = tagRe.exec(text)) !== null) {
    n += 1;
    const attrs = m[1] || '';
    const inner = m[2] || '';
    const id = getAttr(attrs, 'id');
    const container = id ? `${tag}#${id}` : `${tag}#${n}`;
    push(getAttr(attrs, 'src'), 'src', getAttr(attrs, 'type'), container);
    if (tag === 'video') push(getAttr(attrs, 'poster'), 'poster', '', container);
    const srcRe = /<source\b([^>]*?)\/?>/gi;
    let s;
    while ((s = srcRe.exec(inner)) !== null) {
      push(getAttr(s[1], 'src'), 'source', getAttr(s[1], 'type'), container);
    }
  }
  return out;
}

/**
 * Extract every <video> element's playable URLs: the element's own src,
 * its poster image, and all nested <source> children with MIME types.
 * @param {string} html Page HTML
 * @returns {{ url: string, kind: 'src'|'poster'|'source', type: string, container: string }[]}
 */
export function extractVideoSources(html = '') {
  return extractMediaSources(html, 'video');
}

/* ------------------------------------------------------------------ */
/* 774 — <audio> source extraction                                      */
/* ------------------------------------------------------------------ */

/**
 * Extract every <audio> element's playable URLs: the element's own src
 * and all nested <source> children with MIME types.
 * @param {string} html Page HTML
 * @returns {{ url: string, kind: 'src'|'source', type: string, container: string }[]}
 */
export function extractAudioSources(html = '') {
  return extractMediaSources(html, 'audio');
}

/* ------------------------------------------------------------------ */
/* 775 — <track> caption/subtitle URL harvesting                       */
/* ------------------------------------------------------------------ */

/**
 * Harvest <track> caption/subtitle/description file URLs (WebVTT and
 * friends) from <video>/<audio> elements, with language metadata.
 * @param {string} html Page HTML
 * @returns {{ url: string, kind: string, srclang: string, label: string }[]}
 */
export function harvestTrackUrls(html = '') {
  const text = String(html);
  const out = [];
  const seen = new Set();
  const trackRe = /<track\b([^>]*?)\/?>/gi;
  let m;
  while ((m = trackRe.exec(text)) !== null) {
    const url = getAttr(m[1], 'src').trim();
    if (!url || /^data:/i.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push({
      url,
      kind: getAttr(m[1], 'kind') || 'subtitles',
      srclang: getAttr(m[1], 'srclang'),
      label: getAttr(m[1], 'label'),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 776 — <picture>/<source> responsive image extraction                */
/* ------------------------------------------------------------------ */

/**
 * Split a srcset attribute into { url, descriptor } candidates.
 * @param {string} srcset Raw srcset attribute value
 * @returns {{ url: string, descriptor: string }[]} candidates
 */
function parseSrcset(srcset = '') {
  const out = [];
  for (const entry of String(srcset).split(',')) {
    const parts = entry.trim().split(/\s+/);
    if (parts[0]) out.push({ url: parts[0], descriptor: parts[1] || '' });
  }
  return out;
}

/**
 * Extract responsive image sources from <picture> elements: every
 * <source> child's srcset candidates with their media/type metadata,
 * plus the fallback <img> and its srcset.
 * @param {string} html Page HTML
 * @returns {{ url: string, descriptor: string, media: string, type: string, element: string }[]}
 */
export function extractPictureSources(html = '') {
  const text = String(html);
  const out = [];
  const seen = new Set();
  const push = (url, descriptor, media, type, element) => {
    url = (url || '').trim();
    if (!url || /^data:/i.test(url) || seen.has(url)) return;
    seen.add(url);
    out.push({ url, descriptor: descriptor || '', media: media || '', type: type || '', element });
  };

  const pictureRe = /<picture\b([^>]*?)>([\s\S]*?)<\/picture>/gi;
  let m;
  let n = 0;
  while ((m = pictureRe.exec(text)) !== null) {
    n += 1;
    const inner = m[2] || '';
    const id = getAttr(m[1], 'id');
    const label = id ? `picture#${id}` : `picture#${n}`;

    const srcRe = /<source\b([^>]*?)\/?>/gi;
    let s;
    while ((s = srcRe.exec(inner)) !== null) {
      const media = getAttr(s[1], 'media');
      const type = getAttr(s[1], 'type');
      const srcset = getAttr(s[1], 'srcset');
      if (srcset) {
        for (const cand of parseSrcset(srcset)) {
          push(cand.url, cand.descriptor, media, type, `${label}>source`);
        }
      } else {
        push(getAttr(s[1], 'src'), '', media, type, `${label}>source`);
      }
    }

    const imgRe = /<img\b([^>]*?)\/?>/gi;
    let im;
    while ((im = imgRe.exec(inner)) !== null) {
      for (const cand of parseSrcset(getAttr(im[1], 'srcset'))) {
        push(cand.url, cand.descriptor, '', '', `${label}>img`);
      }
      push(getAttr(im[1], 'src'), '', '', '', `${label}>img`);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 777 — CSS url() reference parsing with kind classification           */
/* ------------------------------------------------------------------ */

const CSS_FONT_EXT = /\.(woff2?|ttf|otf|eot|fon)(\?|#|$)/i;
const CSS_IMAGE_EXT = /\.(png|jpe?g|gif|svg|webp|avif|ico|bmp|tiff?)(\?|#|$)/i;

/**
 * Parse every url() reference in stylesheet text and classify the asset
 * kind (font / image / import / other) from the file extension and the
 * declaration context (e.g. @font-face src, @import).
 * @param {string} css Stylesheet text
 * @returns {{ url: string, kind: 'font'|'image'|'import'|'other', context: string }[]}
 */
export function parseCssUrlReferences(css = '') {
  const text = String(css);
  const out = [];
  const seen = new Set();
  const urlRe = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s][^)"']*))\s*\)/gi;
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    const url = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (!url || /^data:/i.test(url) || seen.has(url)) continue;
    seen.add(url);

    // Declaration context: nearest "property:" before this url().
    const before = text.slice(0, m.index);
    const decl = /(?:^|[;{])\s*([a-zA-Z-]+)\s*:[^;{}]*$/.exec(before);
    const context = decl ? decl[1].toLowerCase() : '';

    let kind = 'other';
    if (CSS_FONT_EXT.test(url) || context === 'src') kind = 'font';
    else if (CSS_IMAGE_EXT.test(url)) kind = 'image';
    else if (/\.css(\?|#|$)/i.test(url)) kind = 'import';

    out.push({ url, kind, context: context || '(unknown)' });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 778 — CSS @import chain following with cycle detection               */
/* ------------------------------------------------------------------ */

/**
 * Extract @import targets from a stylesheet, in both url(...) and
 * quoted-string forms (media queries after the URL are tolerated).
 * @param {string} css Stylesheet text
 * @returns {string[]} import targets in source order
 */
function cssImportsOf(css = '') {
  const out = [];
  const re = /@import\s+(?:url\(\s*["']?([^"')]+)["']?\s*\)|["']([^"']+)["'])[^;]*;/gi;
  let m;
  while ((m = re.exec(String(css))) !== null) {
    const target = (m[1] || m[2] || '').trim();
    if (target) out.push(target);
  }
  return out;
}

/**
 * Follow CSS @import chains from a stylesheet inventory: returns the
 * stylesheets in depth-first resolution order plus any import cycles
 * (which would otherwise recurse forever in a naive crawler).
 *
 * @param {Object<string,string>|string} stylesheets Map of name → CSS text,
 *   or a single stylesheet string (treated as the entry stylesheet)
 * @param {string} entry Entry stylesheet name (default 'entry')
 * @returns {{ entry: string, order: string[], cycles: string[][] }} ordered
 *   imports and detected cycles (each cycle lists the looped names)
 */
export function followCssImportChains(stylesheets = {}, entry = 'entry') {
  const sheets = typeof stylesheets === 'string' ? { [entry]: stylesheets } : stylesheets || {};
  const order = [];
  const cycles = [];
  const visited = new Set();
  const stack = [];

  function visit(name) {
    if (stack.includes(name)) {
      cycles.push([...stack.slice(stack.indexOf(name)), name]);
      return;
    }
    if (visited.has(name)) return;
    visited.add(name);
    stack.push(name);
    order.push(name);
    for (const dep of cssImportsOf(sheets[name] ?? '')) visit(dep);
    stack.pop();
  }

  visit(entry);
  return { entry, order, cycles };
}

/* ------------------------------------------------------------------ */
/* 779 — @font-face src URL extraction                                  */
/* ------------------------------------------------------------------ */

/**
 * Extract font-file URLs from @font-face blocks, with format() hints and
 * font metadata (family, weight, style) for font-host inventory.
 * @param {string} css Stylesheet text
 * @returns {{ url: string, format: string, family: string, weight: string, style: string }[]}
 */
export function extractFontFaceUrls(css = '') {
  const text = String(css);
  const out = [];
  const seen = new Set();
  const blockRe = /@font-face\s*\{([^}]*)\}/gi;
  let b;
  while ((b = blockRe.exec(text)) !== null) {
    const body = b[1];
    const family = /font-family\s*:\s*["']?([^;"']+)["']?/i.exec(body);
    const weight = /font-weight\s*:\s*([^;]+)/i.exec(body);
    const style = /font-style\s*:\s*([^;]+)/i.exec(body);
    const srcRe = /\bsrc\s*:\s*([^;]+);?/gi;
    let s;
    while ((s = srcRe.exec(body)) !== null) {
      const chunkRe =
        /url\(\s*["']?([^"')]+)["']?\s*\)(?:\s*format\(\s*["']?([^"')]+)["']?\s*\))?/gi;
      let c;
      while ((c = chunkRe.exec(s[1])) !== null) {
        const url = c[1].trim();
        if (!url || /^data:/i.test(url) || seen.has(url)) continue;
        seen.add(url);
        out.push({
          url,
          format: (c[2] || '').trim(),
          family: family ? family[1].trim() : '',
          weight: weight ? weight[1].trim() : '',
          style: style ? style[1].trim() : '',
        });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 780 — CSS custom-property (variable) URL discovery                   */
/* ------------------------------------------------------------------ */

/**
 * Find URLs stored in CSS custom properties (--var: url(...)), a common
 * theming pattern that hides asset references from scans that only look
 * at known properties.
 * @param {string} css Stylesheet text
 * @returns {{ name: string, url: string }[]} variable names with their URLs
 */
export function findCssCustomPropertyUrls(css = '') {
  const text = String(css);
  const out = [];
  const seen = new Set();
  const varRe = /(--[\w-]+)\s*:\s*url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  let m;
  while ((m = varRe.exec(text)) !== null) {
    const url = m[2].trim();
    if (!url || /^data:/i.test(url) || seen.has(`${m[1]}:${url}`)) continue;
    seen.add(`${m[1]}:${url}`);
    out.push({ name: m[1], url });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Registry — idea coverage (771–780, zero skips)                       */
/* ------------------------------------------------------------------ */

/**
 * Maps each idea number to the function that implements it.
 * @type {Object<number, string>}
 */
export const MEDIA_ASSET_IDEAS = {
  771: 'mineCalendarDateUrls',
  772: 'harvestMapTileUrls',
  773: 'extractVideoSources',
  774: 'extractAudioSources',
  775: 'harvestTrackUrls',
  776: 'extractPictureSources',
  777: 'parseCssUrlReferences',
  778: 'followCssImportChains',
  779: 'extractFontFaceUrls',
  780: 'findCssCustomPropertyUrls',
};

const MEDIA_ASSET_FNS = {
  mineCalendarDateUrls,
  harvestMapTileUrls,
  extractVideoSources,
  extractAudioSources,
  harvestTrackUrls,
  extractPictureSources,
  parseCssUrlReferences,
  followCssImportChains,
  extractFontFaceUrls,
  findCssCustomPropertyUrls,
};

/**
 * Verify that every idea in the 771–780 range is implemented (zero skips).
 * @returns {{ covered: number, total: number }} coverage counts
 */
export function registryComplete() {
  const names = Object.values(MEDIA_ASSET_IDEAS);
  const covered = names.filter(n => typeof MEDIA_ASSET_FNS[n] === 'function').length;
  return { covered, total: names.length };
}

export default {
  ...MEDIA_ASSET_FNS,
  MEDIA_ASSET_IDEAS,
  registryComplete,
};
