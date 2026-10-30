// SCOUT_PGLITE=.local-db/<copy>.tar.gz npx tsx scripts/local-promote.ts <company id>: on a LOCAL copy only, make one
// startup today's Must See (fit 99, a fresh signal; every other score capped at 90), to see how the masthead draws it.
// Then restart `next start` on the copy and POST /api/revalidate. Refuses to run against the shared database.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
if (!process.env.SCOUT_PGLITE) {
  console.error("local-promote: local copy only (set SCOUT_PGLITE)");
  process.exit(2);
}
const id = Number(process.argv[2]);
if (!id) {
  console.error("usage: SCOUT_PGLITE=<copy> npx tsx scripts/local-promote.ts <company id>");
  process.exit(2);
}
const { db, saveLocalDb } = await import("../src/db");
const { sql } = await import("drizzle-orm");
await db().execute(sql`update companies set score = case when id = ${id} then 99 else least(score, 90) end`);
await db().execute(sql`update companies set last_signal = now() where id = ${id}`);
await db().execute(sql`update signals set date = now() where id = (select id from signals where company_id = ${id} order by date desc nulls last limit 1)`);
await saveLocalDb();
console.log(`#${id} is Must See on ${process.env.SCOUT_PGLITE}`);
process.exit(0);
