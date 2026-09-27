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
