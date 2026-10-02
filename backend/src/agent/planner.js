import { config } from '../config.js';
import { ToolRegistry } from '../tools/registry.js';
import { DECISION_SCHEMA_PROMPT } from './decisionSchema.js';
import { PhoneLocalProvider } from './providers/phoneLocalProvider.js';

/**
 * Planner — the AI reasoning engine with multi-provider fallback.
 *
 * Takes the current agent context (compressed state summary) and asks the LLM
 * to produce a structured decision about what to do next.
 *
 * Provider resolution order:
 *   1. User's saved providers from database (sorted by priority)
 *   2. Environment variable LLM_API_KEY (fallback)
 *   3. Deterministic planner (ultimate fallback)
 *
 * If a provider hits rate limits or errors, the planner automatically
 * tries the next provider. Memory is preserved across provider switches
 * because state lives in MongoDB, not in LLM context.
 */
export class Planner {
  constructor({ providerModel, learningEngine = null } = {}) {
    this.providerModel = providerModel || null;
    this.learningEngine = learningEngine || null;
    this.systemPrompt = this.buildSystemPrompt();
    this.phoneAi = new PhoneLocalProvider(config);
  }

  /** Attach (or replace) the learning engine after construction. */
  setLearningEngine(engine) {
    this.learningEngine = engine;
  }

  /**
   * Past-hunt learning, as a prompt section. Returns '' when there is no
   * learning engine or no data for this tech stack.
   */
  learningSection(context) {
    if (!this.learningEngine) return '';
    const stack = (context.technologies || []).join('+') || 'unknown';
    const insights = this.learningEngine.getInsights(stack);
    if (!insights) return '';
    return `\n## Learning from past hunts\n${insights}\nBias your tool choice toward techniques that worked on this stack before.\n`;
  }

  /**
   * Tool priority bias from past hunts: tools whose techniques succeeded on
   * this tech stack move to the front of the deterministic sequence.
   * Returns the (possibly reordered) sequence.
   */
  prioritizeWithLearning(sequence, context) {
    if (!this.learningEngine) return sequence;
    const stack = (context.technologies || []).join('+') || 'unknown';
    const suggested = new Set(this.learningEngine.suggestTechniques(stack, 10));
    if (!suggested.size) return sequence;
    const score = (step) =>
      [...suggested].some((t) => t === step.tool || t.endsWith(`::${step.tool}`)) ? 0 : 1;
    return [...sequence].sort((a, b) => score(a) - score(b));
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
   * Tries each provider in order; falls back to deterministic if all fail.
   */
  async decide(context, lastResult = null, userId = null) {
    // 0. Try Local Phone Gemma (Highest priority)
    if (this.phoneAi.enabled && this.phoneAi.host) {
      try {
        const health = await this.phoneAi.healthCheck();
        if (health.status === 'online') {
          const userMessage = this.buildUserMessage(context, lastResult);
          const messages = [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: userMessage }
          ];
          const decision = await this.phoneAi.generateStructured(messages, null, { temperature: 0.3 });
          if (decision) return decision;
        }
      } catch (error) {
        console.warn(`Local Phone Gemma failed: ${error.message} — trying next`);
      }
    }

    // Cloud provider fallbacks removed as per user request to only use local AI.

    // 3. Ultimate fallback: deterministic planner
    return this.decideDeterministic(context);
  }

  /** Route to the correct API format based on provider type. */
  async callProvider(provider, context, lastResult) {
    if (provider.id === 'gemini') {
      return this.callGemini(provider.apiKey, provider.model, provider.baseUrl, context, lastResult);
    }
    if (provider.id === 'anthropic') {
      return this.callAnthropic(provider.apiKey, provider.model, provider.baseUrl, context, lastResult);
    }
    // OpenAI-compatible: openai, grok, deepseek, openrouter
    return this.callOpenAICompatible(provider.apiKey, provider.model, provider.baseUrl, context, lastResult);
  }

  /** Gemini API call. */
  async callGemini(apiKey, model, baseUrl, context, lastResult) {
    const userMessage = this.buildUserMessage(context, lastResult);
    const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(45_000),
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
      throw new Error(`Gemini ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty Gemini response');

    return this.parseJsonDecision(text);
  }

  /** OpenAI-compatible API call (works for OpenAI, Grok, DeepSeek, OpenRouter). */
  async callOpenAICompatible(apiKey, model, baseUrl, context, lastResult) {
    const userMessage = this.buildUserMessage(context, lastResult);
    const url = `${baseUrl}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`
      },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`OpenAI-compatible ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty OpenAI response');

    return this.parseJsonDecision(text);
  }

  /** Anthropic API call. */
  async callAnthropic(apiKey, model, baseUrl, context, lastResult) {
    const userMessage = this.buildUserMessage(context, lastResult);
    const url = `${baseUrl}/v1/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: this.systemPrompt,
        messages: [
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Anthropic ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text;
    if (!text) throw new Error('Empty Anthropic response');

    return this.parseJsonDecision(text);
  }

  /** Parse JSON decision from LLM text response. */
  parseJsonDecision(text) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in LLM response');
    return JSON.parse(jsonMatch[0]);
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

    const learning = this.learningSection(context);
    if (learning) parts.push(learning);

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

    // Past hunts' confirmed findings bias future tool priority (I50).
    const ordered = this.prioritizeWithLearning(sequence, context);
    const learningNote = this.learningSection(context);

    for (const step of ordered) {
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
          reason: learningNote
            ? `${step.reason} (prioritized: past hunts on this stack succeeded with related techniques)`
            : step.reason,
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
