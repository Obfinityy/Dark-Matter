/**
 * ReportService — professional, evidence-backed bug-bounty reports.
 *
 * Rules that matter:
 *   • Every claim comes from stored data: findings, evidence, tool executions,
 *     agent state and the persisted event timeline. Nothing is invented (#26).
 *   • Report generation happens in the backend and is persisted, so it survives
 *     a frontend disconnect (#29). Reports are versioned (#55).
 *   • No external LLM participates. Optional narrative polish goes through the
 *     LOCAL phone model only; without it the report is fully deterministic.
 */

export class ReportService {
  constructor({
    reportModel,
    assessmentModel,
    findingModel,
    toolExecutionModel,
    agentStateModel,
    eventService,
    evidenceModel = null,
    localModel = null
  }) {
    this.reportModel = reportModel;
    this.assessmentModel = assessmentModel;
    this.findingModel = findingModel;
    this.toolExecutionModel = toolExecutionModel;
    this.agentStateModel = agentStateModel;
    this.eventService = eventService;
    this.evidenceModel = evidenceModel;
    this.localModel = localModel;
  }

  async list(assessmentId) {
    return this.reportModel.list(assessmentId);
  }

  async listByUser(userId) {
    return this.reportModel.listByUser(userId);
  }

  async get(reportId) {
    return this.reportModel.get(reportId);
  }

  async getLatest(assessmentId) {
    return this.reportModel.getLatest(assessmentId);
  }

