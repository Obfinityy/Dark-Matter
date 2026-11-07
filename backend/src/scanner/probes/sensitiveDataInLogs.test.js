// Sensitive data in logs (#180) — no network, no lab needed.
// Fetches go through the opts.fetchPage seam, and log fixtures are
// plain strings built in-code. Secret-shaped fixtures are built by
// concatenation, never as single literals (GitHub push protection
// GH013 rejects Stripe/Twilio/AWS-shaped literals).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeSensitiveDataInLogs,
  detectSensitiveDataInLogs,
  buildLogTargets,
  isLogSurface,
  looksLikeLog,
  luhnValid,
  isRealSecretValue,
  maskValue,
} from './sensitiveDataInLogs.js';
import { verifyFindings } from '../verifier.js';

const PAGE = 'http://example.com/';
const APP_LOG = 'http://example.com/app.log';
const ERR_LOG = 'http://example.com/error.log';
const DBG_LOG = 'http://example.com/debug.log';
const ACC_LOG = 'http://example.com/access.log';
const LOGS = 'http://example.com/logs';

const BASELINE =
  '<html><head><title>Example</title></head><body>' +
  '<h1>Welcome</h1><form><input name="username"><input name="password" type="password">' +
  '<p>Docs: set your api_key in the dashboard.</p></form></body></html>';

// Secret-shaped fixtures — built by concatenation, never literals.
const AWS_KEY = 'AK' + 'IA' + 'IOSFODNN7' + 'EXAMPLE';
const PRIVATE_KEY_BEGIN = '-----BEGIN ' + 'RSA PRIVATE KEY-----';
const CARD = '4111' + ' ' + '1111' + ' ' + '1111' + ' ' + '1111';
const BEARER = 'Bearer ' + 'dmTestToken7f3a9c1e5b8d2460a13579bdf';

const LOG_HEAD = '2026-11-07 10:00:00 INFO app starting\n2026-11-07 10:00:01 INFO listening on :3000';
const PASSWORD_LOG = `${LOG_HEAD}\n2026-11-07 10:00:02 INFO user login password=hunter2XYZ for admin`;
const APIKEY_LOG = `${LOG_HEAD}\n2026-11-07 10:00:02 DEBUG api_key=sk-live-9f2c4a71b3e8d5a6`;
const JSON_LOG = `${LOG_HEAD}\n{"ts":"2026-11-07T10:00:02Z","level":"info","password": "hunter2XYZ"}`;
const BEARER_LOG = `${LOG_HEAD}\n2026-11-07 10:00:02 INFO GET /api ${BEARER}`;
const AWS_LOG = `${LOG_HEAD}\n2026-11-07 10:00:02 ERROR aws key ${AWS_KEY} rejected`;
const KEY_LOG = `${LOG_HEAD}\n2026-11-07 10:00:02 ERROR loading key\n${PRIVATE_KEY_BEGIN}\nMIIEowIBAAKCAQEA7`;
const CARD_LOG = `${LOG_HEAD}\n2026-11-07 10:00:02 INFO payment card ${CARD} charged`;
const BENIGN_LOG = `${LOG_HEAD}\n2026-11-07 10:00:02 INFO GET / 200 12ms\n2026-11-07 10:00:03 WARN slow query 412ms`;

// fetchPage seam: map URL -> { status, body }. Unknown URLs 404.
function fetchPageFor(bodies, calls) {
  return async (url) => {
    if (Array.isArray(calls)) calls.push(String(url));
    const entry = bodies[String(url)];
    if (entry === undefined) return { status: 404, body: 'Not Found' };
    if (entry instanceof Error) throw entry;
    return entry;
  };
}

