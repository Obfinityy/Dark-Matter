/**
 * setupGuide — computer-control setup diagnostics and safe repair (issue #1).
 *
 * "Provide a clear setup path with dependency detection and configuration
 * validation... Provide an automated setup/repair mechanism where safe to do,
 * and otherwise require explicit user authorization."
 *
 * diagnoseComputerSetup() inspects every layer the computer runtime needs —
 * bridge file, Python interpreter, local venv, pyautogui, display — and
 * returns a structured, honest report. Every failing check carries a `fix`
 * with concrete steps; only fixes marked `safe: true` may run through
 * repairComputerSetup(), and only with explicit `userAuthorized: true`.
 *
 * Nothing here installs anything silently, touches the system Python, or
 * opens firewall ports. The one automated repair (creating a project-local
 * venv and pip-installing pyautogui into it) is deliberately scoped: it
 * cannot affect the rest of the machine.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function check(name, ok, detail, fix = null) {
  return { name, ok, detail, fix };
}

function manualFix(steps) {
  return { safe: false, requiresUserAuthorization: true, steps };
}

/**
 * Run the full diagnostic suite against a live adapter.
 * @returns {{ ok: boolean, summary: string, checks: Array }}
 */
export function diagnoseComputerSetup(adapter) {
  const checks = [];

  // 1. Bridge file present.
  const bridgePath = adapter?.bridgePath || null;
  const bridgeExists = Boolean(bridgePath && fs.existsSync(bridgePath));
  checks.push(
    check(
      'bridge_file',
      bridgeExists,
      bridgeExists
        ? `bridge found at ${bridgePath}`
        : `computer bridge not found at ${bridgePath || '(unknown path)'}`,
      bridgeExists
        ? null
        : manualFix([
            'Restore backend/computer/openInterfaceBridge.py from the repository.',
            'Verify the file is executable-readable by the backend process.',
          ])
    )
  );

  // 2. Python interpreter discoverable.
  let python = { bin: null, version: null, tried: [] };
  try {
    python = adapter.discoverPython() || python;
  } catch (error) {
    python = { bin: null, version: null, tried: [{ error: error.message }] };
  }
  checks.push(
    check(
      'python_interpreter',
      Boolean(python.bin),
      python.bin
        ? `working interpreter: ${python.bin} (Python ${python.version})`
        : `no working Python interpreter found (tried: ${(python.tried || []).map(t => t.bin || t.error).join(', ') || 'none'})`,
      python.bin
        ? null
        : manualFix([
            'Install Python 3.10+ from https://www.python.org/downloads/ (tick "Add python.exe to PATH" on Windows).',
            'Restart the backend and re-run this diagnostic.',
          ])
    )
  );

  // 3. Project-local venv (keeps pyautogui out of the system Python).
  let venvPython = null;
  try {
    venvPython = adapter.localVenvPython() || null;
  } catch {
    venvPython = null;
  }
  checks.push(
    check(
      'local_venv',
      Boolean(venvPython),
      venvPython
        ? `project-local virtualenv present: ${venvPython}`
        : 'no project-local virtualenv at backend/computer/.venv (optional but recommended)',
      venvPython
        ? null
        : {
            safe: true,
            requiresUserAuthorization: true,
            steps: [
              'Create the project-local virtualenv: python3 -m venv backend/computer/.venv',
              'Then install the input-simulation dependency into it (see the pyautogui check).',
            ],
            automated: 'create_venv',
          }
    )
  );

  // 4. Live probe — the source of truth for reachability + pyautogui.
  let probe = null;
  try {
    probe = adapter.probe();
  } catch (error) {
    probe = { available: false, reason: `probe crashed: ${error.message}` };
  }
  checks.push(
    check(
      'bridge_probe',
      Boolean(probe?.available),
      probe?.available
        ? `bridge answered the capability probe (platform: ${probe.capabilities?.platform || 'unknown'})`
        : `bridge probe failed: ${probe?.reason || 'unknown reason'}`,
      probe?.available
        ? null
        : manualFix([
            'Check the backend logs for [computer-bridge] errors.',
            'On a headless host, input simulation needs a display (see the display check).',
            'Restart the backend after fixing the underlying cause.',
          ])
    )
  );

  // 5. pyautogui / input simulation.
  const pyautoguiOk = probe?.capabilities?.pyautoguiAvailable === true;
  checks.push(
    check(
      'input_simulation',
      pyautoguiOk,
      pyautoguiOk
        ? 'pyautogui available — full mouse/keyboard control'
        : `input simulation unavailable: ${probe?.capabilities?.pyautoguiError || 'pyautogui not importable'}. Observation-only actions (screenshot, get_active_window, navigate) still work.`,
      pyautoguiOk
        ? null
        : {
            safe: true,
            requiresUserAuthorization: true,
            steps: [
              'Install pyautogui into the project-local virtualenv (never the system Python):',
              '  backend/computer/.venv/bin/python -m pip install pyautogui   (Linux/macOS)',
              '  backend\\computer\\.venv\\Scripts\\python -m pip install pyautogui   (Windows)',
              'Re-run this diagnostic afterwards.',
            ],
            automated: 'install_pyautogui',
          }
    )
  );

  // 6. Display (informational — input simulation needs one).
  const platform = process.platform;
  const displayHint =
    platform === 'win32' || platform === 'darwin'
      ? 'a logged-in desktop session is required'
      : process.env.DISPLAY
        ? `DISPLAY=${process.env.DISPLAY}`
        : 'no DISPLAY set — pyautogui needs an X server or equivalent';
  checks.push(
    check(
      'display',
      platform === 'win32' || platform === 'darwin' || Boolean(process.env.DISPLAY),
      `platform ${platform}: ${displayHint}`,
      null
    )
  );

  const failed = checks.filter(entry => !entry.ok);
  const ok = failed.length === 0;
  return {
    ok,
    summary: ok
      ? 'Computer control is fully set up: bridge reachable, Python available, input simulation ready.'
      : `Computer control setup incomplete — ${failed.length} check(s) failing: ${failed.map(entry => entry.name).join(', ')}.`,
    checks,
  };
}

