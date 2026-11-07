// Dark Matter rule-based scanner — deterministic orchestrator.
// paste link → scope check → recon/fingerprint → ONE-PAGE-DEEP element
// analysis → probe battery → Nuclei → differential verification →
// confirmed findings.
// No LLM, no API keys, no prompts. Same target + same code = same result.
import { authorizeTarget } from './target.js';
import { randomBytes } from 'node:crypto';
import { fingerprint, fetchPage } from './fingerprint.js';
import { crawl, extractParams, extractForms } from './crawl.js';
import { extractProbePoints } from './probePoints.js';
import { analyzePage, planForPage } from './pageAnalyze.js';
import { probeHeaders } from './probes/headers.js';
import { probeSqliError } from './probes/sqliError.js';
import { probeBlindSqli } from './probes/sqliBlind.js';
import { probeXssReflected } from './probes/xss.js';
import { probeCmdiTime } from './probes/cmdi.js';
import { probeTraversal } from './probes/traversal.js';
import { probeSsti } from './probes/ssti.js';
import { probeOpenRedirect } from './probes/redirect.js';
import { probeCsrf } from './probes/csrf.js';
import { probePostForms } from './probes/postForms.js';
import { probeSensitiveFiles } from './probes/files.js';
import { probeXxe } from './probes/xxe.js';
import { probeSsrf } from './probes/ssrf.js';
import { probeIdorSurface } from './probes/idor.js';
import { probeCors } from './probes/cors.js';
import { probeCookieFlags } from './probes/cookies.js';
import { probeStoredXss } from './probes/storedXss.js';
import { probeWeakCreds } from './probes/weakCreds.js';
import { probeHostHeader } from './probes/hostHeader.js';
import { probeNoSqli } from './probes/nosqli.js';
import { probeLdapInjection } from './probes/ldapi.js';
import { probeLdapBlind } from './probes/ldapBlind.js';
import { probeNoSqlDeep } from './probes/nosqlDeep.js';
import { probeRace } from './probes/race.js';
import { probeCrypto } from './probes/crypto.js';
import { probePrototypePollution } from './probes/prototypePollution.js';
import { probeDeserialization } from './probes/deserialization.js';
import { probeHpp } from './probes/hpp.js';
import { probeMassAssignment } from './probes/massAssignment.js';
import { probeWsMessages } from './probes/wsMessages.js';
import { probeSubdomainTakeover } from './probes/subdomainTakeover.js';
import { probeCrlf } from './probes/crlf.js';
import { probeCsvLog } from './probes/csvLogInjection.js';
import { probeSmtpInject } from './probes/smtpInject.js';
import { probeSessionFixation } from './probes/sessionFixation.js';
import { probeUserEnum } from './probes/userEnum.js';
import { probeRfi } from './probes/rfi.js';
import { probeXslt } from './probes/xslt.js';
import { probeEvalInject } from './probes/evalInject.js';
import { probeJsonp } from './probes/jsonp.js';
import { probeRpo } from './probes/rpo.js';
import { probeTabnabbing } from './probes/tabnabbing.js';
import { probeDanglingMarkup } from './probes/danglingMarkup.js';
import { probePaddingOracle } from './probes/paddingOracle.js';
import { probeArgInjection } from './probes/argInjection.js';
import { probeXpathInjection } from './probes/xpathi.js';
import { probeSsiInjection } from './probes/ssi.js';
import { probeFileUpload } from './probes/fileUpload.js';
import { probeCachePoisoning } from './probes/cachePoison.js';
import { probeRequestSmuggling } from './probes/smuggling.js';
import { probeJwt } from './probes/jwt.js';
import { probeGraphql } from './probes/graphql.js';
import { probeCswsh } from './probes/cswsh.js';
import { probeOauth } from './probes/oauth.js';
import { probeSaml } from './probes/saml.js';
import { createOobCollaborator } from './oobCollaborator.js';
import { discoverDomForms } from './domRender.js';
import { discoverOpenApiTargets } from './openapi.js';
import { discoverJsRoutes } from './jsRoutes.js';
import { probeTls } from './probes/tlsScan.js';
import { probePasswordReset } from './probes/passwordReset.js';
import { probeElInject } from './probes/elInject.js';
import { probeOgnlInject } from './probes/ognlInject.js';
import { probeVerbTampering } from './probes/verbTampering.js';
import { probeMethodOverride } from './probes/methodOverride.js';
import { probeSecretsInJs, extractSecretTargets } from './probes/secretsInJs.js';
import { probeErrorDisclosure } from './probes/errorDisclosure.js';
import { probeValidation } from './probes/validation.js';
import { probeFingerprintBanner } from './probes/fingerprintBanner.js';
import { runNuclei, nucleiPhaseFields } from './nuclei.js';
import { verifyFindings } from './verifier.js';

export const DEFAULT_PHASES = [
  'fingerprint',
  'crawl',
  'page-analyze',
  'dom-render',
  'openapi-targets',
  'js-api-routes',
  'headers',
  'sqli-error',
  'sqli-blind',
  'xss',
  'cmdi',
  'traversal',
  'ssti',
  'el-injection',
  'ognl-injection',
  'redirect',
  'csrf',
  'post-forms',
  'files',
  'xxe',
  'ssrf',
  'idor',
  'cors',
  'cookies',
  'stored-xss',
  'weak-creds',
  'host-header',
  'nosqli',
  'nosql-deep',
  'ldapi',
  'ldap-blind',
  'race',
  'crypto',
  'prototype-pollution',
  'deserialization',
  'hpp',
  'mass-assignment',
  'ws-messages',
  'subdomain-takeover',
  'crlf',
  'csv-log-injection',
  'smtp-injection',
  'session-fixation',
  'user-enumeration',
  'rfi',
  'xslt',
  'eval-injection',
  'jsonp',
  'rpo',
  'tabnabbing',
  'dangling-markup',
  'padding-oracle',
  'arg-injection',
  'xpathi',
  'ssi',
  'file-upload',
  'cache-poisoning',
  'request-smuggling',
  'jwt',
  'graphql',
  'cswsh',
  'oauth',
  'saml',
  'tls',
  'password-reset',
  'verb-tampering',
  'method-override',
  'secrets-in-js',
  'error-disclosure',
  'validation',
  'fingerprint-banner',
  'nuclei',
];

