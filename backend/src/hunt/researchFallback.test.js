/**
 * researchFallback.test.js — technique-gap research tests (issue #298).
 *
 * Run: cd backend && node --test src/hunt/researchFallback.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { researchTechnique, defensiveQuery, scrubDefensive } from './researchFallback.js';

const quiet = { warn() {}, info() {} };

const mockSearch = {
  async webSearch(query, maxResults) {
    assert.match(query, /security testing methodology/, 'defensive framing applied');
    return [
      { title: 'IDOR — OWASP', url: 'https://example.com/idor', snippet: 'Insecure direct object references occur when...' },
      { title: 'PortSwigger IDOR', url: 'https://example.com/ps', snippet: 'Testing methodology for access control...' },
    ].slice(0, maxResults);
  },
  async webFetch(url) {
    return { title: 'doc', text: 'IDOR testing guide. union select 1,2,3 -- should be scrubbed.' };
  },
};

describe('defensiveQuery', () => {
  it('frames the question as vulnerability-class research', () => {
    const q = defensiveQuery('IDOR');
    assert.match(q, /IDOR/);
    assert.match(q, /vulnerability class/);
  });

  it('refuses out-of-scope questions', () => {
    assert.throws(() => defensiveQuery('rce payload for sale'), /defensive scope/);
  });
});

describe('scrubDefensive', () => {
  it('strips payload-looking content', () => {
    const out = scrubDefensive("test <script>alert(1)</script> ' union select 1,2 -- ' tail");
    assert.doesNotMatch(out, /<script>/);
    assert.doesNotMatch(out, /union select/i);
    assert.match(out, /tail/);
  });
});

describe('researchTechnique', () => {
  it('logs {question, sources, whatWasLearned, howApplied} into the trace', async () => {
    const traced = [];
    const entry = await researchTechnique({
      question: 'IDOR in user profile endpoints',
      search: mockSearch,
      trace: e => traced.push(e),
      logger: quiet,
    });
    assert.equal(entry.question, 'IDOR in user profile endpoints');
    assert.equal(entry.sources.length, 2);
    assert.equal(entry.sources[0].title, 'IDOR — OWASP');
    assert.match(entry.whatWasLearned, /IDOR/);
    assert.match(entry.howApplied, /authorized target/);
    assert.ok(entry.sources.every(s => !/union select/i.test(s.snippet)), 'no payloads stored');
    assert.ok(traced.length >= 2, 'think-aloud trace got research entries');
  });

  it('notes when GitHub code search has no hook', async () => {
    const entry = await researchTechnique({ question: 'SSRF', search: mockSearch, logger: quiet });
    assert.match(entry.githubNote, /no authenticated hook/);
  });

  it('uses the githubSearch hook when provided', async () => {
    const entry = await researchTechnique({
      question: 'SSRF',
      search: mockSearch,
      githubSearch: async () => [{ title: 'detection snippet', url: 'https://github.com/x', snippet: 'concept' }],
      logger: quiet,
    });
    assert.match(entry.githubNote, /consulted/);
    assert.ok(entry.sources.some(s => /github\.com/.test(s.url)));
  });

  it('degrades gracefully when search fails', async () => {
    const entry = await researchTechnique({
      question: 'XSS',
      search: { webSearch: async () => { throw new Error('net down'); }, webFetch: mockSearch.webFetch },
      logger: quiet,
    });
    assert.equal(entry.sources.length, 0);
    assert.match(entry.whatWasLearned, /No web results/);
  });

  it('requires a question', async () => {
    await assert.rejects(() => researchTechnique({ search: mockSearch }), /requires a question/);
  });
});
