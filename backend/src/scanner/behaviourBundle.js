// Dark Matter — AI behaviour-analysis bundle (owner idea, 8 Nov 2026).
//
// After a scanner (autonomous) hunt finishes, the backend keeps ONE file
// per hunt (behaviour.json) recording, for EVERY vulnerability the
// predefined battery found, the full behaviour — what happened, how it
// happened, probe/trigger/evidence/request sequence — so Meta AI can
// look for NEW vulnerabilities beyond the ones the scanner found.
//
// This module is the bundle builder. PURE functions only, ZERO repo
// imports, never throws: a bundle failure must never fail a hunt (the
// finish path wraps the call in try/catch as well). Hard caps keep the
// downstream AI call small: per-finding evidence ~2000 chars, request
// sequence max 20 entries per finding, whole bundle max ~100KB.
//
// What the bundle is NOT: it never invents behaviour. A field the scan
// did not record arrives as null, never as a guess. AI suggestions built
// from it are leads (verified:false), never confirmed findings.
export const BEHAVIOUR_BUNDLE_VERSION = 1;

/** Per-finding evidence text budget (chars). */
export const BEHAVIOUR_MAX_EVIDENCE_CHARS = 2000;
/** Per-finding trigger/payload budget (chars). */
export const BEHAVIOUR_MAX_TRIGGER_CHARS = 500;
/** Request-sequence entries kept per finding. */
export const BEHAVIOUR_MAX_REQUESTS_PER_FINDING = 20;
/** Whole-bundle size budget (bytes of JSON). */
export const BEHAVIOUR_MAX_BUNDLE_BYTES = 100 * 1024;
/** Sanity cap on finding entries in one bundle. */
export const BEHAVIOUR_MAX_FINDINGS = 200;
/** Fingerprint string budget (chars per scalar). */
export const BEHAVIOUR_MAX_FINGERPRINT_CHARS = 300;

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE'];

/** Truncate to `max` chars; anything non-string becomes '' — never throws. */
export function truncateText(value, max) {
  try {
    if (value === null || value === undefined) return '';
    const s = typeof value === 'string' ? value : String(value);
    const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : 0;
    return s.length > limit ? s.slice(0, limit) : s;
  } catch {
    return '';
  }
}

/** JSON.stringify that survives circular structures — never throws. */
export function safeStringify(value, maxChars) {
  try {
    const seen = new Set();
    const s = JSON.stringify(value, (_k, v) => {
      if (v !== null && typeof v === 'object') {
        if (seen.has(v)) return '[circular]';
        seen.add(v);
      }
      return v;
    });
    return truncateText(s || '', Number.isFinite(maxChars) ? maxChars : 0);
  } catch {
    return '';
  }
}

/**
 * Parse one request line ("GET /path?x=1 HTTP/1.1") into
 * { method, path, status } (status null unless the same text carries
 * an HTTP status). Returns null when the text is not a request line.
 * Pure — exported for unit tests.
 */
export function parseRequestLine(text) {
  try {
    const s = String(text || '').trim();
    if (!s) return null;
    const m = new RegExp(`^(${HTTP_METHODS.join('|')})\\s+(\\S+)`).exec(s);
    if (!m) return null;
    const statusMatch = /HTTP\/\d(?:\.\d)?\s+(\d{3})/.exec(s)
      || /\bstatus[:= ]\s*(\d{3})\b/i.exec(s);
    return {
      method: m[1],
      path: truncateText(m[2], 500),
      status: statusMatch ? Number(statusMatch[1]) : null,
    };
  } catch {
    return null;
  }
}

/**
 * Summarize a finding's evidence into { text, requests }.
 * `text` is a capped "key: value" digest of the evidence's string
 * leaves (request/response first, then the rest) — never the raw
 * object, so a giant or circular evidence can never blow up the
 * bundle. `requests` is the parsed request sequence (cap 20).
 * Pure — exported for unit tests.
 */
