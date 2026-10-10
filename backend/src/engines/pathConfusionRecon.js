/**
 * pathConfusionRecon.js — Path / URL-confusion probe builder and
 * gateway-vs-backend differential response analyzer.
 *
 * Idea 01121: Charset negotiation quirks — append ;charset= values because
 * charset handling differences cause encoding-based filter bypasses.
 *
 * Idea 01122: REST route-conflict detection — test trailing slashes, case
 * variants and dot-segments since overlapping route definitions create
 * auth-check gaps.
 *
 * Idea 01123: Path-parameter type-confusion test — swap numeric IDs for
 * strings and objects because loose parameter typing breaks downstream
 * authorization.
 *
 * Idea 01124: Matrix-parameter support test — insert ;param=value segments
 * since matrix parameters can smuggle data past path-based filters.
 *
 * Idea 01125: URL-encoded slash handling — test %2F inside path params
 * because decoded slashes can shift routing to unintended handlers.
 *
 * Idea 01126: Double-encoding path test — send %252F sequences since double
 * decoding at different layers creates route confusion.
 *
 * Idea 01127: Encoded-dot bypass at gateway — try %2e variants because
 * gateways and backends normalize dots differently.
 *
 * Idea 01128: Semicolon-parameter bypass test — append ;x=1 to paths since
 * some frameworks strip semicolon params before auth checks.
 *
 * Idea 01129: API base-path confusion test — compare /api vs /api/ handling
 * because base-path normalization gaps expose unprotected duplicates.
 *
 * Idea 01130: Case-normalization gateway differential — test /API/Users vs
 * /api/users since gateway and backend may disagree on case folding.
 *
 * No network calls: every builder emits ready-to-send probe descriptors
 * (method + path + what-response-signal-to-look-for) or probe URL-variant
 * lists; every analyzer consumes operator-supplied response records
 * (status codes, body lengths, snippets, headers) and classifies the
 * gateway-vs-backend differential. The agent's network layer performs the
 * actual transport; this module contains only the pure probe-building and
 * classification logic. Defensive surface mapping of the engagement's own
 * authorized target only.
 */

const IDEAS = Object.freeze([
  '01121', '01122', '01123', '01124', '01125',
  '01126', '01127', '01128', '01129', '01130',
]);

/**
 * Normalize a probe descriptor into a uniform shape so the agent's network
 * layer can serialize it.
 * @param {object} probe
 * @returns {{label: string, method: string, path: string, headers: object, detect: string, idea: string, variantOf: string}}
 */
export function normalizeProbe(probe = {}) {
  return {
    label: String(probe.label || ''),
    method: String(probe.method || 'GET').toUpperCase(),
    path: String(probe.path || ''),
    headers: probe.headers && typeof probe.headers === 'object' ? probe.headers : {},
    detect: String(probe.detect || ''),
    idea: String(probe.idea || ''),
    variantOf: String(probe.variantOf || ''),
  };
}

/**
 * Coerce a value to a non-empty trimmed string, or null when unusable.
 * @param {*} v
 * @returns {string|null}
 */
function cleanStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/**
 * Split a URL path into segments, preserving a trailing slash marker.
 * @param {string} path
 * @returns {{segments: string[], trailing: boolean, leading: boolean}}
 */
export function splitPath(path) {
  const p = cleanStr(path) || '/';
  const leading = p.startsWith('/');
  const trailing = p.length > 1 && p.endsWith('/');
  const segments = p.split('/').filter((seg, i, arr) => {
    // Keep interior empties (they are meaningful: // or /;/) but drop the
    // leading empty (from the leading slash) and the trailing empty.
    if (i === 0 && leading) return false;
    if (i === arr.length - 1 && trailing) return false;
    return true;
  });
  return { segments, trailing, leading };
}

/**
 * Rebuild a path from segments, preserving leading/trailing slash style.
 * @param {string[]} segments
 * @param {{trailing?: boolean, leading?: boolean}} [options]
 * @returns {string}
 */
export function joinPath(segments, options = {}) {
  const { trailing = false, leading = true } = options;
  const body = (segments || []).join('/');
  let out = (leading ? '/' : '') + body;
  if (trailing && !out.endsWith('/')) out += '/';
  return out || '/';
}

/* ------------------------------------------------------------------ */
/* Idea 01121 — Charset negotiation quirks                             */
/* ------------------------------------------------------------------ */

/** Charset values known to shift encoding-based filtering behaviour. */
export const CHARSET_VARIANTS = Object.freeze([
  'UTF-8', 'utf-8', 'ISO-8859-1', 'iso-8859-1', 'windows-1252',
  'UTF-16', 'utf-16le', 'UTF-7', 'US-ASCII', 'Shift_JIS',
]);

