/**
 * DeterministicBrain — the rule-based autonomous strategy.
 *
 * When no LLM brain is reachable (no local model, no phone, no API key), the
 * hunt does NOT die in `waiting`: AgentWorker falls back to this brain, which
 * drives the REAL loop — methodology stage machine → tool executor →
 * parsers → finding lifecycle — with deterministic, expert-authored
 * strategy. Every action still passes policy validation, scope checks,
 * evidence gates, and state persistence; the fallback is published honestly
 * as `brain.deterministic` so the UI and logs never pretend an LLM decided.
 *
 * Strategy (web-app hunt):
 *   1. web_probe            — fingerprint + attack-surface discovery (recon)
 *   2. xss_probe + sqli_probe (parallel) — injection detection
 *   3. stored_xss_probe + idor_probe (parallel) — persistence + authz
 *   4. one `finding` action per normalized candidate not already filed
 *   5. complete
 *
 * Implements the same interface AgentWorker.stepReason expects from a brain:
 *   - async health() → { available, reason, provider, mode }
 *   - async decide(context) → { decision }  (decision matches the autonomous
 *     decision schema: objective, reason, nextAction, ...)
 *   - static statusLabel(decision)
 */

const STAGES = ['recon', 'injection', 'persistence_authz', 'file_findings', 'done'];

const PROBE_TOOLS = ['web_probe', 'xss_probe', 'sqli_probe', 'stored_xss_probe', 'idor_probe'];

export class DeterministicBrain {
  constructor({ toolExecutionModel = null, evidenceModel = null, logger = console } = {}) {
    this.toolExecutionModel = toolExecutionModel;
    this.evidenceModel = evidenceModel;
    this.logger = logger;
    this.mode = 'rule-based';
  }

  async health() {
    return {
      available: true,
      reason: null,
      provider: 'DeterministicBrain',
      mode: this.mode,
      detail: {
        note: 'Rule-based strategy — no LLM required. Used when the local AI is unreachable.',
      },
    };
  }

  static statusLabel(decision) {
    const type = decision?.nextAction?.type;
    switch (type) {
      case 'tool':
        return `Deterministic strategy: running ${decision.nextAction.name}…`;
      case 'parallel_tools': {
        const names = (decision.nextAction.tools || decision.nextAction.parallelTools || [])
          .map(t => t.name)
          .join(', ');
        return `Deterministic strategy: parallel recon (${names})…`;
      }
      case 'validate':
        return 'Deterministic strategy: validating a hypothesis…';
      case 'finding':
        return 'Deterministic strategy: confirming a finding with evidence…';
      case 'observation':
        return 'Deterministic strategy: recording an observation…';
      case 'complete':
        return 'Deterministic strategy: objectives satisfied.';
      default:
        return 'Deterministic strategy: analyzing…';
    }
  }

  /** Tool names that completed successfully for this assessment. */
  async completedTools(assessmentId) {
    if (!this.toolExecutionModel) return new Set();
    try {
      const executions = await this.toolExecutionModel.list(assessmentId);
      return new Set(
        (executions || [])
          .filter(e => e.status === 'completed' && PROBE_TOOLS.includes(e.tool))
          .map(e => e.tool)
      );
    } catch (error) {
      this.logger.warn?.(`[deterministic-brain] could not list executions: ${error.message}`);
      return new Set();
    }
  }

  /** Normalized finding candidates from completed probe runs (via the parser funnel). */
  async probeCandidates(assessmentId) {
    const candidates = [];
    if (!this.toolExecutionModel) return candidates;
    try {
      const executions = await this.toolExecutionModel.list(assessmentId);
      for (const exec of executions || []) {
        if (!PROBE_TOOLS.includes(exec.tool) || exec.status !== 'completed') continue;
        const data = exec.parsedResults?.data || exec.parsedResults || null;
        const findings = data?.findings || [];
        for (const f of findings) {
          candidates.push({ ...f, _tool: exec.tool, _executionId: exec.id, _target: exec.target });
        }
      }
    } catch (error) {
      this.logger.warn?.(`[deterministic-brain] candidate collection failed: ${error.message}`);
    }
    return candidates;
  }

