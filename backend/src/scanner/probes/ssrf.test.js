// SSRF probe tests — Zerodha false-positive fix (9 Nov 2026).
//
// Hunt h_6b5942052353 (zerodha.com/varsity, WordPress + Cloudflare)
// confirmed a [Critical] SSRF whose only "proof" was the probe's own
// payload URL reflected in the page: the comment form echoed the
// request URL, which carries "meta-data" as a path segment, and the
// old bare-word matcher (/ami-id|instance-id|meta-data/) fired on
// it. No metadata body was ever returned.
//
// Rule under test: a finding confirms ONLY on content actually
// fetched from the metadata URL — a value-shaped marker (AMI /
// instance id value, IMDS credential JSON, role name) or the
// metadata listing itself (two or more listing fields as whole
// lines), after every reflection of the sent URL (raw and
// percent-encoded) is stripped from the response.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {
  probeSsrf,
  stripReflectedUrl,
  fetchedMetadataMarker,
  ssrfBlindCanaryUrl,
  assessBlindSsrf,
  alternateIpForms,
  assessFetchedContent,
  assessInternalFetch,
  assessSchemeTap,
  passwdMarker,
  schemeTapUrls,
  redirectorUrl,
  COLLAB_FRAGMENT_MARKER,
} from './ssrf.js';

const realFetch = globalThis.fetch;
test.after(() => {
  globalThis.fetch = realFetch;
});

const PAGE = 'https://zerodha.com/varsity/wp-comments-post.php?author=dmprobe1_0f82&email=dmprobe2_a399';
const SENT = `${PAGE}&url=http%3A%2F%2F169.254.169.254%2Flatest%2Fmeta-data%2F`;

// A fetch stub that echoes the requested URL the way the WordPress
// comment page did: the full request URL (percent-encoded) inside a
// hidden field, plus ordinary page text. No metadata body.
function reflectingFetch() {
  return async (url) => {
    const body =
      '<html><body><form>' +
      `<input type="hidden" name="redirect_to" value="${encodeURIComponent(String(url))}">` +
      '<p>Leave a comment below.</p>' +
      '</form></body></html>';
    return { status: 200, text: async () => body };
  };
}

test('SSRF-1: reflected payload URL (Zerodha FP) — no finding', async () => {
  globalThis.fetch = reflectingFetch();
  const findings = await probeSsrf(PAGE, ['url'], {});
  assert.equal(findings.length, 0, 'echoing the request URL is not fetch proof');
});

test('SSRF-2: raw reflected URL in the body — no finding', async () => {
  globalThis.fetch = async (url) => ({
    status: 200,
    text: async () => `<html><body><p>Fetched ${String(url)} for you.</p></body></html>`,
  });
  const findings = await probeSsrf(PAGE, ['url'], {});
  assert.equal(findings.length, 0);
});

test('SSRF-3: the word "meta-data" in page prose — no finding', async () => {
  globalThis.fetch = async () => ({
    status: 200,
    text: async () => '<html><body><p>Our docs explain the meta-data endpoint.</p></body></html>',
  });
  const findings = await probeSsrf(PAGE, ['url'], {});
  assert.equal(findings.length, 0);
});

test('SSRF-4: a single listing field alone — no finding', async () => {
  globalThis.fetch = async () => ({
    status: 200,
    text: async () => 'ami-id\n',
  });
  const findings = await probeSsrf(PAGE, ['url'], {});
  assert.equal(findings.length, 0, 'one field name is docs text, not a fetch');
});