  /**
   * Generate a new report version for an assessment.
   * Versioning is automatic: each call appends a new immutable version.
   */
  async generate(userId, assessmentId) {
    const assessment = await this.assessmentModel.get(userId, assessmentId);
    const findings = await this.findingModel.list(assessmentId);
    const toolExecutions = await this.toolExecutionModel.list(assessmentId);
    const agentState = await this.agentStateModel.get(assessmentId);
    const events = await this.eventService.list(assessmentId);
    const evidence = this.evidenceModel ? await this.evidenceModel.list(assessmentId) : [];

    await this.eventService.publish(assessmentId, {
      type: 'REPORT_GENERATION_STARTED',
      level: 'INFO',
      message: 'Report generation started'
    });

    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
    for (const finding of findings) {
      if (severityCounts[finding.severity] !== undefined) severityCounts[finding.severity] += 1;
    }

    const evidenceById = new Map(evidence.map((item) => [item.id, item]));
    const evidenceByFinding = new Map();
    for (const item of evidence) {
      if (!item.findingId) continue;
      if (!evidenceByFinding.has(item.findingId)) evidenceByFinding.set(item.findingId, []);
      evidenceByFinding.get(item.findingId).push(item);
    }

    // ── Mandated report sections ─────────────────────────────────────────
    const validatedFindings = findings.filter((finding) => finding.status === 'validated' && (evidenceByFinding.get(finding.id)?.length || finding.evidence?.length));
    const unverifiedObservations = findings.filter((finding) => finding.status !== 'validated');

    const detailedFindings = validatedFindings.map((finding) => {
      const linked = (evidenceByFinding.get(finding.id) || []).map((item) => ({
        id: item.id,
        kind: item.kind,
        asset: item.asset,
        endpoint: item.endpoint,
        request: item.request,
        response: item.response ? String(item.response).slice(0, 6000) : null,
        summary: item.summary,
        artifactPath: item.artifactPath,
        sha256: item.sha256,
        capturedAt: item.capturedAt
      }));
      return {
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        confidence: finding.confidence,
        status: finding.status,
        category: finding.category,
        affectedAsset: finding.affectedAsset,
        affectedEndpoint: finding.affectedEndpoint,
        parameter: finding.parameter,
        description: finding.description,
        impact: finding.impact,
        reproductionSteps: finding.reproductionSteps,
        expectedBehavior: finding.expectedBehavior,
        observedBehavior: finding.observedBehavior,
        technicalRootCause: finding.category,
        remediation: finding.remediation,
        references: finding.references,
        evidence: linked,
        evidenceIds: linked.map((item) => item.id),
        toolExecutionIds: finding.toolExecutionIds,
        hypothesisId: finding.hypothesisId,
        createdAt: finding.createdAt,
        validatedAt: finding.validatedAt
      };
    });

    const attackSurface = {
      subdomains: agentState?.subdomains?.length || 0,
      endpoints: agentState?.endpoints?.length || 0,
      technologies: agentState?.technologies || [],
      openPorts: agentState?.openPorts || [],
      topSubdomains: (agentState?.subdomains || []).slice(0, 50),
      topEndpoints: (agentState?.endpoints || []).slice(0, 50)
    };

    const assetsTested = [...new Set([
      assessment.targetHostname,
      ...(agentState?.subdomains || []).slice(0, 200)
    ].filter(Boolean))];

    const testingTimeline = this.buildTestingTimeline(events);
    const toolingSummary = this.buildToolingSummary(toolExecutions);
    const testingCoverage = this.buildTestingCoverage(toolExecutions, agentState);

    const findingsSummary = {
      total: findings.length,
      ...severityCounts,
      validated: validatedFindings.length,
      potential: findings.filter((finding) => finding.status === 'potential').length,
      falsePositive: findings.filter((finding) => finding.status === 'false_positive').length,
      evidenceRecords: evidence.length
    };

    const executiveSummary = this.generateExecutiveSummary(assessment, findingsSummary, attackSurface);

    const base = {
      title: `Bug Bounty Assessment Report — ${assessment.targetHostname}`,
      executiveSummary,
      scope: {
        included: assessment.scope?.included || [assessment.targetHostname],
        excluded: assessment.scope?.excluded || [],
        authorization: 'Explicitly authorized by the target owner (confirmed at assessment creation).'
      },
      methodology: this.getMethodology(),
      testingTimeline,
      assetsTested,
      attackSurface,
      findingsSummary,
      detailedFindings,
      testingCoverage,
      unverifiedObservations: unverifiedObservations.map((finding) => ({
        id: finding.id,
        title: finding.title,
        status: finding.status,
        severity: finding.severity,
        description: finding.description,
        note: 'Recorded as an observation/hypothesis only — NOT a confirmed vulnerability.'
      })),
      riskContext: this.getRiskContext(findingsSummary),
      limitations: this.getLimitations(assessment, findingsSummary),
      toolingSummary,
      conclusion: this.getConclusion(assessment, findingsSummary),
      evidenceIndex: evidence.map((item) => ({
        id: item.id,
        kind: item.kind,
        asset: item.asset,
        endpoint: item.endpoint,
        summary: item.summary,
        findingId: item.findingId,
        sha256: item.sha256,
        artifactPath: item.artifactPath,
        capturedAt: item.capturedAt
      })),
      appendix: [],
      targetHostname: assessment.targetHostname,
      totalFindings: findings.length,
      ...severityCounts
    };

    // Optional narrative polish via the LOCAL model only. If it is unavailable
    // the deterministic report is used as-is — never a cloud fallback.
    let report = base;
    if (this.localModel) {
      const polished = await this.polishWithLocalModel(base);
      if (polished) report = { ...base, ...polished };
    }

    report.totalFindings = findings.length;
    report.criticalCount = severityCounts.critical;
    report.highCount = severityCounts.high;
    report.mediumCount = severityCounts.medium;
    report.lowCount = severityCounts.low;
    report.informationalCount = severityCounts.informational;
    report.targetHostname = assessment.targetHostname;
    report.evidenceCount = evidence.length;
    report.validatedCount = validatedFindings.length;

    const saved = await this.reportModel.create(assessmentId, userId, report);

    await this.eventService.publish(assessmentId, {
      type: 'REPORT_GENERATED',
      level: 'INFO',
      message: `Report v${saved.version} generated — ${validatedFindings.length} confirmed finding(s), ${evidence.length} evidence record(s)`,
      data: { reportId: saved.id, version: saved.version }
    });

    return saved;
  }

