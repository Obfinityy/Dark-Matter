/**
 * permissionsController — Express route handlers for permissions.
 * Factory that wires the permissions service into REST endpoints.
 * Part of: Infinity AI / Dark-Matter backend (HTTP API controllers).
 */

import { asyncHandler } from '../core/utils.js';
import { getPermissionMode, setPermissionMode } from '../services/permissionService.js';

/**
 * Creates permissions controller.
 * @returns {*} Result.
 */
export function createPermissionsController() {
  return {
    get: asyncHandler(async (request, response) => {
      response.json({ permissionMode: getPermissionMode(request.user.id) });
    }),
    update: asyncHandler(async (request, response) => {
      const { permissionMode } = request.body || {};
      try {
        const mode = setPermissionMode(request.user.id, permissionMode);
        response.json({ permissionMode: mode });
      } catch (err) {
        if (err.code === 'INVALID_PERMISSION_MODE') {
          return response.status(400).json({
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }),
  };
}
