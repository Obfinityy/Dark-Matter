/**
 * fontServiceDetector.js — Font-delivery service detection engine.
 *
 * Detects which font-delivery service a target uses by matching stylesheet
 * URL shapes and @font-face CSS API patterns observed during an authorized
 * hunt (Google Fonts, Adobe Fonts/Typekit, Fontshare, Bunny Fonts, self-hosted
 * setups, and others). Font stacks fingerprint the site's build pipeline and
 * third-party exposure (some font services set cookies or log requests).
 *
 * Pure pattern analysis of observed URLs/CSS; performs no requests.
 */

/**
 * Known font-delivery services keyed on URL and CSS shapes.
 */
const FONT_SERVICES = [
  {
    service: 'google-fonts',
    urlPatterns: [/fonts\.googleapis\.com/i, /fonts\.gstatic\.com/i],
    cssPatterns: [/\/css2?\?family=/i, /text=/, /display=swap/i],
    note: 'Google Fonts CSS API v1/v2; fonts served from fonts.gstatic.com.',
  },
  {
    service: 'adobe-fonts',
    urlPatterns: [/use\.typekit\.net/i, /p\.typekit\.net/i],
    cssPatterns: [/\.css\?[^/]*\bv=/i, /font-display:\s*auto/i],
    note: 'Adobe Fonts (Typekit) kit-based delivery.',
  },
  {
    service: 'fontshare',
    urlPatterns: [/api\.fontshare\.com/i, /cdn\.fontshare\.com/i],
    cssPatterns: [/\/v\d+\/css\?/i],
    note: 'Fontshare API; Indian Type Foundry catalogue.',
  },
  {
    service: 'bunny-fonts',
    urlPatterns: [/fonts\.bunny\.net/i],
    cssPatterns: [/\/css\?family=/i],
    note: 'Bunny Fonts — privacy-focused Google Fonts API drop-in.',
  },
  {
    service: 'fonts-com',
    urlPatterns: [/fast\.fonts\.net/i, /fonts\.com/i],
    cssPatterns: [/\/css\/api\//i],
    note: 'Monotype Fonts.com webfont delivery.',
  },
  {
    service: 'font-awesome',
    urlPatterns: [/kit\.fontawesome\.com/i, /use\.fontawesome\.com/i, /cdnjs.*font-awesome/i],
    cssPatterns: [/\.fa-[a-z-]+:/i, /font-family:\s*["']?Font Awesome/i],
    note: 'Font Awesome icon font kit.',
  },
  {
    service: 'self-hosted',
    urlPatterns: [/\/fonts?\//i, /\.(woff2?|ttf|otf|eot)(\?|#|$)/i],
    cssPatterns: [/@font-face/i, /font-display:\s*swap/i, /unicode-range:/i],
    note: 'Self-hosted @font-face delivery — no third-party font service.',
  },
];

/**
 * Detect font services from observed stylesheet/script URLs.
 * @param {string[]} urls stylesheet or script URLs seen on the target
 * @returns {{service: string, matchedUrls: string[], confidence: number, note: string}[]}
 */
export function detectFromUrls(urls = []) {
  const list = (Array.isArray(urls) ? urls : []).filter(u => typeof u === 'string');
  const out = [];
  for (const svc of FONT_SERVICES) {
    const matchedUrls = list.filter(u => svc.urlPatterns.some(p => p.test(u)));
    if (matchedUrls.length === 0) continue;
    out.push({
      service: svc.service,
      matchedUrls: [...new Set(matchedUrls)],
      confidence: svc.service === 'self-hosted' ? 70 : 90,
      note: svc.note,
    });
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Detect font services from raw CSS text via @font-face and API shapes.
 * @param {string} css CSS source text
 * @returns {{service: string, evidence: string[], confidence: number}[]}
 */
export function detectFromCss(css = '') {
  const text = String(css || '');
  if (text.trim() === '') return [];
  const out = [];
  for (const svc of FONT_SERVICES) {
    const evidence = svc.cssPatterns.filter(p => p.test(text)).map(p => p.source.slice(0, 48));
    if (evidence.length === 0) continue;
    const faces = (text.match(/@font-face/gi) || []).length;
    out.push({
      service: svc.service,
      evidence,
      confidence: Math.min(95, 55 + evidence.length * 15 + (faces > 0 ? 10 : 0)),
    });
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Combine URL and CSS signals into a delivery-stack classification.
 * @param {string[]} urls
 * @param {string} css
 * @returns {{primary: string|null, services: string[], thirdParty: boolean, selfHosted: boolean, confidence: number}}
 */
export function classifyDeliveryStack(urls = [], css = '') {
  const fromUrls = detectFromUrls(urls);
  const fromCss = detectFromCss(css);
  const merged = new Map();
  for (const d of [...fromUrls, ...fromCss]) {
    const cur = merged.get(d.service) || { count: 0, conf: 0 };
    merged.set(d.service, { count: cur.count + 1, conf: Math.max(cur.conf, d.confidence) });
  }
  const services = [...merged.entries()]
    .sort((a, b) => b[1].conf - a[1].conf || b[1].count - a[1].count)
    .map(([service]) => service);
  const thirdParty = services.some(s => s !== 'self-hosted');
  return {
    primary: services[0] || null,
    services,
    thirdParty,
    selfHosted: services.includes('self-hosted'),
    confidence: services.length ? merged.get(services[0]).conf : 0,
  };
}

/**
 * Assess privacy/third-party exposure of the detected font stack.
 * @param {{primary: string|null, services: string[], thirdParty: boolean}} classification
 * @returns {{findings: {code: string, severity: string, detail: string}[], exposureScore: number}}
 */
export function assessFontExposure(classification = {}) {
  const findings = [];
  const services = Array.isArray(classification.services) ? classification.services : [];
  if (services.includes('google-fonts')) {
    findings.push({
      code: 'third-party-font-requests',
      severity: 'low',
      detail:
        'Google Fonts loads cross-origin; visitor IPs are exposed to Google. Consider self-hosting for privacy-sensitive targets.',
    });
  }
  if (services.includes('adobe-fonts')) {
    findings.push({
      code: 'typekit-kit',
      severity: 'low',
      detail: 'Adobe Fonts kit loads third-party JS — review for unnecessary tracking surface.',
    });
  }
  if (classification.thirdParty && classification.selfHosted) {
    findings.push({
      code: 'mixed-font-delivery',
      severity: 'info',
      detail: 'Mixed third-party and self-hosted fonts — consolidation opportunity.',
    });
  }
  if (!classification.thirdParty && classification.selfHosted) {
    findings.push({
      code: 'self-hosted-only',
      severity: 'info',
      detail: 'Fully self-hosted fonts — minimal third-party exposure.',
    });
  }
  if (services.length === 0) {
    findings.push({
      code: 'no-fonts-detected',
      severity: 'info',
      detail: 'No recognizable font-delivery service in the observed signals.',
    });
  }
  const penalty = findings.reduce((s, f) => s + (f.severity === 'low' ? 15 : 3), 0);
  return { findings, exposureScore: Math.max(0, 100 - penalty) };
}

export const FONT_SERVICE_DETECT = {
  detectFromUrls,
  detectFromCss,
  classifyDeliveryStack,
  assessFontExposure,
  FONT_SERVICES: FONT_SERVICES.map(({ service, note }) => ({ service, note })),
};
