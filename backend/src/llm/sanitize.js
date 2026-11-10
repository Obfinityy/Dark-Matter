// Split out of ollama.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; ollama.js re-exports the public names so callers are unchanged.

// ---- Privacy gateway --------------------------------------------------------
// Strip secrets, tokens, and PII before anything reaches the model.
// Technique: Dark-Moon (technique only, no code copied).
const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,                    // OpenAI-style keys
  /ghp_[a-zA-Z0-9]{20,}/g,                   // GitHub tokens
  /xox[baprs]-[a-zA-Z0-9-]+/g,               // Slack tokens
  /AKIA[0-9A-Z]{16}/g,                       // AWS access keys
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
  /bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,        // Bearer tokens
  /password\s*[:=]\s*\S+/gi,                 // password assignments
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // emails
];

export function sanitizeForModel(text) {
  let out = String(text || '');
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, '[REDACTED]');
  }
  return out;
}
