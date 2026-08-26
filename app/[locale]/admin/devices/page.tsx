import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { locales } from "@/lib/i18n";
import { getAdminFirestore, isFirebaseConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS, type Device, type DeviceStatus } from "@/lib/firebase/types";
import { DeviceListClient } from "./device-list-client";

export const metadata: Metadata = {
  title: "Devices — Admin",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

interface DeviceRow {
  id: string;
  slug: string;
  brand: string;
  name: string;
  status: DeviceStatus;
  score: number;
  updatedAt: string | null;
}

async function fetchDevices(): Promise<DeviceRow[]> {
  if (!isFirebaseConfigured()) return [];

  const db = getAdminFirestore();
  const snapshot = await db
    .collection(COLLECTIONS.devices)
    .orderBy("updatedAt", "desc")
    .limit(500)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as Device;
    return {
      id: doc.id,
      slug: data.slug ?? doc.id,
      brand: data.brand ?? "",
      name: data.name ?? "",
      status: data.status ?? "rumored",
      score: data.score?.total ?? 0,
      updatedAt: (() => {
        if (!data.updatedAt?.seconds) return null;
        const d = new Date(data.updatedAt.seconds * 1000);
        return Number.isFinite(d.getTime()) ? d.toISOString() : null;
      })(),
    };
  });
}

export default async function DeviceListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const devices = await fetchDevices();

  if (!isFirebaseConfigured()) {
    return (
      <div className="space-y-8">
        <section>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Devices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the device catalog.
          </p>
        </section>
        <div className="rounded-xl border border-border p-8 text-sm text-muted-foreground">
          Firestore isn&apos;t configured. Set FIREBASE_SERVICE_ACCOUNT_JSON to manage devices.
        </div>
      </div>
    );
  }

  return <DeviceListClient devices={devices} locale={locale} />;
}
