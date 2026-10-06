/**
 * kaliToolRegistry.test.js — Kali tool catalog safety + hacker-brain picks.
 *
 * Run: cd backend && node --test tests/kaliToolRegistry.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  listTools,
  getTool,
  buildCommand,
  suggestTools,
  KALI_TOOLS,
} from '../src/engines/kaliToolRegistry.js';

describe('catalog', () => {
  it('lists real Kali tools across all hunt stages', () => {
    const names = KALI_TOOLS.map((t) => t.name);
    for (const expected of ['nmap', 'nikto', 'sqlmap', 'gobuster', 'nuclei', 'subfinder', 'wpscan', 'testssl.sh']) {
      assert.ok(names.includes(expected), `catalog should include ${expected}`);
    }
    const cats = new Set(KALI_TOOLS.map((t) => t.category));
    for (const c of ['recon', 'discovery', 'vuln-scan', 'injection', 'crypto']) {
      assert.ok(cats.has(c), `catalog should cover stage ${c}`);
    }
  });

  it('every autonomous tool has safe argv and documents dangerous flags', () => {
    for (const tool of KALI_TOOLS) {
      assert.ok(tool.description && tool.whenToUse, `${tool.name}: needs description + whenToUse`);
      assert.ok(Array.isArray(tool.dangerousFlags), `${tool.name}: must document dangerousFlags`);
      if (!tool.approvalRequired) {
        const args = tool.safeArgs('https://target.test');
        assert.ok(Array.isArray(args) && args.length > 0, `${tool.name}: safeArgs must return argv`);
        assert.ok(args.every((a) => typeof a === 'string'), `${tool.name}: argv must be strings`);
        assert.ok(!args.join(' ').match(/[;&|`$]/), `${tool.name}: safeArgs must not contain shell metacharacters`);
      }
    }
  });

  it('filters by category', () => {
    const recon = listTools({ category: 'recon' });
    assert.ok(recon.length > 0);
    assert.ok(recon.every((t) => t.category === 'recon'));
  });

  it('getTool is case-insensitive, null for unknown', () => {
    assert.equal(getTool('NMAP').name, 'nmap');
    assert.equal(getTool('nope'), null);
  });
});

describe('buildCommand', () => {
  it('builds a safe argv for nmap', () => {
    const cmd = buildCommand('nmap', 'target.test');
    assert.equal(cmd.bin, 'nmap');
    assert.ok(cmd.args.includes('target.test'));
    assert.ok(!cmd.args.join(' ').includes(';'));
  });

  it('rejects shell-injection targets', () => {
    assert.throws(() => buildCommand('nmap', 'target.test; rm -rf /'), /unsafe target/);
    assert.throws(() => buildCommand('nmap', '$(whoami)'), /unsafe target/);
    assert.throws(() => buildCommand('nmap', 'a`id`b'), /unsafe target/);
    assert.throws(() => buildCommand('nmap', ''), /unsafe target/);
  });

  it('accepts host, host:port, and full URLs', () => {
    assert.doesNotThrow(() => buildCommand('httpx', 'target.test'));
    assert.doesNotThrow(() => buildCommand('httpx', 'target.test:8443'));
    assert.doesNotThrow(() => buildCommand('httpx', 'https://target.test/app?q=1'));
  });

  it('refuses approval-gated tools for autonomous runs', () => {
    assert.throws(() => buildCommand('hydra', 'target.test'), /human approval/);
    assert.throws(() => buildCommand('john', 'target.test'), /human approval/);
  });

  it('throws for unknown tools', () => {
    assert.throws(() => buildCommand('notarealtool', 'target.test'), /Unknown Kali tool/);
  });

  it('sqlmap defaults are non-destructive (batch, low risk)', () => {
    const cmd = buildCommand('sqlmap', 'https://target.test/?id=1');
    assert.ok(cmd.args.includes('--batch'));
    assert.ok(cmd.args.includes('--risk=1'));
    assert.ok(!cmd.args.some((a) => a.includes('os-shell') || a.includes('dump')));
  });
});

describe('suggestTools', () => {
  it('suggests the recon starter kit for stage=recon', () => {
    const picks = suggestTools({ stage: 'recon', target: 'target.test' });
    const names = picks.map((p) => p.name);
    assert.ok(names.includes('nmap'));
    assert.ok(names.includes('subfinder'));
    assert.ok(names.includes('httpx'));
    assert.ok(picks[0].command && picks[0].command.bin === picks[0].name);
  });

  it('boosts wpscan when WordPress is hinted', () => {
    const picks = suggestTools({ stage: 'vuln-scan', techHints: ['wordpress'], target: 'target.test' });
    const wpscan = picks.find((p) => p.name === 'wpscan');
    assert.ok(wpscan, 'wpscan should be suggested');
    assert.match(wpscan.reason, /WordPress detected/);
  });

  it('boosts SMB tools when SMB ports are open', () => {
    const picks = suggestTools({ stage: 'smb', techHints: ['smb'], target: 'target.test' });
    assert.ok(picks.some((p) => p.name === 'enum4linux'));
  });

  it('never suggests approval-gated tools', () => {
    for (const stage of ['recon', 'discovery', 'vuln-scan', 'injection', 'crypto', 'smb', 'auth-test']) {
      const picks = suggestTools({ stage, target: 'target.test' });
      assert.ok(picks.every((p) => p.name !== 'hydra' && p.name !== 'john'), `stage ${stage}: no gated tools`);
    }
  });

  it('ranks by score, highest first', () => {
    const picks = suggestTools({ stage: 'vuln-scan', target: 'target.test' });
    for (let i = 1; i < picks.length; i++) {
      assert.ok(picks[i - 1].score >= picks[i].score, 'picks must be score-ordered');
    }
    assert.equal(picks[0].name, 'nuclei', 'nuclei is the workhorse scanner');
  });
});
