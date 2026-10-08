/**
 * supportInfraMapper.test.js — Tests for the support-infrastructure engine.
 *
 * Ideas 854-860: chat-transcript endpoints (854), canned-response APIs
 * (855), ticket-creation endpoints (856), knowledge-base search APIs (857),
 * FAQ structured-data mining (858), HowTo schema extraction (859),
 * Recipe-schema URL mining (860). All fixtures are synthetic and shaped
 * like real-world widget code / JSON-LD.
 *
 * Run: cd backend && node --test tests/supportInfraMapper.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
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
} from '../src/engines/supportInfraMapper.js';

// ---------------------------------------------------------------- 854
describe('mapChatTranscriptEndpoints (854)', () => {
  const src = `
    async function getTranscript(id) {
      return fetch("/api/chat/conversation/history?id=" + id);
    }
    const url = "https://chat.example.com/v1/transcript/download";
    exportConversation();
  `;

  it('maps transcript endpoint paths', () => {
    const r = mapChatTranscriptEndpoints(src);
    assert.ok(r.endpointPaths.includes('/api/chat/conversation/history?id='));
    assert.ok(r.endpointPaths.includes('https://chat.example.com/v1/transcript/download'));
  });

  it('detects transcript helper functions', () => {
    const r = mapChatTranscriptEndpoints(src);
    assert.ok(r.transcriptFunctions.includes('getTranscript'));
  });

  it('ignores unrelated paths', () => {
    const r = mapChatTranscriptEndpoints('fetch("/api/users/me");');
    assert.deepEqual(r.endpointPaths, []);
    assert.deepEqual(r.transcriptFunctions, []);
  });
});

// ---------------------------------------------------------------- 855
describe('mineCannedResponseApis (855)', () => {
  const src = `
    const macros = await fetch("/api/v2/macros/active.json").then(r => r.json());
    function loadMacros() { return getCannedResponses(); }
  `;

  it('finds canned-response / macro API paths', () => {
    const r = mineCannedResponseApis(src);
    assert.ok(r.apiPaths.includes('/api/v2/macros/active.json'));
  });

  it('detects canned-response code references', () => {
    const r = mineCannedResponseApis(src);
    assert.ok(r.references.includes('getCannedResponses'));
    assert.ok(r.references.includes('loadMacros'));
  });
});

// ---------------------------------------------------------------- 856
describe('mapTicketCreationEndpoints (856)', () => {
  const src = `
    function createTicket(subject, body) {
      return fetch("/api/v2/tickets.json", { method: "POST", body: JSON.stringify({ subject }) });
    }
    const alt = '$.post("/helpdesk/cases", payload);';
  `;

  it('maps ticket paths and creation calls', () => {
    const r = mapTicketCreationEndpoints(src);
    assert.ok(r.ticketPaths.includes('/api/v2/tickets.json'));
    assert.ok(r.creationCalls.includes('createTicket'));
  });

  it('detects explicit write methods against ticket paths', () => {
    const r = mapTicketCreationEndpoints(src);
    assert.ok(r.writeMethods.some((w) => w.method === 'POST' && w.path === '/helpdesk/cases'));
  });
});

// ---------------------------------------------------------------- 857
describe('mapKnowledgeBaseSearchApis (857)', () => {
  const src = `
    async function searchArticles(q) {
      return fetch("/api/v2/help_center/en-us/search.json?query=" + encodeURIComponent(q));
    }
    const legacy = "/support/search?q=";
  `;

  it('maps knowledge-base search paths', () => {
    const r = mapKnowledgeBaseSearchApis(src);
    assert.ok(r.searchPaths.some((p) => p.includes('/api/v2/help_center/en-us/search.json')));
    assert.ok(r.searchPaths.some((p) => p.includes('/support/search')));
  });

  it('detects search helper functions', () => {
    const r = mapKnowledgeBaseSearchApis(src);
    assert.ok(r.searchFunctions.includes('searchArticles'));
  });
});

// ------------------------------------------------------- 858-860 shared
const FAQ_HTML = `
<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
  {"@type":"Question","name":"How do I reset my password?",
   "acceptedAnswer":{"@type":"Answer","text":"Go to <a href=\\"https://support.example.com/reset\\">https://support.example.com/reset</a>."}},
  {"@type":"Question","name":"Where is billing?",
   "acceptedAnswer":{"@type":"Answer","text":"See https://billing.example.com/portal for invoices."}}
]}
</script></head><body></body></html>`;

const HOWTO_JSON = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Fix a leak',
  tool: [
    { '@type': 'HowToTool', name: 'Wrench', url: 'https://shop.example.com/tools/wrench-12' },
    { '@type': 'HowToTool', name: 'Tape' },
  ],
  supply: [{ '@type': 'HowToSupply', name: 'Sealant', url: 'https://shop.example.com/supplies/sealant' }],
  step: [{ '@type': 'HowToStep', name: 'Turn off water', url: 'https://guides.example.com/howto/leak#step1' }],
};

const RECIPE_JSON = {
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Pancakes',
  image: ['https://cdn.example.com/api/v1/media/pancakes.jpg'],
  video: { '@type': 'VideoObject', contentUrl: 'https://cdn.example.com/content/videos/pancakes.mp4' },
};

describe('parseJsonLdNodes / filterSchemaType (helpers)', () => {
  it('extracts nodes from HTML script blocks', () => {
    const nodes = parseJsonLdNodes(FAQ_HTML);
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0]['@type'], 'FAQPage');
  });

  it('parses JSON strings, objects, arrays and @graph', () => {
    assert.equal(parseJsonLdNodes(JSON.stringify(HOWTO_JSON)).length, 1);
    assert.equal(parseJsonLdNodes([HOWTO_JSON, RECIPE_JSON]).length, 2);
    assert.equal(parseJsonLdNodes({ '@graph': [HOWTO_JSON] }).length, 1);
    assert.deepEqual(parseJsonLdNodes(null), []);
    assert.deepEqual(parseJsonLdNodes('not json'), []);
  });

  it('filters by @type case-insensitively incl. array types', () => {
    const nodes = [{ '@type': ['FAQPage', 'Thing'] }, { '@type': 'Recipe' }];
    assert.equal(filterSchemaType(nodes, 'faqpage').length, 1);
    assert.equal(filterSchemaType(nodes, 'recipe').length, 1);
    assert.equal(filterSchemaType(nodes, 'howto').length, 0);
  });
});

// ---------------------------------------------------------------- 858
describe('extractFaqSupportUrls (858)', () => {
  it('parses FAQ schema from HTML and extracts support urls', () => {
    const r = extractFaqSupportUrls(FAQ_HTML);
    assert.equal(r.faqCount, 1);
    assert.equal(r.questions.length, 2);
    assert.ok(r.questions[0].includes('reset my password'));
    assert.ok(r.supportUrls.includes('https://support.example.com/reset'));
    assert.ok(r.supportUrls.includes('https://billing.example.com/portal'));
  });

  it('accepts a plain JSON-LD object', () => {
    const r = extractFaqSupportUrls({
      '@type': 'FAQPage',
      mainEntity: { '@type': 'Question', name: 'Q?', acceptedAnswer: { '@type': 'Answer', text: 'A https://help.example.com/q' } },
    });
    assert.equal(r.faqCount, 1);
    assert.ok(r.supportUrls.includes('https://help.example.com/q'));
  });
});

// ---------------------------------------------------------------- 859
describe('extractHowToToolUrls (859)', () => {
  it('extracts tool, supply and step urls', () => {
    const r = extractHowToToolUrls(HOWTO_JSON);
    assert.equal(r.howToCount, 1);
    assert.deepEqual(r.toolUrls, ['https://shop.example.com/tools/wrench-12']);
    assert.deepEqual(r.supplyUrls, ['https://shop.example.com/supplies/sealant']);
    assert.deepEqual(r.stepUrls, ['https://guides.example.com/howto/leak#step1']);
  });

  it('returns empty lists when the schema is absent', () => {
    const r = extractHowToToolUrls(RECIPE_JSON);
    assert.equal(r.howToCount, 0);
    assert.deepEqual(r.toolUrls, []);
  });
});

// ---------------------------------------------------------------- 860
describe('mineRecipeContentApis (860)', () => {
  it('mines content urls and api patterns from Recipe schema', () => {
    const r = mineRecipeContentApis(RECIPE_JSON);
    assert.equal(r.recipeCount, 1);
    assert.ok(r.contentUrls.includes('https://cdn.example.com/api/v1/media/pancakes.jpg'));
    assert.ok(r.contentUrls.includes('https://cdn.example.com/content/videos/pancakes.mp4'));
    assert.ok(r.apiPatterns.some((p) => p.startsWith('https://cdn.example.com/api/')));
  });

  it('returns empty results for non-recipe input', () => {
    const r = mineRecipeContentApis(HOWTO_JSON);
    assert.equal(r.recipeCount, 0);
    assert.deepEqual(r.contentUrls, []);
  });
});

// ------------------------------------------------------- combined pass
describe('mapSupportInfrastructure', () => {
  it('aggregates all seven ideas across sources', () => {
    const r = mapSupportInfrastructure({
      widgetCode: 'function getTranscript(){ return fetch("/chat/history"); } createTicket("x");',
      jsSources: ['fetch("/api/v2/macros/active.json")', 'searchArticles("q")'],
      jsonLd: FAQ_HTML,
    });
    assert.equal(r.summary.transcriptEndpoints, 1);
    assert.equal(r.summary.cannedApis, 1);
    assert.equal(r.summary.ticketPaths, 0);
    assert.equal(r.summary.kbSearchPaths, 0);
    assert.equal(r.faq.faqCount, 1);
    assert.ok(r.ticketEndpoints[0].creationCalls.includes('createTicket'));
    assert.ok(r.knowledgeBaseSearch[2].searchFunctions.includes('searchArticles'));
  });

  it('handles defaults without crashing', () => {
    const r = mapSupportInfrastructure();
    assert.deepEqual(r.summary, { transcriptEndpoints: 0, cannedApis: 0, ticketPaths: 0, kbSearchPaths: 0 });
    assert.equal(r.faq.faqCount, 0);
  });
});
