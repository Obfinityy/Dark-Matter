// Dark Matter — AI behaviour analysis (owner idea, 8 Nov 2026).
//
// After a scanner (autonomous) hunt finishes, the frontend fires ONE
// api call. The backend hands the hunt's behaviour.json — every
// vulnerability's full behaviour (what happened, how, probe/trigger/
// evidence/request sequence) — to Meta AI, which proposes NEW candidate
// vulnerabilities beyond the ones the predefined battery found.
//
// IDEMPOTENT: once aiAnalysis.json exists for a hunt, it is returned
// as-is and the provider is never called again for that hunt. A
// suggestion is a LEAD (verified:false) — it is never merged into
// scannerSummary confirmed counts or the findings list.
//
// HONEST LIMIT: the Meta Model API key is DEAD (401 since 4 Nov 2026).
// Until the owner reconnects it, the live path returns
// status 'ai-unavailable'. The wiring below is proven with stubbed
// providers only — see aiAnalysis.test.js. Never throws: every
// failure mode degrades to a stored ai-unavailable doc or an error
// envelope, never an exception out of the route.
import { readHuntAiAnalysis, readHuntBehaviour, writeHuntAiAnalysis } from '../store.js';

export const AI_ANALYSIS_MODEL = 'muse-spark-1.3';
export const AI_ANALYSIS_MAX_SUGGESTIONS = 10;
/** Bundle text sent to the model — the bundle itself is already
 * capped at ~100KB; this leaves headroom inside the model call. */
export const AI_ANALYSIS_MAX_PROMPT_BUNDLE_CHARS = 60000;

const SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);

const SYSTEM_PROMPT = `You are a senior bug-bounty analyst reviewing a completed rule-based vulnerability scan. Your job is to look for NEW vulnerabilities the predefined scanner may have missed — by reading the BEHAVIOUR of the vulnerabilities it DID find (what happened, how it happened, probe/trigger/evidence/request sequence) and reasoning about what that behaviour implies about the target.

RULES:
- Propose ONLY vulnerabilities that are NOT in the found set below. Never restate a found finding as a "new" one.
- Every suggestion must be a concrete, verifiable candidate: a specific vulnerability class on a specific surface, with a verification step a scanner could run.
- Do NOT invent evidence, URLs, or parameter names that are not in the behaviour bundle.
- If nothing new is credibly suggested by the behaviour, return an empty suggestions list. Honesty over volume.
- Reply with JSON ONLY — no markdown, no prose outside the JSON:
{"suggestions":[{"title":"...","class":"...","severity":"low|medium|high|critical","reasoning":"...","verification":"..."}]}`;

/**
 * Build the { system, user } prompt for the AI call from a behaviour
 * bundle. Pure — exported for unit tests.
 */
export function buildAiAnalysisPrompt(bundle) {
  const found = Array.isArray(bundle?.findings) ? bundle.findings : [];
  const foundTitles = found.map((f) => f?.title).filter(Boolean);
  const bundleText = JSON.stringify(bundle || {});
  const trimmed = bundleText.length > AI_ANALYSIS_MAX_PROMPT_BUNDLE_CHARS
    ? bundleText.slice(0, AI_ANALYSIS_MAX_PROMPT_BUNDLE_CHARS)
    : bundleText;
  const user = [
    `Target: ${bundle?.target || 'unknown'}`,
    `Scan finished: ${bundle?.finishedAt || 'unknown'}`,
    `Confirmed findings: ${found.filter((f) => f?.verified).length}, unconfirmed leads: ${found.filter((f) => !f?.verified).length}.`,
    'Already found (do NOT propose these again):',
    foundTitles.length ? foundTitles.map((t) => `- ${t}`).join('\n') : '- none',
    'Behaviour bundle (JSON):',
    trimmed,
    'Propose NEW candidate vulnerabilities suggested by this behaviour, as JSON only.',
  ].join('\n');
  return { system: SYSTEM_PROMPT, user, foundTitles };
}

/** Validate + normalize one raw suggestion. Returns null when unusable. Pure. */
export function validateSuggestion(raw) {
  try {
    if (!raw || typeof raw !== 'object') return null;
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (title.length < 5 || title.length > 200) return null;
    const severity = typeof raw.severity === 'string' && SEVERITIES.has(raw.severity.toLowerCase())
      ? raw.severity.toLowerCase()
      : 'low';
    const verification = typeof raw.verification === 'string'
      ? raw.verification.trim()
      : (typeof raw.suggestedVerification === 'string' ? raw.suggestedVerification.trim() : '');
    return {
      title,
      class: typeof raw.class === 'string' && raw.class.trim() ? raw.class.trim().slice(0, 80) : 'ai_suggested',
      severity,
      reasoning: typeof raw.reasoning === 'string' ? raw.reasoning.trim().slice(0, 1000) : '',
      verification: verification.slice(0, 500),
      verified: false,
    };
  } catch {
    return null;
  }
}

