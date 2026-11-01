import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// Dark Matter — Scope understanding for bug bounty hunts.
//
// When a user enters a target + scope, the agent automatically understands:
// - What's in scope (domains, paths, features)
// - What's OUT of scope (must never touch)
// - Program rules (no DoS, no heavy scanning, custom User-Agent, etc.)
//
// This is how the agent hunts like a human who read the program brief.

/**
 * Parse the user's scope text into structured rules.
 * @param {string} target - The target URL/host
 * @param {string} scopeText - User's scope description (can be free text)
 * @returns {Object} { inScope, outOfScope, rules, userAgent }
 */
export function parseScope(target, scopeText = '') {
  const scope = String(scopeText || '');
  const lower = scope.toLowerCase();

  // Extract target domain
  let domain = target;
  try {
    const u = new URL(target.includes('://') ? target : `https://${target}`);
    domain = u.hostname;
  } catch { /* use as-is */ }

  const result = {
    target,
    domain,
    inScope: [domain],
    outOfScope: [],
    rules: {
      noDoS: true,           // Always: never DoS
      noHeavyScan: false,    // Set true if program forbids it
      customUserAgent: null, // Set if program requires it
      maxRequestsPerMin: 60, // Conservative default
    },
    rawScope: scope,
  };

  // Detect common out-of-scope patterns from scope text
  const oosPatterns = [
    [/out[\s-]of[\s-]scope:?\s*([^\n]+)/gi],
    [/exclude:?\s*([^\n]+)/gi],
    [/do not test:?\s*([^\n]+)/gi],
    [/not in scope:?\s*([^\n]+)/gi],
  ];
  for (const [regex] of oosPatterns) {
    let m;
    while ((m = regex.exec(scope)) !== null) {
      result.outOfScope.push(m[1].trim());
    }
  }

  // Explicit in-scope enumeration (Lane D, 21 Oct 2026 — Ezviz audit).
  // Until now this parser NEVER read the programme's asset list:
  // inScope was silently just [target domain]. On a multi-asset
  // programme (Ezviz lists 11 assets) the hunt was confined to the
  // single target host — the other named assets were unreachable by
  // the scope gate and invisible on the hunter's screen, and the
  // brief's recommended public surface (www.ezviz.com) could not be
  // touched at all. Extraction is deliberately narrow and fail-closed:
  //   - it runs ONLY when the text carries an explicit "In scope:"
  //     enumeration (no marker -> behaviour is byte-identical to before);
  //   - it reads domain-shaped tokens between that marker and the
  //     first out-of-scope marker;
  //   - hosts named in the out-of-scope region land in
  //     outOfScopeHosts and WIN over the in-scope list (a named
  //     exclusion like test.ys7.com beats the *.ys7.com wildcard).
  result.outOfScopeHosts = [];
  try {
    const inMarker = /in[\s-]?scope\s*:/i.exec(scope);
    if (inMarker) {
      let region = scope.slice(inMarker.index + inMarker[0].length);
      const oosAt = region.search(/out[\s-]?of[\s-]?scope\s*:|exclude\s*:|do not test\s*:|not in scope\s*:/i);
      const oosRegion = oosAt >= 0 ? region.slice(oosAt) : '';
      if (oosAt >= 0) region = region.slice(0, oosAt);
      const domRe = /(?:\*\.)?((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})/gi;
      const hostsIn = new Set();
      const hostsOut = new Set();
      let dm;
      while ((dm = domRe.exec(region)) !== null) hostsIn.add(dm[1].toLowerCase());
      domRe.lastIndex = 0;
      while ((dm = domRe.exec(oosRegion)) !== null) hostsOut.add(dm[1].toLowerCase());
      for (const h of hostsOut) {
        // The target domain itself is never listed as an out host:
        // contradictory text must not brick the hunt's own target.
        if (h !== domain) result.outOfScopeHosts.push(h);
      }
      for (const h of hostsIn) {
        if (hostsOut.has(h)) continue; // named in both lists -> fail closed (out wins)
        if (!result.inScope.includes(h)) result.inScope.push(h);
      }
    }
  } catch { /* extraction is best-effort; the [domain] default stands */ }

  // Detect program rules
  if (/no[\s-]?dos|denial of service.*forbidden|dos.*not allowed/i.test(scope)) {
    result.rules.noDoS = true;
  }
  if (/no.*automated|no.*scanner|do not use.*scanner/i.test(scope)) {
    result.rules.noHeavyScan = true;
    result.rules.maxRequestsPerMin = 20;
  }
  // Custom User-Agent
  const uaMatch = scope.match(/user[\s-]?agent.*?(?:must be|set to|use)[:\s]*["']?([^"'\n]+)["']?/i);
  if (uaMatch) {
    result.rules.customUserAgent = uaMatch[1].trim();
  }

  // Infomaniak-specific defaults (YesWeHack program)
  if (/infomaniak/i.test(target) || /infomaniak/i.test(scope)) {
    result.rules.customUserAgent = 'Infomaniak-YWH-Bugbounty';
    result.rules.noDoS = true;
    result.rules.noHeavyScan = true;
    result.rules.maxRequestsPerMin = 20;
    result.outOfScope.push(
      'DoS/DDoS attacks',
      'Brute force attacks',
      'Automated scanners with heavy traffic',
      'OpenStack dashboard (Horizon)',
      'Customer subdomains (*.ftp, *.vps, *.myd, *.jcloud)',
      'HTML injection in emails',
      'Business logic errors (unless critical PII leak)',
    );
  }

  return result;
}

