import { assert } from '../core/errors.js';
import { now, redactSecret } from '../core/utils.js';

export const providerCatalog = {
  openai: { name: 'OpenAI', defaultModel: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
  gemini: {
    name: 'Google Gemini',
    defaultModel: 'gemini-2.0-flash',
    baseUrl: 'https://generativelanguage.googleapis.com',
  },
  grok: { name: 'Grok', defaultModel: 'grok-3-mini', baseUrl: 'https://api.x.ai/v1' },
  deepseek: {
    name: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com/v1',
  },
  openrouter: {
    name: 'OpenRouter',
    defaultModel: 'openai/gpt-4o-mini',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
  anthropic: {
    name: 'Anthropic',
    defaultModel: 'claude-3-5-haiku-latest',
    baseUrl: 'https://api.anthropic.com',
  },
};

export class ProviderModel {
  constructor(database, secretBox) {
    this.collection = database.collection('providers');
    this.secretBox = secretBox;
  }

  async publicList(userId) {
    const providers = await this.collection.find({ userId }).toArray();
    return Object.entries(providerCatalog).map(([id, catalog]) => {
      const provider = providers.find(item => item.providerId === id);
      return {
        id,
        name: catalog.name,
        enabled: provider?.enabled ?? false,
        priority: provider?.priority ?? 100,
        model: provider?.model || catalog.defaultModel,
        baseUrl: provider?.baseUrl || catalog.baseUrl,
        hasApiKey: Boolean(provider?.apiKeyCiphertext),
        maskedApiKey: provider?.apiKeyCiphertext ? redactSecret(provider.apiKeyCiphertext) : null,
        updatedAt: provider?.updatedAt || null,
      };
    });
  }

  async upsert(userId, providerId, input = {}) {
    const catalog = providerCatalog[providerId];
    assert(catalog, 404, 'Unsupported AI provider', 'UNSUPPORTED_PROVIDER');
    const current = (await this.collection.findOne({ userId, providerId })) || {};
    const hasNewKey =
      typeof input.apiKey === 'string' && input.apiKey.trim() && !input.apiKey.startsWith('••••');
    const next = {
      userId,
      providerId,
      enabled: input.enabled ?? current.enabled ?? true,
      priority: Number.isFinite(Number(input.priority))
        ? Number(input.priority)
        : (current.priority ?? 100),
      model: String(input.model || current.model || catalog.defaultModel),
      baseUrl: String(input.baseUrl || current.baseUrl || catalog.baseUrl).replace(/\/$/, ''),
      apiKeyCiphertext: hasNewKey
        ? this.secretBox.encrypt(input.apiKey.trim())
        : current.apiKeyCiphertext || null,
      updatedAt: now(),
    };
    assert(
      next.apiKeyCiphertext || !next.enabled,
      400,
      'An API key is required when enabling a provider',
      'PROVIDER_KEY_REQUIRED'
    );
    await this.collection.updateOne({ userId, providerId }, { $set: next }, { upsert: true });
    return (await this.publicList(userId)).find(provider => provider.id === providerId);
  }

  async remove(userId, providerId) {
    assert(providerCatalog[providerId], 404, 'Unsupported AI provider', 'UNSUPPORTED_PROVIDER');
    await this.collection.deleteOne({ userId, providerId });
  }

  /** Get all enabled providers with decrypted keys, sorted by priority (lowest first = highest priority). */
  async getActiveProviders(userId) {
    const providers = await this.collection.find({ userId, enabled: true }).toArray();
    const result = [];
    for (const p of providers) {
      if (!p.apiKeyCiphertext) continue;
      const catalog = providerCatalog[p.providerId];
      if (!catalog) continue;
      try {
        result.push({
          id: p.providerId,
          name: catalog.name,
          apiKey: this.secretBox.decrypt(p.apiKeyCiphertext),
          model: p.model || catalog.defaultModel,
          baseUrl: p.baseUrl || catalog.baseUrl,
          priority: p.priority ?? 100,
        });
      } catch {
        // Skip providers with corrupt keys
      }
    }
    return result.sort((a, b) => a.priority - b.priority);
  }
}
