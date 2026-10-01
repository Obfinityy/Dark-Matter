/**
 * huntContextManager.js
 *
 * Context-window management for the autonomous hunt loop — THE core
 * reliability problem of a long-running agent. A hunt can run for thousands
 * of steps; the brain's window is finite. Without management, observations
 * pile up, the prompt overflows, reasoning collapses, and no bounties get
 * found. This module guarantees the prompt ALWAYS fits, at step 5 and at
 * step 5000.
 *
 * Hierarchical memory:
 *   HOT  — sliding window over the newest activity/observations.
 *          Token-budgeted; older items age out automatically.
 *   WARM — the hunt summary: a dense rolling summary of THIS hunt
 *          (what was tried, what was found, what's pending). Refreshed
 *          every K steps by the brain itself, with a deterministic
 *          extractive fallback when the brain is unreachable.
 *   COLD — long-term memory: AgentMemory notes (retrieved per-cycle by
 *          relevance query) + the self-learning payload library.
 *
 * Token budgeting per cycle:
 *   The variable part of the user message (hot + warm + findings + cycles)
 *   is assembled newest-first against a hard token ceiling. Decision-critical
 *   facts (target, scope, objective, current hypothesis) are NOT part of the
 *   variable budget — the brain carries them in fixed message sections that
 *   are never dropped.
 *
 * Recovery:
 *   If a cycle still fails with a context-window error, `emergencyCompact`
 *   forces a summary refresh and shrinks the hot window, so the retry runs
 *   on a strictly smaller prompt instead of dying.
 *
 * Token estimates reuse the conservative estimator from the long-context
 * engine (never duplicated): over-estimating is safe, under-estimating is
 * how prompts overflow.
 */

import { estimateTokens } from '../services/longContext/tokens.js';

export const DEFAULT_SUMMARY_EVERY_STEPS = Number(process.env.HUNT_SUMMARY_EVERY_STEPS || 25);
export const DEFAULT_VARIABLE_BUDGET_TOKENS = Number(process.env.HUNT_CONTEXT_VARIABLE_TOKENS || 3000);
export const DEFAULT_HOT_BUDGET_TOKENS = Number(process.env.HUNT_CONTEXT_HOT_TOKENS || 1200);
export const HOT_ITEM_MAX_TOKENS = 160;

// Budget shares (of the variable budget) by priority. Warm first: the summary
// is the hunt's compressed experience and must never be starved.
const WARM_SHARE = 0.25;
const FINDINGS_SHARE = 0.2;
const CYCLES_SHARE = 0.15;
// HOT gets the remainder.

/**
 * Truncate one text to roughly maxTokens, keeping head and tail.
 */
export function truncateItem(text, maxTokens) {
  const str = String(text || '');
  if (estimateTokens(str) <= maxTokens) return str;
  const approxChars = Math.max(120, Math.floor(maxTokens * 3.4));
  const half = Math.floor(approxChars / 2);
  return `${str.slice(0, half)}\n[…truncated…]\n${str.slice(-half)}`;
}

export class HuntContextManager {
  constructor({
    activityModel = null,
    jobModel,
    memory = null,
    findingModel = null,
    reasoningCycleModel = null,
    payloadLibraryModel = null,
    summaryEverySteps = DEFAULT_SUMMARY_EVERY_STEPS,
    variableBudgetTokens = DEFAULT_VARIABLE_BUDGET_TOKENS,
    hotBudgetTokens = DEFAULT_HOT_BUDGET_TOKENS,
    logger = console,
  }) {
    this.activityModel = activityModel;
    this.jobModel = jobModel;
    this.memory = memory;
    this.findingModel = findingModel;
    this.reasoningCycleModel = reasoningCycleModel;
    this.payloadLibraryModel = payloadLibraryModel;
    this.summaryEverySteps = summaryEverySteps;
    this.variableBudgetTokens = variableBudgetTokens;
    this.hotBudgetTokens = hotBudgetTokens;
    this.logger = logger;
  }

  // ── Assembly ──────────────────────────────────────────────────────────

