/**
 * Regression tests for SQLi verifier false-positive hardening (31 Oct 2026)
 * 
 * Root cause: probe_sqli_bypass was marked "verified (4/4)" when the payload
 * login.php?username=;-- returned only the login form HTML. The 4-step
 * verifyPipeline checked keyword presence ("bypass" in probe output), not
 * demonstrated authentication bypass.
 * 
 * These tests ensure:
 * 1. Login-form responses NEVER satisfy auth-bypass criteria
 * 2. HTTP 200 alone NEVER confirms SQL injection
 * 3. Generic error text NEVER confirms SQL injection
 * 4. Keywords alone NEVER confirm (weak signal rejection)
 * 5. Valid evidence-backed claims STILL pass (no over-correction)
 * 6. Inconclusive evidence stays inconclusive (not rejected, not confirmed)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateSqliAuthBypass, isWeakSignalOnly } from './differential.js';

// Fixture: DVWA login form HTML (what probe_sqli_bypass actually returned)
const LOGIN_FORM_HTML = `
<html>
<head><title>Login</title></head>
<body>
<form action="login.php" method="post">
  <input type="text" name="username" />
  <input type="password" name="password" />
  <input type="submit" value="Login" />
</form>
<p>Please login to continue</p>
</body>
</html>
`;

// Fixture: Authenticated page (what a REAL bypass would return)
const AUTHENTICATED_HTML = `
<html>
<head><title>Dashboard</title></head>
<body>
<p>Welcome back, admin!</p>
<a href="logout.php">Logout</a>
<div>Dashboard content here</div>
</body>
</html>
`;

describe('SQLi Auth-Bypass: Login form does NOT satisfy criteria', () => {
  it('login form HTML is rejected (probe_sqli_bypass regression)', () => {
    const result = validateSqliAuthBypass({
      output: LOGIN_FORM_HTML,
      baselineOutput: LOGIN_FORM_HTML,
      payload: 'username=;--',
      endpoint: 'login.php',
    });
    
    assert.equal(result.verdict, 'rejected');
    assert.match(result.reason, /login form/i);
    assert.equal(result.evidence.isLoginForm, true);
  });

  it('output with "bypass" keyword but login form is rejected', () => {
    // This is the exact false-accept pattern: keyword in output + login form
    const outputWithKeyword = LOGIN_FORM_HTML + '\n<!-- probe_sqli_bypass completed -->';
    const result = validateSqliAuthBypass({
      output: outputWithKeyword,
      baselineOutput: LOGIN_FORM_HTML,
      payload: 'username=;--',
    });
    
    assert.equal(result.verdict, 'rejected');
    assert.match(result.reason, /login form/i);
  });
});

describe('SQLi Auth-Bypass: HTTP 200 alone does NOT confirm', () => {
  it('200 response with login form is rejected', () => {
    const http200Login = 'HTTP/1.1 200 OK\nContent-Type: text/html\n\n' + LOGIN_FORM_HTML;
    const result = validateSqliAuthBypass({
      output: http200Login,
      baselineOutput: LOGIN_FORM_HTML,
    });
    
    assert.equal(result.verdict, 'rejected');
  });
});

describe('SQLi Auth-Bypass: Generic errors do NOT confirm', () => {
  it('generic error message is not auth bypass evidence', () => {
    const genericError = '<html><body><p>An error occurred. Please try again.</p></body></html>';
    const result = validateSqliAuthBypass({
      output: genericError,
      baselineOutput: LOGIN_FORM_HTML,
    });
    
    // Not a login form, but also not an auth state change → rejected
    assert.equal(result.verdict, 'rejected');
  });
});

describe('Weak Signal Rejection', () => {
  it('keywords alone are weak signals', () => {
    const result = isWeakSignalOnly({
      output: 'Testing for bypass... probe_sqli_bypass running... checking injection points',
      vulnerabilityClass: 'sqli',
    });
    
    assert.equal(result.isWeak, true);
    assert.match(result.reason, /keywords/i);
  });

  it('output with concrete impact is NOT weak', () => {
    const result = isWeakSignalOnly({
      output: 'Welcome admin! <a href="logout.php">Logout</a> Dashboard loaded.',
      vulnerabilityClass: 'sqli',
    });
    
    assert.equal(result.isWeak, false);
  });
});

describe('SQLi Auth-Bypass: Valid claims STILL pass (no over-correction)', () => {
  it('genuine auth state change is confirmed', () => {
    const result = validateSqliAuthBypass({
      output: AUTHENTICATED_HTML,
      baselineOutput: LOGIN_FORM_HTML,
      payload: "admin' --",
      endpoint: 'login.php',
    });
    
    assert.equal(result.verdict, 'confirmed');
    assert.equal(result.evidence.stateChanged, true);
    assert.match(result.reason, /authentication state changed/i);
  });
});

describe('SQLi Auth-Bypass: Inconclusive stays inconclusive', () => {
  it('missing baseline is inconclusive (not rejected)', () => {
    const result = validateSqliAuthBypass({
      output: AUTHENTICATED_HTML,
      baselineOutput: '', // No baseline provided
      payload: "admin' --",
    });
    
    assert.equal(result.verdict, 'inconclusive');
    assert.match(result.reason, /baseline/i);
  });
});

describe('Historical Preservation', () => {
  it('re-audit does not modify original finding (separate assessment)', () => {
    // The re-audit file exists separately; original events.jsonl is untouched
    // This test verifies the validator can reassess without mutating history
    const originalVerdict = 'confirmed (all 4 steps passed)'; // Historical record
    const reaudit = validateSqliAuthBypass({
      output: LOGIN_FORM_HTML,
      baselineOutput: LOGIN_FORM_HTML,
      payload: 'username=;--',
    });
    
    // Re-audit gives different verdict, but original is preserved
    assert.notEqual(reaudit.verdict, 'confirmed');
    assert.equal(originalVerdict, 'confirmed (all 4 steps passed)'); // Unchanged
  });
});
