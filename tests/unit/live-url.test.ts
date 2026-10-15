// The launch checks the PUBLIC address, never the per-deploy one (10-14-26, third dry run): the per-deploy address
// (project-xxxxxxxxx.vercel.app) is behind Vercel Authentication and lands on vercel.com's login page, so all 11 live
// checks failed and the wall's address leaked into SITE_URL. The fixture is the real Vercel CLI 64 deploy log of that run.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const SH = join(ROOT, "scripts", "live-url.sh");
const FX = join(ROOT, "tests", "fixtures");
const url = (log: string, pj = join(FX, "vercel-project.json")) => execFileSync("bash", [SH, log, pj], { encoding: "utf8" }).trim();

describe("live-url.sh picks the public production address", () => {
  it("reads productionUrl from the CLI 64 deploy log, not the per-deploy address it prints first", () => {
    const log = readFileSync(join(FX, "deploy-cli64.log"), "utf8");
    expect(log).toMatch(/Production\s+https:\/\/courtside-ventures-scout-2-[a-z0-9]{9}\.vercel\.app/); // the trap is in the fixture
    expect(url(join(FX, "deploy-cli64.log"))).toBe("https://courtside-ventures-scout-2.vercel.app");
  });

  it("falls back to the project name when the log has no alias, and to the default name without a project file", () => {
    expect(url(join(FX, "deploy-no-alias.log"))).toBe("https://courtside-ventures-scout-2.vercel.app");
    expect(url("/nonexistent/deploy.log", "/nonexistent/project.json")).toBe("https://courtside-ventures-scout.vercel.app");
  });

  it("the launch uses the helper and waits for a 200; the live checks name a login wall in one line", () => {
    const launch = readFileSync(join(ROOT, "scripts", "launch.sh"), "utf8");
    expect(launch).toContain('URL=$(bash scripts/live-url.sh "$LOG/deploy.log" .vercel/project.json)');
    expect(launch).not.toMatch(/grep -oE 'https:\/\/\[a-z0-9.-\]\+\\.vercel\\.app' "\$LOG\/deploy\.log" \| head -1/);
    expect(launch).toContain("is not answering yet");
    const verify = readFileSync(join(ROOT, "scripts", "verify-live.ts"), "utf8");
    expect(verify).toContain("is behind Vercel's login wall");
    expect(verify).toMatch(/\/\^https:\\\/\\\/vercel\\\.com\\\/\/\.test\(home\.landed\)/);
  });
});
