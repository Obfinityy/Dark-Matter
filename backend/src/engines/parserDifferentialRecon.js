/**
 * parserDifferentialRecon.js — parser-differential and serializer recon probe
 * builder and response analyzer.
 *
 * Idea 01101: Duplicate JSON key handling test — send {"a":1,"a":2} since
 * first-wins vs last-wins parsing creates parameter smuggling opportunities.
 *
 * Idea 01102: JSON vs form-encoded differential — submit the same data as
 * JSON and form bodies because dual parsers often validate differently.
 *
 * Idea 01103: Multipart boundary quirk test — mutate boundaries and part
 * headers since multipart parsers have historically lenient edge cases.
 *
 * Idea 01104: Protobuf content-type probe — send application/x-protobuf to
 * JSON endpoints because some stacks silently accept binary protobuf.
 *
 * Idea 01105: MessagePack support detection — try application/msgpack bodies
 * since alternate serializers widen the parser attack surface.
 *
 * Idea 01106: YAML body support detection — send application/yaml payloads
 * because YAML parsers enable deserialization paths JSON lacks.
 *
 * Idea 01107: XML body on JSON endpoints — post application/xml to REST
 * routes since content-type confusion can route data into XML parsers.
 *
 * Idea 01108: GraphQL multipart upload support — test
 * graphql-multipart-request-spec uploads because file-upload mutations
 * bypass REST upload controls.
 *
 * Idea 01109: OPTIONS method enumeration — send OPTIONS to every discovered
 * route and parse Allow headers since Allow lists the exact methods each
 * endpoint supports.
 *
 * Idea 01110: Allow-header gap analysis — diff Allow headers across sibling
 * routes because inconsistent method lists reveal forgotten endpoints.
 *
 * No network calls: every function is pure and operates on operator-supplied
 * strings/objects (request data, response descriptors). The agent's network
 * layer performs the actual transport; this module constructs benign
 * diagnostic probe descriptors (sentinel values, legal-but-unusual
 * boundaries, trivial marker payloads — never weaponized code) and analyzes
 * the returned responses for parser-behavior divergence.
 * Defensive surface mapping of the engagement's own authorized target only.
 */

/**
 * A benign sentinel marker so probes are identifiable in logs and carry no
 * payload semantics beyond "did the server accept this parser path?".
 */
export const PARSER_PROBE_SENTINEL = 'infinity-ai-parser-probe';

/**
 * Shape of a probe descriptor built by this module.
 * @typedef {object} ProbeDescriptor
 * @property {string} method
 * @property {string} path
 * @property {string} contentType
 * @property {string} body
 * @property {string} idea
 * @property {string} expectedSignal - What to look for in the response.
 */

/**
 * Shape of an operator-supplied response descriptor.
 * @typedef {object} ResponseDescriptor
 * @property {number} status
 * @property {string} [body]
 * @property {Record<string, string>} [headers]
 */

function describeProbe({ method, path, contentType, body, idea, expectedSignal }) {
  return { method, path: String(path || '/'), contentType, body: String(body), idea, expectedSignal };
}

/**
 * Idea 01101 — build a duplicate-JSON-key probe descriptor using benign
 * sentinel values. If the server honors the first occurrence vs. the last,
 * the echoed/handled value reveals the parser's winner rule — the raw
 * material for parameter-smuggling analysis.
 * @param {string} [key='probe_key']
 * @param {string} [firstValue='first_sentinel']
 * @param {string} [secondValue='second_sentinel']
 * @param {string} [path='/']
 * @returns {ProbeDescriptor}
 */
export function buildDuplicateKeyProbe(key = 'probe_key', firstValue = 'first_sentinel', secondValue = 'second_sentinel', path = '/') {
  const body = `{"${key}":"${firstValue}","${key}":"${secondValue}"}`;
  return describeProbe({
    method: 'POST',
    path,
    contentType: 'application/json',
    body,
    idea: '01101',
    expectedSignal: 'Inspect the response (or reflected behavior) to see which sentinel value the server acted on: first-wins vs last-wins.',
  });
}