/**
 * Idea 01121 — build probe descriptors that append ;charset= values to each
 * path (matrix-style) and also vary the Content-Type charset, so the
 * operator can observe whether charset handling differences change what
 * the filter sees versus what the backend parses.
 * @param {string[]} paths
 * @param {{charsets?: string[]}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildCharsetProbes(paths = [], options = {}) {
  const charsets = Array.isArray(options.charsets) && options.charsets.length
    ? options.charsets
    : [...CHARSET_VARIANTS];
  const probes = [];
  for (const raw of paths || []) {
    const path = cleanStr(raw);
    if (!path) continue;
    for (const charset of charsets) {
      const cs = cleanStr(charset);
      if (!cs) continue;
      probes.push(normalizeProbe({
        idea: '01121',
        variantOf: path,
        label: `charset-quirk:${path};charset=${cs}`,
        path: `${path};charset=${cs}`,
        detect: 'response differs from plain-path baseline (status, reflected body, or content-type) across charset variants',
      }));
    }
  }
  return probes;
}

/**
 * Idea 01121 — analyze operator-supplied records for charset-driven
 * differentials: a charset variant whose response differs from the baseline
 * (different status class, different body length, or the raw payload
 * reflected where the baseline filtered it) signals an encoding-based
 * filter bypass worth investigating.
 * @param {{variantOf: string, path: string, status?: number, bodyLength?: number, reflected?: boolean, charset?: string}[]} records
 * @returns {{differentials: object[], findings: object[]}}
 */
export function analyzeCharsetDifferential(records = []) {
  const byBase = new Map();
  for (const r of records || []) {
    if (!r || !r.variantOf) continue;
    const key = String(r.variantOf);
    if (!byBase.has(key)) byBase.set(key, []);
    byBase.get(key).push(r);
  }
  const differentials = [];
  const findings = [];
  for (const [base, group] of byBase) {
    const baseline = group.find((r) => String(r.path) === base)
      || group.find((r) => !/;charset=/i.test(String(r.path)));
    if (!baseline) continue;
    const baseStatus = Number(baseline.status);
    for (const rec of group) {
      if (rec === baseline) continue;
      const st = Number(rec.status);
      const statusShift = Math.floor(st / 100) !== Math.floor(baseStatus / 100);
      const lengthShift = Number(rec.bodyLength) !== Number(baseline.bodyLength)
        && Number.isFinite(Number(rec.bodyLength));
      const reflectionShift = Boolean(rec.reflected) && !Boolean(baseline.reflected);
      if (statusShift || lengthShift || reflectionShift) {
        const diff = {
          idea: '01121',
          base,
          path: String(rec.path),
          charset: rec.charset != null ? String(rec.charset) : null,
          baselineStatus: baseStatus,
          status: st,
          statusShift,
          lengthShift,
          reflectionShift,
        };
        differentials.push(diff);
        findings.push({
          idea: '01121',
          severity: 'info',
          title: 'Charset-driven response differential',
          detail: `${rec.path} responded ${st} vs baseline ${baseStatus} on ${base} (reflectionShift=${reflectionShift}) — encoding handling differs across layers; worth probing for filter bypasses.`,
          evidence: diff,
        });
      }
    }
  }
  return { differentials, findings };
}

/* ------------------------------------------------------------------ */
/* Idea 01122 — REST route-conflict detection                          */
/* ------------------------------------------------------------------ */

/**
 * Idea 01122 — build probe descriptors for overlapping route definitions:
 * trailing-slash toggles, case variants of each segment, and dot-segment
 * insertions, since auth middleware often binds to only one spelling.
 * @param {string[]} paths
 * @param {{caseVariants?: boolean, dotSegments?: boolean}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildRouteConflictProbes(paths = [], options = {}) {
  const { caseVariants = true, dotSegments = true } = options;
  const probes = [];
  const seen = new Set();
  const add = (idea, base, label, path, detect) => {
    if (seen.has(path)) return;
    seen.add(path);
    probes.push(normalizeProbe({ idea, variantOf: base, label, path, detect }));
  };
  for (const raw of paths || []) {
    const path = cleanStr(raw);
    if (!path) continue;
    const detect = 'auth gap if variant status/redirect differs from canonical path (e.g. 200/3xx vs 401/403)';
    // Trailing-slash toggle.
    const toggled = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : `${path}/`;
    add('01122', path, `route-conflict:trailing-slash:${toggled}`, toggled, detect);
    if (caseVariants) {
      const { segments, trailing, leading } = splitPath(path);
      if (segments.length) {
        const upper = joinPath(segments.map((s) => s.toUpperCase()), { trailing, leading });
        add('01122', path, `route-conflict:upper:${upper}`, upper, detect);
        const mixed = joinPath(
          segments.map((s, i) => (i % 2 === 0 ? s.toUpperCase() : s.toLowerCase())),
          { trailing, leading },
        );
        add('01122', path, `route-conflict:mixed:${mixed}`, mixed, detect);
      }
    }
    if (dotSegments) {
      const { segments, trailing, leading } = splitPath(path);
      if (segments.length) {
        const dotted = joinPath(['.', ...segments], { trailing, leading });
        add('01122', path, `route-conflict:dot:${dotted}`, dotted, detect);
        const dotdot = joinPath([...segments, '..', segments[segments.length - 1]], { trailing, leading });
        add('01122', path, `route-conflict:dotdot:${dotdot}`, dotdot, detect);
      }
    }
  }
  return probes;
}

/**
 * Idea 01122 — classify route-conflict differentials: group records by the
 * canonical path and flag any variant that escapes the baseline auth
 * posture (baseline 401/403/404 → variant 200/201/3xx) or vice versa.
 * @param {{variantOf: string, path: string, status?: number, location?: string}[]} records
 * @returns {{conflicts: object[], findings: object[]}}
 */
