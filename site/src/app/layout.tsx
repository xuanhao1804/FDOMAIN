import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import { I18nProvider } from "@/components/i18n-context";
import { getServerI18n } from "@/lib/i18n/server";
import { loadSiteRegistryData } from "@/lib/registry";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return {
    title: t("meta.siteTitle"),
    description: t("meta.siteDescription"),
  };
}

export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [{ locale, t }, data] = await Promise.all([
    getServerI18n(),
    Promise.resolve(loadSiteRegistryData()),
  ]);

  return (
    <html lang={locale}>
      <body>
        <I18nProvider initialLocale={locale}>
          <a href="#registry-main" className="skip-link">
            {t("common.skipToContent")}
          </a>
          <AppShell
            rootDomains={data.rootDomains}
            repository={data.repository}
            totalDnsRecords={data.totalDnsRecords}
            maxTotalRecords={data.limits.maxTotalRecords}
          >
            {children}
          </AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