/**
 * Run one automated, explicitly-authorized repair.
 *
 * Only `safe: true` fixes from diagnoseComputerSetup() are eligible, and only
 * when `userAuthorized === true`. Anything else returns instructions instead
 * of acting — this function never installs into the system Python.
 *
 * @returns {{ repaired: boolean, detail: string, instructions?: string[] }}
 */
export function repairComputerSetup(adapter, { repair, userAuthorized = false } = {}) {
  if (!userAuthorized) {
    return {
      repaired: false,
      requiresAuthorization: true,
      detail: 'Automated repair needs explicit user authorization.',
      instructions: [
        'Review the diagnostic report at GET /api/v1/computer/setup.',
        'Re-run this repair with { "userAuthorized": true } to proceed, or apply the manual steps yourself.',
      ],
    };
  }

  const bridgeDir = path.dirname(adapter.bridgePath);
  const venvDir = path.join(bridgeDir, '.venv');

  if (repair === 'create_venv') {
    const created = spawnSync('python3', ['-m', 'venv', venvDir], {
      encoding: 'utf8',
      timeout: 120_000,
    });
    if (created.status !== 0) {
      const fallback = spawnSync('python', ['-m', 'venv', venvDir], {
        encoding: 'utf8',
        timeout: 120_000,
      });
      if (fallback.status !== 0) {
        return {
          repaired: false,
          detail: `could not create virtualenv: ${(fallback.stderr || created.stderr || '').slice(0, 300)}`,
        };
      }
    }
    return { repaired: true, detail: `project-local virtualenv created at ${venvDir}` };
  }

  if (repair === 'install_pyautogui') {
    const venvPython =
      process.platform === 'win32'
        ? path.join(venvDir, 'Scripts', 'python.exe')
        : path.join(venvDir, 'bin', 'python');
    if (!fs.existsSync(venvPython)) {
      return {
        repaired: false,
        detail: 'no project-local virtualenv yet — run the create_venv repair first',
        instructions: [
          'POST /api/v1/computer/repair with { "repair": "create_venv", "userAuthorized": true }',
        ],
      };
    }
    const installed = spawnSync(venvPython, ['-m', 'pip', 'install', 'pyautogui'], {
      encoding: 'utf8',
      timeout: 300_000,
    });
    if (installed.status !== 0) {
      return {
        repaired: false,
        detail: `pip install pyautogui failed: ${(installed.stderr || '').slice(0, 300)}`,
      };
    }
    return { repaired: true, detail: 'pyautogui installed into the project-local virtualenv' };
  }

  return {
    repaired: false,
    detail: `unknown repair "${repair}" — no automated repair exists for it`,
    instructions: ['Use the manual steps from the diagnostic report.'],
  };
}