export function analyzeRouteConflict(records = []) {
  const byBase = new Map();
  for (const r of records || []) {
    if (!r || !r.variantOf) continue;
    const key = String(r.variantOf);
    if (!byBase.has(key)) byBase.set(key, []);
    byBase.get(key).push(r);
  }
  const conflicts = [];
  const findings = [];
  for (const [base, group] of byBase) {
    const baseline = group.find((r) => String(r.path) === base) || group[0];
    const baseStatus = Number(baseline.status);
    const baseDenied = baseStatus === 401 || baseStatus === 403;
    const baseMissing = baseStatus === 404;
    for (const rec of group) {
      if (rec === baseline) continue;
      const st = Number(rec.status);
      const variantOk = st >= 200 && st < 400;
      const authGap = (baseDenied || baseMissing) && variantOk;
      const reverseGap = !baseDenied && !baseMissing && (st === 401 || st === 403);
      if (authGap || reverseGap) {
        const conflict = {
          idea: '01122', base, path: String(rec.path), baselineStatus: baseStatus, status: st,
          authGap, location: rec.location != null ? String(rec.location) : null,
        };
        conflicts.push(conflict);
        findings.push({
          idea: '01122',
          severity: authGap ? 'high' : 'medium',
          title: authGap ? 'Route-conflict auth bypass candidate' : 'Route-conflict auth asymmetry',
          detail: `${rec.path} → ${st} while canonical ${base} → ${baseStatus}. Overlapping route definitions disagree on auth.`,
          evidence: conflict,
        });
      }
    }
  }
  return { conflicts, findings };
}

/* ------------------------------------------------------------------ */
/* Idea 01123 — Path-parameter type-confusion test                    */
/* ------------------------------------------------------------------ */

/**
 * Idea 01123 — given a path template containing a numeric ID segment,
 * build probes that swap the numeric ID for strings, booleans, arrays and
 * JSON-object spellings, since loose parameter typing can break downstream
 * authorization checks.
 * @param {string[]} paths - Paths expected to contain a numeric segment.
 * @param {{idHint?: RegExp}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildTypeConfusionProbes(paths = [], options = {}) {
  const idHint = options.idHint instanceof RegExp ? options.idHint : /^\d+$/;
  const swaps = [
    ['string', 'abc'],
    ['alphanumeric', '123abc'],
    ['negative', '-1'],
    ['zero', '0'],
    ['float', '1.5'],
    ['boolean-true', 'true'],
    ['boolean-false', 'false'],
    ['null', 'null'],
    ['array', '[1]'],
    ['array-multi', '[1,2]'],
    ['object', '{"id":1}'],
    ['object-empty', '{}'],
    ['wildcard', '*'],
  ];
  const probes = [];
  for (const raw of paths || []) {
    const path = cleanStr(raw);
    if (!path) continue;
    const { segments, trailing, leading } = splitPath(path);
    const idx = segments.findIndex((s) => idHint.test(s));
    if (idx === -1) continue;
    for (const [kind, replacement] of swaps) {
      const variant = joinPath(
        segments.map((s, i) => (i === idx ? replacement : s)),
        { trailing, leading },
      );
      probes.push(normalizeProbe({
        idea: '01123',
        variantOf: path,
        label: `type-confusion:${kind}:${variant}`,
        path: variant,
        detect: `authorization breakage signal if ${kind} swap changes auth posture vs numeric baseline (200 with other-user data, or 500 leaking stack)`,
      }));
    }
  }
  return probes;
}

/**
 * Idea 01123 — classify type-confusion responses: flag variants that return
 * 500s (unhandled type coercion, possible info leak), and variants that
 * return 200 while the numeric baseline is denied (authorization breakage).
 * @param {{variantOf: string, path: string, status?: number, bodyLength?: number, bodySnippet?: string}[]} records
 * @returns {{anomalies: object[], findings: object[]}}
 */
export function analyzeTypeConfusion(records = []) {
  const byBase = new Map();
  for (const r of records || []) {
    if (!r || !r.variantOf) continue;
    const key = String(r.variantOf);
    if (!byBase.has(key)) byBase.set(key, []);
    byBase.get(key).push(r);
  }
  const anomalies = [];
  const findings = [];
  for (const [base, group] of byBase) {
    const baseline = group.find((r) => String(r.path) === base) || group[0];
    const baseStatus = Number(baseline.status);
    for (const rec of group) {
      if (rec === baseline) continue;
      const st = Number(rec.status);
      const serverError = st >= 500 && st < 600;
      const authBreak = (baseStatus === 401 || baseStatus === 403) && st >= 200 && st < 300;
      if (serverError || authBreak) {
        const anomaly = {
          idea: '01123', base, path: String(rec.path), baselineStatus: baseStatus,
          status: st, serverError, authBreak,
          bodySnippet: rec.bodySnippet != null ? String(rec.bodySnippet).slice(0, 200) : null,
        };
        anomalies.push(anomaly);
        findings.push({
          idea: '01123',
          severity: authBreak ? 'high' : 'medium',
          title: authBreak ? 'Type-confusion authorization breakage' : 'Type-confusion server error',
          detail: `${rec.path} → ${st} (baseline ${base} → ${baseStatus}). Loose parameter typing ${
            authBreak ? 'changed the authorization outcome' : 'triggered an unhandled server error'
          }.`,
          evidence: anomaly,
        });
      }
    }
  }
  return { anomalies, findings };
}

