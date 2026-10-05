/**
 * subdomainPermutationEngine.js — subdomain permutation generation engine.
 *
 * @idea 0315 — Subdomain permutation generation engine: generate systematic
 *   permutations (prefix/suffix swaps, number increments) of every known
 *   subdomain and resolve them.
 *
 * Pure functions only: callers resolve the generated candidates themselves
 * (respecting provider rate limits) and pass resolutions back if desired.
 * No live DNS here.
 *
 * Defensive framing: enumerates plausible subdomains of a target the owner
 * authorized the agent to hunt on, so forgotten or shadow IT surfaces get
 * tested like an elite human hunter would.
 */

const ENV_SWAPS = [
  ['prod', 'dev', 'staging', 'stage', 'qa', 'test', 'uat', 'demo', 'preprod', 'sandbox', 'local'],
  ['internal', 'external', 'corp', 'vpn'],
  ['us', 'eu', 'apac', 'us-east', 'us-west', 'eu-west'],
];

const COMMON_PREFIXES = [
  'api', 'app', 'web', 'admin', 'portal', 'internal', 'secure', 'vpn', 'mail',
  'cdn', 'static', 'assets', 'dev', 'stage', 'test', 'beta', 'staging', 'demo',
  'ops', 'infra', 'monitor', 'status', 'auth', 'sso', 'ci', 'jenkins', 'git',
];

const COMMON_SUFFIXES = [
  'api', 'app', 'web', 'admin', 'portal', 'internal', 'backup', 'old', 'new',
  'v2', 'legacy', 'prod', 'dev', 'stage', 'test', 'db', 'sql', 'files', 'docs',
];

const DELIMITERS = ['-', '_', '.', ''];

/**
 * Normalize a full hostname: lowercase, strip trailing dot.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHostname(host) {
  return String(host || '').trim().toLowerCase().replace(/\.$/, '');
}

/**
 * Split a subdomain label chain into the part before the apex domain.
 * @param {string} fqdn
 * @param {string} apex
 * @returns {string[]} labels before the apex (e.g. ["api","v2"] for api.v2.acme.com)
 */
export function subdomainLabels(fqdn, apex) {
  const host = normalizeHostname(fqdn);
  const base = normalizeHostname(apex);
  if (!host || !base || host === base) return [];
  if (!host.endsWith(`.${base}`)) return [];
  return host.slice(0, -(base.length + 1)).split('.').filter(Boolean);
}

/**
 * Increment/decrement trailing numbers in a label: api1 → api2…api9,
 * db01 → db02…db09, v1 → v2…v9.
 * @param {string} label
 * @param {object} [opts]
 * @param {number} [opts.range=9] highest digit to generate
 * @returns {string[]}
 */
export function incrementNumericLabels(label, opts = {}) {
  const { range = 9 } = opts || {};
  const m = String(label || '').match(/^(.*?)(\d+)$/);
  if (!m) return [];
  const [, stem, digits] = m;
  const width = digits.length;
  const out = [];
  for (let n = 1; n <= range; n++) {
    const padded = String(n).padStart(width, '0');
    if (padded === digits) continue;
    out.push(`${stem}${padded}`);
  }
  return out;
}

/**
 * Generate systematic permutations of known subdomains under an apex.
 * @param {string[]} seeds known subdomains (FQDNs)
 * @param {string} apex apex domain to permute under
 * @param {object} [opts]
 * @param {boolean} [opts.envSwaps=true] swap environment tokens
 * @param {boolean} [opts.numberIncrements=true] increment numeric tails
 * @param {boolean} [opts.affixes=true] add common prefix/suffix affixes
 * @param {boolean} [opts.delimiterSwaps=true] swap - _ . delimiters
 * @param {number} [opts.maxCandidates=5000] cap on output size
 * @returns {string[]} candidate FQDNs (deduplicated, apex included never)
 */
export function generatePermutations(seeds = [], apex, opts = {}) {
  const { envSwaps = true, numberIncrements = true, affixes = true, delimiterSwaps = true, maxCandidates = 5000 } = opts || {};
  const base = normalizeHostname(apex);
  const candidates = new Set();
  const add = (labels) => {
    if (candidates.size >= maxCandidates) return;
    const fqdn = [...labels, base].join('.');
    if (fqdn !== base) candidates.add(fqdn);
  };

  for (const seed of seeds || []) {
    const labels = subdomainLabels(seed, base);
    if (!labels.length) continue;
    if (candidates.size >= maxCandidates) break;
    add(labels);

    for (let li = 0; li < labels.length && candidates.size < maxCandidates; li++) {
      const label = labels[li];
      const rest = [...labels.slice(0, li), ...labels.slice(li + 1)];

      // Number increments: api1 → api2..api9
      if (numberIncrements) {
        for (const variant of incrementNumericLabels(label)) {
          if (candidates.size >= maxCandidates) break;
          add([...labels.slice(0, li), variant, ...labels.slice(li + 1)]);
        }
      }

      // Environment swaps: prod-api → dev-api, staging-api …
      if (envSwaps) {
        for (const group of ENV_SWAPS) {
          const lower = label.toLowerCase();
          const hit = group.find((t) => lower === t || lower.startsWith(`${t}-`) || lower.startsWith(`${t}_`) || lower.endsWith(`-${t}`) || lower.endsWith(`_${t}`));
          if (!hit) continue;
          for (const token of group) {
            if (candidates.size >= maxCandidates) break;
            if (token === hit) continue;
            const swapped = label.replace(new RegExp(`(^|[-_])${hit}([-_]|$)`, 'i'), `$1${token}$2`);
            if (swapped !== label) add([...labels.slice(0, li), swapped, ...labels.slice(li + 1)]);
          }
        }
      }

      // Delimiter swaps: api-prod → api_prod, api.prod
      if (delimiterSwaps) {
        for (const d of DELIMITERS) {
          if (candidates.size >= maxCandidates) break;
          const parts = label.split(/[-_.]/);
          if (parts.length < 2) break;
          const joined = parts.join(d);
          if (joined !== label) add([...labels.slice(0, li), joined, ...labels.slice(li + 1)]);
        }
      }

      // Affixes: prefix-api, api-suffix for common tokens
      if (affixes) {
        for (const p of COMMON_PREFIXES) {
          if (candidates.size >= maxCandidates) break;
          if (label.toLowerCase().startsWith(p)) continue;
          add([`${p}-${label}`, ...rest]);
        }
        for (const s of COMMON_SUFFIXES) {
          if (candidates.size >= maxCandidates) break;
          if (label.toLowerCase().endsWith(s)) continue;
          add([...rest.slice(0, rest.length), `${label}-${s}`]);
        }
      }
    }
  }

  return [...candidates].sort();
}

/**
 * Filter candidates down to those not already in a known set.
 * @param {string[]} candidates
 * @param {Set<string>|string[]} known
 * @returns {string[]}
 */
export function dropKnownSubdomains(candidates = [], known = []) {
  const knownSet = known instanceof Set ? known : new Set((known || []).map(normalizeHostname));
  return (candidates || []).filter((c) => !knownSet.has(normalizeHostname(c)));
}
