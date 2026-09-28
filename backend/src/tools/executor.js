import { config } from '../config.js';
import { AppError } from '../core/errors.js';
import { ToolRegistry } from './registry.js';
import { PolicyValidator } from './policyValidator.js';
import { parseToolOutput, summarizeForAI } from './parsers/index.js';

/**
 * ToolExecutor — controlled execution layer between the AI brain and actual tools.
 *
 * Execution flow:
 *   AI Decision → PolicyValidator → ScopeEngine → Dedup Check → Execute → Parse → Store
 *
 * Supports two execution modes:
 *   1. Built-in (crt.sh HTTP lookup, no Kali needed)
 *   2. Kali Worker (sends structured requests to a Kali Linux worker)
 */
export class ToolExecutor {
  constructor({ toolExecutionModel, eventService, scopeEngine }) {
    this.toolExecutionModel = toolExecutionModel;
    this.eventService = eventService;
    this.scopeEngine = scopeEngine;
  }

  /**
   * Execute a tool with full policy validation, dedup, and result parsing.
   * @returns {{ execution, parsed, aiSummary }}
   */
  async execute(assessmentId, userId, request) {
    const tool = ToolRegistry.get(request.tool);
    if (!tool) throw new AppError(400, `Unknown tool: ${request.tool}`, 'UNKNOWN_TOOL');

    // 1. Policy validation
    const policy = PolicyValidator.validate(request, this.scopeEngine);
    if (!policy.allowed) {
      await this.eventService.publish(assessmentId, {
        type: 'TOOL_BLOCKED',
        level: 'WARN',
        message: `Policy blocked ${request.tool}: ${policy.reason}`,
        data: { tool: request.tool, reason: policy.reason }
      });
      throw new AppError(403, policy.reason, 'POLICY_VIOLATION');
    }

    // 2. Deduplication check
    const fingerprint = this.toolExecutionModel.constructor.fingerprint(
      request.tool, request.target, request.arguments
    );
    const existing = await this.toolExecutionModel.findByFingerprint(assessmentId, fingerprint);
    if (existing) {
      await this.eventService.publish(assessmentId, {
        type: 'TOOL_DEDUPLICATED',
        level: 'INFO',
        message: `Skipping ${request.tool} — identical execution already completed`,
        data: { tool: request.tool, existingId: existing.id }
      });
      // Return cached result
      const cachedParsed = existing.parsedResults || {};
      return {
        execution: existing,
        parsed: cachedParsed,
        aiSummary: existing.aiSummary || summarizeForAI(request.tool, cachedParsed),
        deduplicated: true
      };
    }

    // 3. Create execution record
    const execution = await this.toolExecutionModel.create(assessmentId, userId, {
      tool: request.tool,
      category: tool.category,
      target: request.target,
      arguments: request.arguments || {},
      riskLevel: tool.riskLevel,
      timeoutMs: Math.min(request.timeout || tool.timeout, config.toolDefaultTimeoutMs)
    });

    await this.eventService.publish(assessmentId, {
      type: 'TOOL_STARTED',
      level: 'INFO',
      message: `Executing ${request.tool} against ${request.target}`,
      data: { tool: request.tool, executionId: execution.id, target: request.target }
    });

    await this.toolExecutionModel.markStarted(execution.id);

    try {
      // 4. Execute
      let rawOutput;
      if (tool.requiresKali) {
        rawOutput = await this.executeOnKali(tool, request);
      } else {
        rawOutput = await this.executeBuiltIn(tool, request);
      }

      // 5. Parse result
      const parseResult = parseToolOutput(tool.parser, rawOutput, {
        hostname: request.target,
        target: request.target
      });
      const parsed = parseResult.result;
      const aiSummary = summarizeForAI(request.tool, parsed);

      // 6. Store
      await this.toolExecutionModel.markCompleted(execution.id, {
        raw: typeof rawOutput === 'string' ? rawOutput.slice(0, config.toolMaxOutputBytes) : JSON.stringify(rawOutput).slice(0, config.toolMaxOutputBytes),
        normalized: parsed,
        parsed,
        aiSummary
      });

      await this.eventService.publish(assessmentId, {
        type: 'TOOL_COMPLETED',
        level: 'INFO',
        message: `${request.tool} completed — ${aiSummary.slice(0, 200)}`,
        data: { tool: request.tool, executionId: execution.id, summary: aiSummary.slice(0, 500) }
      });

      return { execution, parsed, aiSummary, deduplicated: false };

    } catch (error) {
      await this.toolExecutionModel.markFailed(execution.id, error.message);
      await this.eventService.publish(assessmentId, {
        type: 'TOOL_FAILED',
        level: 'ERROR',
        message: `${request.tool} failed: ${error.message}`,
        data: { tool: request.tool, executionId: execution.id, error: error.message }
      });
      throw error;
    }
  }

  /** Built-in tool execution (no Kali required). Currently: crt.sh. */
  async executeBuiltIn(tool, request) {
    if (tool.name === 'crtsh') {
      return this.executeCrtsh(request.target);
    }
    throw new AppError(501, `Built-in execution not implemented for ${tool.name}`, 'NOT_IMPLEMENTED');
  }

  /** crt.sh Certificate Transparency lookup. */
  async executeCrtsh(hostname) {
    const url = new URL('https://crt.sh/');
    url.searchParams.set('q', `%.${hostname}`);
    url.searchParams.set('output', 'json');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.toolRequestTimeoutMs);
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'DarkMatter-Agent/2.0' },
        signal: controller.signal
      });
      if (!response.ok) throw new AppError(502, `crt.sh returned HTTP ${response.status}`, 'CRTSH_FAILED');
      return await response.text();
    } catch (error) {
      if (error.name === 'AbortError') throw new AppError(504, 'crt.sh lookup timed out', 'CRTSH_TIMEOUT');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Send a structured tool execution request to the Kali Linux worker.
   * The Kali worker is a separate service that runs on a Kali machine.
   * If no worker is configured, this returns a placeholder indicating the tool needs Kali.
   */
  async executeOnKali(tool, request) {
    const workerUrl = config.kaliWorkerUrl;
    if (!workerUrl) {
      // No Kali worker configured — return a message indicating this
      return JSON.stringify({
        status: 'kali_required',
        tool: tool.name,
        message: `Tool ${tool.name} requires a Kali Linux worker. Configure KALI_WORKER_URL in .env.`,
        target: request.target
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), tool.timeout || config.toolDefaultTimeoutMs);
    try {
      const response = await fetch(`${workerUrl}/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tool: tool.name,
          command: tool.command,
          args: PolicyValidator.sanitize(tool.name, request.arguments?.args || []),
          target: request.target,
          timeout: tool.timeout
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new AppError(502, `Kali worker returned HTTP ${response.status}: ${body.slice(0, 200)}`, 'KALI_WORKER_ERROR');
      }
      return await response.text();
    } catch (error) {
      if (error.name === 'AbortError') throw new AppError(504, `${tool.name} execution timed out`, 'TOOL_TIMEOUT');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
