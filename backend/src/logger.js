// Dark Matter — structured logger (Lane P4, 9 Nov 2026).
//
// One logger for the backend core: levelled methods that preserve the
// existing message text and add a timestamp, level, and stable per-module
// prefix. Dependency-free; each level writes to the same stream the
// matching console.* call used (info/debug -> stdout, warn/error ->
// stderr), so existing log capture (e.g. tests stubbing console.error)
// keeps working.
//
//   import { createLogger } from './logger.js';
//   const log = createLogger('llm');
//   log.info('[llm] OpenRouter calling model:', model);
//
// Level via LOG_LEVEL (debug|info|warn|error, default info). Debug lines
// stay silent unless LOG_LEVEL=debug.

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function configuredLevel() {
  const raw = String(process.env.LOG_LEVEL || 'info').toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, raw) ? LEVELS[raw] : LEVELS.info;
}

function emit(level, scope, args) {
  if (LEVELS[level] < configuredLevel()) return;
  const stamp = new Date().toISOString();
  const prefix = `${stamp} [${level.toUpperCase()}] [${scope}]`;
  if (level === 'warn') console.warn(prefix, ...args);
  else if (level === 'error') console.error(prefix, ...args);
  else if (level === 'debug') console.debug(prefix, ...args);
  else console.log(prefix, ...args);
}

export function createLogger(scope) {
  const name = String(scope || 'backend');
  return {
    debug(...args) { emit('debug', name, args); },
    info(...args) { emit('info', name, args); },
    warn(...args) { emit('warn', name, args); },
    error(...args) { emit('error', name, args); },
  };
}

export default createLogger;
