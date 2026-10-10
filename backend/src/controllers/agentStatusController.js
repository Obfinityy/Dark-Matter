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
      return response.json({
        connected: presence.connected,
        lastHeartbeatAt: presence.lastHeartbeatAt,
        runner: presence.runner,
        brains: brainStatusesForUser({ selection, runner: modelRunnerService || null }),
      });
    }),
  };
}

export default { createAgentStatusController };
