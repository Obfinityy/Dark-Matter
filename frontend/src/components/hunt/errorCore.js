/**
 * errorCore.js — Forge wave 9, ideas 50341–50360.
 *
 * Pure, testable logic behind the error/failure states:
 * - human-readable byte / countdown formatting (model download, rate limit)
 * - hunt-failure banner and partial-failure messages
 * - inline target-URL validation (50350)
 * - SSO provider error → plain-language fix mapping (50359)
 * - agent-stall diagnosis after 10 min without progress (50357)
 * - quota / storage / upload-size state helpers (50349, 50355, 50360)
 * - ERROR_STATE_IDEAS registry used by honesty checks.
 *
 * Node-importable (no JSX, no CSS). Run: node --test frontend/src/components/hunt/wave9.test.js
 */

/* ---------- idea registry ------------------------------------------ */

export const ERROR_STATE_IDEAS = [
  { idea: 50341, name: 'HuntFailedBanner' },
  { idea: 50342, name: 'PartialFailureNotice' },
  { idea: 50343, name: 'RateLimitCountdown' },
  { idea: 50344, name: 'WafBlockedBadge' },
  { idea: 50345, name: 'ModelDownloadFailure' },
  { idea: 50346, name: 'InvalidKaggleLinkError' },
  { idea: 50347, name: 'SessionExpiredOverlay' },
  { idea: 50348, name: 'SocketDisconnectBanner' },
  { idea: 50349, name: 'QuotaExceededState' },
  { idea: 50350, name: 'InlineUrlValidation' },
  { idea: 50351, name: 'ScopeViolationBlock' },
  { idea: 50352, name: 'ReportGenerationFailure' },
  { idea: 50353, name: 'ZipExportFailure' },
  { idea: 50354, name: 'PermissionDeniedSharing' },
  { idea: 50355, name: 'UploadTooLargeError' },
  { idea: 50356, name: 'UnsupportedTargetNotice' },
  { idea: 50357, name: 'AgentStallError' },
  { idea: 50358, name: 'PaymentFailedState' },
  { idea: 50359, name: 'SsoErrorMapping' },
  { idea: 50360, name: 'StorageFullWarning' },
];

/* ---------- formatting ------------------------------------------------ */

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  return `${n >= 100 || u === 0 ? Math.round(n) : n.toFixed(1)} ${units[u]}`;
}

