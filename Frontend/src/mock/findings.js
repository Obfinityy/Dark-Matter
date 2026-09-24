export const mockFindings = [
  {
    id: 'finding_1',
    title: 'Unauthenticated API Endpoint Exposure',
    severity: 'High',
    confidence: '95%',
    asset: 'api.acmecorp.com/v1/users',
    status: 'Validated',
    discovered: '1 hour ago',
    projectId: 'proj_1',
    targetId: 'target_2',
    description: 'An API endpoint intended for internal use is exposed without authentication requirements.',
    impact: 'An attacker could enumerate users and extract PII.',
    remediation: 'Implement JWT authentication on all /v1/* endpoints.'
  },
  {
    id: 'finding_2',
    title: 'Outdated Nginx Version',
    severity: 'Medium',
    confidence: '100%',
    asset: 'app.acmecorp.com',
    status: 'Potential',
    discovered: '2 days ago',
    projectId: 'proj_1',
    targetId: 'target_1',
    description: 'The server is running Nginx 1.14.0 which has known vulnerabilities.',
    impact: 'Potential exposure to known CVEs depending on module configuration.',
    remediation: 'Upgrade to the latest stable Nginx release.'
  },
  {
    id: 'finding_3',
    title: 'Missing Security Headers',
    severity: 'Low',
    confidence: '100%',
    asset: 'app.acmecorp.com',
    status: 'Validated',
    discovered: '2 days ago',
    projectId: 'proj_1',
    targetId: 'target_1',
    description: 'Strict-Transport-Security and X-Frame-Options headers are missing.',
    impact: 'Increased risk of MITM attacks and Clickjacking.',
    remediation: 'Configure the web server to emit standard security headers.'
  }
];
