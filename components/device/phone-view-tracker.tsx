"use client";

import { useEffect } from "react";
import { trackView } from "@/lib/hooks/use-recently-viewed";

export function PhoneViewTracker({ slug, brand, name }: { slug: string; brand: string; name: string }) {
  useEffect(() => {
    trackView(slug, brand, name);
  }, [slug, brand, name]);
  return null;
}