  /**
   * Build the token-budgeted variable context for one reasoning step.
   *
   * @param {object} job - the agent job (with activity, techniquesTried, assets…)
   * @param {object} opts - { findings, recentCycles, learnedHints }
   * @returns {object} { hotObservations, findings, recentCycles, warmSummary,
   *                     learnedHints, diagnostics }
   *   Every list is newest-first-truncated to its budget; the TOTAL never
   *   exceeds variableBudgetTokens.
   */
  async buildStepContext(job, { findings = [], recentCycles = [], learnedHints = '', variableBudgetTokens = null, hotBudgetTokens = null } = {}) {
    const variableBudget = variableBudgetTokens || this.variableBudgetTokens;
    const warmBudget = Math.floor(variableBudget * WARM_SHARE);
    const findingsBudget = Math.floor(variableBudget * FINDINGS_SHARE);
    const cyclesBudget = Math.floor(variableBudget * CYCLES_SHARE);
    const hotBudget = Math.min(
      hotBudgetTokens || this.hotBudgetTokens,
      variableBudget - warmBudget - findingsBudget - cyclesBudget
    );

    const warmSummary = truncateItem(
      (job.huntSummary && job.huntSummary.text) || '',
      warmBudget
    );

    const budgetedFindings = [];
    let findingsTokens = 0;
    for (const finding of findings) {
      const line = `[${finding.status || 'confirmed'}] ${finding.title} (${finding.severity}) @ ${finding.asset || finding.affectedAsset || 'n/a'}`;
      const cost = estimateTokens(line);
      if (findingsTokens + cost > findingsBudget) break;
      budgetedFindings.push(finding);
      findingsTokens += cost;
    }

    const budgetedCycles = [];
    let cyclesTokens = 0;
    for (const cycle of [...recentCycles].reverse()) {
      const line = `step ${cycle.stepNumber || cycle.step}: ${cycle.technique || cycle.action || '—'} → ${cycle.verification || 'pending'}`;
      const cost = estimateTokens(line);
      if (cyclesTokens + cost > cyclesBudget) break;
      budgetedCycles.unshift(cycle);
      cyclesTokens += cost;
    }

    // HOT: sliding window — newest activity first, each item truncated,
    // stop when the hot budget is exhausted. Old items age out; nothing
    // is lost because the warm summary compresses them.
    const activity = Array.isArray(job.activity) ? job.activity : [];
    const hotObservations = [];
    let hotTokens = 0;
    for (let i = activity.length - 1; i >= 0; i -= 1) {
      const item = activity[i];
      const summary = truncateItem(
        `[${item.kind || 'event'}] ${item.message || item.text || ''}`,
        HOT_ITEM_MAX_TOKENS
      );
      const cost = estimateTokens(summary);
      if (hotTokens + cost > hotBudget) break;
      hotObservations.unshift({ kind: item.kind, summary });
      hotTokens += cost;
    }

    const total = estimateTokens(warmSummary) + findingsTokens + cyclesTokens + hotTokens
      + estimateTokens(learnedHints || '');

    return {
      hotObservations,
      findings: budgetedFindings,
      recentCycles: budgetedCycles,
      warmSummary,
      learnedHints,
      diagnostics: {
        variableBudget,
        totalEstimatedTokens: total,
        withinBudget: total <= variableBudget + estimateTokens(learnedHints || ''),
        hotItems: hotObservations.length,
        hotDropped: activity.length - hotObservations.length,
        findingsIncluded: budgetedFindings.length,
        findingsDropped: findings.length - budgetedFindings.length,
        cyclesIncluded: budgetedCycles.length,
        summaryAtStep: (job.huntSummary && job.huntSummary.atStep) || 0,
      },
    };
  }

  // ── Periodic summarization ────────────────────────────────────────────

