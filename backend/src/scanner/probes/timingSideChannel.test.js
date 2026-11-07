// Timing side-channel disclosure (#185) — no lab needed.
// Timing is injected through the opts.timedPost seam (scripted ms
// values — fully deterministic, never real wall-clock), plus one
// end-to-end test against a stub server that delays responses
// server-side. Fixtures are plain strings built in-code; no
// secret-shaped literals anywhere (no GH013 risk).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  probeTimingSideChannel,
  assessTimingOracle,
  median,
} from './timingSideChannel.js';
import { verifyFindings } from '../verifier.js';

const LOGIN = 'http://example.com/login';
const SAME_BODY = '<html><body><p>Username and/or password incorrect.</p></body></html>';
const VALID_BODY = '<html><body><p>Invalid password for this account.</p></body></html>';
const INVALID_BODY = '<html><body><p>User not found.</p></body></html>';

function loginForm(action = LOGIN) {
  return {
    action,
    inputs: [
      { name: 'username' },
      { name: 'password', type: 'password' },
      { name: 'user_token', type: 'hidden', value: 'tok123' },
    ],
  };
}

// Scripted timedPost seam: pops ms values from the queue matching
// the submitted username ('canaryuser' = valid anchor, anything
// else = invalid). Falls back to the last queued value if a queue
// runs dry, so a miscounted test fails loudly on the finding
// instead of throwing. Records every call for budget assertions.
function timedPostFor(validMs, invalidMs, body = SAME_BODY, calls = null) {
  const v = [...validMs];
  const i = [...invalidMs];
  const pop = (q) => (q.length ? q.shift() : q[q.length - 1] ?? 40);
  return async (url, fields) => {
    if (Array.isArray(calls)) calls.push({ url, user: fields.username });
    const isValid = fields.username === 'canaryuser';
    const ms = isValid ? pop(v) : pop(i);
    return { status: 200, text: body, ms };
  };
}

// Same seam, but the response BODY depends on the username — the
// content oracle user-enumeration owns (timing must stay silent).
function timedPostContentOracle(calls = null) {
  return async (url, fields) => {
    if (Array.isArray(calls)) calls.push({ url, user: fields.username });
    const isValid = fields.username === 'canaryuser';
    return { status: 200, text: isValid ? VALID_BODY : INVALID_BODY, ms: isValid ? 350 : 40 };
  };
}

// Same seam, but the valid body varies per call (unstable content).
function timedPostUnstable(calls = null) {
  let n = 0;
  return async (url, fields) => {
    if (Array.isArray(calls)) calls.push({ url, user: fields.username });
    n += 1;
    const isValid = fields.username === 'canaryuser';
    return { status: 200, text: SAME_BODY + `<!-- ${n} -->`, ms: isValid ? 350 : 40 };
  };
}

const ANCHOR = { labCreds: { username: 'canaryuser', password: 'x' }, sleepMs: 0 };
const V5 = [350, 340, 360, 345, 355];
const I5 = [40, 42, 38, 41, 39];
const V3 = [352, 348, 355];
const I3 = [41, 39, 40];

describe('median', () => {
  it('odd count takes the middle value', () => {
    assert.equal(median([30, 10, 20]), 20);
  });

  it('even count averages the two middle values', () => {
    assert.equal(median([10, 20, 30, 40]), 25);
  });

  it('empty input returns null', () => {
    assert.equal(median([]), null);
  });
});

describe('assessTimingOracle', () => {
  it('a clear oracle fires, valid slower', () => {
    const r = assessTimingOracle(V5, I5, [40, 41], [39, 42], 4);
    assert.equal(r.fires, true);
    assert.equal(r.slower, 'valid');
    assert.ok(r.gap >= 100, `gap ${r.gap} must clear 100ms`);
    assert.equal(r.wins, 5);
    assert.equal(r.reason, 'oracle');
  });

  it('a clear oracle fires either direction (invalid slower)', () => {
    const r = assessTimingOracle(I5, V5, [40, 41], [39, 42], 4);
    assert.equal(r.fires, true);
    assert.equal(r.slower, 'invalid');
  });

  it('a gap below 100ms never fires', () => {
    const r = assessTimingOracle([45, 46, 44, 45, 47], [35, 36, 34, 35, 36], [35, 36], [34, 35], 4);
    assert.equal(r.fires, false);
    assert.equal(r.reason, 'gap-below-threshold');
  });

  it('inconsistent wins never fire', () => {
    // Valid wins only 3 of 5 rounds despite a large median gap.
    const r = assessTimingOracle([350, 30, 360, 35, 355], I5, [40, 41], [39, 42], 4);
    assert.equal(r.fires, false);
    assert.equal(r.reason, 'inconsistent-wins');
  });

  it('a noisy control vetoes the finding', () => {
    // Control gap 160ms is more than half the 310ms signal.
    const r = assessTimingOracle(V5, I5, [200, 200], [40, 40], 4);
    assert.equal(r.fires, false);
    assert.equal(r.reason, 'noisy-control');
  });

  it('no control data means no finding', () => {
    const r = assessTimingOracle(V5, I5, [], [], 4);
    assert.equal(r.fires, false);
    assert.equal(r.reason, 'no-control');
  });

  it('insufficient samples never fire', () => {
    const r = assessTimingOracle([], [], [40], [41], 4);
    assert.equal(r.fires, false);
    assert.equal(r.reason, 'insufficient-samples');
  });

  it('an 8-round combined assessment fires at 6 wins', () => {
    const r = assessTimingOracle([...V5, ...V3], [...I5, ...I3], [40, 41], [39, 42], 6);
    assert.equal(r.fires, true);
    assert.equal(r.wins, 8);
  });

  it('an 8-round combined assessment fails at 5 wins', () => {
    // Re-verify rounds flip: valid faster than invalid 3 times.
    const r = assessTimingOracle([...V5, 30, 30, 30], [...I5, 40, 40, 40], [40, 41], [39, 42], 6);
    assert.equal(r.fires, false);
    assert.equal(r.reason, 'inconsistent-wins');
  });
});

