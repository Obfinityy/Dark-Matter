/**
 * sctTimestampIntel.js — SCT embedded-timestamp ordering (idea 00147).
 *
 * Every Signed Certificate Timestamp (SCT) carries the log's timestamp of
 * when the precertificate was seen. Ordering certificates by their embedded
 * SCT timestamps reconstructs the exact sequence in which infrastructure
 * was rolled out (which hostname came first, bursts of issuance, etc.).
 * This module sorts certs by SCT time and summarizes rollout waves.
 */

function earliestSctTime(cert) {
  const times = (cert.scts || []).map(s => new Date(s.timestamp).getTime()).filter(Number.isFinite);
  return times.length ? Math.min(...times) : null;
}

/**
 * Order certificates by embedded SCT timestamp (rollout sequence).
 * @param {{ serial, hostnames?: string[], scts?: { logId, timestamp }[] }[]} certs
 * @returns {{ serial, hostnames: string[], sctTime, sctTimeIso, sctCount }[]}
 */
export function orderBySctTimestamp(certs = []) {
  return certs
    .map(c => {
      const t = earliestSctTime(c);
      return {
        serial: c.serial || null,
        hostnames: c.hostnames || [],
        sctTime: t,
        sctTimeIso: t === null ? null : new Date(t).toISOString(),
        sctCount: (c.scts || []).length,
      };
    })
    .filter(c => c.sctTime !== null)
    .sort((a, b) => a.sctTime - b.sctTime);
}

/**
 * Group an SCT-ordered sequence into rollout waves: bursts of issuance
 * separated by quiet periods.
 * @param {{ serial, hostnames: string[], scts?: { logId, timestamp }[] }[]} certs
 * @param {number} gapMinutes — silence longer than this starts a new wave
 * @returns {{ wave, startedAt, endedAt, certificates: string[], hostnames: string[] }[]}
 */
export function detectRolloutWaves(certs = [], gapMinutes = 60) {
  const ordered = orderBySctTimestamp(certs);
  const waves = [];
  let current = null;
  for (const cert of ordered) {
    const gap = current ? cert.sctTime - current.lastTime : Infinity;
    if (!current || gap > gapMinutes * 60 * 1000) {
      current = {
        wave: waves.length + 1,
        startedAt: cert.sctTimeIso,
        endedAt: cert.sctTimeIso,
        certificates: [],
        hostnames: [],
        lastTime: cert.sctTime,
      };
      waves.push(current);
    }
    current.certificates.push(cert.serial);
    for (const h of cert.hostnames) {
      if (!current.hostnames.includes(h)) current.hostnames.push(h);
    }
    current.endedAt = cert.sctTimeIso;
    current.lastTime = cert.sctTime;
  }
  return waves.map(({ lastTime, ...rest }) => rest);
}

/**
 * Find hostnames that were rolled out first per suffix (apex vs services).
 * @param {{ serial, hostnames?: string[], scts?: { logId, timestamp }[] }[]} certs
 * @returns {{ hostname, sctTimeIso, rolloutRank: number }[]}
 */
export function firstSeenHostnames(certs = []) {
  const ordered = orderBySctTimestamp(certs);
  const firstSeen = new Map();
  for (const cert of ordered) {
    for (const h of cert.hostnames) {
      if (!firstSeen.has(h)) {
        firstSeen.set(h, {
          hostname: h,
          sctTimeIso: cert.sctTimeIso,
          rolloutRank: firstSeen.size + 1,
        });
      }
    }
  }
  return [...firstSeen.values()];
}
