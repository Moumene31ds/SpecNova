import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * POST /api/upload
 *
 * Accepts multipart form-data with:
 *   - file: the image (max 20 MB)
 *   - deviceId: the phone document ID (for folder organisation)
 *   - type: "hero" | "gallery" | "camera-sample" (default "gallery")
 *
 * Returns { url, publicId, width, height }.
 *
 * On Vercel the body size limit is 4.5 MB for serverless functions.
 * For larger files we accept a signed-upload URL so the client can push
 * directly to Cloudinary (see the second endpoint below).
 */
export async function POST(req: NextRequest) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return NextResponse.json(
      { error: "Cloudinary is not configured." },
      { status: 501 },
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const deviceId = (formData.get("deviceId") as string) || "unknown";
    const type = (formData.get("type") as string) || "gallery";

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 20 MB)." },
        { status: 413 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const folder = `itophone/${deviceId}/${type}`;
    const timestamp = Math.round(Date.now() / 1000);

    const result = await new Promise<{ secure_url: string; public_id: string; width: number; height: number }>(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: "image",
            format: "jpg",
            quality: "auto:best",
            fetch_format: "auto",
            transformation: [
              { width: 2400, height: 2400, crop: "limit" },
              { dpr: "auto" },
            ],
            context: `device_id=${deviceId}|type=${type}|uploaded_at=${timestamp}`,
            tags: ["user-upload", type, deviceId],
          },
          (error, result) => {
            if (error) reject(error);
            else if (result) resolve(result);
            else reject(new Error("Upload failed"));
          },
        );

        uploadStream.end(buffer);
      },
    );

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[upload] Error:", message);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 },
    );
  }
}

/**
 * GET /api/upload?deviceId=xxx
 *
 * Returns a signed upload URL so the client can push directly to Cloudinary,
 * bypassing the 4.5 MB serverless body limit.
 */
export async function GET(req: NextRequest) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return NextResponse.json(
      { error: "Cloudinary is not configured." },
      { status: 501 },
    );
  }

  const deviceId = req.nextUrl.searchParams.get("deviceId") || "unknown";
  const type = req.nextUrl.searchParams.get("type") || "gallery";

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `itophone/${deviceId}/${type}`;

  const paramsToSign: Record<string, string | number> = {
    folder,
    timestamp,
    resource_type: "image",
    transformation: "c_limit,w_2400,h_2400,dpr_auto,f_auto,q_auto:best",
    context: `device_id=${deviceId}|type=${type}|uploaded_at=${timestamp}`,
    tags: `user-upload,${type},${deviceId}`,
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!,
  );

  return NextResponse.json({
    url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder,
    params: paramsToSign,
  });
}
