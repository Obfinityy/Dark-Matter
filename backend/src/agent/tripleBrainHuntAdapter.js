/**
 * tripleBrainHuntAdapter.js — Hunt-loop brain adapter for the three LOCAL
 * brain slots (vision / grounding / hacker on localhost).
 *
 * The hunt loop thinks through a brain interface:
 *   - async health() → { available, reason, provider, mode }
 *   - async decide(context) → { decision }   (loop decision shape)
 *   - static statusLabel(decision)
 *
 * This adapter implements that interface on top of the TripleBrainOrchestrator
 * (overnight mission ②): when the resilient single-brain chain is down, the
 * hunt thinks with the user's real local slot servers instead of dropping
 * straight to the deterministic rule-based strategy. Slot availability is
 * reported honestly — a missing hacker brain degrades to vision reasoning
 * (clearly marked), and if think() itself fails the adapter delegates to the
 * wrapped deterministic brain so the hunt never dies silently.
 *
 * Tool choices from the hacker brain are sanitized against a safe allowlist:
 * an unknown tool name falls back to web_probe and is logged.
 */

const SAFE_TOOLS = new Set([
  // Built-in safe probes (backend/src/tools/registry.js)
  'web_probe',
  'xss_probe',
  'sqli_probe',
  'stored_xss_probe',
  'idor_probe',
  // ProjectDiscovery recon/vuln binaries (backend/src/hunt/toolRunner.js)
  'subfinder',
  'dnsx',
  'httpx',
  'katana',
  'nuclei',
]);

function normalizeTarget(job) {
  const raw = String(job?.target || '').trim();
  if (!raw) return '(unknown target)';
  return /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
}

export class TripleBrainHuntAdapter {
  constructor({ orchestrator, deterministic = null, logger = console } = {}) {
    if (!orchestrator) throw new Error('TripleBrainHuntAdapter requires an orchestrator');
    this.orchestrator = orchestrator;
    this.deterministic = deterministic;
    this.logger = logger;
    this.degradedDecisions = 0;
  }

  /**
   * Slot health, straight from the local servers.
   * available when the hacker slot is up; degraded-but-available when only
   * vision can think; unavailable when no thinking slot is up. The reason
   * always names the missing slots.
   */
  async health() {
    let checks;
    try {
      checks = await this.orchestrator.healthCheck();
    } catch (error) {
      return {
        available: false,
        reason: `triple-brain health check failed: ${error?.message || error}`,
        provider: 'triple-brain',
        mode: 'triple-unavailable',
      };
    }
    const missing = Object.entries(checks || {})
      .filter(([, c]) => !c?.ok)
      .map(([slot]) => slot);
    const live = Object.entries(checks || {})
      .filter(([, c]) => c?.ok)
      .map(([slot]) => slot);

    if (checks?.hacker?.ok) {
      return {
        available: true,
        reason: null,
        provider: 'triple-brain',
        mode: 'triple',
        detail: { live, missing, note: 'Hacker brain thinking on the local slot server.' },
      };
    }
    if (checks?.vision?.ok) {
      return {
        available: true,
        reason: null,
        provider: 'triple-brain',
        mode: 'triple-degraded',
        detail: {
          live,
          missing,
          note: 'Hacker brain MISSING — vision model is reasoning instead. Chains may be simpler.',
        },
      };
    }
    return {
      available: false,
      reason: `triple-brain unavailable — no thinking slot is up (missing: ${missing.join(', ') || 'all three slots'})`,
      provider: 'triple-brain',
      mode: 'triple-unavailable',
      detail: { live, missing },
    };
  }

  static statusLabel(decision) {
    const type = decision?.nextAction?.type;
    const src = decision?.brainSource === 'triple-degraded' ? 'Triple-brain (vision covering hacker)' : 'Triple-brain (hacker slot)';
    switch (type) {
      case 'tool':
        return `${src}: running ${decision.nextAction.name}…`;
      case 'validate':
        return `${src}: validating a hypothesis…`;
      case 'finding':
        return `${src}: confirming a finding with evidence…`;
      case 'observation':
        return `${src}: recording an observation…`;
      case 'computer_action':
        return `${src}: acting on screen…`;
      case 'complete':
        return `${src}: objectives satisfied.`;
      default:
        return `${src}: thinking…`;
    }
  }

