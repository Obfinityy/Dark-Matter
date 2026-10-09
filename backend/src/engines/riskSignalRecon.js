/**
 * riskSignalRecon.js — Payment, fraud-detection & bot-management signal reconnaissance engine.
 *
 * Maps where a site's checkout, fraud and bot-management signals live by
 * detecting payment-gateway client integrations, fraud-detection SDK usage
 * (Sift, Riskified) and bot-management SDK signals (PerimeterX, DataDome,
 * Cloudflare Turnstile, reCAPTCHA, hCaptcha) in the site's own client code.
 *
 * Operates purely on HTML/JS text the hunt agent has already fetched from the
 * target's own publicly served pages (passive/static analysis). No network calls,
 * no execution of target code — fully deterministic.
 *
 * DEFENSIVE/PRODUCT FRAMING ONLY: reports which SDKs are present, which
 * client-side entry points load them, and which checkout/challenge endpoint
 * patterns they pair with — the surface map a defender inventories before a
 * review. NEVER any bypass, disablement or evasion logic, and secret keys are
 * masked, never echoed.
 *
 * @module riskSignalRecon
 */

/**
 * Mask a credential-shaped literal so reports show presence, never the value.
 *
 * @param {string} value - Raw literal.
 * @returns {string} Masked hint, e.g. "present(len=107)".
 */
function maskSecret(value) {
  if (!value) return 'none';
  return `present(len=${value.length})`;
}

/**
 * Line number (1-based) of a character offset in a source string.
 *
 * @param {string} src - Source text.
 * @param {number} offset - Character offset.
 * @returns {number} 1-based line number.
 */
function lineOf(src, offset) {
  return src.slice(0, offset).split('\n').length;
}

