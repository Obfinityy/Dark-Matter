/**
 * taskDecomposer.js — the agent works like its operator: plan, delegate, synthesize.
 *
 * A complex hunt objective ("map this target's attack surface") is too big
 * for one brain call. The TaskDecomposer asks the hacking brain to break it
 * into independent sub-tasks, runs them (tools in parallel, brain analyses
 * through the FIFO queue so they never collide), then asks the brain to
 * synthesize the sub-results into one conclusion.
 *
 * This mirrors how the operator works: todo list → parallel workers →
 * synthesized result. One level of delegation only — workers never spawn
 * workers (bounded, predictable).
 */

const DECOMPOSE_SYSTEM = [
  'You are the task planner for Infinity AI, an autonomous bug-bounty agent.',
  'Break the given objective into small INDEPENDENT sub-tasks that can run in any order.',
  'Each sub-task is one of:',
  '  - {"kind":"analyze","task":"...","context":"..."} — brain analyzes data/text',
  '  - {"kind":"tool","tool":"<registry tool>","target":"...","arguments":{}} — run one security tool',
  'Rules:',
  '  - 2 to 6 sub-tasks. Fewer is better — only split when truly independent.',
  '  - A sub-task must be solvable from its own task+context alone.',
  '  - Prefer tool sub-tasks for data gathering, analyze for reasoning.',
  '  - Never include destructive actions.',
  'Respond with ONLY valid JSON: {"subTasks":[...], "synthesisHint":"..."}',
].join('\n');

const SYNTHESIZE_SYSTEM = [
  'You are the synthesizer for Infinity AI, an autonomous bug-bounty agent.',
  'You receive sub-task results. Combine them into ONE clear conclusion.',
  'Rules:',
  '  - Lead with the answer to the original objective.',
  '  - Cite which sub-task each key fact came from.',
  '  - Flag contradictions between sub-tasks instead of hiding them.',
  '  - End with recommended next steps (max 3).',
  'Respond with ONLY valid JSON: {"conclusion":"...","keyFacts":[...],"nextSteps":[...]}',
].join('\n');

/** TaskDecomposer — plan → delegate → synthesize. */
export class TaskDecomposer {
  /**
   * @param {object} options
   * @param {object} [options.toolExecutor] — ToolExecutor (for tool sub-tasks)
   * @param {object} [options.logger]
   * @param {number} [options.maxSubTasks=6]
   */
  constructor({ toolExecutor = null, logger = console, maxSubTasks = 6 } = {}) {
    this.toolExecutor = toolExecutor;
    this.logger = logger || console;
    this.maxSubTasks = maxSubTasks;
  }

  /**
   * Decompose an objective, run sub-tasks, synthesize.
   * @param {object} args — { brain, objective, context, assessmentId, userId }
   * @returns {Promise<{ conclusion, keyFacts, nextSteps, subResults }>}
   */
  async run({ brain, objective, context = '', assessmentId = null, userId = null }) {
    if (!brain) throw new Error('TaskDecomposer requires a brain');
    this.logger.info?.(`[task-decomposer] decomposing: ${String(objective).slice(0, 80)}`);

    // 1. PLAN — brain breaks the objective into sub-tasks.
    const plan = await this._decompose(brain, objective, context);
    const subTasks = (plan.subTasks || []).slice(0, this.maxSubTasks);
    if (!subTasks.length) throw new Error('Brain produced no sub-tasks');

    // 2. DELEGATE — run sub-tasks. Tools go in parallel; brain analyses
    //    funnel through the provider FIFO queue (no overlap, no mixing).
    const subResults = await this._executeAll(brain, subTasks, {
      assessmentId,
      userId,
      objective,
    });

    // 3. SYNTHESIZE — brain combines sub-results into one conclusion.
    const synthesis = await this._synthesize(brain, objective, subResults, plan.synthesisHint);
    return { ...synthesis, subResults };
  }

