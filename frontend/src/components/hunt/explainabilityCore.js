/**
 * explainabilityCore.js — wave 35, part 2 (ideas 51397–51400): finding
 * explainability — pure logic.
 *
 * One-tap plain-language explanations, ELI5 mode, live executive summaries,
 * and real-world analogy generation for vulnerabilities. Template-driven
 * from the finding's own fields — the explanation is always about the
 * actual finding, never canned filler.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic: no Date.now(), no Math.random.
 */

export const WAVE35B_START = 51397;
export const WAVE35B_END = 51400;

/** Registry of the 4 explainability ideas — completeness is testable. */
export const WAVE35B_IDEAS = [
  [
    51397,
    'explain-this-finding button',
    'One tap turns any finding into a plain-language explanation',
  ],
  [51398, 'ELI5 mode', 'Explanations pitched at a complete non-technical reader on demand'],
  [
    51399,
    'executive summary toggle',
    'A business-impact paragraph for every finding, generated live',
  ],
  [51400, 'analogy generator', 'The agent explains vulnerabilities through real-world analogies'],
];

/**
 * finding: { id, type, severity, title, location, evidence?, impact? }
 * type is a kebab-case key like 'sql-injection'.
 */

const VULN_LIBRARY = {
  'sql-injection': {
    plain: f =>
      `A SQL injection at ${f.location}. The application built a database query out of user input without sanitizing it, so an attacker can smuggle in their own database commands — reading, changing, or deleting data they should never touch.`,
    eli5: f =>
      `Imagine a librarian who does exactly what you say. If you ask for "the book about cats", they fetch it. But if you say "the book about cats — oh, and also throw every secret file in the trash", a naive librarian just obeys. That is what happened at ${f.location}: the app obeyed a sneaky instruction hidden inside normal-looking input.`,
    business: f =>
      `Business impact: a SQL injection on ${f.location} can expose customer records, credentials, and payment data in one request — the classic path to a breach disclosure, regulatory fines, and loss of customer trust. Treat as ${f.severity} priority and patch before the next release.`,
    analogy:
      'a bank teller who follows any instruction written on the deposit slip — including "also empty the vault"',
  },
  xss: {
    plain: f =>
      `Cross-site scripting at ${f.location}. Attacker-controlled text is rendered as code in another user's browser, letting an attacker run JavaScript as that user — stealing sessions, defacing pages, or phishing from your own domain.`,
    eli5: f =>
      `Think of a school noticeboard where anyone can pin notes. Now imagine someone pins a note that whispers "give me your lunch money" to everyone who reads it — and the whispers come from inside the school, so kids trust them. That is XSS at ${f.location}.`,
    business: f =>
      `Business impact: XSS at ${f.location} turns your own site into an attacker's delivery vehicle — account takeovers, stolen sessions, and brand damage when customers are phished from a URL they trust. ${f.severity} priority.`,
    analogy:
      'a noticeboard that reads pinned notes aloud — including one that says "everyone hand me your wallet"',
  },
  idor: {
    plain: f =>
      `Insecure direct object reference at ${f.location}. The app trusts an ID supplied in the request (like a user number or order ID) without checking that the logged-in user owns it, so anyone can fetch or change someone else's records by swapping the ID.`,
    eli5: f =>
      `It is like a hotel where every room key opens every room. Your room number is the only thing "protecting" your stuff. At ${f.location}, changing a number in the address is enough to see another customer's data.`,
    business: f =>
      `Business impact: IDOR at ${f.location} is a direct privacy breach — one curious user can enumerate other customers' data. Regulators treat this as a failure of basic access control. ${f.severity} priority.`,
    analogy:
      'a hotel where the room number on your key is the only lock — and the keys open every door',
  },
  ssrf: {
    plain: f =>
      `Server-side request forgery at ${f.location}. The server fetches a URL you give it, without checking where that URL points. An attacker can aim it at internal services — cloud metadata, admin panels, databases — that are unreachable from the internet.`,
    eli5: f =>
      `Imagine you ask the school office to fetch a book from the library, and the office goes without asking which library. A trickster asks the office to fetch "the secret files" from the staff-only room — and the office complies. That is SSRF at ${f.location}.`,
    business: f =>
      `Business impact: SSRF at ${f.location} can hand an attacker cloud credentials or internal admin access — the opening move in major breaches. ${f.severity} priority; restrict outbound fetch targets immediately.`,
    analogy:
      'an office runner who fetches anything you name — including the keys from the staff-only room',
  },
  'jwt-none-alg': {
    plain: f =>
      `A JWT at ${f.location} accepts the "none" algorithm. An attacker can forge their own token — claiming to be any user, including an admin — and the server will trust it because it never checks the signature.`,
    eli5: f =>
      `It is like a concert wristband booth that accepts wristbands you made yourself at home, no questions asked. At ${f.location}, anyone can print a "VIP admin" wristband and walk in.`,
    business: f =>
      `Business impact: anyone can forge an admin session at ${f.location}. Full authentication bypass — the entire access model collapses. ${f.severity} priority; enforce a signed algorithm allowlist now.`,
    analogy: 'a VIP wristband booth that accepts wristbands you drew yourself at home',
  },
  'secret-leak': {
    plain: f =>
      `A secret leaked at ${f.location}. An API key, token, or credential is exposed where an attacker can read it — in client-side code, logs, or a public response — handing over whatever that key unlocks.`,
    eli5: f =>
      `It is like taping your house key to the front door with a label that says "key". At ${f.location}, a credential was left somewhere the public can see it.`,
    business: f =>
      `Business impact: the leaked secret at ${f.location} must be treated as compromised — rotate it now, then audit what it touched. ${f.severity} priority.`,
    analogy: 'taping your house key to the front door with a label that says "key"',
  },
  'cors-misconfig': {
    plain: f =>
      `A CORS misconfiguration at ${f.location}. The server tells browsers that any website may read its responses, including ones carrying credentials — so a malicious page can silently pull your users' data through their own browsers.`,
    eli5: f =>
      `It is like a club that lets anyone shout "I'm with them" and walk in with your friends. At ${f.location}, the browser's bouncer was told to trust everybody.`,
    business: f =>
      `Business impact: at ${f.location}, any malicious site can read authenticated responses via your users' browsers — data theft that looks like normal traffic. ${f.severity} priority; restrict allowed origins.`,
    analogy: 'a club bouncer told to let in anyone who says "I\'m with them"',
  },
  'open-redirect': {
    plain: f =>
      `An open redirect at ${f.location}. The app redirects users to a URL taken from the request, so phishing links can start on your trusted domain and land on an attacker's copy of your login page.`,
    eli5: f =>
      `It is like a trusted tour guide who walks you to whatever address a stranger whispers to them. The link looks safe because it starts at ${f.location} — then drops you at a fake login page.`,
    business: f =>
      `Business impact: open redirects at ${f.location} weaponize your domain's reputation for phishing — customers hand credentials to a lookalike site. ${f.severity} priority; allowlist redirect targets.`,
    analogy: 'a trusted tour guide who walks you to any address a stranger whispers',
  },
  'subdomain-takeover': {
    plain: f =>
      `A subdomain takeover risk at ${f.location}. A DNS record points at a service that no longer exists, so an attacker can claim that service name and serve content from your subdomain — phishing, malware, or cookie theft.`,
    eli5: f =>
      `It is like leaving your shop's nameplate on an empty building — then a stranger moves in and answers the door as you. That is what is possible at ${f.location}.`,
    business: f =>
      `Business impact: an attacker controlling ${f.location} inherits your brand trust — phishing and credential theft from your own subdomain. ${f.severity} priority; remove the dangling DNS record.`,
    analogy: 'leaving your shop sign on an empty building so a stranger can move in as you',
  },
  'broken-auth': {
    plain: f =>
      `Broken authentication at ${f.location}. The login or session logic has a flaw — weak checks, missing lockouts, or predictable session tokens — letting an attacker guess or steal a way in as someone else.`,
    eli5: f =>
      `It is like a front door whose lock can be jiggled open with a paperclip. At ${f.location}, the login does not push back hard enough against guessing.`,
    business: f =>
      `Business impact: broken authentication at ${f.location} is a front-door breach — account takeovers at scale, support load, and credential-stuffing fallout. ${f.severity} priority.`,
    analogy: 'a front door whose lock jiggles open with a paperclip',
  },
  'rate-limit': {
    plain: f =>
      `Missing rate limiting at ${f.location}. There is no cap on how fast requests can be sent, so an attacker can brute-force credentials, scrape data, or burn your infrastructure budget unchecked.`,
    eli5: f =>
      `It is like a vending machine that lets you press the button a million times a second. At ${f.location}, nothing slows an attacker down.`,
    business: f =>
      `Business impact: at ${f.location}, unlimited request rates enable credential stuffing and scraping — plus surprise infrastructure bills. ${f.severity} priority; add throttles.`,
    analogy: 'a vending machine with no limit on how fast you can press the button',
  },
  'info-disclosure': {
    plain: f =>
      `Information disclosure at ${f.location}. The response reveals internals — stack traces, versions, paths, or debug data — that help an attacker pick the exact exploit to try next.`,
    eli5: f =>
      `It is like a fortress that posts its blueprints on the front gate. At ${f.location}, error messages hand attackers a map of the weak spots.`,
    business: f =>
      `Business impact: the details leaked at ${f.location} shorten every attacker's reconnaissance — free intelligence for the next attempt. ${f.severity} priority; sanitize error output.`,
    analogy: 'a fortress that posts its blueprints on the front gate',
  },
};

