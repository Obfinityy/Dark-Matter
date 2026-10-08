/**
 * errors — typed application errors.
 * Shared error classes with HTTP status mapping so controllers
 * and services fail consistently.
 * Part of: Infinity AI / Dark-Matter backend (core utilities).
 */

/** Error thrown for app failures. */
export class AppError extends Error {
  constructor(statusCode, message, code = 'APP_ERROR', details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Assert.
 * @param {*} condition
 * @param {*} statusCode
 * @param {*} message
 * @param {*} code
 * @param {*} details
 * @returns {*} Result.
 */
export function assert(condition, statusCode, message, code = 'BAD_REQUEST', details) {
  if (!condition) throw new AppError(statusCode, message, code, details);
}
