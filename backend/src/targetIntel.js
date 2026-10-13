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
