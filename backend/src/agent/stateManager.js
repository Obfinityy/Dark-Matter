/**
 * State Manager — loads, saves, and updates agent state with checkpointing.
 * Sits between the agent brain and MongoDB.
 */

export class StateManager {
  constructor({ agentStateModel, assessmentModel, eventService }) {
    this.agentStateModel = agentStateModel;
    this.assessmentModel = assessmentModel;
    this.eventService = eventService;
  }

  /** Initialize fresh state for a new assessment. */
  async initialize(assessmentId, userId, target, scope) {
    const state = await this.agentStateModel.initialize(assessmentId, userId, target, scope);
    await this.eventService.publish(assessmentId, {
      type: 'AGENT_STARTED',
      level: 'INFO',
      message: 'Agent state initialized',
      data: { target, scope }
    });
    return state;
  }

  /** Load existing state (for resume). */
  async load(assessmentId) {
    return this.agentStateModel.get(assessmentId);
  }

  /** Get compressed context for the LLM (never the full raw state). */
  async getContext(assessmentId, userId) {
    return this.agentStateModel.getContextSummary(assessmentId, userId);
  }

  /** Update state after a tool result — dispatch to appropriate state update method. */
  async applyToolResult(assessmentId, toolName, parsedResult) {
    // Extract subdomains
    if (parsedResult.subdomains?.length) {
      await this.agentStateModel.addSubdomains(assessmentId, parsedResult.subdomains);
    }

    // Extract items that look like URLs
    if (parsedResult.items?.length) {
      const urls = parsedResult.items.filter(item => typeof item === 'string' && /^https?:\/\//i.test(item));
      const domains = parsedResult.items.filter(item => typeof item === 'string' && !item.includes('://') && item.includes('.'));

      if (urls.length) await this.agentStateModel.addEndpoints(assessmentId, urls);
      if (domains.length) await this.agentStateModel.addSubdomains(assessmentId, domains);
    }

    // Extract JSON items with structured data (httpx, nuclei, etc.)
    if (parsedResult.items?.length && typeof parsedResult.items[0] === 'object') {
      const techs = [];
      const endpoints = [];
      for (const item of parsedResult.items) {
        if (item.url) endpoints.push(item.url);
        if (item.tech) techs.push(...(Array.isArray(item.tech) ? item.tech : [item.tech]));
        if (item.technologies) techs.push(...(Array.isArray(item.technologies) ? item.technologies : [item.technologies]));
      }
      if (endpoints.length) await this.agentStateModel.addEndpoints(assessmentId, endpoints);
      if (techs.length) await this.agentStateModel.addTechnologies(assessmentId, techs);
    }

    // Record as observation
    await this.agentStateModel.addObservation(assessmentId, {
      tool: toolName,
      type: 'tool_result',
      summary: `${toolName} returned ${JSON.stringify(parsedResult).length} bytes of structured data`
    });
  }

  /** Record a completed action. */
  async recordAction(assessmentId, action) {
    await this.agentStateModel.addCompletedAction(assessmentId, action);
  }

  /** Record a failed action. */
  async recordFailedAction(assessmentId, action) {
    await this.agentStateModel.addFailedAction(assessmentId, action);
  }

  /** Checkpoint — persist current state marker. */
  async checkpoint(assessmentId, phase) {
    await this.agentStateModel.checkpoint(assessmentId);
    if (phase) {
      await this.agentStateModel.update(assessmentId, { phase });
      await this.assessmentModel.setPhase(assessmentId, phase);
    }
    await this.eventService.publish(assessmentId, {
      type: 'CHECKPOINT_SAVED',
      level: 'INFO',
      message: `State checkpoint saved${phase ? ` — phase: ${phase}` : ''}`,
      data: { phase }
    });
  }

  /** Update phase. */
  async setPhase(assessmentId, phase) {
    await this.agentStateModel.update(assessmentId, { phase });
    await this.assessmentModel.setPhase(assessmentId, phase);
    await this.eventService.publish(assessmentId, {
      type: 'PHASE_CHANGED',
      level: 'INFO',
      message: `Investigation phase changed to: ${phase}`,
      data: { phase }
    });
  }

  /** Increment iteration counter. */
  async incrementIteration(assessmentId) {
    await this.agentStateModel.incrementIteration(assessmentId);
  }

  /** Add a hypothesis. */
  async addHypothesis(assessmentId, hypothesis) {
    const hyp = await this.agentStateModel.addHypothesis(assessmentId, hypothesis);
    await this.eventService.publish(assessmentId, {
      type: 'HYPOTHESIS_CREATED',
      level: 'INFO',
      message: `New hypothesis: ${hypothesis.hypothesis || hypothesis.description || 'unnamed'}`,
      data: { hypothesisId: hyp.id }
    });
    return hyp;
  }
}
