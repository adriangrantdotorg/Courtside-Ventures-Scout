// npm run pipeline:all [-- job ...]: runs every job locally, in order, until each one is done.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const { runNamed, JOBS } = await import("../src/lib/jobs");
const { execFileSync } = await import("node:child_process");

const order = process.argv.slice(2).length ? process.argv.slice(2) : ["collect-media", "collect-signals", "culture", "sponsors", "trends", "funds-neighborhood", "funds-synergistic", "score", "alerts", "monday-brief"];
const note = (t: string) => {
  try {
    execFileSync("npx", ["tsx", "scripts/step.ts", "5", "Open", "--note", t], { stdio: "ignore" });
  } catch {
    /* progress is best-effort */
  }
};
for (const j of order) {
  if (!JOBS[j]) continue;
  const t0 = Date.now();
  note(`first pull: ${JOBS[j].label.toLowerCase()} (${order.indexOf(j) + 1} of ${order.length})`);
  let rounds = 0;
  for (;;) {
    rounds++;
    console.log(`[pipeline] ${j} round ${rounds}`);
    const r = await runNamed(j, 270_000);
    console.log(`[pipeline] ${j}: ${r.status}, ${r.items} items, ${r.errors} errors, ${Math.round((Date.now() - t0) / 1000)}s`);
    if (!r.timedOut || rounds >= 3) break;
  }
}
console.log("[pipeline] done");
