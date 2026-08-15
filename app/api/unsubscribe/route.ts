import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe deep link referenced from FCM / email price alerts.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const alertId = searchParams.get("alert");
  if (!alertId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.priceAlerts)
    .where("id", "==", alertId)
    .limit(1)
    .get();
  snap.docs.forEach((doc) => doc.ref.update({ active: false }));

  return NextResponse.redirect(new URL("/?unsubscribed=1", request.url));
}
