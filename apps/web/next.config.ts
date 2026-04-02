import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  serverExternalPackages: [
    "@prisma/client",
    "prisma"
  ],
  transpilePackages: [
    "@bgc-alpha/auth",
    "@bgc-alpha/baseline-model",
    "@bgc-alpha/db",
    "@bgc-alpha/schemas",
    "@bgc-alpha/simulation-core",
    "@bgc-alpha/ui"
  ]
};

export default nextConfig;
