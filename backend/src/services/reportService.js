import { config } from '../config.js';

/**
 * ReportService — generates structured security assessment reports from evidence.
 *
 * Separation of concerns: the Security Agent investigates and produces structured findings.
 * The Report Service takes those structured findings and generates a professional report.
 * It does NOT invent evidence — every claim must reference stored data.
 */
export class ReportService {
  constructor({ reportModel, assessmentModel, findingModel, toolExecutionModel, agentStateModel, eventService }) {
    this.reportModel = reportModel;
    this.assessmentModel = assessmentModel;
    this.findingModel = findingModel;
    this.toolExecutionModel = toolExecutionModel;
    this.agentStateModel = agentStateModel;
    this.eventService = eventService;
  }

  /** List reports for an assessment. */
  async list(assessmentId) {
    return this.reportModel.list(assessmentId);
  }

  /** List all reports for a user. */
  async listByUser(userId) {
    return this.reportModel.listByUser(userId);
  }

  /** Get a specific report. */
  async get(reportId) {
    return this.reportModel.get(reportId);
  }

  /** Get the latest report for an assessment. */
  async getLatest(assessmentId) {
    return this.reportModel.getLatest(assessmentId);
  }

  /**
   * Generate a new report version for an assessment.
   * Collects all findings, tool executions, timeline events, and agent state
   * to produce a comprehensive, evidence-backed security report.
   */
  async generate(userId, assessmentId) {
    const assessment = await this.assessmentModel.get(userId, assessmentId);
    const findings = await this.findingModel.list(assessmentId);
    const toolExecutions = await this.toolExecutionModel.list(assessmentId);
    const agentState = await this.agentStateModel.get(assessmentId);
    const events = await this.eventService.list(assessmentId);

    await this.eventService.publish(assessmentId, {
      type: 'REPORT_GENERATION_STARTED',
      level: 'INFO',
      message: 'Report generation started'
    });

    // Build severity counts
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
    for (const finding of findings) {
      if (severityCounts[finding.severity] !== undefined) {
        severityCounts[finding.severity]++;
      }
    }

    // Build testing timeline from events
    const testingTimeline = this.buildTestingTimeline(events);

    // Build assets tested
    const assetsTested = agentState
      ? [...new Set([
          assessment.targetHostname,
          ...(agentState.subdomains || []).slice(0, 100)
        ])]
      : [assessment.targetHostname];

    // Build attack surface summary
    const attackSurface = {
      subdomains: agentState?.subdomains?.length || 0,
      endpoints: agentState?.endpoints?.length || 0,
      technologies: agentState?.technologies || [],
      openPorts: agentState?.openPorts || [],
      topSubdomains: (agentState?.subdomains || []).slice(0, 20),
      topEndpoints: (agentState?.endpoints || []).slice(0, 20)
    };

    // Build tooling summary
    const toolingSummary = this.buildToolingSummary(toolExecutions);

    // Build detailed findings with evidence chains
    const detailedFindings = findings.map(finding => ({
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
      remediation: finding.remediation,
      references: finding.references,
      evidence: finding.evidence,
      toolExecutionIds: finding.toolExecutionIds,
      observationIds: finding.observationIds,
      createdAt: finding.createdAt,
      validatedAt: finding.validatedAt
    }));

    // Build findings summary
    const findingsSummary = {
      total: findings.length,
      ...severityCounts,
      validated: findings.filter(f => f.status === 'validated').length,
      potential: findings.filter(f => f.status === 'potential').length,
      falsePositive: findings.filter(f => f.status === 'false_positive').length
    };

    // Generate executive summary
    const executiveSummary = this.generateExecutiveSummary(assessment, findingsSummary, attackSurface);

    // Build report
    let report;
    if (config.llmApiKey) {
      report = await this.generateWithLLM(assessment, {
        executiveSummary,
        findingsSummary,
        detailedFindings,
        attackSurface,
        assetsTested,
        testingTimeline,
        toolingSummary,
        severityCounts
      });
    } else {
      report = {
        title: `Security Assessment Report — ${assessment.targetHostname}`,
        executiveSummary,
        scope: assessment.scope,
        methodology: this.getMethodology(),
        testingTimeline,
        assetsTested,
        attackSurface,
        findingsSummary,
        detailedFindings,
        riskContext: this.getRiskContext(findingsSummary),
        limitations: this.getLimitations(assessment),
        toolingSummary,
        appendix: [],
        targetHostname: assessment.targetHostname,
        totalFindings: findings.length,
        ...severityCounts
      };
    }

    // Append count fields
    report.totalFindings = findings.length;
    report.criticalCount = severityCounts.critical;
    report.highCount = severityCounts.high;
    report.mediumCount = severityCounts.medium;
    report.lowCount = severityCounts.low;
    report.informationalCount = severityCounts.informational;
    report.targetHostname = assessment.targetHostname;

    const saved = await this.reportModel.create(assessmentId, userId, report);

    await this.eventService.publish(assessmentId, {
      type: 'REPORT_GENERATED',
      level: 'INFO',
      message: `Report v${saved.version} generated — ${findings.length} finding(s)`,
      data: { reportId: saved.id, version: saved.version }
    });

    return saved;
  }

  /** Generate executive summary from data — no fabrication. */
  generateExecutiveSummary(assessment, findingsSummary, attackSurface) {
    const parts = [];
    parts.push(`A security assessment was conducted against ${assessment.targetHostname} with explicit authorization.`);
    parts.push(`The assessment discovered ${attackSurface.subdomains} subdomain(s) and ${attackSurface.endpoints} endpoint(s).`);

    if (findingsSummary.total === 0) {
      parts.push('No security vulnerabilities were identified during this assessment.');
    } else {
      parts.push(`A total of ${findingsSummary.total} finding(s) were identified:`);
      if (findingsSummary.critical > 0) parts.push(`  • ${findingsSummary.critical} Critical`);
      if (findingsSummary.high > 0) parts.push(`  • ${findingsSummary.high} High`);
      if (findingsSummary.medium > 0) parts.push(`  • ${findingsSummary.medium} Medium`);
      if (findingsSummary.low > 0) parts.push(`  • ${findingsSummary.low} Low`);
      if (findingsSummary.informational > 0) parts.push(`  • ${findingsSummary.informational} Informational`);
      parts.push(`Of these, ${findingsSummary.validated} have been validated with supporting evidence.`);
    }

    if (attackSurface.technologies.length > 0) {
      parts.push(`Technologies detected: ${attackSurface.technologies.slice(0, 10).join(', ')}.`);
    }

    return parts.join('\n');
  }

  /** Build testing timeline from events. */
  buildTestingTimeline(events) {
    const phases = new Map();
    for (const event of events) {
      if (event.type === 'PHASE_CHANGED' && event.data?.phase) {
        phases.set(event.data.phase, { phase: event.data.phase, startedAt: event.timestamp });
      }
    }
    return [...phases.values()];
  }

  /** Build tooling summary from tool executions. */
  buildToolingSummary(executions) {
    const tools = new Map();
    for (const exec of executions) {
      if (!tools.has(exec.tool)) {
        tools.set(exec.tool, {
          tool: exec.tool,
          category: exec.category,
          executions: 0,
          completed: 0,
          failed: 0,
          totalDuration: 0
        });
      }
      const entry = tools.get(exec.tool);
      entry.executions++;
      if (exec.status === 'completed') {
        entry.completed++;
        entry.totalDuration += exec.duration || 0;
      } else if (exec.status === 'failed') {
        entry.failed++;
      }
    }
    return [...tools.values()];
  }

  /** Standard methodology description. */
  getMethodology() {
    return `The assessment followed a structured methodology:
1. Passive Reconnaissance — Certificate transparency, DNS records, web archives
2. Active Enumeration — Subdomain enumeration, HTTP probing, port scanning
3. Technology Detection — Web technology fingerprinting, WAF detection
4. Endpoint Discovery — Web crawling, JavaScript analysis, parameter mining
5. Vulnerability Detection — Template-based scanning, configuration analysis
6. Finding Validation — Safe verification of potential vulnerabilities
7. Evidence Collection — Capturing proof for each validated finding

All testing was conducted within the authorized scope using controlled tool execution with policy validation.`;
  }

