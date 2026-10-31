// P1 scope enforcement — unit tests (node:test). No network access;
// DNS-dependent paths are exercised via structured destinations.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildScope,
  scopeFromMeta,
  extractDestinations,
  validateDestinations,
  guardCommand,
} from './scopeGuard.js';

const LAB = '172.17.0.1';
const dvwaScope = () =>
  buildScope({ target: 'http://172.17.0.1:3100', scope: '', labTargets: LAB });

describe('buildScope', () => {
  it('authorizes the lab target IP + explicit port via LAB_TARGETS', () => {
    const s = dvwaScope();
    assert.ok(s.labIps.includes('172.17.0.1'));
    assert.ok(s.ports.some((p) => p.port === 3100 && p.proto === 'tcp'));
  });

  it('defaults http(s) targets to tcp/80 + tcp/443', () => {
    const s = buildScope({ target: 'https://example.com', scope: '', labTargets: '' });
    assert.ok(s.ports.some((p) => p.port === 443 && p.proto === 'tcp'));
    assert.ok(s.ports.some((p) => p.port === 80 && p.proto === 'tcp'));
    assert.deepEqual(s.hosts, ['example.com']);
  });

  it('is frozen (immutable)', () => {
    const s = dvwaScope();
    assert.ok(Object.isFrozen(s));
    assert.ok(Object.isFrozen(s.hosts));
    assert.ok(Object.isFrozen(s.ports));
  });

  it('fail-closes a private target without lab cover', () => {
    const s = buildScope({ target: 'http://10.9.9.9:8080', scope: '', labTargets: '' });
    assert.deepEqual(s.labIps, []);
    assert.deepEqual(s.ips, []);
    const g = guardCommand({ command: 'curl http://10.9.9.9:8080/', scope: s });
    assert.equal(g.allowed, false);
  });

  it('scopeFromMeta prefers the persisted scope, falls back to build', () => {
    const persisted = dvwaScope();
    const fromMeta = scopeFromMeta({ scopeGuard: persisted, target: 'http://other/' }, 'http://other/');
    assert.equal(fromMeta, persisted);
    const built = scopeFromMeta({ target: 'http://172.17.0.1:3100' }, 'http://172.17.0.1:3100', LAB);
    assert.ok(built.labIps.includes('172.17.0.1'));
  });
});

describe('extractDestinations', () => {
  it('extracts URLs with scheme ports and SNI', () => {
    const d = extractDestinations(`curl -s 'https://example.com:8443/a?b=1'`);
    assert.equal(d.length, 1);
    assert.equal(d[0].host, 'example.com');
    assert.equal(d[0].port, 8443);
    assert.equal(d[0].protocol, 'https');
    assert.equal(d[0].sni, 'example.com');
  });

  it('defaults http port 80', () => {
    const d = extractDestinations('curl http://172.17.0.1:3100/login.php');
    assert.equal(d[0].port, 3100);
    assert.equal(d[0].sni, undefined);
  });

  it('extracts Host headers', () => {
    const d = extractDestinations(`curl -s -H 'Host: evil.example' http://172.17.0.1:3100/`);
    const hosts = d.map((x) => x.host);
    assert.ok(hosts.includes('evil.example'));
    assert.ok(hosts.includes('172.17.0.1'));
  });

  it('extracts bare IPs', () => {
    const d = extractDestinations('nmap -sV 172.17.0.1 2>/dev/null');
    assert.ok(d.some((x) => x.host === '172.17.0.1'));
  });

  it('returns [] for local-only commands', () => {
    assert.deepEqual(extractDestinations('echo hello > /tmp/x && ls -la'), []);
  });
});

