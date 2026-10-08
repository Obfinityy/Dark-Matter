/**
 * voiceManager.js — manages the Infinity Voice Python TTS service.
 *
 * Infinity Voice is Dark-Matter's built-in neural voice engine: text in,
 * natural human-like speech out. Fully offline, zero API cost. It powers
 * the Infinity AI avatar's spoken replies.
 *
 * The Python service (backend/voice/voice_service.py) runs on 127.0.0.1:4120.
 * This manager spawns it on demand, health-checks it, and proxies speak().
 *
 * Setup (one time, on the user's machine):
 *   cd backend/voice
 *   python -m venv .venv                    # Windows: python, Linux/macOS: python3
 *   .venv/Scripts/pip install torch --index-url https://download.pytorch.org/whl/cpu   # Windows
 *   .venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu       # Linux/macOS
 *   .venv/Scripts/pip install -r requirements.txt   # or .venv/bin/pip on POSIX
 *
 * The manager auto-prefers backend/voice/.venv when present.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VOICE_DIR = path.join(__dirname, '..', '..', 'voice');
const VOICE_SCRIPT = path.join(VOICE_DIR, 'voice_service.py');
const VOICE_PORT = Number(process.env.INFINITY_VOICE_PORT || 4120);
const VOICE_URL = `http://127.0.0.1:${VOICE_PORT}`;

/**
 * Resolve the Python interpreter cross-platform.
 * Priority: explicit PYTHON env → backend/voice/.venv → system python.
 * On Windows the venv binary lives in .venv/Scripts/python.exe;
 * on POSIX it's .venv/bin/python (python3 may not exist on Windows).
 */
function resolvePython() {
  if (process.env.PYTHON && fs.existsSync(process.env.PYTHON)) return process.env.PYTHON;
  const isWin = process.platform === 'win32';
  const venvPy = isWin
    ? path.join(VOICE_DIR, '.venv', 'Scripts', 'python.exe')
    : path.join(VOICE_DIR, '.venv', 'bin', 'python');
  if (fs.existsSync(venvPy)) return venvPy;
  // Fallbacks: Windows usually has `python` / `py`, POSIX has `python3`.
  return isWin ? 'python' : 'python3';
}

export class VoiceManager {
  constructor({ logger = console } = {}) {
    this.logger = logger;
    this.child = null;
    this.starting = null;
  }

  /** Is the Python voice service responding? */
  async health() {
    try {
      const res = await fetch(`${VOICE_URL}/health`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { ok: false };
      return await res.json();
    } catch {
      return { ok: false };
    }
  }

  /** Spawn the Python service if not running. Resolves when healthy. */
  async ensureRunning({ timeoutMs = 120000 } = {}) {
    const h = await this.health();
    if (h.ok && h.ready) return true;
    if (this.starting) return this.starting;

    this.starting = (async () => {
      this.logger.info?.('[infinity-voice] starting voice service...');
      const py = resolvePython();
      this.logger.info?.(`[infinity-voice] using interpreter: ${py}`);
      this.child = spawn(py, [VOICE_SCRIPT], {
        env: { ...process.env, INFINITY_VOICE_PORT: String(VOICE_PORT) },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.child.stdout?.on('data', d =>
        this.logger.info?.(`[infinity-voice] ${String(d).trim()}`)
      );
      this.child.stderr?.on('data', d =>
        this.logger.warn?.(`[infinity-voice] ${String(d).trim().slice(0, 300)}`)
      );
      this.child.on('exit', code => {
        this.logger.warn?.(`[infinity-voice] service exited (code ${code})`);
        this.child = null;
        this.starting = null;
      });

      // Wait for readiness (model load can take 30-60s first time).
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const hh = await this.health();
          if (hh.ok && hh.ready) {
            this.logger.info?.('[infinity-voice] voice service ready');
            return true;
          }
        } catch {
          /* keep waiting */
        }
        if (!this.child)
          throw new Error(
            'Voice service died during startup — is Python + requirements installed? See backend/voice/requirements.txt'
          );
      }
      throw new Error('Voice service did not become ready in time');
    })();

    try {
      return await this.starting;
    } finally {
      if (!this.child) this.starting = null;
    }
  }

  /**
   * Text → WAV audio buffer (24kHz mono).
   * @param {string} text — max 2000 chars
   * @param {string} voice — 'aria' | 'aria2' | 'kai' | 'kai2'
   */
  async speak(text, voice = 'aria') {
    await this.ensureRunning();
    const res = await fetch(`${VOICE_URL}/speak`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({ text: String(text).slice(0, 2000), voice }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Voice service ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async stop() {
    try {
      this.child?.kill('SIGTERM');
    } catch {
      /* ignore */
    }
    this.child = null;
    this.starting = null;
  }
}