test('SSRF-5: real metadata listing echoed — one critical finding', async () => {
  globalThis.fetch = async () => ({
    status: 200,
    text: async () =>
      'ami-id\nami-launch-index\nami-manifest-path\ninstance-id\ninstance-type\nlocal-ipv4\n',
  });
  const findings = await probeSsrf(PAGE, ['url'], {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'ssrf');
  assert.equal(findings[0].severity, 'critical');
  assert.equal(findings[0].evidence.oobHit, true);
});

test('SSRF-6: real AMI id value echoed — one critical finding', async () => {
  globalThis.fetch = async () => ({
    status: 200,
    text: async () => '<html><body><pre>ami-0a1b2c3d4e5f67890</pre></body></html>',
  });
  const findings = await probeSsrf(PAGE, ['url'], {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].evidence.oobHit, true);
});

test('SSRF-7: IMDS credential JSON echoed — one critical finding', async () => {
  globalThis.fetch = async () => ({
    status: 200,
    text: async () =>
      '{"Code":"Success","LastUpdated":"2026-11-09T00:00:00Z","Type":"AWS-HMAC",' +
      '"AccessKeyId":"ASIAIOSFODNN7EXAMPLE","SecretAccessKey":"wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",' +
      '"Token":"AQoDYXdzEJr...","Expiration":"2026-11-09T06:00:00Z"}',
  });
  const findings = await probeSsrf(PAGE, ['url'], {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].evidence.oobHit, true);
});

test('SSRF-8: stripReflectedUrl removes raw and encoded reflections', () => {
  const body = `before ${SENT} middle ${encodeURIComponent(SENT)} after`;
  const clean = stripReflectedUrl(body, SENT);
  assert.equal(clean.includes('meta-data'), false);
  assert.equal(clean, 'before  middle  after');
});

test('SSRF-9: fetchedMetadataMarker ignores a match inside the reflection', () => {
  const body = `<input value="${encodeURIComponent(SENT)}">`;
  assert.equal(fetchedMetadataMarker(body, SENT), null);
  const listing = 'ami-id\nami-launch-index\n';
  assert.ok(fetchedMetadataMarker(listing, SENT));
});

// ---- Blind SSRF leg (row #237 [High] + #311, same concept filed twice) ----
//
// The blind leg sends a collaborator canary URL as the param value and
// confirms ONLY on a collaborator hit for the probe token with no hit
// for a never-advertised control token (the ssrfReferer.js leg-1
// model). The tests drive the collaborator seam with a mock waiter:
// waitFor calls arrive probe-first, control-second, so the mock
// answers from an ordered hit list.
const LAB_PAGE = 'http://172.17.0.1:3100/fetch?url=x';
const LAB_TARGETS = '172.17.0.1';
const OOB_BASE = 'http://172.17.0.1:18099';

// A waiter mock: answers each waitFor call in order from `hits`
// (true = a hit arrived for that token, false = none).
function orderWaiter(hits) {
  let i = 0;
  return async (token, ms) => {
    const hit = hits[i++] === true;
    return hit ? { token, path: `/${token}`, method: 'GET', at: new Date().toISOString() } : null;
  };
}

// A fetch stub that records every requested URL and returns an empty
// body — the server returns nothing, so only the collaborator hit can
// confirm. The metadata leg therefore stays quiet in these tests.
function recordingFetch(seen) {
  return async (url) => {
    seen.push(String(url));
    return { status: 200, text: async () => '' };
  };
}

function blindOpts(seen, hits) {
  return {
    labTargets: LAB_TARGETS,
    oobCallback: OOB_BASE,
    oobWaitFor: orderWaiter(hits),
  };
}

test('SSRF-10: blind leg — probe hit, control silent — one high finding', async () => {
  const seen = [];
  globalThis.fetch = recordingFetch(seen);
  const findings = await probeSsrf(LAB_PAGE, ['url'], blindOpts(seen, [true, false]));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'ssrf_blind');
  assert.equal(findings[0].severity, 'high');
  assert.equal(findings[0].evidence.oobHit, true);
  // The probe canary went out as the param value.
  assert.ok(seen.some((u) => decodeURIComponent(u).includes(OOB_BASE)), 'canary URL was sent as the param value');
});

test('SSRF-11: blind leg — no probe hit — no finding', async () => {
  const seen = [];
  globalThis.fetch = recordingFetch(seen);
  const findings = await probeSsrf(LAB_PAGE, ['url'], blindOpts(seen, [false, false]));
  assert.equal(findings.length, 0, 'a fetch that never arrives is not a finding');
});

test('SSRF-12: blind leg — control token also hit — no finding', async () => {
  const seen = [];
  globalThis.fetch = recordingFetch(seen);
  const findings = await probeSsrf(LAB_PAGE, ['url'], blindOpts(seen, [true, true]));
  assert.equal(findings.length, 0, 'a hit for the never-advertised control means the listener is noisy, not a fetch');
});

test('SSRF-13: blind leg — non-lab target — no canary sent, no finding', async () => {
  const seen = [];
  globalThis.fetch = recordingFetch(seen);
  const findings = await probeSsrf(PAGE, ['url'], blindOpts(seen, [true, false]));
  assert.equal(findings.length, 0);
  assert.equal(seen.some((u) => decodeURIComponent(u).includes(OOB_BASE)), false, 'a non-lab target never receives a callback URL');
});

test('SSRF-14: blind leg — no collaborator in opts — leg skipped, metadata leg unaffected', async () => {
  const seen = [];
  globalThis.fetch = recordingFetch(seen);
  const findings = await probeSsrf(LAB_PAGE, ['url'], { labTargets: LAB_TARGETS });
  assert.equal(findings.length, 0, 'without the collaborator seam the leg is skipped, never guessed at');
  assert.equal(seen.some((u) => decodeURIComponent(u).includes(OOB_BASE)), false);
});

test('SSRF-15: blind leg — cap of 2 params (sqli-oob global-cap discipline)', async () => {
  const seen = [];
  globalThis.fetch = recordingFetch(seen);
  // Three URL-shaped params; both attempted params confirm.
  const findings = await probeSsrf(LAB_PAGE, ['url', 'src', 'next'], blindOpts(seen, [true, false, true, false]));
  assert.equal(findings.length, 2, 'only the first 2 params are attempted');
  const canaryUrls = seen.filter((u) => decodeURIComponent(u).includes(OOB_BASE));
  assert.equal(canaryUrls.length, 2, '2 probe canaries only — the control token is never sent, no third param');
});

test('SSRF-16: assessBlindSsrf — pure verdicts', () => {
  assert.equal(assessBlindSsrf({ probeHit: true, controlHit: false }).verdict, 'confirmed');
  assert.equal(assessBlindSsrf({ probeHit: false, controlHit: false }).verdict, 'rejected');
  assert.equal(assessBlindSsrf({ probeHit: true, controlHit: true }).verdict, 'rejected');
  assert.equal(assessBlindSsrf({ probeHit: false, controlHit: true }).verdict, 'rejected');
});

