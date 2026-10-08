import { config } from '../../config.js';
import {
  PhoneLocalProvider,
  normalizeMessagesForPhone,
  stripThinkingTags,
} from '../../agent/providers/phoneLocalProvider.js';
import { localAIQueue } from '../../agent/providers/localAiQueue.js';

/**
 * PhoneModelAdapter — the ONLY place that talks to the phone-hosted Gemma for
 * long-context operations. Wraps the existing LocalAIQueue and
 * PhoneLocalProvider (phone remains the actual local provider; no cloud fallback).
 *
 * Responsibilities:
 *  - enqueue every call through the existing LocalAIQueue (protects the phone)
 *  - retry transient upstream failures (429/503) with real backoff
 *  - on "context too large" failures, throw ContextWindowError so the engine
 *    can shrink the *application-level* context and retry
 *  - report finish_reason so the continuation engine can detect truncation
 *  - NEVER fake a 429: the queue serializes requests; upstream statuses are
 *    propagated honestly.
 */

export class ContextWindowError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'ContextWindowError';
    this.code = 'CONTEXT_WINDOW_EXCEEDED';
    this.detail = detail;
  }
}

/** Errors that are worth retrying (phone busy / temporarily unavailable). */
function isRetryable(status) {
  return status === 429 || status === 503;
}

/** Errors that indicate the prompt exceeded the model's real context window. */
function isContextOverflow(status, body) {
  if (
    status === 500 &&
    (body.includes('Tokenization failed') ||
      body.includes('prompt too long') ||
      body.includes('context'))
  ) {
    return true;
  }
  if (
    status === 400 &&
    (body.includes('prompt too long') ||
      body.includes('max context') ||
      body.includes('context window'))
  ) {
    return true;
  }
  return false;
}

class PhoneModelAdapter {
  constructor({ provider = null, queue = null } = {}) {
    this.provider = provider || new PhoneLocalProvider(config);
    this.queue = queue || localAIQueue;
  }

  get enabled() {
    return this.provider.enabled;
  }

