import { test, expect } from "@playwright/test";
import { HOME, ready } from "./pages";

// The memo (11-06-26): no unfinished outline is handed out; More › Draft Investment Memo opens the memo panel, where
// only Draft the Memo remains, and a finished draft has Copy the Draft.

test("the memo: Draft the Memo only, no outline to download or copy, and More opens the memo panel", async ({ page }) => {
  await page.goto("/company/1");
  await ready(page);
  const memo = page.locator("#memo");
  await expect(memo).toBeVisible();
  const buttons = await memo.getByRole("button").allInnerTexts();
  expect(buttons.every((b) => /Draft the Memo/.test(b)), `only Draft the Memo (or nothing while the AI is off): ${buttons.join(", ")}`).toBe(true);
  await expect(memo).not.toContainText(/Download|Copy the Outline|\.md\b/);
  await page.goto(HOME);
  await ready(page);
  const hero = page.locator(".x-tile.hero");
  const id = await hero.getAttribute("data-company");
  await hero.locator("button.x-more").click();
  await page.locator(".x-menu button[data-act=memo]").click();
  await expect(page).toHaveURL(new RegExp(`/company/${id}#memo$`));
  await expect(page.locator("#memo")).toBeVisible();
});

test("the memo: Copy the Draft copies the finished draft with its title", async ({ page }) => {
  const draft = "## 1. Title\nWhy We Invested: Sample\n\n## Questions for Founders\n\n### The founders\n1. Who leads growth?";
  await page.route("**/api/memo/1", (r) => (r.request().method() === "POST" ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ name: "x", markdown: draft }) }) : r.continue()));
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/company/1");
  await ready(page);
  const memo = page.locator("#memo");
  const write = memo.getByRole("button", { name: "Draft the Memo" });
  test.skip(!(await write.count()), "the AI is off on this server, so there is no Draft the Memo to press");
  await expect(memo.getByRole("button", { name: "Copy the Draft" })).toHaveCount(0); // nothing to copy before a draft
  await write.click();
  await expect(memo.locator("pre")).toContainText("Who leads growth?");
  const name = ((await memo.locator("p").first().innerText()).match(/draft of (.+?)['’]s memo/) || [])[1];
  expect(name).toBeTruthy();
  await memo.getByRole("button", { name: "Copy the Draft" }).click();
  await expect(page.getByText(/Draft (Copied|Downloaded)/)).toBeVisible();
  const copied = await page.evaluate(() => (window as { __lastCopied?: string }).__lastCopied);
  expect(copied).toBe(`# Why We Invested: ${name}\n\n${draft}\n`);
});
