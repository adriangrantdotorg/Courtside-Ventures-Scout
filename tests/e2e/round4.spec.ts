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
  await expect(page).toHaveURL(/\/tracking#configure$/);
  await expect(page.locator("#panel-configure")).toBeVisible();
  await page.goto("/people");
  await expect(page).toHaveURL(/\/tracking#people$/);
});

test("Tracking: five tabs with counts, the Add row right under the tabs, the hits count in the header", async ({ page }) => {
  await page.goto("/tracking");
  const tabs = page.locator('.tabs [role="tab"]');
  expect(await tabs.count()).toBe(5);
  expect((await tabs.allInnerTexts()).map((t) => t.replace(/\d+/g, "").trim().toLowerCase())).toEqual(["companies", "trends", "people", "alerts", "configure alerts"]);
  const tabsBottom = await page.locator(".tabs").evaluate((el) => el.getBoundingClientRect().bottom);
  const addTop = await page.locator("#panel-companies .tabadd").evaluate((el) => el.getBoundingClientRect().top);
  expect(addTop - tabsBottom).toBeLessThan(40);
  await expect(page.locator(".ph .count")).toContainText(/alerts? this week/);
  await expect(page.locator("body")).not.toContainText("Each tab is one list");
  await expect(page.locator('#panel-companies .tabadd button[data-act="add"]')).toBeVisible();
  await expect(page.locator('#panel-companies .tabadd button[data-act="add"]')).toBeDisabled();
  await tabs.nth(4).click();
  await expect(page.locator("#panel-configure")).toBeVisible();
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

test("the Spotlight underline does not move on hover", async ({ page }) => {
  await page.goto(HOME);
  const a = page.locator(".band h2 a").first();
  if (!(await a.count())) return;
  const before = await a.evaluate((el) => [getComputedStyle(el).textUnderlineOffset, getComputedStyle(el).textDecorationStyle]);
  await a.hover();
  const after = await a.evaluate((el) => [getComputedStyle(el).textUnderlineOffset, getComputedStyle(el).textDecorationStyle]);
  expect(after).toEqual(before);
});

test("Add on the Tracking page tracks a typed name", async ({ page }) => {
  test.skip(!!process.env.LIVE_URL, "writes run locally only");
  await page.goto("/tracking");
  const name = `Test Co ${Date.now()}`;
  await page.locator("#panel-companies .tabadd input").fill(name);
  const before = Number((await page.locator('.tabs [role="tab"]').first().locator("b").innerText()) || 0);
  await page.locator('#panel-companies .tabadd button[data-act="add"]').click();
  await expect(page.locator('#panel-companies [data-added-item]').first()).toContainText(name);
  await expect(page.locator('.tabs [role="tab"]').first().locator("b")).toHaveText(String(before + 1));
});

test("a new person and a new rule appear at once, with the tab counts moving", async ({ page }) => {
  test.skip(!!process.env.LIVE_URL, "writes run locally only");
  await page.goto("/tracking#people");
  const who = `Test Person ${Date.now()}`;
  await page.locator('#panel-people input[aria-label="Name"]').fill(who);
  await page.locator("#panel-people button", { hasText: "Track Person" }).click();
  await expect(page.locator('#panel-people [data-added-item]').first()).toContainText(who);
  await page.locator('.tabs [role="tab"]', { hasText: "Configure Alerts" }).click();
  const n = Number(await page.locator('.tabs [role="tab"]', { hasText: "Configure Alerts" }).locator("b").innerText());
  await page.locator('#panel-configure input[aria-label="Who or what"]').fill(`Test rule ${Date.now()}`);
  await page.locator('#panel-configure form button.btn.red').click();
  await expect(page.locator('#panel-configure [data-added-item]').first()).toBeVisible();
  await expect(page.locator('.tabs [role="tab"]', { hasText: "Configure Alerts" }).locator("b")).toHaveText(String(n + 1));
});

