import type { Metadata } from "next";
import { getCatalog } from "@/lib/query/device-query";
import { RankingsView } from "@/components/rankings/rankings-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Top Phones Rankings",
  description:
    "Rankings of the best smartphones by camera, performance, battery, display, and value — updated in real-time.",
};

export default async function RankingsPage() {
  const catalog = await getCatalog(200);
  return <RankingsView catalog={catalog} />;
}
