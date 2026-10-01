import { id, now } from '../core/utils.js';

/**
 * ComputerActionModel — persists every computer ("hands") action the
 * autonomous agent takes, per issue #1 "Persistence":
 *
 *   jobId, assessmentId, action, params, timestamp, result, observation,
 *   success/failure, error, and the next decision taken afterwards.
 *
 * The worker also keeps emitting events, evidence and episodic memory, but
 * those are streams — this is the structured ledger that lets a human (or a
 * future brain) reconstruct exactly what the hands did, in order, and what
 * the brain decided next. Backend-owned: it keeps working when the frontend
 * closes (issue #1 "Backend must continue").
 */
export class ComputerActionModel {
  constructor(database) {
    this.collection = database.collection('computer_actions');
  }

  /** Persist the action *before* it runs, so an interrupted action is still on record. */
  async record({ jobId, assessmentId, userId, action, params = {}, expectedOutcome = null, decision = null }) {
    const entry = {
      id: id('caction'),
      jobId,
      assessmentId,
      userId,
      action: action?.type || action || 'unknown',
      params,
      expectedOutcome,
      // The decision that led to this action.
      decision: decision
        ? {
            objective: decision.objective || null,
            reason: decision.reason || null,
            expectedOutcome: decision.expectedOutcome || null
          }
        : null,
      status: 'started',
      // Filled in by markFinished().
      ok: null,
      output: null,
      observation: null,
      followUpObservation: null,
      outcomeCheck: null,
      error: null,
      durationMs: null,
      recoveryAdvice: [],
      // The brain's next decision after seeing this action's outcome.
      nextDecision: null,
      startedAt: now(),
      finishedAt: null,
      createdAt: now(),
      updatedAt: now()
    };
    await this.collection.insertOne(entry);
    return entry;
  }

  async markFinished(recordId, {
    ok,
    output = null,
    observation = null,
    followUpObservation = null,
    outcomeCheck = null,
    error = null,
    durationMs = null,
    recoveryAdvice = []
  } = {}) {
    await this.collection.updateOne(
      { id: recordId },
      {
        $set: {
          status: ok ? 'completed' : 'failed',
          ok,
          output,
          observation,
          followUpObservation,
          outcomeCheck,
          error,
          durationMs,
          recoveryAdvice,
          finishedAt: now(),
          updatedAt: now()
        }
      }
    );
  }

  /** Link the brain's next decision once it is made, closing the observe→decide loop. */
  async linkNextDecision(recordId, decision) {
    if (!recordId || !decision) return;
    await this.collection.updateOne(
      { id: recordId },
      {
        $set: {
          nextDecision: {
            objective: decision.objective || null,
            reason: decision.reason || null,
            nextActionType: decision.nextAction?.type || decision.action?.type || null,
            status: decision.status || null
          },
          updatedAt: now()
        }
      }
    );
  }

  async listByJob(jobId, limit = 200) {
    return this.collection.find({ jobId }).sort({ startedAt: 1 }).limit(limit).toArray();
  }

  async listByAssessment(assessmentId, limit = 200) {
    return this.collection.find({ assessmentId }).sort({ startedAt: 1 }).limit(limit).toArray();
  }

  async get(recordId) {
    return this.collection.findOne({ id: recordId });
  }
}
