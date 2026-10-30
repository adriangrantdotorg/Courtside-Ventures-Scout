import { test, expect } from "@playwright/test";
import { HOME, LIVE, ready } from "./pages";

// Scout V2 (10-26-26): every picked design, pressed or measured. Decisions: design/v2/NOTES.md.

test("Today is only about companies: Must See, The Combine, then On the Radar with its filter", async ({ page }) => {
  await page.goto(HOME);
  await ready(page);
  const heads = (await page.locator("main .x-h2").allInnerTexts()).map((t) => t.trim().toLowerCase());
  expect(heads).toEqual(["must see", "the combine", "on the radar"]);
  await expect(page.locator("main")).toContainText("The Highest Thesis-Fit Startup Recently in the News");
  await expect(page.locator("main")).toContainText("(Top 10 Startups by Thesis Fit · Updated Daily)");
  for (const gone of ["Velocity", "Sponsor Radar", "Top Picks Today", "Culture", "Throw Some D's on It", "Spotlight"]) await expect(page.locator("main h2", { hasText: gone })).toHaveCount(0);
  // the filter sits under the On the Radar heading
  const radarHead = await page.locator(".x-h2", { hasText: "On the Radar" }).evaluate((el) => el.getBoundingClientRect().bottom);
  const filterTop = await page.locator("#fbar").evaluate((el) => el.getBoundingClientRect().top);
  expect(filterTop).toBeGreaterThan(radarHead);
  // The Combine: ten rows, highest fit first, each with Funds Raised
  const fits = (await page.locator(".x-race .x-rr .x-rtrack b").allInnerTexts()).map((t) => parseInt(t));
  expect(fits.length).toBeGreaterThan(0);
  expect(fits.length).toBeLessThanOrEqual(10);
  expect([...fits].sort((a, b) => b - a)).toEqual(fits);
  expect(await page.locator(".x-race .x-rr .x-rfund").count()).toBe(fits.length);
});

test("Must See shows no website button with no official site, and no Funds Raised when unknown", async ({ page }) => {
  await page.goto(HOME);
  await ready(page);
  const hero = page.locator(".x-tile.hero");
  await expect(hero).toHaveCount(1);
  const funds = hero.locator(".x-funds");
  if (await funds.count()) await expect(funds.locator(".x-amt")).not.toHaveText("Unknown");
  await expect(hero.locator(".x-web.search, .x-btn.site.find")).toHaveCount(0);
  // More sits before the votes, and every menu item stays inside the card
  const order = await hero.locator(".x-acts > *").evaluateAll((els) => els.map((e) => (e.matches(".x-votes") ? "votes" : e.matches(".x-pop") ? "more" : (e.textContent || "").trim())));
  expect(order.indexOf("more")).toBeLessThan(order.indexOf("votes"));
  await hero.locator(".x-more").click();
  const box = hero.locator(".x-menu");
  await expect(box).toBeVisible();
  const [b, c] = await Promise.all([box.boundingBox(), hero.boundingBox()]);
  expect(b!.y).toBeGreaterThanOrEqual(c!.y - 1);
  expect(b!.y + b!.height).toBeLessThanOrEqual(c!.y + c!.height + 1);
  await page.keyboard.press("Escape");
  await expect(box).toBeHidden();
});

