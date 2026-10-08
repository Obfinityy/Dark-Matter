/**
 * ctCoverageValidator.js — multi-CT-log coverage cross-validation (idea 00148).
 *
 * A certificate should appear in every CT log it was submitted to. Querying
 * all major logs and diffing coverage catches certificates visible in only
 * one log — a sign of selective logging or an incomplete picture of the
 * target's attack surface. This module diffs per-log cert sets.
 */

function certKey(cert) {
  if (cert.fingerprint) return cert.fingerprint.toLowerCase();
  if (cert.serial && cert.issuer) return `${cert.issuer}|${cert.serial}`.toLowerCase();
  return null;
}

/**
 * Cross-validate certificate coverage across CT logs.
 * @param {Record<string, Array>} logResults — log name → array of cert metadata
 * @returns {{ logCoverage: { log, certCount }[], singleLogCerts: { key, log, hostnames: string[] }[], jaccard: Record<string, number>, gaps: { pair: string, onlyIn: string, count: number }[] }}
 */
export function crossValidateCoverage(logResults = {}) {
  const logNames = Object.keys(logResults);
  const perLog = {};
  const certToLogs = new Map();
  const certMeta = new Map();

  for (const log of logNames) {
    perLog[log] = new Set();
    for (const cert of logResults[log] || []) {
      const key = certKey(cert);
      if (!key) continue;
      perLog[log].add(key);
      if (!certToLogs.has(key)) certToLogs.set(key, []);
      certToLogs.get(key).push(log);
      if (!certMeta.has(key)) certMeta.set(key, cert);
    }
  }

  const singleLogCerts = [];
  for (const [key, logs] of certToLogs.entries()) {
    if (logs.length === 1 && logNames.length > 1) {
      const cert = certMeta.get(key);
      singleLogCerts.push({
        key,
        log: logs[0],
        hostnames: cert.hostnames || cert.san || [],
        serial: cert.serial || null,
      });
    }
  }

  const jaccard = {};
  for (let i = 0; i < logNames.length; i++) {
    for (let j = i + 1; j < logNames.length; j++) {
      const a = perLog[logNames[i]];
      const b = perLog[logNames[j]];
      const inter = [...a].filter(k => b.has(k)).length;
      const union = new Set([...a, ...b]).size;
      jaccard[`${logNames[i]}~${logNames[j]}`] = union ? inter / union : 0;
    }
  }

  const gaps = [];
  for (let i = 0; i < logNames.length; i++) {
    for (let j = 0; j < logNames.length; j++) {
      if (i === j) continue;
      const onlyIn = [...perLog[logNames[i]]].filter(k => !perLog[logNames[j]].has(k));
      if (onlyIn.length) {
        gaps.push({
          pair: `${logNames[i]} vs ${logNames[j]}`,
          onlyIn: logNames[i],
          count: onlyIn.length,
        });
      }
    }
  }

  return {
    logCoverage: logNames.map(log => ({ log, certCount: perLog[log].size })),
    singleLogCerts,
    jaccard,
    gaps,
  };
}

/**
 * Merge per-log results into one deduplicated certificate list, noting
 * which logs each cert was seen in.
 * @param {Record<string, Array>} logResults
 * @returns {{ cert, seenIn: string[] }[]}
 */
export function mergeLogResults(logResults = {}) {
  const seen = new Map();
  for (const [log, certs] of Object.entries(logResults)) {
    for (const cert of certs || []) {
      const key = certKey(cert);
      if (!key) continue;
      if (!seen.has(key)) seen.set(key, { cert, seenIn: [] });
      const entry = seen.get(key);
      if (!entry.seenIn.includes(log)) entry.seenIn.push(log);
    }
  }
  return [...seen.values()].sort((a, b) => b.seenIn.length - a.seenIn.length);
}
