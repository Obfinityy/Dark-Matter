export function stripThinkingTags(text = '') {
  if (typeof text !== 'string') return '';
  let cleaned = text;

  // 1. Remove all closed thinking channel blocks <|channel>thought ... <channel|>
  cleaned = cleaned.replace(/<\|?channel\|?>thought[\s\S]*?<\/?channel\|?>/gi, '');

  // 2. Remove all closed <think>...</think> or <thought>...</thought>
  cleaned = cleaned.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '');
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '');

  // 3. Handle UNCLOSED thinking blocks (e.g. truncated inside thinking process)
  cleaned = cleaned.replace(/<\|?channel\|?>thought[\s\S]*$/gi, '');
  cleaned = cleaned.replace(/<think(?:ing)?>[\s\S]*$/gi, '');
  cleaned = cleaned.replace(/<thought>[\s\S]*$/gi, '');

  // 4. Remove THOUGHT: / Thinking: prefixes
  cleaned = cleaned.replace(/^(?:THOUGHT|Thinking):\s*/i, '');

  return cleaned.trim();
}

export function normalizeMessagesForPhone(messages) {
  if (!Array.isArray(messages)) return [];
  const result = [];
  
  for (const item of messages) {
    if (!item) continue;
    let role = item.role || 'user';
    let content = typeof item.content === 'string' ? item.content : JSON.stringify(item.content || '');
    
    // Local phone servers (e.g., PocketLLM / MLC-LLM) throw "System role not supported"
    if (role === 'system') {
      role = 'user';
      content = `[System Prompt]\n${content}`;
    }
    
    if (result.length > 0 && result[result.length - 1].role === 'user' && role === 'user') {
      result[result.length - 1].content += `\n\n${content}`;
    } else {
      result.push({ role, content });
    }
  }
  
  return result;
}

export class PhoneLocalProvider {
  constructor(config) {
    this.baseUrl = config.phoneAiBaseUrl;
    this.model = config.phoneAiModel;
    this.apiKey = config.phoneAiApiKey || 'no-key-required';
    this.enabled = config.phoneAiEnabled;
    this.host = config.phoneAiHost;
    this.port = config.phoneAiPort;
  }

  async resolveModel() {
    if (this.model && this.model !== 'local' && this.model !== 'auto') {
      return this.model;
    }
    try {
      const fetchOptions = { signal: AbortSignal.timeout(4000) };
      if (this.apiKey && this.apiKey !== 'no-key-required') {
        fetchOptions.headers = { 'Authorization': `Bearer ${this.apiKey}` };
      }
      const response = await fetch(`${this.baseUrl}/models`, fetchOptions);
      if (response.ok) {
        const body = await response.json();
        if (body?.data?.length > 0 && body.data[0]?.id) {
          const activeId = body.data[0].id;
          this.resolvedModel = activeId;
          return activeId;
        }
      }
    } catch (e) {
      console.warn('[PhoneLocalProvider] Dynamic model discovery via /v1/models failed:', e.message);
    }
    return this.resolvedModel || 'local';
  }

  async healthCheck() {
    if (!this.enabled) {
      return { provider: 'PhoneLocalProvider', enabled: false, reachable: false, reason: 'disabled' };
    }
    
    const start = Date.now();
    try {
      const fetchOptions = {
        signal: AbortSignal.timeout(5000)
      };
      if (this.apiKey && this.apiKey !== 'no-key-required') {
        fetchOptions.headers = { 'Authorization': `Bearer ${this.apiKey}` };
      }
      
      const response = await fetch(`${this.baseUrl}/models`, fetchOptions);
      const latencyMs = Date.now() - start;
      
      if (response.ok) {
        let actualModel = this.model;
        try {
           const body = await response.json();
           if (body?.data?.length > 0) actualModel = body.data[0].id;
        } catch(e) {}
        this.resolvedModel = actualModel;

        return {
          provider: 'PhoneLocalProvider',
          enabled: true,
          reachable: true,
          model: actualModel,
          latencyMs
        };
      }
      return { provider: 'PhoneLocalProvider', enabled: true, reachable: false, reason: `HTTP ${response.status}`, latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - start;
      return { provider: 'PhoneLocalProvider', enabled: true, reachable: false, reason: error.message, latencyMs };
    }
  }

  async fetchWithRetry(url, fetchOptions, maxAttempts = 15) {
    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt++;
      try {
        const response = await fetch(url, fetchOptions);
        if ((response.status === 429 || response.status === 503) && attempt < maxAttempts) {
          console.warn(`[PhoneLocalProvider] Upstream ${response.status}. Retrying (${attempt}/${maxAttempts}) in 1.5s...`);
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        return response;
      } catch (err) {
        if (attempt < maxAttempts && (err.name === 'AbortError' || err.name === 'TypeError' || err.code === 'ECONNRESET')) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        throw err;
      }
    }
  }

  async generate(messages, options = {}) {
    const activeModel = await this.resolveModel();
    const safeMessages = normalizeMessagesForPhone(messages);
    const url = `${this.baseUrl}/chat/completions`;
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${this.apiKey}`
      },
      signal: AbortSignal.timeout(options.timeout || 45000),
      body: JSON.stringify({
        model: activeModel,
        messages: safeMessages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2000
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Phone AI ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty Phone AI response');

    return stripThinkingTags(text);
  }

  async generateStructured(messages, schema, options = {}) {
    const activeModel = await this.resolveModel();
    const safeMessages = normalizeMessagesForPhone(messages);
    const url = `${this.baseUrl}/chat/completions`;
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${this.apiKey}`
      },
      signal: AbortSignal.timeout(options.timeout || 45000),
      body: JSON.stringify({
        model: activeModel,
        messages: safeMessages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2000,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Phone AI Structured ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty Phone AI response');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in Phone AI response');
    return JSON.parse(jsonMatch[0]);
  }

  async stream(messages, options = {}) {
    const activeModel = await this.resolveModel();
    const safeMessages = normalizeMessagesForPhone(messages);
    const url = `${this.baseUrl}/chat/completions`;
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${this.apiKey}`
      },
      signal: AbortSignal.timeout(options.timeout || 45000),
      body: JSON.stringify({
        model: activeModel,
        messages: safeMessages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2000,
        stream: true
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Phone AI Stream ${response.status}: ${errText.slice(0, 200)}`);
    }
    
    return response.body;
  }
}