export function summarizeEvidence(evidence) {
  const out = { text: '', requests: [] };
  try {
    if (evidence === null || evidence === undefined) return out;
    if (typeof evidence === 'string') {
      out.text = truncateText(evidence, BEHAVIOUR_MAX_EVIDENCE_CHARS);
      const req = parseRequestLine(evidence);
      if (req) out.requests.push(req);
      return out;
    }
    if (typeof evidence !== 'object') {
      out.text = truncateText(evidence, BEHAVIOUR_MAX_EVIDENCE_CHARS);
      return out;
    }
    // Request-like fields first (they drive `requests`), then the rest.
    const lines = [];
    let remaining = BEHAVIOUR_MAX_EVIDENCE_CHARS;
    const pushLine = (key, value) => {
      if (remaining <= 0) return;
      const line = `${key}: ${truncateText(value, remaining)}`;
      lines.push(line);
      remaining -= line.length + 1;
    };
    const requestTexts = [];
    for (const key of ['request', 'requests']) {
      const v = evidence[key];
      if (typeof v === 'string' && v.trim()) requestTexts.push(v);
      else if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === 'string' && item.trim()) requestTexts.push(item);
        }
      }
    }
    const responseText = typeof evidence.response === 'string' ? evidence.response : '';
    for (const raw of requestTexts.slice(0, BEHAVIOUR_MAX_REQUESTS_PER_FINDING)) {
      // A request field may carry several lines ("GET ...\nHost: ...");
      // only the request line itself is a sequence entry.
      const firstLine = String(raw).split('\n')[0];
      const parsed = parseRequestLine(firstLine);
      if (parsed) {
        if (parsed.status === null && responseText) {
          const sm = /HTTP\/\d(?:\.\d)?\s+(\d{3})/.exec(responseText)
            || /\bstatus[:= ]\s*(\d{3})\b/i.exec(responseText);
          if (sm) parsed.status = Number(sm[1]);
        }
        out.requests.push(parsed);
      }
    }
    // Evidence digest: request/response first, then the other string leaves.
    const orderedKeys = ['request', 'response', 'impact_demo', 'trigger', 'payload', 'detail', 'note', 'proof', 'sample', 'observed', 'expected', 'message'];
    for (const key of orderedKeys) {
      const v = evidence[key];
      if (typeof v === 'string' && v.trim()) pushLine(key, v);
    }
    for (const [key, v] of Object.entries(evidence)) {
      if (orderedKeys.includes(key)) continue;
      if (typeof v === 'string' && v.trim()) pushLine(key, v);
      else if (typeof v === 'number' || typeof v === 'boolean') pushLine(key, v);
      else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        const flat = safeStringify(v, 500);
        if (flat) pushLine(key, flat);
      }
    }
    out.text = lines.join('\n').slice(0, BEHAVIOUR_MAX_EVIDENCE_CHARS);
    out.requests = out.requests.slice(0, BEHAVIOUR_MAX_REQUESTS_PER_FINDING);
    return out;
  } catch {
    return out;
  }
}

/**
 * Summarize a fingerprint object into scalar fields only (status,
 * server, poweredBy, tech list, dbHint). Unknown shapes degrade to a
 * truncated JSON string under `raw` — never a throw, never a guess.
 * Pure — exported for unit tests.
 */
