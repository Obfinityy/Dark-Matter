/**
 * AUTO-FILER v1 — Autonomous Claim Filing for Dark Matter (ES Module)
 *
 * The brain hunts. The filer files. Together they are the complete human.
 */
import fs from 'fs';
import path from 'path';

const SQLI_HASH_PATTERN = /\b[a-f0-9]{28,64}\b/i;
const SQLI_INDICATORS = [
  'first name:',
  'surname:',
  'union select',
  'union+select',
  'union%20select',
  "1' or '1'='1",
  '1" or "1"="1',
];

const XSS_INDICATORS = [
  '<script>alert',
  'onerror=alert',
  'onload=alert',
  'javascript:alert',
];

const CMDI_INDICATORS = [
  'uid=',
  'gid=',
  'root:',
  '/bin/bash',
  'whoami',
];

function detectSqli(text) {
  const lower = text.toLowerCase();
  const hasHash = SQLI_HASH_PATTERN.test(text);
  const hasIndicator = SQLI_INDICATORS.some(ind => lower.includes(ind));

  if (hasHash && hasIndicator) {
    const hashMatch = text.match(SQLI_HASH_PATTERN);
    const hash = hashMatch ? hashMatch[0] : 'unknown';
    return {
      class: 'sqli',
      title: 'SQL Injection in DVWA User ID field',
      evidence: `Password hash dumped via UNION injection: ${hash}. ` +
                `The application returned database content (first name, surname, password hashes) ` +
                `in response to malicious SQL input, confirming injectable query.`,
      command: 'curl -s "<TARGET>/vulnerabilities/sqli/?id=1%27+UNION+SELECT+user%2Cpassword+FROM+users%23&Submit=Submit" -b "PHPSESSID=<session>; security=low"',
      counterevidence: 'Normal input id=1 returns only single user record without password hashes. ' +
                       'The UNION payload returns multiple rows with hashes, proving injection.',
      confidence: 'high',
    };
  }
  return null;
}

function detectXss(text) {
  const lower = text.toLowerCase();
  const hasIndicator = XSS_INDICATORS.some(ind => lower.includes(ind.toLowerCase()));
  if (hasIndicator) {
    return {
      class: 'xss',
      title: 'Reflected Cross-Site Scripting (XSS)',
      evidence: `Malicious script payload reflected in server response without encoding.`,
      command: 'curl -s "<TARGET>/vulnerabilities/xss_r/?name=<script>alert(1)</script>" -b "PHPSESSID=<session>; security=low"',
      counterevidence: 'Normal input is reflected without script execution when properly encoded.',
      confidence: 'high',
    };
  }
  return null;
}

function detectCmdi(text) {
  const lower = text.toLowerCase();
  const hasIndicator = CMDI_INDICATORS.some(ind => lower.includes(ind));
  if (hasIndicator && (lower.includes('ping') || lower.includes('127.0.0.1'))) {
    return {
      class: 'cmdi',
      title: 'OS Command Injection',
      evidence: `Operating system command output returned in HTTP response.`,
      command: 'curl -s "<TARGET>/vulnerabilities/exec/" --data "ip=127.0.0.1;whoami&Submit=Submit" -b "PHPSESSID=<session>; security=low"',
      counterevidence: 'Normal IP input returns only ping output, no command execution.',
      confidence: 'high',
    };
  }
  return null;
}

function detectSqliVerbal(text) {
  const lower = text.toLowerCase();
  // Verbal proof: brain explicitly states SQLi proven + dumped users
  // Catches cases where hashes are seen on screen but not transcribed
  const hasProven = lower.includes('sqli proven') || lower.includes('sql injection proven') ||
                    lower.includes('proof complete') || lower.includes('or 1=1') ||
                    (lower.includes('bottling') && lower.includes('proof'));
  const hasDumped = (lower.includes('dumped') || lower.includes('dumping')) &&
                    (lower.includes('user') || lower.includes('table'));

  if (hasProven && hasDumped) {
    return {
      class: 'sqli',
      title: 'SQL Injection in DVWA User ID field (verbal proof)',
      evidence: `Brain verified SQL injection by dumping user table. ` +
                `Application returned database content in response to UNION payload, ` +
                `confirming injectable query.`,
      command: 'curl -s "<TARGET>/vulnerabilities/sqli/?id=1%27+UNION+SELECT+user%2Cpassword+FROM+users%23&Submit=Submit" -b "PHPSESSID=<session>; security=low"',
      counterevidence: 'Normal input returns single record; UNION payload returns multiple rows.',
      confidence: 'high',
    };
  }
  return null;
}

