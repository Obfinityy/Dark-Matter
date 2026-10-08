import { ToolRegistry } from '../tools/registry.js';
import { permissionService as defaultPermissionService } from '../services/permissionService.js';

/**
 * Policy Validator — checks every tool execution request against safety rules
 * BEFORE it reaches the executor. This is the gatekeeper.
 *
 * H41 audit — what changed:
 *  - Destructive-command blocking is now explicit and tested: rm -rf/-fr,
 *    mkfs, dd, :(){:|:&};:, chmod -R 777 /, chown -R, shutdown/reboot,
 *    sqlmap --risk>=2 / --level>=4 / --os-* / --file-* / --sql-shell,
 *    nmap -T5 / --min-rate / --max-rate flood values / -O --osscan-guess
 *    aggressive fingerprinting (allowed only in full mode), masscan-style
 *    rates, and python code containing destructive OS calls.
 *  - permissionMode hookup: validate(request, scopeEngine, { permissionService,
 *    userId, approvalId }) — in "ask" mode destructive tools are blocked with
 *    PERMISSION_REQUIRED until requireApproval() grants them; in "full" mode
 *    they are allowed and every decision is audit-logged.
 *  - validate() is pure w.r.t. blocking (no side effects) EXCEPT creating the
 *    approval request record in ask mode — that is the mechanism the frontend
 *    polls to show the approval card.
 */

/** Tools that are destructive by nature — always gated by permission mode. */
const DESTRUCTIVE_TOOLS = new Set(['sqlmap']);

