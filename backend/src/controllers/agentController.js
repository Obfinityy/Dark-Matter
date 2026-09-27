import { asyncHandler } from '../core/utils.js';

export function createAgentController(scanService) {
  return {
    message: asyncHandler(async (request, response) => {
      const input = request.body || {};
      const result = await scanService.startFromMessage(request.user.id, input);
      response.status(result.status === 'started' ? 202 : 200).json(result);
    })
  };
}
