/**
 * queryOperatorRecon.js — Search, filter, sort, fieldset, and include-expansion surface reconnaissance.
 *
 * Implements idea-bank items 01226–01230 for the autonomous bug-bounty agent:
 *   01226 Search-operator discovery
 *   01227 Filter-operator surface mapping
 *   01228 Sort-field enumeration
 *   01229 Sparse-fieldset support test
 *   01230 Include-expansion depth test
 *
 * During an authorized engagement the caller sends the benign probe parameter
 * sets described by the build* functions below and records the responses.
 * This module performs PURE analysis of recorded request/response data: it
 * detects which query parameters, operators, sort fields, fieldset selectors,
 * and relation-expansion directives the target honors. It sends no network
 * traffic itself, uses only benign sentinel values, and contains no exploit
 * payloads.
 */

/**
 * Normalize a header map to lower-cased keys.
 * @param {object} headers Header map (any case).
 * @returns {Record<string,string>}
 */
function normalizeHeaders(headers) {
  const out = {};
  if (!headers || typeof headers !== 'object') return out;
  for (const [k, v] of Object.entries(headers)) {
    const key = String(k).toLowerCase();
    if (Array.isArray(v)) out[key] = v.join(', ');
    else if (v != null) out[key] = String(v);
  }
  return out;
}

/**
 * Compute a coarse behavioral signature of a response for differential comparison.
 * @param {{status?:number, headers?:object, body?:string}} response Recorded response.
 * @returns {{status:number|null, length:number, jsonShape:string, keys:string[], count:number|null}}
 */
export function responseSignature(response) {
  const res = response && typeof response === 'object' ? response : {};
  const body = typeof res.body === 'string' ? res.body : '';
  let keys = [];
  let jsonShape = 'non-json';
  let count = null;
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) {
      jsonShape = `array[${parsed.length}]`;
      count = parsed.length;
      if (parsed.length > 0 && parsed[0] && typeof parsed[0] === 'object')
        keys = Object.keys(parsed[0]);
    } else if (parsed && typeof parsed === 'object') {
      jsonShape = 'object';
      keys = Object.keys(parsed);
      if (Array.isArray(parsed.data)) {
        count = parsed.data.length;
        if (parsed.data.length > 0 && typeof parsed.data[0] === 'object')
          keys = Object.keys(parsed.data[0]);
      }
    } else {
      jsonShape = typeof parsed;
    }
  } catch {
    jsonShape = /<[a-z][\s>]/i.test(body) ? 'html' : 'text';
  }
  return {
    status: typeof res.status === 'number' ? res.status : null,
    length: body.length,
    jsonShape,
    keys,
    count,
  };
}

/**
 * Compare two response signatures and decide whether a probe changed behavior.
 * @param {object} baseline Signature of the baseline response.
 * @param {object} probe Signature of the probe response.
 * @returns {{changed:boolean, differences:string[]}}
 */
export function signaturesDiffer(baseline, probe) {
  const differences = [];
  if (baseline.status !== probe.status)
    differences.push(`status ${baseline.status} -> ${probe.status}`);
  if (baseline.jsonShape !== probe.jsonShape)
    differences.push(`shape ${baseline.jsonShape} -> ${probe.jsonShape}`);
  if (
    baseline.count !== null &&
    probe.count !== null &&
    baseline.count !== probe.count
  )
    differences.push(`result count ${baseline.count} -> ${probe.count}`);
  if (Math.abs(baseline.length - probe.length) > Math.max(32, baseline.length * 0.05))
    differences.push(`length ${baseline.length} -> ${probe.length}`);
  const baseKeys = new Set(baseline.keys);
  const probeKeys = new Set(probe.keys);
  const added = [...probeKeys].filter((k) => !baseKeys.has(k));
  const removed = [...baseKeys].filter((k) => !probeKeys.has(k));
  if (added.length > 0) differences.push(`keys added: ${added.join(',')}`);
  if (removed.length > 0) differences.push(`keys removed: ${removed.join(',')}`);
  return { changed: differences.length > 0, differences };
}

/**
 * Build the search-operator discovery probe matrix for idea 01226.
 * Uses benign sentinel search terms only.
 * @returns {{baseline:object, probes:{param:string, value:string}[]}[]}
 */
export function buildSearchOperatorProbe() {
  const sentinels = ['infinity', 'zzq-nonexistent-term', 'test'];
  const params = ['q', 'query', 'search', 'keyword', 'term', 'filter', 'name', 'title'];
  const probes = [];
  for (const param of params) {
    for (const value of sentinels) probes.push({ param, value });
  }
  return {
    baseline: {},
    probes,
    note: 'Send each probe alone against the listing endpoint; record the response. ' +
      'A probe that changes results versus baseline reveals a live search parameter.',
  };
}

