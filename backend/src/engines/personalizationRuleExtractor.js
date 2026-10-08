/**
 * personalizationRuleExtractor.js — Client-side personalization-rule extraction.
 *
 * Idea 00902: extract client-side personalization rules that reveal segmented
 * content routes on an authorized target.
 *
 * No network calls: the module scans page JavaScript/HTML for audience
 * conditions (segments, personas, behavioral flags, data attributes,
 * personalization config objects) and correlates each rule with the content
 * routes it gates, so every segmented experience of the target can be mapped
 * from its own shipped code. Defensive surface-mapping only.
 */

const SEGMENT_SIGNALS = [
  /segment|audience|persona|cohort/i,
  /returning[_-]?visitor|new[_-]?visitor|loyalty/i,
  /geo[_-]?segment|demographic/i,
  /data-personaliz\w*|data-audience|data-segment/i,
];

/**
 * @typedef {Object} PersonalizationRule
 * @property {string} ruleId - Condition expression or rule name.
 * @property {string} kind - One of 'condition', 'config', 'attribute', 'event'.
 * @property {string} segment - Inferred segment / audience name.
 * @property {string[]} routes - Content routes gated by the rule.
 * @property {string} evidence - Source excerpt.
 */

/**
 * Extract personalization rules from client-side code and markup.
 * @param {string} codeText - JavaScript source and/or page HTML.
 * @param {{maxRules?: number}} [options]
 * @returns {{rules: PersonalizationRule[], segments: string[], stats: object}}
 */
export function extractPersonalizationRules(codeText = '', options = {}) {
  const { maxRules = 50 } = options;
  const text = String(codeText);
  const lines = text.split(/\r?\n/);
  const rules = [];
  const segments = new Set();

  const routeOf = line => {
    const out = [];
    const re = /['"](?:https?:)?\/\/[^'"]+['"]|['"]\/[a-z0-9_.\-\/]{2,140}['"]/gi;
    let m;
    while ((m = re.exec(line)) !== null) {
      const r = m[0].replace(/^['"]|['"]$/g, '');
      if (!/\.(js|css|png|jpe?g|svg|woff2?|map)$/i.test(r)) out.push(r);
    }
    return [...new Set(out)].slice(0, 10);
  };

  const segmentOf = line => {
    const m =
      line.match(/segment\s*[:=]\s*['"]([^'"]{1,60})['"]/i) ||
      line.match(/audience\s*[:=]\s*['"]([^'"]{1,60})['"]/i) ||
      line.match(/persona\s*[:=]\s*['"]([^'"]{1,60})['"]/i);
    return m ? m[1] : 'unknown-segment';
  };

  // 1) Audience/segment conditions in JS: if (user.segment === 'vip') { ... }.
  const condPattern =
    /if\s*\([^)]*(?:segment|audience|persona|cohort)[^)]*\)/i;
  for (const raw of lines) {
    const line = raw.trim();
    if (rules.length >= maxRules) break;
    if (!condPattern.test(line)) continue;
    const seg = segmentOf(line) || 'unknown-segment';
    segments.add(seg);
    const routes = routeOf(line);
    rules.push({
      ruleId: line.slice(0, 160),
      kind: 'condition',
      segment: seg,
      routes,
      evidence: line.slice(0, 240),
    });
  }

  // 2) Personalization config objects: personalization: { rules: [...] }.
  const configPattern =
    /(?:personaliz\w*)\s*[:=]\s*\{[^}]{0,400}\}/i;
  for (const raw of lines) {
    const line = raw.trim();
    if (rules.length >= maxRules) break;
    const m = line.match(configPattern);
    if (!m) continue;
    const seg = segmentOf(line);
    segments.add(seg);
    const routes = routeOf(line);
    rules.push({
      ruleId: `config:${m[0].slice(0, 60)}...`,
      kind: 'config',
      segment: seg,
      routes,
      evidence: line.slice(0, 240),
    });
  }

  // 3) Data attributes in HTML: data-personalize / data-audience / data-segment.
  const attrPattern =
    /<(?:[a-z][a-z0-9]*)[^>]*\sdata-(?:personalize|audience|segment)="([^"]{1,80})"[^>]*>/gi;
  let am;
  while ((am = attrPattern.exec(text)) !== null && rules.length < maxRules) {
    const seg = am[1];
    segments.add(seg);
    rules.push({
      ruleId: `attr:data-*=${seg}`,
      kind: 'attribute',
      segment: seg,
      routes: [],
      evidence: am[0].slice(0, 240),
    });
  }

  // 4) Behavioral events driving rules: page_view, scroll_depth, intent signals.
  const eventPattern =
    /\.(?:track|emit|send)\s*\(\s*['"](page_view|scroll_depth|exit_intent|cart_abandon|signup_intent)[^'"]*['"]/gi;
  let em;
  while ((em = eventPattern.exec(text)) !== null && rules.length < maxRules) {
    rules.push({
      ruleId: `event:${em[1]}`,
      kind: 'event',
      segment: 'behavioral',
      routes: [],
      evidence: em[0].slice(0, 160),
    });
  }

  // Dedupe by ruleId.
  const seen = new Set();
  const unique = rules.filter(r => {
    if (seen.has(r.ruleId)) return false;
    seen.add(r.ruleId);
    return true;
  });

  return {
    rules: unique,
    segments: [...segments],
    segmentedRoutes: [...new Set(unique.flatMap(r => r.routes))],
    stats: {
      rules: unique.length,
      segments: segments.size,
      segmentedRoutes: new Set(unique.flatMap(r => r.routes)).size,
      lines: lines.length,
    },
  };
}

/**
 * Build a report finding from the extraction result.
 * @param {ReturnType<typeof extractPersonalizationRules>} result
 */
export function personalizationFinding(result) {
  return {
    title: `Personalization-rule extraction — ${result.stats.rules} rule(s) across ${result.stats.segments} segment(s)`,
    severity: 'Info',
    confidence: result.stats.rules > 0 ? 'high' : 'low',
    segments: result.segments.slice(0, 20),
    segmentedRoutes: result.segmentedRoutes.slice(0, 25),
    evidence:
      `${result.stats.rules} personalization rule(s) mapped to ` +
      `${result.stats.segmentedRoutes} segmented content route(s).`,
  };
}

export const PERSONALIZATION_RULE_EXTRACTOR = {
  extractPersonalizationRules,
  personalizationFinding,
  SEGMENT_SIGNALS,
};
export default PERSONALIZATION_RULE_EXTRACTOR;
