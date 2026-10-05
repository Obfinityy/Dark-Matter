/**
 * lmsPlatformHostDiscovery.js — LMS platform host discovery engine.
 *
 * @idea 00287 — LMS platform host discovery — find Teachable/Thinkific/
 *   Kajabi course hosts tied to the org's training brand.
 *
 * Orgs deliver training on Teachable (teachable.com schools),
 * Thinkific (thinkific.com / thinkific.com subdomains or custom domains)
 * and Kajabi (mycourses / kajabi sites). This engine identifies LMS
 * hosting from DNS CNAME evidence and from platform asset fingerprints in
 * page HTML, and attributes the school to the org's training brand.
 *
 * Pure functions only: callers fetch DNS records and page HTML themselves.
 * No live network calls here.
 */

const LMS_VENDOR_PATTERNS = [
  { vendor: 'Teachable', re: /\.teachable\.com$/i, note: 'Teachable school subdomain' },
  { vendor: 'Teachable', re: /\.teachablecdn\.com$/i, note: 'Teachable CDN assets' },
  { vendor: 'Thinkific', re: /\.thinkific\.com$/i, note: 'Thinkific course site' },
  { vendor: 'Thinkific', re: /\.thinkific\.com\.cdn/i, note: 'Thinkific CDN assets' },
  { vendor: 'Kajabi', re: /\.kajabi\.com$/i, note: 'Kajabi site subdomain' },
  { vendor: 'Kajabi', re: /\.mykajabi\.com$/i, note: 'Kajabi legacy site subdomain' },
  { vendor: 'Kajabi', re: /\.kajabicdn\.com$/i, note: 'Kajabi CDN assets' },
  { vendor: 'Podia', re: /\.podia\.com$/i, note: 'Podia storefront' },
  { vendor: 'LearnWorlds', re: /\.learnworlds\.com$/i, note: 'LearnWorlds school' },
  { vendor: 'LearnDash-Cloud', re: /\.learndash\.com$/i, note: 'LearnDash cloud site' },
];

const LMS_HTML_FINGERPRINTS = [
  { vendor: 'Teachable', re: /teachable|fedora|school-\d+/i, note: 'Teachable asset/marker fingerprint' },
  { vendor: 'Thinkific', re: /thinkific|thinkific_api|CoursePlayer/i, note: 'Thinkific asset/marker fingerprint' },
  { vendor: 'Kajabi', re: /kajabi|Kajabi\.|kajabi-styles/i, note: 'Kajabi asset/marker fingerprint' },
  { vendor: 'Podia', re: /podia/i, note: 'Podia fingerprint' },
  { vendor: 'LearnWorlds', re: /learnworlds/i, note: 'LearnWorlds fingerprint' },
];

/**
 * Normalize a hostname: lowercase, strip scheme, port, trailing dot.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHostname(host) {
  if (!host) return '';
  return String(host)
    .trim()
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Classify a hostname as LMS-platform infrastructure.
 * @param {string} host
 * @returns {{isLms: boolean, vendor: string, note: string, host: string}}
 */
export function classifyLmsHost(host) {
  const h = normalizeHostname(host);
  for (const { vendor, re, note } of LMS_VENDOR_PATTERNS) {
    if (re.test(h)) return { isLms: true, vendor, note, host: h };
  }
  return { isLms: false, vendor: '', note: '', host: h };
}

/**
 * Extract LMS platform signals from page HTML: platform fingerprints,
 * school/course names from branding metadata, and course URL hints.
 * @param {string} html page HTML
 * @returns {{vendors: {vendor: string, note: string}[], schoolName: string, title: string, coursePaths: string[]}}
 */
export function extractLmsSignals(html) {
  const text = String(html || '');
  const vendors = [];
  const seenVendors = new Set();
  for (const { vendor, re, note } of LMS_HTML_FINGERPRINTS) {
    if (re.test(text) && !seenVendors.has(vendor)) {
      seenVendors.add(vendor);
      vendors.push({ vendor, note });
    }
  }

  let schoolName = '';
  const namePatterns = [
    /<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i,
    /school\.name\s*=\s*["']([^"']+)/i,
    /["']siteName["']\s*:\s*["']([^"']+)/i,
  ];
  for (const re of namePatterns) {
    const m = text.match(re);
    if (m) {
      schoolName = m[1].trim();
      break;
    }
  }

  let title = '';
  const titleMatch = text.match(/<title>([^<]{1,160})<\/title>/i);
  if (titleMatch) title = titleMatch[1].replace(/\s+/g, ' ').trim();

  const coursePaths = new Set();
  const pathRe = /href=["'](\/(?:courses?|academy|learn|training|school)[a-z0-9/_.-]{0,120})["']/gi;
  let m;
  while ((m = pathRe.exec(text)) !== null) {
    coursePaths.add(m[1]);
    if (coursePaths.size >= 20) break;
  }

  return { vendors, schoolName, title, coursePaths: [...coursePaths] };
}

/**
 * Discover LMS-hosted training sites from DNS CNAME records.
 * @param {{query: string, type: string, value: string}[]} records DNS records
 *   already fetched by the caller (CNAME)
 * @returns {{query: string, vendor: string, target: string, note: string, confidence: string}[]}
 */
export function discoverLmsHostsFromDns(records) {
  const findings = [];
  const seen = new Set();
  for (const r of records || []) {
    if (!r || !r.value) continue;
    if (String(r.type || '').toUpperCase() !== 'CNAME') continue;
    const verdict = classifyLmsHost(r.value);
    if (!verdict.isLms) continue;
    const query = normalizeHostname(r.query);
    if (seen.has(query)) continue;
    seen.add(query);
    findings.push({
      query,
      vendor: verdict.vendor,
      target: verdict.host,
      note: verdict.note,
      confidence: 'high',
    });
  }
  return findings;
}

/**
 * Full discovery: merge DNS evidence with page-HTML platform evidence and
 * attribute each school to the org's training brand.
 * @param {{query: string, type: string, value: string}[]} dnsRecords
 * @param {{query: string, html: string}[]} pages page HTML per hostname
 * @returns {{query: string, lmsDetected: boolean, vendors: string[], schoolName: string, dnsEvidence: object|null, pageEvidence: object, brandConfidence: string}[]}
 */
export function discoverLmsPlatformHosts(dnsRecords, pages) {
  const dnsHits = new Map(
    discoverLmsHostsFromDns(dnsRecords).map((f) => [f.query, f])
  );
  const pageQueries = new Set((pages || []).map((p) => normalizeHostname(p.query)));
  const allQueries = new Set([...dnsHits.keys(), ...pageQueries]);
  const results = [];

  for (const query of allQueries) {
    const page = (pages || []).find((p) => normalizeHostname(p.query) === query);
    const signals = extractLmsSignals(page ? page.html : '');
    const dnsHit = dnsHits.get(query) || null;
    const vendorSet = new Set(signals.vendors.map((v) => v.vendor));
    if (dnsHit) vendorSet.add(dnsHit.vendor);
    const lmsDetected = Boolean(dnsHit || signals.vendors.length > 0);
    const brandConfidence =
      signals.schoolName ? 'high' : dnsHit ? 'medium' : lmsDetected ? 'low' : 'none';
    results.push({
      query,
      lmsDetected,
      vendors: [...vendorSet],
      schoolName: signals.schoolName || signals.title,
      dnsEvidence: dnsHit,
      pageEvidence: signals,
      brandConfidence,
    });
  }
  return results;
}
