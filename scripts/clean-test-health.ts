// One-off (11-06-26): before vitest.config.ts dropped the live database's address, every `npm run check` let the unit
// tests write their fake answers into the live source_health table, so Settings › Sources showed 8 failing sources that
// were reading fine. This clears what the last such run (11-06-26, 17:51:20 to 17:51:30 UTC) wrote: its OK and failure
// times and messages. A source cleared this way reads "Not read yet" until its next real read. Also drops the one cache
// row a unit test left ("gnews:NOPE"). Prints what it would change; --write saves it.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const write = process.argv.includes("--write");
const FROM = "2026-11-06T17:51:20Z";
const TO = "2026-11-06T17:51:30Z";
const { db, saveLocalDb } = await import("../src/db");
const { sql } = await import("drizzle-orm");
const rows = (await db().execute(sql`select source, last_ok, last_error from source_health where last_ok between ${FROM} and ${TO} or last_error between ${FROM} and ${TO} order by source`)) as unknown as { rows: { source: string; last_ok: string | null; last_error: string | null }[] };
const inWindow = (t: string | Date | null) => !!t && new Date(t) >= new Date(FROM) && new Date(t) <= new Date(TO);
for (const r of rows.rows) console.log(`${r.source}: ${[inWindow(r.last_ok) && "test OK time", inWindow(r.last_error) && "test failure"].filter(Boolean).join(", ")}`);
if (write) {
  await db().execute(sql`update source_health set last_ok = null where last_ok between ${FROM} and ${TO}`);
  await db().execute(sql`update source_health set last_error = null, error_text = null where last_error between ${FROM} and ${TO}`);
  await db().execute(sql`delete from cache where key = 'gnews:NOPE'`);
  await saveLocalDb(); // a local copy keeps the change only once written back to its file
}
console.log(`${rows.rows.length} sources ${write ? "cleared" : "to clear (dry run; --write saves)"}, plus the cache row gnews:NOPE`);
process.exit(0);
