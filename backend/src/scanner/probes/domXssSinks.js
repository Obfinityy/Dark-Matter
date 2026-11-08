// Dark Matter rule-based scanner — DOM XSS sink fingerprint probe
// (coverage row #115 [High] DOM-Based XSS, phase 87).
//
// NARROW DEFINITION (the ledger row is a bare title, so the boundary
// is written down here, in index.js, and in the lane report): this
// phase detects ONE thing — the app's OWN first-party JS renders
// data through a DOM sink that parses strings as HTML. Three sink
// shapes, all static, all in the page's own same-origin bundles or
// inline <script> blocks:
//   1. `*.bypassSecurityTrustHtml(` — Angular's sanitizer bypass:
//      the value is rendered as trusted HTML with no sanitization.
//   2. `innerHTML` — a quoted `"innerHTML"` literal (the compiled
//      Angular binding/attribute form, e.g. `Y8G("innerHTML", …)`)
//      or a `.innerHTML =` property assignment: the value is parsed
//      as HTML.
//   3. `document.write(` — the argument is parsed as HTML in the
//      (possibly new) document.
//
// A finding counts ONLY when ALL THREE hold:
//   1. It is a CALL SITE / BINDING, not a definition or a bare
//      mention — `.bypassSecurityTrustHtml(` with the leading dot
//      (the sanitizer's own definition has no dot and never fires),
//      `"innerHTML"` as a quoted literal or `.innerHTML =` (a bare
//      word in a comment never fires), `document.write(` as a call.
//   2. It is in a FIRST-PARTY bundle — library/framework bundles
//      are excluded twice over: by filename stem (vendor / polyfills
//      / runtime) AND by content (a bundle that DEFINES
//      `bypassSecurityTrustHtml(` is framework code — the sanitizer
//      itself — and is skipped whole). Juice Shop's vendor.js carries
//      4 bypass call sites + 21 `"innerHTML"` literals + 6
//      `.innerHTML =` assignments of its own (verified 8 Nov 2026);
//      without this gate the probe would fingerprint Angular itself.
//   3. It is the app's own code — inline <script> blocks count
//      (first-party by definition); cross-origin bundles are never
//      fetched (extractSecretTargets is same-origin only).
//
// GATE DECISION (8 Nov 2026, chosen on OWASP DOM-XSS grounds BEFORE
// any proof run): [Low] INFO fingerprint, ONE aggregated finding per
// bundle, following the prototype-pollution merge-sink precedent
// (phase 35). Static evidence alone never proves attacker-controlled
// data reaches the sink unencoded, so the severity stays low and the
// finding text says so — this is a hardening signal, not a proven
// exploit. Consequence, stated up front: Juice Shop's main.js
// carries 9 bypass call sites + 22 innerHTML occurrences + 1
// document.write (verified live 8 Nov 2026), so the Juice proof leg
// is expected to be 1 new [Low] finding; DVWA serves no JS bundles,
// so its leg is expected to be a true negative (phase skipped).
//
// VERIFICATION: the call site IS the evidence (sink shape, count,
// bundle URL, line number, redacted snippet), so the differential
// verifier judges this on the default protocol (signalCorrelated).
// The class name 'dom_sink' is routed by protocolFor to the default
// protocol ON PURPOSE: a class containing 'xss' would be routed to
// the xss_reflected protocol and judged on canaryReflected, which a
// static fingerprint never carries — the finding would land
// 'unconfirmed' forever (same trap as 'bypass' -> auth_bypass, which
// is why missing-auth is class 'missing_auth'). Verified by a unit
// test that calls assessConfirmation on a probe finding and expects
// 'confirmed'.
//
// ROW #190 (CSTI) IS NOT CLAIMED by this lane: bypassSecurityTrustHtml
// and innerHTML are DOM XSS sinks, not template-injection vectors —
// no template expression is evaluated from user input here, and the
// scout's "same sink family" suggestion does not survive scrutiny.
// #115 only.
//
// SAFETY: read-only GETs of the page's own same-origin script bundles
// (cap 5, the jsRoutes cap) plus the page's inline <script> blocks
// (cap 10) — no writes, no allowWrite gate, same-origin only.
// Bundles are fetched with fingerprint.fetchPage (opts.fetchPage is
// the test seam, mirroring probeBrowserStorage). One finding per
// bundle; max 5 findings per scan.
import { fetchPage } from '../fingerprint.js';
import { JS_ROUTES_MAX_BUNDLES } from '../jsRoutes.js';

const MAX_BUNDLES = JS_ROUTES_MAX_BUNDLES; // 5, same cap as jsRoutes
const MAX_INLINE = 10;
const MAX_FINDINGS = 5;
const SNIPPET_RADIUS = 80;

