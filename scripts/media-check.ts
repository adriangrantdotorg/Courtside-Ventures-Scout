// npx tsx scripts/media-check.ts [--recheck]: which cards' saved pictures and videos no longer load (a website's
// poster, video or logo). Read-only by default; --recheck clears enriched_at on those cards so the next enrich run
// (`npm run pipeline:all -- enrich`) reads their sites again, first in line.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const { db, schema: S } = await import("../src/db");
const { mediaLoads } = await import("../src/lib/sources/http");
const { and, eq, inArray, isNull, isNotNull } = await import("drizzle-orm");

type M = { kind?: string; img?: string; poster?: string; mp4?: string; logo?: string; from?: string };
const rows = await db()
  .select({ id: S.companies.id, name: S.companies.name, media: S.companies.media })
  .from(S.companies)
  .where(and(eq(S.companies.hidden, false), isNull(S.companies.mergedInto), isNotNull(S.companies.media)));

const dead: { id: number; name: string; links: string[] }[] = [];
let checked = 0;
for (const r of rows) {
  const m = (r.media || {}) as M;
  if (m.from !== "website" && m.from !== "logo") continue; // App Store and YouTube links come from their own APIs
  const links: [string, "image" | "video"][] = [];
  if (m.img) links.push([m.img, "image"]);
  if (m.poster && !m.poster.includes("i.ytimg.com")) links.push([m.poster, "image"]);
  if (m.mp4) links.push([m.mp4, "video"]);
  if (m.logo && !m.logo.includes("google.com/s2/favicons")) links.push([m.logo, "image"]);
  const bad: string[] = [];
  for (const [u, kind] of links) if (!(await mediaLoads(u, kind, 8000))) bad.push(u);
  checked++;
  if (bad.length) dead.push({ id: r.id, name: r.name, links: bad });
}

console.log(`Checked ${checked} cards with website pictures: ${dead.length} with links that don't load.`);
for (const d of dead) console.log(`  #${d.id} ${d.name}\n    ${d.links.join("\n    ")}`);
if (process.argv.includes("--recheck") && dead.length) {
  await db().update(S.companies).set({ enrichedAt: null }).where(inArray(S.companies.id, dead.map((d) => d.id)));
  console.log(`Queued ${dead.length} for the next enrich run.`);
}
process.exit(0);
