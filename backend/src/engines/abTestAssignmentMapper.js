/**
 * abTestAssignmentMapper.js — Client-side A/B assignment mapping.
 *
 * Idea 00901: map client-side experiment assignment logic to find control
 * vs variant routes on an authorized target.
 *
 * No network calls: the module scans page JavaScript (bundled source,
 * inline scripts, or fetched page text supplied by the operator) for
 * feature-flag / experimentation SDK usage and custom bucketing logic,
 * then correlates control and variant branches with URL routes so a
 * bug-bounty hunter can map every reachable experiment route before
 * crawling. Defensive surface-mapping of the engagement's own target.
 */

const VENDOR_SIGNATURES = [
  {
    vendor: 'Optimizely',
    markers: [/optimizely/i, /optimizely\.get\s*\(\s*['"]state['"]/i],
    variants: [/getVariationForExperiment|activateExperiment|trackEvent/i],
  },
  {
    vendor: 'Google Optimize',
    markers: [/google[_-]?optimize|cxApi|dataLayer\.push\(\s*\{\s*['"]?event['"]?\s*:\s*['"]optimize/i],
    variants: [/optimize\.activate|gaexp|_gaexp/i],
  },
  {
    vendor: 'VWO',
    markers: [/_vwo_code|window\._vwo|VWO\.data/i],
    variants: [/vwo_debug|VWO\.variation/i],
  },
  {
    vendor: 'LaunchDarkly',
    markers: [/launchdarkly|ldclient|ld-client-js/i],
    variants: [/\.variation\s*\(|allFlags|identifyUser/i],
  },
  {
    vendor: 'Split',
    markers: [/splitio|SplitFactory|splitio-client/i],
    variants: [/getTreatment|getTreatments/i],
  },
  {
    vendor: 'Adobe Target',
    markers: [/adobe\.target|mbox|at\.js|tntId/i],
    variants: [/getOffers|applyOffers/i],
  },
  {
    vendor: 'Custom/feature-flag',
    markers: [/feature[_-]?flag|flagsmith|growthbook|unleash|statsig|posthog/i],
    variants: [/isEnabled|isFeatureEnabled|getFeatureFlag|bucket/i],
  },
];

/**
 * @typedef {Object} ExperimentAssignment
 * @property {string} experimentId - Experiment key / flag name.
 * @property {string|null} vendor - Detected experimentation vendor (null if custom).
 * @property {string[]} branches - Variant branch names found in code (e.g. 'control', 'variant_a').
 * @property {string[]} routes - URL routes referenced near the experiment logic.
 * @property {string[]} evidence - Code excerpts that triggered the match.
 */

/**
 * Scan client-side JavaScript for A/B experiment assignment logic.
 * @param {string} jsText - JavaScript source (bundle, inline script, or page text).
 * @param {{maxEvidence?: number}} [options]
 * @returns {{experiments: ExperimentAssignment[], vendors: string[], stats: object}}
 */
export function mapExperimentAssignments(jsText = '', options = {}) {
  const { maxEvidence = 25 } = options;
  const text = String(jsText);
  const lines = text.split(/\r?\n/);
  const experiments = new Map();
  const vendors = new Set();
  const evidence = [];

  const getOrCreate = (id, vendor) => {
    if (!experiments.has(id)) {
      experiments.set(id, { experimentId: id, vendor: vendor || null, branches: [], routes: [], evidence: [] });
    }
    const e = experiments.get(id);
    if (!e.vendor && vendor) e.vendor = vendor;
    return e;
  };

  const pushEvidence = (id, line, trimmed) => {
    if (evidence.length >= maxEvidence) return;
    evidence.push(trimmed);
    getOrCreate(id).evidence.push(trimmed);
    if (getOrCreate(id).evidence.length > 5) getOrCreate(id).evidence.shift();
  };

  // 1) Vendor-signature matches.
  for (const sig of VENDOR_SIGNATURES) {
    const vendorHits = sig.markers.some(re => re.test(text));
    if (!vendorHits) continue;
    vendors.add(sig.vendor);
  }

  // 2) Experiment / flag identifiers: variation('KEY'), activate('KEY'), getTreatment('KEY') etc.
  const idPattern =
    /(?:\.variation|activate|getTreatment|getTreatments|isEnabled|isFeatureEnabled|getFeatureFlag|createFeatureGate|useExperiment|_vwo_\w*)\s*\(\s*['"]([A-Za-z0-9_.\-:/]{2,80})['"]/g;
  for (const line of lines) {
    let m;
    const trimmed = line.trim();
    while ((m = idPattern.exec(trimmed)) !== null) {
      let vendor = null;
      for (const sig of VENDOR_SIGNATURES) {
        if (sig.markers.some(re => re.test(trimmed))) { vendor = sig.vendor; break; }
      }
      if (!vendor) {
        for (const sig of VENDOR_SIGNATURES) {
          if (sig.markers.some(re => re.test(text))) { vendor = sig.vendor; break; }
        }
      }
      const e = getOrCreate(m[1], vendor);
      pushEvidence(m[1], line, trimmed.slice(0, 200));
      // capture vendor on first sight
      if (!e.vendor && vendor) e.vendor = vendor;
    }
  }

  // 3) Bucketing logic: hash modulo 100 style traffic allocation.
  const bucketPattern =
    /(?:hash|murmur|fnv|djb2|crc32|md5|sha1)?\s*\(\s*[^)]*\)\s*%\s*(\d{1,3})\b/i;
  const bucketHits = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (bucketPattern.test(trimmed) && /experiment|variant|bucket|cohort|traffic/i.test(trimmed)) {
      bucketHits.push(trimmed.slice(0, 200));
    }
  }

  // 4) Variant branches: 'control' vs 'variant' literals and ternary assignment.
  const branchPattern =
    /['"](control|variant[_a-z0-9]*|treatment[_a-z0-9]*|holdout|baseline|original|challenger)['"]/gi;
  const routesByExperiment = new Map();
  const routePattern =
    /['"](?:https?:)?\/\/[^'"]*['"]|['"]\/[a-z0-9_.\-\/]{2,120}['"]/gi;
  for (const [id, exp] of experiments) {
    const branchSet = new Set();
    const routeSet = new Set();
    for (const line of lines) {
      if (!line.includes(id) && !/variant|control|treatment/i.test(line)) continue;
      let bm;
      while ((bm = branchPattern.exec(line)) !== null) branchSet.add(bm[1]);
      let rm;
      while ((rm = routePattern.exec(line)) !== null) {
        const r = rm[0].replace(/^['"]|['"]$/g, '');
        if (!/\.(js|css|png|jpg|svg|woff2?)$/i.test(r)) routeSet.add(r);
      }
    }
    exp.branches = [...branchSet];
    exp.routes = [...routeSet].slice(0, 15);
    if (routeSet.size) routesByExperiment.set(id, [...routeSet]);
  }

  // 5) Storage-backed overrides: localStorage/sessionStorage experiment keys.
  const storagePattern =
    /(?:localStorage|sessionStorage)\s*\.\s*(?:getItem|setItem)\s*\(\s*['"]([a-z0-9_.\-]{2,60})['"]/gi;
  const storageKeys = new Set();
  for (const line of lines) {
    let m;
    while ((m = storagePattern.exec(line)) !== null) {
      if (/exp|ab|variant|test|flag|cohort/i.test(m[1])) storageKeys.add(m[1]);
    }
  }

  const exps = [...experiments.values()];
  return {
    experiments: exps,
    vendors: [...vendors],
    bucketing: bucketHits.slice(0, 10),
    storageOverrideKeys: [...storageKeys],
    controlVsVariant: exps.map(e => ({
      experimentId: e.experimentId,
      hasControl: e.branches.some(b => /control|baseline|original/i.test(b)),
      variantCount: e.branches.filter(b => !/control|baseline|original/i.test(b)).length,
      routes: e.routes,
    })),
    stats: {
      experiments: exps.length,
      vendors: vendors.size,
      bucketingHits: bucketHits.length,
      storageOverrideKeys: storageKeys.size,
      lines: lines.length,
    },
  };
}

/**
 * Build a report finding from the mapping result.
 * @param {ReturnType<typeof mapExperimentAssignments>} result
 */
export function abTestFinding(result) {
  const withRoutes = result.controlVsVariant.filter(c => c.routes.length);
  return {
    title: `A/B assignment mapping — ${result.stats.experiments} experiment(s), ${withRoutes.length} with mapped routes`,
    severity: 'Info',
    confidence: result.stats.experiments > 0 ? 'high' : 'low',
    vendors: result.vendors,
    experiments: result.controlVsVariant.slice(0, 20),
    evidence:
      `${result.stats.experiments} experiment identifier(s) found in client-side code; ` +
      `${result.stats.bucketingHits} traffic-bucketing expression(s); ` +
      `${result.stats.storageOverrideKeys} storage override key(s).`,
  };
}

export const AB_TEST_ASSIGNMENT_MAPPER = {
  mapExperimentAssignments,
  abTestFinding,
  VENDOR_SIGNATURES,
};
export default AB_TEST_ASSIGNMENT_MAPPER;
