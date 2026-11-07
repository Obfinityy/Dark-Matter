// Dark Matter — P1 Scope Enforcement (31 Oct 2026, AUD-H1).
//
// Deterministic, code-level destination validation that runs BEFORE any
// command reaches Docker execution. This is the application-layer half of
// scope enforcement (the network layer — per-hunt egress control — is P2,
// which consumes the SAME immutable scope object built here).
//
// Design rules:
// - One immutable scope object per hunt, built at hunt creation from the
//   authorized target + scope text (+ LAB_TARGETS opt-in). Frozen.
// - HOSTNAMES DECIDE, not IPs (shared-IP rule): an in-scope and an
//   out-of-scope hostname may resolve to the same CDN IP — only the in-scope
//   hostname is allowed. Validated: requested hostname, URL, redirects,
//   HTTP Host header, TLS SNI.
// - Fail-closed everywhere: malformed input, missing scope, extraction
//   failure, private IP without lab cover → block.
// - Best-effort shell parsing is a FALLBACK. Callers SHOULD pass structured
//   `destinations`; string parsing cannot see every shell idiom (e.g.
//   `nc host 22` with a space-separated port). P2's network layer is the
//   backstop for what parsing cannot see.
// - Never weakens the existing SSRF protections (scopeParser.js); builds on
//   them. Lab traffic (e.g. DVWA 172.17.0.1:3100) keeps passing via the
//   explicit LAB_TARGETS opt-in.

import { isPrivateIP, parseScope } from './scopeParser.js';

// Cloud metadata endpoints — always blocked, lab exception never applies.
const CLOUD_METADATA_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.google.internal.',
]);

const IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;

/**
 * Build the immutable per-hunt scope object.
 * @param {Object} opts
 * @param {string} opts.target - authorized hunt target (URL or host)
 * @param {string} [opts.scope] - user scope text
 * @param {string} [opts.labTargets] - LAB_TARGETS env value (comma-separated)
 * @returns {Object} frozen scope {version, target, hosts, outHosts, ips, labIps, ports, labTargets, createdAt}
 */
