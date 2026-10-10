/**
 * previewApiRecon.js — preview-API and response-header recon for authorized
 * bug-bounty hunts.
 *
 * Experimental surfaces ship before full security review, and response headers
 * disclose the framework/stack behind an endpoint:
 *
 *  - Idea 1218 — labs/beta subdomain API probing (experimental subdomains run
 *    pre-hardened code)
 *  - Idea 1219 — feature-preview endpoint hunt (/preview, /next, /beta paths)
 *  - Idea 1220 — response-header framework fingerprint (X-Powered-By, Server,
 *    Via values; version disclosure targets exploit selection)
 *
 * Pure functions: takes operator-supplied host probes, route lists, and header
 * maps; returns structured findings. Defensive/product framing only — mapping
 * and fingerprinting logic for authorized targets. No payloads, no
 * weaponized code.
 */

const LAB_SUBDOMAINS = [
  'labs', 'lab', 'beta', 'staging', 'stage', 'preview', 'previews', 'next',
  'dev', 'development', 'test', 'testing', 'canary', 'sandbox', 'experimental',
  'demo', 'demos', 'preprod', 'qa', 'uat', 'alpha', 'pilot', 'early',
];

/**
 * Generate candidate labs/beta-style subdomains for a base domain.
 * @param {string} baseDomain - e.g. "example.com"
 * @returns {Array<string>} candidate hostnames
 */
export function generateLabHosts(baseDomain = '') {
  const base = String(baseDomain).trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  if (!base || !base.includes('.')) return [];
  return LAB_SUBDOMAINS.map(sub => `${sub}.${base}`);
}

/**
 * Idea 1218 — score labs/beta host probes for live experimental APIs.
 *
 * `probes`: [{ host, status, server, contentType, title?, apiLike? }] as
 * recorded by the operator. Live hosts get confidence by signal strength:
 * 2xx/3xx API-like wins; 401/403 means alive but gated; DNS failures are dead.
 *
 * @param {object} input
 * @param {string} [input.baseDomain] - base domain for context
 * @param {Array<object>} input.probes - operator-recorded host probes
 * @returns scored candidates with confidence and notes
 */
export function probeLabsBetaApis({ baseDomain = '', probes = [] } = {}) {
  const findings = probes.map(p => {
    const status = Number(p.status) || 0;
    const host = String(p.host || '');
    const notes = [];
    let confidence = 'low';

    if (!status) {
      notes.push('No response — host does not resolve or refuses connections.');
    } else if (status >= 200 && status < 400) {
      const apiLike = p.apiLike || /json/i.test(String(p.contentType || ''));
      confidence = apiLike ? 'high' : 'medium';
      notes.push(apiLike
        ? `Reachable (${status}) and API-like (${p.contentType || 'unknown content type'}) — experimental API candidate.`
        : `Reachable (${status}) — live experimental host, verify it serves an API.`);
    } else if (status === 401 || status === 403) {
      confidence = 'medium';
      notes.push(`Host is live but gated (${status}) — experimental API behind auth, worth retesting with credentials.`);
    } else if (status >= 400 && status < 500) {
      notes.push(`Client error (${status}) — host resolves but the path is not an API root.`);
    } else {
      notes.push(`Server error (${status}) — host is live; error pages may leak stack details.`);
    }

    const server = String(p.server || '');
    if (server && /node|express|django|laravel|rails|spring|nginx/i.test(server)) {
      notes.push(`Server banner: ${server}.`);
    }

    return {
      host,
      reachable: status > 0,
      status,
      confidence,
      evidence: notes.join(' '),
    };
  });

  const live = findings.filter(f => f.reachable);
  return {
    type: 'Labs and Beta Subdomain API',
    baseDomain,
    confidence: live.some(f => f.confidence === 'high') ? 'high' : live.length > 0 ? 'medium' : 'low',
    evidence: `${live.length}/${findings.length} candidate host(s) reachable.`,
    candidates: findings,
  };
}