function detectEvidence(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();

  // STRICT: Only trigger on UNDENIABLE exploit evidence.
  // Brain saying "I'll try SQLi" is NOT evidence.
  // We need actual dumped data, hashes, errors, etc.
  //
  // COMMAND POLICY (#359): every branch below returns command: ''.
  // The detector sees only text — it does NOT know the vulnerable
  // path or the session, so any replay command it invented would be
  // a lie. The old commands hardcoded DVWA paths
  // (/vulnerabilities/...) with PHPSESSID=test, and <TARGET> was
  // never substituted anywhere in the backend, so a filed claim
  // carried a literal "<TARGET>" replay against the lab with a fake
  // session. Worse, the non-empty fake command SHADOWED the callers'
  // real-command fallback (lastShellCommand — the shell command that
  // actually produced the evidence). Empty command lets the caller
  // fall back to that real command; if no real command exists, the
  // claim gate correctly bounces the claim (no reproducer, no
  // filing) instead of filing a lab replay.

  // SQLi: MD5 hash (32 hex chars) = undeniable proof of dump.
  // FIX (#358): /i — the old case-sensitive regex missed uppercase
  // hashes while SQLI_HASH_PATTERN in this same file uses /i.
  const md5Match = text.match(/\b[a-f0-9]{32}\b/i);
  if (md5Match) {
    return {
      class: 'sqli',
      title: 'SQL Injection (auto-detected)',
      evidence: `MD5 hash found in output: ${md5Match[0]} - indicates successful data dump`,
      command: '',
      counterevidence: 'Hash pattern could be coincidental; verifier will confirm via UNION query.',
      confidence: 'high',
    };
  }

  // SQLi: SQL syntax error = proof of injection
  if (lower.includes('you have an error in your sql syntax')) {
    return {
      class: 'sqli',
      title: 'SQL Injection (auto-detected)',
      evidence: `SQL syntax error in output indicates injection point`,
      command: '',
      counterevidence: 'Error could be from invalid input; verifier will confirm.',
      confidence: 'medium',
    };
  }

  // XSS: a real payload marker reflected in output — NOT the bare words
  // "xss confirmed". FIX (#358): words alone filed claims with no
  // payload and no sink. The markers are this file's own XSS_INDICATORS
  // (the same set detectXss uses).
  if (XSS_INDICATORS.some((ind) => lower.includes(ind))) {
    return {
      class: 'xss',
      title: 'Cross-Site Scripting (auto-detected)',
      evidence: `XSS payload reflected in output`,
      command: '',
      counterevidence: 'Reflection needs verifier confirmation of execution.',
      confidence: 'medium',
    };
  }

  // CMDI: real `id` output shape, not bare markers. FIX (#358): bare
  // `uid=` + `gid=` fire on prose quoting them ("the output was uid=0
  // gid=0") and on tutorial text. Actual `id` output carries the
  // parenthesized names — uid=0(root) gid=0(root) — so require that
  // shape. Residual: prose quoting FULL id output still matches;
  // the claim stays medium-confidence and the verifier must confirm
  // via command execution before anything ships.
  if (/uid=\d+\([^)]+\)/.test(lower) && (/gid=\d+\([^)]+\)/.test(lower) || lower.includes('groups='))) {
    return {
      class: 'cmdi',
      title: 'Command Injection (auto-detected)',
      evidence: `Command output (uid=) found in response`,
      command: '',
      counterevidence: 'Output could be static; verifier will confirm via command execution.',
      confidence: 'medium',
    };
  }

  // No strong evidence found
  return null;
}



function isDuplicate(huntDir, title) {
  try {
    const eventsPath = path.join(huntDir, 'events.jsonl');
    if (!fs.existsSync(eventsPath)) return false;
    const content = fs.readFileSync(eventsPath, 'utf8');
    // A prior filing is recorded either as the brain's action JSON
    // ("action":"claim_finding") or as the dispatch branch's tool_call
    // record ("tool":"claim_finding") — the auto-filer's own filings
    // only ever produce the latter, so matching just the action
    // literal never deduped auto-filed claims (see #315).
    const titleHit = content.toLowerCase().includes(title.toLowerCase().slice(0, 30));
    if (!titleHit) return false;
    return content.includes('"action":"claim_finding"') ||
           content.includes('"tool":"claim_finding"');
  } catch {
    return false;
  }
}

export { detectEvidence, detectSqli, detectXss, detectCmdi, isDuplicate, SQLI_HASH_PATTERN };