/* ------------------------------------------------------------------ */
/* Idea 01124 — Matrix-parameter support test                         */
/* ------------------------------------------------------------------ */

/**
 * Idea 01124 — build probes inserting ;param=value matrix segments at every
 * segment boundary, since matrix parameters can smuggle data past
 * path-based filters that only inspect the raw path.
 * @param {string[]} paths
 * @param {{params?: string[]}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildMatrixParamProbes(paths = [], options = {}) {
  const params = Array.isArray(options.params) && options.params.length
    ? options.params
    : ['x=1', 'debug=true', 'admin=true'];
  const probes = [];
  for (const raw of paths || []) {
    const path = cleanStr(raw);
    if (!path) continue;
    const { segments, trailing, leading } = splitPath(path);
    for (let i = 0; i < segments.length; i++) {
      for (const param of params) {
        const p = cleanStr(param);
        if (!p) continue;
        const variant = joinPath(
          segments.map((s, j) => (j === i ? `${s};${p}` : s)),
          { trailing, leading },
        );
        probes.push(normalizeProbe({
          idea: '01124',
          variantOf: path,
          label: `matrix-param:${segments[i]};${p}`,
          path: variant,
          detect: 'filter bypass signal if matrix-param variant escapes the baseline auth posture (200/3xx vs 401/403/404)',
        }));
      }
    }
  }
  return probes;
}

/**
 * Idea 01124 — analyze matrix-parameter differentials with the shared
 * auth-posture comparator.
 * @param {{variantOf: string, path: string, status?: number, location?: string}[]} records
 * @returns {{differentials: object[], findings: object[]}}
 */
export function analyzeMatrixParamDifferential(records = []) {
  const { differentials, findings } = compareAuthPosture(records, '01124', 'Matrix-parameter');
  return { differentials, findings };
}

/* ------------------------------------------------------------------ */
/* Idea 01125 — URL-encoded slash handling                            */
/* ------------------------------------------------------------------ */

/**
 * Idea 01125 — build probes that replace path separators with %2F (and
 * %2f) inside parameter segments, because a decoded slash can shift
 * routing to unintended handlers.
 * @param {string[]} paths
 * @param {{encodings?: string[]}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildEncodedSlashProbes(paths = [], options = {}) {
  const encodings = Array.isArray(options.encodings) && options.encodings.length
    ? options.encodings
    : ['%2F', '%2f'];
  const probes = [];
  for (const raw of paths || []) {
    const path = cleanStr(raw);
    if (!path) continue;
    const { segments, trailing, leading } = splitPath(path);
    if (segments.length < 2) continue;
    for (const enc of encodings) {
      // Merge the last two segments with an encoded slash: the gateway may
      // see one segment where the backend decodes two.
      const merged = [...segments.slice(0, -2), `${segments[segments.length - 2]}${enc}${segments[segments.length - 1]}`];
      const variant = joinPath(merged, { trailing, leading });
      probes.push(normalizeProbe({
        idea: '01125',
        variantOf: path,
        label: `encoded-slash:${enc}:${variant}`,
        path: variant,
        detect: 'routing-shift signal if response differs from baseline (different handler, status class, or redirect target)',
      }));
    }
  }
  return probes;
}

/**
 * Idea 01125 — analyze encoded-slash differentials: flag variants whose
 * status class or redirect target diverges from the baseline.
 * @param {{variantOf: string, path: string, status?: number, location?: string, bodyLength?: number}[]} records
 * @returns {{differentials: object[], findings: object[]}}
 */
export function analyzeEncodedSlashDifferential(records = []) {
  return analyzeRoutingShift(records, '01125', 'Encoded-slash');
}

/* ------------------------------------------------------------------ */
/* Idea 01126 — Double-encoding path test                             */
/* ------------------------------------------------------------------ */

/**
 * Idea 01126 — build probes using double-encoded sequences (%252F,
 * %252e, %253B) since decoding at different layers (gateway vs backend)
 * creates route confusion.
 * @param {string[]} paths
 * @param {{sequences?: string[]}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildDoubleEncodingProbes(paths = [], options = {}) {
  const sequences = Array.isArray(options.sequences) && options.sequences.length
    ? options.sequences
    : ['%252F', '%252f', '%252e', '%253B'];
  const probes = [];
  for (const raw of paths || []) {
    const path = cleanStr(raw);
    if (!path) continue;
    const { segments, trailing, leading } = splitPath(path);
    if (!segments.length) continue;
    for (const seq of sequences) {
      const variant = joinPath([...segments.slice(0, -1), `${segments[segments.length - 1]}${seq}x`], { trailing, leading });
      probes.push(normalizeProbe({
        idea: '01126',
        variantOf: path,
        label: `double-encode:${seq}:${variant}`,
        path: variant,
        detect: 'layer-confusion signal if double-encoded variant is decoded by one layer only (status/body diverges from baseline)',
      }));
    }
  }
  return probes;
}

/**
 * Idea 01126 — analyze double-encoding differentials with the shared
 * routing-shift comparator.
 * @param {{variantOf: string, path: string, status?: number, location?: string, bodyLength?: number}[]} records
 * @returns {{differentials: object[], findings: object[]}}
 */
