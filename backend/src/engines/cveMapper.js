/**
 * cveMapper.js — Service-version to CVE mapping.
 *
 * Maps a fingerprinted product + version to known CVEs with exploitability
 * context (attack vector, authentication requirement, impact) so the hunt
 * planner can prioritize version-based findings. Includes a small curated,
 * well-documented CVE knowledge base of high-signal vulnerabilities —
 * identification data only, no exploit code.
 *
 * This module is a pure offline analyzer: it consumes product/version
 * strings and returns structured mappings. It performs no network I/O.
 */

/**
 * Compare version strings. Handles numeric parts, letter suffixes
 * (1.0.1f), and patch suffixes (8.5p1). Returns -1 | 0 | 1.
 */
export function compareVersions(a, b) {
  const tok = (v) => String(v).toLowerCase()
    .split(/[^a-z0-9]+/).filter(Boolean)
    .flatMap((p) => { const m = p.match(/^([0-9]+)([a-z].*)?$/); return m ? [m[1], m[2] || ''].filter((x) => x !== '') : [p]; })
    .map((p) => (/^[0-9]+$/.test(p) ? { n: parseInt(p, 10) } : { s: p }));
  const ta = tok(a); const tb = tok(b);
  const len = Math.max(ta.length, tb.length);
  for (let i = 0; i < len; i++) {
    const x = ta[i] || { n: 0 }; const y = tb[i] || { n: 0 };
    if (x.n !== undefined && y.n !== undefined) {
      if (x.n !== y.n) return x.n < y.n ? -1 : 1;
    } else if (x.s !== undefined && y.s !== undefined) {
      if (x.s !== y.s) return x.s < y.s ? -1 : 1;
    } else {
      // Numeric part beats a missing/letter part: 1.0.1 > 1.0.1f handling —
      // letter suffixes (f) denote patch levels, so treat letters as greater
      // than nothing but less than the next number.
      return x.n !== undefined ? 1 : -1;
    }
  }
  return 0;
}

/** True if version is within [min, max] inclusive. Missing bounds = open. */
function inRange(version, min, max) {
  if (min && compareVersions(version, min) < 0) return false;
  if (max && compareVersions(version, max) > 0) return false;
  return true;
}

