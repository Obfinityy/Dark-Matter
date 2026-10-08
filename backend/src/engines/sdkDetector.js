/**
 * sdkDetector.js — Bundled third-party SDK fingerprinting.
 *
 * Passive signature matching over bundled JavaScript (and HTML config
 * snippets) to identify third-party API client SDKs and related services:
 *  - idea 708: detect bundled API client SDKs (Stripe, Twilio, AWS, Firebase,
 *    Sentry, Segment, …) via distinctive globals, banner comments, error
 *    strings and endpoint fragments; each hit maps to the third-party
 *    endpoints that SDK is known to call
 *  - idea 709: read SDK version pins (`VERSION` constants, SDK banners,
 *    `name@version` package references) and flag pins older than a built-in
 *    known-current table (semver compare)
 *  - idea 710: discover feature-flag service endpoints (LaunchDarkly,
 *    Split, Statsig, Optimizely, PostHog) from client keys, streaming hosts
 *    and poll URLs embedded in configs
 *
 * Defensive use: authorized asset discovery — learning which third-party
 * services a target's front-end integrates with so their configuration and
 * exposure can be reviewed.
 */

/**
 * @typedef {object} SdkSignature
 * @property {string} name - SDK display name
 * @property {string} vendor - owning company
 * @property {string[]} markers - distinctive literals that identify the SDK
 * @property {string[]} endpoints - third-party hosts the SDK is known to call
 * @property {string} category - payments | comms | cloud | analytics | error | auth | flags | other
 */

/** @type {SdkSignature[]} */
const SDK_SIGNATURES = [
  {
    name: 'Stripe.js',
    vendor: 'Stripe',
    category: 'payments',
    markers: ['js.stripe.com', 'Stripe.setPublishableKey', '__stripe-js__', 'stripe-js/pure'],
    endpoints: [
      'https://api.stripe.com',
      'https://js.stripe.com',
      'https://m.stripe.com',
      'https://r.stripe.com',
    ],
  },
  {
    name: 'Twilio SDK',
    vendor: 'Twilio',
    category: 'comms',
    markers: ['twilio', 'Twilio.Device', '@twilio/voice-sdk', 'chunderw-vpc-gll.twilio.com'],
    endpoints: ['https://api.twilio.com', 'https://eventgw.twilio.com'],
  },
  {
    name: 'AWS Amplify / aws-sdk',
    vendor: 'Amazon Web Services',
    category: 'cloud',
    markers: ['aws-amplify', 'AWSCognito', 'amazonaws.com', 'aws-sdk-js', 'X-Amz-Target'],
    endpoints: ['https://cognito-idp.', 'https://cognito-identity.', '.amazonaws.com'],
  },
  {
    name: 'Firebase JS SDK',
    vendor: 'Google',
    category: 'cloud',
    markers: ['firebase-app', 'firebasejs', 'FIREBASE_', 'firestore.googleapis.com'],
    endpoints: [
      'https://firestore.googleapis.com',
      'https://identitytoolkit.googleapis.com',
      'https://firebaseinstallations.googleapis.com',
      'https://firebaseremoteconfig.googleapis.com',
    ],
  },
  {
    name: 'Sentry browser SDK',
    vendor: 'Sentry',
    category: 'error',
    markers: ['@sentry/browser', 'sentry.javascript', 'Sentry.init', '__SENTRY__'],
    endpoints: ['https://*.ingest.sentry.io', 'https://*.ingest.us.sentry.io'],
  },
  {
    name: 'Segment Analytics.js',
    vendor: 'Segment',
    category: 'analytics',
    markers: ['analytics.js', 'segment.com/analytics', 'ajs_uid', 'Segment.io'],
    endpoints: ['https://api.segment.io', 'https://cdn.segment.com'],
  },
  {
    name: 'Auth0 SPA SDK',
    vendor: 'Auth0',
    category: 'auth',
    markers: ['auth0-spa-js', '@auth0/auth0-spa-js', 'auth0.com', 'createAuth0Client'],
    endpoints: ['https://*.auth0.com', 'https://*.us.auth0.com'],
  },
  {
    name: 'Algolia search client',
    vendor: 'Algolia',
    category: 'other',
    markers: ['algoliasearch', 'algolianet.com', 'X-Algolia-API-Key'],
    endpoints: ['https://*.algolianet.com', 'https://*.algolia.net'],
  },
  {
    name: 'Pusher Channels JS',
    vendor: 'Pusher',
    category: 'comms',
    markers: ['pusher-js', 'Pusher.logToConsole', 'ws.pusherapp.com'],
    endpoints: ['https://ws.pusherapp.com', 'https://sockjs.pusher.com'],
  },
  {
    name: 'Intercom messenger',
    vendor: 'Intercom',
    category: 'comms',
    markers: ['intercom', 'widget.intercom.io', 'Intercom("boot"'],
    endpoints: ['https://api-iam.intercom.io', 'https://widget.intercom.io'],
  },
  {
    name: 'LaunchDarkly JS client',
    vendor: 'LaunchDarkly',
    category: 'flags',
    markers: [
      'launchdarkly',
      'ldclient-js',
      'app.launchdarkly.com',
      'clientstream.launchdarkly.com',
    ],
    endpoints: [
      'https://app.launchdarkly.com',
      'https://clientstream.launchdarkly.com',
      'https://events.launchdarkly.com',
    ],
  },
  {
    name: 'Split.io JS client',
    vendor: 'Split',
    category: 'flags',
    markers: ['splitio', '@splitsoftware/splitio', 'sdk.split.io', 'streaming.split.io'],
    endpoints: ['https://sdk.split.io', 'https://streaming.split.io', 'https://events.split.io'],
  },
  {
    name: 'Statsig JS client',
    vendor: 'Statsig',
    category: 'flags',
    markers: ['statsig', 'statsig-js', 'statsigapi.net', 'featuregates.statsigapi.net'],
    endpoints: ['https://statsigapi.net', 'https://featuregates.statsigapi.net'],
  },
  {
    name: 'Optimizely Web SDK',
    vendor: 'Optimizely',
    category: 'flags',
    markers: ['optimizely', 'cdn.optimizely.com', 'optimizelyClient'],
    endpoints: ['https://cdn.optimizely.com', 'https://logx.optimizely.com'],
  },
  {
    name: 'PostHog JS',
    vendor: 'PostHog',
    category: 'analytics',
    markers: ['posthog', 'posthog-js', 'app.posthog.com', 'us.i.posthog.com'],
    endpoints: ['https://app.posthog.com', 'https://us.i.posthog.com', 'https://eu.i.posthog.com'],
  },
];

