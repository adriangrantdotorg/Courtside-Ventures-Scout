// Culture (mentions and stance), Sponsor Radar and Trends, all built from feed_items.
import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { extractMentions, extractSponsors } from "../extract";
import { classify } from "../thesis";
import * as F from "../sources/fetchers";
import { domainOf, slugify, areaLabel } from "../format";
import { saveItems } from "./collect-media";
import type { Ctx } from "./runner";

const DAY = 86400000;

async function pending(tag: string, days = 30, limit = 1500) {
  return db()
    .select()
    .from(S.feedItems)
    .where(and(inArray(S.feedItems.kind, ["video", "episode"]), gte(S.feedItems.date, new Date(Date.now() - days * DAY)), sql`not (${S.feedItems.processed} ? ${tag})`))
    .orderBy(desc(S.feedItems.date))
    .limit(limit);
}
async function mark(ids: number[], tag: string) {
  for (let i = 0; i < ids.length; i += 200)
    await db().execute(sql`update feed_items set processed = processed || ${JSON.stringify([tag])}::jsonb where id = any(${sql.raw(`array[${ids.slice(i, i + 200).join(",") || "0"}]`)})`);
}

/* ---------- Culture ---------- */
export async function cultureJob(ctx: Ctx) {
  const items = await pending("culture");
  const [cos, port, sps] = await Promise.all([
    db().select({ name: S.companies.name, area: S.companies.thesisArea }).from(S.companies).where(eq(S.companies.hidden, false)),
    db().select({ name: S.portfolio.name }).from(S.portfolio),
    db().select({ brand: S.sponsors.brand, fit: S.sponsors.fitTag }).from(S.sponsors),
  ]);
  const portSet = new Set(port.map((p) => p.name.toLowerCase()));
  const startup = new Set(cos.filter((c) => c.area).map((c) => c.name.toLowerCase()));
  const established = new Set(sps.filter((s) => s.fit === "established").map((s) => s.brand.toLowerCase()));
  const known = [...new Set([...cos.map((c) => c.name), ...port.map((p) => p.name), ...sps.map((s) => s.brand)])].filter((n) => n.length > 3);
  await ctx.stage("reading episodes and videos", 0, items.length);
  const done: number[] = [];
  for (const it of items) {
    if (ctx.outOfTime()) break;
    const ms = extractMentions(`${it.title}\n${it.text || ""}`, it.voice || "", known);
    for (const m of ms) {
      const k = m.entity.toLowerCase();
      const kind = portSet.has(k) ? "portfolio" : startup.has(k) ? "startup" : established.has(k) ? "established" : "unknown";
      await db().insert(S.mentions).values({ entity: m.entity, kind, stance: m.stance, quote: m.quote, url: it.url, date: it.date, voice: it.voice || it.source }).onConflictDoNothing();
      ctx.item();
    }
    done.push(it.id);
    ctx.tick();
  }
  await mark(done, "culture");
  // influencers tracked by name (their own posts are Phase II): news mentions by name
  const named = await db().select().from(S.voices).where(eq(S.voices.kind, "named"));
  await ctx.stage("news for names tracked by name", 0, named.length);
  for (const v of named) {
    if (ctx.outOfTime()) break;
    const q = `"${v.name.replace(/\s*\(.*\)\s*/g, "")}"`;
    const news = await F.googleNews(q, "7d");
    await saveItems(news.slice(0, 6).map((n) => ({ kind: "news", source: n.outlet || "News", voice: v.name, title: n.title, url: n.url, date: n.date, text: n.text })));
    ctx.tick();
  }
}

/* ---------- Sponsor Radar ---------- */
export async function sponsorsJob(ctx: Ctx) {
  const items = await pending("sponsors", 90, 3000);
  const voices = await db().select({ name: S.voices.name, site: S.voices.site }).from(S.voices);
  const vsite = new Map(voices.map((v) => [v.name, domainOf(v.site)]));
  await ctx.stage("reading show notes and descriptions", 0, items.length);
  const done: number[] = [];
  for (const it of items) {
    if (ctx.outOfTime()) break;
    const hits = extractSponsors(it.text || "", it.voice || "", vsite.get(it.voice || "") || undefined);
    for (const h of hits) {
      const key = slugify(h.brand).replace(/-/g, "");
      if (!key) continue;
      const [sp] = await db()
        .insert(S.sponsors)
        .values({ key, brand: h.brand, site: h.domain ? `https://${h.domain}` : null, firstSeen: it.date, lastSeen: it.date })
        .onConflictDoUpdate({
          target: S.sponsors.key,
          set: {
            lastSeen: sql`greatest(${S.sponsors.lastSeen}, ${it.date || new Date()})`,
            firstSeen: sql`least(${S.sponsors.firstSeen}, ${it.date || new Date()})`,
            site: sql`coalesce(${S.sponsors.site}, ${h.domain ? `https://${h.domain}` : null})`,
          },
        })
        .returning({ id: S.sponsors.id });
      const r = await db()
        .insert(S.sponsorSightings)
        .values({ sponsorId: sp.id, show: it.voice || it.source, date: it.date, url: it.url, evidence: h.evidence })
        .onConflictDoNothing()
        .returning({ id: S.sponsorSightings.id });
      if (r.length) ctx.item();
    }
    done.push(it.id);
    ctx.tick();
  }
  await mark(done, "sponsors");
  // what-it-is lines and fit tags for brands that lack them (the visitor never waits for this)
  const missing = await db().select().from(S.sponsors).where(and(isNotNull(S.sponsors.site), sql`${S.sponsors.whatItIs} is null`)).limit(20);
  await ctx.stage("brand descriptions", 0, missing.length);
  const cos = new Set((await db().select({ n: S.companies.name }).from(S.companies)).map((c) => c.n.toLowerCase()));
  for (const s of missing) {
    if (ctx.outOfTime()) break;
    const what = await F.metaDescription(s.site!);
    const c = classify(`${s.brand} ${what || ""}`);
    await db()
      .update(S.sponsors)
      .set({ whatItIs: what || "", thesisArea: s.thesisArea || c.area, fitTag: s.fitTag === "established" && c.area && cos.has(s.brand.toLowerCase()) ? "thesis" : s.fitTag })
      .where(eq(S.sponsors.id, s.id));
    ctx.tick();
  }
  // brands with no site yet get one from the keyless lookup, a few per run
  const { findSite } = await import("../sources/sites");
  const nosite = await db().select({ id: S.sponsors.id, brand: S.sponsors.brand }).from(S.sponsors).where(sql`${S.sponsors.site} is null`).limit(25);
  if (nosite.length) await ctx.stage("finding brand sites", 0, nosite.length);
  for (const sp of nosite) {
    if (ctx.outOfTime()) break;
    const site = await findSite(sp.brand).catch(() => null);
    if (site) await db().update(S.sponsors).set({ site }).where(eq(S.sponsors.id, sp.id));
    ctx.tick();
  }
}



