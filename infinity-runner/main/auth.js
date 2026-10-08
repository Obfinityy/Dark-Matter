/**
 * auth.js — sign-in for the Infinity AI Runner.
 *
 * The 24/7 hunt agent (agent-poller) needs the user's JWT. Instead of a
 * terminal `npm run login`, the Runner's status window has an email+password
 * form; this module exchanges them for a token via the backend's
 * /api/v1/auth/login and stores ONLY the token in ~/.infinity-ai/poller.json
 * (mode 600) — the exact file the standalone poller also reads, so both stay
 * compatible. The password is never stored.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BACKEND_URL = 'https://dark-matter-90nw.onrender.com';
// Overridable for tests via INFINITY_AI_CONFIG_DIR.
function configDir() {
  return process.env.INFINITY_AI_CONFIG_DIR || path.join(os.homedir(), '.infinity-ai');
}
function configFile() {
  return path.join(configDir(), 'poller.json');
}

function readFile() {
  try {
    const raw = fs.readFileSync(configFile(), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Decode the JWT payload (no verification — display only) to show the account email. */
function emailFromToken(token) {
  try {
    const part = String(token).split('.')[1];
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return payload.email || payload.sub || null;
  } catch {
    return null;
  }
}

function loadAuth() {
  const file = readFile();
  const token = process.env.POLLER_TOKEN || file.token || '';
  return {
    backendUrl: (process.env.BACKEND_URL || file.backendUrl || BACKEND_URL).replace(/\/+$/, ''),
    token,
    pollerId: process.env.POLLER_ID || file.pollerId || `runner-${os.hostname().toLowerCase().replace(/[^a-z0-9-]/g, '')}`,
    email: token ? emailFromToken(token) : null,
  };
}

/**
 * Sign in with email+password. Throws on failure (message is user-safe).
 * @returns {{ email: string|null }} the signed-in account
 */
async function signIn(email, password, { fetchImpl = fetch, backendUrl = BACKEND_URL } = {}) {
  const cleanEmail = String(email || '').trim();
  if (!cleanEmail || !password) throw new Error('Please enter your email and password.');
  let res;
  try {
    res = await fetchImpl(`${backendUrl.replace(/\/+$/, '')}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password }),
    });
  } catch {
    throw new Error('Could not reach Dark Matter. Check your internet connection and try again.');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || 'Sign-in failed.';
    throw new Error(typeof msg === 'string' ? msg : 'Sign-in failed.');
  }
  const token = json.jwt || json.token || json.accessToken || json?.data?.token;
  if (!token) throw new Error('Sign-in worked, but no session was returned. Please try again.');
  const prev = readFile();
  fs.mkdirSync(configDir(), { recursive: true });
  fs.writeFileSync(
    configFile(),
    JSON.stringify({
      backendUrl: backendUrl.replace(/\/+$/, ''),
      token,
      pollerId: prev.pollerId || `runner-${os.hostname().toLowerCase().replace(/[^a-z0-9-]/g, '')}`,
    }, null, 2),
    { mode: 0o600 }
  );
  return { email: emailFromToken(token) || cleanEmail };
}

/** Sign out: remove the stored token (the hunt agent stops until sign-in). */
function signOut() {
  const prev = readFile();
  delete prev.token;
  try {
    fs.mkdirSync(configDir(), { recursive: true });
    fs.writeFileSync(configFile(), JSON.stringify(prev, null, 2), { mode: 0o600 });
  } catch { /* best effort */ }
}

module.exports = { BACKEND_URL, emailFromToken, loadAuth, signIn, signOut, configFile };
