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

/** Judge a finding given its control-probe evidence. */
export function assessConfirmation(finding, evidence = {}) {
  const proto = protocolFor(finding);
  const verdict = proto.judge({ ...finding.evidence, ...evidence });
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
// Dedup by (vuln-class + sink location + trigger), NOT by URL — stops 50
// duplicate reports for the same underlying flaw.

export function dedupeFindings(findings) {
  const seen = new Map();
  for (const f of findings || []) {
    const key = [
      String(f.class || f.type || '').toLowerCase(),
      String(f.sink || f.parameter || f.url || '').toLowerCase(),
      String(f.trigger || f.payload || '').toLowerCase().slice(0, 80),
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
