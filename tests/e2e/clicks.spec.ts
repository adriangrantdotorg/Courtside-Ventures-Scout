import { test, expect } from "@playwright/test";
import { PAGES, LIVE } from "./pages";

// One test per page: press every visible, enabled button and require a visible effect.
const SKIP = /refresh|print|csv|copy|slack|send|delete|remove|reset|undo|run backtest|draft the memo|disconnect|flag a ui|move up|move down|confirm|save|discard|add$|add note|track person|save alert|me too|mark fixed|connection email|email/i;
const SKIP_LIVE = /track|vote|this fits|not for|good call|not useful|worth|convincing|day|night|roomy|compact|normal|large|move to|useful hit|a great source|matters/i;

for (const path of PAGES) {
  test(`click every button on ${path}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(path);
    await page.waitForTimeout(600);
    const handles = (await page.locator("main button:visible").elementHandles()) as import("@playwright/test").ElementHandle<HTMLElement>[];
    const labels: string[] = [];
    for (const h of handles) labels.push(((await h.getAttribute("aria-label")) || (await h.textContent()) || (await h.getAttribute("title")) || "").trim());
    let pressed = 0;
    const dead: string[] = [];
    for (let i = 0; i < handles.length && pressed < 30; i++) {
      const b = handles[i];
      const label = labels[i];
      if (!(await b.isVisible().catch(() => false)) || (await b.isDisabled().catch(() => true))) continue;
      if (SKIP.test(label) || (LIVE && SKIP_LIVE.test(label))) continue;
      if (LIVE && (await b.evaluate((el) => el.getAttribute("role") === "switch" || el.closest(".mini") !== null || el.hasAttribute("data-act")))) continue;
      const inGroup = await b.evaluate((el) => !!el.closest('[role="group"]') && el.getAttribute("aria-pressed") === "true");
      if (inGroup) continue;
      const before = await b.evaluate((el) => ({ p: el.getAttribute("aria-pressed"), e: el.getAttribute("aria-expanded"), c: el.getAttribute("aria-checked") }));
      const url = page.url();
      const html = await page.locator("main").innerHTML();
      let req2xx = false;
      const onResp = (r: { status: () => number; request: () => { method: () => string } }) => {
        if (r.status() < 300 && r.request().method() !== "GET") req2xx = true;
      };
      page.on("response", onResp);
      await b.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
      page.off("response", onResp);
      const gone = !(await b.evaluate((el) => el.isConnected).catch(() => false));
      const after = gone ? null : await b.evaluate((el) => ({ p: el.getAttribute("aria-pressed"), e: el.getAttribute("aria-expanded"), c: el.getAttribute("aria-checked") })).catch(() => null);
      const effect =
        gone ||
        page.url() !== url ||
        (await page.locator(".veil, [data-testid=toast], [data-testid=error-card], [role=tooltip]").count()) > 0 ||
        (after && (after.p !== before.p || after.e !== before.e || after.c !== before.c)) ||
        (await page.locator("main").innerHTML()) !== html ||
        req2xx;
      if (!effect) dead.push(label);
      pressed++;
      if (await page.locator(".veil").count()) await page.keyboard.press("Escape");
      if (page.url() !== url) await page.goto(path);
    }
    expect(dead, `buttons with no visible effect on ${path}`).toEqual([]);
  });
}
