/**
 * actionIntent.js — parse "do X" vs "tell me X" intents from Infinity AI chat.
 *
 * The avatar distinguishes:
 *   - CHAT: "1+1 kitna hota hai?", "yeh kya hai?" → conversational answer
 *   - ACTION: "Notepad khol de", "WhatsApp khol de aur message kar de" → execute
 *
 * Actions are scope-checked: only safe, authorized operations execute.
 * Destructive or external actions require explicit user confirmation.
 */

// Action patterns: [regex, action type, description]
// Supports both "Notepad khol de" and "khol de Notepad" word orders.
const ACTION_PATTERNS = [
  // Open applications (safe local actions via computer control)
  {
    pattern:
      /(notepad).*?(?:khol\s*de|open|launch|start)|(?:khol\s*de|open|launch|start).*?(notepad)/i,
    action: 'open_app',
    app: 'notepad',
    safe: true,
  },
  {
    pattern:
      /(calculator|calc).*?(?:khol\s*de|open|launch|start)|(?:khol\s*de|open|launch|start).*?(calculator|calc)/i,
    action: 'open_app',
    app: 'calculator',
    safe: true,
  },
  {
    pattern:
      /(edge|browser|chrome).*?(?:khol\s*de|open|launch|start)|(?:khol\s*de|open|launch|start).*?(edge|browser|chrome)/i,
    action: 'open_app',
    app: 'browser',
    safe: true,
  },
  {
    pattern:
      /(whatsapp).*?(?:khol\s*de|open|launch|start)|(?:khol\s*de|open|launch|start).*?(whatsapp)/i,
    action: 'open_app',
    app: 'whatsapp',
    safe: true,
  },
  {
    pattern: /(youtube).*?(?:khol\s*de|open|launch)|(?:khol\s*de|open).*?(youtube)/i,
    action: 'open_url',
    url: 'https://youtube.com',
    safe: true,
  },

  // Messaging (requires confirmation — external action)
  {
    pattern: /(?:message|msg|send).*(?:kar\s*de|bhej\s*de|send)/i,
    action: 'send_message',
    safe: false,
    needsConfirm: true,
  },

  // System actions (require confirmation)
  {
    pattern: /(?:shutdown|restart|band\s*kar\s*de)/i,
    action: 'system',
    safe: false,
    needsConfirm: true,
  },
  {
    pattern: /(?:delete|erase|mita\s*de)\s+(.*)/i,
    action: 'delete',
    safe: false,
    needsConfirm: true,
  },
];

// Chat patterns — these are NEVER actions
const CHAT_PATTERNS = [
  /(?:kitna|kya|kaise|kyun|kab|kahan|kaun)/i, // questions
  /(?:bata|samjha|explain|tell me|what is)/i, // explain requests
  /^\s*(hi|hello|hey|namaste|ram ram)/i, // greetings
  /\?$/, // ends with question mark
];

/**
 * Parse a user message into { type: 'chat'|'action', action?, params?, needsConfirm? }
 */
export function parseIntent(message) {
  if (!message || typeof message !== 'string') {
    return { type: 'chat' };
  }

  const text = message.trim();

  // Check action patterns first
  for (const { pattern, action, ...rest } of ACTION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return {
        type: 'action',
        action,
        params: { ...rest, match: match.slice(1) },
        needsConfirm: rest.needsConfirm || false,
        safe: rest.safe !== false,
        originalText: text,
      };
    }
  }

  // Default: chat
  return { type: 'chat', originalText: text };
}

/**
 * Check if an action is allowed to execute.
 * Returns { allowed: boolean, reason?: string }
 */
export function checkActionScope(intent, userId) {
  if (intent.type !== 'action') {
    return { allowed: true };
  }

  // Block destructive actions without confirmation
  if (intent.needsConfirm) {
    return {
      allowed: false,
      reason: 'NEEDS_CONFIRM',
      message: 'Ye action bahar ki duniya ko affect karega. Confirm karo to execute karunga.',
    };
  }

  // Block unknown apps
  if (intent.action === 'open_app' && !intent.params.app) {
    return { allowed: false, reason: 'UNKNOWN_APP' };
  }

  return { allowed: true };
}

export const ACTION_TYPES = {
  OPEN_APP: 'open_app',
  OPEN_URL: 'open_url',
  SEND_MESSAGE: 'send_message',
  SYSTEM: 'system',
  DELETE: 'delete',
};
