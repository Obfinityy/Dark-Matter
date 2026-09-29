import { config } from '../config.js';
import { validateDecision } from './decisionSchema.js';

/**
 * Agent Brain — the main orchestration loop.
 *
 * This is the "nervous system" that:
 *   1. Loads persisted state
 *   2. Asks the planner (AI) for the next action
 *   3. Validates the decision against scope and policy
 *   4. Executes the tool through the controlled executor
 *   5. Parses and stores the result
 *   6. Updates state
 *   7. Checkpoints
 *   8. Repeats until done or budget exhausted
 *
 * The brain runs asynchronously and independently of the HTTP request.
 * The frontend observes progress through SSE events.
 */
export class AgentBrain {
  constructor({ stateManager, planner, toolExecutor, scopeEngine, eventService, assessmentModel, findingModel }) {
    this.stateManager = stateManager;
    this.planner = planner;
    this.toolExecutor = toolExecutor;
    this.scopeEngine = scopeEngine;
    this.eventService = eventService;
    this.assessmentModel = assessmentModel;
    this.findingModel = findingModel;

    // Track running assessments so we can pause/stop
    this.runningAssessments = new Map(); // assessmentId → { abortController }
  }

  /** Start the investigation loop for an assessment. */
  async start(assessmentId, userId) {
    // Prevent duplicate runs
    if (this.runningAssessments.has(assessmentId)) {
      return { status: 'already_running' };
    }

    const abortController = new AbortController();
    this.runningAssessments.set(assessmentId, { abortController });

    // Run the loop in the background — not blocking the HTTP response
    this.runLoop(assessmentId, userId, abortController.signal).catch(error => {
      console.error(`Agent loop crashed for ${assessmentId}:`, error.message);
      this.assessmentModel.setStatus(assessmentId, 'failed', { error: error.message }).catch(() => {});
      this.eventService.publish(assessmentId, {
        type: 'AGENT_CRASHED',
        level: 'ERROR',
        message: `Agent loop crashed: ${error.message}`,
        data: { error: error.message }
      }).catch(() => {});
    }).finally(() => {
      this.runningAssessments.delete(assessmentId);
    });

    return { status: 'started' };
  }

  /** Stop a running assessment. */
  stop(assessmentId) {
    const running = this.runningAssessments.get(assessmentId);
    if (running) {
      running.abortController.abort();
      this.runningAssessments.delete(assessmentId);
      return true;
    }
    return false;
  }

  /** Pause a running assessment. */
  async pause(assessmentId) {
    const stopped = this.stop(assessmentId);
    if (stopped) {
      await this.stateManager.checkpoint(assessmentId);
      await this.assessmentModel.setStatus(assessmentId, 'paused');
      await this.eventService.publish(assessmentId, {
        type: 'ASSESSMENT_PAUSED',
        level: 'INFO',
        message: 'Assessment paused — checkpoint saved'
      });
    }
    return stopped;
  }

  /** Resume a paused assessment. */
  async resume(assessmentId, userId) {
    const assessment = await this.assessmentModel.getInternal(assessmentId);
    if (!assessment) return { status: 'not_found' };
    if (assessment.status !== 'paused') return { status: 'not_paused' };

    await this.assessmentModel.setStatus(assessmentId, 'running');
    await this.eventService.publish(assessmentId, {
      type: 'ASSESSMENT_RESUMED',
      level: 'INFO',
      message: 'Assessment resumed from checkpoint'
    });

    return this.start(assessmentId, userId);
  }

  /** Is a given assessment currently running? */
  isRunning(assessmentId) {
    return this.runningAssessments.has(assessmentId);
  }

  // ─── Main Investigation Loop ─────────────────────────────────────────

