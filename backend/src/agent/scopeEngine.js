/**
 * Scope Engine — validates that every tool execution stays within the authorized boundary.
 * The agent can NEVER bypass this layer.
 */

function normalizeDomain(value) {
  return String(value || '').trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
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
    // Check excluded first
    if (this.excluded.some(ex => normalized === ex || normalized.endsWith(`.${ex}`))) return false;
    // Check included
    return this.included.some(inc => normalized === inc || normalized.endsWith(`.${inc}`));
  }

  /** Check if a URL is inside the authorized scope. */
  isUrlInScope(url) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;
      return this.isDomainInScope(parsed.hostname);
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
      excluded: [...this.excluded]
    };
  }
}