export function summarizeFingerprint(fp) {
  try {
    if (fp === null || fp === undefined) return null;
    if (typeof fp !== 'object') return { raw: truncateText(fp, BEHAVIOUR_MAX_FINGERPRINT_CHARS) };
    const out = {};
    if (Number.isFinite(fp.status)) out.status = fp.status;
    if (typeof fp.server === 'string' && fp.server) out.server = truncateText(fp.server, BEHAVIOUR_MAX_FINGERPRINT_CHARS);
    if (typeof fp.poweredBy === 'string' && fp.poweredBy) out.poweredBy = truncateText(fp.poweredBy, BEHAVIOUR_MAX_FINGERPRINT_CHARS);
    if (Array.isArray(fp.tech)) {
      out.tech = fp.tech.filter((t) => typeof t === 'string').slice(0, 20).map((t) => truncateText(t, 100));
    }
    if (typeof fp.dbHint === 'string' && fp.dbHint) out.dbHint = truncateText(fp.dbHint, BEHAVIOUR_MAX_FINGERPRINT_CHARS);
    if (Object.keys(out).length === 0) {
      out.raw = safeStringify(fp, BEHAVIOUR_MAX_EVIDENCE_CHARS);
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Summarize phase outcomes into a compact list + rollup counts.
 * Skipped phases carry ok:true upstream — the rollup counts them as
 * skipped, never as ok (same rule as buildPhaseRollup).
 * Pure — exported for unit tests.
 */
export function summarizePhases(phases) {
  const list = Array.isArray(phases) ? phases : [];
  const outcomes = [];
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  let timedOut = 0;
  for (const p of list) {
    if (!p || typeof p !== 'object') continue;
    const isSkipped = p.skipped === true;
    const isOk = p.ok === true && !isSkipped;
    const isTimedOut = p.timedOut === true;
    if (isSkipped) skipped += 1;
    else if (isOk) ok += 1;
    else failed += 1;
    if (isTimedOut) timedOut += 1;
    outcomes.push({
      name: typeof p.name === 'string' ? p.name : 'unknown',
      ok: isOk,
      skipped: isSkipped,
      findingsCount: Number.isFinite(p.findingsCount) ? p.findingsCount : 0,
      durationMs: Number.isFinite(p.durationMs) ? p.durationMs : null,
      ...(p.error ? { error: truncateText(p.error, 300) } : {}),
    });
  }
  return {
    outcomes,
    rollup: { total: outcomes.length, ok, skipped, failed, timedOut },
  };
}

/** One finding entry of the bundle — pure, never throws. */
export function summarizeFinding(f) {
  try {
    if (!f || typeof f !== 'object') return null;
    const ev = (f.evidence !== null && typeof f.evidence === 'object') || typeof f.evidence === 'string'
      ? f.evidence
      : null;
    const summarized = summarizeEvidence(ev);
    const trigger = truncateText(
      (ev && typeof ev === 'object' && (ev.trigger || ev.payload))
        || f.trigger || f.payload || '',
      BEHAVIOUR_MAX_TRIGGER_CHARS,
    );
    const requests = summarized.requests.slice(0, BEHAVIOUR_MAX_REQUESTS_PER_FINDING);
    // The finding URL itself is the anchor request when the evidence
    // carried no request line: method GET, path from the URL.
    if (requests.length === 0 && typeof f.url === 'string' && f.url) {
      try {
        const u = new URL(f.url);
        requests.push({ method: 'GET', path: truncateText(u.pathname + (u.search || ''), 500), status: null });
      } catch {
        requests.push({ method: 'GET', path: truncateText(f.url, 500), status: null });
      }
    }
    return {
      title: typeof f.title === 'string' ? f.title : 'Finding',
      class: typeof f.class === 'string' ? f.class : null,
      severity: typeof f.severity === 'string' ? f.severity.toLowerCase() : 'low',
      verified: f.confirmation === 'confirmed',
      probe: typeof f.probe === 'string' ? f.probe : (typeof f.source === 'string' ? f.source : null),
      url: typeof f.url === 'string' ? f.url : null,
      param: typeof f.param === 'string' ? f.param : null,
      trigger: trigger || null,
      evidence: summarized.text,
      requests,
    };
  } catch {
    return null;
  }
}

function bundleByteSize(bundle) {
  try {
    return Buffer.byteLength(JSON.stringify(bundle), 'utf8');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Enforce the whole-bundle byte cap deterministically: first halve
 * every finding's evidence text, then drop request sequences, then
 * drop triggers, then drop the tail findings. Returns the (possibly
 * trimmed) bundle plus how much was cut. Pure — exported for tests.
 */
export function enforceBundleCap(bundle, maxBytes = BEHAVIOUR_MAX_BUNDLE_BYTES) {
  try {
    if (!bundle || typeof bundle !== 'object') return { bundle, trimmed: false };
    let trimmed = false;
    let guard = 0;
    while (bundleByteSize(bundle) > maxBytes && guard < 12) {
      guard += 1;
      trimmed = true;
      const findings = Array.isArray(bundle.findings) ? bundle.findings : [];
      if (guard <= 4) {
        for (const f of findings) {
          if (f && typeof f.evidence === 'string' && f.evidence.length > 0) {
            f.evidence = f.evidence.slice(0, Math.max(0, Math.floor(f.evidence.length / 2)));
          }
        }
      } else if (guard <= 6) {
        for (const f of findings) {
          if (f) f.requests = [];
        }
      } else if (guard <= 8) {
        for (const f of findings) {
          if (f) f.trigger = null;
        }
      } else {
        bundle.findings = findings.slice(0, Math.max(0, Math.floor(findings.length / 2)));
        if (bundle.summary) bundle.summary.truncatedFindings = true;
      }
    }
    return { bundle, trimmed };
  } catch {
    return { bundle, trimmed: false };
  }
}

/**
 * Build one behaviour bundle document for a finished scanner hunt.
 * @param {object} input - { huntId, target, brainMode, scanDepth,
 *   finishedAt, findings, phaseOutcomes, fingerprint }
 * @returns {object} the bundle doc (never throws — worst case an
 *   empty-findings bundle).
 */
export function buildBehaviourBundle(input = {}) {
  const safe = (input !== null && typeof input === 'object') ? input : {};
  try {
    const findingsIn = Array.isArray(safe.findings) ? safe.findings : [];
    const summarized = [];
    for (const f of findingsIn.slice(0, BEHAVIOUR_MAX_FINDINGS)) {
      const s = summarizeFinding(f);
      if (s) summarized.push(s);
    }
    const phases = summarizePhases(safe.phaseOutcomes);
    const confirmed = summarized.filter((f) => f.verified).length;
    const bundle = {
      version: BEHAVIOUR_BUNDLE_VERSION,
      huntKind: 'scanner',
      huntId: typeof safe.huntId === 'string' ? safe.huntId : null,
      target: typeof safe.target === 'string' ? safe.target : null,
      brainMode: typeof safe.brainMode === 'string' ? safe.brainMode : 'scanner',
      scanDepth: typeof safe.scanDepth === 'string' ? safe.scanDepth : 'standard',
      finishedAt: typeof safe.finishedAt === 'string' ? safe.finishedAt : new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      summary: {
        confirmed,
        unconfirmed: summarized.length - confirmed,
        findingsTotal: summarized.length,
        droppedFindings: Math.max(0, findingsIn.length - summarized.length),
        phases: phases.rollup,
      },
      fingerprint: summarizeFingerprint(safe.fingerprint),
      phases: phases.outcomes,
      findings: summarized,
    };
    const { bundle: capped, trimmed } = enforceBundleCap(bundle);
    if (trimmed) capped.summary.bundleTrimmed = true;
    return capped;
  } catch {
    return {
      version: BEHAVIOUR_BUNDLE_VERSION,
      huntKind: 'scanner',
      huntId: typeof safe.huntId === 'string' ? safe.huntId : null,
      target: typeof safe.target === 'string' ? safe.target : null,
      brainMode: 'scanner',
      scanDepth: 'standard',
      finishedAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      summary: { confirmed: 0, unconfirmed: 0, findingsTotal: 0, droppedFindings: 0, phases: { total: 0, ok: 0, skipped: 0, failed: 0, timedOut: 0 } },
      fingerprint: null,
      phases: [],
      findings: [],
    };
  }
}

/**
 * Map a runScan() result straight into a bundle. `result.findings`
 * are the confirmed findings; `result.unconfirmed` are the leads
 * (kept with verified:false — they are behaviour too). Pure.
 */
export function buildBehaviourBundleFromScan(input = {}) {
  const safe = (input !== null && typeof input === 'object') ? input : {};
  try {
    const { huntId, target, scanDepth, finishedAt, result } = safe;
    const r = (result !== null && typeof result === 'object') ? result : {};
    const findings = [
      ...(Array.isArray(r.findings) ? r.findings : []),
      ...(Array.isArray(r.unconfirmed) ? r.unconfirmed : []),
    ];
    return buildBehaviourBundle({
      huntId,
      target,
      brainMode: 'scanner',
      scanDepth,
      finishedAt,
      findings,
      phaseOutcomes: r.phases || [],
      fingerprint: r.fingerprint || null,
    });
  } catch {
    return buildBehaviourBundle({ huntId: safe.huntId, target: safe.target, scanDepth: safe.scanDepth, finishedAt: safe.finishedAt, findings: [] });
  }
}