test("Must See with no product picture draws Brand Sky: the startup's mark in the open sky, clear of the words, never a gray letter", async ({ page }) => {
  // Adrian, 10-30-26: Helios showed a gray "H"; Brand Sky (src/lib/brand.ts) always has a backdrop and a mark
  await page.goto(HOME);
  await ready(page);
  const hero = page.locator(".x-tile.hero");
  await expect(hero.locator(".logostage, .monogram")).toHaveCount(0);
  const sky = hero.locator(".x-sky");
  if (!(await sky.count())) {
    await expect(hero.locator(".x-media img.cover, .x-media video.cover, .x-media .shots").first()).toBeVisible(); // a real product picture
    return;
  }
  expect(["1", "2", "3"]).toContain(await sky.getAttribute("data-tier"));
  const mark = sky.locator(".x-skymark");
  await expect(mark).toBeVisible();
  // decode() resolves only for an image that really loaded (an SVG logo with no size of its own reports naturalWidth 0)
  for (const img of await sky.locator("img").all()) expect(await img.evaluate((el: HTMLImageElement) => el.decode().then(() => true, () => false)), `${await img.getAttribute("src")} loads`).toBe(true);
  // what is drawn: a logo's picture inside its box (object-fit: contain), and the words' own lines, not their blocks
  const drawn = await page.evaluate(() => {
    const r = (x: DOMRect) => ({ x: x.left, y: x.top, w: x.width, h: x.height });
    const mk = document.querySelector(".x-tile.hero .x-skymark") as HTMLElement;
    let m = r(mk.getBoundingClientRect());
    if (mk instanceof HTMLImageElement && mk.naturalWidth && mk.naturalHeight) {
      const k = Math.min(m.w / mk.naturalWidth, m.h / mk.naturalHeight);
      const w = mk.naturalWidth * k, h = mk.naturalHeight * k;
      m = { x: m.x + (m.w - w) / 2, y: m.y + (m.h - h) / 2, w, h };
    }
    const words: { sel: string; x: number; y: number; w: number; h: number }[] = [];
    for (const el of document.querySelectorAll(".x-tile.hero .x-name, .x-tile.hero .x-why, .x-tile.hero .x-tags > *")) {
      const range = document.createRange();
      range.selectNodeContents(el);
      for (const rc of range.getClientRects()) words.push({ sel: el.className || el.tagName, ...r(rc) });
    }
    return { m, sky: r(document.querySelector(".x-tile.hero .x-sky")!.getBoundingClientRect()), words };
  });
  const { m, sky: box, words } = drawn;
  expect(m.x).toBeGreaterThanOrEqual(box.x);
  expect(m.x + m.w).toBeLessThanOrEqual(box.x + box.w + 1);
  for (const t of words) {
    const overlap = Math.max(0, Math.min(m.x + m.w, t.x + t.w) - Math.max(m.x, t.x)) * Math.max(0, Math.min(m.y + m.h, t.y + t.h) - Math.max(m.y, t.y));
    expect(overlap, `the mark covers ${t.sel}`).toBe(0);
  }
});

test("Must See on a phone: the name, the fit ring and the buttons never sit on each other (10-30-26)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(HOME);
  await ready(page);
  const hero = page.locator(".x-tile.hero");
  await expect(hero.locator(".x-name")).toBeVisible();
  const boxes: (readonly [string, { x: number; y: number; width: number; height: number } | null])[] = await Promise.all([".x-tl .x-fit", ".x-tr .x-web", ".x-name", ".x-acts", ".x-tags"].map(async (sel) => [sel, await hero.locator(sel).first().boundingBox()] as const));
  // Brand Sky's mark as drawn (a logo's picture inside its box), clear of the fit ring and the globe too
  const mark = await page.evaluate(() => {
    const mk = document.querySelector(".x-tile.hero .x-skymark");
    if (!mk) return null;
    const r = mk.getBoundingClientRect();
    if (mk instanceof HTMLImageElement && mk.naturalWidth && mk.naturalHeight) {
      const k = Math.min(r.width / mk.naturalWidth, r.height / mk.naturalHeight);
      const w = mk.naturalWidth * k, h = mk.naturalHeight * k;
      return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, width: w, height: h };
    }
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });
  if (mark) boxes.push([".x-skymark", mark]);
  const card = (await hero.boundingBox())!;
  for (const [sel, b] of boxes) {
    if (sel === ".x-tr .x-web" && !b) continue; // no official site, no globe
    expect(b, sel).not.toBeNull();
    expect(b!.y + b!.height, `${sel} stays inside the card`).toBeLessThanOrEqual(card.y + card.height + 1);
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const [sa, a] = boxes[i], [sb, b] = boxes[j];
      if (!a || !b) continue;
      const overlap = Math.max(0, Math.min(a!.x + a!.width, b!.x + b!.width) - Math.max(a!.x, b!.x)) * Math.max(0, Math.min(a!.y + a!.height, b!.y + b!.height) - Math.max(a!.y, b!.y));
      expect(overlap, `${sa} and ${sb} overlap`).toBe(0);
    }
});

