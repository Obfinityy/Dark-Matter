/**
 * appLinkMapper.js — Mobile/web app-link attack-surface mapping engine.
 *
 * An authorized hunter often needs to know every doorway between a web app and
 * its native apps, because each doorway is attack surface: PWA entry routes,
 * smart app banners, iOS universal links, Android app links, custom URL
 * schemes, and third-party attribution/adjustment deep links (Branch,
 * Firebase, Adjust, AppsFlyer, Kochava).
 *
 * This engine maps that infrastructure from PASSIVE, publicly-served sources
 * only — no network calls are made here:
 *  - Web app manifest JSON (start_url, scope, shortcuts, related_applications)
 *  - First-party HTML/JS (meta tags, beforeinstallprompt handlers, branch keys)
 *  - Well-known files the target itself serves: apple-app-site-association,
 *    assetlinks.json
 *
 * It never manufactures exploit payloads; it produces structured inventory
 * rows the hunt's scope-checker and deep-link fuzzer consume downstream.
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Hostname character class used by the deep-link domain extractors. */
const HOST_RE = '(?:[a-z0-9-]+\\.)*[a-z0-9-]+\\.[a-z]{2,}';

/** Protocols that are NOT custom app schemes and must be excluded. */
const KNOWN_PROTOCOLS = new Set([
  'http',
  'https',
  'ftp',
  'ftps',
  'ws',
  'wss',
  'file',
  'data',
  'mailto',
  'tel',
  'sms',
  'smsto',
  'javascript',
  'blob',
  'about',
  'content',
  'android-app',
  'market',
  'intent',
]);

/**
 * Collect unique hostnames matching `re` (which must have group 1 = host).
 * @param {string} text
 * @param {RegExp} re global regex with one host capture group
 * @returns {string[]} unique lower-cased hostnames
 */
function collectHosts(text, re) {
  const hosts = new Set();
  const source = String(text || '');
  const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m;
  while ((m = rx.exec(source)) !== null) {
    if (m[1]) hosts.add(m[1].toLowerCase());
  }
  return [...hosts];
}

/**
 * Safely parse JSON without throwing.
 * @param {*} input string or already-parsed object
 * @returns {any|null}
 */
function safeParse(input) {
  if (input == null) return null;
  if (typeof input === 'object') return input;
  try {
    return JSON.parse(String(input));
  } catch {
    return null;
  }
}

/**
 * Extract <meta ...> attribute maps from HTML.
 * @param {string} html
 * @returns {{name: string, content: string, property: string}[]}
 */