export function analyzeDoubleEncodingDifferential(records = []) {
  return analyzeRoutingShift(records, '01126', 'Double-encoding');
}

/* ------------------------------------------------------------------ */
/* Idea 01127 — Encoded-dot bypass at gateway                         */
/* ------------------------------------------------------------------ */

/**
 * Idea 01127 — build probes with %2e / %2E / %252e dot variants in
 * traversal-style and extension-style positions, because gateways and
 * backends normalize dots differently.
 * @param {string[]} paths
 * @param {{variants?: string[]}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildEncodedDotProbes(paths = [], options = {}) {
  const variants = Array.isArray(options.variants) && options.variants.length
    ? options.variants
    : ['%2e', '%2E', '%252e', '.%2e', '%2e.'];
  const probes = [];
  for (const raw of paths || []) {
    const path = cleanStr(raw);
    if (!path) continue;
    const { segments, trailing, leading } = splitPath(path);
    for (const dot of variants) {
      // Traversal-style: /static/<dot><dot>/admin probes gateway/backend dot normalization.
      const traversal = joinPath(['static', `${dot}${dot}`, 'admin'], { trailing, leading });
      probes.push(normalizeProbe({
        idea: '01127',
        variantOf: path,
        label: `encoded-dot:traversal:${dot}`,
        path: traversal,
        detect: 'normalization-gap signal if traversal variant reaches a protected handler (200/3xx vs baseline 400/403/404)',
      }));
      if (segments.length) {
        const dotted = joinPath([...segments.slice(0, -1), `${segments[segments.length - 1]}${dot}json`], { trailing, leading });
        probes.push(normalizeProbe({
          idea: '01127',
          variantOf: path,
          label: `encoded-dot:extension:${dot}`,
          path: dotted,
          detect: 'extension-handling gap if encoded-dot extension variant changes content handling vs baseline',
        }));
      }
    }
  }
  return probes;
}

/**
 * Idea 01127 — analyze encoded-dot differentials: flag traversal variants
 * that escape the baseline posture and extension variants that change
 * content handling.
 * @param {{variantOf: string, path: string, status?: number, contentType?: string, bodyLength?: number}[]} records
 * @returns {{differentials: object[], findings: object[]}}
 */
export function analyzeEncodedDotDifferential(records = []) {
  const byBase = new Map();
  for (const r of records || []) {
    if (!r || !r.variantOf) continue;
    const key = String(r.variantOf);
    if (!byBase.has(key)) byBase.set(key, []);
    byBase.get(key).push(r);
  }
  const differentials = [];
  const findings = [];
  for (const [base, group] of byBase) {
    const baseline = group.find((r) => String(r.path) === base) || group[0];
    const baseStatus = Number(baseline.status);
    const baseDenied = [400, 401, 403, 404].includes(baseStatus);
    for (const rec of group) {
      if (rec === baseline) continue;
      const st = Number(rec.status);
      const variantOk = st >= 200 && st < 400;
      const traversalBypass = baseDenied && variantOk && /(%2e|%252e)/i.test(String(rec.path));
      const contentShift = rec.contentType != null && baseline.contentType != null
        && String(rec.contentType).split(';')[0].trim().toLowerCase()
          !== String(baseline.contentType).split(';')[0].trim().toLowerCase();
      if (traversalBypass || contentShift) {
        const diff = {
          idea: '01127', base, path: String(rec.path), baselineStatus: baseStatus,
          status: st, traversalBypass, contentShift,
          contentType: rec.contentType != null ? String(rec.contentType) : null,
        };
        differentials.push(diff);
        findings.push({
          idea: '01127',
          severity: traversalBypass ? 'high' : 'info',
          title: traversalBypass ? 'Encoded-dot gateway normalization bypass' : 'Encoded-dot content-handling shift',
          detail: `${rec.path} → ${st}${contentShift ? ` (content-type ${rec.contentType})` : ''} vs baseline ${base} → ${baseStatus}. Gateway and backend normalize dots differently.`,
          evidence: diff,
        });
      }
    }
  }
  return { differentials, findings };
}

/* ------------------------------------------------------------------ */
/* Idea 01128 — Semicolon-parameter bypass test                       */
/* ------------------------------------------------------------------ */

