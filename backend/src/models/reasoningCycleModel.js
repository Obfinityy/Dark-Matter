/**
 * ReasoningCycleModel — the persisted thinking loop (issue #1).
 *
 * Every autonomous reasoning step is a first-class record:
 *   observation → thought → plan → action → expected outcome
 *     → verification → adaptation → learning
 *
 * The worker opens a cycle BEFORE acting (persist-before-act), records the
 * verification after the action's outcome check, and records the adaptation
 * when the NEXT cycle opens (the next decision IS the adaptation). Learnings
 * accumulate per cycle so the brain gets smarter within a hunt.
 *
 * This is how "the brain always knows the full flow state, even after a
 * restart": recentSummaries() feeds the last cycles back into every prompt.
 */

import { id, now } from '../core/utils.js';

const OPEN_STATUSES = ['open', 'verified'];

function toSummary(cycle) {
  return {
    id: cycle.id,
    stepNumber: cycle.stepNumber,
    status: cycle.status,
    thought: cycle.thought || null,
    objective: cycle.objective || null,
    technique: cycle.technique || null,
    actionSummary: cycle.actionSummary || null,
    expectedOutcome: cycle.expectedOutcome || null,
    verification: cycle.verification || null,
    adaptation: cycle.adaptation || null,
    learning: cycle.learning || null,
    createdAt: cycle.createdAt,
  };
}

/** Database model for reasoning cycle. */
export class ReasoningCycleModel {
  constructor(database) {
    this.collection = database.collection('reasoning_cycles');
  }

  /**
   * Open a cycle for the upcoming reasoning step. The decision shape comes
   * from the brain: { objective, observation, nextAction, reason,
   * expectedOutcome, confidence, technique? }.
   */
  async openCycle({ userId, assessmentId, jobId, stepNumber, decision = {}, plan = null }) {
    if (!jobId) throw new Error('openCycle requires a jobId');
    const nextAction = decision.nextAction || {};
    const cycle = {
      id: id('rc'),
      userId: userId || null,
      assessmentId: assessmentId || null,
      jobId,
      stepNumber: Number(stepNumber) || 0,
      status: 'open',
      objective: decision.objective || null,
      observation: decision.observation || null,
      thought: decision.reason || null,
      plan: plan || decision.plan || null,
      technique: decision.technique || nextAction.technique || null,
      action: nextAction,
      actionSummary: nextAction.summary || nextAction.type || null,
      expectedOutcome: decision.expectedOutcome || null,
      confidence: decision.confidence ?? null,
      verification: null,
      adaptation: null,
      learning: null,
      learnings: [],
      createdAt: now(),
      updatedAt: now(),
    };
    await this.collection.insertOne(cycle);
    return { ...cycle };
  }

  /** The latest cycle still awaiting adaptation (open or verified). */
  async getOpenCycle(jobId) {
    if (!jobId) return null;
    const cycles = await this.collection
      .find({ jobId, status: { $in: OPEN_STATUSES } })
      .sort({ stepNumber: -1 })
      .limit(1)
      .toArray();
    return cycles[0] || null;
  }

  async recordVerification(cycleId, verification = {}) {
    const update = {
      verification: {
        outcome: verification.outcome || 'unknown',
        reason: verification.reason || null,
        at: now(),
      },
      status: 'verified',
      updatedAt: now(),
    };
    await this.collection.updateOne({ id: cycleId }, { $set: update });
    return this.collection.findOne({ id: cycleId });
  }

  async recordAdaptation(
    cycleId,
    { nextCycleId = null, nextObjective = null, nextReason = null } = {}
  ) {
    const update = {
      adaptation: { nextCycleId, nextObjective, nextReason, at: now() },
      status: 'closed',
      updatedAt: now(),
    };
    await this.collection.updateOne({ id: cycleId }, { $set: update });
    return this.collection.findOne({ id: cycleId });
  }

  async recordLearning(cycleId, { lesson }) {
    if (!lesson) return null;
    await this.collection.updateOne(
      { id: cycleId },
      {
        $set: { learning: lesson, updatedAt: now() },
        $push: { learnings: { lesson, at: now() } },
      }
    );
    return this.collection.findOne({ id: cycleId });
  }

  /** Compact summaries for prompt injection — the brain's working memory. */
  async recentSummaries(jobId, { limit = 6 } = {}) {
    const cycles = await this.listByJob(jobId, { limit });
    return cycles.map(toSummary);
  }

  async listByJob(jobId, { limit = 100 } = {}) {
    if (!jobId) return [];
    return this.collection
      .find({ jobId })
      .sort({ stepNumber: -1 })
      .limit(Math.min(Number(limit) || 100, 500))
      .toArray();
  }
}