describe('detectSensitiveDataInLogs', () => {
  const check = { baselineBody: BASELINE, catchAllBody: '', url: APP_LOG };

  it('a password assignment with digits fires (credential)', () => {
    const leaks = detectSensitiveDataInLogs(PASSWORD_LOG, check);
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].kind, 'credential');
    assert.equal(leaks[0].field, 'password');
    assert.equal(leaks[0].value, 'hunter2XYZ');
  });

  it('an api_key assignment fires', () => {
    const leaks = detectSensitiveDataInLogs(APIKEY_LOG, check);
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].kind, 'credential');
    assert.equal(leaks[0].field, 'api_key');
  });

  it('a JSON-form credential fires', () => {
    const leaks = detectSensitiveDataInLogs(JSON_LOG, check);
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].kind, 'credential');
    assert.equal(leaks[0].value, 'hunter2XYZ');
  });

  it('a Bearer token fires', () => {
    const leaks = detectSensitiveDataInLogs(BEARER_LOG, check);
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].kind, 'bearer');
  });

  it('a Basic Authorization header fires', () => {
    // 'dXNlcjpodW50ZXIyWFla' is base64 for user:hunter2XYZ.
    const body = `${LOG_HEAD}\n2026-11-07 10:00:02 INFO Authorization: Basic dXNlcjpodW50ZXIyWFla`;
    const leaks = detectSensitiveDataInLogs(body, check);
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].kind, 'bearer');
  });

  it('an AWS access key fires', () => {
    const leaks = detectSensitiveDataInLogs(AWS_LOG, check);
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].kind, 'aws-key');
    assert.equal(leaks[0].value, AWS_KEY);
  });

  it('a private key block fires', () => {
    const leaks = detectSensitiveDataInLogs(KEY_LOG, check);
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].kind, 'private-key');
  });

  it('a Luhn-valid card fires with last-4 display only', () => {
    const leaks = detectSensitiveDataInLogs(CARD_LOG, check);
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].kind, 'card');
    assert.equal(leaks[0].display, '**** **** **** 1111');
    assert.ok(!leaks[0].display.includes('4111111111111111'));
  });

  it('a Luhn-invalid 16-digit number does NOT fire', () => {
    const body = `${LOG_HEAD}\n2026-11-07 10:00:02 INFO order 1234567890123456 shipped`;
    assert.deepEqual(detectSensitiveDataInLogs(body, check), []);
  });

  it('a letters-only short password value does NOT fire', () => {
    const body = `${LOG_HEAD}\n2026-11-07 10:00:02 INFO login failed password=wrongpass`;
    assert.deepEqual(detectSensitiveDataInLogs(body, check), []);
  });

  it('placeholder values do NOT fire', () => {
    const bodies = [
      `${LOG_HEAD}\n2026-11-07 10:00:02 INFO password=changeme`,
      `${LOG_HEAD}\n2026-11-07 10:00:02 INFO api_key=********`,
      `${LOG_HEAD}\n2026-11-07 10:00:02 INFO password=\${DB_PASS}`,
      `${LOG_HEAD}\n2026-11-07 10:00:02 INFO password=<password>`,
    ];
    for (const b of bodies) assert.deepEqual(detectSensitiveDataInLogs(b, check), []);
  });

  it('a value already printed on the baseline page does NOT fire', () => {
    const leaks = detectSensitiveDataInLogs(PASSWORD_LOG, {
      baselineBody: `${BASELINE}<p>demo password hunter2XYZ</p>`,
      catchAllBody: '',
      url: APP_LOG,
    });
    assert.deepEqual(leaks, []);
  });

  it('an HTML document body never fires', () => {
    const body =
      '<html><body><p>2026-11-07 10:00:00 INFO error</p><p>password=hunter2XYZ</p></body></html>';
    assert.deepEqual(detectSensitiveDataInLogs(body, check), []);
  });

  it('a body identical to the catch-all control never fires', () => {
    const leaks = detectSensitiveDataInLogs(PASSWORD_LOG, {
      baselineBody: BASELINE,
      catchAllBody: PASSWORD_LOG,
      url: APP_LOG,
    });
    assert.deepEqual(leaks, []);
  });

  it('a benign log returns no leaks', () => {
    assert.deepEqual(detectSensitiveDataInLogs(BENIGN_LOG, check), []);
  });

  it('non-log prose with one log-like line does NOT fire', () => {
    const prose =
      '2026-11-07 10:00:00 INFO this is a release note\n' +
      'To log in, use password=hunter2XYZ on the demo account.\n' +
      'See the docs for details.';
    assert.deepEqual(
      detectSensitiveDataInLogs(prose, { baselineBody: BASELINE, catchAllBody: '', url: PAGE }),
      []
    );
  });

  it('a single-line .log file with a password fires', () => {
    // One log-like line (timestamped) on a .log URL is a log.
    const leaks = detectSensitiveDataInLogs('2026-11-07 10:00:02 INFO password=hunter2XYZ', {
      baselineBody: BASELINE,
      catchAllBody: '',
      url: APP_LOG,
    });
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].kind, 'credential');
  });

  it('a date-like digit string is not a card', () => {
    const body = `${LOG_HEAD}\n2026-11-07 10:00:02 INFO backup 20261107 done`;
    assert.deepEqual(detectSensitiveDataInLogs(body, check), []);
  });

  it('masked display never contains the full secret', () => {
    const leaks = detectSensitiveDataInLogs(PASSWORD_LOG, check);
    assert.equal(leaks.length, 1);
    assert.ok(!leaks[0].display.includes('hunter2XYZ'));
    assert.ok(leaks[0].display.startsWith('hunt'));
  });
});