/**
 * Detect bundled third-party SDKs by signature markers.
 * Requires at least two distinct markers (or one very distinctive one) to
 * reduce false positives on common words.
 *
 * Idea 708 — API client SDK detection.
 *
 * @param {string} js - bundled JS or HTML text
 * @returns {Array<{name:string,vendor:string,category:string,markersFound:string[],confidence:'high'|'medium',knownEndpoints:string[]}>}
 */
export function detectSdk(js) {
  const src = String(js || '');
  const lowered = src.toLowerCase();
  const hits = [];
  for (const sig of SDK_SIGNATURES) {
    const found = sig.markers.filter(m => lowered.includes(m.toLowerCase()));
    if (found.length === 0) continue;
    // Distinctive host markers (contain a dot + tld-ish) count double.
    const weight = found.reduce((n, m) => n + (/[a-z0-9]\.[a-z]{2,}/i.test(m) ? 2 : 1), 0);
    if (found.length >= 2 || weight >= 2) {
      hits.push({
        name: sig.name,
        vendor: sig.vendor,
        category: sig.category,
        markersFound: found,
        confidence: found.length >= 3 || weight >= 4 ? 'high' : 'medium',
        knownEndpoints: sig.endpoints,
      });
    }
  }
  return hits.sort((a, b) => b.markersFound.length - a.markersFound.length);
}

