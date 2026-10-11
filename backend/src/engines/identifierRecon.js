/**
 * identifierRecon.js — Identifier-scheme + state-machine security reconnaissance.
 *
 * Defensive analyzer functions for an authorized bug-bounty agent. Each function
 * inspects OBSERVED behavior (responses, headers, bodies, docs) of authorized
 * targets and derives a security verdict — they never send exploit payloads, never
 * brute-force anything live, and never handle real secrets beyond entropy/shape
 * estimates. Identifier formats (UUID/ULID/ObjectId/Hashid/base64) and resource
 * state machines are analyzed from what the target already revealed to the
 * authorized test account.
 *
 * Covers idea-bank ideas 1261-1270:
 *  1261 evaluateUuidStrictness — verdict on UUID-format validation from probe outcomes
 *  1262 mapIdFormats — accepted identifier formats per resource and what they reveal
 *  1263 mapSlugToIdResolution — slug-vs-ID authz parity findings
 *  1264 analyzeNumericIdPredictability — sequentiality/entropy analysis of numeric IDs
 *  1265 extractUlidTimestamp — ULID timestamp decode, creation-order/timing findings
 *  1266 analyzeObjectIdComponents — Mongo ObjectId timestamp/machine-identity analysis
 *  1267 attemptHashidDecode — decode obfuscated IDs with common configs (obfuscation check)
 *  1268 analyzeBase64IdIntegrity — base64 ID structure/integrity analysis
 *  1269 mapHypermediaTransitions — state-transition map from observed allowed actions
 *  1270 assessTransitionGuards — server-side vs client-side transition-guard verdict
 */

/** Ideas implemented by this module (auditable coverage). */
export const WAVE1261_COVERAGE = [1261, 1262, 1263, 1264, 1265, 1266, 1267, 1268, 1269, 1270];

/**
 * Map an idea number to the function that implements it.
 * @returns {Record<number, string>} idea number -> exported function name
 */
export function ideaFunctions() {
  return {
    1261: 'evaluateUuidStrictness',
    1262: 'mapIdFormats',
    1263: 'mapSlugToIdResolution',
    1264: 'analyzeNumericIdPredictability',
    1265: 'extractUlidTimestamp',
    1266: 'analyzeObjectIdComponents',
    1267: 'attemptHashidDecode',
    1268: 'analyzeBase64IdIntegrity',
    1269: 'mapHypermediaTransitions',
    1270: 'assessTransitionGuards',
  };
}

// ---------------------------------------------------------------- 1261 ----

/**
 * Evaluate how strictly an endpoint validates UUID-formatted identifiers.
 *
 * Probe observations (from authorized-test-account responses only):
 * @param {object} obs
 * @param {boolean} [obs.rejectedMalformed] — did the server reject a malformed UUID (bad hex/length)?
 * @param {boolean} [obs.rejectedNonV4] — did the server reject a syntactically valid but non-v4 UUID where v4 is documented?
 * @param {boolean} [obs.rejectedNil] — did the server reject the all-zero nil UUID?
 * @param {boolean} [obs.rejectedVersionMarker] — did the server reject a UUID with a wrong version nibble when v4 is required?
 * @param {boolean} [obs.acceptedUppercase] — did the server accept uppercase hex (cosmetic, usually fine)?
 * @returns {{ verdict: 'PASS'|'WEAK'|'FAIL', findings: string[], score: number }}
 *   PASS = strict validation; WEAK = lax in places; FAIL = effectively unvalidated.
 */
