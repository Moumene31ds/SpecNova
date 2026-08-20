"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Star, ThumbsUp, ThumbsDown, CheckCircle, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReviewStats, totalReviews } from "@/components/device/review-stats";
import { ReviewForm } from "@/components/device/review-form";
import { Badge } from "@/components/ui/badge";

interface UserReviewsProps {
  deviceId: string;
  brand: string;
  deviceName: string;
  score: { total: number; camera: number; hardware: number; battery: number; display: number };
}

interface Review {
  id: string;
  username: string;
  rating: number;
  title: string;
  text: string;
  date: string;
  verified: boolean;
  helpful: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const usernames = [
  "Ahmed K.", "Sarah M.", "TechReviewer42", "Alex P.", "Priya S.",
  "Marcus J.", "Lena W.", "Ravi T.", "Sofia R.", "Dylan H.",
  "Fatima B.", "Jake L.", "Yuki N.", "Chris D.", "Amira F.",
];

function generateReviews(score: UserReviewsProps["score"]): Review[] {
  const rng = seededRandom(score.total * 7 + 3);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  const positiveTitles = [
    "Absolutely love this phone!",
    "Best phone I've ever owned",
    "Exceeded my expectations",
    "Solid choice for the price",
    "Great daily driver",
  ];
  const mixedTitles = [
    "Good but not perfect",
    "Decent phone with some trade-offs",
    "Hits the marks where it counts",
    "Impressed with some aspects",
    "Worth considering",
  ];
  const lowTitles = [
    "Has its strengths but...",
    "Could be better",
    "Mixed feelings overall",
  ];

  const positiveTexts = [
    "The camera quality is outstanding, especially in good lighting. Battery life gets me through the whole day with heavy use. Display is gorgeous and snappy.",
    "Incredible performance for everyday tasks and gaming. The build quality feels premium and the software experience is smooth. Highly recommend!",
    "Love the display — colors are vibrant and the refresh rate makes everything buttery smooth. Camera takes stunning shots. Battery easily lasts a full day.",
    "This phone punches above its weight. Great value for the specs you get. The camera system is versatile and the performance is rock solid.",
    "Coming from a budget phone, this is a massive upgrade. Everything feels fast and responsive. The battery life is a real highlight.",
  ];
  const mixedTexts = [
    "Camera is great but battery could be better with heavy use. Performance is solid for most tasks though the display is really nice.",
    "Good phone overall. The camera takes great photos in daylight but struggles a bit at night. Performance handles everything I throw at it.",
    "Display and performance are top-notch. Battery is decent but not amazing. Camera system is solid but not the best in its class.",
    "Impressed by the display quality and smooth performance. Battery life is okay — gets through a day with moderate use. Camera is good.",
    "Solid all-rounder with no major weaknesses. Camera takes nice photos, performance is smooth, battery lasts the day. Nothing groundbreaking.",
  ];
  const lowTexts = [
    "Battery life is the biggest letdown — needs charging by mid-afternoon. Camera is decent though and performance is acceptable for daily tasks.",
    "Display is nice but the camera struggles in low light. Performance is fine for basic use but lags with heavier apps.",
    "It's an okay phone. Nothing stands out as exceptional. Camera and display are good points but battery leaves something to be desired.",
  ];

  const count = 3 + Math.floor(rng() * 3);
  const reviews: Review[] = [];

  for (let i = 0; i < count; i++) {
    const totalScore = score.total / 20;
    let rating: number;
    if (totalScore >= 8) rating = 4 + (rng() > 0.35 ? 1 : 0);
    else if (totalScore >= 6.5) rating = 3 + (rng() > 0.5 ? 1 : 0);
    else rating = 2 + (rng() > 0.5 ? 1 : 0);

    const isPositive = rating >= 4;
    const isLow = rating <= 2;
    const title = isPositive ? pick(positiveTitles) : isLow ? pick(lowTitles) : pick(mixedTitles);
    const text = isPositive ? pick(positiveTexts) : isLow ? pick(lowTexts) : pick(mixedTexts);

    const daysAgo = Math.floor(rng() * 180);
    const date = new Date(Date.now() - daysAgo * 86400000);

    reviews.push({
      id: `rev-${i}`,
      username: pick(usernames),
      rating,
      title,
      text,
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      verified: rng() > 0.45,
      helpful: Math.floor(rng() * 42),
    });
  }

  return reviews.sort((a, b) => b.helpful - a.helpful);
}

function getProsAndCons(score: UserReviewsProps["score"]): { pros: string[]; cons: string[] } {
  const pros: string[] = [];
  const cons: string[] = [];

  if (score.camera >= 75) pros.push("Excellent camera system");
  else if (score.camera < 60) cons.push("Camera could be better");

  if (score.hardware >= 80) pros.push("Powerful performance");
  else if (score.hardware < 65) cons.push("Performance lags behind");

  if (score.battery >= 75) pros.push("Great battery life");
  else if (score.battery < 60) cons.push("Battery drains quickly");

  if (score.display >= 80) pros.push("Stunning display");
  else if (score.display < 65) cons.push("Display could be brighter");

  if (score.total >= 75) pros.push("Excellent value for money");
  else if (score.total < 60) cons.push("Questionable value");

  return { pros, cons };
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn("shrink-0", i < rating ? "fill-warning text-warning" : "text-muted-foreground/25")}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}

