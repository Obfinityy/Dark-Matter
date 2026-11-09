// Dark Matter rule-based scanner — document.domain relaxation probe
// (coverage row #484 [Low] SOP — document.domain relaxation,
// CWE-668 | OWASP A01:2021; phase 103, 'document-domain').
//
// ORACLE (static, no judge, no LLM, $0): assigning document.domain
// to a parent-domain suffix merges the page's origin with every
// sibling subdomain under that suffix — a page on evil.example.com
// can then read and script a page on app.example.com. The row's
// scout note names exactly the observable test: "mine served JS
// for `document.domain =` assignments that relax the origin to a
// parent suffix". The probe mines the page's own same-origin script
// bundles and inline <script> blocks (the same secretTargets feed
// as dom-xss-sinks / secrets-in-js) and confirms ONLY on an
// observed string-literal assignment whose value is a proper parent
// suffix of the page's hostname:
//   * relaxation — value is a proper suffix of the host with at
//     least two labels and strictly fewer labels than the host
//     (host app.example.com, value example.com: drops one label).
//   * noop — value equals the host (document.domain =
//     "app.example.com" on app.example.com changes nothing).
//   * invalid — value is not a suffix of the host (the browser
//     throws on the assignment), a single-label value (not a
//     registrable parent suffix), or a malformed domain. Never a
//     finding.
//   * unresolved — the right-hand side is not a string literal
//     (a variable, location.hostname, a call). The value cannot be
//     resolved statically, so the probe records the count and
//     moves on — never a finding, never a guess.
// A read (document.domain in a comparison or a log line) is not an
// assignment and never fires; a commented-out assignment never
// fires; assignment text inside a string literal never fires (the
// scanner consumes string literals before matching assignments).
//
// GATE DECISION (9 Nov 2026, chosen on the scout's "static JS
// mining" note BEFORE any proof run): [Low] INFO fingerprint, ONE
// aggregated finding per bundle / inline block, following the
// dom-xss-sinks precedent (phase 87). Static evidence alone never
// proves a sibling subdomain hosts attacker-controlled content,
// so the severity stays low and the finding text says so — this is
// a hardening signal, not a proven exploit. Consequence, stated up
// front: none of the current labs is expected to fire (Juice Shop,
// DVWA, WebGoat, bWAPP, VAmPI and the coupon lab serve no
// document.domain assignment — the probe's live value is the
// negative control: a clean run proves the miner does not hallucinate
// relaxations on real apps). The finding text also notes the
// deprecation: the document.domain setter is deprecated in modern
// browsers and is a no-op where the page opts into origin-keyed
// agent clusters — the assignment is still live served code wherever
// the setter is honored.
//
// VERIFICATION: the assignment IS the evidence (assigned value,
// host, line number, redacted snippet), so the differential
// verifier judges this on the default protocol (signalCorrelated).
// The class name 'sop_domain_relaxation' is routed by protocolFor
// to the default protocol ON PURPOSE: it contains neither 'xss'
// (xss_reflected would judge on canaryReflected, which a static
// fingerprint never carries) nor 'bypass' (auth_bypass, judged on
// bypassWorks) — the same trap dom_sink avoids (see domXssSinks.js).
// Verified by a unit test that calls assessConfirmation on a probe
// finding and expects 'confirmed'.
//
// SAFETY: read-only GETs of the page's own same-origin script bundles
// (cap 5, the jsRoutes cap) plus the page's inline <script> blocks
// (cap 10) — no writes, no allowWrite gate, no lab gate, same-origin
// only. Vendor / polyfills / runtime bundles are excluded by
// filename stem, as in dom-xss-sinks: a library that relaxes the
// origin is a follow-up, not this row. One finding per bundle /
// inline block; max 5 findings per scan.
import { fetchPage } from '../fingerprint.js';
import { JS_ROUTES_MAX_BUNDLES } from '../jsRoutes.js';
import { isVendorBundle } from './domXssSinks.js';

const MAX_BUNDLES = JS_ROUTES_MAX_BUNDLES; // 5, same cap as jsRoutes
const MAX_INLINE = 10;
const MAX_FINDINGS = 5;
const SNIPPET_RADIUS = 80;

