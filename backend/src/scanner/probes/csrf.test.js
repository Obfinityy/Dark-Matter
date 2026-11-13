// CSRF probe tests (coverage row #407 [Medium] SameSite / referer-only
// defense gaps; phase 'csrf').
//
// Leg S (static, pure): a token-less POST form whose session cookie
// carries SameSite=Lax/Strict is flagged as csrf_samesite_only — the
// site's ONLY CSRF defense is the cookie attribute, not a token.
// A token-less form with no SameSite protection keeps the existing
// csrf-missing-token finding (unchanged behaviour).
//
// Leg R (live differential): a token-less POST form with NO SameSite
// protection is submitted twice — once with a same-origin Referer
// (control) and once with a cross-site Referer — through
// rawHeaderFetch (node:http.request, transmits Referer verbatim).
// A finding fires ONLY when the control is accepted, the cross-site
// Referer is refused, and the refusal reproduces on a repeat.
// The tests run the full differential against a real local
// node:http listener with NO injected fetchFn, so the default
// transport is proven to transmit the Referer verbatim end to end.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  probeCsrf,
  fetchSessionSameSite,
  probeCsrfRefererOnly,
  assessRefererResponse,
} from './csrf.js';
import { getSessionCookieSameSite } from './cookies.js';
import { verifyFindings } from '../verifier.js';

const TOKENLESS = {
  action: 'https://example.com/change',
  method: 'post',
  inputs: [{ name: 'email', type: 'text', value: '' }],
};
const WITH_TOKEN = {
  action: 'https://example.com/change',
  method: 'post',
  inputs: [
    { name: 'email', type: 'text', value: '' },
    { name: 'csrf_token', type: 'hidden', value: 'tok' },
  ],
};
const LAX_SESSION = { name: 'PHPSESSID', sameSite: 'lax' };
const STRICT_SESSION = { name: 'sessionid', sameSite: 'strict' };
const NONE_SESSION = { name: 'PHPSESSID', sameSite: 'none' };

describe('probeCsrf (existing behaviour, unchanged)', () => {
  it('flags POST forms without a token field', () => {
    const findings = probeCsrf([TOKENLESS], 'https://example.com/');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'csrf');
    assert.ok(findings[0].evidence.signalCorrelated);
  });
  it('passes forms that carry a token', () => {
    assert.equal(probeCsrf([WITH_TOKEN], 'https://example.com/').length, 0);
  });
  it('ignores GET forms', () => {
    const findings = probeCsrf(
      [{ action: 'https://example.com/search', method: 'get', inputs: [{ name: 'q', type: 'text', value: '' }] }],
      'https://example.com/'
    );
    assert.equal(findings.length, 0);
  });
});

describe('probeCsrf — Leg S: SameSite-only defense (#407)', () => {
  it('flags SameSite=Lax as csrf_samesite_only, not csrf-missing-token', () => {
    const findings = probeCsrf([TOKENLESS], 'https://example.com/', { sessionSameSite: LAX_SESSION });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'csrf_samesite_only');
    assert.equal(findings[0].severity, 'medium');
    assert.ok(findings[0].title.includes('SameSite'));
    assert.ok(findings[0].evidence.response.includes('PHPSESSID'));
    assert.ok(findings[0].evidence.response.includes('Lax'));
    assert.ok(findings[0].evidence.signalCorrelated);
  });
  it('flags SameSite=Strict the same way', () => {
    const findings = probeCsrf([TOKENLESS], 'https://example.com/', { sessionSameSite: STRICT_SESSION });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'csrf_samesite_only');
    assert.ok(findings[0].evidence.response.includes('Strict'));
  });
  it('keeps csrf-missing-token when SameSite=None (no protection)', () => {
    const findings = probeCsrf([TOKENLESS], 'https://example.com/', { sessionSameSite: NONE_SESSION });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'csrf');
  });
  it('keeps csrf-missing-token when there is no session cookie', () => {
    const findings = probeCsrf([TOKENLESS], 'https://example.com/', { sessionSameSite: null });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'csrf');
  });
  it('stays quiet when a token is present even with SameSite=Lax', () => {
    const findings = probeCsrf([WITH_TOKEN], 'https://example.com/', { sessionSameSite: LAX_SESSION });
    assert.equal(findings.length, 0);
  });
  it('emits one finding per token-less form, each SameSite-only', () => {
    const second = { ...TOKENLESS, action: 'https://example.com/delete' };
    const findings = probeCsrf([TOKENLESS, second], 'https://example.com/', { sessionSameSite: LAX_SESSION });
    assert.equal(findings.length, 2);
    assert.ok(findings.every((f) => f.class === 'csrf_samesite_only'));
    assert.notEqual(findings[0].id, findings[1].id);
  });
  it('passes the verifier evidence gate', () => {
    const findings = probeCsrf([TOKENLESS], 'https://example.com/', { sessionSameSite: LAX_SESSION });
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length + unconfirmed.length, 1);
  });
});

