/**
 * extract-payloads.mjs — pragmatic PATT README -> structured JSON extractor.
 *
 * Reads the shallow clone at /tmp/patt and writes one JSON dataset per
 * category to backend/data/payload-library/<slug>.json.
 *
 * Heuristic (deliberately simple, not perfect):
 *  - Split each README into sections by markdown headings.
 *  - Skip prose-only sections (Summary/TOC, Methodology, References, Labs,
 *    Tools, Disclaimer).
 *  - Extract fenced code blocks; each non-empty, non-comment line becomes a
 *    payload candidate. Also extract inline `code` spans from list items.
 *  - Drop obvious prose lines and comment lines, dedupe, cap 300/category.
 *
 * Item shape: { id, title, payload, context, tags }
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const PATT = '/tmp/patt';
const OUT = path.resolve(
  process.env.HOME + '/workspace/dm-v2/work/repo/backend/data/payload-library'
);

// folder name -> { slug, name }
const CATEGORIES = [
  ['XSS Injection', { slug: 'xss', name: 'XSS Injection' }],
  ['SQL Injection', { slug: 'sqli', name: 'SQL Injection' }],
  ['Command Injection', { slug: 'command-injection', name: 'Command Injection' }],
  ['Directory Traversal', { slug: 'file-inclusion', name: 'File Inclusion (LFI/RFI)' }],
  ['File Inclusion', { slug: 'file-inclusion', name: 'File Inclusion (LFI/RFI)' }],
  ['Server Side Request Forgery', { slug: 'ssrf', name: 'Server Side Request Forgery' }],
  ['Server Side Template Injection', { slug: 'ssti', name: 'Server Side Template Injection' }],
  ['XXE Injection', { slug: 'xxe', name: 'XXE Injection' }],
  ['LDAP Injection', { slug: 'ldap-injection', name: 'LDAP Injection' }],
  ['NoSQL Injection', { slug: 'nosql-injection', name: 'NoSQL Injection' }],
  ['XPATH Injection', { slug: 'xpath-injection', name: 'XPATH Injection' }],
  ['Open Redirect', { slug: 'open-redirect', name: 'Open Redirect' }],
  ['CRLF Injection', { slug: 'crlf-injection', name: 'CRLF Injection' }],
  ['CSV Injection', { slug: 'csv-injection', name: 'CSV Injection' }],
  ['GraphQL Injection', { slug: 'graphql-injection', name: 'GraphQL Injection' }],
  ['Prototype Pollution', { slug: 'prototype-pollution', name: 'Prototype Pollution' }],
  ['HTTP Parameter Pollution', { slug: 'hpp', name: 'HTTP Parameter Pollution' }],
  ['CORS Misconfiguration', { slug: 'cors-misconfiguration', name: 'CORS Misconfiguration' }],
  ['Clickjacking', { slug: 'clickjacking', name: 'Clickjacking' }],
  ['Upload Insecure Files', { slug: 'file-upload', name: 'Upload Insecure Files' }],
  ['Request Smuggling', { slug: 'request-smuggling', name: 'Request Smuggling' }],
  ['Web Cache Deception', { slug: 'web-cache-deception', name: 'Web Cache Deception' }],
  ['Server Side Include Injection', { slug: 'ssi-injection', name: 'Server Side Include Injection' }],
];

const MAX_PER_CATEGORY = 300;

// Section headings that are prose/documentation, not payload sources.
// NOTE: "Methodology" is intentionally NOT skipped — many PATT READMEs keep
// their payload code blocks under that heading; the prose filter drops the
// explanatory text instead.
const SKIP_HEADINGS = new Set([
  'summary', 'references', 'labs', 'tools', 'disclaimer',
  'contributing', 'acknowledgements', 'credits',
]);

function isSkippedHeading(text) {
  const t = text.toLowerCase().trim();
  return SKIP_HEADINGS.has(t) || t.startsWith('summary');
}

/** Split markdown into [{ heading, level, body }] sections. */
function splitSections(markdown) {
  const sections = [];
  let current = { heading: '', level: 0, body: '' };
  for (const line of markdown.split('\n')) {
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      if (current.body.trim() || current.heading) sections.push(current);
      current = { heading: m[2].trim(), level: m[1].length, body: '' };
    } else {
      current.body += line + '\n';
    }
  }
  if (current.body.trim() || current.heading) sections.push(current);
  return sections;
}

