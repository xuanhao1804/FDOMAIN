import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  output: "export",
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  images: {
    unoptimized: true,
  },
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
};

export default nextConfig;
