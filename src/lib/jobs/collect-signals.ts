// Startup signals: SEC Form D / Form C, Hacker News, Y Combinator, Product Hunt, App Store charts,
// funding news, industry RSS, Google Trends, Courtside's own posts, tracked-name mentions.
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db, schema as S } from "@/db";
import * as F from "../sources/fetchers";
import { classify, DROP_INDUSTRY, THESIS_INDUSTRY, NOT_CONSUMER, INCUMBENT } from "../thesis";
import { upsertCompany, subjectOf, stageOf, moneyOf, isGenericName, cleanName } from "../companies";
import { saveItems } from "./collect-media";
import { getSetting, setSetting, extraSourcesOn, sourcesOff, DEFAULT_QUERIES } from "../settings";
import { domainOf } from "../format";
import type { Ctx } from "./runner";

const DAY = 86400000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export const INDUSTRY_FEEDS: [string, string][] = [
  ["Front Office Sports", "https://frontofficesports.com/feed/"],
  ["Sportico", "https://www.sportico.com/feed/"],
  ["TechCrunch Venture", "https://techcrunch.com/category/venture/feed/"],
  ["Crunchbase News", "https://news.crunchbase.com/feed/"],
  ["Passionfruit", "https://www.passionfru.it/feed"],
  ["Tubefilter", "https://www.tubefilter.com/feed/"],
  ["Variety", "https://variety.com/feed/"],
  ["Deadline", "https://deadline.com/feed/"],
  ["Puck", "https://puck.news/feed/"],
  ["GamesIndustry.biz", "https://www.gamesindustry.biz/feed"],
  ["The Verge", "https://www.theverge.com/rss/index.xml"],
];

const FUNDING = /\b(raises|raised|secures|closes|nabs|bags|funding|seed round|pre-seed|series a)\b/i;

/** A funding headline → a company signal, when the company is the subject and the story is inside the thesis. */
async function fromHeadline(ctx: Ctx, h: { title: string; url: string; date: string | null; text?: string; outlet?: string }, source: string) {
  if (!FUNDING.test(h.title)) return;
  const name = subjectOf(h.title);
  if (!name || INCUMBENT.test(name)) return;
  if (NOT_CONSUMER.test(h.title)) return;
  const c = classify(`${h.title}. ${h.text || ""}`);
  if (!c.area) return;
  const stage = stageOf(h.title);
  if (stage === "unknown" && !moneyOf(h.title)) return; // a funding story names a round or an amount
  if (stage === "later" || stage === "series-b") return; // follow-on territory: never a new card from news
  const money = moneyOf(h.title);
  const r = await upsertCompany({
    name,
    thesisArea: c.area,
    stage,
    amount: money?.amount ?? null,
    currency: money?.currency || "$",
    description: h.text && h.text.length > 40 ? h.text : null,
    descriptionUrl: h.text && h.text.length > 40 ? h.url : null,
    signal: { type: "news", source: h.outlet || source, title: h.title, url: h.url, date: h.date ? new Date(h.date) : null },
  });
  if (r) {
    ctx.item();
    if (r.created) ctx.change(`New company: ${name}`);
  }
}

