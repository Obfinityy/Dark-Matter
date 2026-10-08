/**
 * subdomainPermutator.js — Systematic subdomain permutation generation engine.
 *
 * Attackers register and use predictable variations of known subdomains
 * (dev-api vs api-dev, api2 vs api3, dev- vs staging- prefixes). Given the
 * subdomains already discovered for a target, this module generates the full
 * systematic permutation space — prefix/suffix swaps, numeric increments,
 * hyphen variants, and environment-label swaps — so the resolver sweep that
 * follows has nowhere to hide.
 *
 * Defensive framing: outputs are candidate names for the operator's own
 * authorized DNS resolution step. No network I/O here.
 */

const ENV_LABELS = [
  'dev',
  'development',
  'test',
  'testing',
  'qa',
  'stage',
  'staging',
  'prod',
  'production',
  'preprod',
  'uat',
  'demo',
  'beta',
  'alpha',
  'sandbox',
  'internal',
  'external',
];

const COMMON_PREFIXES = [
  'api',
  'app',
  'web',
  'admin',
  'portal',
  'vpn',
  'mail',
  'cdn',
  'static',
  'assets',
  'auth',
  'login',
  'sso',
];
const COMMON_SUFFIXES = [
  'api',
  'app',
  'web',
  'admin',
  'portal',
  'db',
  'cache',
  'cdn',
  'static',
  'internal',
  'svc',
  'service',
  'node',
];

/**
 * Split a subdomain label into tokens on hyphens/underscores/dots.
 */
export function tokenizeLabel(label) {
  return String(label || '')
    .toLowerCase()
    .split(/[-_.]+/)
    .filter(Boolean);
}

/**
 * Increment trailing numbers: api2 -> api3..api9, web01 -> web02..web20.
 * @param {string} label
 * @returns {string[]}
 */
export function numericPermutations(label) {
  const m = String(label).match(/^(.*?)(\d+)$/);
  const out = [];
  if (m) {
    const base = m[1];
    const num = parseInt(m[2], 10);
    const width = m[2].length;
    for (let d = -3; d <= 5; d++) {
      if (d === 0) continue;
      const n = num + d;
      if (n < 0) continue;
      out.push(base + String(n).padStart(width, '0'));
    }
  } else {
    for (let i = 1; i <= 5; i++) out.push(`${label}${i}`);
    for (let i = 1; i <= 3; i++) out.push(`${label}0${i}`);
  }
  return out;
}

/**
 * Swap an environment token for every other known environment token.
 */
export function environmentSwaps(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    if (ENV_LABELS.includes(tokens[i])) {
      for (const env of ENV_LABELS) {
        if (env === tokens[i]) continue;
        const copy = [...tokens];
        copy[i] = env;
        out.push(copy.join('-'));
        out.push(copy.join('.'));
      }
    }
  }
  return out;
}

/**
 * Generate permutations for a single known subdomain.
 * @param {string} subdomain e.g. "dev-api.example.com" or "api2"
 * @returns {string[]} label-level permutations (registrable label, no trailing domain)
 */
export function permutationsForSubdomain(subdomain) {
  const full = String(subdomain || '')
    .toLowerCase()
    .trim();
  if (!full) return [];
  const label = full.split('.')[0];
  const out = new Set();
  const tokens = tokenizeLabel(label);

  // 1. Numeric increments / additions
  for (const p of numericPermutations(label)) out.add(p);

  // 2. Hyphenation variants
  if (tokens.length > 1) {
    out.add(tokens.join(''));
    out.add(tokens.join('_'));
    out.add([...tokens].reverse().join('-')); // prefix/suffix swap
    out.add([...tokens].reverse().join(''));
  } else if (tokens.length === 1) {
    for (const pre of COMMON_PREFIXES.slice(0, 12)) {
      if (pre === tokens[0]) continue;
      out.add(`${pre}-${tokens[0]}`);
      out.add(`${tokens[0]}-${pre}`);
    }
    for (const suf of COMMON_SUFFIXES.slice(0, 12)) {
      if (suf === tokens[0]) continue;
      out.add(`${tokens[0]}-${suf}`);
    }
  }

  // 3. Environment label swaps
  for (const p of environmentSwaps(tokens)) out.add(p);

  // 4. Separator swap: hyphen <-> none <-> dot-part
  if (label.includes('-')) {
    out.add(label.replace(/-/g, ''));
    out.add(label.replace(/-/g, '_'));
  }
  out.delete(label);
  return [...out];
}

/**
 * Generate the full permutation space for all known subdomains.
 *
 * @param {string[]} knownSubdomains discovered subdomains (fqdn or bare labels)
 * @param {string} domain base domain to qualify bare labels, e.g. "example.com"
 * @param {{maxPerSubdomain?: number}} options
 * @returns {string[]} deduped fully-qualified candidate names
 */
export function generatePermutations(knownSubdomains = [], domain = '', options = {}) {
  const maxPer = options.maxPerSubdomain ?? 200;
  const base = String(domain || '')
    .toLowerCase()
    .replace(/\.$/, '');
  const seen = new Set();
  const out = [];
  for (const sub of knownSubdomains) {
    const perms = permutationsForSubdomain(sub).slice(0, maxPer);
    for (const p of perms) {
      const fqdn =
        base && !p.includes('.')
          ? `${p}.${base}`
          : p.includes('.') && base && !p.endsWith(base)
            ? `${p}.${base}`
            : p;
      const finalName = fqdn.includes('.') ? fqdn : base ? `${fqdn}.${base}` : fqdn;
      if (seen.has(finalName)) continue;
      seen.add(finalName);
      out.push(finalName);
    }
  }
  return out;
}

export const SUBDOMAIN_PERMUTATOR = {
  tokenizeLabel,
  numericPermutations,
  environmentSwaps,
  permutationsForSubdomain,
  generatePermutations,
};

export default SUBDOMAIN_PERMUTATOR;
