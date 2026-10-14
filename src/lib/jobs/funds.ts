// Fund watch for the Neighborhood (co-investors) and the Synergistic Funders Radar.
import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema as S } from "@/db";
import * as F from "../sources/fetchers";
import { classify } from "../thesis";
import { subjectOf, stageOf, moneyOf, companyByName } from "../companies";
import { COMMON_NAMES } from "@/data/funds";
import type { Ctx } from "./runner";

const POOL = /\b(spv|a series of|feeder|opportunit(y|ies) fund|co-invest)\b/i;

function shortName(n: string) {
  return n.replace(/\s*\(.*?\)\s*/g, "").trim();
}

export function dealFromHeadline(fund: string, h: { title: string; text?: string }) {
  const name = shortName(fund);
  const names = h.title.toLowerCase().includes(name.toLowerCase());
  const company = subjectOf(h.title);
  const round = stageOf(h.title);
  const money = moneyOf(h.title);
  const lead = new RegExp(`(led by ${name}|${name} leads|${name}-led|${name} led)`, "i").test(h.title);
  const c = classify(`${h.title} ${h.text || ""}`);
  return { company, round, money, role: lead ? "lead" : names ? "participant" : null, area: c.area, possible: !names };
}

export async function fundsJob(ctx: Ctx, kind: "neighborhood" | "synergistic") {
  const funds = await db().select().from(S.funds).where(and(eq(S.funds.kind, kind), eq(S.funds.active, true))).orderBy(asc(S.funds.id));
  const start = (await ctx.cursor<{ i: number } | null>(null))?.i || 0;
  await ctx.stage(kind === "neighborhood" ? "co-investors" : "synergistic funders", 0, funds.length);
  const port = new Set((await db().select({ n: S.portfolio.name }).from(S.portfolio)).map((p) => p.n.toLowerCase()));
  let i = start % Math.max(1, funds.length);
  for (let k = 0; k < funds.length && !ctx.outOfTime(); k++, i = (i + 1) % funds.length) {
    const f = funds[i];
    const name = shortName(f.name);
    const q = f.query || (COMMON_NAMES.has(f.name) ? `"${name}" (venture OR VC OR seed OR "Series A")` : `"${name}" (seed OR "Series A" OR raises OR led)`);
    const news = await F.googleNews(q, "14d");
    const seenCo = new Set<string>();
    for (const n of news.slice(0, 25)) {
      const d = dealFromHeadline(f.name, { title: n.title, text: n.text });
      // a new fund raised: only when the headline starts with the fund's name
      if (n.title.toLowerCase().startsWith(name.toLowerCase()) && /\b(raises|closes|announces|launches|debuts)\b.*\bfund\b|\bnew fund\b|\bfund (i{1,3}|iv|v|vi|\d)\b/i.test(n.title) && !POOL.test(n.title)) {
        const r = await db()
          .insert(S.fundItems)
          .values({ fundId: f.id, kind: "newfund", title: n.title, url: n.url, date: n.date ? new Date(n.date) : null, amount: d.money?.amount ?? null, currency: d.money?.currency || "$", source: n.outlet })
          .onConflictDoNothing()
          .returning({ id: S.fundItems.id });
        if (r.length) ctx.item();
        continue;
      }
      if (!d.company || POOL.test(n.title)) continue;
      // common names: keep only when the headline names a startup's round
      if (COMMON_NAMES.has(f.name) && d.round === "unknown" && !d.money) continue;
      // a deal whose headline doesn't name the fund is a possible match, and must be inside the thesis
      if (d.possible && !d.area) continue;
      if (f.focus === "broad" && !d.area) continue;
      const key = d.company.toLowerCase();
      if (seenCo.has(key)) continue;
      seenCo.add(key);
      const co = await companyByName(d.company);
      const r = await db()
        .insert(S.fundItems)
        .values({
          fundId: f.id,
          kind: "deal",
          title: n.title,
          url: n.url,
          date: n.date ? new Date(n.date) : null,
          company: d.company,
          round: d.round,
          amount: d.money?.amount ?? null,
          currency: d.money?.currency || "$",
          role: d.role,
          thesisArea: d.area,
          companyId: co?.id ?? null,
          possible: d.possible,
          source: n.outlet,
        })
        .onConflictDoNothing()
        .returning({ id: S.fundItems.id });
      if (r.length) ctx.item();
      // a synergistic funder in a round with Courtside moves to the Neighborhood (logged, with Undo)
      if (kind === "synergistic" && !d.possible && /courtside/i.test(`${n.title} ${n.text}`) && port.has(key)) {
        await db().update(S.funds).set({ kind: "neighborhood", lastSharedDate: (n.date || new Date().toISOString()).slice(0, 10), shared: [{ company: d.company, url: n.url, date: n.date?.slice(0, 10) }] }).where(eq(S.funds.id, f.id));
        await db().insert(S.changeLog).values({ kind: "fund-move", summary: `${f.name} moved to the Neighborhood: ${d.company}, with Courtside`, target: `fund:${f.id}`, before: { kind: "synergistic" }, after: { kind: "neighborhood", url: n.url } });
        ctx.change(`${f.name} moved to the Neighborhood`);
      }
    }
    // its own Form D for a new fund (synergistic funders with an EDGAR name)
    if (f.edgarName) {
      const hits = await F.edgarSearch(f.edgarName, "D", "2024-01-01");
      for (const h of hits.slice(0, 3)) {
        if (POOL.test(h.name)) continue;
        const url = `https://www.sec.gov/Archives/edgar/data/${Number(h.cik)}/${h.adsh.replace(/-/g, "")}/`;
        const r = await db()
          .insert(S.fundItems)
          .values({ fundId: f.id, kind: "newfund", title: `${h.name} filed a Form D`, url, date: h.date ? new Date(h.date + "T12:00:00Z") : null, source: "SEC EDGAR" })
          .onConflictDoNothing()
          .returning({ id: S.fundItems.id });
        if (r.length) ctx.item();
      }
    }
    // they said it: blog feeds and YouTube
    for (const url of f.feeds) {
      const fd = await F.feed(url, "fund-blogs");
      for (const it of fd.items.slice(0, 3)) await db().insert(S.fundItems).values({ fundId: f.id, kind: "said", title: it.title, url: it.link, date: it.date ? new Date(it.date) : null, source: fd.title || "Blog" }).onConflictDoNothing();
    }
    for (const ch of f.youtube) {
      const yt = await F.youtube(ch);
      for (const it of yt.items.slice(0, 3)) await db().insert(S.fundItems).values({ fundId: f.id, kind: "said", title: it.title, url: it.link, date: it.date ? new Date(it.date) : null, source: "YouTube" }).onConflictDoNothing();
    }
    // the Slow Ventures Creator Fund's newsletters (beehiiv, no public feed): the archive page, once a day
    if (/creator fund/i.test(f.name)) {
      for (const [base, src] of [
        ["https://www.meganlightcap.com/", "Megan Lightcap"],
        ["https://snailmail.slow.co/", "Snailmail"],
      ] as const) {
        for (const p of (await F.beehiiv(base, "beehiiv")).slice(0, 4)) await db().insert(S.fundItems).values({ fundId: f.id, kind: "said", title: p.title, url: p.url, date: p.date ? new Date(p.date) : null, source: src }).onConflictDoNothing();
      }
    }
    ctx.tick();
  }
  await ctx.saveCursor({ i });
  await db().execute(sql`select 1`);
}
