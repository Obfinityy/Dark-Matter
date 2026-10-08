/**
 * envPermutationIntel.js — Environment-naming permutation generators for
 * autonomous bug bounty.
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. Covers
 * idea-bank items 00051–00060:
 *
 *  00053 Dev/staging naming-convention brute force — generate permutations
 *            from observed patterns (env-region-app) and resolve them to
 *            find unlinked staging hosts.
 *  00054 Environment-prefix matrix probing — cross dev/staging/qa/uat/
 *            preprod prefixes against every discovered subdomain base to
 *            enumerate parallel environments.
 *  00055 Region-suffix permutation sweep — append region codes
 *            (us-east, eu-west, ap-south) to hostnames to find
 *            geo-distributed deployments.
 *
 * All functions are pure generators: they produce candidate hostnames from
 * observed naming patterns. Actual DNS resolution is left to the caller, so
 * the engine stays testable and safe to run anywhere.
 */

/** Environment tokens commonly used as prefixes/infixes. */
export const ENV_TOKENS = [
  'dev',
  'development',
  'test',
  'testing',
  'stage',
  'staging',
  'qa',
  'uat',
  'preprod',
  'prod',
  'production',
  'beta',
  'alpha',
  'demo',
  'sandbox',
  'canary',
  'preview',
  'internal',
  'corp',
];

/** Region tokens in long (cloud-style) and short forms. */
export const REGION_TOKENS = [
  // Long cloud-style codes.
  'us-east-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-south-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'sa-east-1',
  'us-east',
  'us-west',
  'eu-west',
  'eu-central',
  'ap-south',
  'ap-southeast',
  'ap-northeast',
  'sa-east',
  'af-south',
  'me-south',
  // Short forms operators actually use.
  'use1',
  'usw2',
  'euw1',
  'euc1',
  'aps1',
  'apse2',
  'apne1',
  'us',
  'eu',
  'ap',
  'na',
  'emea',
  'latam',
];

/** Separators observed between naming tokens. */
const SEPARATORS = ['-', '.'];

/**
 * Multi-part tokens (contain separators themselves) that must be kept
 * intact during tokenization, longest-first so 'us-east-1' wins over
 * a shorter prefix.
 */
const MULTI_PART_TOKENS = [
  ...REGION_TOKENS.filter(t => t.includes('-')),
  ...ENV_TOKENS.filter(t => t.includes('-')),
].sort((a, b) => b.length - a.length);

/**
 * Split a label on [-_.] while keeping known multi-part tokens
 * (e.g. 'us-east-1') intact.
 *
 * @param {string} label
 * @returns {string[]}
 */
function smartSplitLabel(label) {
  let s = String(label || '').toLowerCase();
  const placeholders = new Map();
  let idx = 0;
  for (const t of MULTI_PART_TOKENS) {
    if (s.includes(t)) {
      const ph = `\u0001${idx}\u0001`;
      idx += 1;
      placeholders.set(ph, t);
      s = s.split(t).join(ph);
    }
  }
  const out = [];
  for (const part of s.split(/[-_.]/).filter(Boolean)) {
    out.push(placeholders.get(part) ?? part);
  }
  return out;
}

/**
 * Split a hostname label into lowercase tokens on separators.
 *
 * @param {string} hostname
 * @returns {{ apex: string, tokens: string[] }}
 */
export function tokenizeHostname(hostname) {
  const h = String(hostname || '')
    .trim()
    .toLowerCase();
  const parts = h.split('.');
  const apex = parts.length > 1 ? parts.slice(-2).join('.') : h;
  const labelParts = parts.length > 1 ? parts.slice(0, -2) : parts;
  const tokens = labelParts.flatMap(p => smartSplitLabel(p));
  return { apex, tokens };
}

/**
 * Classify tokens of a hostname against known env/region dictionaries.
 *
 * @param {string} hostname
 * @returns {{ apex: string, env: string[], region: string[], app: string[] }}
 */
export function classifyTokens(hostname) {
  const { apex, tokens } = tokenizeHostname(hostname);
  const env = [],
    region = [],
    app = [];
  for (const t of tokens) {
    if (ENV_TOKENS.includes(t)) env.push(t);
    else if (REGION_TOKENS.includes(t)) region.push(t);
    else app.push(t);
  }
  return { apex, env, region, app };
}

