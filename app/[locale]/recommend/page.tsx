"use client";

import dynamic from "next/dynamic";

const PhoneRecommender = dynamic(
  () => import("@/components/ai/phone-recommender"),
  { ssr: false, loading: () => <div className="min-h-[80vh] flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div> },
);

export default function RecommendPage() {
  return <PhoneRecommender />;
}
