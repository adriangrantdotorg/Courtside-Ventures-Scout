import { test, expect } from "@playwright/test";
import { HOME, LIVE, ready } from "./pages";

test.describe("controls are real", () => {
  test.skip(LIVE, "writes or long holds run locally only");

  test("Settings: slider and number stay in sync; a moved weight rebalances to 100; search clears", async ({ page }) => {
    await page.goto("/settings?s=scoring");
    await expect(page.getByRole("textbox", { name: "Search every setting and shortcut" })).toBeFocused();
    const num = page.getByRole("textbox", { name: "Thesis fit value" });
    const slider = page.getByRole("slider", { name: "Thesis fit" });
    await num.fill("29");
    await num.press("Enter");
    await expect(slider).toHaveValue("29");
    await expect(page.getByTestId("weights-total")).toContainText("100");
    await expect(page.getByRole("button", { name: /Save Changes/ })).toBeEnabled();
    await slider.fill("31");
    await expect(num).toHaveValue("31");
    await page.getByRole("button", { name: /Discard/ }).click();
    // the clear control shows only with text; typing anywhere goes to the search field
    const s = page.getByRole("textbox", { name: "Search every setting and shortcut" });
    await page.locator(".pane h2").click();
    await expect(page.locator(".pgh .clear-x")).toBeHidden();
    await page.keyboard.type("slack");
    await expect(page.locator(".pgh .clear-x")).toBeVisible();
    await page.locator(".pgh .clear-x").click();
    await expect(s).toHaveValue("");
    await expect(s).toBeFocused();
  });

  test("Settings: a switch flips on click and on Space", async ({ page }) => {
    await page.goto("/settings?s=sources");
    const t = page.getByRole("switch", { name: "Extra sources" });
    const v = await t.getAttribute("aria-checked");
    await t.click();
    await expect(t).not.toHaveAttribute("aria-checked", v!);
    await t.focus();
    await page.keyboard.press(" ");
    await expect(t).toHaveAttribute("aria-checked", v!);
  });

  test("Backtest: type a name, press Enter, the three-step flow starts", async ({ page }) => {
    await page.goto("/backtest");
    await page.getByTestId("backtest-input").fill("Fanstake");
    await page.getByTestId("backtest-input").press("Enter");
    await expect(page.getByTestId("backtest-steps").locator(".run, .wait").first()).toBeVisible({ timeout: 3000 });
  });

  test("Board: drag a card to Reached Out; counts change; Undo puts it back", async ({ page }) => {
    await page.goto("/pipeline?view=board");
    await page.getByRole("button", { name: /Board/ }).click();
    const card = page.locator('[data-col="new"] .mini').first();
    const name = (await card.locator(".nm").innerText()).trim();
    const count = async (s: string) => Number(await page.locator(`[data-col="${s}"] .col-h b`).innerText());
    const n0 = await count("reached");
    await card.dragTo(page.locator('[data-col="reached"]'));
    await expect(page.getByTestId("toast").filter({ hasText: "Moved to Reached Out" })).toBeVisible();
    expect(await count("reached")).toBe(n0 + 1);
    await page.keyboard.press("Meta+z");
    await expect.poll(() => count("reached")).toBe(n0);
    expect(name.length).toBeGreaterThan(0);
  });

  test("a vote counts for another visitor, and undoes", async ({ browser }) => {
    const a = await browser.newContext();
    const b = await browser.newContext();
    const pa = await a.newPage();
    const pb = await b.newPage();
    await pa.goto("/pipeline");
    await ready(pa);
    await pa.waitForLoadState("networkidle"); // the live counts have loaded
    // the last row: the click tests press the first rows' votes on the same server at the same time
    const key = await pa.locator("[data-vote]").last().getAttribute("data-vote");
    const vA = pa.locator(`[data-vote="${key}"]`).first();
    const start = Number(await vA.getByTestId("vote-count").innerText());
    await vA.locator("[data-act=up]").click();
    await expect(vA.getByTestId("vote-count")).toHaveText(String(start + 1), { timeout: 300 });
    await pa.waitForTimeout(800);
    await pb.goto("/pipeline");
    await ready(pb);
    const vB = pb.locator(`[data-vote="${key}"]`).first();
    await expect(vB.getByTestId("vote-count")).toHaveText(String(start + 1));
    await vB.locator("[data-act=up]").click();
    await expect(vB.getByTestId("vote-count")).toHaveText(String(start + 2));
    await pb.waitForTimeout(800);
    await pa.reload();
    await ready(pa);
    await expect(pa.locator(`[data-vote="${key}"]`).first().getByTestId("vote-count")).toHaveText(String(start + 2));
    await pa.locator(`[data-vote="${key}"]`).first().locator("[data-act=up]").click();
    await expect(pa.locator(`[data-vote="${key}"]`).first().getByTestId("vote-count")).toHaveText(String(start + 1));
    await a.close();
    await b.close();
  });

  test("a vote reverts on a server error", async ({ page }) => {
    await page.route("**/api/vote", (r) => r.fulfill({ status: 500, body: "{}" }));
    const batch = page.waitForResponse((r) => r.url().includes("/api/votes"));
    await page.goto("/pipeline");
    await batch; // the live counts land before the start value is read (the cached page can carry an older count)
    const v = page.locator("[data-vote]").first();
    const start = await v.getByTestId("vote-count").innerText();
    await v.locator("[data-act=up]").click();
    await expect(page.getByTestId("error-card")).toBeVisible();
    await expect(v.getByTestId("vote-count")).toHaveText(start);
  });

  test("core shortcuts: j k, ⌘K, ?, /, Esc; never while typing", async ({ page }) => {
    await page.goto("/pipeline");
    await page.locator("body").click({ position: { x: 5, y: 300 } });
    await page.keyboard.press("j");
    await expect(page.locator("[data-item].focused")).toHaveCount(1);
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    await expect(page.locator("[data-item].focused")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await page.keyboard.press("?");
    await expect(page.getByTestId("sheet")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("sheet")).toHaveCount(0);
    await page.keyboard.press("Meta+k");
    await expect(page.getByTestId("palette")).toBeVisible();
    await page.keyboard.type("moch");
    await expect(page.locator(".pal-it mark").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("/");
    await expect(page.locator("main [data-search]")).toBeFocused();
    await page.keyboard.type("jk?");
    await expect(page.getByTestId("sheet")).toHaveCount(0);
  });

  test("the Building page never reloads itself, keeps its fonts, and its clock ticks", async ({ page }) => {
    test.setTimeout(100_000);
    let navs = 0;
    let fonts = 0;
    page.on("request", (r) => r.resourceType() === "document" && navs++);
    page.on("request", (r) => r.url().includes("fonts.g") && r.url().includes("css") && fonts++);
    await page.goto("/");
    const b = page.getByTestId("building");
    if (!(await b.count())) test.skip(true, "the build is done; the Building page is off");
    const t1 = await page.getByTestId("since").innerText();
    await page.waitForTimeout(2100);
    expect(await page.getByTestId("since").innerText()).not.toBe(t1);
    await page.waitForTimeout(63_000);
    expect(navs).toBe(1);
    expect(fonts).toBeLessThanOrEqual(1);
  });

  test("live values never move their neighbours", async ({ page }) => {
    await page.clock.install();
    await page.goto(HOME);
    const slot = page.locator(".mast [data-live]").first();
    await expect(slot).toBeVisible();
    const w0 = await page.locator(".mast .right").evaluate((e) => [...e.children].map((c) => c.getBoundingClientRect().width));
    await page.clock.fastForward(31_000);
    const w1 = await page.locator(".mast .right").evaluate((e) => [...e.children].map((c) => c.getBoundingClientRect().width));
    expect(w1).toEqual(w0);
  });
});
