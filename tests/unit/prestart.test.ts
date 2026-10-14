// The progress page from second zero (scripts/prestart.sh): opens before npm ci, says whose turn it is, hands over
// to the full page at step 1 without a second tab, and never reloads itself except for that one handoff (10-14-26).
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const SH = join(ROOT, "scripts", "prestart.sh");

function run(home: string, ...args: string[]) {
  return execFileSync("bash", [SH, ...args], { env: { ...process.env, HOME: home, PRESTART_NO_OPEN: "1" }, encoding: "utf8" });
}
function state(home: string) {
  const js = readFileSync(join(home, ".courtside-ventures-scout", "progress.js"), "utf8");
  return JSON.parse(js.replace(/^window\.__progress = /, "").replace(/;\s*$/, ""));
}

describe("prestart.sh: the page from second zero", () => {
  const home = mkdtempSync(join(tmpdir(), "scout-pre-"));
  const dir = join(home, ".courtside-ventures-scout");

  it("open writes the page, the first state, the start time and the opened marker", () => {
    run(home, "open");
    expect(existsSync(join(dir, "progress.html"))).toBe(true);
    expect(existsSync(join(dir, "progress.html.opened-pre"))).toBe(true);
    expect(Number(readFileSync(join(dir, "started-at"), "utf8"))).toBeGreaterThan(0);
    expect(state(home).pre).toBe("start");
  });

  it("each moment is a state the page can show: sign-in with link and code, terms with link, walk away", () => {
    run(home, "state", "signin", "https://vercel.com/device?code=ABCD-EFGH", "ABCD-EFGH");
    expect(state(home)).toMatchObject({ pre: "signin", url: "https://vercel.com/device?code=ABCD-EFGH", code: "ABCD-EFGH" });
    run(home, "state", "terms", "https://vercel.com/t/~/integrations/accept-terms/neon?source=cli");
    expect(state(home)).toMatchObject({ pre: "terms", url: "https://vercel.com/t/~/integrations/accept-terms/neon?source=cli" });
    run(home, "state", "walk");
    expect(state(home).pre).toBe("walk");
    const started = Number(readFileSync(join(dir, "started-at"), "utf8"));
    expect(state(home).startedAt).toBe(started); // the clock never restarts between moments
  });

  it("the page never reloads itself (polls progress.js and patches in place); the one handoff is a replace, not a refresh", () => {
    const html = readFileSync(join(dir, "progress.html"), "utf8");
    expect(html).not.toMatch(/http-equiv="refresh"|location\.reload|window\.location *=/);
    expect(html).toMatch(/progress\.js\?t=/);
    expect(html).toMatch(/location\.replace\(/); // once, when the rich state appears
    for (const id of ["start", "signin", "terms", "walk"]) expect(html).toContain(`id="${id}"`);
    expect(html).not.toMatch(/text-overflow|white-space: *nowrap|line-clamp/);
  });

  it("the full page honors the plain page's marker (no second tab) and the launch start time", () => {
    const step = readFileSync(join(ROOT, "scripts", "step.ts"), "utf8");
    expect(step).toContain('".opened-pre"');
    expect(step).toContain("SCOUT_STARTED_AT");
    // and writes the page before the state, so the handoff reload lands on the rich page
    expect(step.indexOf("writeFileSync(PAGE, renderPage())")).toBeLessThan(step.indexOf('writeFileSync(JS, "window.__progress'));
  });

  it("launch.sh drives every moment", () => {
    const launch = readFileSync(join(ROOT, "scripts", "launch.sh"), "utf8");
    expect(launch).toContain("prestart.sh open");
    for (const m of ["pre signin", "pre terms", "pre walk", "pre start"]) expect(launch).toContain(m);
  });
});
