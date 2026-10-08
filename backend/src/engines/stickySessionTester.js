/**
 * stickySessionTester.js — Load-balancer session-affinity (sticky-session) analyzer.
 *
 * Implements idea 00441 (Sticky-session behavior testing):
 * inspects HTTP responses for load-balancer session-affinity indicators
 * (persistence cookies, backend identity headers) so an authorized assessment
 * can infer which balancer vendor is in front of a target and which topology
 * (single region, multi-zone, CDN-offload) the deployment uses.
 *
 * Defensive analysis only — no traffic manipulation, no exploit payloads.
 */

export const AFFINITY_COOKIES = [
  {
    name: 'AWSALB / AWSALBTG',
    pattern: /^AWSALB(TG)?$/i,
    vendor: 'Amazon Web Services',
    balancer: 'Application Load Balancer',
    topology: 'AWS multi-AZ ALB with sticky sessions enabled on the target group',
  },
  {
    name: 'AWSELB / AWSELB2',
    pattern: /^AWSELB2?$/i,
    vendor: 'Amazon Web Services',
    balancer: 'Classic / Network Load Balancer (cookie sticky)',
    topology: 'AWS ELB sticky sessions; classic ELB implies single-era stack',
  },
  {
    name: 'BIGipServer',
    pattern: /^BIGipServer/i,
    vendor: 'F5',
    balancer: 'BIG-IP LTM',
    topology: 'F5 BIG-IP fronting the app tier; persistence profile in use',
  },
  {
    name: 'ARRAffinity',
    pattern: /^ARRAffinity/i,
    vendor: 'Microsoft',
    balancer: 'Azure App Service front end',
    topology: 'Azure App Service with ARR affinity cookies (multi-instance)',
  },
  {
    name: 'GCLB / GCILB',
    pattern: /^GC(L|I)LB$/i,
    vendor: 'Google',
    balancer: 'Cloud Load Balancer / Internal LB',
    topology: 'Google Cloud LB with session affinity (generated or client IP)',
  },
  {
    name: 'NSC / WSC',
    pattern: /^(NSC|WSC)_/i,
    vendor: 'Citrix',
    balancer: 'NetScaler / ADC',
    topology: 'Citrix ADC persistence cookies; backend pool behind ADC',
  },
  {
    name: 'SERVERID / SRV*',
    pattern: /^SERVERID$/i,
    vendor: 'HAProxy',
    balancer: 'HAProxy',
    topology: 'HAProxy with insert-cookie persistence; backend server IDs encoded',
  },
  {
    name: 'JSESSIONID',
    pattern: /^JSESSIONID$/i,
    vendor: 'Java servlet container',
    balancer: 'Tomcat / JBoss / Jetty (app-level)',
    topology: 'Java session replication or balancer route suffix (node ID after dot)',
  },
  {
    name: 'PHPSESSID sticky',
    pattern: /^PHPSESSID$/i,
    vendor: 'PHP runtime',
    balancer: 'Application-level session',
    topology: 'PHP sessions; affinity detectable via session-ID rotation across nodes',
  },
  {
    name: 'incap_ses_ / nlbi / visid_incap',
    pattern: /^(incap_ses_|nlbi_|visid_incap)/i,
    vendor: 'Imperva',
    balancer: 'Imperva Cloud WAF',
    topology: 'WAF-cloud fronting origin; affinity cookie managed by Imperva edge',
  },
  {
    name: '__cf_bm / __cfduid',
    pattern: /^__(cf_bm|cfduid|cfruid)/i,
    vendor: 'Cloudflare',
    balancer: 'Cloudflare edge',
    topology: 'Cloudflare-managed challenge/affinity; __cfruid indicates Spectrum or LB',
  },
  {
    name: 'TS* / F5-TS',
    pattern: /^(TS|F5)-/i,
    vendor: 'F5 / Akamai Kona',
    balancer: 'F5 BIG-IP ASM / bot-defense flavor',
    topology: 'F5-managed persistence / bot-defense cookie in front of the app',
  },
];

/** Header names that commonly leak backend-node identity behind a balancer. */
const BACKEND_IDENTITY_HEADERS = [
  'x-backend-server',
  'x-served-by',
  'x-app-server',
  'x-node',
  'x-server-name',
  'x-hostname',
  'x-upstream',
  'x-via-backend',
  'server',
];

