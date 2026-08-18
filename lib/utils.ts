import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  value: number,
  currency = "USD",
  locale = "en-US",
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: value < 10 ? 2 : 0,
  }).format(value);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function classNamesOfDevice(device: {
  brand: string;
  name: string;
  modelNumbers?: string[];
  codename?: string | null;
}): string[] {
  const tokens = [
    device.brand,
    device.name,
    ...(device.modelNumbers ?? []),
    device.codename ?? "",
  ]
    .filter(Boolean)
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ""))
    .filter((t) => t.length > 2);

  const brands = ["samsung", "apple", "google", "xiaomi", "oppo", "oneplus", "sony", "motorola", "nothing", "honor", "realme", "vivo", "asus", "huawei"];
  const models = tokens.filter((t) => !brands.includes(t));
  return [...new Set([...brands.filter((b) => tokens.includes(b)), ...models])];
}

export function absoluteUrl(path: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured && !configured.includes("localhost")) {
    return new URL(path, configured).toString();
  }
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return new URL(path, `https://${vercelUrl}`).toString();
  }
  return new URL(path, "https://phone-steel-beta.vercel.app").toString();
}

export function formatDate(date: Date | { seconds: number } | null | undefined) {
  if (!date) return "TBA";
  const d = "seconds" in date ? new Date(date.seconds * 1000) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}
