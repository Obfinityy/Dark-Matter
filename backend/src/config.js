// Central configuration — all values come from environment variables.
// No secrets are hardcoded here; see .env.example and README.md.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Minimal .env loader (no dependency): backend/.env populates process.env
// for keys not already set in the real environment.
(function loadDotEnv() {
  try {
    const envPath = path.join(here, '..', '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (k && !(k in process.env)) process.env[k] = v;
    }
  } catch { /* .env is optional */ }
})();

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

  // Inference heartbeat (GLOBAL — one shared 8B model, one file; the
  // ollama-watchdog reads the same path, so backend and watchdog MUST
  // agree). Derived from the checkout root (this file lives in
  // backend/src, so two levels up is the install root) — never a
  // hardcoded install path, so any install resolves correctly; on EC2
  // the root is the install root and the resolved path is exactly the
  // historical default. Deliberately NOT under dataDir: the installed
  // watchdog defaults to this path and the deploy workflow never
  // reinstalls it, so moving the default would silently break the
  // watchdog's busy-server protection. AI_HEARTBEAT_PATH still
  // overrides at call time (resolved in llm.js, not here).
  aiHeartbeatPath: path.join(here, '..', '..', '.ai-inference-active'),
};
