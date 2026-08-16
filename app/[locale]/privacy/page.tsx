import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = { title: "Privacy Policy" };

export default async function PrivacyPage() {
  const t = await getTranslations("legal.privacy");

  return (
    <div className="container mx-auto max-w-3xl pb-20 pt-12">
      <div className="mb-10">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          SpecNova
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("updated", { date: "August 16, 2026" })}
        </p>
      </div>

      <p className="mb-8 text-muted-foreground">{t("intro")}</p>

      <div className="space-y-8">
        {t.raw("sections").map(
          (section: { heading: string; body: string }, i: number) => (
            <section key={i}>
              <h2 className="font-display text-lg font-semibold tracking-tight">
                {section.heading}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {section.body}
              </p>
            </section>
          ),
        )}
      </div>
    </div>
  );
}
