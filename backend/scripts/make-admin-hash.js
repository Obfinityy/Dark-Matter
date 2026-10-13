// Generate ADMIN_PASSWORD_HASH + ADMIN_PASSWORD_SALT for the backend .env.
// Usage: node scripts/make-admin-hash.js
// Then paste the output values into backend/.env — NEVER commit them.

import crypto from 'node:crypto';
import readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Admin password: ', (password) => {
  rl.close();
  if (!password || password.length < 8) {
    console.error('Password must be 8+ characters.');
    process.exit(1);
  }
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  console.log('\nAdd these to backend/.env:\n');
  console.log(`ADMIN_PASSWORD_SALT=${salt.toString('hex')}`);
  console.log(`ADMIN_PASSWORD_HASH=${hash.toString('hex')}`);
});