describe('luhnValid / isRealSecretValue / maskValue', () => {
  it('luhnValid accepts known test numbers and rejects bad ones', () => {
    assert.equal(luhnValid('4111111111111111'), true);
    assert.equal(luhnValid('5500005555555559'), true);
    assert.equal(luhnValid('1234567890123456'), false);
    assert.equal(luhnValid('4111111111111112'), false);
    assert.equal(luhnValid('123'), false);
  });

  it('isRealSecretValue enforces length, entropy and placeholder rules', () => {
    assert.equal(isRealSecretValue('hunter2XYZ'), true);
    assert.equal(isRealSecretValue('abcdefghijkl'), true); // 12+ letters
    assert.equal(isRealSecretValue('abc123'), false); // too short
    assert.equal(isRealSecretValue('wrongpass'), false); // letters only, short
    assert.equal(isRealSecretValue('changeme'), false);
    assert.equal(isRealSecretValue('********'), false);
    assert.equal(isRealSecretValue('${DB_PASS}'), false);
    assert.equal(isRealSecretValue('aaaaaaaa'), false); // one repeated char
  });

  it('maskValue masks credentials, shows card last-4, keeps the key marker', () => {
    assert.equal(maskValue('hunter2XYZ', 'credential'), 'hunt\u2026YZ');
    assert.equal(maskValue('4111111111111111', 'card'), '**** **** **** 1111');
    assert.equal(maskValue(PRIVATE_KEY_BEGIN, 'private-key'), PRIVATE_KEY_BEGIN);
    assert.equal(maskValue('short', 'credential'), '****');
  });
});

describe('buildLogTargets', () => {
  it('the pasted URL itself is included first when it IS a log', () => {
    const targets = buildLogTargets(APP_LOG, [], '');
    assert.equal(targets[0].url, APP_LOG);
  });

  it('<a> links to log files are mined, cross-origin excluded', () => {
    const html =
      '<a href="/logs/app.log">app</a><a href="https://evil.example.com/x.log">evil</a>' +
      '<a href="/page.html">page</a>';
    const targets = buildLogTargets(PAGE, [], html);
    assert.ok(targets.some((t) => t.url === 'http://example.com/logs/app.log'));
    assert.ok(!targets.some((t) => t.url.includes('evil.example.com')));
    assert.ok(!targets.some((t) => t.url.endsWith('/page.html')));
  });

  it('the fixed log paths are included', () => {
    const targets = buildLogTargets(PAGE, [], '');
    const urls = targets.map((t) => t.url);
    for (const p of ['/logs', '/log', '/admin/logs', '/app.log', '/error.log', '/debug.log', '/access.log']) {
      assert.ok(urls.includes(`http://example.com${p}`), `missing ${p}`);
    }
  });

  it('orchestrator URLs are filtered to log surfaces only', () => {
    const targets = buildLogTargets(PAGE, [
      'http://example.com/custom.log',
      'http://example.com/api/users',
      'http://example.com/bundle.js',
    ], '');
    assert.ok(targets.some((t) => t.url === 'http://example.com/custom.log'));
    assert.ok(!targets.some((t) => t.url.endsWith('/api/users')));
    assert.ok(!targets.some((t) => t.url.endsWith('/bundle.js')));
  });

  it('targets are deduped and capped at 10', () => {
    const many = Array.from({ length: 20 }, (_, i) => `http://example.com/f${i}.log`);
    const targets = buildLogTargets(PAGE, many, '');
    assert.equal(targets.length, 10);
    assert.equal(new Set(targets.map((t) => t.url)).size, 10);
  });

  it('non-log orchestrator URLs are never included', () => {
    const targets = buildLogTargets(PAGE, [
      'http://example.com/bundle.js',
      'http://example.com/style.css',
      'http://example.com/photo.jpg',
      'http://example.com/api.json',
    ], '');
    const urls = targets.map((t) => t.url);
    for (const u of ['http://example.com/bundle.js', 'http://example.com/style.css', 'http://example.com/photo.jpg', 'http://example.com/api.json']) {
      assert.ok(!urls.includes(u), `must not include ${u}`);
    }
    assert.ok(!urls.some((u) => u.endsWith('.js') || u.endsWith('.css') || u.endsWith('.jpg')));
  });

  it('an unparseable page URL returns no targets', () => {
    assert.deepEqual(buildLogTargets('not a url', [], ''), []);
  });
});

