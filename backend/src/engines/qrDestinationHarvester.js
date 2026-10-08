/**
 * qrDestinationHarvester.js — QR-code destination harvesting.
 *
 * Idea 00884: decode QR codes published on a target's site for the URLs they
 * encode — without leaving the machine.
 *
 * QR payloads are recovered in two ways, both local:
 *  1. From markup: QR generator services embed the payload in the image URL
 *     (api.qrserver.com `chl=`, chart.googleapis.com `cht=qr&chl=`), and
 *     hand-rolled implementations often stash it in data-* attributes.
 *  2. From operator-supplied decoded payloads (the operator scans/decodes the
 *     code and passes the text in), which the module classifies and maps.
 *
 * No image decoding and no network calls happen inside this module.
 */

/** QR generator services whose image URLs embed the encoded payload. */
export const QR_SERVICE_PATTERNS = [
  {
    name: 'goqr.me (api.qrserver.com)',
    host: /api\.qrserver\.com/i,
    payloadParam: 'chl',
  },
  {
    name: 'Google Chart API (legacy)',
    host: /chart\.googleapis\.com/i,
    payloadParam: 'chl',
  },
  {
    name: 'quickchart.io',
    host: /quickchart\.io/i,
    payloadParam: 'text',
  },
];

/**
 * Extract candidate QR-bearing elements from HTML: <img>/<svg>/<canvas>
 * tags whose attributes hint at QR codes, plus any data-* payload attributes.
 * @param {string} html
 * @returns {object[]}
 */
export function findQrElements(html = '') {
  const out = [];
  const tagRe = /<(img|svg|canvas|a|div)\b([^<>]*)>/gi;
  let m;
  while ((m = tagRe.exec(String(html))) !== null) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    const get = name => {
      const am = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(attrs);
      return am ? am[1] : null;
    };
    const src = get('src') || get('data-src') || get('href') || '';
    const alt = get('alt') || '';
    const cls = get('class') || '';
    const id = get('id') || '';
    const hintText = `${src} ${alt} ${cls} ${id}`.toLowerCase();
    if (!/\bqr\b|qrcode|qr-code|qrcodegen|matrix-code/.test(hintText)) continue;
    const payloadAttrs = {};
    const dataRe = /\bdata-(?:[a-z]+-)?(url|payload|qr|qrcode|link|href|text)\s*=\s*["']([^"']*)["']/gi;
    let dm;
    while ((dm = dataRe.exec(attrs)) !== null) payloadAttrs[dm[1]] = dm[2];
    out.push({
      kind: 'qr-element',
      tag,
      src: src || null,
      alt: alt || null,
      payloadAttrs,
      outer: m[0].slice(0, 220),
    });
  }
  return out;
}

/**
 * Recover the encoded payload from a QR generator service URL.
 * @param {string} src
 * @returns {{service: string, payload: string}|null}
 */
export function payloadFromServiceUrl(src = '') {
  let url;
  try {
    url = new URL(String(src), 'https://placeholder.invalid');
  } catch {
    return null;
  }
  for (const svc of QR_SERVICE_PATTERNS) {
    if (!svc.host.test(url.hostname)) continue;
    const payload = url.searchParams.get(svc.payloadParam);
    if (payload) return { service: svc.name, payload };
  }
  return null;
}

/**
 * Classify a decoded QR payload.
 * @param {string} payload
 * @returns {{type: 'url'|'wifi'|'vcard'|'sms'|'tel'|'email'|'geo'|'text', value: string, url: string|null}}
 */
export function classifyQrPayload(payload = '') {
  const p = String(payload).trim();
  const url = /^https?:\/\/\S+$/i.test(p) ? p : null;
  if (url) return { type: 'url', value: p, url };
  if (/^WIFI:/i.test(p)) return { type: 'wifi', value: p, url: null };
  if (/^BEGIN:VCARD/i.test(p)) return { type: 'vcard', value: p, url: null };
  if (/^SMSTO:/i.test(p)) return { type: 'sms', value: p, url: null };
  if (/^TEL:/i.test(p)) return { type: 'tel', value: p, url: null };
  if (/^MATMSG:TO:/i.test(p)) return { type: 'email', value: p, url: null };
  if (/^geo:/i.test(p)) return { type: 'geo', value: p, url: null };
  return { type: 'text', value: p, url: null };
}

/**
 * Harvest QR destinations from page HTML plus optional decoded payloads.
 * @param {string} html - Page HTML containing QR code elements.
 * @param {string[]} [decodedPayloads] - Operator-supplied decoded QR texts.
 * @returns {{destinations: object[], stats: object}}
 */
export function harvestQrDestinations(html = '', decodedPayloads = []) {
  const elements = findQrElements(html);
  const destinations = [];
  const seen = new Set();

  const record = (source, payload, service = null) => {
    if (!payload || seen.has(payload)) return;
    seen.add(payload);
    const cls = classifyQrPayload(payload);
    destinations.push({
      kind: 'qr-destination',
      source,
      service,
      payload,
      payloadType: cls.type,
      url: cls.url,
    });
  };

  for (const el of elements) {
    if (el.src) {
      const recovered = payloadFromServiceUrl(el.src);
      if (recovered) record('service-url', recovered.payload, recovered.service);
      else if (/^https?:\/\//i.test(el.src)) {
        // Opaque QR image with no recoverable payload in markup.
        destinations.push({
          kind: 'qr-destination',
          source: 'opaque-image',
          service: null,
          payload: null,
          payloadType: 'unknown',
          url: null,
          note: 'QR image found but payload is not embedded in markup; decode the image and pass the text via decodedPayloads.',
          src: el.src,
        });
      }
    }
    for (const v of Object.values(el.payloadAttrs)) record('data-attribute', v, null);
  }
  for (const p of decodedPayloads) record('decoded-payload', p, null);

  const urls = destinations.filter(d => d.url).map(d => d.url);
  const byType = {};
  for (const d of destinations) byType[d.payloadType] = (byType[d.payloadType] || 0) + 1;
  return {
    destinations,
    stats: {
      elements: elements.length,
      destinations: destinations.length,
      urls: urls.length,
      byType,
      uniqueUrls: [...new Set(urls)],
    },
  };
}

/**
 * Build a report finding from a QR harvest.
 * @param {ReturnType<typeof harvestQrDestinations>} result
 */
export function qrFinding(result) {
  return {
    title: `QR destination harvest — ${result.stats.destinations} payload(s), ${result.stats.urls} URL(s)`,
    severity: 'Info',
    confidence: result.stats.destinations > 0 ? 'high' : 'medium',
    stats: result.stats,
    evidence:
      `${result.stats.elements} QR element(s) found; ` +
      `${result.stats.urls} encoded URL(s) recovered without network access.`,
  };
}

export const QR_DESTINATION_HARVESTER = {
  findQrElements,
  payloadFromServiceUrl,
  classifyQrPayload,
  harvestQrDestinations,
  qrFinding,
};
export default QR_DESTINATION_HARVESTER;
