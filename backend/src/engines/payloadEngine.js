/**
 * payloadEngine.js — Payload Library engine for autonomous bug bounty hunts.
 *
 * Read-only data engine: serves curated payload strings from the Payload
 * Library dataset (22 vulnerability classes, MIT-licensed corpus — see
 * THIRD_PARTY_NOTICES.md). Hunters call payloadsFor() when a hunt targets a
 * specific vulnerability class, so the brain reasons over concrete,
 * field-tested payload shapes instead of inventing syntax from scratch.
 *
 * Data only — this engine never sends requests, never fires payloads, and
 * never touches a target. Everything stays behind the authorized-targets-only
 * guardrails enforced by the hunt pipeline.
 */

import { PayloadLibraryService } from '../services/payloadLibraryService.js';

let service = null;

/** Lazily create the shared dataset service. */
function getService() {
  if (!service) service = new PayloadLibraryService();
  return service;
}

/**
 * List the available payload categories with counts.
 * @returns {Promise<Array<{ slug: string, name: string, count: number }>>}
 */
export async function payloadCategories() {
  return getService().listCategories();
}

/**
 * Payloads for one vulnerability class.
 *
 * @param {object} args
 * @param {string} args.category — dataset slug, e.g. 'xss', 'sqli', 'ssrf'.
 * @param {number} [args.limit=10] — max payloads (clamped by the service).
 * @returns {Promise<{ category: string, total: number, payloads: Array }>}
 */
export async function payloadsFor({ category, limit = 10 } = {}) {
  const svc = getService();
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const { payloads } = await svc.getPayloads(category, { limit: safeLimit, offset: 0 });
  const categories = await svc.listCategories();
  const known = categories.some(c => c.slug === String(category || '').toLowerCase());
  return { category: String(category || ''), known, total: payloads.length, payloads };
}

/**
 * Search the whole library for payloads matching a keyword.
 *
 * @param {object} args
 * @param {string} args.query
 * @param {number} [args.limit=10]
 * @returns {Promise<{ query: string, total: number, results: Array }>}
 */
export async function searchPayloads({ query, limit = 10 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
  return getService().searchPayloads(query, { limit: safeLimit });
}

export const PAYLOAD_ENGINE = { payloadCategories, payloadsFor, searchPayloads };
export default PAYLOAD_ENGINE;