test("On the Radar: a card with no product picture draws Brand Sky, its mark clear of the fit ring, globe and words (10-30-26)", async ({ page }) => {
  await page.goto(HOME);
  await ready(page);
  await expect(page.locator("#radar .x-tile .logostage")).toHaveCount(0);
  const found = await page.evaluate(() => {
    const draw = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (el instanceof HTMLImageElement && el.naturalWidth && el.naturalHeight) {
        const k = Math.min(r.width / el.naturalWidth, r.height / el.naturalHeight);
        const w = el.naturalWidth * k, h = el.naturalHeight * k;
        return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w, h };
      }
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    };
    const hit = (a: ReturnType<typeof draw>, b: ReturnType<typeof draw>) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const bad: string[] = [];
    const tiles = [...document.querySelectorAll("#radar .x-tile")].filter((t) => t.querySelector(".x-sky"));
    for (const t of tiles) {
      const mk = t.querySelector(".x-skymark");
      if (!mk) {
        bad.push(`${t.getAttribute("aria-label")}: no mark`);
        continue;
      }
      const m = draw(mk);
      const others = [t.querySelector(".x-tl .x-fit"), t.querySelector(".x-tr > *"), ...t.querySelectorAll(".x-over .x-name, .x-over .x-tags > *, .x-over .x-funds")].filter(Boolean) as Element[];
      for (const o of others) if (hit(m, draw(o)) > 0) bad.push(`${t.getAttribute("aria-label")}: mark covers ${o.className}`);
    }
    return { count: tiles.length, bad };
  });
  expect(found.bad).toEqual([]);
  test.info().annotations.push({ type: "Brand Sky cards", description: String(found.count) });
});

