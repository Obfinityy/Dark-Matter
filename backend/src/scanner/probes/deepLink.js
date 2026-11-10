// Dark Matter rule-based scanner — deep-link / URL-scheme probe
// (coverage row #510 [High] Deep-link / URL-scheme hijacking +
// unvalidated deep-link parameters, CWE-939 | OWASP M1/M7; phase
// 113, 'deep-link').
//
// A mobile app (or a web page that hands off to one) registers a
// custom URL scheme (myapp://) or an intent:// handler, and a web
// page builds such a link from a URL parameter —
// `location.href = 'myapp://open?url=' + target` where `target`
// comes from `?url=`. Anyone who can craft the link controls the
// parameter: the app opens attacker-chosen content, a WebView
// navigates to an attacker page, or a `javascript:` value in the
// deep link executes in the WebView's context. The same shape
// exists on the web itself (open-redirect-adjacent), but the row
// is a mobile class and this probe is its web-scanner
// interpretation: it mines the page's own served JS/HTML for the
// handler code, exactly like documentDomain / secretsInJs.
//
// ORACLE (static, no judge, no LLM, $0): a finding fires ONLY on
// an observed parameter flow, never on a bare scheme string:
//   * a custom-scheme literal (any scheme:// outside the
//     http/https/ws/mailto/tel/file/data set, plus intent://) or
//     a `javascript:` value, AND
//   * a navigation sink (location.href / location.assign /
//     replace / window.open / loadUrl / navigate / href
//     assignment) whose argument references a variable tainted
//     by a URL-derived source (URLSearchParams.get('name'),
//     location.search / location.hash, getQueryParam, route /
//     search params), or carries the parameter inline, AND
//   * the sink argument carries the scheme (inline literal, or
//     a variable assigned from a scheme literal).
// A scheme literal with no parameter handling is not a finding
// (the nonsense control: a static `myapp://home` link stays
// quiet). A parameter that never reaches a scheme-carrying sink
// is not a finding. Commented-out code and string-embedded fake
// sinks never fire: sink/taint matching runs on code with string
// literals and comments blanked out (offsets preserved), while
// scheme literals are read from the original text.
//
// GATES: none beyond the battery itself. Read-only GETs of the
// page's own same-origin script bundles (cap 5) plus inline
// <script> blocks (cap 10), same-origin only, vendor bundles
// excluded — the same feed and caps as documentDomain. Runs at
// every depth including 'quick'.
//
// HONEST LIMITS: no mobile (DVMA) lab exists today, so this is a
// static-mining probe — it proves the handler code and the
// parameter flow as served, not a live exploit on a device. A
// scheme registered only in a native manifest (AndroidManifest /
// Info.plist) is invisible to a web scan, and a flow routed
// through a framework router the miner does not model is a miss,
// never a false finding.
//
// VERIFICATION: findings are class 'deep_link_hijack' —
// protocolFor routes it to the default protocol (judged on
// signalCorrelated, see differential.js). The class name
// deliberately contains neither 'xss' nor 'bypass' so no family
// branch claims it.
import { fetchPage } from '../fingerprint.js';
import { JS_ROUTES_MAX_BUNDLES } from '../jsRoutes.js';
import { isVendorBundle } from './domXssSinks.js';

const MAX_BUNDLES = JS_ROUTES_MAX_BUNDLES; // 5, same cap as jsRoutes
const MAX_INLINE = 10;
const MAX_FINDINGS = 5;
const SNIPPET_RADIUS = 80;

// Schemes that are ordinary web behaviour, never an app deep link.
const EXCLUDED_SCHEMES = new Set([
  'http', 'https', 'ws', 'wss', 'ftp', 'ftps', 'mailto', 'tel', 'sms',
  'file', 'data', 'blob', 'about', 'chrome', 'view-source',
]);

// URL parameter names that conventionally carry a link / target.
const PARAM_NAMES = new Set([
  'url', 'redirect', 'target', 'link', 'next', 'returnurl', 'return_url',
  'deeplink', 'deep_link', 'deep-link', 'uri', 'dest', 'destination',
  'continue', 'callback', 'open',
]);

