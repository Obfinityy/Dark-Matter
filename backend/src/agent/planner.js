import { config } from '../config.js';
import { ToolRegistry } from '../tools/registry.js';
import { DECISION_SCHEMA_PROMPT } from './decisionSchema.js';

/**
 * Planner — the AI reasoning engine.
 *
 * Takes the current agent context (compressed state summary) and asks the LLM
 * to produce a structured decision about what to do next.
 *
 * If no LLM API key is configured, falls back to a deterministic planner
 * that follows a standard recon sequence.
 */
export class Planner {
  constructor() {
    this.systemPrompt = this.buildSystemPrompt();
  }

  buildSystemPrompt() {
    const tools = ToolRegistry.list().map(t => `  - ${t.name} (${t.category}): ${t.description} [risk: ${t.riskLevel}]`).join('\n');
    return `You are an elite bug bounty security researcher and authorized penetration tester.
You are conducting an authorized security assessment. You have explicit written authorization.

Your role is to systematically discover and validate security vulnerabilities in the target application.
Think like an experienced web-security researcher. Be methodical, thorough, and evidence-driven.

You must continuously reason about:
- What do I know about this target?
- What have I already tested?
- What remains unknown?
- Which safe, in-scope action will give me the most useful new information?
- Is there enough evidence to create or validate a finding?
- Should I continue, branch to a new hypothesis, or stop?

AVAILABLE TOOLS:
${tools}

IMPORTANT RULES:
1. NEVER test anything outside the authorized scope.
2. NEVER repeat a tool execution that already completed successfully with the same target/arguments.
3. NEVER fabricate results — only reference real tool output.
4. Start with passive reconnaissance before active testing.
5. Prioritize: subdomain enumeration → DNS → HTTP probing → technology detection → content discovery → vulnerability scanning.
6. If a tool requires Kali Linux and returns "kali_required", note it and move to a tool you CAN run.
7. Each iteration should make progress. If stuck, set type to "complete".
8. Create hypotheses for potential issues — validate before reporting as findings.

${DECISION_SCHEMA_PROMPT}`;
  }

  /**
   * Ask the LLM to decide the next action.
   * @param {object} context — compressed agent state summary
   * @param {string} lastResult — AI summary of last tool execution
   * @returns {object} Structured decision
   */
  async decide(context, lastResult = null) {
    // If LLM is configured, use it
    if (config.llmApiKey) {
      return this.decideLLM(context, lastResult);
    }

    // Fallback: deterministic planner
    return this.decideDeterministic(context);
  }

