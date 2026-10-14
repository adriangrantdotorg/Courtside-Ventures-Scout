// Every read the pages make. Server-side only (pages, routes, jobs).
import { and, asc, desc, eq, gte, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/db";
import { buildIndex, linkify, type Entity, type Index, type Seg } from "./linkify";
import { areaLabel, domainOf, fmtMoney, pastStage, slugify, stageLabel } from "./format";
import { getSetting, getThreshold, type BuildProgress } from "./settings";
import { cleanCopy } from "./copy";
import { classify } from "./thesis";
export { cleanCopy };

const S = schema;

export type SignalOut = { id: number; type: string; source: string; title: string; url: string; date: string | null; domain: string };
export type CompanyCard = {
  id: number;
  name: string;
  domain: string | null;
  descSegs: Seg[];
  descSource: { label: string; url: string } | null;
  thesisArea: string | null;
  area: string;
  stage: string;
  stageText: string;
  amountText: string;
  whySegs: Seg[];
  score: number;
  breakdown: Record<string, number>;
  check: { text: string; tone: "ok" | "warn" | "plain" };
  portfolio: { text: string; href: string | null; kind: string; reason: string } | null;
  status: string;
  tracked: boolean;
  firstSeen: string;
  lastSignal: string | null;
  signals: SignalOut[];
  rank: number;
  votes: number;
  possible: boolean;
};

const SOURCE_NAMES: Record<string, string> = {
  "ycombinator.com": "Y Combinator",
  "sec.gov": "SEC EDGAR",
  "producthunt.com": "Product Hunt",
  "apps.apple.com": "App Store",
  "news.ycombinator.com": "Hacker News",
  "techcrunch.com": "TechCrunch",
  "courtsidevc.com": "Courtside",
  "medium.com": "Medium",
  "youtube.com": "YouTube",
  "github.com": "GitHub",
};
export function sourceName(url: string, fallback?: string): string {
  const d = domainOf(url);
  for (const k of Object.keys(SOURCE_NAMES)) if (d === k || d.endsWith("." + k)) return SOURCE_NAMES[k];
  return fallback || d;
}

async function rows<T>(q: ReturnType<typeof sql>): Promise<T[]> {
  const r = (await db().execute(q)) as unknown as { rows: T[] };
  return r.rows;
}

/* ---------- entity index for the linkifier ---------- */
export const entityIndex = cache(async (): Promise<Index> => {
  const list: Entity[] = [];
  try {
    const [cos, port, voices, funds, people] = await Promise.all([
      db().select({ id: S.companies.id, name: S.companies.name, aliases: S.companies.aliases }).from(S.companies).where(eq(S.companies.hidden, false)),
      db().select({ name: S.portfolio.name, url: S.portfolio.descriptionUrl, site: S.portfolio.site }).from(S.portfolio),
      db().select({ name: S.voices.name, site: S.voices.site, kind: S.voices.kind }).from(S.voices),
      db().select({ name: S.funds.name, slug: S.funds.slug, kind: S.funds.kind }).from(S.funds),
      db().select({ name: S.people.name, slug: S.people.slug }).from(S.people),
    ]);
    for (const c of cos) list.push({ name: c.name, aliases: (c.aliases || []).filter((a) => a.length > 3), href: `/company/${c.id}`, ext: false });
    for (const p of port) list.push({ name: p.name, aliases: [], href: p.url || p.site || "https://www.courtsidevc.com/portfolio", ext: true });
    for (const v of voices) list.push({ name: v.name, aliases: [], href: `/culture#${slugify(v.name)}`, ext: false });
    for (const f of funds) list.push({ name: f.name, aliases: [], href: `/${f.kind === "neighborhood" ? "neighborhood" : "synergistic-funders"}#${f.slug}`, ext: false });
    for (const p of people) list.push({ name: p.name, aliases: [], href: `/people#${p.slug}`, ext: false });
    for (const [n, h] of [
      ["Y Combinator", "https://www.ycombinator.com/companies"],
      ["Courtside", "/about"],
    ] as const)
      list.push({ name: n, aliases: [], href: h, ext: h.startsWith("http") });
  } catch {
    /* no database yet */
  }
  return buildIndex(list);
});

/* ---------- votes ---------- */
export async function voteCounts(keys: string[]): Promise<Record<string, number>> {
  if (!keys.length) return {};
  const pairs = keys.map((k) => k.split(":"));
  const types = [...new Set(pairs.map((p) => p[0]))];
  const ids = [...new Set(pairs.map((p) => p.slice(1).join(":")))];
  const r = await db()
    .select({ t: S.votes.itemType, i: S.votes.itemId, n: sql<number>`sum(${S.votes.value})::int` })
    .from(S.votes)
    .where(and(inArray(S.votes.itemType, types), inArray(S.votes.itemId, ids)))
    .groupBy(S.votes.itemType, S.votes.itemId);
  const out: Record<string, number> = {};
  for (const x of r) out[`${x.t}:${x.i}`] = Number(x.n);
  return out;
}

/* ---------- companies ---------- */
type CoRow = typeof S.companies.$inferSelect;

export async function companyCards(where: "thesis" | "all" | number[], limit?: number): Promise<CompanyCard[]> {
  const conds = [eq(S.companies.hidden, false)];
  if (where === "thesis") conds.push(isNotNull(S.companies.thesisArea));
  if (Array.isArray(where)) conds.push(inArray(S.companies.id, where.length ? where : [-1]));
  const q = db()
    .select()
    .from(S.companies)
    .where(and(...conds))
    .orderBy(desc(S.companies.score), desc(S.companies.lastSignal));
  const cos = limit ? await q.limit(limit) : await q;
  return toCards(cos);
}

export async function toCards(cos: CoRow[]): Promise<CompanyCard[]> {
  if (!cos.length) return [];
  const ids = cos.map((c) => c.id);
  const [sigs, idx, counts, port, stageCfg] = await Promise.all([
    db().select().from(S.signals).where(inArray(S.signals.companyId, ids)).orderBy(desc(S.signals.date)),
    entityIndex(),
    voteCounts(ids.map((i) => `company:${i}`)),
    db().select({ name: S.portfolio.name, url: S.portfolio.descriptionUrl }).from(S.portfolio),
    getSetting<{ minCheck: number; maxCheck: number }>("stage", { minCheck: 500000, maxCheck: 4000000 }),
  ]);
  const portUrl = new Map(port.map((p) => [p.name.toLowerCase(), p.url]));
  const byCo = new Map<number, SignalOut[]>();
  for (const s of sigs) {
    const list = byCo.get(s.companyId) || [];
    if (list.some((x) => x.url === s.url)) continue;
    list.push({ id: s.id, type: s.type, source: s.source, title: s.title, url: s.url, date: s.date ? s.date.toISOString() : null, domain: domainOf(s.url) });
    byCo.set(s.companyId, list);
  }
  return cos.map((c, i) => {
    const pc = c.portfolioCheck;
    const portfolio = pc
      ? {
          text: pc.kind === "competes" ? `Competes with ${pc.with}` : `Adjacent to ${pc.with}`,
          href: portUrl.get(pc.with.toLowerCase()) || null,
          kind: pc.kind,
          reason: cleanCopy(pc.reason),
        }
      : null;
    return {
      id: c.id,
      name: c.name,
      domain: c.domain,
      descSegs: linkify(cleanDesc(c.description), idx, { skip: [c.name] }),
      descSource: c.descriptionUrl ? { label: (byCo.get(c.id) || []).find((x) => x.url === c.descriptionUrl)?.source || sourceName(c.descriptionUrl), url: c.descriptionUrl } : null,
      thesisArea: c.thesisArea,
      area: areaLabel(c.thesisArea),
      stage: c.stage,
      stageText: stageLabel(c.stage) + (c.amount ? ` · ${fmtMoney(c.amount, c.currency)}` : ""),
      amountText: fmtMoney(c.amount, c.currency),
      whySegs: linkify(cleanCopy(c.whyFits || ""), idx, { skip: [c.name] }),
      score: c.score,
      breakdown: c.breakdown || {},
      check: checkFit(c, stageCfg),
      portfolio,
      status: c.status,
      tracked: c.tracked,
      firstSeen: c.firstSeen.toISOString(),
      lastSignal: c.lastSignal ? c.lastSignal.toISOString() : null,
      signals: byCo.get(c.id) || [],
      rank: i + 1,
      votes: counts[`company:${c.id}`] || 0,
      possible: c.possibleMatch,
    };
  });
}

function checkFit(c: CoRow, cfg: { minCheck: number; maxCheck: number }): CompanyCard["check"] {
  if (pastStage(c.stage)) return { text: "Past Courtside's stage", tone: "warn" };
  if (c.amount && c.currency === "$") {
    if (c.amount > cfg.maxCheck * 5) return { text: "Large round", tone: "plain" };
    return { text: "In range", tone: "ok" };
  }
  if (["pre-seed", "seed", "series-a"].includes(c.stage)) return { text: "In range", tone: "ok" };
  return { text: "Plausible", tone: "plain" };
}

/** The one-line description: the first sentence or two, never cut mid-sentence. */
function cleanDesc(s: string | null): string {
  if (!s) return "";
  const t = s.replace(/\s{2,}/g, " ").replace(/\s+\./g, ".").trim();
  const parts = t.split(/(?<=[.!?])\s+(?=[A-Z])/);
  let out = parts[0];
  if (out.length < 70 && parts[1] && out.length + parts[1].length < 200) out += " " + parts[1];
  return out;
}

export async function companyById(id: number) {
  const [c] = await db().select().from(S.companies).where(eq(S.companies.id, id)).limit(1);
  if (!c) return null;
  const [card] = await toCards([c]);
  const allRank = await rows<{ n: number }>(sql`select count(*)::int as n from companies where hidden = false and thesis_area is not null and score > ${c.score}`);
  card.rank = Number(allRank[0]?.n || 0) + 1;
  const [notes, similar, near] = await Promise.all([
    db().select().from(S.notes).where(eq(S.notes.companyId, id)).orderBy(desc(S.notes.createdAt)),
    c.thesisArea
      ? db()
          .select({ id: S.companies.id, name: S.companies.name, domain: S.companies.domain, why: S.companies.whyFits, score: S.companies.score })
          .from(S.companies)
          .where(and(eq(S.companies.thesisArea, c.thesisArea), ne(S.companies.id, id), eq(S.companies.hidden, false)))
          .orderBy(desc(S.companies.score))
          .limit(4)
      : Promise.resolve([]),
    db().select().from(S.portfolio).orderBy(asc(S.portfolio.name)),
  ]);
  const nearby = near.filter((p) => (c.thesisArea ? sectorArea(p.sector, p.description) === c.thesisArea : false)).slice(0, 4);
  return { row: c, card, notes, similar, nearby };
}

export function sectorArea(sector: string | null, desc?: string | null): string | null {
  const s = (sector || "").toLowerCase();
  const d = (desc || "").toLowerCase();
  if (s.includes("gaming")) return "gaming";
  if (s.includes("sport")) return /media|content|creator|dubb|video/.test(d) ? "media" : "sports";
  if (/health|wellness|fitness|recovery|longevity|clinic|nutrition|sleep|calorie|glucose/.test(d)) return "health";
  if (s.includes("lifestyle")) return "lifestyle";
  return null;
}

/* ---------- counts for the masthead ---------- */
export async function homeCounts() {
  const threshold = await getThreshold();
  const [r] = await rows<{ worth: number; total: number; today: number; formds: number; sponsors: number }>(sql`
    select
      (select count(*)::int from companies where hidden = false and thesis_area is not null and status <> 'passed' and score >= ${threshold}) as worth,
      (select count(*)::int from companies where hidden = false and thesis_area is not null) as total,
      (select count(*)::int from companies where hidden = false and thesis_area is not null and first_seen > now() - interval '24 hours') as today,
      (select count(*)::int from filings where thesis_area is not null and filed_at > now() - interval '7 days') as formds,
      (select count(*)::int from sponsors) as sponsors`);
  return { ...r, threshold };
}

export async function lastUpdated(): Promise<string | null> {
  const r = await rows<{ t: Date | string | null }>(sql`select max(finished_at) as t from job_runs where status in ('ok','partial')`);
  const t = r[0]?.t;
  if (t) return new Date(t).toISOString();
  const s = await rows<{ t: Date | string | null }>(sql`select max(updated_at) as t from settings where key = 'seededAt'`);
  return s[0]?.t ? new Date(s[0].t).toISOString() : null;
}

/* ---------- trends ---------- */
export type TrendCard = {
  id: number;
  slug: string;
  headline: string;
  whySegs: Seg[];
  area: string;
  thesisArea: string | null;
  weekly: number[];
  delta: number;
  weeks: number;
  isNew: boolean;
  up: boolean;
  sources: { url: string; title: string; date: string; source: string; voice?: string }[];
  faces: { name: string; href: string; img: string | null }[];
  lastSeen: string | null;
  tracked: boolean;
  votes: number;
  momentum: string;
};

export function weeklyOf(dates: string[], now = Date.now()): number[] {
  const w = [0, 0, 0, 0];
  for (const d of dates) {
    const t = new Date(d).getTime();
    if (isNaN(t)) continue;
    const age = Math.floor((now - t) / (7 * 86400000));
    if (age >= 0 && age < 4) w[3 - age]++;
  }
  return w;
}

export function velocity(weekly: number[]) {
  const recent = weekly[3] + weekly[2];
  const prior = weekly[1] + weekly[0];
  const delta = recent - prior;
  let weeks = 1;
  for (let i = 3; i > 0; i--) {
    if (weekly[i] >= weekly[i - 1] && weekly[i] > 0) weeks++;
    else break;
  }
  const isNew = prior === 0 && recent > 0;
  return { delta, weeks: Math.min(weeks, 4), isNew, up: delta >= 0 };
}

export async function trendCards(limit = 30): Promise<TrendCard[]> {
  const ts = await db().select().from(S.trends).orderBy(desc(S.trends.tracked), desc(S.trends.score)).limit(limit);
  if (!ts.length) return [];
  const [idx, counts, voices] = await Promise.all([
    entityIndex(),
    voteCounts(ts.map((t) => `trend:${t.id}`)),
    db().select({ name: S.voices.name, image: S.voices.image, site: S.voices.site }).from(S.voices),
  ]);
  const vmap = new Map(voices.map((v) => [v.name, v]));
  const now = Date.now();
  return ts.map((t) => {
    const weekly = t.weekly && t.weekly.some((x) => x > 0) ? t.weekly : weeklyOf(t.sources.map((s) => s.date), now);
    const v = velocity(weekly);
    const faces: TrendCard["faces"] = [];
    for (const s of t.sources) {
      const name = s.voice || (s.source === "voices" || s.source === "podcasts" ? guessVoice(s.url, voices.map((x) => x.name)) : null);
      if (!name || faces.some((f) => f.name === name)) continue;
      const vv = vmap.get(name);
      faces.push({ name, href: s.url, img: vv?.image || null });
      if (faces.length >= 3) break;
    }
    return {
      id: t.id,
      slug: t.slug,
      headline: cleanCopy(t.headline),
      whySegs: linkify(cleanCopy(t.why), idx),
      area: areaLabel(t.thesisArea),
      thesisArea: t.thesisArea,
      weekly,
      ...v,
      sources: orderSources(t.sources),
      faces,
      lastSeen: t.lastSeen ? t.lastSeen.toISOString() : null,
      tracked: t.tracked,
      votes: counts[`trend:${t.id}`] || 0,
      momentum: cleanCopy(t.momentum || ""),
    };
  });
}

function guessVoice(url: string, names: string[]): string | null {
  void url;
  void names;
  return null;
}

const SOURCE_ORDER = ["news", "industry", "google-trends", "trends", "hn", "formd", "voices", "podcasts"];
function orderSources<T extends { source: string; date: string }>(src: T[]): T[] {
  return [...src].sort((a, b) => {
    const ia = SOURCE_ORDER.indexOf(a.source);
    const ib = SOURCE_ORDER.indexOf(b.source);
    if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return b.date.localeCompare(a.date);
  });
}

/* ---------- sponsors ---------- */
export type SponsorCard = {
  id: number;
  key: string;
  brand: string;
  site: string | null;
  domain: string;
  fitTag: string;
  whatItIs: string | null;
  shows: string[];
  firstSeen: string | null;
  lastSeen: string | null;
  seen90: number;
  stamp: string;
  fresh: boolean;
  hot: boolean;
  sightings: { show: string; date: string | null; url: string; evidence: string | null }[];
  votes: number;
};

function spanText(from: Date | null, now: number): string {
  if (!from) return "";
  const days = Math.max(1, Math.round((now - from.getTime()) / 86400000));
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  if (days < 365) return `${Math.round(days / 30.44)}mo`;
  return `${Math.round(days / 365)}y`;
}

export async function sponsorCards(limit?: number): Promise<SponsorCard[]> {
  const sp = await db().select().from(S.sponsors);
  if (!sp.length) return [];
  const sights = await db().select().from(S.sponsorSightings).orderBy(desc(S.sponsorSightings.date));
  const counts = await voteCounts(sp.map((s) => `sponsor:${s.id}`));
  const now = Date.now();
  const by = new Map<number, typeof sights>();
  for (const s of sights) {
    const l = by.get(s.sponsorId) || [];
    l.push(s);
    by.set(s.sponsorId, l);
  }
  const cards = sp.map((s) => {
    const list = by.get(s.id) || [];
    const shows = [...new Set(list.map((x) => x.show))];
    const recentShows = new Set(list.filter((x) => x.date && now - x.date.getTime() < 7 * 86400000).map((x) => x.show));
    const olderShows = new Set(list.filter((x) => x.date && now - x.date.getTime() >= 7 * 86400000).map((x) => x.show));
    const newShow = [...recentShows].find((x) => !olderShows.has(x));
    const fresh = !!s.firstSeen && now - s.firstSeen.getTime() < 30 * 86400000;
    const stamp = newShow && olderShows.size > 0 ? `${plural(shows.length, "show")} · new on ${newShow}` : `${plural(shows.length, "show")} in ${spanText(s.firstSeen, now)}`;
    const seen90 = list.filter((x) => x.date && now - x.date.getTime() < 90 * 86400000).length;
    return {
      id: s.id,
      key: s.key,
      brand: s.brand,
      site: s.site,
      domain: domainOf(s.site),
      fitTag: s.fitTag,
      whatItIs: s.whatItIs,
      shows,
      firstSeen: s.firstSeen?.toISOString() || null,
      lastSeen: s.lastSeen?.toISOString() || null,
      seen90,
      stamp,
      fresh: fresh || !!newShow,
      hot: shows.length >= 2 && fresh,
      sightings: list.slice(0, 12).map((x) => ({ show: x.show, date: x.date?.toISOString() || null, url: x.url, evidence: x.evidence })),
      votes: counts[`sponsor:${s.id}`] || 0,
    };
  });
  cards.sort((a, b) => b.shows.length - a.shows.length || (b.lastSeen || "").localeCompare(a.lastSeen || ""));
  return limit ? cards.slice(0, limit) : cards;
}

function plural(n: number, w: string) {
  return `${n} ${n === 1 ? w : w + "s"}`;
}

/* ---------- culture ---------- */
export type Overlap = { entity: string; slug: string; kind: string; area: string | null; voices: string[]; quotes: { voice: string; quote: string | null; url: string; date: string | null; stance: string }[]; score: number; votes: number; companyId: number | null };

export async function cultureOverlaps(days = 30, limit = 40): Promise<Overlap[]> {
  const since = new Date(Date.now() - days * 86400000);
  const ms = await db().select().from(S.mentions).where(gte(S.mentions.date, since)).orderBy(desc(S.mentions.date));
  const groups = new Map<string, typeof ms>();
  for (const m of ms) {
    const k = m.entity.trim();
    const l = groups.get(k.toLowerCase()) || [];
    l.push(m);
    groups.set(k.toLowerCase(), l);
  }
  const cos = await db().select({ id: S.companies.id, name: S.companies.name }).from(S.companies);
  const coMap = new Map(cos.map((c) => [c.name.toLowerCase(), c.id]));
  const out: Overlap[] = [];
  for (const [, l] of groups) {
    const voices = [...new Set(l.map((x) => x.voice))];
    const kind = l[0].kind;
    const recent = l.filter((x) => x.date && Date.now() - x.date.getTime() < 7 * 86400000).length;
    const score = voices.length * 10 + recent * 2 + (kind === "startup" ? 6 : kind === "portfolio" ? 4 : 0);
    const quotes = voices.map((v) => l.find((x) => x.voice === v)!).map((x) => ({ voice: x.voice, quote: x.quote, url: x.url, date: x.date?.toISOString() || null, stance: x.stance }));
    const area = classify(`${l[0].entity} ${quotes.map((q) => q.quote || "").join(" ")}`).area;
    out.push({ entity: l[0].entity, slug: slugify(l[0].entity), kind, area, voices, quotes, score, votes: 0, companyId: coMap.get(l[0].entity.toLowerCase()) || null });
  }
  out.sort((a, b) => b.score - a.score);
  const top = out.slice(0, limit);
  const counts = await voteCounts(top.map((o) => `culture:${o.slug}`));
  for (const o of top) o.votes = counts[`culture:${o.slug}`] || 0;
  return top;
}

/* ---------- filings ---------- */
export async function filingRows(opts: { thesisOnly?: boolean; limit?: number } = {}) {
  const conds = [ne(S.filings.form, "fund")];
  if (opts.thesisOnly !== false) conds.push(isNotNull(S.filings.thesisArea));
  const q = db()
    .select()
    .from(S.filings)
    .where(and(...conds))
    .orderBy(desc(S.filings.filedAt));
  const r = opts.limit ? await q.limit(opts.limit) : await q;
  const counts = await voteCounts(r.map((f) => `filing:${f.id}`));
  return r.map((f) => ({ ...f, votes: counts[`filing:${f.id}`] || 0 }));
}

/* ---------- funds ---------- */
export async function fundFeed(kind: "neighborhood" | "synergistic", limit = 60) {
  const fs = await db().select().from(S.funds).where(eq(S.funds.kind, kind));
  const ids = fs.map((f) => f.id);
  if (!ids.length) return { funds: fs, items: [] as ((typeof S.fundItems.$inferSelect) & { fund: (typeof fs)[number]; votes: number; inPipeline: boolean; score: number | null })[] };
  const items = await db()
    .select()
    .from(S.fundItems)
    .where(inArray(S.fundItems.fundId, ids))
    .orderBy(desc(S.fundItems.date))
    .limit(limit * 4);
  const fmap = new Map(fs.map((f) => [f.id, f]));
  const cos = await db().select({ id: S.companies.id, name: S.companies.name, score: S.companies.score }).from(S.companies);
  const cmap = new Map(cos.map((c) => [c.name.toLowerCase(), c]));
  // broad funds only show deals inside the thesis; duplicate headlines collapse per company
  const seen = new Set<string>();
  const kept = items.filter((it) => {
    const f = fmap.get(it.fundId)!;
    if (it.kind === "deal" && f.focus === "broad" && !it.thesisArea) return false;
    if (it.kind === "deal" && it.possible && !it.thesisArea) return false;
    const key = it.kind + ":" + (it.company || it.title).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // neighborhood: funds from the most recent shared deal first, then by date
  if (kind === "neighborhood") {
    kept.sort((a, b) => {
      const fa = fmap.get(a.fundId)!.lastSharedDate || "";
      const fb = fmap.get(b.fundId)!.lastSharedDate || "";
      const da = a.date?.getTime() || 0;
      const dbb = b.date?.getTime() || 0;
      if (Math.abs(da - dbb) > 14 * 86400000) return dbb - da;
      return fb.localeCompare(fa) || dbb - da;
    });
  }
  const top = kept.slice(0, limit);
  const counts = await voteCounts(top.map((i) => `fund_item:${i.id}`));
  return {
    funds: fs,
    items: top.map((i) => {
      const c = i.company ? cmap.get(i.company.toLowerCase()) : undefined;
      return { ...i, fund: fmap.get(i.fundId)!, votes: counts[`fund_item:${i.id}`] || 0, inPipeline: !!c, score: c?.score ?? null };
    }),
  };
}

/* ---------- Courtside ---------- */
export async function courtsideLatest() {
  const [medium] = await db().select().from(S.courtsidePosts).where(eq(S.courtsidePosts.kind, "medium")).orderBy(desc(S.courtsidePosts.date)).limit(1);
  const [fourth] = await db().select().from(S.courtsidePosts).where(eq(S.courtsidePosts.kind, "fourthq")).orderBy(desc(S.courtsidePosts.date)).limit(1);
  return [medium, fourth].filter(Boolean);
}

/* ---------- backtests ---------- */
export async function backtestRows(courtsideOnly = true) {
  const r = await db()
    .select()
    .from(S.backtests)
    .where(courtsideOnly ? eq(S.backtests.courtside, true) : sql`true`)
    .orderBy(desc(S.backtests.announceDate));
  return r.map((b) => ({ ...b, evidence: b.evidence.map((e) => ({ ...e, note: cleanCopy(e.note) })) }));
}

/* ---------- ticker ---------- */
export type TickerItem = { href: string; where: string; label: string; delta: string; tone: "up" | "dn" | "gd"; domain?: string };

export async function tickerItems(): Promise<TickerItem[]> {
  const out: TickerItem[] = [];
  const [movers, files, sps, trs, wins, fitems] = await Promise.all([
    db()
      .select({ id: S.companies.id, name: S.companies.name, score: S.companies.score, prev: S.companies.prevScore, domain: S.companies.domain, amount: S.companies.amount, currency: S.companies.currency, stage: S.companies.stage })
      .from(S.companies)
      .where(and(eq(S.companies.hidden, false), isNotNull(S.companies.thesisArea)))
      .orderBy(desc(S.companies.score))
      .limit(5),
    db().select().from(S.filings).where(isNotNull(S.filings.thesisArea)).orderBy(desc(S.filings.filedAt)).limit(3),
    sponsorCards(4),
    db().select().from(S.trends).orderBy(desc(S.trends.score)).limit(3),
    db().select().from(S.backtests).where(eq(S.backtests.verdict, "win")).orderBy(desc(S.backtests.leadDays)).limit(2),
    db()
      .select({ id: S.fundItems.id, title: S.fundItems.title, company: S.fundItems.company, amount: S.fundItems.amount, currency: S.fundItems.currency, kind: S.fundItems.kind, fundKind: S.funds.kind, slug: S.funds.slug, fund: S.funds.name, area: S.fundItems.thesisArea })
      .from(S.fundItems)
      .innerJoin(S.funds, eq(S.funds.id, S.fundItems.fundId))
      .where(and(isNotNull(S.fundItems.thesisArea), eq(S.fundItems.possible, false)))
      .orderBy(desc(S.fundItems.date))
      .limit(2),
  ]);
  for (const c of movers.slice(0, 3)) {
    const d = c.prev > 0 ? c.score - c.prev : 0;
    out.push({ href: `/company/${c.id}`, where: `${c.name} in Scout`, label: c.name, delta: d !== 0 ? `${d > 0 ? "▲" : "▼"} ${c.score}%` : `▲ ${c.score}%`, tone: d < 0 ? "dn" : "up", domain: c.domain || undefined });
  }
  for (const f of files) {
    const amt = fmtMoney(f.amountSold || f.amountOffered, f.currency);
    out.push({ href: `/throw-some-ds#f${f.id}`, where: "that filing on Throw Some D's on it", label: `Form ${f.form.replace(/\/A$/, "")} · ${f.issuer}`, delta: amt || "new", tone: "gd", domain: "sec.gov" });
  }
  for (const s of sps.slice(0, 3)) out.push({ href: `/sponsors#${s.key}`, where: `${s.brand} on Sponsor Radar`, label: s.brand, delta: `${s.shows.length} shows`, tone: "up", domain: s.domain || undefined });
  for (const t of trs) {
    const w = weeklyOf(t.sources.map((s) => s.date));
    const v = velocity(w);
    out.push({ href: `/trends#${t.slug}`, where: "that trend on Trends", label: t.term, delta: `${v.up ? "▲" : "▼"} ${v.isNew ? "new" : v.weeks + " wk"}`, tone: v.up ? "up" : "dn" });
  }
  for (const f of fitems) {
    const amt = fmtMoney(f.amount, f.currency);
    out.push({ href: `/${f.fundKind === "neighborhood" ? "neighborhood" : "synergistic-funders"}#${f.slug}`, where: `${f.fund}`, label: `${f.fund} · ${f.company || "deal"}`, delta: amt || f.kind, tone: "gd" });
  }
  for (const b of wins) out.push({ href: `/backtest#${b.slug}`, where: "that card on Backtest", label: `Backtest · ${b.company}`, delta: `${b.leadDays} d early`, tone: "up", domain: b.domain || undefined });
  return out;
}

/* ---------- build progress ---------- */
export async function buildProgress(): Promise<BuildProgress | null> {
  return getSetting<BuildProgress | null>("build_progress", null);
}

/* ---------- jobs ---------- */
export async function latestJobRuns() {
  return rows<{ job: string; started_at: string; finished_at: string | null; status: string; stage: string | null; done: number; total: number; items: number; errors: number; ai_calls: number; log: string | null }>(sql`
    select distinct on (job) job, started_at, finished_at, status, stage, done, total, items, errors, ai_calls, log
    from job_runs order by job, started_at desc`);
}

export { slugify, areaLabel, stageLabel };
