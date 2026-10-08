import crypto from 'node:crypto';
import { applyCvss } from '../agent/cvss.js';
import { generatePoC } from '../engines/pocGenerator.js';

/**
 * FindingLifecycleService — observation → hypothesis → validation → evidence →
 * confirmed finding (requirement #27, #63).
 *
 * A suspicious response is NOT automatically a vulnerability. The only path to
 * a `validated` finding is evidence stored in the evidence collection. The
 * local AI may *propose*; this service decides what is actually recorded.
 *
 * The lifecycle itself is persisted in agent memory ('episodic' for
 * observations, 'finding' for the finding state), so the brain can see the
 * chain on its next reasoning step without re-reading the whole database.
 */

export const HYPOTHESIS_STATES = Object.freeze([
  'untested',
  'investigating',
  'needs_validation',
  'validated',
  'false_positive',
]);

export class FindingLifecycleService {
  constructor({ findingModel, evidenceModel, memory, eventService, agentStateModel = null }) {
    this.findingModel = findingModel;
    this.evidenceModel = evidenceModel;
    this.memory = memory;
    this.eventService = eventService;
    this.agentStateModel = agentStateModel;
  }

  /**
   * Deterministic identity for a finding so the same issue is never reported
   * 50 times (requirement #63). Similarity is a *hash*, not a model opinion.
   */
  static dedupeKey({ category, asset, endpoint, parameter, rootCause }) {
    const normalize = value =>
      String(value || '')
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/+$/, '');
    const payload = JSON.stringify({
      category: normalize(category),
      asset: normalize(asset),
      endpoint: normalize(endpoint),
      parameter: normalize(parameter),
      rootCause: normalize(rootCause).slice(0, 200),
    });
    return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 20);
  }

  /** #1 — record something that was actually observed. */
  async recordObservation({ userId, assessmentId, jobId, summary, refs = {}, structured = null }) {
    await this.memory.rememberEpisodic({
      userId,
      assessmentId,
      jobId,
      key: refs.observationId || null,
      content: String(summary).slice(0, 2000),
      refs,
    });
    await this.publish(jobId, {
      type: 'observation.recorded',
      level: 'INFO',
      message: String(summary).slice(0, 400),
      data: { refs },
    });
    return { summary, refs, structured };
  }

  /** #2 — raise a testable hypothesis (never a finding). */
  async raiseHypothesis({
    userId,
    assessmentId,
    jobId,
    hypothesis,
    category = 'general',
    asset = null,
    endpoint = null,
  }) {
    let created = null;
    if (this.agentStateModel) {
      created = await this.agentStateModel.addHypothesis(assessmentId, {
        hypothesis,
        type: category,
        asset,
        endpoint,
      });
    } else {
      created = {
        id: `hyp_${crypto.randomUUID().slice(0, 8)}`,
        hypothesis,
        type: category,
        status: 'UNTESTED',
      };
    }

    await this.memory.rememberEpisodic({
      userId,
      assessmentId,
      jobId,
      key: 'hypothesis',
      content: `HYPOTHESIS (untested): ${hypothesis}`,
      refs: { url: endpoint },
    });
    await this.publish(jobId, {
      type: 'hypothesis.created',
      level: 'INFO',
      message: `Hypothesis: ${hypothesis}`,
      data: { hypothesisId: created.id, category, asset, endpoint },
    });
    await this.publish(jobId, {
      type: 'hypothesis.updated',
      level: 'INFO',
      message: `Hypothesis ${created.id} status: untested`,
      data: { hypothesisId: created.id, status: 'untested' },
    });
    return created;
  }

  /**
   * #3 — validation. Existing evidence is REQUIRED. This method never creates
   * evidence: a hypothesis can only be validated by something that was really
   * observed and really stored (anti-fabrication gate).
   */
  async validate({
    userId,
    assessmentId,
    jobId,
    hypothesisId = null,
    hypothesis = null,
    evidenceIds = [],
    valid = true,
  }) {
    const resolved = (await Promise.all(evidenceIds.map(id => this.evidenceModel.get(id)))).filter(
      Boolean
    );

    if (resolved.length === 0) {
      await this.publish(jobId, {
        type: 'hypothesis.updated',
        level: 'WARN',
        message: `Cannot validate hypothesis "${hypothesis || hypothesisId || 'unnamed'}" — no stored evidence was referenced`,
        data: { hypothesisId, status: 'needs_validation' },
      });
      return {
        validated: false,
        reason: 'no_evidence',
        status: 'needs_validation',
        evidence: null,
      };
    }

    const evidence = resolved[resolved.length - 1];

    if (valid === false) {
      await this.publish(jobId, {
        type: 'hypothesis.updated',
        level: 'INFO',
        message: `Hypothesis rejected as false positive: ${hypothesis || hypothesisId}`,
        data: { hypothesisId, status: 'false_positive' },
      });
      return { validated: false, evidence, status: 'false_positive' };
    }

    await this.memory.rememberEpisodic({
      userId,
      assessmentId,
      jobId,
      key: 'validation',
      content: `VALIDATION: hypothesis "${hypothesis || hypothesisId || 'unnamed'}" is supported by ${resolved.length} stored evidence record(s): ${resolved.map(item => `${item.id} (${item.summary || item.kind})`).join('; ')}`,
      refs: { evidenceId: evidence.id, url: evidence.endpoint },
    });

    await this.publish(jobId, {
      type: 'hypothesis.updated',
      level: 'INFO',
      message: `Hypothesis validated with ${resolved.length} evidence record(s): ${evidence.summary || evidence.kind}`,
      data: {
        hypothesisId,
        status: 'validated',
        evidenceId: evidence.id,
        evidenceIds: resolved.map(item => item.id),
      },
    });

    return {
      validated: true,
      evidence,
      evidenceIds: resolved.map(item => item.id),
      status: 'validated',
    };
  }

  /**
   * #4 — promote to a finding. Refuses (and says why) when there is no stored
   * evidence: this is the anti-fabrication gate.
   */
  async createFinding({
    userId,
    assessmentId,
    jobId,
    title,
    severity = 'informational',
    category = 'uncategorized',
    asset = null,
    endpoint = null,
    parameter = null,
    rootCause = '',
    description = '',
    impact = '',
    reproductionSteps = [],
    remediation = '',
    confidence = 0.5,
    evidenceIds = [],
    hypothesisId = null,
    cvssMetrics = null,
  }) {
    // Only evidence the caller actually named may support a finding. We never
    // fall back to "all evidence in the assessment" — that would let an
    // unrelated tool run rubber-stamp a fabricated finding.
    const evidence = evidenceIds.length
      ? (await Promise.all(evidenceIds.map(id => this.evidenceModel.get(id)))).filter(Boolean)
      : [];

    if (evidence.length === 0) {
      await this.publish(jobId, {
        type: 'finding.rejected',
        level: 'WARN',
        message: `Refusing to create finding "${title}" — no stored evidence exists`,
        data: { title, category, asset, endpoint },
      });
      return { created: false, reason: 'no_evidence', finding: null };
    }

    const dedupeKey = FindingLifecycleService.dedupeKey({
      category,
      asset,
      endpoint,
      parameter,
      rootCause,
    });

    // Deterministic dedupe against existing findings for this assessment.
    const existing = await this.findingModel.list(assessmentId);
    const duplicate =
      existing.find(row => row.dedupeKey === dedupeKey) ||
      existing.find(
        row =>
          row.category === category &&
          String(row.affectedAsset || '').toLowerCase() === String(asset || '').toLowerCase() &&
          String(row.affectedEndpoint || '').toLowerCase() === String(endpoint || '').toLowerCase()
      );

    if (duplicate) {
      await this.publish(jobId, {
        type: 'finding.updated',
        level: 'INFO',
        message: `Merged duplicate finding into ${duplicate.id} (same category/asset/endpoint/root cause)`,
        data: { findingId: duplicate.id, dedupeKey },
      });
      // Attach any new evidence to the existing finding instead of duplicating it.
      await this.evidenceModel.linkToFinding(
        duplicate.id,
        evidence.map(item => item.id)
      );
      return { created: false, reason: 'duplicate', finding: duplicate, deduplicated: true };
    }

    // CVSS auto-scoring: every persisted finding carries a computed
    // {score, rating, vector, source} — brain metrics when the brain supplies
    // them, conservative type defaults otherwise. Never hardcoded.
    const cvss = applyCvss({ severity, category, type: category, cvssMetrics });

    const finding = await this.findingModel.create(assessmentId, userId, {
      title,
      severity,
      category,
      affectedAsset: asset,
      affectedEndpoint: endpoint,
      parameter,
      description,
      impact,
      reproductionSteps,
      remediation,
      confidence,
      observationIds: [],
      toolExecutionIds: evidence.map(item => item.toolExecutionId).filter(Boolean),
      hypothesisId,
      cvss,
      cvssMetrics: cvssMetrics || null,
    });

    // Findings are validated only when they carry evidence, and we link it.
    await this.findingModel.update(finding.id, {
      dedupeKey,
      status: 'validated',
      validatedAt: new Date().toISOString(),
    });
    await this.evidenceModel.linkToFinding(
      finding.id,
      evidence.map(item => item.id)
    );

    // ── PoC attach ────────────────────────────────────────────────────
    // Every validated finding gets a runnable proof-of-concept attached
    // right here (curl + python + steps). Safe by design: read-only probes.
    // A failure to generate never blocks the finding itself.
    try {
      const poc = generatePoC({
        type: [category, title].filter(Boolean).join(' '),
        url: endpoint || asset || '',
        evidence: evidence[0]?.summary || '',
        confidence,
        params: parameter ? { [parameter]: '' } : {},
      });
      if (poc && (poc.curl || poc.python)) {
        await this.findingModel.update(finding.id, {
          poc: {
            curl: poc.curl || null,
            python: poc.python || null,
            steps: poc.steps || [],
            attachedAt: new Date().toISOString(),
          },
        });
      }
    } catch {
      /* PoC generation is best-effort — the validated finding stands regardless. */
    }

    await this.memory.rememberFinding({
      userId,
      assessmentId,
      jobId,
      key: dedupeKey,
      content: `CONFIRMED FINDING [${severity}] ${title} @ ${asset || 'n/a'}${endpoint ? ` (${endpoint})` : ''} — evidence: ${evidence.map(e => e.id).join(', ')}`,
      refs: { findingId: finding.id, evidenceId: evidence[0]?.id || null, url: endpoint },
      structured: { severity, category, dedupeKey },
    });

    await this.publish(jobId, {
      type: 'finding.created',
      level: severity === 'critical' || severity === 'high' ? 'ERROR' : 'WARN',
      message: `Finding confirmed: ${title} (${severity})`,
      data: { findingId: finding.id, severity, evidenceIds: evidence.map(e => e.id) },
    });

    return {
      created: true,
      finding: { ...finding, status: 'validated', evidence },
      deduplicated: false,
    };
  }

  async publish(jobId, event) {
    if (!jobId || !this.eventService) return null;
    try {
      return await this.eventService.publish(jobId, event);
    } catch {
      return null;
    }
  }
}
