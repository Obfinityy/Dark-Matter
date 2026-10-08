/**
 * targetTypeClassifier.js — Idea 30006.
 *
 * Labels a target (SaaS, e-commerce, API-only, static, mobile-backend) from
 * its structure and tech fingerprints, then selects a hunt plan template.
 * Classification only — no probing happens here.
 */

/** Plan templates keyed by target type. */
export const PLAN_TEMPLATES = {
  saas: {
    id: 'saas-standard',
    phases: ['recon', 'auth-mapping', 'testing', 'chaining', 'reporting'],
    focus: ['idor', 'xss', 'sqli', 'auth-bypass'],
  },
  ecommerce: {
    id: 'ecommerce-standard',
    phases: ['recon', 'cart-flow', 'payment-flow', 'testing', 'chaining', 'reporting'],
    focus: ['idor', 'payment-logic', 'xss', 'csrf'],
  },
  'api-only': {
    id: 'api-standard',
    phases: ['recon', 'api-mapping', 'testing', 'chaining', 'reporting'],
    focus: ['idor', 'bfla', 'auth-bypass', 'rate-limit'],
  },
  static: {
    id: 'static-light',
    phases: ['recon', 'testing', 'reporting'],
    focus: ['xss', 'info-leak', 'misconfig'],
  },
  'mobile-backend': {
    id: 'mobile-backend-standard',
    phases: ['recon', 'api-mapping', 'mobile-specific', 'testing', 'reporting'],
    focus: ['idor', 'auth-bypass', 'api-key-leak'],
  },
  unknown: {
    id: 'generic-standard',
    phases: ['recon', 'testing', 'chaining', 'reporting'],
    focus: ['xss', 'sqli', 'idor'],
  },
};

const TECH_SIGNALS = [
  {
    type: 'ecommerce',
    tech: [/shopify/i, /magento/i, /woocommerce/i, /bigcommerce/i, /salesforce commerce/i],
    paths: [/\/cart/, /\/checkout/, /\/product\//],
    weight: 3,
  },
  {
    type: 'saas',
    tech: [/intercom/i, /segment/i, /stripe/i, /auth0/i, /okta/i, /hubspot/i],
    paths: [/\/dashboard/, /\/app\//, /\/login/, /\/signup/],
    weight: 2,
  },
  {
    type: 'api-only',
    tech: [/graphql/i, /swagger/i, /openapi/i, /fastapi/i, /express/i],
    paths: [/\/api\//, /\/v1\//, /\/graphql/],
    weight: 3,
  },
  {
    type: 'mobile-backend',
    tech: [/firebase/i, /onesignal/i, /branch\.io/i],
    paths: [/\.well-known\/assetlinks/, /\/apple-app-site-association/],
    weight: 3,
  },
  {
    type: 'static',
    tech: [/jekyll/i, /hugo/i, /gatsby/i, /next\/static/i, /cloudflare/i],
    paths: [],
    weight: 1,
  },
];

/**
 * Classify a target from structure + tech fingerprints.
 * @param {object} target - { domain, tech: string[], paths: string[], headers: object }
 * @returns {{ type: string, confidence: number, template: object, signals: string[] }}
 */
export function classifyTarget(target = {}) {
  const tech = (target.tech || []).join(' ');
  const paths = target.paths || [];
  const scores = {};
  const signals = [];
  for (const sig of TECH_SIGNALS) {
    let score = 0;
    for (const re of sig.tech) {
      re.lastIndex = 0;
      if (re.test(tech)) {
        score += sig.weight;
        signals.push(`${sig.type}: tech match ${re.source.slice(0, 24)}`);
      }
    }
    for (const re of sig.paths) {
      re.lastIndex = 0;
      if (paths.some(p => re.test(p))) {
        score += sig.weight;
        signals.push(`${sig.type}: path match ${re.source.slice(0, 24)}`);
      }
    }
    if (score > 0) scores[sig.type] = (scores[sig.type] || 0) + score;
  }
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const type = entries.length ? entries[0][0] : 'unknown';
  const top = entries.length ? entries[0][1] : 0;
  const runner = entries.length > 1 ? entries[1][1] : 0;
  const confidence = top === 0 ? 0 : Math.min(0.99, 0.5 + (top - runner) * 0.12);
  return {
    type,
    confidence: Math.round(confidence * 100) / 100,
    template: PLAN_TEMPLATES[type] || PLAN_TEMPLATES.unknown,
    signals,
  };
}

/**
 * Select the plan template for a classified target.
 * @param {object} classification - output of classifyTarget
 * @returns {object} plan template
 */
export function selectPlanTemplate(classification) {
  return classification.template || PLAN_TEMPLATES.unknown;
}

export const TARGET_TYPE_CLASSIFIER = { PLAN_TEMPLATES, classifyTarget, selectPlanTemplate };
export default TARGET_TYPE_CLASSIFIER;
