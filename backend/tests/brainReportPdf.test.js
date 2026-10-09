/**
 * brainReportPdf.test.js — pdfkit renderer for brain-written reports.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { renderBrainReportPdf, tokenizeHtml } = await import(
  '../src/services/brainReportPdf.js'
);
const { isTruncated, dedupeOverlap } = await import(
  '../src/services/htmlReportService.js'
);

describe('brainReportPdf', () => {
  test('renders a valid PDF from brain fragments', async () => {
    const pdf = await renderBrainReportPdf({
      target: 'https://example.com',
      findings: [{ severity: 'critical', title: 'SQLi' }],
      fragments: [
        { title: 'Summary', html: '<h2>Summary</h2><p>Hello <strong>world</strong>.</p>' },
      ],
    });
    assert.ok(Buffer.isBuffer(pdf));
    assert.ok(pdf.length > 1000, `PDF too small: ${pdf.length}`);
    assert.equal(pdf.slice(0, 5).toString(), '%PDF-');
  });

  test('handles tables, lists, and code blocks', async () => {
    const pdf = await renderBrainReportPdf({
      target: 't',
      findings: [],
      fragments: [
        {
          title: 'Deep',
          html: '<h2>T</h2><ul><li>a</li><li>b</li></ul><table><tr><th>H</th></tr><tr><td>critical</td></tr></table><pre>code()</pre>',
        },
      ],
    });
    assert.ok(pdf.length > 1000);
    assert.equal(pdf.slice(0, 5).toString(), '%PDF-');
  });

  test('tokenizeHtml parses the semantic subset', () => {
    const toks = tokenizeHtml('<h2>Hi</h2><p>a <strong>b</strong></p>');
    const tags = toks.filter(t => t.type !== 'text').map(t => `${t.type}:${t.tag}`);
    assert.deepEqual(tags, ['open:h2', 'close:h2', 'open:p', 'open:strong', 'close:strong', 'close:p']);
  });
});

describe('continuation helpers', () => {
  test('isTruncated detects cut-off replies', () => {
    assert.equal(isTruncated('short'), false);
    const cut = '<h2>Title</h2><p>This is a long paragraph that just stops without finishing the thought or closing the tag properly and keeps going with more words to exceed two hundred characters of total length so the check applies';
    assert.equal(isTruncated(cut), true);
    const full = '<h2>Title</h2><p>This is a complete paragraph with proper ending.</p>';
    assert.equal(isTruncated(full), false);
    const unclosed = `<p>${'x '.repeat(150)}<ul><li>item`;
    assert.equal(isTruncated(unclosed), true);
  });

  test('dedupeOverlap strips repeated tails', () => {
    const existing = 'the quick brown fox jumps over the lazy dog and then continues running';
    assert.equal(dedupeOverlap(existing, 'dog and then continues running FURTHER'), ' FURTHER');
    assert.equal(dedupeOverlap(existing, 'XYZ'), 'XYZ');
    assert.equal(dedupeOverlap(existing, ''), '');
  });
});
