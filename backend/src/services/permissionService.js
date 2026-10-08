/**
 * permissionService — per-user agent permission mode.
 *
 * Two modes:
 *   'ask'  — agent must prompt before each destructive / system / computer action.
 *   'full' — agent acts autonomously; every destructive action is audit-logged.
 *
 * Two APIs, one store:
 *   - PermissionService class (+ shared `permissionService` singleton): mode
 *     management, approval records (pending → approved | denied | expired,
 *     15-min TTL), and a read-only audit trail. policyValidator calls
 *     requireApproval() — "ask" mode turns destructive tools into
 *     { allowed:false, reason:'PERMISSION_REQUIRED', approval }.
 *   - Functional wrappers (PERMISSION_MODES, get/setPermissionMode,
 *     requiresPrompt, isValidPermissionMode): the backend half of the
 *     frontend contract in frontend/src/services/permissions.js.
 *
 * Store is in-memory (keyed by user id) so the backend keeps its zero-config
 * local boot; it can be swapped for a DB-backed model later without changing
 * the exported API.
 */

const VALID_MODES = new Set(['ask', 'full']);
const APPROVAL_TTL_MS = 15 * 60 * 1000;

function invalidModeError(mode) {
  const err = new Error(`Invalid permission mode: ${mode} (expected "ask" or "full")`);
  err.code = 'INVALID_PERMISSION_MODE';
  return err;
}

/** Business-logic service for permission. */
export class PermissionService {
  constructor() {
    this.modes = new Map(); // userId → 'ask' | 'full'
    this.approvals = new Map(); // approvalId → record
    this.auditLog = []; // every destructive decision, both modes
    this._seq = 0;
  }

  /** Current mode for a user. Defaults to "ask" (safest). */
  getPermissionMode(userId) {
    if (this.modes.has(userId)) return this.modes.get(userId);
    const env = String(process.env.DM_PERMISSION_MODE || '').toLowerCase();
    return VALID_MODES.has(env) ? env : 'ask';
  }

  /** Set mode. Throws a coded INVALID_PERMISSION_MODE error on invalid values. */
  setPermissionMode(userId, mode) {
    const m = String(mode || '').toLowerCase();
    if (!VALID_MODES.has(m)) throw invalidModeError(mode);
    this.modes.set(userId, m);
    this._audit({ userId, event: 'mode_changed', mode: m });
    return m;
  }

  /**
   * Gate a destructive action. Returns:
   *   { decision: 'allowed', ... }                      — mode=full (logged)
   *   { decision: 'approved', approval }                — mode=ask, approval exists
   *   { decision: 'needs_approval', approval }         — mode=ask, fresh request created
   */
  requireApproval({ userId, action, tool, target = null, arguments: args = null, reason = '' }) {
    const mode = this.getPermissionMode(userId);
    const entry = { userId, action, tool, target, mode, at: new Date().toISOString() };

    if (mode === 'full') {
      this._audit({ ...entry, event: 'destructive_allowed_full_mode', reason });
      return {
        decision: 'allowed',
        mode,
        reason: 'permissionMode=full — allowed with audit logging',
      };
    }

    // mode === 'ask': is there a live approval for this exact action?
    const live = [...this.approvals.values()].find(
      a =>
        a.userId === userId &&
        a.tool === tool &&
        a.target === target &&
        a.action === action &&
        a.status === 'approved' &&
        Date.now() - a.decidedAt < APPROVAL_TTL_MS
    );
    if (live) {
      this._audit({ ...entry, event: 'destructive_allowed_by_approval', approvalId: live.id });
      return { decision: 'approved', mode, approval: live };
    }

    const pending = [...this.approvals.values()].find(
      a =>
        a.userId === userId &&
        a.tool === tool &&
        a.target === target &&
        a.action === action &&
        a.status === 'pending' &&
        Date.now() - a.createdAt < APPROVAL_TTL_MS
    );
    if (pending)
      return {
        decision: 'needs_approval',
        mode,
        approval: pending,
        reason: 'approval already pending — waiting for user',
      };

    const approval = {
      id: `apr_${Date.now().toString(36)}_${(++this._seq).toString(36)}`,
      userId,
      action,
      tool,
      target,
      arguments: args,
      reason: reason || `Destructive tool "${tool}" requires your approval`,
      status: 'pending',
      createdAt: Date.now(),
      decidedAt: null,
    };
    this.approvals.set(approval.id, approval);
    this._audit({ ...entry, event: 'approval_requested', approvalId: approval.id });
    return { decision: 'needs_approval', mode, approval, reason: approval.reason };
  }

  /** User (or frontend) resolves a pending approval. */
  resolveApproval(approvalId, { approved, userId = null } = {}) {
    const a = this.approvals.get(approvalId);
    if (!a) throw new Error(`Unknown approval: ${approvalId}`);
    if (a.status !== 'pending') throw new Error(`Approval ${approvalId} is already ${a.status}`);
    a.status = approved ? 'approved' : 'denied';
    a.decidedAt = Date.now();
    a.decidedBy = userId;
    this._audit({
      userId: a.userId,
      event: `approval_${a.status}`,
      approvalId,
      tool: a.tool,
      target: a.target,
    });
    return a;
  }

  getApproval(approvalId) {
    return this.approvals.get(approvalId) || null;
  }

  listPending(userId) {
    return [...this.approvals.values()].filter(a => a.userId === userId && a.status === 'pending');
  }

  /** Read-only audit trail for the UI / compliance. */
  getAuditLog({ userId = null, limit = 100 } = {}) {
    const rows = userId ? this.auditLog.filter(e => e.userId === userId) : this.auditLog;
    return rows.slice(-limit);
  }

  _audit(entry) {
    this.auditLog.push({ ...entry, at: entry.at || new Date().toISOString() });
    if (this.auditLog.length > 5000) this.auditLog.splice(0, this.auditLog.length - 5000);
  }
}

/** Shared singleton for the backend process. */
export const permissionService = new PermissionService();

/* ── Functional API (frontend contract) — thin wrappers over the singleton ── */

export const PERMISSION_MODES = Object.freeze({
  ASK: 'ask',
  FULL: 'full',
});

/**
 * Returns whether valid permission mode.
 * @param {*} mode
 * @returns {*} Result.
 */
export function isValidPermissionMode(mode) {
  return VALID_MODES.has(String(mode || '').toLowerCase());
}

/**
 * Returns permission mode.
 * @param {*} userId
 * @returns {*} Result.
 */
export function getPermissionMode(userId) {
  return permissionService.getPermissionMode(userId);
}

/**
 * Set Permission Mode.
 * @param {*} userId
 * @param {*} mode
 * @returns {*} Result.
 */
export function setPermissionMode(userId, mode) {
  return permissionService.setPermissionMode(userId, mode);
}

/**
 * Middleware-friendly check: true when the agent must prompt the user
 * before running a tool / system / computer action.
 */
export function requiresPrompt(userId, actionType = 'tool') {
  return permissionService.getPermissionMode(userId) === PERMISSION_MODES.ASK;
}

/** Test helper — clears the in-memory store. */
export function _clearPermissionStore() {
  permissionService.modes.clear();
  permissionService.approvals.clear();
}
