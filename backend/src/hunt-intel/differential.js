// Dark Matter hunt-intel — differential confirmation (technique #5) +
// exploitability rubric (from the crash-triage pattern).
//
// The cheapest false-positive killer in existence: NO finding is "confirmed"
// without a CONTROL — a true/false request pair proving the signal is not
// ambient noise. Adapted from nuclei-templates' differential checks
// (baseline-vs-always-false predicate testing).
//
// Verdicts:
//   confirmed   — control pair diverged as the vuln hypothesis predicts
//   unconfirmed — only a single observation exists; needs a control probe
//   rejected    — control pair did NOT diverge; almost certainly a false positive
//
// The exploitability rubric then answers: does the attacker CONTROL data,
// a code path, or merely cause an error? Only "control" findings become
// high/critical severity. This is what keeps reports credible (and hunters
// unbanned).

/**
 * Per-class confirmation protocols: what true/false pair proves the finding.
 * The engine (or a verification pass) executes these; this module judges.
 */
export const CONFIRMATION_PROTOCOLS = {
  sqli_boolean: {
    control: 'Send TRUE predicate (e.g. AND 1=1) and FALSE predicate (AND 1=2); responses must diverge.',
    judge: (r) => (r.diverged === true ? 'confirmed' : r.diverged === false ? 'rejected' : 'unconfirmed'),
  },
  sqli_time: {
    control: 'Baseline response time vs injected SLEEP(5); delay must track the injection.',
    judge: (r) => (r.delayTracks === true ? 'confirmed' : r.delayTracks === false ? 'rejected' : 'unconfirmed'),
  },
  sqli_error: {
    control: 'Trigger the DB error, then send a benign variant; error must disappear on the benign input.',
    judge: (r) => (r.errorCorrelated === true ? 'confirmed' : r.errorCorrelated === false ? 'rejected' : 'unconfirmed'),
  },
  xss_reflected: {
    control: 'Inject a unique canary; it must reflect unencoded. A second request with an encoded canary must NOT execute.',
    judge: (r) => (r.canaryReflected === true ? 'confirmed' : r.canaryReflected === false ? 'rejected' : 'unconfirmed'),
  },
  idor: {
    control: 'Request object A (own) and object B (other user). B must return 200 with foreign data while an unauthenticated request to B returns 401/403.',
    judge: (r) => (r.crossUserRead === true ? 'confirmed' : r.crossUserRead === false ? 'rejected' : 'unconfirmed'),
  },
  ssrf: {
    control: 'Point the fetcher at a collaborator URL; a DNS/HTTP hit must arrive. A non-routable canary must produce no hit.',
    judge: (r) => (r.oobHit === true ? 'confirmed' : r.oobHit === false ? 'rejected' : 'unconfirmed'),
  },
  auth_bypass: {
    control: 'Replay the privileged request with no session (expect 401) and with a low-priv session performing the same action (expect 403); the bypass session must get 200.',
    judge: (r) => (r.bypassWorks === true ? 'confirmed' : r.bypassWorks === false ? 'rejected' : 'unconfirmed'),
  },
  default: {
    control: 'Repeat the probe with a benign control input; the vulnerable signal must appear ONLY on the malicious input.',
    judge: (r) => (r.signalCorrelated === true ? 'confirmed' : r.signalCorrelated === false ? 'rejected' : 'unconfirmed'),
  },
};

function protocolFor(finding) {
  const cls = String(finding.class || finding.type || '').toLowerCase().replace(/[^a-z]/g, '');
  // OOB-confirmed findings FIRST (e.g. saml_xxe_oob, sqli_oob): the
  // control is a collaborator hit, judged on oobHit — same protocol as
  // SSRF. This must precede the family branches below: 'sqli_oob'
  // contains 'sqli' and would otherwise be claimed by the sqli branch
  // for the boolean protocol (judged on `diverged`, which an OOB
  // finding never carries), leaving a collaborator-confirmed hit
  // 'unconfirmed'. The endsWith guard keeps the '_sent' dispatch
  // record (saml_xxe_oob_sent) on the default protocol, where
  // signalCorrelated still judges it.
  if (cls.endsWith('oob')) return CONFIRMATION_PROTOCOLS.ssrf;
  // Generic class -> most common protocol for that family.
  if (cls.includes('sqli') || cls.includes('sqlinjection')) {
    return cls.includes('time') || cls.includes('blind')
      ? CONFIRMATION_PROTOCOLS.sqli_time
      : cls.includes('error')
        ? CONFIRMATION_PROTOCOLS.sqli_error
        : CONFIRMATION_PROTOCOLS.sqli_boolean;
  }
  if (cls.includes('xss')) return CONFIRMATION_PROTOCOLS.xss_reflected;
  if (cls.includes('idor') || cls.includes('bola')) return CONFIRMATION_PROTOCOLS.idor;
  if (cls.includes('ssrf')) return CONFIRMATION_PROTOCOLS.ssrf;
  if (cls.includes('authbypass') || cls.includes('bypass')) return CONFIRMATION_PROTOCOLS.auth_bypass;
  for (const [key, proto] of Object.entries(CONFIRMATION_PROTOCOLS)) {
    if (key !== 'default' && cls.includes(key.replace(/_/g, ''))) return proto;
  }
  return CONFIRMATION_PROTOCOLS.default;
}

// ---- Tiny-error-page differential guard (GitHub calibration, 10 Nov 2026) ----
// Root cause (calibration hunt h_d7b2902f1a99, github.com, unauthenticated):
// 11x NoSQLi + 1x LDAP + 2x XPath on /login "confirmed" on a length
// divergence that was a rejected request, not a bypass — the operator
// response was a tiny error page (31 chars) against a full benign page
// (45,581 chars on /login, 192,606 on /resources/articles). The boolean
// probes judge "result set diverged" on |operator − benign| length, and
// a 31-char rejection stub trivially clears the 25%-of-benign bar. Same
// class as the Zerodha incident (9 Nov, 37 FPs, all protection artefacts).
//
// The guard is DIRECTIONAL and applies only to length-differential
// evidence that carries both sides' sizes (benignLength /
// operatorLength on the finding's evidence — the three boolean probes
// nosqli / ldapi / xpathi attach them; error-text oracles do NOT, so a
// genuine short error page confirming an error oracle is untouched):
//   operator tiny (<= 512 chars — a rejection stub, not a result set)
//   AND benign a real full page (>= 1024 chars)
//   AND benign >= 10x the operator (orders of magnitude larger).
// A genuine bypass returns MORE rows than the benign query, so the
// operator side is the larger one — the guard can never fire on a real
// bypass. It fires only when the operator request was rejected and the
// "divergence" is the missing page. Tightening only: it can only turn a
// would-be 'confirmed' into 'rejected', never the reverse, and it never
// touches OOB/SSRF confirmations (judged on a collaborator hit, not on
// response lengths). When either length is absent the guard abstains —
// old behaviour, unchanged.
export const TINY_ERROR_PAGE_MAX_CHARS = 512;
export const TINY_ERROR_PAGE_MIN_BENIGN_CHARS = 1024;
export const TINY_ERROR_PAGE_MIN_RATIO = 10;