function extractMetaTags(html = '') {
  const metas = [];
  const re = /<meta\s+([^>]*?)>/gi;
  let m;
  while ((m = re.exec(String(html))) !== null) {
    const attrs = m[1];
    const get = k => {
      const mm = attrs.match(new RegExp(`${k}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
      return mm ? (mm[2] ?? mm[3] ?? mm[4] ?? '') : '';
    };
    metas.push({
      name: String(get('name')).toLowerCase(),
      property: String(get('property')).toLowerCase(),
      content: String(get('content')),
    });
  }
  return metas;
}

// ---------------------------------------------------------------------------
// 871. PWA install-prompt mapping
// ---------------------------------------------------------------------------

const PWA_PROMPT_SIGNALS = [
  'beforeinstallprompt',
  'deferredprompt',
  'installprompt',
  'appinstalled',
  'userchoice',
];

/**
 * Map beforeinstallprompt flows to PWA entry routes.
 *
 * Combines the web app manifest (start_url, scope, shortcuts) with any
 * install-prompt handling found in JS, so the hunter knows which routes the
 * installed app opens first — and which shortcuts expose extra routes.
 *
 * @param {string|object} manifestJson web app manifest (JSON text or object)
 * @param {string} jsSource optional JS source to scan for install handlers
 * @returns {{
 *   startUrl: string|null,
 *   scope: string|null,
 *   shortcuts: {name: string, url: string}[],
 *   installSignals: string[],
 *   serviceWorkerRegistered: boolean,
 *   entryRoutes: string[]
 * }}
 */
export function mapPwaInstallRoutes(manifestJson, jsSource = '') {
  const manifest = safeParse(manifestJson) || {};
  const js = String(jsSource || '');
  const lower = js.toLowerCase();

  const shortcuts = [];
  if (Array.isArray(manifest.shortcuts)) {
    for (const s of manifest.shortcuts) {
      if (s && s.url) shortcuts.push({ name: String(s.name || ''), url: String(s.url) });
    }
  }

  const installSignals = PWA_PROMPT_SIGNALS.filter(sig => lower.includes(sig));
  const serviceWorkerRegistered =
    /navigator\s*\.\s*serviceworker\s*\.\s*register|serviceworker\s*\.\s*register/i.test(js);

  const entryRoutes = [];
  if (manifest.start_url) entryRoutes.push(String(manifest.start_url));
  for (const s of shortcuts) entryRoutes.push(s.url);

  return {
    startUrl: manifest.start_url ? String(manifest.start_url) : null,
    scope: manifest.scope ? String(manifest.scope) : null,
    shortcuts,
    installSignals,
    serviceWorkerRegistered,
    entryRoutes: [...new Set(entryRoutes)],
  };
}

// ---------------------------------------------------------------------------
// 872. Smart app-banner URL mapping
// ---------------------------------------------------------------------------

/**
 * Extract smart app banner linkage for native apps.
 *
 * Parses apple-itunes-app / google-play-app (and Microsoft) meta tags into
 * app-store ids, affiliate data, and deep-link arguments the banner passes
 * to the native app.
 *
 * @param {string} html page HTML
 * @returns {{
 *   apple: {appId: string|null, affiliateData: string|null, appArgument: string|null} | null,
 *   googlePlay: {appId: string|null} | null,
 *   urls: string[]
 * }}
 */
export function extractSmartAppBannerUrls(html = '') {
  const metas = extractMetaTags(html);
  let apple = null;
  let googlePlay = null;
  const urls = new Set();

  for (const meta of metas) {
    if (meta.name === 'apple-itunes-app' && meta.content) {
      const appId = /app-id\s*=\s*([0-9]+)/i.exec(meta.content);
      const affiliate = /affiliate-data\s*=\s*([^,]+)/i.exec(meta.content);
      const argument = /app-argument\s*=\s*([^,]+)/i.exec(meta.content);
      apple = {
        appId: appId ? appId[1] : null,
        affiliateData: affiliate ? affiliate[1].trim() : null,
        appArgument: argument ? argument[1].trim() : null,
      };
      if (apple.appId) urls.add(`https://apps.apple.com/app/id${apple.appId}`);
      if (apple.appArgument) urls.add(apple.appArgument);
    }
    if (meta.name === 'google-play-app' && meta.content) {
      const appId = /app-id\s*=\s*([a-z0-9._]+)/i.exec(meta.content);
      googlePlay = { appId: appId ? appId[1] : null };
      if (googlePlay.appId)
        urls.add(`https://play.google.com/store/apps/details?id=${googlePlay.appId}`);
    }
    if (meta.name === 'msapplication-starturl' && meta.content) urls.add(meta.content);
  }

  return { apple, googlePlay, urls: [...urls] };
}

// ---------------------------------------------------------------------------
// 873. Universal-link AASA mapping
// ---------------------------------------------------------------------------

/**
 * Map iOS universal links from an apple-app-site-association document.
 *
 * Handles both the legacy "paths" arrays and the modern "components" arrays,
 * tagging include/exclude (NOT) entries so the hunter sees exactly which
 * routes the native app claims.
 *
 * @param {string|object} aasaJson apple-app-site-association (JSON text or object)
 * @returns {{
 *   apps: {appId: string, teamId: string|null, bundleId: string|null}[],
 *   routes: {route: string, include: boolean}[],
 *   includes: string[],
 *   excludes: string[]
 * }[]}
 *   one entry per applinks.details item
 */
export function mapUniversalLinks(aasaJson) {
  const doc = safeParse(aasaJson) || {};
  const details = doc?.applinks?.details;
  if (!Array.isArray(details)) return [];

  const results = [];
  for (const d of details) {
    if (!d || typeof d !== 'object') continue;
    const appId = String(d.appID || '');
    const [teamId, bundleId] = appId.includes('.')
      ? [appId.slice(0, appId.indexOf('.')), appId.slice(appId.indexOf('.') + 1)]
      : [null, appId || null];

    const routes = [];
    const push = (route, include) => routes.push({ route: String(route), include });

    const src = d.paths ?? d.components ?? [];
    if (Array.isArray(d.paths)) {
      for (const p of d.paths) {
        if (typeof p !== 'string') continue;
        if (p.startsWith('NOT ')) push(p.slice(4).trim(), false);
        else push(p, true);
      }
    } else if (Array.isArray(d.components)) {
      for (const c of d.components) {
        if (!c || typeof c !== 'object') continue;
        const exclude = c['#exclude'] === true;
        // Modern format: ["/" : "<pattern>"], {"#exclude": true, "/": "..."}
        const keys = Object.keys(c).filter(k => k !== '#exclude');
        for (const k of keys) {
          const val = c[k];
          if (typeof val !== 'string') continue;
          // Join field name + pattern for readability, e.g. path=/foo/*
          push(`${k} ${val}`, !exclude);
        }
      }
    }

    const includes = routes.filter(r => r.include).map(r => r.route);
    const excludes = routes.filter(r => !r.include).map(r => r.route);
    results.push({
      apps: [{ appId, teamId, bundleId }],
      routes,
      includes,
      excludes,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// 874. Android App-Link mapping
// ---------------------------------------------------------------------------

/**
 * Map Android app links from a Digital Asset Links (assetlinks.json) file.
 *
 * Returns each statement's relations, target namespace/package, and SHA-256
 * certificate fingerprints — the exact signals that bind web routes to the
 * native app for verified app links.
 *
 * @param {string|object} assetlinksJson assetlinks.json (JSON text, object, or array)
 * @returns {{
 *   relations: string[],
 *   namespace: string,
 *   packageName: string|null,
 *   sha256Fingerprints: string[],
 *   url: string|null
 * }[]}
 */
export function mapAndroidAppLinks(assetlinksJson) {
  const parsed = safeParse(assetlinksJson);
  const statements = Array.isArray(parsed) ? parsed : parsed != null ? [parsed] : [];
  const out = [];

  for (const s of statements) {
    if (!s || typeof s !== 'object') continue;
    const target = s.target || {};
    const fingerprints = Array.isArray(target.sha256_cert_fingerprints)
      ? target.sha256_cert_fingerprints.map(f => String(f).toUpperCase().replace(/:/g, ''))
      : [];
    out.push({
      relations: Array.isArray(s.relation) ? s.relation.map(String) : [],
      namespace: String(target.namespace || ''),
      packageName: target.package_name ? String(target.package_name) : null,
      sha256Fingerprints: fingerprints,
      url: target.site ? String(target.site) : null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 875. Deep-link scheme enumeration
// ---------------------------------------------------------------------------

const SCHEME_ASSIGN_RE = /["'`]([a-z][a-z0-9+.-]{1,40}):\/\//gi;
const INTENT_URI_RE = /intent:\/\/[^\s"'`]+/gi;

/**
 * Enumerate custom URL schemes that map to web routes.
 *
 * Scans HTML/JS for scheme-like tokens ("myapp://..."), window.location
 * assignments, and Android intent:// URIs. Well-known protocols (http,
 * mailto, tel, javascript, ...) are excluded; the rest are candidate app
 * schemes for the deep-link scope review.
 *
 * @param {string} htmlOrJs HTML or JS source
 * @returns {{
 *   schemes: string[],
 *   deepLinks: string[],
 *   intentUris: string[]
 * }}
 */
export function enumerateDeepLinkSchemes(htmlOrJs = '') {
  const text = String(htmlOrJs || '');
  const schemes = new Set();
  const deepLinks = new Set();
  const intentUris = new Set();

  let m;
  SCHEME_ASSIGN_RE.lastIndex = 0;
  while ((m = SCHEME_ASSIGN_RE.exec(text)) !== null) {
    const scheme = m[1].toLowerCase();
    if (KNOWN_PROTOCOLS.has(scheme)) continue;
    schemes.add(scheme);
    // Capture the full deep link up to the closing quote
    const tail = text.slice(m.index + 1 + m[1].length + 3); // after "scheme://"
    const end = tail.search(/["'`\s<>]/);
    deepLinks.add((m[1] + '://' + (end === -1 ? tail : tail.slice(0, end))).toLowerCase());
  }

  INTENT_URI_RE.lastIndex = 0;
  while ((m = INTENT_URI_RE.exec(text)) !== null) {
    intentUris.add(m[0].replace(/;end$/, ''));
  }

  // intent:// URIs often carry a scheme= parameter naming the app scheme
  for (const uri of intentUris) {
    const sm = uri.match(/[;#]scheme=([a-z][a-z0-9+.-]{1,40})/i);
    if (sm && !KNOWN_PROTOCOLS.has(sm[1].toLowerCase())) schemes.add(sm[1].toLowerCase());
  }

  return {
    schemes: [...schemes].sort(),
    deepLinks: [...deepLinks].sort(),
    intentUris: [...intentUris].sort(),
  };
}

// ---------------------------------------------------------------------------
// 876. Branch.io link mapping
// ---------------------------------------------------------------------------

const BRANCH_KEY_RE = /branch[_-]?key["']?\s*[:=]\s*["'](key_(?:live|test)_[A-Za-z0-9]{20,})["']/gi;

/**
 * Extract Branch deep-link domains from HTML/JS.
 *
 * Finds Branch-hosted link domains (*.app.link and custom short domains via
 * link-domain references), API hosts, and publishable branch_key values so
 * the hunter can enumerate the app's deferred deep-link surface.
 *
 * @param {string} htmlOrJs HTML or JS source
 * @returns {{domains: string[], branchKeys: string[], apiHosts: string[]}}
 */
export function extractBranchDomains(htmlOrJs = '') {
  const text = String(htmlOrJs || '');
  const hosts = new Set();

  // *.app.link dedicated short domains
  for (const h of collectHosts(text, new RegExp(`([a-z0-9-]+\\.app\\.link)`, 'i'))) hosts.add(h);
  // custom link domains declared via Branch SDK config
  const cfgRe = /["']?link[-_]?domain["']?\s*[:=]\s*["']((?:[a-z0-9-]+\.)+[a-z]{2,})["']/gi;
  let m;
  while ((m = cfgRe.exec(text)) !== null) hosts.add(m[1].toLowerCase());

  const branchKeys = new Set();
  BRANCH_KEY_RE.lastIndex = 0;
  while ((m = BRANCH_KEY_RE.exec(text)) !== null) branchKeys.add(m[1]);

  const apiHosts = collectHosts(text, /(api[0-9]?(?:-eu)?\.branch\.io)/i);

  return {
    domains: [...hosts].sort(),
    branchKeys: [...branchKeys],
    apiHosts,
  };
}

// ---------------------------------------------------------------------------
// 877. Firebase Dynamic-Link mapping
// ---------------------------------------------------------------------------

/**
 * Map Firebase Dynamic Link domains from HTML/JS.
 *
 * Finds *.page.link short domains and any custom-domain references tied to
 * dynamic links, plus firebase dynamic-links API usage, so the hunter can
 * map the app's cross-platform link surface.
 *
 * @param {string} htmlOrJs HTML or JS source
 * @returns {{pageLinkDomains: string[], customDomains: string[], apiUsed: boolean}}
 */
export function mapFirebaseDynamicLinkDomains(htmlOrJs = '') {
  const text = String(htmlOrJs || '');
  const pageLinkDomains = collectHosts(text, /([a-z0-9-]+\.page\.link)/i);

  const customDomains = new Set();
  // Custom domains referenced near dynamic-link code or /dynamicLinks paths
  const re = /["'`](https?:\/\/((?:[a-z0-9-]+\.)+[a-z]{2,}))[^"'`]*["'`]\s*[,;}\s]/gi;
  let m;
  const lower = text.toLowerCase();
  while ((m = re.exec(text)) !== null) {
    const url = m[1];
    if (/page\.link$/i.test(m[2])) continue;
    const ctxStart = Math.max(0, m.index - 120);
    const ctx = lower.slice(ctxStart, m.index);
    if (
      ctx.includes('dynamic') ||
      ctx.includes('firebasedynamiclinks') ||
      ctx.includes('firebase')
    ) {
      customDomains.add(m[2].toLowerCase());
    } else if (/dynamiclinks/i.test(url)) {
      customDomains.add(m[2].toLowerCase());
    }
  }

  const apiUsed = /firebasedynamiclinks|firebase\.dynamiclinks|dynamiclinks/i.test(text);

  return {
    pageLinkDomains,
    customDomains: [...customDomains].sort(),
    apiUsed,
  };
}

// ---------------------------------------------------------------------------
// 878. Adjust tracker-URL mining
// ---------------------------------------------------------------------------

const ADJUST_TOKEN_RE = /(?:app\.adjust\.com|adjust\.com)\/([a-z0-9]{6,32})(?![a-z0-9])/gi;

/**
 * Mine Adjust tracker URLs for attribution infrastructure.
 *
 * Extracts Adjust tracker tokens and full tracker URLs from JS/HTML, plus
 * Adjust SDK initialization signals, so the hunter can inventory the
 * attribution pipeline (and its deep-link fallbacks).
 *
 * @param {string} jsSource JS or HTML source
 * @returns {{tokens: string[], trackerUrls: string[], sdkDetected: boolean}}
 */
export function extractAdjustTrackers(jsSource = '') {
  const text = String(jsSource || '');
  const tokens = new Set();
  const trackerUrls = new Set();

  ADJUST_TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = ADJUST_TOKEN_RE.exec(text)) !== null) {
    tokens.add(m[1].toLowerCase());
    const urlM = text
      .slice(Math.max(0, m.index - 60), m.index + m[0].length + 120)
      .match(/https?:\/\/(?:app\.)?adjust\.com\/[a-z0-9]{6,32}[^\s"'`]*/i);
    if (urlM) trackerUrls.add(urlM[0]);
  }

  // Bare tracker URLs without the token regex anchor (e.g. with query params)
  for (const u of text.match(/https?:\/\/(?:app\.)?adjust\.com\/[^\s"'`<>]+/gi) || []) {
    trackerUrls.add(u);
  }

  const sdkDetected = /adjust\s*sdk|adjust\.js|adjustsdk|new\s+adjust|adjust\.init/i.test(text);

  return {
    tokens: [...tokens].sort(),
    trackerUrls: [...trackerUrls].sort(),
    sdkDetected,
  };
}

// ---------------------------------------------------------------------------
// 879. AppsFlyer OneLink mapping
// ---------------------------------------------------------------------------

const ONELINK_HOST_RE = /((?:[a-z0-9-]+\.)+onelink\.me)/gi;

/**
 * Map AppsFlyer OneLink domains from HTML/JS.
 *
 * Finds OneLink short domains (*.onelink.me plus custom OneLink domains
 * declared in config) and AppsFlyer SDK signals, mapping the app's
 * cross-platform attribution entry points.
 *
 * @param {string} htmlOrJs HTML or JS source
 * @returns {{domains: string[], sdkDetected: boolean, webKeySignals: string[]}}
 */
export function mapAppsFlyerOneLinkDomains(htmlOrJs = '') {
  const text = String(htmlOrJs || '');
  const domains = new Set(collectHosts(text, ONELINK_HOST_RE));

  // Custom OneLink domains declared via SDK/web config
  const cfgRe =
    /["']?(?:onelink[-_]?domain|oneLinkURL)["']?\s*[:=]\s*["']((?:[a-z0-9-]+\.)+[a-z]{2,})["']/gi;
  let m;
  while ((m = cfgRe.exec(text)) !== null) domains.add(m[1].toLowerCase());

  const sdkDetected = /appsflyer/i.test(text);

  const webKeySignals = [];
  const keyRe = /appsflyer(?:web)?[_-]?key["']?\s*[:=]\s*["']([A-Za-z0-9-]{8,})["']/gi;
  while ((m = keyRe.exec(text)) !== null) webKeySignals.push('appsflyer_key_present');

  return {
    domains: [...domains].sort(),
    sdkDetected,
    webKeySignals: [...new Set(webKeySignals)],
  };
}

// ---------------------------------------------------------------------------
// 880. Kochava tracker extraction
// ---------------------------------------------------------------------------

/**
 * Extract Kochava tracker URLs from HTML/JS.
 *
 * Finds Kochava attribution hosts (control.kochava.com, kochava SDK hosts,
 * kochava.net pixels) and Kochava SDK initialization signals, completing the
 * attribution-infrastructure inventory for the authorized hunt.
 *
 * @param {string} htmlOrJs HTML or JS source
 * @returns {{hosts: string[], trackerUrls: string[], sdkDetected: boolean}}
 */
export function extractKochavaTrackers(htmlOrJs = '') {
  const text = String(htmlOrJs || '');
  const hosts = collectHosts(text, /((?:[a-z0-9-]+\.)?kochava\.(?:com|net|io))/i);
  const trackerUrls = new Set();

  for (const u of text.match(/https?:\/\/(?:[a-z0-9-]+\.)?kochava\.(?:com|net|io)[^\s"'`<>]*/gi) ||
    []) {
    trackerUrls.add(u);
  }

  const sdkDetected = /kochava/i.test(text);

  return {
    hosts: hosts.sort(),
    trackerUrls: [...trackerUrls].sort(),
    sdkDetected,
  };
}

// ---------------------------------------------------------------------------
// Aggregate summary
// ---------------------------------------------------------------------------

/**
 * Run the full app-link mapping pass over a set of sources.
 *
 * Convenience aggregator: feed each source type once and receive the
 * combined inventory plus a one-line scope note per surface.
 *
 * @param {{
 *   manifestJson?: string|object,
 *   jsSource?: string,
 *   html?: string,
 *   aasaJson?: string|object,
 *   assetlinksJson?: string|object
 * }} sources
 * @returns {object} per-engine results plus a `notes` summary
 */
export function mapAppLinkSurface(sources = {}) {
  const {
    manifestJson = null,
    jsSource = '',
    html = '',
    aasaJson = null,
    assetlinksJson = null,
  } = sources || {};

  const pwa = mapPwaInstallRoutes(manifestJson, jsSource);
  const banners = extractSmartAppBannerUrls(html);
  const universal = mapUniversalLinks(aasaJson);
  const android = mapAndroidAppLinks(assetlinksJson);
  const schemes = enumerateDeepLinkSchemes(`${html}\n${jsSource}`);
  const branch = extractBranchDomains(`${html}\n${jsSource}`);
  const firebase = mapFirebaseDynamicLinkDomains(`${html}\n${jsSource}`);
  const adjust = extractAdjustTrackers(jsSource);
  const appsflyer = mapAppsFlyerOneLinkDomains(`${html}\n${jsSource}`);
  const kochava = extractKochavaTrackers(`${html}\n${jsSource}`);

  const notes = [];
  if (pwa.entryRoutes.length) notes.push(`PWA entry routes: ${pwa.entryRoutes.join(', ')}`);
  if (banners.apple || banners.googlePlay)
    notes.push('Native app banners link web pages to store apps');
  if (universal.length) notes.push(`${universal.length} iOS universal-link app claim(s) found`);
  if (android.length) notes.push(`${android.length} Android app-link statement(s) found`);
  if (schemes.schemes.length) notes.push(`Custom schemes: ${schemes.schemes.join(', ')}`);
  const attrHosts = [...branch.domains, ...firebase.pageLinkDomains, ...kochava.hosts];
  if (attrHosts.length) notes.push(`Attribution link hosts: ${[...new Set(attrHosts)].join(', ')}`);

  return {
    pwa,
    banners,
    universal,
    android,
    schemes,
    branch,
    firebase,
    adjust,
    appsflyer,
    kochava,
    notes,
  };
}

export const APP_LINK_MAPPER = {
  mapPwaInstallRoutes,
  extractSmartAppBannerUrls,
  mapUniversalLinks,
  mapAndroidAppLinks,
  enumerateDeepLinkSchemes,
  extractBranchDomains,
  mapFirebaseDynamicLinkDomains,
  extractAdjustTrackers,
  mapAppsFlyerOneLinkDomains,
  extractKochavaTrackers,
  mapAppLinkSurface,
};
export default APP_LINK_MAPPER;