// PARAM BATTERY (5 Nov 2026, 35/63 fix): the 28 injection-class phases
// below run per URL inside the param loop in runScan. When a scan has ZERO
// param-bearing targets (bare-root paste on a POST-login page, SPA with no
// links/forms), the loop body never executes and step() is never invoked
// for them — previously they vanished with no record at all, so the rollup
// read a clean 35/35 ok on a 35/63 run. runScan now emits a skipped record
// for each of them instead; see skipPhase inside runScan.
export const PARAM_BATTERY_PHASES = [
  'sqli-error',
  'sqli-blind',
  'hpp',
  'csv-log-injection',
  'xss',
  'nosqli',
  'nosql-deep',
  'ldapi',
  'ldap-blind',
  'xpathi',
  'ssi',
  'cmdi',
  'traversal',
  'rfi',
  'xslt',
  'eval-injection',
  'jsonp',
  'rpo',
  'tabnabbing',
  'dangling-markup',
  'padding-oracle',
  'arg-injection',
  'ssti',
  'el-injection',
  'ognl-injection',
  'redirect',
  'crlf',
  'ssrf',
];

/**
 * Build the finished-scan phase rollup from runScan's phase records.
 * Pure — exported for unit tests. `skipped` counts separately from ok /
 * failed: a 35-ok / 28-skipped run reports {total: 63, ok: 35, failed: 0,
 * skipped: 28}, never a clean 35/35 pass. `timedOut` counts every record
 * carrying timedOut (a timed-out nuclei record is also failed, as before).
 */
export function buildPhaseRollup(phaseList) {
  const list = Array.isArray(phaseList) ? phaseList : [];
  return {
    total: list.length,
    ok: list.filter((p) => p.ok && !p.skipped).length,
    failed: list.filter((p) => !p.ok && !p.skipped).length,
    skipped: list.filter((p) => p.skipped).length,
    timedOut: list.filter((p) => p.timedOut).length,
  };
}

/**
 * Human-readable one-line phase split for the finished-scan summary.
 * Pure — exported for unit tests. A skipped battery must never again read
 * as "all ok": a 35-ok / 28-skipped run renders
 * "Phases: 35 ran ok, 28 skipped (no param targets), 0 failed, 0 timed out."
 * The parenthetical names the skip reason only when every skipped record
 * shares one (the zero-param-targets case); mixed or missing reasons render
 * as a bare count. Skipped records still carry ok:true by design (see
 * skipPhase) — this line reads the rollup's `skipped` count, never ok:true,
 * so counting ok:true phase events can no longer hide a skipped battery.
 */
export function buildPhaseSummaryLine(phaseList) {
  const rollup = buildPhaseRollup(phaseList);
  const list = Array.isArray(phaseList) ? phaseList : [];
  const reasons = [
    ...new Set(list.filter((p) => p.skipped && p.skipReason).map((p) => p.skipReason)),
  ];
  const skippedPart =
    reasons.length === 1 ? `${rollup.skipped} skipped (${reasons[0]})` : `${rollup.skipped} skipped`;
  return `Phases: ${rollup.ok} ran ok, ${skippedPart}, ${rollup.failed} failed, ${rollup.timedOut} timed out.`;
}

