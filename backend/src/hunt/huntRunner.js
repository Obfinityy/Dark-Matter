/**
 * huntRunner.js — wires the hunt pipeline together:
 *
 *   TripleBrainPlanner  →  toolRunner (external scanners)  →  LiveReport
 *        (reason/generate/parse)      (PD binaries, subprocess)   (grows during the hunt)
 *
 * runHunt() creates the hunt, then loops planner.step() until the task tree
 * completes. Tool-kind tasks are executed by the toolRunner; every finding
 * is forwarded to the LiveReport immediately, so the report builds DURING
 * the hunt. The hunt can be interrupted and resumed later with resumeHunt()
 * because both the planner state and the live report persist per hunt.
 *
 * Defensive framing only: findings + remediation, no exploit payloads.
 */

import { TripleBrainPlanner } from './planner.js';
import { createToolRunner } from './toolRunner.js';
import { LiveReport } from './liveReport.js';

/**
 * @param {object} opts
 * @param {string} opts.huntId
 * @param {string} opts.target
 * @param {object|null} [opts.brain] — Hacking-slot brain provider (DI)
 * @param {object} [opts.runner] — createToolRunner options (spawnFn injectable)
 * @param {object} [opts.hooks] — { onFinding, onTask, onStage, maxSteps }
 * @param {object} [opts.logger]
 * @returns {Promise<{ hunt, report, steps }>}
 */
export async function runHunt({
  huntId,
  target,
  brain = null,
  runner = {},
  hooks = {},
  logger = console,
}) {
  const planner = new TripleBrainPlanner({ brain, logger });
  const toolRunner = createToolRunner({ logger, ...(runner || {}) });
  const report = new LiveReport({ huntId, target, logger });

  const hunt = await planner.createHunt({ id: huntId, target });
  logger.info?.(`[huntRunner] hunt ${huntId} started on ${target} (Infinity AI)`);

  const runTool = async spec => {
    const lines = [];
    const res = await toolRunner.runTool(spec.tool, spec.targets, {
      profile: spec.profile || 'fast',
      onFinding: rec => {
        const finding = {
          title: rec.title || `${spec.tool} observation`,
          severity: rec.severity || 'informational',
          target: rec.target || rec.url || rec.host || '',
          description:
            rec.description ||
            `${spec.tool} reported: ${JSON.stringify(rec.raw || {}).slice(0, 500)}`,
          evidence: rec.evidence || JSON.stringify(rec.raw || {}).slice(0, 1500),
          source: spec.tool,
          templateId: rec.templateId,
          confidence: 'medium',
        };
        report.addFinding(finding).then(stored => {
          if (stored) hooks.onFinding?.(stored);
        });
      },
      onRecord: hooks.onRecord,
    });
    report.recordStage({
      tool: spec.tool,
      records: res.records.length,
      findings: res.findings.length,
      skipped: res.skipped,
    });
    lines.push(
      `TOOL ${spec.tool}: ${res.records.length} records, ${res.findings.length} findings${res.skipped ? ' (binary absent — skipped)' : ''}.`
    );
    return lines.join('\n');
  };

  const maxSteps = hooks.maxSteps || 40;
  let steps = 0;
  let done = false;
  while (!done && steps < maxSteps) {
    const { task, done: finished } = await planner.step(hunt, { runTool });
    done = finished;
    steps++;
    if (task) hooks.onTask?.(task);
  }

  if (!done) {
    logger.warn?.(
      `[huntRunner] hunt ${huntId} hit maxSteps=${maxSteps}; state persisted, resume with resumeHunt()`
    );
  }
  const finalHunt = await planner.loadHunt(huntId);
  return { hunt: finalHunt, report, steps };
}

/**
 * Resume an interrupted hunt from persisted state.
 */
export async function resumeHunt({
  huntId,
  brain = null,
  runner = {},
  hooks = {},
  logger = console,
}) {
  const planner = new TripleBrainPlanner({ brain, logger });
  const report = await LiveReport.load({ huntId, logger });
  const hunt = await planner.loadHunt(huntId);
  logger.info?.(
    `[huntRunner] resumed hunt ${huntId} at stage ${hunt.stage} with ${hunt.findings.length} findings`
  );
  // Continue stepping with the same wiring as runHunt.
  return runHuntContinuation({ planner, report, hunt, runner, hooks, logger });
}

async function runHuntContinuation({ planner, report, hunt, runner, hooks, logger }) {
  const toolRunner = createToolRunner({ logger, ...(runner || {}) });
  const runTool = async spec => {
    const res = await toolRunner.runTool(spec.tool, spec.targets, {
      profile: spec.profile || 'fast',
      onFinding: rec => {
        report
          .addFinding({
            title: rec.title || `${spec.tool} observation`,
            severity: rec.severity || 'informational',
            target: rec.target || rec.url || rec.host || '',
            description: rec.description || '',
            evidence: rec.evidence || '',
            source: spec.tool,
            templateId: rec.templateId,
            confidence: 'medium',
          })
          .then(stored => {
            if (stored) hooks.onFinding?.(stored);
          });
      },
    });
    return `TOOL ${spec.tool}: ${res.records.length} records, ${res.findings.length} findings.`;
  };
  const maxSteps = hooks.maxSteps || 40;
  let steps = 0;
  let done = false;
  let current = hunt;
  while (!done && steps < maxSteps) {
    const r = await planner.step(current, { runTool });
    current = r.hunt;
    done = r.done;
    steps++;
    if (r.task) hooks.onTask?.(r.task);
  }
  return { hunt: current, report, steps };
}

export default { runHunt, resumeHunt };
