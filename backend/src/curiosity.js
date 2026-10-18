// Dark Matter — Curiosity Engine v2.
// Thinks like a HUMAN elite hacker, not a checklist runner.
//
// A human hacker:
//   1. UNDERSTANDS what the app does (it's a shop → money flows through carts;
//      it's a login → sessions and roles matter)
//   2. OBSERVES something interesting (a price in an API response, an ID in a URL)
//   3. WONDERS "what if..." (what if I change the price? what if I use someone else's ID?)
//   4. TESTS the idea with a targeted probe
//   5. LEARNS and follows the thread
//
// This module does two things:
//   - buildAppModel(): from recon, infer what the application DOES and where
//     the value/trust flows (the "mental model" a human builds in 2 minutes)
//   - generateHypotheses(): from observations + app model, produce human-like
//     "hmm, what if..." hypotheses with concrete next probes.

/**
 * Build a human-like mental model of the application from recon data.
 * A human looks at endpoints and thinks "ah, it's a shop" — then knows
 * instinctively where the money and trust boundaries are.
 */
export function buildAppModel(endpoints = [], techs = [], profile = '') {
  const eps = (endpoints || []).join(' ').toLowerCase();
  const model = {
    appType: 'unknown',
    // Where the VALUE flows (money, data, access) — a human's first question
    valueFlows: [],
    // Where TRUST boundaries are (auth, roles, ownership)
    trustBoundaries: [],
    // Things a human would instinctively poke at first
    instincts: [],
  };

  const has = (...words) => words.some((w) => eps.includes(w));

  // E-commerce / shop
  if (has('product', 'basket', 'cart', 'order', 'checkout', 'shop') || profile === 'ecommerce') {
    model.appType = 'ecommerce';
    model.valueFlows.push('money: product prices → basket → checkout → payment');
    model.valueFlows.push('inventory: stock quantities, product IDs');
    model.trustBoundaries.push('users must only see/modify their OWN basket and orders');
    model.trustBoundaries.push('prices should come from the server, never the client');
    model.instincts.push('Can I change the price in the basket?');
    model.instincts.push('Can I see or modify someone else\'s order?');
    model.instincts.push('Can I checkout with quantity 0 or negative?');
    model.instincts.push('Can I apply a coupon twice?');
  }

  // Auth / user management
  if (has('login', 'register', 'user', 'auth', 'session', 'password')) {
    if (model.appType === 'unknown') model.appType = 'webapp';
    model.trustBoundaries.push('authentication: who can log in as whom');
    model.trustBoundaries.push('authorization: what can each role do');
    model.instincts.push('Can I log in as someone else (SQLi, parameter tampering)?');
    model.instincts.push('Can a normal user reach admin endpoints?');
    model.instincts.push('What happens with weird inputs in login (quotes, JSON operators)?');
  }

  // Content / CMS
  if (has('article', 'post', 'comment', 'upload', 'media', 'file')) {
    if (model.appType === 'unknown') model.appType = 'content';
    model.valueFlows.push('content: who can publish, edit, delete what');
    model.trustBoundaries.push('users must only edit their OWN content');
    model.instincts.push('Can I upload a malicious file?');
    model.instincts.push('Can I edit someone else\'s post (IDOR)?');
  }

  // API-heavy / data
  if (has('/api/', '/rest/', 'graphql')) {
    model.trustBoundaries.push('every API endpoint must check WHO is calling');
    model.instincts.push('What happens if I call API endpoints directly, without the UI?');
    model.instincts.push('Are there hidden endpoints the UI never calls?');
  }

  if (model.appType === 'unknown') {
    model.appType = profile || 'webapp';
    model.instincts.push('What does this app DO? Map the main user flows first.');
  }

  return model;
}

/**
 * Format the app model for the AI prompt — the "2-minute human read".
 */
export function formatAppModelForPrompt(model) {
  if (!model) return '';
  const lines = ['--- HOW THIS APP WORKS (your mental model) ---'];
  lines.push(`It looks like: ${model.appType}`);
  if (model.valueFlows.length) {
    lines.push('Where the VALUE flows:');
    for (const v of model.valueFlows) lines.push(`  - ${v}`);
  }
  if (model.trustBoundaries.length) {
    lines.push('Where TRUST boundaries are (break these = real bugs):');
    for (const t of model.trustBoundaries) lines.push(`  - ${t}`);
  }
  if (model.instincts.length) {
    lines.push('A human hunter\'s first instincts here:');
    for (const i of model.instincts.slice(0, 5)) lines.push(`  - ${i}`);
  }
  return lines.join('\n');
}

/**
 * Generate human-like hypotheses from observations.
 * Not keyword matching — pattern recognition like a human does:
 * "I saw a price in a response... a human thinks: who controls that price?"
 */
