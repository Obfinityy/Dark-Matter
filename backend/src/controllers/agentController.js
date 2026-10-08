/**
 * agentController — Express route handlers for agent.
 * Factory that wires the agent service into REST endpoints.
 * Part of: Infinity AI / Dark-Matter backend (HTTP API controllers).
 */

import { asyncHandler } from '../core/utils.js';

/**
 * Creates agent controller.
 * @param {*} scanService
 * @returns {*} Result.
 */
export function createAgentController(scanService) {
  return {
    message: asyncHandler(async (request, response) => {
      const input = request.body || {};
      const result = await scanService.startFromMessage(request.user.id, input);
      response.status(result.status === 'started' ? 202 : 200).json(result);
    }),
  };
}