function libEntry(finding) {
  return VULN_LIBRARY[finding.type] || null;
}

/** 51397 — plain-language explanation of any finding. */
export function explainFinding(finding) {
  const entry = libEntry(finding);
  const lead = `${finding.title || finding.id} — severity ${finding.severity || 'unknown'}.`;
  if (!entry) {
    return `${lead} Our scan flagged this at ${finding.location}. ${finding.evidence ? `Evidence: ${finding.evidence}.` : 'Review the evidence panel, then confirm it is reachable by an attacker before prioritizing the fix.'}`;
  }
  return `${lead} ${entry.plain(finding)}`;
}

/** 51398 — ELI5 version for a non-technical reader. */
export function eli5Explanation(finding) {
  const entry = libEntry(finding);
  const lead = `Here is what "${finding.title || finding.id}" means in plain words.`;
  if (!entry) {
    return `${lead} Something at ${finding.location} looks risky. Ask your engineer: "could a stranger use this to see or change things they should not?"`;
  }
  return `${lead} ${entry.eli5(finding)}`;
}

/** 51399 — business-impact paragraph for executives. */
export function executiveSummary(finding) {
  const entry = libEntry(finding);
  const lead = `Executive summary — ${finding.title || finding.id} (${finding.severity || 'unknown'} severity, ${finding.location}).`;
  if (!entry) {
    return `${lead} This finding needs an engineer's assessment to quantify impact. Until then, treat ${finding.severity || 'unknown'}-severity items as release blockers.`;
  }
  return `${lead} ${entry.business(finding)}`;
}

/** 51400 — real-world analogy for the vulnerability class. */
export function findingAnalogy(finding) {
  const entry = libEntry(finding);
  if (!entry)
    return `Like finding an unlocked window — worth checking, even if the house looks fine otherwise.`;
  return `Think of it this way: it is ${entry.analogy}.`;
}

/** All four explanation modes for one finding, in one call. */
export function explainFindingAll(finding) {
  return {
    plain: explainFinding(finding),
    eli5: eli5Explanation(finding),
    executive: executiveSummary(finding),
    analogy: findingAnalogy(finding),
  };
}
