import { asyncHandler } from '../core/utils.js';

export function createTargetController(targetModel) {
  return {
    list: asyncHandler(async (request, response) => {
      response.json({ targets: await targetModel.list(request.user.id) });
    }),
    get: asyncHandler(async (request, response) => {
      response.json(await targetModel.get(request.user.id, request.params.targetId));
    }),
  };
}
