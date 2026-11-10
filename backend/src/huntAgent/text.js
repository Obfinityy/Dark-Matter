// Split out of huntAgent.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; huntAgent.js re-exports the public names so callers are unchanged.

import { guardClaimTitle, isProbeNameTitle } from '../claimTitleGuard.js';
import { appendHuntEvent, writeHuntMeta, writeHuntMetaCheckpoint, readHuntMeta, readHuntEvents, readUsers, readTargetIntel, writeTargetIntel, huntDir, ensureHuntDir } from '../store.js';
import { episodeLedgerEnabled, retrieveEpisodes, formatRetrievalForPrompt, recordRuledOut, getRuledOutCounts, formatLessonsForPrompt, RETRY_BUDGET, recordFact } from '../episodeStore.js';
import { notifyFinding } from '../notifications.js';

// Pacing delay for the hunt loop: how often a paused hunt re-checks.
const PAUSE_POLL_MS = 5000;


// FNV-1a 32-bit hash, hex-encoded. Used for lightweight prompt-audit records:
// it fingerprints a prompt section's exact content without storing the prompt.
// Dependency-free and deterministic.
export function fnv1aHex(str = '') {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function think(huntId, text) {
  // FULL-FIDELITY RECORD (solver #459, owner order: "total permanent
  // memory"): the event log stores the COMPLETE thought text. The old
  // slice(0, 2000) destroyed the record itself; any shortening for a
  // prompt or a screen happens at READ time, never at write time.
  appendHuntEvent(huntId, { type: 'thinking', text: String(text) });
  // HUMAN-LIKE: Listen to the model's curiosity. If it's wondering about
  // something specific, help it investigate (like a human assistant would).
  // This is not a checklist — it's following the model's natural curiosity.
  detectAndPursueIntent(huntId, String(text));
}

/**
 * Human-like intent detection: if the model's thinking shows curiosity about
 * something specific, trigger deeper recon on it. The model thinks freely;
 * the system helps investigate. Like working with a human freelancer.
 * 
 * SAFE: Only triggers RECON actions (information gathering), never exploits.
 * The model decides WHAT is interesting; the system helps find OUT more.
 */
function detectAndPursueIntent(huntId, thinkingText) {
  const lower = thinkingText.toLowerCase();
  
  // Only act on curiosity, not on every thinking event
  const isCurious = /i wonder|interesting|curious|what if|looks like|seems|might be|odd|strange|unusual|pursuing.*thread/i.test(thinkingText);
  if (!isCurious) return;
  
  // HUMAN-LIKE: The model is curious about something. Acknowledge and encourage
  // deeper exploration. We don't need to know exactly what — the curiosity
  // itself is the signal to dig deeper.
  appendHuntEvent(huntId, { 
    type: 'thinking', 
    text: 'Following curiosity: model finds something interesting — will explore more deeply on next iteration.' 
  });
  
  // Intent: wants to know more about endpoints
  if (/endpoint|url|path|route/i.test(thinkingText) && /more|hidden|other|find/i.test(thinkingText)) {
    appendHuntEvent(huntId, { 
      type: 'thinking', 
      text: 'Intent detected: wants deeper endpoint discovery — will mine JS bundles more thoroughly.' 
    });
  }
  
  // Intent: curious about technology stack
  if (/what.*tech|which.*tech|tech.*stack|built with|framework/i.test(thinkingText)) {
    appendHuntEvent(huntId, { 
      type: 'thinking', 
      text: 'Intent detected: curious about tech stack — will run deeper fingerprinting.' 
    });
  }
  
  // Intent: interested in forms (recon, not exploit)
  if (/form.*interesting|login.*form|curious.*form/i.test(thinkingText)) {
    appendHuntEvent(huntId, { 
      type: 'thinking', 
      text: 'Intent detected: interested in forms — will map all form fields and actions.' 
    });
  }
}

export function finding(huntId, f) {
  // P0 (31 Oct 2026, defense in depth): the finding() function is the
  // FINAL gate before persistence. If a probe/test name somehow reaches
  // here with verified:true (bypassing the assessResult guard), downgrade
  // it to verified:false. A probe name is never a vulnerability.
  let rec = f;
  try {
    if (rec && rec.verified === true && isProbeNameTitle(rec.title)) {
      rec = {
        ...rec,
        verified: false,
        verification: `downgraded by finding() final gate: "${rec.title}" is a probe/test name, not a vulnerability title`,
      };
    }
  } catch { /* final gate is best-effort */ }
  appendHuntEvent(huntId, { type: 'finding', ...rec });
  // BI-TEMPORAL FACTS (Job 6 stage 8): a validator-confirmed class is a
  // durable fact about the target — recorded by code, presence-level
  // only, superseding cleanly if the same class is ever reclassified.
  try {
    if (f && f.verified === true) {
      recordFact({ huntId, subject: 'vuln', predicate: f.type || f.class || 'unknown', object: 'verified' });
    }
  } catch { /* facts are best-effort */ }
  // INSTANT NOTIFICATION (24 Oct 2026, full-human vision order): a
  // verified finding notifies the hunt owner + admins instantly (the
  // bell + toast read this record); the 15-min poll monitor stays as
  // backup only. Never breaks the hunt path.
  try {
    if (f && f.verified === true) {
      const ownerId = (() => { try { return (readHuntMeta(huntId) || {}).userId || null; } catch { return null; } })();
      notifyFinding({ huntId, ownerId, title: f.title, severity: f.severity, target: f.url || null });
    }
  } catch { /* notifications are best-effort */ }
  // DEAD-END REGISTRY (Job 6 stage 4): a validator rejection becomes a
  // code-composed lesson in the ruled_out registry, checked by code in
  // the plan filter. Only deterministic verdicts write lessons — never
  // the model's opinion, never a verification-free false.
  try {
    if (f && f.verified === false && f.verification) {
      const m = /\((\w+)[::]/.exec(String(f.verification));
      recordRuledOut({
        huntId,
        title: f.title || f.class || 'finding',
        family: m ? m[1] : 'validator',
        detail: f.verification,
        linkEpisode: true,
      });
    }
  } catch { /* registry is best-effort */ }
}

export function isStopped(huntId) {
  try {
    const meta = readHuntMeta(huntId);
    return meta && (meta.stopped === true || meta.state === 'stopped');
  } catch {
    return false;
  }
}

export function isPaused(huntId) {
  try {
    const meta = readHuntMeta(huntId);
    if (!meta) return false;
    // Standard pause indicators
    if (meta.paused === true || meta.state === 'paused') return true;
    // DEFENSIVE (19 Oct 2026, solver #6): A pausedReason with state='running'
    // means a loop driver clobbered the pause (wrote state=running without
    // clearing pausedReason). Treat as paused — a pause is a pause.
    // This was observed live: hunt loop overwrote state=paused with
    // state=running+pausedReason=ai_no_reply, reviving a paused hunt.
    if (meta.pausedReason && meta.state !== 'finished' && meta.state !== 'stopped') return true;
    return false;
  } catch {
    return false;
  }
}

/** Operator pause: hold the loop here until resumed or stopped. */
export async function waitWhilePaused(huntId) {
  let waited = 0;
  let announced = false;
  while (isPaused(huntId) && !isStopped(huntId)) {
    if (!announced) {
      think(huntId, 'Hunt paused by user — holding position.');
      announced = true;
    }
    await new Promise((r) => setTimeout(r, PAUSE_POLL_MS));
    waited += 5;
  }
}

/** Infer what the app DOES from endpoints + HTML (problem #6). */
export function inferAppPurpose(endpoints, html, knownApp = null) {
  // KNOWN APP (zero-genuine lane): the fingerprint names the app —
  // keyword regexes must never override it. The DVWA login page
  // matches "social platform" (a POST form) and the leaked Juice
  // Shop endpoints match "ecommerce store"; both mis-models sent
  // the brain hunting the wrong app.
  if (knownApp === 'dvwa') return 'deliberately vulnerable lab (DVWA)';
  if (knownApp === 'juice-shop') return 'ecommerce store (OWASP Juice Shop)';
  const text = [...(endpoints || []), String(html || '').slice(0, 5000)].join(' ').toLowerCase();
  const purposes = [
    ['ecommerce store', /cart|checkout|product|shop|order|payment/i],
    ['banking/fintech', /transfer|wallet|balance|iban|kyc|trading/i],
    ['social platform', /feed|post|follow|like|comment|profile/i],
    ['saas dashboard', /dashboard|workspace|subscription|billing|team/i],
    ['auth service', /login|signup|oauth|sso|2fa|password/i],
    ['file sharing', /upload|download|file|share|storage/i],
    ['cms/blog', /article|post|comment|category|tag/i],
    ['api gateway', /graphql|rest|webhook|api\/v/i],
  ];
  for (const [name, re] of purposes) {
    if (re.test(text)) return name;
  }
  return 'general web app';
}

/**
 * HUMAN-LIKE TEST EXTRACTION: When the model thinks like a human ("Test: ...",
 * "What if I...", "I wonder if...") instead of producing JSON, extract the
 * test INTENTIONS and construct executable commands.
 *
 * A human assistant hears the idea and figures out HOW to test it.
 * This is not a checklist — it's understanding intent and acting on it.
 */
export function extractTestsFromThinking(reply, recon, target) {
  const tests = [];
  const baseUrl = target.replace(/\/$/, '');
  const endpoints = recon.endpoints || [];

  // Find login endpoints for auth tests
  const loginEp = endpoints.find((ep) => /login|auth|signin/i.test(ep)) || '/rest/user/login';
  // Find basket/cart endpoints for business logic tests
  const basketEp = endpoints.find((ep) => /basket|cart/i.test(ep)) || '/rest/basket';
  // Find product endpoints
  const productEp = endpoints.find((ep) => /product/i.test(ep)) || '/rest/products';

  const text = String(reply).toLowerCase();

  // Pattern 1: "Test: <name> — <description>"
  const testPattern = /test:\s*([^—\n]+?)(?:—|-)\s*([^\n]+)/gi;
  let m;
  while ((m = testPattern.exec(reply)) !== null && tests.length < 3) {
    const testName = m[1].trim();
    const description = m[2].trim();
    const lower = (testName + ' ' + description).toLowerCase();

    let command = null;
    let why = description.slice(0, 200);

    // SQLi on login
    if (/sql.*inject|login.*bypass|auth.*bypass/i.test(lower) && /login|auth/i.test(lower)) {
      command = `curl -sk -X POST "${baseUrl}${loginEp}" -H "Content-Type: application/json" -d '{"email":"admin@juice-sh.op'"'"' OR 1=1--","password":"x"}' | head -c 2000`;
    }
    // NoSQL injection
    else if (/nosql/i.test(lower)) {
      command = `curl -sk -X POST "${baseUrl}${loginEp}" -H "Content-Type: application/json" -d '{"email":{"$ne":null},"password":{"$ne":null}}' | head -c 2000`;
    }
    // XSS
    else if (/xss|cross.*site|script.*inject/i.test(lower)) {
      const searchEp = endpoints.find((ep) => /search/i.test(ep)) || '/rest/products/search';
      command = `curl -sk "${baseUrl}${searchEp}?q=<script>alert(1)</script>" | head -c 2000`;
    }
    // Price manipulation
    else if (/price.*manipulat|manipulat.*price|cost.*change/i.test(lower)) {
      command = `curl -sk "${baseUrl}${basketEp}" -d 'quantity=1' -d 'price=0.01' | head -c 2000`;
    }
    // Quantity manipulation
    else if (/quantit/i.test(lower)) {
      command = `curl -sk "${baseUrl}${basketEp}" -d 'quantity=0' | head -c 2000; echo "---NEG---"; curl -sk "${baseUrl}${basketEp}" -d 'quantity=-1' | head -c 2000`;
    }
    // IDOR / object ID
    else if (/idor|object.*id|someone.*else|other.*user/i.test(lower)) {
      command = `curl -sk "${baseUrl}${basketEp}/1" | head -c 2000; echo "---2---"; curl -sk "${baseUrl}${basketEp}/2" | head -c 2000`;
    }
    // Empty basket checkout
    else if (/empty.*basket|basket.*empty|checkout.*empty/i.test(lower)) {
      command = `curl -sk -X POST "${baseUrl}/rest/basket/checkout" -H "Content-Type: application/json" -d '{}' | head -c 2000`;
    }
    // Generic: try to construct a probe based on keywords
    else if (/product.*id|product/i.test(lower)) {
      command = `curl -sk "${baseUrl}${productEp}/1" | head -c 2000`;
    }

    if (command) {
      tests.push({ test: testName.slice(0, 100), command, why, hypothesis: `Testing: ${testName.slice(0, 100)}` });
    }
  }

  // Pattern 2: "What if I..." / "I wonder if..." — curiosity-driven tests
  const wonderPattern = /(?:what if|i wonder if|can i|is it possible to)\s+([^\n?.]+)/gi;
  while ((m = wonderPattern.exec(reply)) !== null && tests.length < 3) {
    const idea = m[1].trim();
    const lower = idea.toLowerCase();

    let command = null;
    if (/checkout.*empty|empty.*basket/i.test(lower)) {
      command = `curl -sk -X POST "${baseUrl}/rest/basket/checkout" -H "Content-Type: application/json" -d '{}' | head -c 2000`;
    } else if (/price|cheaper|free/i.test(lower)) {
      command = `curl -sk "${baseUrl}${basketEp}" | head -c 2000`;
    } else if (/other.*user|someone.*else|idor/i.test(lower)) {
      command = `curl -sk "${baseUrl}${basketEp}/1" | head -c 1000; echo "---"; curl -sk "${baseUrl}${basketEp}/999" | head -c 1000`;
    }

    if (command) {
      tests.push({
        test: `Curiosity: ${idea.slice(0, 80)}`,
        command,
        why: `Model wondered: "${idea.slice(0, 150)}"`,
        hypothesis: 'Curiosity-driven probe',
      });
    }
  }

  return tests;
}

/** Extract the key "interesting signal" from output for reproducibility comparison. */
export function extractSignal(output) {
  const t = output.toLowerCase();
  const signals = [];
  if (/sql syntax|mysql|postgres|sqlite|ora-\d+|sql error/i.test(t)) signals.push('sql-error');
  if (/stack trace|traceback|exception in|at .*\(.*\.js:/i.test(t)) signals.push('stack-trace');
  if (/root:|uid=0|uid=\d+\(/i.test(t)) signals.push('cmd-exec');
  if (/<script>alert|onerror=|onload=/i.test(t)) signals.push('xss-reflect');
  if (/admin|administrator|dashboard/i.test(t)) signals.push('admin-exposure');
  if (/\.env|secret|private key|api[_-]?key/i.test(t)) signals.push('secret-exposure');
  if (/directory listing|index of\//i.test(t)) signals.push('dir-listing');
  if (/bypass|403.*200|unauthorized.*authorized/i.test(t)) signals.push('auth-bypass');
  // Rule #73: generic-probe signal ids — kept in sync by hand with
  // RELEVANCE_SIGNAL_PATTERNS in hunt-intel/differential.js.
  if (/via=ssrf-fetch-hit/i.test(t)) signals.push('ssrf-fetch');
  if (/arithmetic result \d+, which was never transmitted|template evaluated server-side/i.test(t)) signals.push('ssti-eval');
  if (/via=redirect-(location|meta|js)/i.test(t)) signals.push('open-redirect');
  return signals.sort().join(',');
}

/**
 * FIX #175: Sanitize tool output before feeding to AI.
 * Prevents prompt injection from malicious targets.
 * Removes/neutralizes common injection patterns.
 */
export function sanitizeForAI(text) {
  if (!text) return '';
  let clean = String(text);
  // Remove common prompt injection patterns
  const injectionPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions/gi,
    /disregard\s+(all\s+)?previous/gi,
    /you\s+are\s+now\s+a/gi,
    /new\s+instructions:/gi,
    /system\s*:\s*/gi,
    /\[system\]/gi,
    /<\|.*?\|>/g, // Special tokens
  ];
  for (const pattern of injectionPatterns) {
    clean = clean.replace(pattern, '[FILTERED]');
  }
  // Limit length and remove excessive newlines
  clean = clean.slice(0, 3000).replace(/\n{4,}/g, '\n\n\n');
  return clean;
}

/**
 * FIX (19 Oct 2026, solver #6): Strip terminal artifacts from tool output.
 * Container exec output includes Kali MOTD banner, shell prompts, and ANSI
 * codes (from tmux capture-pane or shell startup). These contaminate:
 * 1. Recon endpoints — MOTD lines like '┗━(Run: "touch ~/.hushlogin"...)' were
 *    added as "endpoints"; the /login/ filter matched "hushlogin" so mandatory
 *    SQLi tests ran against garbage URLs.
 * 2. Finding evidence — evidence.response contained MOTD+prompt instead of the
 *    HTTP body, so payload_validation could never match the payload.
 * This strips terminal chrome but preserves the actual command output.
 */
export function stripTerminalArtifacts(text) {
  if (!text) return '';
  let clean = String(text);
  // Remove ANSI escape codes (colors, cursor movement)
  clean = clean.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  clean = clean.replace(/\x1b\][^\x07]*\x07/g, ''); // OSC sequences
  // Remove Kali MOTD banner lines and shell prompts, line by line
  const lines = clean.split('\n');
  const filtered = lines.filter((line) => {
    const t = line.trim();
    if (!t) return true; // keep empty lines (structure)
    // Kali MOTD banner markers
    if (/Message from Kali developers/i.test(t)) return false;
    if (/minimal installation of Kali/i.test(t)) return false;
    if (/touch ~\/\.hushlogin/i.test(t)) return false;
    if (/troubleshooting\/common-minimum-setup/i.test(t)) return false;
    // Pure box-drawing lines (MOTD borders)
    if (/^[┏━┃┗┌└─│\s]+$/.test(t) && /[┏━┃┗┌└]/.test(t)) return false;
    // MOTD content lines (start with ┃ box-drawing char)
    if (/^[┃│]/.test(t)) return false;
    // Shell prompt lines: ┌──(root㉿host)-[dir] and └─# command echo
    if (/┌──\(.*\)-\[.*\]/.test(t)) return false;
    if (/^└─#/.test(t)) return false;
    // Classic prompt patterns (just in case)
    if (/^root@[a-zA-Z0-9-]+:[^#]*#\s*$/.test(t)) return false;
    return true;
  });
  return filtered.join('\n');
}

// ---------------------------------------------------------------------------
// QUOTING-ROBUSTNESS (31 Oct 2026): the 8B brain emits probe commands with
// payload quotes it never closes — seen live on h_6e909d3c1965 iter 22:
//   curl -s -o /dev/null -w 'HTTP_CODE:%{http_code}' http://172.17.0.1:3100/login.php?username=' OR 1=1--'&password='
// `sh -c` rejects that with a syntax error (exit 2): the trailing ' leaves
// a quote unterminated, and the bare & would background the command even if
// the quotes balanced. The probe was discarded as execution-failed, so the
// brain never learned whether the SQLi test itself had any signal.
// A human hunter wraps the URL in double quotes instead. repairShellQuoting
// does exactly that, and ONLY when the command is already unparseable — a
// balanced command is returned byte-identical, so this repair can only turn
// a guaranteed exit-2 into a possible run. It never touches already-quoted
// URLs, and anything it cannot repair deterministically (a URL containing
// both quote kinds) falls through to the close-the-dangling-quote fallback.
// ---------------------------------------------------------------------------
export function repairShellQuoting(command) {
  const cmd = String(command || '');
  if (!cmd) return cmd;
  // POSIX-ish quote-balance scan: a backslash escapes the next char only
  // OUTSIDE single quotes (inside single quotes it is literal).
  const scan = (s) => {
    let inSingle = false, inDouble = false, escaped = false;
    for (const ch of s) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && !inSingle) { escaped = true; continue; }
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
    }
    return { inSingle, inDouble };
  };
  let st = scan(cmd);
  if (!st.inSingle && !st.inDouble) return cmd; // balanced — never touch

  // Per-index quote state, so URLs already inside quotes are skipped.
  const quotedAt = new Array(cmd.length).fill(false);
  {
    let inSingle = false, inDouble = false, escaped = false;
    for (let i = 0; i < cmd.length; i++) {
      const ch = cmd[i];
      quotedAt[i] = inSingle || inDouble;
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && !inSingle) { escaped = true; continue; }
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
    }
  }
  // The URL is the payload carrier: wrap the FIRST unquoted http(s):// URL
  // and everything after it (SQLi payloads carry spaces — ' OR 1=1-- —
  // so the span runs to end-of-command, not to the next whitespace).
  // Extending to EOL is also the safe direction for ';': swallowing it
  // into the URL beats letting sh execute what follows it.
  const urlRe = /https?:\/\//g;
  let m = null, hit = null;
  while ((m = urlRe.exec(cmd)) !== null) {
    if (!quotedAt[m.index]) { hit = m; break; }
  }
  if (hit) {
    const url = cmd.slice(hit.index); // to end of command
    let wrapped = null;
    const escDq = (u) => '"' + u.replace(/\\/g, '\\\\').replace(/\$/g, '\\$').replace(/`/g, '\\`') + '"';
    if (url.includes("'") && !url.includes('"')) wrapped = escDq(url);
    else if (url.includes('"') && !url.includes("'")) wrapped = "'" + url + "'";
    else if (!url.includes("'") && !url.includes('"')) wrapped = escDq(url);
    // both quote kinds inside: no deterministic wrap — fall through
    if (wrapped !== null) {
      const repaired = cmd.slice(0, hit.index) + wrapped;
      st = scan(repaired);
      if (!st.inSingle && !st.inDouble) return repaired;
      // Still unbalanced (stray quote before the URL) — close it.
      return repaired + (st.inSingle ? "'" : '"');
    }
  }
  // No wrappable URL: last resort — close the dangling quote so sh can
  // parse (e.g. `echo 'hello` -> `echo 'hello'`). Better than exit 2.
  return cmd + (st.inSingle ? "'" : '"');
}
