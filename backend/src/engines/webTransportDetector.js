/**
 * webTransportDetector.js — WebTransport endpoint detection engine.
 *
 * Detects WebTransport support from passively observed response metadata
 * (Alt-Svc advertisements, ALPN negotiations, WebTransport-specific response
 * headers) on authorized targets. WebTransport availability fingerprints
 * modern edge stacks (HTTP/3-capable CDNs and load balancers).
 *
 * Pure analysis of observed headers/negotiated protocols; it never initiates
 * WebTransport sessions itself.
 */

/**
 * Known edge stacks and their WebTransport posture signals.
 */
const EDGE_STACK_SIGNALS = [
  {
    stack: 'cloudflare',
    markers: [/cloudflare/i],
    webtransport: 'supported',
    note: 'Cloudflare edge advertises WebTransport over HTTP/3.',
  },
  {
    stack: 'fastly',
    markers: [/fastly/i],
    webtransport: 'supported',
    note: 'Fastly supports WebTransport on HTTP/3.',
  },
  {
    stack: 'akamai',
    markers: [/akamai/i, /akamaighost/i],
    webtransport: 'partial',
    note: 'Akamai WebTransport availability varies by product line.',
  },
  {
    stack: 'aws-cloudfront',
    markers: [/cloudfront/i],
    webtransport: 'supported',
    note: 'CloudFront supports WebTransport via HTTP/3.',
  },
  {
    stack: 'google-cloud-lb',
    markers: [/gws/i, /google/i],
    webtransport: 'supported',
    note: 'Google front-ends support WebTransport.',
  },
  {
    stack: 'azure-frontdoor',
    markers: [/azure/i],
    webtransport: 'partial',
    note: 'Azure Front Door HTTP/3 rollout in progress.',
  },
  {
    stack: 'nginx-quic',
    markers: [/nginx/i],
    webtransport: 'possible',
    note: 'nginx QUIC builds can proxy WebTransport with configuration.',
  },
  {
    stack: 'envoy',
    markers: [/envoy/i],
    webtransport: 'supported',
    note: 'Envoy has native WebTransport support.',
  },
];

/**
 * Detect WebTransport signals in observed response headers.
 * @param {object} headers response headers (any casing)
 * @returns {{supported: boolean|null, signals: string[], details: object}}
 */
export function detectFromHeaders(headers = {}) {
  const h = {};
  for (const [k, v] of Object.entries(headers || {})) h[String(k).toLowerCase()] = String(v);
  const signals = [];
  const details = {};

  const altSvc = h['alt-svc'] || '';
  const h3Advertised = /(^|[,\s])h3([-=,"]|$)/i.test(altSvc);
  details.h3Advertised = h3Advertised;
  if (h3Advertised) signals.push('alt-svc-advertises-h3');

  const wtHeaders = ['sec-webtransport-http3-draft', 'sec-webtransport-protocol', 'x-webtransport'];
  for (const name of wtHeaders) {
    if (h[name]) {
      signals.push(`header:${name}=${h[name].slice(0, 64)}`);
      details[name] = h[name];
    }
  }
  if (/webtransport/i.test(h.upgrade || '')) signals.push('upgrade-header-mentions-webtransport');
  if (/webtransport/i.test(h['accept-ch'] || '')) signals.push('client-hints-mention-webtransport');

  const supported = signals.some(
    s => s.startsWith('header:sec-webtransport') || s.startsWith('upgrade-header')
  )
    ? true
    : h3Advertised
      ? null
      : false;
  return { supported, signals, details };
}

/**
 * Detect WebTransport feasibility from the negotiated ALPN protocol.
 * @param {string[]} alpnProtocols e.g. ["h3", "h2", "http/1.1"]
 * @returns {{http3: boolean, webtransportPossible: boolean, note: string}}
 */
export function detectFromAlpn(alpnProtocols = []) {
  const list = (Array.isArray(alpnProtocols) ? alpnProtocols : []).map(p =>
    String(p).toLowerCase()
  );
  const http3 = list.some(p => p === 'h3' || p.startsWith('h3-'));
  return {
    http3,
    webtransportPossible: http3,
    note: http3
      ? 'HTTP/3 negotiated — WebTransport may be available; confirm with SETTINGS / response headers.'
      : 'No HTTP/3 ALPN — WebTransport (which requires HTTP/3) is not available on this path.',
  };
}

/**
 * Classify the serving edge stack from server banners and WebTransport signals.
 * @param {object} headers response headers (any casing)
 * @param {string[]} [alpnProtocols]
 * @returns {{stack: string, webtransport: string, confidence: number, note: string, wtSignals: string[]}[]}
 */
export function classifyEdgeStack(headers = {}, alpnProtocols = []) {
  const h = {};
  for (const [k, v] of Object.entries(headers || {})) h[String(k).toLowerCase()] = String(v);
  const haystack = `${h.server || ''} ${h.via || ''} ${h['cf-ray'] ? 'cloudflare' : ''} ${h['x-akamai-transformed'] ? 'akamai' : ''}`;
  const wt = detectFromHeaders(headers);
  const out = [];
  for (const sig of EDGE_STACK_SIGNALS) {
    const hits = sig.markers.filter(m => m.test(haystack)).length;
    if (hits === 0) continue;
    let confidence = 55 + hits * 15;
    if (wt.signals.length > 0 && sig.webtransport === 'supported')
      confidence = Math.min(95, confidence + 10);
    out.push({
      stack: sig.stack,
      webtransport: sig.webtransport,
      confidence: Math.min(95, confidence),
      note: sig.note,
      wtSignals: wt.signals,
    });
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Build a passive detection checklist for a host (headers to capture and inspect).
 * @param {string} host
 * @returns {{host: string, checks: {name: string, header?: string, alpn?: boolean, description: string}[]}}
 */
export function buildDetectionPlan(host) {
  return {
    host: String(host || ''),
    checks: [
      {
        name: 'alt-svc-h3',
        header: 'alt-svc',
        description: 'Look for h3 advertisement — prerequisite for WebTransport.',
      },
      {
        name: 'wt-draft-header',
        header: 'sec-webtransport-http3-draft',
        description: 'Direct WebTransport capability advertisement.',
      },
      {
        name: 'wt-protocol-header',
        header: 'sec-webtransport-protocol',
        description: 'Negotiated WebTransport subprotocol, if any.',
      },
      { name: 'alpn', alpn: true, description: 'Confirm h3 in the negotiated ALPN set.' },
      {
        name: 'server-banner',
        header: 'server',
        description: 'Edge-stack banner for stack classification.',
      },
    ],
  };
}

export const WEBTRANSPORT_DETECT = {
  detectFromHeaders,
  detectFromAlpn,
  classifyEdgeStack,
  buildDetectionPlan,
  EDGE_STACK_SIGNALS,
};
