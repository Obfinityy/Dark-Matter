/**
 * Scope Engine — validates that every tool execution stays within the authorized boundary.
 * The agent can NEVER bypass this layer.
 */

function normalizeDomain(value) {
  let v = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.$/, '');
  // job.target may be a full URL (queue/schedule hunts) or a bare hostname.
  // Reduce URLs to host[:port] so scope checks compare like with like.
  // The port is kept: 127.0.0.1:4555 and 127.0.0.1:9000 are different scopes.
  // Default ports are folded away so http://host ≡ http://host:80.
  let scheme = '';
  const schemeMatch = v.match(/^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)/);
  if (schemeMatch) {
    scheme = schemeMatch[1];
    v = schemeMatch[2];
  } else v = v.split('/')[0];
  if ((scheme === 'http' && v.endsWith(':80')) || (scheme === 'https' && v.endsWith(':443'))) {
    v = v.slice(0, v.lastIndexOf(':'));
  }
  return v.replace(/^www\./, '').replace(/\.$/, '');
}

/** Split "host[:port]" into [host, port|null]; tolerates [ipv6]:port. */
function splitHostPort(hostport) {
  const v = String(hostport || '');
  const bracketed = v.match(/^\[([^\]]+)\](?::(\d+))?$/);
  if (bracketed) return [bracketed[1].toLowerCase(), bracketed[2] || null];
  const idx = v.lastIndexOf(':');
  if (idx > 0 && /^\d+$/.test(v.slice(idx + 1)) && !v.slice(0, idx).includes(':')) {
    return [v.slice(0, idx).toLowerCase(), v.slice(idx + 1)];
  }
  return [v.toLowerCase(), null];
}

/**
 * Does a scope entry cover a normalized host[:port]?
 * - Entry WITH a port pins it: only that exact host:port (or its subdomains
 *   on the same port) is covered.
 * - Entry WITHOUT a port covers the host on any port (domain-level grant).
 */
export function scopeEntryCovers(entry, hostport) {
  const [host, port] = splitHostPort(hostport);
  const [entryHost, entryPort] = splitHostPort(entry);
  if (!entryHost || !host) return false;
  const hostMatch = host === entryHost || host.endsWith(`.${entryHost}`);
  if (!hostMatch) return false;
  if (entryPort) return port === entryPort;
  return true;
}

export class ScopeEngine {
  constructor(scope, targetHostname) {
    this.targetHostname = normalizeDomain(targetHostname);
    this.included = (scope?.included || [this.targetHostname]).map(normalizeDomain);
    this.excluded = (scope?.excluded || []).map(normalizeDomain);
  }

  /** Check if a hostname/domain is inside the authorized scope. */
  isDomainInScope(domain) {
    const normalized = normalizeDomain(domain);
    if (!normalized) return false;
    // Excluded entries win, then an included entry must cover the host[:port].
    if (this.excluded.some(ex => scopeEntryCovers(ex, normalized))) return false;
    return this.included.some(inc => scopeEntryCovers(inc, normalized));
  }

  /** Check if a URL is inside the authorized scope. */
  isUrlInScope(url) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;
      // parsed.host keeps an explicit non-default port (127.0.0.1:4555);
      // parsed.hostname would silently drop it and never match a ported scope.
      return this.isDomainInScope(parsed.host);
    } catch {
      return false;
    }
  }

  /** Filter a list of subdomains, keeping only in-scope ones. */
  filterSubdomains(subdomains) {
    return (subdomains || []).filter(s => this.isDomainInScope(s));
  }

  /** Filter a list of URLs, keeping only in-scope ones. */
  filterUrls(urls) {
    return (urls || []).filter(u => this.isUrlInScope(u));
  }

  /** Validate a tool execution target before it runs. */
  validateToolTarget(toolTarget) {
    if (!toolTarget) return { valid: false, reason: 'No target specified' };

    // Could be a hostname, URL, or IP
    try {
      const url = new URL(toolTarget);
      if (!this.isUrlInScope(url.href)) {
        return { valid: false, reason: `URL ${url.href} is outside the authorized scope` };
      }
      return { valid: true };
    } catch {
      // Not a URL — treat as hostname
      if (!this.isDomainInScope(toolTarget)) {
        return { valid: false, reason: `Domain ${toolTarget} is outside the authorized scope` };
      }
      return { valid: true };
    }
  }

  /** Get scope summary for logging/events. */
  summary() {
    return {
      target: this.targetHostname,
      included: [...this.included],
      excluded: [...this.excluded],
    };
  }
}