/** Version-pin patterns: `VERSION = "1.2.3"`, banners, `name@1.2.3`. */
const VERSION_PATTERNS = [
  /(?:VERSION|version|__VERSION__|SDK_VERSION)\s*[:=]\s*["'](\d+\.\d+\.\d+(?:[-+][\w.]+)?)["']/g,
  /\/\*!?\s*([a-z][\w@/-]*?)\s+v?(\d+\.\d+\.\d+(?:[-+][\w.]+)?)/gi,
  /([a-z][\w/-]*?)@(\d+\.\d+\.\d+(?:[-+][\w.]+)?)/g,
  /"version"\s*:\s*"(\d+\.\d+\.\d+(?:[-+][\w.]+)?)"/g,
];

/**
 * Extract SDK/library version pins from bundle text.
 *
 * Idea 709 — SDK version pinning analysis.
 *
 * @param {string} js
 * @returns {Array<{library:string,version:string,source:string}>}
 */
export function extractSdkVersions(js) {
  const src = String(js || '');
  const pins = [];
  const seen = new Set();
  // Named constant pins
  for (const m of src.matchAll(VERSION_PATTERNS[0])) {
    const key = `const:${m[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      pins.push({ library: inferLibrary(src, m.index), version: m[1], source: 'version-constant' });
    }
  }
  // Banner comments: /*! stripe-js v3.4.1 */
  for (const m of src.matchAll(VERSION_PATTERNS[1])) {
    const name = m[1].replace(/^\/\*!?\s*/, '').trim();
    const key = `banner:${name}@${m[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      pins.push({ library: name || inferLibrary(src, m.index), version: m[2], source: 'banner' });
    }
  }
  // name@version package references
  for (const m of src.matchAll(VERSION_PATTERNS[2])) {
    const key = `pkg:${m[1]}@${m[2]}`;
    if (!seen.has(key) && m[1].length <= 60) {
      seen.add(key);
      pins.push({ library: m[1], version: m[2], source: 'package-ref' });
    }
  }
  return pins;
}

/** Guess the owning library from nearby SDK markers. */
function inferLibrary(src, index) {
  const window = src.slice(Math.max(0, index - 400), index).toLowerCase();
  for (const sig of SDK_SIGNATURES) {
    if (sig.markers.some(m => window.includes(m.toLowerCase()))) return sig.name;
  }
  return 'unknown';
}

/**
 * Compare two semver-ish version strings.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} -1 | 0 | 1
 */
export function compareVersions(a, b) {
  const pa = String(a)
    .split(/[.+_-]/)
    .map(x => (isNaN(x) ? x : Number(x)));
  const pb = String(b)
    .split(/[.+_-]/)
    .map(x => (isNaN(x) ? x : Number(x)));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x < y ? -1 : 1;
    return String(x) < String(y) ? -1 : 1;
  }
  return 0;
}

/**
 * Known-current versions as shipped at the time this module was authored
 * (October 2026). A pin older than the table entry is flagged; the table
 * itself is the only moving part and should be refreshed periodically.
 */
export const KNOWN_CURRENT_SDKS = {
  'Stripe.js': '4.2.0',
  'Firebase JS SDK': '11.0.0',
  'Sentry browser SDK': '9.0.0',
  'AWS Amplify / aws-sdk': '6.4.0',
  'Auth0 SPA SDK': '2.4.0',
  'Segment Analytics.js': '2.20.0',
  'LaunchDarkly JS client': '4.0.0',
  'Twilio SDK': '2.12.0',
};

/**
 * Flag outdated SDK pins against the known-current table.
 *
 * @param {Array<{library:string,version:string,source:string}>} pins
 * @returns {Array<{library:string,pinned:string,latestKnown:string,status:'outdated'|'current'|'unknown-library'}>}
 */
export function analyzeSdkFreshness(pins) {
  return pins.map(p => {
    const latest = KNOWN_CURRENT_SDKS[p.library];
    if (!latest)
      return {
        library: p.library,
        pinned: p.version,
        latestKnown: null,
        status: 'unknown-library',
      };
    const cmp = compareVersions(p.version, latest);
    return {
      library: p.library,
      pinned: p.version,
      latestKnown: latest,
      status: cmp < 0 ? 'outdated' : 'current',
    };
  });
}

/**
 * Discover feature-flag service endpoints from configs and bundles:
 * client-side SDK keys, streaming hosts and event-ingest URLs.
 *
 * Idea 710 — feature-flag endpoint discovery.
 *
 * @param {string} text - JS bundle or HTML/config text
 * @returns {Array<{service:string,kind:'client-key'|'streaming'|'events'|'sdk-host',value:string}>}
 */
export function findFeatureFlagEndpoints(text) {
  const src = String(text || '');
  const findings = [];
  const seen = new Set();
  const push = (service, kind, value) => {
    const key = `${service}|${kind}|${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ service, kind, value });
  };

  const FLAG_SERVICES = [
    {
      service: 'LaunchDarkly',
      keyRes: [
        /["']?(?:ld[_-]?client[_-]?key|launchdarkly[_-]?client[_-]?key|LD_CLIENT_KEY)["']?\s*[:=]\s*["']([A-Za-z0-9_-]{16,})["']/gi,
        /\b(client|mob)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g,
      ],
      hosts: ['clientstream.launchdarkly.com', 'events.launchdarkly.com', 'app.launchdarkly.com'],
    },
    {
      service: 'Split',
      keyRes: [
        /["']?(?:split[_-]?auth[_-]?key|splitio[_-]?key|SPLIT_API_KEY)["']?\s*[:=]\s*["']([A-Za-z0-9._-]{16,})["']/gi,
      ],
      hosts: ['sdk.split.io', 'streaming.split.io', 'events.split.io'],
    },
    {
      service: 'Statsig',
      keyRes: [
        /["']?(?:statsig[_-]?(?:client[_-]?)?key|STATSIG_CLIENT_KEY)["']?\s*[:=]\s*["']([A-Za-z0-9_-]{16,})["']/gi,
        /\bclient-[A-Za-z0-9]{20,}\b/g,
      ],
      hosts: ['statsigapi.net', 'featuregates.statsigapi.net'],
    },
    {
      service: 'Optimizely',
      keyRes: [
        /["']?(?:optimizely[_-]?sdk[_-]?key|OPTIMIZELY_SDK_KEY)["']?\s*[:=]\s*["']([A-Za-z0-9_-]{16,})["']/gi,
      ],
      hosts: ['cdn.optimizely.com', 'logx.optimizely.com'],
    },
    {
      service: 'PostHog',
      keyRes: [
        /["']?(?:posthog[_-]?(?:api[_-]?)?key|POSTHOG_KEY)["']?\s*[:=]\s*["'](phc_[A-Za-z0-9]{20,})["']/gi,
      ],
      hosts: ['app.posthog.com', 'us.i.posthog.com', 'eu.i.posthog.com'],
    },
  ];

  for (const svc of FLAG_SERVICES) {
    for (const re of svc.keyRes) {
      for (const m of src.matchAll(re)) {
        const val = m[1] || m[0];
        push(svc.service, 'client-key', maskKey(val));
      }
    }
    for (const host of svc.hosts) {
      if (src.toLowerCase().includes(host)) {
        const kind = host.includes('stream')
          ? 'streaming'
          : host.includes('event') || host.includes('logx')
            ? 'events'
            : 'sdk-host';
        push(svc.service, kind, `https://${host}`);
      }
    }
  }
  return findings;
}

/** Mask all but the last 4 chars of a client key (never log full secrets). */
function maskKey(key) {
  const k = String(key);
  if (k.length <= 8) return '****';
  return `${'*'.repeat(Math.min(k.length - 4, 12))}${k.slice(-4)}`;
}

/**
 * One-call SDK audit: detection + version pins + freshness + flag services.
 *
 * @param {string} js
 * @returns {object}
 */
export function auditBundledSdks(js) {
  const detected = detectSdk(js);
  const versions = extractSdkVersions(js);
  const freshness = analyzeSdkFreshness(versions);
  return {
    detected,
    versions,
    freshness,
    outdatedCount: freshness.filter(f => f.status === 'outdated').length,
    flagServices: findFeatureFlagEndpoints(js),
    thirdPartyHosts: [...new Set(detected.flatMap(d => d.knownEndpoints))],
  };
}
