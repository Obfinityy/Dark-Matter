// Tests for the autocomplete-on-sensitive-fields probe
// (coverage row #483 [Low] Autocomplete enabled on sensitive fields,
// CWE-200 / CWE-525 | OWASP WSTG v4.2; phase 103, 'autocomplete').
//
// The probe is a pure static HTML check: a sensitive field (password,
// payment card, secret/token, SSN, PIN, card expiry) with no
// autocomplete="off" — or explicitly autocomplete="on" — is a
// finding; a plain username / email / search field never fires, and
// autocomplete="off" (input or enclosing form) or a password-manager
// token (current-password / new-password, password fields only)
// protects. Fixtures use fake field names only — no real secrets.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeAutocomplete,
  extractInputFields,
  sensitiveKind,
  isAutocompleteProtected,
  assessAutocomplete,
  __autocompleteMeta,
} from './autocomplete.js';
import { verifyFindings } from '../verifier.js';

const URL = 'http://lab.local/login.php';

// DVWA-shaped login form: a password input with no autocomplete
// attribute at all (the live DVWA login page carries exactly this).
const LOGIN_PAGE = `<html><body><form action="/login.php" method="post">
<input name="username"><input type="password" name="password">
<input type="submit" value="Login"></form></body></html>`;

// Same form, fixed: every sensitive field carries autocomplete="off".
const SAFE_PAGE = `<html><body><form action="/login.php" method="post" autocomplete="off">
<input name="username"><input type="password" name="password" autocomplete="off">
<input type="submit" value="Login"></form></body></html>`;

// Angular-style SPA shell: no inputs in the served HTML.
const SHELL_PAGE = `<html><body><app-root></app-root><script src="main.js"></script></body></html>`;

function field(html) {
  const fields = extractInputFields(html);
  assert.equal(fields.length, 1, `expected 1 input in ${html}`);
  return fields[0];
}

describe('extractInputFields — input parsing with form context', () => {
  it('AC-1: parses type, name, id and autocomplete off an input tag', () => {
    const f = field('<input type="password" id="pw" name="password" autocomplete="off">');
    assert.equal(f.type, 'password');
    assert.equal(f.name, 'password');
    assert.equal(f.id, 'pw');
    assert.equal(f.autocomplete, 'off');
    assert.equal(f.formAutocomplete, null);
    assert.equal(f.disabled, false);
  });

  it('AC-2: an input inside a form inherits the form autocomplete value', () => {
    const fields = extractInputFields(
      '<form autocomplete="off"><input type="password" name="password"></form>' +
        '<input type="password" name="other">'
    );
    assert.equal(fields.length, 2);
    assert.equal(fields[0].formAutocomplete, 'off');
    assert.equal(fields[1].formAutocomplete, null);
  });

  it('AC-3: an unclosed form runs to the end of the body', () => {
    const fields = extractInputFields('<form autocomplete="off"><input type="password" name="password">');
    assert.equal(fields.length, 1);
    assert.equal(fields[0].formAutocomplete, 'off');
  });
});

describe('sensitiveKind — only genuinely sensitive fields', () => {
  it('AC-4: type=password is sensitive whatever its name is', () => {
    assert.equal(sensitiveKind(field('<input type="password" name="q">')), 'password');
    assert.equal(sensitiveKind(field('<input type="password">')), 'password');
  });

  it('AC-5: a text input named password is sensitive', () => {
    assert.equal(sensitiveKind(field('<input type="text" name="password">')), 'password');
    assert.equal(sensitiveKind(field('<input type="text" name="user_passwd">')), 'password');
  });

  it('AC-6: a plain username field is never sensitive', () => {
    assert.equal(sensitiveKind(field('<input type="text" name="username">')), null);
    assert.equal(sensitiveKind(field('<input type="text" name="user">')), null);
  });

  it('AC-7: an email field is never sensitive', () => {
    assert.equal(sensitiveKind(field('<input type="email" name="email">')), null);
  });

  it('AC-8: a search field is never sensitive', () => {
    assert.equal(sensitiveKind(field('<input type="search" name="q">')), null);
    assert.equal(sensitiveKind(field('<input type="text" name="search">')), null);
  });

  it('AC-9: payment-card names are sensitive (card kind)', () => {
    assert.equal(sensitiveKind(field('<input type="text" name="cc-number">')), 'card');
    assert.equal(sensitiveKind(field('<input type="text" name="credit_card">')), 'card');
    assert.equal(sensitiveKind(field('<input type="tel" name="cardNumber">')), 'card');
    assert.equal(sensitiveKind(field('<input type="text" name="cvv">')), 'card');
  });

  it('AC-10: secret / token / key names are sensitive (secret kind)', () => {
    assert.equal(sensitiveKind(field('<input type="text" name="api_key">')), 'secret');
    assert.equal(sensitiveKind(field('<input type="text" name="secret">')), 'secret');
    assert.equal(sensitiveKind(field('<input type="text" name="access-token">')), 'secret');
  });

  it('AC-11: SSN names are sensitive (ssn kind)', () => {
    assert.equal(sensitiveKind(field('<input type="text" name="ssn">')), 'ssn');
    assert.equal(sensitiveKind(field('<input type="text" name="social_security">')), 'ssn');
  });

  it('AC-12: PIN matches whole tokens only — card-pin fires, shipping does not', () => {
    assert.equal(sensitiveKind(field('<input type="text" name="card-pin">')), 'pin');
    assert.equal(sensitiveKind(field('<input type="text" name="shipping">')), null);
    assert.equal(sensitiveKind(field('<input type="text" name="pin">')), 'pin');
  });

  it('AC-13: card-expiry names are sensitive (expiry kind)', () => {
    assert.equal(sensitiveKind(field('<input type="text" name="expiry">')), 'expiry');
    assert.equal(sensitiveKind(field('<input type="text" name="cc-exp">')), 'expiry');
  });

  it('AC-14: hidden and disabled inputs are never sensitive', () => {
    assert.equal(sensitiveKind(field('<input type="hidden" name="password" value="x">')), null);
    assert.equal(sensitiveKind(field('<input type="password" name="password" disabled>')), null);
    assert.equal(sensitiveKind(field('<input type="submit" name="password">')), null);
  });

  it('AC-15: a card autocomplete token marks a plain text input as card', () => {
    assert.equal(
      sensitiveKind(field('<input type="text" name="number" autocomplete="cc-number">')),
      'card'
    );
  });
});

