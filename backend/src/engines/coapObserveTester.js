/**
 * coapObserveTester.js — CoAP Observe-option testing (idea 00542).
 *
 * Analyzes CoAP (RFC 7252) Observe (RFC 7641) behavior of IoT endpoints:
 *  - Parses CoAP responses that acknowledge an Observe registration:
 *    Observe option present in a 2.xx response = Observe supported.
 *  - Reads the Observe sequence counter to detect liveness and re-registration.
 *  - Fingerprints IoT stacks by Observe flavor: notification format
 *    (Observe option value wrapping, block-wise notifications) and
 *    which resources accept Observe registrations.
 *
 * Offline analyzer: callers supply parsed CoAP response summaries or raw
 * response bytes. No network code.
 * Defensive use: IoT device/stack fingerprinting on authorized targets —
 * expose Observe-capable resources that may leak state changes to anyone
 * who registers, a real bug-bounty surface (missing observer auth).
 */

/** CoAP response codes (class.detail) relevant to Observe. */
export const COAP_CODES = {
  '2.05': 'content',
  '4.04': 'not_found',
  '4.05': 'method_not_allowed',
  '4.29': 'bad_option',
};

/** Well-known Observe option behaviors per stack family (observed patterns). */
export const OBSERVE_STACK_HINTS = {
  maxAgeDeregisters: 'sends Max-Age option in notifications; deregistration via RST',
  observeSeqWraps: 'Observe sequence number wraps at 0xFFFFFF (24-bit) per RFC 7641',
  blockwiseNotify: 'issues block-wise (Block2) notifications for large payloads',
  noRstOnCancel: 'does not honor RST-based cancellation promptly',
};

/**
 * Parse the Observe option from a CoAP option list.
 *
 * @param {object[]} options parsed CoAP options: [{ number, value (Buffer|number) }]
 * @returns {{present:boolean, sequence:number|null, deregistered:boolean}}
 */
export function parseObserveOption(options = []) {
  const opt = options.find((o) => o && o.number === 6); // Observe = option 6
  if (!opt) return { present: false, sequence: null, deregistered: false };
  const raw = Buffer.isBuffer(opt.value) ? opt.value : Buffer.from([Number(opt.value) & 0xff]);
  let sequence = 0;
  for (const byte of raw) sequence = (sequence << 8) | byte;
  return {
    present: true,
    sequence: raw.length ? sequence : 0,
    // A response with Observe option 1 is a deregistration notice.
    deregistered: raw.length === 1 && raw[0] === 1,
  };
}

/**
 * Test whether an endpoint resource supports CoAP Observe, from its response
 * to a GET that carried an Observe option.
 *
 * @param {object} resp { code: '2.05'|'4.04'|..., options: [...] , resource: string }
 * @returns {object} { supported, evidence, confidence, hints }
 */
export function testObserveSupport(resp = {}) {
  const observe = parseObserveOption(resp.options);
  if (observe.deregistered) {
    return {
      supported: false,
      confidence: 'high',
      evidence: `resource '${resp.resource || '?'}' replied with Observe=1 (deregistration) — Observe explicitly cancelled`,
      hints: [],
    };
  }
  if (observe.present && String(resp.code).startsWith('2.')) {
    const hints = [OBSERVE_STACK_HINTS.observeSeqWraps];
    return {
      supported: true,
      confidence: 'high',
      evidence: `resource '${resp.resource || '?'}' accepted Observe registration (code ${resp.code}, Observe seq=${observe.sequence})`,
      hints,
    };
  }
  const codeName = COAP_CODES[String(resp.code)] || 'other';
  return {
    supported: false,
    confidence: resp.code ? 'medium' : 'low',
    evidence: `resource '${resp.resource || '?'}' answered ${resp.code || 'no-response'} (${codeName}) without an Observe option — Observe not supported or resource rejects it`,
    hints: [],
  };
}

/**
 * Analyze a batch of Observe probes to fingerprint the stack and find
 * weakly-protected observable resources.
 *
 * @param {object[]} probes [{ resource, code, options }]
 * @returns {object[]} findings
 */
export function analyzeObserveProbes(probes = []) {
  const findings = [];
  const supported = [];
  let blockwiseSeen = false;

  for (const p of probes) {
    const result = testObserveSupport(p);
    if (result.supported) {
      supported.push(p.resource);
      if ((p.options || []).some((o) => o && o.number === 23)) blockwiseSeen = true; // Block2 = 23
    }
  }

  if (supported.length) {
    findings.push({
      type: 'CoAP Observe Supported',
      confidence: 'high',
      cwe: 'CWE-862',
      evidence: `${supported.length} resource(s) accept Observe registrations: ${supported.slice(0, 8).join(', ')}${supported.length > 8 ? ' …' : ''}. Observable resources can push state changes to any registered observer — verify observer authentication/authorization.`,
      extra: { resources: supported },
    });
  }

  if (blockwiseSeen) {
    findings.push({
      type: 'Block-wise CoAP Notifications',
      confidence: 'medium',
      cwe: null,
      evidence: 'endpoint emits Block2 (block-wise) notifications — stack splits large Observe payloads across blocks (stack fingerprint hint)',
    });
  }

  return findings;
}

export const COAP_OBSERVE_TESTER = {
  parseObserveOption,
  testObserveSupport,
  analyzeObserveProbes,
  COAP_CODES,
  OBSERVE_STACK_HINTS,
};
export default COAP_OBSERVE_TESTER;
