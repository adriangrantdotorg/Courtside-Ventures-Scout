// Every vote on the site reads down on the left, up on the right (11-06-26); a vote stacked in a narrow column keeps up
// on top. One component draws them all (Vote in src/components/cards.tsx); this checks every page that shows one, and a
// phone width, where cards stack.
import { test, expect } from "@playwright/test";
import { PAGES, ready } from "./pages";

for (const width of [1440, 390])
  test(`every vote: down on the left, up on the right (or up on top when stacked), at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    let seen = 0;
    const bad: string[] = [];
    for (const path of PAGES) {
      await page.goto(path);
      await ready(page);
      const found = await page.locator("[data-vote]").evaluateAll((els) =>
        els
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .map((el) => {
            const up = el.querySelector("[data-act=up]")!.getBoundingClientRect();
            const dn = el.querySelector("[data-act=down]")!.getBoundingClientRect();
            const row = Math.abs(up.top + up.height / 2 - (dn.top + dn.height / 2)) < 4;
            return { key: el.getAttribute("data-vote") || "", ok: row ? dn.right <= up.left + 1 : up.bottom <= dn.top + 1, row };
          }),
      );
      seen += found.length;
      for (const f of found) {
        if (!f.ok) bad.push(`${path}: ${f.key} (${f.row ? "up sits left of down" : "down sits above up"})`);
        if (!f.key.startsWith("company:")) bad.push(`${path}: ${f.key} is not a startup's vote`);
      }
    }
    expect(seen, "the pages show votes to check").toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });
