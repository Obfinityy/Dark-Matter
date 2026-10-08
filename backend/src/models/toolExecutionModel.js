import crypto from 'node:crypto';
import { id, now } from '../core/utils.js';

/**
 * ToolExecutionModel — records every tool execution with input, output, timing, and a
 * deterministic fingerprint used for deduplication.
 */
export class ToolExecutionModel {
  constructor(database) {
    this.collection = database.collection('tool_executions');
  }

  async list(assessmentId) {
    return this.collection.find({ assessmentId }).sort({ startedAt: -1 }).limit(200).toArray();
  }

  async get(executionId) {
    return this.collection.findOne({ id: executionId });
  }

  /** Generate a deterministic fingerprint so the agent never repeats identical work. */
  static fingerprint(tool, target, args) {
    const payload = JSON.stringify({ tool, target: String(target).toLowerCase(), args });
    return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
  }

  async findByFingerprint(assessmentId, fingerprint) {
    return this.collection.findOne({ assessmentId, fingerprint, status: 'completed' });
  }

  async create(assessmentId, userId, input) {
    const fingerprint = ToolExecutionModel.fingerprint(input.tool, input.target, input.arguments);
    const execution = {
      id: id('exec'),
      assessmentId,
      userId,
      tool: input.tool,
      category: input.category || 'unknown',
      target: input.target,
      arguments: input.arguments || {},
      fingerprint,
      status: 'queued',
      riskLevel: input.riskLevel || 'low',

      // Output
      rawOutput: null,
      normalizedOutput: null,
      aiSummary: null,
      outputSizeBytes: 0,
      parsedResults: null,

      // Timing
      startedAt: null,
      completedAt: null,
      duration: null,
      timeoutMs: input.timeoutMs || 120_000,

      // Error
      error: null,
      retryCount: 0,
      maxRetries: input.maxRetries || 2,

      createdAt: now(),
      updatedAt: now(),
    };
    await this.collection.insertOne(execution);
    return execution;
  }

  async markStarted(executionId) {
    await this.collection.updateOne(
      { id: executionId },
      { $set: { status: 'running', startedAt: now(), updatedAt: now() } }
    );
  }

  async markCompleted(executionId, output) {
    const completedAt = now();
    const execution = await this.get(executionId);
    const startedMs = execution?.startedAt ? new Date(execution.startedAt).getTime() : Date.now();
    const duration = (Date.now() - startedMs) / 1000;
    await this.collection.updateOne(
      { id: executionId },
      {
        $set: {
          status: 'completed',
          rawOutput: output.raw || null,
          normalizedOutput: output.normalized || null,
          aiSummary: output.aiSummary || null,
          parsedResults: output.parsed || null,
          outputSizeBytes: output.raw ? Buffer.byteLength(output.raw, 'utf8') : 0,
          completedAt,
          duration,
          updatedAt: now(),
        },
      }
    );
  }

  async markFailed(executionId, error) {
    await this.collection.updateOne(
      { id: executionId },
      {
        $set: {
          status: 'failed',
          error: String(error).slice(0, 2000),
          completedAt: now(),
          updatedAt: now(),
        },
        $inc: { retryCount: 1 },
      }
    );
  }
}
