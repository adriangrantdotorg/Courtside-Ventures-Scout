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
    // inside the item (inset), or just outside a list row, which has no side padding (-15px)
    expect(marked, `${href}: the landed item wears the edge`).toMatch(/inset|-15px/);
    const barBottom = await page.locator("header.top").evaluate((el) => el.getBoundingClientRect().bottom);
    await expect.poll(async () => {
      const top = await landed.evaluate((el) => el.getBoundingClientRect().top);
      const atEnd = await page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 2);
      return top >= barBottom - 1 && (atEnd || top - barBottom < 60);
    }, { message: `${href} scrolls its item right under the top bar` }).toBe(true);
  }
});

// 11-06-26 (Adrian, Sponsor Radar's Claude card: "the text is going into the left area"): a list row has no side
// padding, so the mark's red edge sat on its words. On every kind of item a link lands on, the words keep a clear gap
// from the red edge, and the edge stays on screen at phone width.
for (const width of [1440, 390])
  test(`a marked item's words never touch its red edge, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(HOME);
    await ready(page);
    const ticker = await page.locator(".ticker .track > a:not([aria-hidden])").evaluateAll((as) => as.map((a) => a.getAttribute("href") || "").filter((h) => h.includes("#")));
    // one of each kind: the ticker's links, plus the first item of the pages whose rows carry an address
    const pages = ["/sponsors", "/trends", "/culture", "/throw-some-ds", "/backtest"];
    const hrefs = [...new Set(ticker)];
    for (const p of pages) {
      await page.goto(p);
      const id = await page.locator("main [id].rowcard, main article[id], main tr[id]").first().getAttribute("id").catch(() => null);
      if (id) hrefs.push(`${p}#${id}`);
    }
    const bad: string[] = [];
    let checked = 0;
    for (const href of hrefs) {
      await page.goto(href);
      await ready(page);
      const landed = page.locator("[data-landed]");
      if (!(await landed.count())) continue;
      checked++;
      const r = await landed.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const cell = el.tagName === "TR" ? (el.querySelector("td") as HTMLElement) : (el as HTMLElement);
        const sh = getComputedStyle(cell).boxShadow;
        // where the red edge's inner side is: inside the item (inset 3px) or just outside it (drawn at -15px..-12px)
        const edge = /inset/.test(sh) ? box.left + 3 : box.left - 12;
        const outer = /inset/.test(sh) ? box.left : box.left - 15;
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent!.trim() ? 1 : 3) });
        let text = Infinity;
        let n: Node | null;
        while ((n = w.nextNode())) {
          const rg = document.createRange();
          rg.selectNodeContents(n);
          for (const rc of rg.getClientRects()) if (rc.width) text = Math.min(text, rc.left);
        }
        return { kind: `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}`, gap: Math.round(text - edge), outer: Math.round(outer) };
      });
      if (r.gap < 6) bad.push(`${href} (${r.kind}): words ${r.gap}px from the red edge`);
      if (r.outer < 0) bad.push(`${href} (${r.kind}): the red edge runs off the screen`);
    }
    expect(checked, "items to check").toBeGreaterThan(3);
    expect(bad).toEqual([]);
  });
