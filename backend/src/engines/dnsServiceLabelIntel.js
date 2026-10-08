/**
 * dnsServiceLabelIntel.js — Underscore-label & service-challenge analyzers
 * (ideas 00094, 00095, 00096).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. DNS labels
 * that begin with an underscore (`_dmarc`, `_acme-challenge`,
 * `_github-challenge`, …) are never user-facing hostnames — they are
 * service-integration markers. Mining them exposes the target's SaaS and
 * certificate tooling, and leftover challenge records reveal which hosts
 * recently proved domain control.
 *
 * All functions are pure: they analyze observed DNS record data supplied by
 * the caller and never perform network lookups themselves.
 */

/**
 * Known underscore-prefixed service labels and what each one discloses.
 * Maps the underscored label (without any transport prefix like `_tcp`)
 * to its service and the intelligence it yields.
 */
export const UNDERSCORE_SERVICE_MAP = {
  _dmarc: {
    service: 'DMARC',
    category: 'email-security',
    intel:
      'Email authentication policy; reporting addresses (rua/ruf) often point at security-team mailboxes.',
  },
  '_acme-challenge': {
    service: 'ACME (certificate issuance)',
    category: 'pki',
    intel:
      'DNS-01 challenge label — leftover TXT tokens reveal which hosts recently requested certificates.',
  },
  '_github-challenge': {
    service: 'GitHub Pages',
    category: 'hosting',
    intel:
      'Domain verification for GitHub Pages — the parent host is (or was) served from GitHub Pages.',
  },
  '_atlassian-domain-verification': {
    service: 'Atlassian Cloud',
    category: 'saas',
    intel: 'Confirms an Atlassian Cloud tenancy tied to this domain.',
  },
  '_gitlab-pages-verification': {
    service: 'GitLab Pages',
    category: 'hosting',
    intel: 'Domain verification for GitLab Pages hosting.',
  },
  _amazonses: {
    service: 'Amazon SES',
    category: 'email',
    intel: 'Authorizes Amazon SES to send mail for the domain — confirms AWS mail infrastructure.',
  },
  _mailgun: {
    service: 'Mailgun',
    category: 'email',
    intel: 'Mailgun sending authorization — exposes mail-provider integration.',
  },
  _sendgrid: {
    service: 'SendGrid',
    category: 'email',
    intel: 'SendGrid sending authorization — exposes mail-provider integration.',
  },
  _mandrill: {
    service: 'Mandrill',
    category: 'email',
    intel: 'Mandrill sending authorization — exposes mail-provider integration.',
  },
  _hubspot: {
    service: 'HubSpot',
    category: 'marketing',
    intel: 'HubSpot domain connection — marketing-site linkage.',
  },
  '_mta-sts': {
    service: 'MTA-STS',
    category: 'email-security',
    intel: 'Mail transport security policy host.',
  },
  '_smtp._tls': {
    service: 'TLS-RPT / DANE',
    category: 'email-security',
    intel: 'TLS reporting endpoint for mail.',
  },
  '_dmarc-report': {
    service: 'DMARC reporting',
    category: 'email-security',
    intel: 'Aggregate DMARC report destination.',
  },
  _autodiscover: {
    service: 'Microsoft Exchange',
    category: 'email',
    intel: 'Exchange Autodiscover — confirms Microsoft 365 / Exchange tenancy.',
  },
  '_sip._tcp': {
    service: 'SIP',
    category: 'voip',
    intel: 'SIP service location — VoIP infrastructure.',
  },
  '_sip._tls': {
    service: 'SIP/TLS',
    category: 'voip',
    intel: 'SIP-over-TLS endpoint — VoIP infrastructure.',
  },
  _sipfederationtls: {
    service: 'Microsoft Teams federation',
    category: 'voip',
    intel: 'Teams/Skype federation endpoint — confirms Microsoft 365 voice.',
  },
  _caldav: { service: 'CalDAV', category: 'collaboration', intel: 'Calendar service endpoint.' },
  _carddav: { service: 'CardDAV', category: 'collaboration', intel: 'Contacts service endpoint.' },
  _jabber: { service: 'XMPP', category: 'messaging', intel: 'XMPP/Jabber endpoint.' },
  '_xmpp-server': {
    service: 'XMPP server',
    category: 'messaging',
    intel: 'XMPP server federation endpoint.',
  },
  _matrix: {
    service: 'Matrix',
    category: 'messaging',
    intel: 'Matrix homeserver federation marker.',
  },
  '_pki-validation': {
    service: 'Certificate validation',
    category: 'pki',
    intel: 'Generic CA domain-validation label — a CA recently validated this domain.',
  },
  _digicert: { service: 'DigiCert', category: 'pki', intel: 'DigiCert validation marker.' },
  _comodoca: {
    service: 'Sectigo/Comodo',
    category: 'pki',
    intel: 'Sectigo domain-control validation marker.',
  },
  _zerossl: { service: 'ZeroSSL', category: 'pki', intel: 'ZeroSSL validation marker.' },
  _globalsign: { service: 'GlobalSign', category: 'pki', intel: 'GlobalSign validation marker.' },
  _dnsauth: {
    service: 'DNS-based validation',
    category: 'pki',
    intel: 'Generic DNS ownership-validation label.',
  },
  '_cf-custom-hostname': {
    service: 'Cloudflare',
    category: 'cdn',
    intel: 'Cloudflare custom-hostname (SSL for SaaS) verification.',
  },
  _herokussl: {
    service: 'Heroku',
    category: 'hosting',
    intel: 'Heroku SSL endpoint verification.',
  },
  _netlify: { service: 'Netlify', category: 'hosting', intel: 'Netlify domain verification.' },
  _vercel: { service: 'Vercel', category: 'hosting', intel: 'Vercel domain verification.' },
  _webflow: { service: 'Webflow', category: 'hosting', intel: 'Webflow domain verification.' },
  '_apple-challenge': {
    service: 'Apple',
    category: 'vendor',
    intel: 'Apple domain verification (Business Manager / Wallet).',
  },
  _statuspage: {
    service: 'Atlassian Statuspage',
    category: 'saas',
    intel: 'Statuspage verification — confirms a public status page.',
  },
  '_cisco-uds': {
    service: 'Cisco UDS',
    category: 'voip',
    intel: 'Cisco Unified Data Service marker.',
  },
  _kerberos: {
    service: 'Kerberos',
    category: 'auth',
    intel: 'Kerberos service location — on-prem identity infrastructure.',
  },
  _ldap: {
    service: 'LDAP',
    category: 'auth',
    intel: 'LDAP service location — directory infrastructure.',
  },
  _ntp: { service: 'NTP', category: 'infra', intel: 'Time-service location record.' },
  _stun: { service: 'STUN', category: 'voip', intel: 'STUN server marker for WebRTC/VoIP.' },
  _turn: { service: 'TURN', category: 'voip', intel: 'TURN relay marker for WebRTC/VoIP.' },
};

