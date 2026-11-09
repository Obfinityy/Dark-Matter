// Route grouping for site-crawl findings (9 Nov 2026, /* scope).
//
// A "route" is one same-origin path: origin + pathname, query and
// fragment stripped, so /search?q=a and /search?q=b render under the
// same route. Mirrors backend/src/scanner/routeGroup.js (the frontend
// cannot import backend code); keep the two in sync.
export function routeKeyForUrl(rawUrl, fallbackUrl) {
  const raw = String(rawUrl || fallbackUrl || '').trim();
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`;
  } catch {
    return raw || 'unknown route';
  }
}

// Group findings by route: [{ route, findings: [...] }], routes in
// first-appearance order, findings in list order. Findings without a
// URL group under the fallback URL (the hunt target).
export function groupFindingsByRoute(findings, fallbackUrl) {
  const groups = [];
  const byKey = new Map();
  for (const f of findings || []) {
    if (!f) continue;
    const key = routeKeyForUrl(f.url, fallbackUrl);
    let g = byKey.get(key);
    if (!g) {
      g = { route: key, findings: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    g.findings.push(f);
  }
  return groups;
}
