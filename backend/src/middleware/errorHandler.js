/**
 * errorHandler — centralized error middleware.
 * Converts thrown application errors into consistent JSON
 * error responses.
 * Part of: Infinity AI / Dark-Matter backend (Express middleware).
 */

import { AppError } from '../core/errors.js';

/**
 * Not Found Handler.
 * @param {*} request
 * @param {*} response
 * @returns {*} Result.
 */
export function notFoundHandler(request, response) {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

/**
 * Error Handler.
 * @param {*} error
 * @param {*} request
 * @param {*} response
 * @param {*} next
 * @returns {*} Result.
 */
export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);
  if (error instanceof AppError) {
    return response
      .status(error.statusCode)
      .json({ error: { code: error.code, message: error.message, details: error.details } });
  }
  // Some services throw plain Errors with an HTTP status attached
  // (e.g. jobManager.requireJob sets error.status = 404 for cross-user
  // access). Honor that instead of masking everything as a 500.
  const plainStatus = Number(error?.status || error?.statusCode);
  if (Number.isInteger(plainStatus) && plainStatus >= 400 && plainStatus < 600) {
    return response.status(plainStatus).json({
      error: { code: error.code || 'REQUEST_FAILED', message: error.message || 'Request failed' },
    });
  }
  request.log?.error?.(error);
  return response
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
}
