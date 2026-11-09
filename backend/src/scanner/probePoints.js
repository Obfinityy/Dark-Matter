// Dark Matter scanner — probe points (6 Nov 2026, path-segment lane).
//
// DIAGNOSIS (VAmPI limit #1): the 28-phase param battery mutated query
// values ONLY, so a pure-API target's real injection surface — the
// templated path segments (/books/v1/{book_title},
// /users/v1/{username}) — was never probed. The OpenAPI lane mirrored
// each path param as a query param so the battery ran, but the segment
// itself stayed untested.
//
// The fix: a probe point is either a QUERY parameter (a name in the
// query string) or a PATH segment (an index into the pathname, named
// after the OpenAPI path param it came from). Points are plain objects
// { kind: 'query'|'path', name, segment? }; a bare STRING is treated
// as a query param name for backward compatibility, so every existing
// probe unit test that passes ['q'] keeps working unchanged.
//
// ORDERING: extractProbePoints lists path points BEFORE query points,
// so a probe's per-probe point cap (slice(0, 6/10)) can never starve
// the segments, and so a segment finding wins the (class, url)
// dedupe over its query-mirror twin when both fire — the real sink
// is reported, the mirror artifact drops as a duplicate.
//
// ENCODING: mutateUrl encodes a segment value with encodeURIComponent
// (a '/' inside a payload becomes %2F, symmetric with what
// searchParams.set does to query values). A server that does not
// decode %2F in a segment will not show segment traversal — an
// honest, documented limit, not a silent miss.
export function probePointKind(point) {
  if (point && typeof point === 'object') return point.kind === 'path' ? 'path' : 'query';
  return 'query';
}

export function isPathPoint(point) {
  return probePointKind(point) === 'path';
}

export function isQueryPoint(point) {
  return probePointKind(point) === 'query';
}

// The display name of a point: the param name for a query point, the
// OpenAPI path-param name for a path point, the string itself for a
// bare-string point. Used for name-regex tests and for building
// field-name / op-name variants (nosqli, ldapBlind, argInjection).
export function probePointName(point) {
  if (point && typeof point === 'object') return String(point.name || '');
  return String(point || '');
}

// The label recorded in a finding's `param` / `parameter` field.
// A path point is suffixed ' (path)' — this is REQUIRED, not
// cosmetic: the dedupe key is class | sink||parameter||url |
// payload-first-80, and a path/query twin pair shares class + url,
// so an identical `parameter` would dedupe the path finding away
// for every probe that records `parameter` (ldap, xpath, ssi, ...).
// For a query point the label is the bare name, byte-identical to
// the pre-lane behaviour.
export function probePointParameter(point) {
  const name = probePointName(point);
  return isPathPoint(point) ? `${name} (path)` : name;
}

// Mutate one probe point in a URL and return the new URL string.
// Query point: url.searchParams.set — byte-identical to every
// probe's old local withParam. Path point: encodeURIComponent the
// value into the pathname segment at the point's index. A bare
// string point is a query param (backward compatibility).
export function mutateUrl(url, point, value) {
  const u = new URL(url);
  if (isPathPoint(point)) {
    const parts = u.pathname.split('/');
    const segment = Number(point.segment);
    if (!Number.isInteger(segment) || segment < 0 || segment >= parts.length) {
      throw new Error(`probe point segment out of range: ${point.segment} in ${url}`);
    }
    parts[segment] = encodeURIComponent(String(value));
    u.pathname = parts.join('/');
  } else {
    u.searchParams.set(probePointName(point), String(value));
  }
  return u.toString();
}

// Replace one pathname segment with a RAW (unencoded) value and
// return the new URL string. Only for probes that build their own
// encodings and must send exact bytes (crlf T4's pre-encoded
// %0d%0a payloads, which searchParams.set would double-encode) —
// the query-point branch is intentionally absent: those probes
// construct their query variant manually.
export function setPathSegmentRaw(url, segment, rawValue) {
  const u = new URL(url);
  const parts = u.pathname.split('/');
  const idx = Number(segment);
  if (!Number.isInteger(idx) || idx < 0 || idx >= parts.length) {
    throw new Error(`path segment out of range: ${segment} in ${url}`);
  }
  parts[idx] = String(rawValue);
  u.pathname = parts.join('/');
  return u.toString();
}