export function UserReviews({ deviceId, brand, deviceName, score }: UserReviewsProps) {
  const [formOpen, setFormOpen] = useState(false);
  const reviews = useMemo(() => generateReviews(score), [score.total]);
  const { pros, cons } = useMemo(() => getProsAndCons(score), [score]);
  const recommendPercent = Math.min(98, Math.round(50 + score.total * 0.5));

  const categories = [
    { label: "Camera", value: score.camera },
    { label: "Performance", value: score.hardware },
    { label: "Battery", value: score.battery },
    { label: "Display", value: score.display },
    { label: "Value", value: Math.round((score.camera + score.hardware + score.battery + score.display) / 4) },
  ];

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">User Reviews</h2>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/50 px-4 py-2 text-sm font-medium backdrop-blur-xl transition-all hover:bg-card/80 active:scale-[0.97]"
        >
          <PenLine className="h-4 w-4" />
          Write a Review
        </button>
      </div>

      <ReviewStats score={score} />

      {/* Category breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {categories.map(({ label, value }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-border/60 bg-card/50 p-3 backdrop-blur-xl text-center"
          >
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-lg font-bold tabular-nums">{value}</p>
            <StarRating rating={Math.round(value / 20)} size={12} />
          </motion.div>
        ))}
      </div>

      {/* Pros & Cons */}
      <div className="grid gap-4 sm:grid-cols-2">
        {pros.length > 0 && (
          <div className="rounded-2xl border border-success/20 bg-success/5 p-4 backdrop-blur-xl">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-success">
              <ThumbsUp className="h-4 w-4" /> Pros
            </h3>
            <ul className="space-y-1.5">
              {pros.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}
        {cons.length > 0 && (
          <div className="rounded-2xl border border-danger/20 bg-danger/5 p-4 backdrop-blur-xl">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-danger">
              <ThumbsDown className="h-4 w-4" /> Cons
            </h3>
            <ul className="space-y-1.5">
              {cons.map((c) => (
                <li key={c} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <ThumbsDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recommend badge */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/50 p-4 backdrop-blur-xl"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl font-display text-xl font-bold text-primary-foreground"
          style={{ background: `linear-gradient(135deg, hsl(var(--neon-cyan)), hsl(var(--success)))` }}
        >
          {recommendPercent}%
        </div>
        <div>
          <p className="text-sm font-semibold">Would Recommend</p>
          <p className="text-xs text-muted-foreground">Based on {totalReviews} user reviews</p>
        </div>
      </motion.div>

      {/* Review cards */}
      <div className="space-y-4">
        <h3 className="font-display text-lg font-semibold">Recent Reviews</h3>
        {reviews.map((review, i) => (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-border/60 bg-card/50 p-5 backdrop-blur-xl transition-colors hover:border-border"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{review.username}</p>
                  {review.verified && (
                    <Badge variant="neon" className="text-[10px]">
                      <CheckCircle className="h-3 w-3" /> Verified
                    </Badge>
                  )}
                </div>
                <StarRating rating={review.rating} />
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{review.date}</span>
            </div>

            <h4 className="mt-3 font-medium">{review.title}</h4>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{review.text}</p>

            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <button className="flex items-center gap-1 transition-colors hover:text-foreground">
                <ThumbsUp className="h-3.5 w-3.5" />
                {review.helpful}
              </button>
              <button className="flex items-center gap-1 transition-colors hover:text-foreground">
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <ReviewForm open={formOpen} onOpenChange={setFormOpen} deviceName={deviceName} />
    </section>
  );
}