export function evaluateUuidStrictness({
  rejectedMalformed,
  rejectedNonV4,
  rejectedNil,
  rejectedVersionMarker,
  acceptedUppercase,
} = {}) {
  const findings = [];
  let penalty = 0;

  if (rejectedMalformed === false) {
    findings.push('Server accepted a malformed UUID — identifier format validation is absent at this endpoint.');
    penalty += 50;
  } else if (rejectedMalformed === true) {
    findings.push('Server rejected malformed UUIDs — basic format validation is enforced.');
  }

  if (rejectedNil === false) {
    findings.push('Server accepted the nil UUID (00000000-0000-0000-0000-000000000000) — sentinel identifiers are not filtered.');
    penalty += 20;
  } else if (rejectedNil === true) {
    findings.push('Server rejected the nil UUID — sentinel identifiers are filtered.');
  }

  if (rejectedNonV4 === false) {
    findings.push('Server accepted non-v4 UUIDs despite v4 being documented — version expectations are not enforced.');
    penalty += 15;
  }

  if (rejectedVersionMarker === false) {
    findings.push('Server accepted UUIDs with a wrong version nibble — version-marker checks are absent.');
    penalty += 15;
  }

  if (acceptedUppercase === true) {
    findings.push('Server accepts uppercase hex in UUIDs — cosmetic normalization only, not a weakness.');
  }

  const score = Math.max(0, 100 - penalty);
  const verdict = score >= 80 ? 'PASS' : score >= 50 ? 'WEAK' : 'FAIL';
  return { verdict, findings, score };
}

// ---------------------------------------------------------------- 1262 ----

/**
 * Map which identifier formats an endpoint accepts per resource.
 *
 * Observations: for each resource, which of the formats (numeric, uuid, slug)
 * the server accepted (HTTP 2xx/404-with-object-shape vs 400/404-generic).
 * @param {Array<{ resource: string, accepted: { numeric?: boolean, uuid?: boolean, slug?: boolean }, docsClaim?: string }>} resources
 * @returns {{ formats: Record<string, string[]>, findings: string[], schemeReveals: number }}
 *   formats maps resource -> accepted formats; schemeReveals counts resources where
 *   the accepted formats expose more than the documentation claims.
 */
export function mapIdFormats(resources = []) {
  const formats = {};
  const findings = [];
  let schemeReveals = 0;

  for (const r of resources) {
    const accepted = Object.entries(r.accepted || {})
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    formats[r.resource] = accepted;

    if (accepted.length > 1) {
      findings.push(
        `Resource '${r.resource}' accepts multiple identifier formats (${accepted.join(', ')}) — the internal identifier scheme is wider than a single-format API suggests.`
      );
      schemeReveals += 1;
    }

    if (r.docsClaim && accepted.length > 0 && !accepted.includes(r.docsClaim)) {
      findings.push(
        `Resource '${r.resource}' documentation claims '${r.docsClaim}' identifiers, but the server accepted ${accepted.join(', ')} — the docs underspecify the real identifier surface.`
      );
      schemeReveals += 1;
    }
  }

  return { formats, findings, schemeReveals };
}

// ---------------------------------------------------------------- 1263 ----

/**
 * Compare authorization enforcement between slug-addressed and ID-addressed endpoints.
 *
 * Observation pattern: fetch the same object by slug and by internal ID as an
 * authorized non-owner test account, record the authz outcome of each.
 * @param {Array<{ slugPath: string, idPath: string, slugAuthz: 'allowed'|'denied', idAuthz: 'allowed'|'denied', note?: string }>} pairs
 * @returns {{ verdict: 'PASS'|'FAIL', findings: string[], mismatches: number }}
 *   FAIL = at least one slug path is authorized differently (usually weaker) than the ID path.
 */
export function mapSlugToIdResolution(pairs = []) {
  const findings = [];
  let mismatches = 0;

  for (const p of pairs) {
    if (p.slugAuthz === 'allowed' && p.idAuthz === 'denied') {
      findings.push(
        `Authorization mismatch: slug path '${p.slugPath}' allowed the request while ID path '${p.idPath}' denied it — the slug endpoint appears to skip the authz the ID endpoint enforces.`
      );
      mismatches += 1;
    } else if (p.slugAuthz === p.idAuthz) {
      findings.push(`Authz parity confirmed: '${p.slugPath}' and '${p.idPath}' both ${p.slugAuthz}.`);
    } else {
      findings.push(`Authz differs for '${p.slugPath}' (${p.slugAuthz}) vs '${p.idPath}' (${p.idAuthz}) — review for inconsistent enforcement.`);
      mismatches += 1;
    }
  }

  return { verdict: mismatches === 0 ? 'PASS' : 'FAIL', findings, mismatches };
}

