import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "specnova",
    version: "0.1.0",
    region: process.env.VERCEL_REGION ?? "edge",
    time: new Date().toISOString(),
  });
}
