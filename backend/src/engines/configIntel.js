/**
 * configIntel.js — Client-side configuration intelligence for authorized targets.
 *
 * Web applications ship their operational configuration in client code:
 * feature-flag keys, remote-config endpoint URLs, error-monitoring DSNs,
 * analytics endpoints and A/B-experiment definitions. For an authorized
 * bug-bounty hunt, mining those artifacts from the target's own JavaScript
 * and HTML is legitimate reconnaissance: it maps gated features, backend
 * hosts, and data-collection infrastructure without touching anything else.
 *
 * Ideas covered:
 *  - 711 Feature-flag key enumeration (LaunchDarkly, Unleash, ConfigCat,
 *        Split, Statsig, Flagsmith, GrowthBook flag keys)
 *  - 712 Remote config-endpoint discovery (remote-config JSON endpoints that
 *        list backend hosts)
 *  - 713 Error-monitoring DSN discovery (Sentry, Bugsnag, Datadog, Rollbar,
 *        Airbrake project identifiers and hosts)
 *  - 714 Analytics endpoint cataloging (GA4, Segment, Mixpanel, Amplitude,
 *        PostHog, Plausible, Hotjar data-collection endpoints)
 *  - 715 A/B testing variant mapping (Optimizely, VWO, Google Optimize,
 *        GrowthBook, AB Tasty experiments and their variants)
 *
 * Defensive framing only: every function parses text the target chose to
 * publish (its own JS/HTML). They never probe, inject, or exfiltrate.
 * No exploit payloads are produced here.
 */

// ---------------------------------------------------------------------------
// Idea 711 — Feature-flag key enumeration
// ---------------------------------------------------------------------------