  /** Risk context based on findings. */
  getRiskContext(findingsSummary) {
    if (findingsSummary.critical > 0 || findingsSummary.high > 0) {
      return 'Critical and/or high-severity vulnerabilities were identified that could allow unauthorized access, data exposure, or service disruption. Immediate remediation is recommended.';
    }
    if (findingsSummary.medium > 0) {
      return 'Medium-severity issues were identified that could be leveraged as part of a larger attack chain. Remediation is recommended within a reasonable timeframe.';
    }
    if (findingsSummary.low > 0 || findingsSummary.informational > 0) {
      return 'Only low-severity or informational findings were identified. These represent best-practice improvements rather than exploitable vulnerabilities.';
    }
    return 'No vulnerabilities were identified during this assessment. The application appears to follow security best practices within the tested scope.';
  }

  /** Assessment limitations. */
  getLimitations(assessment) {
    return `This assessment was limited to the authorized scope: ${(assessment.scope?.included || []).join(', ') || assessment.targetHostname}. ` +
      `Testing was non-destructive and automated. Manual exploitation was not performed. ` +
      `Findings are based on automated tool output and AI analysis. False positives may exist.`;
  }

  /** LLM-enhanced report generation — improves executive summary and risk context. */
  async generateWithLLM(assessment, data) {
    try {
      const url = `${config.llmBaseUrl}/models/${config.llmModel}:generateContent?key=${config.llmApiKey}`;
      const prompt = `You are a professional security report writer. Generate a polished security assessment report based on this data.
Target: ${assessment.targetHostname}
Findings Summary: ${JSON.stringify(data.findingsSummary)}
Attack Surface: ${JSON.stringify({ subdomains: data.attackSurface.subdomains, endpoints: data.attackSurface.endpoints, technologies: data.attackSurface.technologies })}
Tool Executions: ${data.toolingSummary.length} tools used
Detailed Findings: ${JSON.stringify(data.detailedFindings.slice(0, 10).map(f => ({ title: f.title, severity: f.severity, description: f.description?.slice(0, 200) })))}

Return a JSON object with these fields: executiveSummary (string), riskContext (string), limitations (string).
Do NOT invent findings or evidence. Only describe what was actually found.`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2000, responseMimeType: 'application/json' }
        })
      });

      if (!response.ok) throw new Error('LLM API error');
      const result = await response.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('No LLM response');

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const enhanced = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      return {
        title: `Security Assessment Report — ${assessment.targetHostname}`,
        executiveSummary: enhanced.executiveSummary || data.executiveSummary,
        scope: assessment.scope,
        methodology: this.getMethodology(),
        testingTimeline: data.testingTimeline,
        assetsTested: data.assetsTested,
        attackSurface: data.attackSurface,
        findingsSummary: data.findingsSummary,
        detailedFindings: data.detailedFindings,
        riskContext: enhanced.riskContext || this.getRiskContext(data.findingsSummary),
        limitations: enhanced.limitations || this.getLimitations(assessment),
        toolingSummary: data.toolingSummary,
        appendix: []
      };
    } catch {
      // Fallback to deterministic report
      return {
        title: `Security Assessment Report — ${assessment.targetHostname}`,
        executiveSummary: data.executiveSummary,
        scope: assessment.scope,
        methodology: this.getMethodology(),
        testingTimeline: data.testingTimeline,
        assetsTested: data.assetsTested,
        attackSurface: data.attackSurface,
        findingsSummary: data.findingsSummary,
        detailedFindings: data.detailedFindings,
        riskContext: this.getRiskContext(data.findingsSummary),
        limitations: this.getLimitations(assessment),
        toolingSummary: data.toolingSummary,
        appendix: []
      };
    }
  }
}
