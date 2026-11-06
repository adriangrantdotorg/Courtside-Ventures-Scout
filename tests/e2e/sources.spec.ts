import { test, expect } from "@playwright/test";
import { ready } from "./pages";

// Settings › Sources (11-06-26): the sources a switch can turn off are listed first, then the rest.
test("Settings › Sources lists the switchable sources first", async ({ page }) => {
  await page.goto("/settings?s=sources");
  await ready(page);
  const rows = page.locator(".jobrow");
  const flags = await rows.evaluateAll((els) => els.map((el) => !!el.querySelector('[role="switch"]')));
  expect(flags.filter(Boolean).length, "some sources have a switch").toBeGreaterThan(0);
  const firstPlain = flags.indexOf(false);
  expect(firstPlain === -1 || flags.slice(firstPlain).every((f) => !f), `every switch comes before the first row without one: ${flags.map((f) => (f ? "S" : ".")).join("")}`).toBe(true);
});