// One scan pass over a source body. The alternation consumes string
// literals (group 1) and comments (groups 2-3) first, so assignment
// text quoted inside a string or commented out never matches; the
// assignment branch (group 4) matches the dot form
// (`document.domain =`, `window.document.domain =`) and the bracket
// form (`document['domain'] =`). The `=(?!=)` guard keeps `==` /
// `===` comparisons from matching. The right-hand side is a quoted
// literal (groups 5-6) or, when no quote follows, an unresolvable
// expression (variable, call, location.hostname) — group 5 absent.
// Honest limit: an identifier merely ending in `document` (e.g.
// `mydocument.domain =`) would also match — no such shape exists in
// real code — and a `//` inside a regex literal can swallow the rest
// of its line, hiding an assignment on that line (a miss, never a
// false finding).
const ASSIGNMENT_RE =
  /("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|((?:window\.)?document\s*(?:\.domain|\[\s*['"]domain['"]\s*\])\s*=(?!=)\s*(?:(['"`])([^'"`\n\r]*)\5)?)/g;
const LABEL_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

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

function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.+$/, '');
}

function isWellFormedDomain(value) {
  if (!value || value.length > 253) return false;
  const labels = value.split('.');
  if (labels.length < 2) return false;
  return labels.every((label) => LABEL_RE.test(label));
}

/**
 * Judge one document.domain assignment against the page host.
 * Returns { kind, reason } where kind is 'relaxation' (the value
 * is a proper parent suffix of the host — the origin is weakened),
 * 'noop' (the value equals the host — the assignment changes
 * nothing), 'invalid' (the value is not a suffix of the host, is a
 * single label, or is malformed — the browser rejects it), or
 * 'unresolved' (the right-hand side was not a string literal, so
 * the value cannot be resolved statically). Pure.
 */
export function assessDomainAssignment(host, value) {
  if (value === null || value === undefined) {
    return {
      kind: 'unresolved',
      reason: 'the assignment value is not a string literal — it cannot be resolved statically',
    };
  }
  const hostNorm = normalizeDomain(host);
  const valueNorm = normalizeDomain(value);
  if (!isWellFormedDomain(valueNorm)) {
    return {
      kind: 'invalid',
      reason: `the assigned value "${valueNorm}" is not a well-formed multi-label domain — the browser rejects it`,
    };
  }
  if (valueNorm === hostNorm) {
    return {
      kind: 'noop',
      reason: `the assigned value "${valueNorm}" equals the page host — the assignment changes nothing`,
    };
  }
  const hostLabels = hostNorm.split('.');
  const valueLabels = valueNorm.split('.');
  if (valueLabels.length >= hostLabels.length || !hostNorm.endsWith(`.${valueNorm}`)) {
    return {
      kind: 'invalid',
      reason: `the assigned value "${valueNorm}" is not a parent suffix of the host "${hostNorm}" — the browser rejects it`,
    };
  }
  return {
    kind: 'relaxation',
    reason: `the assigned value "${valueNorm}" is a parent suffix of the host "${hostNorm}" — the origin is relaxed to ${valueNorm}`,
  };
}

// Scan one source body for document.domain assignments. Returns
// null when no assignment pattern matches at all, else the
// relaxations found (value, line, snippet) plus the counts of the
// non-firing shapes. Pure.
export function scanDomainAssignments(body, host) {
  const text = typeof body === 'string' ? body : '';
  if (!text) return null;
  const relaxations = [];
  let unresolved = 0;
  let noop = 0;
  let invalid = 0;
  let matched = false;
  const rx = new RegExp(ASSIGNMENT_RE.source, ASSIGNMENT_RE.flags);
  let m;
  while ((m = rx.exec(text)) !== null) {
    // A string literal or a comment — skipped, never an assignment.
    if (m[1] !== undefined || m[2] !== undefined || m[3] !== undefined) continue;
    if (m[4] === undefined) continue;
    matched = true;
    const value = m[5] !== undefined ? m[6] : null;
    const verdict = assessDomainAssignment(host, value);
    if (verdict.kind === 'relaxation') {
      relaxations.push({
        value: normalizeDomain(value),
        line: lineOf(text, m.index),
        snippet: snippetAround(text, m.index, m[4].length),
      });
    } else if (verdict.kind === 'unresolved') {
      unresolved += 1;
    } else if (verdict.kind === 'noop') {
      noop += 1;
    } else {
      invalid += 1;
    }
  }
  if (!matched) return null;
  return { relaxations, unresolved, noop, invalid };
}

function fileStem(url) {
  let base = '';
  try {
    base = new URL(url).pathname.split('/').pop() || '';
  } catch {
    base = String(url || '').split('/').pop() || '';
  }
  return base.replace(/\.js$/i, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'bundle';
}

// Scan one source body and push at most one aggregated finding when
// it relaxes document.domain. `sourceUrl` is the URL the finding is
// filed under; `sourceLabel` names the source in the evidence.
// Vendor bundles are skipped by the caller; inline blocks run here
// (an inline relaxation is first-party code by definition).
function scanBody(body, host, sourceUrl, sourceLabel, findings, seen, diag) {
  if (findings.length >= MAX_FINDINGS) return;
  const scan = scanDomainAssignments(body, host);
  if (!scan) return;
  diag.domainRelaxations = (diag.domainRelaxations || 0) + scan.relaxations.length;
  diag.unresolvedAssignments = (diag.unresolvedAssignments || 0) + scan.unresolved;
  diag.noopAssignments = (diag.noopAssignments || 0) + scan.noop;
  diag.invalidAssignments = (diag.invalidAssignments || 0) + scan.invalid;
  if (scan.relaxations.length === 0) return;
  // Dedup on the source label, not the URL: every inline block is
  // filed under the same pageUrl, so a URL key would collapse two
  // relaxing inline blocks into one finding.
  const dedupKey = sourceLabel;
  if (seen.has(dedupKey)) return;
  seen.add(dedupKey);
  const first = scan.relaxations[0];
  const values = [...new Set(scan.relaxations.map((r) => r.value))];
  findings.push({
    class: 'sop_domain_relaxation',
    id: `document-domain-${fileStem(sourceUrl)}`,
    title: `SOP — document.domain relaxed to parent domain "${first.value}" (LOW)`,
    severity: 'low',
    url: sourceUrl,
    parameter: 'document.domain',
    evidence: {
      request:
        sourceLabel.startsWith('inline')
          ? `inline <script> block on ${sourceUrl} (page body already fetched)`
          : `GET ${sourceUrl} (same-origin script bundle)`,
      response:
        `document.domain assignment in ${sourceLabel} relaxes the origin: ` +
        `page host "${normalizeDomain(host)}" is served code that assigns ` +
        `document.domain to "${values.join('", "')}" ` +
        `(${scan.relaxations.length} relaxation assignment${scan.relaxations.length === 1 ? '' : 's'}; ` +
        `first at line ${first.line}: ${first.snippet}). ` +
        `Static fingerprint only — no proof a sibling subdomain hosts attacker-controlled content, ` +
        `so this is a hardening signal, not a proven exploit. Note: the document.domain setter is ` +
        `deprecated in modern browsers and is a no-op where the page opts into origin-keyed agent ` +
        `clusters — the assignment is still live served code wherever the setter is honored.`,
      impact_demo:
        'Same-origin-policy weakening — assigning document.domain to a parent suffix merges the page origin with every sibling subdomain under that suffix, so a page on an attacker-controlled sibling subdomain can read and script this page (session theft, actions as the user). Remove the assignment and use postMessage with an explicit target origin instead (OWASP DOM XSS / HTML5 Security Cheat Sheet).',
      signalCorrelated: true,
    },
  });
}

/**
 * Probe document.domain relaxations in first-party client-side JS (#484).
 * @param {string} pageUrl — the pasted page URL (its hostname is the
 *   origin the assignments are judged against; findings on inline
 *   scripts are filed under it).
 * @param {object} targets — { bundles: [urls], inline: [bodies] }
 *   from extractSecretTargets (runScan computes it from the page
 *   body so a script-less page skips instead of fetching).
 * @param {object} opts — { timeoutMs, headers, fetchPage, diagnostics }.
 *   fetchPage is the test seam (defaults to fingerprint.fetchPage).
 * @returns {object[]} findings (class 'sop_domain_relaxation', low) —
 *   at most 1 per bundle / inline block, max 5 per scan.
 */
export async function probeDocumentDomain(pageUrl, targets, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  let host;
  try {
    host = new URL(pageUrl).hostname;
  } catch {
    return findings;
  }
  const bundles = Array.isArray(targets && targets.bundles)
    ? targets.bundles.slice(0, MAX_BUNDLES)
    : [];
  const inline = Array.isArray(targets && targets.inline)
    ? targets.inline.slice(0, MAX_INLINE)
    : [];
  const seen = new Set();
  const diagAcc = {};
  let scanned = 0;
  for (const bundleUrl of bundles) {
    if (isVendorBundle(bundleUrl)) continue;
    let res;
    try {
      res = await fetchFn(bundleUrl, opts);
    } catch {
      continue;
    }
    if (!res || res.status !== 200 || !res.body) continue;
    scanned += 1;
    scanBody(res.body, host, bundleUrl, `script bundle ${bundleUrl}`, findings, seen, diagAcc);
    if (findings.length >= MAX_FINDINGS) break;
  }
  if (findings.length < MAX_FINDINGS) {
    inline.forEach((body, i) => {
      if (findings.length >= MAX_FINDINGS) return;
      scanned += 1;
      scanBody(body, host, pageUrl, `inline <script> block #${i + 1} on ${pageUrl}`, findings, seen, diagAcc);
    });
  }
  setDiag('bundlesScanned', scanned);
  setDiag('domainRelaxations', diagAcc.domainRelaxations || 0);
  setDiag('unresolvedAssignments', diagAcc.unresolvedAssignments || 0);
  setDiag('noopAssignments', diagAcc.noopAssignments || 0);
  setDiag('invalidAssignments', diagAcc.invalidAssignments || 0);
  return findings;
}

export const __documentDomainMeta = { phases: ['document-domain'], depth: ['quick', 'standard', 'deep'] };
