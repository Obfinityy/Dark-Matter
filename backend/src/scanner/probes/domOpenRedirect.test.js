// Dark Matter rule-based scanner — DOM-Based Open Redirection tests
// (coverage row #91 [Medium] DOM-Based Open Redirection, CWE-601 |
// Client-Side & Browser; phase 98 'dom-open-redirect').
//
// The probe has two tiers: a static mine (redirect sinks in
// first-party code) and — only when a sink exists — a CDP redirect
// drive in a real browser. Tests cover the mine and the drive with
// fake fetchPage / fake runner / fake CDP seams; no docker, no
// network. Fixtures are built by concatenation, never single
// literals (the repo's secret-shape rule), and every fake is
// per-test so no state leaks between tests.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeDomOpenRedirect,
  driveRedirectExecution,
  findRedirectSinks,
  assessRedirectFlow,
  assessDriveResult,
  extractParamNames,
  canaryTarget,
  canaryTargetRelative,
  controlValue,
  __domOpenRedirectMeta,
} from './domOpenRedirect.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const LAB_URL = 'http://172.17.0.1:3000/';
const BUNDLE_URL = 'http://172.17.0.1:3000/main.js';
const LAB_TARGETS = ['172.17.0.1'];
const LAB_CREDS = { username: 'lab-user', password: 'lab-pass' };

function labOpts(extra = {}) {
  return {
    labCreds: LAB_CREDS,
    allowWrite: true,
    labTargets: LAB_TARGETS,
    depth: 'standard',
    ...extra,
  };
}

// ---- fixtures (concatenation, never single literals) -----------------------

const BUNDLE_CLEAN =
  'const app = ' + "'demo';\n" +
  'const el = document.querySelector(' + "'#out');\n" +
  'el.textContent = ' + "'hello';\n";

const BUNDLE_ASSIGN_QUERY =
  'const target = new URLSearchParams(location.search).get(' + "'next');\n" +
  'location.assign(target);\n';

const BUNDLE_REPLACE_QUERY =
  'const u = new URLSearchParams(location.search).get(' + "'url');\n" +
  'window.location.replace(u);\n';

const BUNDLE_HREF_HASH =
  'const h = location.hash.slice(1);\n' +
  'location.href = h;\n';

const BUNDLE_WINDOW_OPEN =
  'const t = new URLSearchParams(location.search).get(' + "'redirect');\n" +
  'window.open(t, ' + "'_blank');\n";

const BUNDLE_HARDCODED =
  'location.href = ' + "'/dashboard';\n";

// ---- fakes -----------------------------------------------------------------

// Fake fetchPage: serves one bundle body per URL.
function fakeFetchPage(bodiesByUrl) {
  return async (url) => {
    const body = Object.prototype.hasOwnProperty.call(bodiesByUrl, url) ? bodiesByUrl[url] : null;
    if (body === null) return { status: 404, body: '' };
    return { status: 200, body };
  };
}

