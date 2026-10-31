/**
 * Regression tests for Phase 4 vulnerability class validators (31 Oct 2026)
 * 
 * Tests for XSS, Command Injection, Path Traversal validators and the
 * validateVulnClaim dispatcher. Ensures class-specific false-accept patterns
 * are blocked while genuine findings remain confirmable.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  validateXssClaim, 
  validateCommandInjection, 
  validatePathTraversal,
  validateVulnClaim 
} from './differential.js';

describe('XSS Validator', () => {
  it('rejects entity-encoded payload (properly escaped, not vulnerable)', () => {
    const result = validateXssClaim({
      output: '<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>',
      payload: '<script>alert(1)</script>',
    });
    assert.equal(result.verdict, 'rejected');
    assert.match(result.reason, /entity-encoded|escaped/i);
  });

  it('rejects payload in HTML comment (not executable)', () => {
    const result = validateXssClaim({
      output: '<!-- <script>alert(1)</script> -->',
      payload: '<script>alert(1)</script>',
    });
    assert.equal(result.verdict, 'rejected');
    assert.match(result.reason, /comment/i);
  });

  it('rejects when payload not in response', () => {
    const result = validateXssClaim({
      output: '<div>Hello World</div>',
      payload: '<script>alert(1)</script>',
    });
    assert.equal(result.verdict, 'rejected');
    assert.match(result.reason, /not found|not reflected/i);
  });

  it('confirms raw unencoded reflection (genuine XSS)', () => {
    const result = validateXssClaim({
      output: '<div><script>alert(1)</script></div>',
      payload: '<script>alert(1)</script>',
    });
    assert.equal(result.verdict, 'confirmed');
    assert.match(result.reason, /unencoded|reflected/i);
  });

  it('inconclusive when no payload provided', () => {
    const result = validateXssClaim({
      output: '<div>test</div>',
      payload: '',
    });
    assert.equal(result.verdict, 'inconclusive');
  });
});

describe('Command Injection Validator', () => {
  it('rejects failed execution (no evidence from failures)', () => {
    const result = validateCommandInjection({
      output: 'Command failed: sh: id: command not found',
      command: 'id',
    });
    assert.equal(result.verdict, 'rejected');
    assert.match(result.reason, /failed/i);
  });

  it('rejects when no command output present', () => {
    const result = validateCommandInjection({
      output: '<html><body>OK</body></html>',
      command: 'id',
    });
    assert.equal(result.verdict, 'rejected');
    assert.match(result.reason, /no command output/i);
  });

  it('confirms when uid/gid output present (genuine injection)', () => {
    const result = validateCommandInjection({
      output: 'uid=33(www-data) gid=33(www-data) groups=33(www-data)',
      command: 'id',
    });
    assert.equal(result.verdict, 'confirmed');
    assert.match(result.reason, /command output/i);
  });

  it('confirms when directory listing present', () => {
    const result = validateCommandInjection({
      output: 'total 24\ndrwx------ 2 user user 4096 Oct 31 23:00 .',
      command: 'ls -la',
    });
    assert.equal(result.verdict, 'confirmed');
  });
});

describe('Path Traversal Validator', () => {
  it('rejects error page (not file content)', () => {
    const result = validatePathTraversal({
      output: '<html><body><h1>404 Not Found</h1><p>File not found on this server</p></body></html>',
      payload: '../../../etc/passwd',
    });
    assert.equal(result.verdict, 'rejected');
    assert.match(result.reason, /error page/i);
  });

  it('rejects when no file content markers present', () => {
    const result = validatePathTraversal({
      output: '<html><body>Welcome</body></html>',
      payload: '../../../etc/passwd',
    });
    assert.equal(result.verdict, 'rejected');
    assert.match(result.reason, /no file content/i);
  });

  it('confirms /etc/passwd content (genuine traversal)', () => {
    const result = validatePathTraversal({
      output: 'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin',
      payload: '../../../etc/passwd',
    });
    assert.equal(result.verdict, 'confirmed');
    assert.match(result.reason, /file content/i);
    assert.equal(result.evidence.fileType, 'passwd');
  });

  it('confirms win.ini content', () => {
    const result = validatePathTraversal({
      output: '[extensions]\n[fonts]\n[mci extensions]',
      payload: '..\\..\\windows\\win.ini',
    });
    assert.equal(result.verdict, 'confirmed');
    assert.equal(result.evidence.fileType, 'winini');
  });
});

describe('Vulnerability Claim Dispatcher', () => {
  it('routes sqli auth-bypass to SQLi validator', () => {
    const result = validateVulnClaim('sqli', {
      output: '<form><input type="password"></form>',
      baselineOutput: '<form><input type="password"></form>',
      payload: 'test',
      endpoint: 'login.php',
    });
    assert.equal(result.validator, 'validateSqliAuthBypass');
    assert.equal(result.verdict, 'rejected');
  });

  it('routes xss to XSS validator', () => {
    const result = validateVulnClaim('xss_r', {
      output: '<div><script>alert(1)</script></div>',
      payload: '<script>alert(1)</script>',
    });
    assert.equal(result.validator, 'validateXssClaim');
    assert.equal(result.verdict, 'confirmed');
  });

  it('routes exec to Command Injection validator', () => {
    const result = validateVulnClaim('exec', {
      output: 'uid=0(root)',
      command: 'id',
    });
    assert.equal(result.validator, 'validateCommandInjection');
    assert.equal(result.verdict, 'confirmed');
  });

  it('routes fi to Path Traversal validator', () => {
    const result = validateVulnClaim('fi', {
      output: 'root:x:0:0',
      payload: '/etc/passwd',
    });
    assert.equal(result.validator, 'validatePathTraversal');
    assert.equal(result.verdict, 'confirmed');
  });

  it('falls back to weak-signal check for unknown classes', () => {
    const result = validateVulnClaim('unknown_class', {
      output: 'Testing for bypass...',
    });
    assert.match(result.validator, /fallback/i);
    // 'bypass' keyword with no concrete impact = weak = rejected
    assert.equal(result.verdict, 'rejected');
  });
});
