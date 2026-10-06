/**
 * planVersionLedger.js — Idea 30013.
 *
 * Versions every generated hunt plan and records which plan version each
 * hunt actually ran, enabling plan-level A/B comparison over time.
 * In-memory store; swap the Map for a DB collection in production.
 */

/**
 * Create a fresh version ledger.
 * @returns {{ savePlan: Function, recordHunt: Function, getVersion: Function, listVersions: Function, huntsForVersion: Function }}
 */
export function createPlanLedger() {
  const plans = new Map(); // version -> { version, plan, createdAt }
  const hunts = new Map(); // huntId -> version
  let counter = 0;

  return {
    /**
     * Save a plan, returning its new version string (v1, v2, ...).
     * @param {object} plan
     * @returns {string} version
     */
    savePlan(plan) {
      counter += 1;
      const version = `v${counter}`;
      plans.set(version, { version, plan: JSON.parse(JSON.stringify(plan)), createdAt: new Date().toISOString() });
      return version;
    },
    /**
     * Record that a hunt ran a given plan version.
     * @param {string} huntId
     * @param {string} version
     */
    recordHunt(huntId, version) {
      if (!plans.has(version)) throw new Error(`unknown plan version: ${version}`);
      hunts.set(huntId, version);
    },
    /** @param {string} version */
    getVersion(version) {
      return plans.get(version) || null;
    },
    /** @returns {{ version: string, createdAt: string, huntCount: number }[]} */
    listVersions() {
      const counts = {};
      for (const v of hunts.values()) counts[v] = (counts[v] || 0) + 1;
      return [...plans.values()].map((p) => ({ version: p.version, createdAt: p.createdAt, huntCount: counts[p.version] || 0 }));
    },
    /** @param {string} version @returns {string[]} hunt ids */
    huntsForVersion(version) {
      return [...hunts.entries()].filter(([, v]) => v === version).map(([h]) => h);
    },
  };
}

export const PLAN_VERSION_LEDGER = { createPlanLedger };
export default PLAN_VERSION_LEDGER;
