import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { locales } from "@/lib/i18n";
import { WishlistView } from "@/components/wishlist/wishlist-view";

export const metadata: Metadata = { title: "Wishlist" };

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function WishlistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <WishlistView locale={locale} />;
}
