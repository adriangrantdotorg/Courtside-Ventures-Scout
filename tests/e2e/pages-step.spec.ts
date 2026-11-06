import { test, expect } from "@playwright/test";
import { HOME, ready } from "./pages";

// Pages (11-06-26): Must See opens the company page from its picture and name; the fund pages name both sections.

test("Must See: the picture and the name open the company page; its buttons keep their own clicks", async ({ page }) => {
  await page.goto(HOME);
  await ready(page);
  const hero = page.locator(".x-tile.hero");
  const name = hero.locator(".x-name a");
  await expect(name).toHaveAttribute("href", /^\/company\/\d+$/);
  const href = (await name.getAttribute("href"))!;
  // a point on the picture with nothing of its own on it: the middle of the picture's top half
  const box = (await hero.locator(".x-tm").boundingBox())!;
  const at = { x: box.x + box.width * 0.6, y: box.y + box.height * 0.3 };
  expect(await page.evaluate(({ x, y }) => (document.elementFromPoint(x, y) as HTMLElement | null)?.className || "", at)).toContain("x-tmlink");
  // Track keeps its own click: what sits at its centre is the button
  const track = hero.locator("[data-act='track']");
  await track.scrollIntoViewIfNeeded();
  const tb = (await track.boundingBox())!;
  expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest("[data-act='track']"), { x: tb.x + tb.width / 2, y: tb.y + tb.height / 2 })).toBe(true);
  // the fit ring and the website button stay on top of the picture's link
  for (const sel of [".x-tl", ".x-tr a, .x-tr button"]) {
    const el = hero.locator(sel).first();
    if (!(await el.count())) continue;
    const r = (await el.boundingBox())!;
    expect(await page.evaluate(({ x, y }) => !(document.elementFromPoint(x, y) as HTMLElement | null)?.classList.contains("x-tmlink"), { x: r.x + r.width / 2, y: r.y + r.height / 2 }), sel).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.click(at.x, at.y);
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  // the name opens it too
  await page.goto(HOME);
  await ready(page);
  await page.locator(".x-tile.hero .x-name a").click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
});

test("Synergistic Funders and Neighborhood: both sections are named, and no PitchBook line", async ({ page }) => {
  await page.goto("/synergistic-funders");
  await ready(page);
  await expect(page.locator("main h2", { hasText: "Their Latest Deals" })).toBeVisible();
  await expect(page.locator("main h2", { hasText: "The Funders Scout Watches" })).toBeVisible();
  await expect(page.locator("main")).toContainText("Funds Inside Courtside's Thesis");
  for (const gone of ["PitchBook, X and LinkedIn", "links only in this prototype"]) await expect(page.locator("main")).not.toContainText(gone);
  await page.goto("/neighborhood");
  await ready(page);
  await expect(page.locator("main h2", { hasText: "Their Latest Deals" })).toBeVisible();
  await expect(page.locator("main h2", { hasText: "Co-Investors" })).toBeVisible();
});
