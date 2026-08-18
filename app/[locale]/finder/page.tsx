import type { Metadata } from "next";
import { getCatalog } from "@/lib/query/device-query";
import { PhoneFinderClient } from "@/components/finder/phone-finder";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Phone Finder",
  description:
    "Answer 4 quick questions and find your perfect phone — budget, priority, size, and brand preferences matched against our full catalog.",
};

export default async function FinderPage() {
  const catalog = await getCatalog(50);

  return <PhoneFinderClient catalog={catalog} />;
}
