/**
 * elasticIndexHarvester.js — Elasticsearch index-name harvester (idea 00367).
 *
 * Parses a captured `GET /_cat/indices` response (JSON or plain text) from an
 * in-scope cluster and classifies index names by data sensitivity: index
 * names alone (users, payments, credentials, backups…) reveal what the
 * cluster stores, without ever reading a single document.
 *
 * Offline analyzer: callers supply the captured listing. This module never
 * sends HTTP requests and never fetches document contents.
 */

/** Index-name patterns mapped to sensitivity and a human-readable reason. */
export const INDEX_SENSITIVITY_PATTERNS = [
  { regex: /credential|passwd|password|secret/i, sensitivity: 'high', reason: 'credential/secret material' },
  { regex: /payment|card|billing|invoice|transaction/i, sensitivity: 'high', reason: 'payment/financial records' },
  { regex: /ssn|passport|national.?id/i, sensitivity: 'high', reason: 'government identity numbers' },
  { regex: /medical|patient|health|diagnos/i, sensitivity: 'high', reason: 'health records' },
  { regex: /salary|payroll|employee|hr-/i, sensitivity: 'high', reason: 'HR/payroll data' },
  { regex: /user|account|customer|client|member/i, sensitivity: 'high', reason: 'user/account records' },
  { regex: /auth|login|session|token|oauth|mfa|2fa/i, sensitivity: 'high', reason: 'authentication/session state' },
  { regex: /private|confidential|restricted/i, sensitivity: 'high', reason: 'explicitly restricted data' },
  { regex: /backup|dump|snapshot|archive/i, sensitivity: 'medium', reason: 'backup/dump copies (often over-permissioned)' },
  { regex: /log/i, sensitivity: 'medium', reason: 'logs (may contain tokens, IPs, PII)' },
  { regex: /mail|message|chat|comment/i, sensitivity: 'medium', reason: 'communications content' },
  { regex: /order|cart|shipment/i, sensitivity: 'medium', reason: 'order/fulfilment data' },
  { regex: /^\./, sensitivity: 'medium', reason: 'system index (cluster internals, security config, monitoring)' },
  { regex: /test|dev|staging|sample/i, sensitivity: 'low', reason: 'non-production-looking index' },
];

/**
 * Parse a `_cat/indices` listing. Accepts the JSON format
 * (`?format=json`) or the default plain-text table.
 * @param {string|Array} input Raw listing.
 * @returns {Array<{index: string, health: string|null, status: string|null, docs: number|null, size: string|null}>}
 */
export function parseCatIndices(input) {
  if (Array.isArray(input)) {
    return input.map((r) => ({
      index: String(r.index || ''),
      health: r.health ?? null,
      status: r.status ?? null,
      docs: r['docs.count'] != null ? parseInt(r['docs.count'], 10) : null,
      size: r['store.size'] ?? null,
    })).filter((r) => r.index);
  }
  const out = [];
  if (typeof input !== 'string') return out;
  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // Text table columns: health status index uuid pri rep docs.count docs.deleted store.size pri.store.size
    const cols = line.split(/\s+/);
    if (cols.length < 3) continue;
    let health = null, status = null, idx = 0;
    if (/^(green|yellow|red)$/i.test(cols[0])) { health = cols[0]; idx = 1; }
    if (/^(open|close)$/i.test(cols[idx])) { status = cols[idx]; idx += 1; }
    const index = cols[idx];
    if (!index || /^(health|status)$/i.test(index)) continue; // header row
    const docs = cols[idx + 4] && /^\d+$/.test(cols[idx + 4]) ? parseInt(cols[idx + 4], 10) : null;
    out.push({ index, health, status, docs, size: cols[idx + 6] ?? null });
  }
  return out;
}

/**
 * Classify a single index name by sensitivity.
 * @param {string} name Index name.
 * @returns {{index: string, sensitivity: 'high'|'medium'|'low', reasons: string[], confidence: string}}
 */
export function classifyIndexName(name) {
  const reasons = [];
  let sensitivity = 'low';
  for (const p of INDEX_SENSITIVITY_PATTERNS) {
    if (p.regex.test(name)) {
      reasons.push(`Name suggests ${p.reason}.`);
      if (p.sensitivity === 'high') sensitivity = 'high';
      else if (p.sensitivity === 'medium' && sensitivity === 'low') sensitivity = 'medium';
    }
  }
  if (reasons.length === 0) reasons.push('No sensitivity markers in the index name.');
  return { index: name, sensitivity, reasons, confidence: sensitivity === 'low' ? 'medium' : 'high' };
}

/**
 * Harvest and classify all indices from a captured listing.
 * @param {string|Array} input Raw `_cat/indices` listing.
 * @returns {{total, indices, highSensitivity, summary, findings, confidence}}
 */
export function harvestIndexNames(input) {
  const parsed = parseCatIndices(input);
  const indices = parsed.map((r) => ({ ...r, ...classifyIndexName(r.index) }));
  const high = indices.filter((i) => i.sensitivity === 'high');
  const medium = indices.filter((i) => i.sensitivity === 'medium');
  const totalDocs = indices.reduce((n, i) => n + (i.docs || 0), 0);
  const findings = [];
  findings.push(`${indices.length} indice(s) listed, ~${totalDocs.toLocaleString('en-US')} documents in total.`);
  if (high.length > 0) findings.push(`HIGH: ${high.length} index name(s) suggest sensitive data: ${high.map((i) => i.index).join(', ')}.`);
  if (medium.length > 0) findings.push(`MEDIUM: ${medium.length} index name(s) merit review: ${medium.map((i) => i.index).join(', ')}.`);
  const closed = indices.filter((i) => i.status === 'close');
  if (closed.length > 0) findings.push(`${closed.length} closed indice(s) — not searchable but still stored on disk.`);
  const red = indices.filter((i) => i.health === 'red');
  if (red.length > 0) findings.push(`${red.length} indice(s) report RED health.`);
  findings.push('Names only — no document contents were read.');
  return {
    total: indices.length,
    indices,
    highSensitivity: high.map((i) => i.index),
    summary: `${indices.length} indices: ${high.length} high-sensitivity, ${medium.length} medium-sensitivity by name.`,
    findings,
    confidence: indices.length > 0 ? 'high' : 'low',
  };
}

export const ELASTIC_INDEX_HARVESTER = { parseCatIndices, classifyIndexName, harvestIndexNames, INDEX_SENSITIVITY_PATTERNS };
export default ELASTIC_INDEX_HARVESTER;
