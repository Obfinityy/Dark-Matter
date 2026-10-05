/**
 * gtldBrandSweep.js — New-gTLD brand-variant sweep engine.
 *
 * @idea 00300
 * Covers idea-bank item 00300:
 *  - 00300 New-gTLD brand-variant sweep — sweep new gTLDs for exact brand
 *    matches and near-variants that could be phishing or shadow IT.
 *
 * Pure functions only: the caller supplies zone/registration observations
 * (domain, registrar, created date, nameservers) and the engine scores them
 * against brand variants. No live HTTP here.
 */

const NEW_GTLDS = [
  'app', 'dev', 'io', 'ai', 'cloud', 'tech', 'store', 'shop', 'online',
  'site', 'website', 'space', 'xyz', 'top', 'club', 'vip', 'pro', 'biz',
  'info', 'name', 'mobi', 'email', 'company', 'solutions', 'services',
  'agency', 'digital', 'media', 'news', 'blog', 'live', 'studio', 'video',
  'music', 'games', 'bet', 'casino', 'finance', 'bank', 'insurance',
  'health', 'care', 'clinic', 'dental', 'fitness', 'law', 'legal',
  'realty', 'homes', 'property', 'rentals', 'travel', 'tours', 'flights',
  'hotels', 'rest', 'bar', 'cafe', 'pizza', 'restaurant', 'food',
  'fashion', 'shoes', 'jewelry', 'watch', 'luxury', 'beauty', 'skin',
  'baby', 'kids', 'pet', 'dog', 'cat', 'car', 'cars', 'auto', 'tires',
  'motorcycles', 'boats', 'yachts', 'guru', 'ninja', 'expert', 'works',
  'tools', 'systems', 'software', 'network', 'security', 'support',
  'help', 'contact', 'team', 'group', 'partners', 'ventures', 'capital',
  'fund', 'exchange', 'market', 'markets', 'trade', 'deals', 'sale',
  'coupon', 'promo', 'gift', 'cards', 'pay', 'money', 'cash', 'credit',
  'loan', 'accountant', 'tax', 'consulting', 'management', 'center',
];

/**
 * Normalize a brand to its alphanumeric core.
 * @param {string} brand
 * @returns {string}
 */
export function normalizeBrand(brand) {
  return String(brand || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Generate the brand-variant candidate list swept across new gTLDs.
 * Exact brand + phishing-typical affixes; matching-only strings, nothing
 * is registered or resolved by this engine.
 *
 * @param {string} brand base brand name
 * @param {string[]} [gtlds] TLDs to sweep (defaults to NEW_GTLDS)
 * @returns {{domain: string, variantKind: string}[]}
 */
export function generateBrandVariants(brand, gtlds = NEW_GTLDS) {
  const base = normalizeBrand(brand);
  if (!base) return [];
  const cores = new Map();
  const addCore = (core, kind) => { if (!cores.has(core)) cores.set(core, kind); };
  addCore(base, 'exact');
  addCore(`${base}pay`, 'suffix');
  addCore(`${base}app`, 'suffix');
  addCore(`${base}secure`, 'suffix');
  addCore(`${base}login`, 'suffix');
  addCore(`${base}support`, 'suffix');
  addCore(`${base}verify`, 'suffix');
  addCore(`get${base}`, 'prefix');
  addCore(`my${base}`, 'prefix');
  addCore(`try${base}`, 'prefix');
  addCore(base.replace(/o/g, '0'), 'homoglyph');
  addCore(base.replace(/l/g, '1'), 'homoglyph');
  addCore(base.replace(/e/g, '3'), 'homoglyph');

  const out = [];
  for (const [core, kind] of cores) {
    for (const tld of gtlds || []) {
      out.push({ domain: `${core}.${String(tld).toLowerCase()}`, variantKind: kind });
    }
  }
  return out.sort((a, b) => a.domain.localeCompare(b.domain));
}

/**
 * Score an observed domain registration against brand variants.
 * Observation shape: {domain, registrar, created, nameservers[]}.
 *
 * @param {object[]} observations registration observations from the caller
 * @param {string} brand base brand name
 * @param {string[]} [ownedDomains] domains the org already owns (excluded)
 * @returns {{
 *   domain: string, variantKind: string, score: number, reason: string,
 *   registrar: string, created: string
 * }[]}
 */
export function sweepObservedDomains(observations = [], brand, ownedDomains = []) {
  const base = normalizeBrand(brand);
  if (!base) return [];
  const owned = new Set((ownedDomains || []).map((d) => String(d).trim().toLowerCase()));
  const variants = generateBrandVariants(brand);
  const variantByDomain = new Map(variants.map((v) => [v.domain, v.variantKind]));

  const results = [];
  for (const obs of observations || []) {
    const domain = String(obs?.domain || '').trim().toLowerCase();
    if (!domain || owned.has(domain)) continue;
    const kind = variantByDomain.get(domain);
    if (!kind) continue;

    let score = 50;
    let reason = `new-gTLD ${kind} brand variant observed`;
    if (kind === 'exact') { score = 85; reason = 'exact brand match on a new gTLD — high phishing/shadow-IT risk'; }
    if (kind === 'homoglyph') { score = 95; reason = 'homoglyph brand variant on a new gTLD — classic phishing pattern'; }
    if (kind === 'suffix' && /pay|login|secure|verify/.test(domain.split('.')[0])) {
      score = 80;
      reason = 'credential-harvest-style brand variant on a new gTLD — likely phishing';
    }
    results.push({
      domain,
      variantKind: kind,
      score: Math.min(100, score),
      reason,
      registrar: String(obs?.registrar || ''),
      created: String(obs?.created || ''),
    });
  }

  return results.sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));
}
