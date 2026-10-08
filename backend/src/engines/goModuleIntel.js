/**
 * goModuleIntel.js — Go module proxy host extraction (idea 00226).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses `go.mod` module paths and GOPROXY-style / vanity-import URLs to
 * recover organization-owned domains: custom `gopkg.in`-style vanity import
 * hosts, private GOPROXY / GOSUMDB endpoints, and `replace` directives that
 * point at internal module proxies. Useful only against targets the operator
 * is authorized to assess.
 */

/**
 * Normalize a URL/host string to a hostname; null when unusable or when it
 * is public Go infrastructure (proxy.golang.org, gopkg.in, etc.).
 * @param {string} value
 * @returns {string|null}
 */
export function toHost(value) {
  if (!value) return null;
  const s = String(value)
    .trim()
    .replace(/^['"]|['"]$/g, '');
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    const h = u.hostname.toLowerCase();
    if (!h || h === 'localhost') return null;
    if (/^(proxy|index|sumdb?)\.golang\.org$/.test(h)) return null;
    if (/^(gopkg|golang)\.in$/.test(h)) return null;
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) return null;
    return h;
  } catch {
    return null;
  }
}

/**
 * Extract the host portion of a Go module path (first path segment).
 * Skips gopkg.in shorthand (no host info).
 * @param {string} modulePath
 * @returns {string|null}
 */
export function modulePathToHost(modulePath) {
  const s = String(modulePath || '').trim();
  if (!s || /^gopkg\.in(\/|$)/i.test(s)) return null;
  const first = s.split('/')[0];
  if (!/\./.test(first)) return null;
  return toHost(first);
}

/**
 * Idea 00226 — parse `go.mod` (and related) content for org-owned hosts.
 *
 * Reads:
 *  - `module <path>` declaration (vanity import domain)
 *  - `require` / `replace` module paths (internal mirrors, private proxies)
 *  - `GOPROXY=` / `GOSUMDB=` / `GONOSUMDB=` style env lines sometimes
 *    pasted into build docs alongside go.mod
 *
 * @param {string} goModText - Raw go.mod text (optionally with GOPROXY lines).
 * @returns {{ hosts: Array<{host: string, provenance: string, detail?: string}> }}
 */
export function parseGoModuleHosts(goModText) {
  const hits = [];
  const seen = new Set();
  const add = (host, provenance, detail) => {
    if (!host || seen.has(`${host}|${provenance}`)) return;
    seen.add(`${host}|${provenance}`);
    hits.push({ host, provenance, ...(detail ? { detail } : {}) });
  };

  const text = String(goModText || '');

  const moduleDecl = text.match(/^\s*module\s+([^\s]+)/m);
  if (moduleDecl) {
    const host = modulePathToHost(moduleDecl[1]);
    if (host) add(host, 'module', moduleDecl[1]);
  }

  for (const m of text.matchAll(/^\s*replace\s+([^\s]+)\s+=>\s+([^\s]+)/gm)) {
    const target = m[2];
    if (/^\.\.?(\/|$)/.test(target)) continue; // local filesystem path
    const host = modulePathToHost(target) || toHost(target);
    if (host) add(host, 'replace', `${m[1]} => ${target}`);
  }

  for (const m of text.matchAll(
    /^\s*(?:GOPROXY|GOSUMDB|GONOSUMCHECKDB|GONOSUMDB|GOPRIVATE|GONOPROXY)\s*=\s*['"]?([^\s'"]+)['"]?/gim
  )) {
    for (const part of m[1].split(',').map(s => s.trim())) {
      if (!part || /^(off|direct|none)$/i.test(part)) continue;
      const host = toHost(part);
      if (host) add(host, 'goenv', `${m[0].split('=')[0].trim()}=${part}`);
    }
  }

  return { hosts: hits };
}

/**
 * Parse a vanity-import HTML page (`?go-get=1`) for the import prefix host.
 * Go vanity hosts serve a `<meta name="go-import" content="prefix vcs root">`
 * tag; the prefix itself is the org's domain.
 * @param {string} html - Raw HTML of the vanity import URL with ?go-get=1.
 * @returns {{ vanityHost: string|null, vcs: string|null, repoRoot: string|null }}
 */
export function parseGoVanityImport(html) {
  const m = String(html || '').match(/<meta\s+name=["']go-import["']\s+content=["']([^"']+)["']/i);
  if (!m) return { vanityHost: null, vcs: null, repoRoot: null };
  const [prefix, vcs, root] = m[1].split(/\s+/);
  return {
    vanityHost: modulePathToHost(prefix),
    vcs: vcs || null,
    repoRoot: root || null,
  };
}

/**
 * Build fetch targets for a Go module path.
 * @param {string} modulePath - e.g. "go.example.com/team/service"
 */
export function goModuleTargets(modulePath) {
  const first = String(modulePath || '').split('/')[0];
  return [`https://${first}/?go-get=1`];
}
