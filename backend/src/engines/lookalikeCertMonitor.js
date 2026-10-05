/**
 * lookalikeCertMonitor.js — lookalike TLS-certificate monitoring engine.
 *
 * @idea 0313 — Lookalike TLS-cert monitoring: monitor CT logs for certs
 *   issued to lookalike domains to catch phishing sites at issuance.
 *
 * Pure functions only: callers query Certificate Transparency logs
 * themselves (respecting provider rate limits) and pass the certificate
 * records in. No live HTTP here.
 *
 * Defensive framing: helps the authorized owner of a brand catch phishing
 * domains at the moment their certificates are issued, before attacks go
 * live.
 */

const HOMOGLYPHS = {
  a: ['à', 'á', 'â', 'ã', 'ä', 'å', 'ɑ', 'а'], // а = U+0430 Cyrillic a
  e: ['è', 'é', 'ê', 'ë', 'е'],
  i: ['ì', 'í', 'î', 'ï', 'і'], // і = U+0456 Cyrillic i
  o: ['ò', 'ó', 'ô', 'õ', 'ö', 'о', 'ο'],
  u: ['ù', 'ú', 'û', 'ü'],
  c: ['ç', 'с'], // с = U+0441 Cyrillic es
  n: ['ñ'],
  s: ['ѕ'], // ѕ = U+0405 Cyrillic dze
  p: ['р'],
  x: ['х'],
  y: ['у'],
  l: ['1', 'і'],
  m: ['rn'],
  w: ['vv'],
};

const SUSPICIOUS_KEYWORDS = new Set([
  'secure', 'login', 'signin', 'sign-in', 'verify', 'verification', 'account',
  'update', 'support', 'helpdesk', 'billing', 'payment', 'wallet', 'portal',
  'admin', 'service', 'official', 'auth', 'password', 'reset', 'confirm',
]);

/**
 * Normalize a domain: lowercase, strip scheme/port/trailing dot.
 * @param {string} domain
 * @returns {string}
 */
export function normalizeDomain(domain) {
  return String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/\.$/, '');
}

/**
 * Damerau-Levenshtein edit distance between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function editDistance(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  const d = Array.from({ length: s.length + 1 }, (_, i) => [i, ...new Array(t.length).fill(0)]);
  for (let j = 0; j <= t.length; j++) d[0][j] = j;
  for (let i = 1; i <= s.length; i++) {
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[s.length][t.length];
}

/**
 * Check whether two labels differ only by confusable (homoglyph) characters.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function isHomoglyphPair(a, b) {
  const s = String(a || '').toLowerCase();
  const t = String(b || '').toLowerCase();
  if (!s || !t || s.length !== t.length) return false;
  const reverse = {};
  for (const [latin, glyphs] of Object.entries(HOMOGLYPHS)) {
    for (const g of glyphs) reverse[g] = latin;
  }
  const canon = (ch) => reverse[ch] || ch;
  let anyGlyph = false;
  for (let i = 0; i < s.length; i++) {
    if (canon(s[i]) !== canon(t[i])) return false;
    if (canon(s[i]) !== s[i] || canon(t[i]) !== t[i]) anyGlyph = true;
  }
  return anyGlyph;
}

/**
 * Determine whether a domain is a lookalike of the brand (typosquat or
 * homoglyph attack) rather than a legit owned domain.
 * @param {string} domain candidate domain from CT logs
 * @param {string} brandApex legitimate brand apex domain, e.g. "acme.com"
 * @param {string[]} [ownedDomains=[]] other legitimately owned domains to exclude
 * @param {object} [opts]
 * @param {number} [opts.maxTypos=2] max edit distance for typosquat flag
 * @returns {{lookalike: boolean, kind: string, detail: string}}
 */
