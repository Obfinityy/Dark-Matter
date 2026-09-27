export function listTools(request, response) {
  response.json({
    tools: [{
      id: 'subdomain-enumerator',
      name: 'Subdomain Enumerator',
      category: 'reconnaissance',
      status: 'available',
      execution: 'passive',
      source: 'crt.sh',
      description: 'Find certificate names associated with an authorized hostname.'
    }]
  });
}
