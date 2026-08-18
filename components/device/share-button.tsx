"use client";

import * as React from "react";
import { Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  title: string;
  url?: string;
  className?: string;
}

export function ShareButton({ title, url, className }: ShareButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleShare = React.useCallback(async () => {
    const shareUrl = url ?? window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [title, url]);

  return (
    <button
      onClick={handleShare}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-xl border border-border px-5 text-sm font-medium transition-all hover:border-ring/50 active:scale-[0.97]",
        className,
      )}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-success" />
          <span className="text-success">Copied!</span>
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          Share
        </>
      )}
    </button>
  );
}
