/**
 * assessmentService — assessment service.
 * Encapsulates assessment business logic used by controllers and workers.
 * Part of: Infinity AI / Dark-Matter backend (business-logic services).
 */

import { assert } from '../core/errors.js';
import { extractUrl, normalizeUrlCandidate } from '../core/utils.js';
import { normalizeTargetUrl, normalizeScope } from '../models/targetModel.js';
import { ScopeEngine } from '../agent/scopeEngine.js';

/**
 * AssessmentService — orchestrates the full assessment lifecycle.
 * Creates assessments, validates scope, initializes the agent, handles pause/resume/stop.
 */
export class AssessmentService {
  constructor({
    assessmentModel,
    targetModel,
    agentBrain,
    stateManager,
    eventService,
    planner,
    providerModel,
  }) {
    this.assessmentModel = assessmentModel;
    this.targetModel = targetModel;
    this.agentBrain = agentBrain;
    this.stateManager = stateManager;
    this.eventService = eventService;
    this.planner = planner;
    this.providerModel = providerModel;
  }

  /** List all assessments for a user. */
  async list(userId) {
    return this.assessmentModel.list(userId);
  }

  /** Get assessment by ID (with ownership check). */
  async get(userId, assessmentId) {
    return this.assessmentModel.get(userId, assessmentId);
  }

  /** Get assessment timeline events. */
  async getTimeline(assessmentId) {
    return this.eventService.list(assessmentId);
  }

  /**
   * Create a new assessment from a user-submitted target.
   * Full flow: validate → create target → create assessment → init state → start brain.
   */
  async createFromTarget(userId, input) {
    // 1. Resolve target URL
    const targetUrl = input.targetUrl || extractUrl(input.message);
    if (!targetUrl) {
      return { status: 'needs_target', message: 'Please provide an HTTP or HTTPS target URL.' };
    }
    if (input.authorizationConfirmed !== true) {
      return {
        status: 'awaiting_authorization',
        targetUrl,
        message: 'Confirm that you are authorized to test this target before starting.',
      };
    }

    const normalizedUrl = normalizeTargetUrl(targetUrl);
    const hostname = new URL(normalizedUrl).hostname.toLowerCase().replace(/^www\./, '');

    // 2. Create or reuse target
    let target = await this.targetModel.findByUrl(userId, normalizedUrl);
    if (!target) {
      target = await this.targetModel.create(userId, {
        url: normalizedUrl,
        name: input.targetName || hostname,
        scope: input.scope,
        authorizationConfirmed: true,
        authorizationNotes: input.authorizationNotes,
      });
    }
    assert(
      target.authorization.confirmed,
      400,
      'Target authorization is required',
      'AUTHORIZATION_REQUIRED'
    );

    // 3. Create assessment
    const assessment = await this.assessmentModel.create(userId, {
      targetId: target.id,
      targetUrl: normalizedUrl,
      targetHostname: hostname,
      scope: target.scope,
      mode: input.mode,
      message: input.message,
    });

    // 4. Validate scope
    const scope = normalizeScope(normalizedUrl, target.scope);
    await this.assessmentModel.setStatus(assessment.id, 'scope_validation');
    await this.eventService.publish(assessment.id, {
      type: 'SCOPE_VALIDATED',
      level: 'INFO',
      message: `Scope validated — included: ${scope.included.join(', ')}`,
      data: { scope },
    });

    // 5. Initialize agent state
    const scopeEngine = new ScopeEngine(scope, hostname);
    await this.stateManager.initialize(assessment.id, userId, hostname, scope);

    await this.eventService.publish(assessment.id, {
      type: 'ASSESSMENT_CREATED',
      level: 'INFO',
      message: `Assessment created for ${hostname}`,
      data: { assessmentId: assessment.id, target: hostname },
    });

    // 6. Start the agent brain (runs asynchronously) — unless the caller owns
    //    the lifecycle itself (the autonomous worker does: see JobManager).
    if (input.deferStart === true) {
      return {
        status: 'assessment_created',
        assessmentId: assessment.id,
        assessment,
      };
    }

    await this.agentBrain.start(assessment.id, userId);

    return {
      status: 'started',
      assessmentId: assessment.id,
      assessment,
    };
  }

