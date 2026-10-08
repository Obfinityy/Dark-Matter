/**
 * Hunt Record Model — the database side of the hybrid storage design.
 *
 * Two storage jobs, each where it belongs:
 *   - WORKING MEMORY → local files in the app-data dir (services/fileMemory.js),
 *     per task/chat, read and written by the agent itself while a hunt runs.
 *   - PERSISTENT ARTIFACTS → this collection. Completed hunt records and the
 *     final report (Markdown) live in the database forever. The DB is the
 *     source of truth for "what have we already hunted" and powers:
 *       1. Target dedup — paste a link, we check here first and return the
 *          existing report instantly instead of re-running the agent.
 *       2. Report history — browse and re-download any past report.
 *
 * One target can have many records (versioned): each fresh hunt the user
 * explicitly starts saves a new version. Dedup always returns the LATEST
 * completed version.
 */
import { id, now } from '../core/utils.js';

const PUBLIC_FIELDS = [
  'id',
  'userId',
  'target',
  'targetCanonical',
  'targetHash',
  'version',
  'jobId',
  'assessmentId',
  'summary',
  'findings',
  'completedAt',
  'createdAt',
];

function publicRecord(record) {
  if (!record) return null;
  const view = {};
  for (const field of PUBLIC_FIELDS) view[field] = record[field];
  return view;
}

/** Database model for hunt record. */
export class HuntRecordModel {
  constructor(database) {
    this.collection = database.collection('hunt_records');
  }

  /**
   * Persist a completed hunt's final report. version is assigned as
   * (existing versions for this user+target) + 1.
   */
  async create({
    userId,
    target,
    targetCanonical,
    targetHash,
    jobId = null,
    assessmentId = null,
    reportMarkdown,
    summary = {},
    findings = [],
  }) {
    const version = (await this.countByTarget(userId, targetHash)) + 1;
    const record = {
      id: id('hr'),
      userId,
      target, // the URL as the user pasted it (display)
      targetCanonical,
      targetHash, // dedup key
      version,
      jobId,
      assessmentId,
      reportMarkdown: String(reportMarkdown || ''),
      summary: {
        totalFindings: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
        steps: 0,
        durationMs: 0,
        ...summary,
      },
      findings: Array.isArray(findings) ? findings : [],
      completedAt: now(),
      createdAt: now(),
    };
    await this.collection.insertOne(record);
    return publicRecord(record);
  }

  /** Latest completed report for this user + target fingerprint (dedup hit). */
  async findLatestByTarget(userId, targetHash) {
    const records = await this.collection
      .find({ userId, targetHash })
      .sort({ version: -1 })
      .limit(1)
      .toArray();
    return publicRecord(records[0] || null);
  }

  /** Full record INCLUDING the report markdown (for viewing / re-download). */
  async findFullById(userId, recordId) {
    const record = await this.collection.findOne({ userId, id: recordId });
    if (!record) return null;
    return { ...publicRecord(record), reportMarkdown: record.reportMarkdown };
  }

  /** Report history for the "past reports" browser, newest first. */
  async listByUser(userId, { limit = 50 } = {}) {
    const records = await this.collection
      .find({ userId })
      .sort({ completedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 200))
      .toArray();
    // The history view is lightweight: the heavy report markdown is fetched
    // per-record via findFullById (view / re-download).
    return records.map(record => {
      const { reportMarkdown, ...rest } = record;
      return publicRecord(rest);
    });
  }

  async countByTarget(userId, targetHash) {
    return this.collection.countDocuments({ userId, targetHash });
  }
}