/* ---------- Trends ---------- */
export async function trendsJob(ctx: Ctx) {
  // 1. tracked and existing trends: a daily news check adds sources
  const trends = await db().select().from(S.trends).orderBy(desc(S.trends.tracked), desc(S.trends.score)).limit(30);
  await ctx.stage("checking trends in the news", 0, trends.length);
  for (const t of trends) {
    if (ctx.outOfTime()) break;
    const q = t.term.replace(/,/g, " OR ").replace(/\band\b/g, "OR");
    const news = (await F.googleNews(q, "2d")).filter((n) => classify(`${n.title} ${n.text}`).area);
    const fresh = news.filter((n) => !t.sources.some((s) => s.url === n.url)).slice(0, 4);
    if (fresh.length) {
      const sources = [...fresh.map((n) => ({ url: n.url, date: (n.date || new Date().toISOString()).slice(0, 10), title: n.title, source: "news" })), ...t.sources].slice(0, 40);
      const kinds = [...new Set(sources.map((s) => s.source))];
      await db().update(S.trends).set({ sources, sourceKinds: kinds, lastSeen: new Date(), score: t.score + fresh.length * 3 }).where(eq(S.trends.id, t.id));
      ctx.item(fresh.length);
    }
    ctx.tick();
  }
  // 2. discovery: the same name across two or more independent sources this week, inside the thesis
  const since = new Date(Date.now() - 7 * DAY);
  const ms = await db().select().from(S.mentions).where(gte(S.mentions.date, since));
  const by = new Map<string, typeof ms>();
  for (const m of ms) by.set(m.entity.toLowerCase(), [...(by.get(m.entity.toLowerCase()) || []), m]);
  const news = await db().select().from(S.feedItems).where(and(inArray(S.feedItems.kind, ["news", "industry", "gtrends", "hn"]), gte(S.feedItems.date, since)));
  let added = 0;
  for (const [, list] of by) {
    const voices = [...new Set(list.map((m) => m.voice))];
    if (voices.length < 2) continue;
    const ent = list[0].entity;
    const inNews = news.filter((n) => n.title.toLowerCase().includes(ent.toLowerCase()));
    const kinds = new Set(["voices", ...(inNews.length ? ["news"] : [])]);
    const c = classify(`${ent} ${list.map((m) => m.quote || "").join(" ")} ${inNews.map((n) => n.title).join(" ")}`);
    if (!c.area || kinds.size + (voices.length >= 3 ? 1 : 0) < 2) continue;
    const slug = slugify(ent);
    const sources = [...inNews.slice(0, 3).map((n) => ({ url: n.url, date: (n.date || since).toISOString().slice(0, 10), title: n.title, source: "news" })), ...list.slice(0, 6).map((m) => ({ url: m.url, date: (m.date || since).toISOString().slice(0, 10), title: m.quote || ent, source: "voices", voice: m.voice }))];
    const r = await db()
      .insert(S.trends)
      .values({
        slug,
        term: ent,
        headline: `${ent} is coming up across ${voices.length} of the shows Courtside's world listens to`,
        why: `${areaLabel(c.area)}: ${voices.slice(0, 3).join(", ")} all mentioned it this week.`,
        thesisArea: c.area,
        momentum: `New this week · ${voices.slice(0, 3).join(", ")}`,
        score: voices.length * 12 + inNews.length * 4,
        sources,
        sourceKinds: [...kinds],
        voiceCount: voices.length,
      })
      .onConflictDoNothing()
      .returning({ id: S.trends.id });
    if (r.length) {
      added++;
      ctx.change(`New trend: ${ent}`);
    }
  }
  ctx.item(added);
  // keep at most 30 untracked trends, newest scores first
  await db().execute(sql`delete from trends where tracked = false and id not in (select id from trends order by tracked desc, score desc limit 30)`);
  // every trend's four-week curve
  const all = await db().select().from(S.trends);
  for (const t of all) {
    const w = [0, 0, 0, 0];
    for (const s of t.sources) {
      const age = Math.floor((Date.now() - new Date(s.date).getTime()) / (7 * DAY));
      if (age >= 0 && age < 4) w[3 - age]++;
    }
    await db().update(S.trends).set({ weekly: w, delta: w[3] + w[2] - w[1] - w[0] }).where(eq(S.trends.id, t.id));
  }
}

export { saveItems };