  sanitizeTool(name) {
    const clean = String(name || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (SAFE_TOOLS.has(clean)) return clean;
    this.logger?.warn?.(
      `[triple-brain-adapter] hacker brain requested unknown tool "${name}" — ` +
      `falling back to web_probe (allowlist: ${[...SAFE_TOOLS].join(', ')})`
    );
    return 'web_probe';
  }

  strategyToDecision(strategy, context, meta = {}) {
    const job = context.job || {};
    const target = normalizeTarget(job);
    const action = strategy?.nextAction || {};
    const hypothesis = strategy?.hypothesis || '';
    const degraded = meta.degraded ? 'triple-degraded' : 'triple';
    const prefix = meta.degraded
      ? 'Triple-brain (vision model covering for the MISSING hacker brain)'
      : 'Triple-brain (hacker slot, local model)';

    const base = {
      objective: hypothesis || `Advance the hunt against ${target}`,
      observation: `${(context.findings || []).length} finding(s) so far`,
      reason: `${prefix}: ${hypothesis || action.rationale || 'proposing the next step'}`,
      expectedOutcome: action.rationale || 'New evidence about the target',
      confidence: 0.8,
      methodologyStage: (context.job?.phase) || 'vulnerability_detection',
      hypotheses: Array.isArray(strategy?.vulnChains)
        ? strategy.vulnChains.map((vc) => ({
            hypothesis: vc.chain,
            status: 'open',
            evidence: (vc.steps || []).join(' → '),
            nextTest: vc.impact || null,
          }))
        : [],
      memoryNotes: [],
      brainSource: degraded,
      // Direct orders from the hacking brain to the subordinate brains.
      // The see/act loop executes these verbatim: vision only sees,
      // grounding only clicks.
      brainOrders: {
        vision: typeof strategy?.visionInstruction === 'string' ? strategy.visionInstruction : '',
        grounding: typeof strategy?.groundingInstruction === 'string' ? strategy.groundingInstruction : '',
      },
    };

    const toolDecision = (name) => ({
      ...base,
      nextAction: {
        type: 'tool',
        name: this.sanitizeTool(name),
        target,
        arguments: {},
        description: action.rationale || 'Hacker-brain tool pick',
      },
    });

    switch (action.kind) {
      case 'tool':
        return toolDecision(action.tool);
      case 'validate':
        return {
          ...base,
          nextAction: {
            type: 'validate',
            hypothesis: hypothesis || action.rationale || 'Validate the current hypothesis',
            target,
          },
        };
      case 'observe':
        return {
          ...base,
          nextAction: {
            type: 'observation',
            observation: action.rationale || hypothesis || 'Hacker-brain observation',
            target,
          },
        };
      case 'click':
      case 'type':
        return {
          ...base,
          nextAction: {
            type: 'computer_action',
            action: {
              type: action.kind,
              target: action.targetElement || null,
              text: action.text || null,
            },
            target,
            description: action.rationale || `Hacker brain: ${action.kind} ${action.targetElement || ''}`.trim(),
          },
        };
      case 'report':
        return {
          ...base,
          objective: `Assemble the hunt report for ${target}`,
          reason: `${prefix}: enough evidence gathered — finalizing the hunt and assembling the report.`,
          expectedOutcome: 'Hunt report assembled',
          nextAction: { type: 'complete', reason: 'Hacker brain requested report assembly.' },
        };
      case 'done':
        return {
          ...base,
          reason: `${prefix}: done — ${hypothesis || 'objectives satisfied'}`,
          expectedOutcome: 'Hunt complete',
          nextAction: { type: 'complete', reason: hypothesis || 'Hacker brain signaled completion.' },
        };
      default:
        // Unknown / empty strategy: safest useful move is a recon probe.
        return {
          ...toolDecision('web_probe'),
          reason: `${prefix}: strategy had no usable action (kind="${action.kind || 'none'}") — defaulting to web_probe recon.`,
        };
    }
  }

  async degradedDecide(context, why) {
    this.degradedDecisions += 1;
    this.logger?.warn?.(
      `[triple-brain-adapter] think() unusable (${why}) — delegating to the deterministic brain so the hunt keeps moving`
    );
    if (this.deterministic && typeof this.deterministic.decide === 'function') {
      const out = await this.deterministic.decide(context);
      if (out?.decision) out.decision.brainSource = 'triple-degraded-deterministic';
      return out;
    }
    throw new Error(`Triple-brain think() failed and no deterministic fallback is wired: ${why}`);
  }

  async decide(context = {}) {
    const job = context.job || {};
    const target = normalizeTarget(job);
    const observations = (context.recentObservations || []).map((o) =>
      typeof o === 'string' ? o : String(o?.summary || o?.text || o?.message || JSON.stringify(o)).slice(0, 500)
    );
    const findings = (context.findings || []).map((f) => ({
      severity: f?.severity || '?',
      title: f?.title || f?.type || 'finding',
      description: String(f?.description || '').slice(0, 300),
    }));
    const history = (context.recentCycles || []).map((h) =>
      typeof h === 'string' ? h : String(h?.summary || JSON.stringify(h)).slice(0, 200)
    );

    let res;
    try {
      res = await this.orchestrator.think({
        target,
        stage: job?.phase || 'recon',
        observations,
        findings,
        history,
      });
    } catch (error) {
      return this.degradedDecide(context, `think() threw: ${error?.message || error}`);
    }
    if (!res?.ok) {
      return this.degradedDecide(context, res?.reason || 'no thinking brain available');
    }
    if (res.strategy?.done) {
      return {
        decision: this.strategyToDecision({ ...res.strategy, nextAction: { kind: 'done' } }, context, res),
      };
    }
    return { decision: this.strategyToDecision(res.strategy, context, res) };
  }
}

export default TripleBrainHuntAdapter;