/**
 * Idea 01101 — infer the server's duplicate-key winner rule from an
 * operator-supplied response body that echoes the parsed parameter value.
 * @param {string} responseBody - Operator-supplied response text.
 * @param {string} [firstValue='first_sentinel']
 * @param {string} [secondValue='second_sentinel']
 * @returns {{verdict: 'first-wins'|'last-wins'|'inconclusive', evidence: string}}
 */
export function classifyDuplicateKeyBehavior(responseBody = '', firstValue = 'first_sentinel', secondValue = 'second_sentinel') {
  const text = String(responseBody || '');
  const hasFirst = text.includes(String(firstValue));
  const hasSecond = text.includes(String(secondValue));
  if (hasFirst && !hasSecond) {
    return { verdict: 'first-wins', evidence: `Response echoes "${firstValue}" (first occurrence) and not "${secondValue}": parser uses first-wins.` };
  }
  if (hasSecond && !hasFirst) {
    return { verdict: 'last-wins', evidence: `Response echoes "${secondValue}" (second occurrence) and not "${firstValue}": parser uses last-wins.` };
  }
  return {
    verdict: 'inconclusive',
    evidence: 'Response does not uniquely echo either sentinel value; the winner rule cannot be determined from this response alone.',
  };
}

/**
 * Idea 01102 — build a paired probe: the same data submitted once as JSON
 * and once as application/x-www-form-urlencoded. Dual parsers frequently
 * validate the two shapes differently.
 * @param {Record<string, string>} [data] - Benign key/value data to mirror.
 * @param {string} [path='/']
 * @returns {{jsonProbe: ProbeDescriptor, formProbe: ProbeDescriptor}}
 */
export function buildContentTypeDifferentialProbes(data = { probe: PARSER_PROBE_SENTINEL }, path = '/') {
  const entries = Object.entries(data || {});
  const jsonProbe = describeProbe({
    method: 'POST',
    path,
    contentType: 'application/json',
    body: JSON.stringify(data),
    idea: '01102',
    expectedSignal: 'Compare status, validation messages, and behavior against the form-encoded twin.',
  });
  const formBody = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
  const formProbe = describeProbe({
    method: 'POST',
    path,
    contentType: 'application/x-www-form-urlencoded',
    body: formBody,
    idea: '01102',
    expectedSignal: 'Compare status, validation messages, and behavior against the JSON twin.',
  });
  return { jsonProbe, formProbe };
}

/**
 * Idea 01102 — classify a JSON-vs-form response pair into a parser
 * differential: matching vs divergent handling.
 * @param {ResponseDescriptor} jsonResponse
 * @param {ResponseDescriptor} formResponse
 * @returns {{divergent: boolean, statusDelta: boolean, bodyDelta: boolean, summary: string, findings: object[]}}
 */
export function classifyContentTypeDifferential(jsonResponse = {}, formResponse = {}) {
  const a = normalizeResponse(jsonResponse);
  const b = normalizeResponse(formResponse);
  const statusDelta = a.status !== b.status;
  const bodyDelta = a.body !== b.body;
  const divergent = statusDelta || bodyDelta;
  const findings = [];
  if (statusDelta) {
    findings.push({
      type: 'content-type-status-divergence',
      confidence: 'high',
      evidence: `JSON body -> ${a.status}; form body -> ${b.status} for identical data. One parser path validates differently.`,
    });
  }
  if (bodyDelta && !statusDelta) {
    findings.push({
      type: 'content-type-body-divergence',
      confidence: 'medium',
      evidence: 'Same status but different response bodies for JSON vs form encoding: the parsers normalize or reject the data differently.',
    });
  }
  const summary = divergent
    ? `Parser differential detected (statusDelta=${statusDelta}, bodyDelta=${bodyDelta}).`
    : 'No parser differential: JSON and form bodies were handled identically.';
  return { divergent, statusDelta, bodyDelta, summary, findings };
}