  /** LLM-powered decision making via Gemini API. */
  async decideLLM(context, lastResult) {
    const userMessage = this.buildUserMessage(context, lastResult);

    try {
      const url = `${config.llmBaseUrl}/models/${config.llmModel}:generateContent?key=${config.llmApiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${this.systemPrompt}\n\n${userMessage}` }] }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`LLM API error: ${response.status} ${errText.slice(0, 200)}`);
        return this.decideDeterministic(context);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return this.decideDeterministic(context);

      // Parse JSON from LLM response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.decideDeterministic(context);

      const decision = JSON.parse(jsonMatch[0]);
      return decision;
    } catch (error) {
      console.error('LLM decision failed:', error.message);
      return this.decideDeterministic(context);
    }
  }

  buildUserMessage(context, lastResult) {
    const parts = [`## Current Assessment State\n`];
    parts.push(`Target: ${context.target}`);
    parts.push(`Phase: ${context.phase}`);
    parts.push(`Iteration: ${context.iterationCount}`);
    parts.push(`Subdomains discovered: ${context.subdomainCount}`);
    parts.push(`Endpoints discovered: ${context.endpointCount}`);
    parts.push(`Technologies: ${(context.technologies || []).join(', ') || 'none detected'}`);
    parts.push(`Open ports: ${(context.openPorts || []).join(', ') || 'none scanned'}`);

    if (context.completedToolNames?.length) {
      parts.push(`\nCompleted tools: ${context.completedToolNames.join(', ')}`);
    }
    if (context.failedToolNames?.length) {
      parts.push(`Failed tools: ${context.failedToolNames.join(', ')}`);
    }
    if (context.subdomains?.length) {
      parts.push(`\nKnown subdomains (first 50): ${context.subdomains.slice(0, 50).join(', ')}`);
    }
    if (context.endpoints?.length) {
      parts.push(`\nKnown endpoints (first 30): ${context.endpoints.slice(0, 30).join(', ')}`);
    }
    if (context.activeHypotheses?.length) {
      parts.push(`\nActive hypotheses:`);
      for (const h of context.activeHypotheses) {
        parts.push(`  - [${h.status}] ${h.hypothesis || h.description}`);
      }
    }
    if (context.lastActions?.length) {
      parts.push(`\nRecent investigation history:`);
      for (const a of context.lastActions) {
        parts.push(`  - ${a.action}: ${a.result}`);
      }
    }
    if (lastResult) {
      parts.push(`\n## Latest Tool Result\n${lastResult}`);
    }

    parts.push('\n## Your Task\nAnalyze the current state and decide the next safe, in-scope action. Respond with the JSON decision object.');
    return parts.join('\n');
  }

  /**
   * Deterministic fallback planner — follows a standard recon sequence.
   * Used when no LLM API key is configured.
   */
  decideDeterministic(context) {
    const completed = new Set(context.completedToolNames || []);
    const failed = new Set(context.failedToolNames || []);
    const target = context.target;

    // Standard recon sequence
    const sequence = [
      { tool: 'crtsh', phase: 'passive_recon', reason: 'Start with passive certificate transparency lookup' },
      { tool: 'subfinder', phase: 'subdomain_enumeration', reason: 'Enumerate subdomains using multiple passive sources' },
      { tool: 'assetfinder', phase: 'subdomain_enumeration', reason: 'Find additional related domains and subdomains' },
      { tool: 'gau', phase: 'endpoint_discovery', reason: 'Discover known URLs from web archives' },
      { tool: 'waybackurls', phase: 'endpoint_discovery', reason: 'Fetch historical URLs from Wayback Machine' },
      { tool: 'httpx', phase: 'http_discovery', reason: 'Probe discovered subdomains for live HTTP services' },
      { tool: 'dnsx', phase: 'dns_enumeration', reason: 'DNS resolution for discovered subdomains' },
      { tool: 'naabu', phase: 'active_recon', reason: 'Port scanning for open services' },
      { tool: 'whatweb', phase: 'technology_detection', reason: 'Technology fingerprinting' },
      { tool: 'wafw00f', phase: 'technology_detection', reason: 'WAF detection' },
      { tool: 'katana', phase: 'endpoint_discovery', reason: 'Crawl web application for endpoints' },
      { tool: 'nuclei', phase: 'vulnerability_detection', reason: 'Template-based vulnerability scanning' },
      { tool: 'subzy', phase: 'vulnerability_detection', reason: 'Subdomain takeover detection' },
      { tool: 'nikto', phase: 'vulnerability_detection', reason: 'Web server misconfiguration scanning' }
    ];

    for (const step of sequence) {
      if (!completed.has(step.tool) && !failed.has(step.tool)) {
        return {
          objective: `Run ${step.tool} for ${step.phase}`,
          current_observations: [`${completed.size} tools completed so far`],
          hypotheses: [],
          candidate_actions: [step.tool],
          selected_action: {
            type: 'tool_execution',
            tool: step.tool,
            target,
            arguments: {},
            description: step.reason
          },
          reason: step.reason,
          expected_information_gain: `New ${step.phase} data`,
          scope_check: true,
          risk_check: true,
          phase: step.phase
        };
      }
    }

    // All tools in sequence completed
    return {
      objective: 'Assessment complete — all planned tools have been executed',
      current_observations: [`${completed.size} tools completed, ${failed.size} failed`],
      hypotheses: [],
      candidate_actions: [],
      selected_action: { type: 'complete', description: 'Investigation complete' },
      reason: 'All tools in the reconnaissance sequence have been executed',
      expected_information_gain: 'None — generating report',
      scope_check: true,
      risk_check: true,
      phase: 'completed'
    };
  }
}
