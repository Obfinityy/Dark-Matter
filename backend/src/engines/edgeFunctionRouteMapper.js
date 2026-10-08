/**
 * edgeFunctionRouteMapper.js — edge-function route mapping.
 *
 * Idea 00895: map edge-function routes from CDN configs.
 *
 * No network calls: the module parses operator-supplied CDN/edge config
 * text (Cloudflare Workers route tables, Varnish VCL, Netlify-style
 * redirect files, Vercel rewrite blocks) into a unified route map. This
 * reveals the target's edge-layer routing — which URL patterns trigger
 * serverless functions — during authorized recon.
 */

/**
 * Parse Cloudflare Workers route tables (wrangler JSON or TOML-ish).
 * @param {string} text
 */
export function parseWorkersRoutes(text = '') {
  const routes = [];
  const src = String(text);
  // JSON: {"pattern": "...", "script": "..."} or "routes": [...]
  for (const m of src.matchAll(/"pattern"\s*:\s*"([^"]+)"\s*,\s*"script"\s*:\s*"([^"]+)"/g)) {
    routes.push({ source: m[1], kind: 'workers-route', target: m[2] });
  }
  // TOML wrangler: [[routes]] pattern = "..." script = "..."
  for (const m of src.matchAll(/\[\[routes\]\][\s\S]{0,200}?pattern\s*=\s*"([^"]+)"[\s\S]{0,200}?script\s*=\s*"([^"]+)"/g)) {
    routes.push({ source: m[1], kind: 'workers-route', target: m[2] });
  }
  return routes;
}

/**
 * Parse Varnish VCL for backend routing decisions (set req.backend_hint,
 * req.url conditionals inside vcl_recv).
 * @param {string} vcl
 */
export function parseVclBackendRoutes(vcl = '') {
  const routes = [];
  const src = String(vcl);
  for (const m of src.matchAll(/if\s*\(\s*req\.url\s*~\s*"([^"]+)"\s*\)\s*\{\s*set\s+req\.backend_hint\s*=\s*([a-zA-Z0-9_.-]+)/g)) {
    routes.push({ source: m[1], kind: 'vcl-backend-hint', target: m[2] });
  }
  for (const m of src.matchAll(/backend\s+([a-zA-Z0-9_.-]+)\s*\{[^}]*?\.host\s*=\s*"([^"]+)"/gs)) {
    routes.push({ source: `backend:${m[1]}`, kind: 'vcl-backend-host', target: m[2] });
  }
  for (const m of src.matchAll(/if\s*\(\s*req\.http\.host\s*~\s*"([^"]+)"\s*\)/g)) {
    routes.push({ source: `host:${m[1]}`, kind: 'vcl-host-condition', target: null });
  }
  return routes;
}

/**
 * Parse Netlify-style _redirects / edge-handler redirect lines and Vercel
 * rewrite blocks.
 * @param {string} text
 */
export function parseEdgeRedirects(text = '') {
  const routes = [];
  const src = String(text);
  for (const line of src.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // Netlify _redirects: "/old /new 301" or "/fn/* /.netlify/functions/x 200"
    const m = trimmed.match(/^(\S+)\s+(\S+)(?:\s+(\d{3}))?/);
    if (m && /^[/.*]/.test(m[1])) {
      routes.push({ source: m[1], kind: 'netlify-redirect', target: m[2], status: m[3] || null });
      continue;
    }
    // Vercel rewrites JSON: {"source": "...", "destination": "..."}
    for (const j of line.matchAll(/"source"\s*:\s*"([^"]+)"\s*,\s*"destination"\s*:\s*"([^"]+)"/g)) {
      routes.push({ source: j[1], kind: 'vercel-rewrite', target: j[2] });
    }
  }
  // JSON blocks that span lines (catch the vercel style too).
  for (const j of src.matchAll(/"source"\s*:\s*"([^"]+)"\s*,\s*"destination"\s*:\s*"([^"]+)"/g)) {
    if (!routes.some(r => r.source === j[1] && r.target === j[2])) {
      routes.push({ source: j[1], kind: 'vercel-rewrite', target: j[2] });
    }
  }
  return routes;
}

/**
 * Heuristic: is this route handled by an edge function rather than static?
 * @param {{source: string, target: string|null, kind: string}} route
 */
export function isEdgeFunctionRoute(route) {
  const blob = `${route.source} ${route.target || ''}`.toLowerCase();
  return /workers|edge|function|lambda|middleware|_next\/data|api\//.test(blob) ||
    route.kind === 'workers-route' ||
    /\/\*/.test(route.source);
}

/**
 * Unified pass over several config blobs.
 * @param {{workers?: string, vcl?: string, redirects?: string}} configs
 */
export function mapEdgeRoutes(configs = {}) {
  const routes = [
    ...parseWorkersRoutes(configs.workers),
    ...parseVclBackendRoutes(configs.vcl),
    ...parseEdgeRedirects(configs.redirects),
  ];
  const seen = new Set();
  const deduped = routes.filter(r => {
    const key = `${r.kind}|${r.source}|${r.target || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const edge = deduped.filter(isEdgeFunctionRoute);
  const byKind = {};
  for (const r of deduped) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
  return {
    routes: deduped,
    edgeFunctionRoutes: edge,
    stats: {
      routes: deduped.length,
      edgeFunctionRoutes: edge.length,
      byKind,
    },
  };
}

/**
 * Build a report finding from the mapping result.
 * @param {ReturnType<typeof mapEdgeRoutes>} result
 */
export function edgeRouteFinding(result) {
  return {
    title: `Edge-function route mapping — ${result.stats.edgeFunctionRoutes} edge-function route(s) of ${result.stats.routes}`,
    severity: 'Info',
    confidence: result.stats.routes >= 3 ? 'high' : 'medium',
    stats: result.stats,
    edgeFunctionRoutes: result.edgeFunctionRoutes.slice(0, 20),
    evidence:
      `${result.stats.routes} route rule(s) parsed from CDN/edge configs; ` +
      `${result.stats.edgeFunctionRoutes} match edge-function patterns.`,
  };
}

export const EDGE_FUNCTION_ROUTE_MAPPER = {
  parseWorkersRoutes,
  parseVclBackendRoutes,
  parseEdgeRedirects,
  isEdgeFunctionRoute,
  mapEdgeRoutes,
  edgeRouteFinding,
};
export default EDGE_FUNCTION_ROUTE_MAPPER;
