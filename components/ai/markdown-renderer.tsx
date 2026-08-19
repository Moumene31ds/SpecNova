"use client";

/**
 * Bulletproof Markdown Renderer for AI Chat
 * 
 * Handles: tables (with flexible detection), bold, italic, lists, headers, code, links, emoji.
 * Tables get special treatment — they extend beyond the chat bubble width.
 */

import { useMemo } from "react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const elements = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className={`space-y-2 ${className}`}>
      {elements.map((el, i) => (
        <span key={i}>{el}</span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MdElement = string | React.ReactNode;

// ---------------------------------------------------------------------------
// Parser — converts markdown string to React elements
// ---------------------------------------------------------------------------

function parseMarkdown(text: string): MdElement[] {
  const elements: MdElement[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // ── Table Detection ──
    if (isTableRow(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i]!)) {
        tableLines.push(lines[i]!);
        i++;
      }
      const table = parseTable(tableLines);
      if (table) {
        elements.push(<TableRenderer key={`table-${elements.length}`} table={table} />);
      }
      continue;
    }

    // ── Headers ──
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={`h4-${i}`} className="text-sm font-bold text-foreground mt-4 mb-1 flex items-center gap-2">
          <span className="w-1 h-4 bg-primary rounded-full" />
          {line.slice(4)}
        </h4>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-base font-bold text-foreground mt-5 mb-2 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-primary rounded-full" />
          {line.slice(3)}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-lg font-bold text-foreground mt-5 mb-2">
          {line.slice(2)}
        </h2>
      );
      i++;
      continue;
    }

    // ── Unordered list ──
    if (/^[-*•]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^[-*•]\s/, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${elements.length}`} className="space-y-1 my-1">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span className="text-muted-foreground">{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // ── Ordered list ──
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${elements.length}`} className="space-y-1 my-1">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-sm">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {j + 1}
              </span>
              <span className="text-muted-foreground">{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // ── Empty line ──
    if (line.trim() === "") {
      i++;
      continue;
    }

    // ── Regular paragraph ──
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !isTableRow(lines[i]!) &&
      !lines[i]!.startsWith("#") &&
      !/^[-*•]\s/.test(lines[i]!) &&
      !/^\d+\.\s/.test(lines[i]!)
    ) {
      paraLines.push(lines[i]!);
      i++;
    }
    if (paraLines.length > 0) {
      elements.push(
        <p key={`p-${elements.length}`} className="text-sm text-muted-foreground leading-relaxed">
          {renderInline(paraLines.join(" "))}
        </p>
      );
    }
  }

  return elements;
}

// ---------------------------------------------------------------------------
// Inline formatting (bold, italic, code, links, emoji)
// ---------------------------------------------------------------------------

function renderInline(text: string): React.ReactNode {
  // Split by formatting markers and render each part
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(<span key={key++}>{renderEmoji(remaining.slice(0, boldMatch.index))}</span>);
      }
      parts.push(
        <strong key={key++} className="font-semibold text-foreground">{boldMatch[1]}</strong>,
      );
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    // Italic *text*
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
    if (italicMatch && italicMatch.index !== undefined) {
      if (italicMatch.index > 0) {
        parts.push(<span key={key++}>{renderEmoji(remaining.slice(0, italicMatch.index))}</span>);
      }
      parts.push(
        <em key={key++} className="italic text-muted-foreground/80">{italicMatch[1]}</em>,
      );
      remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
      continue;
    }

    // Inline code `text`
    const codeMatch = remaining.match(/`([^`]+)`/);
    if (codeMatch && codeMatch.index !== undefined) {
      if (codeMatch.index > 0) {
        parts.push(<span key={key++}>{renderEmoji(remaining.slice(0, codeMatch.index))}</span>);
      }
      parts.push(
        <code key={key++} className="px-1.5 py-0.5 bg-white/10 rounded-md text-xs font-mono text-primary">{codeMatch[1]}</code>,
      );
      remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
      continue;
    }

    // Link [text](url)
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch && linkMatch.index !== undefined) {
      if (linkMatch.index > 0) {
        parts.push(<span key={key++}>{renderEmoji(remaining.slice(0, linkMatch.index))}</span>);
      }
      parts.push(
        <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{linkMatch[1]}</a>,
      );
      remaining = remaining.slice(linkMatch.index + linkMatch[0].length);
      continue;
    }

    // No more formatting — render rest
    parts.push(<span key={key++}>{renderEmoji(remaining)}</span>);
    break;
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function renderEmoji(text: string): string {
  return text
    .replace(/✅/g, '<span class="text-emerald-400 font-bold">✅</span>')
    .replace(/❌/g, '<span class="text-red-400 font-bold">❌</span>')
    .replace(/🏆/g, '<span class="text-amber-400 font-bold">🏆</span>')
    .replace(/⭐/g, '<span class="text-amber-400">⭐</span>')
    .replace(/🥇/g, '<span class="text-amber-400">🥇</span>')
    .replace(/🥈/g, '<span class="text-gray-300">🥈</span>')
    .replace(/🥉/g, '<span class="text-amber-600">🥉</span>');
}

// ---------------------------------------------------------------------------
// Table Parser
// ---------------------------------------------------------------------------

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|");
}

function isSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function parseTableRowCells(row: string): string[] {
  return row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function parseTable(lines: string[]): ParsedTable | null {
  if (lines.length < 2) return null;

  // Find header (first non-separator row)
  const headerIdx = lines.findIndex((l) => !isSeparator(l));
  if (headerIdx === -1) return null;

  const headers = parseTableRowCells(lines[headerIdx]!);

  // Find separator
  const sepIdx = headerIdx + 1;
  if (sepIdx >= lines.length || !isSeparator(lines[sepIdx]!)) return null;

  // Data rows
  const rows: string[][] = [];
  for (let i = sepIdx + 1; i < lines.length; i++) {
    if (!isSeparator(lines[i]!)) {
      rows.push(parseTableRowCells(lines[i]!));
    }
  }

  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Table Renderer — the star of the show
// ---------------------------------------------------------------------------

function TableRenderer({ table }: { table: ParsedTable }) {
  return (
    <div className="my-3 rounded-xl border border-white/10 overflow-hidden bg-white/[0.02] backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10">
              {table.headers.map((h, i) => (
                <th
                  key={i}
                  className="px-3 py-2.5 text-left font-bold text-foreground border-b border-white/10 first:pl-4 last:pr-4"
                >
                  {renderInline(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr
                key={ri}
                className={`
                  border-b border-white/5 last:border-b-0
                  ${ri % 2 === 0 ? "bg-transparent" : "bg-white/[0.015]"}
                  hover:bg-white/[0.04] transition-colors
                `}
              >
                {row.map((cell, ci) => {
                  const isWinner =
                    cell.includes("✅") ||
                    cell.includes("🏆") ||
                    cell.includes("🥇") ||
                    cell.includes("**Winner**") ||
                    cell.includes("**Best**");
                  const isLoser =
                    cell.includes("❌");

                  return (
                    <td
                      key={ci}
                      className={`
                        px-3 py-2 first:pl-4 last:pr-4
                        ${isWinner ? "text-emerald-400 font-semibold bg-emerald-500/5" : ""}
                        ${isLoser ? "text-red-400/70" : ""}
                        ${!isWinner && !isLoser ? "text-muted-foreground" : ""}
                        ${ci === 0 ? "font-medium text-foreground" : ""}
                      `}
                    >
                      {renderInline(cell)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