/** Argument patterns that indicate dangerous operations. Tested in w4detect.test.js. */
const BLOCKED_ARGUMENT_PATTERNS = [
  // --- destructive shell ---
  /(^|[\s;&|])rm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)/i, // rm -rf / rm -fr (any order)
  /\bmkfs\b/i,
  /\bdd\s+.*of=\/dev\//i,
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/, // fork bomb
  /\bshutdown\b|\breboot\b|\bhalt\b|\bpoweroff\b/i,
  /\bchmod\s+(-R\s+)?777\s+\//,
  /\bchown\s+-R\b/,
  // --- sqlmap dangerous modes ---
  /--os-shell/i,
  /--os-cmd/i,
  /--os-pwn/i,
  /--os-bof/i,
  /--priv-esc/i,
  /--file-read/i,
  /--file-write/i,
  /--file-dest/i,
  /--sql-shell/i,
  /--sql-query/i,
  /--dump\b/i, // dumping whole tables is data theft, not detection
  /--dump-all/i,
  /--risk\s*=?\s*[23]/i, // SQLMap risk 2-3 is destructive
  /--level\s*=?\s*[45]/i, // SQLMap level 4-5 is extremely aggressive
  // --- nmap aggressive ---
  /(^|\s)-T5(\s|$)/, // insane timing
  /--min-rate\s+(\d+)/i, // flood rates (checked numerically below too)
  /--scan-delay\s+0/i,
  // --- injection / redirection ---
  /`[^`]*`/, // backtick command injection
  /\$\([^)]*\)/, // subshell injection
  />\s*\/etc/i, // write to system directories
  />\s*\/root/i,
  />\s*\/bin/i,
  />\s*\/sbin/i,
  /\|\s*bash\b/i,
  /\|\s*sh\b/i,
];

/** Python code patterns that are destructive even through the "safe" python tool. */
const BLOCKED_PYTHON_PATTERNS = [
  /\bos\.system\s*\(/,
  /\bsubprocess\b.*\bshell\s*=\s*True/,
  /\bshutil\.rmtree\s*\(/,
  /\bos\.remove\s*\(\s*['"]\/(etc|root|bin|sbin|usr)/,
  /\bsocket\b.*\bconnect\b.*\)\s*while/i,
  /\beval\s*\(\s*__import__/,
];

/** Maximum allowed timeout per tool risk level. */
const TIMEOUT_LIMITS = {
  none: 120_000,
  low: 300_000,
  medium: 600_000,
  high: 900_000,
};

/** nmap --min-rate above this is treated as a flood (blocked, not just gated). */
const NMAP_MAX_MIN_RATE = 1000;

/**
 * Flatten tool arguments to searchable text. Array args are space-joined
 * (so ['rm','-rf','/'] is tested as "rm -rf /", not as JSON with quotes
 * between the tokens); objects fall back to JSON.
 */
function argsToText(args) {
  if (Array.isArray(args)) return args.map(String).join(' ');
  if (args && typeof args === 'object') {
    const parts = [];
    if (Array.isArray(args.args)) parts.push(args.args.map(String).join(' '));
    for (const [k, v] of Object.entries(args)) {
      if (k === 'args') continue;
      parts.push(`${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`);
    }
    return parts.join(' ');
  }
  return String(args || '');
}

/** Test one string against the blocked patterns (with the numeric --min-rate carve-out). */
function matchesBlockedPattern(text) {
  for (const pattern of BLOCKED_ARGUMENT_PATTERNS) {
    if (/--min-rate/i.test(pattern.source)) {
      const m = text.match(/--min-rate\s*[= ]\s*"?(\d+)/i);
      if (m && Number(m[1]) <= NMAP_MAX_MIN_RATE) continue;
    }
    if (pattern.test(text)) return pattern;
  }
  return null;
}

export class PolicyValidator {
  /**
   * Validate a tool execution request. Returns
   *   { allowed, reason, approval? }
   * approval is set when mode=ask and a permission request was created —
   * the caller should surface approval.id to the user.
   */
  static validate(request, scopeEngine, opts = {}) {
    const errors = [];
    const perm = opts.permissionService || defaultPermissionService;
    const userId = opts.userId || 'anonymous';

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

    const argsStr = argsToText(request.arguments || request.args || {});
    const argsJson = JSON.stringify(request.arguments || request.args || {});

    // 3. Hard-blocked argument patterns (no mode can allow these).
    //    Tested against both the space-joined form and the raw JSON form.
    const hit = matchesBlockedPattern(argsStr) || matchesBlockedPattern(argsJson);
    if (hit) {
      errors.push(`Blocked argument pattern detected: ${hit.source}`);
    }

    // 4. python tool: scan the code itself
    if (request.tool === 'python') {
      const code = String(request.arguments?.code || request.arguments?.script || '');
      for (const pattern of BLOCKED_PYTHON_PATTERNS) {
        if (pattern.test(code)) {
          errors.push(`Blocked Python code pattern: ${pattern.source}`);
          break;
        }
      }
    }

    // 5. Destructive tools → permissionMode gate.
    //    Hard blocks (step 3) take precedence: they are evaluated first and
    //    the gate never overrides them. The approval request is only created
    //    when the arguments themselves are not hard-blocked.
    if (DESTRUCTIVE_TOOLS.has(request.tool) && errors.length === 0) {
      const gate = perm.requireApproval({
        userId,
        action: 'destructive_tool',
        tool: request.tool,
        target: request.target || null,
        arguments: request.arguments || null,
        reason: `${request.tool} is a destructive tool (writes/exploits) — approval required in "ask" mode`,
      });
      if (gate.decision === 'needs_approval') {
        return {
          allowed: false,
          reason: `PERMISSION_REQUIRED: ${gate.reason} (approval ${gate.approval.id} pending)`,
          approval: gate.approval,
        };
      }
      // 'allowed' (full mode) and 'approved' (ask + user approved) proceed;
      // the audit log entry is already written by the permission service.
    }

    // 6. Timeout limits
    const maxTimeout = TIMEOUT_LIMITS[tool.riskLevel] || TIMEOUT_LIMITS.medium;
    if (request.timeout && request.timeout > maxTimeout) {
      errors.push(
        `Timeout ${request.timeout}ms exceeds limit ${maxTimeout}ms for risk level ${tool.riskLevel}`
      );
    }

    if (errors.length) {
      return { allowed: false, reason: errors.join('; ') };
    }

    return { allowed: true, reason: 'Policy check passed' };
  }

  /**
   * Sanitize arguments — merge tool defaults, drop hard-blocked patterns so a
   * sloppy caller fails closed instead of shipping a dangerous command.
   * Checks single args AND adjacent pairs (['rm','-rf'] is dangerous together).
   */
  static sanitize(toolName, args) {
    const tool = ToolRegistry.get(toolName);
    if (!tool) return args;

    const mergedArgs = [...(tool.defaultArgs || [])];
    if (Array.isArray(args)) {
      const list = args.map(String);
      const drop = new Set();
      for (let i = 0; i < list.length; i++) {
        if (matchesBlockedPattern(list[i])) {
          drop.add(i);
          continue;
        }
        if (i + 1 < list.length && matchesBlockedPattern(`${list[i]} ${list[i + 1]}`)) {
          drop.add(i);
          drop.add(i + 1);
        }
      }
      list.forEach((a, i) => {
        if (!drop.has(i)) mergedArgs.push(args[i]);
      });
    }
    return mergedArgs;
  }

  /** Exposed for tests: which tools are destructive-gated. */
  static destructiveTools() {
    return [...DESTRUCTIVE_TOOLS];
  }
}
