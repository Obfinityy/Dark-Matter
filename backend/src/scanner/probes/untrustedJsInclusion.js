// Dark Matter rule-based scanner — untrusted JavaScript inclusion probe
// (coverage row #98 [High], phase 79).
//
// NARROW DEFINITION (the ledger row is a bare title, so the boundary
// is written down here, in index.js, and in the lane report): this
// phase detects ONE thing — a page that loads executable JavaScript
// from a cross-origin host the scanner cannot trust, with no
// Subresource Integrity hash pinning the code. A <script src> from
// an attacker-controlled or compromised third-party host runs with
// the page's full privileges (cookies, DOM, fetch) — that is the
// supply-chain inclusion behind Magecart-style skimmers (CWE-829:
// inclusion of functionality from an untrusted control sphere).
//
// A finding counts ONLY when ALL of these hold for the same script tag:
//   1. The tag is present verbatim in the fetched page HTML (the
//      evidence quotes the tag — no inference from a bundle list).
//   2. The resolved src host is CROSS-ORIGIN (different host from
//      the page URL — port is ignored; a different port on the same
//      host is still the same host's code) and NOT on the trusted-CDN
//      allowlist below.
//   3. The tag carries NO valid SRI integrity attribute
//      (sha256/sha384/sha512-<base64>). A valid hash pins the code —
//      the inclusion is trusted even from an unknown host, so it
//      never fires.
//
// NON-OVERLAP (by design): the existing "Missing Subresource
// Integrity" headers finding fires on ANY script lacking SRI,
// including same-origin bundles — this phase never re-emits it.
// Same-origin scripts are never findings here (the page's own host
// is trusted by definition). Allowlisted CDN hosts are never
// findings here either (cdnjs / jsdelivr / unpkg / Google / jQuery /
// Bootstrap CDNs — the host itself is the trust anchor). Import maps
// (<script type="importmap">) are OUT of scope: their sources are
// JSON mappings, not tags, and the scanner does not parse them.
// <link rel="modulepreload"> hrefs ARE covered — they load JS too.
//
// SAFETY: read-only — the probe inspects the page HTML the
// fingerprint step already fetched (fp.body, zero extra requests).
// It never fetches the script itself. One finding per distinct
// untrusted origin (first tag per origin wins), capped at 20.

const MAX_FINDINGS = 20;

// Well-known public CDNs — the host itself is the trust anchor, so
// scripts from these hosts never fire here, with or without SRI.
// Deliberately short and explicit: an unknown host is untrusted
// until proven otherwise, never the reverse.
const TRUSTED_CDN_HOSTS = new Set([
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'ajax.googleapis.com',
  'fonts.gstatic.com',
  'code.jquery.com',
  'stackpath.bootstrapcdn.com',
  'maxcdn.bootstrapcdn.com',
]);

const SRI_RE = /^(sha256|sha384|sha512)-[A-Za-z0-9+/]+={0,2}$/;

// A response is binary when it carries a NUL byte — HTML never does.
// Binary bodies are never scanned.
export function isTextBody(text) {
  return typeof text === 'string' && !text.includes('\u0000');
}

function attrValue(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? null;
}

// Is this host trusted: the page's own host, or a trusted CDN host
// (exact match, or a subdomain of one)? Exported for unit tests.
export function isTrustedHost(host, pageHost) {
  if (!host || !pageHost) return false;
  const h = String(host).toLowerCase();
  const p = String(pageHost).toLowerCase();
  if (h === p) return true;
  for (const cdn of TRUSTED_CDN_HOSTS) {
    if (h === cdn || h.endsWith(`.${cdn}`)) return true;
  }
  return false;
}

// Extract executable-JS sources from page HTML: <script src> tags
// plus <link rel="modulepreload"> hrefs. Returns [{ src, integrity,
// tag }] with the verbatim tag for evidence. HTML comments are
// stripped first so commented-out tags never fire. data:/blob:/
// javascript: srcs are skipped here (they are not network inclusions).
export function scriptSrcs(html) {
  if (typeof html !== 'string' || !html) return [];
  const clean = html.replace(/<!--[\s\S]*?-->/g, '');
  const out = [];
  for (const m of clean.matchAll(/<script\b[^>]*>/gi)) {
    const tag = m[0];
    const type = attrValue(tag, 'type');
    if (type && String(type).toLowerCase() === 'importmap') continue;
    const src = attrValue(tag, 'src');
    if (!src) continue;
    if (/^(data|blob|javascript):/i.test(src.trim())) continue;
    out.push({ src: src.trim(), integrity: attrValue(tag, 'integrity'), tag });
  }
  for (const m of clean.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = attrValue(tag, 'rel');
    if (!rel || !/\bmodulepreload\b/i.test(rel)) continue;
    const href = attrValue(tag, 'href');
    if (!href) continue;
    if (/^(data|blob|javascript):/i.test(href.trim())) continue;
    out.push({ src: href.trim(), integrity: attrValue(tag, 'integrity'), tag });
  }
  return out;
}

function snippet(tag) {
  return String(tag).replace(/\s+/g, ' ').trim().slice(0, 300);
}

/**
 * Probe untrusted JavaScript inclusion (#98). @param {object} input —
 * { url, html }: the pasted page URL and the HTML the fingerprint
 * step already fetched. @returns {object[]} findings (class
 * 'untrusted_js_inclusion', high) — at most one per distinct
 * untrusted origin, capped at MAX_FINDINGS.
 */
export function probeUntrustedJsInclusion({ url, html }) {
  if (typeof url !== 'string' || !url) return [];
  if (!isTextBody(html)) return [];
  let pageHost;
  try {
    pageHost = new URL(url).hostname.toLowerCase();
  } catch {
    return [];
  }
  const findings = [];
  const seenOrigins = new Set();
  for (const s of scriptSrcs(html)) {
    if (findings.length >= MAX_FINDINGS) break;
    let resolved;
    try {
      resolved = new URL(s.src, url);
    } catch {
      continue;
    }
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue;
    const host = resolved.hostname.toLowerCase();
    if (isTrustedHost(host, pageHost)) continue;
    if (seenOrigins.has(host)) continue;
    // A valid SRI hash pins the code — the inclusion is trusted
    // even from an unknown host.
    const integrity = String(s.integrity || '').trim();
    if (integrity && SRI_RE.test(integrity)) continue;
    seenOrigins.add(host);
    findings.push({
      class: 'untrusted_js_inclusion',
      id: `untrusted-js-inclusion-${host.replace(/[^a-z0-9]+/g, '-')}`,
      title: `Untrusted JavaScript inclusion from ${host} without Subresource Integrity`,
      severity: 'high',
      url,
      evidence: {
        request: `GET ${url}`,
        response:
          `Page loads executable JavaScript from cross-origin host ${host} — not the page's own host and not a trusted CDN — with no integrity attribute: "${snippet(s.tag)}" (src="${s.src}")`,
        impact_demo:
          'The script runs with the page\u2019s full privileges (cookies, DOM, fetch) — a compromised or attacker-controlled host serves arbitrary code into every visitor\u2019s session (Magecart-class supply-chain inclusion); a Subresource Integrity hash would pin the code and is absent.',
        signalCorrelated: true,
      },
    });
  }
  return findings;
}

export const __untrustedJsInclusionMeta = { phases: ['untrusted-js-inclusion'], depth: ['quick', 'standard', 'deep'] };
