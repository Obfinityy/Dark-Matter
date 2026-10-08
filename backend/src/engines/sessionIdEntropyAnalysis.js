/**
 * sessionIdEntropyAnalysis.js — Session-ID entropy analysis for autonomous bug bounty.
 *
 * Implements idea-bank item 00422: analyze session identifier formats to
 * identify the generating framework and to assess identifier strength.
 *
 * Session IDs carry format fingerprints: Django emits 32 lowercase
 * alphanumerics, Laravel 40, Rails 32 hex chars, Tomcat's JSESSIONID 32
 * hex chars, ASP.NET 24 base64-ish chars from [a-z0-5], and express-session
 * defaults to a 24-char uid-safe string. Shannon entropy per character,
 * alphabet size, and total capacity bits let an authorized engagement
 * assess whether session tokens are plausibly unguessable — and which
 * framework minted them.
 *
 * All functions are pure and side-effect free: they analyze session ID
 * strings the caller observed during an authorized engagement. No session
 * fixation, hijacking, or token prediction is performed here.
 */

/**
 * Known session-ID generator signatures.
 * @type {Array<{generator: string, test: RegExp, confidence: string, note: string}>}
 */
const GENERATOR_SIGNATURES = [
  {
    generator: 'Django',
    test: /^[a-z0-9]{32}$/,
    confidence: 'medium',
    note: 'Django session keys are 32 lowercase alphanumerics',
  },
  {
    generator: 'Laravel',
    test: /^[A-Za-z0-9]{40}$/,
    confidence: 'medium',
    note: 'Laravel session IDs are 40 alphanumerics (SHA-1 derived)',
  },
  {
    generator: 'Ruby on Rails / Rack',
    test: /^[a-f0-9]{32}$/,
    confidence: 'medium',
    note: 'Rack session IDs are 32 hex chars (SecureRandom.hex(16))',
  },
  {
    generator: 'Apache Tomcat',
    test: /^[A-F0-9]{32}$/i,
    confidence: 'low',
    note: 'Tomcat JSESSIONID values are 32 hex chars; case-insensitive match',
  },
  {
    generator: 'ASP.NET',
    test: /^[a-z0-5]{24}$/,
    confidence: 'high',
    note: 'ASP.NET SessionIDManager emits 24 chars from a-z0-5',
  },
  {
    generator: 'express-session (Node.js)',
    test: /^[A-Za-z0-9_-]{24}$/,
    confidence: 'medium',
    note: 'express-session default uid-safe IDs are 24 URL-safe chars',
  },
  {
    generator: 'PHP',
    test: /^[a-zA-Z0-9]{26,32}$/,
    confidence: 'low',
    note: 'PHP default session IDs are 26-32 alphanumerics',
  },
  {
    generator: 'UUID v4 (custom)',
    test: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    confidence: 'high',
    note: 'RFC 4122 version-4 UUID shape',
  },
  {
    generator: 'Java UUID (custom)',
    test: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    confidence: 'medium',
    note: 'UUID-shaped token without v4 markers',
  },
];

/**
 * Classify the alphabet of a token into size and character classes.
 * @param {string} value
 * @returns {{size: number, classes: string[]}}
 */
export function charsetOf(value) {
  const classes = new Set();
  const chars = new Set();
  for (const ch of value) {
    chars.add(ch);
    if (/[0-9]/.test(ch)) classes.add('digit');
    else if (/[a-f]/.test(ch)) classes.add('lower-hex');
    else if (/[A-F]/.test(ch)) classes.add('upper-hex');
    else if (/[a-z]/.test(ch)) classes.add('lower');
    else if (/[A-Z]/.test(ch)) classes.add('upper');
    else if (ch === '-' || ch === '_') classes.add('urlsafe');
    else if (ch === '+' || ch === '/' || ch === '=') classes.add('base64');
    else classes.add('other');
  }
  return { size: chars.size, classes: [...classes].sort() };
}

/**
 * Compute Shannon entropy in bits per character for a string.
 * @param {string} value
 * @returns {number} Bits per character (0 when the input is empty).
 */
