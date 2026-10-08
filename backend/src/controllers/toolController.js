/**
 * toolController — Express route handlers for tool.
 * Factory that wires the tool service into REST endpoints.
 * Part of: Infinity AI / Dark-Matter backend (HTTP API controllers).
 */

import { ToolRegistry } from '../tools/registry.js';

/**
 * List Tools.
 * @param {*} request
 * @param {*} response
 * @returns {*} Result.
 */
export function listTools(request, response) {
  const tools = ToolRegistry.list().map(tool => ({
    id: tool.name,
    name: tool.name,
    category: tool.category,
    description: tool.description,
    status: tool.requiresKali ? 'requires_kali' : 'available',
    execution: tool.riskLevel === 'none' ? 'passive' : 'active',
    riskLevel: tool.riskLevel,
    inputType: tool.inputType,
    outputFormat: tool.outputFormat,
  }));
  response.json({ tools });
}
