import { defineConfig, devices } from "@playwright/test";

const LIVE = process.env.LIVE_URL;
const PORT = Number(process.env.E2E_PORT || 4601);
// A local run serves the site from a local copy of the data, never the live database: one run on it read 243 MB of
// Neon's free 5 GB a month (11-06-26). npm run check makes the copy (scripts/check.sh).
if (!LIVE && !process.env.SCOUT_PGLITE)
  throw new Error("The browser tests run on a local copy of the data: npm run check (or SCOUT_PGLITE=<copy> npx playwright test)");

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  workers: 4,
  reporter: "line",
  globalSetup: "./tests/e2e/setup.ts",
  globalTeardown: "./tests/e2e/teardown.ts",
  use: {
    baseURL: LIVE || `http://localhost:${PORT}`,
    actionTimeout: 3_000,
    navigationTimeout: 15_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: LIVE
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}/api/build-progress`,
        reuseExistingServer: false,
        timeout: 60_000,
      },
});
