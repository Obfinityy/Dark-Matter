// Dark Matter rule-based scanner — deterministic orchestrator.
// paste link → scope check → recon/fingerprint → element analysis
// (one page deep, or the whole site with /* scope) → probe battery
// → Nuclei → differential verification → confirmed findings.
// No LLM, no API keys, no prompts. Same target + same code = same result.
import { authorizeTarget } from './target.js';
import { isLabTargetHost } from '../labCreds.js';
import { randomBytes } from 'node:crypto';
import { fingerprint, fetchPage } from './fingerprint.js';
import { crawl, extractParams, extractForms, normalizeScanScope, siteMaxUrls } from './crawl.js';
import { extractProbePoints, buildCoverageExtras, probePointParameter } from './probePoints.js';
import { analyzePage, planForPage, mergePageAnalyses } from './pageAnalyze.js';
import { groupFindingsByRoute } from './routeGroup.js';
import { runPhaseTasks, resolvePhaseConcurrency } from './parallel.js';
import { withThrottledFetch } from './httpBackoff.js';
import { probeHeaders } from './probes/headers.js';
import { probeSqliError } from './probes/sqliError.js';
import { probeBlindSqli, probeBooleanBlindSqli } from './probes/sqliBlind.js';
import { probeSqliUnion } from './probes/sqliUnion.js';
import { probeSqliOob } from './probes/sqliOob.js';
import { probeSqliSecondOrder } from './probes/sqliSecondOrder.js';
import { probeXssReflected, probeXssUriScheme } from './probes/xss.js';
import { probeCmdiTime } from './probes/cmdi.js';
import { probeTraversal } from './probes/traversal.js';
import { probeLogPoisoning } from './probes/logPoisoning.js';
import { probeSsti } from './probes/ssti.js';
import { probeSstiPebble } from './probes/sstiPebble.js';
import { probeOpenRedirect } from './probes/redirect.js';
import { probeCsrf } from './probes/csrf.js';
import { probePostForms } from './probes/postForms.js';
import { probeSensitiveFiles } from './probes/files.js';
import { probeXxe } from './probes/xxe.js';
import { probeXxeXinclude } from './probes/xxeXinclude.js';
import { probeSsrf } from './probes/ssrf.js';
import { probeSsrfRouting } from './probes/ssrfRouting.js';
import { probeSsrfReferer } from './probes/ssrfReferer.js';
import { probeRefererAccessControl } from './probes/refererAccessControl.js';
import { probeIdorSurface } from './probes/idor.js';
import { probeCors } from './probes/cors.js';
import { probeCookieFlags } from './probes/cookies.js';
import { probeStoredXss, probeStoredXssUriScheme } from './probes/storedXss.js';
import { probeBlindXss } from './probes/blindXss.js';
import { probeEgressLaundering } from './probes/egressLaundering.js';
import { probeDocumentExternalImage } from './probes/documentExternalImage.js';
import { probeSpreadsheetExternalImage } from './probes/spreadsheetExternalImage.js';
import { probePresentationExternalImage } from './probes/presentationExternalImage.js';
import { probeWeakCreds } from './probes/weakCreds.js';
import { probeHostHeader } from './probes/hostHeader.js';
import { probeNoSqli } from './probes/nosqli.js';
import { probeLdapInjection } from './probes/ldapi.js';
import { probeLdapBlind } from './probes/ldapBlind.js';
import { probeNoSqlDeep } from './probes/nosqlDeep.js';
import { probeRace } from './probes/race.js';
import { probeCrypto } from './probes/crypto.js';
import { probeHashLengthExtension } from './probes/hashLengthExtension.js';
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
import { probeAntiAutomation } from './probes/antiAutomation.js';
import { probeBfla } from './probes/bfla.js';
import { probeWeakPasswordPolicy } from './probes/weakPasswordPolicy.js';
import { probeBusinessFlowAccess } from './probes/businessFlowAccess.js';
import { probeCouponAbuse } from './probes/couponAbuse.js';
import { probeApiTokenAuth } from './probes/apiTokenAuth.js';
import { probeExceptionalConditions } from './probes/exceptionalConditions.js';
import { probeWorkflowDataExposure } from './probes/workflowDataExposure.js';
import { probeQuotaBypass } from './probes/quotaBypass.js';
import { probeProvisioning } from './probes/provisioning.js';
import { probeLlmRateLimit } from './probes/llmRateLimit.js';
import { probeLlmTrainingData } from './probes/llmTrainingData.js';
import { probeLlmTrainingPoisoning } from './probes/llmTrainingPoisoning.js';
import { probeLlmModelExtraction } from './probes/llmModelExtraction.js';
import { probeLlmMultimodal } from './probes/llmMultimodal.js';
import { probeLlmMembership } from './probes/llmMembership.js';
import { probeLlmSupplyChain } from './probes/llmSupplyChain.js';
import { probeDomPostMessage } from './probes/domPostMessage.js';
import { probeDomOpenRedirect } from './probes/domOpenRedirect.js';
import { probeDomClobbering } from './probes/domClobbering.js';
import { probeDomCookieManipulation } from './probes/domCookieManipulation.js';
import { probeDocumentDomain } from './probes/documentDomain.js';
import { probeDeepLink } from './probes/deepLink.js';
import { probeWebViewBridge } from './probes/webviewBridge.js';
import { probeWebrtcLeak } from './probes/webrtcLeak.js';
import { probeSwCachePoisoning } from './probes/swCachePoisoning.js';
import { probeCsti } from './probes/csti.js';
import { probeCstiFrameworks } from './probes/cstiFrameworks.js';
import { probeCaptcha } from './probes/captcha.js';
import { probeCssInjection } from './probes/cssInjection.js';
import { probeMutationXss } from './probes/mutationXss.js';
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
import { probeBlindXpath } from './probes/blindXpath.js';
import { probeSsiInjection } from './probes/ssi.js';
import { probeFileUpload } from './probes/fileUpload.js';
import { probeUploadRace } from './probes/uploadRace.js';
import { probeUploadHtaccess } from './probes/uploadHtaccess.js';
import { probeCachePoisoning } from './probes/cachePoison.js';
import { probeRequestSmuggling } from './probes/smuggling.js';
import { probeSmugglingClCl } from './probes/smugglingClCl.js';
import { probeSmugglingZeroCl } from './probes/smugglingZeroCl.js';
import { probeSmugglingH2Tunnel } from './probes/smugglingH2Tunnel.js';
import { probeJwt } from './probes/jwt.js';
import { probeJwtClaims } from './probes/jwtClaims.js';
import { probeSessionTimeout } from './probes/sessionTimeout.js';
import { probeLlmToolMisuse } from './probes/llmToolMisuse.js';
import { probeMcpToolPoisoning } from './probes/mcpToolPoisoning.js';
import { probeLlmExcessiveAgency } from './probes/llmExcessiveAgency.js';
import { probeLlmOutputHandling } from './probes/llmOutputHandling.js';
import { probeLlmMisinformation } from './probes/llmMisinformation.js';
import { probeLlmInjection } from './probes/llmInjection.js';
import { probeGraphql } from './probes/graphql.js';
import { probeGraphqlRelay } from './probes/graphqlRelay.js';
import { probeGraphqlApq } from './probes/graphqlApq.js';
import { probeGraphqlDefer } from './probes/graphqlDefer.js';
import { probeCswsh } from './probes/cswsh.js';
import { probeOauth } from './probes/oauth.js';
import { probeOauthLab } from './probes/oauthLab.js';
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
import { probeAutocomplete } from './probes/autocomplete.js';
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
  'sqli-union',
  'sqli-boolean-blind',
  'sqli-oob',
  'sqli-second-order',
  'xss',
  'cmdi',
  'traversal',
  'log-poisoning',
  'ssti',
  'ssti-pebble',
  'el-injection',
  'ognl-injection',
  'redirect',
  'csrf',
  'post-forms',
  'files',
  'missing-auth',
  'xxe',
  'xxe-xinclude',
  'ssrf',
  'ssrf-routing',
  'ssrf-referer',
  'referer-access-control',
  'idor',
  'cors',
  'cookies',
  'stored-xss',
  'blind-xss',
  'egress-laundering',
  'document-external-image',
  'spreadsheet-external-image',
  'presentation-external-image',
  'weak-creds',
  'host-header',
  'nosqli',
  'nosql-deep',
  'ldapi',
  'ldap-blind',
  'race',
  'crypto',
  'hash-length-extension',
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
  'anti-automation',
  'bfla',
  'weak-password-policy',
  'business-flow-access',
  'coupon-abuse',
  'api-token-auth',
  'exceptional-conditions',
  'workflow-data-exposure',
  'dom-open-redirect',
  'dom-clobbering',
  'dom-cookie-manipulation',
  'document-domain',
  'deep-link',
  'webview-bridge',
  'webrtc-leak',
  'sw-cache-poisoning',
  'quota-bypass',
  'provisioning',
  'llm-rate-limit',
  'llm-training-data',
  'llm-training-poisoning',
  'llm-model-extraction',
  'llm-multimodal',
  'llm-membership-inference',
  'llm-supply-chain',
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
  'blind-xpath',
  'ssi',
  'file-upload',
  'upload-race',
  'upload-htaccess',
  'cache-poisoning',
  'request-smuggling',
  'smuggling-cl-cl',
  'smuggling-zero-cl',
  'smuggling-h2-tunnel',
  'jwt',
  'jwt-claims',
  'session-timeout',
  'llm-tool-misuse',
  'mcp-tool-poisoning',
  'llm-excessive-agency',
  'llm-output-handling',
  'llm-misinformation',
  'llm-injection',
  'graphql',
  'graphql-relay',
  'graphql-apq',
  'graphql-defer',
  'cswsh',
  'oauth',
  'oauth-lab',
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
  'autocomplete',
  'dom-xss-sinks',
  'dom-xss-location-hash',
  'dom-postmessage',
  'csti',
  'csti-frameworks',
  'captcha',
  'css-injection',
  'mutation-xss',
  'nuclei',
];

