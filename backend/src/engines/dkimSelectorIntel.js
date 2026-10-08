/**
 * dkimSelectorIntel.js — DKIM selector brute forcing (idea 00082).
 *
 * Defensive mail-signing infrastructure discovery for an authorized
 * bug-bounty agent. DKIM public keys live as TXT records at
 * `<selector>._domainkey.<domain>`. Brute-forcing the common selector
 * namespace reveals the mail-signing infrastructure: the selectors in use,
 * the hostnames they imply, weak key parameters (short RSA keys, revoked
 * keys) and testing selectors that should never sign production mail.
 *
 * Only passive TXT lookups are performed — no mail is sent, no keys are
 * challenged. Use against operator-authorized targets only.
 */

import dns from 'node:dns';

const resolver = new dns.promises.Resolver();

/**
 * Commonly used DKIM selectors observed across mail providers, ESPs and
 * on-prem mail stacks.
 * @type {string[]}
 */
export const COMMON_DKIM_SELECTORS = [
  'default',
  'dkim',
  'mail',
  'selector1',
  'selector2',
  's1',
  's2',
  'google',
  'k1',
  'k2',
  'mxvault',
  'everlytickey1',
  'everlytickey2',
  'cm',
  'mandrill',
  'mailgun',
  'sendgrid',
  'amazonses',
  'dkim1',
  'dkim2',
  'proofpoint',
  'mimecast',
  'zoho',
  'yandex',
  'postmark',
  'sparkpost',
  'message',
  'email',
  'sig1',
  'sig2',
  'key1',
  'key2',
  'protonmail',
  'fastmail',
  'tutanota',
  'outlook',
  'o365',
  'ms365',
];

/**
 * Parse a DKIM TXT record (RFC 6376 §3.6.2.1) into tag/value pairs.
 * Accepts the joined TXT string as returned by DNS (chunks concatenated).
 *
 * @param {string} txt e.g. "v=DKIM1; k=rsa; p=MIGfMA0..."
 * @returns {{tags:Record<string,string>, isDkim:boolean, version:string|null, keyType:string|null, publicKey:string|null}}
 */
export function parseDkimRecord(txt) {
  const tags = {};
  const cleaned = String(txt || '').replace(/\s+/g, '');
  for (const part of cleaned.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) tags[part.slice(0, idx).toLowerCase()] = part.slice(idx + 1);
  }
  const isDkim = (tags.v || '').toUpperCase() === 'DKIM1';
  return {
    tags,
    isDkim,
    version: tags.v || null,
    keyType: (tags.k || 'rsa').toLowerCase(),
    publicKey: tags.p || null,
  };
}

/**
 * Estimate the RSA modulus bit-length from a base64 public-key blob.
 * Works on the DER-encoded SubjectPublicKeyInfo base64 from the `p=` tag.
 *
 * @param {string} p base64 public key
 * @returns {number|null} estimated key size in bits, or null if undecodable
 */
export function estimateRsaKeyBits(p) {
  try {
    const bytes = Buffer.from(String(p || ''), 'base64');
    if (bytes.length < 60) return null;
    // Scan the DER structure for the modulus INTEGER (largest plausible INTEGER).
    let best = 0;
    for (let i = 0; i + 2 < bytes.length; i++) {
      if (bytes[i] === 0x02) {
        let len = bytes[i + 1];
        let off = i + 2;
        if (len & 0x80) {
          const lenBytes = len & 0x7f;
          if (lenBytes > 2) continue;
          len = 0;
          for (let j = 0; j < lenBytes; j++) len = (len << 8) | bytes[off++];
        }
        const start = off;
        if (bytes[start] === 0x00) {
          off++;
          len--;
        }
        if (len > 64 && len < 1024 && start + len <= bytes.length) {
          const bits = len * 8;
          if (bits > best) best = bits;
        }
      }
    }
    if (best > 0) return best;
    // Fallback: raw DER length heuristic for SubjectPublicKeyInfo RSA keys.
    const approx = Math.round(((bytes.length - 40) * 8) / 8);
    return approx >= 512 ? approx : null;
  } catch {
    return null;
  }
}

