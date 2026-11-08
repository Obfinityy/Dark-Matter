// Dark Matter rule-based scanner — deterministic orchestrator.
// paste link → scope check → recon/fingerprint → ONE-PAGE-DEEP element
// analysis → probe battery → Nuclei → differential verification →
// confirmed findings.
// No LLM, no API keys, no prompts. Same target + same code = same result.
import { authorizeTarget } from './target.js';
import { isLabTargetHost } from '../labCreds.js';
import { randomBytes } from 'node:crypto';
import { fingerprint, fetchPage } from './fingerprint.js';
import { crawl, extractParams, extractForms } from './crawl.js';
import { extractProbePoints } from './probePoints.js';
import { analyzePage, planForPage } from './pageAnalyze.js';
import { probeHeaders } from './probes/headers.js';
import { probeSqliError } from './probes/sqliError.js';
import { probeBlindSqli } from './probes/sqliBlind.js';
import { probeSqliOob } from './probes/sqliOob.js';
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
import { probeBasketLogic } from './probes/basketLogic.js';
import { probeWorkflowSkip } from './probes/workflowSkip.js';
import { probeTwoFaBruteForce } from './probes/twoFaBruteForce.js';
import { probeCredentialStuffing } from './probes/credentialStuffing.js';
import { probeDomPostMessage } from './probes/domPostMessage.js';
import { probeCsti } from './probes/csti.js';
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
import { createSmtpCanaryInbox } from './smtpCanaryInbox.js';
import { discoverDomForms } from './domRender.js';
import { acquireLabSession } from './labSession.js';
import { renderDomAuthenticated, mergeAuthAnalysis } from './authDomRender.js';
import { discoverOpenApiTargets } from './openapi.js';
import { discoverJsRoutes } from './jsRoutes.js';
import { probeTls } from './probes/tlsScan.js';
import { probePasswordReset } from './probes/passwordReset.js';
import { probeElInject } from './probes/elInject.js';
import { probeOgnlInject } from './probes/ognlInject.js';
import { probeVerbTampering } from './probes/verbTampering.js';
import { probeMethodOverride } from './probes/methodOverride.js';
import { probeSecretsInJs, extractSecretTargets } from './probes/secretsInJs.js';
import { probeBrowserStorage } from './probes/browserStorage.js';
import { probeDomXssSinks } from './probes/domXssSinks.js';
import { probeDomXssLocationHash } from './probes/domXssLocationHash.js';
import { probeErrorDisclosure } from './probes/errorDisclosure.js';
import { probeValidation } from './probes/validation.js';
import { probeFingerprintBanner } from './probes/fingerprintBanner.js';
import { probeSourceCodeDisclosure } from './probes/sourceCodeDisclosure.js';
import { probeMetadataLeakage } from './probes/metadataLeakage.js';
import { probeSensitiveDataInLogs } from './probes/sensitiveDataInLogs.js';
import { probeSensitiveInfoDisclosure } from './probes/sensitiveInfoDisclosure.js';
import { probeTimingSideChannel } from './probes/timingSideChannel.js';
import { probeXmlInjection } from './probes/xmlInjection.js';
import { probeUntrustedJsInclusion } from './probes/untrustedJsInclusion.js';
import { probeApiVersioning } from './probes/apiVersioning.js';
import { probeSessionTokenInUrl } from './probes/sessionTokenInUrl.js';
import { probeCredentialDisclosure } from './probes/credentialDisclosure.js';
import { probeSensitiveCache } from './probes/sensitiveCache.js';
import { probeMissingAuth } from './probes/missingAuth.js';
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
  'sqli-oob',
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
  'missing-auth',
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
  'basket-logic',
  'workflow-skip',
  'twofa-bruteforce',
  'credential-stuffing',
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
  'source-code-disclosure',
  'metadata-leakage',
  'sensitive-data-in-logs',
  'sensitive-info-disclosure',
  'timing-side-channel',
  'xml-injection',
  'untrusted-js-inclusion',
  'api-versioning',
  'session-token-in-url',
  'credential-disclosure',
  'sensitive-cache',
  'browser-storage',
  'dom-xss-sinks',
  'dom-xss-location-hash',
  'dom-postmessage',
  'csti',
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
  'xml-injection',
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
  const allowWrite = isLabTargetHost(url, labTargets);
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
  let authSession = null;
  let authDiscovery = null;
  let authAdded = null;
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
        // Inputs stay { name, type, value } objects (D1, #474 repair):
        // the old .map(x => x.name) flattened them to bare strings,
        // which broke every consumer testing i.type === 'password'.
        const toCrawlForm = (f) => ({
          action: f.action,
          method: f.method,
          inputs: [...(f.inputs || []), ...(f.textareas || []), ...(f.selects || [])]
            .filter((x) => x && x.name),
        });
        domForms = (dom.forms || []).map(toCrawlForm);

        // AUTHENTICATED DOM RENDER (8 Nov 2026, CDP lane): the
        // unauthenticated pass above renders the logged-OUT shell, so
        // DOM probes never see post-login state on a lab SPA (Juice
        // Shop: account/basket views and their named inputs exist
        // only after login). When the hunt carries lab canary
        // credentials for a lab target, log in and re-render the
        // page + routes with the session, then merge what login
        // reveals (deduplicated) into the same analysis. SECOND
        // PASS, never a replacement: without a session the
        // unauthenticated analysis stands and the scan continues —
        // a failed login or a dead browser is a skipped auth pass,
        // never a failed phase.
        if (opts.labCreds && opts.labCreds.username && isLabTargetHost(url, labTargets)) {
          const acquirer = typeof opts.labSessionAcquirer === 'function' ? opts.labSessionAcquirer : acquireLabSession;
          let session = null;
          try {
            session = await acquirer({
              url,
              routes: [...(domDiscovery.rendered || []).map((r) => r.url), ...(crawled ? crawled.links : [])],
              forms: [...(dom.forms || []), ...(crawled ? crawled.forms : [])],
              pageBody,
              creds: opts.labCreds,
              labTargets,
              fetchPage: typeof opts.jsRoutesFetcher === 'function' ? opts.jsRoutesFetcher : fetchPage,
            });
          } catch (e) {
            session = { ok: false, reason: String((e && e.message) || e).slice(0, 120) };
          }
          authSession = session;
          if (session && session.ok) {
            const authRenderer =
              typeof opts.authDomRender === 'function'
                ? opts.authDomRender
                : (u) => renderDomAuthenticated(u, session.session, opts);
            let authDisc = null;
            try {
              authDisc = await discoverDomForms(url, { ...opts, domRender: authRenderer });
            } catch (e) {
              authDisc = { analysis: null, errors: [String((e && e.message) || e).slice(0, 200)], rendered: [] };
            }
            authDiscovery = authDisc;
            if (authDisc && authDisc.analysis) {
              authAdded = mergeAuthAnalysis(dom, authDisc.analysis);
              pageAnalysis.inputs.push(...authAdded.inputs);
              pageAnalysis.textareas.push(...authAdded.textareas);
              pageAnalysis.selects.push(...authAdded.selects);
              pageAnalysis.buttons.push(...authAdded.buttons);
              for (const p of dom.params || []) {
                if (!pageAnalysis.params.includes(p)) pageAnalysis.params.push(p);
              }
              domForms = [...domForms, ...authAdded.forms.map(toCrawlForm)];
              for (const e of authDisc.errors || []) errors.push(e);
            } else {
              for (const e of (authDisc && authDisc.errors) || []) errors.push(e);
            }
          }
        }
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
              authDom: Boolean(authDiscovery && authDiscovery.analysis),
              authSession:
                authSession && authSession.ok
                  ? authSession.session && authSession.session.token
                    ? authSession.session.cookies && authSession.session.cookies.length
                      ? 'token+cookies'
                      : 'token'
                    : 'cookies'
                  : null,
              authInputs: authAdded ? authAdded.inputs.length : 0,
              authForms: authAdded ? authAdded.forms.length : 0,
              authError: authSession && !authSession.ok ? authSession.reason || 'login-failed' : null,
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
  // Provenance per scan target (7 Nov 2026, #41 FP fix): which URLs
  // the TARGET itself emitted vs which the scanner synthesized. The
  // credential-disclosure URL half fires ONLY on target-emitted URLs —
  // a synthesized URL can only ever carry scanner filler values, never
  // a real disclosed credential (DVWA proof h_d3c0deb50847: a POST
  // login form's GET conversion carried dmprobe* fillers and fired as
  // the 18th finding). Sources: 'link' (pasted page + crawled links),
  // 'get-form' (GET form actions), 'post-form' (POST form GET
  // conversions), 'standalone' (standalone-input targets), 'openapi',
  // 'js-routes'. Only the credential-disclosure and session-token-in-url
  // steps read this map; every other probe still receives the plain
  // string array.
  const scanTargetProvenance = new Map();
  const seen = new Set();
  const pushTarget = (u) => {
    try {
      const norm = new URL(u).toString().split('#')[0];
      if (!seen.has(norm) && scanTargets.length < maxUrls) {
        seen.add(norm);
        scanTargets.push(norm);
        scanTargetProvenance.set(norm, 'link');
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
  const pushFormTarget = (u, source) => {
    try {
      const norm = new URL(u).toString().split('#')[0];
      if (!seen.has(norm) && scanTargets.length < maxUrls + 20) {
        seen.add(norm);
        scanTargets.push(norm);
        scanTargetProvenance.set(norm, source || 'unknown');
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
      `${String(f.method || 'get').toLowerCase()}|${f.action}|${(f.inputs || []).map((i) => i.name).join(',')}`,
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
        const name = inp.name;
        if (!name) continue;
        if (/^submit$/i.test(name)) {
          if (!u.searchParams.has(name)) u.searchParams.set(name, '1');
        } else if (!u.searchParams.has(name)) {
          u.searchParams.set(name, `dmprobe${++n}_${randomBytes(2).toString('hex')}`);
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
      if (fu) pushFormTarget(fu, 'get-form');
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
      if (fu) pushFormTarget(fu, 'post-form');
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
        pushFormTarget(u.toString(), 'standalone');
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
        for (const t of openApiDiscovery.targets) pushFormTarget(t, 'openapi');
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
  // POST-only mined routes (D3, #474 repair, 8 Nov 2026): write
  // endpoints the miner recovers for API-login candidates (T4b).
  // NEVER added to scanTargets — the GET-only mining contract
  // stands; they feed only the session-fixation step's apiRoutes.
  let jsWriteTargets = [];
  if (!hasOffPageParamTarget(scanTargets, url)) {
    await step(
      'js-api-routes',
      async () => {
        jsRoutesDiscovery = await discoverJsRoutes(url, {
          ...opts,
          ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
        });
        if (!jsRoutesDiscovery || !jsRoutesDiscovery.targets || jsRoutesDiscovery.targets.length === 0) {
          jsWriteTargets = (jsRoutesDiscovery && jsRoutesDiscovery.writeTargets) || [];
          return jsRoutesDiscovery;
        }
        for (const t of jsRoutesDiscovery.targets) pushFormTarget(t, 'js-routes');
        jsWriteTargets = jsRoutesDiscovery.writeTargets || [];
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
              jsWriteTargets: (jsRoutesDiscovery.writeTargets || []).length,
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
  // UNTRUSTED JS INCLUSION (7 Nov 2026, row #98): the page loads
  // executable JavaScript from a cross-origin host that is neither
  // same-origin nor a trusted CDN, with no SRI hash pinning the code.
  // Reuses the HTML the fingerprint step already fetched (fp.body) —
  // zero extra requests, never fetches the script itself (see
  // untrustedJsInclusion.js). Never re-fires the generic missing-SRI
  // finding (headers phase owns that).
  await step('untrusted-js-inclusion', () => (fp ? probeUntrustedJsInclusion({ url, html: fp.body }) : []));
  // API VERSIONING (7 Nov 2026, row #343): an API version still live
  // after it was superseded or explicitly deprecated (Deprecation /
  // Sunset header, or two+ versions of one base responding) — old
  // versions keep serving data without security fixes (OWASP
  // API08:2023). Seeds its bases from the scan's target URLs
  // (jsRoutes/openapi-mined /api and /rest paths); a single live
  // version never fires, /api vs /rest are different surfaces, and
  // a 410 is correctly retired (see apiVersioning.js).
  await step('api-versioning', () => probeApiVersioning(url, scanTargets, opts));
  // SESSION TOKEN IN URL (7 Nov 2026, rows #265/#321): a session
  // identifier placed in a URL (CWE-598) leaks via Referer, logs,
  // history, and shared links (CWE-359). Inspects the scan's URLs
  // for session params carrying token-like values (entropy gate);
  // the landing page's own HTML (fp.body) decides the #321 leak
  // path — a token URL on a page loading cross-origin subresources
  // (or linking out) leaks the token in the Referer header. Zero
  // extra requests: pure URL inspection (see sessionTokenInUrl.js).
  // Targets reach the probe as { url, source } provenance objects
  // (7 Nov 2026 latent fix, mirrors the #41 credential FP fix):
  // the probe fires ONLY on target-emitted URLs — a POST form whose
  // action URL itself carries a token-like session value (Java EE
  // `;jsessionid=` rewriting) would otherwise fire on that
  // synthesized target.
  await step('session-token-in-url', () =>
    probeSessionTokenInUrl(
      url,
      scanTargets.map((u) => ({ url: u, source: scanTargetProvenance.get(u) || 'unknown' })),
      { ...opts, html: fp ? fp.body : '' }
    )
  );
  // CREDENTIAL DISCLOSURE IN URL / LOGS (7 Nov 2026, row #41): a
  // credential value disclosed where it can be harvested — a
  // password / secret / API key in a scan URL (CWE-359), or echoed
  // in the landing page's visible text outside form inputs. Inspects
  // the scan's URLs for credential params (password params fire on
  // any non-empty value; secret/key params need a token-like value)
  // and the landing page HTML (fp.body) for echoed credential
  // assignments. Zero extra requests: pure inspection (see
  // credentialDisclosure.js). Log-file landing pages are skipped
  // for the body half — those are #180's surface. Targets reach the
  // probe as { url, source } provenance objects (7 Nov 2026 FP fix):
  // the URL half fires ONLY on target-emitted URLs (links, GET form
  // actions) — a POST form's GET conversion or any other synthesized
  // target can only carry scanner filler values, never a real
  // credential (DVWA proof h_d3c0deb50847 fired on exactly that).
  await step('credential-disclosure', () =>
    probeCredentialDisclosure(
      url,
      scanTargets.map((u) => ({ url: u, source: scanTargetProvenance.get(u) || 'unknown' })),
      { ...opts, html: fp ? fp.body : '' }
    )
  );
  // SENSITIVE DATA CACHED BY BROWSER (7 Nov 2026, row #96): a sensitive
  // landing page served without `Cache-Control: no-store` stays in the
  // browser cache after logout / on a shared device (CWE-524, OWASP
  // WSTG Browser Cache Weaknesses). Inspects the fingerprint step's own
  // response (fp.headers + fp.body) — zero extra requests. GATE (strict,
  // decided on OWASP grounds before any proof run): ONLY the `no-store`
  // directive protects — `no-cache`/`must-revalidate`/`Pragma: no-cache`
  // permit storage with revalidation, and `Expires: 0` is not accepted
  // in v1. DVWA's login page carries exactly that weaker set (verified
  // live 7 Nov ~21:05 IST), so the DVWA proof leg is expected to be 1
  // real [Medium] finding, not a true negative (see sensitiveCache.js).
  await step('sensitive-cache', () =>
    probeSensitiveCache(url, fp ? fp.headers : {}, fp ? fp.body : '', opts)
  );
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
    await step('hpp', () => probeHpp(u, points, { ...opts, labTargets }));
    await step('csv-log-injection', () => probeCsvLog(u, points, opts));
    await step('xss', () => probeXssReflected(u, points, opts));
    await step('nosqli', () => probeNoSqli(u, points, opts));
    await step('nosql-deep', () => probeNoSqlDeep(u, points, opts));
    await step('ldapi', () => probeLdapInjection(u, points, opts));
    await step('ldap-blind', () => probeLdapBlind(u, points, opts));
    await step('xpathi', () => probeXpathInjection(u, points, opts));
    // XML INJECTION (7 Nov 2026, row #214): a parameter spliced
    // raw into an XML document lets the attacker break out of the
    // element it sits in (structure breakout with a unique marker
    // element) or break parsing outright (malformed XML → parser
    // error). A finding counts only on the benign differential —
    // marker element in an XML-context response, or a parser error
    // signature absent from the benign response (see
    // xmlInjection.js). No DOCTYPE/entity payloads (xxe owns
    // those), no entity-expansion bombs (DoS-class, excluded).
    await step('xml-injection', () => probeXmlInjection(u, points, opts));
    await step('ssi', () => probeSsiInjection(u, points, opts));
    await step('cmdi', () => probeCmdiTime(u, points, opts));
    await step('traversal', () => probeTraversal(u, points, opts));
    await step('rfi', () => probeRfi(u, points, { ...opts, labTargets }));
    await step('xslt', () => probeXslt(u, points, { ...opts, labTargets }));
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
  // SQLI OOB (7 Nov 2026, row #280, CWE-89): the blind-SQLi family
  // taken out-of-band — a payload that makes the DATABASE itself issue
  // an HTTP request to a canary URL the scanner controls. A collaborator
  // hit for the payload's token CONFIRMS the injection in-scan (see
  // sqliOob.js); no hit means no finding. One phase record per scan
  // (not per URL): the probe is expensive — each payload waits up to
  // 8s on the collaborator — so the step caps the whole phase at 2
  // probe points across all verb targets (~32s worst case). The step
  // always RUNS (the pasted page's params are the surface, like
  // credential-disclosure above): with no param targets it returns []
  // instead of skipping, so the bare-page rollup counts it as ok.
  // LAB-GATED (allowWrite, the same host check as file-upload): the
  // collaborator starts only for lab-gated scans, and the probe itself
  // re-checks opts.labTargets before sending anything — a non-lab
  // target never receives a callback URL. The collaborator is always
  // stopped afterwards (finally), so no listener outlives the scan.
  // Callback-host default is the docker bridge gateway (172.17.0.1) —
  // the IP lab containers use to reach the host; override with
  // opts.oobCallbackHost / DM_OOB_CALLBACK_HOST.
  let sqliOob = null;
  if (phases.includes('sqli-oob') && allowWrite) {
    try {
      sqliOob = createOobCollaborator({
        listenHost: opts.oobListenHost || process.env.DM_OOB_LISTEN_HOST || '0.0.0.0',
        listenPort: opts.oobListenPort || (process.env.DM_OOB_PORT ? Number(process.env.DM_OOB_PORT) : 0),
        callbackHost: opts.oobCallbackHost || process.env.DM_OOB_CALLBACK_HOST || '172.17.0.1',
      });
      await sqliOob.start();
    } catch (e) {
      errors.push(`oob-collaborator: ${e && e.message ? e.message : String(e)}`);
      sqliOob = null;
    }
  }
  try {
    await step('sqli-oob', async () => {
      const findings = [];
      const pairs = [];
      for (const u of verbTargets) {
        for (const p of extractProbePoints(u, pathParamsByUrl.get(u))) {
          pairs.push([u, p]);
          if (pairs.length >= 2) break;
        }
        if (pairs.length >= 2) break;
      }
      for (const [u, p] of pairs) {
        findings.push(
          ...(await probeSqliOob([p], u, {
            ...opts,
            dbHint: fp?.dbHint,
            labTargets,
            ...(sqliOob
              ? { oobCallback: sqliOob.baseUrl(), oobWaitFor: (token, ms) => sqliOob.waitFor(token, ms) }
              : {}),
          }))
        );
      }
      return findings;
    });
  } finally {
    if (sqliOob) {
      try { await sqliOob.stop(); } catch { /* stop is best-effort */ }
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
  // BROWSER STORAGE (7 Nov 2026, row #97): sensitive data written
  // to localStorage / sessionStorage in the page's own JS bundles or
  // inline scripts is readable by any script in the origin (ASVS V8,
  // OWASP HTML5 Security Cheat Sheet). GATE (strict, decided on
  // OWASP/ASVS grounds before any proof run): writes ONLY, static
  // literal key, allowlist-only sensitive name — reads never fire,
  // dynamic keys never fire, placeholder literal values never fire.
  // Reuses secretTargets (same gate as secrets-in-js, so a
  // script-less page records a skip instead of fetching). Juice
  // Shop's main.js stores its login JWT with
  // localStorage.setItem("token", …) (verified live 7 Nov ~22:10 IST),
  // so the Juice proof leg is expected to be 1 real [Medium] finding;
  // DVWA serves no storage writes, so its leg is expected to be a
  // true negative (see browserStorage.js).
  if (secretTargets.bundles.length > 0 || secretTargets.inline.length > 0) {
    await step('browser-storage', () =>
      probeBrowserStorage(url, secretTargets, {
        ...opts,
        ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
      })
    );
  } else {
    skipPhase('browser-storage', 'no script targets');
  }
  // DOM XSS SINKS (8 Nov 2026, row #115): the app's own first-party
  // JS renders data through a DOM sink — Angular's
  // bypassSecurityTrustHtml, innerHTML bindings/assignments,
  // document.write. GATE (strict, decided on OWASP DOM-XSS grounds
  // before any proof run): [Low] INFO fingerprint, one aggregated
  // finding per bundle; vendor/polyfill/runtime bundles excluded by
  // filename stem AND any bundle defining the sanitizer is skipped
  // whole (framework code — Juice vendor.js would otherwise fire on
  // Angular itself); call sites only, definitions never fire. Class
  // 'dom_sink' routes to the default verifier protocol on purpose (a
  // class containing 'xss' would land 'unconfirmed' under
  // xss_reflected — see domXssSinks.js). Reuses secretTargets (same
  // gate as secrets-in-js / browser-storage, so a script-less page
  // records a skip instead of fetching). Juice Shop's main.js carries
  // 9 bypass call sites + 22 innerHTML occurrences + 1 document.write
  // (verified live 8 Nov 2026), so the Juice proof leg is expected to
  // be 1 new [Low] finding; DVWA serves no JS bundles, so its leg is
  // expected to be a true negative (see domXssSinks.js). Row #190
  // (CSTI) is NOT claimed: these are DOM XSS sinks, not template
  // injection — no template expression is evaluated from user input.
  if (secretTargets.bundles.length > 0 || secretTargets.inline.length > 0) {
    await step('dom-xss-sinks', () =>
      probeDomXssSinks(url, secretTargets, {
        ...opts,
        ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
      })
    );
  } else {
    skipPhase('dom-xss-sinks', 'no script targets');
  }
  // DOM XSS VIA LOCATION.HASH (9 Nov 2026, row #275 [High] CWE-79):
  // dom-xss-sinks fingerprints sinks statically; this phase goes one
  // step further — it mines first-party code for location.hash reads
  // and, only when a read exists, drives a canary fragment through
  // the pasted page in a real browser (transient container + fixed
  // CDP endpoint, same pattern as renderDomAuthenticated) and
  // confirms ONLY on observed execution. Sink presence alone never
  // fires. Lab-gated like basket-logic / workflow-skip / twofa
  // (labCreds + allowWrite + lab host + depth !== 'quick'), so the
  // drive never runs outside the lab gate; a read into a safe sink
  // (textContent / encode) drives but cannot execute, and zero reads
  // is a proven true negative with no drive at all.
  const lhDiag = {};
  if (secretTargets.bundles.length > 0 || secretTargets.inline.length > 0) {
    await step(
      'dom-xss-location-hash',
      () =>
        probeDomXssLocationHash(url, secretTargets, {
          ...opts,
          allowWrite,
          labTargets,
          diagnostics: lhDiag,
          ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
        }),
      () => ({
        hashReads: lhDiag.hashReads || 0,
        hashNearSink: lhDiag.hashNearSink || 0,
        driveAttempted: Boolean(lhDiag.driveAttempted),
        driveExecuted: Boolean(lhDiag.driveExecuted),
      })
    );
  } else {
    skipPhase('dom-xss-location-hash', 'no script targets');
  }
  // DOM XSS VIA POSTMESSAGE (9 Nov 2026, row #274 [High] CWE-79):
  // dom-xss-sinks fingerprints sinks statically and
  // dom-xss-location-hash drives a fragment canary; this phase
  // goes after the third DOM-XSS source — it mines first-party code
  // for `message` listeners and, only when one exists, posts a
  // control message and canary messages to the pasted page from a
  // cross-origin iframe in a real browser (transient container +
  // fixed CDP endpoint, same pattern as renderDomAuthenticated)
  // and confirms ONLY on observed execution. A self-post would
  // arrive as the page's own origin and falsely confirm a handler
  // that checks origin, so the drive posts from a data:-URL iframe
  // (opaque "null" origin) and verifies delivery at the window —
  // see domPostMessage.js. Listener presence alone never fires.
  // Lab-gated like dom-xss-location-hash (labCreds + allowWrite +
  // lab host + depth !== 'quick'), so the drive never runs outside
  // the lab gate; a listener into a safe sink drives but cannot
  // execute, and zero listeners is a proven true negative with no
  // drive at all.
  const pmDiag = {};
  if (secretTargets.bundles.length > 0 || secretTargets.inline.length > 0) {
    await step(
      'dom-postmessage',
      () =>
        probeDomPostMessage(url, secretTargets, {
          ...opts,
          allowWrite,
          labTargets,
          diagnostics: pmDiag,
          ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
        }),
      () => ({
        listeners: pmDiag.listeners || 0,
        listenersNearSink: pmDiag.listenersNearSink || 0,
        driveAttempted: Boolean(pmDiag.driveAttempted),
        driveExecuted: Boolean(pmDiag.driveExecuted),
      })
    );
  } else {
    skipPhase('dom-postmessage', 'no script targets');
  }
  // CLIENT-SIDE TEMPLATE INJECTION (9 Nov 2026, row #190 [High]
  // CWE-79): dom-xss-sinks fingerprints sinks statically and
  // dom-xss-location-hash / dom-postmessage drive canaries at other
  // DOM sources; this phase goes after the fourth DOM source — it
  // mines first-party code for runtime template engines (AngularJS
  // $interpolate, Handlebars.compile, Mustache.render, _.template,
  // doT, EJS, Nunjucks, Vue runtime compiler) and, only when one
  // exists, navigates the pasted page in a real browser (transient
  // container + fixed CDP endpoint, same pattern as
  // renderDomAuthenticated) with the template canary {{7*7*191}} in
  // the query string and then in the fragment, and confirms ONLY
  // when the full SSTI oracle holds on the rendered DOM (control
  // clean, canary evaluates to 9352, literal absent, same
  // reflection point in two renders) — see csti.js. Engine presence
  // alone never fires. Lab-gated like dom-postmessage (labCreds +
  // allowWrite + lab host + depth !== 'quick'), so the drive never
  // runs outside the lab gate; an engine feeding only a text sink
  // drives but cannot execute, and zero engines is a proven true
  // negative with no drive at all.
  const cstiDiag = {};
  if (secretTargets.bundles.length > 0 || secretTargets.inline.length > 0) {
    await step(
      'csti',
      () =>
        probeCsti(url, secretTargets, {
          ...opts,
          allowWrite,
          labTargets,
          diagnostics: cstiDiag,
          ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
        }),
      () => ({
        engines: cstiDiag.engines || 0,
        enginesNearSink: cstiDiag.enginesNearSink || 0,
        driveAttempted: Boolean(cstiDiag.driveAttempted),
        driveExecuted: Boolean(cstiDiag.driveExecuted),
      })
    );
  } else {
    skipPhase('csti', 'no script targets');
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
  // SOURCE CODE DISCLOSURE (7 Nov 2026, row #184): backup copies of
  // discovered server-side files, .git/config and JS source maps
  // are fetched for actual source content (see
  // sourceCodeDisclosure.js). A finding counts only when the body
  // reads as source for the claimed language — a 200, a 404 or an
  // HTML shell is never a finding — and the matched snippet must
  // not already appear on the baseline page. Read-only GETs, no
  // allowWrite gate. One phase record per scan; the pasted page is
  // always a surface, so this phase never skips (like
  // fingerprint-banner above). It never re-fires on files the
  // 'files' phase already covers (.git/HEAD, .env, .DS_Store,
  // phpinfo.php) or on JS bundle contents (secrets-in-js).
  await step('source-code-disclosure', () => probeSourceCodeDisclosure(url, verbTargets, opts));
  // METADATA LEAKAGE (7 Nov 2026, row #178): images served with
  // embedded EXIF/document metadata (GPS coordinates, camera serial,
  // author, software strings carrying internal user paths) are
  // fetched as raw bytes and parsed (see metadataLeakage.js). A
  // finding counts only for a genuinely sensitive field — benign
  // metadata (dimensions, make/model alone, a plain software name)
  // never fires — and the value must not already be printed on the
  // baseline page. Read-only GETs, no allowWrite gate. One phase
  // record per scan; the pasted page is always a surface, so this
  // phase never skips (like fingerprint-banner and
  // source-code-disclosure above). It never re-fires on JS bundle
  // contents (secrets-in-js), error responses (error-disclosure)
  // or headers (fingerprint-banner). PDF/DOCX metadata is out of
  // scope (no parser dependency).
  await step('metadata-leakage', () => probeMetadataLeakage(url, verbTargets, opts));
  // SENSITIVE DATA IN LOGS (7 Nov 2026, row #180): log files and
  // log-viewer paths served over HTTP are fetched for the app's own
  // secrets — credential assignments, Authorization tokens, AWS keys,
  // private keys, Luhn-valid card numbers (see
  // sensitiveDataInLogs.js). A finding counts only for a genuinely
  // sensitive value (8+ chars with a digit, a symbol, or 12+
  // characters; placeholders never fire) that is not already
  // printed on the baseline page and whose body is not the catch-all
  // control. Read-only GETs, no allowWrite gate. One phase record
  // per scan; the pasted page is always a surface, so this phase
  // never skips (like fingerprint-banner, source-code-disclosure
  // and metadata-leakage above). It never re-fires on error
  // responses (error-disclosure), JS bundle contents (secrets-in-js)
  // or attacker data reflected into logs (csv-log-injection — the
  // opposite direction). HTML log-viewer pages are out of scope.
  await step('sensitive-data-in-logs', () => probeSensitiveDataInLogs(url, verbTargets, opts));
  // SENSITIVE INFORMATION DISCLOSURE (GENERAL) (7 Nov 2026, row
  // #181): the scanner's already-selected response bodies are
  // examined for the application's own internal infrastructure —
  // RFC1918 private IP addresses and internal hostnames
  // (*.internal/*.intranet/*.corp/*.lan/*.local/*.private) (see
  // sensitiveInfoDisclosure.js). A finding counts only for a
  // genuinely internal address that is not the target's own host/IP,
  // is not already printed on the baseline page, and whose body is
  // not the catch-all control. Read-only GETs, no allowWrite gate.
  // One phase record per scan; the pasted page is the baseline, so
  // this phase never skips (like fingerprint-banner,
  // source-code-disclosure, metadata-leakage and
  // sensitive-data-in-logs above). It never re-fires on error
  // responses (error-disclosure), JS bundle contents (secrets-in-js),
  // served log files (sensitive-data-in-logs), headers
  // (fingerprint-banner), backup/source files (source-code-disclosure
  // / files) or image/document metadata (metadata-leakage), and it
  // never probes diagnostic endpoints (/actuator, /metrics,
  // /openapi.json, /swagger.json — nuclei and openapi-targets own
  // those). IPv6 internal addresses are out of scope.
  await step('sensitive-info-disclosure', () => probeSensitiveInfoDisclosure(url, verbTargets, opts));
  // TIMING SIDE-CHANNEL DISCLOSURE (7 Nov 2026, row #185, CWE-208):
  // a login endpoint that returns the SAME generic error for a valid
  // and an invalid username but takes measurably longer for the
  // valid one leaks account existence through response time alone
  // (see timingSideChannel.js). A finding counts only when the
  // content is indistinguishable (otherwise user-enumeration owns
  // the surface), the median gap is >= 100ms, the same side wins
  // >= 4/5 rounds (>= 6/8 after re-verification), and a same-user
  // control shows noise smaller than half the gap. Needs a
  // known-valid anchor (opts.labCreds.username); without one it
  // degrades honestly to []. Read-only POSTs, at most 20 requests.
  // One phase record per scan; the pasted page is the baseline, so
  // this phase never skips (like sensitive-info-disclosure above).
  // Register/reset forms, password-length oracles and cryptographic
  // timing attacks are out of scope.
  await step('timing-side-channel', () => probeTimingSideChannel(forms, url, opts));
  await step('csrf', () => probeCsrf(forms, url));
  await step('post-forms', () => probePostForms(postForms, opts));
  // SMTP CANARY INBOX (8 Nov 2026, row #43 T2): the smtp-injection
  // probe's Bcc-relay variant confirms ONLY by received mail at OUR
  // canary inbox — a local SMTP sink started here for the duration of
  // this phase, same pattern as the OOB collaborators. Only when the
  // target is lab-gated (allowWrite, the same host check as the
  // file-upload gate); the probe itself re-checks opts.labTargets
  // before sending anything, so a non-lab target never receives a
  // canary address. Start is best-effort: a bind failure is recorded
  // in errors and the scan continues with T2 skipped, exactly as
  // before this lane. The sink is always stopped afterwards
  // (finally), so no listener outlives the scan. The canary domain
  // defaults to the reserved .invalid domain (RFC 2606 — never
  // resolves, so no mail can ever escape to a real mailbox);
  // override with opts.smtpCanaryDomain / DM_SMTP_CANARY_DOMAIN.
  // Listen host/port: opts.smtpListenHost / opts.smtpListenPort or
  // DM_SMTP_LISTEN_HOST / DM_SMTP_PORT (0 = ephemeral).
  let smtpInbox = null;
  if (phases.includes('smtp-injection') && allowWrite) {
    try {
      smtpInbox = createSmtpCanaryInbox({
        listenHost: opts.smtpListenHost || process.env.DM_SMTP_LISTEN_HOST || '0.0.0.0',
        listenPort: opts.smtpListenPort || (process.env.DM_SMTP_PORT ? Number(process.env.DM_SMTP_PORT) : 0),
        domain: opts.smtpCanaryDomain || process.env.DM_SMTP_CANARY_DOMAIN || 'dm-canary.invalid',
      });
      await smtpInbox.start();
    } catch (e) {
      errors.push(`smtp-canary-inbox: ${e && e.message ? e.message : String(e)}`);
      smtpInbox = null;
    }
  }
  try {
    await step('smtp-injection', () =>
      probeSmtpInject(forms, url, {
        ...opts,
        labTargets,
        ...(smtpInbox
          ? {
              smtpCanaryInbox: {
                domain: smtpInbox.domain,
                check: (addr) => smtpInbox.check(addr),
                waitFor: (addr, ms) => smtpInbox.waitFor(addr, ms),
              },
            }
          : {}),
      })
    );
  } finally {
    if (smtpInbox) {
      try { await smtpInbox.stop(); } catch { /* stop is best-effort */ }
    }
  }
  // T4b (bearer/API login) needs the already-discovered route set —
  // wired in here from scanTargets (crawl + openapi + jsRoutes-mined),
  // no new discovery phase. T4b never fires on the SPA-root HTML alone.
  // D2 (#474 repair): labTargets is passed explicitly — the probe's
  // isLab reads opts.labTargets, and runScan's spec field never
  // reached opts before. D3: the POST-only mined routes ride along
  // as API-login candidates (never as GET probe targets).
  await step('session-fixation', () => probeSessionFixation(forms, url, { ...opts, apiRoutes: [...scanTargets, ...jsWriteTargets], labTargets }));
  // BASKET LOGIC (8 Nov 2026, rows #82/#370, variants #374/#80/#83):
  // negative-quantity / price / overflow manipulation of a shop
  // basket, confirmed by a pure-arithmetic total differential with
  // a +1 control (see basketLogic.js). Same apiRoutes wiring as
  // session-fixation (T4b) — the mined basket endpoints reach the
  // probe only through the discovered route set, never invented.
  // Diagnostics ride the phase extras (basketRoutes, basketId,
  // controlOk, mutations) so a live proof can tell "no surface"
  // from "oracle uncalibrated" without re-running the scan.
  const blDiag = {};
  await step(
    'basket-logic',
    () =>
      probeBasketLogic(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: blDiag,
      }),
    () => ({
      basketRoutes: blDiag.basketRoutes || 0,
      basketId: Boolean(blDiag.basketId),
      controlOk: Boolean(blDiag.controlOk),
      mutations: blDiag.mutations || 0,
    })
  );
  // WORKFLOW SKIP (8 Nov 2026, row #87 [High], WSTG-BUSL): the
  // out-of-order half of the basket-logic row family — checkout
  // accepted for an empty basket, confirmed by a control checkout
  // of a non-empty basket that must first return an order artefact
  // (see workflowSkip.js). Same apiRoutes wiring as basket-logic.
  // Diagnostics ride the phase extras (workflowRoutes, basketId,
  // controlOk, mutations) so a live proof can tell "no surface"
  // from "oracle uncalibrated" without re-running the scan.
  const wsDiag = {};
  await step(
    'workflow-skip',
    () =>
      probeWorkflowSkip(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: wsDiag,
      }),
    () => ({
      workflowRoutes: wsDiag.workflowRoutes || 0,
      basketId: Boolean(wsDiag.basketId),
      controlOk: Boolean(wsDiag.controlOk),
      mutations: wsDiag.mutations || 0,
    })
  );
  // TWO-FA BRUTE-FORCE (8 Nov 2026, row #326 [High], CWE-307): a
  // short 2FA code with no attempt limit is enumerable — confirm
  // only when 10 distinct wrong codes are each answered as ordinary
  // invalid-code responses with no throttle signal anywhere (see
  // twoFaBruteForce.js). Same apiRoutes wiring as basket-logic /
  // workflow-skip. Diagnostics ride the phase extras (twoFaRoutes,
  // controlOk, attempts) so a live proof can tell "no surface" from
  // "oracle uncalibrated" without re-running the scan.
  const tfbDiag = {};
  await step(
    'twofa-bruteforce',
    () =>
      probeTwoFaBruteForce(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: tfbDiag,
      }),
    () => ({
      twoFaRoutes: tfbDiag.twoFaRoutes || 0,
      controlOk: Boolean(tfbDiag.controlOk),
      attempts: tfbDiag.attempts || 0,
    })
  );
  // CREDENTIAL STUFFING (9 Nov 2026, row #42 [High], OWASP A07:2021):
  // a login that never throttles wrong passwords lets an attacker
  // replay leaked credential pairs at scale — confirm only when 10
  // distinct fixed wrong passwords are each answered as ordinary
  // invalid-credential responses with no throttle signal anywhere
  // (see credentialStuffing.js). Same apiRoutes wiring as
  // twofa-bruteforce. Diagnostics ride the phase extras
  // (loginRoutes, controlOk, attempts) so a live proof can tell
  // "no surface" from "oracle uncalibrated" without re-running
  // the scan.
  const csDiag = {};
  await step(
    'credential-stuffing',
    () =>
      probeCredentialStuffing(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: csDiag,
      }),
    () => ({
      loginRoutes: csDiag.loginRoutes || 0,
      controlOk: Boolean(csDiag.controlOk),
      attempts: csDiag.attempts || 0,
    })
  );
  await step('user-enumeration', () => probeUserEnum(forms, url, opts));
  await step('mass-assignment', () => probeMassAssignment(forms, url, { ...opts, labTargets }));
  await step('ws-messages', () => probeWsMessages(url, { ...opts, labTargets }));
  await step('subdomain-takeover', () => probeSubdomainTakeover(url, opts));
  await step('race', () =>
    probeRace(
      forms,
      url,
      [...new Set(forms.flatMap((f) => (f.inputs || []).map((i) => i.name).filter(Boolean)))],
      // D2 (#474 repair): same labTargets defect as session-fixation —
      // the probe's isLab read opts.labTargets, which runScan never set.
      { ...opts, labTargets }
    )
  );
  await step('files', () => probeSensitiveFiles(url, opts));
  // MISSING AUTH (7 Nov 2026, row #47 [Critical], CWE-306 / ASVS
  // V4.1): a critical function (admin, management, setup, ...) that
  // answers an unauthenticated GET with authenticated-only content.
  // Always-run (the fixed candidate list is never empty); strict
  // 4-conjunct gate in missingAuth.js — direct 200 only, not the SPA
  // catch-all, auth markers with no login form, HTML/JSON only.
  await step('missing-auth', () => probeMissingAuth(url, scanTargets, opts));
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
  await step('graphql', () => probeGraphql(url, { ...opts, labTargets }));
  await step('cswsh', () => probeCswsh(url, opts));
  await step('oauth', () => probeOauth(url, { ...opts, labTargets }));
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
  await step('password-reset', () => probePasswordReset(forms, url, { ...opts, labTargets }));
  await step('crypto', () => probeCrypto(url, opts));
  await step('prototype-pollution', () => probePrototypePollution(url, { ...opts, labTargets }));
  await step('deserialization', () => probeDeserialization(url, { ...opts, labTargets }));
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