describe('guardCommand — DVWA lab scope', () => {
  it('authorized target passes (curl + nmap forms)', () => {
    const s = dvwaScope();
    assert.equal(guardCommand({ command: `curl -s 'http://172.17.0.1:3100/login.php'`, scope: s }).allowed, true);
    assert.equal(guardCommand({ command: 'nmap -sV 172.17.0.1', scope: s }).allowed, true);
  });

  it('local commands with no destinations pass', () => {
    const s = dvwaScope();
    assert.equal(guardCommand({ command: 'echo hi && grep -r foo /tmp', scope: s }).allowed, true);
  });

  it('out-of-scope hostname blocked', () => {
    const s = dvwaScope();
    const g = guardCommand({ command: 'curl -s https://evil.com/steal', scope: s });
    assert.equal(g.allowed, false);
    assert.match(g.reason, /evil\.com/);
  });

  it('out-of-scope IP blocked', () => {
    const s = dvwaScope();
    const g = guardCommand({ command: 'curl -s http://93.184.216.34/', scope: s });
    assert.equal(g.allowed, false);
    assert.match(g.reason, /93\.184\.216\.34/);
  });

  it('unauthorized port on authorized IP blocked', () => {
    const s = dvwaScope();
    for (const cmd of ['curl http://172.17.0.1:22/', 'curl https://172.17.0.1:3306/x']) {
      const g = guardCommand({ command: cmd, scope: s });
      assert.equal(g.allowed, false, cmd);
      assert.match(g.reason, /not authorized/);
    }
  });

  it('redirect to unauthorized destination blocked', () => {
    const s = dvwaScope();
    const g = guardCommand({
      command: `curl -sL 'http://172.17.0.1:3100/go' # Location: https://evil.com/phish`,
      scope: s,
    });
    assert.equal(g.allowed, false);
    assert.match(g.reason, /evil\.com/);
  });

  it('cloud metadata blocked (IP and hostname)', () => {
    const s = dvwaScope();
    for (const cmd of [
      'curl -s http://169.254.169.254/latest/meta-data/',
      'curl -s http://metadata.google.internal/',
    ]) {
      const g = guardCommand({ command: cmd, scope: s });
      assert.equal(g.allowed, false, cmd);
    }
  });

  it('forged Host header to out-of-scope host blocked', () => {
    const s = dvwaScope();
    const g = guardCommand({
      command: `curl -s -H 'Host: evil.example' http://172.17.0.1:3100/`,
      scope: s,
    });
    assert.equal(g.allowed, false);
    assert.match(g.reason, /evil\.example/);
  });

  it('malformed input blocked (fail-closed)', () => {
    const s = dvwaScope();
    const g1 = guardCommand({
      command: 'x',
      destinations: [{ host: '', port: 80, protocol: 'tcp' }],
      scope: s,
    });
    assert.equal(g1.allowed, false);
    const g2 = guardCommand({
      command: 'x',
      destinations: [{ host: 'exa mple.com!!', port: 443, protocol: 'tcp' }],
      scope: s,
    });
    assert.equal(g2.allowed, false);
    assert.match(g2.reason, /malformed/);
  });

  it('missing scope fails closed', () => {
    const g = guardCommand({ command: 'curl http://172.17.0.1:3100/', scope: null });
    assert.equal(g.allowed, false);
    assert.match(g.reason, /fail-closed/);
  });
});

describe('shared-IP / hostname isolation', () => {
  const webScope = () =>
    buildScope({ target: 'https://allowed.example', scope: '', labTargets: '' });

  it('in-scope hostname allowed even though an out-of-scope hostname shares its IP', () => {
    const s = webScope();
    const g = guardCommand({
      command: 'x',
      destinations: [{ host: 'allowed.example', port: 443, protocol: 'tcp' }],
      scope: s,
    });
    assert.equal(g.allowed, true);
  });

  it('out-of-scope hostname on the SAME IP blocked — hostname decides', () => {
    const s = webScope();
    const g = guardCommand({
      command: 'x',
      destinations: [{ host: 'evil.example', port: 443, protocol: 'tcp' }],
      scope: s,
    });
    assert.equal(g.allowed, false);
    assert.match(g.reason, /evil\.example/);
  });

  it('subdomain of in-scope host allowed; explicit exclusion wins', () => {
    const s = buildScope({
      target: 'https://example.com',
      scope: 'In scope: example.com\nOut of scope: secret.example.com',
      labTargets: '',
    });
    const okSub = guardCommand({
      command: 'x',
      destinations: [{ host: 'app.example.com', port: 443, protocol: 'tcp' }],
      scope: s,
    });
    assert.equal(okSub.allowed, true);
    const blocked = guardCommand({
      command: 'x',
      destinations: [{ host: 'secret.example.com', port: 443, protocol: 'tcp' }],
      scope: s,
    });
    assert.equal(blocked.allowed, false);
    assert.match(blocked.reason, /out of scope/);
  });

  it('SNI mismatch blocked', () => {
    const s = webScope();
    const g = guardCommand({
      command: 'x',
      destinations: [{ host: 'allowed.example', port: 443, protocol: 'https', sni: 'evil.example' }],
      scope: s,
    });
    assert.equal(g.allowed, false);
    assert.match(g.reason, /SNI/);
  });

  it('wrong protocol on authorized tuple blocked', () => {
    const s = webScope();
    const g = guardCommand({
      command: 'x',
      destinations: [{ host: 'allowed.example', port: 443, protocol: 'udp' }],
      scope: s,
    });
    assert.equal(g.allowed, false);
    assert.match(g.reason, /not authorized/);
  });
});

describe('structured destinations (preferred path)', () => {
  it('uses caller-provided destinations instead of parsing', () => {
    const s = dvwaScope();
    const g = guardCommand({
      command: 'echo no-urls-here',
      destinations: [{ host: '172.17.0.1', port: 3100, protocol: 'tcp' }],
      scope: s,
    });
    assert.equal(g.allowed, true);
    assert.equal(g.destinations.length, 1);
  });

  it('DNS-resolved unauthorized destination blocked via structured path', () => {
    const s = dvwaScope();
    const g = guardCommand({
      command: 'curl <resolved-url>',
      destinations: [{ host: 'attacker.example', port: 443, protocol: 'tcp' }],
      scope: s,
    });
    assert.equal(g.allowed, false);
  });
});

describe('validateDestinations', () => {
  it('empty destination list is ok', () => {
    assert.deepEqual(validateDestinations([], dvwaScope()), { ok: true });
  });

  it('rejects invalid scope version', () => {
    const r = validateDestinations([{ host: 'x' }], { version: 99 });
    assert.equal(r.ok, false);
    assert.match(r.reason, /fail-closed/);
  });
});
