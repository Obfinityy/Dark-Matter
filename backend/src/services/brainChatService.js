/**
 * brainChatService.js — dynamic chat with the local brains. NOT pre-defined.
 *
 * The user can ask ANYTHING. The brain (local LLM running on the user's
 * machine via llama-server) generates a fresh reply every time, using:
 *   - the conversation's memory (per-chat, on local disk)
 *   - the hunt context (target, findings so far, current step)
 *   - the brain's own knowledge
 *
 * No intent templates, no hardcoded replies. Fully dynamic.
 */

import { loadMemory, appendMessage, getRecentMessages } from './chatMemoryService.js';

/**
 * Create the brain chat service bound to a ModelRunnerService instance.
 */
export function createBrainChatService({ modelRunnerService }) {
  /**
   * Build the system prompt for a brain based on its role and context.
   */
  function buildSystemPrompt(brainSlot, context = {}) {
    const base = `You are Infinity AI's ${brainSlot} brain, running locally on the user's machine. You are a helpful, direct AI assistant. Answer in the user's language (match Hindi/Hinglish if they use it). Be concise but complete. No fluff.`;

    if (brainSlot === 'hacker') {
      const huntInfo = context.target
        ? `You are currently hunting target: ${context.target}. `
        : '';
      const findingsInfo = context.findingsCount
        ? `Findings so far: ${context.findingsCount}. `
        : '';
      const stepInfo = context.currentStep ? `Current step: ${context.currentStep}. ` : '';
      return `${base} You are an elite bug bounty hunter — you think like one, analyze like one, and find vulnerabilities like one. ${huntInfo}${findingsInfo}${stepInfo}The user can ask you anything about the hunt, vulnerabilities, or security. Use your memory of this conversation and the hunt context.`;
    }

    if (brainSlot === 'vision') {
      return `${base} You see the user's screen and describe what you observe.`;
    }

    if (brainSlot === 'grounding') {
      return `${base} You figure out screen coordinates for UI elements the user describes.`;
    }

    return base;
  }

  /**
   * Query the local brain (llama-server OpenAI-compatible API).
   */
  async function queryBrain(brainSlot, messages) {
    const server = modelRunnerService.slotServers?.[brainSlot];
    if (!server) {
      throw new Error(
        `BRAIN_NOT_RUNNING: the ${brainSlot} brain is not running. Download and Run it from Models first.`
      );
    }

    const baseUrl = server.baseUrl || `http://127.0.0.1:${server.port}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    try {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages,
          temperature: 0.7,
          max_tokens: 2000,
          stream: false,
        }),
      });

      if (!res.ok) {
        throw new Error(`Brain API error: HTTP ${res.status}`);
      }

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content;
      if (!reply) {
        throw new Error('Brain returned an empty reply');
      }
      return reply.trim();
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Chat with a brain. Dynamic — no pre-defined replies.
   */
  async function chatWithBrain(chatId, brainSlot, userMessage, context = {}) {
    if (!userMessage?.trim()) {
      throw new Error('Message is required');
    }

    // 1. Load this chat's memory
    const memory = loadMemory(chatId);

    // 2. Merge fresh context
    const mergedContext = { ...memory.context, ...context };

    // 3. Build messages: system + recent history + new user message
    const systemPrompt = buildSystemPrompt(brainSlot, mergedContext);
    const history = getRecentMessages(chatId, 20).map(m => ({ role: m.role, content: m.content }));

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    // 4. Save user message to memory
    appendMessage(chatId, 'user', userMessage);

    // 5. Get dynamic reply from the brain
    let reply;
    try {
      reply = await queryBrain(brainSlot, messages);
    } catch (err) {
      if (err.message?.includes('BRAIN_NOT_RUNNING')) {
        throw err;
      }
      throw new Error(`Brain error: ${err.message}`);
    }

    // 6. Save brain's reply to memory
    appendMessage(chatId, 'assistant', reply, { brain: brainSlot });

    return { reply, chatId, brain: brainSlot };
  }

  /**
   * Check which brains are currently running.
   */
  function getRunningBrains() {
    const servers = modelRunnerService.slotServers || {};
    return {
      hacker: !!servers.hacker,
      vision: !!servers.vision,
      grounding: !!servers.grounding,
    };
  }

  return { chatWithBrain, getRunningBrains };
}