/**
 * Check if a URL/path is in scope.
 * @param {string} url - URL to check
 * @param {Object} parsedScope - Result from parseScope()
 * @returns {boolean}
 */
export function isInScope(url, parsedScope) {
  if (!parsedScope) return true;
  try {
    if (typeof url !== 'string' || !url.trim()) return false;
    const u = new URL(url.includes('://') ? url : `https://${url}`);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname) return false;
    const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const candidates = Array.isArray(parsedScope.inScope) && parsedScope.inScope.length
      ? parsedScope.inScope
      : [parsedScope.domain];
    const matchesHost = (candidate) => {
      const allowed = String(candidate || '').toLowerCase().replace(/^\*\./, '').replace(/^\[|\]$/g, '');
      return !!allowed && (host === allowed || host.endsWith('.' + allowed));
    };
    if (!candidates.some(matchesHost)) return false;
    if ((parsedScope.outOfScopeHosts || []).some(matchesHost)) return false;
    const path = (u.pathname + u.search).toLowerCase();
    for (const oos of parsedScope.outOfScope || []) {
      if (path.includes(String(oos).toLowerCase())) return false;
    }
    return true;
  } catch {
    return false; // Invalid/unparseable targets must fail closed.
  }
}

/**
 * Get the User-Agent to use for this hunt.
 */
export function getHuntUserAgent(parsedScope) {
  return parsedScope?.rules?.customUserAgent || 'DarkMatter-Hunt/1.0 (bug-bounty; authorized)';
}

/**
 * FIX #154: Check if an IP address is private/internal (SSRF protection).
 * Blocks: 10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x (cloud metadata), 0.0.0.0
 */
export function isPrivateIP(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '');
  // IPv6 unspecified, loopback, unique-local (fc00::/7), and link-local (fe80::/10).
  if (lower === '::' || lower === '::1' || /^(fc|fd)/.test(lower) || /^fe[89ab]/.test(lower)) return true;
  // IPv4-mapped IPv6 addresses inherit the IPv4 classification.
  const mapped = lower.match(/^(?:::ffff:)(\\d+\\.\\d+\\.\\d+\\.\\d+)$/);
  if (mapped) return isPrivateIP(mapped[1]);
  if (isIP(lower) !== 4) return false;
  const parts = lower.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local, cloud metadata)
  if (a === 169 && b === 254) return true;
  // Unspecified, carrier-grade NAT, benchmarking, multicast, and reserved ranges.
  if (a === 0 || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) || a >= 224) return true;
  return false;
}

/**
 * FIX #154: Validate target URL against SSRF.
 * Returns { valid: true } or { valid: false, reason }.
 * This is a synchronous check — for DNS resolution, use validateTargetAsync.
 */
export function validateTargetSSRF(target) {
  try {
    const urlStr = target.includes('://') ? target : `https://${target}`;
    const u = new URL(urlStr);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname || u.username || u.password) {
      return { valid: false, reason: 'Only credential-free HTTP(S) targets are allowed' };
    }
    const hostname = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    // Block localhost variants
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return { valid: false, reason: 'Target is localhost (SSRF blocked)' };
    }

    // If hostname is already an IP, check directly
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      if (isPrivateIP(hostname)) {
        return { valid: false, reason: `Target IP ${hostname} is private/internal (SSRF blocked)` };
      }
    }

    // Block cloud metadata hostnames and metadata aliases.
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal' || hostname.endsWith('.metadata.google.internal')) {
      return { valid: false, reason: 'Cloud metadata endpoint blocked (SSRF)' };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'Invalid target URL' };
  }
}

/** Resolve a hostname and reject any private/non-routable answer. Call before starting network work. */
export async function validateTargetAsync(target) {
  const basic = validateTargetSSRF(target);
  if (!basic.valid) return basic;
  try {
    const urlStr = target.includes('://') ? target : `https://${target}`;
    const hostname = new URL(urlStr).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (isIP(hostname)) return basic;
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length) return { valid: false, reason: 'Target hostname did not resolve' };
    const blocked = addresses.find((entry) => isPrivateIP(entry.address));
    if (blocked) return { valid: false, reason: `Target hostname resolves to private/internal IP ${blocked.address} (SSRF blocked)` };
    return { valid: true, addresses: addresses.map((entry) => entry.address) };
  } catch {
    return { valid: false, reason: 'Target DNS validation failed' };
  }
}