// Fake CDP client. `mode` decides what the canary observes:
//   'noexec'          — the page never navigates to the canary.
//   'exec-absolute'   — a query canary (absolute URL) navigates the tab.
//   'exec-relative'   — only the protocol-relative canary navigates.
//   'exec-popup'      — window.open opens a new tab on the canary.
//   'exec-fragment'   — a fragment canary navigates the tab.
//   'control-flag'    — even the control value navigates to the canary
//                       (contaminated oracle).
function fakeCdpClient(mode) {
  let currentUrl = '';
  const navigations = [];
  const client = {
    endpoint: 'http://127.0.0.1:9222',
    navigations,
    async newTarget() {
      return { webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/FAKE' };
    },
    async attach() {},
    async send() {
      return {};
    },
    async navigate(url) {
      currentUrl = String(url);
      navigations.push(currentUrl);
      return {};
    },
    async evaluate(expr) {
      if (expr === 'location.href') {
        try {
          const parsed = new URL(currentUrl);
          for (const v of parsed.searchParams.values()) {
            if (mode === 'control-flag' && v.startsWith('dmcontrol-')) return 'https://evil.example/__dmredir_x';
            if (v.startsWith('https://evil.example/__dmredir_') && mode === 'exec-absolute') return v;
            if (v.startsWith('//evil.example/__dmredir_') && mode === 'exec-relative') return `https:${v}`;
          }
          if (parsed.hash) {
            const frag = decodeURIComponent(parsed.hash.slice(1));
            if (mode === 'control-flag' && frag.startsWith('dmcontrol-')) return 'https://evil.example/__dmredir_x';
            if (frag.startsWith('https://evil.example/__dmredir_') && mode === 'exec-fragment') return frag;
          }
        } catch {
          // malformed URL — fall through to the raw URL
        }
        return currentUrl;
      }
      return undefined;
    },
    async popupTargets() {
      try {
        const parsed = new URL(currentUrl);
        for (const v of parsed.searchParams.values()) {
          // The drive's listTargets seam returns URL strings (same
          // contract as the real /json/list mapping), not objects.
          if (v.startsWith('https://evil.example/__dmredir_') && mode === 'exec-popup') return [v];
        }
      } catch {
        // malformed URL — no popup
      }
      return [];
    },
    async close() {},
  };
  return client;
}

function fakeCdpConnect(mode) {
  const client = fakeCdpClient(mode);
  return async () => ({ ok: true, client });
}

// Fake docker runner: 'run' starts a container, 'rm' removes it.
function fakeRunner(calls) {
  return async (_file, args) => {
    calls.push(Array.isArray(args) ? args.slice() : args);
    if (Array.isArray(args) && args[0] === 'run') return { ok: true, stdout: 'fake-container-id\n' };
    if (Array.isArray(args) && args[0] === 'rm') return { ok: true, stdout: '' };
    return { ok: true, stdout: '' };
  };
}

function failingRunner() {
  return async () => ({ ok: false, stdout: '', stderr: 'Cannot connect to the Docker daemon' });
}

// Probe with the CDP drive faked (mode selects the observed outcome).
async function probeWithFakeCdp(mode, targets, extra = {}) {
  const calls = [];
  const diag = {};
  const clientHolder = {};
  const cdpConnect = async () => {
    const client = fakeCdpClient(mode);
    clientHolder.client = client;
    return { ok: true, client };
  };
  const findings = await probeDomOpenRedirect(LAB_URL, targets, labOpts({
    fetchPage: fakeFetchPage({ [BUNDLE_URL]: extra.bundleBody || BUNDLE_CLEAN }),
    runner: fakeRunner(calls),
    cdpConnect,
    listTargets: async () => (clientHolder.client ? clientHolder.client.popupTargets() : []),
    diagnostics: diag,
  }));
  return { findings, diag, calls, client: clientHolder.client };
}

describe('domOpenRedirect — tier-1 mine (pure)', () => {
  it('RED-1: finds assign, replace, href-assignment and window.open sinks with line numbers', () => {
    const body =
      'location.assign(x);\n' +
      'window.location.replace(y);\n' +
      'location.href = z;\n' +
      'window.open(w);\n';
    const sinks = findRedirectSinks(body);
    assert.equal(sinks.length, 4);
    assert.deepEqual(sinks.map((s) => s.kind), ['location.assign', 'location.replace', 'location.href', 'window.open']);
    assert.deepEqual(sinks.map((s) => s.line), [1, 2, 3, 4]);
    assert.ok(sinks.every((s) => typeof s.snippet === 'string' && s.snippet.length > 0));
  });

  it('RED-2: clean code has no sinks', () => {
    assert.deepEqual(findRedirectSinks(BUNDLE_CLEAN), []);
    assert.deepEqual(findRedirectSinks(''), []);
    assert.deepEqual(findRedirectSinks(null), []);
  });

  it('RED-3: a sink near location.search is query-sourced with the parameter name extracted', () => {
    const sinks = findRedirectSinks(BUNDLE_ASSIGN_QUERY);
    assert.equal(sinks.length, 1);
    assert.equal(sinks[0].kind, 'location.assign');
    assert.equal(sinks[0].paramSource, 'query');
    assert.equal(sinks[0].nearSink, true);
    assert.deepEqual(sinks[0].paramNames, ['next']);
  });

  it('RED-4: a sink near location.hash is fragment-sourced', () => {
    const sinks = findRedirectSinks(BUNDLE_HREF_HASH);
    assert.equal(sinks.length, 1);
    assert.equal(sinks[0].kind, 'location.href');
    assert.equal(sinks[0].paramSource, 'fragment');
    assert.equal(sinks[0].nearSink, true);
    assert.deepEqual(sinks[0].paramNames, []);
  });

  it('RED-5: a hardcoded sink has unknown source and is not near-sink', () => {
    const sinks = findRedirectSinks(BUNDLE_HARDCODED);
    assert.equal(sinks.length, 1);
    assert.equal(sinks[0].paramSource, 'unknown');
    assert.equal(sinks[0].nearSink, false);
  });

  it('RED-6: extractParamNames dedupes .get() and getParameter() names', () => {
    assert.deepEqual(
      extractParamNames(`const a = p.get('next'); const b = p.get("next"); const c = getParameter('url');`),
      ['next', 'url']
    );
    assert.deepEqual(extractParamNames('no params here'), []);
  });

  it('RED-7: assessRedirectFlow drives only when a sink exists, with generic fallback params', () => {
    assert.deepEqual(assessRedirectFlow([]), {
      redirectSinks: 0, redirectNearSink: 0, drive: false, paramNames: [], hasFragmentSink: false,
    });
    const flow = assessRedirectFlow(findRedirectSinks(BUNDLE_ASSIGN_QUERY));
    assert.deepEqual(flow, {
      redirectSinks: 1, redirectNearSink: 1, drive: true, paramNames: ['next'], hasFragmentSink: false,
    });
    // Query sink with no mined name falls back to generic params.
    const generic = assessRedirectFlow(findRedirectSinks("const t = location.search;\nlocation.assign(t);"));
    assert.deepEqual(generic.paramNames, ['redirect', 'next']);
    // Fragment-only sinks drive the fragment, never a generic query param.
    const frag = assessRedirectFlow(findRedirectSinks(BUNDLE_HREF_HASH));
    assert.equal(frag.hasFragmentSink, true);
    assert.deepEqual(frag.paramNames, []);
  });

  it('RED-8: canary builders — absolute and protocol-relative targets carry the rid, control is a bare token', () => {
    const rid = 'a1b2c3d4';
    assert.equal(canaryTarget(rid), 'https://evil.example/__dmredir_a1b2c3d4');
    assert.equal(canaryTargetRelative(rid), '//evil.example/__dmredir_a1b2c3d4');
    assert.equal(controlValue(rid), 'dmcontrol-a1b2c3d4');
    assert.ok(!controlValue(rid).includes('://'));
  });

  it('RED-9: assessDriveResult — control navigation is uncalibrated, canary navigation confirms', () => {
    assert.equal(assessDriveResult({ controlClean: false, canaryReached: true }).verdict, 'uncalibrated');
    assert.equal(assessDriveResult({ controlClean: true, canaryReached: true }).verdict, 'confirmed');
    assert.equal(assessDriveResult({ controlClean: true, canaryReached: false }).verdict, 'not-executed');
  });
});

describe('domOpenRedirect — gates (fail-closed)', () => {
  it('RED-10: no labCreds → no findings and fetchPage never called', async () => {
    let fetched = 0;
    const findings = await probeDomOpenRedirect(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, {
      allowWrite: true,
      labTargets: LAB_TARGETS,
      fetchPage: async () => { fetched += 1; return { status: 200, body: BUNDLE_ASSIGN_QUERY }; },
    });
    assert.deepEqual(findings, []);
    assert.equal(fetched, 0);
  });

  it('RED-11: allowWrite false → no findings', async () => {
    // Control: the same fixture WOULD fire with allowWrite true, so
    // the gate is what blocks the finding here.
    const { findings: control } = await probeWithFakeCdp('exec-absolute', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_ASSIGN_QUERY });
    assert.equal(control.length, 1);
    const gated = await probeDomOpenRedirect(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      allowWrite: false,
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_ASSIGN_QUERY }),
    }));
    assert.deepEqual(gated, []);
  });

  it('RED-12: non-lab target → no findings', async () => {
    const findings = await probeDomOpenRedirect('https://example.com/', { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_ASSIGN_QUERY }),
      runner: fakeRunner([]),
      cdpConnect: fakeCdpConnect('exec-absolute'),
    }));
    assert.deepEqual(findings, []);
  });

  it('RED-13: depth quick → no findings', async () => {
    const findings = await probeDomOpenRedirect(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      depth: 'quick',
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_ASSIGN_QUERY }),
      runner: fakeRunner([]),
      cdpConnect: fakeCdpConnect('exec-absolute'),
    }));
    assert.deepEqual(findings, []);
  });
});

