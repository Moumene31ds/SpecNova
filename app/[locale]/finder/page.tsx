import type { Metadata } from "next";
import { AiPhoneFinder } from "@/components/finder/ai-phone-finder";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Phone Finder",
  description:
    "Tell us what you need and our AI will find the perfect phone for you — powered by Gemini and our full device database.",
};

export default function FinderPage() {
  return <AiPhoneFinder />;
}
