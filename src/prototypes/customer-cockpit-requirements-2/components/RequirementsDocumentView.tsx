import React from 'react';
import prdText from '../../../resources/prd/智慧厨房驾驶舱PRD.md?raw';

const PRD_META = (() => {
  const match = /^版本：([^｜]+)｜日期：([^｜]+)｜状态：(.+)$/m.exec(prdText);
  return {
    version: match?.[1] ?? 'V1.0',
    date: match?.[2] ?? '—',
    status: match?.[3] ?? '开发需求稿',
  };
})();

type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; rows: string[][] }
  | { type: 'code'; language: string; value: string };

function cleanInlineMarkdown(text: string) {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
}

function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    const codeFence = /^```\s*(.*)$/.exec(line);
    if (codeFence) {
      const language = codeFence[1].trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== '```') {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: 'code', language, value: codeLines.join('\n') });
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: cleanInlineMarkdown(heading[2]) });
      index += 1;
      continue;
    }

    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        const cells = lines[index].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cleanInlineMarkdown(cell.trim()));
        if (!cells.every((cell) => /^:?-{3,}:?$/.test(cell))) rows.push(cells);
        index += 1;
      }
      if (rows.length > 0) blocks.push({ type: 'table', rows });
      continue;
    }

    const unordered = /^[-*]\s+(.*)$/.exec(line);
    const ordered = /^\d+\.\s+(.*)$/.exec(line);
    if (unordered || ordered) {
      const items: string[] = [];
      const isOrdered = Boolean(ordered);
      while (index < lines.length) {
        const item = isOrdered ? /^\d+\.\s+(.*)$/.exec(lines[index].trim()) : /^[-*]\s+(.*)$/.exec(lines[index].trim());
        if (!item) break;
        items.push(cleanInlineMarkdown(item[1]));
        index += 1;
      }
      blocks.push({ type: 'list', ordered: isOrdered, items });
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || /^(#{1,3})\s+/.test(next) || next.startsWith('|') || /^[-*]\s+/.test(next) || /^\d+\.\s+/.test(next)) break;
      paragraphLines.push(next);
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: cleanInlineMarkdown(paragraphLines.join(' ')) });
  }

  return blocks;
}

const PRD_BLOCKS = parseMarkdown(prdText);

export function RequirementsDocumentView() {
  return (
    <main className="uk-prd-page">
      <header className="uk-prd-hero">
        <div>
          <span className="uk-module-kicker">原型管理 · 需求文档</span>
          <h2>智慧厨房驾驶舱 PRD</h2>
          <p>当前原型的产品范围、页面需求、字段字典和验收口径。</p>
        </div>
        <div className="uk-prd-meta">
          <b>{PRD_META.version}</b>
          <span>{PRD_META.status}</span>
          <span>{PRD_META.date}</span>
        </div>
      </header>

      <article className="uk-prd-document" data-annotation-id="prd-document">
        {PRD_BLOCKS.map((block, index) => {
          if (block.type === 'heading') {
            const Heading = `h${Math.min(block.level + 1, 4)}` as keyof JSX.IntrinsicElements;
            return <Heading key={`heading-${index}`}>{block.text}</Heading>;
          }
          if (block.type === 'table') {
            const [header, ...rows] = block.rows;
            return (
              <div className="uk-prd-table-wrap" key={`table-${index}`}>
                <table className="uk-prd-table">
                  <thead><tr>{header.map((cell) => <th key={cell}>{cell}</th>)}</tr></thead>
                  <tbody>{rows.map((row, rowIndex) => <tr key={`row-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
          }
          if (block.type === 'list') {
            const List = block.ordered ? 'ol' : 'ul';
            return <List key={`list-${index}`}>{block.items.map((item) => <li key={item}>{item}</li>)}</List>;
          }
          if (block.type === 'code') {
            return (
              <div className="uk-prd-code-wrap" key={`code-${index}`}>
                {block.language ? <span className="uk-prd-code-language">{block.language}</span> : null}
                <pre className="uk-prd-code"><code>{block.value}</code></pre>
              </div>
            );
          }
          return <p key={`paragraph-${index}`}>{block.text}</p>;
        })}
      </article>
    </main>
  );
}
