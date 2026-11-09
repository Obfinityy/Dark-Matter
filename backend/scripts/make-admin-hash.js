// Generate ADMIN_PASSWORD_HASH + ADMIN_PASSWORD_SALT for the backend .env.
// Usage: node scripts/make-admin-hash.js
// Then paste the output values into backend/.env — NEVER commit them.

import crypto from 'node:crypto';
import readline from 'node:readline';
import { Writable } from 'node:stream';

// FIX (#354): the old readline echoed the typed password to the terminal
// (visible on screen, kept in scrollback, captured by session logs).
// Interactive input now goes through a muted output stream, so
// keystrokes are never echoed; piped input never echoes anyway, so it
// keeps the plain path. The prompt is printed manually because the
// muted stream would swallow it too.
function askPassword(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    let rl;
    if (process.stdin.isTTY) {
      const muted = new Writable({
        write(_chunk, _encoding, callback) { callback(); },
      });
      rl = readline.createInterface({ input: process.stdin, output: muted, terminal: true });
    } else {
      rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    }
    let done = false;
    const finish = (answer) => {
      if (done) return;
      done = true;
      rl.close();
      resolve(answer);
    };
    rl.question('', finish);
    rl.on('close', () => finish(''));
  });
}

const password = await askPassword('Admin password: ');
if (!password || password.length < 8) {
  console.error('Password must be 8+ characters.');
  process.exit(1);
}
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64);
console.log('\nAdd these to backend/.env:\n');
console.log(`ADMIN_PASSWORD_SALT=${salt.toString('hex')}`);
console.log(`ADMIN_PASSWORD_HASH=${hash.toString('hex')}`);
