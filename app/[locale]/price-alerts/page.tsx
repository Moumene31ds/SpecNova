import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { locales } from "@/lib/i18n";
import { listMyPriceAlerts } from "@/actions/price-alerts";
import { PriceAlertList } from "@/components/price-alert/price-alert-list";
import type { PriceAlert } from "@/lib/firebase/types";

export const metadata: Metadata = { title: "Price Alerts" };

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function PriceAlertsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("priceAlerts");

  let alerts: PriceAlert[];
  try {
    alerts = await listMyPriceAlerts();
  } catch {
    alerts = [];
  }

  return (
    <div className="container mx-auto max-w-3xl pb-20 pt-12">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-4 py-1.5 text-xs font-medium text-neon-cyan">
          <Bell className="h-3.5 w-3.5" /> {t("subtitle")}
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight md:text-4xl">
          {t("title")}
        </h1>
      </div>

      <PriceAlertList
        alerts={alerts}
        labels={{
          totalAlerts: t("totalAlerts"),
          activeCount: t("activeCount"),
          targetPrice: t("targetPrice"),
          threshold: t("threshold"),
          channels: t("channels"),
          push: t("push"),
          email: t("email"),
          status: t("status"),
          active: t("active"),
          inactive: t("inactive"),
          createdAt: t("createdAt"),
          deactivate: t("deactivate"),
          delete: t("delete"),
          deleteConfirmTitle: t("deleteConfirmTitle"),
          deleteConfirmBody: t("deleteConfirmBody"),
          emptyTitle: t("emptyTitle"),
          emptyBody: t("emptyBody"),
          browseDevices: t("browseDevices"),
        }}
      />
    </div>
  );
}