// Curated CVE knowledge base. Each entry: product aliases, affected version
// range, and exploitability context for prioritization. Identification only.
const CVE_DB = [
  {
    cve: 'CVE-2011-2523', title: 'vsftpd 2.3.4 backdoored release', severity: 'Critical', cvss: 9.8,
    products: ['vsftpd'], min: '2.3.4', max: '2.3.4',
    attackVector: 'network', requiresAuth: false, userInteraction: false,
    context: 'Only the trojaned 2.3.4 tarball is affected — confirm the exact version string before treating as actionable.',
  },
  {
    cve: 'CVE-2014-0160', title: 'OpenSSL Heartbleed (TLS heartbeat read overrun)', severity: 'High', cvss: 7.5,
    products: ['openssl'], min: '1.0.1', max: '1.0.1f',
    attackVector: 'network', requiresAuth: false, userInteraction: false,
    context: 'Memory disclosure via TLS heartbeat — verify with a safe heartbeat probe against the captured banner version.',
  },
  {
    cve: 'CVE-2021-41773', title: 'Apache httpd 2.4.49 path traversal / RCE', severity: 'Critical', cvss: 9.8,
    products: ['apache', 'httpd', 'apache httpd'], min: '2.4.49', max: '2.4.49',
    attackVector: 'network', requiresAuth: false, userInteraction: false,
    context: 'Requires mod_cgi enabled for RCE; path traversal works regardless. Only 2.4.49 (and 2.4.50 via CVE-2021-42013).',
  },
  {
    cve: 'CVE-2021-42013', title: 'Apache httpd 2.4.50 path traversal / RCE (incomplete fix)', severity: 'Critical', cvss: 9.8,
    products: ['apache', 'httpd', 'apache httpd'], min: '2.4.50', max: '2.4.50',
    attackVector: 'network', requiresAuth: false, userInteraction: false,
    context: 'Follow-up to CVE-2021-41773; same preconditions.',
  },
  {
    cve: 'CVE-2017-7494', title: 'Samba remote code execution (writable share)', severity: 'Critical', cvss: 9.8,
    products: ['samba'], min: '3.5.0', max: '4.6.4',
    attackVector: 'network', requiresAuth: true, userInteraction: false,
    context: 'Needs a writable share (even anonymous/guest). Confirm share writability before flagging as actionable.',
  },
  {
    cve: 'CVE-2017-5638', title: 'Apache Struts2 Jakarta Multipart RCE', severity: 'Critical', cvss: 10.0,
    products: ['struts', 'struts2', 'apache struts'], min: '2.3.5', max: '2.5.16',
    attackVector: 'network', requiresAuth: false, userInteraction: false,
    context: 'Only Struts 2 apps using the Jakarta multipart parser — confirm framework usage, not just a version string.',
  },
  {
    cve: 'CVE-2018-7600', title: 'Drupalgeddon2 — Drupal core RCE', severity: 'Critical', cvss: 9.8,
    products: ['drupal'], min: '7.0', max: '7.57',
    attackVector: 'network', requiresAuth: false, userInteraction: false,
    context: 'Unauthenticated RCE on Drupal 7 before 7.58 (also 8.x before 8.5.1 — map those separately).',
  },
  {
    cve: 'CVE-2021-44228', title: 'Log4Shell — Log4j JNDI RCE', severity: 'Critical', cvss: 10.0,
    products: ['log4j'], min: '2.0', max: '2.14.1',
    attackVector: 'network', requiresAuth: false, userInteraction: false,
    context: 'Only if the app logs attacker-controlled strings via Log4j2 — version alone is a lead, not proof.',
  },
  {
    cve: 'CVE-2024-6387', title: 'regreSSHion — OpenSSH race condition RCE', severity: 'High', cvss: 8.1,
    products: ['openssh'], min: '8.5p1', max: '9.7p1',
    attackVector: 'network', requiresAuth: false, userInteraction: false,
    context: 'Race condition — exploitation is timing-sensitive and unreliable; version match is a prioritization signal.',
  },
  {
    cve: 'CVE-2019-10149', title: 'Exim RCE (deliver_message)', severity: 'Critical', cvss: 9.8,
    products: ['exim'], min: '4.87', max: '4.91',
    attackVector: 'network', requiresAuth: false, userInteraction: false,
    context: 'Remote command execution as root via crafted recipient address.',
  },
  {
    cve: 'CVE-2010-4221', title: 'ProFTPD 1.3.3c backdoor', severity: 'Critical', cvss: 9.3,
    products: ['proftpd'], min: '1.3.3c', max: '1.3.3c',
    attackVector: 'network', requiresAuth: false, userInteraction: false,
    context: 'Only the trojaned 1.3.3c release — confirm exact version string.',
  },
];

/** Normalize a product name for matching. */
function normalizeProduct(p) {
  return String(p || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Map a fingerprinted product + version to known CVEs with exploitability context.
 * @param {{product: string, version: string, port?: number, service?: string}} input
 */
export function mapVersionToCves({ product, version, port = null, service = null } = {}) {
  const norm = normalizeProduct(product);
  if (!norm) return { product, version, matches: [], confidence: 'none', error: 'No product supplied.' };
  if (!version) {
    return {
      product, version: null, matches: [], confidence: 'low',
      note: 'Version unknown — fingerprint the exact version before CVE mapping; banner-only product matches are not findings.',
    };
  }

  const matches = [];
  for (const entry of CVE_DB) {
    if (!entry.products.some((p) => norm.includes(p) || p.includes(norm))) continue;
    if (!inRange(String(version), entry.min, entry.max)) continue;
    matches.push({
      cve: entry.cve,
      title: entry.title,
      severity: entry.severity,
      cvss: entry.cvss,
      attackVector: entry.attackVector,
      requiresAuth: entry.requiresAuth,
      userInteraction: entry.userInteraction,
      exploitabilityContext: entry.context,
      reference: `https://nvd.nist.gov/vuln/detail/${entry.cve}`,
    });
  }

  matches.sort((a, b) => b.cvss - a.cvss);
  const topSeverity = matches.length ? matches[0].severity : null;

  return {
    product: norm,
    version: String(version),
    port,
    service,
    matchCount: matches.length,
    topSeverity,
    matches,
    confidence: matches.length ? 'high' : 'medium',
    summary: matches.length
      ? `${product} ${version} matches ${matches.length} known CVE(s); highest severity ${topSeverity}. Version match is a lead — confirm exploitability prerequisites before reporting.`
      : `No CVEs in the knowledge base for ${product} ${version} — not known-vulnerable, not proven-safe.`,
  };
}

export const CVE_MAPPER = { mapVersionToCves, compareVersions, CVE_DB };
export default CVE_MAPPER;
