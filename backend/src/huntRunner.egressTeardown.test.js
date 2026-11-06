// Egress-teardown leak regression tests (6 Nov 2026, h_fc3861b36b82).
//
// REGRESSION: hunt h_fc3861b36b82 (thebhavesh.online) finished 4 Nov,
// but its iptables chain + both ipsets + docker network were STILL live
// in the kernel days later. Two stacked causes:
//  (a) its finish path never called teardown at all (scanner hunts only
//      started calling teardownHuntContainer on 6 Nov, e52c98c2), and
//  (b) teardownHuntContainer itself returned false the moment
//      `docker rm -f` failed — BEFORE the egress block — so any hunt
//      whose container was already gone leaked its kernel state forever.
// This file pins the fixed behaviour: a failed/irrelevant `rm -f` must
// never gate the egress removal, an ambiguous rm failure must prove the
// container is gone (docker inspect) before touching egress, and the
// periodic reconciler must heal terminal hunts' stale kernel state
// without ever touching a live hunt.
//
// Contained: every docker/iptables/ipset call is a stub injected through
// the deps/opts seams; no docker, no sudo, no DATA_DIR, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teardownHuntContainer, reconcileStaleEgressState } from './huntRunner.js';
import {
  egressChainName,
  egressSetName,
  egressIpSetName,
  egressNetName,
} from './egressControl.js';

const NO_SUCH_CONTAINER = new Error(
  'Command failed: docker rm -f dm-hunt-h_x\nError: No such container: dm-hunt-h_x'
);
const DAEMON_DOWN = new Error(
  'Command failed: docker rm -f dm-hunt-h_x\nCannot connect to the Docker daemon'
);

/** Docker stub: script maps the first argv word ('rm' | 'inspect') to 'ok' or an Error. */
function stubDocker(script) {
  const calls = [];
  const fn = async (args) => {
    calls.push(args);
    const outcome = script[args[0]];
    if (outcome instanceof Error) throw outcome;
    return '';
  };
  fn.calls = calls;
  return fn;
}

/** Egress stubs: record stopProxy / removeEgress calls; readMeta returns a meta with egress state. */
function stubEgress(meta = null) {
  const removed = [];
  const stopped = [];
  return {
    removed,
    stopped,
    readMeta: () => meta,
    stopProxy: async (id) => {
      stopped.push(id);
    },
    removeEgress: async (id, opts) => {
      removed.push([id, opts]);
      return { ok: true, results: [] };
    },
  };
}

const META_WITH_EGRESS = {
  egress: { setName: 'dm-allow-h_x', containerIps: ['172.24.0.2'], resolverIp: '8.8.8.8' },
};

test('teardown removes egress when docker rm succeeds', async () => {
  const docker = stubDocker({ rm: 'ok' });
  const eg = stubEgress(META_WITH_EGRESS);
  const removed = await teardownHuntContainer('h_x', {
    docker,
    readMeta: eg.readMeta,
    stopProxy: eg.stopProxy,
    removeEgress: eg.removeEgress,
  });
  assert.equal(removed, true);
  assert.deepEqual(eg.stopped, ['h_x']);
  assert.equal(eg.removed.length, 1);
  assert.equal(eg.removed[0][0], 'h_x');
  assert.deepEqual(eg.removed[0][1].containerIps, ['172.24.0.2']);
});

test('teardown removes egress when the container is already gone (h_fc3861b36b82 shape)', async () => {
  // THE regression: old code returned false here and never ran the
  // egress block, so the chain + ipsets + network leaked forever.
  const docker = stubDocker({ rm: NO_SUCH_CONTAINER });
  const eg = stubEgress(META_WITH_EGRESS);
  const removed = await teardownHuntContainer('h_x', {
    docker,
    readMeta: eg.readMeta,
    stopProxy: eg.stopProxy,
    removeEgress: eg.removeEgress,
  });
  assert.equal(removed, false);
  assert.equal(eg.removed.length, 1);
  assert.equal(eg.removed[0][0], 'h_x');
});

test('teardown removes egress on ambiguous rm failure once inspect proves the container gone', async () => {
  const docker = stubDocker({ rm: DAEMON_DOWN, inspect: NO_SUCH_CONTAINER });
  const eg = stubEgress(META_WITH_EGRESS);
  await teardownHuntContainer('h_x', {
    docker,
    readMeta: eg.readMeta,
    stopProxy: eg.stopProxy,
    removeEgress: eg.removeEgress,
  });
  assert.deepEqual(
    docker.calls.map((c) => c[0]),
    ['rm', 'inspect']
  );
  assert.equal(eg.removed.length, 1);
});

test('teardown keeps egress when inspect shows the container still exists', async () => {
  const docker = stubDocker({ rm: DAEMON_DOWN, inspect: 'ok' });
  const eg = stubEgress(META_WITH_EGRESS);
  const removed = await teardownHuntContainer('h_x', {
    docker,
    readMeta: eg.readMeta,
    stopProxy: eg.stopProxy,
    removeEgress: eg.removeEgress,
  });
  assert.equal(removed, false);
  assert.equal(eg.removed.length, 0);
});

