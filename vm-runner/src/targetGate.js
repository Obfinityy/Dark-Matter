/**
 * Target-scope gate for VM shell/input actions.
 *
 * Each session declares its authorized target at POST /vm/start (e.g. the
 * hunt target domain). The gate inspects every command and typed text for
 * host references and refuses anything outside the declared scope.
 *
 * Allowlist:
 *  - the session's declared target (exact host or any subdomain of it)
 *  - safe-local ranges, always allowed: loopback (127.0.0.0/8, ::1,
 *    "localhost") and the QEMU guest NAT network (10.0.2.0/24)
 *
 * Anything else referenced in a command → { allowed: false } and the runner
 * answers 403 { ok:false, code:'out_of_scope' }.
 *
 * This is a first-line guard, not a sandbox escape analysis: the VM itself
 * is the sandbox (NAT only, throwaway overlay disk).
 */
import net from 'node:net';

const URL_RE = /[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^\s/?#]+)/g;
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
// Bare domain-like tokens (nmap example.com). File extensions are excluded
// so `report.txt` is not mistaken for a host.
const FILE_EXTENSIONS = new Set(
  'txt md json xml html htm log sh py js ts css png jpg jpeg gif pdf zip 7z gz tar qcow2 iso exe msi yaml yml toml ini cfg conf db sqlite nmap gnmap'.split(
    ' ',
  ),
);
const BARE_DOMAIN_RE =
  /(?:^|[\s"'`(=,;])([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+)(?::\d+)?(?=[\s"'`),;:/]|$)/g;

function normalizeHost(raw) {
  let h = String(raw).trim();
  // Strip userinfo: user:pw@host
  const at = h.lastIndexOf('@');
  if (at >= 0) h = h.slice(at + 1);
  // Strip [ipv6] brackets and :port (careful not to break bare IPv6)
  if (h.startsWith('[')) {
    const close = h.indexOf(']');
    if (close >= 0) h = h.slice(1, close);
  } else if (h.indexOf(':') === h.lastIndexOf(':')) {
    const colon = h.lastIndexOf(':');
    if (colon >= 0 && /^\d+$/.test(h.slice(colon + 1))) h = h.slice(0, colon);
  }
  return h.toLowerCase();
}

/** Extract candidate host references from free-form command text. */
export function extractHosts(text) {
  const hosts = new Set();
  const input = String(text || '');
  let m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(input)) !== null) {
    const h = normalizeHost(m[1]);
    if (h) hosts.add(h);
  }
  IPV4_RE.lastIndex = 0;
  while ((m = IPV4_RE.exec(input)) !== null) {
    hosts.add(m[0]);
  }
  BARE_DOMAIN_RE.lastIndex = 0;
  while ((m = BARE_DOMAIN_RE.exec(input)) !== null) {
    const h = normalizeHost(m[1]);
    if (!h || net.isIP(h)) continue;
    const ext = h.split('.').pop();
    if (FILE_EXTENSIONS.has(ext)) continue;
    if (!/^[a-z]{2,}$/.test(ext)) continue; // TLD must look like a TLD
    hosts.add(h);
  }
  return [...hosts];
}

function isLoopback(host) {
  if (host === 'localhost' || host === '::1') return true;
  if (net.isIP(host) === 4) {
    return host.split('.').map(Number)[0] === 127;
  }
  return false;
}

function isGuestNat(host) {
  // QEMU user-mode networking: guest lives at 10.0.2.15, gateway 10.0.2.2.
  if (net.isIP(host) !== 4) return false;
  const [a, b, c] = host.split('.').map(Number);
  return a === 10 && b === 0 && c === 2;
}

function matchesTarget(host, target) {
  if (!target) return false;
  const t = normalizeHost(target);
  if (!t) return false;
  if (net.isIP(t)) return host === t;
  return host === t || host.endsWith(`.${t}`);
}

/**
 * Decide whether a command may run in the session's VM.
 * @param {{ command: string, target?: string }} opts
 * @returns {{ allowed: boolean, hosts: string[], reason?: string }}
 */
export function checkCommandScope({ command, target }) {
  const hosts = extractHosts(command);
  for (const host of hosts) {
    if (isLoopback(host) || isGuestNat(host)) continue;
    if (matchesTarget(host, target)) continue;
    return {
      allowed: false,
      hosts,
      reason: target
        ? `host "${host}" is outside the session's declared target "${target}"`
        : `host "${host}" is outside the sandbox: declare a target at /vm/start to authorize external hosts`,
    };
  }
  return { allowed: true, hosts };
}
