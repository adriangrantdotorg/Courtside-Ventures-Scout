// npm run pipeline:all [-- job ... --rounds=N]: runs every job locally, in order, until each one is done (up to N
// 270 s rounds each, 3 by default; the launch's thesis-check-all needs about one round per 20 cards).
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const { runNamed, JOBS: SCHEDULED, ON_DEMAND } = await import("../src/lib/jobs");
const JOBS = { ...SCHEDULED, ...ON_DEMAND };
const { saveLocalDb } = await import("../src/db"); // SCOUT_PGLITE: the local copy keeps what each job found
const { execFileSync } = await import("node:child_process");

const args = process.argv.slice(2);
const maxRounds = Number(args.find((a) => a.startsWith("--rounds="))?.split("=")[1]) || 3;
const named = args.filter((a) => !a.startsWith("--"));
const order = named.length ? named : ["collect-media", "collect-signals", "culture", "sponsors", "trends", "funds-neighborhood", "funds-synergistic", "score", "enrich", "alerts", "monday-brief"];
const note = (t: string) => {
  if (process.env.SCOUT_PGLITE) return; // a run on the local copy never touches the shared database's progress record
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
    await saveLocalDb();
    if (!(r.timedOut || r.more) || rounds >= maxRounds) break;
  }
}
console.log("[pipeline] done");
process.exit(0); // open sockets (and a local copy) would keep the process alive