/**
 * Idea 01128 — build probes appending semicolon parameters (;x=1, ;, ;.json
 * style) since some frameworks strip semicolon params before auth checks
 * while the gateway still sees the protected path.
 * @param {string[]} paths
 * @param {{params?: string[]}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildSemicolonParamProbes(paths = [], options = {}) {
  const params = Array.isArray(options.params) && options.params.length
    ? options.params
    : ['x=1', '', 'a=b;c=d', '.json'];
  const probes = [];
  for (const raw of paths || []) {
    const path = cleanStr(raw);
    if (!path) continue;
    for (const param of params) {
      const suffix = param === '' ? ';' : `;${param}`;
      probes.push(normalizeProbe({
        idea: '01128',
        variantOf: path,
        label: `semicolon-param:${path}${suffix}`,
        path: `${path}${suffix}`,
        detect: 'auth-strip signal if semicolon variant returns 200/3xx while the canonical path returns 401/403',
      }));
    }
  }
  return probes;
}

/**
 * Idea 01128 — analyze semicolon-parameter differentials with the shared
 * auth-posture comparator.
 * @param {{variantOf: string, path: string, status?: number, location?: string}[]} records
 * @returns {{differentials: object[], findings: object[]}}
 */
export function analyzeSemicolonDifferential(records = []) {
  const { differentials, findings } = compareAuthPosture(records, '01128', 'Semicolon-parameter');
  return { differentials, findings };
}

/* ------------------------------------------------------------------ */
/* Idea 01129 — API base-path confusion test                          */
/* ------------------------------------------------------------------ */

/**
 * Idea 01129 — build probes comparing /api vs /api/ handling and
 * duplicate-slash / dot spellings of base paths, since base-path
 * normalization gaps expose unprotected duplicates.
 * @param {string[]} basePaths
 * @param {{suffixes?: string[]}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildBasePathConfusionProbes(basePaths = [], options = {}) {
  const suffixes = Array.isArray(options.suffixes) && options.suffixes.length
    ? options.suffixes
    : ['users', 'users/', 'v1/users', '../api/users'];
  const probes = [];
  for (const raw of basePaths || []) {
    const base = cleanStr(raw);
    if (!base) continue;
    const detect = 'duplicate-endpoint signal if a non-canonical base spelling serves the API while the canonical one is denied';
    const spellings = [
      base,
      base.endsWith('/') ? base.slice(0, -1) : `${base}/`,
      base.replace(/\/+$/, '') + '//',
      base.replace(/\/+$/, '') + '/./',
    ];
    for (const spelling of spellings) {
      for (const suffix of suffixes) {
        const cleanSuffix = String(suffix).replace(/^\/+/, '');
        const path = spelling + (spelling.endsWith('/') ? '' : '/') + cleanSuffix;
        probes.push(normalizeProbe({
          idea: '01129',
          variantOf: `${base.replace(/\/+$/, '')}/${String(suffixes[0]).replace(/^\/+/, '')}`,
          label: `base-path:${path}`,
          path,
          detect,
        }));
      }
    }
  }
  return probes;
}

/**
 * Idea 01129 — analyze base-path differentials with the shared
 * auth-posture comparator.
 * @param {{variantOf: string, path: string, status?: number, location?: string}[]} records
 * @returns {{differentials: object[], findings: object[]}}
 */
export function analyzeBasePathDifferential(records = []) {
  const { differentials, findings } = compareAuthPosture(records, '01129', 'Base-path');
  return { differentials, findings };
}

/* ------------------------------------------------------------------ */
/* Idea 01130 — Case-normalization gateway differential               */
/* ------------------------------------------------------------------ */

/**
 * Idea 01130 — build probes with case-folded spellings of each path
 * (/API/Users vs /api/users) since the gateway and backend may disagree
 * on case folding and only one of them enforces auth.
 * @param {string[]} paths
 * @returns {object[]} Probe descriptors.
 */
export function buildCaseVariantProbes(paths = []) {
  const probes = [];
  for (const raw of paths || []) {
    const path = cleanStr(raw);
    if (!path) continue;
    const { segments, trailing, leading } = splitPath(path);
    if (!segments.length) continue;
    const detect = 'case-folding gap if a cased variant escapes the baseline auth posture (200/3xx vs 401/403/404)';
    const variants = [
      joinPath(segments.map((s) => s.toUpperCase()), { trailing, leading }),
      joinPath(segments.map((s) => s.toLowerCase()), { trailing, leading }),
      joinPath(segments.map((s) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s)), { trailing, leading }),
    ];
    for (const variant of variants) {
      if (variant === path) continue;
      probes.push(normalizeProbe({
        idea: '01130',
        variantOf: path,
        label: `case-variant:${variant}`,
        path: variant,
        detect,
      }));
    }
  }
  return probes;
}

/**
 * Idea 01130 — analyze case-variant differentials with the shared
 * auth-posture comparator.
 * @param {{variantOf: string, path: string, status?: number, location?: string}[]} records
 * @returns {{differentials: object[], findings: object[]}}
 */
export function analyzeCaseDifferential(records = []) {
  const { differentials, findings } = compareAuthPosture(records, '01130', 'Case-variant');
  return { differentials, findings };
}

/* ------------------------------------------------------------------ */
/* Shared differential comparators                                     */
/* ------------------------------------------------------------------ */

/**
 * Group records by their canonical (variantOf) path.
 * @param {object[]} records
 * @returns {Map<string, object[]>}
 */
