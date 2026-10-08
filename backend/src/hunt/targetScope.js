/**
 * targetScope.js — authorized-target allowlist gate (VM control design §7).
 *
 * A hunt (or VM control session) declares its target scope at start. Every
 * shell-type action is checked against the scope before it is allowed to run:
 * only the declared target hosts (plus common safe-local ranges used by the
 * VM sandbox) may be executed against. Anything else is blocked.
 *
 * Pure functions — no I/O, safe to unit test.
 */

/** Ranges that are always in scope: VM sandbox / loopback networking. */
const SAFE_LOCAL_RES = [
  /^localhost$/i,
  /^127\./, // loopback
  /^10\./, // RFC1918
  /^192\.168\./, // RFC1918
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC1918
  /^::1$/, // IPv6 loopback
  /^0\.0\.0\.0$/,
];

/**
 * Normalize a declared target (hostname, URL, or IP) to a bare lowercase host.
 * @param {string} raw
 * @returns {string} '' when unparseable
 */
export function normalizeHost(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  s = s.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, ''); // strip scheme
  s = s.split('/')[0]; // strip path/query
  s = s.replace(/^\[([^\]]+)\](:\d+)?$/, '$1'); // [ipv6] or [ipv6]:port
  // Strip a trailing :port (but not the colons of a bare IPv6 address).
  if (/^[A-Za-z0-9_.\-]+:\d+$/.test(s)) s = s.slice(0, s.lastIndexOf(':'));
  s = s.toLowerCase();
  if (!/^[A-Za-z0-9_.\-:]+$/.test(s) || s.length > 253) return '';
  return s;
}

/**
 * Extract the host from a sanitized tool target.
 * @param {string} target
 * @returns {string} bare host, or '' when unparseable
 */
export function hostOfTarget(target) {
  return normalizeHost(target);
}

/**
 * Build an allowlist gate from the declared hunt target scope.
 * @param {string|string[]} declared — e.g. 'example.com' or ['https://shop.example.com', '10.0.2.15']
 * @returns {{ hosts: string[], allows(host: string): boolean }}
 */
export function createTargetScope(declared) {
  const list = Array.isArray(declared) ? declared : [declared];
  const hosts = [];
  for (const d of list) {
    const h = normalizeHost(d);
    if (h && !hosts.includes(h)) hosts.push(h);
  }
  return {
    hosts,
    /**
     * True when `host` is the declared host, a subdomain of it, or a
     * safe-local address.
     */
    allows(host) {
      const h = normalizeHost(host);
      if (!h) return false;
      if (SAFE_LOCAL_RES.some((re) => re.test(h))) return true;
      for (const allowed of hosts) {
        if (h === allowed || h.endsWith(`.${allowed}`)) return true;
      }
      return false;
    },
  };
}

export default { createTargetScope, normalizeHost, hostOfTarget };