  /** Pause an assessment. */
  async pause(userId, assessmentId) {
    await this.assessmentModel.get(userId, assessmentId); // ownership check
    const paused = await this.agentBrain.pause(assessmentId);
    return { status: paused ? 'paused' : 'not_running' };
  }

  /** Resume an assessment. */
  async resume(userId, assessmentId) {
    await this.assessmentModel.get(userId, assessmentId); // ownership check
    const result = await this.agentBrain.resume(assessmentId, userId);
    return result;
  }

  /** Stop an assessment. */
  async stop(userId, assessmentId) {
    await this.assessmentModel.get(userId, assessmentId); // ownership check
    const stopped = this.agentBrain.stop(assessmentId);
    if (stopped) {
      await this.assessmentModel.setStatus(assessmentId, 'stopped');
      await this.eventService.publish(assessmentId, {
        type: 'ASSESSMENT_STOPPED',
        level: 'WARN',
        message: 'Assessment stopped by user',
      });
    }
    return { status: stopped ? 'stopped' : 'not_running' };
  }

  /** Chat — send a message to the assessment and get a response. */
  async chat(userId, assessmentId, message) {
    const assessment = await this.assessmentModel.get(userId, assessmentId);
    await this.assessmentModel.addMessage(assessmentId, 'user', message);

    // Handle commands
    const lower = message.toLowerCase().trim();
    if (lower === 'pause' || lower === 'stop') {
      const result =
        lower === 'pause'
          ? await this.pause(userId, assessmentId)
          : await this.stop(userId, assessmentId);
      const response =
        lower === 'pause' ? 'Assessment paused. Checkpoint saved.' : 'Assessment stopped.';
      await this.assessmentModel.addMessage(assessmentId, 'assistant', response);
      return { message: response, ...result };
    }
    if (lower === 'resume' || lower === 'continue') {
      const result = await this.resume(userId, assessmentId);
      const response = 'Resuming assessment from last checkpoint.';
      await this.assessmentModel.addMessage(assessmentId, 'assistant', response);
      return { message: response, ...result };
    }
    if (lower === 'status') {
      const isRunning = this.agentBrain.isRunning(assessmentId);
      const response = `Assessment status: ${assessment.status}. Phase: ${assessment.phase}. Running: ${isRunning}. Iteration: ${assessment.iterationCount || 0}.`;
      await this.assessmentModel.addMessage(assessmentId, 'assistant', response);
      return { message: response, status: assessment.status };
    }

    // Smart LLM response using current assessment context
    let responseText = null;
    try {
      const context = await this.stateManager.getContext(assessmentId);
      if (context && this.planner) {
        const prompt = `User question during security assessment: "${message}"\nTarget: ${context.target}\nCurrent Phase: ${context.phase}\nIteration: ${context.iterationCount}\nSubdomains found: ${context.subdomainCount}\nEndpoints: ${context.endpointCount}\nTechnologies: ${(context.technologies || []).join(', ') || 'none'}\nOpen Ports: ${(context.openPorts || []).join(', ') || 'none'}\nRecent tools: ${(context.completedToolNames || []).slice(-5).join(', ')}\n\nAnswer the user directly and professionally as an autonomous security AI agent. Be concise, technical, and accurate.`;

        // Try user providers first
        if (userId && this.providerModel) {
          const providers = await this.providerModel.getActiveProviders(userId);
          for (const provider of providers) {
            try {
              if (provider.id === 'gemini') {
                const res = await fetch(
                  `${provider.baseUrl}/models/${provider.model}:generateContent?key=${provider.apiKey}`,
                  {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    signal: AbortSignal.timeout(15_000),
                    body: JSON.stringify({
                      contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    }),
                  }
                );
                if (res.ok) {
                  const data = await res.json();
                  responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (responseText) break;
                }
              } else if (provider.id === 'anthropic') {
                const res = await fetch(`${provider.baseUrl}/v1/messages`, {
                  method: 'POST',
                  headers: {
                    'content-type': 'application/json',
                    'x-api-key': provider.apiKey,
                    'anthropic-version': '2023-06-01',
                  },
                  signal: AbortSignal.timeout(15_000),
                  body: JSON.stringify({
                    model: provider.model,
                    max_tokens: 1000,
                    messages: [{ role: 'user', content: prompt }],
                  }),
                });
                if (res.ok) {
                  const data = await res.json();
                  responseText = data?.content?.[0]?.text;
                  if (responseText) break;
                }
              } else {
                const res = await fetch(`${provider.baseUrl}/chat/completions`, {
                  method: 'POST',
                  headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${provider.apiKey}`,
                  },
                  signal: AbortSignal.timeout(15_000),
                  body: JSON.stringify({
                    model: provider.model,
                    messages: [{ role: 'user', content: prompt }],
                  }),
                });
                if (res.ok) {
                  const data = await res.json();
                  responseText = data?.choices?.[0]?.message?.content;
                  if (responseText) break;
                }
              }
            } catch (err) {
              console.warn(`Chat provider ${provider.id} error:`, err.message);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Smart chat generation failed:', e.message);
    }

    const finalResponse =
      responseText ||
      `Message received. Assessment on ${assessment.targetHostname || 'target'} is ${assessment.status} in phase "${assessment.phase}". Assets found: ${assessment.assetsDiscovered || 0}, findings: ${assessment.findingsCount || 0}.`;
    await this.assessmentModel.addMessage(assessmentId, 'assistant', finalResponse);
    return { message: finalResponse, status: assessment.status };
  }

  /**
   * Posture score for a target, computed from its confirmed findings.
   * Pure + deterministic: 100 starts clean, each finding deducts a
   * severity-weighted amount, floored at 0. Grades: A ≥90, B ≥75, C ≥60,
   * D ≥40, F below. Used by GET /api/v1/jobs/:id/posture and the
   * HuntStatusPanel / Reports UI.
   */
  postureFromFindings(findings = []) {
    return computePostureScore(findings);
  }
}

// ── Posture scoring (pure) ───────────────────────────────────────────────

const POSTURE_WEIGHTS = { critical: 25, high: 10, medium: 4, low: 1, informational: 0, info: 0 };

function normalizeSeverity(severity) {
  const s = String(severity || 'informational').toLowerCase();
  if (s === 'info') return 'informational';
  return POSTURE_WEIGHTS[s] !== undefined ? s : 'informational';
}

function gradeForScore(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Compute a 0–100 posture score from a finding list.
 * Returns { score, grade, counts, total, topRisks } — topRisks are the 3
 * most severe findings ({ id, title, severity }).
 */
export function computePostureScore(findings = []) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
  let deduction = 0;
  for (const finding of findings || []) {
    const severity = normalizeSeverity(finding.severity);
    counts[severity] += 1;
    deduction += POSTURE_WEIGHTS[severity];
  }
  const score = Math.max(0, 100 - deduction);
  const rank = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };
  const topRisks = [...(findings || [])]
    .sort(
      (a, b) =>
        (rank[normalizeSeverity(a.severity)] ?? 4) - (rank[normalizeSeverity(b.severity)] ?? 4)
    )
    .slice(0, 3)
    .map(f => ({ id: f.id, title: f.title, severity: normalizeSeverity(f.severity) }));
  return {
    score,
    grade: gradeForScore(score),
    counts,
    total: (findings || []).length,
    topRisks,
  };
}
