/**
 * cookiePolicyTrackerInventory.js — Cookie-policy tracker inventory.
 *
 * Idea 00910: inventory the trackers named in a target's cookie policy for
 * authorized recon.
 *
 * No network calls: the module takes operator-supplied cookie-policy text
 * (HTML tables or markdown), extracts declared cookies (name, provider,
 * purpose, duration), and matches cookie names/providers against a built-in
 * knowledge base of well-known tracking technologies to produce a
 * categorized tracker inventory. Defensive disclosure analysis only —
 * everything is read from the target's own published policy.
 */

const KNOWN_TRACKERS = [
  { cookie: /^_ga$|^_ga_[A-Z0-9]+$/, vendor: 'Google Analytics', category: 'analytics', providerHint: /google/i },
  { cookie: /^_gid$|^_gat/, vendor: 'Google Analytics', category: 'analytics', providerHint: /google/i },
  { cookie: /^_fbp$|^_fbc$/, vendor: 'Meta Pixel', category: 'marketing', providerHint: /meta|facebook/i },
  { cookie: /^_gcl_au$|^_gac_/, vendor: 'Google Ads', category: 'marketing', providerHint: /google/i },
  { cookie: /^_hjSession|_hjFirstSeen|_hjIncludedInSessionSample/, vendor: 'Hotjar', category: 'analytics', providerHint: /hotjar/i },
  { cookie: /^_uetvid|^_uetsid/, vendor: 'Microsoft Clarity/Bing Ads', category: 'marketing', providerHint: /microsoft|bing|clarity/i },
  { cookie: /^_clck|^_clsk/, vendor: 'Microsoft Clarity', category: 'analytics', providerHint: /microsoft|clarity/i },
  { cookie: /^_li_sugr|^lidc|^bcookie/, vendor: 'LinkedIn Insight', category: 'marketing', providerHint: /linkedin/i },
  { cookie: /^_pin_unauth|^_pinterest_ct/, vendor: 'Pinterest Tag', category: 'marketing', providerHint: /pinterest/i },
  { cookie: /^_tiktok|^ttclid/, vendor: 'TikTok Pixel', category: 'marketing', providerHint: /tiktok/i },
  { cookie: /^_scid|^_sctr/, vendor: 'Snap Pixel', category: 'marketing', providerHint: /snap/i },
  { cookie: /^_tt_enable_cookie|^_ttp/, vendor: 'TikTok Pixel', category: 'marketing', providerHint: /tiktok/i },
  { cookie: /^_rdt_uuid/, vendor: 'Reddit Pixel', category: 'marketing', providerHint: /reddit/i },
  { cookie: /^_qca|^mc$/, vendor: 'Quantcast', category: 'marketing', providerHint: /quantcast/i },
  { cookie: /^IDE$|^NID$|^AEC$/, vendor: 'Google (DoubleClick)', category: 'marketing', providerHint: /google/i },
  { cookie: /^personalization_id|^guest_id|^ct0$/, vendor: 'X (Twitter) Ads', category: 'marketing', providerHint: /twitter|^x$/i },
  { cookie: /^muxData|^_sp_/, vendor: 'Snowplow', category: 'analytics', providerHint: /snowplow/i },
  { cookie: /^ajs_/, vendor: 'Segment', category: 'analytics', providerHint: /segment/i },
  { cookie: /^mp_|^mixpanel/, vendor: 'Mixpanel', category: 'analytics', providerHint: /mixpanel/i },
  { cookie: /^amplitude_/, vendor: 'Amplitude', category: 'analytics', providerHint: /amplitude/i },
  { cookie: /^ph_/, vendor: 'PostHog', category: 'analytics', providerHint: /posthog/i },
  { cookie: /^intercom-/, vendor: 'Intercom', category: 'functional', providerHint: /intercom/i },
  { cookie: /^_zendesk/, vendor: 'Zendesk', category: 'functional', providerHint: /zendesk/i },
  { cookie: /^hubspot/, vendor: 'HubSpot', category: 'marketing', providerHint: /hubspot/i },
  { cookie: /^__stripe_/, vendor: 'Stripe', category: 'functional', providerHint: /stripe/i },
  { cookie: /^OptanonConsent|^OptanonAlertBoxClosed/, vendor: 'OneTrust', category: 'necessary', providerHint: /onetrust/i },
  { cookie: /^CookieConsent$/, vendor: 'Cookiebot', category: 'necessary', providerHint: /cookiebot/i },
  { cookie: /^osano_consentmanager/, vendor: 'Osano', category: 'necessary', providerHint: /osano/i },
];

