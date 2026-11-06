// Dark Matter rule-based scanner — deterministic orchestrator.
// paste link → scope check → recon/fingerprint → ONE-PAGE-DEEP element
// analysis → probe battery → Nuclei → differential verification →
// confirmed findings.
// No LLM, no API keys, no prompts. Same target + same code = same result.
import { authorizeTarget } from './target.js';
import { randomBytes } from 'node:crypto';
import { fingerprint, fetchPage } from './fingerprint.js';
import { crawl, extractParams, extractForms } from './crawl.js';
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
import { probeTls } from './probes/tlsScan.js';
import { probePasswordReset } from './probes/passwordReset.js';
import { probeElInject } from './probes/elInject.js';
import { probeOgnlInject } from './probes/ognlInject.js';
import { runNuclei, nucleiPhaseFields } from './nuclei.js';
import { verifyFindings } from './verifier.js';

export const DEFAULT_PHASES = [
  'fingerprint',
  'crawl',
  'page-analyze',
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
 * Run the rule-based scan battery.
 *
 * opts (5 Nov 2026, phase visibility): `opts.onPhase` — optional callback
 * invoked (best-effort) with each step's phase record as the step finishes;
 * `opts.nucleiRunner` — test seam, defaults to the real runNuclei.
 * Returns `phases` — one record per executed step ({name, startedAt,
 * finishedAt, durationMs, ok, error, findingsCount}; the nuclei record
 * additionally carries ok/timedOut/stderrTail) PLUS one skipped record per
 * param-battery phase ({skipped: true, skipReason}) when the scan had zero
 * param-bearing targets (35/63 fix — a skipped phase is neither ok nor
 * failed; buildPhaseRollup counts it separately). `errors` is kept for
 * backward compatibility.
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
    pageAnalysis = analyzePage(body, url);
    return pageAnalysis;
  });

  // Scan targets: the target URL plus every discovered same-origin link
  // (capped). Param probes run per URL — this is what makes the battery
  // cover the whole site, not just the landing page.
  const maxUrls = opts.maxUrls || 10;
  const scanTargets = [];
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
  const forms = crawled ? [...crawled.forms] : [];
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
        const u = new URL(url);
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

  await step('headers', () => (fp ? probeHeaders({ url, headers: fp.headers }) : []));
  // 35/63 FIX: track whether the param battery ran at all. If no scan
  // target carried a single parameter, the loop body below never executes
  // and the 28 phases inside it would vanish in silence — record each of
  // them as skipped instead (after the loop).
  let paramBatteryRan = false;
  for (const u of scanTargets) {
    const uparams = [...new Set(extractParams(u))];
    if (uparams.length === 0) continue;
    paramBatteryRan = true;
    await step('sqli-error', () => probeSqliError(u, uparams, opts));
    await step('sqli-blind', () =>
      probeBlindSqli(u, uparams, { ...opts, dbHint: fp?.dbHint })
    );
    await step('hpp', () => probeHpp(u, uparams, opts));
    await step('csv-log-injection', () => probeCsvLog(u, uparams, opts));
    await step('xss', () => probeXssReflected(u, uparams, opts));
    await step('nosqli', () => probeNoSqli(u, uparams, opts));
    await step('nosql-deep', () => probeNoSqlDeep(u, uparams, opts));
    await step('ldapi', () => probeLdapInjection(u, uparams, opts));
    await step('ldap-blind', () => probeLdapBlind(u, uparams, opts));
    await step('xpathi', () => probeXpathInjection(u, uparams, opts));
    await step('ssi', () => probeSsiInjection(u, uparams, opts));
    await step('cmdi', () => probeCmdiTime(u, uparams, opts));
    await step('traversal', () => probeTraversal(u, uparams, opts));
    await step('rfi', () => probeRfi(u, uparams, opts));
    await step('xslt', () => probeXslt(u, uparams, opts));
    await step('eval-injection', () => probeEvalInject(u, uparams, opts));
    await step('jsonp', () => probeJsonp(u, uparams, opts));
    await step('rpo', () => probeRpo(u, uparams, opts));
    await step('tabnabbing', () => probeTabnabbing(u, opts));
    await step('dangling-markup', () => probeDanglingMarkup(u, uparams, opts));
    await step('padding-oracle', () => probePaddingOracle(u, opts));
    await step('arg-injection', () => probeArgInjection(u, uparams, opts));
    await step('ssti', () => probeSsti(u, uparams, opts));
    await step('el-injection', () => probeElInject(u, uparams, opts));
    await step('ognl-injection', () => probeOgnlInject(u, uparams, opts));
    await step('redirect', () => probeOpenRedirect(u, uparams, opts));
    await step('crlf', () => probeCrlf(u, uparams, opts));
    await step('ssrf', () => probeSsrf(u, uparams, opts));
  }
  // 35/63 FIX: no param-bearing target existed, so the whole injection
  // battery was skipped in silence. Emit one skipped record per phase so
  // the audit trail (and the rollup) shows the gap instead of a clean pass.
  if (!paramBatteryRan) {
    for (const name of PARAM_BATTERY_PHASES) skipPhase(name, 'no param targets');
  }
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
  await step('xxe', () => probeXxe(url, opts));
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
