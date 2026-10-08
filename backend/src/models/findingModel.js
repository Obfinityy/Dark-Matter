import { id, now } from '../core/utils.js';

const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low', 'informational'];
const VALID_FINDING_STATUSES = [
  'potential',
  'investigating',
  'validated',
  'false_positive',
  'duplicate',
  'accepted',
];

/**
 * FindingModel — vulnerability findings with full evidence chains.
 * A finding is NOT created until sufficient evidence exists.
 */
export class FindingModel {
  constructor(database) {
    this.collection = database.collection('findings');
  }

  async list(assessmentId) {
    return this.collection.find({ assessmentId }).sort({ createdAt: -1 }).toArray();
  }

  async listByUser(userId) {
    return this.collection.find({ userId }).sort({ createdAt: -1 }).limit(100).toArray();
  }

  async get(findingId) {
    return this.collection.findOne({ id: findingId });
  }

  async create(assessmentId, userId, input) {
    const finding = {
      id: id('find'),
      assessmentId,
      userId,
      status: 'potential',
      severity: VALID_SEVERITIES.includes(input.severity) ? input.severity : 'informational',
      confidence: Math.max(0, Math.min(1, input.confidence || 0)),
      title: String(input.title || 'Untitled Finding').slice(0, 300),
      category: input.category || 'uncategorized',
      affectedAsset: input.affectedAsset || null,
      affectedEndpoint: input.affectedEndpoint || null,
      parameter: input.parameter || null,
      description: String(input.description || '').slice(0, 5000),
      impact: String(input.impact || '').slice(0, 2000),
      reproductionSteps: input.reproductionSteps || [],
      expectedBehavior: input.expectedBehavior || '',
      observedBehavior: input.observedBehavior || '',
      remediation: String(input.remediation || '').slice(0, 2000),
      references: input.references || [],
      evidence: input.evidence || [],
      observationIds: input.observationIds || [],
      toolExecutionIds: input.toolExecutionIds || [],
      hypothesisId: input.hypothesisId || null,
      cvss: input.cvss || null, // auto-scored {score,rating,vector,source} — never hardcoded
      cvssMetrics: input.cvssMetrics || null, // brain-supplied metrics (or null when defaults were used)
      createdAt: now(),
      updatedAt: now(),
      validatedAt: null,
    };
    await this.collection.insertOne(finding);
    return finding;
  }

  async updateStatus(findingId, status) {
    const patch = { status, updatedAt: now() };
    if (status === 'validated') patch.validatedAt = now();
    await this.collection.updateOne({ id: findingId }, { $set: patch });
  }

  async addEvidence(findingId, evidence) {
    const ev = { id: id('ev'), ...evidence, addedAt: now() };
    await this.collection.updateOne(
      { id: findingId },
      { $push: { evidence: ev }, $set: { updatedAt: now() } }
    );
    return ev;
  }

  async update(findingId, patch) {
    await this.collection.updateOne({ id: findingId }, { $set: { ...patch, updatedAt: now() } });
  }
}

export { VALID_SEVERITIES, VALID_FINDING_STATUSES };
