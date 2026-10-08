/**
 * intentEncoder.js — Idea 30012.
 *
 * Turns a one-line user goal ("find RCE only", "focus on XSS and IDOR")
 * into weighted plan objectives the Hunt Planner can optimize for.
 */

/** Goal keywords → vulnerability class mapping. */
export const INTENT_VOCABULARY = [
  { cls: 'rce', patterns: [/\brce\b/i, /remote\s?code/i, /command\s?injection/i] },
  { cls: 'sqli', patterns: [/\bsqli?\b/i, /sql\s?injection/i] },
  { cls: 'xss', patterns: [/\bxss\b/i, /cross.site.script/i] },
  { cls: 'ssrf', patterns: [/\bssrf\b/i] },
  { cls: 'idor', patterns: [/\bidor\b/i] },
  {
    cls: 'auth-bypass',
    patterns: [/auth.{0,10}(bypass|break)/i, /broken\s?auth/i, /login\s?bypass/i],
  },
  { cls: 'csrf', patterns: [/\bcsrf\b/i] },
  { cls: 'open-redirect', patterns: [/open\s?redirect/i] },
  { cls: 'info-leak', patterns: [/info(rmation)?\s?(leak|disclosure)/i, /sensitive\s?data/i] },
  { cls: 'misconfig', patterns: [/misconfig/i, /default\s?cred/i] },
];

/**
 * Encode a one-line goal into weighted objectives.
 * @param {string} goal - e.g. "find RCE only", "focus on XSS and IDOR"
 * @returns {{ objectives: Record<string, number>, exclusive: boolean, raw: string }}
 */
export function encodeIntent(goal = '') {
  const text = String(goal);
  const objectives = {};
  for (const { cls, patterns } of INTENT_VOCABULARY) {
    if (
      patterns.some(p => {
        p.lastIndex = 0;
        return p.test(text);
      })
    )
      objectives[cls] = 1;
  }
  const exclusive = /\bonly\b/i.test(text) || /\bjust\b/i.test(text);
  if (!Object.keys(objectives).length) {
    // No specific class mentioned: broad hunt, even weights.
    return { objectives: { broad: 1 }, exclusive: false, raw: text };
  }
  if (exclusive) {
    const n = Object.keys(objectives).length;
    for (const k of Object.keys(objectives)) objectives[k] = Math.round((1 / n) * 1000) / 1000;
  }
  return { objectives, exclusive, raw: text };
}

export const INTENT_ENCODER = { INTENT_VOCABULARY, encodeIntent };
export default INTENT_ENCODER;
