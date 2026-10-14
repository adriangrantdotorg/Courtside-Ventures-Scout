// One-off: remove the first pull's company finds (made before the stricter rules) so they are re-found under the new rules.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFileSync } from "node:fs";
const { db } = await import("../src/db");
const { sql } = await import("drizzle-orm");
const { setSetting } = await import("../src/lib/settings");
const seed = JSON.parse(readFileSync("seed/scout-launch-seed.json", "utf8"));
const keys: string[] = seed.companies.map((c: { key: string }) => c.key);
const r = (await db().execute(sql`select id from companies where key <> all(${sql.raw(`array[${keys.map((k) => `'${k.replace(/'/g, "''")}'`).join(",")}]`)})`)) as unknown as { rows: { id: number }[] };
const ids = r.rows.map((x) => x.id);
if (ids.length) {
  await db().execute(sql.raw(`delete from signals where company_id in (${ids.join(",")})`));
  await db().execute(sql.raw(`delete from companies where id in (${ids.join(",")})`));
}
await db().execute(sql`delete from filings`);
await setSetting("secIndexDays", seed.settings.secIndexDays || []);
await setSetting("appRanks", seed.settings.appRanks || {});
console.log(`removed ${ids.length} first-pull finds`);
