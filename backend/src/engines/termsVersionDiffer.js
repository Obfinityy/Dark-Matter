/**
 * termsVersionDiffer.js — Terms-of-service version diffing.
 *
 * Idea 00909: diff terms-of-service versions for newly mentioned services
 * on an authorized target.
 *
 * No network calls: the module takes two operator-supplied terms snapshots
 * (old and new text), performs a line/token level diff, and surfaces newly
 * mentioned third-party services, removed services, and structural changes
 * (new sections, new headings). Defensive change-tracking of the
 * engagement's own target surface.
 */

const SERVICE_CANDIDATE_RE =
  /\b[A-Z][A-Za-z0-9]*(?:[ \t]+(?:[A-Z][A-Za-z0-9]*|of|for|and|the)){0,3}/g;

const NOISE_WORDS = new Set([
  'We', 'Our', 'The', 'And', 'For', 'With', 'Your', 'You', 'This', 'That',
  'These', 'Those', 'From', 'Into', 'Under', 'Terms', 'Service', 'Services',
  'Agreement', 'Policy', 'Section', 'Article', 'You Agree', 'Effective',
]);

/**
 * @typedef {Object} TermsDiff
 * @property {boolean} changed - Whether the text changed at all.
 * @property {string[]} addedServices - Newly mentioned services.
 * @property {string[]} removedServices - No-longer-mentioned services.
 * @property {string[]} addedSections - New headings/sections.
 * @property {string[]} addedLines - New lines (trimmed, capped).
 * @property {object} stats - Diff statistics.
 */

/**
 * Extract candidate service names (proper-noun phrases) from text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractServiceMentions(text = '') {
  const t = String(text);
  const names = new Set();
  let m;
  SERVICE_CANDIDATE_RE.lastIndex = 0;
  while ((m = SERVICE_CANDIDATE_RE.exec(t)) !== null) {
    const name = m[0].trim();
    const first = name.split(/\s+/)[0];
    if (name.length < 3 || name.length > 60) continue;
    if (NOISE_WORDS.has(first)) continue;
    if (/^[A-Z]{2,}$/.test(name.replace(/\s/g, '')) && name.length < 5) continue;
    names.add(name);
  }
  return [...names];
}

/**
 * Extract headings (markdown or numbered/clauses) from terms text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractTermsHeadings(text = '') {
  const t = String(text);
  const headings = new Set();
  for (const raw of t.split(/\r?\n/)) {
    const line = raw.trim();
    const md = line.match(/^#{1,4}\s+(.{3,90})$/);
    if (md) { headings.add(md[1].trim()); continue; }
    const numbered = line.match(/^(\d{1,2}\.\s+[A-Z][\w\s&',()\-]{3,80})$/);
    if (numbered && line.length < 100) { headings.add(numbered[1].trim()); continue; }
    const upper = line.match(/^([A-Z][A-Z\s&',()\-]{5,80})$/);
    if (upper && line.length < 90) headings.add(upper[1].trim());
  }
  return [...headings];
}

/**
 * Diff two terms-of-service snapshots.
 * @param {{text?: string, capturedAt?: string}} oldSnap
 * @param {{text?: string, capturedAt?: string}} newSnap
 * @param {{maxLines?: number}} [options]
 * @returns {TermsDiff}
 */
export function diffTermsVersions(oldSnap = {}, newSnap = {}, options = {}) {
  const { maxLines = 60 } = options;
  const oldText = String(oldSnap.text || '');
  const newText = String(newSnap.text || '');
  const changed = oldText !== newText;

  const oldLines = new Set(oldText.split(/\r?\n/).map(l => l.trim()).filter(Boolean));
  const addedLines = newText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !oldLines.has(l))
    .slice(0, maxLines);

  const oldServices = new Set(extractServiceMentions(oldText));
  const newServices = new Set(extractServiceMentions(newText));
  const addedServices = [...newServices].filter(s => !oldServices.has(s));
  const removedServices = [...oldServices].filter(s => !newServices.has(s));

  const oldHeadings = new Set(extractTermsHeadings(oldText));
  const addedSections = extractTermsHeadings(newText).filter(h => !oldHeadings.has(h));

  return {
    changed,
    addedServices,
    removedServices,
    addedSections,
    addedLines,
    stats: {
      changed,
      addedServices: addedServices.length,
      removedServices: removedServices.length,
      addedSections: addedSections.length,
      addedLines: addedLines.length,
      oldWords: oldText.split(/\s+/).filter(Boolean).length,
      newWords: newText.split(/\s+/).filter(Boolean).length,
    },
  };
}

/**
 * Build a report finding from the diff result.
 * @param {TermsDiff} diff
 */
export function termsDiffFinding(diff) {
  const material = diff.stats.addedServices > 0 || diff.stats.addedSections > 0;
  return {
    title: `Terms-of-service version diffing — ${diff.stats.addedServices} new service(s), ${diff.stats.addedSections} new section(s)`,
    severity: material ? 'Low' : 'Info',
    confidence: diff.changed ? 'high' : 'medium',
    addedServices: diff.addedServices.slice(0, 30),
    removedServices: diff.removedServices.slice(0, 30),
    addedSections: diff.addedSections.slice(0, 20),
    evidence:
      diff.changed
        ? `Terms text changed (${diff.stats.oldWords} → ${diff.stats.newWords} words); ` +
          `${diff.stats.addedServices} newly mentioned service(s), ` +
          `${diff.stats.addedSections} new section(s).`
        : 'Terms text unchanged between snapshots.',
  };
}

export const TERMS_VERSION_DIFFER = {
  extractServiceMentions,
  extractTermsHeadings,
  diffTermsVersions,
  termsDiffFinding,
};
export default TERMS_VERSION_DIFFER;
