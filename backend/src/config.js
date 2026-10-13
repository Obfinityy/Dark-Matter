// Central configuration — all values come from environment variables.
// No secrets are hardcoded here; see .env.example and README.md.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function csv(name) {
  return (process.env[name] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function stripTrailingSlash(u) {
  return (u || '').replace(/\/+$/, '');
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),

  // PentAGI hunt engine bridge
  engineUrl: stripTrailingSlash(process.env.ENGINE_URL || 'http://localhost:8080'),
  engineToken: process.env.ENGINE_TOKEN || '',
  engineTimeoutMs: parseInt(process.env.ENGINE_TIMEOUT_MS || '8000', 10),

  // Voice service (STT/TTS) bridge
  voiceUrl: stripTrailingSlash(process.env.VOICE_URL || 'http://localhost:8001'),

  // Authorized-targets enforcement (hunt creation)
  allowedTargets: csv('ALLOWED_TARGETS'),

  // Plugin API-key encryption master key
  pluginMasterKey: process.env.PLUGIN_MASTER_KEY || '',

  // Local persistence (plugin keys, model jobs, hunt event cache)
  dataDir: process.env.DATA_DIR || path.join(here, '..', 'data'),
};
