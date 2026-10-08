/**
 * reportModel — database model for report.
 * Schema definition and data-access methods for report records.
 * Part of: Infinity AI / Dark-Matter backend (database models).
 */

import { id, now } from '../core/utils.js';

/**
 * ReportModel — professional security assessment reports with versioning.
 * Each report version is immutable once created; new versions are appended.
 * Every claim in the report must reference stored evidence.
 */
export class ReportModel {
  constructor(database) {
    this.collection = database.collection('reports');
  }

  async list(assessmentId) {
    return this.collection.find({ assessmentId }).sort({ createdAt: -1 }).toArray();
  }

  async listByUser(userId) {
    return this.collection.find({ userId }).sort({ createdAt: -1 }).limit(50).toArray();
  }

  async get(reportId) {
    return this.collection.findOne({ id: reportId });
  }

  async getLatest(assessmentId) {
    const reports = await this.collection
      .find({ assessmentId })
      .sort({ version: -1 })
      .limit(1)
      .toArray();
    return reports[0] || null;
  }

  async create(assessmentId, userId, input) {
    // Determine version number
    const existing = await this.list(assessmentId);
    const version = existing.length + 1;

    const report = {
      id: id('report'),
      assessmentId,
      userId,
      version,
      status: 'generated',

      // Report sections
      title: input.title || 'Security Assessment Report',
      executiveSummary: input.executiveSummary || '',
      scope: input.scope || {},
      methodology: input.methodology || '',
      testingTimeline: input.testingTimeline || [],
      assetsTested: input.assetsTested || [],
      attackSurface: input.attackSurface || {},
      findingsSummary: input.findingsSummary || {},
      detailedFindings: input.detailedFindings || [],
      riskContext: input.riskContext || '',
      limitations: input.limitations || '',
      toolingSummary: input.toolingSummary || [],
      appendix: input.appendix || [],

      // Evidence-backed sections (autonomous bug-bounty report)
      testingCoverage: input.testingCoverage || {},
      unverifiedObservations: input.unverifiedObservations || [],
      conclusion: input.conclusion || '',
      evidenceIndex: input.evidenceIndex || [],
      evidenceCount: input.evidenceCount || 0,
      validatedCount: input.validatedCount || 0,

      // Metadata
      targetHostname: input.targetHostname || '',
      totalFindings: input.totalFindings || 0,
      criticalCount: input.criticalCount || 0,
      highCount: input.highCount || 0,
      mediumCount: input.mediumCount || 0,
      lowCount: input.lowCount || 0,
      informationalCount: input.informationalCount || 0,

      // Timestamps
      createdAt: now(),
      updatedAt: now(),
    };
    await this.collection.insertOne(report);
    return report;
  }

  async update(reportId, patch) {
    await this.collection.updateOne({ id: reportId }, { $set: { ...patch, updatedAt: now() } });
  }
}
