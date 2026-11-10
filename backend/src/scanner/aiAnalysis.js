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
// LIVE PATH: the Meta Model API key is ALIVE (verified 8 Nov 2026 with
// real muse-spark-1.3 replies). 6 live calls on 10 Nov 2026 all failed
// to parse — and proof #43 (h_d382c4489e18, 21:16 IST) proved WHY:
// both calls hit their output-token caps EXACTLY (2000 then 1200), so
// the replies were truncated mid-JSON and no parser could ever parse
// them. That is what the compact prompt, the same-or-larger retry cap
// and the truncated-JSON salvage below exist to survive. The wiring is
// proven with stubbed providers in aiAnalysis.test.js plus those live
// calls. Never throws: every failure mode degrades to a stored
// ai-unavailable doc or an error envelope, never an exception out of
// the route.
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
{"suggestions":[{"title":"...","class":"...","severity":"low|medium|high|critical","reasoning":"...","verification":"..."}]}
- Keep the reply SHORT so it fits inside the output-token budget:
at most 5 suggestions, and one short sentence each for reasoning and
verification. A reply cut off by the output limit loses every
suggestion after the cut, so brevity is correctness, not terseness.`;

/** Output-token budgets. First call and retry get the SAME budget —
 * never tighten the retry. Proof #43 (10 Nov 2026) showed why: the
 * first call hit 2000 output tokens and the retry hit its 1200 cap,
 * so BOTH replies were truncated mid-JSON; a tighter retry cap makes
 * truncation more likely, not less. The compact prompt (at most 5
 * suggestions, one short sentence each) is what keeps the reply
 * inside the budget — the cap is a backstop, not the sizing tool. */
export const AI_ANALYSIS_FIRST_MAX_TOKENS = 2000;
export const AI_ANALYSIS_RETRY_MAX_TOKENS = 2000;
export const AI_ANALYSIS_RAW_REPLY_PREVIEW_CHARS = 1000;
const RETRY_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

Your previous reply was not valid JSON and could not be used. Reply with ONLY the JSON object — no markdown fences, no prose, no explanation. Keep the list short (at most 5 suggestions, one short sentence for each reasoning and verification).`;

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
 * Scan text from `start` (which must point at '{' or '[') and return
 * the smallest balanced span ending at the matching close bracket, or
 * null when the brackets never balance (truncated reply). String-aware:
 * braces inside "..." (and escaped quotes) never count. Pure.
 */
function balancedSpan(text, start) {
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Candidate JSON substrings from a model reply, best first. A reply
 * is often prose + a fenced block + trailing prose, or several JSON
 * values in a row — the old first-'{' / last-'}' slice swallowed
 * trailing braced prose and glued multiple objects together, which is
 * how 4 consecutive live replies failed to parse (10 Nov 2026).
 * Order: fenced-block bodies, then each balanced {…} / […] span in
 * document order, then the whole trimmed reply. Pure.
 */
function extractJsonCandidates(text) {
  const candidates = [];
  const seen = new Set();
  const push = (c) => {
    const t = typeof c === 'string' ? c.trim() : '';
    if (t && !seen.has(t)) { seen.add(t); candidates.push(t); }
  };
  const fenceRe = /```(?:json)?\s*\n?([\s\S]*?)```/gi;
  let m;
  while ((m = fenceRe.exec(text)) !== null) push(m[1]);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== '{' && ch !== '[') continue;
    const span = balancedSpan(text, i);
    if (span) push(span);
  }
  push(text);
  return candidates;
}

/**
 * Parse one candidate, tolerating the trailing commas LLMs commonly
 * emit (`{"a": 1,}` / `[1, 2,]`). Returns the parsed value, or
 * null when neither the raw nor the repaired text parses.
 */
function tryParseJson(candidate) {
  try {
    return JSON.parse(candidate);
  } catch {
    try {
      return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      return null;
    }
  }
}

/**
 * Repair the two string-level defects LLMs commonly emit, best-effort:
 * raw control characters inside strings (JSON forbids literal newlines
 * in strings) and unescaped quotes inside string values. A quote is
 * treated as the string's end only when the next non-space character
 * is structural (`,` `:` `}` `]`); any other quote is content and is
 * escaped. Returns the input unchanged when nothing needed repair.
 * Only ever tried AFTER strict parsing fails, so valid JSON is never
 * touched. Known limit: a content quote immediately before a colon
 * is misread as a closer — acceptable for a fallback, and salvage
 * below still runs on the original text. Pure.
 */
