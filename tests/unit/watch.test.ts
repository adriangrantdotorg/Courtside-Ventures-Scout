// npm run watch (scripts/watch-launch.sh): the one fixed log watcher the prompt names, so the agent never improvises
// its own (dry runs 3 and 4, 10-14-26). It prints new lines as they land and stops on the ✅ or ❌ line.
import { describe, it, expect } from "vitest";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const SH = join(ROOT, "scripts", "watch-launch.sh");

function watch(log: string, feed: (append: (s: string) => void) => void) {
  return new Promise<{ code: number | null; out: string }>((resolve) => {
    const p = spawn("bash", [SH, log], { cwd: ROOT });
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.on("close", (code) => resolve({ code, out }));
    setTimeout(() => feed((s) => appendFileSync(log, s)), 300);
  });
}

describe("npm run watch", () => {
  const dir = mkdtempSync(join(tmpdir(), "scout-watch-"));

  it("prints each new line once and exits 0 on the ✅ line", async () => {
    const log = join(dir, "ok.txt");
    writeFileSync(log, "▶ first\n");
    const r = await watch(log, (add) => {
      add("▰▱▱▱▱  Step 1 of 5 · Setup · 0:20 since start\n");
      setTimeout(() => add("\n✅ Courtside Ventures Scout is live: https://x.vercel.app\n"), 2500);
    });
    expect(r.code).toBe(0);
    expect(r.out).toContain("▶ first");
    expect(r.out.match(/Step 1 of 5/g)?.length).toBe(1);
    expect(r.out).toContain("✅ Courtside Ventures Scout is live");
  }, 20_000);

  it("exits 1 on a ❌ line and still prints the way past it", async () => {
    const log = join(dir, "bad.txt");
    writeFileSync(log, "");
    const r = await watch(log, (add) => add("❌ the deploy failed (see .logs/deploy.log)\n   The way past it: npm run launch -- --from 4\n"));
    expect(r.code).toBe(1);
    expect(r.out).toContain("The way past it");
  }, 20_000);

  it("is wired as npm run watch, and the launch log says when a page is not needed", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(pkg.scripts.watch).toBe("bash scripts/watch-launch.sh");
    const launch = readFileSync(join(ROOT, "scripts", "launch.sh"), "utf8");
    expect(launch).toContain("no sign-in page");
    expect(launch).toContain("no terms page");
    expect(launch).not.toContain("one or two pages open in your browser now");
    expect(execFileSync("bash", ["-n", SH]).toString()).toBe("");
  });
});