export async function stageSec(ctx: Ctx, opts: { days?: number; maxDocs?: number } = {}) {
  const seen = await getSetting<string[]>("secIndexDays", []);
  const today = new Date();
  const days: Date[] = [];
  for (let k = 1; k <= 7 && days.length < (opts.days ?? 2); k++) {
    const d = new Date(today.getTime() - k * DAY);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    if (!seen.includes(ymd(d))) days.push(d);
  }
  for (const day of days) {
    if (ctx.outOfTime()) break;
    const rows = await F.secDailyIndex(day);
    if (!rows.length) continue;
    const existing = new Set(
      (await db().select({ a: S.filings.accession }).from(S.filings).where(inArray(S.filings.accession, rows.map((r) => r.accession).slice(0, 2000)))).map((x) => x.a),
    );
    // name-first triage: thesis words in the issuer name, or Form C (consumer crowdfunding)
    const cand = rows.filter((r) => !existing.has(r.accession) && !INCUMBENT.test(r.company) && !/\b(fund|lp|l\.p\.|reit|capital partners|holdings|properties|realty|trust|spv|a series of|feeder|opportunity|offshore|master|co-invest|bank|energy|oil|gas|mining|group|pharma|pharmaceuticals|therapeutics|biosciences|medical)\b/i.test(r.company));
    const max = opts.maxDocs ?? 220;
    const pick = cand.slice(0, max);
    await ctx.stage(`SEC filings for ${ymd(day)}`, 0, pick.length);
    for (const r of pick) {
      if (ctx.outOfTime()) break;
      ctx.tick();
      const doc = await F.secPrimary(r.primaryXml);
      if (!doc || doc.isFund) continue;
      if (doc.industry && DROP_INDUSTRY.test(doc.industry)) continue;
      const nameArea = classify(`${doc.issuer} ${doc.website || ""}`);
      const indArea = doc.industry ? THESIS_INDUSTRY[doc.industry] : null;
      const area = nameArea.area || indArea || null;
      const form = r.form.startsWith("C") ? "C" : "D";
      if (!area && form === "D") continue;
      const issuer = cleanName(doc.issuer);
      const indexUrl = `https://www.sec.gov/Archives/edgar/data/${r.cik}/${r.accession.replace(/-/g, "")}/`;
      const [f] = await db()
        .insert(S.filings)
        .values({
          accession: r.accession,
          form: r.form,
          issuer,
          cik: r.cik,
          industry: doc.industry,
          amountSold: doc.amountSold,
          amountOffered: doc.amountOffered,
          firstSale: doc.firstSale,
          filedAt: new Date(r.date + "T12:00:00Z"),
          related: doc.related,
          thesisArea: area,
          confidence: area ? Math.max(nameArea.confidence, indArea ? 0.45 : 0) : 0,
          url: indexUrl,
          website: doc.website,
        })
        .onConflictDoNothing()
        .returning({ id: S.filings.id });
      if (!f) continue;
      ctx.item();
      const amt = doc.amountSold || doc.amountOffered;
      const bigEnough = form === "C" ? (amt || 0) >= 100_000 : (amt || 0) >= 250_000 && Math.max(nameArea.confidence, indArea ? 0.6 : 0) >= 0.57;
      if (area && bigEnough && !isGenericName(issuer)) {
        const up = await upsertCompany({
          name: issuer,
          domain: doc.website,
          thesisArea: area,
          amount: amt && amt < 50_000_000 ? amt : null,
          signal: { type: form === "C" ? "formc" : "formd", source: "SEC EDGAR", title: `Form ${form}: ${issuer}${amt ? ` · ${Math.round(amt / 1e5) / 10}M` : ""}`, url: indexUrl, date: new Date(r.date + "T12:00:00Z") },
        });
        if (up) await db().update(S.filings).set({ companyId: up.id }).where(eq(S.filings.id, f.id));
      }
    }
    seen.push(ymd(day));
    await setSetting("secIndexDays", seen.slice(-60));
  }
  // "Before any press": one news lookup per new thesis filing (cap 12 a run)
  const fresh = await db()
    .select()
    .from(S.filings)
    .where(and(isNotNull(S.filings.thesisArea), sql`${S.filings.filedAt} > now() - interval '10 days'`, eq(S.filings.beforePress, false)))
    .limit(12);
  for (const f of fresh) {
    if (ctx.outOfTime()) break;
    const n = await F.googleNews(`"${f.issuer}"`, "60d");
    if (!n.length) await db().update(S.filings).set({ beforePress: true }).where(eq(S.filings.id, f.id));
  }
}