/**
 * Analyze one selector's DKIM records and return defensive findings.
 *
 * @param {string} domain
 * @param {string} selector
 * @param {string[]} txtRecords TXT record strings at selector._domainkey.domain
 * @returns {{selector:string, present:boolean, keyType:string|null, keyBits:number|null, revoked:boolean, findings:Array<{severity:string,type:string,detail:string}>}}
 */
export function analyzeDkimSelector(domain, selector, txtRecords) {
  const findings = [];
  const parsed = (txtRecords || []).map(parseDkimRecord).filter(p => p.isDkim);
  if (parsed.length === 0) {
    return { selector, present: false, keyType: null, keyBits: null, revoked: false, findings };
  }
  const first = parsed[0];
  const revoked = first.publicKey === '';
  const keyBits = revoked ? null : estimateRsaKeyBits(first.publicKey);
  if (revoked) {
    findings.push({
      severity: 'info',
      type: 'dkim-selector-revoked',
      detail: `Selector "${selector}" publishes a revoked DKIM key (empty p=). Presence of a revoked selector often means a rotation happened — enumerate the sibling selectors that replaced it.`,
    });
  }
  if (first.keyType && first.keyType !== 'rsa' && first.keyType !== 'ed25519') {
    findings.push({
      severity: 'medium',
      type: 'dkim-unknown-key-type',
      detail: `Selector "${selector}" uses unexpected key type "${first.keyType}" — verify it is intentional and not a stale test record.`,
    });
  }
  if (keyBits !== null && keyBits < 1024) {
    findings.push({
      severity: 'high',
      type: 'dkim-weak-key',
      detail: `Selector "${selector}" signs with a ~${keyBits}-bit RSA key, below the 1024-bit minimum — short enough to be factorable with modest resources, undermining DMARC alignment.`,
    });
  }
  if (/test|dev|stage|temp/i.test(selector)) {
    findings.push({
      severity: 'medium',
      type: 'dkim-testing-selector-live',
      detail: `Selector "${selector}" looks like a testing selector but is live on ${domain} — test selectors are frequently forgotten and rotate poorly; confirm it still belongs to production mail flow.`,
    });
  }
  return { selector, present: true, keyType: first.keyType, keyBits, revoked, findings };
}

/**
 * Idea 00082 — brute-force common DKIM selectors as TXT records at
 * `<selector>._domainkey.<domain>` and analyze every live key.
 *
 * @param {string} domain e.g. "example.com"
 * @param {string[]} [selectors] selector list to try (default: COMMON_DKIM_SELECTORS)
 * @returns {Promise<{domain:string, discovered:Array, summary:string[]}>}
 */
export async function discoverDkimSelectors(domain, selectors = COMMON_DKIM_SELECTORS) {
  const d = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  const discovered = [];
  const summary = [];
  await Promise.all(
    selectors.map(async selector => {
      const name = `${selector}._domainkey.${d}`;
      try {
        const txt = await resolver.resolveTxt(name);
        const joined = txt.map(chunks => chunks.join(''));
        const analysis = analyzeDkimSelector(d, selector, joined);
        if (analysis.present) discovered.push(analysis);
      } catch {
        /* selector not published — not a finding */
      }
    })
  );
  discovered.sort((a, b) => a.selector.localeCompare(b.selector));
  if (discovered.length === 0) {
    summary.push(
      'No DKIM selectors from the common list are published — the domain may use unpublished selectors or no DKIM at all (check DMARC policy for p=none vs reject).'
    );
  } else {
    summary.push(
      `${discovered.length} DKIM selector(s) discovered: ${discovered.map(x => x.selector).join(', ')} — each selector is a mail-signing key worth key-strength and rotation review.`
    );
    const weak = discovered.filter(x => (x.keyBits ?? Infinity) < 1024);
    if (weak.length)
      summary.push(
        `WEAK KEYS: ${weak.map(x => `${x.selector} (~${x.keyBits} bits)`).join(', ')} — factorable keys break the domain's DMARC story.`
      );
  }
  return { domain: d, discovered, summary };
}