function groupByBase(records = []) {
  const byBase = new Map();
  for (const r of records || []) {
    if (!r || !r.variantOf) continue;
    const key = String(r.variantOf);
    if (!byBase.has(key)) byBase.set(key, []);
    byBase.get(key).push(r);
  }
  return byBase;
}

/**
 * Shared auth-posture comparator: flag variants that escape the baseline
 * auth posture (baseline denied/missing → variant served) or that become
 * denied while the baseline is served (asymmetric auth binding).
 * @param {object[]} records
 * @param {string} idea
 * @param {string} kind - Human label used in findings.
 * @returns {{differentials: object[], findings: object[]}}
 */
export function compareAuthPosture(records = [], idea = '', kind = 'Variant') {
  const byBase = groupByBase(records);
  const differentials = [];
  const findings = [];
  for (const [base, group] of byBase) {
    const baseline = group.find((r) => String(r.path) === base) || group[0];
    const baseStatus = Number(baseline.status);
    const baseDenied = [401, 403].includes(baseStatus);
    const baseMissing = baseStatus === 404;
    for (const rec of group) {
      if (rec === baseline) continue;
      const st = Number(rec.status);
      const variantServed = st >= 200 && st < 400;
      const variantDenied = [401, 403].includes(st);
      const escaped = (baseDenied || baseMissing) && variantServed;
      const asymmetric = !baseDenied && !baseMissing && variantDenied;
      if (escaped || asymmetric) {
        const diff = {
          idea, base, path: String(rec.path), baselineStatus: baseStatus,
          status: st, escaped, asymmetric,
          location: rec.location != null ? String(rec.location) : null,
        };
        differentials.push(diff);
        findings.push({
          idea,
          severity: escaped ? 'high' : 'medium',
          title: escaped ? `${kind} auth-bypass candidate` : `${kind} auth asymmetry`,
          detail: `${rec.path} → ${st} while canonical ${base} → ${baseStatus}. The ${kind.toLowerCase()} spelling ${
            escaped ? 'escapes' : 'is bound to different'
          } auth handling.`,
          evidence: diff,
        });
      }
    }
  }
  return { differentials, findings };
}

/**
 * Shared routing-shift comparator: flag variants whose status class,
 * redirect target, or body length diverges from the baseline, which
 * indicates the variant reached a different handler.
 * @param {object[]} records
 * @param {string} idea
 * @param {string} kind - Human label used in findings.
 * @returns {{differentials: object[], findings: object[]}}
 */
export function analyzeRoutingShift(records = [], idea = '', kind = 'Variant') {
  const byBase = groupByBase(records);
  const differentials = [];
  const findings = [];
  for (const [base, group] of byBase) {
    const baseline = group.find((r) => String(r.path) === base) || group[0];
    const baseStatus = Number(baseline.status);
    const baseClass = Math.floor(baseStatus / 100);
    const baseLocation = baseline.location != null ? String(baseline.location) : null;
    for (const rec of group) {
      if (rec === baseline) continue;
      const st = Number(rec.status);
      const statusClassShift = Math.floor(st / 100) !== baseClass;
      const loc = rec.location != null ? String(rec.location) : null;
      const redirectShift = loc !== baseLocation && (st >= 300 && st < 400);
      const lengthShift = Number.isFinite(Number(rec.bodyLength))
        && Number.isFinite(Number(baseline.bodyLength))
        && Math.abs(Number(rec.bodyLength) - Number(baseline.bodyLength)) > 0
        && (statusClassShift || st === 200);
      if (statusClassShift || redirectShift || lengthShift) {
        const diff = {
          idea, base, path: String(rec.path), baselineStatus: baseStatus, status: st,
          statusClassShift, redirectShift, lengthShift, location: loc,
        };
        differentials.push(diff);
        findings.push({
          idea,
          severity: 'info',
          title: `${kind} routing shift`,
          detail: `${rec.path} → ${st}${redirectShift ? ` (redirect → ${loc})` : ''} vs baseline ${base} → ${baseStatus}. The variant appears to reach a different handler.`,
          evidence: diff,
        });
      }
    }
  }
  return { differentials, findings };
}

/* ------------------------------------------------------------------ */
/* Registry, summary and report                                        */
/* ------------------------------------------------------------------ */

/**
 * Registry mapping each idea number (01121–01130) to its technique
 * functions: the probe builder and the differential analyzer, plus the
 * human-readable title. Coverage is verifiable: every idea has both.
 */
