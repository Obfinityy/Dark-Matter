export const mockTargets = [
  {
    id: 'target_1',
    projectId: 'proj_1',
    name: 'acme-main-app',
    url: 'https://app.acmecorp.com',
    authorizationStatus: 'Verified',
    scope: {
      included: ['*.acmecorp.com'],
      excluded: ['admin.acmecorp.com'],
    },
    restrictions: 'No disruptive testing',
    recentScans: 4,
    findings: 8
  },
  {
    id: 'target_2',
    projectId: 'proj_1',
    name: 'acme-api',
    url: 'https://api.acmecorp.com',
    authorizationStatus: 'Verified',
    scope: {
      included: ['api.acmecorp.com'],
      excluded: [],
    },
    restrictions: 'Rate limit: 100 req/sec',
    recentScans: 2,
    findings: 4
  }
];
