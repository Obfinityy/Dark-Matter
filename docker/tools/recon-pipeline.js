// Dark Matter — default recon pipeline template.
// Technique: noxpwn (19-phase chained pipeline). Each phase has per-phase
// error isolation: a failed phase logs and continues, never kills the hunt.

export const RECON_PIPELINE = [
  { phase: 1, name: 'subdomain_enum', tools: ['subfinder', 'amass'], critical: false },
  { phase: 2, name: 'dns_resolve', tools: ['dnsx'], critical: false },
  { phase: 3, name: 'port_scan', tools: ['naabu'], critical: false },
  { phase: 4, name: 'http_probe', tools: ['httpx'], critical: true },
  { phase: 5, name: 'tech_fingerprint', tools: ['wappalyzer-cli'], critical: false },
  { phase: 6, name: 'content_discovery', tools: ['ffuf', 'gobuster'], critical: false },
  { phase: 7, name: 'js_analysis', tools: ['js-secret-scan'], critical: false },
  { phase: 8, name: 'vuln_scan', tools: ['nuclei'], critical: true },
  { phase: 9, name: 'xss_scan', tools: ['dalfox'], critical: false },
  { phase: 10, name: 'sqli_probe', tools: ['sqlmap'], critical: false },
  { phase: 11, name: 'jwt_tests', tools: ['jwt-battery'], critical: false },
  { phase: 12, name: 'api_sequence', tools: ['api-sequencer'], critical: false },
  { phase: 13, name: 'logic_tests', tools: ['logic-tester'], critical: false },
  { phase: 14, name: 'screenshot', tools: ['screenshot'], critical: false, onlyOn: 'critical' },
];

/**
 * Get the pipeline phases for a hunt mode.
 * Minimal modes run phases 1-8; higher modes run the full pipeline.
 */
export function pipelineForMode(modeId) {
  const minimal = ['normal', 'medium'];
  if (minimal.includes(modeId)) {
    return RECON_PIPELINE.filter((p) => p.phase <= 8);
  }
  return RECON_PIPELINE;
}
