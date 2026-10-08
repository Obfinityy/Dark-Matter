/**
 * WAF-adaptive strategy (G34) — wafw00f detection ENFORCES stealth, it does
 * not merely suggest it.
 *
 * When a WAF is confirmed on the target, every subsequent tool request for
 * that assessment is rewritten through the enforced stealth profile:
 *   - concurrency / rate limits lowered (nuclei -c, -rate-limit; ffuf -t)
 *   - jitter added between requests (executor-side delay)
 *   - User-Agent rotation (random UA injected into tool args / headers)
 *   - nuclei restricted to low-noise templates (no intrusive fuzzing tags)
 *
 * The executor calls `applyWafDetection()` once (from the wafw00f result)
 * and `enforceOnRequest()` before every later tool execution. The policy
 * layer is consulted so a user in permissionMode "full" can still opt out —
 * the default is enforced.
 */
import { randomUserAgent, detectWaf } from '../agent/stealthEngine.js';

/** Stealth profiles keyed by WAF state. */
export const STEALTH_PROFILES = Object.freeze({
  normal: Object.freeze({
    name: 'normal',
    enforced: false,
    nucleiConcurrency: 25,
    rateLimit: 150,
    jitterMs: 0,
    rotateUserAgent: false,
    lowNoiseTemplatesOnly: false,
  }),
  'waf-enforced': Object.freeze({
    name: 'waf-enforced',
    enforced: true,
    nucleiConcurrency: 5,
    rateLimit: 10,
    jitterMs: 1200,
    rotateUserAgent: true,
    lowNoiseTemplatesOnly: true,
  }),
});

/** Parse wafw00f JSON output → { detected, waf }. Handles -o - -f json shape. */
export function parseWafw00f(raw) {
  if (!raw) return { detected: false, waf: null };
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const rows = Array.isArray(data) ? data : [data];
    for (const row of rows) {
      const waf = row?.firewall || row?.waf || row?.detected_waf;
      const isBehind = row?.is_behind === true || row?.generic === true;
      if (waf && !/no waf|none/i.test(String(waf))) {
        return { detected: true, waf: String(waf), method: 'wafw00f' };
      }
      if (isBehind)
        return { detected: true, waf: 'generic (wafw00f heuristics)', method: 'wafw00f' };
    }
    return { detected: false, waf: null };
  } catch {
    // Fall back to header/body heuristics on raw text
    return detectWaf({}, String(raw || ''));
  }
}

/**
 * Rewrite a tool request through the enforced stealth profile.
 * Returns { request, enforced, changes[] } — the original is never mutated.
 */
export function enforceOnRequest(request, profile = STEALTH_PROFILES['waf-enforced']) {
  if (!profile?.enforced) return { request, enforced: false, changes: [] };
  const changes = [];
  const next = {
    ...request,
    arguments: { ...(request.arguments || {}) },
    meta: { ...(request.meta || {}), stealthEnforced: true, stealthProfile: profile.name },
  };
  const args = Array.isArray(next.arguments.args) ? [...next.arguments.args] : [];
  const tool = request.tool;

  const setFlag = (flag, value, reason) => {
    const idx = args.findIndex(a => a === flag);
    if (idx >= 0) args[idx + 1] = String(value);
    else args.push(flag, String(value));
    changes.push(`${flag} ${value} (${reason})`);
  };

  if (tool === 'nuclei') {
    setFlag('-c', profile.nucleiConcurrency, 'WAF: low concurrency');
    setFlag('-rate-limit', profile.rateLimit, 'WAF: rate limit');
    if (profile.lowNoiseTemplatesOnly && !args.some(a => /-tags|-exclude/.test(a))) {
      args.push('-exclude-tags', 'intrusive,fuzz,dos');
      changes.push('-exclude-tags intrusive,fuzz,dos (WAF: low-noise templates only)');
    }
  }
  if (tool === 'ffuf' || tool === 'gobuster') {
    setFlag('-t', 5, 'WAF: low thread count');
    setFlag('-rate', 10, 'WAF: request rate cap');
  }
  if (tool === 'dalfox') {
    if (!args.includes('--skip-discovery')) {
      args.push('--skip-discovery');
      changes.push('--skip-discovery (WAF: no crawler noise before XSS probes)');
    }
  }
  if (tool === 'katana') {
    setFlag('-concurrency', 3, 'WAF: low crawl concurrency');
    setFlag('-delay', 2, 'WAF: delay between requests');
  }
  if (tool === 'sqlmap') {
    setFlag('--delay', 2, 'WAF: delay between requests');
    // Never let stealth loosen sqlmap's safe defaults; if the caller asked
    // for risk>1 the policyValidator blocks it before we get here.
  }

  if (profile.rotateUserAgent) {
    const ua = randomUserAgent();
    next.meta.rotatedUserAgent = ua;
    if (
      tool === 'nuclei' ||
      tool === 'ffuf' ||
      tool === 'dalfox' ||
      tool === 'sqlmap' ||
      tool === 'nikto'
    ) {
      const idx = args.findIndex(
        a => a === '-H' || a === '-header' || a === '--user-agent' || a === '-A'
      );
      if (idx >= 0) args[idx + 1] = `User-Agent: ${ua}`;
      else args.push('-H', `User-Agent: ${ua}`);
      changes.push('rotated User-Agent (WAF: identity rotation)');
    }
  }

  if (profile.jitterMs > 0) {
    next.meta.preRequestJitterMs = profile.jitterMs;
    changes.push(`pre-request jitter ~${profile.jitterMs}ms (WAF: timing randomization)`);
  }

  next.arguments.args = args;
  return { request: next, enforced: true, changes };
}

/**
 * Per-assessment WAF state store. The executor keeps one instance and calls
 * applyWafDetection() with each wafw00f result; later requests are enforced.
 */
export class WafAdaptiveState {
  constructor() {
    this.states = new Map(); // assessmentId → { detected, waf, profile, since }
  }

  /** Feed a wafw00f (or header-heuristic) result in. Returns the new state. */
  applyWafDetection(assessmentId, wafResult) {
    const parsed =
      typeof wafResult === 'string' || wafResult?.firewall
        ? parseWafw00f(typeof wafResult === 'string' ? wafResult : JSON.stringify(wafResult))
        : wafResult;
    const state = {
      detected: !!parsed?.detected,
      waf: parsed?.waf || null,
      method: parsed?.method || 'unknown',
      profile: parsed?.detected ? STEALTH_PROFILES['waf-enforced'] : STEALTH_PROFILES.normal,
      since: new Date().toISOString(),
    };
    this.states.set(assessmentId, state);
    return state;
  }

  get(assessmentId) {
    return (
      this.states.get(assessmentId) || {
        detected: false,
        waf: null,
        profile: STEALTH_PROFILES.normal,
      }
    );
  }

  /** Rewrite a request if this assessment is under enforced stealth. */
  enforce(assessmentId, request) {
    return enforceOnRequest(request, this.get(assessmentId).profile);
  }

  isEnforced(assessmentId) {
    return this.get(assessmentId).profile.enforced === true;
  }
}