// DISCOVERY GATE (7 Nov 2026, error-disclosure coverage fix): a
// param-bearing target satisfies this gate — "the battery is already
// unlocked, no discovery needed" — only when it lives OFF the pasted
// page. A param synthesised from a standalone input on the landing
// page itself (Juice SPA root: /?email=dmprobe_...) proves nothing
// about the site's API surface: it used to satisfy the gate and skip
// both openapi-targets and js-api-routes, so /rest/* was never
// discovered in-scan and error-disclosure never saw
// /rest/products/search (live SQLITE_ERROR in the lane matrix, 0
// mentions in the whole hunt). Off-page targets (a form on
// /login.php, a crawled link with a query) still satisfy the gate
// exactly as before. Pure — exported for unit tests.
export function hasOffPageParamTarget(targets, baseUrl) {
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return false;
  }
  const normPath = (p) => (p.length > 1 ? p.replace(/\/$/, '') : p);
  for (const t of Array.isArray(targets) ? targets : []) {
    if (extractParams(t).length === 0) continue;
    try {
      const u = new URL(t);
      if (u.origin !== base.origin) continue;
      if (normPath(u.pathname) !== normPath(base.pathname)) return true;
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * Run the rule-based scan battery.
 *
 * opts (5 Nov 2026, phase visibility): `opts.onPhase` — optional callback
 * invoked (best-effort) with each step's phase record as the step finishes;
 * `opts.nucleiRunner` — test seam, defaults to the real runNuclei.
 * Returns `phases` — one record per executed step ({name, startedAt,
 * finishedAt, durationMs, ok, error, findingsCount}; the nuclei record
 * additionally carries ok/timedOut/stderrTail) PLUS one skipped record per
 * param-battery phase ({skipped: true, skipReason}) when the scan had zero
 * param-bearing targets (35/63 fix) AND one skipped record per gated
 * discovery phase (dom-render, openapi-targets, js-api-routes) whose
 * gate was false (7 Nov 2026, gated-skip fix — a skipped phase is
 * neither ok nor failed; buildPhaseRollup counts it separately).
 * `errors` is kept for backward compatibility.
 */
export async function runScan(
  {
    target,
    scope = '',
    labTargets = '',
    phases = DEFAULT_PHASES,
    confirmedAuthorized = false,
  },
  opts = {}
) {
  const startedAt = new Date().toISOString();
  const { url, host } = authorizeTarget({
    target,
    scope,
    labTargets,
    confirmedAuthorized,
  });
  // LAB GATE (file-upload probe): uploads write real files — allowed only
  // when the authorized host is listed in labTargets. Everywhere else the
  // probe returns [] without a single request.
  const allowWrite = String(labTargets || '')
    .split(/[,\s]+/)
    .some((t) => t && (host.includes(t) || t.includes(host)));
  const all = [];
  const errors = [];
  let fp = null;
  let crawled = null;

  // PHASE VISIBILITY (5 Nov 2026): every executed step records one phase
  // record — name, timing, ok/error, findings count — into `phaseRecords`
  // (returned by runScan) and, when opts.onPhase is set, streams it to the
  // listener as the step finishes. Before this fix step() emitted NOTHING:
  // a finished 63-phase scan left 13 event lines, zero per-phase record,
  // zero timing, zero error trace — a nuclei timeout vanished entirely.
  // The listener is best-effort (try/catch): a listener failure can NEVER
  // break the scan.
  const phaseRecords = [];
  const onPhase = typeof opts.onPhase === 'function' ? opts.onPhase : null;
  const emitPhase = (record) => {
    phaseRecords.push(record);
    if (onPhase) {
      try {
        onPhase(record);
      } catch {
        // listener failure must never break the scan
      }
    }
  };

  const step = async (name, fn, getExtras) => {
    if (!phases.includes(name)) return;
    const startedAt = new Date().toISOString();
    const startMs = Date.now();
    let ok = true;
    let error = null;
    let result;
    try {
      result = await fn();
      if (Array.isArray(result)) all.push(...result);
    } catch (e) {
      // A throwing step is recorded ok:false WITH its error message — it
      // must NOT vanish into errors[] alone (nothing persisted errors[]).
      ok = false;
      error = e && e.message ? String(e.message) : String(e);
      errors.push(`${name}: ${error}`);
      result = null;
    }
    let extras = {};
    if (typeof getExtras === 'function') {
      try {
        extras = getExtras() || {};
      } catch {
        extras = {};
      }
    }
    // Extras may override base fields (the nuclei step's extras carry the
    // tool's own ok/timedOut, which is the meaningful ok for that phase).
    const record = {
      name,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
      ok,
      error,
      findingsCount: Array.isArray(result) ? result.length : 0,
      ...extras,
    };
    emitPhase(record);
    return result;
  };

  // SKIPPED PHASES (5 Nov 2026, 35/63 fix): a phase that never ran must
  // still leave a record — otherwise the rollup cannot tell "35 of 63 ran"
  // from "63 of 63 passed". A skipped record is neither a pass nor a
  // failure: ok stays true so nothing counts it as failed, and the
  // `skipped` flag (with a reason) lets buildPhaseRollup count it
  // separately. Like step(), it honours the requested `phases` allowlist
  // and streams through onPhase.
  const skipPhase = (name, reason) => {
    if (!phases.includes(name)) return;
    const at = new Date().toISOString();
    emitPhase({
      name,
      startedAt: at,
      finishedAt: at,
      durationMs: 0,
      ok: true,
      skipped: true,
      skipReason: reason,
      error: null,
      findingsCount: 0,
    });
  };

  fp = await step('fingerprint', () => fingerprint(url, opts));
  crawled = await step('crawl', () => crawl(url, opts));

  // ONE-PAGE-DEEP (3 Nov 2026, owner order): the pasted page is the primary
  // target. Inventory every element on it and map each to its predefined
  // vulnerability classes (ELEMENT_VULN_MATRIX) — input box, button, form,
  // textarea, select, URL param, page itself. Standalone inputs (outside any
  // <form>) are invisible to the form battery, so they get synthesized GET
  // targets with UNIQUE filler values (same safety rule as form targets:
  // never empty, never equal — keeps every probe read-only).
  let pageAnalysis = null;
  let pageBody = null;
  await step('page-analyze', async () => {
    let body = crawled && crawled.body ? crawled.body : null;
    if (!body) {
      try {
        body = (await fetchPage(url, opts)).body;
      } catch {
        body = null;
      }
    }
    if (!body) return null;
    pageBody = body;
    pageAnalysis = analyzePage(body, url);
    return pageAnalysis;
  });

  // DOM RENDER (6 Nov 2026, DOM form discovery): an SPA pastes a shell
  // with zero static forms, so the injection battery would skip all 28
  // phases in silence (Juice Shop root: 0 forms, 0 named inputs even
  // AFTER a full JS render — its forms live on its routes, /#/login
  // renders named email/password inputs). When static analysis found
  // no element targets at all, render the page in a real browser
  // (transient chromium container, read-only GET) plus its discovered
  // SPA routes, and merge the DOM inventory into the page analysis.
  // The merged forms/inputs flow into the EXISTING target builder
  // below unchanged — the param battery only GETs the synthesised
  // targets (a POST form is never submitted FOR THE BATTERY; the
  // dedicated post-forms probe still POSTs to POST forms by design,
  // exactly as it does for static forms). This step only supplies
  // what static analysis could not see. It fires ONLY on the
  // zero-static-elements trigger, so server-rendered targets (DVWA,
  // WebGoat) never pay the render. A gated-off run records a skipped
  // dom-render entry instead (7 Nov 2026, gated-skip fix) — the
  // rollup gains 1 skipped record, everything else byte-identical.
  // A failed render throws inside step(), which records
  // ok:false with the error and lets the scan continue static-only.
  // opts.domRenderer is the test seam: a single-page renderer
  // (url) => { ok, html, error } replacing renderDom — the real
  // discoverDomForms still runs (route extraction + merge), so
  // integration tests exercise the orchestration and stub only the
  // chromium execution. Production callers never pass it.
  let domForms = [];
  let domDiscovery = null;
  const needsDom =
    pageAnalysis &&
    pageAnalysis.forms.length === 0 &&
    pageAnalysis.inputs.length === 0 &&
    pageAnalysis.textareas.length === 0 &&
    pageAnalysis.selects.length === 0;
  if (needsDom) {
    await step(
      'dom-render',
      async () => {
        domDiscovery = await discoverDomForms(url, {
          ...opts,
          ...(typeof opts.domRenderer === 'function' ? { domRender: opts.domRenderer } : {}),
        });
        if (!domDiscovery || !domDiscovery.analysis) {
          const why =
            (domDiscovery && domDiscovery.errors && domDiscovery.errors[0]) || 'dom render failed';
          throw new Error(why);
        }
        const dom = domDiscovery.analysis;
        pageAnalysis.inputs.push(...(dom.inputs || []));
        pageAnalysis.textareas.push(...(dom.textareas || []));
        pageAnalysis.selects.push(...(dom.selects || []));
        pageAnalysis.buttons.push(...(dom.buttons || []));
        for (const p of dom.params || []) {
          if (!pageAnalysis.params.includes(p)) pageAnalysis.params.push(p);
        }
        // Route renders that failed are best-effort (the analysis
        // stands), but the failure is not silent: it lands in the
        // scan's errors, which the finished summary carries.
        for (const e of domDiscovery.errors || []) errors.push(e);
        // Crawl-shape forms for the form battery (csrf / post-forms /
        // race / ...): every named control on the form — inputs plus
        // textareas/selects, which the static extractor misses.
        domForms = (dom.forms || []).map((f) => ({
          action: f.action,
          method: f.method,
          inputs: [...(f.inputs || []), ...(f.textareas || []), ...(f.selects || [])]
            .map((x) => x.name)
            .filter(Boolean),
        }));
        return dom;
      },
      () =>
        domDiscovery && domDiscovery.analysis
          ? {
              findingsCount:
                (domDiscovery.analysis.inputs || []).length +
                (domDiscovery.analysis.forms || []).length,
              domRoutes: (domDiscovery.rendered || []).filter((r) => r.ok).length,
              domForms: (domDiscovery.analysis.forms || []).length,
            }
          : {}
    );
  } else {
    // GATED SKIP (7 Nov 2026): static analysis already found elements,
    // so no render was needed — but the phase must still leave a
    // record, or the rollup cannot tell "gate false" from "phase
    // missing" (the Juice js-routes proof expected 94 and got 92
    // because js-api-routes vanished entirely). Without a page
    // analysis at all there was nothing to trigger on.
    skipPhase('dom-render', pageAnalysis ? 'static elements found' : 'no page analysis');
  }

  // Scan targets: the target URL plus every discovered same-origin link
  // (capped). Param probes run per URL — this is what makes the battery
  // cover the whole site, not just the landing page.
  const maxUrls = opts.maxUrls || 10;
  const scanTargets = [];
  // Path-param descriptors per OpenAPI-derived target URL ({ name,
  // segment } lists from extractOpenApiTargets). The battery loop
  // reads this map to build probe points; a URL absent here simply
  // has no path params.
  const pathParamsByUrl = new Map();
  const seen = new Set();
  const pushTarget = (u) => {
    try {
      const norm = new URL(u).toString().split('#')[0];
      if (!seen.has(norm) && scanTargets.length < maxUrls) {
        seen.add(norm);
        scanTargets.push(norm);
      }
    } catch {
      // ignore malformed URLs
    }
  };
  pushTarget(url);
  for (const l of crawled ? crawled.links : []) pushTarget(l);
  const forms = [...(crawled ? crawled.forms : []), ...domForms];
  // Form-derived GET URLs get a separate allowance beyond maxUrls — they
  // carry known inputs and are the highest-value probe targets.
  const pushFormTarget = (u) => {
    try {
      const norm = new URL(u).toString().split('#')[0];
      if (!seen.has(norm) && scanTargets.length < maxUrls + 20) {
        seen.add(norm);
        scanTargets.push(norm);
      }
    } catch {
      // ignore malformed URLs
    }
  };

  // Forms also live on discovered pages, not just the landing page —
  // fetch every scan target (already capped by maxUrls) and merge forms.
  for (const u of scanTargets) {
    try {
      const p = await fetchPage(u, opts);
      for (const f of extractForms(p.body, p.url)) forms.push(f);
    } catch {
      // ignore per-page fetch failures
    }
  }

  // Forms are merged from the landing page AND from re-fetching every scan
  // target — the same form can appear twice (the landing page's own form is
  // re-found on its re-fetch). Synthesizing a target per copy would probe
  // the identical form twice with different random fillers. Dedupe by
  // method+action+inputs first; distinct forms (same action, different
  // inputs) still get their own target.
  const uniqueForms = [...new Map(
    forms.map((f) => [
      `${String(f.method || 'get').toLowerCase()}|${f.action}|${(f.inputs || []).join(',')}`,
      f,
    ])
  ).values()];
  // GET forms become URL targets so the param battery covers them.
  // SAFETY: fill each input with a UNIQUE value (never empty, never equal).
  // A state-changing GET form (e.g. DVWA's csrf password-change) triggers
  // when its submit param is set AND its inputs "match" — empty==empty or
  // identical fillers would fire it. Unique values keep every probe
  // read-only while still satisfying isset(submit) gates.
  const toFormUrl = (form) => {
    try {
      const u = new URL(form.action);
      let n = 0;
      for (const inp of form.inputs || []) {
        if (/^submit$/i.test(inp)) {
          if (!u.searchParams.has(inp)) u.searchParams.set(inp, '1');
        } else if (!u.searchParams.has(inp)) {
          u.searchParams.set(inp, `dmprobe${++n}_${randomBytes(2).toString('hex')}`);
        }
      }
      return u.toString();
    } catch {
      return null;
    }
  };
  for (const f of uniqueForms) {
    if (String(f.method || 'get').toLowerCase() === 'get') {
      const fu = toFormUrl(f);
      if (fu) pushFormTarget(fu);
    }
  }
  // POST forms become GET probe targets too (5 Nov 2026, 35/63 fix): the
  // DVWA root paste's only form is a POST login form, so without this the
  // param battery has zero targets and all 28 injection phases are skipped
  // in silence. We NEVER submit the POST for the battery — we only GET the
  // action URL with the same UNIQUE filler values the GET-form rule uses
  // (never empty, never equal), so probing stays read-only: a failed login
  // with random credentials changes nothing, and a state-changing gate that
  // requires matching values can never fire on unique fillers.
  for (const f of uniqueForms) {
    if (String(f.method || 'get').toLowerCase() === 'post') {
      const fu = toFormUrl(f);
      if (fu) pushFormTarget(fu);
    }
  }
  // Standalone inputs (outside any <form>) never reach the form battery —
  // synthesize a GET target per input with a UNIQUE filler value (same
  // safety rule: never empty, never equal — keeps every probe read-only).
  // This is what makes the one-page-deep model exhaustive: every input box
  // on the pasted page gets the full param battery, in a form or not.
  if (pageAnalysis) {
    for (const inp of pageAnalysis.inputs) {
      if (inp.form || !inp.name) continue;
      try {
        // DOM-discovered standalone inputs live on a route, not the
        // pasted page — synthesise against the route URL (inp.page);
        // static inputs carry no page and use the pasted URL as before.
        const u = new URL(inp.page || url);
        u.searchParams.set(inp.name, `dmprobe_${randomBytes(2).toString('hex')}`);
        pushFormTarget(u.toString());
      } catch {
        // ignore malformed URLs
      }
    }
  }
  const postForms = forms.filter(
    (f) => String(f.method || 'get').toLowerCase() === 'post'
  );

  // OPENAPI TARGETS (6 Nov 2026, VAmPI): a pure API returns JSON only —
  // no HTML form can ever exist there, so static analysis AND the DOM
  // render both find zero param-bearing targets and the 28-phase
  // battery skips in silence. When (and only when) the target builder
  // above produced zero param-bearing targets, fetch the target's
  // OpenAPI spec and synthesise GET targets from its GET operations'
  // query + path params (see openapi.js). The synthesised targets flow
  // into the EXISTING battery loop below unchanged — the battery only
  // GETs them, exactly as for form targets. An absent spec (or one
  // with no probeable GET params) is an honest no-op: the step records
  // ok:true with 0 targets and the battery's skipped records below
  // still describe the gap. Where off-page static/DOM targets already
  // exist (DVWA, WebGoat) the step never fires and a skipped record is
  // emitted instead (7 Nov 2026, gated-skip fix), so their rollups gain
  // 1 skipped record and nothing else changes. A landing-page-only param
  // target does NOT satisfy the gate (7 Nov 2026, error-disclosure
  // coverage fix — see hasOffPageParamTarget): Juice Shop's /?email=...
  // used to skip this step and hide /rest/* from the whole scan.
  // opts.openApiFetcher is the test seam: (url, opts) => fetchPage-shaped { url, status, headers, body }
  // replacing fetchPage; production callers never pass it.
  let openApiDiscovery = null;
  const needsOpenApi = !hasOffPageParamTarget(scanTargets, url);
  if (needsOpenApi) {
    await step(
      'openapi-targets',
      async () => {
        openApiDiscovery = await discoverOpenApiTargets(url, {
          ...opts,
          ...(typeof opts.openApiFetcher === 'function' ? { fetchPage: opts.openApiFetcher } : {}),
        });
        if (!openApiDiscovery || !openApiDiscovery.targets || openApiDiscovery.targets.length === 0) {
          return openApiDiscovery;
        }
        for (const t of openApiDiscovery.targets) pushFormTarget(t);
        if (openApiDiscovery.pathParams) {
          for (const [targetUrl, descriptors] of Object.entries(openApiDiscovery.pathParams)) {
            pathParamsByUrl.set(targetUrl, descriptors);
          }
        }
        return openApiDiscovery;
      },
      () =>
        openApiDiscovery
          ? {
              findingsCount: (openApiDiscovery.targets || []).length,
              openApiTargets: (openApiDiscovery.targets || []).length,
              openApiSpec: openApiDiscovery.specUrl || null,
            }
          : {}
    );
  } else {
    // GATED SKIP (7 Nov 2026): param-bearing targets already exist,
    // so no spec was fetched — record the skip, or the rollup cannot
    // tell "gate false" from "phase missing" (see dom-render above).
    skipPhase('openapi-targets', 'param targets already exist');
  }

  // JS-API ROUTES (7 Nov 2026, Juice Shop): the spec survey proved
  // Juice publishes NO standalone OpenAPI spec, so openapi-targets
  // can never unlock the battery there — but the SPA's served JS
  // bundle contains every /rest/* + /api/* route the frontend calls
  // (50 distinct literals + 27 service bases in main.js, live).
  // When (and only when) the target builder AND openapi-targets both
  // produced zero OFF-PAGE param-bearing targets (see
  // hasOffPageParamTarget — a landing-page-only param does not count),
  // mine the page's same-origin <script> bundles for GET-usable routes
  // (see jsRoutes.js) and synthesise GET targets from them. The gate is
  // re-checked fresh here: if openapi-targets already unlocked the battery, this step
  // never fires — a skipped record is emitted instead (7 Nov 2026,
  // gated-skip fix), so VAmPI/DVWA/WebGoat rollups gain 1 skipped
  // record and nothing else changes.
  // opts.jsRoutesFetcher is the test seam, mirroring openApiFetcher.
  let jsRoutesDiscovery = null;
  if (!hasOffPageParamTarget(scanTargets, url)) {
    await step(
      'js-api-routes',
      async () => {
        jsRoutesDiscovery = await discoverJsRoutes(url, {
          ...opts,
          ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
        });
        if (!jsRoutesDiscovery || !jsRoutesDiscovery.targets || jsRoutesDiscovery.targets.length === 0) {
          return jsRoutesDiscovery;
        }
        for (const t of jsRoutesDiscovery.targets) pushFormTarget(t);
        if (jsRoutesDiscovery.pathParams) {
          for (const [targetUrl, descriptors] of Object.entries(jsRoutesDiscovery.pathParams)) {
            pathParamsByUrl.set(targetUrl, descriptors);
          }
        }
        return jsRoutesDiscovery;
      },
      () =>
        jsRoutesDiscovery
          ? {
              findingsCount: (jsRoutesDiscovery.targets || []).length,
              jsRoutesFound: (jsRoutesDiscovery.targets || []).length,
              jsRouteTargets: (jsRoutesDiscovery.targets || []).length,
              jsBundles: jsRoutesDiscovery.bundlesFetched || 0,
            }
          : {}
    );
  } else {
    // GATED SKIP (7 Nov 2026): param-bearing targets already exist,
    // so no bundle was mined — record the skip (see dom-render
    // above). This is the exact gap the Juice proof exposed: the
    // parent brief expected 94 with js-api-routes present as
    // skipped, and the run read 92 with no record at all.
    skipPhase('js-api-routes', 'param targets already exist');
  }

  await step('headers', () => (fp ? probeHeaders({ url, headers: fp.headers }) : []));
  // 35/63 FIX: track whether the param battery ran at all. If no scan
  // target carried a single parameter, the loop body below never executes
  // and the 28 phases inside it would vanish in silence — record each of
  // them as skipped instead (after the loop).
  let paramBatteryRan = false;
  for (const u of scanTargets) {
    // Probe points: path segments first, then query params
    // (extractProbePoints) — the battery mutates segments with the
    // same payloads and the same differential discipline as query
    // values (path-segment lane, 6 Nov 2026).
    const points = extractProbePoints(u, pathParamsByUrl.get(u));
    if (points.length === 0) continue;
    paramBatteryRan = true;
    await step('sqli-error', () => probeSqliError(u, points, opts));
    await step('sqli-blind', () =>
      probeBlindSqli(u, points, { ...opts, dbHint: fp?.dbHint })
    );
    await step('hpp', () => probeHpp(u, points, opts));
    await step('csv-log-injection', () => probeCsvLog(u, points, opts));
    await step('xss', () => probeXssReflected(u, points, opts));
    await step('nosqli', () => probeNoSqli(u, points, opts));
    await step('nosql-deep', () => probeNoSqlDeep(u, points, opts));
    await step('ldapi', () => probeLdapInjection(u, points, opts));
    await step('ldap-blind', () => probeLdapBlind(u, points, opts));
    await step('xpathi', () => probeXpathInjection(u, points, opts));
    await step('ssi', () => probeSsiInjection(u, points, opts));
    await step('cmdi', () => probeCmdiTime(u, points, opts));
    await step('traversal', () => probeTraversal(u, points, opts));
    await step('rfi', () => probeRfi(u, points, opts));
    await step('xslt', () => probeXslt(u, points, opts));
    await step('eval-injection', () => probeEvalInject(u, points, opts));
    await step('jsonp', () => probeJsonp(u, points, opts));
    await step('rpo', () => probeRpo(u, points, opts));
    await step('tabnabbing', () => probeTabnabbing(u, opts));
    await step('dangling-markup', () => probeDanglingMarkup(u, points, opts));
    await step('padding-oracle', () => probePaddingOracle(u, opts));
    await step('arg-injection', () => probeArgInjection(u, points, opts));
    await step('ssti', () => probeSsti(u, points, opts));
    await step('el-injection', () => probeElInject(u, points, opts));
    await step('ognl-injection', () => probeOgnlInject(u, points, opts));
    await step('redirect', () => probeOpenRedirect(u, points, opts));
    await step('crlf', () => probeCrlf(u, points, opts));
    await step('ssrf', () => probeSsrf(u, points, opts));
  }
  // 35/63 FIX: no param-bearing target existed, so the whole injection
  // battery was skipped in silence. Emit one skipped record per phase so
  // the audit trail (and the rollup) shows the gap instead of a clean pass.
  if (!paramBatteryRan) {
    for (const name of PARAM_BATTERY_PHASES) skipPhase(name, 'no param targets');
  }
  // VERB TAMPERING (7 Nov 2026, rows #167 + #35): replay each GET probe
  // target with PUT/DELETE/PATCH/HEAD (empty bodies). The targets are
  // the scan URLs that carry probe points — a URL with no points is not
  // a GET probe target and is never tested. One phase record per scan
  // (not per URL): the probe iterates the deduped target list itself
  // and returns all findings. When no scan target carries a probe
  // point, the phase records a skip instead of vanishing (gated-skip
  // pattern, same as dom-render/openapi-targets/js-api-routes).
  // allowWrite is the lab gate (the same value file-upload gets):
  // write verbs never leave toward a non-lab host; HEAD runs anywhere.
  const verbTargets = [];
  const verbSeen = new Set();
  for (const u of scanTargets) {
    if (extractProbePoints(u, pathParamsByUrl.get(u)).length === 0) continue;
    try {
      const norm = new URL(u).toString().split('#')[0];
      if (!verbSeen.has(norm)) {
        verbSeen.add(norm);
        verbTargets.push(norm);
      }
    } catch {
      // ignore malformed URLs
    }
  }
  if (verbTargets.length > 0) {
    await step('verb-tampering', () => probeVerbTampering(verbTargets, { ...opts, allowWrite }));
  } else {
    skipPhase('verb-tampering', 'no probe targets');
  }
  // METHOD OVERRIDE + CONTENT-TYPE CONFUSION (7 Nov 2026, rows #387
  // + #388): same GET probe targets as verb-tampering (reused —
  // the override needs the direct-verb reference, which the probe
  // fetches itself), plus the scan's POST forms for the JSON-vs-form
  // vector. One phase record per scan. When no scan target carries
  // a probe point AND no POST form exists, the phase records a skip
  // instead of vanishing (gated-skip pattern). allowWrite is the lab
  // gate: without it the probe sends nothing at all.
  if (verbTargets.length > 0 || postForms.length > 0) {
    await step('method-override', () =>
      probeMethodOverride(verbTargets, postForms, { ...opts, allowWrite })
    );
  } else {
    skipPhase('method-override', 'no probe targets');
  }
  // SECRETS IN CLIENT-SIDE JS (7 Nov 2026, row #179): scan the
  // page's same-origin script bundles + inline <script> blocks for
  // high-confidence secret formats (known-format keys/tokens, JWTs,
  // PEM blocks, DB URIs, high-entropy assignments). Read-only GETs
  // of the page's own bundles — no allowWrite gate. The targets come
  // from the page body page-analyze already fetched, so a script-less
  // page records a skip instead of fetching (gated-skip pattern).
  // opts.jsRoutesFetcher is the test seam, mirroring js-api-routes.
  const secretTargets =
    pageBody && typeof pageBody === 'string'
      ? extractSecretTargets(pageBody, url)
      : { bundles: [], inline: [] };
  if (secretTargets.bundles.length > 0 || secretTargets.inline.length > 0) {
    await step('secrets-in-js', () =>
      probeSecretsInJs(url, secretTargets, {
        ...opts,
        ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
      })
    );
  } else {
    skipPhase('secrets-in-js', 'no script targets');
  }
  // ERROR DISCLOSURE (7 Nov 2026, rows #175 + #176): trigger
  // errors with read-only GETs on the same GET probe targets as
  // verb-tampering (non-existent paths + malformed query values)
  // and scan 4xx/5xx responses for filesystem paths (#175, Low)
  // and error details (#176, Medium) — a leak counts only when
  // the baseline GET of the same target does not carry it. No
  // writes, no allowWrite gate. One phase record per scan; when no
  // scan target carries a probe point the phase records a skip
  // instead of vanishing (gated-skip pattern).
  if (verbTargets.length > 0) {
    await step('error-disclosure', () => probeErrorDisclosure(verbTargets, opts));
  } else {
    skipPhase('error-disclosure', 'no probe targets');
  }
  // INPUT VALIDATION (7 Nov 2026, rows #436–#440): crafted values
  // on the same GET probe targets as verb-tampering (integer
  // overflow past 32/64-bit, array-vs-scalar type juggling,
  // null-byte truncation, fullwidth unicode) plus the scan's forms
  // for the hidden-field vector. A finding counts only on the
  // probe's own differential (acceptance + garbage control, wrapped
  // echo, or tampered-value substitution — see validation.js).
  // GET vectors are read-only; POST-form submits run only behind
  // the allowWrite lab gate. One phase record per scan; when no
  // scan target carries a probe point and no form exists the phase
  // records a skip instead of vanishing (gated-skip pattern).
  if (verbTargets.length > 0 || forms.length > 0) {
    await step('validation', () =>
      probeValidation(verbTargets, forms, {
        ...opts,
        allowWrite,
        pathParamsByUrl,
        pageUrl: url,
      })
    );
  } else {
    skipPhase('validation', 'no probe targets');
  }
  // FINGERPRINT / BANNER DISCLOSURE (7 Nov 2026, row #183): the
  // pasted page's own response headers plus a 404 trigger per
  // directory are scanned for server/framework version disclosure
  // (Server, X-Powered-By, X-AspNet-Version, ...). A finding
  // counts only when a version number is actually disclosed —
  // bare header presence is not a leak — and error-page body
  // matches count only when the baseline page does not carry the
  // same string. Read-only GETs, no allowWrite gate. One phase
  // record per scan; the pasted page is always a surface, so this
  // phase never skips (unlike the gated probes above).
  await step('fingerprint-banner', () => probeFingerprintBanner(url, verbTargets, opts));
  await step('csrf', () => probeCsrf(forms, url));
  await step('post-forms', () => probePostForms(postForms, opts));
  await step('smtp-injection', () => probeSmtpInject(forms, url, opts));
  await step('session-fixation', () => probeSessionFixation(forms, url, opts));
  await step('user-enumeration', () => probeUserEnum(forms, url, opts));
  await step('mass-assignment', () => probeMassAssignment(forms, url, opts));
  await step('ws-messages', () => probeWsMessages(url, opts));
  await step('subdomain-takeover', () => probeSubdomainTakeover(url, opts));
  await step('race', () =>
    probeRace(
      forms,
      url,
      [...new Set(forms.flatMap((f) => (f.inputs || []).map((i) => i.name).filter(Boolean)))],
      opts
    )
  );
  await step('files', () => probeSensitiveFiles(url, opts));
  // XXE OOB collaborator (6 Nov 2026): the xxe probe's blind-XXE variant
  // needs a callback base AND a waiter — same pattern as the saml block
  // below, one collaborator per OOB phase so each listener lives only for
  // its own phase and the proven saml wiring stays untouched. Only when
  // the target is lab-gated (allowWrite, the same host check as the
  // file-upload gate). Start is best-effort: a bind failure is recorded
  // in errors and the scan continues with the OOB variant skipped, exactly
  // as before this lane. The collaborator is always stopped afterwards
  // (finally), so no listener outlives the scan. Callback-host default is
  // the docker bridge gateway (172.17.0.1) — the IP lab containers use to
  // reach the host; override with opts.oobCallbackHost / DM_OOB_CALLBACK_HOST.
  let xxeOob = null;
  if (phases.includes('xxe') && allowWrite) {
    try {
      xxeOob = createOobCollaborator({
        listenHost: opts.oobListenHost || process.env.DM_OOB_LISTEN_HOST || '0.0.0.0',
        listenPort: opts.oobListenPort || (process.env.DM_OOB_PORT ? Number(process.env.DM_OOB_PORT) : 0),
        callbackHost: opts.oobCallbackHost || process.env.DM_OOB_CALLBACK_HOST || '172.17.0.1',
      });
      await xxeOob.start();
    } catch (e) {
      errors.push(`oob-collaborator: ${e && e.message ? e.message : String(e)}`);
      xxeOob = null;
    }
  }
  try {
    await step('xxe', () =>
      probeXxe(url, {
        ...opts,
        labTargets,
        ...(xxeOob
          ? { oobCallback: xxeOob.baseUrl(), oobWaitFor: (token, ms) => xxeOob.waitFor(token, ms) }
          : {}),
      })
    );
  } finally {
    if (xxeOob) {
      try { await xxeOob.stop(); } catch { /* stop is best-effort */ }
    }
  }
  await step('idor', () => probeIdorSurface(url));
  await step('cors', () => probeCors(url, opts));
  await step('cookies', () => probeCookieFlags(url, opts));
  await step('stored-xss', () => probeStoredXss(forms, url, opts));
  await step('weak-creds', () => probeWeakCreds(forms, opts));
  await step('host-header', () => probeHostHeader(url, opts));
  await step('file-upload', () => probeFileUpload(url, { ...opts, allowWrite }));
  await step('cache-poisoning', () => probeCachePoisoning(url, opts));
  await step('request-smuggling', () => probeRequestSmuggling(url, opts));
  await step('jwt', () => probeJwt(url, opts));
  await step('graphql', () => probeGraphql(url, opts));
  await step('cswsh', () => probeCswsh(url, opts));
  await step('oauth', () => probeOauth(url, opts));
  // SAML-XXE OOB collaborator (6 Nov 2026): the SAML probe's blind-XXE
  // variant needs a callback base AND a waiter. Both come from a
  // collaborator started here for the duration of the saml phase — only
  // when the target is lab-gated (allowWrite, the same host check as the
  // file-upload gate). Start is best-effort: a bind failure is recorded
  // in errors and the scan continues with the OOB variant skipped, exactly
  // as before this lane. The collaborator is always stopped afterwards
  // (finally), so no listener outlives the scan. Callback-host default is
  // the docker bridge gateway (172.17.0.1) — the IP lab containers use to
  // reach the host; override with opts.oobCallbackHost / DM_OOB_CALLBACK_HOST.
  let oob = null;
  if (phases.includes('saml') && allowWrite) {
    try {
      oob = createOobCollaborator({
        listenHost: opts.oobListenHost || process.env.DM_OOB_LISTEN_HOST || '0.0.0.0',
        listenPort: opts.oobListenPort || (process.env.DM_OOB_PORT ? Number(process.env.DM_OOB_PORT) : 0),
        callbackHost: opts.oobCallbackHost || process.env.DM_OOB_CALLBACK_HOST || '172.17.0.1',
      });
      await oob.start();
    } catch (e) {
      errors.push(`oob-collaborator: ${e && e.message ? e.message : String(e)}`);
      oob = null;
    }
  }
  try {
    await step('saml', () =>
      probeSaml(url, {
        ...opts,
        labTargets,
        ...(oob
          ? { oobCallback: oob.baseUrl(), oobWaitFor: (token, ms) => oob.waitFor(token, ms) }
          : {}),
      })
    );
  } finally {
    if (oob) {
      try { await oob.stop(); } catch { /* stop is best-effort */ }
    }
  }
  await step('tls', () => probeTls(url, opts));
  await step('password-reset', () => probePasswordReset(forms, url, opts));
  await step('crypto', () => probeCrypto(url, opts));
  await step('prototype-pollution', () => probePrototypePollution(url, opts));
  await step('deserialization', () => probeDeserialization(url, opts));
  // Nuclei step: captures the FULL runNuclei result. The old code kept
  // only `.findings` — a timeout/failure vanished with no trace. The phase
  // record now carries the tool's ok/timedOut plus a capped stderr tail
  // (via nucleiPhaseFields); findings still flow into the scan results
  // exactly as before.
  // opts.nucleiRunner is a test seam (defaults to the real runNuclei):
  // unit tests must never spawn docker/nuclei. Production callers never
  // pass it, so the production path is unchanged.
  let nucleiResult = null;
  const nucleiRunner = typeof opts.nucleiRunner === 'function' ? opts.nucleiRunner : runNuclei;
  await step(
    'nuclei',
    async () => {
      nucleiResult = await nucleiRunner(url, opts);
      return nucleiResult.findings;
    },
    () => (nucleiResult ? nucleiPhaseFields(nucleiResult) : {})
  );

  const { confirmed, unconfirmed } = verifyFindings(all);
  return {
    target: url,
    host,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - new Date(startedAt).getTime(),
    fingerprint: fp
      ? { status: fp.status, server: fp.server, tech: fp.tech, dbHint: fp.dbHint }
      : null,
    pagesCrawled: crawled ? crawled.links.length : 0,
    pageAnalysis: pageAnalysis
      ? {
          inputs: pageAnalysis.inputs.length,
          forms: pageAnalysis.forms.length,
          standaloneInputs: pageAnalysis.inputs.filter((i) => !i.form).length,
          planEntries: planForPage(pageAnalysis).length,
        }
      : null,
    findings: confirmed,
    unconfirmed,
    errors,
    phases: phaseRecords,
  };
}