test('SSRF-17: ssrfBlindCanaryUrl — pure builder', () => {
  assert.equal(ssrfBlindCanaryUrl('http://172.17.0.1:18099/', 'dmssrf-abc'), 'http://172.17.0.1:18099/dmssrf-abc');
  assert.equal(ssrfBlindCanaryUrl('http://172.17.0.1:18099', 'dmssrf-abc'), 'http://172.17.0.1:18099/dmssrf-abc');
});

// ---- New legs (coverage rows #306/#308/#309/#310, Nov 2026) -----------------
// #306 internal-service probing, #308 redirect bypass, #309 alternate-IP
// forms, #310 non-HTTP schemes. Local mock servers only (loopback); no
// external service, no lab needed. The probe starts its own OOB
// collaborator / scheme tap per call (lab-gated); the stubs below play
// the vulnerable server-side fetcher.

const METADATA_LISTING = 'ami-id\nami-launch-index\nami-manifest-path\ninstance-id\ninstance-type\nlocal-ipv4\n';
const PASSWD_BODY = 'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\n';
const BENIGN_PAGE = '<html><body><p>hello, a plain page</p></body></html>';
const PAGE_URL = 'http://127.0.0.1:18080/fetch?url=https://example.com/';
const LAB_OPTS = {
  labTargets: ['127.0.0.1'],
  oobListenHost: '127.0.0.1',
  oobCallbackHost: '127.0.0.1',
  tapWaitMs: 1500,
  tapControlWaitMs: 300,
};

