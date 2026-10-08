/**
 * runnerDownload.js — Infinity AI Runner (desktop companion) helpers.
 *
 * The Runner is a one-click Windows starter that runs the local Kali VM
 * sandbox + the 24/7 hunt agent on the user's own PC — no terminal, no
 * setup. The website auto-detects it at http://127.0.0.1:4100
 * and shows a "Download Runner" prompt when it isn't there.
 *
 * The starter is published as a GitHub Release asset with a STABLE name
 * (no version in the filename), so this "latest" URL never changes.
 * The ZIP contains the runner sources + Start-Runner.bat, which fetches
 * portable Node.js automatically on first run (no admin, no system install).
 */

import { LOCAL_RUNNER_BASE_URL } from '../lib/apiBase.js';

export const RUNNER_VERSION = '1.0.0';

/** Stable download URL for the Windows starter ZIP (GitHub Releases, latest). */
export const RUNNER_DOWNLOAD_URL =
  'https://github.com/Obfinityy/Dark-Matter/releases/latest/download/Infinity-AI-Runner-Windows.zip';

/** Where the local Runner serves its API (the VM sandbox host). */
export const RUNNER_LOCAL_URL = LOCAL_RUNNER_BASE_URL;

/**
 * Probe the local Runner. Resolves { up: true, version? } or { up: false }.
 * Never throws — a missing/blocked Runner is an expected state, not an error.
 */
export async function probeRunner(timeoutMs = 3500) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${RUNNER_LOCAL_URL}/health`, { signal: ctl.signal });
    if (!res.ok) return { up: false };
    const data = await res.json().catch(() => ({}));
    return { up: true, version: data.version || null };
  } catch {
    return { up: false };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Check whether the Runner's VM sandbox is fully provisioned (QEMU + Kali
 * image). Resolves { ready: true } or { ready: false, missing: ['QEMU', …] }.
 * Never throws.
 */
export async function probeRunnerReadiness(timeoutMs = 4000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${RUNNER_LOCAL_URL}/doctor`, { signal: ctl.signal });
    if (!res.ok) return { ready: false, missing: [] };
    const d = await res.json().catch(() => ({}));
    const missing = [];
    if (!d.qemuPath) missing.push('QEMU');
    if (!d.kaliImage?.present) missing.push('Kali image');
    if (!d.accel) missing.push('acceleration');
    return { ready: missing.length === 0, missing };
  } catch {
    return { ready: false, missing: [] };
  } finally {
    clearTimeout(timer);
  }
}
