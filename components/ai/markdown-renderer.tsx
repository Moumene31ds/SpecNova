"use client";

/**
 * Bulletproof Markdown Renderer — React-native (no dangerouslySetInnerHTML)
 * Handles: tables, bold, italic, lists, headers, code, links, emoji.
 */

import { useMemo, type ReactNode } from "react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const elements = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className={`space-y-2 ${className}`}>
      {elements}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table types
// ---------------------------------------------------------------------------

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function parseMarkdown(text: string): ReactNode[] {
  const elements: ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // ── Table ──
    if (isTableRow(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i]!)) {
        tableLines.push(lines[i]!);
        i++;
      }
      const table = buildTable(tableLines);
      if (table) {
        elements.push(<TableBlock key={elements.length} table={table} />);
      }
      continue;
    }

    // ── Headers ──
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={elements.length} className="text-sm font-bold text-foreground mt-4 mb-1 flex items-center gap-2">
          <span className="w-1 h-4 bg-primary rounded-full inline-block" />
          {line.slice(4)}
        </h4>,
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={elements.length} className="text-base font-bold text-foreground mt-5 mb-2 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-primary rounded-full inline-block" />
          {line.slice(3)}
        </h3>,
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h2 key={elements.length} className="text-lg font-bold text-foreground mt-5 mb-2">
          {line.slice(2)}
        </h2>,
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
        <ul key={elements.length} className="space-y-1 my-1">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0 inline-block" />
              <span className="text-muted-foreground">{parseInline(item)}</span>
            </li>
          ))}
        </ul>,
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
        <ol key={elements.length} className="space-y-1 my-1">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-sm">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 inline-flex">
                {j + 1}
              </span>
              <span className="text-muted-foreground">{parseInline(item)}</span>
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // ── Empty ──
    if (line.trim() === "") {
      i++;
      continue;
    }

    // ── Paragraph ──
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
        <p key={elements.length} className="text-sm text-muted-foreground leading-relaxed">
          {parseInline(paraLines.join(" "))}
        </p>,
      );
    }
  }

  return elements;
}

// ---------------------------------------------------------------------------
// Inline parser — returns ReactNode, NOT HTML strings
// ---------------------------------------------------------------------------

function parseInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let rest = text;
  let key = 0;

  while (rest.length > 0) {
    // Bold **text**
    const boldRe = /\*\*(.+?)\*\*/;
    const boldMatch = boldRe.exec(rest);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) parts.push(<span key={key++}>{rest.slice(0, boldMatch.index)}</span>);
      parts.push(<strong key={key++} className="font-semibold text-foreground">{boldMatch[1]}</strong>);
      rest = rest.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    // Italic *text*
    const italicRe = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/;
    const italicMatch = italicRe.exec(rest);
    if (italicMatch && italicMatch.index !== undefined) {
      if (italicMatch.index > 0) parts.push(<span key={key++}>{rest.slice(0, italicMatch.index)}</span>);
      parts.push(<em key={key++} className="italic">{italicMatch[1]}</em>);
      rest = rest.slice(italicMatch.index + italicMatch[0].length);
      continue;
    }

    // Code `text`
    const codeRe = /`([^`]+)`/;
    const codeMatch = codeRe.exec(rest);
    if (codeMatch && codeMatch.index !== undefined) {
      if (codeMatch.index > 0) parts.push(<span key={key++}>{rest.slice(0, codeMatch.index)}</span>);
      parts.push(
        <code key={key++} className="px-1.5 py-0.5 bg-white/10 rounded-md text-xs font-mono text-primary">
          {codeMatch[1]}
        </code>,
      );
      rest = rest.slice(codeMatch.index + codeMatch[0].length);
      continue;
    }

    // Link [text](url)
    const linkRe = /\[([^\]]+)\]\(([^)]+)\)/;
    const linkMatch = linkRe.exec(rest);
    if (linkMatch && linkMatch.index !== undefined) {
      if (linkMatch.index > 0) parts.push(<span key={key++}>{rest.slice(0, linkMatch.index)}</span>);
      parts.push(
        <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          {linkMatch[1]}
        </a>,
      );
      rest = rest.slice(linkMatch.index + linkMatch[0].length);
      continue;
    }

    // Nothing left to match — just render the rest with emoji
    parts.push(<span key={key++}>{renderEmoji(rest)}</span>);
    break;
  }

  return parts.length <= 1 ? (parts[0] ?? null) : <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Emoji — returns ReactNode (JSX spans), NOT HTML strings
// ---------------------------------------------------------------------------

function renderEmoji(text: string): ReactNode {
  // Split text by emoji and render each as a colored span
  const emojiMap: Record<string, string> = {
    "✅": "text-emerald-400",
    "❌": "text-red-400",
    "🏆": "text-amber-400",
    "⭐": "text-amber-400",
    "🥇": "text-amber-400",
    "🥈": "text-gray-300",
    "🥉": "text-amber-600",
    "🔥": "text-orange-400",
    "💪": "text-blue-400",
    "📸": "text-purple-400",
    "🎮": "text-green-400",
    "🔋": "text-emerald-400",
    "📱": "text-blue-400",
    "⚡": "text-yellow-400",
  };

  const emojiRegex = new RegExp(`(${Object.keys(emojiMap).join("|")})`, "g");
  const tokens = text.split(emojiRegex);

  if (tokens.length === 1) return text; // No emoji found

  return (
    <>
      {tokens.map((token, i) => {
        const colorClass = emojiMap[token];
        if (colorClass) {
          return (
            <span key={i} className={`${colorClass} font-bold`}>
              {token}
            </span>
          );
        }
        return <span key={i}>{token}</span>;
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Table helpers
// ---------------------------------------------------------------------------

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && t.endsWith("|") && t.length > 2;
}

function isSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function parseCells(row: string): string[] {
  return row.split("|").slice(1, -1).map((c) => c.trim());
}

function buildTable(lines: string[]): ParsedTable | null {
  if (lines.length < 2) return null;
  const headerIdx = lines.findIndex((l) => !isSeparator(l));
  if (headerIdx === -1) return null;
  const headers = parseCells(lines[headerIdx]!);
  const sepIdx = headerIdx + 1;
  if (sepIdx >= lines.length || !isSeparator(lines[sepIdx]!)) return null;
  const rows: string[][] = [];
  for (let j = sepIdx + 1; j < lines.length; j++) {
    if (!isSeparator(lines[j]!)) rows.push(parseCells(lines[j]!));
  }
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Table Block Component — the star
// ---------------------------------------------------------------------------

function TableBlock({ table }: { table: ParsedTable }) {
  return (
    <div className="my-3 rounded-xl border border-white/10 overflow-hidden bg-white/[0.02] backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10">
              {table.headers.map((h, ci) => (
                <th
                  key={ci}
                  className="px-3 py-2.5 text-start font-bold text-foreground border-b border-white/10 first:ps-4 last:pe-4 whitespace-nowrap"
                >
                  {parseInline(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr
                key={ri}
                className={`border-b border-white/5 last:border-b-0 transition-colors hover:bg-white/[0.04] ${
                  ri % 2 === 1 ? "bg-white/[0.015]" : ""
                }`}
              >
                {row.map((cell, ci) => {
                  const isWin =
                    cell.includes("✅") || cell.includes("🏆") || cell.includes("🥇") ||
                    cell.toLowerCase().includes("winner") || cell.toLowerCase().includes("best");
                  const isLose = cell.includes("❌");

                  return (
                    <td
                      key={ci}
                      className={`px-3 py-2 first:ps-4 last:pe-4 whitespace-nowrap ${
                        ci === 0 ? "font-medium text-foreground" : ""
                      } ${isWin ? "text-emerald-400 font-semibold bg-emerald-500/5" : ""} ${
                        isLose ? "text-red-400/70" : ""
                      } ${!isWin && !isLose && ci > 0 ? "text-muted-foreground" : ""}`}
                    >
                      {parseInline(cell)}
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
