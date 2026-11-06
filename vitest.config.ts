import { config } from "dotenv";
// Unit tests read the same .env.local the app does (SITE_URL for the User-Agent); the shell no longer has to export it.
config({ path: ".env.local", quiet: true });
// …but never the live database's address (11-06-26): with it, a unit test that has no test database of its own wrote
// into the live one, so the reader tests' deliberate broken answers showed as 8 failing sources on Settings › Sources.
// A unit test that needs a database makes its own (PGlite, `__scoutTestDb`); tests/unit/rules.test.ts checks this.
for (const k of Object.keys(process.env)) if (/^(DATABASE_URL|POSTGRES_|PG[A-Z]|NEON_)/.test(k)) delete process.env[k];
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node", testTimeout: 30_000, pool: "forks" },
});
