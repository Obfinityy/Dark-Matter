// Dark Matter rule-based scanner — CSTI framework variants probe
// (coverage rows #452–#455 [High] Client-Side Template Injection,
// CWE-94 / CWE-79; phase 111, 'csti-frameworks').
//
//   #452 AngularJS template injection (CWE-94)
//   #453 Vue.js template injection (CWE-94)
//   #454 Knockout / Handlebars client templates (CWE-94)
//   #455 React dangerouslySetInnerHTML abuse (CWE-79)
//
// ORACLE (deterministic, no judge, no LLM, $0): this probe is the
// framework-gated sibling of the #190 CSTI probe (csti.js). The
// #190 probe mines for ANY runtime template engine; this probe
// fires ONLY when a matching client-side template framework is
// fingerprinted first — AngularJS, Vue, Knockout, Handlebars, or
// React. The framework gate is the whole point: a page with no
// matching framework is a proven true negative with a 'no matching
// framework' diagnostic, never a vacuous pass.
//
//   TIER 1 — FRAMEWORK FINGERPRINT (cheap, rigorous for the
//   negative case): the page's own first-party bundles + inline
//   <script> blocks + the served page HTML are scanned for
//   framework markers. AngularJS: angular.module / ng-app /
//   ng-controller / $interpolate / $scope. Vue: new Vue /
//   Vue.createApp / Vue.compile / v-bind / v-model / v-if / v-for /
//   v-on / v-html. Knockout: ko.applyBindings / ko.observable /
//   data-bind. Handlebars: Handlebars.compile / .template.
//   React: dangerouslySetInnerHTML / ReactDOM.createRoot /
//   React.createElement. ZERO markers means no framework on the
//   page can evaluate a template at runtime — a proven true
//   negative, no browser needed. Compiled-at-build-time frameworks
//   (modern Angular, Vue SFC, Svelte) carry none of these markers:
//   modern Angular uses ng-version / app-root / compiled symbols,
//   never angular.module or ng-app, so it is a true negative by
//   construction, not a gap — Juice Shop (modern Angular) and DVWA
//   (no framework) are both expected true negatives on current
//   labs, and the gate diagnostic is what proves it.
//
//   TIER 2 — CDP EXECUTION DRIVE (only when a framework is
//   fingerprinted): a real headless browser (the same
//   transient-container + fixed-loopback-CDP pattern as
//   renderDomAuthenticated) navigates the pasted page with a canary
//   in the two attacker-controlled inputs a page can read without
//   interaction — the query string and then the fragment — and reads
//   back the rendered DOM.
//     Template frameworks (AngularJS / Vue / Knockout /
//     Handlebars): the #190 canary {{7*7*191}}, which a runtime
//     template engine evaluates to 9352. The drive is
//     driveCstiExecution from csti.js, reused verbatim — same
//     oracle (control clean, canary evaluates to 9352, literal
//     absent, same reflection point in two renders). CONFIRM only
//     when that oracle holds.
//     React (#455): the HTML canary <i data-dmreact="9352">x</i>.
//     A page that feeds untrusted HTML to dangerouslySetInnerHTML
//     renders it as parsed markup; a page that renders data as
//     text (React's default) echoes it escaped. CONFIRM only when
//     the parsed <i data-dmreact="9352"> element is present in the
//     rendered DOM in two separate renders at the same reflection
//     point, and absent from the control render. The React drive
//     runs ONLY when dangerouslySetInnerHTML itself is present in
//     first-party code — a React app that never uses the sink has
//     no #455 surface, so there is nothing to drive.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// csti / basket-logic / workflow-skip / session-fixation / twofa /
// credential-stuffing / dom-postmessage); depth 'quick' skips the
// probe. BOUND: at most 1 template drive + 1 React drive per scan
// (control + 2 canary renders per vector, 2 vectors each), at most
// 5 bundles + 10 inline blocks + 1 page body mined. Findings are
// class 'dom_sink' — the default confirmation protocol judges them
// on signalCorrelated. Severity follows the rows (High) ONLY on
// observed evaluation; a true negative fires nothing.
//
// HONEST LIMITS (stated up front, not discovered later):
// - The drive is ANONYMOUS (no lab session): it tests the pasted
//   page as a logged-out visitor. A template that only renders
//   behind login is not reached — the probe reports no execution
//   with driveAttempted=true and says so in the evidence, never a
//   proven true negative.
// - Only the query string and the fragment are tested as input
//   vectors. A template fed exclusively by an API response, a
//   postMessage, or user interaction is not exercised — such a
//   template is a true negative BY THIS ORACLE, not proof of
//   safety; the evidence says so.
// - Knockout has no {{ }} evaluation surface: its templates bind
//   via data-bind attributes, which no URL vector can reach
//   without app code. A Knockout-only page still drives the
//   {{ }} canary (the Handlebars half of #454) and reports
//   not-executed — the data-bind surface cannot be reached from
//   URL vectors, and the probe says so rather than claiming a
//   proof of safety.
// - A page that echoes the raw query/fragment value into the DOM
//   elsewhere keeps the literal canary in the render, and the
//   template oracle then refuses to confirm even when another
//   slot evaluates it — the SSTI literal-absent rule, applied
//   conservatively. That can only hide an execution (a missed
//   finding), never create one.
// - Vendor / polyfill / runtime bundles are excluded by filename
//   stem and sanitizer-defining bundles are skipped whole (same
//   gates as domXssSinks) — framework code is not the app's
//   vulnerability. A framework FILE (angular.js, react-dom.js)
//   can still trip the gate when served first-party; that only
//   costs a drive, never a finding — the drive oracle decides.
// - When several frameworks are fingerprinted and the canary
//   evaluates, the finding names the FIRST detected template
//   framework and lists every detected framework in the evidence:
//   the rendered DOM alone cannot attribute the evaluation to one
//   framework.

