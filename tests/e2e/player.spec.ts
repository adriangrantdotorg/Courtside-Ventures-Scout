import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { ready } from "./pages";

// The video player (11-06-26): a file with no sound track says so in place of Mute, Mute follows the video, and a
// scrub bar under the video shows the time played and the length and moves the video. The two sample files are
// made with ffmpeg: silent.webm has no sound track, sound.webm carries a tone.
const MEDIA = fileURLToPath(new URL("./media/", import.meta.url));

async function play(page: import("@playwright/test").Page, file: string, blob = false) {
  await page.route(`**/__test-media/${file}`, (r) => r.fulfill({ body: fs.readFileSync(MEDIA + file), contentType: "video/webm" }));
  await page.goto("/about");
  await ready(page);
  // a blob address lets the browser seek (a routed reply has no byte ranges, and Chrome won't seek without them)
  await page.evaluate(async ({ file, blob }) => {
    const src = blob ? URL.createObjectURL(await (await fetch(`/__test-media/${file}`)).blob()) : `/__test-media/${file}`;
    document.dispatchEvent(new CustomEvent("scout:play", { detail: { name: "Sample", site: null, logo: null, media: { kind: "mp4", mp4: src, play: "Play Product Video" } } }));
  }, { file, blob });
  const th = page.getByTestId("theater");
  await expect(th).toBeVisible();
  return th;
}

for (const [file, silent] of [["silent.webm", true], ["sound.webm", false]] as const)
  test(`the video player: ${silent ? "a file with no sound track says so" : "Mute and Unmute follow the video"}`, async ({ page }) => {
    const th = await play(page, file);
    await th.locator("video").evaluate((v: HTMLVideoElement) => { v.muted = false; return v.play().catch(() => undefined); });
    if (silent) {
      await expect(th.getByTestId("silent")).toHaveText("This Video Has No Sound", { timeout: 8000 });
      await expect(th.locator(".x-thsound")).toHaveCount(0);
    } else {
      await page.waitForTimeout(1800);
      await expect(th.getByTestId("silent")).toHaveCount(0);
      const sound = th.locator(".x-thsound");
      await expect(sound).toHaveText("Mute");
      await sound.click();
      await expect(sound).toHaveText("Unmute");
      expect(await th.locator("video").evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
      await sound.click();
      await expect(sound).toHaveText("Mute");
      expect(await th.locator("video").evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);
    }
  });

test("the video player: a scrub bar shows the time and moves the video", async ({ page }) => {
  const th = await play(page, "sound.webm", true);
  const scrub = th.getByTestId("scrub");
  await expect(scrub).toBeVisible();
  const range = scrub.locator("input[type=range]");
  await expect(range).toBeEnabled({ timeout: 8000 });
  const max = Number(await range.getAttribute("max"));
  expect(max).toBeGreaterThan(0);
  await expect(scrub.locator(".x-thtime").last()).toHaveText(/^\d+:\d\d$/);
  // the bar sits inside the window, under the video, with nothing on top of it
  const box = (await scrub.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(await range.evaluate((el) => { const r = el.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el; })).toBe(true);
  await th.locator("video").evaluate((v: HTMLVideoElement) => v.pause());
  // a press at the slider's middle moves the video to about half way
  await range.click();
  await expect.poll(() => th.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(max * 0.3);
  await expect(scrub.locator(".x-thtime").first()).not.toHaveText("0:00");
});
