// Link → Recon → A01..A10 → Report: OWASP Top 10 2021 stage table
// (owner order 15 Nov 2026, design doc link-to-report-design-20261115.md
// §2–§4). The ordered stages are the product: REC (recon first), then
// OWASP Top 10 2021 A01..A10 in order, then Additional (outside the
// Top 10). Every one of the 159 DEFAULT_PHASES entries lives in exactly
// one stage; orderedPhases() is the flat run list in stage order.
//
// NUMBERING TRAP (§2 of the design): the Go.xlsx sheets / Self
// checklist use a DIFFERENT numbering from OWASP Top 10 2021. The
// report MUST use the 2021 numbering and titles below; the Go-sheet
// codes survive only in GO_SHEET_TO_OWASP (an internal mapping aid,
// never shown as the category in the report).
//
// VERIFICATION (Lane A, 15 Nov 2026): every row was checked against
// the probe source (backend/src/scanner/probes/*.js) and
// docs/scanner/*.md. Two corrections to design §4 v1, both recorded
// where they land below:
//   (1) `dom-cookie-manipulation` was missing from §4 entirely — it is
//       in DEFAULT_PHASES but in no stage list, so §4 listed 157
//       phases while claiming 159 (its A03 count said 55 but listed
//       54). Placed in A03: the probe drives attacker input in a URL
//       parameter into a document.cookie write that overwrites a
//       sensitive cookie — a DOM-injection sibling of dom-xss-sinks /
//       dom-clobbering / dom-postmessage, which are all A03.
//   (2) `document-domain` moved A08 → A01: the probe header cites its
//       coverage row as "CWE-668 | OWASP A01:2021" — CWE-668 is
//       exposure of a resource to the wrong sphere, and assigning
//       document.domain merges the page origin with every sibling
//       subdomain, i.e. an access-control boundary failure. A08
//       (software/data integrity) does not describe it.
//   Judgment calls CONFIRMED as written in §4 (reason in each comment):
//   webrtc-leak stays A02, validation stays A03, ws-messages stays
//   A03, the graphql family stays A03 as one unit, nuclei and
//   untrusted-js-inclusion stay A06, rpo stays A08, egress-laundering
//   + the three external-image phases stay A10.

export const STAGE_TABLE_VERSION = '20261115-v1';

// Run mode value for this flow (POST /api/v1/hunts { runMode }).
export const LINK_TO_REPORT_RUN_MODE = 'link-to-report';

// Blocked-leg reasons, verbatim in the report (design §3.2/§6).
// MCP stays blocked until the owner decides the endpoint; the 14
// kind-'ai' Self checks are never run, never faked (zero-Meta-spend).
export const MCP_BLOCKED_REASON = 'MCP endpoint decision pending (owner)';
export const AI_BLOCKED_REASON = 'no AI executor (zero-Meta-spend order)';