// A URL-derived source in code: query-param reads and location
// query/fragment access. Matched against blanked code (string
// contents removed), so the param NAME is not visible here — the
// name is recovered from the original text separately.
const SOURCE_RE =
  /URLSearchParams|location\s*\.\s*(?:search|hash)|searchParams\s*\.\s*get|getQueryParam|getParameter|route\s*\.\s*params|\bparams\s*\.\s*get|useSearchParams\s*\(\)/;

// Navigation sinks: [kind, regex] over blanked code; group 1 is
// the sink argument. Offsets are preserved by the blanking, so
// the argument text is sliced from the original body.
const SINK_RES = [
  ['location-href-assign', /(?:window\s*\.\s*)?location\s*\.\s*href\s*=\s*([^;\n]{0,300})/g],
  ['location-assign', /(?:window\s*\.\s*)?location\s*=\s*([^;\n]{0,300})/g],
  ['location-method', /location\s*\.\s*(?:assign|replace)\s*\(\s*([^;)\n]{0,300})/g],
  ['window-open', /window\s*\.\s*open\s*\(\s*([^;)\n]{0,300})/g],
  ['webview-load', /(?:\w+\s*\.\s*)?loadUrl\s*\(\s*([^;)\n]{0,300})/g],
  ['navigate', /\bnavigate\s*\(\s*([^;)\n]{0,300})/g],
];

function lineOf(body, offset) {
  let n = 1;
  for (let i = 0; i < offset && i < body.length; i += 1) {
    if (body[i] === '\n') n += 1;
  }
  return n;
}

function snippetAround(body, matchIndex, matchLength) {
  const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
  const end = Math.min(body.length, matchIndex + matchLength + SNIPPET_RADIUS);
  let snip = body.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snip = `…${snip}`;
  if (end < body.length) snip = `${snip}…`;
  return snip.slice(0, 400);
}

function slug(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'value';
}

// Blank string literals and comments out of a body, replacing
// every consumed character with a space (newlines kept), so the
// returned text has exactly the same offsets as the original.
// Sink and taint patterns run on this text; scheme literals and
// argument text are read from the original at the same offsets.
export function blankStringsAndComments(body) {
  const text = typeof body === 'string' ? body : '';
  const out = text.split('');
  let i = 0;
  const blank = (from, to) => {
    for (let k = from; k < to; k += 1) {
      if (out[k] !== '\n') out[k] = ' ';
    }
  };
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '/' && next === '/') {
      const end = text.indexOf('\n', i);
      blank(i, end === -1 ? text.length : end);
      i = end === -1 ? text.length : end;
    } else if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === '\\') {
          j += 2;
          continue;
        }
        if (text[j] === quote) break;
        // A single/double-quoted literal cannot span lines; a
        // backtick literal can.
        if (quote !== '`' && text[j] === '\n') break;
        j += 1;
      }
      blank(i, Math.min(text.length, j + 1));
      i = Math.min(text.length, j + 1);
    } else {
      i += 1;
    }
  }
  return out.join('');
}

// String literals in a body (contents with their quotes), in
// order. Used only to find scheme literals — never for code
// structure.
function stringLiterals(body) {
  const text = typeof body === 'string' ? body : '';
  const re = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
  return [...text.matchAll(re)].map((m) => ({ text: m[0], index: m.index }));
}

/**
 * Custom-scheme literals in a body: { scheme, value, line }.
 * 'javascript:' is reported with scheme 'javascript'. Ordinary
 * web schemes (http/https/mailto/…) are excluded. Pure.
 */
