/**
 * humanRecon.js — page understanding for the continuous hunt loop (issue #298).
 *
 * A human hunter doesn't fire tools blindly: they OPEN the target first, read
 * the page like a person, note the login forms, inputs, parameters, JS
 * frameworks and interesting endpoints, and build a mental site map. This
 * module does the same programmatically:
 *
 *   fetchPageHtml()  — read-only GET, size-capped, no credentials
 *   summarizePage()  — { purpose, forms, inputs, params, jsFrameworks, interestingEndpoints }
 *   buildSiteMap()   — aggregate summaries across crawled pages
 *   thinkAloudFor()  — think-aloud trace entries a human would voice
 *
 * Findings + surface notes only. No exploit payloads anywhere.
 */

const FETCH_TIMEOUT_MS = 15000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** Read-only page fetch. Never sends credentials, never posts. */
export async function fetchPageHtml(url, { fetchFn = globalThis.fetch, timeoutMs = FETCH_TIMEOUT_MS, maxBytes = MAX_HTML_BYTES } = {}) {
  const target = String(url || '').trim();
  if (!/^https?:\/\//i.test(target)) throw new Error('humanRecon fetches http(s) URLs only');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(target, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = String(res.headers?.get?.('content-type') || '');
    if (ct && !/html/i.test(ct)) throw new Error(`non-HTML content (${ct.slice(0, 60)})`);
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.slice(0, maxBytes).toString('utf8');
  } finally {
    clearTimeout(timer);
  }
}

/** Strip tags/comments/scripts to leave readable text. */
function visibleText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800);
}

function attrOf(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return (m && (m[1] ?? m[2] ?? m[3])) || '';
}

/** Parse forms + inputs from raw HTML (no DOM dependency). */
export function extractForms(html) {
  const forms = [];
  const formRe = /<form\b[^>]*>([\s\S]*?)<\/form>/gi;
  let fm;
  while ((fm = formRe.exec(html || ''))) {
    const open = fm[0].slice(0, fm[0].indexOf('>') + 1);
    const inputs = [];
    const inputRe = /<(input|textarea|select|button)\b[^>]*>/gi;
    let im;
    while ((im = inputRe.exec(fm[1]))) {
      const tag = im[0];
      inputs.push({
        tag: im[1].toLowerCase(),
        name: attrOf(tag, 'name') || attrOf(tag, 'id') || '',
        type: attrOf(tag, 'type') || (im[1].toLowerCase() === 'textarea' ? 'textarea' : 'text'),
      });
    }
    forms.push({
      action: attrOf(open, 'action') || '',
      method: (attrOf(open, 'method') || 'get').toLowerCase(),
      inputs,
    });
  }
  return forms;
}

/** Detect JS frameworks/libraries from HTML/JS markers. */
export function detectFrameworks(html) {
  const found = new Set();
  const h = String(html || '');
  const checks = [
    [/__NEXT_DATA__|next\/|_next\/static/i, 'Next.js'],
    [/ng-version|ng-app|angular/i, 'Angular'],
    [/data-v-[0-9a-f]{4,}|__VUE__|vue\.js/i, 'Vue'],
    [/data-reactroot|react-dom|__REACT/i, 'React'],
    [/nuxt|__NUXT__/i, 'Nuxt'],
    [/svelte/i, 'Svelte'],
    [/jquery/i, 'jQuery'],
    [/_csrf|csrf/i, 'CSRF-token present'],
    [/graphql/i, 'GraphQL'],
    [/wp-content|wp-includes/i, 'WordPress'],
    [/drupal/i, 'Drupal'],
    [/shopify/i, 'Shopify'],
    [/strapi/i, 'Strapi'],
    [/laravel|csrf-token/i, 'Laravel'],
  ];
  for (const [re, name] of checks) if (re.test(h)) found.add(name);
  return [...found];
}

