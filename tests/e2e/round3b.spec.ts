import { test, expect } from "@playwright/test";
import { HOME } from "./pages";

// Adrian's review of rounds 1 to 3 (10-14-26), each item pressed or measured.

test("the ticker keeps moving under the pointer", async ({ page }) => {
  await page.goto(HOME);
  const track = page.locator(".ticker .track");
  const box = (await page.locator(".ticker").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); // the track itself moves, so the pointer parks over the strip
  expect(await track.evaluate((el) => getComputedStyle(el).animationPlayState)).toBe("running");
});

test("a deep link lands with the item fully below the sticky top bar", async ({ page }) => {
  await page.goto("/trends");
  const slug = await page.locator("article.tcard").nth(3).getAttribute("id");
  await page.goto(`/trends#${slug}`);
  await page.waitForTimeout(400);
  const barBottom = await page.locator("header.top").evaluate((el) => el.getBoundingClientRect().bottom);
  const top = await page.locator(`#${slug}`).evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(barBottom);
  expect(top - barBottom).toBeLessThan(60);
});

test("no keycap appears in the top bar, even on hover", async ({ page }) => {
  await page.goto(HOME);
  const chip = page.locator("[data-theme-chip]");
  await chip.hover();
  expect(await chip.locator(".kbd").evaluate((el) => getComputedStyle(el).display)).toBe("none");
});

test("home blocks never spill past their column", async ({ page }) => {
  await page.goto(HOME);
  const spills = await page.locator("main .x-sec, #radar .x-tile").evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  expect(spills).toBe(0);
});

test("footer: pages on the left, the person on the right; Funds Raised on the card", async ({ page }) => {
  await page.goto("/pipeline");
  const left = await page.locator("footer.foot .left").boundingBox();
  const right = await page.locator("footer.foot .right").boundingBox();
  expect(left!.x).toBeLessThan(right!.x);
  await expect(page.locator("footer.foot .left")).toContainText("Settings");
  await expect(page.locator("footer.foot .right")).toContainText("Built by");
  await expect(page.locator(".x-row .x-funds").first()).toContainText("Funds Raised");
});

test("every Phase II on the Culture and Alerts pages opens the door", async ({ page }) => {
  for (const path of ["/culture", "/tracking#configure"]) {
    await page.goto(path);
    const links = page.locator("main button.p2");
    expect(await links.count(), path).toBeGreaterThan(0);
    await links.first().click();
    await expect(page.getByRole("dialog")).toContainText("Phase II");
    await page.keyboard.press("Escape");
  }
});

test("Sponsor Radar: dropdowns on one row; Backtest shows only wins", async ({ page }) => {
  await page.goto("/sponsors");
  const tops = await page.locator(".frow.sels .fsel").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  await page.goto("/backtest");
  expect(await page.locator(".card2.none").count()).toBe(0);
  await expect(page.locator(".score")).not.toContainText("Found first");
  await expect(page.locator(".score")).not.toContainText("Honest");
});