/**
 * Analyze recorded search-operator probes (idea 01226).
 * @param {{baseline:{status?:number, headers?:object, body?:string}, probes:{param:string, value:string, response:{status?:number, headers?:object, body?:string}}[]}} input Baseline plus per-probe responses.
 * @returns {{discovered:{param:string, values:string[], evidence:string}[], findings:string[], verdict:'operators-found'|'none'}}
 */
export function analyzeSearchOperators(input) {
  const baseline = responseSignature(input && input.baseline);
  const probes = Array.isArray(input && input.probes) ? input.probes : [];
  const discovered = [];
  const findings = [];
  const byParam = new Map();

  for (const p of probes) {
    const sig = responseSignature(p.response);
    const diff = signaturesDiffer(baseline, sig);
    if (diff.changed) {
      if (!byParam.has(p.param))
        byParam.set(p.param, { param: p.param, values: [], evidence: '' });
      const entry = byParam.get(p.param);
      entry.values.push(p.value);
      entry.evidence = diff.differences.join('; ');
    }
  }

  for (const entry of byParam.values()) {
    entry.values = [...new Set(entry.values)];
    discovered.push(entry);
    findings.push(
      `Live search parameter discovered: "${entry.param}" — behavior changes: ${entry.evidence}`
    );
  }
  if (discovered.length === 0)
    findings.push('No search parameters altered responses — search surface not detected on this endpoint');

  return {
    discovered,
    findings,
    verdict: discovered.length > 0 ? 'operators-found' : 'none',
  };
}

/**
 * Build the filter-operator surface probe for idea 01227.
 * Bracket-style operators with benign sentinel values only.
 * @param {string} field A benign field name to attach operators to (e.g. "name").
 * @returns {{field:string, probes:{param:string, value:string}[]}}
 */
export function buildFilterOperatorProbe(field) {
  const f = String(field || 'name');
  const operators = [
    { op: '[gt]', value: 'a' },
    { op: '[gte]', value: 'a' },
    { op: '[lt]', value: 'zzz' },
    { op: '[lte]', value: 'zzz' },
    { op: '[eq]', value: 'infinity' },
    { op: '[ne]', value: 'infinity' },
    { op: '[in]', value: 'infinity,zzz' },
    { op: '[nin]', value: 'infinity,zzz' },
    { op: '[like]', value: 'inf%' },
    { op: '[ilike]', value: 'inf%' },
    { op: '[regex]', value: '^inf' },
    { op: '[iregex]', value: '^inf' },
    { op: '[exists]', value: 'true' },
    { op: '[contains]', value: 'infinity' },
    { op: '[startswith]', value: 'inf' },
    { op: '[endswith]', value: 'ity' },
  ];
  return {
    field: f,
    probes: operators.map((o) => ({ param: `${f}${o.op}`, value: o.value })),
    note:
      'Send each operator probe alone against the listing endpoint. Operators that ' +
      'change behavior map the filter surface; [regex]-style support is a ' +
      'NoSQL-injection-adjacent risk signal for the report.',
  };
}

/**
 * Analyze recorded filter-operator probes (idea 01227).
 * @param {{baseline:{status?:number, headers?:object, body?:string}, probes:{param:string, value:string, response:{status?:number, headers?:object, body?:string}}[]}} input Baseline plus per-probe responses.
 * @returns {{supported:{param:string, evidence:string}[], riskSignals:string[], findings:string[], verdict:'operators-supported'|'none'}}
 */
export function analyzeFilterOperators(input) {
  const baseline = responseSignature(input && input.baseline);
  const probes = Array.isArray(input && input.probes) ? input.probes : [];
  const supported = [];
  const findings = [];
  const riskSignals = [];

  for (const p of probes) {
    const sig = responseSignature(p.response);
    const diff = signaturesDiffer(baseline, sig);
    if (diff.changed) {
      supported.push({ param: p.param, evidence: diff.differences.join('; ') });
      findings.push(`Filter operator honored: "${p.param}" — ${diff.differences.join('; ')}`);
    }
  }

  const risky = supported.filter((s) => /regex|like|exists|\[in\]|\[ne\]/i.test(s.param));
  for (const r of risky) riskSignals.push(r.param);
  if (risky.length > 0)
    findings.push(
      `NoSQL-injection-adjacent risk signal: operators ${risky
        .map((r) => r.param)
        .join(', ')} are live — flag for deeper authorized review`
    );
  if (supported.length === 0)
    findings.push('No bracket filter operators altered responses');

  return {
    supported,
    riskSignals,
    findings,
    verdict: supported.length > 0 ? 'operators-supported' : 'none',
  };
}

