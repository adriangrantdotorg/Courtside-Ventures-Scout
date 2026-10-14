import { test, expect } from "@playwright/test";

// The one-minute check that ends step 2 (and runs again on the live URL).
test("home renders the Building page or Today, with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const r = await page.goto("/");
  expect(r?.status()).toBe(200);
  await expect(page.locator("[data-testid=building], main h1, .mast").first()).toBeVisible();
  expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
  expect(errors.filter((e) => !/favicon|Failed to load resource/.test(e))).toEqual([]);
});

test("icons are Courtside's, not the scaffold's", async ({ request }) => {
  for (const p of ["/icon.png", "/favicon.ico"]) {
    const r = await request.get(p);
    expect(r.status()).toBe(200);
    const b = await r.body();
    expect(b.length).toBeGreaterThan(500);
    expect(b.length).not.toBe(25931); // the Next.js scaffold favicon.ico
  }
});

test("build progress API answers", async ({ request }) => {
  const r = await request.get("/api/build-progress");
  expect(r.status()).toBe(200);
});