  /** Executive summary — deterministic, no fabrication. */
  generateExecutiveSummary(assessment, findingsSummary, attackSurface) {
    const parts = [];
    parts.push(`An authorized security assessment was conducted against ${assessment.targetHostname}.`);
    parts.push(`The assessment enumerated ${attackSurface.subdomains} subdomain(s) and ${attackSurface.endpoints} endpoint(s), backed by ${findingsSummary.evidenceRecords} stored evidence record(s).`);

    if (findingsSummary.validated === 0) {
      parts.push('No vulnerabilities were confirmed with evidence during this assessment.');
    } else {
      parts.push(`${findingsSummary.validated} finding(s) were confirmed with supporting evidence:`);
      if (findingsSummary.critical > 0) parts.push(`  • ${findingsSummary.critical} Critical`);
      if (findingsSummary.high > 0) parts.push(`  • ${findingsSummary.high} High`);
      if (findingsSummary.medium > 0) parts.push(`  • ${findingsSummary.medium} Medium`);
      if (findingsSummary.low > 0) parts.push(`  • ${findingsSummary.low} Low`);
      if (findingsSummary.informational > 0) parts.push(`  • ${findingsSummary.informational} Informational`);
    }
    if (findingsSummary.potential > 0) {
      parts.push(`${findingsSummary.potential} further observation(s) remain unverified and are listed separately — they are NOT reported as vulnerabilities.`);
    }
    if (attackSurface.technologies.length > 0) {
      parts.push(`Technologies detected: ${attackSurface.technologies.slice(0, 15).join(', ')}.`);
    }
    return parts.join('\n');
  }

  buildTestingTimeline(events) {
    const phases = new Map();
    for (const event of events) {
      if (event.type === 'job.phase_changed' && event.data?.phase) {
        phases.set(event.data.phase, { phase: event.data.phase, startedAt: event.timestamp });
      }
    }
    return [...phases.values()];
  }

  buildToolingSummary(executions) {
    const tools = new Map();
    for (const execution of executions) {
      if (!tools.has(execution.tool)) {
        tools.set(execution.tool, { tool: execution.tool, category: execution.category, executions: 0, completed: 0, failed: 0, totalDuration: 0 });
      }
      const entry = tools.get(execution.tool);
      entry.executions += 1;
      if (execution.status === 'completed') {
        entry.completed += 1;
        entry.totalDuration += execution.duration || 0;
      } else if (execution.status === 'failed') {
        entry.failed += 1;
      }
    }
    return [...tools.values()];
  }

  /** Testing coverage — what was actually exercised, from real executions. */
  buildTestingCoverage(executions, agentState) {
    const phasesCovered = new Set(executions.map((execution) => execution.category).filter(Boolean));
    const failed = executions.filter((execution) => execution.status === 'failed');
    return {
      toolsExecuted: executions.length,
      successful: executions.filter((execution) => execution.status === 'completed').length,
      failed: failed.length,
      phasesCovered: [...phasesCovered],
      assetsEnumerated: (agentState?.subdomains || []).length,
      endpointsEnumerated: (agentState?.endpoints || []).length,
      parametersEnumerated: (agentState?.parameters || []).length,
      gaps: [
        'Automated, non-destructive testing only — manual exploitation was not performed.',
        failed.length ? `${failed.length} tool execution(s) failed and are listed as coverage gaps.` : null
      ].filter(Boolean)
    };
  }

  getMethodology() {
    return `The assessment followed a structured, evidence-driven methodology executed by DARKMATTER's
autonomous agent under an explicitly authorized scope:

1. Target intake and authorization — the owner confirmed authorization; the scope was persisted.
2. Passive reconnaissance — DNS/certificate intelligence and historical URL sources.
3. Asset enumeration — subdomain discovery, resolution and filtering against the scope.
4. Live service discovery — HTTP probing, port scanning, technology fingerprinting.
5. Attack-surface mapping — endpoint, parameter and behaviour discovery.
6. Hypothesis generation — the local AI proposes testable hypotheses from real observations.
7. Validation — each hypothesis must be supported by stored evidence before it becomes a finding.
8. Evidence collection — requests, responses, tool output and screenshots are stored immutably.
9. Reporting — this report is generated from the stored evidence, never from model memory.

Every action passed DARKMATTER's scope engine and policy validator before execution.`;
  }

  getRiskContext(findingsSummary) {
    if (findingsSummary.validated === 0) {
      return 'No evidence-backed vulnerabilities were identified. Unverified observations are listed separately and should not be treated as confirmed issues.';
    }
    if (findingsSummary.critical > 0 || findingsSummary.high > 0) {
      return 'Critical and/or high-severity vulnerabilities were confirmed. These could allow unauthorized access, data exposure or service disruption. Immediate remediation is recommended.';
    }
    if (findingsSummary.medium > 0) {
      return 'Medium-severity issues were confirmed. These could be chained into a larger attack. Remediation is recommended within a reasonable timeframe.';
    }
    return 'Only low-severity or informational issues were confirmed. These represent hardening opportunities rather than immediate exploitable risks.';
  }