/**
 * Normalize raw headers into a lower-cased key map.
 * @param {object|Array} headers raw header object or [name, value] pairs
 */
function normalizeHeaders(headers = {}) {
  const out = {};
  if (Array.isArray(headers)) {
    for (const [k, v] of headers) out[String(k).toLowerCase()] = v;
  } else {
    for (const k of Object.keys(headers)) out[k.toLowerCase()] = headers[k];
  }
  return out;
}

/**
 * Extract Set-Cookie cookie names from a normalized header map.
 * @param {object} headers normalized headers
 * @returns {Array<string>}
 */
function setCookieNames(headers) {
  const raw = headers['set-cookie'];
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map(c => String(c).split(';')[0].split('=')[0].trim()).filter(Boolean);
}

/**
 * Analyze a single response for sticky-session / session-affinity indicators.
 * @param {{url, status, headers, body}} input
 */
export function analyzeStickySession({ url, status = 0, headers = {}, body = '' } = {}) {
  const norm = normalizeHeaders(headers);
  const cookieNames = setCookieNames(norm);
  const findings = [];

  for (const cookie of cookieNames) {
    const sig = AFFINITY_COOKIES.find(s => s.pattern.test(cookie));
    if (sig) {
      findings.push({
        detected: true,
        idea: '00441',
        cookie,
        vendor: sig.vendor,
        balancer: sig.balancer,
        topology: sig.topology,
        confidence: 'high',
        severity: 'Info',
        cwe: 'CWE-200',
        evidence: `Response from ${url} sets persistence cookie "${cookie}" (${sig.balancer}).`,
      });
    }
  }

  for (const h of BACKEND_IDENTITY_HEADERS) {
    if (norm[h]) {
      findings.push({
        detected: true,
        idea: '00441',
        header: h,
        value: String(norm[h]).slice(0, 80),
        confidence: 'medium',
        severity: 'Info',
        cwe: 'CWE-200',
        evidence: `Backend-identity header "${h}" present — suggests requests reach a specific node behind a balancer.`,
      });
    }
  }

  return {
    detected: findings.length > 0,
    url,
    status,
    affinityCookies: cookieNames,
    findings,
    summary:
      findings.length > 0
        ? `Session-affinity indicators present (${findings.length} finding${findings.length > 1 ? 's' : ''}).`
        : 'No sticky-session indicators detected in this response.',
  };
}

/**
 * Compare a sequence of repeated responses to the same URL to detect
 * affinity drift: rotating Set-Cookie values or changing backend headers
 * reveal how many nodes sit behind the balancer and how rotation behaves.
 * @param {{url, samples: Array<{status, headers}>}} input
 */
export function detectAffinityBehavior({ url, samples = [] } = {}) {
  const cookieSeries = samples.map(s => setCookieNames(normalizeHeaders(s.headers)));
  const rotated = new Set();
  const flat = cookieSeries.flat();
  for (const name of flat) {
    const sig = AFFINITY_COOKIES.find(s => s.pattern.test(name));
    if (sig) rotated.add(sig.name);
  }

  const backendHeaders = new Set();
  for (const s of samples) {
    const norm = normalizeHeaders(s.headers);
    for (const h of BACKEND_IDENTITY_HEADERS) {
      if (norm[h]) backendHeaders.add(`${h}=${String(norm[h]).slice(0, 60)}`);
    }
  }

  const backendCount = backendHeaders.size;
  return {
    detected: rotated.size > 0 || backendCount > 1,
    idea: '00441',
    url,
    sampleCount: samples.length,
    affinityVendors: [...rotated],
    distinctBackendsObserved: backendCount,
    backendHeaders: [...backendHeaders],
    confidence: samples.length >= 3 ? 'medium' : 'low',
    severity: 'Info',
    cwe: 'CWE-200',
    topology:
      backendCount > 1
        ? `At least ${backendCount} distinct backend identities observed — balancer rotates across nodes.`
        : rotated.size > 0
          ? 'Affinity cookie vendor identified; single backend identity observed across samples.'
          : 'Insufficient variation to map topology.',
    evidence: `Analyzed ${samples.length} repeated responses to ${url}.`,
  };
}

export const STICKY_SESSION_TESTER = {
  analyzeStickySession,
  detectAffinityBehavior,
  AFFINITY_COOKIES,
  BACKEND_IDENTITY_HEADERS,
};
export default STICKY_SESSION_TESTER;