/**
 * Idea 00094 — Underscore-label service mining.
 *
 * Scans observed DNS owner names for underscore-prefixed labels
 * (`_dmarc`, `_acme-challenge`, `_github-challenge`, …) and maps each one
 * to the service integration it exposes, including any hostnames or
 * endpoints leaked in the record data.
 *
 * @param {Array<{ name: string, type?: string, data?: string }>} records
 *   Observed DNS records with owner `name` (e.g. `_dmarc.example.com`).
 * @returns {{
 *   integrations: Array<{ name: string, label: string, service: string, category: string, intel: string, exposedValues: string[] }>,
 *   unknownLabels: Array<{ name: string, label: string, detail: string }>,
 *   summary: { total: number, byCategory: Record<string, number> }
 * }}
 */
export function mineUnderscoreLabels(records) {
  const integrations = [];
  const unknownLabels = [];
  const byCategory = {};

  for (const r of records || []) {
    const name = String(r?.name || '')
      .toLowerCase()
      .replace(/\.$/, '');
    if (!name) continue;
    const labels = name.split('.');
    const underIdx = labels.findIndex(l => l.startsWith('_'));
    if (underIdx === -1) continue;

    // Match the longest known service key against the underscored prefix,
    // e.g. `_smtp._tls.example.com` → `_smtp._tls`.
    const prefix = labels.slice(underIdx, underIdx + 2).join('.');
    const single = labels[underIdx];
    const key = UNDERSCORE_SERVICE_MAP[prefix]
      ? prefix
      : UNDERSCORE_SERVICE_MAP[single]
        ? single
        : null;
    const data = String(r?.data ?? '');

    if (key) {
      const svc = UNDERSCORE_SERVICE_MAP[key];
      byCategory[svc.category] = (byCategory[svc.category] || 0) + 1;
      integrations.push({
        name,
        label: key,
        service: svc.service,
        category: svc.category,
        intel: svc.intel,
        exposedValues: data ? [data] : [],
        detail: `'${name}' exposes a ${svc.service} integration (${svc.category}). ${svc.intel}`,
      });
    } else {
      unknownLabels.push({
        name,
        label: labels.slice(underIdx).join('.'),
        detail:
          `Unrecognized underscore label '${single}' under '${name}' — a custom or ` +
          'less-common service marker. Investigate the record data; bespoke underscore ' +
          'labels frequently belong to internal tooling with verbose verification strings.',
      });
    }
  }

  return {
    integrations,
    unknownLabels,
    summary: { total: integrations.length, byCategory },
  };
}