// Extract the probe points of a target URL: the path segments named
// in `pathParams` first, then the deduplicated query param names.
// `pathParams` is the per-target descriptor list from the OpenAPI
// inventory ({ name, segment }) — null/undefined/[] means the URL
// has no known path params and only query points are returned.
// A segment index outside the pathname is skipped (never throws —
// a stale descriptor must not kill the battery).
export function extractProbePoints(url, pathParams) {
  const points = [];
  if (Array.isArray(pathParams) && pathParams.length > 0) {
    let segmentCount = 0;
    try {
      segmentCount = new URL(url).pathname.split('/').length;
    } catch {
      segmentCount = 0;
    }
    for (const descriptor of pathParams) {
      if (!descriptor || typeof descriptor.name !== 'string' || !descriptor.name) continue;
      const segment = Number(descriptor.segment);
      if (!Number.isInteger(segment) || segment < 0 || segment >= segmentCount) continue;
      points.push({ kind: 'path', name: descriptor.name, segment });
    }
  }
  const u = new URL(url);
  for (const name of new Set(u.searchParams.keys())) {
    points.push({ kind: 'query', name });
  }
  return points;
}

// ---- Per-phase coverage diagnostic (9 Nov 2026, deep-coverage audit) ----
// The owner requires every element to get every applicable class tried.
// A probe that filters by name (rfi/ssrf/eval/...) or caps its list
// (sqli-blind 6, crlf 8, ...) silently skips elements unless it says
// what it attempted. The contract: a battery probe records the probe
// points it actually attempted into opts.diagnostics.pointsAttempted
// (display labels via probePointParameter); the orchestrator turns
// that into per-phase coverage extras (see buildCoverageExtras).
// A probe that never reports leaves pointsAttempted unset — the
// extras then carry pointsAttempted: null ("not reported"), never an
// invented number. Non-param probes (tabnabbing, padding-oracle)
// record pointsAttempted: [] plus a coverageNote naming their real
// surface, so 0 attempted reads as "not a param probe", not a skip.
/**
 * Record the probe points a probe actually attempted, for the
 * per-phase coverage diagnostic. `points` is the working list the
 * probe iterated (already sliced/filtered); labels come from
 * probePointParameter. No-op when opts carries no diagnostics
 * object (unit tests and old callers are unaffected). Calls
 * ACCUMULATE (union, deduped): a probe with two halves (csv-log's
 * CSV half + log half) reports each half and the diagnostic holds
 * the union — the second call never erases the first.
 */
export function noteAttemptedPoints(opts, points) {
  const d = opts && typeof opts === 'object' ? opts.diagnostics : null;
  if (!d || typeof d !== 'object') return;
  const prev = Array.isArray(d.pointsAttempted) ? d.pointsAttempted : [];
  const mine = (Array.isArray(points) ? points : []).map((p) => probePointParameter(p));
  d.pointsAttempted = [...new Set([...prev, ...mine])];
}

/**
 * Build the per-phase coverage extras for one battery step, from the
 * diagnostics object the probe filled and the points the orchestrator
 * offered it. Pure — exported for unit tests.
 * Returns { coverage: { pointsOffered, pointsAttempted, attemptedPoints,
 * skippedPoints, note? } }. pointsAttempted/skippedPoints are null
 * when the probe reported nothing.
 */
export function buildCoverageExtras(diag, points) {
  const offered = (Array.isArray(points) ? points : []).map((p) => probePointParameter(p));
  const attempted = diag && Array.isArray(diag.pointsAttempted) ? diag.pointsAttempted : null;
  const skipped = attempted === null ? null : offered.filter((n) => !attempted.includes(n));
  const coverage = {
    pointsOffered: offered.length,
    pointsAttempted: attempted === null ? null : attempted.length,
    attemptedPoints: attempted,
    skippedPoints: skipped,
  };
  if (diag && typeof diag.coverageNote === 'string' && diag.coverageNote) {
    coverage.note = diag.coverageNote;
  }
  return { coverage };
}