describe('probeTimingSideChannel', () => {
  it('a login timing oracle fires once and verifyFindings confirms it', async () => {
    const calls = [];
    const findings = await probeTimingSideChannel([loginForm()], 'http://example.com/', {
      ...ANCHOR,
      timedPost: timedPostFor([...V5, ...V3], [...I5, 40, 40, 40, 40, ...I3], SAME_BODY, calls),
    });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'timing_side_channel');
    assert.equal(f.severity, 'medium');
    assert.match(f.title, /Timing side-channel disclosure/);
    assert.equal(f.url, LOGIN);
    assert.equal(f.parameter, 'username');
    assert.equal(f.evidence.signalCorrelated, true);
    assert.ok(f.evidence.response.includes('median gap'), 'evidence must state the gap');
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
    assert.equal(calls.length, 20, '5 main + 2 control + 3 re-verify rounds = 20 requests');
  });

  it('two login forms still yield one finding (first form only)', async () => {
    const findings = await probeTimingSideChannel(
      [loginForm(), loginForm('http://example.com/login2')],
      'http://example.com/',
      {
        ...ANCHOR,
        timedPost: timedPostFor([...V5, ...V3], [...I5, 40, 40, 40, 40, ...I3]),
      }
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, LOGIN);
  });

  it('a content oracle stays silent (user-enumeration owns it)', async () => {
    const findings = await probeTimingSideChannel([loginForm()], 'http://example.com/', {
      ...ANCHOR,
      timedPost: timedPostContentOracle(),
    });
    assert.deepEqual(findings, [], 'differing messages mean no timing finding');
  });

  it('unstable content stays silent (timing could be confounded)', async () => {
    const findings = await probeTimingSideChannel([loginForm()], 'http://example.com/', {
      ...ANCHOR,
      timedPost: timedPostUnstable(),
    });
    assert.deepEqual(findings, [], 'unstable signatures mean no timing finding');
  });

  it('degrades honestly without a valid-user anchor', async () => {
    const calls = [];
    const findings = await probeTimingSideChannel([loginForm()], 'http://example.com/', {
      sleepMs: 0,
      timedPost: timedPostFor(V5, I5, SAME_BODY, calls),
    });
    assert.deepEqual(findings, [], 'no anchor => no differential');
    assert.equal(calls.length, 0, 'no anchor => no requests at all');
  });

  it('no login form means no finding and no requests', async () => {
    const calls = [];
    const noLogin = { action: LOGIN, inputs: [{ name: 'q' }, { name: 'search' }] };
    const findings = await probeTimingSideChannel([noLogin], 'http://example.com/', {
      ...ANCHOR,
      timedPost: timedPostFor(V5, I5, SAME_BODY, calls),
    });
    assert.deepEqual(findings, []);
    assert.equal(calls.length, 0);
  });

  it('a small timing gap never fires', async () => {
    const findings = await probeTimingSideChannel([loginForm()], 'http://example.com/', {
      ...ANCHOR,
      timedPost: timedPostFor([45, 46, 44, 45, 47], [35, 36, 34, 35, 36]),
    });
    assert.deepEqual(findings, [], '45 vs 35ms is noise, not an oracle');
  });

  it('a noisy control vetoes the finding', async () => {
    // Invalid queue: main 5x40, then control A 200/200 vs B 40/40.
    const findings = await probeTimingSideChannel([loginForm()], 'http://example.com/', {
      ...ANCHOR,
      timedPost: timedPostFor(V5, [40, 40, 40, 40, 40, 200, 40, 200, 40]),
    });
    assert.deepEqual(findings, [], 'control gap 160ms swamps the signal');
  });

  it('a washed-out re-verification never fires', async () => {
    // First run fires (350 vs 40), re-verify flips (30 vs 40).
    const findings = await probeTimingSideChannel([loginForm()], 'http://example.com/', {
      ...ANCHOR,
      timedPost: timedPostFor(
        [...V5, 30, 30, 30],
        [...I5, 40, 40, 40, 40, 40, 40, 40]
      ),
    });
    assert.deepEqual(findings, [], 're-verify must reproduce the gap');
  });

  it('a transport error yields no finding', async () => {
    let n = 0;
    const flaky = async () => {
      n += 1;
      if (n === 3) return null;
      return { status: 200, text: SAME_BODY, ms: 40 };
    };
    const findings = await probeTimingSideChannel([loginForm()], 'http://example.com/', {
      ...ANCHOR,
      timedPost: flaky,
    });
    assert.deepEqual(findings, [], 'a null sample aborts the differential');
  });

  it('fires end to end against a stub server with real delays', async () => {
    const server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/login') {
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => {
          const params = new URLSearchParams(raw);
          const user = params.get('username') || '';
          const delay = user === 'canaryuser' ? 300 : 20;
          setTimeout(() => {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(SAME_BODY);
          }, delay);
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>login</html>');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    try {
      const forms = [{
        action: `http://127.0.0.1:${port}/login`,
        inputs: [{ name: 'username' }, { name: 'password', type: 'password' }],
      }];
      const findings = await probeTimingSideChannel(forms, `http://127.0.0.1:${port}/`, {
        labCreds: { username: 'canaryuser', password: 'x' },
        timeoutMs: 8000,
        sleepMs: 10,
      });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].class, 'timing_side_channel');
    } finally {
      await new Promise((r) => server.close(r));
    }
  }, { timeout: 60000 });
});