function mockServer(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` });
    });
  });
}
async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

// The stub pretends to be a vulnerable server-side fetcher: it reads the
// `url` param value and hands it to fetchImpl, returning whatever the
// fetch returns as the page body. `seen` records every param value sent.
function fetcherStub(fetchImpl, seen) {
  return async (url) => {
    const value = new URL(String(url)).searchParams.get('url') || '';
    if (seen) seen.push(value);
    const body = await fetchImpl(value, String(url));
    return { status: 200, text: async () => body };
  };
}

// Minimal raw-TCP client: connect, optionally wait for the greeting
// line, write `send`, wait briefly, close. Used to simulate a fetcher
// speaking gopher/dict/ftp to the scheme tap.
function tcpSend(host, port, send, waitForGreeting) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host, port });
    let done = false;
    const finish = (err) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch { /* ignore */ }
      if (err) reject(err);
      else resolve();
    };
    const timer = setTimeout(() => finish(), 800);
    sock.on('connect', () => {
      if (!waitForGreeting) {
        if (send) sock.write(send);
        return;
      }
      // FTP waits for the 220 greeting before USER.
      sock.once('data', () => {
        if (send) sock.write(send);
      });
    });
    sock.on('error', (e) => {
      clearTimeout(timer);
      finish(e);
    });
    sock.on('close', () => {
      clearTimeout(timer);
      finish();
    });
  });
}

// ---- #306 — internal-service probing --------------------------------------

test('SSRF-18: #306 internal canary body echoed — one high finding', async () => {
  globalThis.fetch = fetcherStub(async (value) => {
    // The vulnerable fetcher fetches the internal canary URL and echoes it.
    if (value.includes('/dmssrf-')) return (await realFetch(value)).text();
    return BENIGN_PAGE;
  });
  const findings = await probeSsrf(PAGE_URL, ['url'], { ...LAB_OPTS });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'ssrf_internal');
  assert.equal(findings[0].severity, 'high');
  assert.equal(findings[0].evidence.oobHit, true);
});

test('SSRF-19: #306 canary URL reflected but never fetched — no finding', async () => {
  globalThis.fetch = fetcherStub(async (value) => `<p>you asked for ${value}</p>`);
  const findings = await probeSsrf(PAGE_URL, ['url'], { ...LAB_OPTS });
  assert.equal(findings.length, 0, 'echoing the canary URL is not fetch proof');
});

test('SSRF-20: #306 benign control also returns the fragment — no finding', async () => {
  globalThis.fetch = fetcherStub(async (value) => {
    if (value.includes('/dmssrf-')) return (await realFetch(value)).text();
    // The benign control fetch ALSO returns the collaborator fragment:
    // the marker is not correlated with the internal fetch.
    return `<!ENTITY ${COLLAB_FRAGMENT_MARKER} "1">`;
  });
  const findings = await probeSsrf(PAGE_URL, ['url'], { ...LAB_OPTS });
  assert.equal(findings.length, 0);
});

test('SSRF-21: #306 non-lab target — internal legs never sent, no finding', async () => {
  const seen = [];
  globalThis.fetch = fetcherStub(async (value) => {
    if (value.includes('/dmssrf-')) return (await realFetch(value)).text();
    return BENIGN_PAGE;
  }, seen);
  const findings = await probeSsrf(PAGE_URL, ['url'], { labTargets: [] });
  assert.equal(findings.length, 0);
  assert.equal(seen.some((v) => v.includes('/dmssrf-')), false, 'canary must never be sent to a non-lab target');
  assert.equal(seen.some((v) => v.includes('/redir/')), false, 'redirector must never be sent to a non-lab target');
});

// ---- #308 — redirect bypass -----------------------------------------------

test('SSRF-22: #308 redirect to mock metadata — one high finding', async () => {
  const { server, base } = await mockServer((req, res) => {
    if (req.url === '/latest/meta-data/') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(METADATA_LISTING);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(BENIGN_PAGE);
    }
  });
  try {
    globalThis.fetch = fetcherStub(async (value) => {
      // The fetcher follows the redirector URL and echoes what it fetched.
      if (value.includes('/redir/')) return (await realFetch(value)).text();
      return BENIGN_PAGE;
    });
    const findings = await probeSsrf(PAGE_URL, ['url'], {
      ...LAB_OPTS,
      redirectTarget: `${base}/latest/meta-data/`,
      redirectBenignTarget: `${base}/benign`,
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'ssrf_redirect');
    assert.equal(findings[0].severity, 'high');
    assert.equal(findings[0].evidence.oobHit, true);
  } finally {
    await closeServer(server);
  }
});

test('SSRF-23: #308 redirect to a benign page — no finding', async () => {
  const { server, base } = await mockServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(BENIGN_PAGE);
  });
  try {
    globalThis.fetch = fetcherStub(async (value) => {
      if (value.includes('/redir/')) return (await realFetch(value)).text();
      return BENIGN_PAGE;
    });
    const findings = await probeSsrf(PAGE_URL, ['url'], {
      ...LAB_OPTS,
      redirectTarget: `${base}/benign`,
      redirectBenignTarget: `${base}/benign`,
    });
    assert.equal(findings.length, 0);
  } finally {
    await closeServer(server);
  }
});

test('SSRF-24: #308 redirector URL reflected but never followed — no finding', async () => {
  globalThis.fetch = fetcherStub(async (value) => `<p>you asked for ${value}</p>`);
  const findings = await probeSsrf(PAGE_URL, ['url'], { ...LAB_OPTS });
  assert.equal(findings.length, 0);
});

// ---- #309 — alternate IP forms --------------------------------------------

const ALT_FORM_MARKERS = ['0xA9', '2852039166', '0251.0376', '::ffff:'];
// The percent-encoded form double-encodes in the query string, so it
// is detected on the raw URL, not the decoded value.
const PCT_FORM_RAW_MARKER = '%2531%2536%2539';
function isAltFormValue(value, rawUrl) {
  return (
    ALT_FORM_MARKERS.some((m) => value.includes(m)) || String(rawUrl || '').includes(PCT_FORM_RAW_MARKER)
  );
}

test('SSRF-25: #309 every alternate IMDS form returns metadata — six findings', async () => {
  globalThis.fetch = fetcherStub(async (value, rawUrl) => {
    if (isAltFormValue(value, rawUrl)) return METADATA_LISTING;
    return BENIGN_PAGE;
  });
  const findings = await probeSsrf(PAGE_URL, ['url'], {});
  const alt = findings.filter((f) => f.class === 'ssrf_alt_ip');
  assert.equal(alt.length, 6, `expected 6 alt-IP findings, got ${JSON.stringify(findings.map((f) => f.id))}`);
  assert.equal(new Set(alt.map((f) => f.id)).size, 6, 'each form has a distinct id');
  assert.ok(alt.every((f) => f.severity === 'high' && f.evidence.oobHit === true));
  assert.equal(findings.length, 6, 'no other leg fires on this stub');
});

test('SSRF-26: #309 alternate-form URLs reflected only — no finding', async () => {
  globalThis.fetch = fetcherStub(async (value) => `<p>you asked for ${value}</p>`);
  const findings = await probeSsrf(PAGE_URL, ['url'], {});
  assert.equal(findings.length, 0);
});

test('SSRF-27: #309 benign control also returns metadata — no finding', async () => {
  globalThis.fetch = fetcherStub(async (value, rawUrl) => {
    if (value === 'https://example.com/') return METADATA_LISTING;
    if (isAltFormValue(value, rawUrl)) return METADATA_LISTING;
    return BENIGN_PAGE;
  });
  const findings = await probeSsrf(PAGE_URL, ['url'], {});
  assert.equal(findings.length, 0, 'a metadata leak on the benign control is not a form bypass');
});

// ---- #310 — non-HTTP schemes: file:// --------------------------------------

test('SSRF-28: #310 file:///etc/passwd content echoed — one high finding', async () => {
  globalThis.fetch = fetcherStub(async (value) => {
    if (value === 'file:///etc/passwd') return PASSWD_BODY;
    if (value === 'file:///etc/hostname') return 'labhost\n';
    return BENIGN_PAGE;
  });
  const findings = await probeSsrf(PAGE_URL, ['url'], {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'ssrf_file');
  assert.equal(findings[0].severity, 'high');
  assert.equal(findings[0].evidence.oobHit, true);
});

test('SSRF-29: #310 file:// URL reflected but never read — no finding', async () => {
  globalThis.fetch = fetcherStub(async (value) => `<p>you asked for ${value}</p>`);
  const findings = await probeSsrf(PAGE_URL, ['url'], {});
  assert.equal(findings.length, 0);
});

test('SSRF-30: #310 benign file control also returns passwd content — no finding', async () => {
  globalThis.fetch = fetcherStub(async (value) => {
    if (value === 'file:///etc/passwd') return PASSWD_BODY;
    if (value === 'file:///etc/hostname') return PASSWD_BODY;
    return BENIGN_PAGE;
  });
  const findings = await probeSsrf(PAGE_URL, ['url'], {});
  assert.equal(findings.length, 0);
});

// ---- #310 — non-HTTP schemes: gopher / dict / ftp (scheme tap) -------------

test('SSRF-31: #310 gopher tap hit — one high finding', async () => {
  globalThis.fetch = fetcherStub(async (value) => {
    if (value.startsWith('gopher://')) {
      const u = new URL(value);
      await tcpSend(u.hostname, Number(u.port), `${u.pathname.replace(/^\//, '')}\r\n`, false);
    }
    return BENIGN_PAGE;
  });
  const findings = await probeSsrf(PAGE_URL, ['url'], { ...LAB_OPTS });
  const tap = findings.filter((f) => f.class === 'ssrf_gopher');
  assert.equal(tap.length, 1);
  assert.equal(tap[0].severity, 'high');
  assert.equal(tap[0].evidence.oobHit, true);
  assert.equal(findings.length, 1, 'only the gopher leg fires on this stub');
});

