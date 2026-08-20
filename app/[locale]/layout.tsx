import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono, Noto_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AmbientBackground } from "@/components/ui/ambient-background";
import { Navbar } from "@/components/layout/navbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { PageTransition } from "@/components/layout/page-transition";
import { LoadingBar } from "@/components/layout/loading-bar";
import AiChatWidget from "@/components/ai/ai-chat-widget";
import { InstallPrompt } from "@/components/layout/install-prompt";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { KeyboardShortcutsProvider } from "@/components/ui/keyboard-shortcuts";
import { locales, isRtl, type Locale } from "@/lib/i18n";
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

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://phone-steel-beta.vercel.app"),
  title: {
    default: "iToPhone — AI Phone Comparison & Price Tracking",
    template: "%s · iToPhone",
  },
  description:
    "The 100%-coverage phone intelligence engine. Compare every device ever made, track real-time prices, and check carrier compatibility — powered by Gemini and real-time scraping.",
  keywords: [
    "phone comparison",
    "smartphone specs",
    "price tracker",
    "5G bands",
    "iToPhone",
  ],
  openGraph: {
    type: "website",
    siteName: "iToPhone",
    title: "iToPhone — AI Phone Comparison & Price Tracking",
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

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  const messages = await getMessages({ locale });
  setRequestLocale(locale);
  const rtl = isRtl(locale as Locale);

  return (
    <html
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      data-theme="light"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${notoSansArabic.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {locales.map((loc) => (
          <link
            key={loc}
            rel="alternate"
            hrefLang={loc}
            href={`${process.env.NEXT_PUBLIC_APP_URL || "https://phone-steel-beta.vercel.app"}/${loc}`}
          />
        ))}
        <link
          rel="alternate"
          hrefLang="x-default"
          href={`${process.env.NEXT_PUBLIC_APP_URL || "https://phone-steel-beta.vercel.app"}/en`}
        />
      </head>
      <body className="font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <TooltipProvider delayDuration={150}>
              <AmbientBackground />
              <LoadingBar />
              <Navbar />
              <main className="min-h-screen pb-24 md:pb-0">
                <PageTransition>{children}</PageTransition>
              </main>
              <div className="pb-24 md:pb-0">
                <Footer />
              </div>
              <BottomNav />
              <AiChatWidget />
              <InstallPrompt />
              <ScrollToTop />
              <KeyboardShortcutsProvider locale={locale} />
            </TooltipProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