/**
 * Normalize an operator-supplied response descriptor.
 * @param {ResponseDescriptor} response
 * @returns {{status: number, body: string, headers: Record<string, string>}}
 */
function normalizeResponse(response = {}) {
  return {
    status: Number(response.status) || 0,
    body: String(response.body ?? ''),
    headers: { ...(response.headers || {}) },
  };
}

/**
 * Idea 01103 — build multipart probe descriptors with legal-but-unusual
 * boundary mutations and part-header variations (case mutation, stray
 * whitespace, duplicate part names). All bodies are benign text parts.
 * @param {string} [path='/']
 * @returns {ProbeDescriptor[]}
 */
export function buildMultipartBoundaryMutations(path = '/') {
  const fieldValue = PARSER_PROBE_SENTINEL;
  const part = (boundary, headers) =>
    `--${boundary}\r\n${headers}\r\n\r\n${fieldValue}\r\n--${boundary}--\r\n`;
  const mutations = [
    {
      label: 'overlong-boundary',
      boundary: 'infinity-ai-boundary-0123456789-abcdef',
      headers: 'Content-Disposition: form-data; name="probe"',
      expectedSignal: 'Overlong (nonstandard) boundary: does the parser still delimit parts?',
    },
    {
      label: 'boundary-with-special-chars',
      boundary: "inf'boundary\"probe",
      headers: 'Content-Disposition: form-data; name="probe"',
      expectedSignal: 'Quoted special characters in boundary: strict vs lenient matching.',
    },
    {
      label: 'boundary-trailing-whitespace',
      boundary: 'infinityaiprobe ',
      headers: 'Content-Disposition: form-data; name="probe"',
      expectedSignal: 'Trailing whitespace inside the header boundary parameter: trimmed or rejected?',
    },
    {
      label: 'uppercase-part-headers',
      boundary: 'infinityaiprobe',
      headers: 'CONTENT-DISPOSITION: FORM-DATA; NAME="probe"',
      expectedSignal: 'Uppercase part headers: case-insensitive per RFC 7578, but many parsers are not.',
    },
    {
      label: 'duplicate-part-name',
      boundary: 'infinityaiprobe',
      headers: 'Content-Disposition: form-data; name="probe"',
      expectedSignal: 'Two parts with the same name: first-wins, last-wins, or array merge.',
      double: true,
    },
  ];
  return mutations.map(m => {
    const body = m.double ? part(m.boundary, m.headers) + part(m.boundary, m.headers) : part(m.boundary, m.headers);
    return describeProbe({
      method: 'POST',
      path,
      contentType: `multipart/form-data; boundary=${m.boundary}`,
      body,
      idea: '01103',
      expectedSignal: `[${m.label}] ${m.expectedSignal}`,
    });
  });
}

/**
 * Idea 01103 — interpret an operator-supplied response to a multipart
 * mutation probe: did the server accept, partially parse, or reject the
 * unusual boundary/part headers?
 * @param {ResponseDescriptor} response
 * @param {string} [mutationLabel='']
 * @returns {{outcome: 'accepted'|'rejected'|'parsed-partially'|'inconclusive', evidence: string}}
 */