const PREVIEW_SEGMENTS = [
  { segment: 'preview', weight: 3 },
  { segment: 'previews', weight: 3 },
  { segment: 'next', weight: 2 },
  { segment: 'beta', weight: 3 },
  { segment: 'canary', weight: 3 },
  { segment: 'experimental', weight: 3 },
  { segment: 'experiments', weight: 2 },
  { segment: 'sandbox', weight: 2 },
  { segment: 'playground', weight: 2 },
  { segment: 'staging', weight: 2 },
  { segment: 'wip', weight: 2 },
  { segment: 'draft', weight: 1 },
  { segment: 'unreleased', weight: 2 },
  { segment: 'v2-beta', weight: 3 },
  { segment: 'alpha', weight: 2 },
];

/**
 * Idea 1219 — hunt discovered routes for feature-preview endpoints.
 *
 * `routes`: [{ path, status, method? }] as recorded by the operator's crawl.
 * Paths containing preview-style segments score up; live 2xx statuses confirm.
 *
 * @param {object} input
 * @param {Array<object>} input.routes - discovered routes with statuses
 * @returns preview candidates with confidence scores
 */
export function huntFeaturePreviewEndpoints({ routes = [] } = {}) {
  const candidates = [];

  for (const r of routes) {
    const path = String(r.path || '');
    const segments = path.toLowerCase().split('/').filter(Boolean);
    const hits = PREVIEW_SEGMENTS.filter(p => segments.some(s => s === p.segment || s.includes(p.segment)));
    if (!hits.length) continue;
    const score = hits.reduce((n, h) => n + h.weight, 0);
    const status = Number(r.status) || 0;
    const live = status >= 200 && status < 400;
    const gated = status === 401 || status === 403;
    const confidence = live && score >= 3 ? 'high' : live || gated ? 'medium' : 'low';

    candidates.push({
      path,
      method: r.method ? String(r.method).toUpperCase() : 'GET',
      status,
      matchedSegments: hits.map(h => h.segment),
      score,
      confidence,
      evidence:
        `Preview-style segment(s) [${hits.map(h => h.segment).join(', ')}] in path; ` +
        (live ? `responds ${status} — live preview surface.` : gated ? `responds ${status} — gated preview surface.` : `responds ${status || 'unreached'}.`),
    });
  }

  candidates.sort((a, b) => b.score - a.score || (b.status >= 200 && b.status < 400 ? 1 : 0) - (a.status >= 200 && a.status < 400 ? 1 : 0));

  return {
    type: 'Feature-Preview Endpoint Hunt',
    confidence: candidates.some(c => c.confidence === 'high') ? 'high' : candidates.length > 0 ? 'medium' : 'low',
    evidence: `${candidates.length} preview-style endpoint candidate(s) found.`,
    candidates,
  };
}

const FRAMEWORK_SIGNATURES = [
  { re: /express/i, framework: 'Express.js (Node.js)' },
  { re: /\bphp\b/i, framework: 'PHP' },
  { re: /next\.js|nextjs/i, framework: 'Next.js' },
  { re: /nuxt/i, framework: 'Nuxt.js' },
  { re: /django/i, framework: 'Django (Python)' },
  { re: /flask/i, framework: 'Flask (Python)' },
  { re: /fastapi/i, framework: 'FastAPI (Python)' },
  { re: /laravel/i, framework: 'Laravel (PHP)' },
  { re: /symfony/i, framework: 'Symfony (PHP)' },
  { re: /wordpress/i, framework: 'WordPress' },
  { re: /drupal/i, framework: 'Drupal' },
  { re: /joomla/i, framework: 'Joomla' },
  { re: /rails|phusion passenger/i, framework: 'Ruby on Rails' },
  { re: /asp\.net|kestrel|iis/i, framework: 'ASP.NET / IIS' },
  { re: /spring|tomcat|jetty|jboss|wildfly/i, framework: 'Java (Spring/Tomcat-family)' },
  { re: /gunicorn|uvicorn/i, framework: 'Gunicorn/Uvicorn (Python)' },
  { re: /nginx/i, framework: 'Nginx' },
  { re: /apache/i, framework: 'Apache httpd' },
  { re: /cloudflare/i, framework: 'Cloudflare (proxy)' },
  { re: /awselb|aws/i, framework: 'AWS infrastructure' },
  { re: /gws|google frontend/i, framework: 'Google infrastructure' },
  { re: /varnish/i, framework: 'Varnish' },
  { re: /h2o/i, framework: 'H2O' },
];