test("On the Radar: the Dropdown Bar filters the tiles, and Clear Filters brings them back", async ({ page }) => {
  await page.goto(HOME);
  await ready(page);
  const tiles = page.locator("#radar .x-tile");
  const total = Number((await page.locator("[data-count]").innerText()).match(/of (\d+)/)![1]);
  expect(total).toBeGreaterThan(0);
  // the hover label
  await tiles.first().hover();
  await expect(tiles.first().locator(".x-hov")).toContainText("Click to View More Details");
  await expect.poll(() => tiles.first().locator(".x-hov").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  // Category
  await page.locator(".x-ddbtn", { hasText: "Category" }).click();
  const opt = page.locator(".x-ddmenu button").nth(1);
  const label = (await opt.locator("span").innerText()).trim();
  const n = Number(await opt.locator("b").innerText());
  await opt.click();
  await expect(page.locator(".x-ddbtn", { hasText: "Category" }).locator("[data-shown]")).toHaveText(label);
  await expect(page.locator("[data-count]")).toHaveText(`${n} of ${total} Companies`);
  for (const a of await tiles.locator(".x-area").allInnerTexts()) expect(a.toLowerCase()).toBe(label.toLowerCase());
  // the toggles
  await page.locator(".x-chip", { hasText: "50%+ Fit" }).click();
  for (const f of await tiles.locator(".x-fit b").allInnerTexts()) expect(parseInt(f)).toBeGreaterThanOrEqual(50);
  await page.locator(".x-fclear").click();
  await expect(page.locator("[data-count]")).toHaveText(`${total} of ${total} Companies`);
  // Funds Raised offers only ranges that have companies
  await page.locator(".x-ddbtn", { hasText: "Funds Raised" }).click();
  for (const k of await page.locator(".x-ddmenu button b").allInnerTexts()) expect(Number(k)).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
});

test("a tile opens its company page; its own buttons and links don't", async ({ page }) => {
  await page.goto(HOME);
  await ready(page);
  const tile = page.locator("#radar .x-tile").first();
  const id = await tile.getAttribute("data-company");
  const web = tile.locator(".x-web");
  await expect(web).toHaveAttribute("target", "_blank");
  await expect(web).toHaveAttribute("aria-label", /^(Visit Website|Find Website)/);
  await tile.locator(".x-tags").click({ position: { x: 2, y: 2 } });
  await expect(page).toHaveURL(new RegExp(`/company/${id}$`));
  await expect(page.locator("h1.x-dname")).toBeVisible();
});

test("the Pipeline: Tile rows sorted by fit, one row of menus, Category replaces Status, no area chips", async ({ page }) => {
  await page.goto("/pipeline");
  await ready(page);
  const labels = await page.locator(".x-pfilters .fsel").evaluateAll((els) => els.map((e) => (e.firstChild?.textContent || "").trim())); // textContent: CSS uppercase would hide the real casing
  expect(labels).toEqual(["Funds Raised", "Category", "Fit", "Signal", "Seen", "Rating"]);
  await expect(page.locator(".lanes, .lane-chip")).toHaveCount(0);
  const fits = (await page.locator("#prows .x-row .x-key .x-fit b").allInnerTexts()).map((t) => parseInt(t));
  expect([...fits].sort((a, b) => b - a)).toEqual(fits);
  // Visit Website is red; Find Website is dashed and never red
  const visit = page.locator("#prows .x-btn.site.cta").first();
  if (await visit.count()) expect(await visit.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(204, 0, 61)");
  const find = page.locator("#prows .x-btn.site.find").first();
  if (await find.count()) expect(await find.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe("dashed");
  await expect(page.locator("#prows .x-web")).toHaveCount(0);
  // the Category menu filters the rows
  const sel = page.locator('select[aria-label="Category"]');
  const v = await sel.locator("option").nth(1).getAttribute("value");
  await sel.selectOption(v!);
  const name = (await sel.locator(`option[value="${v}"]`).innerText()).trim().toLowerCase();
  for (const a of await page.locator("#prows .x-row .x-area").allInnerTexts()) expect(a.toLowerCase()).toBe(name);
});

test("signals and sources open in place, and a long list scrolls inside its popover", async ({ page }) => {
  await page.goto("/pipeline");
  await ready(page);
  const sig = page.locator("#prows .x-sigbtn").first();
  if (await sig.count()) {
    await sig.click();
    const list = page.locator(".x-siglist:visible");
    await expect(list).toBeVisible();
    expect(await list.locator("li").count()).toBeGreaterThan(1);
    const r = await list.boundingBox();
    expect(r!.y).toBeGreaterThanOrEqual(0);
    expect(r!.height).toBeLessThanOrEqual(Math.max(440, 900 * 0.62) + 2);
    await page.keyboard.press("Escape");
    await expect(list).toHaveCount(0);
  }
  const src = page.locator("#prows .x-srcbtn").first();
  if (await src.count()) {
    await src.click();
    await expect(page.locator(".x-popbox:visible")).toContainText("Where This Number Comes From");
    await page.locator("body").click({ position: { x: 3, y: 300 } });
    await expect(page.locator(".x-popbox:visible")).toHaveCount(0);
  }
});

test("secondary buttons share one look sitewide: Track, More and View Details", async ({ page }) => {
  const looks = new Set<string>();
  for (const p of [HOME, "/pipeline"]) {
    await page.goto(p);
    await ready(page);
    for (const s of ['.x-track[aria-pressed="false"]', ".x-more", "a.x-btn.ghost"]) {
      const el = page.locator(s).first();
      if (await el.count()) looks.add(await el.evaluate((e) => { const c = getComputedStyle(e); return [c.backgroundColor, c.borderTopColor, c.color].join("|"); }));
    }
  }
  expect([...looks]).toHaveLength(1);
});

test("the Pipeline and the company page: no gray logo tile; Brand Sky's mark sits inside the picture, clear of the words (10-30-26)", async ({ page }) => {
  await page.goto("/pipeline");
  await ready(page);
  await expect(page.locator(".x-row .logostage")).toHaveCount(0);
  const check = (scope: string) =>
    page.evaluate((scope) => {
      const draw = (el: Element) => {
        const r = el.getBoundingClientRect();
        if (el instanceof HTMLImageElement && el.naturalWidth && el.naturalHeight) {
          const k = Math.min(r.width / el.naturalWidth, r.height / el.naturalHeight);
          const w = el.naturalWidth * k, h = el.naturalHeight * k;
          return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w, h };
        }
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      };
      const bad: string[] = [];
      const skies = [...document.querySelectorAll(`${scope} .x-sky`)];
      for (const sky of skies) {
        const mk = sky.querySelector(".x-skymark");
        if (!mk) {
          bad.push("no mark");
          continue;
        }
        const name = sky.querySelector(".x-skyname");
        if (name) {
          // a word never splits across lines ("Chao / s", 10-30-26): no more lines than words
          const range = document.createRange();
          range.selectNodeContents(name);
          const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
          if (lines > (name.textContent || "").trim().split(/\s+/).length) bad.push(`"${name.textContent}" breaks inside a word`);
        }
        const m = draw(mk), b = draw(sky);
        if (m.x < b.x - 1 || m.x + m.w > b.x + b.w + 1 || m.y < b.y - 1 || m.y + m.h > b.y + b.h + 1) bad.push(`mark outside its picture (${mk.className})`);
        const row = sky.closest(".x-row");
        for (const el of row ? row.querySelectorAll(".x-bover .x-name, .x-bover .x-why, .x-bover .x-tags > *") : []) {
          const range = document.createRange();
          range.selectNodeContents(el);
          for (const t of range.getClientRects())
            if (Math.max(0, Math.min(m.x + m.w, t.right) - Math.max(m.x, t.left)) * Math.max(0, Math.min(m.y + m.h, t.bottom) - Math.max(m.y, t.top)) > 0) bad.push(`mark covers ${el.className}`);
        }
      }
      return { count: skies.length, bad };
    }, scope);
  const rows = await check(".x-row");
  expect(rows.bad).toEqual([]);
  if (!rows.count) return; // nothing without a product picture today
  // the company page of a row drawn with Brand Sky
  await page.locator(".x-row:has(.x-sky) .x-name a").first().click();
  await page.waitForURL(/\/company\/\d+/);
  await ready(page);
  await expect(page.locator(".x-dmedia .logostage")).toHaveCount(0);
  await expect(page.locator(".x-dmedia .x-sky")).toHaveCount(1);
  expect((await check(".x-dmedia")).bad).toEqual([]);
});

test("the company page is the Deal Sheet: fit and Funds Raised lead, one red button", async ({ page }) => {
  await page.goto("/pipeline");
  await ready(page);
  const href = await page.locator("#prows .x-row .x-name a").first().getAttribute("href");
  await page.goto(href!);
  await expect(page.locator(".x-deal .x-fit.xl")).toBeVisible();
  await expect(page.locator(".x-deal .x-funds.xxl .x-amt")).toBeVisible();
  await expect(page.locator(".x-deal .x-bars .x-bar")).toHaveCount(6);
  expect(await page.locator("main .x-btn.site.cta").count()).toBeLessThanOrEqual(1);
  const red = await page.locator("main .btn, main .x-btn").evaluateAll((els) => els.filter((e) => getComputedStyle(e).backgroundColor === "rgb(204, 0, 61)" && !e.matches(".x-btn.site.cta")).map((e) => e.textContent));
  expect(red).toEqual([]);
  for (const s of ["Team Notes", "Draft Investment Memo", "Record"]) await expect(page.locator(`section[aria-label="${s}"]`)).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/Not Yet Public|\bNear [A-Z]/);
});

test("the on-site player opens with Pause, Mute and Close, and Esc closes it", async ({ page }) => {
  for (const p of [HOME, "/pipeline"]) {
    await page.goto(p);
    await ready(page);
    const play = page.locator("main .x-play").first();
    if (!(await play.count())) continue;
    await expect(play).toHaveText(/^Play /);
    await play.click();
    const th = page.getByTestId("theater");
    await expect(th).toBeVisible();
    await expect(th.locator(".x-thplay")).toBeVisible();
    await expect(th.locator(".x-thsound")).toBeVisible();
    await expect(th.locator("iframe, video")).toHaveCount(1);
    const src = await th.locator("iframe, video").first().getAttribute("src");
    expect(src || "").not.toMatch(/^https:\/\/(www\.)?youtube\.com/); // YouTube plays through youtube-nocookie inside Scout
    await page.keyboard.press("Escape");
    await expect(th).toHaveCount(0);
    return;
  }
  test.skip(true, "no company has a video yet");
});

test("no full-screen buttons, Title Case labels, Unknown never Not Yet Public", async ({ page }) => {
  for (const p of [HOME, "/pipeline", "/brief", "/tracking"]) {
    await page.goto(p);
    await ready(page);
    expect(await page.locator("main button", { hasText: /full ?screen/i }).count(), p).toBe(0);
    await expect(page.locator("main")).not.toContainText(/Not Yet Public|Visit website|Find website/);
  }
});

test("IC Meeting: the Top 5 are Tile rows, and one story is one entry", async ({ page }) => {
  await page.goto("/brief");
  const rows = page.locator(".x-rows.brief .x-row");
  expect(await rows.count()).toBeGreaterThan(0);
  expect(await rows.count()).toBeLessThanOrEqual(5);
  await expect(page.locator("#startups")).toHaveText("Top 5 Startups This Week");
  const titles = await page.locator("#neighborhood + ul > li > a").allInnerTexts();
  expect(new Set(titles).size).toBe(titles.length);
});

test("Tracking: tracked companies are Tile rows that say Tracking", async ({ page }) => {
  await page.goto("/tracking");
  const rows = page.locator("#panel-companies .x-row");
  if (await rows.count()) await expect(rows.first().locator(".x-track")).toHaveText("Tracking");
});

test("the logo and the current page's nav link scroll back to the top", async ({ page }) => {
  await page.goto("/pipeline");
  await ready(page);
  await page.mouse.wheel(0, 2400);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(400);
  await page.locator("nav.nav a", { hasText: "Pipeline" }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(5);
  await page.goto("/");
  await ready(page);
  await page.mouse.wheel(0, 2400);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(400);
  await page.locator("a.brand").click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(5);
});

test("Settings › Hidden Startups lists what the startup filter keeps off, with Restore", async ({ page }) => {
  test.skip(LIVE, "the list loads from the shared database");
  await page.goto("/settings?s=hidden");
  await expect(page.locator('[data-card="Hidden Startups"]')).toBeVisible();
});

test("the filter bar is one tidy row: nothing overlaps, every control has room", async ({ page }) => {
  await page.goto(HOME);
  await ready(page);
  const boxes = await page.locator(".x-filter.f2 > *").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; }));
  expect(await page.locator(".x-filter.f2").evaluate((el) => getComputedStyle(el).display)).toBe("flex");
  for (let i = 1; i < boxes.length; i++) {
    const a = boxes[i - 1], b = boxes[i];
    if (Math.abs(a.t - b.t) > 20) continue; // the next line
    expect(b.l - a.r, `gap before control ${i}`).toBeGreaterThanOrEqual(8);
  }
});