describe('domOpenRedirect — probe outcomes (fake CDP drive)', () => {
  it('RED-14: true negative — bundle with no redirect sinks → no findings, no drive', async () => {
    const { findings, diag, calls } = await probeWithFakeCdp('noexec', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_CLEAN });
    assert.deepEqual(findings, []);
    assert.equal(diag.redirectSinks, 0);
    assert.equal(diag.redirectNearSink, 0);
    assert.equal(diag.driveAttempted, undefined);
    assert.equal(calls.length, 0);
  });

  it('RED-15: sink exists but the canary never navigates → no finding, drive attempted', async () => {
    const { findings, diag, calls } = await probeWithFakeCdp('noexec', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_ASSIGN_QUERY });
    assert.deepEqual(findings, []);
    assert.equal(diag.redirectSinks, 1);
    assert.equal(diag.redirectNearSink, 1);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
    assert.ok(calls.some((a) => a[0] === 'run'), 'the drive must have started a browser');
    assert.ok(calls.some((a) => a[0] === 'rm'), 'the drive must have removed the container');
  });

  it('RED-16: absolute canary navigates the tab → exactly one medium finding', async () => {
    const { findings, diag, client } = await probeWithFakeCdp('exec-absolute', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_ASSIGN_QUERY });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'dom_sink');
    assert.equal(findings[0].severity, 'medium');
    assert.equal(findings[0].id, 'dom-open-redirect');
    assert.equal(findings[0].parameter, 'next');
    assert.match(findings[0].title, /Open Redirection/);
    assert.match(findings[0].evidence.request, /query-absolute/);
    assert.match(findings[0].evidence.request, /evil\.example\/__dmredir_/);
    assert.match(findings[0].evidence.response, /location\.href became https:\/\/evil\.example\/__dmredir_/);
    assert.match(findings[0].evidence.response, /location\.assign/);
    assert.equal(diag.redirectSinks, 1);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, true);
    assert.ok(client.navigations.some((u) => u.includes('next=dmcontrol-')), 'control navigation must run first');
  });

  it('RED-17: only the protocol-relative canary navigates → finding names that shape', async () => {
    const { findings } = await probeWithFakeCdp('exec-relative', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_REPLACE_QUERY });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].parameter, 'url');
    assert.match(findings[0].evidence.request, /query-protocol-relative/);
  });

  it('RED-18: window.open opens a new tab on the canary → finding via popup', async () => {
    const { findings } = await probeWithFakeCdp('exec-popup', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_WINDOW_OPEN });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].parameter, 'redirect');
    assert.match(findings[0].evidence.request, /query-absolute/);
  });

  it('RED-19: fragment canary navigates the tab → finding names the fragment shape', async () => {
    const { findings } = await probeWithFakeCdp('exec-fragment', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_HREF_HASH });
    assert.equal(findings.length, 1);
    assert.match(findings[0].evidence.request, /fragment/);
  });

  it('RED-20: browser fails to start → no findings, never throws', async () => {
    const diag = {};
    const findings = await probeDomOpenRedirect(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_ASSIGN_QUERY }),
      runner: failingRunner(),
      cdpConnect: fakeCdpConnect('exec-absolute'),
      diagnostics: diag,
    }));
    assert.deepEqual(findings, []);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
  });

  it('RED-21: assessConfirmation judges a probe finding confirmed (default protocol)', async () => {
    const { findings } = await probeWithFakeCdp('exec-absolute', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_ASSIGN_QUERY });
    assert.equal(findings.length, 1);
    const { verdict } = assessConfirmation(findings[0]);
    assert.equal(verdict, 'confirmed');
  });

  it('RED-22: class is dom_sink, never contains xss (no xss_reflected routing trap)', async () => {
    const { findings } = await probeWithFakeCdp('exec-absolute', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_ASSIGN_QUERY });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'dom_sink');
    assert.ok(!String(findings[0].class).includes('xss'));
  });

  it('RED-23: control value navigates to the canary → uncalibrated, no finding', async () => {
    const { findings, diag } = await probeWithFakeCdp('control-flag', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_ASSIGN_QUERY });
    assert.deepEqual(findings, []);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
  });
});