// ---------------------------------------------------------------- 1264 ----

/**
 * Analyze observed numeric IDs for sequentiality/predictability.
 *
 * @param {number[]} ids — numeric IDs observed across authorized test-account resources (order observed).
 * @returns {{ verdict: 'PASS'|'WEAK'|'FAIL', findings: string[], stats: { count: number, sequentialPairs: number, minGap: number, maxGap: number, monotonic: boolean, estimatedBits: number } }}
 *   FAIL = IDs are (near-)sequential and trivially enumerable; WEAK = low-entropy gaps;
 *   PASS = gaps large enough that enumeration is impractical.
 */
export function analyzeNumericIdPredictability(ids = []) {
  const findings = [];
  const stats = { count: ids.length, sequentialPairs: 0, minGap: Infinity, maxGap: 0, monotonic: true, estimatedBits: 0 };

  if (ids.length < 2) {
    findings.push('Fewer than two numeric IDs observed — sequentiality cannot be assessed.');
    return { verdict: 'PASS', findings, stats };
  }

  const sorted = [...ids].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap === 1) stats.sequentialPairs += 1;
    if (gap < stats.minGap) stats.minGap = gap;
    if (gap > stats.maxGap) stats.maxGap = gap;
  }
  for (let i = 1; i < ids.length; i += 1) {
    if (ids[i] <= ids[i - 1]) { stats.monotonic = false; break; }
  }
  stats.estimatedBits = stats.maxGap > 0 ? Math.ceil(Math.log2(stats.maxGap + 1)) : 0;

  const seqRatio = stats.sequentialPairs / (sorted.length - 1);
  if (seqRatio >= 0.5) {
    findings.push(`IDs are sequential in ${stats.sequentialPairs}/${sorted.length - 1} adjacent pairs — object enumeration is trivial.`);
  } else if (stats.maxGap > 0 && stats.maxGap < 1000) {
    findings.push(`ID gaps are small (max gap ${stats.maxGap}) — IDs are predictable enough to enumerate.`);
  } else {
    findings.push(`ID gaps are large (max gap ${stats.maxGap}) — enumeration is impractical from these observations.`);
  }
  if (stats.monotonic) {
    findings.push('IDs increase monotonically with creation order — creation timing can be inferred from ID value.');
  }

  const verdict = seqRatio >= 0.5 ? 'FAIL' : (stats.maxGap > 0 && stats.maxGap < 1000 ? 'WEAK' : 'PASS');
  return { verdict, findings, stats };
}

// ---------------------------------------------------------------- 1265 ----

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function decodeUlidTimestamp(ulid) {
  if (typeof ulid !== 'string' || ulid.length !== 26) return null;
  const upper = ulid.toUpperCase();
  let ts = 0;
  for (let i = 0; i < 10; i += 1) {
    const digit = ULID_ALPHABET.indexOf(upper[i]);
    if (digit === -1) return null;
    ts = ts * 32 + digit;
  }
  return ts;
}

/**
 * Decode ULID timestamps from observed identifiers and assess timing leakage.
 *
 * @param {string[]} ulids — ULID strings observed on authorized targets.
 * @returns {{ decoded: Array<{ ulid: string, timestampMs: number, iso: string }>, findings: string[], orderedByCreation: boolean, timeSpanMs: number }}
 */
export function extractUlidTimestamp(ulids = []) {
  const decoded = [];
  const findings = [];

  for (const u of ulids) {
    const ts = decodeUlidTimestamp(u);
    if (ts === null) {
      findings.push(`'${u}' is not a valid ULID — not decodable.`);
      continue;
    }
    decoded.push({ ulid: u, timestampMs: ts, iso: new Date(ts).toISOString() });
  }

  const times = decoded.map((d) => d.timestampMs);
  const timeSpanMs = times.length > 1 ? Math.max(...times) - Math.min(...times) : 0;

  const orderedByCreation = decoded.every((d, i, arr) => i === 0 || arr[i - 1].timestampMs <= d.timestampMs);
  if (decoded.length > 1 && orderedByCreation) {
    findings.push('ULIDs appear in creation order — embedded timestamps confirm creation sequencing and can be decoded by anyone.');
  }
  if (decoded.length > 0) {
    findings.push(`ULIDs embed millisecond creation timestamps (${decoded[0].iso} …) — creation timing is public information, not a secret.`);
  }
  if (timeSpanMs > 0 && timeSpanMs < 3_600_000) {
    findings.push(`All observed ULIDs were created within ${(timeSpanMs / 1000).toFixed(1)}s — a tight window that aids targeted enumeration by timestamp.`);
  }

  return { decoded, findings, orderedByCreation, timeSpanMs };
}

