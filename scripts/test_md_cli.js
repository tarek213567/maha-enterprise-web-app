/**
 * CLI verification check for AI Manezar Markdown Rendering
 * Strictly verifies zero literal `**` remains in rendered output for all prompt test cases.
 */

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdownHtml(escapedText) {
  if (!escapedText) return '';
  let result = escapedText;
  result = result.replace(
    /`([^`]+)`/g,
    '<code class="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-xs border border-slate-700">$1</code>'
  );
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
  result = result.replace(/__(.+?)__/g, '<strong class="text-white font-bold">$1</strong>');
  return result;
}

function renderMarkdownToHtml(rawMarkdown) {
  if (!rawMarkdown) return '';
  const escaped = escapeHtml(rawMarkdown);
  const lines = escaped.split('\n');

  const htmlLines = [];
  let inList = null;
  let inTable = false;

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
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeList();
      const isSeparator = /^\|(?:\s*:?-+:?\s*\|)+$/.test(trimmed);
      if (isSeparator) continue;
      const cells = trimmed.slice(1, -1).split('|').map((c) => renderInlineMarkdownHtml(c.trim()));
      if (!inTable) {
        htmlLines.push('<div class="ai-table-wrap overflow-x-auto my-3"><table class="ai-md-table w-full border-collapse">');
        htmlLines.push('<thead><tr>');
        cells.forEach((cell) => htmlLines.push(`<th>${cell}</th>`));
        htmlLines.push('</tr></thead><tbody>');
        inTable = true;
      } else {
        htmlLines.push('<tr>');
        cells.forEach((cell) => htmlLines.push(`<td>${cell}</td>`));
        htmlLines.push('</tr>');
      }
      continue;
    } else {
      closeTable();
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s*(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      let headerContent = headingMatch[2].trim();
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

    if (!trimmed) {
      closeList();
      htmlLines.push('<div class="h-2"></div>');
      continue;
    }

    closeList();
    const inlineFormatted = renderInlineMarkdownHtml(trimmed);
    htmlLines.push(`<p class="mb-1 text-slate-200 leading-relaxed">${inlineFormatted}</p>`);
  }

  closeList();
  closeTable();
  return htmlLines.join('\n');
}

const testCases = [
  { name: '1. Standalone Bold Header (Parens + Colon)', text: '**গুদাম মজুদ (Warehouse Stock):**' },
  { name: '2. Standalone Bold Header (Bengali/English)', text: '**মহাজন বা সাপ্লায়ার দেনা (Supplier Payables):**' },
  { name: '3. Unicode Bullet + Multiple Inline Bold', text: '• **সরিষা:** ৬০ বস্তা (**১২০.৫ মণ**) - পর্যাপ্ত স্টক রয়েছে।' },
  { name: '4. Markdown Heading with Bold Wrapped', text: '### **গুদাম মজুদ (Warehouse Stock):**' },
  { name: '5. ASCII Numbered List Item with Bold', text: '1. **ধান:** ৫০ মণ' },
  { name: '6. Bengali Numbered List Item with Bold', text: '১. **গম:** ৩০ মণ' },
  { name: '7. XSS Injection Prevention', text: '<script>alert("XSS")</script><img src=x onerror=alert(1)>' },
  { name: '8. Markdown Table with Bold', text: '| শস্য | মজুদ | অবস্থা |\n| --- | --- | --- |\n| **সরিষা** | ৬০ বস্তা | **পর্যাপ্ত** |' },
];

console.log('============================================================');
console.log('🧪 VERIFYING AI MANEZAR MARKDOWN RENDERER');
console.log('============================================================\n');

let allPassed = true;
testCases.forEach((tc, idx) => {
  const rendered = renderMarkdownToHtml(tc.text);
  const hasLiteralDoubleAsterisk = rendered.includes('**');
  // Ensure no unescaped dangerous HTML tags exist
  const hasRawScript = /<script|<img/i.test(rendered);

  const passed = !hasLiteralDoubleAsterisk && !hasRawScript;
  if (!passed) allPassed = false;

  console.log(`[Test ${idx + 1}] ${tc.name}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Input:    ${tc.text.replace(/\n/g, ' \\n ')}`);
  console.log(`   Rendered: ${rendered.replace(/\n/g, ' ')}`);
  console.log(`   Contains literal ** ? ${hasLiteralDoubleAsterisk}`);
  console.log(`   Safe against XSS ?    ${!hasRawScript}\n`);
});

console.log('============================================================');
console.log(`Final Markdown Parser Verification Result: ${allPassed ? 'ALL PASSED ✅' : 'FAILED ❌'}`);
console.log('============================================================');

if (!allPassed) {
  process.exit(1);
}
