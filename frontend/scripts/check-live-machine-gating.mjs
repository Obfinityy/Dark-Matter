// Live-machine gating regression check (27 Oct 2026) — no test framework
// in the frontend, so this is a dependency-free node guard over
// HuntCard.jsx + LiveMachinesPage.jsx.
//
// LiveMachine renders for running hunts and for a parent-brain hunt
// whose process is actively driving the machine. A paused hunt without
// an active parent process must not show a stale "live" panel.
//
// Run: node scripts/check-live-machine-gating.mjs   (exit 0 = all pass)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const huntCard = readFileSync(join(root, '..', 'src', 'components', 'HuntCard.jsx'), 'utf8');
const machinesPage = readFileSync(join(root, '..', 'src', 'pages', 'LiveMachinesPage.jsx'), 'utf8');
const liveMachine = readFileSync(join(root, '..', 'src', 'components', 'LiveMachine.jsx'), 'utf8');

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

// 1. HuntCard defines a running-only gate distinct from isActive.
check(
  'HuntCard defines isRunning (running/starting) beside isActive',
  /const isRunning = status === 'running' \|\| status === 'starting';/.test(huntCard),
);
// 2. The LiveMachine render allows a running hunt or an active parent-brain process.
check(
  'LiveMachine is gated on a running hunt or active parent process',
  huntCard.includes('(isRunning || (brainMode === \'parent\' && liveProc && liveProc.in_process)) && !brainConsoleOpen'),
);
check(
  'LiveMachine is not gated on isActive alone',
  !/\{isActive && \(\s*<LiveMachine /.test(huntCard),
);
// 3. The steer section / PiP keep their isActive behaviour (paused
// hunts can still be steered / viewed in the terminal).
check('steer section still uses isActive', /\{isActive && \(\s*<div className="hunt-steer">/.test(huntCard));
// 4. LiveMachinesPage lists running hunts only.
check(
  'LiveMachinesPage filters to running only',
  /setHunts\(all\.filter\(\(h\) => h\.status === 'running'\)\)/.test(machinesPage),
);
check(
  'LiveMachinesPage no longer lists paused hunts',
  !/h\.status === 'paused'/.test(machinesPage) || !machinesPage.includes("h.status === 'running' || h.status === 'paused'"),
);
// 5. ALWAYS VISIBLE (21:55 IST 27 Oct 2026, owner order): the running
// hunt's panel mounts open — the PiP is live on first render, not a
// collapsed bar the owner must open.
check(
  'LiveMachine mounts open (collapsed starts false)',
  /const \[collapsed, setCollapsed\] = useState\(false\)/.test(liveMachine),
);
check(
  'no collapsed-by-default initial state remains',
  !/const \[collapsed, setCollapsed\] = useState\(true\)/.test(liveMachine),
);

console.log(failures === 0 ? '\nAll live-machine gating checks passed.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
