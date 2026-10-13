// Dark Matter — automatic target understanding.
//
// When the user pastes a link, the AI first UNDERSTANDS the target before
// hunting: fetches the page, detects the tech stack from headers + HTML,
// extracts forms/endpoints, and stores it as hunt context. This is what
// makes "just put the link" work — no manual recon needed.

import { appendHuntEvent } from './store.js';

const TECH_SIGNATURES = [
  { name: 'WordPress', header: /wp-/i, html: /wp-content|wp-includes/i },
  { name: 'React', header: null, html: /react|_react|__NEXT_DATA__/i },
  { name: 'Next.js', header: /next/i, html: /__NEXT_DATA__/i },
  { name: 'Angular', header: null, html: /ng-version|angular/i },
  { name: 'Vue', header: null, html: /vue\.js|__VUE__/i },
  { name: 'Laravel', header: /laravel/i, html: /laravel/i },
  { name: 'Django', header: /django|csrftoken/i, html: /csrfmiddlewaretoken/i },
  { name: 'Rails', header: /rails|phusion/i, html: /rails/i },
  { name: 'PHP', header: /php/i, html: null },
  { name: 'Nginx', header: /nginx/i, html: null },
  { name: 'Apache', header: /apache/i, html: null },
  { name: 'Cloudflare', header: /cloudflare/i, html: null },
  { name: 'jQuery', header: null, html: /jquery/i },
  { name: 'GraphQL', header: null, html: /graphql/i },
];

function detectTech(headers, html) {
  const found = [];
  const headerStr = Object.entries(headers || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  for (const sig of TECH_SIGNATURES) {
    if (sig.header && sig.header.test(headerStr)) found.push(sig.name);
    else if (sig.html && sig.html.test(html || '')) found.push(sig.name);
  }
  return [...new Set(found)];
}

function extractEndpoints(html, baseUrl) {
  const endpoints = new Set();
  try {
    const base = new URL(baseUrl);
    const regex = /(?:href|src|action)=["']([^"'#]+)["']/gi;
    let m;
    while ((m = regex.exec(html || '')) && endpoints.size < 50) {
      const u = m[1];
      if (u.startsWith('http')) {
        try {
          const parsed = new URL(u);
          if (parsed.hostname === base.hostname) endpoints.add(parsed.pathname);
        } catch { /* skip */ }
      } else if (u.startsWith('/')) {
        endpoints.add(u.split('?')[0]);
      }
    }
  } catch { /* skip */ }
  return [...endpoints].slice(0, 30);
}

// ---- ReconFramework modules (technique, MIT) --------------------------------
// CORS misconfig, JS secret scan, takeover fingerprints — beyond header sniffing.

/** Check CORS misconfiguration from response headers. */
export function checkCorsMisconfig(headers) {
  const acao = headers['access-control-allow-origin'] || headers['Access-Control-Allow-Origin'];
  const acac = headers['access-control-allow-credentials'] || headers['Access-Control-Allow-Credentials'];
  if (acao === '*' && String(acac).toLowerCase() === 'true') {
    return { misconfigured: true, severity: 'medium', detail: 'CORS: * with credentials=true' };
  }
  if (acao && acao.includes('null')) {
    return { misconfigured: true, severity: 'low', detail: 'CORS: null origin allowed' };
  }
  return { misconfigured: false };
}

/** Scan JS/HTML for leaked secrets. */
export function scanJsSecrets(html) {
  const findings = [];
  const patterns = [
    { name: 'aws_key', re: /AKIA[0-9A-Z]{16}/ },
    { name: 'github_token', re: /ghp_[a-zA-Z0-9]{20,}/ },
    { name: 'api_key', re: /["']api[_-]?key["']\s*[:=]\s*["'][a-zA-Z0-9\-_]{16,}["']/i },
    { name: 'secret', re: /["']secret["']\s*[:=]\s*["'][^"']{8,}["']/i },
  ];
  for (const p of patterns) {
    if (p.re.test(html || '')) findings.push({ type: 'js_secret', name: p.name, severity: 'high' });
  }
  return findings;
}

/** Subdomain takeover fingerprints (CNAME -> unclaimed service). */
const TAKEOVER_FINGERPRINTS = [
  { service: 'GitHub Pages', pattern: /github\.io/ },
  { service: 'Heroku', pattern: /herokuapp\.com/ },
  { service: 'S3', pattern: /s3\.amazonaws\.com/ },
  { service: 'CloudFront', pattern: /cloudfront\.net/ },
];

export function checkTakeoverFingerprint(cname) {
  for (const fp of TAKEOVER_FINGERPRINTS) {
    if (fp.pattern.test(cname || '')) {
      return { possible: true, service: fp.service, detail: `CNAME points to ${fp.service} — verify if unclaimed` };
    }
  }
  return { possible: false };
}

/**
 * Understand a target: fetch, detect stack, extract endpoints.
 * Runs right after hunt creation; results become hunt context.
 * Never throws — failures are recorded as events, not errors.
 */
export async function understandTarget(huntId, target) {
  appendHuntEvent(huntId, { type: 'thinking', text: `🔍 Understanding target: ${target}` });
  let url = target.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const profile = {
    url,
    reachable: false,
    status: null,
    server: null,
    tech: [],
    endpoints: [],
    forms: 0,
    understoodAt: new Date().toISOString(),
  };

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'DarkMatter-Recon/1.0 (authorized security research)' },
    });
    clearTimeout(timeout);
    profile.reachable = true;
    profile.status = res.status;
    const headers = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    profile.server = headers['server'] || null;
    const html = await res.text().catch(() => '');
    profile.tech = detectTech(headers, html);
    profile.endpoints = extractEndpoints(html, url);
    profile.forms = (html.match(/<form/gi) || []).length;
  } catch (err) {
    profile.error = String(err.message || err).slice(0, 200);
  }

  appendHuntEvent(huntId, {
    type: 'target-profile',
    profile,
    text: profile.reachable
      ? `✅ Target understood: ${profile.tech.join(', ') || 'unknown stack'} · ${profile.endpoints.length} endpoints · ${profile.forms} forms`
      : `⚠️ Target not directly reachable (${profile.error || 'unknown'}). Hunting with passive techniques.`,
  });
  return profile;
}
