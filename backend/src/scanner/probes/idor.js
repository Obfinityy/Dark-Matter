// Dark Matter rule-based scanner — IDOR probe (v2).
// Flags sequential numeric, UUID-shaped, and predictable-token
// object references as a review surface. A true cross-user
// differential needs two authenticated sessions; without them the
// item stays UNCONFIRMED by design and is never reported as a
// finding — the confirmable leg lives in idorUuid.js and rides the
// same 'idor' phase. Pure function of the URL — no network.
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const HEX_ID_RE = /^[0-9a-f]{8,32}$/i;
const TOKEN_PART_RE = /^(?=.*[0-9])(?=.*[a-z])[0-9a-z]{8,32}$/i;
const NUMERIC_PART_RE = /^\d{3,}$/;

/**
 * Classify one URL path segment as an object-ID shape. Returns
 * 'uuid' (canonical 8-4-4-4-12 hex, any version), 'predictable-token'
 * (a short hex id such as a truncated UUID or a 24-hex ObjectId, or
 * a mixed letter+digit token — hyphenated segments are split and
 * each part is classified, so "ord-9f2k7xq4" classifies on its
 * token part), 'numeric' (a sequential numeric id — the v1 surface),
 * or null (an ordinary slug: all letters, too short, or no id
 * shape at all). Priority is uuid > predictable-token > numeric.
 * Pure. Exported for the idorUuid miner and for unit tests.
 */
export function classifyIdSegment(segment) {
  const s = String(segment || '');
  if (!s) return null;
  if (UUID_RE.test(s)) return 'uuid';
  const parts = s.split(/[-_]/).filter(Boolean);
  let sawNumeric = false;
  for (const p of parts) {
    if (HEX_ID_RE.test(p)) return 'predictable-token';
    if (TOKEN_PART_RE.test(p)) return 'predictable-token';
    if (NUMERIC_PART_RE.test(p)) sawNumeric = true;
  }
  if (sawNumeric) return 'numeric';
  return null;
}

export function probeIdorSurface(url) {
  const u = String(url);
  // v1 behaviour, byte-preserved: a sequential numeric object
  // reference anywhere in the path flags the surface.
  const m = /\/(\d{3,})(\/|$|\?)/.exec(u);
  if (m) {
    return [
      {
        class: 'idor',
        id: `idor-surface-${m[1]}`,
        title: `Sequential object ID in URL — IDOR review surface: ${u}`,
        severity: 'info',
        url: u,
        evidence: {
          request: `GET ${u}`,
          response: 'numeric object reference detected in the URL path',
          impact_demo: 'needs a second session for the cross-user differential — not auto-confirmed',
        },
      },
    ];
  }
  // v2 (row #339): a UUID-shaped object reference flags the same
  // INFO review surface. A random UUIDv4 is not itself predictable
  // — the flag says "review this object reference", and only the
  // two-session differential in idorUuid.js can confirm access.
  const uuid = UUID_RE.exec(u);
  if (uuid) {
    return [
      {
        class: 'idor',
        id: `idor-surface-${uuid[0]}`,
        title: `UUID object ID in URL — IDOR review surface: ${u}`,
        severity: 'info',
        url: u,
        evidence: {
          request: `GET ${u}`,
          response: 'UUID-shaped object reference detected in the URL path',
          impact_demo:
            'needs a second session for the cross-user differential — not auto-confirmed',
        },
      },
    ];
  }
  // v2 (row #339): a predictable-token object reference (short hex
  // id, truncated UUID, ObjectId, mixed letter+digit token) flags
  // the same INFO review surface.
  let tokenSeg = null;
  try {
    for (const seg of new URL(u).pathname.split('/').filter(Boolean)) {
      if (classifyIdSegment(seg) === 'predictable-token') {
        tokenSeg = seg;
        break;
      }
    }
  } catch {
    tokenSeg = null;
  }
  if (tokenSeg) {
    return [
      {
        class: 'idor',
        id: `idor-surface-${tokenSeg}`,
        title: `Predictable token ID in URL — IDOR review surface: ${u}`,
        severity: 'info',
        url: u,
        evidence: {
          request: `GET ${u}`,
          response: 'predictable-token object reference detected in the URL path',
          impact_demo: 'needs a second session for the cross-user differential — not auto-confirmed',
        },
      },
    ];
  }
  return [];
}