import { randomBytes } from 'node:crypto';
import { isLabTargetHost } from '../../labCreds.js';
import { fetchPage } from '../fingerprint.js';
import { JS_ROUTES_MAX_BUNDLES } from '../jsRoutes.js';
import { runCmd } from '../runner.js';
import { DOM_RENDER_IMAGE } from '../domRender.js';
import { connectCdp } from '../cdpClient.js';
import {
  buildCdpContainerRunArgs,
  buildCdpContainerRmArgs,
  AUTH_RENDER_CONNECT_ATTEMPTS,
  AUTH_RENDER_CONNECT_DELAY_MS,
  AUTH_RENDER_TIMEOUT_MS,
  AUTH_RENDER_DEBUG_ENDPOINT,
} from '../authDomRender.js';
import { isVendorBundle, isFrameworkBundle } from './domXssSinks.js';
import { stripVolatileValues, sameReflectionPoint } from './oracleGuards.js';
import {
  driveCstiExecution,
  canaryValue,
  queryCanaryUrl,
  fragmentCanaryUrl,
} from './csti.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const MAX_BUNDLES = JS_ROUTES_MAX_BUNDLES; // 5, same cap as jsRoutes / domXssSinks / csti
const MAX_INLINE = 10;
const MAX_FINDINGS = 1;
const SNIPPET_RADIUS = 80;
const DRIVE_SETTLE_MS = 1000; // extra settle after each drive navigation (SPA render is async)
const REACT_PARAM = 'dmreact';
const REACT_MARKER = '<i data-dmreact="9352">'; // parsed-element marker for the React drive