// PARAM BATTERY (5 Nov 2026, 35/63 fix): the 32 injection-class phases
// below run per URL inside the param loop in runScan. When a scan has ZERO
// param-bearing targets (bare-root paste on a POST-login page, SPA with no
// links/forms), the loop body never executes and step() is never invoked
// for them — previously they vanished with no record at all, so the rollup
// read a clean 35/35 ok on a 35/63 run. runScan now emits a skipped record
// for each of them instead; see skipPhase inside runScan.
export const PARAM_BATTERY_PHASES = [
  'sqli-error',
  'sqli-blind',
  'sqli-union',
  'sqli-boolean-blind',
  'hpp',
  'csv-log-injection',
  'xss',
  'nosqli',
  'nosql-deep',
  'ldapi',
  'ldap-blind',
  'xpathi',
  'blind-xpath',
  'xml-injection',
  'ssi',
  'cmdi',
  'traversal',
  'log-poisoning',
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
  'ssti-pebble',
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
 *
 * 429 / RETRY-AFTER BACK-OFF (10 Nov 2026): runScanInner is the real
 * battery; the exported runScan runs it under the throttled fetch from
 * httpBackoff.js, so a host that answers 429 pauses further requests
 * to that host for the Retry-After duration (capped at 60s, 5s default)
 * instead of being hammered. The 429 response itself reaches the probe
 * untouched. `opts.httpBackoff` is a test seam for the wrapper options
 * ({ now, sleep, defaultBackoffMs, maxBackoffMs }); production
 * callers never pass it.
 */
export async function runScan(scanArgs, opts = {}) {
  return withThrottledFetch(
    () => runScanInner(scanArgs, opts),
    globalThis.fetch,
    opts && typeof opts.httpBackoff === 'object' ? opts.httpBackoff : {}
  );
}

async function runScanInner(
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
  // SCAN SCOPE (9 Nov 2026, /* owner order): 'page' (default — the
  // pasted page only, today's behaviour) or 'site' (recursive
  // same-origin crawl). The scope flows through opts from the hunt
  // route; anything else is 'page'.
  const scanScope = normalizeScanScope(opts.scanScope);
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

  // executeStepBody is the per-phase execution core shared by the
  // sequential step() (setup chain) and the parallel probe plan: run
  // the probe, catch its failure into the record, build the record.
  // It touches NO shared scan state — the caller merges the returned
  // findings/error/record — so the same body serves both paths and a
  // parallel run cannot drift from the sequential one.
  const executeStepBody = async (name, fn, getExtras) => {
    const startedAt = new Date().toISOString();
    const startMs = Date.now();
    let ok = true;
    let error = null;
    let result;
    try {
      result = await fn();
    } catch (e) {
      // A throwing step is recorded ok:false WITH its error message — it
      // must NOT vanish into errors[] alone (nothing persisted errors[]).
      ok = false;
      error = e && e.message ? String(e.message) : String(e);
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
    return { result, record, ok, error };
  };

  const step = async (name, fn, getExtras) => {
    if (!phases.includes(name)) return;
    const { result, record, error } = await executeStepBody(name, fn, getExtras);
    if (Array.isArray(result)) all.push(...result);
    if (error) errors.push(`${name}: ${error}`);
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
  // The crawl phase record carries the scope + how many pages the
  // walk visited, so a finished scan shows its crawl footprint
  // without re-reading the summary.
  let crawlPagesScanned = 0;
  crawled = await step(
    'crawl',
    async () => {
      const res = await crawl(url, opts);
      crawlPagesScanned = res && res.pagesScanned ? res.pagesScanned : 0;
      return res;
    },
    () => ({ pagesScanned: crawlPagesScanned, scanScope })
  );

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
    // SITE MODE (9 Nov 2026): every discovered page's body gets the
    // same element inventory, merged with per-page provenance
    // (mergePageAnalyses tags each element/form with its page URL).
    // Page mode is unchanged: the pasted page only.
    if (scanScope === 'site' && crawled && Array.isArray(crawled.pages) && crawled.pages.length) {
      pageAnalysis = mergePageAnalyses(
        crawled.pages.map((p) => ({ url: p.url, analysis: p.body ? analyzePage(p.body, p.url) : null }))
      );
    } else {
      pageAnalysis = analyzePage(body, url);
    }
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
          // DOM textareas/selects carry no type in the analysis, so
          // tag them here (9 Nov 2026, deep-coverage audit) — the
          // static extractor sets the same types, so both paths now
          // honour the { name, type, value } contract.
          inputs: [
            ...(f.inputs || []),
            ...(f.textareas || []).map((t) => ({ ...t, type: 'textarea' })),
            ...(f.selects || []).map((s) => ({ ...s, type: 'select' })),
          ].filter((x) => x && x.name),
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
  // SITE MODE (9 Nov 2026): the cap rises so discovered pages are
  // never silently dropped — exact caps by scan depth: Quick 25,
  // Standard 30, Deep 40 (page cap + 20 link slack; see
  // SITE_MAX_URLS in crawl.js). Page mode keeps the caller's cap.
  const maxUrls = scanScope === 'site' ? siteMaxUrls(opts.scanDepth) : (opts.maxUrls || 10);
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
  // SITE MODE (9 Nov 2026): every discovered page becomes a scan
  // target FIRST (BFS order), so the battery tries each route even
  // when the cap fills; their links follow after. Page mode pushes
  // the pasted page's links only, unchanged.
  if (scanScope === 'site' && crawled && Array.isArray(crawled.pages)) {
    for (const p of crawled.pages) pushTarget(p.url);
  }
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
  // SITE MODE (9 Nov 2026): pages the crawl already fetched are read
  // from its cache instead of re-fetched — the body is the same one
  // page-analyze inventoried, and a large site is not fetched twice.
  const crawledBodyByUrl = new Map();
  if (crawled && Array.isArray(crawled.pages)) {
    for (const p of crawled.pages) {
      try {
        crawledBodyByUrl.set(new URL(p.url).toString().split('#')[0], { body: p.body, url: p.url });
      } catch {
        // ignore malformed page URLs
      }
    }
  }
  for (const u of scanTargets) {
    try {
      const cached = crawledBodyByUrl.get(u);
      const p = cached || (await fetchPage(u, opts));
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
    // Standalone textareas/selects get the same treatment (9 Nov
    // 2026, deep-coverage audit): analyzePage inventories them, but
    // only inputs reached the battery — a standalone textarea or
    // select was planned and never tried.
    const standalone = [
      ...(pageAnalysis.inputs || []),
      ...(pageAnalysis.textareas || []),
      ...(pageAnalysis.selects || []),
    ];
    for (const inp of standalone) {
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

  // PARALLEL PROBE PLAN (10 Nov 2026): the probe phases below are
  // independent given the setup inputs — no probe reads another
  // probe's findings and none mutates the shared inputs — so they
  // run concurrently in a bounded pool (runPhaseTasks) instead of
  // one-by-one. plan()/planSkip() only ENQUEUE a task; nothing runs
  // here. The pool executes after the last plan entry (nuclei) and
  // merges outcomes in TASK order, so the confirmed-finding set,
  // the dedup first-wins winner, and the phase-record order are
  // identical to the old sequential run. The setup chain above stays
  // sequential (fingerprint → crawl → page-analyze → dom-render →
  // openapi/js-api-routes): each step feeds the next.
  //
  // EXCLUSIVE GROUP (10 Nov 2026 fix): independence above covers
  // in-process inputs only. Six phases below log in as the SAME
  // labCreds account and write to its ONE basket — basket-logic
  // (seed / mutate / restore / checkout-tamper), workflow-skip
  // (control checkout CONSUMES the basket by design), coupon-abuse
  // (seed / coupon apply / checkout), business-flow-access (seed
  // the victim basket), workflow-data-exposure (seed / checkout)
  // and exceptional-conditions (basket add / update). Running them
  // concurrently lost a finding live: the parallel Juice re-proof
  // finished 29/0 vs 30/0 sequential because workflow-skip's
  // checkout emptied the shared basket while basket-logic was
  // mid-mutation (mutations 2 -> 0). Those six declare the same
  // `exclusive` key, so the pool serializes them against each other
  // while everything else still runs concurrently. The key names
  // the shared RESOURCE, not the probes — any future phase that
  // writes the lab basket joins this key. Read-only basket users
  // (session-fixation T4b, quota-bypass, api-token-auth) stay out:
  // concurrent reads cannot corrupt a mutation.
  const LAB_BASKET = 'lab-basket';
  const probeTasks = [];
  const plan = (name, fn, getExtras, taskOpts = {}) => {
    if (!phases.includes(name)) return;
    probeTasks.push({
      name,
      run: () => executeStepBody(name, fn, getExtras),
      teardown: taskOpts.teardown,
      exclusive: taskOpts.exclusive,
    });
  };
  // A gated skip is a plan entry too: its record is built at
  // execution time so skipped phases keep their task-order slot in
  // result.phases (paramBattery.test.js asserts the full 30-name
  // battery order even when every phase is skipped).
  const planSkip = (name, reason) => {
    if (!phases.includes(name)) return;
    probeTasks.push({
      name,
      run: async () => {
        const now = new Date().toISOString();
        const record = {
          name,
          startedAt: now,
          finishedAt: now,
          durationMs: 0,
          ok: true,
          skipped: true,
          skipReason: reason,
          error: null,
          findingsCount: 0,
        };
        return { result: [], record, ok: true, error: null };
      },
    });
  };

  plan('headers', () => (fp ? probeHeaders({ url, headers: fp.headers }) : []));
  // UNTRUSTED JS INCLUSION (7 Nov 2026, row #98): the page loads
  // executable JavaScript from a cross-origin host that is neither
  // same-origin nor a trusted CDN, with no SRI hash pinning the code.
  // Reuses the HTML the fingerprint step already fetched (fp.body) —
  // zero extra requests, never fetches the script itself (see
  // untrustedJsInclusion.js). Never re-fires the generic missing-SRI
  // finding (headers phase owns that).
  plan('untrusted-js-inclusion', () => (fp ? probeUntrustedJsInclusion({ url, html: fp.body }) : []));
  // API VERSIONING (7 Nov 2026, row #343): an API version still live
  // after it was superseded or explicitly deprecated (Deprecation /
  // Sunset header, or two+ versions of one base responding) — old
  // versions keep serving data without security fixes (OWASP
  // API08:2023). Seeds its bases from the scan's target URLs
  // (jsRoutes/openapi-mined /api and /rest paths); a single live
  // version never fires, /api vs /rest are different surfaces, and
  // a 410 is correctly retired (see apiVersioning.js).
  plan('api-versioning', () => probeApiVersioning(url, scanTargets, opts));
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
  plan('session-token-in-url', () =>
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
  plan('credential-disclosure', () =>
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
  plan('sensitive-cache', () =>
    probeSensitiveCache(url, fp ? fp.headers : {}, fp ? fp.body : '', opts)
  );
  // 35/63 FIX: track whether the param battery ran at all. If no scan
  // target carried a single parameter, the loop body below never executes
  // and the 31 phases inside it would vanish in silence — record each of
  // them as skipped instead (after the loop).
  let paramBatteryRan = false;
  // PER-PHASE COVERAGE DIAGNOSTIC (9 Nov 2026, deep-coverage audit):
  // batteryStep wraps step() for the param battery: it hands the
  // probe a fresh opts.diagnostics object and records the coverage
  // extras — points offered vs points the probe actually attempted
  // (see probePoints.buildCoverageExtras). A probe that never
  // reports leaves pointsAttempted null ("not reported"), never an
  // invented number.
  const batteryStep = (name, fn, points) => {
    const diag = {};
    plan(
      name,
      () => fn({ ...opts, diagnostics: diag }),
      () => buildCoverageExtras(diag, points)
    );
  };
  for (const u of scanTargets) {
    // Probe points: path segments first, then query params
    // (extractProbePoints) — the battery mutates segments with the
    // same payloads and the same differential discipline as query
    // values (path-segment lane, 6 Nov 2026).
    const points = extractProbePoints(u, pathParamsByUrl.get(u));
    if (points.length === 0) continue;
    paramBatteryRan = true;
    // Stack gate input (9 Nov 2026, Zerodha FP fix): the error-SQLi
    // probe needs the fingerprinted tech so an engine-specific error
    // contradicting the stack (postgres on WordPress) never confirms.
    batteryStep('sqli-error', (o) => probeSqliError(u, points, { ...o, tech: fp?.tech }), points);
    batteryStep('sqli-blind', (o) =>
      probeBlindSqli(u, points, { ...o, dbHint: fp?.dbHint }), points);
    // UNION leg (row #277) + boolean-blind leg (row #278), 14 Nov 2026:
    // both are lab-gated inside their probes (non-lab targets return []
    // without a single request) and read-only (ORDER BY / SELECT /
    // TRUE-vs-FALSE comparisons, no writes).
    batteryStep('sqli-union', (o) =>
      probeSqliUnion(u, points, { ...o, dbHint: fp?.dbHint, labTargets }), points);
    batteryStep('sqli-boolean-blind', (o) =>
      probeBooleanBlindSqli(u, points, { ...o, labTargets }), points);
    batteryStep('hpp', (o) => probeHpp(u, points, { ...o, labTargets }), points);
    batteryStep('csv-log-injection', (o) => probeCsvLog(u, points, o), points);
    batteryStep('xss', async (o) => [...(await probeXssReflected(u, points, o)), ...(await probeXssUriScheme(u, points, o))], points);
    batteryStep('nosqli', (o) => probeNoSqli(u, points, o), points);
    batteryStep('nosql-deep', (o) => probeNoSqlDeep(u, points, { ...o, labTargets }), points);
    batteryStep('ldapi', (o) => probeLdapInjection(u, points, { ...o, stack: fp?.tech }), points);
    batteryStep('ldap-blind', (o) => probeLdapBlind(u, points, { ...o, stack: fp?.tech }), points);
    batteryStep('xpathi', (o) => probeXpathInjection(u, points, o), points);
    // BLIND XPATH INJECTION (9 Nov 2026, row #479 [High], CWE-643):
    // the sink evaluates injected XPath but suppresses engine
    // errors and caps the result set, so xpathi's widening/error
    // oracle never fires. This probe proves the boolean channel
    // instead: a TRUE/FALSE substring() pair differing only in the
    // compared character must diverge reproducibly, plus a second
    // independent witness (further substring() extraction, or a
    // string-length() pair when the equality fallback fires). See
    // blindXpath.js. Diagnostics ride the phase extras so a live
    // proof can tell "no oracle" from "oracle without witness".
    const blindXpathDiag = {};
    plan(
      'blind-xpath',
      () =>
        probeBlindXpath(u, points, {
          ...opts,
          diagnostics: blindXpathDiag,
        }),
      () => ({
        paramsTried: blindXpathDiag.paramsTried || 0,
        oracleParams: blindXpathDiag.oracleParams || 0,
        shape: blindXpathDiag.shape || null,
        extracted: blindXpathDiag.extracted || null,
        attempts: blindXpathDiag.attempts || 0,
        ...buildCoverageExtras(blindXpathDiag, points),
      })
    );
    // XML INJECTION (7 Nov 2026, row #214): a parameter spliced
    // raw into an XML document lets the attacker break out of the
    // element it sits in (structure breakout with a unique marker
    // element) or break parsing outright (malformed XML → parser
    // error). A finding counts only on the benign differential —
    // marker element in an XML-context response, or a parser error
    // signature absent from the benign response (see
    // xmlInjection.js). No DOCTYPE/entity payloads (xxe owns
    // those), no entity-expansion bombs (DoS-class, excluded).
    batteryStep('xml-injection', (o) => probeXmlInjection(u, points, o), points);
    batteryStep('ssi', (o) => probeSsiInjection(u, points, o), points);
    batteryStep('cmdi', (o) => probeCmdiTime(u, points, o), points);
    batteryStep('traversal', (o) => probeTraversal(u, points, o), points);
    // LOG POISONING TO RCE (14 Nov 2026, coverage row #337 [Critical]):
    // a canary in a log field (User-Agent, Referer fallback) included
    // through an LFI sink — confirms ONLY when the poisoned entry
    // executes (see logPoisoning.js). Lab-gated like rfi/xslt: the
    // probe writes attacker content into server logs.
    batteryStep('log-poisoning', (o) => probeLogPoisoning(u, points, { ...o, labTargets }), points);
    batteryStep('rfi', (o) => probeRfi(u, points, { ...o, labTargets }), points);
    batteryStep('xslt', (o) => probeXslt(u, points, { ...o, labTargets }), points);
    batteryStep('eval-injection', (o) => probeEvalInject(u, points, o), points);
    batteryStep('jsonp', (o) => probeJsonp(u, points, o), points);
    batteryStep('rpo', (o) => probeRpo(u, points, o), points);
    batteryStep('tabnabbing', (o) => probeTabnabbing(u, o), points);
    batteryStep('dangling-markup', (o) => probeDanglingMarkup(u, points, o), points);
    batteryStep('padding-oracle', (o) => probePaddingOracle(u, o), points);
    batteryStep('arg-injection', (o) => probeArgInjection(u, points, o), points);
    batteryStep('ssti', (o) => probeSsti(u, points, o), points);
    batteryStep('ssti-pebble', (o) => probeSstiPebble(u, points, o), points);
    batteryStep('el-injection', (o) => probeElInject(u, points, { ...o, stack: fp?.tech }), points);
    batteryStep('ognl-injection', (o) => probeOgnlInject(u, points, o), points);
    batteryStep('redirect', (o) => probeOpenRedirect(u, points, o), points);
    batteryStep('crlf', (o) => probeCrlf(u, points, o), points);
    // BLIND SSRF (14 Nov 2026, coverage rows #237 [High] + #311 — the
    // same concept filed twice): the metadata leg proves SSRF only
    // when fetched content comes back — a fetch that returns nothing
    // to the attacker can never confirm under it. The blind leg in
    // ssrf.js sends a collaborator canary URL as the param value and
    // confirms ONLY on a collaborator hit for the probe token with no
    // hit for a never-advertised control token. The control token is
    // never sent to the target (see ssrf.js header — a literal copy
    // of the ssrfReferer.js leg-1 control would reject genuinely
    // vulnerable param-fetchers). One collaborator per ssrf task — the battery
    // plans one task per scan target, and a task teardown would stop
    // a shared listener after the first task — started only when
    // this target is a lab host, always stopped afterwards in a
    // finally, so no listener outlives the scan. The probe re-checks
    // opts.labTargets before sending anything, and labTargets is
    // passed explicitly (the bare battery opts do not carry it).
    batteryStep('ssrf', async (o) => {
      let ssrfBlindOob = null;
      if (isLabTargetHost(u, labTargets)) {
        try {
          ssrfBlindOob = createOobCollaborator({
            listenHost: opts.oobListenHost || process.env.DM_OOB_LISTEN_HOST || '0.0.0.0',
            listenPort: opts.oobListenPort || (process.env.DM_OOB_PORT ? Number(process.env.DM_OOB_PORT) : 0),
            callbackHost: opts.oobCallbackHost || process.env.DM_OOB_CALLBACK_HOST || '172.17.0.1',
          });
          await ssrfBlindOob.start();
        } catch (e) {
          errors.push(`oob-collaborator: ${e && e.message ? e.message : String(e)}`);
          ssrfBlindOob = null;
        }
      }
      try {
        return await probeSsrf(u, points, {
          ...o,
          labTargets,
          ...(ssrfBlindOob
            ? { oobCallback: ssrfBlindOob.baseUrl(), oobWaitFor: (token, ms) => ssrfBlindOob.waitFor(token, ms) }
            : {}),
        });
      } finally {
        if (ssrfBlindOob) await ssrfBlindOob.stop();
      }
    }, points);
  }
  // 35/63 FIX: no param-bearing target existed, so the whole injection
  // battery was skipped in silence. Emit one skipped record per phase so
  // the audit trail (and the rollup) shows the gap instead of a clean pass.
  if (!paramBatteryRan) {
    for (const name of PARAM_BATTERY_PHASES) planSkip(name, 'no param targets');
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
  // Coverage diagnostic for the sqli-oob global cap (9 Nov 2026,
  // deep-coverage audit): the phase tries only the first 2 probe
  // points across ALL verb targets (each payload waits up to 8s on
  // the collaborator) — the extras name exactly which points were
  // attempted and which the cap skipped.
  let sqliOobCoverage = {};
  // The OOB collaborator stops via the task teardown (after the pool
  // runs this phase), not in a finally here — a finally would stop it
  // at plan time, before the phase ever executes.
  plan(
    'sqli-oob',
    async () => {
      const findings = [];
      const allPairs = [];
      for (const u of verbTargets) {
        for (const p of extractProbePoints(u, pathParamsByUrl.get(u))) {
          allPairs.push([u, p]);
        }
      }
      const pairs = allPairs.slice(0, 2);
      sqliOobCoverage = buildCoverageExtras(
        { pointsAttempted: pairs.map(([, p]) => probePointParameter(p)) },
        allPairs.map(([, p]) => p)
      );
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
    },
    () => sqliOobCoverage,
    { teardown: sqliOob ? () => sqliOob.stop() : undefined }
  );
  if (verbTargets.length > 0) {
    plan('verb-tampering', () => probeVerbTampering(verbTargets, { ...opts, allowWrite }));
  } else {
    planSkip('verb-tampering', 'no probe targets');
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
    plan('method-override', () =>
      probeMethodOverride(verbTargets, postForms, { ...opts, allowWrite })
    );
  } else {
    planSkip('method-override', 'no probe targets');
  }
  // SECRETS IN CLIENT-SIDE JS (7 Nov 2026, row #179): scan the
  // page's same-origin script bundles + inline <script> blocks for
  // high-confidence secret formats (known-format keys/tokens, JWTs,
  // PEM blocks, DB URIs, high-entropy assignments). Read-only GETs
  // of the page's own bundles — no allowWrite gate. The targets come
  // from the page body page-analyze already fetched, so a script-less
  // page records a skip instead of fetching (gated-skip pattern).
  // opts.jsRoutesFetcher is the test seam, mirroring js-api-routes.
  // SITE MODE (9 Nov 2026): mine every discovered page's bundles +
  // inline scripts, merged under the same caps as the single-page
  // path (5 bundles, 10 inline blocks — the probes slice to these
  // anyway), so secrets-in-js / browser-storage / DOM-sink tier-1 /
  // captcha mining covers the whole site, not just the landing page.
  // KNOWN LIMIT: js-api-routes still mines the pasted page's bundles
  // only — discovered pages' API routes are covered because their
  // links/forms join scanTargets and the param battery tries them.
  const secretTargets = (() => {
    if (scanScope === 'site' && crawled && Array.isArray(crawled.pages) && crawled.pages.length > 1) {
      const bundles = [];
      const inline = [];
      for (const p of crawled.pages) {
        if (!p.body) continue;
        const t = extractSecretTargets(p.body, p.url);
        for (const b of t.bundles || []) if (!bundles.includes(b)) bundles.push(b);
        for (const s of t.inline || []) inline.push(s);
      }
      return { bundles: bundles.slice(0, 5), inline: inline.slice(0, 10) };
    }
    return pageBody && typeof pageBody === 'string'
      ? extractSecretTargets(pageBody, url)
      : { bundles: [], inline: [] };
  })();
  // SITE MODE (9 Nov 2026): the CSS probe mines page HTML for inline
  // styles — in site mode it gets every discovered page's HTML,
  // joined with a per-page marker comment. The ±300-char near-sink
  // window can in theory span a page boundary; a sink still only
  // confirms via the tier-2 CDP drive on the pasted page, so no false
  // finding can come from the merge — at most a diagnostics count.
  const sitePageBody =
    scanScope === 'site' && crawled && Array.isArray(crawled.pages) && crawled.pages.length > 1
      ? crawled.pages.map((p) => `<!-- site-crawl page: ${p.url} -->\n${p.body || ''}`).join('\n')
      : null;
  if (secretTargets.bundles.length > 0 || secretTargets.inline.length > 0) {
    plan('secrets-in-js', () =>
      probeSecretsInJs(url, secretTargets, {
        ...opts,
        ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
      })
    );
  } else {
    planSkip('secrets-in-js', 'no script targets');
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
    plan('browser-storage', () =>
      probeBrowserStorage(url, secretTargets, {
        ...opts,
        ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
      })
    );
  } else {
    planSkip('browser-storage', 'no script targets');
  }
  // AUTOCOMPLETE (9 Nov 2026, row #483 [Low] Autocomplete enabled on
  // sensitive fields, CWE-200 / CWE-525 | OWASP WSTG v4.2): a password,
  // payment-card, secret/token, SSN, PIN or card-expiry input with no
  // autocomplete="off" lets the browser store the value in form
  // history and re-offer it (see autocomplete.js). Static served-HTML
  // check on the page body page-analyze already fetched — in site
  // mode the merged body of every discovered page — so a page with
  // no body at all records a skip instead of running. No lab gate,
  // no allowWrite gate, all depths: the check is read-only on a body
  // the scan already holds. Diagnostics ride the phase extras
  // (inputsScanned, sensitiveInputs, unprotectedInputs) so a live
  // proof can tell "no inputs" from "inputs, all protected" without
  // re-running the scan. DVWA's server-rendered login form carries a
  // password input with no autocomplete attribute, so its leg is
  // expected to be 1 real [Low] finding; Juice Shop's served shell
  // carries no inputs, so its leg is expected to be a true negative.
  const acDiag = {};
  if (pageBody && typeof pageBody === 'string') {
    plan(
      'autocomplete',
      () =>
        probeAutocomplete(url, sitePageBody || pageBody, {
          ...opts,
          diagnostics: acDiag,
        }),
      () => ({
        inputsScanned: acDiag.inputsScanned || 0,
        sensitiveInputs: acDiag.sensitiveInputs || 0,
        unprotectedInputs: acDiag.unprotectedInputs || 0,
      })
    );
  } else {
    planSkip('autocomplete', 'no page body');
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
    plan('dom-xss-sinks', () =>
      probeDomXssSinks(url, secretTargets, {
        ...opts,
        ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
      })
    );
  } else {
    planSkip('dom-xss-sinks', 'no script targets');
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
    plan(
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
    planSkip('dom-xss-location-hash', 'no script targets');
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
    plan(
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
    planSkip('dom-postmessage', 'no script targets');
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
    plan(
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
    planSkip('csti', 'no script targets');
  }
  // CSTI FRAMEWORK VARIANTS (9 Nov 2026, rows #452–#455 [High]
  // CWE-94/CWE-79): the #190 probe mines for ANY runtime template
  // engine; this phase fires ONLY when a matching client-side
  // template framework is fingerprinted first — AngularJS (#452),
  // Vue (#453), Knockout / Handlebars (#454), React (#455) — in
  // first-party code + the served page HTML (ng-app / data-bind /
  // v- directives live in HTML, not in bundles). Zero frameworks
  // is a proven true negative recorded with skipReason 'no matching
  // framework', never a vacuous pass: Juice Shop is modern Angular
  // (compiled templates, ng-version / app-root, never
  // angular.module or ng-app) and DVWA has no framework, so both
  // labs are expected true negatives here. When a framework IS
  // fingerprinted, the phase drives the pasted page in a real
  // browser (same transient-container + fixed-CDP pattern as csti)
  // with the {{7*7*191}} canary for template frameworks (the #190
  // drive, reused) or the <i data-dmreact="9352">x</i> HTML canary
  // for React, and confirms ONLY when the oracle holds — see
  // cstiFrameworks.js. Lab-gated like csti (labCreds + allowWrite
  // + lab host + depth !== 'quick'), so the drives never run
  // outside the lab gate; framework presence alone never fires.
  const cstiFwDiag = {};
  if (secretTargets.bundles.length > 0 || secretTargets.inline.length > 0) {
    plan(
      'csti-frameworks',
      () =>
        probeCstiFrameworks(url, secretTargets, {
          ...opts,
          allowWrite,
          labTargets,
          pageBody: sitePageBody || pageBody,
          diagnostics: cstiFwDiag,
          ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
        }),
      () => ({
        frameworks: cstiFwDiag.frameworks || 0,
        frameworkKinds: cstiFwDiag.frameworkKinds || '',
        frameworkDetected: Boolean(cstiFwDiag.frameworkDetected),
        reactSink: Boolean(cstiFwDiag.reactSink),
        driveAttempted: Boolean(cstiFwDiag.driveAttempted),
        driveExecuted: Boolean(cstiFwDiag.driveExecuted),
        driveKind: cstiFwDiag.driveKind || '',
        skipReason: cstiFwDiag.skipReason || '',
      })
    );
  } else {
    planSkip('csti-frameworks', 'no script targets');
  }
  // CAPTCHA BYPASS (9 Nov 2026, row #40 [Medium] Technique (no
  // single CVE) | OWASP A07:2021): mines first-party code for
  // CAPTCHA services and, only when a solvable math CAPTCHA exists
  // (Juice Shop feedback form — GET /rest/captcha/ returns a math
  // expression the probe computes, never the leaked answer field),
  // drives the feedback flow: control with a solved CAPTCHA, then
  // a missing-CAPTCHA submission, then a wrong-answer submission,
  // and confirms ONLY when the control was accepted AND a bypass
  // submission was accepted with the same success signal (see
  // captcha.js). Lab-gated like csti (labCreds + allowWrite + lab
  // host + depth !== 'quick'); an image CAPTCHA is noted, never
  // driven, and zero CAPTCHA surfaces is a proven true negative
  // with no drive at all. 'Missing CAPTCHA on login' is never a
  // finding — it would double-count credential stuffing (#42).
  const capDiag = {};
  if (secretTargets.bundles.length > 0 || secretTargets.inline.length > 0) {
    plan(
      'captcha',
      () =>
        probeCaptcha(url, secretTargets, {
          ...opts,
          allowWrite,
          apiRoutes: [...scanTargets, ...jsWriteTargets],
          labTargets,
          diagnostics: capDiag,
          ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
        }),
      () => ({
        captchaSurfaces: capDiag.captchaSurfaces || 0,
        mathSurfaces: capDiag.mathSurfaces || 0,
        imageSurfaces: capDiag.imageSurfaces || 0,
        genericSurfaces: capDiag.genericSurfaces || 0,
        feedbackRoutes: capDiag.feedbackRoutes || 0,
        controlOk: Boolean(capDiag.controlOk),
        attempts: capDiag.attempts || 0,
        bypassKind: capDiag.bypassKind || null,
      })
    );
  } else {
    planSkip('captcha', 'no script targets');
  }
  // CSS INJECTION (9 Nov 2026, row #194 [Medium] CWE-79): the
  // served page itself is the primary surface — an inline `style`
  // attribute or a `<style>` block the server reflects input into —
  // so this phase mines the page HTML for CSS contexts AND the
  // first-party bundles / inline scripts for runtime CSS writes
  // (cssText, style-property assignments, setAttribute('style', …),
  // insertRule), and, only when a sink exists, navigates the pasted
  // page in a real browser (transient container + fixed CDP
  // endpoint, same pattern as renderDomAuthenticated) with the CSS
  // canary in the query string and then in the fragment, and
  // confirms ONLY when the canary changes a computed style
  // (control clean, same element carries the marker colour in two
  // renders) — see cssInjection.js. Sink presence alone never
  // fires. Lab-gated like csti (labCreds + allowWrite + lab host +
  // depth !== 'quick'), so the drive never runs outside the lab
  // gate; zero CSS contexts is a proven true negative with no drive
  // at all. Unlike the JS-only probes this step is NOT gated on
  // secretTargets: a server-rendered page with zero JS can still
  // reflect input into a style attribute, and gating on scripts
  // would leave exactly that surface untested (DVWA serves no JS).
  // The probe needs no apiRoutes — it navigates the pasted page
  // URL only and fetches the page's own script bundles.
  const cssDiag = {};
  plan(
    'css-injection',
    () =>
      probeCssInjection(url, secretTargets, {
        ...opts,
        allowWrite,
        labTargets,
        pageBody: sitePageBody || pageBody,
        diagnostics: cssDiag,
        ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
      }),
    () => ({
      cssSinks: cssDiag.cssSinks || 0,
      cssNearSink: cssDiag.cssNearSink || 0,
      driveAttempted: Boolean(cssDiag.driveAttempted),
      driveExecuted: Boolean(cssDiag.driveExecuted),
    })
  );
  // MUTATION XSS (9 Nov 2026, row #116 [High] CWE-79): sanitizer-
  // approved markup re-parsed by the browser into executable
  // markup. This phase mines first-party code for HTML-write
  // assignments (innerHTML / outerHTML / insertAdjacentHTML /
  // document.write) and, only when one exists, navigates the pasted
  // page in a real browser (transient container + fixed CDP
  // endpoint, same pattern as renderDomAuthenticated) with a
  // mutation canary in the query string and then in the fragment,
  // and confirms ONLY when the canary executes in two renders with
  // a clean control — see mutationXss.js. The canaries are inert
  // under a single conforming HTML parse, so execution implies the
  // page's handling re-parsed them (a sanitizer round-trip). Sink
  // presence alone never fires. Lab-gated like css-injection
  // (labCreds + allowWrite + lab host + depth !== 'quick'), so the
  // drive never runs outside the lab gate; zero HTML-write sinks
  // is a proven true negative with no drive at all. Unlike
  // css-injection this step IS gated on secretTargets: the probe
  // mines JS only (no served-HTML surface), so a script-less page
  // has nothing to mine and the phase skips with 'no script
  // targets' instead of running an empty mine. The probe needs no
  // apiRoutes — it navigates the pasted page URL only and fetches
  // the page's own script bundles.
  const mxssDiag = {};
  if (secretTargets.bundles.length > 0 || secretTargets.inline.length > 0) {
    plan(
      'mutation-xss',
      () =>
        probeMutationXss(url, secretTargets, {
          ...opts,
          allowWrite,
          labTargets,
          pageBody,
          diagnostics: mxssDiag,
          ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
        }),
      () => ({
        mxssSinks: mxssDiag.mxssSinks || 0,
        mxssNearSink: mxssDiag.mxssNearSink || 0,
        driveAttempted: Boolean(mxssDiag.driveAttempted),
        driveExecuted: Boolean(mxssDiag.driveExecuted),
      })
    );
  } else {
    planSkip('mutation-xss', 'no script targets');
  }
  // DOM-BASED OPEN REDIRECTION (9 Nov 2026, row #91 [Medium]
  // CWE-601): dom-xss-sinks fingerprints sinks statically and the
  // other DOM probes drive canaries at other DOM sources; this
  // phase goes after the fifth DOM source — it mines first-party
  // code for redirect sinks (location.assign / location.replace /
  // location.href = / window.open) fed by a location parameter
  // and, only when one exists, navigates the pasted page in a real
  // browser (transient container + fixed CDP endpoint, same
  // pattern as renderDomAuthenticated) with a control value and
  // then a canary redirect target (https://evil.example/… — the
  // .example TLD never resolves, so the navigation is observable
  // without reaching a real server), and confirms ONLY when the
  // browser navigates to the canary target — see
  // domOpenRedirect.js. Sink presence alone never fires.
  // Lab-gated like dom-postmessage (labCreds + allowWrite + lab
  // host + depth !== 'quick'), so the drive never runs outside the
  // lab gate; a sink fed by a hardcoded string drives but cannot
  // navigate, and zero sinks is a proven true negative with no
  // drive at all.
  const orDiag = {};
  if (secretTargets.bundles.length > 0 || secretTargets.inline.length > 0) {
    plan(
      'dom-open-redirect',
      () =>
        probeDomOpenRedirect(url, secretTargets, {
          ...opts,
          allowWrite,
          labTargets,
          diagnostics: orDiag,
          ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
        }),
      () => ({
        redirectSinks: orDiag.redirectSinks || 0,
        redirectNearSink: orDiag.redirectNearSink || 0,
        driveAttempted: Boolean(orDiag.driveAttempted),
        driveExecuted: Boolean(orDiag.driveExecuted),
      })
    );
  } else {
    planSkip('dom-open-redirect', 'no script targets');
  }
  // DOM CLOBBERING (9 Nov 2026, row #89 [Medium] Technique (no
  // single CVE) | PortSwigger DOM): this phase mines first-party
  // code for global reads feeding a sink (a URL assignment, an
  // HTML sink, an eval sink) and the served page for id=/name=
  // attributes proving a global IS clobberable by markup, and,
  // only when a sink-feeding read exists, loads the pasted page in
  // a real browser (transient container + fixed CDP endpoint, same
  // pattern as renderDomAuthenticated), injects a crafted element
  // (`<a id="<global>" href="https://evil.example/…">`) the way
  // attacker-injected markup would, and confirms ONLY when
  // window.<global> resolves to the injected node AND a sink
  // consumes it (the canary URL on another element, a navigation
  // to the canary, or the element's markup re-inserted) — see
  // domClobbering.js. Clobbering without consumption is NEVER a
  // finding. Lab-gated like dom-open-redirect (labCreds +
  // allowWrite + lab host + depth !== 'quick'), so the drive never
  // runs outside the lab gate; zero sink-feeding reads is a proven
  // true negative with no drive at all.
  const clobDiag = {};
  if (secretTargets.bundles.length > 0 || secretTargets.inline.length > 0) {
    plan(
      'dom-clobbering',
      () =>
        probeDomClobbering(url, secretTargets, {
          ...opts,
          allowWrite,
          labTargets,
          pageBody,
          diagnostics: clobDiag,
          ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
        }),
      () => ({
        clobberSinks: clobDiag.clobberSinks || 0,
        clobberNearSink: clobDiag.clobberNearSink || 0,
        driveAttempted: Boolean(clobDiag.driveAttempted),
        driveExecuted: Boolean(clobDiag.driveExecuted),
      })
    );
  } else {
    planSkip('dom-clobbering', 'no script targets');
  }
  // DOM-BASED COOKIE MANIPULATION (9 Nov 2026, row #90 [Medium]
  // Technique (no single CVE) | PortSwigger DOM): this phase mines
  // first-party code for document.cookie writes fed by a location
  // parameter and, only when one exists, drives the pasted page in
  // a real browser WITH the hunt's lab session (acquired once by
  // the dom-render step — reusing it spends no extra login POST),
  // navigating with a control value and then a canary value and
  // snapshotting document.cookie after each navigation, and
  // confirms ONLY when a sensitive cookie (session / auth / token
  // / CSRF) carries the canary marker in the canary render and
  // does not in the control render — the control render is the
  // baseline differential that separates DOM-set cookies from
  // server-set ones — see domCookieManipulation.js. A write into a
  // non-sensitive cookie is never a finding. Lab-gated like
  // dom-clobbering (labCreds + allowWrite + lab host + depth !==
  // 'quick'); without a lab session the drive is not attempted
  // (the authenticated surface was never reached, never a false
  // true negative), and zero cookie writes is a proven true
  // negative with no drive at all.
  const ckDiag = {};
  if (secretTargets.bundles.length > 0 || secretTargets.inline.length > 0) {
    plan(
      'dom-cookie-manipulation',
      () =>
        probeDomCookieManipulation(url, secretTargets, {
          ...opts,
          allowWrite,
          labTargets,
          session: authSession && authSession.ok ? authSession.session : null,
          diagnostics: ckDiag,
          ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
        }),
      () => ({
        cookieSinks: ckDiag.cookieSinks || 0,
        cookieNearSink: ckDiag.cookieNearSink || 0,
        sessionOk: Boolean(ckDiag.sessionOk),
        driveAttempted: Boolean(ckDiag.driveAttempted),
        driveExecuted: Boolean(ckDiag.driveExecuted),
      })
    );
  } else {
    planSkip('dom-cookie-manipulation', 'no script targets');
  }
  // DOCUMENT.DOMAIN RELAXATION (9 Nov 2026, row #484 [Low] SOP —
  // document.domain relaxation, CWE-668): dom-xss-sinks fingerprints
  // sinks statically and the DOM trio drives canaries only when
  // their sink exists; this phase mines first-party code for
  // `document.domain =` assignments and confirms ONLY on an
  // observed string-literal assignment to a parent suffix of the
  // page host (see documentDomain.js). Static mining only — no lab
  // gate, no writes — reuses secretTargets (same gate as
  // dom-xss-sinks, so a script-less page records a skip instead of
  // fetching). Diagnostics ride the phase extras
  // (domainRelaxations, unresolvedAssignments, noopAssignments,
  // invalidAssignments) so a live proof can tell "no assignments"
  // from "assignments that do not relax" without re-running.
  const ddDiag = {};
  if (secretTargets.bundles.length > 0 || secretTargets.inline.length > 0) {
    plan(
      'document-domain',
      () =>
        probeDocumentDomain(url, secretTargets, {
          ...opts,
          diagnostics: ddDiag,
          ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
        }),
      () => ({
        domainRelaxations: ddDiag.domainRelaxations || 0,
        unresolvedAssignments: ddDiag.unresolvedAssignments || 0,
        noopAssignments: ddDiag.noopAssignments || 0,
        invalidAssignments: ddDiag.invalidAssignments || 0,
      })
    );
  } else {
    planSkip('document-domain', 'no script targets');
  }
  // DEEP-LINK / URL-SCHEME HIJACKING (10 Nov 2026, row #510 [High]
  // Deep-link / URL-scheme hijacking + parameter injection,
  // CWE-939): first-party JS that reads a URL parameter and
  // forwards it into a custom-scheme deep link (location.href,
  // window.open, iframe src) lets any site invoke the app with
  // attacker-chosen parameters (see deepLink.js). Static mining
  // only — no lab gate, no writes — reuses secretTargets (same
  // gate as document-domain, so a script-less page records a
  // skip instead of fetching). Diagnostics ride the phase extras
  // (bundlesScanned, schemesFound, sinksFound, flowsConfirmed).
  const dlDiag = {};
  if (secretTargets.bundles.length > 0 || secretTargets.inline.length > 0) {
    plan(
      'deep-link',
      () =>
        probeDeepLink(url, secretTargets, {
          ...opts,
          diagnostics: dlDiag,
          ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
        }),
      () => ({
        bundlesScanned: dlDiag.bundlesScanned || 0,
        schemesFound: dlDiag.schemesFound || [],
        sinksFound: dlDiag.sinksFound || 0,
        flowsConfirmed: dlDiag.flowsConfirmed || 0,
      })
    );
  } else {
    planSkip('deep-link', 'no script targets');
  }
  // WEBVIEW JAVASCRIPT BRIDGE ABUSE (10 Nov 2026, row #511 [High]
  // WebView JavaScript bridge abuse, CWE-749): a bridge object
  // exposed to web content that reachable tainted input can call
  // lets a page drive native functionality (see
  // webviewBridge.js). Static mining only — same secretTargets
  // gate as deep-link. Diagnostics ride the phase extras
  // (bundlesScanned, bridgesRegistered, callSites,
  // reachableCalls).
  const wvDiag = {};
  if (secretTargets.bundles.length > 0 || secretTargets.inline.length > 0) {
    plan(
      'webview-bridge',
      () =>
        probeWebViewBridge(url, secretTargets, {
          ...opts,
          diagnostics: wvDiag,
          ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
        }),
      () => ({
        bundlesScanned: wvDiag.bundlesScanned || 0,
        bridgesRegistered: wvDiag.bridgesRegistered || 0,
        callSites: wvDiag.callSites || 0,
        reachableCalls: wvDiag.reachableCalls || 0,
      })
    );
  } else {
    planSkip('webview-bridge', 'no script targets');
  }
  // WEBRTC LOCAL IP LEAKAGE (9 Nov 2026, row #459 [Low] Browser —
  // WebRTC local IP leakage, CWE-200): drive the pasted page in a
  // real headless browser (same transient-container + fixed-loopback
  // CDP pattern as the DOM trio) and gather ICE candidates with an
  // RTCPeerConnection that uses NO STUN/TURN servers — host
  // candidates only, so no public IP is ever exposed and no
  // external server is contacted. Flag literal RFC1918 /
  // link-local / IPv6-ULA host-candidate addresses (see
  // webrtcLeak.js); mDNS-masked (.local) candidates are the
  // modern-browser true negative. Lab-gated like the DOM trio
  // (labCreds + allowWrite + lab host + depth !== 'quick'): the
  // drive executes JS in the target page. Diagnostics ride the
  // phase extras (candidatesCollected, rfc1918Found,
  // mdnsCandidates, driveAttempted, driveExecuted) so a live proof
  // can tell "no candidates gathered" (uncalibrated) from
  // "gathered and clean" without re-running the scan.
  const wrDiag = {};
  plan(
    'webrtc-leak',
    () =>
      probeWebrtcLeak(url, {
        ...opts,
        allowWrite,
        labTargets,
        diagnostics: wrDiag,
      }),
    () => ({
      candidatesCollected: wrDiag.candidatesCollected || 0,
      rfc1918Found: wrDiag.rfc1918Found || 0,
      mdnsCandidates: wrDiag.mdnsCandidates || 0,
      driveAttempted: Boolean(wrDiag.driveAttempted),
      driveExecuted: Boolean(wrDiag.driveExecuted),
    })
  );
  // SERVICE WORKER CACHE POISONING (9 Nov 2026, row #460 [Medium]
  // Browser — service worker cache poisoning, CWE-444): Juice Shop
  // is a PWA with a registered worker, so this phase mines
  // first-party code for worker registrations and cache-write
  // sinks, then — only when a poisonable sink exists and the lab
  // gate passes — drives the poison oracle in a real browser
  // (control render + poison render, see swCachePoisoning.js).
  // Tier 1 is read-only mining (no lab gate, same as
  // document-domain); tier 2 is lab-gated like the DOM trio.
  // Diagnostics ride the phase extras (swRegistered, swScripts,
  // cacheWriteSinks, fetchHandlerPuts, keyNormalizedSinks,
  // driveAttempted, driveExecuted) so a live proof can tell "no
  // worker" from "worker with no poisonable write" from "drive
  // never served the poison" without re-running.
  const swDiag = {};
  if (secretTargets.bundles.length > 0 || secretTargets.inline.length > 0) {
    plan(
      'sw-cache-poisoning',
      () =>
        probeSwCachePoisoning(url, secretTargets, {
          ...opts,
          apiRoutes: [...scanTargets, ...jsWriteTargets],
          diagnostics: swDiag,
          ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
        }),
      () => ({
        swRegistered: Boolean(swDiag.swRegistered),
        swScripts: swDiag.swScripts || 0,
        cacheWriteSinks: swDiag.cacheWriteSinks || 0,
        fetchHandlerPuts: swDiag.fetchHandlerPuts || 0,
        keyNormalizedSinks: swDiag.keyNormalizedSinks || 0,
        driveAttempted: Boolean(swDiag.driveAttempted),
        driveExecuted: Boolean(swDiag.driveExecuted),
      })
    );
  } else {
    planSkip('sw-cache-poisoning', 'no script targets');
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
    plan('error-disclosure', () => probeErrorDisclosure(verbTargets, opts));
  } else {
    planSkip('error-disclosure', 'no probe targets');
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
    plan('validation', () =>
      probeValidation(verbTargets, forms, {
        ...opts,
        allowWrite,
        pathParamsByUrl,
        pageUrl: url,
      })
    );
  } else {
    planSkip('validation', 'no probe targets');
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
  plan('fingerprint-banner', () => probeFingerprintBanner(url, verbTargets, opts));
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
  plan('source-code-disclosure', () => probeSourceCodeDisclosure(url, verbTargets, opts));
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
  plan('metadata-leakage', () => probeMetadataLeakage(url, verbTargets, opts));
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
  plan('sensitive-data-in-logs', () => probeSensitiveDataInLogs(url, verbTargets, opts));
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
  plan('sensitive-info-disclosure', () => probeSensitiveInfoDisclosure(url, verbTargets, opts));
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
  plan('timing-side-channel', () => probeTimingSideChannel(forms, url, opts));
  plan('csrf', () => probeCsrf(forms, url));
  // Stack gate input (9 Nov 2026, Zerodha FP fix): same as sqli-error
  // — the POST form battery needs the fingerprinted tech.
  plan('post-forms', () => probePostForms(postForms, { ...opts, tech: fp?.tech }));
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
  plan(
    'smtp-injection',
    () =>
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
      }),
    undefined,
    { teardown: smtpInbox ? () => smtpInbox.stop() : undefined }
  );
  // T4b (bearer/API login) needs the already-discovered route set —
  // wired in here from scanTargets (crawl + openapi + jsRoutes-mined),
  // no new discovery phase. T4b never fires on the SPA-root HTML alone.
  // D2 (#474 repair): labTargets is passed explicitly — the probe's
  // isLab reads opts.labTargets, and runScan's spec field never
  // reached opts before. D3: the POST-only mined routes ride along
  // as API-login candidates (never as GET probe targets).
  plan('session-fixation', () => probeSessionFixation(forms, url, { ...opts, apiRoutes: [...scanTargets, ...jsWriteTargets], labTargets }));
  // BASKET LOGIC (8 Nov 2026, rows #82/#370, variants #374/#80/#83):
  // negative-quantity / price / overflow manipulation of a shop
  // basket, confirmed by a pure-arithmetic total differential with
  // a +1 control (see basketLogic.js). Same apiRoutes wiring as
  // session-fixation (T4b) — the mined basket endpoints reach the
  // probe only through the discovered route set, never invented.
  // Diagnostics ride the phase extras (basketRoutes, basketId,
  // controlOk, mutations, bailStage, seedProductId, seedAttempts)
  // so a live proof can tell "no surface" from "oracle
  // uncalibrated" without re-running the scan — and can see
  // exactly which stage bailed (10 Nov 2026, proof #40: the seed
  // and the control both bailed silently on an out-of-stock
  // cheapest product, and the record could not say which).
  const blDiag = {};
  plan(
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
      bailStage: blDiag.bailStage || null,
      seedProductId: blDiag.seedProductId || null,
      seedAttempts: blDiag.seedAttempts || 0,
    }),
    { exclusive: LAB_BASKET }
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
  plan(
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
      bailStage: wsDiag.bailStage || null,
    }),
    { exclusive: LAB_BASKET }
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
  plan(
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
  plan(
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
  // ANTI-AUTOMATION (10 Nov 2026, row #79 [Medium], CWE-799 |
  // OWASP A07:2021): a login that answers machine-speed password
  // attempts with ordinary invalid-credential replies and never
  // puts a bot challenge in the way — confirm only when 10
  // distinct fixed wrong passwords are each answered ordinarily
  // with no CAPTCHA widget, no challenge page, no JS-challenge
  // marker and no throttle signal anywhere (see
  // antiAutomation.js). The oracle reuses credential-stuffing's
  // login evidence surface and calibration; the bot-challenge
  // detector is the #79-specific part (challenge widgets and
  // interstitial wording that never contain the word 'captcha').
  // Same apiRoutes wiring as credential-stuffing. Diagnostics ride
  // the phase extras (loginRoutes, controlOk, attempts,
  // botChallengeSeen, botChallengeKind) so a live proof can tell
  // "no surface" from "defense exists" without re-running the scan.
  const aaDiag = {};
  plan(
    'anti-automation',
    () =>
      probeAntiAutomation(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: aaDiag,
      }),
    () => ({
      loginRoutes: aaDiag.loginRoutes || 0,
      controlOk: Boolean(aaDiag.controlOk),
      attempts: aaDiag.attempts || 0,
      botChallengeSeen: Boolean(aaDiag.botChallengeSeen),
      botChallengeKind: aaDiag.botChallengeKind || null,
    })
  );
  // BFLA (9 Nov 2026, row #340 [High], CWE-862 | OWASP API05:2023):
  // a low-privilege session that can invoke an admin-only API
  // function proves missing function-level authorization — the
  // probe runs a three-way differential on each mined admin route
  // (no-token GET must be refused, admin-token GET is the control,
  // low-privilege-token GET confirms only when granted with a
  // substantive body at least half the control body's length),
  // using a throwaway self-registered low-privilege account (see
  // bfla.js). Same apiRoutes wiring as credential-stuffing.
  // Diagnostics ride the phase extras (adminRoutes, registerOk,
  // controlOk, attempts, bypassKind) so a live proof can tell "no
  // surface" from "oracle uncalibrated" without re-running the scan.
  const bflaDiag = {};
  plan(
    'bfla',
    () =>
      probeBfla(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: bflaDiag,
      }),
    () => ({
      adminRoutes: bflaDiag.adminRoutes || 0,
      registerOk: Boolean(bflaDiag.registerOk),
      controlOk: Boolean(bflaDiag.controlOk),
      attempts: bflaDiag.attempts || 0,
      bypassKind: bflaDiag.bypassKind || null,
    })
  );
  // WEAK PASSWORD POLICY (9 Nov 2026, row #55 [Medium] Weak
  // Password Policy, CWE-521 | ASVS V6): a registration endpoint
  // that accepts a trivial password proves the password policy is
  // weak — the probe calibrates with a strong-password control
  // registration first, then tries 'a', '123456' and 'password',
  // confirming only when a trivial password registers on the same
  // route the control succeeded on (see weakPasswordPolicy.js).
  // Same apiRoutes wiring as bfla. Diagnostics ride the phase
  // extras (registerRoutes, controlOk, attempts, acceptedKind,
  // bypassKind) so a live proof can tell "no surface" from "oracle
  // uncalibrated" without re-running the scan.
  const wppDiag = {};
  plan(
    'weak-password-policy',
    () =>
      probeWeakPasswordPolicy(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: wppDiag,
      }),
    () => ({
      registerRoutes: wppDiag.registerRoutes || 0,
      controlOk: Boolean(wppDiag.controlOk),
      attempts: wppDiag.attempts || 0,
      acceptedKind: wppDiag.acceptedKind || null,
      bypassKind: wppDiag.bypassKind || null,
    })
  );
  // BUSINESS-FLOW ACCESS (9 Nov 2026, row #86 [High] Unrestricted
  // Access to Sensitive Business Flows, CWE-840 | OWASP API6:2023):
  // a basket is a sensitive business flow that belongs to exactly
  // one user — the server must enforce ownership on the
  // client-supplied basket id. The probe runs a three-way
  // differential on the mined basket GET route (no-token GET must be
  // refused, victim-token GET is the control with the seeded marker
  // item visible, canary-token GET of the SAME victim basket
  // confirms only when granted with the victim's basket id and the
  // marker present, while the canary's own basket reads empty),
  // using the labCreds account as the victim and a throwaway
  // self-registered account as the canary (see
  // businessFlowAccess.js). This is NOT the BFLA probe (#340):
  // BFLA replays admin endpoints as low-priv; this row is ownership
  // on a business flow — the same low-priv user reaching ANOTHER
  // USER'S basket. Same apiRoutes wiring as bfla. Diagnostics ride
  // the phase extras (basketRoutes, registerOk, victimSeeded,
  // controlOk, attempts, bypassKind) so a live proof can tell "no
  // surface" from "oracle uncalibrated" without re-running the scan.
  const bfaDiag = {};
  plan(
    'business-flow-access',
    () =>
      probeBusinessFlowAccess(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: bfaDiag,
      }),
    () => ({
      basketRoutes: bfaDiag.basketRoutes || 0,
      registerOk: Boolean(bfaDiag.registerOk),
      victimSeeded: Boolean(bfaDiag.victimSeeded),
      controlOk: Boolean(bfaDiag.controlOk),
      attempts: bfaDiag.attempts || 0,
      bypassKind: bfaDiag.bypassKind || null,
      bailStage: bfaDiag.bailStage || null,
      seedProductId: bfaDiag.seedProductId || null,
    }),
    { exclusive: LAB_BASKET }
  );
  // COUPON ABUSE (9 Nov 2026, rows #78 [Medium] Coupon / Discount /
  // Referral Abuse and #371 [Medium] Logic — Coupon / voucher reuse
  // abuse, CWE-840 | OWASP A04:2021): a coupon the server applies
  // more than it should — the same single-use code discounting a
  // fresh basket again, or a second code stacking on top of the
  // first. The probe calibrates with a control apply first (the
  // total must drop), then tests reuse on a fresh basket and
  // stacking against the single-coupon floor (see couponAbuse.js).
  // Same apiRoutes wiring as bfla. Diagnostics ride the phase
  // extras (couponRoutes, couponCodes, controlOk, attempts,
  // bypassKind) so a live proof can tell "no surface" from
  // "oracle uncalibrated" without re-running the scan.
  const couponDiag = {};
  plan(
    'coupon-abuse',
    () =>
      probeCouponAbuse(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: couponDiag,
      }),
    () => ({
      couponRoutes: couponDiag.couponRoutes || 0,
      couponCodes: couponDiag.couponCodes || 0,
      controlOk: Boolean(couponDiag.controlOk),
      attempts: couponDiag.attempts || 0,
      bypassKind: couponDiag.bypassKind || null,
    }),
    { exclusive: LAB_BASKET }
  );
  // API TOKEN AUTH (9 Nov 2026, row #342 [High] API — Broken
  // authentication (token in URL / weak tokens), CWE-287 | OWASP
  // API02:2023): an API token the app itself puts in a URL query
  // string, or a token the server issues weak — static across
  // logins, short numeric, or a trivial derivation of the
  // username. The probe mines token-param API routes and runs a
  // three-way differential (no-token must refuse, header-token is
  // the control, query-token confirms only when granted with a
  // substantive body), then logs in twice and judges the issued
  // tokens (opaque only — JWTs are jwt.js territory; see
  // apiTokenAuth.js). Same apiRoutes wiring as bfla. Diagnostics
  // ride the phase extras (tokenUrlRoutes, tokenKind, tokenLen,
  // tokensCompared, controlOk, attempts, bypassKind) so a live
  // proof can tell "no surface" from "oracle uncalibrated"
  // without re-running the scan.
  const apiTokenDiag = {};
  plan(
    'api-token-auth',
    () =>
      probeApiTokenAuth(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: apiTokenDiag,
      }),
    () => ({
      tokenUrlRoutes: apiTokenDiag.tokenUrlRoutes || 0,
      tokenKind: apiTokenDiag.tokenKind || null,
      tokenLen: apiTokenDiag.tokenLen || 0,
      tokensCompared: apiTokenDiag.tokensCompared || 0,
      controlOk: Boolean(apiTokenDiag.controlOk),
      attempts: apiTokenDiag.attempts || 0,
      bypassKind: apiTokenDiag.bypassKind || null,
    })
  );
  // QUOTA BYPASS (9 Nov 2026, row #81 [Medium] Limit / Quota
  // Bypass, WSTG-BUSL): an API that answers volume with success —
  // the probe calibrates with a control GET first (2xx + JSON),
  // then fires the same GET 15 times in rapid succession and
  // confirms only when every burst answer is granted with no
  // throttle signal (no 429, no Retry-After, no refusal text); a
  // single throttle signal proves the limit exists (see
  // quotaBypass.js). Same apiRoutes wiring as bfla. Diagnostics
  // ride the phase extras (apiRoutes, derivedCollections,
  // candidates, controlOk, attempts, throttled, bypassKind) so a
  // live proof can tell "no surface" from "oracle uncalibrated"
  // without re-running the scan — and can see exactly which
  // routes were tried, in order (9 Nov 2026 follow-up, proof #34:
  // the cap-2 cut was invisible live because the record carried
  // neither the derived count nor the route list).
  const quotaDiag = {};
  plan(
    'quota-bypass',
    () =>
      probeQuotaBypass(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: quotaDiag,
      }),
    () => ({
      apiRoutes: quotaDiag.apiRoutes || 0,
      derivedCollections: quotaDiag.derivedCollections || 0,
      candidates: quotaDiag.candidates || [],
      controlOk: Boolean(quotaDiag.controlOk),
      attempts: quotaDiag.attempts || 0,
      throttled: Boolean(quotaDiag.throttled),
      bypassKind: quotaDiag.bypassKind || null,
    })
  );
  // PROVISIONING (9 Nov 2026, rows #171 [Medium] Insecure Account
  // Provisioning / Deprovisioning and #172 [Medium] Role Definition
  // Flaws, WSTG-IDNT): a freshly self-registered account must land
  // in an unprivileged role — the probe registers a throwaway
  // account and checks the default role three ways (the role
  // marker in the registration response, the role claim in the
  // issued JWT, and an admin-route replay with the fresh token),
  // confirming on the first leg that proves privilege (see
  // provisioning.js). Same apiRoutes wiring as bfla. Diagnostics
  // ride the phase extras (registerRoutes, registerOk, roleClaim,
  // adminRoutes, controlOk, attempts, bypassKind) so a live proof
  // can tell "no surface" from "oracle uncalibrated" without
  // re-running the scan.
  const provDiag = {};
  plan(
    'provisioning',
    () =>
      probeProvisioning(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: provDiag,
      }),
    () => ({
      registerRoutes: provDiag.registerRoutes || 0,
      registerOk: Boolean(provDiag.registerOk),
      roleClaim: provDiag.roleClaim || null,
      adminRoutes: provDiag.adminRoutes || 0,
      controlOk: Boolean(provDiag.controlOk),
      attempts: provDiag.attempts || 0,
      bypassKind: provDiag.bypassKind || null,
    })
  );
  // LLM RATE LIMIT (9 Nov 2026, rows #26 [High] Unbounded LLM
  // Consumption / Denial of Wallet, LLM10:2025, and #382 [Medium]
  // LLM — Unbounded consumption, OWASP LLM10:2025): the stub has
  // no throttle at all, so the probe runs a control-first burst —
  // one chat POST, then the same chat POST 12 times plus the same
  // allowlisted tool POST 4 times — and confirms only when every
  // burst answer is granted with no throttle signal (see
  // llmRateLimit.js). Diagnostics ride the phase extras (llmLab,
  // controlOk, attempts, chatAttempts, toolAttempts, throttled,
  // burstKind) so a live proof can tell "no surface" from "oracle
  // uncalibrated" without re-running the scan.
  const llmRateLimitDiag = {};
  plan(
    'llm-rate-limit',
    () =>
      probeLlmRateLimit(url, {
        ...opts,
        allowWrite,
        labTargets,
        diagnostics: llmRateLimitDiag,
      }),
    () => ({
      llmLab: Boolean(llmRateLimitDiag.llmLab),
      controlOk: Boolean(llmRateLimitDiag.controlOk),
      attempts: llmRateLimitDiag.attempts || 0,
      chatAttempts: llmRateLimitDiag.chatAttempts || 0,
      toolAttempts: llmRateLimitDiag.toolAttempts || 0,
      throttled: Boolean(llmRateLimitDiag.throttled),
      burstKind: llmRateLimitDiag.burstKind || null,
    })
  );
  // LLM TRAINING DATA EXTRACTION (9 Nov 2026, row #512 [Medium]
  // LLM — training data extraction / memorization regurgitation,
  // CWE-200): the stub has no training step, so its "memory" is
  // the keyword RAG store — the probe learns the record's canary
  // tokens at runtime from GET /api/rag, prompts the chat for the
  // same record, and confirms only on verbatim regurgitation (see
  // llmTrainingData.js). Diagnostics ride the phase extras
  // (llmLab, controlOk, ragDocs, promptsTried, regurgitatedKind,
  // tokensMatched).
  const llmTrainingDataDiag = {};
  plan(
    'llm-training-data',
    () =>
      probeLlmTrainingData(url, {
        ...opts,
        allowWrite,
        labTargets,
        diagnostics: llmTrainingDataDiag,
      }),
    () => ({
      llmLab: Boolean(llmTrainingDataDiag.llmLab),
      controlOk: Boolean(llmTrainingDataDiag.controlOk),
      ragDocs: llmTrainingDataDiag.ragDocs || 0,
      promptsTried: llmTrainingDataDiag.promptsTried || 0,
      regurgitatedKind: llmTrainingDataDiag.regurgitatedKind || null,
      tokensMatched: llmTrainingDataDiag.tokensMatched || 0,
    })
  );
  // LLM TRAINING POISONING (9 Nov 2026, rows #16 [High] Data &
  // Model Poisoning, LLM04:2025, and #378 [High] LLM — Training
  // data poisoning, OWASP LLM03:2025): no training step exists in
  // the stub, so the poisoned RAG doc is the standing partial
  // surface — the probe asks about the internal notes and confirms
  // only when retrieved content alone steers the model into an
  // unrequested readFile tool call whose output the reply folds in
  // (see llmTrainingPoisoning.js). Diagnostics ride the phase
  // extras (llmLab, controlOk, controlToolCall, retrievedDoc,
  // poisonToolCall, toolCalled).
  const llmTrainingPoisoningDiag = {};
  plan(
    'llm-training-poisoning',
    () =>
      probeLlmTrainingPoisoning(url, {
        ...opts,
        allowWrite,
        labTargets,
        diagnostics: llmTrainingPoisoningDiag,
      }),
    () => ({
      llmLab: Boolean(llmTrainingPoisoningDiag.llmLab),
      controlOk: Boolean(llmTrainingPoisoningDiag.controlOk),
      controlToolCall: Boolean(llmTrainingPoisoningDiag.controlToolCall),
      retrievedDoc: llmTrainingPoisoningDiag.retrievedDoc || null,
      poisonToolCall: Boolean(llmTrainingPoisoningDiag.poisonToolCall),
      toolCalled: llmTrainingPoisoningDiag.toolCalled || null,
    })
  );
  // LLM MODEL EXTRACTION (9 Nov 2026, rows #22 [Medium] Model
  // Extraction / Stealing and #383 [Medium] LLM — Model theft /
  // extraction, OWASP LLM10:2025): TRUE NEGATIVE BY DESIGN — the
  // stub has no weights, and the probe verifies the model card
  // says so, then attempts extraction twice and records whether
  // anything weight-shaped was disclosed (see
  // llmModelExtraction.js). Diagnostics ride the phase extras
  // (llmLab, modelType, modelVersion, noWeights,
  // extractionAttempts, weightsDisclosed).
  const llmModelExtractionDiag = {};
  plan(
    'llm-model-extraction',
    () =>
      probeLlmModelExtraction(url, {
        ...opts,
        allowWrite,
        labTargets,
        diagnostics: llmModelExtractionDiag,
      }),
    () => ({
      llmLab: Boolean(llmModelExtractionDiag.llmLab),
      modelType: llmModelExtractionDiag.modelType || null,
      modelVersion: llmModelExtractionDiag.modelVersion || null,
      noWeights: Boolean(llmModelExtractionDiag.noWeights),
      extractionAttempts: llmModelExtractionDiag.extractionAttempts || 0,
      weightsDisclosed: Boolean(llmModelExtractionDiag.weightsDisclosed),
    })
  );
  // LLM MULTIMODAL (9 Nov 2026, row #513 [Medium] LLM —
  // multimodal prompt injection, CWE-94): UNPROVABLE ON THIS LAB
  // — the stub has no image/audio input, so the probe inventories
  // the endpoint surface and attempts an image + an audio data-URI
  // prompt, recording whether the model processed the media or
  // treated it as plain text (see llmMultimodal.js). Diagnostics
  // ride the phase extras (llmLab, multimodalEndpoints,
  // cardModalities, imageTreatedAsText, audioTreatedAsText,
  // verdict).
  const llmMultimodalDiag = {};
  plan(
    'llm-multimodal',
    () =>
      probeLlmMultimodal(url, {
        ...opts,
        allowWrite,
        labTargets,
        diagnostics: llmMultimodalDiag,
      }),
    () => ({
      llmLab: Boolean(llmMultimodalDiag.llmLab),
      multimodalEndpoints: llmMultimodalDiag.multimodalEndpoints || 0,
      cardModalities: Boolean(llmMultimodalDiag.cardModalities),
      imageTreatedAsText: Boolean(llmMultimodalDiag.imageTreatedAsText),
      audioTreatedAsText: Boolean(llmMultimodalDiag.audioTreatedAsText),
      verdict: llmMultimodalDiag.verdict || null,
    })
  );
  // LLM MEMBERSHIP INFERENCE (9 Nov 2026, row #514 [Low] LLM —
  // membership inference attack, CWE-200): UNPROVABLE ON THIS LAB
  // — the stub is deterministic and carries no confidence signal,
  // so the probe records determinism (same prompt twice),
  // confidence-signal presence, and the retrieval oracle shape
  // (member keyword retrieves, nonsense keyword does not) instead
  // of inferring anything (see llmMembership.js). Diagnostics ride
  // the phase extras (llmLab, deterministic, confidenceSignal,
  // memberRetrievable, nonMemberEmpty, verdict).
  const llmMembershipDiag = {};
  plan(
    'llm-membership-inference',
    () =>
      probeLlmMembership(url, {
        ...opts,
        allowWrite,
        labTargets,
        diagnostics: llmMembershipDiag,
      }),
    () => ({
      llmLab: Boolean(llmMembershipDiag.llmLab),
      deterministic: Boolean(llmMembershipDiag.deterministic),
      confidenceSignal: Boolean(llmMembershipDiag.confidenceSignal),
      memberRetrievable: Boolean(llmMembershipDiag.memberRetrievable),
      nonMemberEmpty: Boolean(llmMembershipDiag.nonMemberEmpty),
      verdict: llmMembershipDiag.verdict || null,
    })
  );
  // LLM SUPPLY CHAIN (9 Nov 2026, rows #15 [High] AI Supply Chain
  // Vulnerability, LLM03:2025, and #377 [High] LLM — Supply chain
  // (poisoned models / plugins), OWASP LLM03:2025): TRUE NEGATIVE
  // BY DESIGN — the stub is Node stdlib only with no third-party
  // model or plugin, so the probe reads the model card and
  // inventories the endpoint surface for a supply-chain surface
  // (see llmSupplyChain.js). Diagnostics ride the phase extras
  // (llmLab, modelType, thirdPartyModel, supplyChainEndpoints,
  // verdict).
  const llmSupplyChainDiag = {};
  plan(
    'llm-supply-chain',
    () =>
      probeLlmSupplyChain(url, {
        ...opts,
        allowWrite,
        labTargets,
        diagnostics: llmSupplyChainDiag,
      }),
    () => ({
      llmLab: Boolean(llmSupplyChainDiag.llmLab),
      modelType: llmSupplyChainDiag.modelType || null,
      thirdPartyModel: Boolean(llmSupplyChainDiag.thirdPartyModel),
      supplyChainEndpoints: llmSupplyChainDiag.supplyChainEndpoints || 0,
      verdict: llmSupplyChainDiag.verdict || null,
    })
  );
  // WORKFLOW DATA EXPOSURE (9 Nov 2026, row #375 [Medium] Logic —
  // Excessive data exposure in workflows, CWE-200 | OWASP
  // A04:2021): a workflow step that returns more data than the
  // step needs — credential/secret material, or another user's
  // data, riding in a workflow response. The probe walks the
  // authenticated workflow (login -> basket -> whoami -> address
  // -> checkout) and inspects each step's genuine server response
  // against a tight parent-defined allowlist (see
  // workflowDataExposure.js). Same apiRoutes wiring as bfla.
  // Diagnostics ride the phase extras (workflowRoutes, controlOk,
  // stepsInspected, exposedKind) so a live proof can tell "no
  // surface" from "oracle uncalibrated" without re-running the
  // scan.
  const wdeDiag = {};
  plan(
    'workflow-data-exposure',
    () =>
      probeWorkflowDataExposure(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: wdeDiag,
      }),
    () => ({
      workflowRoutes: wdeDiag.workflowRoutes || 0,
      controlOk: Boolean(wdeDiag.controlOk),
      stepsInspected: wdeDiag.stepsInspected || 0,
      exposedKind: wdeDiag.exposedKind || null,
    }),
    { exclusive: LAB_BASKET }
  );
  // EXCEPTIONAL CONDITIONS (9 Nov 2026, row #482 [Medium]
  // Mishandling of Exceptional Conditions, CWE-703 / CWE-636 |
  // OWASP A10:2025): a multi-step workflow that does not fail
  // securely on a malformed input — the probe calibrates with a
  // well-formed basket add first, then feeds type-confusion
  // quantities ('abc', 1.5, null, 2^53+1) to the same add
  // endpoint (confirm only on 2xx + a basket state change) and,
  // when every variant is rejected there, to the sibling update
  // endpoint (confirm only when the update accepts what the add
  // rejected). A 5xx crash response is recorded in diagnostics
  // only — it is error-disclosure's territory, never this probe's
  // confirm trigger (see exceptionalConditions.js). Same apiRoutes
  // wiring as bfla / coupon-abuse. Diagnostics ride the phase
  // extras (basketRoutes, controlOk, attempts, failOpenKind) so a
  // live proof can tell "no surface" from "oracle uncalibrated"
  // without re-running the scan.
  const exceptionalDiag = {};
  plan(
    'exceptional-conditions',
    () =>
      probeExceptionalConditions(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: exceptionalDiag,
      }),
    () => ({
      basketRoutes: exceptionalDiag.basketRoutes || 0,
      controlOk: Boolean(exceptionalDiag.controlOk),
      attempts: exceptionalDiag.attempts || 0,
      failOpenKind: exceptionalDiag.failOpenKind || null,
    }),
    { exclusive: LAB_BASKET }
  );
  plan('user-enumeration', () => probeUserEnum(forms, url, opts));
  plan('mass-assignment', () => probeMassAssignment(forms, url, { ...opts, labTargets }));
  // WS MESSAGES (rows #39/#270 + #480 [Medium] WebSocket message/frame
  // replay, CWE-1385): T2 replays a captured state-changing frame
  // verbatim on a fresh connection. Diagnostics ride the phase extras
  // so a live proof can tell "no WS surface" (wsEndpoints 0) from
  // "replay ran, no double-effect" (replayAttempts 1, replayConfirmed
  // false) from "replay never ran" (quick depth / non-lab:
  // replayAttempts 0, frames null).
  const wsMsgDiag = {};
  plan(
    'ws-messages',
    () => probeWsMessages(url, { ...opts, labTargets, diagnostics: wsMsgDiag }),
    () => ({
      wsEndpoints: wsMsgDiag.wsEndpoints || 0,
      replayEndpoints: wsMsgDiag.replayEndpoints || 0,
      replayAttempts: wsMsgDiag.replayAttempts || 0,
      replayFramesBefore: wsMsgDiag.replayFramesBefore ?? null,
      replayFramesAfter: wsMsgDiag.replayFramesAfter ?? null,
      replayConfirmed: Boolean(wsMsgDiag.replayConfirmed),
    })
  );
  plan('subdomain-takeover', () => probeSubdomainTakeover(url, opts));
  plan('race', () =>
    probeRace(
      forms,
      url,
      [...new Set(forms.flatMap((f) => (f.inputs || []).map((i) => i.name).filter(Boolean)))],
      // D2 (#474 repair): same labTargets defect as session-fixation —
      // the probe's isLab read opts.labTargets, which runScan never set.
      { ...opts, labTargets }
    )
  );
  plan('files', () => probeSensitiveFiles(url, opts));
  // MISSING AUTH (7 Nov 2026, row #47 [Critical], CWE-306 / ASVS
  // V4.1): a critical function (admin, management, setup, ...) that
  // answers an unauthenticated GET with authenticated-only content.
  // Always-run (the fixed candidate list is never empty); strict
  // 4-conjunct gate in missingAuth.js — direct 200 only, not the SPA
  // catch-all, auth markers with no login form, HTML/JSON only.
  plan('missing-auth', () => probeMissingAuth(url, scanTargets, opts));
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
  plan(
    'xxe',
    () =>
      probeXxe(url, {
        ...opts,
        labTargets,
        allowWrite,
        ...(xxeOob
          ? { oobCallback: xxeOob.baseUrl(), oobWaitFor: (token, ms) => xxeOob.waitFor(token, ms) }
          : {}),
      }),
    undefined,
    { teardown: xxeOob ? () => xxeOob.stop() : undefined }
  );
  // XXE VIA XINCLUDE (10 Nov 2026, row #500 [High] XXE —
  // XInclude, CWE-611): the parser resolves <xi:include> hrefs
  // without any DOCTYPE, so the blind leg needs an OOB
  // collaborator (lab-gated inside the probe); the canary-content
  // leg runs only when the caller supplies a canary URL + marker
  // (opts.xincludeCanaryUrl / opts.xincludeCanaryMarker — see
  // xxeXinclude.js). Diagnostics ride the phase extras
  // (controlStatus, canaryLeg, oobLeg, skipNote).
  // NOTE (merge): the scout lane shared the xxe collaborator
  // between xxe and xxe-xinclude inside one try/finally, but the
  // probe plan runs phases concurrently — xxe's teardown could
  // stop the shared listener mid-flight. xxe-xinclude therefore
  // gets its own collaborator, stopped by its own teardown.
  let xxeXincludeOob = null;
  if (phases.includes('xxe-xinclude') && allowWrite) {
    try {
      xxeXincludeOob = createOobCollaborator({
        listenHost: opts.oobListenHost || process.env.DM_OOB_LISTEN_HOST || '0.0.0.0',
        listenPort: opts.oobListenPort || (process.env.DM_OOB_PORT ? Number(process.env.DM_OOB_PORT) : 0),
        callbackHost: opts.oobCallbackHost || process.env.DM_OOB_CALLBACK_HOST || '172.17.0.1',
      });
      await xxeXincludeOob.start();
    } catch (e) {
      errors.push(`oob-collaborator: ${e && e.message ? e.message : String(e)}`);
      xxeXincludeOob = null;
    }
  }
  const xxeXincludeDiag = {};
  plan(
    'xxe-xinclude',
    () =>
      probeXxeXinclude(url, {
        ...opts,
        labTargets,
        diagnostics: xxeXincludeDiag,
        ...(xxeXincludeOob
          ? { oobCallback: xxeXincludeOob.baseUrl(), oobWaitFor: (token, ms) => xxeXincludeOob.waitFor(token, ms) }
          : {}),
      }),
    () => ({
      controlStatus: xxeXincludeDiag.controlStatus ?? null,
      canaryLeg: xxeXincludeDiag.canaryLeg || null,
      oobLeg: xxeXincludeDiag.oobLeg || null,
      skipNote: xxeXincludeDiag.skipped || null,
    }),
    { teardown: xxeXincludeOob ? () => xxeXincludeOob.stop() : undefined }
  );
  plan('idor', () => probeIdorSurface(url));
  plan('cors', () => probeCors(url, opts));
  plan('cookies', () => probeCookieFlags(url, opts));
  plan('stored-xss', async () => [...(await probeStoredXss(forms, url, opts)), ...(await probeStoredXssUriScheme(forms, url, opts))]);
  // SECOND-ORDER SQL INJECTION (14 Nov 2026, rows #208 + #281 [High],
  // CWE-89 — the same concept filed twice, one leg covers both): the
  // payload is STORED by one request (a profile/registration field)
  // and executed only when a later request re-uses the stored value.
  // The probe stores a canary quote via a form, then re-reads the
  // trigger pages and confirms ONLY on a DB error on the SECOND
  // request, absent on the pre-store baseline and after a benign
  // store (see sqliSecondOrder.js). LAB-GATED (allowWrite, the same
  // host check as file-upload / sqli-oob): the store step WRITES to
  // the target, so on a non-lab host the phase records a gated skip
  // instead of running — the probe re-checks the gate itself, defence
  // in depth. Runs next to stored-xss: same forms surface, same
  // two-step shape, different sink.
  if (allowWrite) {
    plan('sqli-second-order', () =>
      probeSqliSecondOrder(forms, url, { ...opts, labTargets, tech: fp?.tech, dbHint: fp?.dbHint })
    );
  } else {
    planSkip('sqli-second-order', 'lab-gated: second-order writes need a lab target');
  }
  // BLIND XSS OOB collaborator (14 Nov 2026, row #113 [High] Blind XSS,
  // CWE-79): the blind-XSS leg needs a callback base AND a waiter — same
  // pattern as the xxe block above, one collaborator per OOB phase so each
  // listener lives only for its own phase. Only when the target is
  // lab-gated (allowWrite, the same host check as the file-upload gate).
  // Start is best-effort: a bind failure is recorded in errors and the
  // scan continues with the OOB variant skipped, exactly as before this
  // lane. The collaborator is always stopped afterwards (teardown), so no
  // listener outlives the scan. Callback-host default is the docker bridge
  // gateway (172.17.0.1) — the IP lab containers use to reach the host;
  // override with opts.oobCallbackHost / DM_OOB_CALLBACK_HOST.
  let blindXssOob = null;
  if (phases.includes('blind-xss') && allowWrite) {
    try {
      blindXssOob = createOobCollaborator({
        listenHost: opts.oobListenHost || process.env.DM_OOB_LISTEN_HOST || '0.0.0.0',
        listenPort: opts.oobListenPort || (process.env.DM_OOB_PORT ? Number(process.env.DM_OOB_PORT) : 0),
        callbackHost: opts.oobCallbackHost || process.env.DM_OOB_CALLBACK_HOST || '172.17.0.1',
      });
      await blindXssOob.start();
    } catch (e) {
      errors.push(`oob-collaborator: ${e && e.message ? e.message : String(e)}`);
      blindXssOob = null;
    }
  }
  plan(
    'blind-xss',
    () =>
      probeBlindXss(forms, url, {
        ...opts,
        labTargets,
        ...(blindXssOob
          ? { oobCallback: blindXssOob.baseUrl(), oobWaitFor: (token, ms) => blindXssOob.waitFor(token, ms) }
          : {}),
      }),
    undefined,
    { teardown: blindXssOob ? () => blindXssOob.stop() : undefined }
  );
  // EGRESS LAUNDERING (H3(b), V8-F1, Meta Cat 7 up to $5k): a stored
  // content sink that preserves an external URL in a fetchable
  // attribute causes every viewer browser to fetch that URL directly
  // — outside the agent egress gate. Same one-collaborator-per-OOB-
  // phase pattern as sqli-oob / ssrf-referer: only when the target is
  // lab-gated (allowWrite). The collaborator is stopped by the plan
  // teardown, so no listener outlives the scan. The probe itself
  // re-checks opts.labTargets and requires the collaborator to be
  // wired — without it, it returns [] without a single request.
  let egressLaunderingOob = null;
  if (phases.includes('egress-laundering') && allowWrite) {
    try {
      egressLaunderingOob = createOobCollaborator({
        listenHost: opts.oobListenHost || process.env.DM_OOB_LISTEN_HOST || '0.0.0.0',
        listenPort: opts.oobListenPort || (process.env.DM_OOB_PORT ? Number(process.env.DM_OOB_PORT) : 0),
        callbackHost: opts.oobCallbackHost || process.env.DM_OOB_CALLBACK_HOST || '172.17.0.1',
      });
      await egressLaunderingOob.start();
    } catch (e) {
      errors.push(`oob-collaborator: ${e && e.message ? e.message : String(e)}`);
      egressLaunderingOob = null;
    }
  }
  plan(
    'egress-laundering',
    () =>
      probeEgressLaundering(forms, url, {
        ...opts,
        labTargets,
        ...(egressLaunderingOob
          ? {
              oobCallback: egressLaunderingOob.baseUrl(),
              oobWaitFor: (token, ms) => egressLaunderingOob.waitFor(token, ms),
              oobHasHit: (token) => egressLaunderingOob.hasHit(token),
            }
          : {}),
        // Authenticated render when the scan acquired a lab session:
        // the stored page is post-login, so an anonymous render would
        // see the login page, not the stored content. The closure
        // reads authSession at execution time (after the dom-render
        // step sets it); without a session the probe's default
        // (plain renderDom) applies.
        ...(authSession && authSession.ok
          ? { renderDom: (u, o) => renderDomAuthenticated(u, authSession.session, o) }
          : {}),
      }),
    undefined,
    { teardown: egressLaunderingOob ? () => egressLaunderingOob.stop() : undefined }
  );
  // GENERATED-DOCUMENT EXTERNAL IMAGES (V10-F4 docx, V10-F5 xlsx,
  // V10-VC-1 pptx control; Meta Cat 7 family): a generated Office
  // document that LINKS an external image makes every viewer fetch
  // that URL on open — the same egress primitive as egress-laundering,
  // in a different component and viewer. The probes are READ-ONLY
  // (GETs of document URLs the target itself links to) — no lab gate,
  // no collaborator, no form submission. A document whose images are
  // embedded (the presentation pipeline's build-time render) records
  // a verified control, never a finding. Diagnostics ride the phase
  // extras (documentsChecked, externalFound, controlStatus, skipNote).
  const documentExternalImageDiag = {};
  plan(
    'document-external-image',
    () => probeDocumentExternalImage(url, { ...opts, diagnostics: documentExternalImageDiag }),
    () => ({
      documentsChecked: documentExternalImageDiag.documentsChecked ?? 0,
      externalFound: documentExternalImageDiag.externalFound ?? 0,
      controlStatus: documentExternalImageDiag.controlStatus ?? null,
      skipNote: documentExternalImageDiag.skipped || null,
    })
  );
  const spreadsheetExternalImageDiag = {};
  plan(
    'spreadsheet-external-image',
    () => probeSpreadsheetExternalImage(url, { ...opts, diagnostics: spreadsheetExternalImageDiag }),
    () => ({
      documentsChecked: spreadsheetExternalImageDiag.documentsChecked ?? 0,
      externalFound: spreadsheetExternalImageDiag.externalFound ?? 0,
      controlStatus: spreadsheetExternalImageDiag.controlStatus ?? null,
      skipNote: spreadsheetExternalImageDiag.skipped || null,
    })
  );
  const presentationExternalImageDiag = {};
  plan(
    'presentation-external-image',
    () => probePresentationExternalImage(url, { ...opts, diagnostics: presentationExternalImageDiag }),
    () => ({
      documentsChecked: presentationExternalImageDiag.documentsChecked ?? 0,
      externalFound: presentationExternalImageDiag.externalFound ?? 0,
      controlStatus: presentationExternalImageDiag.controlStatus ?? null,
      skipNote: presentationExternalImageDiag.skipped || null,
    })
  );
  plan('weak-creds', () => probeWeakCreds(forms, url, opts));
  plan('host-header', () => probeHostHeader(url, opts));
  // SSRF VIA ROUTING-BASED HOST HEADER (10 Nov 2026, row #494
  // [High] SSRF via routing-based Host header, CWE-918): a routing
  // middleware that dispatches by Host can expose an internal admin
  // panel to an outside caller who guesses the internal host name.
  // The probe sends the candidate Host values over a raw socket
  // (undici drops Host — see ssrfRouting.js) and confirms only on
  // the admin marker served for the candidate Host, reproduced, and
  // absent from the baseline and the nonsense-Host control.
  // Read-only GETs — the Host header itself is the surface, not a
  // probe point, so this is a single-shot plan, not a battery step.
  // Diagnostics ride the phase extras (candidates,
  // baselineHasMarker, attempts, hostValue).
  const ssrfRoutingDiag = {};
  plan(
    'ssrf-routing',
    () => probeSsrfRouting(url, [], { ...opts, diagnostics: ssrfRoutingDiag }),
    () => ({
      candidates: ssrfRoutingDiag.candidates || 0,
      baselineHasMarker: Boolean(ssrfRoutingDiag.baselineHasMarker),
      attempts: ssrfRoutingDiag.attempts || 0,
      hostValue: ssrfRoutingDiag.hostValue || null,
    })
  );
  // SSRF VIA REFERER HEADER (10 Nov 2026, row #495 [High] SSRF via
  // Referer header fetch + Shellshock via Referer, CWE-918 /
  // CWE-78): the server fetches the URL carried in Referer (leg 1,
  // OOB collaborator canary + control) or executes it as bash in a
  // CGI handler (leg 2, marker + benign control + repeat). Same
  // one-collaborator-per-OOB-phase pattern as saml/xxe — only when
  // the target is lab-gated (allowWrite). Start is best-effort: a
  // bind failure is recorded in errors and the scan continues with
  // the fetch leg skipped (the Shellshock leg needs no
  // collaborator). The collaborator is stopped by the plan
  // teardown, so no listener outlives the scan. Callback-host
  // default is the docker bridge gateway (172.17.0.1).
  let refererOob = null;
  if (phases.includes('ssrf-referer') && allowWrite) {
    try {
      refererOob = createOobCollaborator({
        listenHost: opts.oobListenHost || process.env.DM_OOB_LISTEN_HOST || '0.0.0.0',
        listenPort: opts.oobListenPort || (process.env.DM_OOB_PORT ? Number(process.env.DM_OOB_PORT) : 0),
        callbackHost: opts.oobCallbackHost || process.env.DM_OOB_CALLBACK_HOST || '172.17.0.1',
      });
      await refererOob.start();
    } catch (e) {
      errors.push(`oob-collaborator: ${e && e.message ? e.message : String(e)}`);
      refererOob = null;
    }
  }
  const ssrfRefererDiag = {};
  plan(
    'ssrf-referer',
    () =>
      probeSsrfReferer(url, {
        ...opts,
        diagnostics: ssrfRefererDiag,
        ...(refererOob
          ? { oobCallback: refererOob.baseUrl(), oobWaitFor: (token, ms) => refererOob.waitFor(token, ms) }
          : {}),
      }),
    () => ({
      refererFetchVerdict: ssrfRefererDiag.refererFetchVerdict || null,
      shellshockVerdict: ssrfRefererDiag.shellshockVerdict || null,
      attempts: ssrfRefererDiag.attempts || 0,
    }),
    { teardown: refererOob ? () => refererOob.stop() : undefined }
  );
  // REFERER-BASED ACCESS CONTROL (10 Nov 2026, row #496 [High]
  // Access control — Referer-based access control, CWE-862): an
  // admin route that opens for a forged Referer is a broken access
  // check, not a header quirk. The probe needs labCreds (a
  // known-good session) + apiRoutes and confirms only on the
  // differential — forged Referer reaches admin content, benign
  // and nonsense Referers do not (see refererAccessControl.js).
  // Lab-gated (allowWrite + lab host + depth !== 'quick' inside
  // the probe). Diagnostics ride the phase extras (adminRoutes,
  // controlOk, registerOk, bypassKind, attempts).
  const refererAcDiag = {};
  plan(
    'referer-access-control',
    () =>
      probeRefererAccessControl(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: refererAcDiag,
      }),
    () => ({
      adminRoutes: refererAcDiag.adminRoutes || 0,
      controlOk: Boolean(refererAcDiag.controlOk),
      registerOk: Boolean(refererAcDiag.registerOk),
      bypassKind: refererAcDiag.bypassKind || null,
      attempts: refererAcDiag.attempts || 0,
    })
  );
  // FILE-UPLOAD OOB collaborator (14 Nov 2026): the file-upload probe's
  // XML leg (row #149, stored XXE via uploaded file) needs a callback base
  // AND a waiter — same pattern as the xxe block above, one collaborator
  // per OOB phase so each listener lives only for its own phase. Only when
  // the target is lab-gated (allowWrite, the same host check as the
  // file-upload gate). Start is best-effort: a bind failure is recorded
  // in errors and the scan continues with the XML leg skipped, exactly as
  // the xxe OOB variant does. The collaborator is always stopped
  // afterwards (teardown), so no listener outlives the scan.
  let fileUploadOob = null;
  if (phases.includes('file-upload') && allowWrite) {
    try {
      fileUploadOob = createOobCollaborator({
        listenHost: opts.oobListenHost || process.env.DM_OOB_LISTEN_HOST || '0.0.0.0',
        listenPort: opts.oobListenPort || (process.env.DM_OOB_PORT ? Number(process.env.DM_OOB_PORT) : 0),
        callbackHost: opts.oobCallbackHost || process.env.DM_OOB_CALLBACK_HOST || '172.17.0.1',
      });
      await fileUploadOob.start();
    } catch (e) {
      errors.push(`oob-collaborator: ${e && e.message ? e.message : String(e)}`);
      fileUploadOob = null;
    }
  }
  plan(
    'file-upload',
    () =>
      probeFileUpload(url, {
        ...opts,
        allowWrite,
        ...(fileUploadOob
          ? { oobCallback: fileUploadOob.baseUrl(), oobWaitFor: (token, ms) => fileUploadOob.waitFor(token, ms) }
          : {}),
      }),
    undefined,
    { teardown: fileUploadOob ? () => fileUploadOob.stop() : undefined }
  );
  // FILE UPLOAD RACE CONDITION (10 Nov 2026, row #498 [High] File
  // upload — race condition (validation bypass), CWE-434 / CWE-367):
  // a handler that moves the file into the public directory BEFORE
  // the type/virus check deletes it leaves a live window — the
  // probe uploads a harmless marker file while GET-polling the
  // predicted public URL and confirms only on a hit inside the
  // window plus a later GET showing the file gone (see
  // uploadRace.js). Lab-gated (allowWrite + lab host inside the
  // probe). Diagnostics ride the phase extras (forms,
  // uploadAccepted, verdict, windowHitMs, goneAfter).
  const uploadRaceDiag = {};
  plan(
    'upload-race',
    () => probeUploadRace(url, { ...opts, allowWrite, labTargets, diagnostics: uploadRaceDiag }),
    () => ({
      forms: uploadRaceDiag.forms || 0,
      uploadAccepted: Boolean(uploadRaceDiag.uploadAccepted),
      verdict: uploadRaceDiag.verdict || null,
      windowHitMs: uploadRaceDiag.windowHitMs ?? null,
      goneAfter: Boolean(uploadRaceDiag.goneAfter),
    })
  );
  // FILE UPLOAD — SERVER CONFIG OVERRIDE VIA .HTACCESS (10 Nov
  // 2026, row #499 [High] File upload — server config override
  // (.htaccess), CWE-434): an upload handler that accepts a
  // .htaccess into a public directory lets an attacker rewrite the
  // directory's server configuration — here, mapping a new
  // extension to the PHP handler. The probe uploads a .htaccess
  // carrying `AddType application/x-httpd-php .l33t`, then a
  // MARKER file with that extension, and confirms only on
  // execution of the marker — with the control marker (uploaded
  // BEFORE the .htaccess) served inert (see uploadHtaccess.js).
  // Lab-gated (allowWrite + lab host inside the probe).
  // Diagnostics ride the phase extras (forms, htaccessAccepted,
  // probeExecuted, probeRepeatExecuted, controlExecuted, verdict).
  const uploadHtaccessDiag = {};
  plan(
    'upload-htaccess',
    () => probeUploadHtaccess(url, { ...opts, allowWrite, labTargets, diagnostics: uploadHtaccessDiag }),
    () => ({
      forms: uploadHtaccessDiag.forms || 0,
      htaccessAccepted: Boolean(uploadHtaccessDiag.htaccessAccepted),
      probeExecuted: Boolean(uploadHtaccessDiag.probeExecuted),
      probeRepeatExecuted: Boolean(uploadHtaccessDiag.probeRepeatExecuted),
      controlExecuted: Boolean(uploadHtaccessDiag.controlExecuted),
      verdict: uploadHtaccessDiag.verdict || null,
    })
  );
  plan('cache-poisoning', () => probeCachePoisoning(url, opts));
  plan('request-smuggling', () => probeRequestSmuggling(url, opts));
  // REQUEST SMUGGLING — CL.CL (10 Nov 2026, row #166 [Critical] HTTP
  // Request Smuggling — CL.CL variant, CWE-444; CL.CL has no dedicated
  // checklist row, #351–#354 cover CL.TE / TE.CL / TE.TE /
  // chunked-extension only): duplicate Content-Length
  // headers let front and back disagree on where the body ends, so
  // attacker bytes are processed as a new request. Raw-socket
  // oracle (baseline must pipeline cleanly or the phase skips —
  // see smugglingClCl.js); https targets skip (raw socket, no
  // TLS). Diagnostics ride the phase extras (baselineResponses,
  // skipNote).
  const smugglingClClDiag = {};
  plan(
    'smuggling-cl-cl',
    () => probeSmugglingClCl(url, { ...opts, diagnostics: smugglingClClDiag }),
    () => ({
      baselineResponses: smugglingClClDiag.baselineResponses ?? null,
      skipNote: smugglingClClDiag.skipped || null,
    })
  );
  // REQUEST SMUGGLING — 0.CL / CL.0 (10 Nov 2026, row #166 [Critical]
  // HTTP Request Smuggling — 0.CL / CL.0 variant, CWE-444; 0.CL / CL.0
  // has no dedicated checklist row, #351–#354 cover CL.TE / TE.CL /
  // TE.TE / chunked-extension only): a zero
  // Content-Length against a non-zero one is the same front/back
  // disagreement with a different shape (see
  // smugglingZeroCl.js). Same raw-socket oracle and https skip as
  // CL.CL.
  const smugglingZeroClDiag = {};
  plan(
    'smuggling-zero-cl',
    () => probeSmugglingZeroCl(url, { ...opts, diagnostics: smugglingZeroClDiag }),
    () => ({
      baselineResponses: smugglingZeroClDiag.baselineResponses ?? null,
      skipNote: smugglingZeroClDiag.skipped || null,
    })
  );
  // HTTP/2 REQUEST TUNNELLING (10 Nov 2026, row #168 [Critical] HTTP/2
  // Desync / Downgrading Attacks, CWE-444): a front-end that terminates
  // HTTP/2 and forwards to HTTP/1.1 must sanitise header values when it
  // re-serialises them — a CRLF inside an H2 header value becomes
  // a new HTTP/1.1 request on the back-end connection. Node's
  // http2 client refuses \r / \n outright, so the probe speaks
  // raw HTTP/2 frames over a node:net socket (see
  // smugglingH2Tunnel.js). Confirmed ONLY when the smuggled
  // request is observed reaching the back-end — via a second
  // response on another stream, or via opts.smuggledObserver (a
  // lab back-end tap supplied by the caller); without an observer
  // the phase reports "no observer" and stays quiet. h2c
  // cleartext only — https targets skip. Diagnostics ride the
  // phase extras (h2Available, baselineStatus, attackStatus,
  // smuggledObserved, noObserver, skipNote).
  const smugglingH2Diag = {};
  plan(
    'smuggling-h2-tunnel',
    () => probeSmugglingH2Tunnel(url, { ...opts, diagnostics: smugglingH2Diag }),
    () => ({
      h2Available: Boolean(smugglingH2Diag.h2Available),
      baselineStatus: smugglingH2Diag.baselineStatus ?? null,
      attackStatus: smugglingH2Diag.attackStatus ?? null,
      smuggledObserved: Boolean(smugglingH2Diag.smuggledObserved),
      noObserver: Boolean(smugglingH2Diag.noObserver),
      skipNote: smugglingH2Diag.skipped || null,
    })
  );
  plan('jwt', () => probeJwt(url, opts));
  // JWT SENSITIVE CLAIMS (9 Nov 2026, row #481 [Medium] JWT —
  // sensitive data in claims (unencrypted payload), CWE-359 /
  // CWE-200): the token the server itself issues, decoded
  // (base64url, no key needed), claims walked for sensitive fields
  // — a credential/secret field or a personal-data field with a
  // non-empty value confirms (field names only in the evidence;
  // values never leak into the report); a token whose payload holds
  // only standard identifiers is a proven true negative (see
  // jwtClaims.js). Same lab gates + apiRoutes wiring as bfla /
  // coupon-abuse. Diagnostics ride the phase extras (loginRoutes,
  // tokenFound, tokenJwt, claimsScanned, sensitiveFields, tier) so
  // a live proof can tell "no token" from "clean token" without
  // re-running the scan.
  const jwtClaimsDiag = {};
  plan(
    'jwt-claims',
    () =>
      probeJwtClaims(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: jwtClaimsDiag,
      }),
    () => ({
      loginRoutes: jwtClaimsDiag.loginRoutes || 0,
      tokenFound: Boolean(jwtClaimsDiag.tokenFound),
      tokenJwt: Boolean(jwtClaimsDiag.tokenJwt),
      claimsScanned: jwtClaimsDiag.claimsScanned || 0,
      sensitiveFields: jwtClaimsDiag.sensitiveFields || 0,
      tier: jwtClaimsDiag.tier || null,
    })
  );
  // SESSION TIMEOUT + REMEMBER-ME TOKEN (9 Nov 2026, rows #259
  // [Medium] No Session Timeout, CWE-613, and #475 [High]
  // Remember-me token flaws, CWE-384): the token the server itself
  // issues, decoded (base64url, no key needed), its exp claim
  // judged offline — no exp, or a lifetime over 7 days, confirms
  // #259; the same login transaction is inspected for a
  // remember-me token (JSON field / Set-Cookie) and confirms #475
  // only when that token is predictable or permanent (see
  // sessionTimeout.js). The logout-invalidation half of #259 is
  // already LIVE via #474 and is NEVER re-tested here. Same lab
  // gates + apiRoutes wiring as jwt-claims. Diagnostics ride the
  // phase extras (loginRoutes, tokenFound, tokenJwt, expPresent,
  // tokenLifetimeSecs, rememberMeSurface, rememberMeKind) so a live
  // proof can tell "no token" from "clean token" and "no
  // remember-me surface" from "surface clean" without re-running.
  const stDiag = {};
  plan(
    'session-timeout',
    () =>
      probeSessionTimeout(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: stDiag,
      }),
    () => ({
      loginRoutes: stDiag.loginRoutes || 0,
      tokenFound: Boolean(stDiag.tokenFound),
      tokenJwt: Boolean(stDiag.tokenJwt),
      expPresent: Boolean(stDiag.expPresent),
      tokenLifetimeSecs:
        typeof stDiag.tokenLifetimeSecs === 'number' ? stDiag.tokenLifetimeSecs : null,
      rememberMeSurface: Boolean(stDiag.rememberMeSurface),
      rememberMeKind: stDiag.rememberMeKind || null,
    })
  );
  // LLM TOOL MISUSE (9 Nov 2026, rows #384 [High] + #28 [High]):
  // the model invokes a file-read / command tool from prompt
  // content, and the tool endpoint answers directly without auth
  // (see llmToolMisuse.js). The probe fingerprints the chat
  // endpoint first (a benign POST must return a completion
  // string), then asks the question that retrieves the lab's
  // tool-instructing document and confirms only on an observed
  // tool call with a real tool result; it also replays that call
  // and tries the harmless runCommand canary directly against
  // /api/tool. Lab-gated (allowWrite + lab host + depth !==
  // 'quick'). Diagnostics ride the phase extras (llmEndpoints,
  // controlOk, toolViaPrompt, toolDirect, toolName,
  // runCommandDirect) so a live proof can tell "no LLM surface"
  // from "LLM present, tools safe" without re-running the scan.
  const llmToolDiag = {};
  plan(
    'llm-tool-misuse',
    () =>
      probeLlmToolMisuse(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: llmToolDiag,
      }),
    () => ({
      llmEndpoints: llmToolDiag.llmEndpoints || 0,
      controlOk: Boolean(llmToolDiag.controlOk),
      toolViaPrompt: Boolean(llmToolDiag.toolViaPrompt),
      toolDirect: Boolean(llmToolDiag.toolDirect),
      toolName: llmToolDiag.toolName || null,
      runCommandDirect: Boolean(llmToolDiag.runCommandDirect),
    })
  );
  // MCP TOOL POISONING (10 Nov 2026, row #485 [Critical] MCP tool
  // poisoning incl. rug pull / tool shadowing, CWE-94 / CWE-829):
  // an MCP server whose tool list carries hidden instructions,
  // swaps a tool definition after approval, or lists a lookalike
  // shadow tool (see mcpToolPoisoning.js). Read-only JSON-RPC
  // (initialize + tools/list) — no tool is ever invoked. Runs only
  // when the scan already knows an MCP endpoint (opts.mcpEndpoint,
  // supplied by the caller); otherwise the phase records a skip,
  // never a probe against an arbitrary web target. Diagnostics ride
  // the phase extras (initialized, toolsListed, listsCompared).
  const mcpDiag = {};
  if (opts.mcpEndpoint) {
    plan(
      'mcp-tool-poisoning',
      () => probeMcpToolPoisoning(opts.mcpEndpoint, { ...opts, diagnostics: mcpDiag }),
      () => ({
        initialized: Boolean(mcpDiag.initialized),
        toolsListed: mcpDiag.toolsListed || 0,
        listsCompared: mcpDiag.listsCompared || 0,
      })
    );
  } else {
    planSkip('mcp-tool-poisoning', 'no MCP endpoint discovered');
  }
  // LLM EXCESSIVE AGENCY (9 Nov 2026, rows #17 [Critical] + #379
  // [High]): a state-changing agent action with no confirmation
  // step (see llmExcessiveAgency.js). The probe reads the user
  // list, sends ONE deleteUser request for the last listed user
  // (no approval token, no confirmation field), and re-reads the
  // list — it confirms only on the observed state change (the
  // victim gone, count down by exactly one). Lab-gated
  // (allowWrite + lab host + depth !== 'quick'). Diagnostics ride
  // the phase extras (usersBefore, usersAfter, deletedUserId,
  // confirmationRequired). STATE NOTE: each confirming run
  // consumes one seeded lab user; the lab re-seeds on restart.
  const llmAgencyDiag = {};
  plan(
    'llm-excessive-agency',
    () =>
      probeLlmExcessiveAgency(url, {
        ...opts,
        allowWrite,
        labTargets,
        diagnostics: llmAgencyDiag,
      }),
    () => ({
      usersBefore: llmAgencyDiag.usersBefore || 0,
      usersAfter: llmAgencyDiag.usersAfter || 0,
      deletedUserId: llmAgencyDiag.deletedUserId || null,
      confirmationRequired: Boolean(llmAgencyDiag.confirmationRequired),
    })
  );
  // LLM OUTPUT HANDLING (9 Nov 2026, row #18 [High]): model
  // output rendered as raw HTML without escaping (see
  // llmOutputHandling.js). The probe fingerprints the chat
  // endpoint first, then GETs the output page with a benign
  // markup marker and confirms only when the marker is echoed
  // verbatim (its escaped form absent). Read-only — no
  // allowWrite gate. Lab-gated (lab host + depth !== 'quick').
  // Diagnostics ride the phase extras (llmEndpoints,
  // pageReflects, markerEscaped).
  const llmOutputDiag = {};
  plan(
    'llm-output-handling',
    () =>
      probeLlmOutputHandling(url, {
        ...opts,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: llmOutputDiag,
      }),
    () => ({
      llmEndpoints: llmOutputDiag.llmEndpoints || 0,
      pageReflects: Boolean(llmOutputDiag.pageReflects),
      markerEscaped: Boolean(llmOutputDiag.markerEscaped),
    })
  );
  // LLM MISINFORMATION (9 Nov 2026, rows #21 [Medium] + #381
  // [Medium]): the model repeats a claim its own knowledge base
  // contradicts (see llmMisinformation.js). The probe fingerprints
  // the chat endpoint first, asks the refund-policy question,
  // then asks the retrieval surface the same question — it
  // confirms only when the answer's duration differs from a
  // duration the store itself returns (a contradiction, not a
  // hardcoded string). Read-only — no allowWrite gate. Lab-gated
  // (lab host + depth !== 'quick'). Diagnostics ride the phase
  // extras (llmEndpoints, chatDays, ragDays, contradiction).
  const llmMisinfoDiag = {};
  plan(
    'llm-misinformation',
    () =>
      probeLlmMisinformation(url, {
        ...opts,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: llmMisinfoDiag,
      }),
    () => ({
      llmEndpoints: llmMisinfoDiag.llmEndpoints || 0,
      chatDays: llmMisinfoDiag.chatDays ?? null,
      ragDays: llmMisinfoDiag.ragDays || [],
      contradiction: Boolean(llmMisinfoDiag.contradiction),
    })
  );
  // LLM PROMPT INJECTION (9 Nov 2026, rows #23 [High] Prompt
  // Injection (Direct), #20 [Medium] LLM Jailbreak / Guardrail
  // Bypass, #25 [Medium] System Prompt Leakage, #19 + #376 [High]
  // Indirect Prompt Injection, #24 [High] Sensitive Information
  // Disclosure via LLM, CWE LLM01/LLM02/LLM07:2025): the probe
  // fingerprints an LLM chat/completion endpoint (mined routes
  // first, then well-known paths), calibrates with a benign
  // control prompt, then fires three tests — a jailbreak (confirm
  // only on a credential value in the completion), a question
  // about retrieved internal notes (confirm only when the model
  // returns file contents or invokes a tool from retrieved
  // content), and a retrieval question (confirm only on a
  // credential value or another customer's PII). DVWA and Juice
  // Shop have no chat endpoint, so the probe returns [] with
  // llmRoutes 0 there — a proven true negative (see
  // llmInjection.js). Same lab gates + apiRoutes wiring as bfla /
  // jwt-claims. Diagnostics ride the phase extras (llmRoutes,
  // controlOk, attempts, directLeak, indirectLeak, ragLeak) so a
  // live proof can tell "no LLM surface" from "oracle
  // uncalibrated" without re-running the scan.
  const llmInjectionDiag = {};
  plan(
    'llm-injection',
    () =>
      probeLlmInjection(url, {
        ...opts,
        allowWrite,
        apiRoutes: [...scanTargets, ...jsWriteTargets],
        labTargets,
        diagnostics: llmInjectionDiag,
      }),
    () => ({
      llmRoutes: llmInjectionDiag.llmRoutes || 0,
      controlOk: Boolean(llmInjectionDiag.controlOk),
      attempts: llmInjectionDiag.attempts || 0,
      directLeak: Boolean(llmInjectionDiag.directLeak),
      indirectLeak: Boolean(llmInjectionDiag.indirectLeak),
      ragLeak: Boolean(llmInjectionDiag.ragLeak),
    })
  );
  plan('graphql', () => probeGraphql(url, { ...opts, labTargets }));
  // GRAPHQL RELAY NODE IDOR (10 Nov 2026, row #507 [High] GraphQL
  // Relay Node interface IDOR, CWE-639): node(id:) resolves any
  // global id, so a neighbouring user's object is readable through
  // it. The probe discovers the endpoint itself, resolves its own
  // id (baseline), a neighbouring id (attack + repeat) and a
  // nonsense id (control) — confirmed only on the full oracle
  // (see graphqlRelay.js). Read-only __typename/node reads, no
  // mutation ever sent. Diagnostics ride the phase extras
  // (endpoint, ownResolved, otherResolved, nonsenseResolved,
  // oracle).
  const graphqlRelayDiag = {};
  plan(
    'graphql-relay',
    () => probeGraphqlRelay(url, [], { ...opts, labTargets, diagnostics: graphqlRelayDiag }),
    () => ({
      endpoint: graphqlRelayDiag.endpoint || null,
      ownResolved: Boolean(graphqlRelayDiag.ownResolved),
      otherResolved: Boolean(graphqlRelayDiag.otherResolved),
      nonsenseResolved: Boolean(graphqlRelayDiag.nonsenseResolved),
      oracle: graphqlRelayDiag.oracle || null,
    })
  );
  // GRAPHQL PERSISTED QUERIES / APQ ABUSE (10 Nov 2026, row #508
  // [Medium] GraphQL persisted queries / APQ abuse, CWE-639):
  // Automatic Persisted Queries let a client replay an arbitrary
  // query by hash alone — the probe registers a query, replays it
  // by hash (attack + repeat) and checks an unknown hash is
  // rejected (control) (see graphqlApq.js). Read-only __typename
  // reads. Diagnostics ride the phase extras (endpoint,
  // registered, unknownHashRejected, oracle).
  const graphqlApqDiag = {};
  plan(
    'graphql-apq',
    () => probeGraphqlApq(url, [], { ...opts, labTargets, diagnostics: graphqlApqDiag }),
    () => ({
      endpoint: graphqlApqDiag.endpoint || null,
      registered: Boolean(graphqlApqDiag.registered),
      unknownHashRejected: Boolean(graphqlApqDiag.unknownHashRejected),
      oracle: graphqlApqDiag.oracle || null,
    })
  );
  // GRAPHQL @DEFER / @STREAM DELIVERY ABUSE (10 Nov 2026, row #509
  // [Medium] GraphQL @defer / @stream delivery abuse, CWE-400):
  // deferred delivery can leak fields the caller should not see
  // and amplify one request into many chunks / much server time.
  // The probe compares plain vs deferred queries (chunk count,
  // timing, directive-key leakage — see graphqlDefer.js).
  // Read-only queries only, no DoS-class behaviour. Diagnostics
  // ride the phase extras (endpoint, deferSupported,
  // chunkAmplified, timingAmplified, directiveLeaked).
  const graphqlDeferDiag = {};
  plan(
    'graphql-defer',
    () => probeGraphqlDefer(url, [], { ...opts, labTargets, diagnostics: graphqlDeferDiag }),
    () => ({
      endpoint: graphqlDeferDiag.endpoint || null,
      deferSupported: Boolean(graphqlDeferDiag.deferSupported),
      chunkAmplified: Boolean(graphqlDeferDiag.chunkAmplified),
      timingAmplified: Boolean(graphqlDeferDiag.timingAmplified),
      directiveLeaked: Boolean(graphqlDeferDiag.directiveLeaked),
    })
  );
  // CSWSH — DOM-BASED WEBSOCKET-URL POISONING (9 Nov 2026, row #92
  // [Medium] Technique (no single CVE) | PortSwigger DOM): tier 1
  // mines first-party code for WebSocket endpoints (new WebSocket()
  // URLs + ws(s):// literals); tier 2 drives the raw-socket
  // handshake oracle — the control (legit Origin + lab-session
  // cookies) must upgrade before the evil-Origin attack handshake
  // counts, so a missing Origin check confirms only on a live
  // endpoint (see cswsh.js). No CDP drive: the handshake
  // differential IS the attack (a browser sends the same Origin +
  // cookies), and no application message is ever sent. The phase
  // runs on every scan; zero mined endpoints + zero known-path
  // upgrades is a proven true negative, recorded as wsSinks /
  // wsEndpoints 0 in the phase record.
  const cswshDiag = {};
  plan(
    'cswsh',
    () =>
      probeCswsh(url, secretTargets, {
        ...opts,
        session: authSession && authSession.ok ? authSession.session : null,
        diagnostics: cswshDiag,
        ...(typeof opts.jsRoutesFetcher === 'function' ? { fetchPage: opts.jsRoutesFetcher } : {}),
      }),
    () => ({
      wsSinks: cswshDiag.wsSinks || 0,
      wsEndpoints: cswshDiag.wsEndpoints || 0,
      driveAttempted: Boolean(cswshDiag.driveAttempted),
      driveExecuted: Boolean(cswshDiag.driveExecuted),
      sessionOk: Boolean(cswshDiag.sessionOk),
    })
  );
  plan('oauth', () => probeOauth(url, { ...opts, labTargets }));
  // OAuth lab flows (10 Nov 2026, 130th phase): the completed-flow
  // OAuth/OIDC rows (#487-#493, #497, #502) — magic-link replay,
  // pre-account hijack, unverified-email IdP, forced linking, code
  // injection, IdP mix-up, SSRF via dynamic registration, refresh
  // reuse, WebAuthn without validation. Lab-gated + fingerprint-
  // gated inside the probe (returns [] on any non-oauth-lab target),
  // so on a bare page this records an honest no-op.
  // NOTE (merge): the scout lane implemented the same 9 rows as 9
  // separate lab-gated phases with the same 10 findings; the
  // single-phase oauthLab.js already live on main is kept instead,
  // so the OAuth lab proof baseline keeps its titles.
  plan('oauth-lab', () => probeOauthLab(url, { ...opts, labTargets }));
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
  plan(
    'saml',
    () =>
      probeSaml(url, {
        ...opts,
        labTargets,
        ...(oob
          ? { oobCallback: oob.baseUrl(), oobWaitFor: (token, ms) => oob.waitFor(token, ms) }
          : {}),
      }),
    undefined,
    { teardown: oob ? () => oob.stop() : undefined }
  );
  plan('tls', () => probeTls(url, opts));
  plan('password-reset', () => probePasswordReset(forms, url, { ...opts, labTargets }));
  plan('crypto', () => probeCrypto(url, opts));
  // HASH LENGTH EXTENSION (10 Nov 2026, row #506 [High] hash
  // length extension, CWE-327 / CWE-347): a secret-prefix MAC
  // (hash(secret || message)) lets an attacker forge a valid MAC
  // for message + glue-padding + append without knowing the
  // secret. The probe needs a harvested MAC triple from the caller
  // (opts.hashLengthExtension: { message, mac, algorithm, append }
  // plus opts.verifyMac / opts.verifyUrl) — without it the phase
  // records a skip in diagnostics, never a guess (see
  // hashLengthExtension.js). No MAC harvester exists in the scan
  // yet, so the phase skips until one lands. Diagnostics ride the
  // phase extras (algorithm, secretLengthsTried, forgedAccepted,
  // skipNote).
  const hleDiag = {};
  plan(
    'hash-length-extension',
    () => probeHashLengthExtension(url, { ...opts, diagnostics: hleDiag }),
    () => ({
      algorithm: hleDiag.algorithm || null,
      secretLengthsTried: hleDiag.secretLengthsTried || 0,
      forgedAccepted: Boolean(hleDiag.forgedAccepted),
      skipNote: hleDiag.skipped || null,
    })
  );
  plan('prototype-pollution', () => probePrototypePollution(url, { ...opts, labTargets }));
  plan('deserialization', () => probeDeserialization(url, { ...opts, labTargets }));
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
  plan(
    'nuclei',
    async () => {
      nucleiResult = await nucleiRunner(url, opts);
      return nucleiResult.findings;
    },
    () => (nucleiResult ? nucleiPhaseFields(nucleiResult) : {})
  );

  // Run the planned probe phases concurrently (bounded pool, default
  // cap 5 — DM_SCANNER_PHASE_CONCURRENCY or opts.phaseConcurrency
  // overrides it). Outcomes merge in TASK order via onSettled, so
  // `all`, `errors` and the phase records land exactly as the old
  // sequential loop produced them. A task that throws or times out
  // (opts.phaseTimeoutMs, unset by default) synthesises a failed
  // phase record instead of aborting the scan.
  await runPhaseTasks(probeTasks, {
    concurrency: resolvePhaseConcurrency(opts),
    timeoutMs: opts.phaseTimeoutMs,
    onSettled: (outcome) => {
      const value = outcome.value;
      if (value && value.record) {
        if (Array.isArray(value.result)) all.push(...value.result);
        if (value.error) errors.push(`${outcome.name}: ${value.error}`);
        emitPhase(value.record);
        return;
      }
      // The task threw or timed out (value undefined): record the
      // failure as a phase record so the run still reports it.
      errors.push(`${outcome.name}: ${outcome.error}`);
      emitPhase({
        name: outcome.name,
        startedAt: outcome.startedAt,
        finishedAt: outcome.finishedAt,
        durationMs: outcome.durationMs,
        ok: false,
        error: outcome.error,
        findingsCount: 0,
      });
    },
  });

  const { confirmed, unconfirmed } = verifyFindings(all);
  // PER-ROUTE ROLLUP (9 Nov 2026, /* scope): the report must answer
  // "which route had what" — findingsByRoute groups confirmed
  // finding titles by route (origin + pathname, query stripped).
  // routesScanned is the number of pages the crawl visited (1 in
  // page mode); pagesCrawled keeps its old meaning (crawled links
  // count) so existing reporting does not shift.
  const scannedPages =
    crawled && Array.isArray(crawled.pages) && crawled.pages.length
      ? crawled.pages.map((p) => p.url)
      : [url];
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
    scanScope,
    routesScanned: scannedPages.length,
    scannedPages,
    findingsByRoute: groupFindingsByRoute(confirmed, url),
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
