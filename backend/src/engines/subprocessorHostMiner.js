/**
 * subprocessorHostMiner.js — Sub-processor list host mining.
 *
 * Idea 00907: extract sub-processor domains from privacy pages on an
 * authorized target.
 *
 * No network calls: the module takes operator-supplied privacy-page text
 * (HTML or markdown), finds sub-processor/vendor tables and lists, extracts
 * domains, and classifies each host by provider category so the hunter can
 * map the target's disclosed third-party surface. Defensive recon only.
 */

const PROVIDER_CATEGORIES = [
  { category: 'cloud-hosting', patterns: [/aws|amazon web services/i, /azure|microsoft/i, /google cloud|gcp/i, /cloudflare/i, /akamai/i, /fastly/i, /digitalocean/i, /heroku/i, /vercel/i, /netlify/i, /oracle cloud/i, /ibm cloud/i, /ovh/i, /hetzner/i, /linode/i] },
  { category: 'payments', patterns: [/stripe/i, /paypal/i, /braintree/i, /adyen/i, /razorpay/i, /checkout\.com/i, /paddle/i] },
  { category: 'email', patterns: [/sendgrid/i, /mailgun/i, /mailchimp/i, /ses|simple email/i, /postmark/i, /sendinblue|brevo/i, /customer\.io/i] },
  { category: 'analytics', patterns: [/google analytics|ga4/i, /mixpanel/i, /amplitude/i, /segment\.io|segment\b/i, /hotjar/i, /snowplow/i, /matomo/i, /posthog/i] },
  { category: 'support-crm', patterns: [/salesforce/i, /hubspot/i, /zendesk/i, /intercom/i, /freshdesk/i, /drift/i] },
  { category: 'identity', patterns: [/auth0/i, /okta/i, /cognito/i, /firebase auth/i, /clerk/i] },
  { category: 'data-storage', patterns: [/mongodb/i, /redis/i, /snowflake/i, /datadog/i, /s3/i, /bigquery/i, /elasticsearch/i] },
  { category: 'cdn-security', patterns: [/imperva/i, /sucuri/i, /stackpath/i, /bunny/i, /incapsula/i] },
];

const DOMAIN_RE =
  /(?:https?:\/\/)?(?:www\.)?([a-z0-9][a-z0-9\-]{0,61}\.[a-z0-9.\-]{2,}(?:\.[a-z]{2,})?)/gi;

const IMAGE_EXT = /\.(png|jpe?g|svg|gif|webp|ico|css|js)$/i;

/**
 * @typedef {Object} SubprocessorHost
 * @property {string} domain - Extracted domain.
 * @property {string|null} provider - Matched known provider name.
 * @property {string} category - Provider category ('unknown' when unmatched).
 * @property {string} evidence - Source excerpt.
 */

/**
 * Extract sub-processor domains from privacy-page text.
 * @param {string} pageText - Privacy page HTML or markdown.
 * @param {{maxHosts?: number}} [options]
 * @returns {{hosts: SubprocessorHost[], categories: object, stats: object}}
 */
export function mineSubprocessorHosts(pageText = '', options = {}) {
  const { maxHosts = 100 } = options;
  const text = String(pageText);
  const hosts = [];
  const seen = new Set();

  const categorize = context => {
    for (const { category, patterns } of PROVIDER_CATEGORIES) {
      const hit = patterns.find(re => re.test(context));
      if (hit) return { category, provider: context.match(hit)?.[0] || null };
    }
    return { category: 'unknown', provider: null };
  };

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (hosts.length >= maxHosts) break;
    // Only consider lines that look like sub-processor listings:
    // tables, list items, or lines mentioning vendor/provider/process.
    const looksLikeListing =
      /^\s*[|*\-•\d.]/.test(raw) ||
      /<(?:td|li|tr|a)\b/i.test(line) ||
      /sub-?processor|service[_-]?provider|third[_-]?party|vendor|data[_-]?processor/i.test(line);
    if (!looksLikeListing) continue;

    DOMAIN_RE.lastIndex = 0;
    let m;
    while ((m = DOMAIN_RE.exec(line)) !== null && hosts.length < maxHosts) {
      let domain = m[1].toLowerCase().replace(/\.$/, '');
      if (IMAGE_EXT.test(domain) || domain.length < 4 || domain.length > 80) continue;
      if (seen.has(domain)) continue;
      seen.add(domain);
      const { category, provider } = categorize(line);
      hosts.push({
        domain,
        provider,
        category,
        evidence: line.slice(0, 200),
      });
    }
  }

  const categories = {};
  for (const h of hosts) categories[h.category] = (categories[h.category] || 0) + 1;

  return {
    hosts,
    categories,
    known: hosts.filter(h => h.category !== 'unknown'),
    unknown: hosts.filter(h => h.category === 'unknown'),
    stats: {
      hosts: hosts.length,
      known: hosts.filter(h => h.category !== 'unknown').length,
      categories: Object.keys(categories).length,
      lines: lines.length,
    },
  };
}

/**
 * Build a report finding from the mining result.
 * @param {ReturnType<typeof mineSubprocessorHosts>} result
 */
export function subprocessorFinding(result) {
  return {
    title: `Sub-processor host mining — ${result.stats.hosts} host(s), ${result.stats.known} mapped to known providers`,
    severity: 'Info',
    confidence: result.stats.hosts > 0 ? 'high' : 'low',
    categories: result.categories,
    hosts: result.hosts.slice(0, 30).map(h => ({
      domain: h.domain,
      provider: h.provider,
      category: h.category,
    })),
    evidence:
      `${result.stats.hosts} sub-processor domain(s) extracted from the privacy page; ` +
      `${result.stats.known} matched known provider categories.`,
  };
}

export const SUBPROCESSOR_HOST_MINER = {
  mineSubprocessorHosts,
  subprocessorFinding,
  PROVIDER_CATEGORIES,
};
export default SUBPROCESSOR_HOST_MINER;
