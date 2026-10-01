/**
 * huntDiary.js — the plain-language hunt diary.
 *
 * The diary is the human-readable story of a hunt: what the agent tried, what
 * it thought, what it found. It merges every persisted trace — the job's
 * activity log, the reasoning-cycle ledger (the thinking loop), computer
 * actions, and confirmed findings — into one time-ordered list the UI renders
 * as a timeline. It is also the evidence backbone of the final report.
 */

const SEVERITY_RANK = { critical: 5, high: 4, medium: 3, low: 2, info: 1, informational: 1 };

function severityRank(severity) {
  return SEVERITY_RANK[String(severity || '').toLowerCase().trim()] ?? 0;
}

/** Critical-first ordering for findings boards and exports. */
export function sortFindingsCriticalFirst(findings = []) {
  return [...findings].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

function atOf(item) {
  return item?.createdAt || item?.at || item?.timestamp || item?.startedAt || null;
}

/**
 * Build the diary from the persisted sources. Each source is optional —
 * the diary degrades gracefully when a model is not wired (tests, partial
 * deployments) instead of crashing the endpoint.
 *
 * @param {object} sources { activityModel, reasoningCycleModel, computerActionModel, findingModel, evidenceModel }
 */
export async function buildDiary(sources = {}, userId, jobId) {
  const entries = [];
  const push = (entry) => {
    if (entry && entry.title) entries.push({ detail: null, ...entry });
  };

  // 1. Job activity log — the worker's own running commentary.
  try {
    const activity = await sources.activityModel?.list?.();
    for (const item of activity || []) {
      push({
        at: atOf(item),
        kind: item.kind || 'activity',
        title: item.message || item.title || 'Activity',
        detail: item.data ? summarizeData(item.data) : null
      });
    }
  } catch { /* activity is best-effort */ }

  // 2. Reasoning cycles — the persisted thinking loop (thought → action → outcome).
  try {
    const cycles = await sources.reasoningCycleModel?.listByJob?.(jobId, { limit: 500 });
    for (const cycle of cycles || []) {
      push({
        at: cycle.createdAt,
        kind: 'thought',
        title: `Step ${cycle.stepNumber}: ${cycle.thought || cycle.objective || 'reasoning'}`,
        detail: [
          cycle.plan ? `Plan: ${cycle.plan}` : null,
          cycle.actionSummary ? `Action: ${cycle.actionSummary}` : null,
          cycle.expectedOutcome ? `Expected: ${cycle.expectedOutcome}` : null,
          cycle.verification ? `Outcome: ${cycle.verification.outcome || 'verified'}${cycle.verification.reason ? ` — ${cycle.verification.reason}` : ''}` : null,
          cycle.adaptation ? `Adapted: ${cycle.adaptation.nextObjective || cycle.adaptation.nextReason || ''}` : null,
          cycle.learning ? `Lesson: ${cycle.learning}` : null
        ].filter(Boolean).join('\n') || null
      });
    }
  } catch { /* thinking loop is best-effort */ }

  // 3. Computer actions — what the agent's hands actually did.
  try {
    const actions = await sources.computerActionModel?.listByJob?.(jobId, 500);
    for (const action of actions || []) {
      push({
        at: atOf(action),
        kind: 'computer',
        title: `Computer: ${action.type || action.actionType || 'action'}`,
        detail: action.summary || action.reason || null
      });
    }
  } catch { /* computer trace is best-effort */ }

  // 4. Findings — confirmed vulnerabilities, critical first in spirit.
  try {
    const findings = await sources.findingModel?.list?.();
    for (const finding of sortFindingsCriticalFirst(findings || [])) {
      push({
        at: atOf(finding),
        kind: 'finding',
        title: `Found: ${finding.title} [${String(finding.severity || 'info').toUpperCase()}]`,
        detail: finding.description ? String(finding.description).slice(0, 300) : null
      });
    }
  } catch { /* findings are best-effort */ }

  entries.sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  return entries;
}

function summarizeData(data) {
  try {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    return text.length > 280 ? `${text.slice(0, 280)}…` : text;
  } catch {
    return null;
  }
}
