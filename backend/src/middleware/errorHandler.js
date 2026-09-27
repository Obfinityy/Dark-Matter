import { AppError } from '../core/errors.js';

export function notFoundHandler(request, response) {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);
  if (error instanceof AppError) {
    return response.status(error.statusCode).json({ error: { code: error.code, message: error.message, details: error.details } });
  }
  request.log?.error?.(error);
  return response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
}
