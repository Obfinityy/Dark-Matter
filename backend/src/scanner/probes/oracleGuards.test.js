// Tests for the shared oracle guards (oracleGuards.js).
// Zerodha fixtures are verbatim fragments from hunt h_6b5942052353
// (9 Nov 2026, zerodha.com) — a deep scan that confirmed 37 findings
// which were all false positives from their own recorded evidence.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isBotChallengePage,
  isSelfReferentialMarker,
  isPayloadReflected,
  controlObservationsStable,
  isPhpWordpressStack,
} from './oracleGuards.js';

// Recorded fragments (verbatim from the hunt's finding evidence).
const CHALLENGE_FRAGMENT =
  'Just a moment...       *{box-sizing:border-box;margin:0;padding:0}' +
  'html{line-height:1.15;-webkit-text-size-adjust:100%;color:#313131;' +
  'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI';
// The same recorded page, with its Cloudflare footer attribution (the
// evidence window only quoted the first ~200 chars; the full page is a
// verified Cloudflare interstitial, footer "DDoS protection by Cloudflare").
const CHALLENGE_PAGE = `${CHALLENGE_FRAGMENT}\nDDoS protection by Cloudflare.`;
const EL_REFLECTED_FRAGMENT =
  `...,cTplV:5,cType: 'managed',cUPMDTk:"/varsity/wp-comments-post.php` +
  `?author=%24%7B%27dmElTest%27.toString%28%29%7D&email=dmprobe2_a399&...`;
const NORMAL_LOGIN =
  '<html><body><form><label>Username</label><input name="username">' +
  '<label>Password</label><input name="password"></form></body></html>';

describe('isBotChallengePage (Zerodha FP: Cloudflare "Just a moment")', () => {
  it('flags the recorded Cloudflare challenge fragment', () => {
    assert.equal(isBotChallengePage(CHALLENGE_PAGE), true);
  });

  it('flags a full Cloudflare interstitial', () => {
    assert.equal(
      isBotChallengePage(
        '<title>Just a moment...</title><p>Checking your browser before accessing this site. ' +
          'DDoS protection by Cloudflare.</p>',
      ),
      true,
    );
  });

  it('does not flag a normal login page', () => {
    assert.equal(isBotChallengePage(NORMAL_LOGIN), false);
  });

  it('does not flag a page that merely contains a captcha widget', () => {
    assert.equal(
      isBotChallengePage(
        '<html><form><div class="g-recaptcha"></div><button>Login</button></form></html>',
      ),
      false,
    );
  });

  it('does not flag "just a moment" prose without a Cloudflare marker', () => {
    assert.equal(
      isBotChallengePage('<html><p>Hold on just a moment while we fetch your results.</p></html>'),
      false,
    );
  });
});

describe('isSelfReferentialMarker (Zerodha FP: marker inside its own payload)', () => {
  it('flags the retired ${...toString()} / dmElTest shape', () => {
    assert.equal(isSelfReferentialMarker("${'dmElTest'.toString()}", 'dmElTest'), true);
  });

  it('does not flag the math oracles', () => {
    assert.equal(isSelfReferentialMarker('${1336*7}', '9352'), false);
    assert.equal(isSelfReferentialMarker('#{1336*7}', '9352'), false);
  });

  it('does not flag the toUpperCase string oracle', () => {
    assert.equal(isSelfReferentialMarker("${'dmElTest'.toUpperCase()}", 'DMELTEST'), false);
  });
});

describe('isPayloadReflected (Zerodha FP: URL-encoded payload in a link)', () => {
  it('detects the recorded encoded reflection', () => {
    assert.equal(isPayloadReflected(EL_REFLECTED_FRAGMENT, "${'dmElTest'.toString()}"), true);
  });

  it('detects a raw literal reflection', () => {
    assert.equal(isPayloadReflected('<html>result: ${1336*7}</html>', '${1336*7}'), true);
  });

  it('does not flag an evaluated result', () => {
    assert.equal(isPayloadReflected('<html>result: 9352</html>', '${1336*7}'), false);
  });

  it('does not flag an unrelated page', () => {
    assert.equal(isPayloadReflected('<html>result: baseline-ok</html>', '${1336*7}'), false);
  });
});

describe('controlObservationsStable (FP3: double-control noise guard)', () => {
  it('stable when both controls agree', () => {
    assert.equal(
      controlObservationsStable(
        { status: 200, text: '<html>login</html>' },
        { status: 200, text: '<html>login</html>' },
      ),
      true,
    );
  });

  it('unstable on a status-class flip', () => {
    assert.equal(
      controlObservationsStable({ status: 200, text: 'ok' }, { status: 503, text: 'ok' }),
      false,
    );
  });

  it('unstable when only one side is a challenge page', () => {
    assert.equal(
      controlObservationsStable(
        { status: 200, text: NORMAL_LOGIN },
        { status: 200, text: CHALLENGE_PAGE },
      ),
      false,
    );
  });

  it('unstable on the recorded Zerodha length-bucket wobble (bucket 15 vs 14)', () => {
    // The /open-account matrix moved err:other:15 -> err:other:14 on a
    // challenge page: same outcome words, one bucket apart. A control
    // that cannot reproduce its own bucket is noise.
    assert.equal(
      controlObservationsStable(
        { status: 403, text: 'x'.repeat(15 * 400) },
        { status: 403, text: 'x'.repeat(14 * 400) },
      ),
      false,
    );
  });
});

describe('isPhpWordpressStack (stack gate)', () => {
  it('fires on php / wordpress identifications', () => {
    assert.equal(isPhpWordpressStack(['php', 'wordpress', 'cloudflare']), true);
    assert.equal(isPhpWordpressStack(['wordpress']), true);
    assert.equal(isPhpWordpressStack('php'), true);
  });

  it('does not fire on a Java stack', () => {
    assert.equal(isPhpWordpressStack(['java', 'nginx']), false);
  });

  it('does not fire when the stack is unknown (fail-open)', () => {
    assert.equal(isPhpWordpressStack(undefined), false);
    assert.equal(isPhpWordpressStack(null), false);
    assert.equal(isPhpWordpressStack([]), false);
  });
});