function repairJsonStrings(candidate) {
  let out = '';
  let changed = false;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inString) {
      if (escaped) { out += ch; escaped = false; continue; }
      if (ch === '\\') { out += ch; escaped = true; continue; }
      if (ch === '"') {
        let j = i + 1;
        while (j < candidate.length && /\s/.test(candidate[j])) j++;
        const next = candidate[j];
        if (next === ',' || next === ':' || next === '}' || next === ']' || next === undefined) {
          out += ch; inString = false;
        } else {
          out += '\\"'; changed = true;
        }
        continue;
      }
      if (ch === '\n') { out += '\\n'; changed = true; continue; }
      if (ch === '\r') { out += '\\r'; changed = true; continue; }
      if (ch === '\t') { out += '\\t'; changed = true; continue; }
      out += ch;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; continue; }
    out += ch;
  }
  return changed ? out : candidate;
}

/**
 * Does this text look cut off mid-JSON — brackets (or a string) left
 * open at the end? String-aware scan from the first `{` or `[`. Pure.
 */
export function looksTruncated(text) {
  const raw = typeof text === 'string' ? text : '';
  let start = -1;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '{' || raw[i] === '[') { start = i; break; }
  }
  if (start < 0) return false;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{' || ch === '[') depth += 1;
    else if (ch === '}' || ch === ']') depth -= 1;
  }
  return inString || depth > 0;
}

/**
 * Salvage a reply truncated mid-JSON (the confirmed proof-#43 failure:
 * the model hit the output-token cap and the reply ends mid-string or
 * mid-object). Walks the text string-aware, remembers the end of the
 * last COMPLETE element of the top-level suggestions array, cuts
 * there, and closes the still-open brackets — returning the parsed
 * value, or null when no complete element exists (nothing honest to
 * recover). Only elements of the top-level array count (stack depth
 * <= 2), so a nested array inside a suggestion can never fake a cut
 * point. Complete elements are the model's own finished output, never
 * fabricated; each still goes through validateSuggestion downstream.
 * Pure.
 */
function salvageTruncatedJson(candidate) {
  const raw = typeof candidate === 'string' ? candidate : '';
  let start = -1;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '{' || raw[i] === '[') { start = i; break; }
  }
  if (start < 0) return null;
  // Stack of open frames. When a frame closes and the frame below it
  // is the top-level array (depth <= 2), one suggestion just completed.
  // The stack snapshot at that moment is kept too: the cut drops
  // everything after the last complete element, so the closers must
  // come from the stack AS IT WAS at the cut — not from the stack at
  // end-of-text, which still holds the cut-off element's open frame.
  const stack = [];
  let inString = false;
  let escaped = false;
  let lastElementEnd = -1;
  let cutStack = null;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{' || ch === '[') { stack.push(ch); continue; }
    if (ch === '}' || ch === ']') {
      const open = stack.pop();
      if (!open) return null; // stray closer — not salvageable JSON
      if (stack.length > 0 && stack.length <= 2 && stack[stack.length - 1] === '[') {
        lastElementEnd = i + 1;
        cutStack = stack.slice();
      }
      continue;
    }
  }
  if (lastElementEnd < 0) return null;
  // If the text already balances, there is nothing to salvage — the
  // strict parse would have succeeded.
  if (stack.length === 0 && !inString) return null;
  const closers = cutStack.map((open) => (open === '{' ? '}' : ']')).reverse().join('');
  const repaired = raw.slice(start, lastElementEnd) + closers;
  return tryParseJson(repaired);
}

/**
 * Explain a persistent parse failure for the stored doc: the strict
 * parser's error message and whether the reply looks truncated at the
 * output-token cap. Pure — exported for unit tests.
 */
export function diagnoseParseFailure(text) {
  const raw = typeof text === 'string' ? text : '';
  let error = 'not valid JSON';
  for (const candidate of extractJsonCandidates(raw)) {
    try {
      JSON.parse(candidate);
    } catch (e) {
      error = e && e.message ? String(e.message) : 'not valid JSON';
      break;
    }
  }
  return { error, truncated: looksTruncated(raw), length: raw.length };
}

/**
 * Parse the model's reply into suggestions. Tolerant of a JSON object,
 * a bare JSON array, prose wrapping the JSON, markdown-fenced JSON,
 * trailing prose that itself contains braces, several JSON values in
 * one reply, and trailing commas. Drops any suggestion whose title
 * matches an already-found title (case-insensitive) and dedupes by
 * title. Pure — exported for unit tests.
 */
