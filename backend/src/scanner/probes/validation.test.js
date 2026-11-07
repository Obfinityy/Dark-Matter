// Tests for the input-validation probe
// (coverage rows #436 [Medium] + #437 [High] + #438 [Medium] +
// #439 [Medium] + #440 [Medium], phase 71).
// No network, no lab needed — fetches go through the opts.fetchPage
// seam and form submits through the opts.submitForm seam.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeValidation,
  buildValidationCases,
  toFullwidth,
  extractHiddenInputs,
} from './validation.js';
import { verifyFindings } from '../verifier.js';

const TARGET_INT = 'http://lab.local/item?id=5&name=widget';
const TARGET_STR = 'http://lab.local/search?q=hello&page=2';
const TARGET_PLAIN = 'http://lab.local/login.php';
const BASELINE_INT = '<html><body><h1>Item 5 widget</h1><p>price 10</p></body></html>';
const BASELINE_STR = '<html><body><h1>Results for hello</h1></body></html>';
const GARBAGE_BODY = '<html><body><h1>Not found</h1><p>no such item here at all, sorry</p></body></html>';

// fetchPage seam: map URL -> { status, body } via a handler fn.
// Unknown URLs 404.
function fetchPageFor(handler) {
  return async (url) => {
    const entry = typeof handler === 'function' ? handler(String(url)) : handler[String(url)];
    if (entry === undefined) return { status: 404, body: 'Not Found' };
    if (entry instanceof Error) throw entry;
    return entry;
  };
}

describe('toFullwidth', () => {
  it('widens ASCII letters and digits', () => {
    assert.equal(toFullwidth('hello'), 'ｈｅｌｌｏ');
    assert.equal(toFullwidth('a1'), 'ａ１');
  });

  it('returns null when nothing can widen', () => {
    assert.equal(toFullwidth(''), null);
    assert.equal(toFullwidth('é'), null);
  });
});

describe('buildValidationCases', () => {
  it('an integer param gets overflow + juggling + null-byte + unicode cases', () => {
    const cases = buildValidationCases(['http://lab.local/item?id=5']);
    const vectors = cases.map((c) => c.vector);
    assert.deepEqual(vectors, ['integer-overflow', 'type-juggling', 'null-byte', 'unicode']);
    const ov = cases[0];
    assert.equal(ov.craftedValue, '2147483648');
    assert.equal(ov.wrapped, '-2147483648');
    assert.ok(new URL(ov.url).searchParams.get('id') === '2147483648');
    assert.equal(ov.parameter, 'id');
    assert.equal(ov.baselineUrl, 'http://lab.local/item?id=5');
    const jug = cases[1];
    assert.ok(new URL(jug.url).searchParams.get('id[]') === '5');
    assert.equal(new URL(jug.url).searchParams.get('id'), null);
    const nb = cases[2];
    assert.ok(nb.url.includes('%00dmjunk'));
    assert.ok(!nb.url.includes('%2500'));
    const uni = cases[3];
    assert.equal(new URL(uni.url).searchParams.get('id'), '５');
  });

  it('a second integer param also gets an overflow case', () => {
    const cases = buildValidationCases(['http://lab.local/a?x=7&y=9']);
    assert.equal(cases.filter((c) => c.vector === 'integer-overflow').length, 2);
  });

  it('a string param gets no overflow case', () => {
    const cases = buildValidationCases(['http://lab.local/search?q=hello']);
    assert.deepEqual(
      cases.map((c) => c.vector),
      ['type-juggling', 'null-byte', 'unicode']
    );
  });

  it('a plain target with no params gets no cases', () => {
    assert.deepEqual(buildValidationCases([TARGET_PLAIN]), []);
    assert.deepEqual(buildValidationCases([]), []);
    assert.deepEqual(buildValidationCases(null), []);
  });

  it('a large integer value gets the 64-bit overflow case', () => {
    const cases = buildValidationCases(['http://lab.local/a?id=3000000000']);
    const ov = cases.find((c) => c.vector === 'integer-overflow');
    assert.equal(ov.craftedValue, '9223372036854775808');
    assert.equal(ov.wrapped, '-9223372036854775808');
  });

  it('a path point gets overflow/null-byte/unicode but no array juggling', () => {
    const map = new Map([
      ['http://lab.local/users/42', [{ name: 'user_id', segment: 2 }]],
    ]);
    const cases = buildValidationCases(['http://lab.local/users/42'], map);
    assert.deepEqual(
      cases.map((c) => c.vector),
      ['integer-overflow', 'null-byte', 'unicode']
    );
    assert.equal(cases[0].parameter, 'user_id (path)');
    assert.ok(cases[0].url.includes('/users/2147483648'));
    assert.ok(cases[1].url.includes('/users/42%00dmjunk'));
  });

  it('caps targets at 3 and points at 2 per target', () => {
    const urls = Array.from({ length: 5 }, (_, i) => `http://lab.local/p${i}?a=${i}&b=${i}&c=${i}`);
    const cases = buildValidationCases(urls);
    // 3 targets x 2 points x 4 vectors (integer params) = 24
    assert.equal(cases.length, 24);
  });
});

