#!/usr/bin/env node
/**
 * login.js — one-time poller authentication.
 *
 * Usage: `npm run login`
 * Prompts for email + password, exchanges them for a user JWT via the
 * backend's /auth/login, and stores ONLY the token in
 * ~/.infinity-ai/poller.json (mode 600). The password is never stored.
 *
 * When the token expires (HTTP 401), run `npm run login` again.
 */
import readline from 'node:readline';
import { loadConfig, saveConfig } from './config.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q, hidden = false) =>
  new Promise((resolve) => {
    if (!hidden) return rl.question(q, resolve);
    // Mask password input.
    const stdin = process.stdin;
    let input = '';
    process.stdout.write(q);
    stdin.setRawMode(true);
    stdin.resume();
    const onData = (ch) => {
      const s = ch.toString();
      if (s === '\r' || s === '\n' || s === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(input);
      } else if (s === '\u0003') {
        process.exit(1);
      } else if (s === '\u007f') {
        input = input.slice(0, -1);
      } else {
        input += s;
      }
    };
    stdin.on('data', onData);
  });

async function main() {
  const config = loadConfig();
  console.log(`Backend: ${config.backendUrl}`);
  const email = (await ask('Email: ')).trim();
  const password = await ask('Password: ', true);
  rl.close();

  const res = await fetch(`${config.backendUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Login failed (${res.status}): ${json?.error?.message || json?.error || 'unknown'}`);
    process.exit(1);
  }
  const token = json.jwt || json.token || json.accessToken || json?.data?.token;
  if (!token) {
    console.error('Login succeeded but no token was returned — aborting.');
    process.exit(1);
  }
  saveConfig({ backendUrl: config.backendUrl, token, pollerId: config.pollerId });
  console.log(`\nToken saved to ~/.infinity-ai/poller.json (mode 600).`);
  console.log('Start the poller with: node src/index.js  (keep it running)');
}

main().catch((err) => {
  console.error('login failed:', err.message);
  process.exit(1);
});
