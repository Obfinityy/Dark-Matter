// Split out of brainMode.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; brainMode.js re-exports the public names so callers are unchanged.

import {
  claimGateCheck,
  claimClassFromTitle,
  extractTaskBlock,
  scopeViolation,
  pendingPlannedProbes,
  targetHostsFor,
} from '../../humanLoop.js';

export function publicEntry(entry, status) {
  return {
    n: entry.n,
    hash: entry.hash,
    tool: entry.tool,
    title: entry.title || entry.label,
    label: entry.label,
    variant: entry.variant && entry.variant !== '—' ? entry.variant : undefined,
    detail: entry.detail,
    at: entry.at || '',
    outcome: entry.outcome || '',
    status,
  };
}

export const OBS_BUDGET = 3500;

export const COMMAND_CAP = 4000;

export async function defaultExec(huntId, target, command, deps) {
  if (typeof deps.exec === 'function') return deps.exec(huntId, target, command);
  const { executeWithEvasion } = await import('../../huntAgent.js');
  return executeWithEvasion(huntId, target, command);
}

export async function defaultGui(huntId, target, parsedScope, deps) {
  if (deps.gui) return deps.gui;
  const { guiBrowserOpen, guiBrowserClick, guiBrowserType } = await import('../../guiTools.js');
  const execRaw = deps.execRaw || ((h, c, t, o) => import('../../huntRunner.js').then((hr) => hr.execInHuntContainerWithRespawn(h, c, t, o)));
  const targetHosts = targetHostsFor(target, parsedScope);
  const { guiBrowserSnapshot, guiBrowserScreenshot } = await import('../../guiTools.js');
  return {
    open: (h, url) => guiBrowserOpen(h, url, { exec: execRaw, targetHosts, targetUrl: target }),
    click: (h, text) => guiBrowserClick(h, text, { exec: execRaw, targetHosts, targetUrl: target }),
    type: (h, target, text, submit) => guiBrowserType(h, target, text, submit, { exec: execRaw, targetHosts, targetUrl: target }),
    snapshot: (h) => guiBrowserSnapshot(h, { exec: execRaw, targetHosts, targetUrl: target }),
    screenshot: (h) => guiBrowserScreenshot(h, { exec: execRaw, targetHosts, targetUrl: target }),
  };
}

export async function defaultAssess(deps) {
  if ('assess' in deps) return deps.assess; // null = disabled, fn = stub
  const { assessResult } = await import('../../huntAgent.js');
  return assessResult || null;
}