describe('domOpenRedirect — drive helper', () => {
  it('RED-24: driveRedirectExecution returns the driven rid and canary for verbatim evidence', async () => {
    const calls = [];
    const clientHolder = {};
    const cdpConnect = async () => {
      const client = fakeCdpClient('exec-absolute');
      clientHolder.client = client;
      return { ok: true, client };
    };
    const out = await driveRedirectExecution(LAB_URL, ['next'], {
      runner: fakeRunner(calls),
      cdpConnect,
      listTargets: async () => (clientHolder.client ? clientHolder.client.popupTargets() : []),
    });
    assert.equal(out.attempted, true);
    assert.equal(out.executed, true);
    assert.equal(out.shape, 'query-absolute');
    assert.equal(out.param, 'next');
    assert.match(out.rid, /^[0-9a-f]{8}$/);
    assert.equal(out.canary, `https://evil.example/__dmredir_${out.rid}`);
    assert.ok(calls.some((a) => a[0] === 'run'));
    assert.ok(calls.some((a) => a[0] === 'rm'));
  });

  it('RED-25: driveRedirectExecution never throws when the runner fails', async () => {
    const out = await driveRedirectExecution(LAB_URL, ['next'], {
      runner: failingRunner(),
      cdpConnect: fakeCdpConnect('exec-absolute'),
    });
    assert.equal(out.executed, false);
    assert.ok(typeof out.error === 'string' && out.error.length > 0);
  });
});

describe('domOpenRedirect — registration metadata', () => {
  it('RED-meta: phase 98 registration metadata', () => {
    assert.deepEqual(__domOpenRedirectMeta, { phases: ['dom-open-redirect'], depth: ['standard', 'deep'] });
  });
});