test('SSRF-32: #310 dict tap hit — one high finding', async () => {
  globalThis.fetch = fetcherStub(async (value) => {
    if (value.startsWith('dict://')) {
      const u = new URL(value);
      const word = u.pathname.replace(/^\/d:/, '');
      await tcpSend(u.hostname, Number(u.port), `CLIENT dm-test\r\nDEFINE * ${word}\r\n`, false);
    }
    return BENIGN_PAGE;
  });
  const findings = await probeSsrf(PAGE_URL, ['url'], { ...LAB_OPTS });
  const tap = findings.filter((f) => f.class === 'ssrf_dict');
  assert.equal(tap.length, 1);
  assert.equal(tap[0].severity, 'high');
  assert.equal(tap[0].evidence.oobHit, true);
  assert.equal(findings.length, 1, 'only the dict leg fires on this stub');
});

test('SSRF-33: #310 ftp tap hit (greeting, then USER) — one high finding', async () => {
  globalThis.fetch = fetcherStub(async (value) => {
    if (value.startsWith('ftp://')) {
      const u = new URL(value);
      await tcpSend(u.hostname, Number(u.port), `USER ${u.username}\r\nPASS x\r\n`, true);
    }
    return BENIGN_PAGE;
  });
  const findings = await probeSsrf(PAGE_URL, ['url'], { ...LAB_OPTS });
  const tap = findings.filter((f) => f.class === 'ssrf_ftp');
  assert.equal(tap.length, 1);
  assert.equal(tap[0].severity, 'high');
  assert.equal(tap[0].evidence.oobHit, true);
  assert.equal(findings.length, 1, 'only the ftp leg fires on this stub');
});

