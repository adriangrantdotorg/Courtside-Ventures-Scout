import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
  // the local copy of the data (SCOUT_PGLITE) is a development tool: never bundled, never shipped
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingExcludes: { "*": ["node_modules/@electric-sql/**"] },
};

export default nextConfig;
