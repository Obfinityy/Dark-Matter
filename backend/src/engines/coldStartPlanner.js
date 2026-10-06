/**
 * coldStartPlanner.js — Idea 30014.
 *
 * Seeds hunt-plan modules from public-writeup-derived knowledge when no
 * prior hunt data exists for the target type (cold start). The knowledge
 * base encodes which check families historically paid off per target type.
 */

/** Writeup-derived starter module sets per target type. */
export const COLD_START_KNOWLEDGE = {
  saas: ['idor-probes', 'xss-probes', 'sqli-probes', 'auth-flow-tests', 'api-mapping'],
  ecommerce: ['idor-probes', 'xss-probes', 'auth-flow-tests', 'dir-discovery'],
  'api-only': ['api-mapping', 'idor-probes', 'auth-flow-tests', 'ssrf-probes'],
  static: ['xss-probes', 'dir-discovery'],
  'mobile-backend': ['api-mapping', 'idor-probes', 'auth-flow-tests'],
  unknown: ['xss-probes', 'sqli-probes', 'idor-probes', 'dir-discovery'],
};

/**
 * Seed starter modules for a target type with no hunt history.
 * @param {string} targetType
 * @param {object} knowledge - optional override table
 * @returns {{ modules: string[], source: string }}
 */
export function seedColdStartModules(targetType = 'unknown', knowledge = COLD_START_KNOWLEDGE) {
  const modules = knowledge[targetType] || knowledge.unknown;
  return { modules: [...modules], source: `cold-start knowledge: ${targetType}` };
}

/**
 * Decide whether cold start is needed (no recorded hunts for this type).
 * @param {string} targetType
 * @param {object} history - { [targetType]: huntCount }
 * @returns {boolean}
 */
export function needsColdStart(targetType, history = {}) {
  return !(history[targetType] > 0);
}

export const COLD_START_PLANNER = { COLD_START_KNOWLEDGE, seedColdStartModules, needsColdStart };
export default COLD_START_PLANNER;
