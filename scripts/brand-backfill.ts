// npm run brand:backfill [-- --limit=80] [--all]: Brand Sky's parts (hero art, header logo, colors) for cards
// that don't have them yet, best fit first, so the Must See masthead draws a startup's own art and logo right away.
// The daily enrich job fills the rest within a week. Writes only media.brand. --all redoes cards that already have it.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const { db, schema: S, saveLocalDb } = await import("../src/db");
const F = await import("../src/lib/sources/fetchers");
const { brandFor } = await import("../src/lib/jobs/brand");
const { and, desc, eq, isNull, isNotNull, sql } = await import("drizzle-orm");
import type { Media } from "../src/db/schema";

const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1]) || 80;
const conds = [eq(S.companies.hidden, false), isNull(S.companies.mergedInto), isNull(S.companies.notStartup), isNotNull(S.companies.domain), isNotNull(S.companies.thesisArea)];
if (!process.argv.includes("--all")) conds.push(sql`${S.companies.media}->'brand' is null`);
const rows = await db()
  .select({ id: S.companies.id, name: S.companies.name, domain: S.companies.domain, media: S.companies.media })
  .from(S.companies)
  .where(and(...conds))
  .orderBy(desc(S.companies.score))
  .limit(limit);

let filled = 0;
for (const r of rows) {
  const page = await F.homepage(`https://${r.domain}`);
  if (!page) {
    console.log(`  #${r.id} ${r.name}: homepage didn't answer`);
    continue;
  }
  const m: Media = r.media || { kind: "logo" };
  const brand = await brandFor(page.html, page.url, r.name, m.logo || null);
  if (!Object.keys(brand).length) {
    console.log(`  #${r.id} ${r.name}: nothing usable (tier 2 or 3 from its icon or name)`);
    continue;
  }
  await db().update(S.companies).set({ media: { ...m, brand } }).where(eq(S.companies.id, r.id));
  filled++;
  console.log(`  #${r.id} ${r.name}: ${brand.art ? "art" : "no art"}, ${brand.mark ? `logo (${brand.markTone})` : "no logo"}, ${(brand.colors || []).join(" ") || "no colors"}`);
}
await saveLocalDb();
console.log(`Brand Sky parts for ${filled} of ${rows.length} cards.`);
// the shared database: refresh the live pages so they draw the new parts now, not in 5 minutes
const site = (process.env.SITE_URL || "").replace(/"/g, "").replace(/\/$/, "");
if (!process.env.SCOUT_PGLITE && filled && site && process.env.CRON_SECRET) {
  const r = await fetch(`${site}/api/revalidate`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }).catch(() => null);
  console.log(r?.ok ? `Refreshed ${site}` : `Couldn't refresh ${site}: POST /api/revalidate yourself`);
}
process.exit(0);