export function shannonEntropyPerChar(value) {
  if (!value) return 0;
  const freq = new Map();
  for (const ch of value) freq.set(ch, (freq.get(ch) || 0) + 1);
  let entropy = 0;
  const n = value.length;
  for (const count of freq.values()) {
    const p = count / n;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Guess the generator framework from a session ID's shape.
 * @param {string} value
 * @returns {Array<{generator: string, confidence: string, note: string}>}
 */
export function guessGenerator(value) {
  if (!value || typeof value !== 'string') return [];
  return GENERATOR_SIGNATURES.filter(sig => sig.test.test(value)).map(sig => ({
    generator: sig.generator,
    confidence: sig.confidence,
    note: sig.note,
  }));
}

/**
 * Analyze one session ID: format, entropy, capacity, generator guesses,
 * and defensive strength flags.
 * @param {string} value Session ID string.
 * @returns {{
 *   valueLength: number, alphabetSize: number, alphabetClasses: string[],
 *   shannonBitsPerChar: number, capacityBits: number,
 *   generatorGuesses: Array, strength: string, flags: string[]
 * }}
 */
export function analyzeSessionId(value) {
  const empty = {
    valueLength: 0,
    alphabetSize: 0,
    alphabetClasses: [],
    shannonBitsPerChar: 0,
    capacityBits: 0,
    generatorGuesses: [],
    strength: 'invalid',
    flags: ['empty or non-string input'],
  };
  if (!value || typeof value !== 'string') return empty;

  const { size, classes } = charsetOf(value);
  const perChar = shannonEntropyPerChar(value);
  // Capacity: log2 of the alphabet actually in use, times length — the
  // theoretical ceiling if characters were uniformly random.
  const capacityBits = size > 1 ? Math.round(value.length * Math.log2(size) * 100) / 100 : 0;
  const observedBits = Math.round(value.length * perChar * 100) / 100;

  const flags = [];
  if (value.length < 20) flags.push('short identifier — low guessing resistance');
  if (size < 16) flags.push('small alphabet — reduced capacity');
  if (capacityBits > 0 && observedBits < capacityBits * 0.7) {
    flags.push('observed entropy well below alphabet capacity — possible structure/predictability');
  }
  if (/^(.)\1+$/.test(value)) flags.push('degenerate: single repeated character');

  const strength = capacityBits >= 128 ? 'strong' : capacityBits >= 64 ? 'moderate' : 'weak';

  return {
    valueLength: value.length,
    alphabetSize: size,
    alphabetClasses: classes,
    shannonBitsPerChar: Math.round(perChar * 100) / 100,
    capacityBits,
    observedBits,
    generatorGuesses: guessGenerator(value),
    strength,
    flags,
  };
}

/**
 * Batch-analyze session IDs and summarize the population.
 * @param {string[]} values
 * @returns {{
 *   count: number, uniqueCount: number, duplicates: boolean,
 *   lengths: {min: number, max: number}, strengths: Record<string, number>,
 *   weakest: Array<{index: number, value: string, strength: string, flags: string[]}>,
 *   commonGenerators: Array<{generator: string, hits: number}>
 * }}
 */
export function batchAnalyzeSessionIds(values) {
  const list = Array.isArray(values) ? values.filter(v => typeof v === 'string') : [];
  const analyzed = list.map((v, index) => ({ index, value: v, analysis: analyzeSessionId(v) }));
  const strengths = {};
  const genHits = new Map();
  for (const { analysis } of analyzed) {
    strengths[analysis.strength] = (strengths[analysis.strength] || 0) + 1;
    for (const g of analysis.generatorGuesses) {
      genHits.set(g.generator, (genHits.get(g.generator) || 0) + 1);
    }
  }
  const lengths = analyzed.map(a => a.value.length);
  return {
    count: list.length,
    uniqueCount: new Set(list).size,
    duplicates: new Set(list).size < list.length,
    lengths: {
      min: lengths.length ? Math.min(...lengths) : 0,
      max: lengths.length ? Math.max(...lengths) : 0,
    },
    strengths,
    weakest: analyzed
      .filter(a => a.analysis.strength === 'weak')
      .slice(0, 10)
      .map(a => ({
        index: a.index,
        value: a.value,
        strength: a.analysis.strength,
        flags: a.analysis.flags,
      })),
    commonGenerators: [...genHits.entries()]
      .map(([generator, hits]) => ({ generator, hits }))
      .sort((a, b) => b.hits - a.hits),
  };
}
