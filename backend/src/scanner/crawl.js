// Dark Matter rule-based scanner — same-origin crawler (depth 1).
// Extracts links + forms + parameters from the target page for probing.
import { fetchPage } from './fingerprint.js';

function sameOrigin(base, href) {
  try {
    const b = new URL(base);
    const u = new URL(href, base);
    return u.protocol === b.protocol && u.host === b.host;
  } catch {
    return false;
  }
}

export function extractLinks(body, base) {
  const urls = new Set();
  const re = /<a[^>]+href=["']([^"'#]+)["']/gi;
  let m;
  while ((m = re.exec(String(body || '')))) {
    const href = m[1].trim();
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
    if (sameOrigin(base, href)) {
      try {
        urls.add(new URL(href, base).toString().split('#')[0]);
      } catch {
        // ignore
      }
    }
  }
  return [...urls].slice(0, 200);
}

export function extractForms(body, base) {
  const forms = [];
  const re = /<form[^>]*>([\s\S]*?)<\/form>/gi;
  let m;
  while ((m = re.exec(String(body || '')))) {
    const tag = m[0].slice(0, 400);
    const inner = m[1];
    const action = (/action=["']([^"']*)["']/i.exec(tag) || [])[1] || base;
    const method = ((/method=["']([^"']*)["']/i.exec(tag) || [])[1] || 'get').toLowerCase();
    const inputs = [];
    const ire = /<input[^>]+name=["']([^"']+)["'][^>]*>/gi;
    let im;
    while ((im = ire.exec(inner))) inputs.push(im[1]);
    try {
      forms.push({ action: new URL(action, base).toString(), method, inputs });
    } catch {
      // ignore
    }
  }
  return forms.slice(0, 50);
}

export function extractParams(url) {
  try {
    const u = new URL(url);
    return [...u.searchParams.keys()];
  } catch {
    return [];
  }
}

export async function crawl(url, opts = {}) {
  const page = await fetchPage(url, opts);
  return {
    url: page.url,
    links: extractLinks(page.body, page.url),
    forms: extractForms(page.body, page.url),
    params: extractParams(page.url),
    headers: page.headers,
    body: page.body,
  };
}