const VERSION_RE = /(\d+\.\d+(?:\.\d+)?(?:[.-][a-z0-9]+)?)/i;
const HEADER_SOURCES = [
  'server', 'x-powered-by', 'via', 'x-aspnet-version', 'x-aspnetmvc-version',
  'x-runtime', 'x-generator', 'x-version', 'x-framework', 'powered-by',
];

/**
 * Identify the framework from a header value, returning the match or null.
 * @param {string} value
 * @returns {{framework: string, version: (string|null)}|null}
 */
export function identifyFramework(value = '') {
  const v = String(value);
  for (const sig of FRAMEWORK_SIGNATURES) {
    if (sig.re.test(v)) {
      const m = v.match(VERSION_RE);
      return { framework: sig.framework, version: m ? m[1] : null };
    }
  }
  const m = v.match(VERSION_RE);
  return m ? { framework: 'Unknown (versioned banner)', version: m[1] } : null;
}

/**
 * Idea 1220 — fingerprint the stack from response headers.
 *
 * Parses Server, X-Powered-By, Via and sibling headers for framework
 * signatures; exact version disclosure is flagged because it narrows
 * exploit selection for an authorized hunter.
 *
 * @param {object} input
 * @param {object} input.headers - response header map (any casing)
 * @param {string} [input.url] - probed URL (provenance)
 * @returns framework fingerprint with version-disclosure assessment
 */
export function fingerprintResponseHeaders({ headers = {}, url = '' } = {}) {
  const lowered = Object.fromEntries(
    Object.entries(headers || {}).map(([k, v]) => [String(k).toLowerCase(), String(v)])
  );

  const findings = [];
  for (const source of HEADER_SOURCES) {
    const value = lowered[source];
    if (!value) continue;
    const id = identifyFramework(value);
    const versionDisclosed = Boolean(id && id.version);
    findings.push({
      header: source,
      value,
      framework: id ? id.framework : 'Unrecognized',
      version: id && id.version ? id.version : null,
      versionDisclosed,
      confidence: id ? (versionDisclosed ? 'high' : 'medium') : 'low',
      evidence: id
        ? `${source}: "${value}" identifies ${id.framework}${versionDisclosed ? ` at version ${id.version} — exact version disclosure.` : '.'}`
        : `${source}: "${value}" — banner present but not in the signature set.`,
    });
  }

  const versioned = findings.filter(f => f.versionDisclosed);
  const frameworks = [...new Set(findings.filter(f => f.framework !== 'Unrecognized').map(f => f.framework))];
  const confidence = versioned.length > 0 ? 'high' : findings.length > 0 ? 'medium' : 'low';

  return {
    type: 'Response-Header Framework Fingerprint',
    url,
    confidence,
    evidence:
      findings.length === 0
        ? 'No disclosing headers present — server banner is hardened.'
        : `${findings.length} disclosing header(s); ${versioned.length} with exact version; framework(s): ${frameworks.join(', ') || 'unrecognized'}.`,
    framework: frameworks.length ? frameworks.join(' + ') : null,
    version: versioned.length ? versioned[0].version : null,
    versionDisclosure: versioned.length > 0,
    findings,
  };
}

export const PREVIEW_API_RECON = {
  generateLabHosts,
  probeLabsBetaApis,
  huntFeaturePreviewEndpoints,
  identifyFramework,
  fingerprintResponseHeaders,
};
export default PREVIEW_API_RECON;
