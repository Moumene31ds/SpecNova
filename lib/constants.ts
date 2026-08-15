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
  return BRAND_COLORS[brand.toLowerCase()] ?? "#8A2BE2";
}

export const THEMES = ["oled", "neon", "light"] as const;
export type ThemeName = (typeof THEMES)[number];

export const NAV_LINKS = [
  { href: "/", label: "Explore" },
  { href: "/compare", label: "Compare" },
  { href: "/search", label: "AI Search" },
  { href: "/bands", label: "Carrier Bands" },
] as const;
