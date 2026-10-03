/**
 * certSerialSequencer.js — certificate serial-number sequencing (idea 00143).
 *
 * Some CAs issue serial numbers that are sequential (or close to it) within
 * an account. Tracking the serial numbers seen for a CA account lets an
 * analyst infer the issuance order and probe the hostnames that appeared
 * between two known certs. This module normalizes serials, detects
 * sequential runs, and lists the gaps worth probing.
 */

function bigSerial(raw) {
  try {
    const hex = String(raw).replace(/^0x/i, '').replace(/[^0-9a-fA-F]/g, '');
    if (!hex) return null;
    return BigInt(`0x${hex}`);
  } catch {
    return null;
  }
}

/**
 * Normalize serial-number representations to canonical hex strings.
 * @param {(string|number)[]} serials — serials as hex, decimal, or raw numbers
 * @returns {{ original, hex, value: bigint }[]}
 */
export function normalizeSerials(serials = []) {
  const out = [];
  for (const s of serials) {
    const value = bigSerial(String(s));
    if (value === null) continue;
    out.push({ original: s, hex: value.toString(16).padStart(2, '0'), value });
  }
  return out;
}

/**
 * Detect sequential runs and gaps in an issuance series.
 * @param {string[]} serials — serial numbers (any representation)
 * @returns {{ sorted: { original, hex, value }[], runs: { from, to, length }[], gaps: { from, to, missing: number }[], sequentialRatio: number }}
 */
export function findSerialRuns(serials = []) {
  const sorted = normalizeSerials(serials).sort((a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
  const runs = [];
  const gaps = [];
  let runStart = null;
  let prev = null;
  for (const cert of sorted) {
    if (prev === null || cert.value === prev.value + 1n) {
      if (runStart === null) runStart = cert;
    } else if (cert.value > prev.value) {
      runs.push({ from: runStart.hex, to: prev.hex, length: sorted.filter((c) => c.value >= runStart.value && c.value <= prev.value).length });
      const missing = cert.value - prev.value - 1n;
      if (missing > 0n && missing <= 100000n) {
        gaps.push({ from: prev.hex, to: cert.hex, missing: Number(missing) });
      }
      runStart = cert;
    }
    prev = cert;
  }
  if (runStart && prev) {
    runs.push({ from: runStart.hex, to: prev.hex, length: sorted.filter((c) => c.value >= runStart.value && c.value <= prev.value).length });
  }
  const sequentialRatio = sorted.length > 1
    ? runs.reduce((sum, r) => sum + Math.max(r.length - 1, 0), 0) / (sorted.length - 1)
    : 0;
  return { sorted, runs, gaps, sequentialRatio };
}

/**
 * Predict the next hostnames to probe: serials adjacent to known certs that
 * were not observed, paired with the nearest known hostname patterns.
 * @param {string[]} serials — observed serial numbers
 * @param {{ serial: string, hostnames: string[] }[]} knownCerts
 * @returns {{ serial, nearHostnameHint }[]}
 */
export function predictProbeSerials(serials = [], knownCerts = []) {
  const known = new Map();
  for (const cert of knownCerts) {
    const value = bigSerial(String(cert.serial));
    if (value !== null) known.set(value.toString(16), cert.hostnames || []);
  }
  const { gaps } = findSerialRuns(serials);
  const probes = [];
  for (const gap of gaps) {
    const fromValue = bigSerial(gap.from);
    if (fromValue === null) continue;
    const hint = known.get(fromValue.toString(16)) || known.get(bigSerial(gap.to).toString(16)) || [];
    const step = Math.min(gap.missing, 10);
    for (let i = 1; i <= step; i++) {
      probes.push({
        serial: (fromValue + BigInt(i)).toString(16),
        nearHostnameHint: hint,
      });
    }
  }
  return probes;
}
