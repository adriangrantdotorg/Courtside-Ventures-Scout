import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
  // the local copy of the data (SCOUT_PGLITE) is a development tool: never bundled, never shipped
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingExcludes: { "*": ["node_modules/@electric-sql/**"] },
  // Brand Sky measures images with sharp. The build runs on a Mac, so sharp's Mac engine is what ships; on Vercel's
  // Linux it falls back to its WebAssembly engine, which must ride in the cron function (tested with the Mac engine
  // blocked: SVG, PNG and JPEG all measure, 10-30-26)
  outputFileTracingIncludes: { "/api/cron/[job]": ["./node_modules/@img/sharp-wasm32/**/*", "./node_modules/@img/colour/**/*"] },
};

export default nextConfig;
