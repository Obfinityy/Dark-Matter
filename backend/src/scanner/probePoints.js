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
