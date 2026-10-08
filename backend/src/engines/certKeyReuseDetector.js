/**
 * certKeyReuseDetector.js — Certificate public-key reuse detection engine.
 *
 * Compares the Subject Public Key Info (SPKI) fingerprints of certificates
 * observed across an authorized target's infrastructure. Identical public
 * keys on different hosts can indicate legitimately cloned/migrated services
 * (CDN edge, load-balancer pools) or risky key sharing between unrelated
 * environments (prod key reused on a staging box).
 *
 * Pure analysis: it consumes parsed certificate metadata (SPKI SHA-256
 * hashes, subjects, issuers) collected during the authorized hunt.
 */

/**
 * Check whether two certificates share the same public key.
 * @param {{spkiSha256?: string}} certA
 * @param {{spkiSha256?: string}} certB
 * @returns {{match: boolean, reason: string}}
 */
export function spkiMatch(certA = {}, certB = {}) {
  const a = normalizeSpki(certA.spkiSha256);
  const b = normalizeSpki(certB.spkiSha256);
  if (!a || !b) return { match: false, reason: 'missing-spki-hash' };
  return { match: a === b, reason: a === b ? 'identical-public-key' : 'different-public-key' };
}

/**
 * Group certificates by identical public key.
 * @param {{host: string, spkiSha256?: string, subject?: string, issuer?: string, notAfter?: string}[]} certs
 * @returns {{spkiSha256: string, members: object[], size: number}[]} groups with >1 member
 */
export function groupByPublicKey(certs = []) {
  const groups = new Map();
  for (const c of Array.isArray(certs) ? certs : []) {
    const spki = normalizeSpki(c && c.spkiSha256);
    if (!spki) continue;
    if (!groups.has(spki)) groups.set(spki, { spkiSha256: spki, members: [] });
    groups.get(spki).members.push(c);
  }
  return [...groups.values()]
    .filter(g => g.members.length > 1)
    .map(g => ({ ...g, size: g.members.length }))
    .sort((a, b) => b.size - a.size);
}

/**
 * Classify a public-key reuse group as benign infrastructure sharing or a
 * risky cross-environment clone, and score the finding.
 * @param {{spkiSha256: string, members: object[]}} group
 * @returns {{classification: string, riskScore: number, notes: string[]}}
 */
export function classifyReuse(group) {
  const notes = [];
  if (!group || !Array.isArray(group.members) || group.members.length < 2) {
    return {
      classification: 'insufficient-data',
      riskScore: 0,
      notes: ['Fewer than two certificates in group.'],
    };
  }
  const members = group.members;
  const issuers = new Set(members.map(m => String(m.issuer || '').toLowerCase()));
  const subjects = new Set(members.map(m => String(m.subject || '').toLowerCase()));
  const hosts = members.map(m => String(m.host || ''));
  const uniqueApex = new Set(hosts.map(h => apexOf(h)));
  const envs = new Set(hosts.map(h => environmentTag(h)));

  let classification = 'shared-infrastructure';
  let riskScore = 10;

  if (issuers.size > 1) {
    classification = 'cross-issuer-reuse';
    riskScore = 85;
    notes.push(
      'Same public key appears in certificates from different issuers — possible migration or unauthorized re-issuance.'
    );
  } else if (uniqueApex.size > 1) {
    classification = 'cross-domain-reuse';
    riskScore = 60;
    notes.push(
      'Same public key secures different apex domains — verify this is an intentional shared edge/tenant setup.'
    );
  } else if (
    envs.size > 1 &&
    envs.has('prod') &&
    (envs.has('staging') || envs.has('dev') || envs.has('test'))
  ) {
    classification = 'cross-environment-reuse';
    riskScore = 75;
    notes.push(
      'Production key material appears reused in a non-production environment — key compromise blast radius is widened.'
    );
  } else if (subjects.size === 1) {
    classification = 'same-service-pool';
    riskScore = 5;
    notes.push(
      'Identical key across members of one service pool (expected for load-balanced / CDN edges).'
    );
  } else {
    notes.push(
      'Same key reused within one apex domain across services — review whether this is an intentional wildcard setup.'
    );
    riskScore = 30;
  }
  notes.push(`${members.length} certificates share SPKI ${group.spkiSha256.slice(0, 16)}…`);
  return { classification, riskScore, notes };
}

/**
 * Find public keys reused across different issuers — the highest-signal
 * indicator of migration, cloning, or key-material mishandling.
 * @param {{host: string, spkiSha256?: string, subject?: string, issuer?: string}[]} certs
 * @returns {{spkiSha256: string, issuers: string[], hosts: string[]}[]}
 */
export function findCrossIssuerReuse(certs = []) {
  const out = [];
  for (const g of groupByPublicKey(certs)) {
    const issuers = [...new Set(g.members.map(m => String(m.issuer || 'unknown')))];
    if (issuers.length > 1) {
      out.push({
        spkiSha256: g.spkiSha256,
        issuers,
        hosts: g.members.map(m => String(m.host || 'unknown')),
      });
    }
  }
  return out;
}

/**
 * Summarize a whole certificate inventory: reuse rate and hotspot keys.
 * @param {{host: string, spkiSha256?: string, issuer?: string}[]} certs
 * @returns {{total: number, uniqueKeys: number, reuseRatePct: number, groups: object[], classifications: object[]}}
 */
export function summarizeKeyReuse(certs = []) {
  const list = Array.isArray(certs) ? certs : [];
  const uniqueKeys = new Set(list.map(c => normalizeSpki(c && c.spkiSha256)).filter(Boolean));
  const groups = groupByPublicKey(list);
  const classifications = groups.map(g => ({
    spkiSha256: g.spkiSha256,
    size: g.size,
    ...classifyReuse(g),
  }));
  return {
    total: list.length,
    uniqueKeys: uniqueKeys.size,
    reuseRatePct:
      list.length === 0
        ? 0
        : Math.round(((list.length - uniqueKeys.size) / list.length) * 10000) / 100,
    groups,
    classifications,
  };
}

function normalizeSpki(spki) {
  if (typeof spki !== 'string') return '';
  return spki.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
}

function apexOf(host) {
  const parts = String(host).toLowerCase().split('.').filter(Boolean);
  return parts.length <= 2 ? parts.join('.') : parts.slice(-2).join('.');
}

function environmentTag(host) {
  const h = String(host).toLowerCase();
  if (/(^|[.-])(prod|production|live|www)($|[.-])/.test(h)) return 'prod';
  if (/(^|[.-])(staging|stage|stg|preprod)($|[.-])/.test(h)) return 'staging';
  if (/(^|[.-])(dev|development|test|qa|uat|sandbox)($|[.-])/.test(h)) return 'dev';
  return 'other';
}

export const CERT_KEY_REUSE = {
  spkiMatch,
  groupByPublicKey,
  classifyReuse,
  findCrossIssuerReuse,
  summarizeKeyReuse,
};