export function classifyLookalike(domain, brandApex, ownedDomains = [], opts = {}) {
  const { maxTypos = 2 } = opts || {};
  const d = normalizeDomain(domain);
  const brand = normalizeDomain(brandApex);
  if (!d || !brand) return { lookalike: false, kind: 'invalid', detail: '' };
  if (d === brand) return { lookalike: false, kind: 'brand', detail: 'the brand domain itself' };
  if ((ownedDomains || []).some((o) => normalizeDomain(o) === d)) {
    return { lookalike: false, kind: 'owned', detail: 'listed as legitimately owned' };
  }

  const brandLabel = brand.split('.')[0];
  const domainLabels = d.split('.');
  const sld = domainLabels.slice(0, -1).join('.') || d;
  const mainLabel = domainLabels[0];

  // 1. Homoglyph check on the brand label
  if (isHomoglyphPair(mainLabel, brandLabel) || isHomoglyphPair(sld, brand)) {
    return { lookalike: true, kind: 'homoglyph', detail: `confusable characters of "${brandLabel}"` };
  }
  // 2. Typosquat: small edit distance on the brand label
  if (mainLabel.length >= 4 && editDistance(mainLabel, brandLabel) <= maxTypos && mainLabel.length <= brandLabel.length + 2) {
    return { lookalike: true, kind: 'typosquat', detail: `edit distance ${editDistance(mainLabel, brandLabel)} from "${brandLabel}"` };
  }
  // 3. Keyword combos: brand + suspicious keyword (acme-secure.com, acmelogin.com)
  for (const kw of SUSPICIOUS_KEYWORDS) {
    const fused = `${brandLabel}${kw}`;
    const dashed = `${brandLabel}-${kw}`;
    if (mainLabel === fused || mainLabel === dashed || mainLabel === `${kw}${brandLabel}` || mainLabel === `${kw}-${brandLabel}`) {
      return { lookalike: true, kind: 'keyword-combo', detail: `brand fused with "${kw}"` };
    }
  }
  // 4. Brand as subdomain of an unknown domain is usually legit-ish (phish often does the reverse: brand.attacker.com is fine)
  //    But attacker brand lookalike in the TLD slot (acme-support.com) caught above.
  return { lookalike: false, kind: 'unrelated', detail: '' };
}

/**
 * Score a lookalike finding for triage priority (0–100).
 * @param {{kind: string}} finding
 * @param {{domain: string, issuer?: string, notBefore?: string, sans?: string[]}} entry CT entry
 * @returns {number}
 */
export function scoreLookalikeRisk(finding = {}, entry = {}) {
  let score = 40;
  if (finding.kind === 'homoglyph') score += 30;
  if (finding.kind === 'typosquat') score += 25;
  if (finding.kind === 'keyword-combo') score += 20;
  const sans = entry?.sans || [];
  if (sans.length > 5) score += 10; // broad cert covering many lookalikes
  const issuer = String(entry?.issuer || '').toLowerCase();
  if (issuer.includes('free') || issuer.includes('letsencrypt') || issuer.includes('zerossl')) score += 5; // cheap DV cert
  return Math.min(100, score);
}

/**
 * Analyze a batch of CT-log certificate entries for brand lookalikes.
 * @param {{domain: string, issuer?: string, notBefore?: string, sans?: string[]}[]} entries pre-fetched CT entries
 * @param {string} brandApex legitimate brand apex domain
 * @param {string[]} [ownedDomains=[]] legitimately owned domains to exclude
 * @param {object} [opts]
 * @returns {{domain: string, kind: string, detail: string, risk: number, issuer: string, notBefore: string}[]}
 */
export function analyzeCertEntries(entries = [], brandApex, ownedDomains = [], opts = {}) {
  const findings = [];
  const seen = new Set();
  for (const entry of entries || []) {
    const d = normalizeDomain(entry?.domain);
    if (!d || seen.has(d)) continue;
    seen.add(d);
    const cls = classifyLookalike(d, brandApex, ownedDomains, opts);
    if (!cls.lookalike) continue;
    findings.push({
      domain: d,
      kind: cls.kind,
      detail: cls.detail,
      risk: scoreLookalikeRisk(cls, entry),
      issuer: String(entry?.issuer || ''),
      notBefore: String(entry?.notBefore || ''),
    });
  }
  return findings.sort((a, b) => b.risk - a.risk || a.domain.localeCompare(b.domain));
}

/**
 * Diff two CT snapshots to report newly issued lookalike certificates —
 * the "catch them at issuance" monitor tick.
 * @param {{domain: string}[]} previous previous snapshot of CT entries
 * @param {{domain: string}[]} current current snapshot of CT entries
 * @param {string} brandApex legitimate brand apex domain
 * @param {string[]} [ownedDomains=[]]
 * @returns {{newLookalikes: ReturnType<typeof analyzeCertEntries>, totalNew: number}}
 */
export function newIssuanceAlerts(previous = [], current = [], brandApex, ownedDomains = []) {
  const prevSet = new Set((previous || []).map((e) => normalizeDomain(e?.domain)));
  const fresh = (current || []).filter((e) => !prevSet.has(normalizeDomain(e?.domain)));
  return { newLookalikes: analyzeCertEntries(fresh, brandApex, ownedDomains), totalNew: fresh.length };
}