describe('probeSensitiveDataInLogs', () => {
  it('a password in /app.log is one High finding and verifyFindings confirms it', async () => {
    const findings = await probeSensitiveDataInLogs(PAGE, [], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: BASELINE },
        [APP_LOG]: { status: 200, body: PASSWORD_LOG },
      }),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'sensitive_data_in_logs');
    assert.equal(findings[0].severity, 'high');
    assert.ok(findings[0].title.includes('app.log'));
    assert.ok(!findings[0].evidence.response.includes('hunter2XYZ'));
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
  });

  it('a Bearer token in /logs fires', async () => {
    const findings = await probeSensitiveDataInLogs(PAGE, [], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: BASELINE },
        [LOGS]: { status: 200, body: BEARER_LOG },
      }),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'sensitive_data_in_logs');
  });

  it('an AWS key in /error.log fires', async () => {
    const findings = await probeSensitiveDataInLogs(PAGE, [], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: BASELINE },
        [ERR_LOG]: { status: 200, body: AWS_LOG },
      }),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].title.includes('AWS access key'), true);
  });

  it('a private key in /debug.log fires', async () => {
    const findings = await probeSensitiveDataInLogs(PAGE, [], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: BASELINE },
        [DBG_LOG]: { status: 200, body: KEY_LOG },
      }),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].title.includes('private key'), true);
  });

  it('a card in /access.log fires', async () => {
    const findings = await probeSensitiveDataInLogs(PAGE, [], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: BASELINE },
        [ACC_LOG]: { status: 200, body: CARD_LOG },
      }),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].title.includes('credit-card'), true);
  });

  it('a value already on the baseline page fires nothing', async () => {
    const findings = await probeSensitiveDataInLogs(PAGE, [], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: `${BASELINE}<p>demo password hunter2XYZ</p>` },
        [APP_LOG]: { status: 200, body: PASSWORD_LOG },
      }),
    });
    assert.deepEqual(findings, []);
  });

  it('an HTML body on a log path fires nothing', async () => {
    const findings = await probeSensitiveDataInLogs(PAGE, [], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: BASELINE },
        [APP_LOG]: { status: 200, body: '<html><body><p>password=hunter2XYZ</p></body></html>' },
      }),
    });
    assert.deepEqual(findings, []);
  });

  it('a benign log fires nothing', async () => {
    const findings = await probeSensitiveDataInLogs(PAGE, [], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: BASELINE },
        [APP_LOG]: { status: 200, body: BENIGN_LOG },
      }),
    });
    assert.deepEqual(findings, []);
  });

  it('a body identical to the catch-all control fires nothing', async () => {
    const findings = await probeSensitiveDataInLogs(PAGE, [], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: BASELINE },
        'http://example.com/dm-nonexistent-7b31e9d2.txt': { status: 200, body: PASSWORD_LOG },
        [APP_LOG]: { status: 200, body: PASSWORD_LOG },
      }),
    });
    assert.deepEqual(findings, []);
  });

  it('the fetch budget is respected (baseline + catch-all + at most 10 candidate fetches)', async () => {
    const calls = [];
    const bodies = { [PAGE]: { status: 200, body: BASELINE } };
    for (const p of ['/logs', '/log', '/admin/logs', '/app.log', '/error.log', '/debug.log', '/access.log', '/logs/app.log', '/logs/error.log', '/logs/access.log']) {
      bodies[`http://example.com${p}`] = { status: 200, body: PASSWORD_LOG };
    }
    const findings = await probeSensitiveDataInLogs(PAGE, [], { fetchPage: fetchPageFor(bodies, calls) });
    assert.equal(calls.length, 12);
    assert.equal(findings.length, 10);
  });

  it('a non-200 log candidate fires nothing', async () => {
    const findings = await probeSensitiveDataInLogs(PAGE, [], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: BASELINE },
        [APP_LOG]: { status: 404, body: PASSWORD_LOG },
      }),
    });
    assert.deepEqual(findings, []);
  });

  it('the pasted page itself, when it IS a log file, fires', async () => {
    const findings = await probeSensitiveDataInLogs(APP_LOG, [], {
      fetchPage: fetchPageFor({
        [APP_LOG]: { status: 200, body: PASSWORD_LOG },
      }),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, APP_LOG);
  });

  it('a .js URL in the orchestrator list is never fetched', async () => {
    const calls = [];
    const findings = await probeSensitiveDataInLogs(PAGE, ['http://example.com/bundle.js', APP_LOG], {
      fetchPage: fetchPageFor(
        {
          [PAGE]: { status: 200, body: BASELINE },
          [APP_LOG]: { status: 200, body: BENIGN_LOG },
        },
        calls
      ),
    });
    assert.deepEqual(findings, []);
    assert.ok(!calls.some((c) => c.endsWith('/bundle.js')));
  });

  it('a throwing fetchPage never throws out of the probe', async () => {
    const findings = await probeSensitiveDataInLogs(PAGE, [], {
      fetchPage: async () => {
        throw new Error('network down');
      },
    });
    assert.deepEqual(findings, []);
  });
});