/**
 * Build the sort-field enumeration probe for idea 01228.
 * @param {string[]} candidateFields Benign candidate field names.
 * @returns {{probes:{param:string, value:string}[]}}
 */
export function buildSortFieldProbe(candidateFields) {
  const defaults = ['id', 'name', 'title', 'created_at', 'createdAt', 'updated_at', 'email', 'price', 'rating', 'date'];
  const fields = Array.isArray(candidateFields) && candidateFields.length > 0 ? candidateFields : defaults;
  const probes = [];
  for (const f of fields) {
    probes.push({ param: 'sort', value: String(f) });
    probes.push({ param: 'sort', value: `-${f}` });
  }
  return {
    probes,
    note:
      'Send sort probes one at a time. A field that reorders or changes results ' +
      'versus baseline confirms a real database column name.',
  };
}

/**
 * Analyze recorded sort-field probes (idea 01228).
 * Confirmed sortable fields map to real database column names.
 * @param {{baseline:{status?:number, headers?:object, body?:string}, probes:{param:string, value:string, response:{status?:number, headers?:object, body?:string}}[]}} input Baseline plus per-probe responses.
 * @returns {{sortable:string[], findings:string[], verdict:'columns-confirmed'|'none'}}
 */
export function analyzeSortFields(input) {
  const baseline = responseSignature(input && input.baseline);
  const probes = Array.isArray(input && input.probes) ? input.probes : [];
  const sortable = [];
  const findings = [];

  for (const p of probes) {
    const sig = responseSignature(p.response);
    const diff = signaturesDiffer(baseline, sig);
    const field = p.value.replace(/^[+-]/, '');
    if (diff.changed && !sortable.includes(field)) {
      sortable.push(field);
      findings.push(`Sortable field confirmed: "${field}" — ${diff.differences.join('; ')}`);
    }
  }
  if (sortable.length > 0)
    findings.push(
      `Confirmed ${sortable.length} sortable field(s), mapping to database columns: ${sortable.join(', ')}`
    );
  else findings.push('No candidate sort field altered responses');

  return {
    sortable,
    findings,
    verdict: sortable.length > 0 ? 'columns-confirmed' : 'none',
  };
}

/**
 * Build the sparse-fieldset probe for idea 01229.
 * @param {string[]} fields Benign field names to request.
 * @returns {{probes:{params:object}[]}}
 */
export function buildSparseFieldsetProbe(fields) {
  const list = Array.isArray(fields) && fields.length > 0 ? fields : ['id', 'name'];
  return {
    probes: [
      { params: { fields: list.join(',') } },
      { params: { 'fields[]': list } },
      { params: { fields: `[${list.join(',')}]` } },
      { params: { select: list.join(',') } },
      { params: { only: list.join(',') } },
    ],
    note:
      'Request a subset of fields. A response that narrows to the requested ' +
      'fields confirms sparse-fieldset support — useful for targeted data ' +
      'harvesting, so report it as an information-disclosure aid.',
  };
}

/**
 * Analyze recorded sparse-fieldset probes (idea 01229).
 * @param {{baseline:{status?:number, headers?:object, body?:string}, requestedFields:string[], probes:{params:object, response:{status?:number, headers?:object, body?:string}}[]}} input Baseline, requested fields, and per-probe responses.
 * @returns {{supportedSyntax:string[], harvestable:boolean, findings:string[], verdict:'fieldsets-supported'|'none'}}
 */