export const OWASP_STAGES = [
  {
    code: 'REC',
    title: 'Reconnaissance',
    goSheet: 'REC',
    note: 'Discovery only: what the target is, what it exposes.',
    phases: [
      'fingerprint',
      'crawl',
      'page-analyze',
      'dom-render',
      'openapi-targets',
      'js-api-routes',
      'post-forms',
      'fingerprint-banner',
      'subdomain-takeover',
      'secrets-in-js',
      'source-code-disclosure',
    ],
  },
  {
    code: 'A01',
    title: 'Broken Access Control',
    goSheet: 'A01',
    note: null,
    phases: [
      'missing-auth',
      'idor',
      'bfla',
      'mass-assignment',
      'verb-tampering',
      'method-override',
      'referer-access-control',
      'cors',
      'csrf',
      'cswsh',
      'redirect',
      'dom-open-redirect',
      'api-token-auth',
      // MOVED from design §4 A08 (see header): probe header cites
      // CWE-668 | OWASP A01:2021 — origin merging is an
      // access-control boundary failure, not an integrity failure.
      'document-domain',
    ],
  },
  {
    code: 'A02',
    title: 'Cryptographic Failures',
    goSheet: 'A04',
    note: null,
    phases: [
      'crypto',
      'hash-length-extension',
      'padding-oracle',
      'tls',
      'credential-disclosure',
      'sensitive-info-disclosure',
      'metadata-leakage',
      'sensitive-cache',
      'browser-storage',
      'timing-side-channel',
      // JUDGMENT CALL (§4 *), confirmed: CWE-200 information
      // exposure — the visitor's local IP disclosed to a malicious
      // page. OWASP 2021 moved sensitive-data exposure into A02, so
      // the probe header's legacy "OWASP A01:2021" tag is not
      // followed here; A08 (integrity) does not fit either. Grouped
      // with A02's other disclosure phases.
      'webrtc-leak',
    ],
  },
  {
    code: 'A03',
    title: 'Injection',
    goSheet: 'A05',
    note: null,
    phases: [
      'sqli-error',
      'sqli-blind',
      'sqli-union',
      'sqli-boolean-blind',
      'sqli-oob',
      'sqli-second-order',
      'xss',
      'stored-xss',
      'blind-xss',
      'cmdi',
      'traversal',
      'log-poisoning',
      'ssti',
      'ssti-pebble',
      'ssti-engines',
      'el-injection',
      'ognl-injection',
      'xpathi',
      'blind-xpath',
      'nosqli',
      'nosql-deep',
      'ldapi',
      'ldap-blind',
      'xml-injection',
      'xxe',
      'xxe-xinclude',
      'eval-injection',
      'csv-log-injection',
      'smtp-injection',
      'ssi',
      'arg-injection',
      'csti',
      'csti-frameworks',
      'css-injection',
      'mutation-xss',
      'dom-xss-sinks',
      'dom-xss-location-hash',
      'dom-postmessage',
      'dom-clobbering',
      // ADDED — missing from design §4 (see header): DOM injection
      // into document.cookie (attacker input → sensitive-cookie
      // overwrite), sibling of the other DOM-injection phases here.
      'dom-cookie-manipulation',
      'dangling-markup',
      'rfi',
      'file-upload',
      'upload-race',
      'upload-htaccess',
      'jsonp',
      'hpp',
      // JUDGMENT CALL (§4 *), confirmed: input-validation bypasses
      // (integer overflow, type juggling, null-byte, unicode
      // normalisation, hidden-field validation) are attacker-shaped
      // input reaching the app unvalidated — the injection
      // category, not A05 misconfiguration.
      'validation',
      // JUDGMENT CALL (§4 *), confirmed: the probe owns the WS
      // MESSAGE layer (field tampering + replay, differential
      // oracle) — injection into WebSocket messages. The handshake
      // / authorisation half is cswsh (A01) and is not re-tested
      // here.
      'ws-messages',
      // JUDGMENT CALL (§4 *), confirmed: one phase unit testing
      // introspection, query-depth DoS, unauthenticated mutations,
      // mutation BOLA, alias auth bypass, field leakage, batching.
      // Field-auth gaps are A01-flavoured, but the phase runs as a
      // single injection-surface unit and is not split.
      'graphql',
      'graphql-relay',
      'graphql-apq',
      'graphql-defer',
      'crlf',
      'xslt',
    ],
  },
  {
    code: 'A04',
    title: 'Insecure Design',
    goSheet: 'A06',
    note: null,
    phases: [
      'race',
      'workflow-skip',
      'basket-logic',
      'coupon-abuse',
      'quota-bypass',
      'workflow-data-exposure',
      'business-flow-access',
      'captcha',
      'exceptional-conditions',
      'provisioning',
    ],
  },
  {
    code: 'A05',
    title: 'Security Misconfiguration',
    goSheet: 'A02',
    note: null,
    phases: [
      'headers',
      'files',
      'host-header',
      'cache-poisoning',
      'sw-cache-poisoning',
      'request-smuggling',
      'smuggling-cl-cl',
      'smuggling-zero-cl',
      'smuggling-h2-tunnel',
      'error-disclosure',
      'autocomplete',
      'api-versioning',
      'tabnabbing',
    ],
  },
  {
    code: 'A06',
    title: 'Vulnerable and Outdated Components',
    goSheet: 'A03',
    note: 'Go sheet A03 "Supply Chain Failures" covers only part of OWASP 2021 A06.',
    phases: [
      // JUDGMENT CALL (§4 *), confirmed: cross-cutting templates,
      // but its CVE / end-of-life detection (unpatched server /
      // framework, PHP/Apache EOL) is the A06 leg. Findings
      // re-group by template class in the report where the template
      // names one.
      'nuclei',
      // JUDGMENT CALL (§4 *), confirmed: CWE-829 inclusion of
      // functionality from an untrusted control sphere — a page
      // loading executable JS from an untrusted cross-origin host
      // with no SRI pin (Magecart-style supply-chain inclusion).
      'untrusted-js-inclusion',
    ],
  },
  {
    code: 'A07',
    title: 'Identification and Authentication Failures',
    goSheet: 'A07',
    note: null,
    phases: [
      'cookies',
      'session-fixation',
      'session-timeout',
      'weak-creds',
      'weak-password-policy',
      'credential-stuffing',
      'twofa-bruteforce',
      'mfa-bypass',
      'anti-automation',
      'password-reset',
      'oauth',
      'oauth-lab',
      'saml',
      'jwt',
      'jwt-claims',
      'user-enumeration',
      'session-token-in-url',
    ],
  },
  {
    code: 'A08',
    title: 'Software and Data Integrity Failures',
    goSheet: 'A08',
    note: null,
    phases: [
      'deserialization',
      'prototype-pollution',
      // JUDGMENT CALL (§4 *), confirmed: relative-path overwrite
      // hijacks the stylesheet/script resource the page loads — a
      // loaded-resource integrity failure, not an injection.
      'rpo',
      'deep-link',
      'webview-bridge',
    ],
  },
  {
    code: 'A09',
    title: 'Security Logging and Monitoring Failures',
    goSheet: 'A09',
    note: 'Thin by construction — the Go A09 sheet has 1 check. The report must say so; do not pad this section.',
    phases: ['sensitive-data-in-logs'],
  },
  {
    code: 'A10',
    title: 'Server-Side Request Forgery',
    goSheet: 'A11',
    note: null,
    phases: [
      'ssrf',
      'ssrf-routing',
      'ssrf-referer',
      // JUDGMENT CALL (§4 *), confirmed: V8-F1 egress laundering —
      // rendered content causing a viewer browser to fetch an
      // attacker URL (Meta Cat 7) — is an SSRF-like egress: a fetch
      // the victim never approved, to an attacker-chosen URL. The
      // three external-image phases are the same class in generated
      // documents (V10-F4 docx, V10-F5 xlsx, V26-F1 pptx).
      'egress-laundering',
      'document-external-image',
      'spreadsheet-external-image',
      'presentation-external-image',
    ],
  },
  {
    code: 'Additional',
    title: 'Additional (outside OWASP Top 10 2021)',
    goSheet: 'A10',
    note: 'LLM-specific phases and anything that does not fit the Top 10. Honestly labelled as outside OWASP 2021 scope.',
    phases: [
      'llm-rate-limit',
      'llm-training-data',
      'llm-training-poisoning',
      'llm-model-extraction',
      'llm-multimodal',
      'llm-membership-inference',
      'llm-supply-chain',
      'llm-tool-misuse',
      'llm-excessive-agency',
      'llm-output-handling',
      'llm-misinformation',
      'llm-injection',
      // Blocked in ordered runs: MCP endpoint decision pending
      // (owner) — the phase is listed so the report can name it as
      // blocked, never as passed or omitted.
      'mcp-tool-poisoning',
    ],
  },
];

