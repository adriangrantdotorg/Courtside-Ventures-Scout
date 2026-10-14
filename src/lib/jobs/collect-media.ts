// Reads every creator and show (YouTube channel feeds and podcast feeds) into feed_items.
import { asc, eq } from "drizzle-orm";
import { db, schema as S } from "@/db";
import * as F from "../sources/fetchers";
import { stripHtml } from "../sources/parse";
import type { Ctx } from "./runner";

const DAY = 86400000;

export async function saveItems(items: { kind: string; source: string; voice?: string | null; title: string; url: string; date: string | Date | null; text?: string | null }[]) {
  const rows = items
    .filter((i) => i.url && i.title)
    .map((i) => ({ kind: i.kind, source: i.source, voice: i.voice || null, title: i.title.slice(0, 500), url: i.url, date: i.date ? new Date(i.date) : null, text: i.text ? i.text.slice(0, 6000) : null }));
  let n = 0;
  for (let k = 0; k < rows.length; k += 100) {
    const r = await db().insert(S.feedItems).values(rows.slice(k, k + 100)).onConflictDoNothing().returning({ id: S.feedItems.id });
    n += r.length;
  }
  return n;
}

export async function collectMedia(ctx: Ctx, opts: { limit?: number } = {}) {
  const voices = await db().select().from(S.voices).where(eq(S.voices.status, "active")).orderBy(asc(S.voices.priority), asc(S.voices.name));
  const list = voices.filter((v) => v.kind !== "named" || v.feeds.length || v.youtube.length);
  const start = (await ctx.cursor<{ i: number } | null>(null))?.i || 0;
  const total = opts.limit ? Math.min(list.length, opts.limit) : list.length;
  await ctx.stage("creators and shows", 0, total);
  let i = start % list.length;
  let processed = 0;
  while (processed < total && !ctx.outOfTime()) {
    const v = list[i];
    let newest = v.lastEpisode?.getTime() || 0;
    let image = v.image;
    const items: Parameters<typeof saveItems>[0] = [];
    for (const ch of v.youtube) {
      const f = await F.youtube(ch);
      if (!f.items.length) continue;
      // the channel's own title must match the creator, else skip YouTube for this voice
      for (const it of f.items) {
        items.push({ kind: "video", source: "youtube", voice: v.name, title: it.title, url: it.link, date: it.date, text: it.description });
        if (it.date) newest = Math.max(newest, new Date(it.date).getTime());
      }
    }
    for (const url of v.feeds) {
      const f = await F.feed(url, "podcasts");
      if (f.image && !image) image = f.image;
      for (const it of f.items.slice(0, 15)) {
        const notes = stripHtml(`${it.description}\n${it.content}`);
        items.push({ kind: "episode", source: "podcast", voice: v.name, title: it.title, url: it.link || it.enclosure || it.guid, date: it.date, text: notes });
        if (it.date) newest = Math.max(newest, new Date(it.date).getTime());
      }
    }
    const n = await saveItems(items);
    ctx.item(n);
    await db()
      .update(S.voices)
      .set({ lastEpisode: newest ? new Date(newest) : v.lastEpisode, image })
      .where(eq(S.voices.id, v.id));
    processed++;
    ctx.tick();
    i = (i + 1) % list.length;
  }
  await ctx.saveCursor({ i });
  if (!opts.limit && !ctx.outOfTime()) await peopleStage(ctx);
}

/** The 90-day rule: a show with no new episode in 90 days is "quiet" (Adrian's own show never is). */
export async function quietCheck(ctx: Ctx) {
  const voices = await db().select().from(S.voices);
  const now = Date.now();
  for (const v of voices) {
    if (v.kind !== "podcast" && !v.feeds.length) continue;
    const quiet = !v.exempt && (!v.lastEpisode || now - v.lastEpisode.getTime() > 90 * DAY);
    const status = quiet ? "quiet" : "active";
    if (status !== v.status) {
      await db().update(S.voices).set({ status }).where(eq(S.voices.id, v.id));
      ctx.change(`${v.name} is ${status}`);
    }
  }
}

/** Person tracker: YouTube uploads, podcast appearances (Apple episode search), Medium or Substack posts, news. */
export async function peopleStage(ctx: Ctx) {
  const ppl = await db().select().from(S.people).where(eq(S.people.tracked, true));
  await ctx.stage("people", 0, ppl.length);
  for (const p of ppl) {
    if (ctx.outOfTime()) break;
    const items: { kind: string; title: string; url: string; date: string | null; source: string }[] = [];
    const ch = p.youtube?.match(/\/channel\/(UC[\w-]{20,})/);
    if (ch) for (const it of (await F.youtube(ch[1])).items.slice(0, 5)) items.push({ kind: "video", title: it.title, url: it.link, date: it.date, source: "YouTube" });
    if (p.blog) {
      const u = p.blog.replace(/\/$/, "");
      const feedUrl = /medium\.com\/@/.test(u) ? u.replace("medium.com/@", "medium.com/feed/@") : /substack\.com/.test(u) ? `${u}/feed` : null;
      if (feedUrl) for (const it of (await F.feed(feedUrl, "people")).items.slice(0, 5)) items.push({ kind: "post", title: it.title, url: it.link, date: it.date, source: new URL(u).hostname });
      else for (const it of (await F.beehiiv(u + "/", "people")).slice(0, 5)) items.push({ kind: "post", title: it.title, url: it.url, date: it.date, source: new URL(u).hostname });
    }
    const { fetchJSON } = await import("../sources/http");
    const eps = (await fetchJSON(`https://itunes.apple.com/search?media=podcast&entity=podcastEpisode&term=${encodeURIComponent(p.name)}&limit=10`, { source: "itunes-search" })) as { results?: { trackName?: string; collectionName?: string; trackViewUrl?: string; releaseDate?: string; description?: string }[] } | null;
    for (const e of eps?.results || []) {
      if (!e.trackViewUrl || !`${e.trackName} ${e.description || ""}`.toLowerCase().includes(p.name.toLowerCase())) continue;
      items.push({ kind: "appearance", title: `${e.collectionName}: ${e.trackName}`, url: e.trackViewUrl, date: e.releaseDate || null, source: "Apple Podcasts" });
    }
    for (const n of (await F.googleNews(`"${p.name}"`, "14d")).slice(0, 5)) items.push({ kind: "news", title: n.title, url: n.url, date: n.date, source: n.outlet || "News" });
    for (const it of items)
      await db()
        .insert(S.personItems)
        .values({ personId: p.id, kind: it.kind, title: it.title.slice(0, 400), url: it.url, date: it.date ? new Date(it.date) : null, source: it.source })
        .onConflictDoNothing();
    ctx.item(items.length);
    ctx.tick();
  }
}
