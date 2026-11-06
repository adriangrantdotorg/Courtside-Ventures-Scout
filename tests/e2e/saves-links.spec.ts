import { test, expect } from "@playwright/test";
import { HOME, ready } from "./pages";

// Saves and links (11-06-26).

// A save shows on every page at once: the browser kept its copy of Tracking from before a Track; every save now drops
// those copies (SaveRefresh in Shell.tsx), and a link clicked while that is on its way waits for it.
test("a startup tracked on its page shows on Tracking at once, with no reload", async ({ page }) => {
  test.skip(!!process.env.LIVE_URL, "writes run locally only");
  await page.goto("/tracking"); // the browser now holds a copy of Tracking from before the save
  await ready(page);
  // a startup nobody tracks yet: the first company page whose Track button is off
  let found = 0;
  for (let id = 1; id <= 12 && !found; id++) {
    await page.goto(`/company/${id}`);
    if ((await page.locator('main button[data-act="track"][aria-pressed="false"]').count()) > 0) found = id;
  }
  expect(found, "a company page with Track off").toBeGreaterThan(0);
  await ready(page);
  const btn = page.locator('main button[data-act="track"]').first();
  await expect(btn).toHaveAttribute("aria-pressed", "false");
  const name = ((await btn.getAttribute("title")) || "").replace(/^Track /, "").split(":")[0];
  expect(name).not.toBe("");
  const [saved] = await Promise.all([page.waitForResponse((r) => r.url().includes("/api/track") && r.request().method() === "POST"), btn.click()]);
  expect(saved.status(), `the Track save answered: ${await saved.text()}`).toBe(200);
  await expect(btn).toHaveAttribute("aria-pressed", "true");
  // no grace period: a link clicked while the purge is on its way waits for it
  await page.locator("nav.nav a", { hasText: "Tracking" }).click();
  await expect(page).toHaveURL(/\/tracking/);
  await expect(page.locator("#panel-companies")).toContainText(name);
  // leave the startup as it was: the browser tests share one server
  await page.request.post("/api/track", { data: { kind: "company", id: found, on: false } });
});

// A ticker deal lands on its row, marked: clicked the way a person clicks (an in-app navigation, which never sets
// :target), every ticker link with an address lands on a marked item right under the top bar.
test("every ticker link lands on its item, marked, right under the top bar", async ({ page }) => {
  await page.goto(HOME);
  const hrefs = [...new Set(await page.locator(".ticker .track > a:not([aria-hidden])").evaluateAll((as) => as.map((a) => a.getAttribute("href") || "").filter((h) => h.includes("#"))))];
  expect(hrefs.length, "the ticker has links to items").toBeGreaterThan(0);
  for (const href of hrefs) {
    await page.goto(HOME);
    await ready(page);
    await page.locator(`.ticker .track > a[href="${href}"]`).first().evaluate((a) => (a as HTMLAnchorElement).click());
    await page.waitForURL((u) => u.pathname + u.hash === href);
    const hash = href.split("#")[1];
    const landed = page.locator("[data-landed]");
    await expect(landed, `${href} lands on an item`).toHaveCount(1);
    const at = await landed.evaluate((el) => [el.id, ...(el.getAttribute("data-also") || "").split(" ")]);
    expect(at, `${href} lands on its own item`).toContain(hash);
    const marked = await landed.evaluate((el) => getComputedStyle(el.tagName === "TR" ? el.querySelector("td")! : el).boxShadow);
    expect(marked, `${href}: the landed item wears the edge`).toContain("inset");
    const barBottom = await page.locator("header.top").evaluate((el) => el.getBoundingClientRect().bottom);
    await expect.poll(async () => {
      const top = await landed.evaluate((el) => el.getBoundingClientRect().top);
      const atEnd = await page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 2);
      return top >= barBottom - 1 && (atEnd || top - barBottom < 60);
    }, { message: `${href} scrolls its item right under the top bar` }).toBe(true);
  }
});