/**
 * Unquote and flatten TXT record data: `"v=spf1 …" "more"` → `v=spf1 …more`.
 * @param {string} data
 */
export function flattenTxtData(data) {
  return String(data || '')
    .split(/"\s*"/)
    .map(s => s.replace(/^"|"$/g, ''))
    .join('');
}

/**
 * Idea 00095 — ACME-challenge TXT residue.
 *
 * Collects TXT records published under `_acme-challenge.<host>` labels.
 * Each token is residue from a DNS-01 certificate request: its presence
 * proves that `<host>` recently asked a CA for a certificate, which maps
 * hosts the organization considers worth encrypting — including internal
 * or staging names that never appear in CT logs with the same visibility.
 *
 * @param {Array<{ name: string, type?: string, data?: string }>} records
 * @returns {Array<{ host: string, token: string, detail: string }>}
 */
export function analyzeAcmeResidue(records) {
  const hits = [];

  for (const r of records || []) {
    const name = String(r?.name || '')
      .toLowerCase()
      .replace(/\.$/, '');
    const m = name.match(/^_acme-challenge\.(.+)$/);
    if (!m) continue;
    if (String(r?.type || 'TXT').toUpperCase() !== 'TXT') continue;

    const token = flattenTxtData(r.data).trim();
    if (!token) continue;
    hits.push({
      host: m[1],
      token,
      detail:
        `ACME DNS-01 residue: '${m[1]}' published a challenge token, proving a recent ` +
        'certificate request for that exact host. Hosts that request certificates are ' +
        'hosts the organization actively operates — pivot this name into subdomain ' +
        'enumeration and CT-log searches.',
    });
  }

  return hits;
}

/**
 * Idea 00096 — GitHub-challenge TXT discovery.
 *
 * Collects TXT records under `_github-challenge.<host>` labels. A token
 * here proves the owner verified domain control with GitHub Pages, which
 * means the host is (or was) backed by a GitHub Pages site — a static
 * asset surface that frequently leaks repository names, internal docs,
 * and staging content.
 *
 * @param {Array<{ name: string, type?: string, data?: string }>} records
 * @returns {Array<{ host: string, token: string, pagesSignal: string, recommendation: string }>}
 */
export function checkGitHubChallenge(records) {
  const hits = [];

  for (const r of records || []) {
    const name = String(r?.name || '')
      .toLowerCase()
      .replace(/\.$/, '');
    const m = name.match(/^_github-challenge\.(.+)$/);
    if (!m) continue;
    if (String(r?.type || 'TXT').toUpperCase() !== 'TXT') continue;

    const token = flattenTxtData(r.data).trim();
    if (!token) continue;
    hits.push({
      host: m[1],
      token,
      pagesSignal:
        `Domain-verification token for GitHub Pages found at '${name}': the owner ` +
        `proved control of '${m[1]}' to GitHub, so this host is Pages-backed (or was at verification time).`,
      recommendation:
        `Resolve '${m[1]}' and check for a *.github.io CNAME or Pages content. ` +
        'Enumerate the backing repository and any published paths — Pages sites routinely ' +
        'expose internal documentation, API specs, and staging builds.',
    });
  }

  return hits;
}