  async runLoop(assessmentId, userId, signal) {
    await this.assessmentModel.setStatus(assessmentId, 'running');

    let lastAiSummary = null;
    let iteration = 0;

    while (!signal.aborted && iteration < config.agentMaxIterations) {
      iteration++;
      await this.stateManager.incrementIteration(assessmentId);

      await this.eventService.publish(assessmentId, {
        type: 'AGENT_DECISION',
        level: 'INFO',
        message: `Agent iteration ${iteration}/${config.agentMaxIterations} — analyzing state...`,
        data: { iteration, maxIterations: config.agentMaxIterations }
      });

      // 1. Load compressed context
      const context = await this.stateManager.getContext(assessmentId, userId);
      if (!context) {
        await this.fail(assessmentId, 'Agent state not found');
        return;
      }

      // 2. Ask planner for next decision
      let decision;
      try {
        decision = await this.planner.decide(context, lastAiSummary, userId);
      } catch (error) {
        console.error('Planner failed:', error.message);
        await this.eventService.publish(assessmentId, {
          type: 'AGENT_DECISION',
          level: 'WARN',
          message: `Planner error: ${error.message} — retrying next iteration`,
          data: { error: error.message }
        });
        await this.delay(signal);
        continue;
      }

      // 3. Validate structured decision
      const validation = validateDecision(decision);
      if (!validation.valid) {
        console.error('Invalid decision:', validation.errors);
        await this.eventService.publish(assessmentId, {
          type: 'AGENT_DECISION',
          level: 'WARN',
          message: `Invalid decision format — ${validation.errors.join(', ')}`,
          data: { errors: validation.errors }
        });
        await this.delay(signal);
        continue;
      }

      // 4. Log the decision
      await this.eventService.publish(assessmentId, {
        type: 'AGENT_DECISION',
        level: 'INFO',
        message: `Decision: ${decision.selected_action.description || decision.selected_action.type}`,
        data: {
          action: decision.selected_action,
          reason: decision.reason,
          phase: decision.phase
        }
      });

      // 5. Handle phase change
      if (decision.phase && decision.phase !== context.phase) {
        await this.stateManager.setPhase(assessmentId, decision.phase);
      }

      // 6. Process the action
      const action = decision.selected_action;

      if (action.type === 'complete') {
        await this.complete(assessmentId);
        return;
      }

      if (action.type === 'tool_execution') {
        lastAiSummary = await this.executeToolAction(assessmentId, userId, action, signal);
      } else if (action.type === 'observation') {
        await this.stateManager.checkpoint(assessmentId, context.phase);
        lastAiSummary = `Observation recorded: ${action.description || 'unnamed'}`;
      } else if (action.type === 'hypothesis') {
        await this.stateManager.addHypothesis(assessmentId, {
          hypothesis: action.description,
          type: action.category || 'general'
        });
        lastAiSummary = `Hypothesis created: ${action.description}`;
      } else if (action.type === 'finding') {
        await this.createFinding(assessmentId, userId, action);
        lastAiSummary = `Finding created: ${action.description}`;
      }

      // 7. Checkpoint every 3 iterations
      if (iteration % 3 === 0) {
        await this.stateManager.checkpoint(assessmentId, decision.phase || context.phase);
      }

      // 8. Update assessment counters
      const updatedContext = await this.stateManager.getContext(assessmentId);
      if (updatedContext) {
        await this.assessmentModel.update(assessmentId, {
          assetsDiscovered: updatedContext.subdomainCount,
          endpointsDiscovered: updatedContext.endpointCount,
          iterationCount: iteration
        });
      }

      // 9. Delay between iterations
      await this.delay(signal);
    }

    // Loop ended — max iterations reached
    if (!signal.aborted) {
      await this.complete(assessmentId, 'Maximum iterations reached');
    }
  }

  /** Execute a tool action through the controlled executor. */
  async executeToolAction(assessmentId, userId, action, signal) {
    if (signal.aborted) return 'Assessment stopped';

    try {
      const result = await this.toolExecutor.execute(assessmentId, userId, {
        tool: action.tool,
        target: action.target,
        arguments: action.arguments || {},
        timeout: action.timeout
      });

      // Update agent state with parsed results
      await this.stateManager.applyToolResult(assessmentId, action.tool, result.parsed);
      await this.stateManager.recordAction(assessmentId, {
        tool: action.tool,
        target: action.target,
        description: action.description,
        resultSummary: result.aiSummary?.slice(0, 200),
        deduplicated: result.deduplicated
      });

      // Increment tools counter
      if (!result.deduplicated) {
        await this.assessmentModel.incrementCounters(assessmentId, { toolsExecuted: 1 });
      }

      return result.aiSummary;

    } catch (error) {
      await this.stateManager.recordFailedAction(assessmentId, {
        tool: action.tool,
        target: action.target,
        error: error.message
      });
      return `Tool ${action.tool} failed: ${error.message}`;
    }
  }

  /** Mark assessment as completed. */
  async complete(assessmentId, reason = 'Investigation objectives satisfied') {
    await this.stateManager.checkpoint(assessmentId, 'completed');
    await this.assessmentModel.setStatus(assessmentId, 'completed');
    await this.eventService.publish(assessmentId, {
      type: 'ASSESSMENT_COMPLETED',
      level: 'INFO',
      message: `Assessment completed — ${reason}`,
      data: { reason }
    });
  }

  /** Mark assessment as failed. */
  async fail(assessmentId, reason) {
    await this.assessmentModel.setStatus(assessmentId, 'failed', { error: reason });
    await this.eventService.publish(assessmentId, {
      type: 'ASSESSMENT_FAILED',
      level: 'ERROR',
      message: `Assessment failed: ${reason}`,
      data: { reason }
    });
  }

  /** Create a finding from an agent decision. */
  async createFinding(assessmentId, userId, action) {
    const finding = await this.findingModel.create(assessmentId, userId, {
      title: action.description || 'Untitled Finding',
      severity: action.severity || 'informational',
      category: action.category || 'uncategorized',
      description: action.details || action.description,
      affectedAsset: action.target,
      confidence: action.confidence || 0.5
    });
    await this.assessmentModel.incrementCounters(assessmentId, { findingsCount: 1 });
    await this.eventService.publish(assessmentId, {
      type: 'FINDING_CREATED',
      level: 'WARN',
      message: `Potential finding: ${finding.title}`,
      data: { findingId: finding.id, severity: finding.severity }
    });
    return finding;
  }

  /** Sleep between iterations — respects abort signal. */
  delay(signal) {
    return new Promise(resolve => {
      if (signal.aborted) return resolve();
      const timer = setTimeout(resolve, config.agentIterationDelayMs);
      signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
    });
  }
}