// ---------------------------------------------------------------- 1266 ----

/**
 * Parse MongoDB ObjectId components and assess information leakage.
 *
 * Layout: 4-byte big-endian timestamp | 3-byte machine id | 2-byte process id | 3-byte counter.
 * @param {string[]} objectIds — 24-hex-char ObjectIds observed on authorized targets.
 * @returns {{ parsed: Array<{ objectId: string, createdAt: string, machineId: string, processId: string, counter: number }>, findings: string[], machineIds: string[] }}
 */
export function analyzeObjectIdComponents(objectIds = []) {
  const parsed = [];
  const findings = [];
  const machineSet = new Set();

  for (const oid of objectIds) {
    if (!/^[0-9a-fA-F]{24}$/.test(oid)) {
      findings.push(`'${oid}' is not a 24-hex-char ObjectId — skipped.`);
      continue;
    }
    const ts = parseInt(oid.slice(0, 8), 16);
    const machineId = oid.slice(8, 14).toLowerCase();
    const processId = oid.slice(14, 18).toLowerCase();
    const counter = parseInt(oid.slice(18, 24), 16);
    machineSet.add(machineId);
    parsed.push({
      objectId: oid,
      createdAt: new Date(ts * 1000).toISOString(),
      machineId,
      processId,
      counter,
    });
  }

  if (parsed.length > 0) {
    findings.push(`ObjectIds embed creation timestamps (e.g. ${parsed[0].createdAt}) — document creation time is public information.`);
  }
  if (machineSet.size === 1 && parsed.length > 1) {
    findings.push(`All observed ObjectIds share machine id '${[...machineSet][0]}' — single-host deployment is fingerprinted from identifiers alone.`);
  } else if (machineSet.size > 1) {
    findings.push(`${machineSet.size} distinct machine ids observed — ObjectIds fingerprint individual backend hosts.`);
  }
  const ordered = parsed.every((p, i, arr) => i === 0 || arr[i - 1].createdAt <= p.createdAt);
  if (parsed.length > 1 && ordered) {
    findings.push('ObjectIds are ordered by creation time — creation sequence is recoverable from the IDs.');
  }

  return { parsed, findings, machineIds: [...machineSet] };
}

// ---------------------------------------------------------------- 1267 ----

const HASHID_DEFAULT_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
const HASHID_DEFAULT_SEPS = 'cfhistuCFHISTU';

/**
 * Attempt to decode obfuscated (Hashids-style) identifiers with common configurations.
 *
 * Hashids is obfuscation, not protection: if an observed ID decodes with a
 * default/empty/common salt, the underlying integer is recoverable by anyone.
 * This is analysis of OBSERVED identifiers — no live probing is performed here.
 * @param {string} encoded — the observed obfuscated identifier.
 * @param {Array<{ salt?: string, alphabet?: string, seps?: string, label?: string }>} configs — candidate configs to try (defaults tried first).
 * @returns {{ decodable: boolean, decoded: number[] | null, usedConfig: string | null, verdict: 'FAIL'|'PASS', findings: string[] }}
 */
