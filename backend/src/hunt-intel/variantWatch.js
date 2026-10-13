// Dark Matter hunt-intel — negative-day silent-patch watch.
// Technique: vulnerability-spoiler-alert (MIT) + DiffRays (MIT) + diffalayze (MIT).
// Watch upstream commits for SILENT security patches (before CVE assignment),
// then variant-hunt the target for the same flaw.

/** Keywords that suggest a silent security patch. */
const SILENT_PATCH_KEYWORDS = [
  /fix.*(?:overflow|oob|uaf|double[-\s]?free)/i,
  /sanitize|escape.*output/i,
  /auth.*bypass|bypass.*auth/i,
  /prevent.*(?:injection|traversal)/i,
  /bounds?\s*check/i,
  /use[-\s]?after[-\s]?free/i,
  /integer\s*overflow/i,
];

/** Score a commit message for silent-patch likelihood. */
export function scoreSilentPatch(commitMessage, filesChanged = []) {
  let score = 0;
  const msg = String(commitMessage || '');
  for (const re of SILENT_PATCH_KEYWORDS) {
    if (re.test(msg)) score += 2;
  }
  // Security-relevant files bump the score
  const sensitiveFiles = /\.(c|cpp|h|rs|go)$|auth|session|crypto|parser/i;
  if (filesChanged.some((f) => sensitiveFiles.test(f))) score += 1;
  // Explicit CVE mention = already disclosed, not silent
  if (/cve-\d{4}-\d+/i.test(msg)) score = 0;
  return score;
}

/**
 * Build a variant-hunt task from a suspected silent patch.
 * @returns {{priority: string, hunt: object} | null}
 */
export function silentPatchToVariant(commit) {
  const score = scoreSilentPatch(commit.message, commit.files || []);
  if (score < 2) return null;
  return {
    priority: score >= 4 ? 'critical' : 'high',
    hunt: {
      type: 'variant_hunt',
      reason: 'silent upstream patch — possible negative-day',
      commit: commit.sha?.slice(0, 8),
      files: commit.files || [],
      strategy: 'fingerprint target version → if pre-patch, replay the fixed flaw class',
    },
  };
}

/** Multi-signal version fingerprinting (cve-2026-1731-scanner technique). */
export function fingerprintConfidence(signals) {
  // signals: [{source, version, weight}]
  const byVersion = new Map();
  for (const s of signals || []) {
    const cur = byVersion.get(s.version) || 0;
    byVersion.set(s.version, cur + (s.weight || 1));
  }
  const sorted = [...byVersion.entries()].sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return { version: null, confidence: 'none' };
  const [version, weight] = sorted[0];
  const total = [...byVersion.values()].reduce((a, b) => a + b, 0);
  const ratio = weight / total;
  return {
    version,
    confidence: ratio >= 0.8 ? 'exact' : ratio >= 0.6 ? 'high' : ratio >= 0.4 ? 'medium' : 'low',
  };
}
