// Route grouping for site-crawl reporting (9 Nov 2026, /* scope).
//
// A "route" is one same-origin path: origin + pathname, query and
// fragment stripped, so /search?q=a and /search?q=b report under the
// same route. Findings without a URL group under the fallback URL
// (the pasted target). Pure — no imports, shared by the scanner
// summary (index.js) and the report builder (routes/hunts.js).
export function routeKeyForUrl(rawUrl, fallbackUrl) {
  const raw = String(rawUrl || fallbackUrl || '').trim();
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`;
  } catch {
    return raw || 'unknown route';
  }
}

// Group findings by route: { route: [title, ...] }. Titles keep
// first-appearance order; a title already listed under a route is
// not repeated there. Findings without a URL land on the fallback
// route (the pasted target).
export function groupFindingsByRoute(findings, fallbackUrl) {
  const byRoute = {};
  for (const f of findings || []) {
    if (!f) continue;
    const key = routeKeyForUrl(f.url, fallbackUrl);
    const title = String((f && f.title) || 'Finding');
    const list = byRoute[key] || (byRoute[key] = []);
    if (!list.includes(title)) list.push(title);
  }
  return byRoute;
}