export function attemptHashidDecode(encoded, configs = []) {
  const findings = [];

  const tryConfigs = [
    { salt: '', label: 'default (empty salt)' },
    { salt: 'salt', label: "common salt 'salt'" },
    { salt: 'this is my salt', label: "well-known example salt 'this is my salt'" },
    ...configs,
  ];

  for (const cfg of tryConfigs) {
    const decoded = hashidsDecode(encoded, cfg.salt || '', cfg.alphabet || HASHID_DEFAULT_ALPHABET, cfg.seps || HASHID_DEFAULT_SEPS);
    if (decoded) {
      findings.push(`Identifier decoded with ${cfg.label} → [${decoded.join(', ')}] — the ID is obfuscated, not protected; anyone can reverse it.`);
      return { decodable: true, decoded, usedConfig: cfg.label || 'custom', verdict: 'FAIL', findings };
    }
  }

  findings.push('Identifier did not decode with default or common Hashids configurations — obfuscation holds against casual reversal, but treat it as opaque, not as access control.');
  return { decodable: false, decoded: null, usedConfig: null, verdict: 'PASS', findings };
}

function consistentShuffle(alpha, saltChars) {
  if (!saltChars.length) return alpha;
  const a = [...alpha];
  let p = 0;
  for (let i = a.length - 1, v = 0; i > 0; i -= 1, v += 1) {
    v %= saltChars.length;
    p += saltChars[v].codePointAt(0);
    const j = (saltChars[v].codePointAt(0) + v + p) % i;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.join('');
}

/**
 * Build the working Hashids configuration (constructor logic, decode-relevant
 * parts only): dedupe alphabet, drop seps chars from the alphabet, adjust seps
 * length, consistently shuffle both, then split off guards.
 */
function buildHashidsConfig(salt, alphabet, seps) {
  const saltChars = [...salt];
  const unique = [...new Set([...alphabet])];
  const sepsChars = [...seps];
  let alpha = unique.filter((ch) => !sepsChars.includes(ch));
  let sepsW = sepsChars.filter((ch) => unique.includes(ch));

  sepsW = [...consistentShuffle(sepsW.join(''), saltChars)];
  if (sepsW.length === 0 || alpha.length / sepsW.length > 3.5) {
    const target = Math.ceil(alpha.length / 3.5);
    if (target > sepsW.length) {
      const take = target - sepsW.length;
      sepsW.push(...alpha.slice(0, take));
      alpha = alpha.slice(take);
    }
  }

  alpha = [...consistentShuffle(alpha.join(''), saltChars)];
  const guardCount = Math.ceil(alpha.length / 12);
  let guards;
  if (alpha.length < 3) {
    guards = sepsW.slice(0, guardCount);
    sepsW = sepsW.slice(guardCount);
  } else {
    guards = alpha.slice(0, guardCount);
    alpha = alpha.slice(guardCount);
  }
  return { alphabet: alpha.join(''), seps: sepsW.join(''), guards: guards.join(''), salt };
}

function toAlphabetChars(num, alphabet) {
  const out = [];
  do {
    out.unshift(alphabet[num % alphabet.length]);
    num = Math.floor(num / alphabet.length);
  } while (num > 0);
  return out;
}

/**
 * Canonical Hashids encode for the given numbers/config (no minLength padding).
 * Used ONLY as a round-trip verifier: a decode is accepted iff re-encoding the
 * decoded numbers reproduces the input string exactly.
 */
function hashidsEncodeNumbers(numbers, cfg) {
  let alpha = cfg.alphabet;
  const numbersHashInt = numbers.reduce((t, n, i) => t + (n % (i + 100)), 0);
  const lottery = alpha[numbersHashInt % alpha.length];
  let ret = lottery;
  numbers.forEach((n, i) => {
    const buffer = [...lottery, ...cfg.salt, ...alpha].slice(0, alpha.length).join('');
    alpha = consistentShuffle(alpha, [...buffer]);
    const last = toAlphabetChars(n, alpha);
    ret += last.join('');
    if (i + 1 < numbers.length) {
      const sepsIndex = (n % (last[0].codePointAt(0) + i)) % cfg.seps.length;
      ret += cfg.seps[sepsIndex];
    }
  });
  return ret;
}

function hashidsDecode(id, salt, alphabet, seps) {
  // Decode per the public Hashids algorithm (analysis only — never encodes or probes).
  const cfg = buildHashidsConfig(salt, alphabet, seps);

  const allowed = new Set([...cfg.guards, ...cfg.seps, ...cfg.alphabet]);
  if ([...id].some((c) => !allowed.has(c))) return null;

  const parts = id.split(new RegExp(`[${cfg.guards.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&')}]`));
  const idx = parts.length === 3 || parts.length === 2 ? 1 : 0;
  const body = parts[idx];
  if (!body) return null;

  const lottery = [...body][0];
  const rest = body.slice(lottery.length);
  const subHashes = rest.split(new RegExp(`[${cfg.seps.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&')}]`));
  const out = [];
  let curAlpha = cfg.alphabet;
  for (const sub of subHashes) {
    if (!sub) return null;
    const buffer = [...lottery, ...cfg.salt, ...curAlpha].slice(0, curAlpha.length).join('');
    curAlpha = consistentShuffle(curAlpha, [...buffer]);
    let num = 0;
    for (const ch of sub) {
      const pos = curAlpha.indexOf(ch);
      if (pos === -1) return null;
      num = num * curAlpha.length + pos;
    }
    out.push(num);
  }
  if (out.length === 0) return null;

  // Round-trip verification: reject strings that are not genuine encodings
  // (Hashids decode is total over alphabet-valid strings, so this check is what
  // separates real IDs from alphabet-valid lookalikes).
  return hashidsEncodeNumbers(out, cfg) === id ? out : null;
}

// ---------------------------------------------------------------- 1268 ----

function decodeBase64Loose(s) {
  try {
    const normalized = s.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const buf = Buffer.from(padded, 'base64');
    if (buf.length === 0) return null;
    return buf;
  } catch {
    return null;
  }
}

/**
 * Analyze base64-encoded identifiers for structure and integrity protection.
 *
 * Decodes an OBSERVED identifier and checks whether the payload is structured
 * (JSON) and whether it carries any integrity mechanism (signature/MAC field).
 * Encoded ≠ protected: structured data without integrity can be re-encoded.
 * @param {string} encoded — the observed base64/base64url identifier.
 * @returns {{ decodable: boolean, kind: 'json'|'text'|'binary'|'invalid', hasIntegrityField: boolean, verdict: 'PASS'|'WEAK'|'FAIL', findings: string[] }}
 */
export function analyzeBase64IdIntegrity(encoded) {
  const findings = [];

  if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/=_-]+$/.test(encoded)) {
    findings.push('Identifier is not base64-shaped — nothing to decode.');
    return { decodable: false, kind: 'invalid', hasIntegrityField: false, verdict: 'PASS', findings };
  }

  const buf = decodeBase64Loose(encoded);
  if (!buf) {
    findings.push('Identifier looks base64-shaped but does not decode cleanly.');
    return { decodable: false, kind: 'invalid', hasIntegrityField: false, verdict: 'PASS', findings };
  }

  let kind = 'binary';
  let parsed = null;
  try {
    parsed = JSON.parse(buf.toString('utf8'));
    kind = 'json';
  } catch {
    if (/^[\x20-\x7e\s]*$/.test(buf.toString('utf8'))) kind = 'text';
  }

  let hasIntegrityField = false;
  if (kind === 'json' && parsed && typeof parsed === 'object') {
    const keys = Object.keys(parsed).map((k) => k.toLowerCase());
    hasIntegrityField = keys.some((k) => /sig(nature)?|hmac|mac|checksum|digest|token/.test(k));
    findings.push(`Identifier decodes to JSON with keys: ${Object.keys(parsed).join(', ')}.`);
    if (!hasIntegrityField) {
      findings.push('Decoded JSON carries no signature/MAC/checksum field — the structure has no integrity protection and can be re-encoded after modification.');
    } else {
      findings.push('Decoded JSON carries an integrity field — tampering would require defeating that mechanism.');
    }
  } else if (kind === 'text') {
    findings.push(`Identifier decodes to plaintext: '${buf.toString('utf8').slice(0, 80)}' — encoded, not protected.`);
  } else {
    findings.push(`Identifier decodes to ${buf.length} opaque bytes — no structure recoverable; treated as opaque.`);
  }

  const verdict = kind === 'json' && !hasIntegrityField ? 'FAIL'
    : kind === 'text' ? 'WEAK'
    : 'PASS';
  return { decodable: true, kind, hasIntegrityField, verdict, findings };
}

