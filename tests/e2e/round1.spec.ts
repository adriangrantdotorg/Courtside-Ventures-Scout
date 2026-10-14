import { test, expect } from "@playwright/test";
import { HOME } from "./pages";

// Round 1 of Adrian's 10-14-26 Vercel feedback: each fix has a click or a measurement here.

test("the site moves even when the Mac asks for reduced motion, and Settings can switch motion off", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(HOME);
  const name = await page.locator(".ticker .track").evaluate((el) => getComputedStyle(el).animationName);
  expect(name).toBe("tick");
  const live = await page.locator(".ticker .lbl i").evaluate((el) => getComputedStyle(el).animationName);
  expect(live).toBe("liveglow");
  await page.goto("/pipeline");
  const sweep = await page.locator(".rule").first().evaluate((el) => getComputedStyle(el, "::after").animationName);
  expect(sweep).toBe("sweep");
  await page.evaluate(() => (document.documentElement.dataset.motion = "off"));
  expect(await page.locator(".ticker .track").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});

test("the top bar stays put while the page scrolls", async ({ page }) => {
  await page.goto("/pipeline");
  expect(await page.locator("header.top").evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(200);
  const top = await page.locator("header.top").evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBe(0);
});

test("the theme chip is a symbol with no keycap (the key lives in its tooltip)", async ({ page }) => {
  await page.goto(HOME);
  const chip = page.locator("[data-theme-chip]");
  expect((await chip.innerText()).trim()).toBe("");
  expect(await chip.locator(".kbd").evaluate((el) => getComputedStyle(el).display)).toBe("none");
  expect(await chip.getAttribute("title")).toMatch(/⇧T/);
});

test("links carry no underline at rest and a dotted one on hover", async ({ page }) => {
  await page.goto("/synergistic-funders");
  const a = page.locator(".ph-lede a").first();
  expect(await a.evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe("none");
  await a.hover();
  const cs = await a.evaluate((el) => [getComputedStyle(el).textDecorationLine, getComputedStyle(el).textDecorationStyle]);
  expect(cs).toEqual(["underline", "dotted"]);
});

test("the Pipeline dropdowns sit on one line and never offer an empty option", async ({ page }) => {
  await page.goto("/pipeline");
  const tops = await page.locator(".frow.sels .fsel").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(tops.length).toBeGreaterThan(3);
  expect(new Set(tops).size).toBe(1);
  // every offered Signal option yields at least one card
  const opts = await page.locator('select[aria-label="Signal"] option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
  for (const v of opts) {
    await page.locator('select[aria-label="Signal"]').selectOption(v);
    expect(await page.locator("article.dossier, .list article").count(), `signal ${v}`).toBeGreaterThan(0);
  }
});

test("moving one weight rebalances the others and lights Save", async ({ page }) => {
  await page.goto("/settings?s=scoring");
  const slider = page.getByRole("slider", { name: "Thesis fit" });
  const before = await slider.inputValue();
  await slider.fill(String(Number(before) + 3));
  await expect(page.locator('[data-testid="weights-total"] b')).toHaveText("100");
  const save = page.locator("button", { hasText: "Save Changes" });
  await expect(save).toBeEnabled();
  await page.locator("button", { hasText: "Discard" }).click();
});

test("the removed features and words are gone", async ({ page }) => {
  for (const path of [HOME, "/about", "/company/3", "/culture"]) {
    await page.goto(path);
    const text = await page.locator("body").innerText();
    expect(text, path).not.toMatch(/Flag a UI problem|No payments|non-commercial|Newest first|&#\d+;|&amp;/i);
  }
  await page.goto(HOME);
  await expect(page.locator("footer.foot a", { hasText: "Settings" })).toBeVisible();
  await expect(page.locator("footer.foot a", { hasText: "About" })).toBeVisible();
  await expect(page.locator("nav.nav a", { hasText: "IC Meeting" })).toBeVisible();
  await page.goto("/about");
  await expect(page.locator("[data-talk]").first()).toBeVisible();
});
