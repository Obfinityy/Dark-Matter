// HUNTER-MIND timing fix (26 Oct 2026): the container's clocks are
// NOT skewed — the bug is DISPLAY (no TZ set, so the XFCE clock
// shows UTC, 5:30 behind IST). The spawn path must set TZ=Asia/Kolkata
// and mount the host zoneinfo read-only so glibc can resolve it.
//
//   TZ-1  the run args carry -e TZ=Asia/Kolkata
//   TZ-2  the run args mount /usr/share/zoneinfo read-only by default
//   TZ-3  zoneinfoPath: null skips the mount (host without zoneinfo)
//   TZ-4  the rest of the spawn contract is unchanged: name, memory,
//         cpus, network, ttyd port per hunt, image last
import test from 'node:test';
import assert from 'node:assert/strict';

const { buildHuntContainerRunArgs, HUNT_TZ, ttydPortForHunt } = await import('./huntRunner.js');

const HUNT = 'h_tz_test';
const TARGET = 'https://scanme.nmap.org';

function envValue(args, key) {
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === '-e' && args[i + 1].startsWith(`${key}=`)) return args[i + 1].slice(key.length + 1);
  }
  return null;
}

// TZ-1: TZ is set to Asia/Kolkata.
test('TZ-1: the run args set TZ=Asia/Kolkata', () => {
  const args = buildHuntContainerRunArgs(HUNT, TARGET);
  assert.equal(HUNT_TZ, 'Asia/Kolkata');
  assert.equal(envValue(args, 'TZ'), 'Asia/Kolkata');
});

// TZ-2: the zoneinfo mount is present and read-only by default.
test('TZ-2: the run args mount the host zoneinfo read-only', () => {
  const args = buildHuntContainerRunArgs(HUNT, TARGET);
  const vIdx = args.indexOf('-v');
  assert.ok(vIdx >= 0, 'a -v mount is present');
  assert.equal(args[vIdx + 1], '/usr/share/zoneinfo:/usr/share/zoneinfo:ro');
});

// TZ-3: zoneinfoPath: null skips the mount.
test('TZ-3: zoneinfoPath null skips the zoneinfo mount', () => {
  const args = buildHuntContainerRunArgs(HUNT, TARGET, { zoneinfoPath: null });
  assert.ok(!args.includes('/usr/share/zoneinfo:/usr/share/zoneinfo:ro'));
  assert.equal(envValue(args, 'TZ'), 'Asia/Kolkata', 'TZ is still set — glibc falls back to UTC only for the zone file, the env still names IST');
});

// TZ-4: the rest of the spawn contract is unchanged.
test('TZ-4: name, resources, network, ttyd port and image are unchanged', () => {
  const args = buildHuntContainerRunArgs(HUNT, TARGET, { mode: 'human' });
  assert.equal(args[0], 'run');
  assert.equal(args[args.indexOf('--name') + 1], 'dm-hunt-h_tz_test');
  assert.equal(args[args.indexOf('--memory') + 1], '4g');
  assert.equal(args[args.indexOf('--cpus') + 1], '1.5');
  assert.equal(args[args.indexOf('--network') + 1], 'bridge');
  assert.equal(envValue(args, 'DM_HUNT_ID'), HUNT);
  assert.equal(envValue(args, 'DM_TARGET'), TARGET);
  assert.equal(envValue(args, 'DM_MODE'), 'human');
  assert.equal(envValue(args, 'DM_TTYD_PORT'), ttydPortForHunt(HUNT));
  assert.equal(args[args.length - 1], process.env.HUNT_IMAGE || 'darkmatter/hunt:latest');
});
