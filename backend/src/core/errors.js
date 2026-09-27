export class AppError extends Error {
  constructor(statusCode, message, code = 'APP_ERROR', details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function assert(condition, statusCode, message, code = 'BAD_REQUEST', details) {
  if (!condition) throw new AppError(statusCode, message, code, details);
}