/** 50343 — rate-limit backoff countdown, e.g. "01:24" remaining. */
export function formatCountdown(msRemaining) {
  const total = Math.max(0, Math.ceil(msRemaining / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/* ---------- 50341: hunt-failure banner -------------------------------- */

export function buildHuntFailureBanner({ stepName, errorExcerpt, huntId }) {
  const step = stepName || 'unknown step';
  const excerpt = (errorExcerpt || '').trim().slice(0, 180);
  return {
    title: `Hunt failed at: ${step}`,
    excerpt: excerpt || 'No error details captured.',
    checkpointHint: huntId
      ? `Resume from the checkpoint saved for hunt ${huntId} — completed phases are kept.`
      : 'Resume from the last saved checkpoint — completed phases are kept.',
  };
}

/* ---------- 50342: partial failure ------------------------------------ */

export function partialFailureMessage({ failed, total }) {
  const f = Math.max(0, failed | 0);
  const t = Math.max(0, total | 0);
  return `${f} of ${t} checks failed — findings still valid`;
}

/* ---------- 50349: quota exceeded ------------------------------------- */

export function quotaExceededMessage({ quotaName, resetsAt }) {
  const when = resetsAt ? `Resets ${new Date(resetsAt).toLocaleString()}.` : '';
  return {
    title: `${quotaName || 'Usage quota'} exhausted`,
    detail:
      `You've used all of this period's ${quotaName || 'quota'}. ${when} Upgrade for more capacity.`.trim(),
  };
}

/* ---------- 50350: inline URL validation ------------------------------ */

const EXAMPLE_GOOD_URL = 'https://example.com';
const URL_RE = /^https?:\/\/[^\s/$.?#][^\s]*$/i;

export function validateTargetUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) {
    return {
      ok: false,
      message: 'Enter a target URL to start the hunt.',
      example: EXAMPLE_GOOD_URL,
    };
  }
  if (/^www\./i.test(url)) {
    return {
      ok: false,
      message: 'Add the protocol — try https:// before the address.',
      example: `https://${url}`,
    };
  }
  if (!URL_RE.test(url)) {
    return {
      ok: false,
      message: 'That URL looks incomplete. Use a full address like the example.',
      example: EXAMPLE_GOOD_URL,
    };
  }
  if (url.startsWith('http://')) {
    return { ok: true, warning: 'Plain HTTP is supported, but HTTPS scans see more.' };
  }
  return { ok: true };
}

/* ---------- 50351: scope-violation block ------------------------------- */

export function scopeViolationMessage({ target, matchedRule }) {
  return {
    title: 'Target is out of authorized scope',
    detail: matchedRule
      ? `Blocked by scope rule "${matchedRule}" — "${target || 'this target'}" doesn't match your authorized scope.`
      : 'This target is not in your authorized scope. Edit the scope or ask an admin.',
  };
}

/* ---------- 50357: agent stall ----------------------------------------- */

export const AGENT_STALL_AFTER_MS = 10 * 60 * 1000;

export function agentStallState({ lastProgressAt, now = Date.now() }) {
  const idleMs = Math.max(0, now - lastProgressAt);
  const stalled = idleMs >= AGENT_STALL_AFTER_MS;
  return {
    stalled,
    idleMinutes: Math.floor(idleMs / 60000),
    message: stalled
      ? `No progress for ${Math.floor(idleMs / 60000)} minutes. The agent may be stuck — restart this phase or download diagnostics.`
      : null,
  };
}

/* ---------- 50359: SSO error mapping ---------------------------------- */

const SSO_FIXES = [
  {
    match: /redirect_uri_mismatch/i,
    fix: 'The redirect URL registered with the provider must exactly match this app’s callback URL — including https:// and the trailing path.',
  },
  {
    match: /invalid_client|unauthorized_client/i,
    fix: 'The provider rejected our client ID or secret. Ask an admin to re-check the SSO credentials in settings.',
  },
  {
    match: /access_denied/i,
    fix: 'You denied the provider’s consent screen. Sign in again and accept the requested permissions.',
  },
  {
    match: /invalid_grant|expired/i,
    fix: 'Your session token expired. Sign in again — no data was lost.',
  },
  {
    match: /server_error|temporarily_unavailable/i,
    fix: 'The provider is having trouble right now. Wait a minute and try again.',
  },
];

export function mapSsoError(providerCode, providerName = 'the identity provider') {
  const code = String(providerCode || '');
  const hit = SSO_FIXES.find(f => f.match.test(code));
  return {
    title: 'Sign-in with SSO failed',
    detail: hit
      ? hit.fix
      : `Something went wrong with ${providerName} (${code || 'unknown error'}). Try again, or use email sign-in.`,
    fixKnown: Boolean(hit),
  };
}

/* ---------- 50355 / 50360: size limits -------------------------------- */

export function uploadTooLargeMessage({ sizeBytes, limitBytes }) {
  return {
    title: 'File too large',
    detail: `This file is ${formatBytes(sizeBytes)} — the limit is ${formatBytes(limitBytes)}. Try compressing it first.`,
  };
}

export function storageFullWarning({ usedBytes, quotaBytes }) {
  const pct = quotaBytes > 0 ? Math.round((usedBytes / quotaBytes) * 100) : 100;
  return {
    title: 'Storage is full',
    detail: `Local snapshots can't save — ${formatBytes(usedBytes)} of ${formatBytes(quotaBytes)} used (${pct}%). Clean up old snapshots to continue.`,
    pct,
  };
}

export default ERROR_STATE_IDEAS;
