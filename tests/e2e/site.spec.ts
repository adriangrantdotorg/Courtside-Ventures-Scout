import { test, expect, type Page } from "@playwright/test";
import { PAGES, IGNORE_CONSOLE, HOME } from "./pages";

const BANNED = [/\blanes?\b/i, /\bvoices\b/i, /key insight/i, /context only/i, /\bPre-seed\b/, /\bpretend\b/i, /\bthesis areas?\b/, /\b(pricing|subscribe|upsell|premium|paid tier|hiring|on board)\b/i, /\b(no payments|no ads|non-commercial)\b/i, /Flag a UI problem/i, /&#\d+;|&amp;/];

async function open(page: Page, path: string) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && !IGNORE_CONSOLE.test(m.text()) && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  const r = await page.goto(path);
  expect(r?.status(), path).toBe(200);
  await page.waitForLoadState("domcontentloaded");
  return errors;
}

for (const path of PAGES) {
  test(`page ${path}: renders, words, links, layout`, async ({ page }) => {
    const errors = await open(page, path);
    await page.waitForTimeout(800);
    expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
    const text = await page.locator("body").innerText();
    for (const b of BANNED) expect(text, `${path} shows ${b}`).not.toMatch(b);
    // links: red, no underline at rest (the dotted underline comes on hover, tested in round1.spec); never browser blue
    for (const theme of ["dark", "light"]) {
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
      const bad = await page.evaluate(() => {
        const OPT = "nav a, .ticker a, a.seg, a.btn, a.lane-chip, a.src, a.src2, .evi a, .views a, .brands > a, .sim > a, .faces a, a.brand, .votes a, .toc a, .snav a, .tabbar a, a.pal-it, a.fund-chip, a.nl, .tabmenu a";
        const out: string[] = [];
        document.querySelectorAll("a").forEach((a) => {
          const cs = getComputedStyle(a);
          if (cs.display === "none" || !a.offsetParent) return;
          const opted = a.matches(OPT);
          if (cs.color === "rgb(0, 0, 238)") out.push("blue:" + a.textContent);
          if (cs.textDecorationLine.includes("underline") && !a.matches(".band h2 a")) out.push("underlined at rest:" + a.textContent?.slice(0, 40)); // the Spotlight headline keeps its underline (10-14-26)
          void opted;
        });
        return out.slice(0, 10);
      });
      expect(bad, `${path} ${theme}`).toEqual([]);
    }
    // buttons never carry an X glyph
    const xs = await page.locator("button.btn, .btn").evaluateAll((els) => els.filter((e) => /[✕✖×]/.test(e.textContent || "")).length);
    expect(xs).toBe(0);
    expect(errors, path).toEqual([]);
  });
}

test("nav labels are one line at 1440 and 1024", async ({ page }) => {
  for (const w of [1440, 1024]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto("/pipeline");
    const tall = await page.locator(".nav > a, .nav .dd > button").evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetHeight > 0 && e.getBoundingClientRect().height > 70).map((e) => e.textContent));
    expect(tall, `width ${w}`).toEqual([]);
    const overlap = await page.evaluate(() => {
      const nav = document.querySelector(".nav")!.getBoundingClientRect();
      const tools = document.querySelector(".tools")!.getBoundingClientRect();
      const last = [...document.querySelectorAll(".nav > a, .nav .dd")].pop()!.getBoundingClientRect();
      return last.right > tools.left + 1 && nav.width > 0;
    });
    expect(overlap, `nav overlaps the tools at ${w}`).toBe(false);
  }
});

for (const w of [390, 768, 1440]) {
  test(`no horizontal scroll and no clipped text at ${w}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 900 });
    for (const p of [HOME, "/pipeline", "/company/3", "/settings", "/backtest"]) {
      await page.goto(p);
      await page.waitForTimeout(300);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sw, `${p} at ${w}`).toBeLessThanOrEqual(1);
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll("main p, main h1, main h2, main h3, main .why, main .cdesc, main .cname")]
          .filter((e) => (e as HTMLElement).offsetParent && e.scrollWidth > e.clientWidth + 2)
          .map((e) => e.textContent?.slice(0, 40)),
      );
      expect(clipped, `${p} at ${w}`).toEqual([]);
    }
  });
}

test("a first visit is Night, and the theme chip switches it", async ({ page }) => {
  await page.goto(HOME);
  expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
  await page.locator("[data-theme-chip]").click();
  expect(await page.locator("html").getAttribute("data-theme")).toBe("light");
});

test("phone: the tab bar works and every card action is reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pipeline");
  await expect(page.locator(".tabbar")).toBeVisible();
  await page.locator(".tabbar a", { hasText: "Trends" }).click();
  await expect(page).toHaveURL(/\/trends/);
  await page.goto("/pipeline");
  const acts = page.locator(".t1").first().locator(".acts .btn");
  for (let i = 0; i < (await acts.count()); i++) await expect(acts.nth(i)).toBeInViewport({ ratio: 0.01 }).catch(async () => {
    await acts.nth(i).scrollIntoViewIfNeeded();
    await expect(acts.nth(i)).toBeVisible();
  });
});

test("icons are Courtside's", async ({ request }) => {
  for (const p of ["/icon.png", "/favicon.ico"]) {
    const r = await request.get(p);
    expect(r.status()).toBe(200);
    expect((await r.body()).length).not.toBe(25931);
  }
});

test("every Talk to Adrian opens his LinkedIn in a new window", async ({ page }) => {
  await page.goto("/about");
  const a = page.locator("[data-talk]").first();
  await expect(a).toHaveAttribute("href", "https://www.linkedin.com/in/adriangrant3/");
  await expect(a).toHaveAttribute("target", "_blank");
  await page.goto("/company/3");
  await page.locator(".lock-chip").first().click();
  const door = page.getByTestId("door");
  await expect(door).toBeVisible();
  await expect(door.locator("[data-talk]")).toHaveAttribute("href", "https://www.linkedin.com/in/adriangrant3/");
  await page.keyboard.press("Escape");
  await expect(door).toHaveCount(0);
});

test("external links open in a new window", async ({ page }) => {
  await page.goto("/company/3");
  const bad = await page.evaluate(() => [...document.querySelectorAll("a[href^='http']")].filter((a) => !(a as HTMLAnchorElement).href.startsWith(location.origin) && a.getAttribute("target") !== "_blank").map((a) => a.getAttribute("href")));
  expect(bad).toEqual([]);
});