test('teardown keeps egress when inspect fails ambiguously (fail-closed)', async () => {
  const docker = stubDocker({ rm: DAEMON_DOWN, inspect: DAEMON_DOWN });
  const eg = stubEgress(META_WITH_EGRESS);
  await teardownHuntContainer('h_x', {
    docker,
    readMeta: eg.readMeta,
    stopProxy: eg.stopProxy,
    removeEgress: eg.removeEgress,
  });
  assert.equal(eg.removed.length, 0);
});

test('teardown removes egress even without meta.egress (network-only leak shape)', async () => {
  // The 1 Nov finalize failures left bare dm-net-<id> networks behind
  // with NO meta.egress — the old meta.egress gate skipped them.
  // removeHuntEgress derives every name from the huntId alone, so it
  // still removes the network (and any sets/chain) with no container IPs.
  const docker = stubDocker({ rm: NO_SUCH_CONTAINER });
  const eg = stubEgress(null);
  await teardownHuntContainer('h_netonly', {
    docker,
    readMeta: eg.readMeta,
    stopProxy: eg.stopProxy,
    removeEgress: eg.removeEgress,
  });
  assert.equal(eg.removed.length, 1);
  assert.equal(eg.removed[0][1].containerIps, undefined);
});

test('reconciler heals terminal hunts with live kernel state and touches nothing else', async () => {
  const finishedChain = 'h_fin_chain';
  const finishedNetOnly = 'h_fin_net';
  const runningChain = 'h_run_chain';
  const pausedNet = 'h_paused_net';
  const finishedClean = 'h_fin_clean';
  const finishedLiveDriver = 'h_fin_driver';
  const finishedUnknownLiveness = 'h_fin_unknown';
  const metas = [
    { huntId: finishedChain, state: 'finished', brainMode: 'scanner' },
    { huntId: finishedNetOnly, state: 'finished', brainMode: 'scanner' },
    { huntId: runningChain, state: 'running', brainMode: 'scanner' },
    { huntId: pausedNet, state: 'paused', brainMode: null },
    { huntId: finishedClean, state: 'finished', brainMode: 'scanner' },
    { huntId: finishedLiveDriver, state: 'finished', brainMode: null },
    { huntId: finishedUnknownLiveness, state: 'finished', brainMode: null },
  ];
  const liveNames = {
    chains: new Set([
      egressChainName(finishedChain),
      egressChainName(runningChain),
      egressChainName(finishedLiveDriver),
      egressChainName(finishedUnknownLiveness),
    ]),
    sets: new Set([egressSetName(finishedChain), egressIpSetName(finishedChain)]),
    nets: new Set([egressNetName(finishedNetOnly), egressNetName(pausedNet)]),
  };
  const tornDown = [];
  const events = [];
  const res = await reconcileStaleEgressState({
    listMetas: () => metas,
    listLiveNames: async () => liveNames,
    teardown: async (id) => {
      tornDown.push(id);
    },
    isLive: async (id) => {
      if (id === finishedLiveDriver) return true;
      if (id === finishedUnknownLiveness) throw new Error('liveness probe failed');
      return false;
    },
    recordEvent: async (id, event) => {
      events.push([id, event]);
    },
  });
  // Only the two terminal hunts with live kernel state are healed — the
  // net-only one proves the reconciler does not need meta.egress.
  assert.deepEqual(res.reconciled, [finishedChain, finishedNetOnly]);
  assert.deepEqual(tornDown, [finishedChain, finishedNetOnly]);
  // Audit events are recorded for each healed hunt.
  assert.equal(events.length, 2);
  assert.equal(events[0][1].state, 'egress_teardown_reconciled');
  // Running + paused hunts are never touched, even with live state.
  assert.equal(tornDown.includes(runningChain), false);
  assert.equal(tornDown.includes(pausedNet), false);
  // A terminal hunt with no live kernel state costs no teardown.
  assert.equal(tornDown.includes(finishedClean), false);
  // Live-driver and unknown-liveness hunts are skipped, never torn down.
  assert.deepEqual(
    res.skipped.map((s) => s.huntId).sort(),
    [finishedLiveDriver, finishedUnknownLiveness].sort()
  );
  assert.equal(res.skipped.find((s) => s.huntId === finishedLiveDriver).reason, 'live-driver');
  assert.equal(tornDown.includes(finishedLiveDriver), false);
  assert.equal(tornDown.includes(finishedUnknownLiveness), false);
});

test('reconciler does nothing when the kernel probe fails', async () => {
  const tornDown = [];
  const res = await reconcileStaleEgressState({
    listMetas: () => [{ huntId: 'h_fin', state: 'finished' }],
    listLiveNames: async () => {
      throw new Error('iptables not found');
    },
    teardown: async (id) => {
      tornDown.push(id);
    },
    isLive: async () => false,
    recordEvent: async () => {},
  });
  assert.deepEqual(res.reconciled, []);
  assert.deepEqual(tornDown, []);
});