  /** Evidence ids from the probe execution that produced this candidate. */
  async evidenceForExecution(jobId, executionId, target) {
    if (!this.evidenceModel) return [];
    try {
      const all = await this.evidenceModel.listByJob(jobId);
      return all
        .filter(
          e =>
            e.toolExecutionId === executionId ||
            String(e.asset || '').toLowerCase() === String(target || '').toLowerCase()
        )
        .slice(-5)
        .map(e => e.id);
    } catch {
      return [];
    }
  }

  candidateKey(c) {
    return `${c.type || ''}|${c.url || ''}|${c.title || ''}`.toLowerCase();
  }

  findingKey(f) {
    return `${f.category || f.type || ''}|${f.endpoint || f.url || ''}|${f.title || ''}`.toLowerCase();
  }

  async decide(context = {}) {
    const job = context.job || {};
    const jobId = job.id;
    const assessmentId = job.assessmentId;
    // job.target is the full normalized URL (port kept) since the intake
    // fix; tolerate a bare hostname for jobs created before it.
    const target = /^https?:\/\//i.test(String(job.target || ''))
      ? String(job.target)
      : `http://${job.target}`;
    const done = await this.completedTools(assessmentId);
    const filed = new Set((context.findings || []).map(f => this.findingKey(f)));

    const toolAction = (name, reason, stage, args = {}) => ({
      objective: `Run ${name} against ${target}`,
      observation: `${done.size} probe tool(s) completed so far`,
      reason,
      expectedOutcome: `New ${stage} data about ${target}`,
      confidence: 0.85,
      methodologyStage: stage,
      hypotheses: [],
      memoryNotes: [],
      nextAction: { type: 'tool', name, target, arguments: args, description: reason },
    });

    // Stage 1 — recon: fingerprint the target and map the attack surface.
    if (!done.has('web_probe')) {
      return {
        decision: {
          ...toolAction(
            'web_probe',
            'Map the attack surface first: fetch the target, extract forms, links, query params, and tech hints before testing anything.',
            'recon'
          ),
          reason:
            'Deterministic strategy (no LLM reachable): start with web_probe recon — map forms, params, and endpoints before probing.',
        },
      };
    }

    // Stage 2 — injection: reflected XSS + SQLi in parallel (independent).
    if (!done.has('xss_probe') || !done.has('sqli_probe')) {
      const pending = ['xss_probe', 'sqli_probe'].filter(t => !done.has(t));
      return {
        decision: {
          objective: `Run injection probes against ${target}`,
          observation: 'Recon complete — attack surface mapped',
          reason:
            'Deterministic strategy (no LLM reachable): recon mapped the surface; now run reflected-XSS and SQLi probes in parallel.',
          expectedOutcome: 'Confirmed or ruled-out injection vulnerabilities',
          confidence: 0.85,
          methodologyStage: 'vulnerability_detection',
          hypotheses: [],
          memoryNotes: [],
          nextAction: {
            type: 'parallel_tools',
            target,
            tools: pending.map(name => ({
              name,
              target,
              arguments: {},
              description: `Deterministic ${name}`,
            })),
            description: 'Parallel injection probes',
          },
        },
      };
    }

    // Stage 3 — persistence + authz: stored XSS + IDOR in parallel.
    if (!done.has('stored_xss_probe') || !done.has('idor_probe')) {
      const pending = ['stored_xss_probe', 'idor_probe'].filter(t => !done.has(t));
      return {
        decision: {
          objective: `Run persistence/authorization probes against ${target}`,
          observation: 'Injection probes complete',
          reason:
            'Deterministic strategy (no LLM reachable): injection layer tested; now check stored XSS persistence and object-level authorization.',
          expectedOutcome: 'Confirmed or ruled-out stored-XSS / IDOR',
          confidence: 0.85,
          methodologyStage: 'vulnerability_detection',
          hypotheses: [],
          memoryNotes: [],
          nextAction: {
            type: 'parallel_tools',
            target,
            tools: pending.map(name => ({
              name,
              target,
              arguments: {},
              description: `Deterministic ${name}`,
            })),
            description: 'Parallel persistence/authz probes',
          },
        },
      };
    }

    // Stage 4 — file one finding per unfiled normalized candidate.
    const candidates = await this.probeCandidates(assessmentId);
    const unfiled = candidates.filter(
      c =>
        ![...filed].some(
          k =>
            k.includes((c.type || '').toLowerCase()) ||
            (c.title || '')
              .toLowerCase()
              .split(' ')
              .slice(0, 4)
              .every(w => k.includes(w))
        )
    );
    if (unfiled.length) {
      const c = unfiled[0];
      const evidenceIds = await this.evidenceForExecution(
        jobId,
        c._executionId,
        c._target || target
      );
      return {
        decision: {
          objective: `Confirm finding: ${c.title}`,
          observation: `${candidates.length} candidate(s) from probes, ${unfiled.length} unfiled`,
          reason: `Deterministic strategy (no LLM reachable): probe ${c._tool} produced a normalized ${c.type} candidate with evidence — filing it as a finding.`,
          expectedOutcome: 'Finding confirmed with attached evidence',
          confidence: c.confidence ?? 0.8,
          methodologyStage: 'reporting',
          hypotheses: [],
          memoryNotes: [`Probe ${c._tool} confirmed: ${c.title}`],
          nextAction: {
            type: 'finding',
            target: c.url || target,
            title: c.title,
            severity: c.severity || 'medium',
            category: c.type || 'web',
            endpoint: c.url || null,
            description: c.evidence?.note || c.title,
            details: c.evidence?.note || c.title,
            impact: impactFor(c.type, c.severity),
            reproductionSteps: reproductionFor(c),
            remediation: remediationFor(c.type),
            confidence: c.confidence ?? 0.8,
            evidenceIds,
            rootCause: c.evidence?.note || c.title,
          },
        },
      };
    }

    // Stage 5 — everything probed and filed: complete.
    return {
      decision: {
        objective: 'Assessment complete — deterministic strategy exhausted',
        observation: `${done.size} probes completed, ${candidates.length} candidate(s) filed`,
        reason:
          'Deterministic strategy (no LLM reachable): all probe stages ran and every candidate was filed as a finding. Nothing left to test autonomously.',
        expectedOutcome: 'Job completes with findings report',
        confidence: 1,
        methodologyStage: 'reporting',
        hypotheses: [],
        memoryNotes: [],
        nextAction: { type: 'complete', description: 'Deterministic hunt complete' },
      },
    };
  }
}

