/**
 * Maha Enterprise - AI Manezar Markdown to HTML Parser
 * 100% XSS-Safe: strictly escapes all HTML before transforming markdown constructs.
 * Supports:
 * - Standalone bold lines and headers: **গুদাম মজুদ (Warehouse Stock):**
 * - Inline bold: **...** and __...__ with Bengali & English Unicode, numbers, colons, parentheses
 * - Markdown Headings: #, ##, ###, #### (safely stripping redundant outer asterisks)
 * - Lists: Bullets (-, *, •, +) and Numbered (1. or ১.)
 * - Inline code: `...`
 * - Markdown tables: | col | col |
 */

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderInlineMarkdownHtml(escapedText: string): string {
  if (!escapedText) return '';
  let result = escapedText;

  // Inline code: `code`
  result = result.replace(
    /`([^`]+)`/g,
    '<code class="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-xs border border-slate-700">$1</code>'
  );

  // Bold: **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
  result = result.replace(/__(.+?)__/g, '<strong class="text-white font-bold">$1</strong>');

  return result;
}

export function renderMarkdownToHtml(rawMarkdown: string): string {
  if (!rawMarkdown) return '';

  // 1. Strict HTML escaping (Prevents any XSS, raw script injection, or event handlers)
  const escaped = escapeHtml(rawMarkdown);
  const lines = escaped.split('\n');

  const htmlLines: string[] = [];
  let inList: 'ul' | 'ol' | null = null;
  let inTable = false;
  let tableHeaderParsed = false;

  const closeList = () => {
    if (inList) {
      htmlLines.push(inList === 'ul' ? '</ul>' : '</ol>');
      inList = null;
    }
  };

  const closeTable = () => {
    if (inTable) {
      htmlLines.push('</tbody></table></div>');
      inTable = false;
      tableHeaderParsed = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check for Table Row: | cell | cell |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeList();

      // Check if it's a separator row: | --- | :--- | ---: |
      const isSeparator = /^\|(?:\s*:?-+:?\s*\|)+$/.test(trimmed);
      if (isSeparator) {
        tableHeaderParsed = true;
        continue;
      }

      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => renderInlineMarkdownHtml(c.trim()));

      if (!inTable) {
        htmlLines.push('<div class="ai-table-wrap overflow-x-auto my-3"><table class="ai-md-table w-full border-collapse">');
        htmlLines.push('<thead><tr>');
        cells.forEach((cell) => htmlLines.push(`<th>${cell}</th>`));
        htmlLines.push('</tr></thead><tbody>');
        inTable = true;
        tableHeaderParsed = false;
      } else {
        htmlLines.push('<tr>');
        cells.forEach((cell) => htmlLines.push(`<td>${cell}</td>`));
        htmlLines.push('</tr>');
      }
      continue;
    } else {
      closeTable();
    }

    // Markdown Headings: #, ##, ###, ####
    const headingMatch = trimmed.match(/^(#{1,4})\s*(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      let headerContent = headingMatch[2].trim();

      // Strip outer bold wrapping if present (e.g. `### **Title:**` -> `Title:`)
      if (
        (headerContent.startsWith('**') && headerContent.endsWith('**')) ||
        (headerContent.startsWith('__') && headerContent.endsWith('__'))
      ) {
        headerContent = headerContent.slice(2, -2).trim();
      }

      const inlineFormatted = renderInlineMarkdownHtml(headerContent);
      const tagClass =
        level === 1
          ? 'ai-md-h1 text-xl font-bold text-white mt-4 mb-2'
          : level === 2
          ? 'ai-md-h2'
          : level === 3
          ? 'ai-md-h3'
          : 'ai-md-h4';

      htmlLines.push(`<h${level} class="${tagClass}">${inlineFormatted}</h${level}>`);
      continue;
    }

    // Standalone Bold Header Line: e.g. **গুদাম মজুদ (Warehouse Stock):** or **মহাজন বা সাপ্লায়ার দেনা (Supplier Payables)**:
    const standaloneBoldHeader = trimmed.match(/^(\*\*|__)(.+?)\1(?:\s*:)?$/);
    if (standaloneBoldHeader) {
      closeList();
      let titleContent = standaloneBoldHeader[2].trim();
      if (trimmed.endsWith(':') && !titleContent.endsWith(':')) {
        titleContent += ':';
      }
      const inlineFormatted = renderInlineMarkdownHtml(titleContent);
      htmlLines.push(
        `<h3 class="ai-md-h3 font-bold text-amber-300 mt-3 mb-1.5 flex items-center gap-1.5">${inlineFormatted}</h3>`
      );
      continue;
    }

    // Bullet list items: -, *, •, +
    const bulletMatch = trimmed.match(/^([-*•+]|\u2022)\s+(.*)$/);
    if (bulletMatch) {
      if (inList !== 'ul') {
        closeList();
        htmlLines.push('<ul class="ai-md-list list-disc ml-5 space-y-1 text-slate-200">');
        inList = 'ul';
      }
      const inlineFormatted = renderInlineMarkdownHtml(bulletMatch[2]);
      htmlLines.push(`<li class="leading-relaxed">${inlineFormatted}</li>`);
      continue;
    }

    // Numbered list items: 1. or ১. or 1) or ১)
    const numberedMatch = trimmed.match(/^([0-9০-৯]+)[.)]\s+(.*)$/);
    if (numberedMatch) {
      if (inList !== 'ol') {
        closeList();
        htmlLines.push('<ol class="ai-md-list list-decimal ml-5 space-y-1 text-slate-200">');
        inList = 'ol';
      }
      const inlineFormatted = renderInlineMarkdownHtml(numberedMatch[2]);
      htmlLines.push(`<li class="leading-relaxed">${inlineFormatted}</li>`);
      continue;
    }

    // Blank line
    if (!trimmed) {
      closeList();
      htmlLines.push('<div class="h-2"></div>');
      continue;
    }

    // Standard paragraph
    closeList();
    const inlineFormatted = renderInlineMarkdownHtml(trimmed);
    htmlLines.push(`<p class="mb-1 text-slate-200 leading-relaxed">${inlineFormatted}</p>`);
  }

  closeList();
  closeTable();

  return htmlLines.join('\n');
}