export function analyzeMultipartMutationResponse(response = {}, mutationLabel = '') {
  const { status, body } = normalizeResponse(response);
  const prefix = mutationLabel ? `[${mutationLabel}] ` : '';
  if (status >= 200 && status < 300) {
    if (body.includes(PARSER_PROBE_SENTINEL)) {
      return { outcome: 'accepted', evidence: `${prefix}2xx and the sentinel part value was processed: parser tolerated the mutation.` };
    }
    return { outcome: 'parsed-partially', evidence: `${prefix}2xx but the sentinel part value was not echoed/processed: parts may have been dropped silently.` };
  }
  if (status === 400 || status === 415 || status === 422) {
    return { outcome: 'rejected', evidence: `${prefix}HTTP ${status}: parser rejected the mutated boundary/part headers.` };
  }
  if (status === 0) {
    return { outcome: 'inconclusive', evidence: `${prefix}No usable response supplied.` };
  }
  return { outcome: 'inconclusive', evidence: `${prefix}HTTP ${status}: ambiguous outcome, needs manual review.` };
}

/**
 * Idea 01104 — build an application/x-protobuf probe descriptor carrying a
 * trivial textual marker body (not real binary protobuf): the question is
 * whether a JSON endpoint's stack silently routes the request into a
 * protobuf parser at all.
 * @param {string} [path='/']
 * @returns {ProbeDescriptor}
 */
export function buildProtobufProbe(path = '/') {
  return describeProbe({
    method: 'POST',
    path,
    contentType: 'application/x-protobuf',
    body: `${PARSER_PROBE_SENTINEL}:marker-only`,
    idea: '01104',
    expectedSignal: 'Accepted/processed (not 415/406) means the stack routes x-protobuf content somewhere — check which parser handled it.',
  });
}

/**
 * Idea 01105 — build an application/msgpack probe descriptor with a trivial
 * marker body. Alternate serializers widen the parser attack surface.
 * @param {string} [path='/']
 * @returns {ProbeDescriptor}
 */
export function buildMessagePackProbe(path = '/') {
  return describeProbe({
    method: 'POST',
    path,
    contentType: 'application/msgpack',
    body: `{"probe":"${PARSER_PROBE_SENTINEL}"}`,
    idea: '01105',
    expectedSignal: 'Accepted/processed (not 415/406) means a MessagePack parser is reachable on this route.',
  });
}

/**
 * Idea 01106 — build an application/yaml probe descriptor with a minimal
 * benign YAML mapping. YAML parsers add deserialization paths JSON lacks.
 * @param {string} [path='/']
 * @returns {ProbeDescriptor}
 */
export function buildYamlProbe(path = '/') {
  return describeProbe({
    method: 'POST',
    path,
    contentType: 'application/yaml',
    body: `probe: ${PARSER_PROBE_SENTINEL}\n`,
    idea: '01106',
    expectedSignal: 'Accepted/processed (not 415/406) means a YAML parser is reachable; flag for deserialization-path review.',
  });
}

/**
 * Idea 01107 — build an application/xml probe descriptor with a minimal
 * benign XML document, aimed at a JSON REST route to detect content-type
 * confusion routing data into an XML parser.
 * @param {string} [path='/']
 * @returns {ProbeDescriptor}
 */
export function buildXmlProbe(path = '/') {
  return describeProbe({
    method: 'POST',
    path,
    contentType: 'application/xml',
    body: `<probe>${PARSER_PROBE_SENTINEL}</probe>`,
    idea: '01107',
    expectedSignal: 'Accepted/processed as XML on a JSON route means content-type confusion: check which parser consumed the body.',
  });
}

/**
 * Idea 01104-01107 — classify an operator-supplied response to a serializer
 * probe: did the server silently accept, explicitly reject, or behave
 * ambiguously?
 * @param {ResponseDescriptor} response
 * @param {string} contentType - The serializer content-type that was probed.
 * @returns {{outcome: 'silently-accepted'|'rejected'|'ambiguous', evidence: string}}
 */
