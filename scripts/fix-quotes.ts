// One-off repair (10-14-26): mentions that arrived with the launch seed had lost the first letter of their quote
// ("cott Galloway: …"). Re-extract each one from its stored feed item with today's extractor and update the quote.
import { config } from "dotenv";
import { and, eq, sql } from "drizzle-orm";
import { db, schema as S } from "../src/db";
import { extractMentions } from "../src/lib/extract";

config({ path: ".env.local", quiet: true });
const bad = await db().select().from(S.mentions).where(sql`quote ~ '^[a-z]'`);
let fixed = 0, gone = 0, removed = 0;
for (const m of bad) {
  const [it] = await db().select().from(S.feedItems).where(eq(S.feedItems.url, m.url)).limit(1);
  if (!it) {
    // no feed item to re-read: the cut quote cannot be repaired, and a quote that starts mid-word is worse than none
    await db().delete(S.mentions).where(eq(S.mentions.id, m.id));
    removed++;
    continue;
  }
  const fresh = extractMentions(`${it.title}\n${it.text || ""}`, it.voice || "", [m.entity]).find((x) => x.entity.toLowerCase() === m.entity.toLowerCase());
  if (!fresh || fresh.quote === m.quote) { gone++; continue; }
  await db().update(S.mentions).set({ quote: fresh.quote }).where(and(eq(S.mentions.id, m.id)));
  fixed++;
}
console.log(`cut quotes: ${bad.length} · fixed ${fixed} · removed (no feed item) ${removed} · genuine lowercase ${gone}`);