describe('getSessionCookieSameSite (cookies.js)', () => {
  it('picks the session cookie SameSite out of several Set-Cookie values', () => {
    const out = getSessionCookieSameSite([
      'prefs=dark; Path=/; SameSite=Strict',
      'PHPSESSID=abc123; Path=/; HttpOnly; SameSite=Lax',
      'tracking=1; Path=/',
    ]);
    assert.deepEqual(out, { name: 'PHPSESSID', sameSite: 'lax' });
  });
  it('returns null when no session-like cookie exists', () => {
    assert.equal(getSessionCookieSameSite(['prefs=dark; Path=/; SameSite=Strict']), null);
    assert.equal(getSessionCookieSameSite([]), null);
  });
  it('returns null when the session cookie has no SameSite', () => {
    assert.equal(getSessionCookieSameSite(['PHPSESSID=abc123; Path=/; HttpOnly']), null);
  });
  it('reports SameSite=None explicitly', () => {
    assert.deepEqual(getSessionCookieSameSite(['sid=x; Path=/; Secure; SameSite=None']), {
      name: 'sid',
      sameSite: 'none',
    });
  });
  it('parses case-insensitively and tolerates spacing', () => {
    assert.deepEqual(getSessionCookieSameSite(['AuthToken=abc; samesite = STRICT']), {
      name: 'AuthToken',
      sameSite: 'strict',
    });
  });
});

describe('fetchSessionSameSite', () => {
  it('reads SameSite via getSetCookie when available', async () => {
    const fetchFn = async () => ({
      headers: {
        getSetCookie: () => ['PHPSESSID=abc; Path=/; SameSite=Lax'],
        get: () => null,
      },
      text: async () => '',
    });
    assert.deepEqual(await fetchSessionSameSite('https://example.com/', { fetchFn }), {
      name: 'PHPSESSID',
      sameSite: 'lax',
    });
  });
  it('falls back to the raw set-cookie header', async () => {
    const fetchFn = async () => ({
      headers: {
        get: (name) => (name.toLowerCase() === 'set-cookie' ? 'sessionid=z; Path=/; SameSite=Strict' : null),
      },
      text: async () => '',
    });
    assert.deepEqual(await fetchSessionSameSite('https://example.com/', { fetchFn }), {
      name: 'sessionid',
      sameSite: 'strict',
    });
  });
  it('returns null when the fetch fails', async () => {
    const fetchFn = async () => {
      throw new Error('boom');
    };
    assert.equal(await fetchSessionSameSite('https://example.com/', { fetchFn }), null);
  });
});

describe('assessRefererResponse (pure judge)', () => {
  it('accepts a clean 200', () => {
    assert.equal(assessRefererResponse(200, '<html>saved</html>', null), 'accepted');
  });
  it('accepts a 302 away from login', () => {
    assert.equal(assessRefererResponse(302, '', '/done'), 'accepted');
  });
  it('refuses a 403', () => {
    assert.equal(assessRefererResponse(403, 'Forbidden', null), 'refused');
  });
  it('refuses a 200 carrying a CSRF error phrase', () => {
    assert.equal(assessRefererResponse(200, 'Invalid CSRF token', null), 'refused');
    assert.equal(assessRefererResponse(200, 'referer check failed', null), 'refused');
  });
  it('refuses a 302 to a login page (not processed)', () => {
    assert.equal(assessRefererResponse(302, '', '/login'), 'refused');
    assert.equal(assessRefererResponse(302, '', 'https://example.com/signin'), 'refused');
  });
  it('is unclear on a 500', () => {
    assert.equal(assessRefererResponse(500, 'error', null), 'unclear');
  });
});

