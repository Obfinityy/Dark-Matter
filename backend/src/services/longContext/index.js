/**
 * Long-Context Engine stack — public surface.
 *
 * Architecture:
 *   infiniteChatController (orchestration only)
 *     → LongContextEngine   (input virtualization + bounded chat context)
 *         → chunker → LongContextStore (lc_* collections)
 *         → Retriever → Summarizer → ContextBudgetManager
 *     → LongGenerationEngine (output virtualization)
 *         → plan → parts → Validator → Assembler
 *     → PhoneModelAdapter → LocalAIQueue → PhoneLocalProvider (the real phone)
 */
export { chunkText, hashContent } from './chunker.js';
export { LongContextStore, newId } from './longContextStore.js';
export { Retriever } from './retriever.js';
export { Summarizer } from './summarizer.js';
export { ContextBudgetManager } from './contextBudgetManager.js';
export { PhoneModelAdapter, ContextWindowError } from './phoneModelAdapter.js';
export { LongContextEngine } from './longContextEngine.js';
export { LongGenerationEngine } from './longGenerationEngine.js';
export { LongGenerationStore } from './longGenerationStore.js';
export { Validator, Assembler, OutputPlanner } from './validator.js';
export { estimateTokens, modelContextCapacity, reservedOutputTokens } from './tokens.js';
