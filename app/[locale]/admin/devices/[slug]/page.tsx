import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { locales } from "@/lib/i18n";
import { getAdminFirestore, isFirebaseConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS, type Device } from "@/lib/firebase/types";
import type { AiExtractedDevice } from "@/lib/ai/extractSpecs";
import { DeviceEditClient, type DeviceData } from "./device-edit-client";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

async function fetchDevice(slug: string): Promise<DeviceData | null> {
  if (!isFirebaseConfigured()) return null;

  const db = getAdminFirestore();
  const doc = await db.collection(COLLECTIONS.devices).doc(slug).get();

  if (!doc.exists) return null;

  const data = doc.data() as Device;

  // Fetch variants
  const variantsSnap = await db
    .collection(COLLECTIONS.devices)
    .doc(slug)
    .collection(COLLECTIONS.variants)
    .get();

  const variants = variantsSnap.docs.map((v) => {
    const vd = v.data();
    return {
      name: vd.name ?? "",
      region: vd.region ?? "Global",
      chipset: vd.chipset ?? null,
      ramGb: vd.ramGb ?? null,
      storageGb: vd.storageGb ?? null,
      modem: vd.modem ?? null,
      note: null,
    };
  });

  return {
    id: doc.id,
    slug: data.slug ?? doc.id,
    brand: data.brand ?? "",
    name: data.name ?? "",
    modelNumbers: data.modelNumbers ?? [],
    codename: data.codename ?? null,
    status: data.status ?? "rumored",
    announcedAt: (() => {
      if (!data.announcedAt?.seconds) return null;
      const d = new Date(data.announcedAt.seconds * 1000);
      return Number.isFinite(d.getTime()) ? d.toISOString() : null;
    })(),
    releaseAt: (() => {
      if (!data.releaseAt?.seconds) return null;
      const d = new Date(data.releaseAt.seconds * 1000);
      return Number.isFinite(d.getTime()) ? d.toISOString() : null;
    })(),
    specs: data.specs as unknown as AiExtractedDevice["specs"],
    variants,
    media: {
      heroImage: data.media?.heroImage ?? null,
      gallery: data.media?.gallery ?? [],
      renderImages: data.media?.renderImages ?? [],
    },
    sources: (data.sources ?? []).map((s) => ({
      title: s.title ?? "",
      url: s.url ?? "",
      kind: s.kind ?? "retailer",
    })),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Edit ${slug} — Admin` };
}

export default async function DeviceEditPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  if (!isFirebaseConfigured()) {
    return (
      <div className="space-y-8">
        <section>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Edit Device</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Firestore isn&apos;t configured. Set FIREBASE_SERVICE_ACCOUNT_JSON to edit devices.
          </p>
        </section>
      </div>
    );
  }

  const device = await fetchDevice(slug);
  if (!device) notFound();

  return <DeviceEditClient device={device} locale={locale} />;
}
