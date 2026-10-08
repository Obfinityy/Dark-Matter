import crypto from 'node:crypto';
import { id, now } from '../core/utils.js';

/**
 * EvidenceModel — the immutable evidence store.
 *
 * Report generation consumes evidence from here, never from the model's memory
 * (requirement #26, #28). Every record points at something that actually
 * happened: a tool execution, an HTTP exchange, a screenshot file, a computer
 * observation.
 */

export const EVIDENCE_KINDS = Object.freeze([
  'tool_output',
  'http_exchange',
  'screenshot',
  'computer_observation',
  'terminal_output',
  'file',
]);

export class EvidenceModel {
  constructor(database) {
    this.collection = database.collection('evidence');
  }

  /**
   * Deterministic identity for an evidence artifact so the same observation
   * captured twice does not inflate a report.
   */
  static fingerprint({
    kind,
    assessmentId,
    asset,
    endpoint,
    sha256,
    toolExecutionId,
    request,
    response,
  }) {
    const payload = JSON.stringify({
      kind,
      assessmentId,
      asset: asset ? String(asset).toLowerCase() : null,
      endpoint: endpoint || null,
      sha256: sha256 || null,
      toolExecutionId: toolExecutionId || null,
      request: request || null,
      response: response ? String(response).slice(0, 500) : null,
    });
    return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
  }

  async store(input) {
    const fingerprint = EvidenceModel.fingerprint(input);
    const existing = await this.collection.findOne({
      assessmentId: input.assessmentId,
      fingerprint,
    });
    if (existing) return { evidence: existing, deduplicated: true };

    const record = {
      id: id('ev'),
      fingerprint,
      userId: input.userId,
      assessmentId: input.assessmentId,
      jobId: input.jobId || null,
      findingId: input.findingId || null,
      toolExecutionId: input.toolExecutionId || null,
      observationId: input.observationId || null,
      kind: EVIDENCE_KINDS.includes(input.kind) ? input.kind : 'tool_output',
      asset: input.asset || null,
      endpoint: input.endpoint || null,
      method: input.method || null,
      request: input.request ? String(input.request).slice(0, 20_000) : null,
      response: input.response ? String(input.response).slice(0, 40_000) : null,
      summary: String(input.summary || '').slice(0, 2000),
      sha256: input.sha256 || null,
      artifactPath: input.artifactPath || null,
      metadata: input.metadata || {},
      capturedAt: input.capturedAt || now(),
      createdAt: now(),
    };
    await this.collection.insertOne(record);
    return { evidence: record, deduplicated: false };
  }

  async list(assessmentId) {
    return this.collection.find({ assessmentId }).sort({ createdAt: 1 }).limit(1000).toArray();
  }

  async listByJob(jobId) {
    return this.collection.find({ jobId }).sort({ createdAt: 1 }).limit(2000).toArray();
  }

  async listByFinding(findingId) {
    return this.collection.find({ findingId }).sort({ createdAt: 1 }).toArray();
  }

  async get(evidenceId) {
    return this.collection.findOne({ id: evidenceId });
  }

  async linkToFinding(findingId, evidenceIds = []) {
    for (const evidenceId of evidenceIds) {
      await this.collection.updateOne(
        { id: evidenceId },
        { $set: { findingId, updatedAt: now() } }
      );
    }
  }

  async count(assessmentId) {
    const rows = await this.list(assessmentId);
    return rows.length;
  }
}
