/**
 * assessmentModel — database model for assessment.
 * Schema definition and data-access methods for assessment records.
 * Part of: Infinity AI / Dark-Matter backend (database models).
 */

import { assert } from '../core/errors.js';
import { id, now } from '../core/utils.js';

const VALID_STATUSES = [
  'created',
  'scope_validation',
  'planning',
  'running',
  'paused',
  'completed',
  'failed',
  'stopped',
];
const VALID_PHASES = [
  'initializing',
  'scope_validation',
  'planning',
  'passive_recon',
  'active_recon',
  'dns_enumeration',
  'subdomain_enumeration',
  'http_discovery',
  'technology_detection',
  'endpoint_discovery',
  'content_discovery',
  'parameter_discovery',
  'javascript_analysis',
  'certificate_analysis',
  'vulnerability_detection',
  'configuration_analysis',
  'authentication_testing',
  'authorization_testing',
  'api_security_testing',
  'evidence_collection',
  'report_generation',
  'completed',
  'failed',
];

/** Database model for assessment. */
export class AssessmentModel {
  constructor(database) {
    this.collection = database.collection('assessments');
  }

  async list(userId) {
    return this.collection.find({ userId }).sort({ createdAt: -1 }).toArray();
  }

  async get(userId, assessmentId) {
    const assessment = await this.collection.findOne({ id: assessmentId, userId });
    assert(
      assessment && assessment.userId === userId,
      404,
      'Assessment not found',
      'ASSESSMENT_NOT_FOUND'
    );
    return assessment;
  }

  async getInternal(assessmentId) {
    return this.collection.findOne({ id: assessmentId });
  }

  async create(userId, input) {
    const assessment = {
      id: id('assess'),
      userId,
      targetId: input.targetId,
      targetUrl: input.targetUrl,
      targetHostname: input.targetHostname,
      scope: input.scope || { included: [], excluded: [] },
      status: 'created',
      phase: 'initializing',
      mode: String(input.mode || 'NORMAL').toUpperCase(),

      // Counters
      assetsDiscovered: 0,
      endpointsDiscovered: 0,
      toolsExecuted: 0,
      findingsCount: 0,
      iterationCount: 0,

      // Timestamps
      createdAt: now(),
      updatedAt: now(),
      startedAt: null,
      completedAt: null,
      pausedAt: null,

      // Chat messages
      messages: input.message
        ? [
            {
              id: id('msg'),
              role: 'user',
              content: String(input.message).slice(0, 6000),
              createdAt: now(),
            },
          ]
        : [],

      // Error tracking
      error: null,
      lastCheckpoint: null,
    };
    await this.collection.insertOne(assessment);
    return assessment;
  }

  async update(assessmentId, patch) {
    const updatePatch = { ...patch, updatedAt: now() };
    await this.collection.updateOne({ id: assessmentId }, { $set: updatePatch });
  }

  async addMessage(assessmentId, role, content) {
    const message = {
      id: id('msg'),
      role,
      content: String(content).slice(0, 10_000),
      createdAt: now(),
    };
    await this.collection.updateOne(
      { id: assessmentId },
      { $push: { messages: message }, $set: { updatedAt: now() } }
    );
    return message;
  }

  async setStatus(assessmentId, status, extra = {}) {
    assert(VALID_STATUSES.includes(status), 400, `Invalid status: ${status}`, 'INVALID_STATUS');
    const patch = { status, updatedAt: now(), ...extra };
    if (status === 'running' && !extra.startedAt) patch.startedAt = now();
    if (status === 'completed') patch.completedAt = now();
    if (status === 'paused') patch.pausedAt = now();
    await this.collection.updateOne({ id: assessmentId }, { $set: patch });
  }

  async setPhase(assessmentId, phase) {
    assert(VALID_PHASES.includes(phase), 400, `Invalid phase: ${phase}`, 'INVALID_PHASE');
    await this.collection.updateOne({ id: assessmentId }, { $set: { phase, updatedAt: now() } });
  }

  async incrementCounters(assessmentId, counters = {}) {
    const inc = {};
    for (const [key, value] of Object.entries(counters)) {
      if (typeof value === 'number' && value > 0) inc[key] = value;
    }
    if (Object.keys(inc).length) {
      await this.collection.updateOne(
        { id: assessmentId },
        { $inc: inc, $set: { updatedAt: now() } }
      );
    }
  }
}

export { VALID_STATUSES, VALID_PHASES };