// Go-sheet code (Self checklist category) → OWASP 2021 stage code.
// The Go numbering differs from OWASP 2021 (§2 of the design); this
// is the bridge the report uses to render Self-checklist coverage
// (GAP / AI-blocked) under the right OWASP section. A12–A16 are
// focused views with 0 checks of their own — duplicates of rows
// already covered inside the stage they map to.
export const GO_SHEET_TO_OWASP = {
  REC: 'REC',
  A01: 'A01',
  A02: 'A05',
  A03: 'A06',
  A04: 'A02',
  A05: 'A03',
  A06: 'A04',
  A07: 'A07',
  A08: 'A08',
  A09: 'A09',
  A10: 'Additional',
  A11: 'A10',
  A12: 'A01',
  A13: 'A03',
  A14: 'A03',
  A15: 'A08',
  A16: 'A01',
};

const PHASE_TO_STAGE = new Map();
for (const stage of OWASP_STAGES) {
  for (const phase of stage.phases) PHASE_TO_STAGE.set(phase, stage.code);
}

/** Flat ordered phase list: REC phases, then A01, …, A10, Additional. */
export function orderedPhases(stages = OWASP_STAGES) {
  return (Array.isArray(stages) ? stages : OWASP_STAGES).flatMap((s) => s.phases || []);
}