test('SSRF-34: #310 tap legs on a non-lab target — never sent, no finding', async () => {
  const seen = [];
  globalThis.fetch = fetcherStub(async () => BENIGN_PAGE, seen);
  const findings = await probeSsrf(PAGE_URL, ['url'], { labTargets: [] });
  assert.equal(findings.length, 0);
  assert.equal(seen.some((v) => /^(gopher|dict|ftp):\/\//.test(v)), false, 'no non-HTTP URL may be sent to a non-lab target');
});

// ---- pure helpers -----------------------------------------------------------

test('SSRF-35: alternateIpForms covers hex, decimal, octal and IPv6', () => {
  const forms = alternateIpForms();
  const byName = Object.fromEntries(forms.map((f) => [f.name, f.url]));
  assert.equal(forms.length, 6);
  assert.equal(byName.hex, 'http://0xA9.0xFE.0xA9.0xFE/latest/meta-data/');
  assert.equal(byName.decimal, 'http://2852039166/latest/meta-data/');
  assert.equal(byName.octal, 'http://0251.0376.0251.0376/latest/meta-data/');
  assert.equal(byName['ipv6-hex'], 'http://[::ffff:a9fe:a9fe]/latest/meta-data/');
  assert.equal(byName['ipv6-dotted'], 'http://[::ffff:169.254.169.254]/latest/meta-data/');
  assert.equal(byName['pct-encoded'], 'http://%31%36%39.254.169.254/latest/meta-data/');
});

test('SSRF-36: assessFetchedContent judges probe-vs-benign', () => {
  assert.equal(assessFetchedContent({ probeMarker: 'ami-0a1b2c3d', benignMarker: null }).verdict, 'confirmed');
  assert.equal(assessFetchedContent({ probeMarker: null, benignMarker: null }).verdict, 'rejected');
  assert.equal(assessFetchedContent({ probeMarker: 'ami-0a1b2c3d', benignMarker: 'ami-0a1b2c3d' }).verdict, 'rejected');
});

test('SSRF-37: assessInternalFetch judges fragment-vs-benign', () => {
  assert.equal(assessInternalFetch({ probeHasFragment: true, benignHasFragment: false }).verdict, 'confirmed');
  assert.equal(assessInternalFetch({ probeHasFragment: false, benignHasFragment: false }).verdict, 'rejected');
  assert.equal(assessInternalFetch({ probeHasFragment: true, benignHasFragment: true }).verdict, 'rejected');
});

test('SSRF-38: assessSchemeTap judges probe-vs-control hits', () => {
  assert.equal(assessSchemeTap({ probeHit: true, controlHit: false }).verdict, 'confirmed');
  assert.equal(assessSchemeTap({ probeHit: false, controlHit: false }).verdict, 'rejected');
  assert.equal(assessSchemeTap({ probeHit: true, controlHit: true }).verdict, 'rejected');
});

test('SSRF-39: passwdMarker finds the root line only', () => {
  assert.ok(passwdMarker(PASSWD_BODY, 'file:///etc/passwd'));
  assert.equal(passwdMarker(PASSWD_BODY, 'file:///etc/passwd').marker, 'root:x:0:0:');
  assert.equal(passwdMarker('labhost\n', 'file:///etc/hostname'), null);
  assert.equal(passwdMarker('<p>you asked for file:///etc/passwd</p>', 'file:///etc/passwd'), null);
});

test('SSRF-40: schemeTapUrls and redirectorUrl build exact URLs', () => {
  const urls = schemeTapUrls('172.17.0.1:45678', 'dmssrf-gopher-abc123');
  assert.equal(urls.gopher, 'gopher://172.17.0.1:45678/dmssrf-gopher-abc123');
  assert.equal(urls.dict, 'dict://172.17.0.1:45678/d:dmssrf-gopher-abc123');
  assert.equal(urls.ftp, 'ftp://dmssrf-gopher-abc123@172.17.0.1:45678/');
  assert.equal(
    redirectorUrl('http://172.17.0.1:45678', 'http://169.254.169.254/latest/meta-data/'),
    'http://172.17.0.1:45678/redir/http%3A%2F%2F169.254.169.254%2Flatest%2Fmeta-data%2F'
  );
});

// --- SSRF via URL parser differentials (coverage row #469) -----------------
// The mock below is a lab target with a VALIDATOR + FETCHER pair — the
// exact differential the legs target:
//   - validator: a naive literal-host blocklist. It extracts the host
//     with a plain regex (^https?://([^/:?#@]+)) and blocks only exact
//     literals (169.254.169.254, localhost, 127.0.0.1,
//     metadata.google.internal). It does NOT normalize: hex/decimal/
//     octal IPs, trailing dots, unicode dots, tabs and userinfo all
//     pass it. A validator that normalizes (WHATWG parse + IP
//     canonicalization) is NOT bypassed by these payloads — that is
//     the honest limit, documented in ssrf.js and docs/scanner/ssrf.md.
//   - fetcher: WHATWG `new URL()` + a metadata listing stub served iff
//     the parsed hostname is 169.254.169.254. The listing satisfies
//     fetchedMetadataMarker (two or more whole-line listing fields).
// NOTE: the SSRF-1..9 tests above replace globalThis.fetch with stubs.
// Every differential test below resets it to the real fetch first so
// the mock server receives real HTTP requests.
const CONTROL_469 = 'http://169.254.169.254/latest/meta-data/';
const LISTING_469 = 'ami-id\nami-launch-index\nami-manifest-path\ninstance-id\ninstance-type\nlocal-ipv4\n';

// Every payload the legs try. Each MUST parse to the metadata host
// under WHATWG URL (verified empirically on Node 24) while evading
// the mock validator's literal-host blocklist.
const PAYLOADS_469 = {
  'alt-ip': [
    'http://0xA9FEA9FE/latest/meta-data/',
    'http://0xA9.0xFE.0xA9.0xFE/latest/meta-data/',
    'http://2852039166/latest/meta-data/',
    'http://0251.0376.0251.0376/latest/meta-data/',
  ],
  userinfo: [
    'http://trusted.example@169.254.169.254/latest/meta-data/',
    'http://trusted.example:80@169.254.169.254/latest/meta-data/',
  ],
  'host-normalization': [
    'http://169.254.169.254./latest/meta-data/',
    'http://169。254。169。254/latest/meta-data/',
    'http://169.254.169.254%E3%80%82/latest/meta-data/',
  ],
  'whitespace-trim': [
    'http://169.254.169.254\t/latest/meta-data/',
    'http://169.254\t.169.254/latest/meta-data/',
  ],
};

function startMock469({ open = false, dead = false, flaky = false, extraBlocked = [] } = {}) {
  const hits = [];
  const blocked = new Set(
    ['169.254.169.254', 'localhost', '127.0.0.1', 'metadata.google.internal']
      .concat(extraBlocked.map((s) => String(s).toLowerCase()))
  );
  const perPayloadHits = new Map();
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname !== '/fetch') {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const raw = u.searchParams.get('url') ?? '';
    hits.push(raw);
    const count = (perPayloadHits.get(raw) || 0) + 1;
    perPayloadHits.set(raw, count);
    // Naive validator: plain-regex host[:port] extraction (it does not
    // strip the port before the blocklist comparison), exact-literal
    // blocklist. `trusted.example:80@...` therefore extracts as
    // `trusted.example:80`, which is not the blocked literal
    // `trusted.example` — the port-confusion differential.
    const m = raw.match(/^https?:\/\/([^/?#@]+)/);
    const host = m ? m[1].toLowerCase() : null;
    if (!open && (!host || blocked.has(host))) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('blocked: private host');
      return;
    }
    // Fetcher: WHATWG parse; metadata listing iff the parsed host is internal.
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      res.writeHead(400);
      res.end('invalid url');
      return;
    }
    const internal = parsed.hostname === '169.254.169.254';
    // Flaky mode: listing on the FIRST hit for a payload only, never on
    // the repeat — the repeat gate must reject every family.
    const showMarker = !dead && internal && (!flaky || count === 1);
    if (showMarker) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(LISTING_469);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`fetched external host: ${parsed.hostname}`);
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port, hits });
    });
  });
}

