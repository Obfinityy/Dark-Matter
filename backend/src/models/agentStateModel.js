import { id, now } from '../core/utils.js';

/**
 * AgentStateModel — persisted structured state for each assessment.
 * This is the agent's "long-term memory" — NOT the LLM context window.
 */
export class AgentStateModel {
  constructor(database) {
    this.collection = database.collection('agent_states');
  }

  async get(assessmentId, userId) {
    return this.collection.findOne({ assessmentId, ...(userId ? { userId } : {}) });
  }

  async initialize(assessmentId, userId, target, scope) {
    const state = {
      id: id('state'),
      assessmentId,
      userId,
      target,
      scope,
      phase: 'initializing',
      status: 'created',

      // Discovered assets
      knownAssets: [],
      subdomains: [],
      endpoints: [],
      technologies: [],
      parameters: [],
      openPorts: [],
      httpServices: [],
      authenticationContext: {},

      // Reasoning state
      hypotheses: [],
      testedHypotheses: [],
      findings: [],
      evidence: [],

      // Action tracking
      completedActions: [],
      pendingActions: [],
      failedActions: [],

      // Results
      toolResults: [],
      observations: [],

      // Current plan
      currentPlan: null,
      nextAction: null,
      investigationHistory: [],

      // Iteration tracking
      iterationCount: 0,
      lastIterationAt: null,

      // Metadata
      createdAt: now(),
      updatedAt: now(),
      lastCheckpointAt: null,
    };
    await this.collection.insertOne(state);
    return state;
  }

  async update(assessmentId, patch) {
    await this.collection.updateOne({ assessmentId }, { $set: { ...patch, updatedAt: now() } });
  }

  async checkpoint(assessmentId) {
    await this.collection.updateOne(
      { assessmentId },
      { $set: { lastCheckpointAt: now(), updatedAt: now() } }
    );
  }

  async addSubdomains(assessmentId, newSubdomains) {
    if (!newSubdomains?.length) return;
    await this.collection.updateOne(
      { assessmentId },
      { $addToSet: { subdomains: { $each: newSubdomains } }, $set: { updatedAt: now() } }
    );
  }

  async addEndpoints(assessmentId, newEndpoints) {
    if (!newEndpoints?.length) return;
    await this.collection.updateOne(
      { assessmentId },
      { $addToSet: { endpoints: { $each: newEndpoints } }, $set: { updatedAt: now() } }
    );
  }

  async addTechnologies(assessmentId, newTechs) {
    if (!newTechs?.length) return;
    await this.collection.updateOne(
      { assessmentId },
      { $addToSet: { technologies: { $each: newTechs } }, $set: { updatedAt: now() } }
    );
  }

  async addObservation(assessmentId, observation) {
    const obs = { id: id('obs'), ...observation, createdAt: now() };
    await this.collection.updateOne(
      { assessmentId },
      { $push: { observations: obs }, $set: { updatedAt: now() } }
    );
    return obs;
  }

  async addCompletedAction(assessmentId, action) {
    await this.collection.updateOne(
      { assessmentId },
      {
        $push: {
          completedActions: { ...action, completedAt: now() },
          investigationHistory: {
            action: action.description || action.tool,
            timestamp: now(),
            result: action.resultSummary || 'completed',
          },
        },
        $set: { updatedAt: now() },
      }
    );
  }

  async addFailedAction(assessmentId, action) {
    await this.collection.updateOne(
      { assessmentId },
      {
        $push: { failedActions: { ...action, failedAt: now() } },
        $set: { updatedAt: now() },
      }
    );
  }

  async addHypothesis(assessmentId, hypothesis) {
    const hyp = {
      id: id('hyp'),
      ...hypothesis,
      status: 'UNTESTED',
      confidence: 0,
      evidenceFor: [],
      evidenceAgainst: [],
      testsPerformed: [],
      createdAt: now(),
    };
    await this.collection.updateOne(
      { assessmentId },
      { $push: { hypotheses: hyp }, $set: { updatedAt: now() } }
    );
    return hyp;
  }

  async updateHypothesis(assessmentId, hypothesisId, patch) {
    await this.collection.updateOne(
      { assessmentId, 'hypotheses.id': hypothesisId },
      { $set: { 'hypotheses.$': { ...patch, id: hypothesisId }, updatedAt: now() } }
    );
  }

  async incrementIteration(assessmentId) {
    await this.collection.updateOne(
      { assessmentId },
      { $inc: { iterationCount: 1 }, $set: { lastIterationAt: now(), updatedAt: now() } }
    );
  }

  /** Build a compressed context summary for the LLM — never send the entire raw state. */
  async getContextSummary(assessmentId, userId) {
    const state = await this.get(assessmentId, userId);
    if (!state) return null;
    return {
      target: state.target,
      scope: state.scope,
      phase: state.phase,
      iterationCount: state.iterationCount,
      subdomainCount: state.subdomains.length,
      subdomains: state.subdomains.slice(0, 50),
      endpointCount: state.endpoints.length,
      endpoints: state.endpoints.slice(0, 30),
      technologies: state.technologies.slice(0, 20),
      openPorts: state.openPorts.slice(0, 30),
      recentObservations: state.observations.slice(-15),
      activeHypotheses: state.hypotheses
        .filter(h => h.status === 'INVESTIGATING' || h.status === 'UNTESTED')
        .slice(0, 10),
      findings: state.findings.slice(0, 20),
      completedToolNames: state.completedActions.map(a => a.tool).filter(Boolean),
      failedToolNames: state.failedActions.map(a => a.tool).filter(Boolean),
      lastActions: state.investigationHistory.slice(-10),
    };
  }
}
