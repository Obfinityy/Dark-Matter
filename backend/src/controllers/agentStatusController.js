/**
 * agentStatusController.js — agent-machine presence for the Hunt console.
 *
 *   POST /api/v1/agent/heartbeat — the headless agent poller (user's own
 *     machine / Oracle VM) reports in every poll tick. Authenticated with
 *     the poller's user token; keyed per user.
 *   GET /api/v1/agent/status — agent presence + this account's brain-slot
 *     sources, so the UI can show the one-click start action when no agent
 *     machine is connected:
 *     { connected, lastHeartbeatAt, runner: 'local'|'oracle'|null,
 *       brains: { vision, hacking, grounding } }  // 'kaggle'|'local'|'missing' (+ 'vision-driven')
 *
 * The backend never pushes commands here — heartbeat is a one-way,
 * poller-initiated signal. Pure orchestration.
 */

import { asyncHandler } from '../core/utils.js';
import { recordHeartbeat, getAgentPresence } from '../services/agentPresence.js';
import { brainStatusesForUser } from '../services/huntChatBrain.js';

/**
 * Probe the VM Runner on this machine (server-side). The backend and the
 * runner share localhost, so this works even when the user's browser cannot
 * reach 127.0.0.1 directly (tunnel setups, IPv6 quirks, firewalls).
 * Returns true when the runner answers /health.
 */
async function isLocalRunnerUp(timeoutMs = 4000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch('http://127.0.0.1:4100/health', { signal: ctl.signal });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return Boolean(data && data.ok !== false);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function createAgentStatusController({
  brainProviderModel = null,
  modelRunnerService = null,
} = {}) {
  return {
    /**
     * POST /api/v1/agent/heartbeat
     * Body: { pollerId?, runner?: 'local'|'oracle' }
     */
    heartbeat: asyncHandler(async (request, response) => {
      const userId = request.user?.id;
      if (!userId) {
        return response
          .status(401)
          .json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } });
      }
      const { pollerId = null, runner = null } = request.body || {};
      const record = recordHeartbeat(userId, { pollerId, runner });
      return response.json({ ok: true, connected: true, ...record });
    }),

    /**
     * GET /api/v1/agent/status
     */
    status: asyncHandler(async (request, response) => {
      const userId = request.user?.id;
      if (!userId) {
        return response
          .status(401)
          .json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } });
      }
      const presence = getAgentPresence(userId);
      let selection = {};
      try {
        selection = brainProviderModel ? (await brainProviderModel.getSelection(userId)) || {} : {};
      } catch {
        selection = {};
      }
      // Heartbeats come from the headless agent poller (Oracle/cloud path).
      // For the local path the poller may never run — but the VM Runner on
      // this same machine IS the agent machine. Probe it server-side so the
      // Hunt console shows the agent as connected whenever the runner is up.
      let connected = Boolean(presence.connected);
      let runner = presence.runner || null;
      let lastHeartbeatAt = presence.lastHeartbeatAt || null;
      if (!connected) {
        try {
          if (await isLocalRunnerUp()) {
            connected = true;
            runner = 'local';
            lastHeartbeatAt = new Date().toISOString();
          }
        } catch {
          /* runner probe failed — stay disconnected */
        }
      }
      return response.json({
        connected,
        lastHeartbeatAt,
        runner,
        brains: brainStatusesForUser({ selection, runner: modelRunnerService || null }),
      });
    }),
  };
}

export default { createAgentStatusController };