export const TECHNIQUE_REGISTRY = Object.freeze({
  '01121': {
    title: 'Charset negotiation quirks',
    build: buildCharsetProbes,
    analyze: analyzeCharsetDifferential,
  },
  '01122': {
    title: 'REST route-conflict detection',
    build: buildRouteConflictProbes,
    analyze: analyzeRouteConflict,
  },
  '01123': {
    title: 'Path-parameter type-confusion test',
    build: buildTypeConfusionProbes,
    analyze: analyzeTypeConfusion,
  },
  '01124': {
    title: 'Matrix-parameter support test',
    build: buildMatrixParamProbes,
    analyze: analyzeMatrixParamDifferential,
  },
  '01125': {
    title: 'URL-encoded slash handling',
    build: buildEncodedSlashProbes,
    analyze: analyzeEncodedSlashDifferential,
  },
  '01126': {
    title: 'Double-encoding path test',
    build: buildDoubleEncodingProbes,
    analyze: analyzeDoubleEncodingDifferential,
  },
  '01127': {
    title: 'Encoded-dot bypass at gateway',
    build: buildEncodedDotProbes,
    analyze: analyzeEncodedDotDifferential,
  },
  '01128': {
    title: 'Semicolon-parameter bypass test',
    build: buildSemicolonParamProbes,
    analyze: analyzeSemicolonDifferential,
  },
  '01129': {
    title: 'API base-path confusion test',
    build: buildBasePathConfusionProbes,
    analyze: analyzeBasePathDifferential,
  },
  '01130': {
    title: 'Case-normalization gateway differential',
    build: buildCaseVariantProbes,
    analyze: analyzeCaseDifferential,
  },
});

/**
 * Verify registry coverage: returns the idea numbers missing a build or
 * analyze function. An empty array means 10/10 coverage.
 * @returns {string[]}
 */
export function registryCoverageGaps() {
  return IDEAS.filter((idea) => {
    const entry = TECHNIQUE_REGISTRY[idea];
    return !entry || typeof entry.build !== 'function' || typeof entry.analyze !== 'function';
  });
}

/**
 * Build the full probe set for every registered technique against the
 * given paths. Returns probes grouped per idea plus a flat list.
 * @param {string[]} paths
 * @param {object} [options] - Forwarded to individual builders.
 * @returns {{byIdea: Record<string, object[]>, all: object[], total: number}}
 */
export function buildAllPathConfusionProbes(paths = [], options = {}) {
  const byIdea = {};
  const all = [];
  for (const idea of IDEAS) {
    const probes = TECHNIQUE_REGISTRY[idea].build(paths, options[idea] || {});
    byIdea[idea] = probes;
    all.push(...probes);
  }
  return { byIdea, all, total: all.length };
}

/**
 * Run every registered analyzer over operator-supplied response records
 * and merge the findings.
 * @param {{variantOf: string, path: string, status?: number}[]} records
 * @returns {{differentials: object[], findings: object[], byIdea: Record<string, {differentials: object[], findings: object[]}>}}
 */
export function analyzeAllDifferentials(records = []) {
  const byIdea = {};
  const differentials = [];
  const findings = [];
  for (const idea of IDEAS) {
    const result = TECHNIQUE_REGISTRY[idea].analyze(records);
    byIdea[idea] = result;
    differentials.push(...(result.differentials || []));
    const conflicts = result.conflicts || [];
    const anomalies = result.anomalies || [];
    differentials.push(...conflicts, ...anomalies);
    findings.push(...(result.findings || []));
  }
  return { differentials, findings, byIdea };
}

/**
 * Summarize merged findings into a compact report object: counts by
 * severity and by idea, plus the highest-severity signal first.
 * @param {object[]} findings
 * @returns {{total: number, bySeverity: object, byIdea: object, top: object|null, lines: string[]}}
 */
export function summarizeFindings(findings = []) {
  const list = Array.isArray(findings) ? findings : [];
  const rank = { critical: 4, high: 3, medium: 2, info: 1, low: 0 };
  const bySeverity = {};
  const byIdea = {};
  let top = null;
  for (const f of list) {
    if (!f) continue;
    const sev = String(f.severity || 'info').toLowerCase();
    bySeverity[sev] = (bySeverity[sev] || 0) + 1;
    const idea = String(f.idea || 'unknown');
    byIdea[idea] = (byIdea[idea] || 0) + 1;
    if (!top || (rank[sev] ?? 0) > (rank[String(top.severity).toLowerCase()] ?? 0)) top = f;
  }
  const lines = [
    `Path-confusion recon: ${list.length} finding(s) across ${Object.keys(byIdea).length} technique(s).`,
    ...Object.entries(bySeverity).map(([sev, n]) => `  ${sev}: ${n}`),
    ...Object.entries(byIdea).map(([idea, n]) => `  idea ${idea}: ${n}`),
  ];
  if (top) lines.push(`Top signal: [${top.severity}] ${top.title} — ${top.detail}`);
  return { total: list.length, bySeverity, byIdea, top, lines };
}

/**
 * Render a short human-readable report of the recon outcome.
 * @param {{target: string, probeTotal: number, findings: object[]}} input
 * @returns {string}
 */
export function renderReconReport({ target = '', probeTotal = 0, findings = [] } = {}) {
  const summary = summarizeFindings(findings);
  const out = [
    `# Path-confusion recon report — ${target || 'target'}`,
    '',
    `Probes generated: ${probeTotal}. Findings: ${summary.total}.`,
    '',
    ...summary.lines,
  ];
  if (summary.top) out.push('');
  const actionable = (findings || []).filter((f) => f && ['high', 'critical'].includes(String(f.severity).toLowerCase()));
  if (actionable.length) {
    out.push('## Actionable signals');
    for (const f of actionable) out.push(`- [${f.severity}] (${f.idea}) ${f.title}: ${f.detail}`);
  }
  return out.join('\n');
}

export const IDEA_NUMBERS = IDEAS;
