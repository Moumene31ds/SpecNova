import { NextRequest, NextResponse } from "next/server";
import { getServerTokens } from "@/lib/firebase/auth";
import { getAdminFirestore } from "@/lib/firebase/admin";

/**
 * POST /api/device/[deviceId]/images
 *
 * Saves a user-uploaded image URL to the device's Firestore document.
 * Requires authentication (any signed-in user can upload).
 *
 * Body: { url: string, type: "gallery" | "camera-sample" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const { deviceId } = await params;

  const tokens = await getServerTokens();
  const uid = tokens?.decodedToken?.uid;
  const email = tokens?.decodedToken?.email;

  if (!uid) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { url, type = "gallery" } = body as {
      url: string;
      type?: "gallery" | "camera-sample";
    };

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
    }

    const db = getAdminFirestore();
    const deviceRef = db.collection("devices").doc(deviceId);
    const doc = await deviceRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Device not found." }, { status: 404 });
    }

    const data = doc.data()!;
    const media = data.media ?? {};

    if (type === "camera-sample") {
      const samples = media.cameraSamples ?? {};
      const key = `user-${uid}-${Date.now()}`;
      samples[key] = url;
      await deviceRef.update({ "media.cameraSamples": samples });
    } else {
      const gallery: string[] = media.gallery ?? [];
      if (!gallery.includes(url)) {
        gallery.push(url);
      }
      await deviceRef.update({ "media.gallery": gallery });
    }

    await db.collection("upload-logs").add({
      deviceId,
      uid,
      email,
      url,
      type,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[device/images] Error:", message);
    return NextResponse.json(
      { error: "Failed to save image." },
      { status: 500 },
    );
  }
}