/** Feature-flag SDKs and the call patterns that reference a flag key. */
export const FLAG_SDK_PATTERNS = [
  { sdk: 'launchdarkly', regex: /(?:ldClient|launchdarkly)[\w.$]*\.(?:variation|allFlags|variationDetail|track)\(\s*['"`]([^'"`]{1,120})['"`]/gi },
  { sdk: 'launchdarkly-react', regex: /useFlags\(\s*\)|\basyncWithLDProvider\b|\bwithLDProvider\b/gi, keyed: false },
  { sdk: 'unleash', regex: /(?:unleashClient|unleash)[\w.$]*\.(?:isEnabled|getVariant|toggle)\(\s*['"`]([^'"`]{1,120})['"`]/gi },
  { sdk: 'configcat', regex: /(?:configCatClient|configcat)[\w.$]*\.(?:getValue|getValueAsync)\(\s*['"`]([^'"`]{1,120})['"`]/gi },
  { sdk: 'split', regex: /(?:splitClient|splitio)[\w.$]*\.(?:getTreatment|getTreatments)\(\s*['"`]([^'"`]{1,120})['"`]/gi },
  { sdk: 'statsig', regex: /(?:statsig|Statsig)[\w.$]*\.(?:checkGate|getConfig|getExperiment)\(\s*['"`]([^'"`]{1,120})['"`]/gi },
  { sdk: 'flagsmith', regex: /(?:flagsmith)[\w.$]*\.(?:hasFeature|getValue)\(\s*['"`]([^'"`]{1,120})['"`]/gi },
  { sdk: 'growthbook', regex: /(?:growthbook|gb)[\w.$]*\.(?:isOn|getFeatureValue|evalFeature)\(\s*['"`]([^'"`]{1,120})['"`]/gi },
  { sdk: 'generic-flag', regex: /(?:featureFlags|feature_flags|FLAGS|flagStore)[\w.$]*\[['"`]([^'"`]{1,120})['"`]\]/gi },
  { sdk: 'generic-flag', regex: /isFeatureEnabled\(\s*['"`]([^'"`]{1,120})['"`]\s*\)/gi },
];

/**
 * Enumerate feature-flag keys referenced through client flag SDKs.
 * Maps which gated features the client can toggle — a route map of
 * functionality hidden behind flags.
 * @param {string} jsText client JavaScript text
 * @returns {Array} flag records { key, sdk, source }
 */
export function enumerateFlagKeys(jsText) {
  const out = [];
  const seen = new Set();
  const text = String(jsText || '');
  for (const { sdk, regex } of FLAG_SDK_PATTERNS) {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(text)) !== null) {
      const key = (m[1] || '').trim();
      if (!key || seen.has(sdk + '|' + key)) continue;
      seen.add(sdk + '|' + key);
      out.push({ key, sdk, source: 'client-sdk-call' });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Idea 712 — Remote config-endpoint discovery
// ---------------------------------------------------------------------------

/** Known remote-config URL shapes, keyed by provider. */
export const REMOTE_CONFIG_PATTERNS = [
  { provider: 'firebase-remote-config', regex: /https?:\/\/[^\s'"`]*firebaseremoteconfig\.googleapis\.com[^\s'"`]*/gi },
  { provider: 'firebase-remote-config', regex: /https?:\/\/[^\s'"`]*\/v1\/projects\/[^\s'"`]*\/namespaces\/[^\s'"`]*:fetch/gi },
  { provider: 'launchdarkly-stream', regex: /https?:\/\/[^\s'"`]*(?:clientstream|events)\.launchdarkly\.com[^\s'"`]*/gi },
  { provider: 'launchdarkly-flags', regex: /https?:\/\/[^\s'"`]*app\.launchdarkly\.com\/sdk\/flags\/[A-Za-z0-9_-]+/gi },
  { provider: 'unleash-api', regex: /https?:\/\/[^\s'"`]*\/api\/client\/features[^\s'"`]*/gi },
  { provider: 'configcat-cdn', regex: /https?:\/\/[^\s'"`]*cdn\.configcat\.com[^\s'"`]*/gi },
  { provider: 'split-api', regex: /https?:\/\/[^\s'"`]*sdk\.split\.io[^\s'"`]*/gi },
  { provider: 'flagsmith-api', regex: /https?:\/\/[^\s'"`]*\/api\/v1\/flags\/[^\s'"`]*/gi },
  { provider: 'statsig-config', regex: /https?:\/\/[^\s'"`]*statsigapi\.net[^\s'"`]*/gi },
  { provider: 'growthbook-cdn', regex: /https?:\/\/[^\s'"`]*cdn\.growthbook\.io[^\s'"`]*/gi },
  { provider: 'well-known-remote-config', regex: /(\/?\.well-known\/remote-config(?:\.json)?)/gi },
  { provider: 'generic-config-json', regex: /["'`]([^\s'"`]*\/(?:remote-?config|app-?config|client-?config)(?:\.json)?)["'`]/gi },
];

/**
 * Find remote-config JSON endpoints referenced in client code/HTML.
 * Remote-config payloads frequently enumerate backend hosts and gated
 * rollout metadata, so their endpoints are valuable recon targets.
 * @param {string} jsText client JavaScript text
 * @param {string} [htmlText] page HTML text
 * @returns {Array} endpoint records { url, provider, source }
 */
export function discoverRemoteConfigEndpoints(jsText, htmlText = '') {
  const out = [];
  const seen = new Set();
  const combined = String(jsText || '') + '\n' + String(htmlText || '');
  for (const { provider, regex } of REMOTE_CONFIG_PATTERNS) {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(combined)) !== null) {
      const url = (m[1] !== undefined ? m[1] : m[0]).replace(/^["'`]|["'`]$/g, '').trim();
      if (!url || seen.has(provider + '|' + url)) continue;
      seen.add(provider + '|' + url);
      out.push({ url, provider, source: 'client-artifact' });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Idea 713 — Error-monitoring DSN discovery
// ---------------------------------------------------------------------------

/** Error-monitoring credential shapes. */
export const ERROR_MONITOR_PATTERNS = [
  {
    provider: 'sentry',
    regex: /https:\/\/[0-9a-fA-F]{16,64}@([A-Za-z0-9.-]+)\/(\d{1,10})/g,
    parse: (m) => ({ dsn: m[0], host: m[1], projectId: m[2] }),
  },
  {
    provider: 'sentry-init',
    regex: /Sentry\.init\(\s*\{[^}]*?dsn\s*:\s*["'`]([^"'`]+)["'`]/g,
    parse: (m) => ({ dsn: m[1] }),
  },
  {
    provider: 'bugsnag',
    regex: /Bugsnag\.start\(\s*\{[^}]*?apiKey\s*:\s*["'`]([0-9a-fA-F]{32})["'`]/g,
    parse: (m) => ({ apiKey: m[1] }),
  },
  {
    provider: 'datadog-rum',
    regex: /(?:applicationId|clientToken)\s*:\s*["'`]([A-Za-z0-9_-]{20,})["'`]/g,
    parse: (m, m2) => ({ [m.includes('applicationId') ? 'applicationId' : 'clientToken']: m2 || m[1] }),
  },
  {
    provider: 'datadog-logs',
    regex: /browserLogs?[^\n]{0,200}?clientToken\s*:\s*["'`]([A-Za-z0-9_-]{20,})["'`]/g,
    parse: (m) => ({ clientToken: m[1] }),
  },
  {
    provider: 'rollbar',
    regex: /accessToken\s*:\s*["'`]([0-9a-fA-F]{32})["'`][^}]{0,200}?environment\s*:\s*["'`]([^"'`]+)["'`]/g,
    parse: (m) => ({ accessToken: m[1], environment: m[2] }),
  },
  {
    provider: 'airbrake',
    regex: /projectId\s*:\s*(\d{1,10})[^}]{0,200}?projectKey\s*:\s*["'`]([0-9a-fA-F]{24,})["'`]/g,
    parse: (m) => ({ projectId: m[1], projectKey: m[2] }),
  },
];

/**
 * Extract error-monitoring DSNs/keys from client code.
 * A DSN discloses the monitoring host and the target's project identifier —
 * useful for scoping the authorized asset inventory. These are the target's
 * own published client keys; no authentication material is derived.
 * @param {string} jsText client JavaScript text
 * @returns {Array} findings { provider, detail }
 */
export function extractErrorMonitoringDsns(jsText) {
  const out = [];
  const seen = new Set();
  const text = String(jsText || '');
  for (const { provider, regex, parse } of ERROR_MONITOR_PATTERNS) {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(text)) !== null) {
      let detail;
      try {
        detail = parse(m);
      } catch {
        continue;
      }
      const sig = provider + '|' + JSON.stringify(detail);
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push({ provider, detail });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Idea 714 — Analytics endpoint cataloging
// ---------------------------------------------------------------------------

/** Analytics/data-collection endpoint shapes. */
export const ANALYTICS_PATTERNS = [
  { provider: 'google-analytics-4', regex: /https?:\/\/[^\s'"`]*google-analytics\.com\/(?:g\/)?collect[^\s'"`]*/gi },
  { provider: 'google-tag-manager', regex: /https?:\/\/[^\s'"`]*googletagmanager\.com\/gtm\.js\?id=(GTM-[A-Z0-9]+)/gi },
  { provider: 'segment', regex: /https?:\/\/cdn\.segment\.com\/analytics\.js\/v1\/([A-Za-z0-9]+)\/analytics\.min\.js/gi },
  { provider: 'mixpanel', regex: /https?:\/\/cdn\.(?:mxpnl|mixpanel)\.com[^\s'"`]*/gi },
  { provider: 'mixpanel', regex: /\bmixpanel\.(?:init|track|identify)\s*\(/gi },
  { provider: 'amplitude', regex: /https?:\/\/cdn\.amplitude\.com[^\s'"`]*/gi },
  { provider: 'posthog', regex: /https?:\/\/[^\s'"`]*posthog[^\s'"`]*/gi },
  { provider: 'plausible', regex: /https?:\/\/[^\s'"`]*plausible\.io\/js[^\s'"`]*/gi },
  { provider: 'hotjar', regex: /https?:\/\/[^\s'"`]*hotjar\.com\/c\/hotjar-(\d+)\.js/gi },
  { provider: 'fullstory', regex: /https?:\/\/[^\s'"`]*fullstory\.com\/s\/fs\.js/gi },
  { provider: 'logrocket', regex: /https?:\/\/cdn\.logrocket\.io[^\s'"`]*/gi },
  { provider: 'clarity', regex: /https?:\/\/[^\s'"`]*clarity\.ms\/tag\/([A-Za-z0-9]+)/gi },
  { provider: 'matomo', regex: /https?:\/\/[^\s'"`]*(?:matomo|piwik)[^\s'"`]*/gi },
  { provider: 'heap', regex: /https?:\/\/cdn\.heapanalytics\.com[^\s'"`]*/gi },
  { provider: 'snowplow', regex: /https?:\/\/[^\s'"`]*snowplow[^\s'"`]*/gi },
];

/**
 * Catalog analytics/data-collection endpoints embedded in client code.
 * Maps the target's data-collection infrastructure: which vendors receive
 * telemetry, which collection hosts are used, and the associated IDs.
 * @param {string} jsText client JavaScript text
 * @param {string} [htmlText] page HTML text
 * @returns {Array} records { endpoint, provider, source }
 */
export function catalogAnalyticsEndpoints(jsText, htmlText = '') {
  const out = [];
  const seen = new Set();
  const combined = String(jsText || '') + '\n' + String(htmlText || '');
  for (const { provider, regex } of ANALYTICS_PATTERNS) {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(combined)) !== null) {
      const endpoint = m[0].replace(/^["'`]|["'`]$/g, '').trim();
      if (!endpoint || seen.has(provider + '|' + endpoint)) continue;
      seen.add(provider + '|' + endpoint);
      out.push({ endpoint, provider, source: 'client-artifact' });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Idea 715 — A/B testing variant mapping
// ---------------------------------------------------------------------------

/** Experiment/variant declaration shapes. */
export const EXPERIMENT_PATTERNS = [
  { sdk: 'optimizely', regex: /optimizely\.activate\(\s*["'`]([^"'`]{1,120})["'`]/gi },
  { sdk: 'optimizely', regex: /createInstance\(\s*\{[^}]{0,400}?experimentId\s*:\s*["'`]([^"'`]{1,120})["'`]/gi },
  { sdk: 'vwo', regex: /_vwo_code[^\n]{0,120}?account_id\s*:\s*["'`](\d+)["'`]/gi, variant: false },
  { sdk: 'vwo', regex: /VWO\.(?:push|track)\(\s*\[["'`]track\.([^"'`\]]{1,120})["'`]/gi },
  { sdk: 'google-optimize', regex: /optimize\.get\(\s*["'`]([^"'`]{1,60})["'`]\s*\)/gi },
  { sdk: 'growthbook-experiment', regex: /useExperiment\(\s*\{\s*key\s*:\s*["'`]([^"'`]{1,120})["'`]/gi },
  { sdk: 'growthbook-experiment', regex: /run\(\s*\{\s*key\s*:\s*["'`]([^"'`]{1,120})["'`]\s*,?\s*variations\s*:\s*(\[[^\]]{1,400}\])/gi },
  { sdk: 'split-treatment', regex: /getTreatment(?:sWithConfig)?\(\s*["'`]([^"'`]{1,120})["'`]/gi },
  { sdk: 'ab-tasty', regex: /ABTastyClickTracking\(\s*["'`]([^"'`]{1,120})["'`]/gi },
  { sdk: 'custom-experiment', regex: /experiments?\s*:\s*\{([^}]{1,800})\}/gi },
];

/**
 * Map A/B experiments and their variants from client testing SDKs.
 * Experiment variants often gate hidden routes, alternate layouts, or
 * pre-release features — mapping them completes the feature surface.
 * @param {string} jsText client JavaScript text
 * @returns {Array} experiments { name, sdk, variants, source }
 */
export function mapExperimentVariants(jsText) {
  const out = [];
  const seen = new Set();
  const text = String(jsText || '');
  for (const { sdk, regex } of EXPERIMENT_PATTERNS) {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(text)) !== null) {
      const name = (m[1] || '').trim();
      if (!name || seen.has(sdk + '|' + name)) continue;
      seen.add(sdk + '|' + name);
      const variants = [];
      if (m[2]) {
        // GrowthBook-style variations array — parse string/number literals.
        const lit = m[2].match(/["'`]([^"'`]{1,80})["'`]/g) || [];
        for (const l of lit) variants.push(l.replace(/^["'`]|["'`]$/g, ''));
      }
      out.push({ name, sdk, variants, source: 'client-sdk-call' });
    }
  }
  return out;
}

/**
 * Summarize a full config-intel pass over the target's client artifacts.
 * Convenience aggregator the hunt loop can call on observed JS/HTML.
 * @param {string} jsText client JavaScript text
 * @param {string} [htmlText] page HTML text
 * @returns {{flagKeys:Array, remoteConfigEndpoints:Array, errorMonitoring:Array, analyticsEndpoints:Array, experiments:Array}}
 */
export function summarizeConfigIntel(jsText, htmlText = '') {
  return {
    flagKeys: enumerateFlagKeys(jsText),
    remoteConfigEndpoints: discoverRemoteConfigEndpoints(jsText, htmlText),
    errorMonitoring: extractErrorMonitoringDsns(jsText),
    analyticsEndpoints: catalogAnalyticsEndpoints(jsText, htmlText),
    experiments: mapExperimentVariants(jsText),
  };
}

// Keep the legacy default-export shape used by other engines.
export default {
  enumerateFlagKeys,
  discoverRemoteConfigEndpoints,
  extractErrorMonitoringDsns,
  catalogAnalyticsEndpoints,
  mapExperimentVariants,
  summarizeConfigIntel,
  FLAG_SDK_PATTERNS,
  REMOTE_CONFIG_PATTERNS,
  ERROR_MONITOR_PATTERNS,
  ANALYTICS_PATTERNS,
  EXPERIMENT_PATTERNS,
};
