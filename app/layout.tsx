import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AmbientBackground } from "@/components/ui/ambient-background";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://specnova.app"),
  title: {
    default: "SpecNova — AI Phone Comparison & Price Tracking",
    template: "%s · SpecNova",
  },
  description:
    "The 100%-coverage phone intelligence engine. Compare every device ever made, track real-time prices, and check carrier compatibility — powered by Gemini and real-time scraping.",
  keywords: [
    "phone comparison",
    "smartphone specs",
    "price tracker",
    "5G bands",
    "SpecNova",
  ],
  openGraph: {
    type: "website",
    siteName: "SpecNova",
    title: "SpecNova — AI Phone Comparison & Price Tracking",
    description:
      "Compare every device ever made, track real-time prices, and check carrier compatibility.",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#05050a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeInitScript = `try{var t=localStorage.getItem("specnova-theme");document.documentElement.setAttribute("data-theme",t||"light")}catch(e){};`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans">
        <ThemeProvider>
          <TooltipProvider delayDuration={150}>
            <AmbientBackground />
            <Navbar />
            <main className="min-h-screen">{children}</main>
            <Footer />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
