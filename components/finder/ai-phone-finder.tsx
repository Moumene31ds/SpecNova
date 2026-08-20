"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  RotateCcw,
  Sparkles,
  Loader2,
  MessageCircle,
  Smartphone,
  ArrowRight,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { phoneFinderChat, type FinderDevice } from "@/actions/phoneFinder";
import MarkdownRenderer from "@/components/ai/markdown-renderer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  devices?: FinderDevice[];
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const messageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

const suggestionVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.1 + i * 0.05, duration: 0.3 },
  }),
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiPhoneFinder() {
  const t = useTranslations("finder");

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // ── Persistence ──────────────────────────────────────────────────────
  const STORAGE_KEY = "itophone-finder-chat";

  // Load saved conversation on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save conversation when messages change
  React.useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch {
        // Storage full, ignore
      }
    }
  }, [messages]);

  // Auto-scroll to bottom
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── Send message ──────────────────────────────────────────────────────

  const sendMessage = React.useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const allMessages = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const result = await phoneFinderChat(allMessages);

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: result.response,
          devices: result.devices,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: t("error"),
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [messages, isLoading, t],
  );

  // ── Handle keyboard ───────────────────────────────────────────────────

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input);
      }
    },
    [input, sendMessage],
  );

  // ── Start over ────────────────────────────────────────────────────────

  const startOver = React.useCallback(() => {
    setMessages([]);
    setInput("");
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ── Suggestions ───────────────────────────────────────────────────────

  const suggestions = t.raw("suggestions") as string[];
  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3 backdrop-blur-sm md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold">{t("chatTitle")}</h1>
            <p className="text-xs text-muted-foreground">{t("chatSubtitle")}</p>
          </div>
        </div>
        {hasMessages && (
          <button
            onClick={startOver}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/60 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t("startOver")}
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {/* Welcome screen */}
          {!hasMessages && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center py-12 text-center"
            >
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                <Smartphone className="h-10 w-10 text-primary" />
              </div>
              <h2 className="mb-2 text-2xl font-bold">{t("title")}</h2>
              <p className="mb-8 max-w-md text-sm text-muted-foreground">
                {t("welcome")}
              </p>

              {/* Suggestion chips */}
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((suggestion: string, i: number) => (
                  <motion.button
                    key={i}
                    custom={i}
                    variants={suggestionVariants}
                    initial="hidden"
                    animate="visible"
                    onClick={() => sendMessage(suggestion)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-sm text-muted-foreground backdrop-blur transition-all hover:border-primary/40 hover:text-primary"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {suggestion}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Chat messages */}
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                variants={messageVariants}
                initial="hidden"
                animate="visible"
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border/60 bg-card/80 backdrop-blur",
                  )}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <MarkdownRenderer content={msg.content} />
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}

                  {/* Device cards */}
                  {msg.devices && msg.devices.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {msg.devices.map((device, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-xl border border-border/40 bg-secondary/30 px-3 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-primary">
                                {device.brand}
                              </span>
                              <span className="text-sm font-semibold">
                                {device.name}
                              </span>
                              {device.score && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                  {device.score.toFixed(1)}
                                </span>
                              )}
                            </div>
                            {device.reason && (
                              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                                {device.reason}
                              </p>
                            )}
                          </div>
                          <Link
                            href={`/phone/${device.slug}`}
                            className="ms-3 flex h-8 shrink-0 items-center gap-1 rounded-lg bg-primary/10 px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                          >
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/80 px-4 py-3 backdrop-blur">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  {t("thinking")}
                </span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border/50 bg-background/80 px-4 py-3 backdrop-blur-sm md:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-card/60 p-2 backdrop-blur focus-within:border-primary/40">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("placeholder")}
              rows={1}
              className="min-h-[40px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
              style={{ maxHeight: "120px" }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all",
                input.trim() && !isLoading
                  ? "bg-primary text-primary-foreground shadow-[0_0_16px_hsl(var(--glow-primary)/0.3)]"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
            {t("poweredBy")} · iToPhone AI
          </p>
        </div>
      </div>
    </div>
  );
}
