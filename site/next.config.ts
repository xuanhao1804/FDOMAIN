import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  outputFileTracingIncludes: {
    "/**": ["./src/data/registry.json", "../config.json", "./messages/**"],
  },
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
    staleTimes: {
      dynamic: 60,
      static: 180,
    },
  },
  images: {
    unoptimized: true,
  },
};

export default withNextIntl(nextConfig);
