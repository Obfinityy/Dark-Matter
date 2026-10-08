/**
 * smsShortDomainMapper.js — SMS short-domain to campaign-infrastructure mapping.
 *
 * Idea 00883: map the short domains used in SMS campaign links back to the
 * messaging/campaign infrastructure behind them (bulk-SMS vendors, marketing
 * platforms, brand-owned shorteners).
 *
 * The module extracts candidate short domains from SMS text, classifies them
 * against a signature table of known messaging-platform domains, and records
 * per-domain campaign evidence (paths seen, tracking-parameter usage). The
 * signature table is heuristic and documented as such; classification never
 * contacts the network.
 */

/**
 * Heuristic signature table: short-domain pattern → vendor/platform.
 * Patterns are regular expressions matched against the lowercase host.
 */
export const SMS_VENDOR_SIGNATURES = [
  { pattern: /(?:^|\.)att\.cm$/i, vendor: 'AT&T Messaging', type: 'carrier-shortcode' },
  { pattern: /(?:^|\.)txt\.att\.net$/i, vendor: 'AT&T Messaging', type: 'carrier-gateway' },
  { pattern: /(?:^|\.)vzw\.com$/i, vendor: 'Verizon Messaging', type: 'carrier-shortcode' },
  { pattern: /(?:^|\.)tmobile\.com$/i, vendor: 'T-Mobile Messaging', type: 'carrier-shortcode' },
  { pattern: /(?:^|\.)twilio\.com$/i, vendor: 'Twilio', type: 'cpass' },
  { pattern: /(?:^|\.)sms\.twilio\.com$/i, vendor: 'Twilio', type: 'cpass' },
  { pattern: /(?:^|\.)sendgrid\.net$/i, vendor: 'Twilio SendGrid', type: 'esp-link' },
  { pattern: /(?:^|\.)mailchimp\.com$/i, vendor: 'Mailchimp', type: 'esp-link' },
  { pattern: /(?:^|\.)list-manage\.com$/i, vendor: 'Mailchimp', type: 'esp-link' },
  { pattern: /(?:^|\.)klaviyo\.com$/i, vendor: 'Klaviyo', type: 'esp-link' },
  { pattern: /(?:^|\.)braze\.com$/i, vendor: 'Braze', type: 'esp-link' },
  { pattern: /(?:^|\.)iterable\.com$/i, vendor: 'Iterable', type: 'esp-link' },
  { pattern: /(?:^|\.)sfmc\.email$/i, vendor: 'Salesforce Marketing Cloud', type: 'esp-link' },
  { pattern: /(?:^|\.)exacttarget\.com$/i, vendor: 'Salesforce Marketing Cloud', type: 'esp-link' },
  { pattern: /(?:^|\.)hubspot\.com$/i, vendor: 'HubSpot', type: 'esp-link' },
  { pattern: /(?:^|\.)marketo\.com$/i, vendor: 'Adobe Marketo', type: 'esp-link' },
  { pattern: /(?:^|\.)bit\.ly$/i, vendor: 'Bitly', type: 'public-shortener' },
  { pattern: /(?:^|\.)tinyurl\.com$/i, vendor: 'TinyURL', type: 'public-shortener' },
  { pattern: /(?:^|\.)t\.co$/i, vendor: 'X/Twitter', type: 'platform-shortener' },
  { pattern: /(?:^|\.)lnkd\.in$/i, vendor: 'LinkedIn', type: 'platform-shortener' },
  { pattern: /(?:^|\.)goo\.gl$/i, vendor: 'Google (legacy)', type: 'public-shortener' },
];

/** Query parameters typical of campaign tracking on short links. */
export const CAMPAIGN_PARAM_RE = /utm_|^cid$|^sid$|gclid|fbclid|msclkid|_branch|branch_|mkt_tok/i;

/**
 * Extract bare domains/hosts from SMS text (URLs with or without scheme).
 * @param {string} text
 * @returns {string[]}
 */
export function extractSmsHosts(text = '') {
  const out = new Set();
  const re = /(?:https?:\/\/)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\/[^\s<>"']*)?)/gi;
  let m;
  while ((m = re.exec(String(text))) !== null) {
    const host = m[1].split('/')[0].toLowerCase();
    if (host.includes('.')) out.add(host);
  }
  return [...out];
}

/**
 * A domain counts as "short" for SMS purposes when its registrable part is
 * compact — a common signal of campaign shorteners.
 * @param {string} host
 * @returns {boolean}
 */
export function looksLikeShortDomain(host = '') {
  const h = String(host).toLowerCase();
  const first = h.split('.').slice(0, -1).join('');
  if (first.length <= 6) return true;
  return /^(txt|txts|sms|lnk|go|m|t|u|clik|clk|info|msg|deal|offer)/i.test(h);
}

/**
 * Classify a host against the vendor signature table.
 * @param {string} host
 * @returns {{vendor: string|null, type: string|null, matched: boolean}}
 */
export function classifySmsHost(host = '') {
  const h = String(host).toLowerCase();
  for (const sig of SMS_VENDOR_SIGNATURES) {
    if (sig.pattern.test(h)) {
      return { vendor: sig.vendor, type: sig.type, matched: true };
    }
  }
  return { vendor: null, type: null, matched: false };
}

/**
 * Map SMS short domains in message text to campaign infrastructure.
 * @param {string} smsText - One SMS body, or many concatenated with newlines.
 * @returns {{domains: object[], stats: object}}
 */
export function mapSmsShortDomains(smsText = '') {
  const hosts = extractSmsHosts(smsText);
  const domains = [];
  for (const host of hosts) {
    const cls = classifySmsHost(host);
    const hasTracking = CAMPAIGN_PARAM_RE.test(String(smsText));
    domains.push({
      kind: 'sms-short-domain',
      host,
      short: looksLikeShortDomain(host),
      vendor: cls.vendor,
      infraType: cls.type,
      signatureMatched: cls.matched,
      campaignTrackingPresent: hasTracking,
      evidence:
        cls.matched
          ? `Host matches ${cls.vendor} signature (${cls.type}).`
          : 'No vendor signature matched; treated as brand-owned or unknown shortener.',
    });
  }
  const vendors = new Set();
  for (const d of domains) if (d.vendor) vendors.add(d.vendor);
  return {
    domains,
    stats: {
      total: domains.length,
      short: domains.filter(d => d.short).length,
      signatureMatched: domains.filter(d => d.signatureMatched).length,
      distinctVendors: vendors.size,
      vendors: [...vendors],
    },
  };
}

/**
 * Build a report finding from an SMS short-domain map.
 * @param {ReturnType<typeof mapSmsShortDomains>} result
 */
export function smsShortDomainFinding(result) {
  return {
    title: `SMS short-domain mapping — ${result.stats.total} domain(s), ${result.stats.distinctVendors} vendor(s)`,
    severity: 'Info',
    confidence: result.stats.signatureMatched > 0 ? 'high' : 'medium',
    stats: result.stats,
    evidence:
      `${result.stats.total} short-domain candidate(s) mapped; ` +
      `vendors observed: ${result.stats.vendors.join(', ') || 'none'}.`,
  };
}

export const SMS_SHORT_DOMAIN_MAPPER = {
  extractSmsHosts,
  looksLikeShortDomain,
  classifySmsHost,
  mapSmsShortDomains,
  smsShortDomainFinding,
};
export default SMS_SHORT_DOMAIN_MAPPER;
