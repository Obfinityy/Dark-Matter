// Dark Matter rule-based scanner — target intake + scope enforcement.
// No AI, no network beyond the target itself. Authorized targets only.
//
// Authorization model (matches the hunt lifecycle): the USER explicitly
// confirms the target (confirmedAuthorized) at scan creation. The scope
// object then constrains every request the scanner makes — see assertInScope.
import { buildScope } from '../scopeGuard.js';

export function normalizeTarget(raw) {
  const s = String(raw || '').trim();
  if (!s) throw new Error('scanner: empty target');
  const withScheme = s.includes('://') ? s : `https://${s}`;
  let u;
  try {
    u = new URL(withScheme);
  } catch {
    throw new Error(`scanner: invalid target URL: ${s}`);
  }
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new Error('scanner: only http/https targets are supported');
  }
  return u.toString().replace(/\/$/, '');
}

// Throws unless the user explicitly confirmed this target.
export function authorizeTarget({
  target,
  scope = '',
  labTargets = '',
  confirmedAuthorized = false,
}) {
  if (!confirmedAuthorized) {
    throw new Error(
      'scanner: target not authorized — the user must confirm the target before scanning'
    );
  }
  const url = normalizeTarget(target);
  const sc = buildScope({ target: url, scope, labTargets });
  const host = new URL(url).hostname.toLowerCase();
  return { url, host, scope: sc };
}

// Per-request check: the scanner only ever fetches in-scope URLs.
export function assertInScope(requestUrl, scopeObj) {
  let host;
  try {
    host = new URL(requestUrl).hostname.toLowerCase();
  } catch {
    throw new Error(`scanner: invalid request URL: ${requestUrl}`);
  }
  const sc = scopeObj || {};
  if (Array.isArray(sc.outHosts) && sc.outHosts.includes(host)) {
    throw new Error(`scanner: host explicitly out of scope: ${host}`);
  }
  const ok =
    (Array.isArray(sc.hosts) && sc.hosts.includes(host)) ||
    (Array.isArray(sc.ips) && sc.ips.includes(host)) ||
    (Array.isArray(sc.labIps) && sc.labIps.includes(host));
  if (!ok) {
    throw new Error(`scanner: request outside authorized scope: ${host}`);
  }
  return true;
}