/**
 * @typedef {Object} DeclaredCookie
 * @property {string} name - Cookie name.
 * @property {string} provider - Declared provider.
 * @property {string} purpose - Declared purpose text.
 * @property {string} duration - Declared retention.
 * @property {string|null} trackerVendor - Matched known tracker vendor.
 * @property {string} trackerCategory - analytics | marketing | functional | necessary | unknown.
 */

/**
 * Parse declared cookies from a cookie-policy page.
 * Supports HTML tables (<td>/<th> rows) and markdown tables.
 * @param {string} policyText - Cookie policy HTML or markdown.
 * @param {{maxCookies?: number}} [options]
 * @returns {{cookies: DeclaredCookie[], vendors: string[], categories: object, stats: object}}
 */
export function inventoryCookieTrackers(policyText = '', options = {}) {
  const { maxCookies = 300 } = options;
  const text = String(policyText);
  const rows = [];

  // 1) HTML table rows.
  const trRe = /<tr[^>]*>([\s\S]{0,1200}?)<\/tr>/gi;
  let m;
  while ((m = trRe.exec(text)) !== null && rows.length < maxCookies) {
    const cells = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]{0,400}?)<\/t[dh]>/gi)]
      .map(c => c[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim());
    if (cells.length >= 2) rows.push(cells);
  }

  // 2) Markdown table rows.
  if (!rows.length) {
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line.startsWith('|') || /^\|[\s\-:|]+\|$/.test(line)) continue;
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 2) rows.push(cells);
    }
  }

  const cookies = [];
  for (const cells of rows) {
    if (cookies.length >= maxCookies) break;
    const [name = '', provider = '', purpose = '', duration = ''] = cells;
    if (!name || /^cookie|name$/i.test(name)) continue; // header row
    if (!/^[_a-zA-Z0-9.\-]{1,80}$/.test(name)) continue;

    const kb = KNOWN_TRACKERS.find(t => t.cookie.test(name));
    let trackerVendor = kb?.vendor || null;
    let trackerCategory = kb?.category || 'unknown';

    // Provider-hint fallback when the cookie name is not in the base.
    if (!kb) {
      const ph = KNOWN_TRACKERS.find(t => t.providerHint.test(provider));
      if (ph) { trackerVendor = `${ph.vendor} (provider match)`; trackerCategory = ph.category; }
    }

    cookies.push({
      name,
      provider,
      purpose: purpose.slice(0, 200),
      duration: duration.slice(0, 60),
      trackerVendor,
      trackerCategory,
    });
  }

  const vendors = [...new Set(cookies.map(c => c.trackerVendor).filter(Boolean))];
  const categories = {};
  for (const c of cookies) categories[c.trackerCategory] = (categories[c.trackerCategory] || 0) + 1;

  return {
    cookies,
    vendors,
    categories,
    trackers: cookies.filter(c => c.trackerVendor),
    firstParty: cookies.filter(c => !c.trackerVendor),
    stats: {
      cookies: cookies.length,
      matchedTrackers: cookies.filter(c => c.trackerVendor).length,
      vendors: vendors.length,
      rows: rows.length,
    },
  };
}

/**
 * Build a report finding from the inventory result.
 * @param {ReturnType<typeof inventoryCookieTrackers>} result
 */
export function cookieTrackerFinding(result) {
  return {
    title: `Cookie-policy tracker inventory — ${result.stats.cookies} declared cookie(s), ${result.stats.matchedTrackers} matched to known trackers`,
    severity: 'Info',
    confidence: result.stats.cookies > 0 ? 'high' : 'low',
    categories: result.categories,
    vendors: result.vendors.slice(0, 30),
    trackers: result.trackers.slice(0, 40).map(t => ({
      name: t.name,
      vendor: t.trackerVendor,
      category: t.trackerCategory,
      duration: t.duration,
    })),
    evidence:
      `${result.stats.cookies} cookie declaration(s) parsed; ` +
      `${result.stats.matchedTrackers} matched to known tracker vendors.`,
  };
}

export const COOKIE_POLICY_TRACKER_INVENTORY = {
  inventoryCookieTrackers,
  cookieTrackerFinding,
  KNOWN_TRACKERS,
};
export default COOKIE_POLICY_TRACKER_INVENTORY;
