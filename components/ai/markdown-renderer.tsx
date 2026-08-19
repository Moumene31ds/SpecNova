"use client";

/**
 * Simple markdown renderer for AI chat responses.
 * Handles: tables, bold, italic, lists, headers, code, links.
 */

import { useMemo } from "react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ---------------------------------------------------------------------------
// Markdown → HTML
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): string {
  let result = text;

  // 1. Extract and replace markdown tables with HTML tables
  result = result.replace(
    /(?:^|\n)((?:\|.+\|\n)+)/g,
    (_match, tableBlock: string) => {
      const rows = tableBlock.trim().split("\n");
      if (rows.length < 2) return tableBlock;

      // Check if row 2 is a separator (|---|---|)
      const isSeparator = (row: string) => /^\|[\s\-:|]+\|$/.test(row.trim());
      if (!isSeparator(rows[1]!)) return tableBlock;

      const headerCells = parseTableRow(rows[0]!);
      const dataRows = rows.slice(2).filter((r) => !isSeparator(r));

      let html = '<div class="overflow-x-auto my-3"><table class="w-full text-xs border-collapse">';
      html += "<thead><tr>";
      for (const cell of headerCells) {
        html += `<th class="px-3 py-2 text-left font-semibold text-foreground bg-white/5 border-b border-white/10">${formatInline(cell)}</th>`;
      }
      html += "</tr></thead><tbody>";

      for (let i = 0; i < dataRows.length; i++) {
        const cells = parseTableRow(dataRows[i]!);
        const bg = i % 2 === 0 ? "" : " bg-white/[0.02]";
        html += `<tr class="border-b border-white/5${bg}">`;
        for (const cell of cells) {
          // Highlight winner cells (checkmarks, "Winner", bold text)
          const isWinner = cell.includes("✅") || cell.includes("Winner") || cell.includes("🏆");
          const cellClass = isWinner
            ? "px-3 py-2 text-green-400 font-semibold"
            : "px-3 py-2 text-muted-foreground";
          html += `<td class="${cellClass}">${formatInline(cell)}</td>`;
        }
        html += "</tr>";
      }

      html += "</tbody></table></div>";
      return "\n" + html + "\n";
    },
  );

  // 2. Headers (## → <h3>, ### → <h4>)
  result = result.replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold text-foreground mt-3 mb-1">$1</h4>');
  result = result.replace(/^## (.+)$/gm, '<h3 class="text-base font-bold text-foreground mt-4 mb-2">$1</h3>');
  result = result.replace(/^# (.+)$/gm, '<h2 class="text-lg font-bold text-foreground mt-4 mb-2">$1</h2>');

  // 3. Bold **text**
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');

  // 4. Italic *text*
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em class="italic">$1</em>');

  // 5. Inline code `text`
  result = result.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono">$1</code>');

  // 6. Unordered lists
  result = result.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>');
  result = result.replace(/(<li class="ml-4 list-disc[^"]*">[^<]+<\/li>\n?)+/g, (match) => {
    return `<ul class="my-2 space-y-1">${match}</ul>`;
  });

  // 7. Ordered lists
  result = result.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm">$1</li>');

  // 8. Links [text](url)
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>',
  );

  // 9. Line breaks → paragraphs (double newline)
  result = result.replace(/\n\n+/g, '</p><p class="mb-2">');
  result = `<p class="mb-2">${result}</p>`;

  // 10. Single line breaks
  result = result.replace(/\n/g, "<br/>");

  // Clean up empty paragraphs
  result = result.replace(/<p class="mb-2">\s*<\/p>/g, "");
  result = result.replace(/<p class="mb-2">\s*(<div|<h[2-4]|<ul|<table)/g, "$1");
  result = result.replace(/(<\/table>|<\/ul>|<\/div>|<\/h[2-4]>)\s*<\/p>/g, "$1");

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseTableRow(row: string): string[] {
  return row
    .split("|")
    .slice(1, -1) // Remove first and last empty strings from leading/trailing |
    .map((cell) => cell.trim());
}

function formatInline(text: string): string {
  let result = text;
  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
  // Italic
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em class="italic">$1</em>');
  // Code
  result = result.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-white/10 rounded text-xs font-mono">$1</code>');
  // Emoji checkmarks
  result = result.replace(/✅/g, '<span class="text-green-400">✅</span>');
  result = result.replace(/❌/g, '<span class="text-red-400">❌</span>');
  result = result.replace(/🏆/g, '<span class="text-yellow-400">🏆</span>');
  result = result.replace(/⭐/g, '<span class="text-yellow-400">⭐</span>');
  return result;
}
