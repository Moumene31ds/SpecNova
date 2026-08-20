"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Send, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ReviewFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceName: string;
  brandColor?: string;
}

interface FormData {
  overall: number;
  title: string;
  text: string;
  camera: number;
  performance: number;
  battery: number;
  display: number;
}

const emptyForm: FormData = { overall: 0, title: "", text: "", camera: 0, performance: 0, battery: 0, display: 0 };

function ClickableStars({ value, onChange, size = 20 }: { value: number; onChange: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = (hover || value) > i;
        return (
          <button
            key={i}
            type="button"
            className="h-8 w-8 min-w-8 transition-transform hover:scale-110 focus:outline-none"
            onMouseEnter={() => setHover(i + 1)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(i + 1)}
          >
            <Star
              className={cn("transition-colors", filled ? "fill-warning text-warning" : "text-muted-foreground/30")}
              style={{ width: size, height: size }}
            />
          </button>
        );
      })}
    </div>
  );
}

export function ReviewForm({ open, onOpenChange, deviceName, brandColor = "#8A2BE2" }: ReviewFormProps) {
  const [form, setForm] = useState<FormData>(emptyForm);
  const [submitted, setSubmitted] = useState(false);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => setForm((p) => ({ ...p, [key]: value }));

  const valid = form.overall > 0 && form.title.trim().length >= 3 && form.text.trim().length >= 10;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setForm(emptyForm);
      onOpenChange(false);
    }, 2000);
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setSubmitted(false);
      setForm(emptyForm);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md border-border/60 bg-card/80 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Write a Review</DialogTitle>
          <DialogDescription>Share your experience with the {deviceName}</DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <CheckCircle className="h-12 w-12" style={{ color: brandColor }} />
              </motion.div>
              <p className="font-display text-lg font-semibold">Review Submitted!</p>
              <p className="text-sm text-muted-foreground">Thank you for your feedback.</p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Overall Rating</label>
                <ClickableStars value={form.overall} onChange={(v) => set("overall", v)} size={24} />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Review Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Summarize your experience"
                  className="w-full rounded-xl border border-border/60 bg-secondary/50 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring/60"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Your Review</label>
                <textarea
                  value={form.text}
                  onChange={(e) => set("text", e.target.value)}
                  rows={3}
                  placeholder="What did you like or dislike?"
                  className="w-full resize-none rounded-xl border border-border/60 bg-secondary/50 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {([["camera", "Camera"], ["performance", "Performance"], ["battery", "Battery"], ["display", "Display"]] as const).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs text-muted-foreground">{label}</label>
                    <ClickableStars value={form[key]} onChange={(v) => set(key, v)} size={16} />
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={!valid}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98]"
                style={{ background: brandColor }}
              >
                <Send className="h-4 w-4" />
                Submit Review
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