test("the card hover label sits in the middle of the picture", async ({ page }) => {
  await page.goto(HOME);
  await ready(page);
  const tile = page.locator("#radar .x-tile").first();
  const [lab, pic] = await Promise.all([tile.locator(".x-hov.h1 > span").boundingBox(), tile.locator(".x-tm").boundingBox()]);
  expect(Math.abs(lab!.x + lab!.width / 2 - (pic!.x + pic!.width / 2))).toBeLessThan(12);
  expect(Math.abs(lab!.y + lab!.height / 2 - (pic!.y + pic!.height / 2))).toBeLessThan(12);
});

test("Tracking's rows sit inside the page margins, under the Add row", async ({ page }) => {
  await page.goto("/tracking");
  await ready(page);
  const row = page.locator("#panel-companies .x-row").first();
  if (!(await row.count())) return;
  const [r, add] = await Promise.all([row.boundingBox(), page.locator("#panel-companies .tabadd").boundingBox()]);
  expect(r!.x).toBeGreaterThanOrEqual(add!.x - 1);
  expect(r!.x + r!.width).toBeLessThanOrEqual(add!.x + add!.width + 1);
});

test("Draft the Memo past today's 4 drafts: an error card that stays and points to the outline", async ({ page }) => {
  await page.goto(HOME);
  await ready(page);
  const id = await page.locator("#radar .x-tile").first().getAttribute("data-company");
  await page.goto(`/company/${id}`);
  await ready(page);
  const btn = page.getByRole("button", { name: "Draft the Memo" });
  test.skip(!(await btn.count()), "AI drafting is off on this server");
  // the server's answer once the day's cap is used; mocked, so no AI call is made
  await page.route(`**/api/memo/${id}`, (r) => (r.request().method() === "POST" ? r.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "AI drafting is done for today; copy the outline instead." }) }) : r.continue()));
  await btn.click();
  const card = page.getByTestId("error-card");
  await expect(card).toContainText("Today's AI drafts are used");
  await expect(card).toContainText("copy the outline instead");
  await page.waitForTimeout(6000);
  await expect(card).toBeVisible(); // errors stay until closed
  await expect(btn).toBeEnabled();
});

