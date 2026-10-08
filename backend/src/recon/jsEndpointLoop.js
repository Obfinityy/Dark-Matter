/**
 * JS endpoint testing loop — katana / linkfinder output → extract endpoints +
 * parameters → feed dalfox (XSS) and nuclei (exposure/misconfig) on them.
 *
 * The loop closes the recon→detection gap for JS-heavy targets: an endpoint
 * is only "covered" when a scanner has actually been pointed at it.
 */

/** Parse katana JSONL records → [{url, method, source}]. */
export function extractEndpointsFromKatana(raw, { baseHost = null } = {}) {
  if (!raw) return { endpoints: [], count: 0 };
  const seen = new Set();
  const endpoints = [];
  for (const line of String(raw).split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t);
      const url = String(obj.url || obj.request?.url || '').trim();
      if (!url || seen.has(url)) continue;
      if (baseHost) {
        try {
          if (new URL(url).hostname !== baseHost) continue; // stay in scope
        } catch {
          continue;
        }
      }
      seen.add(url);
      endpoints.push({
        url,
        method: String(obj.method || obj.request?.method || 'GET').toUpperCase(),
        source: 'katana',
      });
    } catch {
      /* skip malformed lines */
    }
  }
  return { endpoints, count: endpoints.length };
}

/** Parse linkfinder CLI output (one endpoint per line, relative or absolute) → absolute URLs. */
export function extractEndpointsFromLinkfinder(raw, baseUrl) {
  if (!raw || !baseUrl) return { endpoints: [], count: 0 };
  const base = new URL(baseUrl);
  const seen = new Set();
  const endpoints = [];
  for (const line of String(raw).split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    try {
      const url = new URL(t, base).toString();
      const u = new URL(url);
      if (u.hostname !== base.hostname) continue; // out of scope
      if (seen.has(url)) continue;
      seen.add(url);
      endpoints.push({ url, method: 'GET', source: 'linkfinder' });
    } catch {
      /* skip unparseable */
    }
  }
  return { endpoints, count: endpoints.length };
}

/** Split a URL's query string into {name, value} pairs. */
export function extractParams(url) {
  try {
    return [...new URL(url).searchParams.entries()].map(([name, value]) => ({ name, value }));
  } catch {
    return [];
  }
}

/**
 * Build the testing plan for a set of endpoints:
 *   - URLs WITH query params → dalfox (XSS on each param) — one request per URL
 *   - ALL endpoints → nuclei (exposure/misconfig templates, low-noise)
 * Returns tool requests ready for the executor, plus coverage accounting.
 */
export function buildJsEndpointTestPlan(
  endpoints,
  {
    dalfoxArgs = ['url', '--silence', '--format', 'json'],
    nucleiArgs = ['-silent', '-json', '-severity', 'medium,high,critical', '-rate-limit', '25'],
    maxDalfoxTargets = 50,
    maxNucleiTargets = 200,
  } = {}
) {
  const unique = [...new Map(endpoints.map(e => [e.url, e])).values()];
  const withParams = unique.filter(e => extractParams(e.url).length > 0);
  const dalfoxTargets = withParams.slice(0, maxDalfoxTargets);
  const nucleiTargets = unique.slice(0, maxNucleiTargets);

  const requests = [];
  for (const ep of dalfoxTargets) {
    const params = extractParams(ep.url).map(p => p.name);
    requests.push({
      tool: 'dalfox',
      target: ep.url,
      arguments: { args: [...dalfoxArgs] },
      description: `dalfox XSS scan of JS-discovered endpoint (params: ${params.join(', ')})`,
      meta: { source: ep.source, params },
    });
  }
  if (nucleiTargets.length) {
    requests.push({
      tool: 'nuclei',
      target: nucleiTargets[0].url,
      arguments: { args: [...nucleiArgs, '-l', '__TARGET_LIST__'] },
      description: `nuclei exposure sweep over ${nucleiTargets.length} JS-discovered endpoints`,
      meta: { targetList: nucleiTargets.map(e => e.url), source: 'js-endpoint-loop' },
    });
  }

  return {
    requests,
    coverage: {
      endpointsDiscovered: unique.length,
      withParams: withParams.length,
      dalfoxTargets: dalfoxTargets.length,
      nucleiTargets: nucleiTargets.length,
      uncovered: unique.length - nucleiTargets.length,
    },
  };
}

/**
 * One-call loop: canned katana + linkfinder outputs → test plan.
 * The executor replaces `__TARGET_LIST__` handling per its transport.
 */
export function jsEndpointLoop({ katanaRaw = '', linkfinderRaw = '', baseUrl = '' }, opts = {}) {
  const baseHost = baseUrl ? new URL(baseUrl).hostname : null;
  const katana = extractEndpointsFromKatana(katanaRaw, { baseHost });
  const linkfinder = extractEndpointsFromLinkfinder(linkfinderRaw, baseUrl);
  const merged = [
    ...katana.endpoints,
    ...linkfinder.endpoints.filter(e => !katana.endpoints.some(k => k.url === e.url)),
  ];
  return {
    ...buildJsEndpointTestPlan(merged, opts),
    sources: { katana: katana.count, linkfinder: linkfinder.count },
  };
}
