/**
 * grpcReflectionProber.js — gRPC server-reflection probing analyzer.
 *
 * Analyzes responses from the gRPC Server Reflection protocol
 * (grpc.reflection.v1alpha.ServerReflection): listed services, file
 * descriptors and symbol names are used to fingerprint the framework
 * (grpc-go, grpc-java, grpc-python, grpc-node, envoy proxy, connectrpc)
 * and to inventory the exposed API surface on in-scope targets.
 *
 * Offline analyzer: callers supply already-decoded reflection payloads.
 */

/** Framework hints from server-reflection response metadata. */
export const FRAMEWORK_HINTS = [
  {
    regex: /grpc-go/i,
    framework: 'grpc-go',
    note: 'User-Agent / reflection metadata mentions grpc-go',
  },
  { regex: /grpc-java/i, framework: 'grpc-java', note: 'grpc-java stack detected' },
  { regex: /grpc-python/i, framework: 'grpc-python', note: 'grpc-python stack detected' },
  {
    regex: /grpc-node|@grpc\/grpc-js/i,
    framework: 'grpc-node',
    note: 'grpc-node / grpc-js stack detected',
  },
  { regex: /grpc-dotnet/i, framework: 'grpc-dotnet', note: '.NET gRPC stack detected' },
  { regex: /envoy/i, framework: 'Envoy', note: 'Envoy proxy in front of or serving reflection' },
  {
    regex: /connectrpc|connect-protocol/i,
    framework: 'ConnectRPC',
    note: 'Connect protocol stack detected',
  },
];

/** Well-known reflection-adjacent services worth flagging. */
export const INTERESTING_SERVICES = [
  {
    pattern: /^grpc\.reflection\.v1alpha\.ServerReflection$/,
    label: 'reflection',
    note: 'Server reflection enabled — full API surface enumerable.',
  },
  {
    pattern: /^grpc\.health\.v1\.Health$/,
    label: 'health',
    note: 'Standard health service exposed.',
  },
  {
    pattern: /^google\.longrunning\.Operations$/,
    label: 'longrunning',
    note: 'Long-running operations API exposed.',
  },
  {
    pattern: /Admin|Debug|Internal/i,
    label: 'admin',
    note: 'Possibly internal/admin service exposed publicly.',
  },
];

/**
 * Analyze a server-reflection ListServices response.
 *
 * @param {Object} resp - { services: string[], metadata?: object,
 *   fileDescriptors?: string[], symbols?: string[] }
 * @returns {Object} analysis.
 */
export function analyzeReflectionResponse(resp = {}) {
  const services = Array.isArray(resp.services) ? resp.services.map(String) : [];
  const metadata = resp.metadata || {};
  const fileDescriptors = Array.isArray(resp.fileDescriptors) ? resp.fileDescriptors : [];
  const symbols = Array.isArray(resp.symbols) ? resp.symbols : [];

  const reflectionEnabled = services.length > 0;
  const interesting = [];
  for (const svc of services) {
    for (const it of INTERESTING_SERVICES) {
      if (it.pattern.test(svc)) interesting.push({ service: svc, label: it.label, note: it.note });
    }
  }

  const metaText = JSON.stringify(metadata);
  const frameworks = [];
  for (const h of FRAMEWORK_HINTS) {
    if (h.regex.test(metaText) || fileDescriptors.some(f => h.regex.test(f))) {
      frameworks.push({ framework: h.framework, note: h.note });
    }
  }

  // Namespace census: top-level proto packages.
  const packages = {};
  for (const svc of services) {
    const parts = svc.split('.');
    const head = parts.length > 1 ? parts.slice(0, -1).join('.') : '(default)';
    packages[head] = (packages[head] || 0) + 1;
  }

  return {
    reflectionEnabled,
    serviceCount: services.length,
    services,
    interestingServices: interesting,
    frameworks,
    packages,
    fileDescriptorsFound: fileDescriptors.length,
    symbolsFound: symbols.length,
    exposure: !reflectionEnabled
      ? 'none'
      : interesting.some(i => i.label === 'admin')
        ? 'high'
        : interesting.length
          ? 'medium'
          : 'low',
    summary: reflectionEnabled
      ? `Reflection enabled: ${services.length} services listed${frameworks.length ? `; stack: ${frameworks.map(f => f.framework).join(', ')}` : ''}.`
      : 'Server reflection not enabled (ListServices returned nothing).',
    type: 'gRPC Reflection Analysis',
    confidence: reflectionEnabled ? 'high' : 'medium',
  };
}

/**
 * Quick boolean: does this response indicate reflection is available?
 * @param {Object} resp
 */
export function isReflectionEnabled(resp = {}) {
  return Array.isArray(resp.services) && resp.services.length > 0;
}

export const GRPC_REFLECTION_PROBER = {
  FRAMEWORK_HINTS,
  INTERESTING_SERVICES,
  analyzeReflectionResponse,
  isReflectionEnabled,
};
export default GRPC_REFLECTION_PROBER;