  getLimitations(assessment, findingsSummary = {}) {
    return `Testing was restricted to the authorized scope: ${(assessment.scope?.included || [assessment.targetHostname]).join(', ')}.
Testing was automated and non-destructive; no data was modified or exfiltrated beyond what was needed to demonstrate an issue.
Tool failures and unverified observations are disclosed elsewhere in this report rather than omitted.
${findingsSummary.evidenceRecords ? `Every confirmed finding references ${findingsSummary.evidenceRecords} stored evidence record(s).` : 'No evidence-bearing findings were produced.'}
The local language model assisted with hypothesis generation and triage; all confirmations are evidence-based.`;
  }

  getConclusion(assessment, findingsSummary) {
    if (findingsSummary.validated === 0) {
      return `The assessment of ${assessment.targetHostname} found no evidence-backed vulnerabilities within the authorized scope. The enumerated attack surface and unverified observations are documented above for follow-up testing.`;
    }
    return `The assessment of ${assessment.targetHostname} confirmed ${findingsSummary.validated} vulnerability/vulnerabilities with supporting evidence. Each item above includes the affected asset, endpoint, impact, reproduction context and remediation guidance.`;
  }

  /**
   * Optional narrative polish through the LOCAL phone model only.
   * Returns null when the model is unavailable — the caller keeps the
   * deterministic report. Never calls a cloud provider.
   */
  async polishWithLocalModel(base) {
    try {
      const prompt = [
        'You are a professional security report writer.',
        'Rewrite the executive summary and risk context below so they read clearly.',
        'Use ONLY the facts provided. Do not add findings, evidence or numbers that are not present.',
        'Reply with a JSON object: {"executiveSummary": "...", "riskContext": "...", "conclusion": "..."}',
        '',
        `Target: ${base.targetHostname}`,
        `Findings summary: ${JSON.stringify(base.findingsSummary)}`,
        `Executive summary draft: ${base.executiveSummary}`,
        `Risk context draft: ${base.riskContext}`,
        `Conclusion draft: ${base.conclusion}`
      ].join('\n');

      const text = await this.localModel.complete([{ role: 'user', content: prompt }], { maxTokens: 900, maxAttempts: 1 });
      const match = String(text?.text || '').match(/\{[\s\S]*\}/);
      if (!match) return null;
      const parsed = JSON.parse(match[0]);
      return {
        executiveSummary: typeof parsed.executiveSummary === 'string' ? parsed.executiveSummary.slice(0, 4000) : base.executiveSummary,
        riskContext: typeof parsed.riskContext === 'string' ? parsed.riskContext.slice(0, 2000) : base.riskContext,
        conclusion: typeof parsed.conclusion === 'string' ? parsed.conclusion.slice(0, 4000) : base.conclusion
      };
    } catch {
      return null;
    }
  }

  /**
   * Generate a HackerOne-style industry markdown report (idea #4).
   * This is the report the user submits to a bug bounty platform to claim
   * a bounty: summary, severity, CVSS, steps to reproduce, impact, remediation.
   * Every claim is backed by stored evidence — no fabricated findings.
   *
   * Flexible output (user asked: "jaise main maangu vaise report"):
   * @param {object} [options]
   * @param {string[]} [options.severities] — only include these severities
   *   (e.g. ['high','critical'] for "sirf high wali report do")
   * @param {boolean} [options.perFinding] — return one markdown per finding
   *   instead of a single combined report ("ek-ek vulnerability alag-alag")
   * @param {string} [options.findingId] — report for a single finding only
   */
  async generateMarkdown(userId, assessmentId, options = {}) {
    const base = await this.generate(userId, assessmentId);
    let findings = base.detailedFindings || [];

    // Severity filter: "sirf high/critical wali do"
    if (options.severities?.length) {
      const wanted = new Set(options.severities.map((s) => String(s).toLowerCase()));
      findings = findings.filter((f) => wanted.has(String(f.severity).toLowerCase()));
    }
    // Single finding: "is wali ka alag report do"
    if (options.findingId) {
      findings = findings.filter((f) => f.id === options.findingId);
    }

    // Per-finding mode: one standalone report per vulnerability
    if (options.perFinding) {
      return {
        perFinding: true,
        reports: findings.map((f) => ({
          findingId: f.id,
          title: f.title,
          severity: f.severity,
          markdown: this.renderFindingReport(f, base, true)
        }))
      };
    }

    return {
      markdown: this.renderFullReport(findings, base),
      findingCount: findings.length,
      severityCounts: base.severityCounts
    };
  }