async function withMock469(opts, fn) {
  const mock = await startMock469(opts);
  try {
    return await fn(mock);
  } finally {
    await new Promise((resolve) => mock.server.close(resolve));
  }
}

const diffs469 = (findings) => findings.filter((f) => f.class === 'ssrf_parser_differential');

test('SSRF-469-1: differential payloads all parse to the metadata host under WHATWG', () => {
  for (const [family, list] of Object.entries(PAYLOADS_469)) {
    assert.ok(list.length > 0, `${family} has payloads`);
    for (const p of list) {
      assert.equal(new URL(p).hostname, '169.254.169.254', `${family}: ${JSON.stringify(p)}`);
    }
  }
});

test('SSRF-469-2: alt-ip family confirms via hex (probe + repeat)', async () => {
  globalThis.fetch = realFetch;
  await withMock469({}, async ({ port, hits }) => {
    const findings = await probeSsrf(`http://127.0.0.1:${port}/fetch`, ['url'], { allowWrite: true });
    const found = diffs469(findings);
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'high');
    assert.equal(found[0].evidence.variant, 'alt-ip');
    assert.equal(found[0].evidence.coverageRow, 469);
    assert.ok(found[0].evidence.request.includes('0xA9FEA9FE'));
    // Probe + repeat: the confirming payload was sent at least twice.
    const hexHits = hits.filter((h) => h === PAYLOADS_469['alt-ip'][0]).length;
    assert.ok(hexHits >= 2, `hex payload hit ${hexHits}x, expected >= 2`);
  });
});

test('SSRF-469-3: alt-ip falls back to hex-quad when hex-single is blocked', async () => {
  globalThis.fetch = realFetch;
  await withMock469({ extraBlocked: ['0xa9fea9fe'] }, async ({ port, hits }) => {
    const findings = await probeSsrf(`http://127.0.0.1:${port}/fetch`, ['url'], { allowWrite: true });
    const found = diffs469(findings);
    assert.equal(found.length, 1);
    assert.equal(found[0].evidence.variant, 'alt-ip');
    const quadHits = hits.filter((h) => h === PAYLOADS_469['alt-ip'][1]).length;
    assert.ok(quadHits >= 2, `hex-quad payload hit ${quadHits}x, expected >= 2`);
  });
});

// Validator-side host forms (what the mock's naive regex extracts) for
// each family, used to block EARLIER families so a later family is the
// one that confirms. The legs try families in order and stop at the
// first confirming family (one finding per parameter), so a test for a
// later family must neutralize every earlier family first.
const ALT_IP_HOSTS_469 = ['0xa9fea9fe', '0xa9.0xfe.0xa9.0xfe', '2852039166', '0251.0376.0251.0376'];
const USERINFO_HOSTS_469 = ['trusted.example', 'trusted.example:80'];
const HOSTNORM_HOSTS_469 = ['169.254.169.254.', '169。254。169。254', '169.254.169.254%e3%80%82'];

test('SSRF-469-4: userinfo family confirms via trusted.example@', async () => {
  globalThis.fetch = realFetch;
  await withMock469({ extraBlocked: ALT_IP_HOSTS_469 }, async ({ port, hits }) => {
    const findings = await probeSsrf(`http://127.0.0.1:${port}/fetch`, ['url'], { allowWrite: true });
    const found = diffs469(findings);
    assert.equal(found.length, 1);
    assert.equal(found[0].evidence.variant, 'userinfo');
    const atHits = hits.filter((h) => h === PAYLOADS_469.userinfo[0]).length;
    assert.ok(atHits >= 2, `userinfo payload hit ${atHits}x, expected >= 2`);
  });
});

test('SSRF-469-5: userinfo falls back to :80@ when trusted.example is blocked', async () => {
  globalThis.fetch = realFetch;
  await withMock469({ extraBlocked: [...ALT_IP_HOSTS_469, 'trusted.example'] }, async ({ port, hits }) => {
    const findings = await probeSsrf(`http://127.0.0.1:${port}/fetch`, ['url'], { allowWrite: true });
    const found = diffs469(findings);
    assert.equal(found.length, 1);
    assert.equal(found[0].evidence.variant, 'userinfo');
    const portHits = hits.filter((h) => h === PAYLOADS_469.userinfo[1]).length;
    assert.ok(portHits >= 2, `:80@ payload hit ${portHits}x, expected >= 2`);
  });
});

test('SSRF-469-6: host-normalization confirms via trailing dot', async () => {
  globalThis.fetch = realFetch;
  await withMock469({ extraBlocked: [...ALT_IP_HOSTS_469, ...USERINFO_HOSTS_469] }, async ({ port, hits }) => {
    const findings = await probeSsrf(`http://127.0.0.1:${port}/fetch`, ['url'], { allowWrite: true });
    const found = diffs469(findings);
    assert.equal(found.length, 1);
    assert.equal(found[0].evidence.variant, 'host-normalization');
    const dotHits = hits.filter((h) => h === PAYLOADS_469['host-normalization'][0]).length;
    assert.ok(dotHits >= 2, `trailing-dot payload hit ${dotHits}x, expected >= 2`);
  });
});

