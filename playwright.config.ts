import { defineConfig, devices } from "@playwright/test";

const LIVE = process.env.LIVE_URL;
const PORT = Number(process.env.E2E_PORT || 4601);

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
