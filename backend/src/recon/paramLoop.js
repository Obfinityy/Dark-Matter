/**
 * Wayback/gau param loop — collect historical URLs → dedup → extract params →
 * arjun confirms live params → sqlmap/dalfox test them.
 *
 * Old URLs are where the forgotten params live: debug flags, legacy API
 * versions, admin panels indexed years ago. The loop turns archive noise
 * into live parameter candidates.
 */

/** Collect URLs from gau/waybackurls line output → deduped, in-scope list. */
export function collectArchiveUrls(rawOutputs = [], { baseHost = null, max = 5000 } = {}) {
  const seen = new Set();
  const urls = [];
  const sources = Array.isArray(rawOutputs) ? rawOutputs : [rawOutputs];
  for (const raw of sources) {
    for (const line of String(raw || '').split('\n')) {
      const t = line.trim();
      if (!t || seen.has(t)) continue;
      try {
        const u = new URL(t);
        if (!['http:', 'https:'].includes(u.protocol)) continue;
        if (baseHost && u.hostname !== baseHost && !u.hostname.endsWith(`.${baseHost}`)) continue;
        // Drop static assets — params on images are noise
        if (/\.(png|jpe?g|gif|svg|ico|css|woff2?|ttf|mp4|mp3)(\?|$)/i.test(u.pathname)) continue;
        seen.add(t);
        urls.push(t);
        if (urls.length >= max) break;
      } catch {
        /* skip unparseable */
      }
    }
    if (urls.length >= max) break;
  }
  return { urls, count: urls.length };
}

/** Group URLs by (path without query) → set of param names seen across archives. */
export function extractParamCandidates(urls) {
  const byPath = new Map();
  for (const raw of urls) {
    try {
      const u = new URL(raw);
      const key = `${u.origin}${u.pathname}`;
      if (!byPath.has(key)) byPath.set(key, { url: key, params: new Set(), samples: [] });
      const entry = byPath.get(key);
      for (const [name] of u.searchParams) entry.params.add(name);
      if (entry.samples.length < 3) entry.samples.push(raw);
    } catch {
      /* skip */
    }
  }
  return [...byPath.values()]
    .map(e => ({ url: e.url, params: [...e.params], samples: e.samples }))
    .filter(e => e.params.length > 0)
    .sort((a, b) => b.params.length - a.params.length);
}

/** Interesting params (debug/admin/auth/PII/traversal/redirect) get tested first. */
const HIGH_VALUE_PARAM =
  /^(debug|test|admin|id|user|uid|account|key|token|api[_-]?key|secret|password|passwd|pwd|email|phone|ssn|redirect|url|next|callback|file|path|page|include|template|lang|locale|_method)$/i;

export function prioritizeParams(candidates) {
  return candidates
    .map(c => ({
      ...c,
      highValue: c.params.filter(p => HIGH_VALUE_PARAM.test(p)),
      score: c.params.filter(p => HIGH_VALUE_PARAM.test(p)).length * 10 + c.params.length,
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Build arjun confirmation requests, then sqlmap/dalfox test requests for
 * the top candidates. arjunArgs passed through to the executor.
 */
export function buildParamTestPlan(
  candidates,
  {
    maxArjunTargets = 30,
    maxTestTargets = 20,
    arjunArgs = ['--json'],
    includeSqlmap = true,
    includeDalfox = true,
  } = {}
) {
  const prioritized = prioritizeParams(candidates);
  const arjunTargets = prioritized.slice(0, maxArjunTargets);
  const testTargets = prioritized.slice(0, maxTestTargets);
  const requests = [];

  for (const c of arjunTargets) {
    requests.push({
      tool: 'arjun',
      target: c.url,
      arguments: { args: [...arjunArgs] },
      description: `arjun param discovery on archive-found endpoint (${c.params.length} archived param(s): ${c.params.slice(0, 8).join(', ')})`,
      meta: { archivedParams: c.params, highValue: c.highValue },
    });
  }
  for (const c of testTargets) {
    const seedUrl = `${c.url}?${c.highValue
      .concat(c.params.filter(p => !c.highValue.includes(p)))
      .slice(0, 5)
      .map(p => `${encodeURIComponent(p)}=1`)
      .join('&')}`;
    if (includeDalfox) {
      requests.push({
        tool: 'dalfox',
        target: seedUrl,
        arguments: { args: ['url', '--silence', '--format', 'json'] },
        description: `dalfox XSS on archive-derived params (${c.highValue.join(', ') || c.params.slice(0, 3).join(', ')})`,
        meta: { archivedParams: c.params },
      });
    }
    if (includeSqlmap) {
      requests.push({
        tool: 'sqlmap',
        target: seedUrl,
        arguments: { args: ['--batch', '--risk=1', '--level=1', '--random-agent'] },
        description: `sqlmap (risk 1, batch) on archive-derived params — needs permissionMode full/approval`,
        meta: { archivedParams: c.params, needsApproval: true },
      });
    }
  }

  return {
    requests,
    stats: {
      urlsWithParams: candidates.length,
      arjunTargets: arjunTargets.length,
      testTargets: testTargets.length,
      highValueHits: prioritized.filter(c => c.highValue.length).length,
    },
  };
}

/** One-call loop: raw archive outputs → prioritized test plan. */
export function paramLoop(rawOutputs, { baseHost = null, ...planOpts } = {}) {
  const { urls } = collectArchiveUrls(rawOutputs, { baseHost });
  const candidates = extractParamCandidates(urls);
  return {
    ...buildParamTestPlan(candidates, planOpts),
    collected: urls.length,
  };
}