  async _decompose(brain, objective, context) {
    const raw = await brain.generate(
      [
        { role: 'system', content: DECOMPOSE_SYSTEM },
        {
          role: 'user',
          content: `Objective: ${objective}\n\nContext:\n${String(context).slice(0, 2000)}`,
        },
      ],
      { maxTokens: 1200, timeout: 120000 }
    );
    const parsed = safeJson(String(raw));
    if (!parsed || !Array.isArray(parsed.subTasks)) {
      throw new Error('Brain did not return a valid sub-task plan');
    }
    return parsed;
  }

  async _executeAll(brain, subTasks, { assessmentId, userId, objective }) {
    // Split: tool tasks can run in parallel; analyze tasks go through the
    // brain queue (serialized automatically by the provider).
    const toolTasks = [];
    const analyzeTasks = [];
    subTasks.forEach((t, i) => {
      const task = { ...t, _index: i };
      if (t.kind === 'tool' && this.toolExecutor) toolTasks.push(task);
      else analyzeTasks.push({ ...task, kind: 'analyze' });
    });

    const results = new Array(subTasks.length);

    // Tools in parallel (bounded by the executor's own cap).
    if (toolTasks.length) {
      const toolResults = await Promise.allSettled(
        toolTasks.map(t =>
          this.toolExecutor.execute(t.tool, {
            target: t.target,
            arguments: t.arguments || {},
            assessmentId,
            userId,
          })
        )
      );
      toolResults.forEach((r, i) => {
        const t = toolTasks[i];
        results[t._index] = {
          subTask: describeTask(t),
          status: r.status,
          result: r.status === 'fulfilled' ? summarize(r.value) : String(r.reason?.message || r.reason),
        };
      });
    }

    // Analyses via the brain (FIFO queue serializes them safely).
    for (const t of analyzeTasks) {
      try {
        const out = await brain.generate(
          [
            {
              role: 'system',
              content:
                'You are a focused analysis worker for Infinity AI. Answer ONLY the sub-task below, concisely. Return plain text or JSON, no preamble.',
            },
            {
              role: 'user',
              content: `Sub-task ${t._index + 1}: ${t.task || t.objective || ''}\n\nContext:\n${String(t.context || '').slice(0, 3000)}`,
            },
          ],
          { maxTokens: 1000, timeout: 120000 }
        );
        results[t._index] = { subTask: describeTask(t), status: 'fulfilled', result: String(out).slice(0, 2000) };
      } catch (err) {
        results[t._index] = {
          subTask: describeTask(t),
          status: 'rejected',
          result: err?.message || String(err),
        };
      }
    }
    return results;
  }

  async _synthesize(brain, objective, subResults, hint = '') {
    const resultsText = subResults
      .map((r, i) => `--- Sub-task ${i + 1} (${r.subTask}) [${r.status}] ---\n${r.result}`)
      .join('\n\n');
    const raw = await brain.generate(
      [
        { role: 'system', content: SYNTHESIZE_SYSTEM },
        {
          role: 'user',
          content: `Original objective: ${objective}\n${hint ? `Synthesis hint: ${hint}\n` : ''}\nSub-task results:\n${resultsText.slice(0, 6000)}`,
        },
      ],
      { maxTokens: 1200, timeout: 120000 }
    );
    const parsed = safeJson(String(raw));
    if (!parsed || typeof parsed.conclusion !== 'string') {
      // Graceful: return the raw synthesis text even if JSON parsing failed.
      return {
        conclusion: String(raw).slice(0, 2000),
        keyFacts: [],
        nextSteps: [],
      };
    }
    return parsed;
  }
}

function describeTask(t) {
  if (t.kind === 'tool') return `tool:${t.tool}`;
  return `analyze:${String(t.task || '').slice(0, 60)}`;
}

function summarize(value) {
  if (value == null) return '(no output)';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s.slice(0, 2000);
}

function safeJson(text) {
  try {
    const cleaned = String(text).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export function createTaskDecomposer(options = {}) {
  return new TaskDecomposer(options);
}
