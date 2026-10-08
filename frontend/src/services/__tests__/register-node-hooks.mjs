/**
 * register-node-hooks.mjs — TEST-ONLY entry point that registers the
 * node-resolve-hooks.mjs ESM hook for the current node process.
 *
 * Usage: node --test --import ./frontend/src/services/__tests__/register-node-hooks.mjs <test-file>
 * (from the repo root)
 */
import { register } from 'node:module';

register('./node-resolve-hooks.mjs', import.meta.url);
