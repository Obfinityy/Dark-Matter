import { config } from '../config.js';
import { PhoneLocalProvider } from '../agent/providers/phoneLocalProvider.js';
import { localAIQueue } from '../agent/providers/localAiQueue.js';
import crypto from 'crypto';

export function health(request, response) {
  response.json({ status: 'ok', service: 'darkmatter-backend', framework: 'express', timestamp: new Date().toISOString() });
}

export function agentInfo(request, response) {
  response.json({
    name: 'Elite Bug Bounty Expert',
    role: 'authorized-security-research-agent',
    activeTool: 'subdomain-enumerator',
    capabilities: ['authorized target intake', 'passive subdomain enumeration', 'live terminal events'],
    restrictions: ['explicit authorization required', 'only declared scope is used', 'no arbitrary command execution']
  });
}

export async function localAiHealth(request, response) {
  const phoneAi = new PhoneLocalProvider(config);
  const result = await phoneAi.healthCheck();
  response.json(result);
}

export async function directChat(request, response) {
  try {
    const { message } = request.body;
    const phoneAi = new PhoneLocalProvider(config);
    if (!phoneAi.enabled) {
      return response.status(400).json({ error: { message: 'Local AI is disabled in environment.' } });
    }
    const messages = [
      { role: 'user', content: message || 'Hello' }
    ];
    
    const requestId = crypto.randomUUID();
    const activeModel = await phoneAi.resolveModel();
    
    const reply = await localAIQueue.enqueue(async () => {
      const fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: activeModel,
          messages: messages
        }),
        signal: AbortSignal.timeout(60000)
      };
      
      if (phoneAi.apiKey && phoneAi.apiKey !== 'no-key-required') {
        fetchOptions.headers['Authorization'] = `Bearer ${phoneAi.apiKey}`;
      }
      
      const res = await fetch(`${phoneAi.baseUrl}/chat/completions`, fetchOptions);
      
      if (!res.ok) {
        const errorBody = await res.text();
        console.error(`[HealthChat] Error: ${res.status} ${errorBody}`);
        const e = new Error(`AI server error: ${res.status}`);
        e.status = res.status;
        throw e;
      }
      
      const data = await res.json();
      return data.choices?.[0]?.message?.content || 'Error: No response from local AI.';
    }, requestId);
    
    response.json({ reply });
  } catch (error) {
    console.error('AI connection error:', error);
    response.status(error.status || 500).json({ error: { message: error.message } });
  }
}