import { test, expect } from "@playwright/test";
import { HOME, ready } from "./pages";

// Quick fixes (11-05-26): Find Startups in This Trend, Brand Sky's drift, the pressed view, the Phase II dialog.

test("Trends: Find Startups in This Trend searches the trend's idea, never the first word of its id", async ({ page }) => {
  await page.goto("/trends");
  await ready(page);
  const links = page.getByRole("link", { name: "Find Startups in This Trend" });
  const n = await links.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const a = links.nth(i);
    const id = await a.evaluate((el) => el.closest("article[id]")?.id || "");
    const q = new URL((await a.getAttribute("href"))!, "http://x").searchParams.get("q") || "";
    expect(q.length, `${id}: searches something`).toBeGreaterThan(0);
    if (id.includes("-")) expect(q.toLowerCase(), `${id}: not just its first word`).not.toBe(id.split("-")[0]);
  }
});

test("Brand Sky: the drifting picture never shows the page behind it", async ({ page }) => {
  await page.goto(HOME);
  await ready(page);
  const gap = await page.evaluate(() => {
    const sky = document.createElement("div");
    sky.className = "x-sky";
    sky.style.cssText = "position:relative;width:900px;height:320px";
    const art = document.createElement("img");
    art.className = "x-skyart x-drift";
    art.src = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
    art.style.animation = "none";
    art.style.transform = "translateX(-12%)"; // the far point of x-skydrift
    sky.appendChild(art);
    document.body.appendChild(sky);
    const gap = sky.getBoundingClientRect().right - art.getBoundingClientRect().right;
    sky.remove();
    return gap;
  });
  expect(gap).toBeLessThanOrEqual(0);
});

test("Must See's Brand Sky picture stands still; the drift is kept for every other Brand Sky", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(HOME);
  await ready(page);
  const names = await page.evaluate(() => {
    const make = (inHero: boolean) => {
      const sky = document.createElement("div");
      sky.className = "x-sky";
      const art = document.createElement("img");
      art.className = "x-skyart x-drift";
      sky.appendChild(art);
      const host = document.createElement("article");
      if (inHero) host.className = "x-tile hero";
      host.appendChild(sky);
      document.body.appendChild(host);
      const n = getComputedStyle(art).animationName;
      host.remove();
      return n;
    };
    return { hero: make(true), other: make(false) };
  });
  expect(names).toEqual({ hero: "none", other: "x-skydrift" });
  // and the real Must See, when today's startup draws Brand Sky
  for (const el of await page.locator(".x-tile.hero .x-sky .x-drift").all()) expect(await el.evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
});

test("the List / Board toggle: the pressed view is a plain fill, no frame inside the pill", async ({ page }) => {
  await page.goto("/pipeline");
  await ready(page);
  const pressed = page.locator('.views [aria-pressed="true"]').first();
  await expect(pressed).toBeVisible();
  expect(await pressed.evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");
});

test("the Phase II dialog: the footnote on its own line, Cancel and Talk to Adrian side by side under it", async ({ page }) => {
  for (const width of [1440, 900]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/tracking");
    await ready(page);
    await page.locator(".lock-chip").first().click();
    const door = page.getByTestId("door");
    await expect(door).toBeVisible();
    const [note, cancel, talk] = await Promise.all([door.locator(".why2"), door.getByRole("button", { name: /Cancel/ }), door.locator("[data-talk]")].map((l) => l.boundingBox()));
    expect(Math.abs(cancel!.y - talk!.y), `${width}px: the two buttons share a row`).toBeLessThan(2);
    expect(cancel!.y, `${width}px: the buttons sit under the footnote`).toBeGreaterThanOrEqual(note!.y + note!.height - 1);
    await page.keyboard.press("Escape");
    await expect(door).toHaveCount(0);
  }
});