test('SSRF-469-7: host-normalization falls back to U+3002 when trailing dot is blocked', async () => {
  globalThis.fetch = realFetch;
  await withMock469({ extraBlocked: [...ALT_IP_HOSTS_469, ...USERINFO_HOSTS_469, '169.254.169.254.'] }, async ({ port, hits }) => {
    const findings = await probeSsrf(`http://127.0.0.1:${port}/fetch`, ['url'], { allowWrite: true });
    const found = diffs469(findings);
    assert.equal(found.length, 1);
    assert.equal(found[0].evidence.variant, 'host-normalization');
    const uniHits = hits.filter((h) => h === PAYLOADS_469['host-normalization'][1]).length;
    assert.ok(uniHits >= 2, `U+3002 payload hit ${uniHits}x, expected >= 2`);
  });
});

test('SSRF-469-8: whitespace-trim confirms via trailing tab', async () => {
  globalThis.fetch = realFetch;
  await withMock469({ extraBlocked: [...ALT_IP_HOSTS_469, ...USERINFO_HOSTS_469, ...HOSTNORM_HOSTS_469] }, async ({ port, hits }) => {
    const findings = await probeSsrf(`http://127.0.0.1:${port}/fetch`, ['url'], { allowWrite: true });
    const found = diffs469(findings);
    assert.equal(found.length, 1);
    assert.equal(found[0].evidence.variant, 'whitespace-trim');
    const tabHits = hits.filter((h) => h === PAYLOADS_469['whitespace-trim'][0]).length;
    assert.ok(tabHits >= 2, `trailing-tab payload hit ${tabHits}x, expected >= 2`);
  });
});

test('SSRF-469-9: whitespace-trim falls back to mid-host tab when trailing tab is blocked', async () => {
  globalThis.fetch = realFetch;
  await withMock469({ extraBlocked: [...ALT_IP_HOSTS_469, ...USERINFO_HOSTS_469, ...HOSTNORM_HOSTS_469, '169.254.169.254\t'] }, async ({ port, hits }) => {
    const findings = await probeSsrf(`http://127.0.0.1:${port}/fetch`, ['url'], { allowWrite: true });
    const found = diffs469(findings);
    assert.equal(found.length, 1);
    assert.equal(found[0].evidence.variant, 'whitespace-trim');
    const midHits = hits.filter((h) => h === PAYLOADS_469['whitespace-trim'][1]).length;
    assert.ok(midHits >= 2, `mid-host-tab payload hit ${midHits}x, expected >= 2`);
  });
});

test('SSRF-469-10: repeat gate — markers on first hit only never confirm', async () => {
  globalThis.fetch = realFetch;
  await withMock469({ flaky: true }, async ({ port }) => {
    const findings = await probeSsrf(`http://127.0.0.1:${port}/fetch`, ['url'], { allowWrite: true });
    assert.equal(diffs469(findings).length, 0, 'flaky single-hit markers must not confirm');
  });
});

test('SSRF-469-11: lab gate — without allowWrite the differential legs send nothing', async () => {
  globalThis.fetch = realFetch;
  await withMock469({}, async ({ port, hits }) => {
    const findings = await probeSsrf(`http://127.0.0.1:${port}/fetch`, ['url'], {});
    assert.equal(diffs469(findings).length, 0);
    // Without allowWrite no #469 payload may arrive. The merged probe's
    // non-gated legs still send their own requests (plain metadata leg,
    // #309 alternate-IP forms, #310 file://) — and the #309 forms share
    // the alt-ip payloads, so this gate is checked on the families only
    // #469 sends: userinfo, host-normalization, whitespace-trim.
    const gated469 = [
      ...PAYLOADS_469['userinfo'],
      ...PAYLOADS_469['host-normalization'],
      ...PAYLOADS_469['whitespace-trim'],
    ];
    assert.ok(hits.every((h) => !gated469.includes(h)), 'no differential payload without allowWrite');
    assert.ok(hits.includes(CONTROL_469), 'plain metadata leg still sends its control');
  });
});

test('SSRF-469-12: control already open — no differential finding (plain leg covers it)', async () => {
  globalThis.fetch = realFetch;
  await withMock469({ open: true }, async ({ port }) => {
    const findings = await probeSsrf(`http://127.0.0.1:${port}/fetch`, ['url'], { allowWrite: true });
    assert.equal(diffs469(findings).length, 0, 'open validator => differential is meaningless');
    assert.ok(findings.some((f) => f.class === 'ssrf'), 'plain metadata leg still fires');
  });
});

test('SSRF-469-13: dead fetcher — no markers anywhere, no findings', async () => {
  globalThis.fetch = realFetch;
  await withMock469({ dead: true }, async ({ port }) => {
    const findings = await probeSsrf(`http://127.0.0.1:${port}/fetch`, ['url'], { allowWrite: true });
    assert.equal(diffs469(findings).length, 0);
  });
});