export function extractSchemeLiterals(body) {
  const found = [];
  for (const lit of stringLiterals(body)) {
    const inner = lit.text.slice(1, -1);
    const schemeRe = /([A-Za-z][A-Za-z0-9+.-]{2,}):\/\/([^\s'"`]*)/g;
    let m;
    while ((m = schemeRe.exec(inner)) !== null) {
      const scheme = m[1].toLowerCase();
      if (EXCLUDED_SCHEMES.has(scheme)) continue;
      found.push({ scheme, value: m[0], line: lineOf(body, lit.index) });
    }
    if (/javascript:/i.test(inner)) {
      found.push({ scheme: 'javascript', value: 'javascript:', line: lineOf(body, lit.index) });
    }
  }
  return found;
}

/** True when `scheme` names an app deep link (or javascript:). Pure. */
export function isCustomScheme(scheme) {
  const s = String(scheme || '').toLowerCase();
  return s === 'javascript' || (s.length >= 2 && !EXCLUDED_SCHEMES.has(s));
}

// Parameter names read from query-param accessors in a body
// (e.g. get('url') -> 'url'). Pure.
export function extractParamNames(body) {
  const text = typeof body === 'string' ? body : '';
  const names = new Set();
  const re = /(?:\.get(?:All)?|getQueryParam|getParameter)\s*\(\s*['"]([A-Za-z0-9_$-]+)['"]/g;
  let m;
  while ((m = re.exec(text)) !== null) names.add(m[1]);
  return [...names];
}

function wordIn(text, word) {
  return new RegExp(`\\b${word.replace(/\$/g, '\\$')}\\b`).test(text);
}

/**
 * Variables tainted by a URL-derived source, with the parameter
 * each one came from ({ varName: paramName | 'url-derived' }).
 * Assignment right-hand sides are read from the ORIGINAL body at
 * the offsets matched in blanked code, so a commented-out
 * assignment never taints. Three passes propagate taint through
 * intermediate variables (a = param; b = a). Pure.
 */
export function findTaintedVars(body) {
  const text = typeof body === 'string' ? body : '';
  const blanked = blankStringsAndComments(text);
  const tainted = new Map();
  const assignRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]{0,300})/g;
  for (let pass = 0; pass < 3; pass += 1) {
    const rx = new RegExp(assignRe.source, assignRe.flags);
    let m;
    let grew = false;
    while ((m = rx.exec(blanked)) !== null) {
      const varName = m[1];
      if (tainted.has(varName)) continue;
      // The right-hand side as written (strings intact): the full
      // original statement, from the assignment to its `;`. (The
      // blanked group-2 start is NOT the original RHS start — the
      // `\s*` after `=` consumes the blanked string literal, so
      // slicing from the group offset would skip the literal.)
      const stmtEnd = blanked.indexOf(';', m.index);
      const rhs = text.slice(m.index, stmtEnd === -1 ? text.length : stmtEnd);
      let param = null;
      if (SOURCE_RE.test(m[2])) {
        const nameMatch = /(?:\.get(?:All)?|getQueryParam|getParameter)\s*\(\s*['"]([A-Za-z0-9_$-]+)['"]/.exec(rhs);
        param = nameMatch ? nameMatch[1] : 'url-derived';
      } else {
        for (const [taintedVar, origin] of tainted) {
          if (wordIn(m[2], taintedVar)) {
            param = origin;
            break;
          }
        }
      }
      if (param !== null) {
        tainted.set(varName, param);
        grew = true;
      }
    }
    if (!grew) break;
  }
  return tainted;
}

/**
 * Variables assigned from an expression containing a custom
 * scheme literal or a javascript: value (e.g. `const link =
 * 'myapp://open?url=' + target`). Pure.
 */
export function findSchemeVars(body) {
  const text = typeof body === 'string' ? body : '';
  const blanked = blankStringsAndComments(text);
  const vars = new Set();
  const assignRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]{0,300})/g;
  let m;
  while ((m = assignRe.exec(blanked)) !== null) {
    // The full original statement (see findTaintedVars): the
    // scheme literal lives in the assignment text itself.
    const stmtEnd = blanked.indexOf(';', m.index);
    const rhs = text.slice(m.index, stmtEnd === -1 ? text.length : stmtEnd);
    if (/[A-Za-z][A-Za-z0-9+.-]{2,}:\/\//.test(rhs) || /javascript:/i.test(rhs)) {
      vars.add(m[1]);
    }
  }
  return vars;
}

/**
 * Scan one source body for confirmed deep-link parameter flows.
 * Returns { flows, schemesFound, sinksFound, paramReads } where
 * each flow carries { scheme, param, taintedVar, sinkKind,
 * sinkSnippet, line }. A flow is confirmed ONLY when a navigation
 * sink's argument is tainted by a URL parameter AND carries a
 * custom scheme (inline or via a scheme variable). Pure.
 */
export function scanDeepLinkFlows(body) {
  const text = typeof body === 'string' ? body : '';
  const schemes = extractSchemeLiterals(text);
  const schemesFound = [...new Set(schemes.map((s) => s.scheme))];
  const paramReads = extractParamNames(text);
  const tainted = findTaintedVars(text);
  const schemeVars = findSchemeVars(text);
  const blanked = blankStringsAndComments(text);
  const flows = [];
  const seenSinkOffsets = new Set();
  let sinksFound = 0;
  for (const [sinkKind, re] of SINK_RES) {
    const rx = new RegExp(re.source, re.flags);
    let m;
    while ((m = rx.exec(blanked)) !== null) {
      if (seenSinkOffsets.has(m.index)) continue;
      seenSinkOffsets.add(m.index);
      sinksFound += 1;
      // The sink argument as written: the full original
      // statement, from the sink to its `;` (see findTaintedVars
      // — slicing from the blanked group offset would skip a
      // leading string literal).
      const stmtEnd = blanked.indexOf(';', m.index);
      const argText = text.slice(m.index, stmtEnd === -1 ? text.length : stmtEnd);
      // (1) Is the sink argument attacker-controlled?
      let taintedVar = null;
      let param = null;
      for (const [varName, origin] of tainted) {
        if (wordIn(argText, varName)) {
          taintedVar = varName;
          param = origin;
          break;
        }
      }
      if (!taintedVar && SOURCE_RE.test(argText)) {
        const nameMatch = /(?:\.get(?:All)?|getQueryParam|getParameter)\s*\(\s*['"]([A-Za-z0-9_$-]+)['"]/.exec(argText);
        param = nameMatch ? nameMatch[1] : 'url-derived';
        taintedVar = '(inline parameter read)';
      }
      if (!taintedVar) continue;
      // A bare variable named like a parameter (url, redirect)
      // with no URL-derived taint is not attacker-controlled —
      // the taint map above is the only source of `param`.
      if (param && !PARAM_NAMES.has(param.toLowerCase()) && param !== 'url-derived') {
        // A named query parameter is attacker-controlled whatever
        // it is called; keep the flow. (The PARAM_NAMES set only
        // documents the conventional names.)
      }
      // (2) Does the sink argument carry a custom scheme?
      let scheme = null;
      const inlineScheme = /([A-Za-z][A-Za-z0-9+.-]{2,}):\/\//.exec(argText);
      if (inlineScheme && isCustomScheme(inlineScheme[1])) {
        scheme = inlineScheme[1].toLowerCase();
      } else if (/javascript:/i.test(argText)) {
        scheme = 'javascript';
      } else {
        for (const v of schemeVars) {
          if (wordIn(argText, v)) {
            // The scheme comes from the variable's assignment;
            // report the scheme literal found in that assignment.
            const assignRe = new RegExp(
              `(?:const|let|var)\\s+${v.replace(/\$/g, '\\$')}\\s*=\\s*([^;\\n]{0,300})`,
            );
            const assignMatch = assignRe.exec(text);
            if (assignMatch) {
              const sm = /([A-Za-z][A-Za-z0-9+.-]{2,}):\/\//.exec(assignMatch[1]);
              if (sm && isCustomScheme(sm[1])) scheme = sm[1].toLowerCase();
              else if (/javascript:/i.test(assignMatch[1])) scheme = 'javascript';
            }
            break;
          }
        }
      }
      if (!scheme) continue;
      flows.push({
        scheme,
        param,
        taintedVar,
        sinkKind,
        sinkSnippet: snippetAround(text, m.index, m[0].length),
        line: lineOf(text, m.index),
      });
    }
  }
  return { flows, schemesFound, sinksFound, paramReads };
}

// Scan one source body and push findings for its confirmed flows.
// `sourceUrl` is the URL the finding is filed under; `sourceLabel`
// names the source in the evidence.
function scanBody(body, sourceUrl, sourceLabel, findings, seen, diag) {
  if (findings.length >= MAX_FINDINGS) return;
  const scan = scanDeepLinkFlows(body);
  diag.schemesFound = [...new Set([...(diag.schemesFound || []), ...scan.schemesFound])];
  diag.sinksFound = (diag.sinksFound || 0) + scan.sinksFound;
  diag.paramReads = [...new Set([...(diag.paramReads || []), ...scan.paramReads])];
  diag.flowsConfirmed = (diag.flowsConfirmed || 0) + scan.flows.length;
  for (const flow of scan.flows) {
    if (findings.length >= MAX_FINDINGS) return;
    const dedupKey = `${sourceLabel}|${flow.scheme}|${flow.param}|${flow.sinkKind}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    const isJs = flow.scheme === 'javascript';
    findings.push({
      class: 'deep_link_hijack',
      id: `deep-link-${slug(flow.scheme)}-${slug(flow.param)}`,
      title: isJs
        ? `Deep-link hijack — attacker parameter '${flow.param}' flows into a javascript: deep-link value`
        : `Deep-link hijack — attacker parameter '${flow.param}' flows into ${flow.scheme}:// navigation`,
      severity: 'high',
      url: sourceUrl,
      parameter: flow.param,
      evidence: {
        request:
          sourceLabel.startsWith('inline')
            ? `inline <script> block on ${sourceUrl} (page body already fetched)`
            : `GET ${sourceUrl} (same-origin script bundle)`,
        response:
          `Deep-link parameter flow in ${sourceLabel}: URL parameter '${flow.param}' ` +
          `is read into ${flow.taintedVar === '(inline parameter read)' ? 'an inline parameter read' : `variable '${flow.taintedVar}'`} ` +
          `and passed to a ${flow.sinkKind} navigation sink carrying a ${isJs ? 'javascript:' : `${flow.scheme}://`} value ` +
          `(line ${flow.line}: ${flow.sinkSnippet}). ` +
          `Static mining only — the handler code and the parameter flow are observed as served; ` +
          `no mobile device was driven.`,
        impact_demo:
          'Attacker-crafted link primitive — anyone who can send the victim a link controls the deep-link parameter, so the app opens attacker-chosen content or a WebView navigates to an attacker page; a javascript: value executes script in the WebView context. Validate the parameter against an allowlist of destinations and never build a deep link from raw query input (OWASP MASVS V5 / MSTG-DEEPLINK).',
        signalCorrelated: true,
      },
    });
  }
}

/**
 * Probe deep-link / URL-scheme handling in first-party client-side
 * JS (#510).
 * @param {string} pageUrl — the pasted page URL (findings on inline
 *   scripts are filed under it).
 * @param {object} targets — { bundles: [urls], inline: [bodies] }
 *   from extractSecretTargets (runScan computes it from the page
 *   body so a script-less page skips instead of fetching).
 * @param {object} opts — { timeoutMs, headers, fetchPage, diagnostics }.
 *   fetchPage is the test seam (defaults to fingerprint.fetchPage).
 * @returns {object[]} findings (class 'deep_link_hijack', high) —
 *   at most 1 per (source, scheme, parameter, sink), max 5 per scan.
 */
export async function probeDeepLink(pageUrl, targets, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  try {
    new URL(pageUrl);
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
    scanBody(res.body, bundleUrl, `script bundle ${bundleUrl}`, findings, seen, diagAcc);
    if (findings.length >= MAX_FINDINGS) break;
  }
  if (findings.length < MAX_FINDINGS) {
    inline.forEach((body, i) => {
      if (findings.length >= MAX_FINDINGS) return;
      scanned += 1;
      scanBody(body, pageUrl, `inline <script> block #${i + 1} on ${pageUrl}`, findings, seen, diagAcc);
    });
  }
  setDiag('bundlesScanned', scanned);
  setDiag('schemesFound', diagAcc.schemesFound || []);
  setDiag('sinksFound', diagAcc.sinksFound || 0);
  setDiag('paramReads', diagAcc.paramReads || []);
  setDiag('flowsConfirmed', diagAcc.flowsConfirmed || 0);
  return findings;
}

export const __deepLinkMeta = { phases: ['deep-link'], depth: ['quick', 'standard', 'deep'] };
