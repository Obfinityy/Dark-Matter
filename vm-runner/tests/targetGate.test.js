import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractHosts, checkCommandScope } from '../src/targetGate.js';

describe('extractHosts', () => {
  it('extracts hosts from URLs', () => {
    assert.deepEqual(extractHosts('curl http://example.com:8080/a?x=1'), ['example.com']);
    assert.deepEqual(extractHosts('https://user:pw@sub.example.com/path'), ['sub.example.com']);
  });

  it('extracts IPv4 literals', () => {
    assert.deepEqual(extractHosts('nmap -sV 10.0.2.15'), ['10.0.2.15']);
  });

  it('extracts bare domains but not filenames', () => {
    const hosts = extractHosts('nmap example.com && cat report.txt');
    assert.ok(hosts.includes('example.com'));
    assert.ok(!hosts.includes('report.txt'));
  });

  it('returns empty for hostless commands', () => {
    assert.deepEqual(extractHosts("echo admin' OR '1'='1"), []);
    assert.deepEqual(extractHosts('ls -la /home/kali'), []);
  });
});

describe('checkCommandScope', () => {
  it('allows the declared target and its subdomains', () => {
    assert.equal(checkCommandScope({ command: 'nmap example.com', target: 'example.com' }).allowed, true);
    assert.equal(
      checkCommandScope({ command: 'curl https://api.example.com/', target: 'example.com' }).allowed,
      true,
    );
  });

  it('always allows loopback and guest NAT ranges', () => {
    for (const cmd of [
      'curl http://127.0.0.1:1024/health',
      'curl http://localhost:8080/',
      'nmap 10.0.2.15',
      'ping 10.0.2.2',
    ]) {
      assert.equal(checkCommandScope({ command: cmd, target: 'example.com' }).allowed, true, cmd);
    }
  });

  it('denies out-of-scope hosts', () => {
    const r = checkCommandScope({ command: 'nmap evil-corp.com', target: 'example.com' });
    assert.equal(r.allowed, false);
    assert.match(r.reason, /outside the session's declared target/);
  });

  it('denies external hosts when no target is declared', () => {
    const r = checkCommandScope({ command: 'curl https://example.com/' });
    assert.equal(r.allowed, false);
    assert.match(r.reason, /declare a target/);
  });

  it('allows hostless commands without a target', () => {
    assert.equal(checkCommandScope({ command: 'ls -la' }).allowed, true);
  });

  it('does not confuse similar domains with the target', () => {
    const r = checkCommandScope({ command: 'curl http://example.com.evil.com/', target: 'example.com' });
    assert.equal(r.allowed, false);
  });
});
