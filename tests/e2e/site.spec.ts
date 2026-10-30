import { test, expect, type Page } from "@playwright/test";
import { PAGES, IGNORE_CONSOLE, HOME } from "./pages";

const BANNED = [/\blanes?\b/i, /\bvoices\b/i, /key insight/i, /context only/i, /\bPre-seed\b/, /\bpretend\b/i, /\bthesis areas?\b/, /\b(pricing|subscribe|upsell|premium|paid tier|hiring|on board)\b/i, /\b(no payments|no ads|non-commercial)\b/i, /Flag a UI problem/i, /&#\d+;|&amp;/, /\b(near|close to|next to) [A-Z][^.;]* in the portfolio\b/];

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
    // Scout's own words: quoted episode notes and creators' quotes are someone else's text ("Innovation-based pricing", 10-26-26)
    const text = await page.locator("body").evaluate((b) => {
      const c = b.cloneNode(true) as HTMLElement;
      c.querySelectorAll("blockquote, q, [data-quote]").forEach((q) => q.remove());
      document.body.appendChild(c);
      c.style.cssText = "position:absolute;left:-99999px;top:0";
      const t = c.innerText;
      c.remove();
      return t;
    });
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
          // neutral links in prose carry a quiet dotted underline so they read as links without red (V2, 10-26-26)
          if (cs.textDecorationLine.includes("underline") && !a.matches(".band h2 a, .ph-lede a, .pgh .lede2 a, .doc .main li > a, .doc .main p > a, .x-popbox li > a")) out.push("underlined at rest:" + a.textContent?.slice(0, 40));
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

test("nav labels are one line from 1440 down to 920", async ({ page }) => {
  for (const w of [1440, 1320, 1180, 1024, 920]) {
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
    for (const p of [HOME, "/pipeline", "/company/3", "/settings", "/backtest", "/tracking", "/brief"]) {
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
  const acts = page.locator(".x-row").first().locator(".x-side > *");
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

test("View on GitHub: the top bar and the footer open the public repo in a new window", async ({ page, context }) => {
  const REPO = "https://github.com/adriangrantdotorg/Courtside-Ventures-Scout";
  await context.route("https://github.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>repo</title>" }));
  // the label shortens with the other chips but never disappears (Adrian, 10-30-26: icon + text)
  for (const [w, label] of [[1440, "View on GitHub"], [1180, "GitHub"], [390, "GitHub"]] as const) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto("/pipeline");
    const chip = page.locator(".tools a[data-github]");
    await expect(chip, `width ${w}`).toBeVisible();
    expect((await chip.innerText()).trim().toLowerCase(), `width ${w}`).toBe(label.toLowerCase());
    expect(await chip.locator("svg.gh-mark").boundingBox(), `mark at ${w}`).not.toBeNull();
    const foot = page.locator("footer.foot a[data-github]");
    await expect(foot).toHaveText("View on GitHub");
    await expect(foot.locator("svg.gh-mark")).toBeVisible();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const sel of [".tools a[data-github]", "footer.foot a[data-github]"]) {
    const a = page.locator(sel);
    await expect(a).toHaveAttribute("href", REPO);
    await expect(a).toHaveAttribute("target", "_blank");
    await a.scrollIntoViewIfNeeded();
    const hit = await a.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!top && el.contains(top);
    });
    expect(hit, `${sel} is the thing under its center`).toBe(true);
    const [popup] = await Promise.all([page.waitForEvent("popup"), a.click()]);
    expect(popup.url()).toBe(REPO);
    await popup.close();
  }
});

test("every Talk to Adrian opens his LinkedIn in a new window", async ({ page }) => {
  await page.goto("/about");
  const a = page.locator("[data-talk]").first();
  await expect(a).toHaveAttribute("href", "https://www.linkedin.com/in/adriangrant3/");
  await expect(a).toHaveAttribute("target", "_blank");
  await page.goto("/tracking");
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
