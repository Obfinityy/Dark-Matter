import { ToolRegistry } from '../tools/registry.js';

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
    outputFormat: tool.outputFormat
  }));
  response.json({ tools });
}