// Filename stems that mark a bundle as library/framework output, never
// app code. Matched as a whole dot/dash segment of the basename:
// 'vendor.<hash>.js', 'polyfills.<hash>.js', 'runtime.<hash>.js' are
// excluded; 'main.<hash>.js' and lazy 'chunk-<n>.js' app routes are
// scanned (a chunk that is pure library code is a known v1 FP risk —
// see honest limits). A stem that merely CONTAINS the word (e.g.
// 'my-vendor-dashboard.js') is excluded too — fail-closed direction.
const VENDOR_BUNDLE_RE = /(?:^|[-_.])(vendor|polyfills?|runtime)(?:[-_.]|$)/i;

// Sink shapes. The bypass call regex REQUIRES the leading dot: the
// sanitizer's own definition (`bypassSecurityTrustHtml(we){…}`) has
// none, so it never matches. The definition regex is the mirror —
// any non-dot char (or start of string) before the name — and marks
// a whole bundle as framework code (see isFrameworkBundle).
const BYPASS_CALL_RE = /\.bypassSecurityTrustHtml\s*\(/g;
const BYPASS_DEF_RE = /(^|[^A-Za-z0-9_$.])bypassSecurityTrustHtml\s*\(/g;
// Compiled Angular binding/attribute form: the quoted literal
// `"innerHTML"` in `Y8G("innerHTML", …)` or `[3,"innerHTML"]`.
// A bare unquoted word (comment, identifier) never matches.
const INNERHTML_LITERAL_RE = /["']innerHTML["']/g;
// Vanilla assignment form: `.innerHTML = …` (the `(?!=)` lookahead
// keeps a comparison read `el.innerHTML == 'x'` from matching).
const INNERHTML_ASSIGN_RE = /\.innerHTML\s*=(?!=)/g;
const DOCUMENT_WRITE_RE = /document\.write\s*\(/g;

// Line number (1-based) of an offset in a body.
function lineOf(body, offset) {
  let n = 1;
  for (let i = 0; i < offset && i < body.length; i += 1) {
    if (body[i] === '\n') n += 1;
  }
  return n;
}

// A redacted snippet around a match — newlines flattened, capped.
function snippetAround(body, matchIndex, matchLength) {
  const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
  const end = Math.min(body.length, matchIndex + matchLength + SNIPPET_RADIUS);
  let snip = body.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snip = `…${snip}`;
  if (end < body.length) snip = `${snip}…`;
  return snip.slice(0, 400);
}

function basenameOf(url) {
  try {
    return new URL(url).pathname.split('/').pop() || '';
  } catch {
    return String(url || '').split('/').pop() || '';
  }
}

// Filename-stem gate: true when the bundle is library/framework
// output (vendor / polyfills / runtime) and must not be scanned.
export function isVendorBundle(url) {
  const base = basenameOf(url).replace(/\.js$/i, '');
  return VENDOR_BUNDLE_RE.test(base);
}

// Content gate: true when the bundle DEFINES the sanitizer — i.e. it
// IS framework code (Angular's DomSanitizer), not app code calling
// it. A definition is a bare `bypassSecurityTrustHtml(` with no
// leading dot; call sites (`.bypassSecurityTrustHtml(`) do not count.
export function isFrameworkBundle(body) {
  const text = typeof body === 'string' ? body : '';
  if (!text) return false;
  return new RegExp(BYPASS_DEF_RE.source, BYPASS_DEF_RE.flags).test(text);
}

function countMatches(text, re) {
  const rx = new RegExp(re.source, re.flags);
  const matches = [];
  let m;
  while ((m = rx.exec(text)) !== null) matches.push(m);
  return matches;
}

// Scan one source body (a bundle or an inline block). Returns null
// when no sink shape fires, else the per-shape counts, first-match
// line numbers, and one snippet per firing shape.
export function scanDomSinks(body) {
  const text = typeof body === 'string' ? body : '';
  if (!text) return null;
  const bypass = countMatches(text, BYPASS_CALL_RE);
  const innerLit = countMatches(text, INNERHTML_LITERAL_RE);
  const innerAssign = countMatches(text, INNERHTML_ASSIGN_RE);
  const docWrite = countMatches(text, DOCUMENT_WRITE_RE);
  const innerHTML = innerLit.length + innerAssign.length;
  if (bypass.length === 0 && innerHTML === 0 && docWrite.length === 0) return null;
  const first = (matches) =>
    matches.length ? { line: lineOf(text, matches[0].index), snippet: snippetAround(text, matches[0].index, matches[0][0].length) } : null;
  return {
    bypass: bypass.length,
    innerHTML,
    documentWrite: docWrite.length,
    firstBypass: first(bypass),
    firstInnerHTML: first(innerLit.length ? innerLit : innerAssign),
    firstDocumentWrite: first(docWrite),
  };
}

function fileStem(url) {
  return basenameOf(url).replace(/\.js$/i, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'bundle';
}

function sinkSummary(scan) {
  const parts = [];
  if (scan.bypass > 0) parts.push(`bypassSecurityTrustHtml ×${scan.bypass}`);
  if (scan.innerHTML > 0) parts.push(`innerHTML ×${scan.innerHTML}`);
  if (scan.documentWrite > 0) parts.push(`document.write ×${scan.documentWrite}`);
  return parts.join(', ');
}

function evidenceLines(scan) {
  const lines = [];
  if (scan.firstBypass) lines.push(`bypassSecurityTrustHtml ×${scan.bypass} (first at line ${scan.firstBypass.line}): ${scan.firstBypass.snippet}`);
  if (scan.firstInnerHTML) lines.push(`innerHTML ×${scan.innerHTML} (first at line ${scan.firstInnerHTML.line}): ${scan.firstInnerHTML.snippet}`);
  if (scan.firstDocumentWrite) lines.push(`document.write ×${scan.documentWrite} (first at line ${scan.firstDocumentWrite.line}): ${scan.firstDocumentWrite.snippet}`);
  return lines.join(' | ');
}

// Scan one source body and push at most one aggregated finding.
// `sourceUrl` is the URL the finding is filed under; `sourceLabel`
// names the source in the evidence. Vendor/framework bundles are
// skipped by the caller for bundles; inline blocks run the framework
// gate here (an inline sanitizer definition is pasted framework code).
function scanBody(body, sourceUrl, sourceLabel, findings, seen) {
  if (findings.length >= MAX_FINDINGS) return;
  if (isFrameworkBundle(body)) return;
  const scan = scanDomSinks(body);
  if (!scan) return;
  // Dedup on the source label, not the URL: every inline block is
  // filed under the same pageUrl, so a URL key would collapse two
  // sinking inline blocks into one finding.
  const dedupKey = sourceLabel;
  if (seen.has(dedupKey)) return;
  seen.add(dedupKey);
  findings.push({
    class: 'dom_sink',
    id: `dom-sink-${fileStem(sourceUrl)}`,
    title: `DOM XSS sink fingerprinted: ${sinkSummary(scan)} (INFO)`,
    severity: 'low',
    url: sourceUrl,
    parameter: 'js-bundle',
    evidence: {
      request:
        sourceLabel.startsWith('inline')
          ? `inline <script> block on ${sourceUrl} (page body already fetched)`
          : `GET ${sourceUrl} (same-origin script bundle)`,
      response:
        `DOM sinks in the app's own code in ${sourceLabel}: ${sinkSummary(scan)}. ` +
        `${evidenceLines(scan)} ` +
        `Static fingerprint only — no proof attacker-controlled data reaches a sink unencoded, ` +
        `so this is a hardening signal, not a proven exploit.`,
      impact_demo:
        'DOM XSS sink primitive — bypassSecurityTrustHtml tells Angular to skip sanitization and render the value as trusted HTML; innerHTML / document.write parse the assigned string as HTML. Any sink fed with unencoded user input executes script in the origin (session theft, actions as the user). Remove the bypass and render text via textContent / Angular interpolation, or sanitize with the default sanitizer (OWASP DOM XSS Cheat Sheet).',
      signalCorrelated: true,
    },
  });
}

/**
 * Probe DOM XSS sinks in first-party client-side JS (#115).
 * @param {string} pageUrl — the pasted page URL (findings on inline
 *   scripts are filed under it).
 * @param {object} targets — { bundles: [urls], inline: [bodies] }
 *   from extractSecretTargets (runScan computes it from the page
 *   body so a script-less page skips instead of fetching).
 * @param {object} opts — { timeoutMs, headers, fetchPage }.
 *   fetchPage is the test seam (defaults to fingerprint.fetchPage).
 * @returns {object[]} findings (class 'dom_sink', low) — at most 1
 *   per bundle / inline block, max 5 per scan.
 */
export async function probeDomXssSinks(pageUrl, targets, opts = {}) {
  const findings = [];
  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  const bundles = Array.isArray(targets && targets.bundles)
    ? targets.bundles.slice(0, MAX_BUNDLES)
    : [];
  const inline = Array.isArray(targets && targets.inline)
    ? targets.inline.slice(0, MAX_INLINE)
    : [];
  const seen = new Set();
  for (const bundleUrl of bundles) {
    if (isVendorBundle(bundleUrl)) continue;
    let res;
    try {
      res = await fetchFn(bundleUrl, opts);
    } catch {
      continue;
    }
    if (!res || res.status !== 200 || !res.body) continue;
    scanBody(res.body, bundleUrl, `script bundle ${bundleUrl}`, findings, seen);
    if (findings.length >= MAX_FINDINGS) return findings;
  }
  inline.forEach((body, i) => {
    if (findings.length >= MAX_FINDINGS) return;
    scanBody(body, pageUrl, `inline <script> block #${i + 1} on ${pageUrl}`, findings, seen);
  });
  return findings;
}

export const __domXssSinksMeta = { phases: ['dom-xss-sinks'], depth: ['quick', 'standard', 'deep'] };
