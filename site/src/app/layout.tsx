import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import { loadSiteRegistryData } from "@/lib/registry";
import "./globals.css";

export const metadata: Metadata = {
  title: "FDOMAIN — Subdomain Registry",
  description:
    "Personal GitOps DNS-as-code subdomain directory, JSON claim builder, and live health monitor.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const data = loadSiteRegistryData();

  return (
    <html lang="en">
      <body>
        <a href="#registry-main" className="skip-link">
          Skip to content
        </a>
        <AppShell
          rootDomains={data.rootDomains}
          repository={data.repository}
          totalDnsRecords={data.totalDnsRecords}
          maxTotalRecords={data.limits.maxTotalRecords}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
