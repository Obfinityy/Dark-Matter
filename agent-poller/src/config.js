/**
 * config.js — agent poller configuration.
 *
 * Values come from `~/.infinity-ai/poller.json` (created by `npm run login`),
 * overridden by environment variables. Nothing secret is ever hardcoded.
 *
 * Config file shape:
 * {
 *   "backendUrl": "https://dark-matter-90nw.onrender.com",
 *   "token": "<user JWT — set by `npm run login`>",
 *   "pollerId": "oracle-vm-1",
 *   "pollIntervalMs": 30000,
 *   "vmRunnerUrl": "http://127.0.0.1:4100",
 *   "stateDir": "<default: ~/.infinity-ai/poller-state>"
 * }
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CONFIG_DIR = path.join(os.homedir(), '.infinity-ai');
const CONFIG_FILE = path.join(CONFIG_DIR, 'poller.json');

function readConfigFile() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function loadConfig() {
  const file = readConfigFile();
  const stateDir =
    process.env.POLLER_STATE_DIR || file.stateDir || path.join(CONFIG_DIR, 'poller-state');
  return {
    backendUrl: (
      process.env.BACKEND_URL ||
      file.backendUrl ||
      'https://dark-matter-90nw.onrender.com'
    ).replace(/\/+$/, ''),
    token: process.env.POLLER_TOKEN || file.token || '',
    pollerId:
      process.env.POLLER_ID || file.pollerId || `poller-${os.hostname().toLowerCase().replace(/[^a-z0-9-]/g, '')}`,
    pollIntervalMs: Number(process.env.POLLER_INTERVAL_MS || file.pollIntervalMs || 30_000),
    vmRunnerUrl: (process.env.VM_RUNNER_URL || file.vmRunnerUrl || 'http://127.0.0.1:4100').replace(
      /\/+$/,
      ''
    ),
    stateDir,
    configFile: CONFIG_FILE,
  };
}

export function saveConfig(patch) {
  const current = readConfigFile();
  const next = { ...current, ...patch };
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}

export { CONFIG_FILE };
