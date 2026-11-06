// verify-install.mjs — CI/deploy helper (NOT imported by the running server).
//
// Resolves every production dependency (plus the exact transitive chain
// that failed on the 8db79ede deploy) against backend/node_modules, and
// also loads the two AWS SDK clients, then exits 0 only when all of them
// resolve AND load. Run in the deploy workflow AFTER install-deps.sh and
// BEFORE any restart, so a corrupt or half-installed tree fails the deploy
// loudly instead of restarting the backend into a MODULE_NOT_FOUND crash
// loop.
//
// WHY this exists: 6 Nov 2026, 8db79ede deploy — a restart landed inside
// `npm ci`'s reinstall window and the first start died on
// `Cannot find module '@smithy/core/retry'` (the @aws-sdk/client-
// bedrock-runtime import chain, llm.js:27). install-deps.sh closes that
// window by staging the install; this script is the second layer — it
// proves the tree that is about to go live actually resolves and loads,
// so a broken install can never reach a restart.
//
// Run from anywhere:  node scripts/verify-install.mjs [backendDir]
// (backendDir defaults to the backend/ dir holding this script).
// Exit 0: all modules resolve and load. Exit 1: lists every module that
// does not. Exit 2: usage error (backendDir unreadable / no package.json).

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(scriptDir, '..');

let pkg;
try {
  pkg = JSON.parse(fs.readFileSync(path.join(backendDir, 'package.json'), 'utf8'));
} catch (err) {
  console.error(`verify-install: cannot read ${path.join(backendDir, 'package.json')}: ${err.message}`);
  process.exit(2);
}

// The exact transitive chain that failed on 8db79ede: llm.js statically
// imports @aws-sdk/client-bedrock-runtime (and lazily imports
// @aws-sdk/client-sagemaker-runtime), whose @aws-sdk/core client submodule
// requires @smithy/core/retry — re-added late by npm ci, so it is the
// first thing a mid-install start trips over. These are pinned, not
// derived from package.json, so the check survives a dep being dropped
// from the direct list.
const extra = [
  '@aws-sdk/client-bedrock-runtime',
  '@aws-sdk/client-sagemaker-runtime',
  '@smithy/core/retry',
];

const modules = [...new Set([...Object.keys(pkg.dependencies ?? {}), ...extra])];
const require = createRequire(path.join(backendDir, 'package.json'));
const missing = [];
for (const mod of modules) {
  try {
    require.resolve(mod);
  } catch {
    missing.push(mod);
  }
}

// Load, not just resolve, the two SDK clients: a package can resolve yet
// fail to load (e.g. a truncated file mid-write). Resolution is scoped to
// backendDir via the require above, so this works for a fixture tree too.
if (!missing.includes('@aws-sdk/client-bedrock-runtime')
  && !missing.includes('@aws-sdk/client-sagemaker-runtime')) {
  for (const client of ['@aws-sdk/client-bedrock-runtime', '@aws-sdk/client-sagemaker-runtime']) {
    try {
      await import(pathToFileURL(require.resolve(client)).href);
    } catch (err) {
      missing.push(`${client} (unloadable: ${err && err.message ? err.message : err})`);
    }
  }
}

if (missing.length > 0) {
  console.error(`verify-install: ${missing.length} module(s) do not resolve in ${backendDir}/node_modules:`);
  for (const mod of missing) console.error(`  - ${mod}`);
  process.exit(1);
}

console.log(`verify-install: OK — ${modules.length} module(s) resolve in ${backendDir}/node_modules`);
