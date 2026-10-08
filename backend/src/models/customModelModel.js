/**
 * customModelModel.js — user-added custom models (issue #3).
 *
 * Beyond the curated uncensored library, the user may add ANY model of their
 * choice: an Ollama tag (`llama3:8b`, `registry/namespace/model:tag`) or a
 * HuggingFace reference (`hf.co/bartowski/model-GGUF`). The tag is strictly
 * validated (no shell metacharacters, no traversal, sane length) because it
 * is later passed to `ollama pull` — a malicious tag must never reach a shell.
 */

import { id, now } from '../core/utils.js';

const MAX_TAG_LENGTH = 200;

// Conservative allowlist: what may appear in a model tag. Deliberately
// excludes whitespace, quotes, backticks, $, ;, &, |, <, >, *, ?, !, ~.
const TAG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._\-/]*[a-zA-Z0-9](:[a-zA-Z0-9._\-]+)?$/;

function kindForTag(tag) {
  const lower = tag.toLowerCase();
  if (lower.startsWith('hf.co/') || lower.startsWith('huggingface.co/')) return 'huggingface';
  return 'ollama';
}

function labelForTag(tag) {
  const withoutRegistry = tag.replace(/^(hf\.co|huggingface\.co)\//i, '');
  const last = withoutRegistry.split('/').pop();
  return last.split(':')[0] || tag;
}

/**
 * Strictly validate a user-supplied model tag.
 * @returns {{ valid: boolean, tag?: string, error?: string }}
 */
export function validateCustomTag(raw) {
  const tag = String(raw || '').trim();
  if (!tag) return { valid: false, error: 'Model tag is required' };
  if (tag.length > MAX_TAG_LENGTH) {
    return { valid: false, error: `Model tag is too long (max ${MAX_TAG_LENGTH} characters)` };
  }
  if (tag.includes('..')) {
    return { valid: false, error: 'Model tag must not contain ".."' };
  }
  if (!TAG_PATTERN.test(tag)) {
    return {
      valid: false,
      error:
        'Invalid model tag. Use an Ollama tag like "llama3:8b" or "namespace/model:tag", or a HuggingFace reference like "hf.co/bartowski/model-GGUF".',
    };
  }
  return { valid: true, tag };
}

/** Database model for custom model. */
export class CustomModelModel {
  constructor(database) {
    this.collection = database.collection('custom_models');
  }

  async list() {
    return this.collection.find({}).sort({ addedAt: 1 }).limit(500).toArray();
  }

  async get(customId) {
    if (!customId) return null;
    return this.collection.findOne({ id: String(customId) });
  }

  async getByTag(tag) {
    if (!tag) return null;
    return this.collection.findOne({ tag: String(tag) });
  }

  async add({ tag, addedBy = null }) {
    const check = validateCustomTag(tag);
    if (!check.valid) {
      const error = new Error(check.error);
      error.code = 'INVALID_TAG';
      throw error;
    }
    const existing = await this.getByTag(check.tag);
    if (existing) return existing;
    const record = {
      id: id('cm'),
      tag: check.tag,
      label: labelForTag(check.tag),
      kind: kindForTag(check.tag),
      addedBy,
      addedAt: now(),
    };
    await this.collection.insertOne(record);
    return { ...record };
  }

  async remove(customId) {
    if (!customId) return false;
    const existing = await this.get(customId);
    if (!existing) return false;
    await this.collection.deleteOne({ id: existing.id });
    return true;
  }
}