export function generateHypotheses(observations, targetIntel) {
  const hypotheses = [];
  const seen = new Set();
  const push = (h) => {
    const key = h.hypothesis.slice(0, 60);
    if (!seen.has(key)) {
      seen.add(key);
      hypotheses.push(h);
    }
  };

  for (const obs of observations || []) {
    const raw = String(obs.output || obs.text || '');
    const text = raw.toLowerCase();

    // --- BUSINESS LOGIC signals (what a human notices) ---

    // Prices / money in responses — "who controls this number?"
    if (/\$\s?\d|price["']?\s*:\s*[\d."]|total["']?\s*:/i.test(raw)) {
      push({
        hypothesis: 'A price or total appeared in a response — who controls that number?',
        why: `Saw money-like data: ${raw.slice(0, 120)}`,
        test: 'Try changing the price/quantity in the next request; see if the server trusts it',
        priority: 10,
      });
    }

    // IDs in URLs or bodies — "can I use someone else's ID?"
    const idMatch = raw.match(/(\/|^|\?|&)(user|order|basket|account|profile)[-_/]?id["']?\s*[:=]\s*["']?(\w+)/i)
      || raw.match(/["'](userId|orderId|basketId|accountId)["']\s*:\s*["']?([^"',}\s]+)/i);
    if (idMatch) {
      push({
        hypothesis: `An object ID is visible (${idMatch[0].slice(0, 40)}) — can I swap it for someone else's?`,
        why: 'IDs in responses are classic IDOR signals; a human immediately wonders about other users\' objects',
        test: 'Replay the request with a different/guessed ID and compare responses',
        priority: 10,
      });
    }

    // Roles, admin flags — "am I really who I claim to be?"
    if (/\brole["']?\s*:\s*["']?(admin|user)|isAdmin|admin\s*[:=]\s*true/i.test(raw)) {
      push({
        hypothesis: 'Role information leaked — can I escalate my own role?',
        why: `Saw role data: ${raw.slice(0, 120)}`,
        test: 'Try tampering with role fields in requests; probe admin-only endpoints as a normal user',
        priority: 9,
      });
    }

    // Quantities, stock — "what about zero or negative?"
    if (/quantit|stock|amount["']?\s*:\s*\d/i.test(raw)) {
      push({
        hypothesis: 'A quantity is exposed — what happens with 0, negative, or huge values?',
        why: 'Humans instinctively test boundaries; quantity tampering breaks business logic',
        test: 'Send quantity 0, -1, and 999999; watch totals and stock behavior',
        priority: 9,
      });
    }

    // State transitions — "can I skip steps?"
    if (/status["']?\s*:\s*["']?(pending|processing|shipped|paid)|step|stage|workflow/i.test(raw)) {
      push({
        hypothesis: 'A state machine is visible — can I skip steps or go backwards?',
        why: 'Humans think in flows: what if I mark my own order as "paid"?',
        test: 'Try forcing state transitions directly via API (e.g., set status=paid)',
        priority: 8,
      });
    }

    // --- CLASSIC technical signals (still human, just sharper) ---

    // Errors — "the app is telling me something"
    if (text.includes('500') || /exception|stack trace|syntax error/i.test(text)) {
      push({
        hypothesis: 'The server errored — errors leak internals and mark injection points',
        why: `Observed: ${raw.slice(0, 100)}`,
        test: 'Vary the malformed input slightly; map which inputs trigger which errors',
        priority: 8,
      });
    }

    // Parameters — "every input is a question to the server"
    const params = raw.match(/[?&](\w+)=/g);
    if (params && params.length > 0) {
      const uniqueParams = [...new Set(params.map((p) => p.slice(1, -1)))].slice(0, 3);
      push({
        hypothesis: `Inputs ${uniqueParams.join(', ')} go to the server — what does it do with them?`,
        why: 'A human sees every parameter as a conversation with the backend worth testing',
        test: 'Probe each with a quote, a bracket, and a boolean — watch for differences, not just errors',
        priority: 7,
      });
    }

    // Slow responses — "is it thinking too hard about my input?"
    if (obs.duration && obs.duration > 5000) {
      push({
        hypothesis: 'That took suspiciously long — is my input being executed or queried?',
        why: `Response took ${obs.duration}ms`,
        test: 'Send a time-delay probe vs a normal one; a consistent gap means the input reaches a dangerous sink',
        priority: 7,
      });
    }

    // Secrets/tokens in output — "should I be seeing this?"
    if (/password|secret|api[_-]?key|token/i.test(text) && /["']\s*:\s*["'][^"']{8,}/.test(raw)) {
      push({
        hypothesis: 'Something secret-looking came back — should a user ever see this?',
        why: `Saw: ${raw.slice(0, 100)}`,
        test: 'Check if the value is real (use it) and whether other users\' secrets leak the same way',
        priority: 9,
      });
    }
  }

  return hypotheses.sort((a, b) => b.priority - a.priority);
}

/**
 * Format hypotheses for the AI planning prompt — as a human's notebook,
 * not a checklist.
 */
export function formatHypothesesForPrompt(hypotheses) {
  if (!hypotheses || hypotheses.length === 0) return '';
  const top = hypotheses.slice(0, 4);
  return (
    '\n--- YOUR NOTEBOOK (threads you found interesting) ---\n' +
    'These are YOUR OWN observations from poking at the app. Follow the one\n' +
    'that feels most promising — like a human following their nose.\n' +
    top.map(
      (h, i) =>
        `${i + 1}. ITCH: ${h.hypothesis}\n   WHY IT ITCHES: ${h.why}\n   SCRATCH IT BY: ${h.test}`
    ).join('\n')
  );
}

/**
 * Score how "interesting" an observation is to a human hunter.
 */
export function scoreInterestingness(observation) {
  let score = 0;
  const raw = String(observation.output || observation.text || '');
  const text = raw.toLowerCase();

  // Business-logic gold
  if (/\$\s?\d|price/i.test(raw)) score += 10;
  if (/userId|orderId|basketId/i.test(raw)) score += 10;
  if (/role|isAdmin/i.test(text)) score += 9;
  if (/quantit|stock/i.test(text)) score += 8;
  // Secrets
  if (/password|secret|token/i.test(text)) score += 8;
  // Errors that talk
  if (/exception|stack trace|sql/i.test(text)) score += 6;
  if (text.includes('500')) score += 5;
  // Slow = thinking
  if (observation.duration > 3000) score += 4;

  return score;
}
