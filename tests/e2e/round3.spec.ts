import { test, expect } from "@playwright/test";
import { HOME, LIVE } from "./pages";

// Round 3 (10-14-26): Adrian's picks from the six variations pages, each pressed or measured.

test("Trends: one action bar, Track turns green and says Tracking", async ({ page }) => {
  test.skip(LIVE, "writes run locally only");
  await page.goto("/trends");
  const bar = page.locator(".tbar").first();
  const mids = await bar.locator("> *:not(.tlist)").evaluateAll((els) => els.map((e) => Math.round((e.getBoundingClientRect().top + e.getBoundingClientRect().bottom) / 2)));
  expect(Math.max(...mids) - Math.min(...mids), "bar controls share one line (centers within 4px)").toBeLessThanOrEqual(4);
  await bar.locator("button", { hasText: /^Timeline/ }).click();
  await expect(bar.locator(".tlist")).toBeVisible();
  const track = bar.locator("button.track");
  const was = await track.getAttribute("aria-pressed");
  await track.click();
  await expect(track).toHaveAttribute("aria-pressed", was === "true" ? "false" : "true");
  const pressed = (await track.getAttribute("aria-pressed")) === "true";
  const bg = await track.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe(pressed ? "rgb(15, 107, 51)" : "rgb(204, 0, 61)");
  await expect(track).toHaveText(pressed ? /Tracking/ : /Track$/);
  await track.click(); // put it back
  await expect(track).toHaveAttribute("aria-pressed", was!);
});

test("Dossier: six actions in two rows of three, no label clipped", async ({ page }) => {
  await page.goto("/pipeline");
  const acts = page.locator(".acts").first();
  const tops = await acts.locator(".btn").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(tops.length).toBe(6);
  expect(new Set(tops).size).toBe(2);
  const clipped = await acts.locator(".btn .long, .btn").evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  expect(clipped).toBe(0);
});

test("Filings and deals are tables with the picked columns", async ({ page }) => {
  await page.goto(HOME);
  const f = page.locator('table[data-table="filings"]').first();
  const heads = async (t: typeof f) => (await t.locator("th").allInnerTexts()).map((x) => x.trim().toLowerCase());
  if (await f.count()) expect(await heads(f)).toEqual(expect.arrayContaining(["company", "sold", "area · fit", "notes", "source"]));
  const d = page.locator('table[data-table="deals"]').first();
  if (await d.count()) expect(await heads(d)).toEqual(expect.arrayContaining(["fund", "backed", "round", "source"]));
  await page.goto("/neighborhood");
  expect(await heads(page.locator('table[data-table="deals"]'))).toEqual(expect.arrayContaining(["fund", "backed", "round", "amount", "area", "source"]));
  await expect(page.locator("body")).not.toContainText("Clear Filters");
  // red text in a deal row is always a link
  const redNonLinks = await page.locator('table[data-table="deals"] td *').evaluateAll((els) => els.filter((e) => getComputedStyle(e).color === "rgb(255, 77, 122)" && !e.closest("a")).length);
  expect(redNonLinks).toBe(0);
  await page.goto("/synergistic-funders");
  await expect(page.locator("body")).not.toContainText("Clear Filters");
});

test("Culture: tabs with counts switch the panels and keep the hash", async ({ page }) => {
  await page.goto("/culture");
  const tabs = page.locator('.tabs [role="tab"]');
  expect(await tabs.count()).toBe(3);
  await expect(page.locator("#panel-taste")).toBeVisible();
  await expect(page.locator("#panel-named")).toBeHidden();
  await expect(async () => {
    await tabs.nth(1).click(); // the click lands once the page has hydrated
    await expect(page.locator("#panel-named")).toBeVisible({ timeout: 800 });
  }).toPass({ timeout: 10000 });
  await expect(page.locator("#panel-taste")).toBeHidden();
  expect(page.url()).toContain("#named");
  await page.goto("/pipeline"); // a link from another page lands on the tab in the hash
  await page.goto("/culture#shows");
  await expect(page.locator("#panel-shows")).toBeVisible();
});