const GATEWAY_DEFS = [
  {
    name: 'Stripe',
    scriptRes: [/js\.stripe\.com\/v\d+\/stripe\.js/i, /stripe\.js/i],
    ctorRe: /Stripe\(\s*['"`](pk_[a-z]+_[A-Za-z0-9]+)['"`]\s*\)/,
    apiHint: ['/payments', '/payment-intent', '/checkout-session', '/api/billing'],
  },
  {
    name: 'Razorpay',
    scriptRes: [/checkout\.razorpay\.com\/v\d+\/checkout\.js/i, /razorpay/i],
    ctorRe: /new\s+Razorpay\(\s*\{[^}]{0,300}key\s*:\s*['"`](rzp_[a-z]+_[A-Za-z0-9]+)['"`]/,
    apiHint: ['/payments/order', '/razorpay/order', '/api/checkout'],
  },
  {
    name: 'PayPal',
    scriptRes: [/paypal\.com\/sdk\/js/i, /paypalobjects\.com/i],
    ctorRe: /paypal\.Buttons\s*\(\s*\{|paypal\.HostedFields\.render/,
    apiHint: ['/paypal/order', '/api/paypal', '/checkout/paypal'],
  },
  {
    name: 'Braintree',
    scriptRes: [/js\.braintreegateway\.com/i, /braintree/i],
    ctorRe: /braintree\.client\.create\s*\(\s*\{|braintree\.dropin\.create/,
    apiHint: ['/braintree/token', '/api/braintree'],
  },
  {
    name: 'Adyen',
    scriptRes: [/checkoutshopper.*adyen|adyen\.com/i, /adyen/i],
    ctorRe: /new\s+AdyenCheckout\s*\(\s*\{/,
    apiHint: ['/adyen/session', '/api/adyen'],
  },
  {
    name: 'Checkout.com',
    scriptRes: [/frames\.checkout\.com/i, /checkout\.js/i],
    ctorRe: /new\s+Frames\s*\(\s*\{[^}]{0,300}publicKey/,
    apiHint: ['/api/checkout', '/checkout/payment'],
  },
];

/**
 * Idea 00997 — map payment-gateway client integrations to checkout endpoints.
 *
 * Detects gateway SDK script loads, constructor/config call sites (public keys
 * masked), and nearby checkout endpoint strings (`/payments`, `/checkout`,
 * `create-payment-intent`) so reviewers can trace where client payment flows
 * reach the backend. No bypass, evasion or key-exfiltration logic anywhere.
 *
 * @param {string} htmlOrJs - Raw HTML or JS source.
 * @returns {Array<{gateway: string, evidence: string, publicKey: string, checkoutHints: string[], line: number}>}
 */
export function mapPaymentGatewayIntegrations(htmlOrJs = '') {
  const src = String(htmlOrJs);
  const findings = [];
  const seen = new Set();

  for (const gw of GATEWAY_DEFS) {
    const loaded = gw.scriptRes.some(re => re.test(src));
    const scripts = [];
    for (const re of gw.scriptRes) {
      const mm = src.match(new RegExp(`['"\`][^'"\`\\s]*?${re.source}[^'"\`\\s]*?['"\`]`, 'i'));
      if (mm && !scripts.includes(mm[0])) scripts.push(mm[0]);
    }

    const ctorMatch = src.match(gw.ctorRe);
    if (!loaded && !ctorMatch) continue;

    const key = gw.name;
    if (seen.has(key)) continue;
    seen.add(key);

    const idx = ctorMatch ? ctorMatch.index : src.search(gw.scriptRes[0]);
    const checkoutHints = [];
    for (const hint of gw.apiHint) {
      if (src.includes(hint)) checkoutHints.push(hint);
    }
    const payRe = /['"`](\/[a-z0-9/_-]*(?:pay|checkout|billing|order)[a-z0-9/_-]*)['"`]/gi;
    let m;
    while ((m = payRe.exec(src)) !== null && checkoutHints.length < 8) {
      if (!checkoutHints.includes(m[1])) checkoutHints.push(m[1]);
    }

    findings.push({
      gateway: gw.name,
      evidence: ctorMatch ? 'constructor-config' : 'sdk-script',
      publicKey: ctorMatch && ctorMatch[1] ? maskSecret(ctorMatch[1]) : scripts.length ? 'via-sdk-script' : 'none',
      checkoutHints,
      line: idx >= 0 ? lineOf(src, idx) : 1,
    });
  }

  return findings;
}

const FRAUD_SDK_DEFS = [
  {
    name: 'Sift',
    scriptRes: [/cdn\.sift\.com\/s\/v\d+\/js\/sift\.js/i, /\bsift\.js\b/i],
    callRe: /\b_sift\.push\(\s*\[\s*['"`]([^'"`]+)['"`]/g,
    beaconRe: /api\d?\.siftscience\.com|cdn\.sift\.com/i,
  },
  {
    name: 'Riskified',
    scriptRes: [/beacon\.riskified\.com/i, /\briskified\b/i],
    callRe: /\bRiskified\.Beacon\.render\(\s*['"`]([^'"`]+)['"`]/g,
    beaconRe: /beacon\.riskified\.com/i,
  },
  {
    name: 'Forter',
    scriptRes: [/forter\.com\/token/i, /\bforter\b/i],
    callRe: /\bforter\.load\(\s*['"`]([^'"`]+)['"`]/g,
    beaconRe: /forter\.com/i,
  },
  {
    name: 'Signifyd',
    scriptRes: [/cdn\.signifyd\.com/i, /\bsignifyd\b/i],
    callRe: /\bsignifyd\.init\(\s*['"`]([^'"`]+)['"`]/g,
    beaconRe: /signifyd\.com/i,
  },
  {
    name: 'Kount',
    scriptRes: [/kaxsdc\/tst\/collect|\bkount\b/i, /\bkount\b/i],
    callRe: /\bkount\.init\(\s*['"`]([^'"`]+)['"`]/g,
    beaconRe: /kount\.net|kount\.com/i,
  },
];

/**
 * Idea 00998 — map fraud-detection SDK endpoints (Sift, Riskified, …) from client code.
 *
 * Detects SDK script loads, beacon endpoint hosts, and event/call names pushed
 * into the SDK (`$create_order`, `render`, …) — the signal inventory a fraud
 * team reviews. Defensive only: no session forging, no event spoofing.
 *
 * @param {string} htmlOrJs - Raw HTML or JS source.
 * @returns {Array<{sdk: string, beaconHost: string|null, signals: Array<{signal: string, line: number}>, line: number}>}
 */
export function mapFraudSdkEndpoints(htmlOrJs = '') {
  const src = String(htmlOrJs);
  const findings = [];
  const seen = new Set();

  for (const sdk of FRAUD_SDK_DEFS) {
    const loaded = sdk.scriptRes.some(re => re.test(src));
    if (!loaded) continue;
    if (seen.has(sdk.name)) continue;
    seen.add(sdk.name);

    const beaconMatch = src.match(sdk.beaconRe);
    const signals = [];
    const seenSig = new Set();
    let m;
    while ((m = sdk.callRe.exec(src)) !== null) {
      if (seenSig.has(m[1])) continue;
      seenSig.add(m[1]);
      signals.push({ signal: m[1], line: lineOf(src, m.index) });
    }

    findings.push({
      sdk: sdk.name,
      beaconHost: beaconMatch ? beaconMatch[0] : null,
      signals,
      line: beaconMatch ? lineOf(src, beaconMatch.index) : 1,
    });
  }

  return findings;
}

const BOT_SDK_DEFS = [
  {
    name: 'PerimeterX',
    scriptRes: [/perimeterx/i, /px-captcha|_pxAppId|_pxJsClientSrc/i],
    signalRes: [/_pxAppId\s*=\s*['"`]([^'"`]+)['"`]/, /px-[a-z0-9]+\.perimeterx\.net/i, /firstPartyEnabled/i],
    challengeHints: ['/px-captcha', '/firstparty', '/perimeterx'],
  },
  {
    name: 'DataDome',
    scriptRes: [/datadome\.co\/tags|datadome/i, /\bdatadome\b/i],
    signalRes: [/dd\.protection\.js/i, /dd\.runtime/i, /dd-?[a-z0-9]+\.js/i],
    challengeHints: ['/datadome', '/dd-captcha', '/captcha'],
  },
  {
    name: 'Cloudflare Turnstile',
    scriptRes: [/challenges\.cloudflare\.com\/turnstile/i, /\bturnstile\b/i],
    signalRes: [/turnstile\.render\(\s*['"`]([^'"`]+)['"`]/, /data-sitekey=['"`]([^'"`]+)['"`]/],
    challengeHints: ['/cdn-cgi/challenge-platform', '/turnstile'],
  },
  {
    name: 'reCAPTCHA',
    scriptRes: [/google\.com\/recaptcha/i, /\bgrecaptcha\b/i],
    signalRes: [/grecaptcha\.execute\(\s*['"`]([^'"`]+)['"`]/, /data-sitekey=['"`]([^'"`]+)['"`]/],
    challengeHints: ['/recaptcha', '/captcha'],
  },
  {
    name: 'hCaptcha',
    scriptRes: [/js\.hcaptcha\.com\/1\/api\.js/i, /\bhcaptcha\b/i],
    signalRes: [/hcaptcha\.render\(\s*['"`]([^'"`]+)['"`]/, /data-sitekey=['"`]([^'"`]+)['"`]/],
    challengeHints: ['/hcaptcha', '/captcha'],
  },
];

/**
 * Idea 00999 — map bot-detection SDK signals to challenge endpoints.
 *
 * Detects bot-management SDK loads (PerimeterX, DataDome, Turnstile, reCAPTCHA,
 * hCaptcha), the signal identifiers they register (app ids, site keys —
 * reported masked or truncated to 8 chars) and the challenge-endpoint patterns
 * found nearby. Purely observational: NO challenge solving, token minting or
 * evasion of any kind.
 *
 * @param {string} htmlOrJs - Raw HTML or JS source.
 * @returns {Array<{sdk: string, signals: Array<{signal: string, line: number}>, challengeHints: string[], line: number}>}
 */
export function mapBotManagementSignals(htmlOrJs = '') {
  const src = String(htmlOrJs);
  const findings = [];
  const seen = new Set();

  for (const sdk of BOT_SDK_DEFS) {
    const loaded = sdk.scriptRes.some(re => re.test(src));
    if (!loaded) continue;
    if (seen.has(sdk.name)) continue;
    seen.add(sdk.name);

    const signals = [];
    const seenSig = new Set();
    let firstIdx = -1;
    for (const re of sdk.signalRes) {
      const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
      const rx = new RegExp(re.source, flags);
      let m;
      while ((m = rx.exec(src)) !== null) {
        if (firstIdx < 0) firstIdx = m.index;
        const raw = m[1] || m[0].slice(0, 40);
        const sig = raw.length > 12 ? raw.slice(0, 8) + '…(truncated)' : raw;
        if (seenSig.has(sig)) continue;
        seenSig.add(sig);
        signals.push({ signal: sig, line: lineOf(src, m.index) });
      }
    }

    const challengeHints = [];
    for (const hint of sdk.challengeHints) {
      if (src.includes(hint)) challengeHints.push(hint);
    }

    findings.push({
      sdk: sdk.name,
      signals,
      challengeHints,
      line: firstIdx >= 0 ? lineOf(src, firstIdx) : 1,
    });
  }

  return findings;
}

/**
 * Run every risk-signal mapper over one source and combine the results.
 *
 * @param {string} htmlOrJs - Raw HTML or JS source.
 * @returns {object} Combined findings keyed by idea number.
 */
export function analyseRiskSignalSurface(htmlOrJs = '') {
  return {
    paymentGateways: mapPaymentGatewayIntegrations(htmlOrJs),
    fraudSdks: mapFraudSdkEndpoints(htmlOrJs),
    botManagement: mapBotManagementSignals(htmlOrJs),
  };
}

export const RISK_SIGNAL_RECON = {
  mapPaymentGatewayIntegrations,
  mapFraudSdkEndpoints,
  mapBotManagementSignals,
  analyseRiskSignalSurface,
};

export default RISK_SIGNAL_RECON;