  /**
   * Run a chat completion against the phone model.
   *
   * @param {Array<{role,content}>} messages bounded prompt
   * @param {object} [options]
   * @param {number} [options.maxTokens]      output token cap for this call
   * @param {number} [options.timeoutMs]      per-attempt timeout
   * @param {number} [options.maxAttempts]    retry attempts for transient errors
   * @param {(info:object)=>void} [options.onAttempt] retry/attempt observer
   * @returns {Promise<{ text: string, finishReason: string|null, raw: object }>}
   */
  async complete(messages, options = {}) {
    const maxTokens = options.maxTokens || 768;
    const timeoutMs =
      options.timeoutMs || parseInt(process.env.PHONE_AI_GENERATION_TIMEOUT_MS || '3600000', 10);
    const maxAttempts = options.maxAttempts || 8;
    const onAttempt = options.onAttempt || (() => {});

    return this.queue.enqueue(async () => {
      let attempt = 0;
      // Local mutable copy of the message list; on context overflow the engine
      // shrinks application context and calls again (new enqueue), so inside a
      // single call we only handle transient retries.
      let lastError = null;

      const activeModel = await this.provider.resolveModel();
      const safeMessages = normalizeMessagesForPhone(messages);
      while (attempt < maxAttempts) {
        attempt += 1;
        try {
          const fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: activeModel,
              messages: safeMessages,
              max_tokens: maxTokens,
            }),
            signal: AbortSignal.timeout(timeoutMs),
          };
          if (this.provider.apiKey && this.provider.apiKey !== 'no-key-required') {
            fetchOptions.headers['Authorization'] = `Bearer ${this.provider.apiKey}`;
          }

          const res = await fetch(`${this.provider.baseUrl}/chat/completions`, fetchOptions);

          if (res.ok) {
            const data = await res.json();
            const choice = data?.choices?.[0];
            const rawText = choice?.message?.content || '';
            return {
              text: stripThinkingTags(rawText),
              finishReason: choice?.finish_reason || null,
              raw: data,
            };
          }

          const errorBody = await res.text();

          if (isContextOverflow(res.status, errorBody)) {
            // Adaptive prompt reduction retry if phone LLM context overflows
            if (safeMessages.length > 0) {
              const lastMsg = safeMessages[safeMessages.length - 1];
              const trimmedContent =
                typeof lastMsg.content === 'string'
                  ? lastMsg.content.slice(0, 1200) +
                    '\n\n[... Prompt trimmed to fit phone memory ...]'
                  : lastMsg.content;
              const fallbackMessages = [{ role: 'user', content: trimmedContent }];

              try {
                const fallbackOptions = {
                  ...fetchOptions,
                  body: JSON.stringify({
                    model: activeModel,
                    messages: fallbackMessages,
                    max_tokens: Math.min(maxTokens, 512),
                  }),
                };
                const fallbackRes = await fetch(
                  `${this.provider.baseUrl}/chat/completions`,
                  fallbackOptions
                );
                if (fallbackRes.ok) {
                  const data = await fallbackRes.json();
                  const choice = data?.choices?.[0];
                  return {
                    text: choice?.message?.content || '',
                    finishReason: choice?.finish_reason || null,
                    raw: data,
                  };
                }
              } catch (e) {}
            }

            throw new ContextWindowError('Prompt exceeded the local model context window', {
              upstreamStatus: res.status,
              body: errorBody.slice(0, 300),
            });
          }

          if (isRetryable(res.status)) {
            const retryAfter = res.headers.get('Retry-After');
            const delayMs =
              res.status === 429 ? (retryAfter ? parseInt(retryAfter, 10) * 1000 : 3000) : 3000;
            onAttempt({ attempt, status: res.status, delayMs });
            if (attempt >= maxAttempts) {
              const err = new Error(`Local AI busy (${res.status}) after ${maxAttempts} attempts.`);
              err.status = res.status;
              throw err;
            }
            await new Promise(r => setTimeout(r, delayMs));
            continue;
          }

          const err = new Error(`Local AI returned ${res.status}: ${errorBody.slice(0, 200)}`);
          err.status = res.status;
          throw err;
        } catch (error) {
          if (error.name === 'ContextWindowError' || error.code === 'CONTEXT_WINDOW_EXCEEDED')
            throw error;
          if (error.name === 'AbortError' || error.name === 'TimeoutError') {
            lastError = new Error('AI request timed out.');
            lastError.status = 504;
          } else {
            lastError = error;
          }
          // Network-level failures (phone briefly unreachable) get a couple of
          // retries too, but do not mask the final failure.
          if (attempt >= maxAttempts) throw lastError;
          onAttempt({ attempt, status: lastError.status || 0, delayMs: 2000 });
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      throw lastError || new Error('Local AI call failed');
    });
  }

  /**
   * Structured JSON completion (used for planning / requirement extraction).
   * Parses the first JSON object found in the reply.
   */
  async completeJson(messages, options = {}) {
    const { text } = await this.complete(messages, options);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      const err = new Error('Model did not return JSON');
      err.code = 'JSON_PARSE_FAILED';
      err.rawText = text.slice(0, 400);
      throw err;
    }
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      const err = new Error('Model returned malformed JSON');
      err.code = 'JSON_PARSE_FAILED';
      err.rawText = text.slice(0, 400);
      throw err;
    }
  }

  /**
   * Stream completion tokens in real-time.
   */
  async streamComplete(messages, options = {}) {
    const { onToken, onState = () => {}, maxTokens = 2500 } = options;
    const timeoutMs = options.timeoutMs || 3600000;

    return this.queue.enqueue(async () => {
      onState({
        step: 'Connecting to Local Phone AI',
        detail: 'Acquiring queue lock & resolving model...',
      });
      const activeModel = await this.provider.resolveModel();
      const safeMessages = normalizeMessagesForPhone(messages);

      const fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: activeModel,
          messages: safeMessages,
          max_tokens: maxTokens,
          stream: true,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      };
      if (this.provider.apiKey && this.provider.apiKey !== 'no-key-required') {
        fetchOptions.headers['Authorization'] = `Bearer ${this.provider.apiKey}`;
      }

      let res;
      try {
        res = await fetch(`${this.provider.baseUrl}/chat/completions`, fetchOptions);
      } catch (err) {
        // Fallback to non-streaming complete if stream connection fails
        return this.complete(messages, options);
      }

      if (!res.ok || !res.body) {
        return this.complete(messages, options);
      }

      onState({ step: 'Streaming Live Response', detail: 'Receiving tokens from phone AI...' });

      let fullText = '';
      let buffer = '';
      const decoder = new TextDecoder();

      for await (const chunk of res.body) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') break;
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const delta = data?.choices?.[0]?.delta?.content || '';
              if (delta) {
                fullText += delta;
                const cleanTextSoFar = stripThinkingTags(fullText);
                if (onToken) {
                  onToken(delta, cleanTextSoFar);
                }
              }
            } catch (e) {}
          }
        }
      }

      const finalCleanText = stripThinkingTags(fullText);
      return {
        text: finalCleanText || fullText,
        finishReason: 'stop',
        raw: { text: fullText },
      };
    });
  }
}

export { PhoneModelAdapter };