// ---------------------------------------------------------------- 1269 ----

/**
 * Build a state-transition map from observed hypermedia allowed actions.
 *
 * @param {Array<{ state: string, allowedActions: string[], terminal?: boolean }>} observations — per-state observed actions (Link headers, _links, actions arrays).
 * @returns {{ transitions: Record<string, string[]>, findings: string[], skippableSteps: Array<{ from: string, action: string }> }}
 */
export function mapHypermediaTransitions(observations = []) {
  const transitions = {};
  const findings = [];
  const skippableSteps = [];

  for (const o of observations) {
    transitions[o.state] = [...new Set(o.allowedActions || [])];
  }

  const states = Object.keys(transitions);
  // Heuristic: an action named like a late-stage operation available from an
  // early state suggests a skippable step (e.g. 'ship' offered while 'created').
  const lateStageHints = /ship|deliver|complete|finish|publish|activate|approve|fulfil/i;
  const earlyStageHints = /creat|draft|new|pending|init/i;

  for (const [state, actions] of Object.entries(transitions)) {
    if (earlyStageHints.test(state)) {
      for (const action of actions) {
        if (lateStageHints.test(action)) {
          findings.push(`State '${state}' exposes late-stage action '${action}' — the intermediate steps may be skippable.`);
          skippableSteps.push({ from: state, action });
        }
      }
    }
  }

  const terminalStates = observations.filter((o) => o.terminal).map((o) => o.state);
  for (const t of terminalStates) {
    if ((transitions[t] || []).length > 0) {
      findings.push(`Terminal state '${t}' still exposes actions (${transitions[t].join(', ')}) — terminal states should offer none.`);
    }
  }

  if (skippableSteps.length === 0 && findings.length === 0) {
    findings.push(`Transition map built for ${states.length} states (${states.join(' → ') || 'none'}) — no obviously skippable steps observed.`);
  }

  return { transitions, findings, skippableSteps };
}

