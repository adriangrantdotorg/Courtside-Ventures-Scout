import { test, expect } from "@playwright/test";
import { PAGES, ready } from "./pages";

// No Slack anywhere (11-06-26): SLACK is off in src/lib/features.ts. No page says Slack, Settings has no Slack
// section, and the Slack addresses are closed.
test("no Slack anywhere: no page says it, Settings has no Slack section, and its addresses are closed", async ({ page, request }) => {
  for (const p of [...PAGES, "/settings?s=alerts", "/settings?s=phase2", "/settings?s=slack"]) {
    await page.goto(p);
    await ready(page);
    await expect(page.locator("body"), p).not.toContainText(/slack/i);
  }
  await page.goto("/settings");
  await ready(page);
  await expect(page.getByRole("link", { name: "Slack", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Slack", exact: true })).toHaveCount(0);
  for (const a of ["/api/slack/start", "/api/slack/callback"]) expect((await request.get(a, { maxRedirects: 0 })).status(), a).toBe(404);
  for (const a of ["/api/slack/test", "/api/slack/disconnect"]) expect((await request.post(a, { data: {} })).status(), a).toBe(404);
});
