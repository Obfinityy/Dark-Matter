// Dark Matter hunt-intel — Pentesting Task Tree (PTT).
// Technique: PentestGPT (MIT). The hunt's memory is a TREE, not a flat log:
// each node is a task with status, children are subtasks, findings attach
// to the node that produced them. The planner reasons over the tree.

export const TASK_STATUS = ['pending', 'active', 'completed', 'failed', 'blocked'];

export function createTaskTree(target) {
  return {
    id: `ptt-${Date.now().toString(36)}`,
    target,
    createdAt: new Date().toISOString(),
    root: {
      id: 'root',
      title: `Hunt ${target}`,
      status: 'active',
      children: [],
      findings: [],
    },
  };
}

export function addTask(tree, parentId, title, meta = {}) {
  const node = {
    id: `t-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    title,
    status: 'pending',
    children: [],
    findings: [],
    meta,
    createdAt: new Date().toISOString(),
  };
  const parent = findNode(tree.root, parentId) || tree.root;
  parent.children.push(node);
  return node;
}

export function findNode(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function setTaskStatus(tree, taskId, status) {
  if (!TASK_STATUS.includes(status)) return false;
  const node = findNode(tree.root, taskId);
  if (!node) return false;
  node.status = status;
  node.updatedAt = new Date().toISOString();
  // Auto-complete parent when all children complete
  return true;
}

export function attachFinding(tree, taskId, finding) {
  const node = findNode(tree.root, taskId) || tree.root;
  node.findings.push({ ...finding, attachedAt: new Date().toISOString() });
}

/** Flatten the tree into a planner-readable summary. */
export function summarizeTree(tree) {
  const out = { total: 0, byStatus: {}, findings: 0, openTasks: [] };
  (function walk(node, depth) {
    out.total++;
    out.byStatus[node.status] = (out.byStatus[node.status] || 0) + 1;
    out.findings += (node.findings || []).length;
    if (['pending', 'active', 'blocked'].includes(node.status)) {
      out.openTasks.push({ id: node.id, title: node.title, status: node.status, depth });
    }
    for (const child of node.children || []) walk(child, depth + 1);
  })(tree.root, 0);
  return out;
}

/** Serialize for persistence (file-based hunt memory). */
export function serializeTree(tree) {
  return JSON.stringify(tree);
}

export function deserializeTree(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