/** Pull interesting endpoints: hrefs, srcs, form actions, fetch('/api/...') calls. */
export function extractEndpoints(html) {
  const out = new Set();
  const h = String(html || '');
  const hrefRe = /(?:href|src|action)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
  let m;
  while ((m = hrefRe.exec(h))) {
    const v = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (!v || v.startsWith('#') || v.startsWith('javascript:') || v.startsWith('data:')) continue;
    out.add(v.slice(0, 300));
  }
  const fetchRe = /(?:fetch|axios\.(?:get|post)|XMLHttpRequest)[\s(]*['"`]([^'"`]{2,200})['"`]/gi;
  while ((m = fetchRe.exec(h))) out.add(m[1].trim().slice(0, 300));
  const apiRe = /['"`](\/[a-zA-Z0-9_.\-/{}]{3,120})['"`]/g;
  while ((m = apiRe.exec(h))) {
    if (/\.(js|css|png|jpg|svg|ico|woff2?)($|\?)/i.test(m[1])) continue;
    out.add(m[1].slice(0, 300));
  }
  return [...out].slice(0, 200);
}

/** Query parameters seen across the extracted endpoints. */
export function extractParams(endpoints) {
  const params = new Set();
  for (const ep of endpoints || []) {
    const q = String(ep).split('?')[1];
    if (!q) continue;
    for (const pair of q.split('&')) {
      const k = pair.split('=')[0].trim();
      if (k) params.add(k.slice(0, 80));
    }
  }
  return [...params];
}

/**
 * Summarize a page the way a human hunter would read it.
 * @returns {{ url, title, purpose, forms, inputs, params, jsFrameworks, interestingEndpoints }}
 */
export function summarizePage({ url, html }) {
  const h = String(html || '');
  const title = (h.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i) || [])[1]?.trim() || '';
  const desc = attrOf(h.match(/<meta\b[^>]*name=["']description["'][^>]*>/i)?.[0] || '', 'content');
  const h1 = (h.match(/<h1\b[^>]*>([\s\S]{0,160}?)<\/h1>/i) || [])[1]?.replace(/<[^>]+>/g, ' ').trim() || '';
  const text = visibleText(h);
  const forms = extractForms(h);
  const inputs = [
    ...new Set(
      forms.flatMap(f => f.inputs.map(i => i.name).filter(Boolean))
    ),
  ];
  const jsFrameworks = detectFrameworks(h);
  const interestingEndpoints = extractEndpoints(h);
  const params = extractParams(interestingEndpoints);
  const purpose = [title, desc, h1, text.slice(0, 200)].filter(Boolean).join(' — ').slice(0, 400);
  return { url: String(url || ''), title, purpose, forms, inputs, params, jsFrameworks, interestingEndpoints };
}

/**
 * Aggregate page summaries into a site map.
 * @param {Array} summaries — summarizePage() outputs
 */
export function buildSiteMap(summaries = []) {
  const pages = [];
  const forms = [];
  const apis = new Set();
  for (const s of summaries || []) {
    pages.push({ url: s.url, title: s.title, purpose: s.purpose });
    for (const f of s.forms || []) forms.push({ page: s.url, ...f });
    for (const ep of s.interestingEndpoints || []) {
      if (/^\/(api|graphql|v\d|rest)/i.test(ep)) apis.add(ep);
    }
  }
  return { pages, forms, apis: [...apis] };
}

/**
 * Think-aloud trace entries from a page summary — the inner monologue of a
 * human hunter, stored so the owner can see what the agent "saw" and why.
 */
export function thinkAloudFor(summary) {
  const lines = [];
  const s = summary || {};
  if (s.title || s.purpose) {
    lines.push(`I see a page${s.title ? ` titled "${s.title}"` : ''} — ${s.purpose.slice(0, 160)}. A human would read this first to understand what the app is FOR.`);
  }
  for (const f of s.forms || []) {
    const names = (f.inputs || []).map(i => i.name).filter(Boolean).join(', ');
    const loginish = /login|sign.?in|auth/i.test(`${f.action} ${names}`);
    lines.push(
      loginish
        ? `I see a login form (${f.method.toUpperCase()}${f.action ? ` to ${f.action}` : ''}) with fields ${names || '(unnamed)'} — a human would test the login flow: account lockout, credential handling, and session behavior.`
        : `I see a ${f.method.toUpperCase()} form${f.action ? ` posting to ${f.action}` : ''} with fields ${names || '(unnamed)'} — a human would map what each field does and test how the server validates them.`
    );
  }
  if ((s.params || []).length) {
    lines.push(`I see URL parameters: ${s.params.join(', ')} — a human would note these as injection/IDOR surface.`);
  }
  if ((s.jsFrameworks || []).length) {
    lines.push(`I see ${s.jsFrameworks.join(', ')} — a human would tailor tests to that stack's known weakness classes.`);
  }
  const apis = (s.interestingEndpoints || []).filter(e => /^\/(api|graphql|v\d|rest)/i.test(e));
  if (apis.length) {
    lines.push(`I see API endpoints: ${apis.slice(0, 8).join(', ')} — a human would probe these for auth and access-control gaps.`);
  }
  if (!lines.length) lines.push('The page shows little surface — a human would dig into linked pages and JS bundles next.');
  return lines;
}

/**
 * Understand a target page end-to-end: fetch → summarize → think aloud.
 * Pure convenience wrapper around the pieces above.
 */
export async function understandPage({ url, fetchFn } = {}) {
  const html = await fetchPageHtml(url, { fetchFn });
  const summary = summarizePage({ url, html });
  return { summary, thinkAloud: thinkAloudFor(summary) };
}

export default { fetchPageHtml, summarizePage, buildSiteMap, thinkAloudFor, understandPage };
