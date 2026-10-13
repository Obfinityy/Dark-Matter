// Dark Matter hunt-intel — JS endpoint + secret mining.
// Techniques: LinkFinder (MIT) + jsluice (MIT) + unwebpack-sourcemap (MIT).
// Hidden endpoints are where zero-days live — mine every JS bundle.

/** LinkFinder-style: extract URLs/paths from JS text. */
export function mineJsEndpoints(jsText) {
  const found = new Set();
  const patterns = [
    // fetch("/api/..."), axios.get('...'), $.ajax({url: ...})
    /(?:fetch|axios\.(?:get|post|put|delete)|url)\s*\(\s*["'`]([^"'`]+)["'`]/gi,
    // "/api/v1/users" string literals that look like endpoints
    /["'`](\/(?:api|v\d+|admin|graphql|internal)[^"'`\s]*)["'`]/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(jsText || ''))) {
      const u = m[1];
      if (u.length > 2 && u.length < 200) found.add(u);
    }
  }
  return [...found];
}

/** jsluice-style: find where URLs are semantically USED (fetch/XHR/location). */
export function semanticUrlUsage(jsText) {
  const usage = [];
  const sinks = [
    { name: 'fetch', re: /fetch\s*\(\s*([^,)]+)/g },
    { name: 'xhr_open', re: /\.open\s*\(\s*["'](?:GET|POST|PUT|DELETE|PATCH)["']\s*,\s*([^,)]+)/gi },
    { name: 'location', re: /(?:location\.href|window\.open)\s*=\s*([^;]+)/g },
    { name: 'websocket', re: /new\s+WebSocket\s*\(\s*([^,)]+)/g },
  ];
  for (const sink of sinks) {
    let m;
    while ((m = sink.re.exec(jsText || ''))) {
      usage.push({ sink: sink.name, arg: m[1].trim().slice(0, 200) });
    }
  }
  return usage;
}

/** Detect sourceMappingURL trailers for unminified source recovery. */
export function findSourceMaps(jsText) {
  const m = /\/\/#\s*sourceMappingURL=(\S+)/.exec(jsText || '');
  return m ? m[1] : null;
}

/** Rank mined endpoints by bounty value. */
export function rankEndpoints(endpoints) {
  const score = (e) => {
    let s = 0;
    if (/admin|internal|debug/i.test(e)) s += 3;
    if (/graphql/i.test(e)) s += 2;
    if (/api\/v\d+/i.test(e)) s += 2;
    if (/api/i.test(e)) s += 1;
    return s;
  };
  return [...endpoints].sort((a, b) => score(b) - score(a));
}