/** Pure: is this length pair a tiny-error-page divergence? */
export function isTinyErrorPageDivergence(evidence = {}) {
  const benign = Number(evidence.benignLength);
  const operator = Number(evidence.operatorLength);
  if (!Number.isFinite(benign) || !Number.isFinite(operator)) return false;
  if (operator <= 0 || benign <= 0) return false;
  return (
    operator <= TINY_ERROR_PAGE_MAX_CHARS &&
    benign >= TINY_ERROR_PAGE_MIN_BENIGN_CHARS &&
    benign >= operator * TINY_ERROR_PAGE_MIN_RATIO
  );
}

/** Judge a finding given its control-probe evidence. */
export function assessConfirmation(finding, evidence = {}) {
  const merged = { ...finding.evidence, ...evidence };
  const proto = protocolFor(finding);
  const verdict = proto.judge(merged);
  // A would-be confirmation resting on a tiny-error-page divergence is
  // a rejected-request artefact, not a bypass — veto it. Runs after the
  // protocol judge so it can only demote 'confirmed' to 'rejected'.
  if (
    verdict === 'confirmed' &&
    proto !== CONFIRMATION_PROTOCOLS.ssrf &&
    isTinyErrorPageDivergence(merged)
  ) {
    return {
      verdict: 'rejected',
      protocol: `Differential rejected: operator response is a tiny error page (${merged.operatorLength} chars) against a full benign page (${merged.benignLength} chars) — the length divergence is a rejected request, not a bypass.`,
    };
  }
  return { verdict, protocol: proto.control };
}

// ---- Exploitability rubric -------------------------------------------------
// LIKELY_EXPLOITABLE: attacker controls data reaching a sensitive sink/code path.
// MEDIUM:              attacker influence is partial or impact is limited.
// BENIGN:              error/observation only; no attacker control demonstrated.
//
// Control is derived from the finding's CAPABILITY primitives (chainEngine),
// not from string-matching the class name.

const CONTROL_CAPS = new Set(['code_exec', 'db_read', 'db_write', 'file_read', 'file_write', 'auth_bypass', 'priv_esc', 'ssrf', 'js_exec', 'session_theft', 'cloud_meta']);
const PARTIAL_CAPS = new Set(['info_leak', 'data_read', 'data_write', 'state_change', 'phishing', 'bruteforce', 'admin_access', 'source_leak', 'cred_leak']);

