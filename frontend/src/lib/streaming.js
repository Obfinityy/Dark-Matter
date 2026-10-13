// ============================================================================
// Simulated streaming for chat replies.
//
// The backend contract for chat is POST /api/v1/chat → { reply } (one shot).
// This module reveals the reply token-by-token so the UI already streams like
// a live conversation. When the backend later offers true SSE/WebSocket chat
// streaming, replace streamReveal() with a real stream reader — the ChatPage
// only depends on the (text, onToken) => Promise signature.
// ============================================================================

/** Yield progressively longer prefixes of `text`, word-grouped, with pacing. */
export async function streamReveal(text, onToken, opts = {}) {
  const chunkSize = opts.chunkSize || 3; // words per frame
  const delayMs = opts.delayMs || 24;
  const words = String(text || '').split(/(\s+)/);
  let current = '';
  let count = 0;
  for (const w of words) {
    current += w;
    count += 1;
    if (count % chunkSize === 0) {
      onToken(current);
      await sleep(delayMs);
    }
  }
  onToken(current);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
