// Minimal markdown renderer (no external dependency):
// headings, bold, italic, inline code, fenced code blocks, links, lists,
// blockquotes, paragraphs. Used for assistant replies and hunt reports.
import React from 'react';

function renderInline(text, keyPrefix) {
  const parts = [];
  // Order matters: code, link, bold, italic
  const re = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('`')) {
      parts.push(<code key={`${keyPrefix}-${i++}`} className="md-inline-code">{token.slice(1, -1)}</code>);
    } else if (token.startsWith('[')) {
      const label = token.slice(1, token.indexOf(']'));
      const url = token.slice(token.indexOf('(') + 1, token.lastIndexOf(')'));
      parts.push(
        <a key={`${keyPrefix}-${i++}`} href={url} target="_blank" rel="noreferrer" className="md-link">
          {label}
        </a>,
      );
    } else if (token.startsWith('**')) {
      parts.push(<strong key={`${keyPrefix}-${i++}`}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={`${keyPrefix}-${i++}`}>{token.slice(1, -1)}</em>);
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
}

export default function Markdown({ text }) {
  const lines = String(text || '').split('\n');
  const blocks = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <pre key={key++} className="md-codeblock">
          {lang ? <div className="md-codeblock-lang">{lang}</div> : null}
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }
    // Headings
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const content = renderInline(heading[2], `h${key}`);
      const Tag = `h${Math.min(level + 1, 4)}`;
      blocks.push(<Tag key={key++} className="md-heading">{content}</Tag>);
      i += 1;
      continue;
    }
    // Blockquote
    if (line.trimStart().startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push(
        <blockquote key={key++} className="md-quote">
          {renderInline(quoteLines.join(' '), `q${key}`)}
        </blockquote>,
      );
      continue;
    }
    // List
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items = [];
      const ordered = /^\s*\d+\.\s+/.test(line);
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        i += 1;
      }
      const ListTag = ordered ? 'ol' : 'ul';
      blocks.push(
        <ListTag key={key++} className="md-list">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `li${key}-${idx}`)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }
    // Blank line
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    // Paragraph (merge consecutive lines)
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trimStart().startsWith('```') &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\s*([-*]|\d+\.)\s+/.test(lines[i]) &&
      !lines[i].trimStart().startsWith('>')
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push(<p key={key++} className="md-paragraph">{renderInline(paraLines.join(' '), `p${key}`)}</p>);
  }
  return <div className="markdown">{blocks}</div>;
}