function capabilitiesOfFinding(finding) {
  const cls = String(finding.class || finding.type || finding.name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  // Local copy of the primitive map (kept in sync with chainEngine.js).
  const map = {
    sqli: ['db_read', 'db_write'], sqli_blind: ['db_read'], sqli_error: ['db_read'],
    xss_stored: ['js_exec', 'session_theft'], xss_reflected: ['js_exec'], xss_dom: ['js_exec'],
    ssrf: ['ssrf'], lfi: ['file_read'], rfi: ['file_read', 'code_exec'], rce: ['code_exec'],
    cmd_injection: ['code_exec'], idor: ['data_read', 'data_write'], auth_bypass: ['auth_bypass'],
    jwt_weak: ['auth_bypass', 'priv_esc'], priv_esc: ['priv_esc'], cred_leak: ['cred_leak'],
    file_upload: ['file_write'], xxe: ['file_read', 'ssrf'], ssti: ['code_exec'],
    deserialization: ['code_exec'], exposed_admin: ['admin_access'], exposed_git: ['source_leak', 'cred_leak'],
  };
  if (map[cls]) return map[cls];
  for (const [key, caps] of Object.entries(map)) {
    if (cls.includes(key) || key.includes(cls)) return caps;
  }
  return [];
}

export function scoreExploitability(finding, confirmation = 'unconfirmed') {
  const conf = String(confirmation).toLowerCase();
  if (conf === 'rejected') return { level: 'BENIGN', reason: 'Control probe did not diverge — likely false positive.' };
  const caps = capabilitiesOfFinding(finding);
  const hasControl = caps.some((c) => CONTROL_CAPS.has(c));
  const hasPartial = caps.some((c) => PARTIAL_CAPS.has(c));
  if (hasControl && conf === 'confirmed') {
    return { level: 'LIKELY_EXPLOITABLE', reason: 'Confirmed attacker control over a sensitive sink.' };
  }
  if (hasControl) {
    return { level: 'MEDIUM', reason: 'Sensitive sink reachable but not yet differentially confirmed.' };
  }
  if (hasPartial && conf === 'confirmed') {
    return { level: 'MEDIUM', reason: 'Confirmed finding with limited direct impact — chain it.' };
  }
  return { level: 'BENIGN', reason: 'Observation only; no attacker control demonstrated.' };
}

// ---- Dedup -----------------------------------------------------------------
// Dedup by (vuln-class + sink location + trigger + title), NOT by URL —
// stops 50 duplicate reports for the same underlying flaw.
// The title segment is load-bearing (7 Nov 2026): without it, distinct
// findings that share class + URL and carry no sink/parameter/trigger
// collapse to one — probeHeaders' five missing-header checks (hsts/csp/
// xfo/xcto/rp) all keyed identically, so only missing-hsts ever reached
// the report, and two nuclei templates matching at the same URL lost one.
// Title, NOT id: several probes use random-suffixed ids (arginj-<rand>,
// crlf-hdr-<rand>, …), so keying on id would defeat dedup for them.
// Appending a segment can only split, never merge — every finding that
// survived before still survives; identical title + identical key still
// collapses to one.

export function dedupeFindings(findings) {
  const seen = new Map();
  for (const f of findings || []) {
    const key = [
      String(f.class || f.type || '').toLowerCase(),
      String(f.sink || f.parameter || f.url || '').toLowerCase(),
      String(f.trigger || f.payload || '').toLowerCase().slice(0, 80),
      String(f.title || '').toLowerCase().slice(0, 80),
    ].join('|');
    if (!seen.has(key)) seen.set(key, f);
  }
  return [...seen.values()];
}

// ---- Evidence-first gate (BugTraceAI technique, Apache-2.0) -----------------
// "AI output is a hypothesis, evidence makes it a finding."
// No finding ships to the user without attached execution evidence:
// the exact request, the exact response, and what proves exploitation.

const EVIDENCE_REQUIREMENTS = {
  critical: ['request', 'response', 'impact_demo'],
  high: ['request', 'response'],
  medium: ['request', 'response'],
  low: ['request'],
};

/**
 * Gate a finding: does it carry enough evidence to ship?
 * @returns {{pass: boolean, missing: string[], gated: object}}
 */
export function evidenceGate(finding) {
  const severity = String(finding.severity || 'medium').toLowerCase();
  const required = EVIDENCE_REQUIREMENTS[severity] || EVIDENCE_REQUIREMENTS.medium;
  const evidence = finding.evidence || {};
  const missing = required.filter((k) => !evidence[k]);
  const gated = {
    ...finding,
    evidenceStatus: missing.length === 0 ? 'evidenced' : 'hypothesis',
    evidenceMissing: missing,
  };
  return { pass: missing.length === 0, missing, gated };
}

// ---- 4-step verify pipeline (0sec technique) --------------------------------
// reachability → payload validation → impact assessment → exploit confirmation.
// ANY step fails = false positive. No exceptions.

export const VERIFY_STEPS = [
  { id: 'reachability', desc: 'Target endpoint is reachable and responds' },
  { id: 'payload_validation', desc: 'Payload reaches the sink unmodified (or predictably transformed)' },
  { id: 'impact_assessment', desc: 'Observed behavior proves security impact (not just reflection)' },
  { id: 'exploit_confirmation', desc: 'Impact is reproducible and attacker-controlled' },
];

/**
 * Run the 4-step verify pipeline over step results.
 * @param {{reachability: boolean, payload_validation: boolean, impact_assessment: boolean, exploit_confirmation: boolean}} steps
 * @returns {{verified: boolean, failedAt: string|null, verdict: string}}
 */
export function verifyPipeline(steps) {
  for (const step of VERIFY_STEPS) {
    if (!steps[step.id]) {
      return {
        verified: false,
        failedAt: step.id,
        verdict: `false_positive (${step.id}: ${step.desc} — FAILED)`,
      };
    }
  }
  return { verified: true, failedAt: null, verdict: 'confirmed (all 4 steps passed)' };
}

// ---- Execution-failure gate (solver #442, 20 Oct 2026) ----------------------
// Root cause of the verifier false-accept family (45 settled cases audited on
// benchmark hunt h_bench_d69e5746): when a probe command FAILED inside the
// container (curl DNS failure on a placeholder host, connection refused,
// grep no-match), the exec layer reported the failure as error text —
// "Command failed: docker exec … sh -c <cmd>" — and that text was
// concatenated into the evidence output. The echoed command line contains
// the probe URL (e.g. /admin), so downstream signal extraction derived a
// real-looking impact signal ('admin-exposure') from the FAILURE ECHO
// itself. A deterministic re-run reproduced the identical failure → the
// identical signal → "confirmed (all 4 steps passed)". The verifier never
// checked whether the command had actually run.
// Rule: a failed execution produces NO evidence — regardless of any marker
// text found in the output. Tightening only: a successful run (exit code 0,
// no failure marker) is completely unaffected, so no genuine finding path
// changes behaviour.
export function executionFailed(result, outputText = '') {
  if (result && typeof result.code === 'number' && result.code !== 0) return true;
  const out = String(outputText || '');
  return /Command failed:|DM_CONTAINER_MISSING/.test(out);
}

// ---- HTTP error-page detector (27 Oct 2026, 404-verified audit) -------------
// The verifier's remaining false-accept family: a probe whose response is
// an HTTP error page (404 Not Found for /rest/admin/* on DVWA) still
// "verifies" — curl without -f exits 0 on a 404, the 404 body contains
// the signal word ("admin"), and a 404 reproduces deterministically, so
// sig1 === sig2 "confirms" it. An error page is not evidence of a
// vulnerability: no status code was ever checked anywhere in the verify
// path. These detectors read the status from the response text itself
// (status line when the probe captured headers, <title> / Apache body
// when it captured the body only) — the same evidence the verifier
// already holds, no extra probe needed.
//   httpErrorStatus(text) -> 0 (not an error page) or the 4xx/5xx code.
//   isHttpErrorPage(text) -> boolean.
// Tightening only: a 200-class page is completely unaffected.
export function httpErrorStatus(text) {
  const s = String(text || '');
  if (!s) return 0;
  let m = /^HTTP\/\d+(?:\.\d+)?\s+([45]\d\d)\b/m.exec(s);
  if (m) return Number(m[1]);
  m = /<title>\s*([45]\d\d)\s+(not found|forbidden|internal server error|bad gateway|service unavailable|method not allowed|gone|conflict|unauthorized|too many requests|bad request)[^<]{0,60}<\/title>/i.exec(s);
  if (m) return Number(m[1]);
  if (/The requested URL [^\n]{0,200} was not found on this server/i.test(s)) return 404;
  if (/<h1>\s*Not Found\s*<\/h1>/i.test(s) && /404/.test(s)) return 404;
  return 0;
}

export function isHttpErrorPage(text) {
  return httpErrorStatus(text) > 0;
}

// ---- Evidence-reproduction confirmation (gate-replay lane, 28 Oct 2026) -----
// Root cause of the 0-verified night (live DVWA hunt h_830317bdc184):
// assessResult confirmed a claim only when the SIGNAL SET of the brain's
// pasted evidence EXACTLY equalled the signal set of the re-run's raw
// output (sig1 === sig2). For a data-exfiltration finding (UNION dump)
// the brain's evidence is a hand-pasted excerpt and the re-run is full
// raw output — they carry different signal words (an extra 'mysql' /
// 'token' / 'admin' line on either side, a negated line, a framing
// line), so a real, reproducible dump was rejected as "the second run
// differed" — the SQLi claim filed 05:17 and 06:31 IST 28 Oct was
// rejected both times within 1 second, although the dump (all five
// DVWA users with MD5 hashes) was real and in hand. The signal set is
// a proxy for "the re-run reproduced the evidence"; for data claims
// the right check is whether the re-run reproduces the CLAIMED DATA
// itself. That is what evidenceReproduced answers, deterministically:
//
//   1. DATA TOKENS — a reproduced hash / canary IS the proof. Hex
//      strings (>= 16 chars: MD5/SHA hashes, tokens) are the data
//      itself — a password hash in the re-run output is the
//      exfiltration. Canary tokens (mixed letter+digit, >= 6 chars,
//      present in BOTH the evidence and the command — the probe's
//      payload, reflected or exfiltrated) count only when the
//      re-run line carrying the marker also carries a supporting
//      signal: a bare marker echo (the script tag stripped) does
//      NOT reproduce an XSS claim.
//   2. ERROR PAGE — a re-run that returns an HTTP error page is not
//      a confirmation, however reproducible (the 404 family: a 404
//      reproduces deterministically, so step 3 alone would confirm
//      it). Runs after the token check, so a re-run that DOES return
//      the claimed data is not vetoed by an error line elsewhere in
//      its output.
//   3. SIGNAL-LINE FALLBACK — when the evidence names no concrete
//      data token (a prose-free excerpt), a supporting-signal line
//      (>= 40 normalised chars, non-negated, non-framing) from the
//      evidence reproduced verbatim in the re-run output confirms.
//      Evidence that yields no token AND no signal line cannot be
//      confirmed — there is nothing concrete to reproduce, so the
//      claim stays unproven (the brain must paste the real output;
//      the claim contract already requires "the exact output").
//
// Tightening only in one direction and loosening in exactly one:
// a claim whose re-run reproduces its data now confirms (previously
// impossible for dump-shaped evidence); a claim whose re-run does
// NOT reproduce its data still fails exactly as before. The 404
// protection is preserved at two layers — this function's step 2,
// and assessContentRelevance's limb 0, which still runs after the
// pipeline passes.
const CANARY_STOPWORDS = new Set([
  'base64', 'sha256', 'sha512', 'sha1', 'md5', 'utf8', 'utf-8', 'ascii',
  'https', 'http', 'html', 'json', 'admin', 'passwd', 'password',
  // Tool / interpreter names — never exfiltrated data, but they match
  // the canary shape (letters + digit) and appear in both a command
  // and its output framing.
  'python3', 'python2', 'node', 'nodejs', 'curl', 'wget', 'bash', 'sh',
  'perl', 'ruby', 'php', 'java',
]);

/**
 * The concrete data tokens a claim asserts: long hex strings (hashes)
 * plus canary tokens (mixed letter+digit, >= 6 chars) that appear in
 * both the evidence and the reproducing command. Pure.
 */
export function evidenceDataTokens(evidence, command = '') {
  const ev = String(evidence || '');
  const cmdLower = String(command || '').toLowerCase();
  const tokens = new Set();
  for (const m of ev.matchAll(/\b[0-9a-f]{16,}\b/gi)) tokens.add(m[0].toLowerCase());
  for (const m of ev.matchAll(/\b(?=[a-z0-9]*[a-z])(?=[a-z0-9]*[0-9])[a-z0-9]{6,}\b/gi)) {
    const t = m[0].toLowerCase();
    if (CANARY_STOPWORDS.has(t)) continue;
    if (cmdLower.includes(t)) tokens.add(t);
  }
  return [...tokens].sort();
}

/**
 * Did the re-run reproduce the claimed evidence? Pure.
 * @param {string} evidence — the claim's evidence (brain's pasted output)
 * @param {string} reRunOutput — the verifier re-run's raw output
 * @param {string} command — the reproducing command (canary source)
 * @returns {boolean}
 */
export function evidenceReproduced(evidence, reRunOutput, command = '') {
  const out = String(reRunOutput || '');
  if (!out.trim()) return false;
  const outLower = out.toLowerCase();
  // 1. A reproduced data token IS the proof. A HEX token is the
  // data itself (a password hash in the output is the
  // exfiltration). A CANARY token is only the marker: it counts
  // when the re-run line carrying it also carries a supporting
  // signal — a bare marker echo (the script tag stripped) does
  // NOT reproduce an XSS claim.
  const tokens = evidenceDataTokens(evidence, command);
  for (const token of tokens) {
    if (!outLower.includes(token)) continue;
    if (/^[0-9a-f]{16,}$/.test(token)) return true;
    for (const line of out.split('\n')) {
      if (line.toLowerCase().includes(token) && evidenceSignalIds(line, command).length > 0) return true;
    }
  }
  // 2. An error page is not a confirmation, however reproducible.
  if (isHttpErrorPage(out)) return false;
  // 3. Fallback: a signal line from the evidence, reproduced verbatim.
  const lines = supportingSignalLines(evidence, { excludeText: command });
  const normOut = normalizeText(out);
  for (const { line } of lines) {
    const n = normalizeText(line);
    if (n.length >= 40 && normOut.includes(n)) return true;
  }
  return false;
}

// ---- Content-relevance judgement (solver #454, Job 7 item C) ----------------
// The execution gate above answers "did the probe run?" — it cannot answer
// "does this output actually prove THIS claim about THIS target?" The
// residual false-accept family (flagged in #442, audited shapes #233,
// #256/#257, #259–#262, #73–#81 on h_bench_d69e5746) is successful commands
// whose output is signal-bearing but irrelevant:
//   - the target's own generic content (SPA index / theme CSS) contains
//     signal words ('admin', 'token') — the words are ambient, not evidence;
//   - a probe of a DIFFERENT host (target.com) returned a 301 whose echoed
//     Location header contains '/admin' — real content, wrong target;
//   - a sweep probe's own output NEGATES the claim ("not exposed: …/.env"
//     ×3) while extractSignal still fires on the '.env' filename.
// This judgement binds evidence to claim with three deterministic limbs,
// all tightening-only (it can only turn a would-be verified into a
// rejection; it never promotes anything):
//   1. HOST BINDING — every host referenced by the probe command must be
//      the hunt target (or a TARGET/TARGET_IP/TARGET_URL placeholder the
//      runner substitutes with it). Evidence from another host is not
//      evidence about this target.
//   2. SUPPORTING SIGNAL — at least one output line must carry a signal
//      (extractSignal's vocabulary, kept in sync below, or the pipeline's
//      payload keyword set) that is NOT negated earlier in the same line
//      ("not exposed: …" does not support an exposure claim).
//   3. NOVELTY vs BASELINE — that supporting signal's surrounding text
//      must not appear in the target's generic baseline bodies (root page
//      + a canary path that returns the SPA fallback / generic error +
//      the root page's linked CSS/JS assets, added solver #456 — an
//      asset-shaped stamp must be judged against the real asset bodies
//      too, not just the HTML shell). Ambient site content cannot prove
//      a vulnerability.
// If no baseline could be fetched, limb 3 abstains (logged by the caller):
// the check tightens wherever it can judge, and never silently loosens.

// Signal vocabulary — mirror of huntAgent.js extractSignal() (kept in sync
// by hand, same precedent as capabilitiesOfFinding vs chainEngine above),
// plus the verify pipeline's payload keyword set as id 'keyword'.
// Rule #73: three generic-probe signal ids (ssrf-fetch, ssti-eval,
// open-redirect). Each fires ONLY on a probe EVIDENCE line the probe
// prints exclusively on a CONFIRMED verdict with a never-transmitted
// observed artifact (listener canary hit / computed arithmetic result /
// canary host in the redirect target) — the Rule #49 treatment: the
// pipeline re-runs the probe independently, so a broken probe that
// printed these unconditionally would be caught by the re-run, and the
// lab proof asserts each probe stays FAILED on the /safe control.
const RELEVANCE_SIGNAL_PATTERNS = [
  { id: 'sql-error', re: /sql syntax|mysql|postgres|sqlite|ora-\d+|sql error/i },
  { id: 'stack-trace', re: /stack trace|traceback|exception in|at .*\(.*\.js:/i },
  { id: 'cmd-exec', re: /root:|uid=0|uid=\d+\(/i },
  { id: 'xss-reflect', re: /<script>alert|onerror=|onload=/i },
  { id: 'admin-exposure', re: /admin|administrator|dashboard/i },
  { id: 'secret-exposure', re: /\.env|secret|private key|api[_-]?key/i },
  { id: 'dir-listing', re: /directory listing|index of\//i },
  { id: 'auth-bypass', re: /bypass|403.*200|unauthorized.*authorized/i },
  { id: 'keyword', re: /vulnerable|exposed|injection|leak|token|password/i },
  { id: 'ssrf-fetch', re: /via=ssrf-fetch-hit/i },
  { id: 'ssti-eval', re: /arithmetic result \d+, which was never transmitted|template evaluated server-side/i },
  { id: 'open-redirect', re: /via=redirect-(location|meta|js)/i },
];
const NEGATION_CUE = /\b(not|no|never|none|without|failed|failure|unable|cannot|can't|couldn't|didn't|doesn't|isn't|aren't|wasn't|weren't|denied|blocked|absent|missing|refused)\b/i;

function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Lines of `text` that support a claim: a signal match whose position is
 * not preceded by a negation cue in the same line. Returns
 * [{signal, line, index}] — index is the match offset within the line.
 *
 * FRAMING EXCLUSION (Lane A, 21 Oct 2026 — verifier label-trust re-fire):
 * when `excludeText` (the executed probe command) is supplied, a line
 * that appears VERBATIM in the command is the probe's own framing —
 * echo banners and printed labels — not target content, and is skipped.
 * Root cause it closes: the canary-controlled /ftp probe v3 prints the
 * banner "--- /ftp/ directory listing ---" UNCONDITIONALLY as its first
 * line. On open.ys7.com every per-file verdict was "not exposed:", yet
 * the banner alone supplied a non-negated, baseline-novel 'dir-listing'
 * signal, so the verifier "confirmed" a finding whose own evidence
 * negated it (Ezviz stamp 2026-10-20T13:23:12.720Z, episode #16010).
 * Deterministic probes reproduce their banner perfectly, so a
 * reproducibility check over raw text confirms the banner, not the
 * vulnerability. Lines the probe instantiates per-result (a filename
 * substituted into a label) are NOT verbatim in the command and still
 * count — that asymmetry is exactly what separates a conditional
 * verdict label from unconditional framing.
 */
export function supportingSignalLines(text, { excludeText = '' } = {}) {
  const out = [];
  const framingCorpus = excludeText ? normalizeText(excludeText) : '';
  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (framingCorpus) {
      const normLine = normalizeText(line);
      if (normLine.length >= 10 && framingCorpus.includes(normLine)) continue;
    }
    const neg = NEGATION_CUE.exec(line);
    const negIdx = neg ? neg.index : -1;
    for (const { id, re } of RELEVANCE_SIGNAL_PATTERNS) {
      const m = re.exec(line);
      if (m && (negIdx === -1 || m.index < negIdx)) {
        out.push({ signal: id, line, index: m.index, match: m[0] });
        break; // one supporting record per line is enough
      }
    }
  }
  return out;
}

/**
 * Signal ids EVIDENCED by an executed probe's output: signals carried
 * by lines that are (a) not negated before the match and (b) not the
 * probe's own framing (verbatim in the executed command). This is the
 * only signal set the verify path may trust — assessResult's
 * reproducibility confirmation and impact assessment consume it, so a
 * deterministic probe can no longer "confirm" itself by re-printing
 * its own banner/labels, and a superseded probe whose verdict lines
 * are all negated ("not exposed: …") yields an EMPTY set even though
 * the raw text is full of signal words. Tightening only: genuine
 * target content (response bodies, per-result verdict labels with
 * substituted values) is never verbatim in the command and is
 * unaffected.
 */
export function evidenceSignalIds(text, command = '') {
  const ids = new Set();
  for (const s of supportingSignalLines(text, { excludeText: command })) ids.add(s.signal);
  return [...ids].sort();
}

/** Hosts a shell command references: URLs and bare IPv4, host[:port]. */
export function commandHostRefs(command) {
  const refs = new Set();
  const cmd = String(command || '');
  for (const m of cmd.matchAll(/https?:\/\/([a-z0-9.-]+)(?::(\d+))?/gi)) {
    refs.add(m[2] ? `${m[1].toLowerCase()}:${m[2]}` : m[1].toLowerCase());
  }
  for (const m of cmd.matchAll(/\b(\d{1,3}(?:\.\d{1,3}){3})(?::(\d+))?\b/g)) {
    refs.add(m[2] ? `${m[1]}:${m[2]}` : m[1]);
  }
  return [...refs];
}

/** The hunt target as host[:port] (port only when non-default/explicit). */
export function targetHostRef(target) {
  try {
    const u = new URL(String(target || ''));
    const port = u.port || (u.protocol === 'https:' ? '443' : '80');
    return `${u.hostname.toLowerCase()}:${port}`;
  } catch {
    return null;
  }
}

function hostRefMatchesTarget(ref, tRef) {
  if (!tRef) return true; // cannot parse the target — abstain on this limb
  const bare = ref.toLowerCase();
  if (bare === 'target' || bare === 'target_ip' || bare === 'target_url') return true;
  const [tHost, tPort] = tRef.split(':');
  if (!bare.includes(':')) return bare === tHost; // host-only ref: host must match
  const [rHost, rPort] = bare.split(':');
  if (rHost !== tHost) return false;
  // The target URL's port is authoritative; a ref naming a different
  // explicit port probed a different service.
  return rPort === tPort;
}

/**
 * Linked CSS/JS asset URLs referenced by an HTML body (solver #456).
 * Pure parser used by the baseline fetcher to extend the novelty corpus
 * beyond the HTML shell: <link rel="stylesheet" href="…"> and
 * <script src="…"> references, resolved against the page URL. Only
 * same-origin http(s) assets are returned (a third-party CDN body is not
 * the target's ambient content, and fetching it would leave scope);
 * duplicates are dropped and the list is capped. Returns [] on any
 * unparseable input — the caller treats that as "no asset corpus",
 * never as an error.
 */
export function extractLinkedAssetUrls(html, baseUrl, maxAssets = 8) {
  let base;
  try {
    base = new URL(String(baseUrl || ''));
  } catch {
    return [];
  }
  const out = [];
  const seen = new Set();
  const push = (raw) => {
    if (out.length >= maxAssets) return;
    const ref = String(raw || '').trim();
    if (!ref || ref.startsWith('data:') || ref.startsWith('blob:')) return;
    let u;
    try {
      u = new URL(ref, base);
    } catch {
      return;
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
    if (u.origin !== base.origin) return; // same-origin only — scope + relevance
    const key = u.href;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(key);
  };
  const text = String(html || '');
  // <link … href="…"> (stylesheet/icon preloads all carry ambient CSS/JS refs)
  for (const m of text.matchAll(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) push(m[1]);
  // <script … src="…">
  for (const m of text.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) push(m[1]);
  return out;
}

/**
 * Judge whether executed-probe output is bound to the claim.
 * @param {{command: string, target: string, output: string, baselines?: string[]}} args
 *   baselines: the target's generic bodies (root + canary + linked
 *   CSS/JS assets). Empty/absent → the novelty limb abstains.
 * @returns {{relevant: boolean, reason: string}}
 */
export function assessContentRelevance({ command, target, output, baselines } = {}) {
  // Limb 0 — ERROR PAGE (27 Oct 2026, 404-verified audit): an HTTP
  // error page is not evidence, however many signal words it carries.
  // Runs first: a 404 body contains "admin", so limbs 1-3 all pass on
  // it. Tightening only — a 200-class response is unaffected.
  const errStatus = httpErrorStatus(output);
  if (errStatus) {
    return { relevant: false, reason: `PoC response is an HTTP ${errStatus} error page, not the vulnerability` };
  }
  // Limb 1 — host binding.
  const refs = commandHostRefs(command);
  const tRef = targetHostRef(target);
  if (refs.length > 0 && tRef && !refs.some((r) => hostRefMatchesTarget(r, tRef))) {
    return { relevant: false, reason: `off-target host (probe referenced ${refs.join(', ')}; hunt target is ${tRef})` };
  }
  // Limb 2 — a non-negated supporting signal must exist.
  const support = supportingSignalLines(output);
  if (support.length === 0) {
    return { relevant: false, reason: 'no non-negated signal line in evidence (signal absent or negated by the evidence text itself)' };
  }
  // Limb 3 — novelty against the target's generic baseline content.
  const baseTexts = (baselines || []).filter((b) => String(b || '').trim().length > 0);
  if (baseTexts.length > 0) {
    const corpus = baseTexts.map(normalizeText).join('\n');
    const novel = support.some(({ line, index, match }) => {
      const start = Math.max(0, index - 48);
      const window = normalizeText(line.slice(start, index + match.length + 48));
      return window.length > 0 && !corpus.includes(window);
    });
    if (!novel) {
      return { relevant: false, reason: 'signal content is ambient (present verbatim in the target baseline response)' };
    }
  }
  return { relevant: true, reason: 'bound: non-negated signal, novel vs target baseline, on-target host' };
}

// ---- SQL Injection Auth-Bypass Claim Validator (31 Oct 2026) ----------------
// ROOT CAUSE (probe_sqli_bypass false-accept): the 4-step verifyPipeline
// checked boolean flags derived from keyword presence in output, not from
// demonstrated vulnerability impact. A login form HTML (>50 chars) with the
// word "bypass" (from the probe's own name) passed all 4 steps.
//
// This validator enforces claim-to-evidence requirements for SQLi
// authentication-bypass claims. It does NOT hardcode rejection — genuine
// findings with sufficient evidence remain confirmable.
//
// For auth-bypass claims, REQUIRE:
// 1. Baseline auth state established (what does "not logged in" look like?)
// 2. Test executed with SQLi payload
// 3. Independent verification that auth state CHANGED (not just keywords)
// 4. Access to protected resource OR other direct impact indicator
// 5. REJECT if response merely returns the login page
//
// Do NOT accept as evidence:
// - HTTP 200 alone
// - Login form HTML in response
// - Generic error messages
// - Keywords (bypass, injection, vulnerable) in output
// - Model assertions without demonstrated state change
// - Repeated checks depending on the same weak signal
//
// @param {Object} claim - { output, baselineOutput, payload, endpoint }
// @returns {{verdict: 'confirmed'|'rejected'|'inconclusive', reason: string, evidence: Object}}

/**
 * Detect if HTML output is a login form (not an authenticated page).
 * A login form contains password input fields and login-related text,
 * but no authenticated session indicators.
 */
function isLoginFormHtml(output) {
  const html = String(output || '').toLowerCase();
  // Must have password field (characteristic of login form)
  const hasPasswordField = /<input[^>]*type\s*=\s*["']?password/i.test(html);
  // Must have login-related text
  const hasLoginText = /login|sign in|username.*password|password.*username/i.test(html);
  // Must NOT have authenticated indicators
  const hasAuthIndicators = /logout|log out|welcome back|dashboard|my account|session.*active/i.test(html);
  
  return hasPasswordField && hasLoginText && !hasAuthIndicators;
}

/**
 * Check for demonstrated authentication state change.
 * Looks for concrete indicators that the session is now authenticated,
 * not just keywords in the output.
 */
function hasAuthStateChange(baselineOutput, testOutput) {
  const baseline = String(baselineOutput || '').toLowerCase();
  const test = String(testOutput || '').toLowerCase();
  
  // Baseline should be unauthenticated (login form)
  const baselineIsLogin = isLoginFormHtml(baseline);
  
  // Test output should NOT be login form (should be authenticated page)
  const testIsLogin = isLoginFormHtml(test);
  
  // Auth state changed if: baseline was login form AND test is not login form
  // AND test shows authenticated indicators
  if (baselineIsLogin && !testIsLogin) {
    const hasAuthIndicators = /logout|welcome|dashboard|authenticated/i.test(test);
    return hasAuthIndicators;
  }
  
  return false;
}

export function validateSqliAuthBypass({ output, baselineOutput = '', payload = '', endpoint = '' }) {
  const out = String(output || '');
  
  // REJECT: Output is just a login form (no bypass demonstrated)
  if (isLoginFormHtml(out)) {
    return {
      verdict: 'rejected',
      reason: 'Response is a login form — no authentication bypass demonstrated. A successful SQLi auth bypass must show an authenticated session, not the login page.',
      evidence: {
        isLoginForm: true,
        hasPasswordField: /<input[^>]*type\s*=\s*["']?password/i.test(out.toLowerCase()),
      },
    };
  }
  
  // REJECT: No baseline to compare against (cannot prove state change)
  if (!baselineOutput || String(baselineOutput).trim().length === 0) {
    return {
      verdict: 'inconclusive',
      reason: 'No baseline authentication state provided — cannot verify that auth state changed. Provide baseline (unauthenticated) output for comparison.',
      evidence: { hasBaseline: false },
    };
  }
  
  // CHECK: Did auth state actually change?
  const stateChanged = hasAuthStateChange(baselineOutput, out);
  if (!stateChanged) {
    return {
      verdict: 'rejected',
      reason: 'No demonstrated authentication state change. The test output does not show a transition from unauthenticated to authenticated state.',
      evidence: {
        baselineWasLogin: isLoginFormHtml(baselineOutput),
        testIsLogin: isLoginFormHtml(out),
        stateChanged: false,
      },
    };
  }
  
  // CONFIRMED: Auth state changed from login form to authenticated page
  return {
    verdict: 'confirmed',
    reason: 'Authentication state changed from unauthenticated (login form) to authenticated (session indicators present). SQLi auth bypass demonstrated.',
    evidence: {
      baselineWasLogin: true,
      testIsLogin: false,
      stateChanged: true,
    },
  };
}

// ---- Generic Weak-Signal Rejector (31 Oct 2026) ----------------------------
// For any vulnerability claim, reject these weak signals as sole evidence:
// - HTTP 200 status alone
// - Generic error messages
// - Keywords in output without demonstrated impact
// - Model assertions without evidence
//
// @param {Object} claim - { output, vulnerabilityClass }
// @returns {{isWeak: boolean, reason: string}}

export function isWeakSignalOnly({ output, vulnerabilityClass = '' }) {
  const out = String(output || '');
  
  // Check if output contains ONLY weak signals (no concrete impact evidence)
  const hasKeywords = /vulnerable|bypass|injection|leak|exposed/i.test(out);
  const has200 = /200 OK|HTTP\/1\.1 200/i.test(out);
  const hasGenericError = /error|exception|failed/i.test(out) && !/sql.*error|syntax.*error/i.test(out);
  
  // If output has keywords but no concrete impact indicators, it's weak
  const hasConcreteImpact = /logout|welcome|dashboard|authenticated|session|admin|root|uid=\d+|select.*from/i.test(out);
  
  if (hasKeywords && !hasConcreteImpact) {
    return {
      isWeak: true,
      reason: `Output contains vulnerability keywords but no concrete impact evidence for ${vulnerabilityClass}. Keywords alone do not confirm a vulnerability.`,
    };
  }
  
  return { isWeak: false, reason: 'Output contains concrete impact indicators or no misleading keywords.' };
}

// ---- XSS Claim Validator (31 Oct 2026, Phase 4) ----------------------------
// For XSS claims, require the payload to appear UNENCODED in the response
// body in an executable context. Do NOT accept:
// - HTML-entity-encoded payload (&lt;script&gt;)
// - Payload in HTML comment
// - Keywords in probe output (not in response)
// - Payload in URL but not in response body
//
// @param {Object} claim - { output, payload, baselineOutput }
// @returns {{verdict: 'confirmed'|'rejected'|'inconclusive', reason: string}}

export function validateXssClaim({ output, payload = '', baselineOutput = '' }) {
  const out = String(output || '');
  const pay = String(payload || '');
  
  if (!pay) {
    return {
      verdict: 'inconclusive',
      reason: 'No payload provided — cannot verify XSS without the test payload.',
    };
  }
  
  // Check if payload appears unencoded in output
  // First, check for entity-encoded version (this is SAFE, not vulnerable)
  const encoded = pay
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  
  const hasEncoded = out.includes(encoded) && encoded !== pay;
  const hasRaw = out.includes(pay);
  
  // If payload is entity-encoded, it's NOT XSS (properly escaped)
  if (hasEncoded && !hasRaw) {
    return {
      verdict: 'rejected',
      reason: 'Payload is HTML-entity-encoded in response — properly escaped, not XSS.',
      evidence: { encoded: true, raw: false },
    };
  }
  
  // If payload not in output at all, it's not reflected
  if (!hasRaw) {
    return {
      verdict: 'rejected',
      reason: 'Payload not found in response body — not reflected.',
      evidence: { reflected: false },
    };
  }
  
  // Check if payload is in HTML comment (not executable)
  const commentPattern = new RegExp(`<!--[\\s\\S]*?${pay.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?-->`);
  if (commentPattern.test(out)) {
    return {
      verdict: 'rejected',
      reason: 'Payload is inside HTML comment — not in executable context.',
      evidence: { inComment: true },
    };
  }
  
  // Payload is present raw and not in comment — potential XSS
  // For a full confirmation, we'd need to verify executable context,
  // but raw reflection outside comments is sufficient for 'confirmed'
  // at the validator level (browser execution is a separate step).
  return {
    verdict: 'confirmed',
    reason: 'Payload reflected unencoded in response body outside HTML comments — XSS demonstrated.',
    evidence: { reflected: true, encoded: false, inComment: false },
  };
}

// ---- Command Injection Claim Validator (31 Oct 2026, Phase 4) --------------
// For command injection claims, require command OUTPUT in the response.
// Do NOT accept:
// - Generic error messages
// - Keywords in probe output
// - "Command executed" assertions without output
// - Failed executions (must check executionFailed first)
//
// @param {Object} claim - { output, command, baselineOutput }
// @returns {{verdict: 'confirmed'|'rejected'|'inconclusive', reason: string}}

export function validateCommandInjection({ output, command = '', baselineOutput = '' }) {
  const out = String(output || '');
  
  // If the command failed to execute, there is NO evidence
  // (The caller should have checked executionFailed, but defense in depth)
  if (/Command failed:|DM_CONTAINER_MISSING|command not found/i.test(out)) {
    return {
      verdict: 'rejected',
      reason: 'Command failed to execute — failed executions produce no evidence.',
      evidence: { executed: false },
    };
  }
  
  // Look for command output indicators
  // Common command outputs: uid=, gid=, root:, directory listings, etc.
  const hasCommandOutput = /uid=\d+|gid=\d+|root:x:|www-data|total \d+|drwx/i.test(out);
  
  // Check for time-based blind (sleep command)
  const hasTimingDiff = /sleep|delay/i.test(command) && out.length > 0;
  // Note: Actual timing measurement must be done by caller; we check the pattern
  
  if (hasCommandOutput) {
    return {
      verdict: 'confirmed',
      reason: 'Command output detected in response — command injection demonstrated.',
      evidence: { hasOutput: true },
    };
  }
  
  // No command output found
  return {
    verdict: 'rejected',
    reason: 'No command output in response — injection not demonstrated. Output contains no uid/gid, file listing, or other command results.',
    evidence: { hasOutput: false },
  };
}

// ---- Path Traversal Claim Validator (31 Oct 2026, Phase 4) -----------------
// For path traversal claims, require ACTUAL FILE CONTENT in the response.
// Do NOT accept:
// - Error messages ("File not found")
// - Keywords in URL or probe output
// - HTTP 200 with error page
// - Payload in URL without file content
//
// @param {Object} claim - { output, payload, baselineOutput }
// @returns {{verdict: 'confirmed'|'rejected'|'inconclusive', reason: string}}

export function validatePathTraversal({ output, payload = '', baselineOutput = '' }) {
  const out = String(output || '');
  
  // Look for actual file content markers
  // /etc/passwd: root:x:0:0
  // win.ini: [extensions], [fonts]
  // Generic: file content patterns
  const hasPasswdContent = /root:x:0:0|daemon:x:1:1/i.test(out);
  const hasWinIniContent = /\[extensions\]|\[fonts\]|\[mci extensions\]/i.test(out);
  const hasFileContent = hasPasswdContent || hasWinIniContent;
  
  // Check for error messages (these are NOT file content)
  const hasError = /file not found|no such file|not found on this server|404/i.test(out);
  
  if (hasFileContent && !hasError) {
    return {
      verdict: 'confirmed',
      reason: 'File content detected in response — path traversal demonstrated.',
      evidence: { hasContent: true, fileType: hasPasswdContent ? 'passwd' : 'winini' },
    };
  }
  
  if (hasError) {
    return {
      verdict: 'rejected',
      reason: 'Response is an error page, not file content — traversal not demonstrated.',
      evidence: { hasContent: false, isError: true },
    };
  }
  
  return {
    verdict: 'rejected',
    reason: 'No file content in response — traversal not demonstrated. Response does not contain /etc/passwd, win.ini, or other file content markers.',
    evidence: { hasContent: false },
  };
}

// ---- Vulnerability Claim Dispatcher (31 Oct 2026, Phase 4) ------------------
// Routes a vulnerability claim to the appropriate class-specific validator.
// Falls back to generic weak-signal check for classes without specific validators.
//
// @param {string} vulnClass - Vulnerability class (sqli, xss, exec, fi, etc.)
// @param {Object} evidence - { output, payload, baselineOutput, command, endpoint }
// @returns {{verdict: 'confirmed'|'rejected'|'inconclusive', reason: string, validator: string}}

export function validateVulnClaim(vulnClass, evidence) {
  const cls = String(vulnClass || '').toLowerCase();
  
  // SQL Injection (auth bypass)
  if (cls.includes('sqli') || cls.includes('sql')) {
    // Check if it's an auth-bypass claim (login-related)
    const isAuthBypass = /login|auth|bypass/i.test(evidence.endpoint || '') || 
                         /login|auth/i.test(evidence.payload || '');
    if (isAuthBypass) {
      return { ...validateSqliAuthBypass(evidence), validator: 'validateSqliAuthBypass' };
    }
    // Generic SQLi: fall through to weak-signal check
  }
  
  // XSS (reflected, stored, DOM)
  if (cls.includes('xss') || cls.includes('cross.*site')) {
    return { ...validateXssClaim(evidence), validator: 'validateXssClaim' };
  }
  
  // Command Injection
  if (cls.includes('exec') || cls.includes('cmdi') || cls.includes('command')) {
    return { ...validateCommandInjection(evidence), validator: 'validateCommandInjection' };
  }
  
  // Path Traversal / File Inclusion
  if (cls.includes('fi') || cls.includes('lfi') || cls.includes('traversal') || cls.includes('inclusion')) {
    return { ...validatePathTraversal(evidence), validator: 'validatePathTraversal' };
  }
  
  // Fallback: generic weak-signal check
  const weak = isWeakSignalOnly({ 
    output: evidence.output, 
    vulnerabilityClass: vulnClass 
  });
  
  if (weak.isWeak) {
    return {
      verdict: 'rejected',
      reason: `No class-specific validator for '${vulnClass}'; generic check: ${weak.reason}`,
      validator: 'isWeakSignalOnly (fallback)',
    };
  }
  
  return {
    verdict: 'inconclusive',
    reason: `No class-specific validator for '${vulnClass}'; generic check passed but cannot confirm without class-specific evidence criteria.`,
    validator: 'isWeakSignalOnly (fallback)',
  };
}
