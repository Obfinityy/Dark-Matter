export class PhoneLocalProvider {
  constructor(config) {
    this.baseUrl = config.phoneAiBaseUrl;
    this.model = config.phoneAiModel;
    this.apiKey = config.phoneAiApiKey || 'no-key-required';
    this.enabled = config.phoneAiEnabled;
    this.host = config.phoneAiHost;
    this.port = config.phoneAiPort;
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

  async generate(messages, options = {}) {
    const url = `${this.baseUrl}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${this.apiKey}`
      },
      signal: AbortSignal.timeout(options.timeout || 45000),
      body: JSON.stringify({
        model: this.model,
        messages,
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

    return text;
  }

  async generateStructured(messages, schema, options = {}) {
    // Phone AI (OpenAI compatible) supports response_format: { type: 'json_object' }
    const url = `${this.baseUrl}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${this.apiKey}`
      },
      signal: AbortSignal.timeout(options.timeout || 45000),
      body: JSON.stringify({
        model: this.model,
        messages,
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
    const url = `${this.baseUrl}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${this.apiKey}`
      },
      signal: AbortSignal.timeout(options.timeout || 45000),
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2000,
        stream: true
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Phone AI Stream ${response.status}: ${errText.slice(0, 200)}`);
    }
    
    return response.body; // Return readable stream
  }
}