/**
 * Infer the naming patterns in use from a set of observed hostnames.
 * Returns the distinct env tokens, region tokens, separators, and the
 * structural templates (e.g. ["env","-","app"]) seen in the data.
 *
 * @param {string[]} hostnames observed hostnames
 * @returns {{ envTokens: string[], regionTokens: string[], separators: string[], templates: string[][] }}
 */
export function inferNamingPatterns(hostnames) {
  const envSet = new Set();
  const regionSet = new Set();
  const sepSet = new Set();
  const templateSet = new Set();
  for (const h of Array.isArray(hostnames) ? hostnames : []) {
    const label = String(h || '')
      .trim()
      .toLowerCase()
      .split('.')
      .slice(0, -2)
      .join('.');
    if (!label) continue;
    for (const sep of SEPARATORS) {
      if (label.includes(sep)) sepSet.add(sep);
    }
    const { env, region } = classifyTokens(h);
    env.forEach(t => envSet.add(t));
    region.forEach(t => regionSet.add(t));
    const template = smartSplitLabel(
      String(h).trim().toLowerCase().split('.').slice(0, -2).join('.')
    ).map(t => (ENV_TOKENS.includes(t) ? 'env' : REGION_TOKENS.includes(t) ? 'region' : 'app'));
    if (template.length > 0) templateSet.add(JSON.stringify(template));
  }
  return {
    envTokens: [...envSet].sort(),
    regionTokens: [...regionSet].sort(),
    separators: [...sepSet].sort(),
    templates: [...templateSet].map(s => JSON.parse(s)),
  };
}

/**
 * Normalize a candidate hostname: lowercase, collapse repeated separators.
 *
 * @param {string} name
 * @returns {string}
 */
export function normalizeCandidateName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '')
    .replace(/([.-])\1+/g, '$1')
    .replace(/^[.-]+|[.-]+$/g, '');
}