export function classifySerializerAcceptance(response = {}, contentType = '') {
  const { status, body } = normalizeResponse(response);
  const label = contentType || 'unknown';
  if (status >= 200 && status < 300) {
    return {
      outcome: 'silently-accepted',
      evidence: `HTTP ${status} for Content-Type ${label} on a JSON route: the stack accepted an alternate serializer — parser attack surface confirmed.`,
    };
  }
  if (status === 415 || status === 406) {
    return {
      outcome: 'rejected',
      evidence: `HTTP ${status} for Content-Type ${label}: the server explicitly refuses this serializer — parser surface is closed.`,
    };
  }
  if (status === 400 || status === 422) {
    return {
      outcome: 'ambiguous',
      evidence: `HTTP ${status} for Content-Type ${label}: rejected by validation, not by media type — a parser may still have consumed the body. Retest with stricter markers.`,
    };
  }
  return { outcome: 'ambiguous', evidence: `HTTP ${status || 'unknown'} for Content-Type ${label}: ambiguous, needs manual review.` };
}

/**
 * Idea 01108 — build a graphql-multipart-request-spec upload probe
 * descriptor: an operations/map JSON pair plus one benign text file part,
 * targeting a GraphQL endpoint's file-upload mutation. Upload mutations can
 * bypass REST-side upload controls.
 * @param {string} [path='/graphql']
 * @param {string} [mutationName='uploadFile']
 * @returns {ProbeDescriptor}
 */
