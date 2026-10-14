import { config } from "dotenv";
// Unit tests read the same .env.local the app does (SITE_URL for the User-Agent); the shell no longer has to export it.
config({ path: ".env.local", quiet: true });
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node", testTimeout: 30_000, pool: "forks" },
});