function dedupe(names, seen = new Set()) {
  const out = [];
  for (const n of names) {
    const norm = normalizeCandidateName(n);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

/**
 * Generate env-region-app permutations from observed naming patterns.
 * Swaps each observed env/region token for every other known token while
 * keeping the observed template shape, surfacing unlinked staging hosts
 * that follow the same convention (idea 00053).
 *
 * @param {string[]} hostnames observed hostnames (patterns inferred from these)
 * @param {object} [opts] { envTokens?: string[], regionTokens?: string[], limit?: number }
 * @returns {string[]} candidate hostnames.
 */
export function generatePatternPermutations(hostnames, opts = {}) {
  const limit = Number.isFinite(opts.limit) ? opts.limit : 5000;
  const envTokens =
    Array.isArray(opts.envTokens) && opts.envTokens.length > 0 ? opts.envTokens : ENV_TOKENS;
  const regionTokens =
    Array.isArray(opts.regionTokens) && opts.regionTokens.length > 0
      ? opts.regionTokens
      : REGION_TOKENS;
  const seen = new Set(
    (Array.isArray(hostnames) ? hostnames : []).map(h => normalizeCandidateName(h))
  );
  const candidates = [];
  for (const h of Array.isArray(hostnames) ? hostnames : []) {
    if (candidates.length >= limit) break;
    const norm = normalizeCandidateName(h);
    const parts = norm.split('.');
    if (parts.length < 3) continue;
    const apex = parts.slice(-2).join('.');
    const label = parts.slice(0, -2).join('.');
    const sep = label.includes('-') ? '-' : label.includes('_') ? '_' : '-';
    const toks = smartSplitLabel(label);
    const kinds = toks.map(t =>
      ENV_TOKENS.includes(t) ? 'env' : REGION_TOKENS.includes(t) ? 'region' : 'app'
    );
    for (let i = 0; i < toks.length; i++) {
      if (candidates.length >= limit) break;
      if (kinds[i] === 'env') {
        for (const e of envTokens) {
          if (e === toks[i]) continue;
          const next = [...toks];
          next[i] = e;
          candidates.push(`${next.join(sep)}.${apex}`);
        }
      } else if (kinds[i] === 'region') {
        for (const r of regionTokens) {
          if (r === toks[i]) continue;
          const next = [...toks];
          next[i] = r;
          candidates.push(`${next.join(sep)}.${apex}`);
        }
      }
    }
    // Also try inserting a region token where none exists (env-app → env-region-app).
    if (!kinds.includes('region')) {
      for (const r of regionTokens.slice(0, 12)) {
        candidates.push(`${toks.join(sep)}${sep}${r}.${apex}`);
        candidates.push(`${r}${sep}${toks.join(sep)}.${apex}`);
      }
    }
  }
  return dedupe(candidates.slice(0, limit * 2), seen).slice(0, limit);
}

/**
 * Cross env prefixes against every discovered subdomain base to enumerate
 * parallel environments (idea 00054).
 *
 * @param {string[]} subdomainBases discovered base names, e.g. ["api.example.com"]
 * @param {object} [opts] { envTokens?: string[], limit?: number }
 * @returns {string[]} candidate hostnames.
 */
export function generateEnvPrefixMatrix(subdomainBases, opts = {}) {
  const limit = Number.isFinite(opts.limit) ? opts.limit : 5000;
  const envTokens =
    Array.isArray(opts.envTokens) && opts.envTokens.length > 0 ? opts.envTokens : ENV_TOKENS;
  const seen = new Set(
    (Array.isArray(subdomainBases) ? subdomainBases : []).map(b => normalizeCandidateName(b))
  );
  const candidates = [];
  for (const base of Array.isArray(subdomainBases) ? subdomainBases : []) {
    const norm = normalizeCandidateName(base);
    if (!norm || !norm.includes('.')) continue;
    const parts = norm.split('.');
    const apex = parts.slice(-2).join('.');
    const baseLabel = parts.slice(0, -2).join('.');
    for (const e of envTokens) {
      if (candidates.length >= limit) break;
      candidates.push(`${e}.${norm}`); // dev.api.example.com
      candidates.push(`${e}-${baseLabel}.${apex}`); // dev-api.example.com
      candidates.push(`${baseLabel}-${e}.${apex}`); // api-dev.example.com
    }
    if (candidates.length >= limit) break;
  }
  return dedupe(candidates.slice(0, limit * 2), seen).slice(0, limit);
}

/**
 * Append region codes to hostnames to find geo-distributed deployments
 * (idea 00055).
 *
 * @param {string[]} hostnames known hostnames
 * @param {object} [opts] { regionTokens?: string[], limit?: number }
 * @returns {string[]} candidate hostnames.
 */
export function generateRegionSuffixSweep(hostnames, opts = {}) {
  const limit = Number.isFinite(opts.limit) ? opts.limit : 5000;
  const regionTokens =
    Array.isArray(opts.regionTokens) && opts.regionTokens.length > 0
      ? opts.regionTokens
      : REGION_TOKENS;
  const seen = new Set(
    (Array.isArray(hostnames) ? hostnames : []).map(h => normalizeCandidateName(h))
  );
  const candidates = [];
  for (const h of Array.isArray(hostnames) ? hostnames : []) {
    const norm = normalizeCandidateName(h);
    if (!norm || !norm.includes('.')) continue;
    const parts = norm.split('.');
    const apex = parts.slice(-2).join('.');
    const label = parts.slice(0, -2).join('.');
    for (const r of regionTokens) {
      if (candidates.length >= limit) break;
      candidates.push(`${label}-${r}.${apex}`); // api-us-east-1.example.com
      candidates.push(`${r}.${norm}`); // us-east-1.api.example.com
    }
    if (candidates.length >= limit) break;
  }
  return dedupe(candidates.slice(0, limit * 2), seen).slice(0, limit);
}

/**
 * Rank generated candidates so the most plausible permutations are probed
 * first: observed-env/region swaps outrank exotic tokens.
 *
 * @param {string[]} candidates
 * @param {object} [opts] { observedEnvs?: string[], observedRegions?: string[] }
 * @returns {string[]} candidates sorted by plausibility.
 */
export function rankCandidates(candidates, opts = {}) {
  const observedEnvs = new Set((opts.observedEnvs || []).map(String));
  const observedRegions = new Set((opts.observedRegions || []).map(String));
  const scored = (Array.isArray(candidates) ? candidates : []).map(c => {
    const toks = smartSplitLabel(String(c));
    let score = 0;
    for (const t of toks) {
      if (observedEnvs.has(t)) score += 3;
      else if (ENV_TOKENS.includes(t)) score += 1;
      if (observedRegions.has(t)) score += 3;
      else if (REGION_TOKENS.includes(t)) score += 1;
    }
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.c);
}
