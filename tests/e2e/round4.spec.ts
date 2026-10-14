import { test, expect } from "@playwright/test";
import { HOME } from "./pages";

// The Tracking page (Adrian's pick A, 10-14-26) and the two nav fixes from the same note.

test("Tracking replaces Alerts and People in the menu, and the old addresses land on their tab", async ({ page }) => {
  await page.goto(HOME);
  const labels = (await page.locator("nav.nav a").allInnerTexts()).map((t) => t.trim().toLowerCase());
  expect(labels).toContain("tracking");
  expect(labels).not.toContain("alerts");
  expect(labels).not.toContain("people");
  await page.goto("/alerts");
  await expect(page).toHaveURL(/\/tracking#rules$/);
  await expect(page.locator("#panel-rules")).toBeVisible();
  await page.goto("/people");
  await expect(page).toHaveURL(/\/tracking#people$/);
});

test("Tracking: five tabs with counts, the Add row right under the tabs, the hits count in the header", async ({ page }) => {
  await page.goto("/tracking");
  const tabs = page.locator('.tabs [role="tab"]');
  expect(await tabs.count()).toBe(5);
  expect((await tabs.allInnerTexts()).map((t) => t.replace(/\d+/g, "").trim().toLowerCase())).toEqual(["companies", "trends", "people", "rules", "hits"]);
  const tabsBottom = await page.locator(".tabs").evaluate((el) => el.getBoundingClientRect().bottom);
  const addTop = await page.locator("#panel-companies .tabadd").evaluate((el) => el.getBoundingClientRect().top);
  expect(addTop - tabsBottom).toBeLessThan(40);
  await expect(page.locator(".ph .count")).toContainText(/hits? this week/);
  await expect(page.locator("body")).not.toContainText("Each tab is one list");
  await tabs.nth(3).click();
  await expect(page.locator("#panel-rules")).toBeVisible();
});

test("a nav click on Pipeline lands with nothing preselected", async ({ page }) => {
  await page.goto("/pipeline?q=prediction");
  await expect(page.locator('input[aria-label="Search the Pipeline"]')).toHaveValue("prediction");
  await page.locator("nav.nav a", { hasText: "Pipeline" }).click();
  await expect(page.locator('input[aria-label="Search the Pipeline"]')).toHaveValue("");
  await page.reload();
  await expect(page.locator('input[aria-label="Search the Pipeline"]')).toHaveValue("");
});

test("the Spotlight headline shows its underline at rest", async ({ page }) => {
  await page.goto(HOME);
  const a = page.locator(".band h2 a").first();
  if (await a.count()) expect(await a.evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe("underline");
});
