// One-off (10-14-26): give every sponsor with no site one from the keyless lookup, so its logo shows.
import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";
import { db, schema as S } from "../src/db";
import { findSite } from "../src/lib/sources/sites";

config({ path: ".env.local", quiet: true });
const rows = await db().select({ id: S.sponsors.id, brand: S.sponsors.brand }).from(S.sponsors).where(sql`site is null`);
let n = 0;
for (const r of rows) {
  const site = await findSite(r.brand).catch(() => null);
  if (site) {
    await db().update(S.sponsors).set({ site }).where(eq(S.sponsors.id, r.id));
    n++;
    console.log(`${r.brand} → ${site}`);
  }
}
console.log(`${rows.length} without a site · ${n} found`);
