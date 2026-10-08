/**
 * settingsController — Express route handlers for settings.
 * Factory that wires the settings service into REST endpoints.
 * Part of: Infinity AI / Dark-Matter backend (HTTP API controllers).
 */

import { asyncHandler } from '../core/utils.js';

/**
 * Creates settings controller.
 * @param {*} providerModel
 * @returns {*} Result.
 */
export function createSettingsController(providerModel) {
  return {
    listProviders: asyncHandler(async (request, response) => {
      response.json({ providers: await providerModel.publicList(request.user.id) });
    }),
    updateProviders: asyncHandler(async (request, response) => {
      const providers = request.body?.providers;
      if (!Array.isArray(providers)) {
        return response
          .status(400)
          .json({
            error: { code: 'INVALID_PROVIDER_PAYLOAD', message: 'providers must be an array' },
          });
      }
      const updated = [];
      for (const provider of providers) {
        updated.push(await providerModel.upsert(request.user.id, provider.id, provider));
      }
      response.json({ providers: updated });
    }),
    updateProvider: asyncHandler(async (request, response) => {
      response.json(
        await providerModel.upsert(request.user.id, request.params.providerId, request.body)
      );
    }),
    removeProvider: asyncHandler(async (request, response) => {
      await providerModel.remove(request.user.id, request.params.providerId);
      response.status(204).send();
    }),
  };
}