  /**
   * Refresh the warm hunt summary when due (every K steps) or forced.
   * Rolling: the new summary compresses (previous summary + activity that
   * has aged out of the hot window). Stored on the job, so it survives
   * restarts and is visible in the UI.
   *
   * @returns the stored summary record { text, atStep, updatedAt }
   */
  async maybeRefreshSummary({ job, brain = null, force = false }) {
    const stepCount = job.stepCount || 0;
    const lastAt = (job.huntSummary && job.huntSummary.atStep) || 0;
    if (!force && stepCount - lastAt < this.summaryEverySteps) {
      return job.huntSummary || null;
    }

    const activity = Array.isArray(job.activity) ? job.activity : [];
    // Summarize everything up to the current hot window — i.e. what the
    // brain is about to lose sight of — plus the previous summary.
    const hotWindowSize = 30;
    const agedOut = activity.slice(0, Math.max(0, activity.length - hotWindowSize));
    const previous = (job.huntSummary && job.huntSummary.text) || '';

    let text = null;
    if (brain && typeof brain.summarizeText === 'function' && (previous || agedOut.length)) {
      try {
        text = await brain.summarizeText({
          previousSummary: previous,
          newActivity: agedOut.slice(-120).map((a) => `[${a.kind || 'event'}] ${a.message || a.text || ''}`),
          focus: 'bug-bounty hunt progress: techniques tried and their outcomes, assets discovered, findings confirmed, open hypotheses',
          job: { target: job.target, stepCount },
        });
      } catch (error) {
        this.logger.warn?.(`[hunt-context] brain summarization failed, using extractive fallback: ${error.message}`);
      }
    }
    if (!text) {
      text = this.extractiveSummary({ job, previous, agedOut });
    }

    const record = {
      text: truncateItem(text, Math.floor(this.variableBudgetTokens * WARM_SHARE)),
      atStep: stepCount,
      updatedAt: new Date().toISOString(),
    };
    await this.jobModel.update(job.id, { huntSummary: record });
    // Hybrid storage: the warm summary is ALSO written to the file-memory
    // summary.md for this hunt — the agent's own long-term note, readable
    // with `cat` and surviving restarts independent of the database.
    if (this.memory && typeof this.memory.writeSummary === 'function' && job.userId) {
      try {
        await this.memory.writeSummary({ userId: job.userId, jobId: job.id, text: record.text });
      } catch (error) {
        this.logger.warn?.(`[hunt-context] file-memory summary write failed: ${error.message}`);
      }
    }
    return record;
  }

  /**
   * Deterministic extractive summary — no LLM needed. Used when the brain
   * is unreachable, and as the seed for the first summary. Never invents:
   * every line is counted or quoted from stored records.
   */
  extractiveSummary({ job, previous = '', agedOut = [] }) {
    const lines = [];
    const stepCount = job.stepCount || 0;
    lines.push(`HUNT SUMMARY (steps 1–${stepCount}, auto-compacted ${new Date().toISOString()}):`);

    const tried = Array.isArray(job.techniquesTried) ? job.techniquesTried : [];
    if (tried.length) {
      const byOutcome = {};
      for (const t of tried) {
        const key = t.verification || 'unknown';
        byOutcome[key] = (byOutcome[key] || 0) + 1;
      }
      lines.push(
        `- Techniques tried (${tried.length}): ` +
        tried.slice(-15).map((t) => `${t.techniqueId || t} (${t.verification || '?'})`).join(', ') +
        (tried.length > 15 ? ` …and ${tried.length - 15} earlier` : '')
      );
      lines.push(`- Outcomes: ${Object.entries(byOutcome).map(([k, v]) => `${v}× ${k}`).join(', ')}`);
    } else {
      lines.push('- Techniques tried: none yet');
    }

    const assets = Array.isArray(job.assets) ? job.assets : [];
    if (assets.length) {
      const kinds = {};
      for (const a of assets) kinds[a.kind || 'unknown'] = (kinds[a.kind || 'unknown'] || 0) + 1;
      lines.push(`- Assets discovered (${assets.length}): ${Object.entries(kinds).map(([k, v]) => `${v} ${k}`).join(', ')}`);
    }

    const findingsCount = job.findingsCount || 0;
    lines.push(`- Findings confirmed: ${findingsCount}`);

    // Open hypotheses: the newest few, quoted verbatim.
    const hypotheses = agedOut
      .filter((a) => a.kind === 'decision' || a.kind === 'brain')
      .slice(-3)
      .map((a) => String(a.message || a.text || '').slice(0, 140));
    if (hypotheses.length) {
      lines.push(`- Recent thinking: ${hypotheses.join(' | ')}`);
    }

    if (previous) {
      lines.push(`- Earlier summary: ${truncateItem(previous, 400)}`);
    }
    return lines.join('\n');
  }

  // ── Recovery ──────────────────────────────────────────────────────────

  /**
   * Emergency compaction after a context-window failure: force a summary
   * refresh NOW and return a one-shot tightened budget so the retried step
   * runs on a strictly smaller prompt.
   */
  async emergencyCompact({ job, brain = null }) {
    await this.maybeRefreshSummary({ job, brain, force: true });
    const fresh = await this.jobModel.get(job.id);
    return {
      job: fresh || job,
      tightenedBudgets: {
        variableBudgetTokens: Math.floor(this.variableBudgetTokens * 0.5),
        hotBudgetTokens: Math.floor(this.hotBudgetTokens * 0.5),
      },
    };
  }
}