describe('extractHiddenInputs', () => {
  it('parses hidden inputs grouped by form action', () => {
    const html = `<html><body>
      <form action="/buy" method="post">
        <input type="hidden" name="price" value="10">
        <input type="hidden" name="csrf_token" value="tok123">
        <input name="qty" value="1">
      </form>
      <form action="/search" method="get">
        <input type="hidden" name="lang" value="en">
      </form></body></html>`;
    const out = extractHiddenInputs(html, 'http://lab.local/shop');
    assert.equal(out.length, 2);
    assert.equal(out[0].action, 'http://lab.local/buy');
    assert.deepEqual(out[0].hidden, [
      { name: 'price', value: '10' },
      { name: 'csrf_token', value: 'tok123' },
    ]);
    assert.equal(out[1].action, 'http://lab.local/search');
    assert.deepEqual(out[1].hidden, [{ name: 'lang', value: 'en' }]);
  });

  it('a form with no hidden inputs is not listed', () => {
    const html = '<form action="/x"><input name="q"></form>';
    assert.deepEqual(extractHiddenInputs(html, 'http://lab.local/'), []);
  });
});

describe('validation probe — integer overflow (#436)', () => {
  it('a wrapped value in the crafted response, absent from the baseline, is a Medium finding', async () => {
    const findings = await probeValidation([TARGET_INT], [], {
      fetchPage: fetchPageFor((url) => {
        if (url.includes('id=2147483648')) {
          return { status: 200, body: '<html><body><h1>Item -2147483648 widget</h1></body></html>' };
        }
        if (url === TARGET_INT) return { status: 200, body: BASELINE_INT };
        return { status: 404, body: GARBAGE_BODY };
      }),
    });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'integer_overflow');
    assert.equal(f.severity, 'medium');
    assert.ok(f.title.includes('Integer overflow'));
    assert.ok(f.evidence.response.includes('-2147483648'));
    assert.equal(f.evidence.signalCorrelated, true);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('no finding when the baseline already carries the wrapped value', async () => {
    const findings = await probeValidation([TARGET_INT], [], {
      fetchPage: fetchPageFor((url) => {
        if (url.includes('id=2147483648')) {
          return { status: 200, body: '<html><body><h1>Item -2147483648</h1></body></html>' };
        }
        if (url === TARGET_INT) {
          return { status: 200, body: '<html><body><p>range -2147483648..2147483647</p></body></html>' };
        }
        return { status: 404, body: GARBAGE_BODY };
      }),
    });
    assert.equal(findings.length, 0);
  });

  it('no finding when the crafted response never wraps', async () => {
    const findings = await probeValidation([TARGET_INT], [], {
      fetchPage: fetchPageFor((url) => {
        if (url === TARGET_INT) return { status: 200, body: BASELINE_INT };
        return { status: 400, body: '<html><body>bad id</body></html>' };
      }),
    });
    assert.equal(findings.length, 0);
  });
});

describe('validation probe — type juggling (#437)', () => {
  const jugglingFetch = (craftedBody) =>
    fetchPageFor((url) => {
      const u = new URL(url);
      if (u.searchParams.has('q[]')) return { status: 200, body: craftedBody };
      if (url === TARGET_STR) return { status: 200, body: BASELINE_STR };
      return { status: 404, body: GARBAGE_BODY };
    });

  it('an array value answered like the scalar, while garbage diverges, is a High finding', async () => {
    const findings = await probeValidation([TARGET_STR], [], {
      fetchPage: jugglingFetch(BASELINE_STR),
    });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'type_juggling');
    assert.equal(f.severity, 'high');
    assert.ok(f.title.includes('Type juggling'));
    assert.equal(f.evidence.signalCorrelated, true);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('no finding when garbage is answered like the baseline (endpoint ignores the param)', async () => {
    const findings = await probeValidation([TARGET_STR], [], {
      fetchPage: fetchPageFor((url) => {
        if (url === TARGET_STR) return { status: 200, body: BASELINE_STR };
        return { status: 200, body: BASELINE_STR };
      }),
    });
    assert.equal(findings.length, 0);
  });

  it('no finding when the array value is rejected', async () => {
    const findings = await probeValidation([TARGET_STR], [], {
      fetchPage: jugglingFetch('<html><body><h1>Type error</h1><p>q must be a string value here</p></body></html>'),
    });
    assert.equal(findings.length, 0);
  });

  it('no finding when the crafted body is the same length but different content (fixture-caught)', async () => {
    // {"id":0} vs {"id":5} score 1.00 on length-ratio alone, but
    // the server did NOT coerce the array into the scalar — it
    // defaulted to 0. The content-aware similarity must kill it.
    const findings = await probeValidation(['http://lab.local/item?id=5'], [], {
      fetchPage: fetchPageFor((url) => {
        const u = new URL(url);
        if (u.searchParams.has('id[]')) return { status: 200, body: '{"id":0}' };
        if (url === 'http://lab.local/item?id=5') return { status: 200, body: '{"id":5}' };
        return { status: 404, body: GARBAGE_BODY };
      }),
    });
    assert.equal(findings.length, 0);
  });
});

describe('validation probe — null-byte truncation (#438)', () => {
  it('a %00-truncated value answered like the plain value, while garbage diverges, is a Medium finding', async () => {
    const findings = await probeValidation(['http://lab.local/search?q=hello'], [], {
      fetchPage: fetchPageFor((url) => {
        if (url.includes('%00dmjunk')) return { status: 200, body: BASELINE_STR };
        if (url === 'http://lab.local/search?q=hello') return { status: 200, body: BASELINE_STR };
        return { status: 404, body: GARBAGE_BODY };
      }),
    });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'null_byte_truncation');
    assert.equal(f.severity, 'medium');
    assert.ok(f.title.includes('Null-byte'));
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('no finding when the null-byte value is rejected', async () => {
    const findings = await probeValidation([TARGET_STR], [], {
      fetchPage: fetchPageFor((url) => {
        if (url === TARGET_STR) return { status: 200, body: BASELINE_STR };
        return { status: 400, body: '<html><body>bad request value rejected</body></html>' };
      }),
    });
    assert.equal(findings.length, 0);
  });
});

describe('validation probe — unicode normalization (#439)', () => {
  it('a fullwidth value answered like the canonical value, while garbage diverges, is a Medium finding', async () => {
    const findings = await probeValidation([TARGET_STR], [], {
      fetchPage: fetchPageFor((url) => {
        const u = new URL(url);
        const q = u.searchParams.get('q');
        if (q === toFullwidth('hello')) return { status: 200, body: BASELINE_STR };
        if (url === TARGET_STR) return { status: 200, body: BASELINE_STR };
        return { status: 404, body: GARBAGE_BODY };
      }),
    });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'unicode_normalization');
    assert.equal(f.severity, 'medium');
    assert.ok(f.title.includes('Unicode'));
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('no finding when the fullwidth value is treated as a different search', async () => {
    const findings = await probeValidation([TARGET_STR], [], {
      fetchPage: fetchPageFor((url) => {
        if (url === TARGET_STR) return { status: 200, body: BASELINE_STR };
        return { status: 200, body: '<html><body><h1>No results for that search term</h1></body></html>' };
      }),
    });
    assert.equal(findings.length, 0);
  });
});

describe('validation probe — request budget', () => {
  it('caps GET requests at 32 across many targets', async () => {
    let count = 0;
    const urls = Array.from({ length: 8 }, (_, i) => `http://lab.local/p${i}?a=${i}&b=x`);
    await probeValidation(urls, [], {
      fetchPage: async () => {
        count += 1;
        return { status: 200, body: BASELINE_STR };
      },
    });
    assert.ok(count <= 32, `expected <= 32 requests, got ${count}`);
    assert.ok(count > 0);
  });

  it('no targets and no forms yields no findings and no fetches', async () => {
    let count = 0;
    const findings = await probeValidation([], [], {
      fetchPage: async () => {
        count += 1;
        return { status: 200, body: BASELINE_STR };
      },
    });
    assert.deepEqual(findings, []);
    assert.equal(count, 0);
  });
});

describe('validation probe — hidden fields (#440)', () => {
  const PAGE = 'http://lab.local/shop';
  const PAGE_HTML = `<html><body>
    <form action="/buy" method="post">
      <input type="hidden" name="price" value="10">
      <input type="hidden" name="csrf_token" value="tok123">
      <input name="qty" value="1">
      <input name="Buy" type="submit" value="Buy">
    </form></body></html>`;
  const FORM = { action: 'http://lab.local/buy', method: 'post', inputs: [{ name: 'price', type: 'hidden', value: '10' }, { name: 'csrf_token', type: 'hidden', value: 'tok123' }, { name: 'qty', type: 'text', value: '1' }, { name: 'Buy', type: 'submit', value: 'Buy' }] };

  function runForms({ allowWrite, controlStatus = 200, tamperedBody }) {
    const submits = [];
    const submitForm = async (form, values) => {
      submits.push({ ...values });
      if (values.price === '0') {
        return { status: 200, body: tamperedBody };
      }
      return { status: controlStatus, body: '<html><body><h1>Order placed</h1><p>price 10 charged</p></body></html>' };
    };
    const fetchPage = fetchPageFor({
      [PAGE]: { status: 200, body: PAGE_HTML },
    });
    return { submits, submitForm, fetchPage };
  }

  it('a tampered hidden price accepted like the original, with the token untouched, is a Medium finding', async () => {
    const { submits, submitForm, fetchPage } = runForms({
      allowWrite: true,
      tamperedBody: '<html><body><h1>Order placed</h1><p>price 0 charged</p></body></html>',
    });
    const findings = await probeValidation([], [FORM], { fetchPage, submitForm, allowWrite: true, pageUrl: PAGE });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'hidden_field_validation');
    assert.equal(f.severity, 'medium');
    assert.ok(f.title.includes("hidden field 'price'"));
    assert.equal(f.evidence.signalCorrelated, true);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    // Both submits carried the untouched CSRF token.
    assert.equal(submits.length, 2);
    assert.ok(submits.every((s) => s.csrf_token === 'tok123'));
    assert.equal(submits[0].price, '10');
    assert.equal(submits[1].price, '0');
  });

  it('a POST form is never submitted without the lab gate', async () => {
    const { submits, submitForm, fetchPage } = runForms({ allowWrite: false });
    const findings = await probeValidation([], [FORM], { fetchPage, submitForm, allowWrite: false, pageUrl: PAGE });
    assert.deepEqual(findings, []);
    assert.equal(submits.length, 0);
  });

  it('no finding when the tampered value is not reflected (server ignored the field)', async () => {
    const { submitForm, fetchPage } = runForms({
      allowWrite: true,
      tamperedBody: '<html><body><h1>Order placed</h1><p>price 10 charged</p></body></html>',
    });
    const findings = await probeValidation([], [FORM], { fetchPage, submitForm, allowWrite: true, pageUrl: PAGE });
    assert.equal(findings.length, 0);
  });

  it('no finding when the control submit itself fails', async () => {
    const { submitForm, fetchPage } = runForms({
      allowWrite: true,
      controlStatus: 403,
      tamperedBody: '<html><body><h1>Order placed</h1><p>price 0 charged</p></body></html>',
    });
    const findings = await probeValidation([], [FORM], { fetchPage, submitForm, allowWrite: true, pageUrl: PAGE });
    assert.equal(findings.length, 0);
  });

  it('a GET form is submitted without the lab gate (read-only)', async () => {
    const submits = [];
    const submitForm = async (form, values) => {
      submits.push({ ...values });
      const pad = 'x'.repeat(200);
      if (values.lang === TAMPERED) {
        return { status: 200, body: `<html><body><p>lang dm-validation-tampered applied</p><p>${pad}</p></body></html>` };
      }
      return { status: 200, body: `<html><body><p>lang en applied ok here</p><p>${pad}</p></body></html>` };
    };
    const TAMPERED = 'dm-validation-tampered';
    const getForm = { action: 'http://lab.local/search', method: 'get', inputs: [{ name: 'lang', type: 'hidden', value: 'en' }, { name: 'q', type: 'text', value: '' }] };
    const getPage = `<html><body><form action="/search" method="get">
      <input type="hidden" name="lang" value="en"><input name="q"></form></body></html>`;
    const fetchPage = fetchPageFor({
      [PAGE]: { status: 200, body: getPage },
    });
    const findings = await probeValidation([], [getForm], { fetchPage, submitForm, allowWrite: false, pageUrl: PAGE });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'hidden_field_validation');
    assert.equal(submits.length, 2);
    assert.equal(submits[1].lang, TAMPERED);
  });

  it('a form with no hidden inputs submits nothing', async () => {
    const submits = [];
    const submitForm = async () => {
      submits.push(1);
      return { status: 200, body: 'ok' };
    };
    const noHiddenPage = '<html><body><form action="/x" method="post"><input name="q"></form></body></html>';
    const fetchPage = fetchPageFor({
      [PAGE]: { status: 200, body: noHiddenPage },
    });
    const findings = await probeValidation(
      [],
      [{ action: 'http://lab.local/x', method: 'post', inputs: [{ name: 'q', type: 'text', value: '' }] }],
      { fetchPage, submitForm, allowWrite: true, pageUrl: PAGE }
    );
    assert.deepEqual(findings, []);
    assert.equal(submits.length, 0);
  });
});
