/**
 * emotionPicker — deterministic emotion selection for the Infinity AI avatar.
 *
 * The backend attaches one emotion to every assistant reply so the avatar can
 * react visibly (facial expression variants, accent shifts, motion cues).
 * Emotions are rendered with CSS/SVG only — never emoji.
 *
 * This module is intentionally rule-based and dependency-free (no ML):
 * keyword and intent rules are cheap, predictable, and unit-testable.
 * A future ML sentiment model can replace `pickEmotion` internals without
 * changing the exported contract.
 *
 * Emotion set: 'happy' | 'angry' | 'surprised' | 'thinking' | 'neutral'
 */

/** The complete set of emotions the avatar can express. */
export const EMOTIONS = ['happy', 'angry', 'surprised', 'thinking', 'neutral'];

/** Fallback when nothing matches. */
export const DEFAULT_EMOTION = 'neutral';

// ── Keyword rules ──────────────────────────────────────────────────────────
// Ordered by emotional intensity: anger and surprise beat happiness, and all
// beat the calm thinking state. Each entry: [emotion, RegExp[]].

const KEYWORD_RULES = [
  ['angry', [
    /\bfail(ed|ure)?\b/i, /\berror\b/i, /\bblocked\b/i, /\bdenied\b/i,
    /\brefus/i, /\battack(ed|ing)?\b/i, /\bmalicious\b/i,
    /nahi ho pa|nahin ho pa/i, /nahi kar sakta/i, /unable to/i,
  ]],
  ['surprised', [
    /\bsurpris/i, /\bunexpected\b/i, /\bunusual\b/i, /\bstrange\b/i,
    /\binteresting\b/i, /\bnever seen\b/i, /\bpehli baar\b/i,
    /\bajeeb\b/i, /\bwao\b/i,
  ]],
  ['happy', [
    /\bmil gay[ai]\b/i, /\bmila\b/i, /\bfound\b/i, /\bdiscover/i,
    /\bsuccess/i, /\bcomplete(d)?\b/i, /\bdone\b/i, /\bho gay[ai]\b/i,
    /\bcongrat/i, /\bbadhaai\b/i, /\bgreat\b/i, /\bexcellent\b/i,
    /\bshabaash\b/i, /\bvulnerability\b/i, /\bcritical\b/i,
  ]],
  ['thinking', [
    /\bthinking\b/i, /\banalyz/i, /\bchecking\b/i, /\bworking on\b/i,
    /soch rh?[ae] hoon/i, /dekh rh?[ae] hoon/i, /pata lag[ae] raha/i,
  ]],
];

// ── Intent rules ───────────────────────────────────────────────────────────
// Used when the reply text carries no strong keyword, or when the caller
// only knows the detected intent (e.g. the ask-the-agent intent).

const INTENT_RULES = {
  // Findings to celebrate — happy when there is something to show.
  findings: ({ hasFindings }) => (hasFindings ? 'happy' : 'neutral'),
  // The agent explains what it is doing — a thoughtful look fits.
  doing: () => 'thinking',
  progress: () => 'thinking',
  next: () => 'thinking',
  status: () => 'thinking',
  // The hunt hit a wall — the avatar looks firm, not celebratory.
  whystopped: () => 'angry',
  // Destructive command answered with guidance — calm and firm.
  stop: () => 'neutral',
};

/**
 * Pick an emotion from a detected intent when no keyword matched.
 *
 * @param {string|null|undefined} intent - intent key (see askAgentService intents)
 * @param {{ hasFindings?: boolean }} [options]
 * @returns {string} one of EMOTIONS
 */
export function pickEmotionForIntent(intent, options = {}) {
  const rule = INTENT_RULES[String(intent || '').toLowerCase()];
  const emotion = rule ? rule(options) : DEFAULT_EMOTION;
  return EMOTIONS.includes(emotion) ? emotion : DEFAULT_EMOTION;
}

/**
 * Pick an emotion for an assistant reply.
 *
 * Keyword rules run first against the reply text (English + Hinglish);
 * when nothing matches, the intent hint decides; otherwise 'neutral'.
 *
 * @param {string|null|undefined} replyText - the assistant's reply
 * @param {{ intent?: string, hasFindings?: boolean }} [options]
 * @returns {string} one of EMOTIONS
 */
export function pickEmotion(replyText, options = {}) {
  const text = String(replyText || '');
  for (const [emotion, patterns] of KEYWORD_RULES) {
    if (patterns.some((pattern) => pattern.test(text))) return emotion;
  }
  return pickEmotionForIntent(options.intent, options);
}
