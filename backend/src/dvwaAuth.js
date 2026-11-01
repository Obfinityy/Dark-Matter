/**
 * dvwaAuth.js — DVWA auto-login helper for the hunt engine.
 *
 * Problem: the brain gets stuck at DVWA login because DVWA requires a
 * per-request CSRF token (user_token) that the browser-based login flow
 * does not handle reliably. The brain loops on recall#267 trying to log in.
 *
 * Solution: system-level helper that performs the login via shell (curl),
 * handling the CSRF token extraction + POST + security-level setting.
 * The authenticated cookie jar is saved for the hunt container to reuse.
 *
 * This is a permanent system-level fix: any future hunt targeting a DVWA
 * instance gets working auth without the brain having to figure it out.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const execFileAsync = promisify(execFile);

/**
 * Perform DVWA login inside the hunt container.
 *
 * @param {object} opts
 * @param {string} opts.huntId - hunt id (for cookie jar path)
 * @param {string} opts.target - DVWA base URL, e.g. http://172.17.0.1:3100
 * @param {string} opts.username - default 'admin'
 * @param {string} opts.password - default 'password'
 * @param {function} opts.execInContainer - async (huntId, cmd) => { stdout, stderr }
 * @returns {Promise<{ok:boolean, cookieJar:string, error?:string}>}
 */
export async function dvwaLogin({
  huntId,
  target,
  username = 'admin',
  password = 'password',
  execInContainer,
}) {
  const base = String(target || '').replace(/\/+$/, '');
  if (!base) return { ok: false, error: 'no_target' };
  if (typeof execInContainer !== 'function') return { ok: false, error: 'no_exec' };

  const jar = `/tmp/dvwa-cookies-${huntId}.txt`;

  // The login script handles: GET login.php -> extract user_token ->
  // POST credentials -> verify welcome -> set security=low
  const script = `
set -e
BASE="${base}"
JAR="${jar}"
USER="${username}"
PASS="${password}"
curl -s -c "$JAR" "$BASE/login.php" -o /tmp/dvwa_login.html
TOKEN=$(grep -oP "user_token' value='\\K[^']+" /tmp/dvwa_login.html | head -1)
if [ -z "$TOKEN" ]; then echo "NOTOKEN"; exit 1; fi
curl -s -b "$JAR" -c "$JAR" -L \\
  -d "username=$USER&password=$PASS&user_token=$TOKEN&Login=Login" \\
  "$BASE/login.php" -o /tmp/dvwa_logged.html
if ! grep -q "Welcome" /tmp/dvwa_logged.html; then echo "LOGINFAIL"; exit 1; fi
curl -s -b "$JAR" "$BASE/security.php" -o /tmp/dvwa_sec.html
SECTOKEN=$(grep -oP "user_token' value='\\K[^']+" /tmp/dvwa_sec.html | head -1)
curl -s -b "$JAR" -c "$JAR" \\
  -d "security=low&user_token=$SECTOKEN&seclev_submit=Submit" \\
  "$BASE/security.php" -o /dev/null
echo "OK $JAR"
`.trim();

  try {
    const res = await execInContainer(huntId, `bash -c ${JSON.stringify(script)}`);
    const out = String(res.stdout || '') + String(res.stderr || '');
    if (out.includes('OK ')) {
      return { ok: true, cookieJar: jar };
    }
    if (out.includes('NOTOKEN')) return { ok: false, error: 'csrf_token_not_found' };
    if (out.includes('LOGINFAIL')) return { ok: false, error: 'login_failed' };
    return { ok: false, error: 'unknown', detail: out.slice(0, 500) };
  } catch (e) {
    return { ok: false, error: 'exec_failed', detail: String(e.message || e).slice(0, 500) };
  }
}

/**
 * Check whether the brain appears stuck at a DVWA login page.
 * Looks at recent tool_call events for repeated login attempts
 * without a successful navigation away from login.php.
 */
export function isStuckAtDvwaLogin(events, { window = 20 } = {}) {
  const rows = Array.isArray(events) ? events.slice(-window) : [];
  let loginAttempts = 0;
  let navigatedAway = false;
  for (const e of rows) {
    if (!e) continue;
    const text = JSON.stringify(e).toLowerCase();
    if (text.includes('login.php') && (text.includes('browser_click') || text.includes('browser_type'))) {
      loginAttempts++;
    }
    if (e.type === 'verification' && e.verified === false &&
        String(e.evidence || '').includes('url contains index')) {
      loginAttempts++;
    }
    // successful navigation away from login = not stuck
    if (e.type === 'observation' && typeof e.text === 'string' &&
        e.text.includes('Welcome') && !e.text.includes('login.php')) {
      navigatedAway = true;
    }
  }
  return loginAttempts >= 3 && !navigatedAway;
}