describe('isAutocompleteProtected — the protected values', () => {
  it('AC-16: autocomplete="off" on the input protects', () => {
    assert.equal(
      isAutocompleteProtected(field('<input type="password" name="password" autocomplete="off">')).protected,
      true
    );
  });

  it('AC-17: form autocomplete="off" protects a bare input, but an input autocomplete="on" wins', () => {
    assert.equal(
      isAutocompleteProtected(
        field('<form autocomplete="off"><input type="password" name="password"></form>')
      ).protected,
      true
    );
    assert.equal(
      isAutocompleteProtected(
        field('<form autocomplete="off"><input type="password" name="password" autocomplete="on"></form>')
      ).protected,
      false
    );
  });

  it('AC-18: password-manager tokens protect a password field only', () => {
    assert.equal(
      isAutocompleteProtected(field('<input type="password" name="password" autocomplete="current-password">'))
        .protected,
      true
    );
    assert.equal(
      isAutocompleteProtected(field('<input type="password" name="password" autocomplete="new-password">'))
        .protected,
      true
    );
    assert.equal(
      isAutocompleteProtected(field('<input type="text" name="cc-number" autocomplete="current-password">'))
        .protected,
      false
    );
  });

  it('AC-19: a card token does NOT protect a card field', () => {
    assert.equal(
      isAutocompleteProtected(field('<input type="text" name="number" autocomplete="cc-number">')).protected,
      false
    );
  });
});

describe('assessAutocomplete — the oracle', () => {
  it('AC-20: sensitive + unprotected confirms, protected or non-sensitive rejects', () => {
    assert.equal(
      assessAutocomplete(field('<input type="password" name="password">')).verdict,
      'confirmed'
    );
    assert.equal(
      assessAutocomplete(field('<input type="password" name="password" autocomplete="off">')).verdict,
      'rejected'
    );
    assert.equal(
      assessAutocomplete(field('<input type="text" name="username">')).verdict,
      'rejected'
    );
    assert.equal(
      assessAutocomplete(field('<input type="password" name="password" autocomplete="on">')).verdict,
      'confirmed'
    );
  });
});

describe('probeAutocomplete — end to end', () => {
  it('AC-21: DVWA-shaped login page fires exactly 1 Low finding, verifier-confirmed', async () => {
    const findings = await probeAutocomplete(URL, LOGIN_PAGE, {});
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'autocomplete');
    assert.equal(f.severity, 'low');
    assert.equal(f.title, 'Autocomplete enabled on a sensitive password field (LOW)');
    assert.equal(f.parameter, 'password');
    assert.equal(f.url, URL);
    assert.equal(f.evidence.signalCorrelated, true);
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
  });

  it('AC-22: a fixed page fires nothing; diagnostics count the sensitive field', async () => {
    const diag = {};
    const findings = await probeAutocomplete(URL, SAFE_PAGE, { diagnostics: diag });
    assert.equal(findings.length, 0);
    assert.equal(diag.inputsScanned, 3);
    assert.equal(diag.sensitiveInputs, 1);
    assert.equal(diag.unprotectedInputs, 0);
  });

  it('AC-23: an SPA shell with no inputs fires nothing (honest no-surface)', async () => {
    const diag = {};
    const findings = await probeAutocomplete(URL, SHELL_PAGE, { diagnostics: diag });
    assert.equal(findings.length, 0);
    assert.equal(diag.inputsScanned, 0);
    assert.equal(diag.sensitiveInputs, 0);
    assert.equal(diag.unprotectedInputs, 0);
  });

  it('AC-24: a prefilled value attribute is redacted out of the evidence', async () => {
    const findings = await probeAutocomplete(
      URL,
      '<input type="password" name="password" value="hunter2-secret-value">',
      {}
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].evidence.response.includes('hunter2-secret-value'), false);
    assert.equal(findings[0].evidence.response.includes('…(redacted)'), true);
  });

  it('AC-25: at most 5 findings per scan, diagnostics count all unprotected fields', async () => {
    const diag = {};
    const html = Array.from({ length: 7 }, (_, i) => `<input type="password" name="pw${i}">`).join('');
    const findings = await probeAutocomplete(URL, html, { diagnostics: diag });
    assert.equal(findings.length, 5);
    assert.equal(diag.sensitiveInputs, 7);
    assert.equal(diag.unprotectedInputs, 7);
  });

  it('AC-26: the same field twice dedups to 1 finding', async () => {
    const html =
      '<input type="password" name="password"><input type="password" name="password">';
    const findings = await probeAutocomplete(URL, html, {});
    assert.equal(findings.length, 1);
  });

  it('AC-27: probe metadata names the phase and all depths', () => {
    assert.deepEqual(__autocompleteMeta, {
      phases: ['autocomplete'],
      depth: ['quick', 'standard', 'deep'],
    });
  });
});