export function buildGraphqlMultipartProbe(path = '/graphql', mutationName = 'uploadFile') {
  const boundary = 'infinityai-graphql-upload';
  const operations = JSON.stringify({
    query: `mutation ($file: Upload!) { ${mutationName}(file: $file) { ok } }`,
    variables: { file: null },
  });
  const map = JSON.stringify({ 0: ['variables.file'] });
  const fileBody = `${PARSER_PROBE_SENTINEL}: benign upload marker\n`;
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="operations"\r\n\r\n${operations}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="map"\r\n\r\n${map}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="0"; filename="probe.txt"\r\n` +
    `Content-Type: text/plain\r\n\r\n${fileBody}\r\n` +
    `--${boundary}--\r\n`;
  return describeProbe({
    method: 'POST',
    path,
    contentType: `multipart/form-data; boundary=${boundary}`,
    body,
    idea: '01108',
    expectedSignal: 'A processed upload (not a spec error) means graphql-multipart uploads are live: compare the upload controls against REST upload routes.',
  });
}

/**
 * Idea 01108 — interpret an operator-supplied response to the
 * graphql-multipart upload probe.
 * @param {ResponseDescriptor} response
 * @returns {{outcome: 'upload-processed'|'spec-rejected'|'ambiguous', evidence: string}}
 */
export function analyzeGraphqlMultipartResponse(response = {}) {
  const { status, body } = normalizeResponse(response);
  if (status >= 200 && status < 300) {
    if (/upload/i.test(body) && !/error/i.test(body)) {
      return { outcome: 'upload-processed', evidence: '2xx response mentions the upload without errors: graphql-multipart upload is processed.' };
    }
    return { outcome: 'ambiguous', evidence: '2xx but the response is inconclusive about whether the upload was processed; check the response data field.' };
  }
  if (status === 400 || status === 415) {
    return { outcome: 'spec-rejected', evidence: `HTTP ${status}: the endpoint rejected the multipart upload (spec unsupported or validation failed).` };
  }
  return { outcome: 'ambiguous', evidence: `HTTP ${status || 'unknown'}: ambiguous, needs manual review.` };
}

/**
 * Idea 01109 — build an OPTIONS probe descriptor for one discovered route.
 * @param {string} route - Discovered route path.
 * @returns {ProbeDescriptor}
 */
export function buildOptionsProbe(route = '/') {
  return describeProbe({
    method: 'OPTIONS',
    path: route,
    contentType: 'text/plain',
    body: '',
    idea: '01109',
    expectedSignal: 'Parse the Allow response header into the exact method set this endpoint supports.',
  });
}

/**
 * Idea 01109 — parse an Allow header value into a normalized method set.
 * @param {string} [allowValue='']
 * @returns {{methods: string[], raw: string}}
 */
export function parseAllowHeader(allowValue = '') {
  const raw = String(allowValue || '');
  const methods = [...new Set(
    raw
      .split(',')
      .map(m => m.trim().toUpperCase())
      .filter(Boolean),
  )].sort();
  return { methods, raw };
}

/**
 * Idea 01110 — diff Allow-header method sets across sibling routes. Methods
 * present on some routes but missing from others are forgotten-method
 * candidates; routes whose Allow set is a strict subset of the union may be
 * forgotten endpoints.
 * @param {Record<string, string>} routeAllows - Map of route path -> raw Allow header value.
 * @returns {{perRoute: Record<string, string[]>, union: string[], gaps: object[], findings: object[]}}
 */
export function diffAllowHeadersAcrossRoutes(routeAllows = {}) {
  const perRoute = {};
  for (const [route, raw] of Object.entries(routeAllows || {})) {
    perRoute[route] = parseAllowHeader(raw).methods;
  }
  const union = [...new Set(Object.values(perRoute).flat())].sort();
  const gaps = [];
  for (const [route, methods] of Object.entries(perRoute)) {
    const missing = union.filter(m => !methods.includes(m));
    if (missing.length) {
      gaps.push({ route, methods, missing, type: missing.length === union.length && union.length > 0 ? 'no-allow-header' : 'method-gap' });
    }
  }
  const findings = gaps.map(g => ({
    type: g.type === 'no-allow-header' ? 'allow-header-gap-missing-header' : 'allow-header-gap-method',
    confidence: 'medium',
    evidence:
      g.type === 'no-allow-header'
        ? `Route "${g.route}" returned no Allow header while sibling routes advertise ${union.join(', ')} — its supported methods are undeclared (possible forgotten endpoint).`
        : `Route "${g.route}" supports [${g.methods.join(', ') || 'none'}] but siblings also advertise [${g.missing.join(', ')}] — inconsistent method lists reveal a possibly forgotten method/endpoint.`,
  }));
  return { perRoute, union, gaps, findings };
}

/**
 * Build a uniform report finding from a parser-differential recon result.
 * @param {{title?: string, kind?: string, evidence?: string, targets?: string[], confidence?: string}} result
 * @returns {{title: string, severity: string, confidence: string, kind: string, evidence: string, targets: string[], recommendation: string}}
 */
export function parserDifferentialReconFinding(result = {}) {
  const { title = 'Parser differential recon finding', kind = 'recon', evidence = '', targets = [], confidence = 'medium' } = result;
  return {
    title: `Parser differential recon — ${title}`,
    severity: 'Info',
    confidence,
    kind,
    evidence,
    targets: Array.isArray(targets) ? targets : [],
    recommendation:
      'Review the flagged parser differentials on the authorized target: enforce one canonical parser per content type with explicit duplicate-key and content-type policies, ' +
      'strictly validate multipart boundaries and part headers, refuse unsupported serializers with 415, keep GraphQL upload controls at parity with REST uploads, ' +
      'and publish consistent Allow headers so every route advertises its real method set.',
  };
}

/**
 * Named-const registry for deterministic access, mirroring house style.
 */
export const PARSER_DIFFERENTIAL_RECON = {
  PARSER_PROBE_SENTINEL,
  buildDuplicateKeyProbe,
  classifyDuplicateKeyBehavior,
  buildContentTypeDifferentialProbes,
  classifyContentTypeDifferential,
  buildMultipartBoundaryMutations,
  analyzeMultipartMutationResponse,
  buildProtobufProbe,
  buildMessagePackProbe,
  buildYamlProbe,
  buildXmlProbe,
  classifySerializerAcceptance,
  buildGraphqlMultipartProbe,
  analyzeGraphqlMultipartResponse,
  buildOptionsProbe,
  parseAllowHeader,
  diffAllowHeadersAcrossRoutes,
  parserDifferentialReconFinding,
};

export default PARSER_DIFFERENTIAL_RECON;