function impactFor(type, severity) {
  const map = {
    'sql-injection':
      'Database compromise: authentication bypass, data theft, potential full host takeover via stacked queries.',
    'reflected-xss':
      'Session hijacking and phishing: attacker-crafted links execute script in victims\u2019 browsers.',
    'stored-xss':
      'Persistent script execution for every visitor: mass session theft, defacement, malware delivery.',
    idor: 'Unauthorized access to other users\u2019 private records (PII, credentials).',
  };
  return map[type] || `Security weakness with ${severity} severity.`;
}

function reproductionFor(c) {
  const steps = [];
  if (c.evidence?.request) steps.push(`Send: ${c.evidence.request}`);
  if (c.evidence?.payload) steps.push(`Payload: ${c.evidence.payload}`);
  if (c.evidence?.renderUrl) steps.push(`Verify at: ${c.evidence.renderUrl}`);
  steps.push(`Observed: ${c.evidence?.note || c.title}`);
  return steps;
}

function remediationFor(type) {
  const map = {
    'sql-injection':
      'Use parameterized queries / prepared statements everywhere; never interpolate input into SQL; apply least-privilege DB accounts.',
    'reflected-xss':
      'Context-aware output encoding on every reflection point; adopt a strict Content-Security-Policy.',
    'stored-xss':
      'Encode on output (not just on input); validate/sanitize stored content; strict CSP.',
    idor: 'Enforce server-side authorization on every object reference: verify the caller owns (or may access) the requested id.',
  };
  return map[type] || 'Fix the root cause and re-test.';
}