/** Stage code ('REC' | 'A01' … 'A10' | 'Additional') for a phase, or null. */
export function stageOfPhase(name) {
  return PHASE_TO_STAGE.get(name) || null;
}

/** Stage table entry for a stage code, or null. */
export function stageByCode(code) {
  return OWASP_STAGES.find((s) => s.code === code) || null;
}

/**
 * Per-stage rollup from runScan phase records (+ optionally findings).
 * Pure — exported for unit tests and reused by the scanner hunt.
 *
 * phaseRecords: runScan's `phases` (one record per executed step; the
 * param battery repeats a phase name per URL, so records are
 * aggregated per phase NAME, not counted raw). A phase counts as
 * failed when ANY of its records failed; skipped only when EVERY
 * record is skipped; not-run when the table lists it but no record
 * exists (e.g. a narrowed `phases` allowlist).
 * findings: findings tagged with `.phase` by runScan (only when
 * owaspStages is enabled) and `.confirmation`; counted per stage.
 */
export function buildStageRecords(phaseRecords = [], findings = [], stages = OWASP_STAGES) {
  const records = Array.isArray(phaseRecords) ? phaseRecords : [];
  const byName = new Map();
  for (const r of records) {
    if (!r || !r.name) continue;
    if (!byName.has(r.name)) byName.set(r.name, []);
    byName.get(r.name).push(r);
  }
  const findingsByStage = new Map();
  for (const f of Array.isArray(findings) ? findings : []) {
    const stage = f && f.phase ? stageOfPhase(f.phase) : null;
    if (!stage) continue;
    if (!findingsByStage.has(stage)) findingsByStage.set(stage, []);
    findingsByStage.get(stage).push(f);
  }
  return (Array.isArray(stages) ? stages : OWASP_STAGES).map((stage) => {
    let phasesRun = 0;
    let phasesFailed = 0;
    let phasesSkipped = 0;
    let phasesNotRun = 0;
    let recTotal = 0;
    let recOk = 0;
    let recFailed = 0;
    let recSkipped = 0;
    let recTimedOut = 0;
    let findingsCount = 0;
    for (const name of stage.phases || []) {
      const list = byName.get(name);
      if (!list || !list.length) {
        phasesNotRun += 1;
        continue;
      }
      phasesRun += 1;
      recTotal += list.length;
      recOk += list.filter((p) => p.ok && !p.skipped).length;
      recFailed += list.filter((p) => !p.ok && !p.skipped).length;
      recSkipped += list.filter((p) => p.skipped).length;
      recTimedOut += list.filter((p) => p.timedOut).length;
      if (list.some((p) => !p.ok && !p.skipped)) phasesFailed += 1;
      else if (list.every((p) => p.skipped)) phasesSkipped += 1;
      for (const p of list) findingsCount += Number(p.findingsCount) || 0;
    }
    const stageFindings = findingsByStage.get(stage.code) || [];
    return {
      code: stage.code,
      title: stage.title,
      phases: [...(stage.phases || [])],
      phasesTotal: (stage.phases || []).length,
      phasesRun,
      phasesFailed,
      phasesSkipped,
      phasesNotRun,
      records: { total: recTotal, ok: recOk, failed: recFailed, skipped: recSkipped, timedOut: recTimedOut },
      // findingsCount sums the per-phase record counters (what each
      // phase reported); confirmed/unconfirmed count the tagged
      // finding objects actually attributed to this stage.
      findingsCount,
      confirmed: stageFindings.filter((f) => f.confirmation === 'confirmed').length,
      unconfirmed: stageFindings.filter((f) => f.confirmation !== 'confirmed').length,
    };
  });
}
