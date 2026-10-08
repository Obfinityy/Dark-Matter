/**
 * privacyPolicyVersionTracker.js — Privacy-policy version tracking.
 *
 * Idea 00906: track privacy-policy page versions so newly disclosed
 * sub-processors are surfaced for authorized recon.
 *
 * No network calls: the module takes operator-supplied page snapshots
 * (captured text + optional metadata), normalizes them into a versioned
 * record keyed by content hash and effective date, and diffs consecutive
 * versions to report newly disclosed sub-processors and material text
 * changes. Defensive tracking of the engagement's own target surface.
 */

import { createHash } from 'node:crypto';

const SUBPROCESSOR_HINTS = [
  /sub-?processor/i, /third[_-]?part(y|ies)/i, /service[_-]?provider/i,
  /data[_-]?processor/i, /vendor/i,
];

/**
 * @typedef {Object} PolicySnapshot
 * @property {string} text - Page text (markdown or extracted text).
 * @property {string} [capturedAt] - ISO-8601 capture time.
 * @property {string} [url] - Page URL.
 */

/**
 * Normalize policy text for stable hashing (strip dates-free noise).
 * @param {string} text
 */
function normalizePolicy(text) {
  return String(text)
    .replace(/\s+/g, ' ')
    .replace(/[©®™]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Extract a plausible effective/last-updated date from policy text.
 * @param {string} text
 * @returns {string|null} ISO-ish date or null.
 */
export function extractPolicyDate(text) {
  const t = String(text);
  const m =
    t.match(/(?:effective|last\s+updated|updated)\s*(?:date)?\s*[:\-]?\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i) ||
    t.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return m ? m[1] : null;
}

/**
 * Record a new privacy-policy snapshot as a versioned entry.
 * @param {PolicySnapshot} snapshot
 * @returns {{versionId: string, hash: string, effectiveDate: string|null, capturedAt: string, wordCount: number}}
 */
export function recordPolicyVersion(snapshot = {}) {
  const text = String(snapshot.text || '');
  const hash = createHash('sha256').update(normalizePolicy(text)).digest('hex').slice(0, 16);
  return {
    versionId: `pp-${hash}`,
    hash,
    effectiveDate: extractPolicyDate(text),
    capturedAt: snapshot.capturedAt || new Date().toISOString(),
    url: snapshot.url || null,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  };
}

/**
 * Extract candidate sub-processor names from a policy snapshot's
 * sub-processor-ish sections.
 * @param {string} text
 * @returns {string[]}
 */
export function extractSubprocessorNames(text = '') {
  const t = String(text);
  const names = new Set();
  // Lines inside sections that mention sub-processors/vendors/providers.
  const lines = t.split(/\r?\n/);
  let inSection = false;
  let sectionStreak = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (SUBPROCESSOR_HINTS.some(re => re.test(line))) {
      inSection = true;
      sectionStreak = 0;
    }
    if (inSection) {
      sectionStreak += 1;
      // Capitalized product/company names on the line are candidates.
      const cands = line.match(/\b[A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*)*\b/g) || [];
      for (const c of cands) {
        if (c.length > 2 && c.length < 40 && !/^(We|Our|The|And|For|With|Your|You|This|That)$/.test(c)) {
          names.add(c);
        }
      }
      if (sectionStreak > 60) inSection = false;
    }
    if (inSection && line === '' && sectionStreak > 8) inSection = false;
  }
  return [...names];
}

/**
 * Diff two recorded versions: newly added text and newly disclosed
 * sub-processors.
 * @param {PolicySnapshot} oldSnapshot
 * @param {PolicySnapshot} newSnapshot
 * @returns {{changed: boolean, addedSubprocessors: string[], removedSubprocessors: string[], dateChanged: boolean, stats: object}}
 */
export function diffPolicyVersions(oldSnapshot = {}, newSnapshot = {}) {
  const oldRec = recordPolicyVersion(oldSnapshot);
  const newRec = recordPolicyVersion(newSnapshot);
  const changed = oldRec.hash !== newRec.hash;
  const oldNames = new Set(extractSubprocessorNames(oldSnapshot.text));
  const newNames = new Set(extractSubprocessorNames(newSnapshot.text));
  const addedSubprocessors = [...newNames].filter(n => !oldNames.has(n));
  const removedSubprocessors = [...oldNames].filter(n => !newNames.has(n));
  return {
    changed,
    addedSubprocessors,
    removedSubprocessors,
    dateChanged: oldRec.effectiveDate !== newRec.effectiveDate,
    oldVersion: oldRec,
    newVersion: newRec,
    stats: {
      changed,
      addedSubprocessors: addedSubprocessors.length,
      removedSubprocessors: removedSubprocessors.length,
      dateChanged: oldRec.effectiveDate !== newRec.effectiveDate,
    },
  };
}

/**
 * Build a report finding from a version diff.
 * @param {ReturnType<typeof diffPolicyVersions>} diff
 */
export function privacyVersionFinding(diff) {
  return {
    title: `Privacy-policy version tracking — ${diff.stats.addedSubprocessors} newly disclosed sub-processor(s)`,
    severity: diff.stats.addedSubprocessors > 0 ? 'Low' : 'Info',
    confidence: diff.changed ? 'high' : 'medium',
    addedSubprocessors: diff.addedSubprocessors.slice(0, 30),
    removedSubprocessors: diff.removedSubprocessors.slice(0, 30),
    effectiveDate: { old: diff.oldVersion.effectiveDate, new: diff.newVersion.effectiveDate },
    evidence:
      diff.changed
        ? `Policy hash changed (${diff.oldVersion.hash} → ${diff.newVersion.hash}); ` +
          `${diff.stats.addedSubprocessors} new sub-processor mention(s).`
        : 'Policy text unchanged between snapshots.',
  };
}

export const PRIVACY_POLICY_VERSION_TRACKER = {
  recordPolicyVersion,
  extractPolicyDate,
  extractSubprocessorNames,
  diffPolicyVersions,
  privacyVersionFinding,
};
export default PRIVACY_POLICY_VERSION_TRACKER;
