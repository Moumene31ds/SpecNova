"use server";

import { getDevices } from "@/lib/query/device-query";

export async function fetchWishlistDevices(slugs: string[]) {
  if (!slugs.length) return [];
  const devices = await getDevices(slugs);
  return devices.map((d) => ({
    ...d,
    embedding: undefined,
  }));
}