export async function stageQuick(ctx: Ctx) {
  // Hacker News Show HN
  await ctx.stage("Hacker News", 0, 1);
  for (const h of await F.hnShow()) {
    const t = h.title.replace(/^Show HN:\s*/i, "");
    const c = classify(t);
    if (!c.area || c.confidence < 0.7 || !h.url || NOT_CONSUMER.test(t)) continue;
    const name = t.split(/\s[–—:-]\s|:\s/)[0].trim();
    if (isGenericName(name) || name.split(" ").length > 4) continue;
    const r = await upsertCompany({ name, domain: h.url, thesisArea: c.area, description: t, descriptionUrl: `https://news.ycombinator.com/item?id=${h.id}`, signal: { type: "hn", source: "Hacker News", title: h.title, url: `https://news.ycombinator.com/item?id=${h.id}`, date: new Date(h.date) } });
    if (r) ctx.item();
  }
  ctx.tick();
  // Product Hunt
  await ctx.stage("Product Hunt", 0, 1);
  for (const p of await F.productHunt()) {
    const text = `${p.title}. ${p.content.replace(/<[^>]+>/g, " ")}`;
    const c = classify(text);
    if (!c.area || c.confidence < 0.7 || NOT_CONSUMER.test(text)) continue;
    const name = p.title.replace(/^Launched on Product Hunt:\s*/i, "").split(/\s[–—:-]\s/)[0].trim();
    if (INCUMBENT.test(name)) continue;
    const r = await upsertCompany({ name, thesisArea: c.area, description: p.content.replace(/<[^>]+>/g, " ").trim().slice(0, 300), descriptionUrl: p.link, signal: { type: "producthunt", source: "Product Hunt", title: p.title, url: p.link, date: p.date ? new Date(p.date) : null } });
    if (r) ctx.item();
  }
  ctx.tick();
}

export async function stageYC(ctx: Ctx) {
  await ctx.stage("Y Combinator", 0, 1);
  const all = await F.ycAll();
  const since = Date.now() / 1000 - 75 * 86400;
  for (const c of all.filter((x) => x.launchedAt > since && F && x.website)) {
    if (ctx.outOfTime()) break;
    const consumer = [...c.industries, ...c.tags].some((x) => /consumer|gaming|content|media|entertainment/i.test(x)) && ![...c.industries, ...c.tags].some((x) => /b2b|infrastructure|healthcare it|enterprise|operations|supply chain|industrials|smb|developer tools/i.test(x));
    if (!consumer) continue;
    const cl = classify(`${c.name}. ${c.oneLiner}. ${c.long} ${c.industries.join(" ")}`);
    if (!cl.area) continue;
    const url = `https://www.ycombinator.com/companies/${c.slug}`;
    const r = await upsertCompany({ name: c.name, domain: c.website, thesisArea: cl.area, stage: "pre-seed", description: `${c.oneLiner}. ${c.long}`.slice(0, 400), descriptionUrl: url, signal: { type: "yc", source: "Y Combinator", title: `YC ${c.batch}: ${c.oneLiner}`, url, date: new Date(c.launchedAt * 1000) } });
    if (r) ctx.item();
  }
}

