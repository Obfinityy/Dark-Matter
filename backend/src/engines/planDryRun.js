/**
 * planDryRun.js — Idea 30010.
 *
 * Simulates a hunt plan against a synthetic target graph (pure in-memory
 * graph walk, zero network traffic) to estimate expected coverage before
 * any probe runs.
 */

/**
 * Build a synthetic target graph for dry-run simulation.
 * @param {object} opts - { hosts?: number, pathsPerHost?: number, seed?: number }
 * @returns {{ nodes: object[], edges: [number, number][] }}
 */
export function syntheticTargetGraph({ hosts = 3, pathsPerHost = 12, seed = 42 } = {}) {
  let s = seed;
  const rand = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const nodes = [];
  const edges = [];
  let id = 0;
  for (let h = 0; h < hosts; h++) {
    const hostId = id++;
    nodes.push({ id: hostId, kind: 'host', label: `host-${h}` });
    let prev = hostId;
    for (let p = 0; p < pathsPerHost; p++) {
      const pid = id++;
      nodes.push({ id: pid, kind: 'path', label: `/p${h}-${p}`, depth: 1 + Math.floor(rand() * 3) });
      edges.push([prev, pid]);
      prev = pid;
    }
  }
  return { nodes, edges };
}

/**
 * Dry-run a plan against a target graph: which modules cover which nodes.
 * @param {object} plan - { modules: [{ id, actions }] }
 * @param {object} graph - { nodes, edges }
 * @returns {{ coverage: number, coveredNodes: number, totalNodes: number, perModule: Record<string, number> }}
 */
export function dryRunPlan(plan = { modules: [] }, graph = syntheticTargetGraph()) {
  const modules = plan.modules || [];
  const totalNodes = graph.nodes.length;
  const covered = new Set();
  const perModule = {};
  // Deterministic coverage model: each module covers nodes by action affinity.
  for (const mod of modules) {
    const hits = new Set();
    const affinity = ((mod.id || '').length % 5) + 2;
    graph.nodes.forEach((n, i) => {
      if ((i * affinity + (mod.actions || []).length) % 4 < 2) hits.add(n.id);
    });
    perModule[mod.id || 'unknown'] = hits.size;
    hits.forEach((id) => covered.add(id));
  }
  return {
    coverage: totalNodes ? Math.round((covered.size / totalNodes) * 1000) / 1000 : 0,
    coveredNodes: covered.size,
    totalNodes,
    perModule,
  };
}

export const PLAN_DRY_RUN = { syntheticTargetGraph, dryRunPlan };
export default PLAN_DRY_RUN;