// ---- tier-1: framework fingerprints (pure) -------------------------------
//
// Each entry is one framework marker set. `sink` marks the React
// entry that IS the #455 surface (dangerouslySetInnerHTML): the
// React drive runs only when a sink marker is present — a React
// app that never uses the sink has no #455 surface to drive.
// Modern Angular is deliberately absent: ng-version / app-root /
// compiled ɵ symbols are not markers, so a modern Angular page
// (Juice Shop) fingerprints zero frameworks.
const FRAMEWORK_RES = [
  {
    kind: 'angularjs',
    sink: false,
    re: /angular\.module\s*\(|ng-app\b|ng-controller\b|ng-repeat\b|ng-model\b|ng-bind\b|\$interpolate\s*\(|\$scope\b/g,
  },
  {
    kind: 'vue',
    sink: false,
    re: /Vue\.compile\s*\(|new Vue\s*\(|Vue\.createApp\s*\(|Vue\.component\s*\(|v-bind\b|v-model\b|v-if\b|v-for\b|v-on\b|v-html\b/g,
  },
  {
    kind: 'knockout',
    sink: false,
    re: /ko\.(applyBindings|observable|observableArray|computed)\s*\(|data-bind\s*=/g,
  },
  {
    kind: 'handlebars',
    sink: false,
    re: /Handlebars\.(compile|template)\s*\(|Handlebars\.registerHelper\s*\(/g,
  },
  { kind: 'react', sink: true, re: /dangerouslySetInnerHTML/g },
  {
    kind: 'react',
    sink: false,
    re: /ReactDOM\.(createRoot|render)\s*\(|React\.createElement\s*\(|__REACT_DEVTOOLS_GLOBAL_HOOK__/g,
  },
];

// Template-evaluating frameworks: the {{7*7*191}} canary drive
// covers all four. React has its own HTML canary drive.
const TEMPLATE_KINDS = ['angularjs', 'vue', 'knockout', 'handlebars'];

// Row + title per framework kind. Knockout and Handlebars share
// row #454, so they share a finding id too.
const FRAMEWORK_ROWS = {
  angularjs: {
    row: 452,
    id: 'csti-framework-angularjs',
    title:
      'CSTI — AngularJS template injection — page evaluates {{7*7*191}} to 9352 in an AngularJS template (HIGH)',
  },
  vue: {
    row: 453,
    id: 'csti-framework-vue',
    title:
      'CSTI — Vue.js template injection — page evaluates {{7*7*191}} to 9352 in a Vue template (HIGH)',
  },
  knockout: {
    row: 454,
    id: 'csti-framework-knockout-handlebars',
    title:
      'CSTI — Knockout / Handlebars client template injection — page evaluates {{7*7*191}} to 9352 in a client template (HIGH)',
  },
  handlebars: {
    row: 454,
    id: 'csti-framework-knockout-handlebars',
    title:
      'CSTI — Knockout / Handlebars client template injection — page evaluates {{7*7*191}} to 9352 in a client template (HIGH)',
  },
  react: {
    row: 455,
    id: 'csti-framework-react',
    title:
      'CSTI — React dangerouslySetInnerHTML abuse — page renders untrusted HTML as markup via dangerouslySetInnerHTML (HIGH)',
  },
};

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

// All framework markers in one source body, each with its kind,
// whether it is the React sink, line, snippet and source. Pure —
// exported for unit tests. `source` names the body (bundle URL,
// inline block label, or 'page html').
export function detectFrameworks(body, source = '') {
  const text = typeof body === 'string' ? body : '';
  if (!text) return [];
  const out = [];
  for (const { kind, sink, re } of FRAMEWORK_RES) {
    const rx = new RegExp(re.source, re.flags);
    let m;
    while ((m = rx.exec(text)) !== null) {
      out.push({
        index: m.index,
        kind,
        sink: Boolean(sink),
        line: lineOf(text, m.index),
        snippet: snippetAround(text, m.index, m[0].length),
        source,
      });
    }
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

// Tier-1 verdict from a framework list: which kinds were
// fingerprinted (first-seen order), whether the gate opens, and
// which drives are warranted. Pure — exported for unit tests.
export function assessFrameworkGate(frameworks) {
  const list = Array.isArray(frameworks) ? frameworks : [];
  const kinds = [];
  for (const f of list) {
    if (f && f.kind && !kinds.includes(f.kind)) kinds.push(f.kind);
  }
  const reactSink = list.some((f) => f && f.kind === 'react' && f.sink);
  const driveTemplate = kinds.some((k) => TEMPLATE_KINDS.includes(k));
  return {
    detected: list.length > 0,
    frameworks: list.length,
    kinds,
    reactSink,
    driveTemplate,
    driveReact: reactSink,
  };
}

// ---- tier-2 (React): canary values + URL builders (pure) -----------------

// The HTML fragment a page feeding untrusted HTML to
// dangerouslySetInnerHTML renders as parsed markup. The marker is
// the parsed element itself: <i data-dmreact="9352"> can only
// appear in outerHTML if the HTML was parsed, never when it was
// echoed as text (that renders &lt;i ...).
export function reactCanaryValue() {
  return '<i data-dmreact="9352">x</i>';
}

export function reactMarkerValue() {
  return REACT_MARKER;
}

// Control value: a unique literal filler. It carries the rid but
// never the marker, so the oracle cannot be satisfied by the
// control alone.
export function reactControlValue(rid) {
  return `dmcontrol-${String(rid || '')}`;
}

// Query-string vector: ?dmreact=<value> (or & when a query exists).
export function reactQueryCanaryUrl(pageUrl, value) {
  try {
    const u = new URL(pageUrl);
    u.searchParams.set(REACT_PARAM, value);
    return u.toString();
  } catch {
    return null;
  }
}

// Fragment vector: #<value> — read by the page via location.hash.
export function reactFragmentCanaryUrl(pageUrl, value) {
  try {
    const u = new URL(pageUrl);
    u.hash = encodeURIComponent(value);
    return u.toString();
  } catch {
    return null;
  }
}

// Tier-2 React verdict from the drive observations. Pure — exported
// for unit tests. The parsed element is decisive on its own: it
// can only appear when the HTML was parsed as markup, never when
// echoed as text. The control must be clean and the element must
// sit at the same reflection point in two separate renders, or the
// oracle is uncalibrated — never a finding.
export function assessReactDriveResult({ controlParsed, canaryParsed, samePoint }) {
  if (controlParsed) {
    return { verdict: 'uncalibrated', reason: 'parsed <i data-dmreact="9352"> element already present in the control render — oracle uncalibrated' };
  }
  if (!canaryParsed) {
    return { verdict: 'not-executed', reason: 'HTML canary was not rendered as parsed markup in the rendered DOM' };
  }
  if (!samePoint) {
    return { verdict: 'uncalibrated', reason: 'parsed element present but not at a stable reflection point' };
  }
  return { verdict: 'confirmed', reason: 'HTML canary rendered as parsed markup at the same reflection point in two renders, control clean' };
}

// ---- tier-2 (React): the CDP drive -----------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Drive the pasted page in a real headless browser with the React
 * HTML canary, mirroring driveCstiExecution (same transient
 * container + fixed host-loopback CDP pattern): navigate with a
 * control value, then twice with the HTML canary, in the query
 * string and then in the fragment, and read back the rendered DOM
 * after each navigation.
 * opts.runner / opts.cdpConnect / opts.image are the test seams
 * (defaults mirror authDomRender).
 * Returns { attempted, executed, vector, error, rid, marker }.
 * Never throws.
 */
export async function driveReactHtml(pageUrl, opts = {}) {
  const rid = randomBytes(4).toString('hex');
  const marker = reactMarkerValue();
  const canary = reactCanaryValue();
  const control = reactControlValue(rid);
  const out = {
    attempted: false,
    executed: false,
    vector: null,
    error: null,
    rid,
    marker,
  };
  const runner = typeof opts.runner === 'function' ? opts.runner : runCmd;
  const cdpConnect = typeof opts.cdpConnect === 'function' ? opts.cdpConnect : connectCdp;
  const image = opts.image || DOM_RENDER_IMAGE;
  const timeoutMs =
    Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0 ? opts.timeoutMs : AUTH_RENDER_TIMEOUT_MS;
  if (!pageUrl) {
    out.error = 'no url';
    return out;
  }
  let containerId = null;
  let client = null;
  try {
    const run = await runner('docker', buildCdpContainerRunArgs(image), { timeoutMs });
    if (!run || !run.ok || !String(run.stdout || '').trim()) {
      out.error = String((run && run.stderr) || '').trim().slice(0, 200) || 'browser container failed to start';
      return out;
    }
    containerId = String(run.stdout).trim().split(/\s+/)[0];
    out.attempted = true;

    let connected = null;
    let lastError = 'cdp endpoint unreachable';
    for (let i = 0; i < AUTH_RENDER_CONNECT_ATTEMPTS; i += 1) {
      const res = await cdpConnect(AUTH_RENDER_DEBUG_ENDPOINT, opts);
      if (res && res.ok) {
        connected = res;
        break;
      }
      lastError = (res && res.error) || lastError;
      if (i < AUTH_RENDER_CONNECT_ATTEMPTS - 1 && AUTH_RENDER_CONNECT_DELAY_MS > 0) {
        await sleep(AUTH_RENDER_CONNECT_DELAY_MS);
      }
    }
    if (!connected) {
      out.error = lastError;
      return out;
    }
    client = connected.client;

    const target = await client.newTarget('about:blank');
    await client.attach(target.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    // One render: navigate, let the SPA settle, read the serialised
    // DOM. The serialised DOM is the reflection surface: parsed
    // markup shows up here as the element itself, a text echo as
    // the escaped &lt;... form.
    const renderedHtml = async (url) => {
      await client.navigate(url);
      await sleep(DRIVE_SETTLE_MS);
      const html = await client.evaluate('document.documentElement.outerHTML');
      return typeof html === 'string' ? html : null;
    };

    const vectors = [
      { name: 'query', control: reactQueryCanaryUrl(pageUrl, control), canary: reactQueryCanaryUrl(pageUrl, canary) },
      { name: 'fragment', control: reactFragmentCanaryUrl(pageUrl, control), canary: reactFragmentCanaryUrl(pageUrl, canary) },
    ];
    for (const v of vectors) {
      if (!v.control || !v.canary) {
        out.error = `cannot build ${v.name} canary URL`;
        return out;
      }
      const controlRaw = await renderedHtml(v.control);
      const c1Raw = await renderedHtml(v.canary);
      const c2Raw = await renderedHtml(v.canary);
      if (controlRaw === null || c1Raw === null || c2Raw === null) {
        out.error = 'rendered DOM unavailable';
        return out;
      }
      // Guard (a): strip per-request random values from all three
      // renders before the differential, so the oracle can never
      // match inside a fresh token.
      const controlHtml = stripVolatileValues(controlRaw);
      const c1 = stripVolatileValues(c1Raw);
      const c2 = stripVolatileValues(c2Raw);
      const verdict = assessReactDriveResult({
        controlParsed: controlHtml.includes(marker),
        canaryParsed: c1.includes(marker),
        samePoint: sameReflectionPoint(c1, c2, marker),
      });
      if (verdict.verdict === 'confirmed') {
        out.executed = true;
        out.vector = v.name;
        return out;
      }
      if (verdict.verdict === 'uncalibrated') {
        out.error = verdict.reason;
        return out;
      }
      // not-executed on this vector: try the next one.
    }
    return out;
  } catch (e) {
    out.error = e && e.message ? String(e.message).slice(0, 200) : String(e);
    return out;
  } finally {
    try {
      if (client) await client.close();
    } catch {
      // close is best-effort
    }
    if (containerId) {
      try {
        await runner('docker', buildCdpContainerRmArgs(containerId), { timeoutMs: 15000 });
      } catch {
        // container removal is best-effort
      }
    }
  }
}

// ---- the probe ---------------------------------------------------------------

/**
 * Probe CSTI framework variants (#452–#455).
 * @param {string} pageUrl — the pasted page URL (findings are filed under it).
 * @param {object} targets — { bundles: [urls], inline: [bodies] } from
 *   extractSecretTargets (runScan computes it from the page body so a
 *   script-less page skips instead of fetching).
 * @param {object} opts — { labCreds, allowWrite, labTargets, depth,
 *   timeoutMs, headers, fetchPage, pageBody, runner, cdpConnect,
 *   image, diagnostics }.
 *   fetchPage is the bundle-fetch seam (defaults to fingerprint.fetchPage);
 *   pageBody is the served page HTML (mined for framework attributes
 *   such as ng-app / data-bind); runner / cdpConnect / image are the
 *   CDP-drive seams.
 * @returns {object[]} findings (class 'dom_sink', high) — at most 1 per
 *   scan: the first framework whose canary evaluates.
 */
export async function probeCstiFrameworks(pageUrl, targets, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  // GATES (fail-closed, same lab gate as csti / basket-logic /
  // workflow-skip / session-fixation / twofa / credential-stuffing
  // / dom-postmessage): canary lab creds + allowWrite + lab host +
  // depth !== 'quick'. The drives navigate the target with a
  // template/HTML canary, so they never run outside the lab gate.
  const creds = opts.labCreds;
  if (!creds || !creds.username || !creds.password) return findings;
  if (opts.allowWrite !== true) return findings;
  if (!isLabTargetHost(pageUrl, opts.labTargets)) return findings;
  if ((opts.depth || 'standard') === 'quick') return findings;

  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  const bundles = Array.isArray(targets && targets.bundles)
    ? targets.bundles.slice(0, MAX_BUNDLES)
    : [];
  const inline = Array.isArray(targets && targets.inline)
    ? targets.inline.slice(0, MAX_INLINE)
    : [];

  // TIER 1 — fingerprint a matching client-side template framework
  // in first-party code + the served page HTML. Vendor /
  // framework bundles are excluded by the same gates as
  // domXssSinks (framework code is not the app's vuln).
  const frameworks = [];
  for (const bundleUrl of bundles) {
    if (isVendorBundle(bundleUrl)) continue;
    let res;
    try {
      res = await fetchFn(bundleUrl, opts);
    } catch {
      continue;
    }
    if (!res || res.status !== 200 || !res.body) continue;
    if (isFrameworkBundle(res.body)) continue;
    for (const r of detectFrameworks(res.body, bundleUrl)) {
      frameworks.push(r);
    }
  }
  inline.forEach((body, i) => {
    for (const r of detectFrameworks(body, `inline <script> block #${i + 1}`)) {
      frameworks.push(r);
    }
  });
  // The served page HTML carries framework attributes (ng-app,
  // data-bind, v- directives) that no bundle body shows.
  if (typeof opts.pageBody === 'string' && opts.pageBody) {
    for (const r of detectFrameworks(opts.pageBody, 'page html')) {
      frameworks.push(r);
    }
  }
  const gate = assessFrameworkGate(frameworks);
  setDiag('frameworks', gate.frameworks);
  setDiag('frameworkKinds', gate.kinds.join(','));
  setDiag('frameworkDetected', gate.detected);
  setDiag('reactSink', gate.reactSink);
  // THE GATE: no matching framework is a proven true negative —
  // recorded with its reason, never a vacuous pass.
  if (!gate.detected) {
    setDiag('skipReason', 'no matching framework');
    return findings;
  }

  // TIER 2 — drive the pasted page in a real browser and observe
  // whether a canary evaluates. Template frameworks first (one
  // drive covers all four); React second, only when its sink is
  // present. A drive error leaves the oracle uncalibrated — never
  // a finding, and never a proven true negative either.
  if (gate.driveTemplate) {
    setDiag('driveAttempted', true);
    setDiag('driveKind', 'template');
    const drive = await driveCstiExecution(pageUrl, opts);
    setDiag('driveExecuted', drive.executed);
    if (drive.error) return findings;
    if (drive.executed) {
      const first = frameworks.find((f) => TEMPLATE_KINDS.includes(f.kind));
      const row = FRAMEWORK_ROWS[first.kind];
      const canaryUrl =
        drive.vector === 'fragment'
          ? fragmentCanaryUrl(pageUrl, canaryValue())
          : queryCanaryUrl(pageUrl, canaryValue());
      findings.push({
        class: 'dom_sink',
        id: row.id,
        title: row.title,
        severity: 'high',
        url: pageUrl,
        parameter: `{{7*7*191}} → 9352 via ${drive.vector}`,
        evidence: {
          request:
            `GET ${canaryUrl} in a real browser — control dmcsti=dmcontrol-${drive.rid} first (no 9352 in the ` +
            `rendered DOM), then the canary {{7*7*191}} twice via the ${drive.vector} vector.`,
          response:
            `Template canary evaluated in a real browser: the rendered DOM contains 9352 at the same reflection ` +
            `point in two separate renders, the control render is clean, and the literal {{7*7*191}} is absent. ` +
            `Static mine fingerprinted ${gate.kinds.join(', ')} in first-party code (${first.source}, line ${first.line}, ` +
            `${first.kind}): ${first.snippet} ` +
            `The injected expression is attacker-controlled (any link can carry it in the ${drive.vector}) and the ` +
            `page's ${first.kind} template engine evaluates it unencoded. Coverage row #${row.row}.`,
          impact_demo:
            'Client-side template injection — an attacker link carrying {{7*7}} (or a sandbox-escape chain after it) executes script in the victim origin (session theft, actions as the user). Never pass user input to a template engine as a template — render data with context-aware encoding / textContent, and compile templates from trusted sources only (PortSwigger client-side template injection).',
          signalCorrelated: true,
        },
      });
      return findings;
    }
  }

  if (gate.driveReact) {
    setDiag('driveAttempted', true);
    setDiag('driveKind', 'react');
    const drive = await driveReactHtml(pageUrl, opts);
    setDiag('driveExecuted', drive.executed);
    if (drive.error) return findings;
    if (!drive.executed) return findings;

    const sink = frameworks.find((f) => f.kind === 'react' && f.sink);
    const row = FRAMEWORK_ROWS.react;
    const canaryUrl =
      drive.vector === 'fragment'
        ? reactFragmentCanaryUrl(pageUrl, reactCanaryValue())
        : reactQueryCanaryUrl(pageUrl, reactCanaryValue());
    findings.push({
      class: 'dom_sink',
      id: row.id,
      title: row.title,
      severity: 'high',
      url: pageUrl,
      parameter: `<i data-dmreact="9352">x</i> rendered as markup via ${drive.vector}`,
      evidence: {
        request:
          `GET ${canaryUrl} in a real browser — control dmreact=dmcontrol-${drive.rid} first (no parsed ` +
          `<i data-dmreact="9352"> element in the rendered DOM), then the HTML canary <i data-dmreact="9352">x</i> ` +
          `twice via the ${drive.vector} vector.`,
        response:
          `Untrusted HTML rendered as markup in a real browser: the rendered DOM contains the parsed ` +
          `<i data-dmreact="9352"> element at the same reflection point in two separate renders, the control ` +
          `render is clean. Static mine found dangerouslySetInnerHTML in first-party code (${sink.source}, line ` +
          `${sink.line}): ${sink.snippet} ` +
          `The injected markup is attacker-controlled (any link can carry it in the ${drive.vector}) and the ` +
          `page's React code injects it as HTML instead of text. Coverage row #${row.row}.`,
        impact_demo:
          'React dangerouslySetInnerHTML abuse — attacker HTML injected via dangerouslySetInnerHTML executes script in the React app origin (reflected/stored XSS through untrusted HTML; session theft, actions as the user). Never pass untrusted HTML to dangerouslySetInnerHTML — render data as text, or sanitise with DOMPurify behind a strict Content-Security-Policy (OWASP A03:2021, CWE-79).',
        signalCorrelated: true,
      },
    });
    return findings;
  }

  return findings;
}

export const __cstiFrameworksMeta = { phases: ['csti-frameworks'], depth: ['standard', 'deep'] };
