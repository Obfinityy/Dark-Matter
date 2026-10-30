// QUOTING-ROBUSTNESS (31 Oct 2026) — repairShellQuoting.
//
// Seen live on h_6e909d3c1965 iter 22: the 8B brain emitted a SQLi probe
// whose payload quotes never closed; `sh -c` died with exit 2 and the
// probe was discarded as execution-failed before the verifier ever saw it.
//
// Asserted here (pure helper):
//   - balanced commands return byte-identical (the repair NEVER fires on
//     commands sh could already parse)
//   - the exact live failing command is repaired to a sh-parseable form
//     (checked with `sh -n`, not just our own scanner)
//   - already-quoted URLs are never re-wrapped
//   - $ and backticks inside a wrapped URL are escaped (no expansion)
//   - unrepairable shapes degrade to the close-the-dangling-quote fallback
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { repairShellQuoting } from './huntAgent.js';

// `sh -n` parses without executing — the closest thing to "would sh -c
// accept this" without running a probe.
const shParses = (cmd) => {
  try {
    execFileSync('sh', ['-n'], { input: cmd, stdio: ['pipe', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
};

test('balanced command is returned byte-identical', () => {
  const cmd = "curl -s -o /dev/null -w 'HTTP_CODE:%{http_code}' http://172.17.0.1:3100/login.php";
  assert.equal(repairShellQuoting(cmd), cmd);
  const quoted = 'curl "http://172.17.0.1:3100/login.php?username=\' OR 1=1--\'"';
  assert.equal(repairShellQuoting(quoted), quoted);
});

test('live failing SQLi probe is repaired to a sh-parseable command', () => {
  const broken = "curl -s -o /dev/null -w 'HTTP_CODE:%{http_code}' http://172.17.0.1:3100/login.php?username=' OR 1=1--'&password='";
  assert.equal(shParses(broken), false, 'original must fail sh -n (exit 2 live)');
  const fixed = repairShellQuoting(broken);
  assert.equal(
    fixed,
    `curl -s -o /dev/null -w 'HTTP_CODE:%{http_code}' "http://172.17.0.1:3100/login.php?username=' OR 1=1--'&password='"`,
  );
  assert.equal(shParses(fixed), true, 'repaired command must parse under sh -n');
});

test('dangling single quote with no URL is closed', () => {
  assert.equal(repairShellQuoting("echo 'hello"), "echo 'hello'");
  assert.ok(shParses(repairShellQuoting("echo 'hello")));
});

test('dangling double quote with no URL is closed', () => {
  assert.equal(repairShellQuoting('echo "hello'), 'echo "hello"');
});

test('already-quoted URL is not re-wrapped (balanced payload quote is literal)', () => {
  // The ' inside double quotes is literal — the command is already
  // balanced, so the repair must not fire at all.
  const cmd = `curl "http://172.17.0.1:3100/?a='b"`;
  assert.equal(repairShellQuoting(cmd), cmd);
});

test('dangling quote after a quoted URL is closed', () => {
  // Balanced double-quoted URL, but a stray ' after it unbalances the line.
  const cmd = `curl "http://172.17.0.1:3100/?a=b" --data 'x=1`;
  const fixed = repairShellQuoting(cmd);
  assert.equal(fixed, cmd + "'");
  assert.ok(shParses(fixed));
});

test('$ and backticks in a wrapped URL are escaped (no shell expansion)', () => {
  // Unbalanced trailing ' forces the repair; the wrapped URL must not
  // let $HOME expand or `id` execute inside the double quotes.
  const fixed = repairShellQuoting("curl http://x/?a=$HOME&b=`id'");
  assert.equal(fixed, 'curl "http://x/?a=\\$HOME&b=\\`id\'"');
  assert.ok(shParses(fixed));
});

test('URL with both quote kinds falls back to closing the dangling quote', () => {
  const cmd = `curl http://x/?a='b"c`;
  const fixed = repairShellQuoting(cmd);
  assert.equal(fixed, cmd + "'");
  assert.ok(shParses(fixed));
});

test('empty and quote-free inputs pass through', () => {
  assert.equal(repairShellQuoting(''), '');
  assert.equal(repairShellQuoting('nmap -sV 172.17.0.1'), 'nmap -sV 172.17.0.1');
});
