import { ToolRegistry } from '../tools/registry.js';

/**
 * Policy Validator — checks every tool execution request against safety rules
 * BEFORE it reaches the executor. This is the gatekeeper.
 */

/** Tools that must never be run without explicit authorization. */
const DESTRUCTIVE_TOOLS = new Set(['sqlmap']);

/** Argument patterns that indicate dangerous operations. */
const BLOCKED_ARGUMENT_PATTERNS = [
  /--os-shell/i,
  /--os-cmd/i,
  /--os-pwn/i,
  /--file-write/i,
  /--file-dest/i,
  /-oS\b/i,
  /;.*rm\s/i,
  /&&.*rm\s/i,
  /\|\s*rm\s/i,
  /`.*`/,       // backtick command injection
  /\$\(/,       // subshell injection
  />\s*\/etc/i, // write to system directories
  />\s*\/root/i,
  /--risk\s*=?\s*3/i,  // SQLMap risk 3 is destructive
  /--level\s*=?\s*5/i, // SQLMap level 5 is extremely aggressive
];

/** Maximum allowed timeout per tool risk level. */
const TIMEOUT_LIMITS = {
  none: 120_000,
  low: 300_000,
  medium: 600_000,
  high: 900_000
};

export class PolicyValidator {
  /**
   * Validate a tool execution request. Returns { allowed, reason }.
   */
  static validate(request, scopeEngine) {
    const errors = [];

    // 1. Tool must exist in registry
    const tool = ToolRegistry.get(request.tool);
    if (!tool) {
      return { allowed: false, reason: `Tool "${request.tool}" is not in the registry` };
    }

    // 2. Scope check
    if (tool.requiresAuthorization && request.target) {
      const scopeCheck = scopeEngine.validateToolTarget(request.target);
      if (!scopeCheck.valid) {
        return { allowed: false, reason: `Scope violation: ${scopeCheck.reason}` };
      }
    }

    // 3. Risk level check — destructive tools need extra caution
    if (DESTRUCTIVE_TOOLS.has(request.tool)) {
      // For destructive tools, enforce safe defaults
      if (request.tool === 'sqlmap') {
        const argsStr = JSON.stringify(request.arguments || {});
        if (/--risk\s*=?\s*[23]/i.test(argsStr)) {
          errors.push('SQLMap risk level 2-3 is too aggressive for automated testing');
        }
      }
    }

    // 4. Blocked argument patterns
    const argsStr = JSON.stringify(request.arguments || request.args || {});
    for (const pattern of BLOCKED_ARGUMENT_PATTERNS) {
      if (pattern.test(argsStr)) {
        errors.push(`Blocked argument pattern detected: ${pattern.source}`);
        break;
      }
    }

    // 5. Timeout limits
    const maxTimeout = TIMEOUT_LIMITS[tool.riskLevel] || TIMEOUT_LIMITS.medium;
    if (request.timeout && request.timeout > maxTimeout) {
      errors.push(`Timeout ${request.timeout}ms exceeds limit ${maxTimeout}ms for risk level ${tool.riskLevel}`);
    }

    if (errors.length) {
      return { allowed: false, reason: errors.join('; ') };
    }

    return { allowed: true, reason: 'Policy check passed' };
  }

  /**
   * Sanitize arguments — remove any dangerous patterns and enforce safe defaults.
   */
  static sanitize(toolName, args) {
    const tool = ToolRegistry.get(toolName);
    if (!tool) return args;

    // Merge default args
    const mergedArgs = [...(tool.defaultArgs || [])];
    if (Array.isArray(args)) {
      mergedArgs.push(...args);
    }

    return mergedArgs;
  }
}