export function buildScope({ target, scope = '', labTargets = '' }) {
  const labList = String(labTargets || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const targetStr = String(target || '');
  // Lab exception uses the SAME substring semantics as the create-route SSRF gate.
  const isLabTarget = labList.length > 0 && labList.some((lab) => targetStr.toLowerCase().includes(lab));

  let targetHost = '';
  let targetPort = null;
  let targetScheme = '';
  try {
    const u = new URL(targetStr.includes('://') ? targetStr : `https://${targetStr}`);
    targetHost = u.hostname.toLowerCase();
    targetScheme = u.protocol.replace(':', '');
    targetPort = u.port ? Number(u.port) : null;
  } catch {
    targetHost = targetStr.toLowerCase();
  }

  // In-scope hostnames: the target host (if a name) + parseScope's asset list.
  let parsed = null;
  try {
    parsed = parseScope(targetStr, scope);
  } catch {
    parsed = null;
  }
  const hosts = [];
  const pushHost = (h) => {
    const lh = String(h || '').toLowerCase().trim();
    if (lh && !hosts.includes(lh)) hosts.push(lh);
  };
  if (targetHost && !IPV4_RE.test(targetHost)) pushHost(targetHost);
  for (const h of (parsed && parsed.inScope) || []) pushHost(h);
  // Structured lists (scopeParser, 1 Nov 2026): named exact assets
  // and wildcard bases. Exact assets also join `hosts` so the P2
  // egress layer resolves them into the ipset — otherwise the shell
  // guard would allow a command the network layer then drops.
  // Wildcard bases do NOT join `hosts`: only their subdomains are
  // authorized, and a base's IPs are not its subdomains' IPs
  // (subdomains with distinct IPs stay network-blocked — fail-closed
  // gap, see the lane report).
  const exactHosts = [];
  const wildcardHosts = [];
  for (const h of (parsed && parsed.inScopeExactHosts) || []) {
    const lh = String(h || '').toLowerCase().trim();
    if (lh && !exactHosts.includes(lh)) exactHosts.push(lh);
  }
  for (const h of (parsed && parsed.inScopeWildcardHosts) || []) {
    const lh = String(h || '').toLowerCase().trim();
    if (lh && !wildcardHosts.includes(lh)) wildcardHosts.push(lh);
  }
  for (const h of exactHosts) pushHost(h);
  const outHosts = [];
  for (const h of (parsed && parsed.outOfScopeHosts) || []) {
    const lh = String(h).toLowerCase().trim();
    if (lh && !outHosts.includes(lh)) outHosts.push(lh);
  }

  // Authorized (port, proto) tuples. Defaults for http(s) targets.
  const ports = [];
  const addPort = (port, proto = 'tcp') => {
    if (!ports.some((p) => p.port === port && p.proto === proto)) ports.push({ port, proto });
  };
  if (targetPort) addPort(targetPort, 'tcp');
  if (targetScheme === 'http' || targetScheme === 'https') {
    addPort(80, 'tcp');
    addPort(443, 'tcp');
  }

  // IP literals. A private target IP is allowed ONLY via the lab opt-in
  // (mirrors the create-route SSRF gate); otherwise it lands in neither
  // list and every command to it is blocked — fail closed.
  const ips = [];
  const labIps = [];
  if (IPV4_RE.test(targetHost)) {
    if (isPrivateIP(targetHost)) {
      if (isLabTarget) labIps.push(targetHost);
    } else {
      ips.push(targetHost);
    }
  }
  // Lab target entries that are IP literals are reachable as lab IPs.
  for (const lab of labList) {
    const m = lab.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    if (m && !ips.includes(m[1]) && !labIps.includes(m[1])) labIps.push(m[1]);
  }

  return Object.freeze({
    version: 1,
    target: targetStr,
    hosts: Object.freeze([...hosts]),
    exactHosts: Object.freeze([...exactHosts]),
    wildcardHosts: Object.freeze([...wildcardHosts]),
    outHosts: Object.freeze([...outHosts]),
    ips: Object.freeze([...ips]),
    labIps: Object.freeze([...labIps]),
    ports: Object.freeze(ports.map((p) => Object.freeze({ ...p }))),
    labTargets: Object.freeze([...labList]),
    createdAt: new Date().toISOString(),
  });
}

/**
 * Resolve the effective scope for a hunt: prefer the immutable scope
 * persisted at creation; fall back to building one from the target
 * (covers hunts created before P1).
 * @param {Object} meta - hunt meta object (may carry scopeGuard)
 * @param {string} target - hunt target
 * @param {string} [labTargets] - LAB_TARGETS env value
 */
export function scopeFromMeta(meta, target, labTargets = '') {
  if (meta && meta.scopeGuard && meta.scopeGuard.version === 1) return meta.scopeGuard;
  return buildScope({
    target: (meta && meta.target) || target,
    scope: (meta && meta.scope) || '',
    labTargets,
  });
}

function validIpv4(ip) {
  if (!IPV4_RE.test(ip)) return false;
  return ip.split('.').every((n) => Number(n) >= 0 && Number(n) <= 255);
}

// Exact match or subdomain match (named exclusions beat wildcards).
function matchesAny(host, list) {
  return (list || []).some((e) => host === e || host.endsWith('.' + e));
}

function normalizeProto(p) {
  return String(p || '').toLowerCase() === 'udp' ? 'udp' : 'tcp';
}

/**
 * Best-effort destination extraction from shell text.
 * Finds: http(s) URLs (→ host, port, protocol, sni), HTTP Host headers,
 * bare IPv4 literals (with optional :port).
 * @param {string} command
 * @returns {Array<{host, port, protocol, url?, sni?, raw}>}
 */
export function extractDestinations(command) {
  const out = [];
  const seen = new Set();
  const push = (d) => {
    const key = `${d.host}|${d.port}|${d.protocol}`;
    if (d.host && !seen.has(key)) {
      seen.add(key);
      out.push(d);
    }
  };
  const cmd = String(command || '');

  // 1. URLs — https URLs yield sni=hostname for TLS SNI validation.
  const urlRe = /https?:\/\/[^\s"'`\]\)\}<>]+/gi;
  let m;
  const foundUrls = [];
  while ((m = urlRe.exec(cmd)) !== null) {
    const raw = m[0].replace(/[.,;:!?]+$/, '');
    foundUrls.push(raw);
    try {
      const u = new URL(raw);
      const isHttps = u.protocol === 'https:';
      const host = u.hostname.toLowerCase();
      push({
        host,
        port: u.port ? Number(u.port) : isHttps ? 443 : 80,
        protocol: isHttps ? 'https' : 'http',
        url: raw,
        sni: isHttps ? host : undefined,
        raw,
      });
    } catch {
      out.push({ host: null, port: null, protocol: 'http', url: raw, raw, malformed: true });
    }
  }
  // 2. HTTP Host headers (incl. inside -H 'Host: ...' flags).
  const rest = foundUrls.reduce((s, u) => s.split(u).join(' '), cmd);
  const hostRe = /(?:^|[^\w])Host\s*:\s*([^\s'"`\r\n;]+)/gim;
  while ((m = hostRe.exec(rest)) !== null) {
    const parts = m[1].split(':');
    const host = parts[0].toLowerCase();
    const port = parts[1] ? Number(parts[1]) : null;
    push({ host, port: Number.isFinite(port) ? port : null, protocol: 'http', header: 'host', raw: m[0].trim() });
  }
  // 3. Bare IPv4 literals (URLs already removed above).
  const ipRe = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::(\d{1,5}))?\b/g;
  while ((m = ipRe.exec(rest)) !== null) {
    push({ host: m[1], port: m[2] ? Number(m[2]) : null, protocol: 'tcp', raw: m[0] });
  }
  return out;
}

function block(reason, d) {
  return {
    ok: false,
    reason,
    blocked: d ? { host: d.host ?? null, port: d.port ?? null, protocol: d.protocol ?? null } : null,
  };
}

function validateOne(d, scope) {
  if (!d || d.malformed) return block('malformed destination in command', d);
  const host = String(d.host || '').toLowerCase().trim();
  if (!host) return block('malformed destination (empty host)', d);

  // Cloud metadata — always blocked, no lab exception.
  if (CLOUD_METADATA_HOSTS.has(host)) return block(`cloud metadata endpoint blocked: ${host}`, d);

  const isIp = IPV4_RE.test(host);
  if (isIp) {
    if (!validIpv4(host)) return block(`malformed IP literal: ${d.host}`, d);
    const allowedIp = (scope.ips || []).includes(host) || (scope.labIps || []).includes(host);
    if (!allowedIp) return block(`IP ${host} is not in the hunt scope`, d);
    // Private IPs are reachable ONLY via the explicit lab list (belt and braces:
    // buildScope already keeps them out of `ips`, but re-check here).
    if (isPrivateIP(host) && !(scope.labIps || []).includes(host)) {
      return block(`private IP ${host} is not lab-authorized`, d);
    }
  } else {
    if (!HOSTNAME_RE.test(host)) return block(`malformed hostname: ${d.host}`, d);
    // Explicit exclusions win over inclusions. Exclusions keep
    // subdomain semantics: excluding a host excludes its subtree.
    if (matchesAny(host, scope.outHosts)) return block(`hostname ${host} is explicitly out of scope`, d);
    // Shared-IP rule: the HOSTNAME decides. An out-of-scope hostname is
    // blocked even if it shares an IP with an in-scope one.
    //
    // 1-Nov exact-host rule (scope-guard widening lane, 7 Nov 2026):
    // `hosts` / `exactHosts` authorize ONLY the listed host itself;
    // `wildcardHosts` authorize subdomains of the base, never the
    // base itself. The old matchesAny() subdomain rule on `hosts`
    // let any target subdomain past the shell guard (and the egress
    // proxy, which reuses this function). Scopes persisted before
    // this lane lack exactHosts/wildcardHosts — they default to []
    // and the tightening still applies via `hosts`.
    const exactOk = (scope.hosts || []).some((e) => host === String(e).toLowerCase()) ||
      (scope.exactHosts || []).some((e) => host === String(e).toLowerCase());
    const wildcardOk = (scope.wildcardHosts || []).some((e) => {
      const base = String(e).toLowerCase().replace(/^\*\./, '');
      return !!base && host !== base && host.endsWith('.' + base);
    });
    if (!exactOk && !wildcardOk) return block(`hostname ${host} is not in the hunt scope`, d);
    // TLS SNI must match the validated hostname when present.
    if (d.sni && String(d.sni).toLowerCase().trim() !== host) {
      return block(`TLS SNI ${d.sni} does not match hostname ${host}`, d);
    }
  }

  // Port + protocol. A null port (e.g. bare `nmap 172.17.0.1`) means the
  // command text carries no port — host validation suffices at the app
  // layer; P2's network layer enforces ports strictly per tuple.
  if (d.port != null) {
    const port = Number(d.port);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      return block(`invalid port ${d.port} for ${host}`, d);
    }
    const proto = normalizeProto(d.protocol);
    const okPort = (scope.ports || []).some((p) => p.port === port && p.proto === proto);
    if (!okPort) return block(`${proto}/${port} is not authorized for ${host}`, d);
  }
  return { ok: true };
}

/**
 * Validate a list of destinations against the scope.
 * @param {Array} destinations
 * @param {Object} scope - from buildScope()
 * @returns {{ok:true}|{ok:false, reason, blocked}}
 */
export function validateDestinations(destinations, scope) {
  if (!scope || scope.version !== 1) {
    return { ok: false, reason: 'no valid hunt scope configured (fail-closed)', blocked: null };
  }
  for (const d of destinations || []) {
    const v = validateOne(d, scope);
    if (!v.ok) return v;
  }
  return { ok: true };
}

/**
 * The gate: validate a command's destinations before execution.
 * Uses structured `destinations` when the caller provides them (preferred —
 * robust), else falls back to best-effort extraction from the command text.
 * @param {Object} opts
 * @param {string} opts.command
 * @param {Array} [opts.destinations] - structured [{host, port, protocol, url?, sni?}]
 * @param {Object} opts.scope - from buildScope()
 * @returns {{allowed:true, destinations}|{allowed:false, reason, blocked?}}
 */
export function guardCommand({ command, destinations, scope }) {
  if (!scope || scope.version !== 1) {
    return { allowed: false, reason: 'no valid hunt scope configured (fail-closed)' };
  }
  let dests = destinations;
  if (!dests) {
    try {
      dests = extractDestinations(command);
    } catch {
      return { allowed: false, reason: 'destination extraction failed (fail-closed)' };
    }
  }
  // No network destinations in the command (local file ops, echo, etc.) —
  // nothing to validate; allowed. Malformed destinations still block.
  const v = validateDestinations(dests, scope);
  if (!v.ok) return { allowed: false, reason: v.reason, blocked: v.blocked };
  return { allowed: true, destinations: dests };
}