/**
 * Parse the model's reply into suggestions. Tolerant of a JSON object,
 * a bare JSON array, or prose wrapping the JSON. Drops any suggestion
 * whose title matches an already-found title (case-insensitive) and
 * dedupes by title. Pure — exported for unit tests.
 */
export function parseAiSuggestions(text, foundTitles = []) {
  const out = { suggestions: [], parseOk: false };
  try {
    const raw = typeof text === 'string' ? text : '';
    if (!raw.trim()) return out;
    let parsed = null;
    const attempts = [raw];
    const objStart = raw.indexOf('{');
    const objEnd = raw.lastIndexOf('}');
    if (objStart >= 0 && objEnd > objStart) attempts.push(raw.slice(objStart, objEnd + 1));
    const arrStart = raw.indexOf('[');
    const arrEnd = raw.lastIndexOf(']');
    if (arrStart >= 0 && arrEnd > arrStart) attempts.push(raw.slice(arrStart, arrEnd + 1));
    for (const attempt of attempts) {
      try {
        parsed = JSON.parse(attempt);
        break;
      } catch {
        // try the next extraction
      }
    }
    if (parsed === null || parsed === undefined) return out;
    const list = Array.isArray(parsed) ? parsed : parsed.suggestions;
    if (!Array.isArray(list)) return out;
    out.parseOk = true;
    const foundSet = new Set(
      (Array.isArray(foundTitles) ? foundTitles : []).map((t) => String(t).trim().toLowerCase()),
    );
    const seen = new Set();
    for (const rawSuggestion of list) {
      const s = validateSuggestion(rawSuggestion);
      if (!s) continue;
      const key = s.title.toLowerCase();
      if (foundSet.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.suggestions.push(s);
      if (out.suggestions.length >= AI_ANALYSIS_MAX_SUGGESTIONS) break;
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * Run (or return the stored) AI analysis for a hunt.
 *
 * @param {string} huntId
 * @param {object} [opts] - test seams only: { metaCall, readBehaviour,
 *   readAnalysis, writeAnalysis }. Production passes none — the real
 *   Meta provider is reached through brainProvider.callMetaModel, the
 *   same abstraction agent-report/agent-chat use.
 * @returns {Promise<{ok:true,stored:boolean,analysis:object}
 *   |{ok:false,error:string}>} — never throws.
 */
export async function runAiAnalysis(huntId, opts = {}) {
  try {
    const readAnalysis = opts.readAnalysis || (() => readHuntAiAnalysis(huntId));
    const readBehaviour = opts.readBehaviour || (() => readHuntBehaviour(huntId));
    const writeAnalysis = opts.writeAnalysis || ((doc) => writeHuntAiAnalysis(huntId, doc));

    // Idempotency: a stored result is returned as-is; the provider is
    // never called again for this hunt.
    let existing = null;
    try { existing = readAnalysis(); } catch { existing = null; }
    if (existing && typeof existing === 'object' && typeof existing.status === 'string') {
      return { ok: true, stored: true, analysis: existing };
    }

    let bundle = null;
    try { bundle = readBehaviour(); } catch { bundle = null; }
    if (!bundle || typeof bundle !== 'object') {
      return { ok: false, error: 'no behaviour bundle yet' };
    }

    const { system, user, foundTitles } = buildAiAnalysisPrompt(bundle);
    const callMeta = opts.metaCall || (await import('../brainProvider.js')).callMetaModel;
    let r;
    try {
      r = await callMeta(
        [{ role: 'user', text: user }],
        system,
        { huntId, purpose: 'scanner-ai-analysis' },
        { model: AI_ANALYSIS_MODEL, maxTokens: 2000, timeoutMs: 90000 },
      );
    } catch {
      r = { ok: false, reason: 'error' };
    }

    const createdAt = new Date().toISOString();
    if (!r || !r.ok) {
      // No provider / 401 / timeout / any failure: honest
      // ai-unavailable, never a fabricated suggestion. The reason is a
      // short provider code (no_key, http_401, timeout, error) — never
      // a secret or a token.
      const doc = {
        status: 'ai-unavailable',
        provider: 'meta',
        model: AI_ANALYSIS_MODEL,
        suggestions: [],
        error: `Meta AI unavailable (${(r && r.reason) || 'error'})`,
        createdAt,
      };
      try { writeAnalysis(doc); } catch { /* best-effort */ }
      return { ok: true, stored: false, analysis: doc };
    }

    const { suggestions, parseOk } = parseAiSuggestions(r.text, foundTitles);
    const doc = {
      status: 'ok',
      provider: 'meta',
      model: AI_ANALYSIS_MODEL,
      suggestions,
      ...(parseOk ? {} : { note: 'AI reply was not valid JSON — no suggestions extracted' }),
      createdAt,
    };
    try { writeAnalysis(doc); } catch { /* best-effort */ }
    return { ok: true, stored: false, analysis: doc };
  } catch {
    return { ok: false, error: 'ai_analysis_failed' };
  }
}
