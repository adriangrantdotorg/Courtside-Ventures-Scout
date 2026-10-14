// The live address shows only with the Open Scout button, once the launch is done (Adrian, 10-14-26): during
// Deploy and Open it is not a site yet. Guards the step rows (local page and the site's Building page), the
// terminal block and the page markup.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stepRows, STEPS } from "../../src/lib/progress-core.mjs";

const ROOT = join(__dirname, "..", "..");
const url = "https://courtside-ventures-scout-2.vercel.app";
const base = { step: 5, name: "Open", startedAt: 0, stepStartedAt: 0, updatedAt: 0, note: "", waiting: false, liveUrl: url, durations: {} };

describe("the live address waits for the Open Scout button", () => {
  it("step rows name the address only when done", () => {
    const deploy = STEPS.length - 2;
    expect(stepRows({ ...base, done: false })[deploy].name).toBe("Deploy");
    expect(stepRows({ ...base, done: true })[deploy].name).toContain("live at courtside-ventures-scout-2.vercel.app");
  });

  it("the page has no footer address and shows the address only inside the done card", () => {
    const step = readFileSync(join(ROOT, "scripts", "step.ts"), "utf8");
    expect(step).not.toContain('id="foot"');
    expect(step).not.toContain("Live site:");
    expect(step).toContain('id="doneCard" hidden');
    expect(step).toMatch(/var ready = !!\(p\.done && p\.liveUrl\)/);
    // the terminal block shows "(live: …)" only once done
    expect(step).toContain("st.done && st.liveUrl ? ` (live:");
    // the site's Building page goes off as soon as the last step starts, so the live checks see the real site
    expect(step).toContain("n === STEPS.length ? { ...s, done: true } : s");
  });

  it("the launch asks Vercel about each project name instead of parsing the listing", () => {
    const launch = readFileSync(join(ROOT, "scripts", "launch.sh"), "utf8");
    expect(launch).not.toMatch(/V project ls/); // the parsed listing is gone; only the comment names it
    expect(launch).toContain('V project inspect "$1"');
    expect(launch).toContain("project_not_found");
  });
});