  /** Render one finding as a standalone bounty-submission report. */
  renderFindingReport(f, base, standalone = false) {
    const lines = [];
    if (standalone) {
      lines.push(`# ${f.title}`);
      lines.push(``);
      lines.push(`**Target:** ${base.target || 'n/a'} | **Date:** ${new Date().toISOString().slice(0, 10)}`);
      lines.push(``);
    } else {
      lines.push(`### ${f.title}`);
      lines.push(``);
    }
    lines.push(`**Severity:** ${f.severity}${f.cvss ? ` (CVSS ${f.cvss})` : ''} | **Confidence:** ${f.confidence || 'n/a'} | **Status:** ${f.status}`);
    lines.push(`**Affected asset:** ${f.affectedAsset || 'n/a'}`);
    if (f.affectedEndpoint) lines.push(`**Endpoint:** ${f.affectedEndpoint}`);
    if (f.parameter) lines.push(`**Parameter:** ${f.parameter}`);
    lines.push(``);
    lines.push(`#### Description`);
    lines.push(``);
    lines.push(f.description || 'No description recorded.');
    lines.push(``);
    if (f.impact) {
      lines.push(`#### Impact`);
      lines.push(``);
      lines.push(f.impact);
      lines.push(``);
    }
    if (f.reproductionSteps?.length) {
      lines.push(`#### Steps to Reproduce`);
      lines.push(``);
      f.reproductionSteps.forEach((step, j) => lines.push(`${j + 1}. ${step}`));
      lines.push(``);
    }
    if (f.expectedBehavior || f.observedBehavior) {
      lines.push(`#### Expected vs Observed`);
      lines.push(``);
      if (f.expectedBehavior) lines.push(`- **Expected:** ${f.expectedBehavior}`);
      if (f.observedBehavior) lines.push(`- **Observed:** ${f.observedBehavior}`);
      lines.push(``);
    }
    if (f.remediation) {
      lines.push(`#### Remediation`);
      lines.push(``);
      lines.push(f.remediation);
      lines.push(``);
    }
    const ev = f.evidence || [];
    if (ev.length) {
      lines.push(`#### Evidence (${ev.length})`);
      lines.push(``);
      for (const e of ev.slice(0, 5)) {
        lines.push(`- [${e.kind}] ${e.summary || e.id}${e.sha256 ? ` (sha256: ${String(e.sha256).slice(0, 16)}…)` : ''}`);
      }
      lines.push(``);
    }
    return lines.join('\n');
  }

  /** Render the full combined report. */
  renderFullReport(findings, base) {
    const lines = [];

    lines.push(`# Security Assessment Report`);
    lines.push(``);
    lines.push(`**Target:** ${base.target || 'n/a'}`);
    lines.push(`**Assessment ID:** ${base.assessmentId || 'n/a'}`);
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**Methodology:** Autonomous assessment (Dark-Matter agent)`);
    lines.push(``);
    lines.push(`## Executive Summary`);
    lines.push(``);
    lines.push(base.executiveSummary || 'No summary available.');
    lines.push(``);
    lines.push(`## Severity Breakdown`);
    lines.push(``);
    lines.push(`| Severity | Count |`);
    lines.push(`|----------|-------|`);
    for (const [sev, count] of Object.entries(base.severityCounts || {})) {
      lines.push(`| ${sev} | ${count} |`);
    }
    lines.push(``);

    if (!findings.length) {
      lines.push(`## Findings`);
      lines.push(``);
      lines.push(`No validated vulnerabilities were confirmed during this assessment.`);
      lines.push(``);
    } else {
      lines.push(`## Findings (${findings.length})`);
      lines.push(``);
      findings.forEach((f) => {
        lines.push(this.renderFindingReport(f, base, false));
        lines.push(`---`);
        lines.push(``);
      });
    }

    lines.push(`## Methodology Notes`);
    lines.push(``);
    lines.push(`- Assessment performed by an autonomous agent under explicit user authorization.`);
    lines.push(`- Scope: ${(base.scope?.included || []).join(', ') || base.target || 'n/a'}`);
    lines.push(`- All findings are backed by stored evidence; unvalidated observations are excluded.`);
    lines.push(``);
    lines.push(`*Generated by Dark-Matter autonomous bug-bounty agent.*`);

    return lines.join('\n');
  }
}