export function analyzeSparseFieldsets(input) {
  const baseline = responseSignature(input && input.baseline);
  const requested = Array.isArray(input && input.requestedFields) ? input.requestedFields : [];
  const probes = Array.isArray(input && input.probes) ? input.probes : [];
  const supportedSyntax = [];
  const findings = [];
  let harvestable = false;

  for (const p of probes) {
    const sig = responseSignature(p.response);
    const paramLabel = Object.entries(p.params || {})
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`)
      .join('&');
    const narrowed =
      requested.length > 0 &&
      sig.keys.length > 0 &&
      requested.every((f) => sig.keys.includes(f)) &&
      sig.keys.length < baseline.keys.length;
    if (narrowed) {
      supportedSyntax.push(paramLabel);
      harvestable = true;
      findings.push(
        `Sparse fieldset honored via "${paramLabel}" — response narrowed to: ${sig.keys.join(', ')}`
      );
    }
  }

  if (harvestable)
    findings.push(
      'Sparse-fieldset support confirmed: an attacker can request only sensitive fields, ' +
        'aiding targeted data harvesting — note in the report'
    );
  else findings.push('No fieldset selector narrowed the response');

  return {
    supportedSyntax,
    harvestable,
    findings,
    verdict: supportedSyntax.length > 0 ? 'fieldsets-supported' : 'none',
  };
}

/**
 * Build the include-expansion depth probe for idea 01230.
 * @param {string[]} relations Benign relation names in nesting order.
 * @param {number} maxDepth Maximum expansion depth to test (default 5).
 * @returns {{probes:{depth:number, value:string}[]}}
 */
export function buildIncludeExpansionProbe(relations, maxDepth) {
  const rels = Array.isArray(relations) && relations.length > 0 ? relations : ['author', 'comments', 'profile'];
  const depth = Math.max(1, Math.min(Number(maxDepth) || 5, 10));
  const probes = [];
  for (let d = 1; d <= depth; d++) {
    const chain = [];
    for (let i = 0; i < d; i++) chain.push(rels[i % rels.length]);
    probes.push({ depth: d, value: chain.join('.') });
  }
  return {
    probes,
    note:
      'Send include= with increasing nesting depth. The deepest depth that still ' +
      'returns nested relation objects is the expansion ceiling; deep ' +
      'expansion can bypass per-endpoint field restrictions.',
  };
}

/**
 * Check whether a parsed JSON body contains a nested relation key path.
 * @param {any} parsed Parsed JSON body.
 * @param {string[]} path Relation key path.
 * @returns {boolean}
 */
function hasNestedPath(parsed, path) {
  let node = parsed;
  const unwrap = (n) => {
    if (Array.isArray(n)) return n[0];
    if (n && typeof n === 'object' && Array.isArray(n.data)) return n.data[0];
    if (n && typeof n === 'object' && n.data && typeof n.data === 'object') return n.data;
    return n;
  };
  node = unwrap(node);
  for (const key of path) {
    if (!node || typeof node !== 'object' || !(key in node)) return false;
    node = unwrap(node[key]);
  }
  return true;
}

/**
 * Analyze recorded include-expansion probes (idea 01230).
 * @param {{probes:{depth:number, value:string, response:{status?:number, headers?:object, body?:string}}[]}} input Per-depth probe responses.
 * @returns {{maxDepth:number, expansionMap:{depth:number, expanded:boolean}[], findings:string[], verdict:'deep-expansion'|'shallow'|'none'}}
 */
export function analyzeIncludeExpansion(input) {
  const probes = Array.isArray(input && input.probes) ? input.probes : [];
  const expansionMap = [];
  const findings = [];
  let maxDepth = 0;

  for (const p of probes) {
    const body = p.response && typeof p.response.body === 'string' ? p.response.body : '';
    const status = p.response && typeof p.response.status === 'number' ? p.response.status : null;
    const path = String(p.value).split('.');
    let expanded = false;
    if (status === 200) {
      try {
        expanded = hasNestedPath(JSON.parse(body), path);
      } catch {
        expanded = false;
      }
    }
    expansionMap.push({ depth: p.depth, expanded });
    if (expanded) maxDepth = Math.max(maxDepth, p.depth);
  }

  if (maxDepth > 0)
    findings.push(
      `Include expansion honored up to depth ${maxDepth} ` +
        `(${expansionMap.filter((e) => e.expanded).map((e) => `depth ${e.depth}`).join(', ')})`
    );
  if (maxDepth >= 3)
    findings.push(
      `Deep expansion (depth ${maxDepth}) confirmed — nested relation traversal may ` +
        'bypass per-endpoint field restrictions; flag for authorized review'
    );
  if (maxDepth === 0) findings.push('No include expansion observed at any tested depth');

  let verdict = 'none';
  if (maxDepth >= 3) verdict = 'deep-expansion';
  else if (maxDepth > 0) verdict = 'shallow';

  return { maxDepth, expansionMap, findings, verdict };
}

/**
 * One-line summary of query-operator surface findings for a hunt report.
 * @param {object} summary Any analyzer result from this module carrying a findings array.
 * @returns {string}
 */
export function queryOperatorSummary(summary) {
  if (!summary || !Array.isArray(summary.findings) || summary.findings.length === 0)
    return 'No query-operator surface observations recorded.';
  return summary.findings.join(' ');
}
