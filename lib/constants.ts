export const BRAND_COLORS: Record<string, string> = {
  samsung: "#8A2BE2",
  apple: "#A3A3A3",
  google: "#4285F4",
  xiaomi: "#FF6900",
  oppo: "#00A64E",
  oneplus: "#EB0028",
  vivo: "#415FFF",
  realme: "#FFD900",
  sony: "#003791",
  motorola: "#5C2D91",
  nothing: "#F1F1F1",
  honor: "#00C0FF",
  huawei: "#FF0000",
  asus: "#00BDFF",
  nokia: "#124191",
  infinix: "#E4002B",
  tecno: "#00C3FF",
  itel: "#1F8A70",
};

export function brandColor(brand: string): string {
  return BRAND_COLORS[brand.toLowerCase()] ?? "#6B7280";
}

export const BRAND_NAME_MAP: Record<string, string> = {
  samsung: "Samsung",
  apple: "Apple",
  google: "Google",
  xiaomi: "Xiaomi",
  oppo: "OPPO",
  oneplus: "OnePlus",
  vivo: "vivo",
  realme: "realme",
  sony: "Sony",
  motorola: "Motorola",
  nothing: "Nothing",
  honor: "HONOR",
  huawei: "Huawei",
  asus: "ASUS",
  nokia: "Nokia",
  infinix: "Infinix",
  tecno: "Tecno",
  itel: "itel",
};

export const POPULAR_BRANDS = [
  "samsung",
  "apple",
  "xiaomi",
  "oneplus",
  "google",
  "oppo",
  "vivo",
  "realme",
  "sony",
  "motorola",
  "nothing",
  "honor",
  "huawei",
];

export function brandDisplayName(slug: string): string {
  return BRAND_NAME_MAP[slug.toLowerCase()] ?? capitalize(slug);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export const THEMES = ["oled", "neon", "light"] as const;
export type ThemeName = (typeof THEMES)[number];

export const NAV_LINKS = [
  { href: "/", label: "Explore" },
  { href: "/compare", label: "Compare" },
  { href: "/search", label: "AI Search" },
  { href: "/bands", label: "Carrier Bands" },
] as const;