export async function stageAppStore(ctx: Ctx) {
  const prev = await getSetting<Record<string, number>>("appRanks", {});
  const next: Record<string, number> = {};
  const genres = Object.keys(F.APP_GENRES);
  await ctx.stage("App Store charts", 0, genres.length);
  let lookups = 0;
  for (const g of genres) {
    const apps = await F.appChart(g);
    ctx.tick();
    for (const a of apps) {
      const k = `${g}:${a.id}`;
      next[k] = a.rank;
      const was = prev[k];
      const climbing = (was === undefined && Object.keys(prev).length > 0 && a.rank <= 60) || (was !== undefined && was - a.rank >= 15);
      if (!climbing) continue;
      const rel = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      if (!rel || Date.now() - rel > 150 * DAY) continue; // new apps, not incumbents
      if (INCUMBENT.test(a.name) || INCUMBENT.test(a.developer) || /[^\x00-\u024f\s\p{P}\p{S}]/u.test(a.name)) continue;
      const cl = classify(`${a.name}. ${a.summary}. ${a.category}`);
      if (!cl.area || cl.confidence < 0.7 || lookups > 12) continue;
      lookups++;
      const lk = await F.appLookup(a.id);
      const r = await upsertCompany({
        name: a.name.split(/\s[–—:-]\s|:\s/)[0],
        domain: lk?.sellerUrl || null,
        thesisArea: cl.area,
        description: a.summary.slice(0, 300),
        descriptionUrl: a.link,
        signal: { type: "appstore", source: "App Store", title: `${a.name} is #${a.rank} in ${F.APP_GENRES[g]}${was ? ` (was #${was})` : ""}`, url: a.link, date: new Date() },
      });
      if (r) ctx.item();
    }
  }
  if (Object.keys(next).length) await setSetting("appRanks", next);
}

export async function stageNews(ctx: Ctx, queriesMax = 6) {
  const qs = (await getSetting<string[]>("thesisQueries", DEFAULT_QUERIES)).slice(0, queriesMax);
  await ctx.stage("funding news", 0, qs.length);
  for (const q of qs) {
    if (ctx.outOfTime()) break;
    const items = await F.googleNews(`(${q}) ("pre-seed" OR seed OR "Series A")`, "7d");
    await saveItems(items.map((n) => ({ kind: "news", source: n.outlet || "Google News", title: n.title, url: n.url, date: n.date, text: n.text })));
    for (const n of items) await fromHeadline(ctx, { title: n.title, url: n.url, date: n.date, text: n.text, outlet: n.outlet }, "Google News");
    ctx.tick();
  }
}

export async function stageIndustry(ctx: Ctx) {
  const off = await sourcesOff();
  const feeds = INDUSTRY_FEEDS.filter(([n]) => !off.includes(n));
  await ctx.stage("industry news", 0, feeds.length);
  for (const [name, url] of feeds) {
    if (ctx.outOfTime()) break;
    const f = await F.feed(url, name);
    const items = f.items.slice(0, 40);
    await saveItems(items.map((i) => ({ kind: "industry", source: name, title: i.title, url: i.link, date: i.date, text: (i.description || "").replace(/<[^>]+>/g, " ").slice(0, 1500) })));
    for (const i of items) await fromHeadline(ctx, { title: i.title, url: i.link, date: i.date, text: (i.description || "").replace(/<[^>]+>/g, " ").slice(0, 400), outlet: name }, name);
    ctx.tick();
  }
}

export async function stageTrendsFeed(ctx: Ctx) {
  await ctx.stage("Google Trends", 0, 1);
  const t = await F.googleTrends();
  const keep = t.filter((x) => classify(`${x.term} ${x.news.map((n) => n.title).join(" ")}`).area);
  await saveItems(keep.map((x) => ({ kind: "gtrends", source: "Google Trends", title: x.term, url: x.news[0]?.url || `https://trends.google.com/trends/explore?q=${encodeURIComponent(x.term)}&geo=US`, date: x.date, text: x.news.map((n) => n.title).join(" · ") })));
  ctx.item(keep.length);
  ctx.tick();
}

export async function stageCourtside(ctx: Ctx) {
  await ctx.stage("Courtside's posts", 0, 2);
  const m = await F.feed("https://medium.com/feed/@courtsidevc", "courtside-medium");
  for (const it of m.items) {
    const r = await db()
      .insert(S.courtsidePosts)
      .values({ title: it.title, url: it.link.split("?")[0], date: it.date ? new Date(it.date) : null, kind: "medium", summary: it.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220) })
      .onConflictDoNothing()
      .returning({ id: S.courtsidePosts.id });
    if (r.length) ctx.change(`New Courtside post: ${it.title}`);
  }
  ctx.tick();
  const q = await F.beehiiv("https://www.thefourthquarter.co/", "fourth-quarter");
  for (const p of q) await db().insert(S.courtsidePosts).values({ title: p.title, url: p.url, date: p.date ? new Date(p.date) : null, kind: "fourthq", summary: p.summary }).onConflictDoNothing();
  ctx.tick();
}

/** Mention flags: every tracked company, by name and domain, in the news and on Hacker News. */
export async function stageTracked(ctx: Ctx) {
  const tracked = await db().select().from(S.companies).where(eq(S.companies.tracked, true)).limit(25);
  if (!tracked.length) return;
  await ctx.stage("tracked companies", 0, tracked.length);
  const extra = await extraSourcesOn();
  for (const c of tracked) {
    if (ctx.outOfTime()) break;
    const news = await F.googleNews(`"${c.name}"${c.domain ? ` OR "${c.domain}"` : ""}`, "2d");
    for (const n of news.slice(0, 5)) {
      if (!n.title.toLowerCase().includes(c.name.toLowerCase())) continue;
      await db().insert(S.signals).values({ companyId: c.id, type: "news", source: n.outlet || "News", title: n.title, url: n.url, date: n.date ? new Date(n.date) : null }).onConflictDoNothing();
      ctx.item();
    }
    const hn = await F.hnSearch(c.name);
    for (const h of hn.slice(0, 3)) {
      if (!h.title.toLowerCase().includes(c.name.toLowerCase()) || Date.now() - new Date(h.date).getTime() > 3 * DAY) continue;
      await db().insert(S.signals).values({ companyId: c.id, type: "hn", source: "Hacker News", title: h.title, url: `https://news.ycombinator.com/item?id=${h.id}`, date: new Date(h.date) }).onConflictDoNothing();
    }
    if (extra) {
      for (const g of (await F.gdelt(`"${c.name}"`)).slice(0, 3))
        await db().insert(S.signals).values({ companyId: c.id, type: "news", source: g.domain, title: g.title, url: g.url, date: g.date ? new Date(g.date) : null }).onConflictDoNothing();
    }
    // the homepage check: title, description, careers link; "site changed" when they move
    if (c.domain) {
      const meta = await F.metaDescription(`https://${c.domain}`);
      const snap = { description: meta };
      const prev = c.siteSnapshot as { description?: string | null } | null;
      if (prev && meta && prev.description !== meta)
        await db().insert(S.signals).values({ companyId: c.id, type: "site", source: c.domain, title: `Site changed: "${meta}"`, url: `https://${c.domain}`, date: new Date() }).onConflictDoNothing();
      await db().update(S.companies).set({ siteSnapshot: snap }).where(eq(S.companies.id, c.id));
    }
    ctx.tick();
  }
}

export async function stageExtra(ctx: Ctx) {
  if (!(await extraSourcesOn())) return;
  await ctx.stage("GitHub and GDELT", 0, 2);
  const since = ymd(new Date(Date.now() - 14 * DAY));
  for (const q of ["game", "sports", "creator"]) {
    for (const r of await F.github(q, since)) {
      const c = classify(`${r.name} ${r.description}`);
      if (!c.area || r.stars < 50) continue;
      await saveItems([{ kind: "github", source: "GitHub", title: `${r.owner}/${r.name}: ${r.description}`, url: r.url, date: r.created }]);
    }
  }
  ctx.tick();
  for (const g of await F.gdelt('(startup OR "seed round") (sports OR gaming OR creator OR wellness)')) {
    await saveItems([{ kind: "news", source: g.domain, title: g.title, url: g.url, date: g.date }]);
    await fromHeadline(ctx, { title: g.title, url: g.url, date: g.date, outlet: g.domain }, "GDELT");
  }
  ctx.tick();
}

export async function collectSignals(ctx: Ctx) {
  const stages: [string, (c: Ctx) => Promise<void>][] = [
    ["sec", (c) => stageSec(c)],
    ["quick", stageQuick],
    ["yc", stageYC],
    ["appstore", stageAppStore],
    ["news", (c) => stageNews(c)],
    ["industry", stageIndustry],
    ["gtrends", stageTrendsFeed],
    ["courtside", stageCourtside],
    ["tracked", stageTracked],
    ["extra", stageExtra],
  ];
  for (const [name, fn] of stages) {
    if (ctx.outOfTime()) {
      ctx.error(`stopped before ${name}: out of time, resumes tomorrow`);
      break;
    }
    try {
      await fn(ctx);
    } catch (e) {
      ctx.error(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

export { domainOf };
