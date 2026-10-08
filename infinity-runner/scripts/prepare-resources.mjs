#!/usr/bin/env node
/**
 * prepare-resources.js — stage the bundled services for electron-builder.
 *
 * Copies ../vm-runner and ../agent-poller into build-resources/ (excluding
 * dev-only files) and installs their runtime dependencies with
 * `npm install --omit=dev`. electron-builder then ships them via
 * extraResources; the main process launches them with utilityProcess.fork()
 * (Electron's bundled Node — the user never installs Node).
 *
 * Native modules are deliberately skipped: vm-runner's node-pty is optional
 * and degrades gracefully (terminal sessions report "unavailable", everything
 * else keeps working).
 */
import { cp, rm, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..', '..');
const outDir = path.join(here, '..', 'build-resources');

const SERVICES = ['vm-runner', 'agent-poller'];

function npmInstall(cwd) {
  // --omit=dev + --no-audit/--no-fund: quiet, reproducible, no native builds
  // beyond what prebuilds provide. node-pty is optional and skipped.
  return execFileAsync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd, timeout: 300000 });
}

async function main() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const svc of SERVICES) {
    const src = path.join(repoRoot, svc);
    const dest = path.join(outDir, svc);
    console.log(`staging ${svc} ...`);
    await cp(src, dest, {
      recursive: true,
      filter: (p) => {
        const rel = path.relative(src, p);
        // Drop dev-only weight: tests, node_modules (reinstalled clean),
        // lockfiles are fine to keep for reproducibility.
        if (/(^|[\\/])node_modules([\\/]|$)/.test(rel)) return false;
        if (/(^|[\\/])tests?([\\/]|$)/.test(rel)) return false;
        if (/(^|[\\/])\.git([\\/]|$)/.test(rel)) return false;
        return true;
      },
    });
    console.log(`installing ${svc} runtime deps ...`);
    await npmInstall(dest);
    console.log(`${svc} staged.`);
  }
  console.log(`done → ${outDir}`);
}

main().catch((err) => {
  console.error('prepare-resources failed:', err.message);
  process.exit(1);
});