// ---------------------------------------------------------------- 1270 ----

/**
 * Assess whether state-transition guards are enforced server-side.
 *
 * Observations: attempted state jumps (from authorized test account), how the
 * jump was performed (via documented server API vs UI-only path), and the
 * server's response.
 * @param {Array<{ from: string, to: string, via: 'server-api'|'ui-only'|'direct-call', result: 'allowed'|'rejected' }>} attempts
 * @returns {{ verdict: 'PASS'|'WEAK'|'FAIL', findings: string[], bypasses: number, guardCoverage: number }}
 *   bypasses = illegal jumps the server allowed; guardCoverage = rejected/illegal ratio.
 */
export function assessTransitionGuards(attempts = []) {
  const findings = [];
  let bypasses = 0;
  let illegal = 0;

  for (const a of attempts) {
    const legal = a.via === 'server-api' && a.result === 'allowed';
    if (!legal) illegal += 1;

    if (a.result === 'allowed' && a.via !== 'server-api') {
      findings.push(`Transition ${a.from} → ${a.to} was allowed via ${a.via} — the guard is client-side only or absent.`);
      bypasses += 1;
    } else if (a.result === 'rejected') {
      findings.push(`Transition ${a.from} → ${a.to} via ${a.via} was rejected server-side — guard holds.`);
    } else {
      findings.push(`Transition ${a.from} → ${a.to} via the documented API was allowed — expected behavior, guard permits it.`);
    }
  }

  const guardCoverage = illegal > 0 ? (illegal - bypasses) / illegal : 1;
  const verdict = bypasses > 0 ? 'FAIL' : guardCoverage < 1 ? 'WEAK' : 'PASS';

  if (attempts.length === 0) {
    findings.push('No transition attempts observed — guard posture cannot be assessed.');
  } else if (bypasses === 0) {
    findings.push(`All ${illegal} out-of-band transition attempts were rejected — transition guards are enforced server-side.`);
  }

  return { verdict, findings, bypasses, guardCoverage };
}