/** A line is probably prose (not a payload) if it reads like a sentence. */
function looksLikeProse(line) {
  const t = line.trim();
  if (t.length < 2) return true;
  if (t.length > 500) return true; // too long to be a useful single payload line
  if (/^[A-Z][a-z]+(\s+[a-zA-Z,;:'"()]+){4,}.*[.]$/.test(t)) return true; // sentence
  if (/^(the|this|these|those|when|where|which|however|for example|note|warning|tip)\b/i.test(t) && t.includes(' ') && t.endsWith('.')) return true;
  return false;
}

function isCommentLine(t) {
  return (
    t.startsWith('#') || t.startsWith('//') || t.startsWith('--') ||
    t.startsWith('/*') || t.startsWith('<!--') || t.startsWith('* ') ||
    t.startsWith(';') || t.startsWith('REM ') || t.startsWith('::')
  );
}

function extractFromBody(body, contextLabel, slug, seen, out) {
  // 1) Fenced code blocks.
  const fenceRe = /```[a-zA-Z0-9+#-]*\n([\s\S]*?)```/g;
  let m;
  while ((m = fenceRe.exec(body)) !== null) {
    for (const rawLine of m[1].split('\n')) {
      const line = rawLine.trim();
      if (!line || isCommentLine(line) || looksLikeProse(line)) continue;
      addPayload(line, contextLabel, slug, seen, out);
    }
  }
  // 2) Markdown table rows: | Description | `payload` | — extract code spans
  //    from every cell of non-separator rows.
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('|') || !line.endsWith('|')) continue;
    if (/^\|[\s:\-|]+\|$/.test(line)) continue; // separator row
    const cells = line.split('|').slice(1, -1);
    for (const cell of cells) {
      const codeRe = /`([^`]{2,300})`/g;
      let cm;
      while ((cm = codeRe.exec(cell)) !== null) {
        const payload = cm[1].trim();
        if (!payload || isCommentLine(payload)) continue;
        addPayload(payload, contextLabel, slug, seen, out);
      }
    }
  }
  // 3) Inline `code` spans inside list items (e.g. "- `payload` — desc").
  const inlineRe = /^[\s]*[-*]\s+`([^`]{2,200})`/gm;
  while ((m = inlineRe.exec(body)) !== null) {
    const line = m[1].trim();
    if (!line || isCommentLine(line)) continue;
    addPayload(line, contextLabel, slug, seen, out);
  }
}

/** Demo/example program lines that are not payloads. */
function looksLikeDemoCode(t) {
  return (
    /^(<\?php|\?>|import\s|from\s+[\w.]+\s+import|def\s|function\s|class\s|return\s|print\(|console\.log|echo\s|var\s|let\s|const\s)/.test(t) ||
    /^\$[A-Za-z_]\w*\s*=/.test(t) || // $var = ... (PHP demo assignments)
    /^[A-Za-z_]\w*\s*=\s*(input\(|requests\.|urllib|sys\.)/.test(t) // python demo
  );
}

function cleanPayload(raw) {
  let t = raw.trim();
  // strip stray backticks left over from nested formatting
  t = t.replace(/^`+|`+$/g, '').trim();
  return t;
}

function addPayload(rawPayload, contextLabel, slug, seen, out) {
  const payload = cleanPayload(rawPayload);
  if (!payload || looksLikeDemoCode(payload)) return;
  const key = payload;
  if (seen.has(key)) return;
  if (out.length >= MAX_PER_CATEGORY) return;
  seen.add(key);
  out.push({
    id: `${slug}-${out.length + 1}`,
    title: contextLabel,
    payload,
    context: contextLabel,
    tags: [slug],
  });
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const bySlug = new Map(); // slug -> { name, items, seen }

  for (const [folder, meta] of CATEGORIES) {
    const readme = path.join(PATT, folder, 'README.md');
    let markdown;
    try {
      markdown = await fs.readFile(readme, 'utf8');
    } catch {
      console.warn(`missing README for folder: ${folder}`);
      continue;
    }
    if (!bySlug.has(meta.slug)) bySlug.set(meta.slug, { name: meta.name, items: [], seen: new Set() });
    const bucket = bySlug.get(meta.slug);
    if (bucket.name !== meta.name && folder === 'File Inclusion') {
      // keep merged display name
    }

    const sections = splitSections(markdown);
    for (const section of sections) {
      if (isSkippedHeading(section.heading)) continue;
      const contextLabel = section.heading || meta.name;
      extractFromBody(section.body, contextLabel, meta.slug, bucket.seen, bucket.items);
    }
    console.log(`${meta.slug}: ${bucket.items.length} payloads (folder: ${folder})`);
  }

  for (const [slug, bucket] of bySlug) {
    const file = path.join(OUT, `${slug}.json`);
    await fs.writeFile(file, JSON.stringify(bucket.items, null, 2) + '\n');
  }
  const total = [...bySlug.values()].reduce((n, b) => n + b.items.length, 0);
  console.log(`TOTAL: ${total} payloads across ${bySlug.size} datasets -> ${OUT}`);
}

main().catch(err => { console.error(err); process.exit(1); });