export function parseAiSuggestions(text, foundTitles = []) {
  const out = { suggestions: [], parseOk: false, salvaged: false };
  try {
    const raw = typeof text === 'string' ? text : '';
    if (!raw.trim()) return out;
    let parsed = null;
    let salvaged = false;
    // Per candidate: strict parse, then string repair, then salvage of
    // a truncated reply — on the original text AND on the repaired
    // text, so a truncated reply whose complete elements carry a stray
    // quote is still recoverable. Salvage only fires when the text is
    // genuinely unbalanced, so it can never demote a complete reply.
    // A candidate that parses but carries no suggestions list (e.g. a
    // single suggestion object inside a truncated reply) is skipped,
    // not accepted — the search continues to the next candidate, where
    // salvage can recover the whole list.
    for (const candidate of extractJsonCandidates(raw)) {
      const repaired = repairJsonStrings(candidate);
      const attempts = repaired === candidate ? [candidate] : [candidate, repaired];
      for (const attempt of attempts) {
        let value = tryParseJson(attempt);
        let wasSalvaged = false;
        if (value === null || value === undefined) {
          value = salvageTruncatedJson(attempt);
          wasSalvaged = value !== null && value !== undefined;
        }
        if (value === null || value === undefined) continue;
        const list = Array.isArray(value) ? value : value.suggestions;
        if (!Array.isArray(list)) continue;
        parsed = value;
        salvaged = wasSalvaged;
        break;
      }
      if (parsed !== null && parsed !== undefined) break;
    }
    if (parsed === null || parsed === undefined) return out;
    const list = Array.isArray(parsed) ? parsed : parsed.suggestions;
    if (!Array.isArray(list)) return out;
    out.parseOk = true;
    out.salvaged = salvaged;
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
    const callOnce = async (sys, maxTokens) => {
      try {
        return await callMeta(
          [{ role: 'user', text: user }],
          sys,
          { huntId, purpose: 'scanner-ai-analysis' },
          { model: AI_ANALYSIS_MODEL, maxTokens, timeoutMs: 90000 },
        );
      } catch {
        return { ok: false, reason: 'error' };
      }
    };

    let r = await callOnce(system, AI_ANALYSIS_FIRST_MAX_TOKENS);

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

    // The provider answered but the reply did not parse: ONE retry
    // with a stricter prompt. Never more than one — the retry is a
    // salvage attempt, not a loop.
    let parsed = parseAiSuggestions(r.text, foundTitles);
    let retried = false;
    let unparsedReply = null;
    if (!parsed.parseOk) {
      retried = true;
      unparsedReply = r.text;
      const retry = await callOnce(RETRY_SYSTEM_PROMPT, AI_ANALYSIS_RETRY_MAX_TOKENS);
      if (retry && retry.ok) {
        parsed = parseAiSuggestions(retry.text, foundTitles);
        if (!parsed.parseOk) unparsedReply = retry.text;
      }
    }

    const { suggestions, parseOk, salvaged } = parsed;
    const doc = {
      status: 'ok',
      provider: 'meta',
      model: AI_ANALYSIS_MODEL,
      suggestions,
      ...(retried ? { retried: true } : {}),
      // Salvaged: the reply was truncated at the cap but complete
      // suggestions were recovered from it — worth knowing on the
      // next live proof, since the reply itself was not whole.
      ...(parseOk && salvaged ? { salvaged: true } : {}),
      createdAt,
    };
    if (!parseOk) {
      // Persistent parse failure: keep the FULL reply that failed, not
      // a preview — proof #43 (10 Nov 2026) stored only 1000 chars and
      // the failure was undiagnosable from the record. The preview is
      // kept alongside for a quick skim; the parse error and the
      // truncated flag say whether the reply was cut off at the cap.
      const fullReply = String(unparsedReply || r.text || '');
      const diagnosis = diagnoseParseFailure(fullReply);
      doc.note = 'AI reply was not valid JSON — no suggestions extracted';
      doc.rawReply = fullReply;
      doc.rawReplyPreview = fullReply.slice(0, AI_ANALYSIS_RAW_REPLY_PREVIEW_CHARS);
      doc.parseError = diagnosis.error;
      doc.rawReplyLength = fullReply.length;
      if (diagnosis.truncated) doc.truncated = true;
    }
    try { writeAnalysis(doc); } catch { /* best-effort */ }
    return { ok: true, stored: false, analysis: doc };
  } catch {
    return { ok: false, error: 'ai_analysis_failed' };
  }
}
