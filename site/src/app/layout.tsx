import type { Metadata } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono, Newsreader } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { isAdminAuthConfigured } from "@/lib/auth";
import { isServerAdminAuthenticated } from "@/lib/auth-cookies";
import { getDomainCapability, getProviderEnvStatus } from "@/lib/dns-providers";
import { loadSiteRegistryData } from "@/lib/registry";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin", "vietnamese"],
  weight: ["600"],
  variable: "--font-newsreader",
  display: "swap",
  preload: false,
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "vietnamese"],
  variable: "--font-jetbrains",
  display: "swap",
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("siteTitle"),
    description: t("siteDescription"),
  };
}

const COLOR_SCHEME_INIT_SCRIPT = `try{var s=localStorage.getItem("color-scheme");if(s==="light"||s==="dark"){var m=document.querySelector('meta[name="color-scheme"]');if(m)m.content=s;}}catch(e){}`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, messages, tCommon, initialAuthenticated] = await Promise.all([
    getLocale(),
    getMessages(),
    getTranslations("common"),
    isServerAdminAuthenticated(),
  ]);
  const data = loadSiteRegistryData();
  const initialAdminState = {
    authenticated: initialAuthenticated,
    configured: isAdminAuthConfigured(),
    envStatus: getProviderEnvStatus(),
    capabilities: data.rootDomains.map((dom) => getDomainCapability(dom)),
  };

  return (
    <html
      lang={locale}
      className={`${newsreader.variable} ${beVietnamPro.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: COLOR_SCHEME_INIT_SCRIPT }} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <a href="#registry-main" className="skip-link">
            {tCommon("skipToContent")}
          </a>
          <AppShell
            rootDomains={data.rootDomains}
            repository={data.repository}
            totalDnsRecords={data.totalDnsRecords}
            maxTotalRecords={data.limits.maxTotalRecords}
            initialAdminState={initialAdminState}
          >
            {children}
          </AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