// Not a Fit (10-26-26): the team hides a stray card in one click. The last row: other tests press the first rows.
const hiddenIds = async (page: import("@playwright/test").Page) => ((await (await page.request.get("/api/hidden")).json()).rows as { id: number; why: string | null }[]).map((r) => `${r.id}:${r.why}`);
const onTop = (el: Element) => {
  const r = el.getBoundingClientRect();
  return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
};

test("Not a Fit: a Pipeline row leaves at once, Settings lists it as hidden by the team, and ⌘Z puts it back", async ({ page }) => {
  test.skip(LIVE, "writes run locally only");
  await page.goto("/pipeline");
  await ready(page);
  const row = page.locator(".x-row").last();
  const id = await row.getAttribute("data-company");
  const name = (await row.locator(".x-name").innerText()).trim();
  await row.locator(".x-more").click();
  const item = row.locator('.x-menu [data-act="notfit"]');
  await expect(item).toHaveText("Not a Fit");
  expect(await item.evaluate(onTop)).toBe(true);
  await item.click();
  await expect(page.locator(`.x-row[data-company="${id}"]`)).toHaveCount(0);
  await expect(page.getByTestId("toast").filter({ hasText: `${name} Hidden` })).toBeVisible();
  expect(await hiddenIds(page)).toContain(`${id}:Hidden by the team`);
  await page.keyboard.press("Meta+z");
  await expect(page.locator(`.x-row[data-company="${id}"]`)).toHaveCount(1);
  await expect.poll(async () => (await hiddenIds(page)).some((r) => r.startsWith(`${id}:`))).toBe(false);
});

test("Not a Fit on a company page: the note says it's hidden, the menu stops offering it, and ⌘Z undoes it", async ({ page }) => {
  test.skip(LIVE, "writes run locally only");
  await page.goto("/pipeline");
  await ready(page);
  const id = await page.locator(".x-row").nth(-2).getAttribute("data-company");
  await page.goto(`/company/${id}`);
  await ready(page);
  const deal = page.locator(".x-deal");
  await deal.locator(".x-more").click();
  await deal.locator('.x-menu [data-act="notfit"]').click();
  await expect(deal.locator(".x-notrec.gone")).toContainText("Hidden from Scout's recommendations.");
  await deal.locator(".x-more").click();
  await expect(deal.locator('.x-menu [data-act="notfit"]')).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Meta+z");
  await expect(deal.locator(".x-notrec.gone")).toHaveCount(0);
  await expect.poll(async () => (await hiddenIds(page)).some((r) => r.startsWith(`${id}:`))).toBe(false);
});
