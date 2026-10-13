// Dark Matter hunt-intel — broken access control verdict engine.
// Technique: AuthMatrix-Reloaded (MIT). Content-based verdicts, not just
// status codes: three-way triangulation + capability markers + confidence.

export const BAC_CONFIDENCE = ['tentative', 'firm', 'certain'];

/**
 * Verdict a BOLA/BFLA test from three observations.
 * @param {{owner: object, replayAsB: object, unauthenticated: object}} obs
 *   Each: {status, bodyLength, bodyHash, markers: string[]}
 * @returns {{verdict: string, confidence: string, reason: string}}
 */
export function verdictBAC(obs) {
  const { owner, replayAsB, unauthenticated } = obs || {};
  if (!owner || !replayAsB) {
    return { verdict: 'inconclusive', confidence: 'tentative', reason: 'missing observations' };
  }

  // Capability markers: admin UI elements in B's response = certain BFLA
  const adminMarkers = ['add user', 'delete', 'admin panel', 'settings', 'export all'];
  const bBody = String(replayAsB.body || '').toLowerCase();
  const hasMarker = adminMarkers.some((m) => bBody.includes(m));

  // Three-way triangulation
  const bMatchesOwner =
    replayAsB.status === owner.status &&
    Math.abs((replayAsB.bodyLength || 0) - (owner.bodyLength || 0)) < 50;

  const bBlockedLikeUnauth =
    unauthenticated &&
    replayAsB.status === unauthenticated.status;

  if (hasMarker && bMatchesOwner) {
    return { verdict: 'vulnerable_bfla', confidence: 'certain', reason: 'capability marker leaked + body matches owner' };
  }
  if (bMatchesOwner && !bBlockedLikeUnauth) {
    return { verdict: 'vulnerable_bola', confidence: 'firm', reason: 'B sees owner-identical content, not blocked like anonymous' };
  }
  if (bBlockedLikeUnauth) {
    return { verdict: 'not_vulnerable', confidence: 'firm', reason: 'B blocked same as unauthenticated' };
  }
  return { verdict: 'needs_review', confidence: 'tentative', reason: 'ambiguous — manual review needed' };
}

/** Check response for admin capability markers. */
export function findCapabilityMarkers(body) {
  const markers = [
    /add\s+user/i, /delete\s+(user|account)/i, /admin\s+panel/i,
    /export\s+all/i, /system\s+settings/i, /impersonate/i,
  ];
  return markers.filter((re) => re.test(String(body || ''))).map((re) => re.source);
}