// Mock lab for Leg R: one POST form action. `mode` picks how the
// server treats a cross-site Referer:
//   'vulnerable' — accepts same-origin Referer, refuses cross-site (403)
//   'public'     — accepts every Referer
//   'secure'     — refuses every POST (auth-gated form: control fails)
//   'flaky'      — refuses the cross-site Referer once, then accepts
async function startLab(mode) {
  let hits = 0;
  let crossSiteRefusals = 0;
  const srv = http.createServer((req, res) => {
    hits += 1;
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const send = (status, body) => {
        res.writeHead(status, { 'Content-Type': 'text/html' });
        res.end(body);
      };
      const u = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'POST' && u.pathname === '/change') {
        const referer = req.headers.referer || '';
        const sameOrigin = referer.startsWith('http://127.0.0.1');
        if (mode === 'public') return send(200, 'saved');
        if (mode === 'secure') return send(403, 'Forbidden');
        if (mode === 'flaky') {
          if (!sameOrigin) {
            crossSiteRefusals += 1;
            if (crossSiteRefusals === 1) return send(403, 'Forbidden');
            return send(200, 'saved');
          }
          return send(200, 'saved');
        }
        // vulnerable
        if (!sameOrigin) return send(403, 'Forbidden');
        return send(200, 'saved');
      }
      return send(404, 'not found');
    });
  });
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const port = srv.address().port;
  const origin = `http://127.0.0.1:${port}`;
  return {
    origin,
    hits: () => hits,
    close: () => new Promise((resolve) => srv.close(resolve)),
  };
}

describe('probeCsrfRefererOnly — Leg R: Referer-only defense (#407)', () => {
  it('fires on a clean differential: control accepted, cross-site refused twice', async () => {
    const lab = await startLab('vulnerable');
    try {
      const form = { action: `${lab.origin}/change`, method: 'post', inputs: [{ name: 'email', type: 'text', value: '' }] };
      const findings = await probeCsrfRefererOnly([form], lab.origin, {});
      assert.equal(findings.length, 1);
      assert.equal(findings[0].class, 'csrf_referer_only');
      assert.equal(findings[0].severity, 'medium');
      assert.ok(findings[0].evidence.response.includes('cross-site Referer refused'));
      assert.ok(findings[0].evidence.signalCorrelated);
      assert.equal(lab.hits(), 3, 'control + test + repeat = 3 POSTs');
    } finally {
      await lab.close();
    }
  });
  it('stays quiet when every Referer is accepted (no Referer defense)', async () => {
    const lab = await startLab('public');
    try {
      const form = { action: `${lab.origin}/change`, method: 'post', inputs: [{ name: 'email', type: 'text', value: '' }] };
      assert.equal((await probeCsrfRefererOnly([form], lab.origin, {})).length, 0);
    } finally {
      await lab.close();
    }
  });
  it('stays quiet when the control is refused too (auth-gated form)', async () => {
    const lab = await startLab('secure');
    try {
      const form = { action: `${lab.origin}/change`, method: 'post', inputs: [{ name: 'email', type: 'text', value: '' }] };
      assert.equal((await probeCsrfRefererOnly([form], lab.origin, {})).length, 0);
    } finally {
      await lab.close();
    }
  });
  it('stays quiet when the refusal does not reproduce (flaky)', async () => {
    const lab = await startLab('flaky');
    try {
      const form = { action: `${lab.origin}/change`, method: 'post', inputs: [{ name: 'email', type: 'text', value: '' }] };
      assert.equal((await probeCsrfRefererOnly([form], lab.origin, {})).length, 0);
    } finally {
      await lab.close();
    }
  });
  it('skips forms with a token and GET forms', async () => {
    const lab = await startLab('vulnerable');
    try {
      const tokenForm = { action: `${lab.origin}/change`, method: 'post', inputs: [{ name: 'csrf_token', type: 'hidden', value: 't' }] };
      const getForm = { action: `${lab.origin}/change`, method: 'get', inputs: [{ name: 'q', type: 'text', value: '' }] };
      assert.equal((await probeCsrfRefererOnly([tokenForm, getForm], lab.origin, {})).length, 0);
      assert.equal(lab.hits(), 0, 'no POST is sent for skipped forms');
    } finally {
      await lab.close();
    }
  });
  it('skips the leg when SameSite protection is present (SameSite leg owns it)', async () => {
    const lab = await startLab('vulnerable');
    try {
      const form = { action: `${lab.origin}/change`, method: 'post', inputs: [{ name: 'email', type: 'text', value: '' }] };
      const findings = await probeCsrfRefererOnly([form], lab.origin, { sessionSameSite: LAX_SESSION });
      assert.equal(findings.length, 0);
      assert.equal(lab.hits(), 0, 'no POST is sent when SameSite already characterizes the defense');
    } finally {
      await lab.close();
    }
  });
  it('tests at most two token-less forms', async () => {
    const lab = await startLab('public');
    try {
      const forms = [1, 2, 3].map((n) => ({
        action: `${lab.origin}/change`,
        method: 'post',
        inputs: [{ name: `f${n}`, type: 'text', value: '' }],
      }));
      await probeCsrfRefererOnly(forms, lab.origin, {});
      // public mode: control + test per form, no repeat (no refusal to repeat)
      assert.equal(lab.hits(), 4, '2 forms x (control + test), third form untouched');
    } finally {
      await lab.close();
    }
  });
});
