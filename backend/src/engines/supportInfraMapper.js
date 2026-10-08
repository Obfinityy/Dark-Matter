/**
 * supportInfraMapper.js — Support-infrastructure surface mapping.
 *
 * Passively maps a target's support stack from widget code and structured
 * data already collected during an authorized engagement (idea-bank
 * ideas 854-860):
 *
 *  - Idea 854: chat-transcript endpoints from widget code.
 *  - Idea 855: canned-response APIs that reveal support infrastructure.
 *  - Idea 856: support-ticket creation endpoints.
 *  - Idea 857: help-center / knowledge-base search APIs.
 *  - Idea 858: FAQ structured-data (JSON-LD) URLs.
 *  - Idea 859: HowTo structured-data tool/supply URLs.
 *  - Idea 860: Recipe structured-data content-API patterns (the JSON-LD
 *    parsing technique generalized and validated on a third schema type).
 *
 * Pure parsing only: JS source text, HTML, or JSON-LD in — structured
 * endpoint maps out. No network access, no form submission, no ticket
 * creation. Results help an authorized hunter inventory the support
 * backend before testing the in-scope endpoints.
 */

const TRANSCRIPT_PATH_RE =
  /["'`]([^"'`]*\/(?:transcript|conversation|chat|message)[-_a-z]*\/(?:history|export|download|messages|thread)[^"'`]*|[^"'`]*\/(?:history|export|download)\/transcript[^"'`]*)["'`]/gi;
const TRANSCRIPT_FUNC_RE =
  /\b(getTranscript|fetchTranscript|downloadTranscript|exportConversation|loadChatHistory|fetchMessages|getConversation)\s*\(/gi;

const CANNED_PATH_RE =
  /["'`]([^"'`]*\/(?:canned[-_ ]?responses?|quick[-_ ]?replies|macros?|saved[-_ ]?replies|response[-_ ]?templates)[^"'`]*|[^"'`]*(?:canned|quick)[-_]?(?:responses?|replies)[^"'`]*)["'`]/gi;
const CANNED_FUNC_RE = /\b(getCannedResponses|fetchQuickReplies|loadMacros|cannedResponses?)\b/gi;

const TICKET_PATH_RE =
  /["'`]([^"'`]*\/(?:tickets?|support[-_ ]?tickets?|cases?|requests?|helpdesk)[^"'`]*)["'`]/gi;
const TICKET_CREATE_RE =
  /\b(createTicket|submitTicket|openTicket|newTicket|postTicket|raiseTicket)\s*\(/gi;
const TICKET_METHOD_RE =
  /(?:\b(post|put))\s*\(?\s*["'`]([^"'`]*\/(?:tickets?|cases?|requests?)[^"'`]*)["'`]/gi;

const KB_SEARCH_RE =
  /["'`]([^"'`]*\/(?:search|api\/(?:v\d+\/)?(?:search|articles?|docs?|kb|help|hc))[^"'`]*|[^"'`]*\/(?:help|support|docs|kb)[^"'`]*search[^"'`]*)["'`]/gi;
const KB_FUNC_RE =
  /\b(searchKnowledgeBase|searchArticles|searchDocs|kbSearch|helpCenterSearch|fetchArticles)\s*\(/gi;

const JSONLD_SCRIPT_RE =
  /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const URL_RE = /^https?:\/\/[^\s"'<>()]+$/i;
const EMBEDDED_URL_RE = /https?:\/\/[^\s"'<>()]+/gi;

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

/** Strip trailing sentence punctuation left by prose-embedded URLs. */
function cleanUrl(u) {
  return u.replace(/[).,;!?]+$/, '');
}

function collectQuotedPaths(src, pattern) {
  const out = new Set();
  const re = new RegExp(pattern.source, 'gi');
  let m;
  while ((m = re.exec(src)) !== null) {
    const p = (m[1] || '').trim();
    if (p && !/\.png|\.jpg|\.svg|\.css|\.woff2?(\?|$)/i.test(p)) out.add(p);
  }
  return [...out];
}

/**
 * Map chat-transcript endpoints from widget code. Idea 854.
 * @param {string} widgetCode widget/page JavaScript source
 * @returns {{endpointPaths: string[], transcriptFunctions: string[]}}
 */
export function mapChatTranscriptEndpoints(widgetCode = '') {
  const src = String(widgetCode || '');
  const transcriptFunctions = new Set();
  TRANSCRIPT_FUNC_RE.lastIndex = 0;
  let m;
  while ((m = TRANSCRIPT_FUNC_RE.exec(src)) !== null) transcriptFunctions.add(m[1]);
  return {
    endpointPaths: collectQuotedPaths(src, TRANSCRIPT_PATH_RE),
    transcriptFunctions: [...transcriptFunctions],
  };
}

/**
 * Find canned-response / quick-reply APIs in widget code. Idea 855.
 * @param {string} jsSource JavaScript source text
 * @returns {{apiPaths: string[], references: string[]}}
 */
export function mineCannedResponseApis(jsSource = '') {
  const src = String(jsSource || '');
  const references = new Set();
  CANNED_FUNC_RE.lastIndex = 0;
  let m;
  while ((m = CANNED_FUNC_RE.exec(src)) !== null) references.add(m[1]);
  return {
    apiPaths: collectQuotedPaths(src, CANNED_PATH_RE),
    references: [...references],
  };
}

/**
 * Map support-ticket creation endpoints. Idea 856.
 * @param {string} jsSource JavaScript source text
 * @returns {{ticketPaths: string[], creationCalls: string[], writeMethods: {method: string, path: string}[]}}
 */
export function mapTicketCreationEndpoints(jsSource = '') {
  const src = String(jsSource || '');
  const creationCalls = new Set();
  TICKET_CREATE_RE.lastIndex = 0;
  let m;
  while ((m = TICKET_CREATE_RE.exec(src)) !== null) creationCalls.add(m[1]);
  const writeMethods = [];
  TICKET_METHOD_RE.lastIndex = 0;
  while ((m = TICKET_METHOD_RE.exec(src)) !== null) {
    writeMethods.push({ method: m[1].toUpperCase(), path: m[2] });
  }
  return {
    ticketPaths: collectQuotedPaths(src, TICKET_PATH_RE),
    creationCalls: [...creationCalls],
    writeMethods,
  };
}

/**
 * Map help-center / knowledge-base search APIs. Idea 857.
 * @param {string} jsSource JavaScript source text
 * @returns {{searchPaths: string[], searchFunctions: string[]}}
 */
export function mapKnowledgeBaseSearchApis(jsSource = '') {
  const src = String(jsSource || '');
  const searchFunctions = new Set();
  KB_FUNC_RE.lastIndex = 0;
  let m;
  while ((m = KB_FUNC_RE.exec(src)) !== null) searchFunctions.add(m[1]);
  return {
    searchPaths: collectQuotedPaths(src, KB_SEARCH_RE),
    searchFunctions: [...searchFunctions],
  };
}

/**
 * Normalize a JSON-LD input (object, array, JSON string, or HTML page with
 * embedded ld+json script blocks) into a flat list of schema nodes.
 * @param {object|object[]|string} jsonLd
 * @returns {object[]} schema nodes
 */
export function parseJsonLdNodes(jsonLd) {
  if (jsonLd == null) return [];
  if (typeof jsonLd === 'string') {
    const text = jsonLd.trim();
    if (/<script/i.test(text)) {
      const nodes = [];
      let m;
      JSONLD_SCRIPT_RE.lastIndex = 0;
      while ((m = JSONLD_SCRIPT_RE.exec(text)) !== null) {
        try {
          const parsed = JSON.parse(m[1]);
          nodes.push(...parseJsonLdNodes(parsed));
        } catch {
          /* skip malformed blocks */
        }
      }
      return nodes;
    }
    try {
      return parseJsonLdNodes(JSON.parse(text));
    } catch {
      return [];
    }
  }
  if (Array.isArray(jsonLd)) return jsonLd.flatMap(parseJsonLdNodes);
  if (typeof jsonLd === 'object') {
    const graph = jsonLd['@graph'];
    if (Array.isArray(graph)) return graph.flatMap(parseJsonLdNodes);
    return [jsonLd];
  }
  return [];
}

/**
 * Keep only nodes of the given @type (handles string or array types).
 * @param {object[]} nodes
 * @param {string} type schema.org type name
 * @returns {object[]}
 */
export function filterSchemaType(nodes, type) {
  const want = String(type).toLowerCase();
  return (nodes || []).filter(n => {
    const t = n && n['@type'];
    if (!t) return false;
    return (Array.isArray(t) ? t : [t]).some(x => String(x).toLowerCase() === want);
  });
}

function harvestUrls(value, into) {
  if (value == null) return;
  if (typeof value === 'string') {
    const v = value.trim();
    if (URL_RE.test(v)) {
      into.add(v);
    } else {
      // URLs embedded in prose (e.g. FAQ answer text)
      EMBEDDED_URL_RE.lastIndex = 0;
      let m;
      while ((m = EMBEDDED_URL_RE.exec(v)) !== null) into.add(cleanUrl(m[0]));
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) harvestUrls(item, into);
    return;
  }
  if (typeof value === 'object') {
    for (const key of Object.keys(value)) harvestUrls(value[key], into);
  }
}

/**
 * Parse FAQPage schema for support URLs. Idea 858.
 * @param {object|object[]|string} jsonLd JSON-LD nodes, JSON string, or HTML
 * @returns {{faqCount: number, supportUrls: string[], questions: string[]}}
 */
export function extractFaqSupportUrls(jsonLd) {
  const nodes = parseJsonLdNodes(jsonLd);
  const faqs = filterSchemaType(nodes, 'FAQPage');
  const supportUrls = new Set();
  const questions = [];
  for (const faq of faqs) {
    const entities = Array.isArray(faq.mainEntity)
      ? faq.mainEntity
      : [faq.mainEntity].filter(Boolean);
    for (const q of entities) {
      if (q && q.name) questions.push(String(q.name).slice(0, 200));
      const accepted = q && q.acceptedAnswer;
      const answers = Array.isArray(accepted) ? accepted : [accepted].filter(Boolean);
      for (const a of answers) harvestUrls(a && a.text, supportUrls);
      harvestUrls(q && q.url, supportUrls);
    }
  }
  return { faqCount: faqs.length, supportUrls: [...supportUrls], questions };
}

/**
 * Extract tool/supply URLs from HowTo structured data. Idea 859.
 * @param {object|object[]|string} jsonLd JSON-LD nodes, JSON string, or HTML
 * @returns {{howToCount: number, toolUrls: string[], supplyUrls: string[], stepUrls: string[]}}
 */
export function extractHowToToolUrls(jsonLd) {
  const nodes = parseJsonLdNodes(jsonLd);
  const howTos = filterSchemaType(nodes, 'HowTo');
  const toolUrls = new Set();
  const supplyUrls = new Set();
  const stepUrls = new Set();
  for (const h of howTos) {
    harvestUrls(h.tool, toolUrls);
    harvestUrls(h.supply, supplyUrls);
    const steps = Array.isArray(h.step) ? h.step : [h.step].filter(Boolean);
    for (const s of steps) harvestUrls(s && s.url, stepUrls);
    harvestUrls(h.url, stepUrls);
  }
  return {
    howToCount: howTos.length,
    toolUrls: [...toolUrls],
    supplyUrls: [...supplyUrls],
    stepUrls: [...stepUrls],
  };
}

/**
 * Mine Recipe schema for content-API patterns (validates the JSON-LD URL
 * harvesting technique on a third schema type). Idea 860.
 * @param {object|object[]|string} jsonLd JSON-LD nodes, JSON string, or HTML
 * @returns {{recipeCount: number, contentUrls: string[], apiPatterns: string[]}}
 */
export function mineRecipeContentApis(jsonLd) {
  const nodes = parseJsonLdNodes(jsonLd);
  const recipes = filterSchemaType(nodes, 'Recipe');
  const contentUrls = new Set();
  const apiPatterns = new Set();
  for (const r of recipes) {
    harvestUrls(r.image, contentUrls);
    harvestUrls(r.video, contentUrls);
    harvestUrls(r.url, contentUrls);
    for (const u of [...contentUrls]) {
      const pm = u.match(/^(https?:\/\/[^/]+\/[^?#]*)/i);
      if (pm && /\/(api|v\d+|content|media|images?)\//i.test(pm[1])) {
        apiPatterns.add(pm[1].replace(/\/[^/]+$/, '/{resource}'));
      }
    }
  }
  return {
    recipeCount: recipes.length,
    contentUrls: [...contentUrls],
    apiPatterns: [...apiPatterns],
  };
}

/**
 * Full support-infrastructure mapping pass.
 * @param {{widgetCode?: string, jsSources?: string[], jsonLd?: object|object[]|string}} input
 * @returns {object} per-idea mapping results
 */
export function mapSupportInfrastructure({ widgetCode = '', jsSources = [], jsonLd = null } = {}) {
  const sources = [widgetCode, ...(jsSources || [])].map(s => String(s || ''));
  const transcripts = sources.map(mapChatTranscriptEndpoints);
  const canned = sources.map(mineCannedResponseApis);
  const tickets = sources.map(mapTicketCreationEndpoints);
  const kb = sources.map(mapKnowledgeBaseSearchApis);
  return {
    transcripts,
    cannedResponses: canned,
    ticketEndpoints: tickets,
    knowledgeBaseSearch: kb,
    faq: extractFaqSupportUrls(jsonLd),
    howTo: extractHowToToolUrls(jsonLd),
    recipe: mineRecipeContentApis(jsonLd),
    summary: {
      transcriptEndpoints: transcripts.reduce((n, r) => n + r.endpointPaths.length, 0),
      cannedApis: canned.reduce((n, r) => n + r.apiPaths.length, 0),
      ticketPaths: tickets.reduce((n, r) => n + r.ticketPaths.length, 0),
      kbSearchPaths: kb.reduce((n, r) => n + r.searchPaths.length, 0),
    },
  };
}

export const SUPPORT_INFRA_MAPPER = {
  mapChatTranscriptEndpoints,
  mineCannedResponseApis,
  mapTicketCreationEndpoints,
  mapKnowledgeBaseSearchApis,
  parseJsonLdNodes,
  filterSchemaType,
  extractFaqSupportUrls,
  extractHowToToolUrls,
  mineRecipeContentApis,
  mapSupportInfrastructure,
};
export default SUPPORT_INFRA_MAPPER;
