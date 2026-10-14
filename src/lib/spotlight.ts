// The day's one call, picked by rules (never AI). Recomputed after every job and Refresh Now,
// and from the live database on each visit (cached 5 minutes).
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { getSetting, setSetting } from "./settings";
import { areaLabel, fmtMoney } from "./format";
import { velocity, weeklyOf } from "./queries";

export type Spotlight = {
  kind: string;
  rule: string;
  before: string;
  link: { text: string; href: string };
  after: string;
  source: { label: string; url: string; domain: string };
  itemKey: string;
  computedAt: string;
};

export const RULES: Record<string, string> = {
  "Form D before any press": "A company inside the thesis filed a Form D with the SEC, and a news search finds nothing on it yet.",
  "New sponsor on 3 shows": "A brand started buying ads on three or more of the tracked shows within the last two weeks.",
  "Steepest trend": "The trend whose mentions rose the most over the last four weeks, across at least two independent sources.",
  "Biggest score jump": "The company whose thesis-fit score rose the most since yesterday (it must have been seen for more than two days).",
  "Neighborhood deal": "A fund that has invested alongside Courtside, or one that invests inside the thesis, just backed a company inside the thesis.",
  "New fund raised": "A synergistic funder or co-investor filed or announced a new fund.",
};

const DAY = 86400000;

export async function computeSpotlight(): Promise<Spotlight | null> {
  const now = Date.now();
  const cands: (Spotlight & { weight: number })[] = [];
  const at = new Date().toISOString();

  // (a) Form D before any press, inside the thesis
  const [fd] = await db()
    .select()
    .from(S.filings)
    .where(and(isNotNull(S.filings.thesisArea), eq(S.filings.beforePress, true), gte(S.filings.filedAt, new Date(now - 14 * DAY))))
    .orderBy(desc(S.filings.amountSold))
    .limit(1);
  if (fd) {
    const amt = fmtMoney(fd.amountSold || fd.amountOffered, fd.currency);
    cands.push({
      kind: "Form D before any press",
      rule: RULES["Form D before any press"],
      before: "",
      link: { text: fd.issuer, href: fd.companyId ? `/company/${fd.companyId}` : `/throw-some-ds#f${fd.id}` },
      after: ` just ${fd.amountSold ? "raised" : "filed to raise"} ${amt || "money"} inside Courtside's ${areaLabel(fd.thesisArea).toLowerCase()} thesis, and nobody has written about it yet`,
      source: { label: "SEC EDGAR", url: fd.url, domain: "sec.gov" },
      itemKey: `filing:${fd.id}`,
      computedAt: at,
      weight: 90 + Math.min(20, (fd.amountSold || 0) / 1e6),
    });
  }

  // (b) a brand newly sponsoring 3+ shows
  const sp = (await db().execute(sql`
    select s.id, s.brand, s.key, s.site, count(distinct ss.show)::int as shows, max(ss.url) as url, max(ss.show) as show
    from sponsors s join sponsor_sightings ss on ss.sponsor_id = s.id
    where s.first_seen > now() - interval '14 days'
    group by s.id having count(distinct ss.show) >= 3 order by shows desc limit 1`)) as unknown as { rows: { id: number; brand: string; key: string; site: string | null; shows: number; url: string; show: string }[] };
  const b = sp.rows[0];
  if (b)
    cands.push({
      kind: "New sponsor on 3 shows",
      rule: RULES["New sponsor on 3 shows"],
      before: "",
      link: { text: b.brand, href: `/sponsors#${b.key}` },
      after: ` started buying ads on ${b.shows} of the shows Courtside's world listens to in the last two weeks`,
      source: { label: b.show, url: b.url, domain: new URL(b.url).hostname },
      itemKey: `sponsor:${b.id}`,
      computedAt: at,
      weight: 70 + b.shows * 4,
    });

  // (c) the steepest trend
  const trends = await db().select().from(S.trends).orderBy(desc(S.trends.score)).limit(30);
  let steep: { t: (typeof trends)[number]; delta: number } | null = null;
  for (const t of trends) {
    if ((t.sourceKinds?.length || 0) < 2 && t.sources.length < 2) continue;
    const v = velocity(weeklyOf(t.sources.map((s) => s.date), now));
    if (!steep || v.delta > steep.delta) steep = { t, delta: v.delta };
  }
  if (steep && steep.delta >= 3) {
    const src = steep.t.sources.find((s) => !/youtube\.com\/shorts/.test(s.url)) || steep.t.sources[0];
    cands.push({
      kind: "Steepest trend",
      rule: RULES["Steepest trend"],
      before: "",
      link: { text: steep.t.headline, href: `/trends#${steep.t.slug}` },
      after: `, up ${steep.delta} mentions in two weeks`,
      source: { label: src ? new URL(src.url).hostname.replace(/^www\./, "") : "Trends", url: src?.url || "/trends", domain: src ? new URL(src.url).hostname : "" },
      itemKey: `trend:${steep.t.id}`,
      computedAt: at,
      weight: 50 + steep.delta * 3,
    });
  }

  // (d) biggest score jump (prev_score > 0 and first seen more than 2 days ago)
  const [jump] = await db()
    .select()
    .from(S.companies)
    .where(and(isNotNull(S.companies.thesisArea), sql`${S.companies.prevScore} > 0`, sql`${S.companies.firstSeen} < now() - interval '2 days'`, sql`${S.companies.score} - ${S.companies.prevScore} >= 5`))
    .orderBy(desc(sql`${S.companies.score} - ${S.companies.prevScore}`))
    .limit(1);
  if (jump) {
    const [sig] = await db().select().from(S.signals).where(eq(S.signals.companyId, jump.id)).orderBy(desc(S.signals.date)).limit(1);
    cands.push({
      kind: "Biggest score jump",
      rule: RULES["Biggest score jump"],
      before: "",
      link: { text: jump.name, href: `/company/${jump.id}` },
      after: ` jumped ${jump.score - jump.prevScore} points to ${jump.score}% thesis fit${sig ? ` after ${sig.source}` : ""}`,
      source: { label: sig?.source || "Scout", url: sig?.url || `/company/${jump.id}`, domain: sig ? new URL(sig.url).hostname : "" },
      itemKey: `company:${jump.id}`,
      computedAt: at,
      weight: 40 + (jump.score - jump.prevScore) * 3,
    });
  }

  // (e) a co-investor's or synergistic funder's new deal inside the thesis, or a new fund
  const fi = (await db().execute(sql`
    select i.id, i.kind, i.title, i.url, i.company, i.amount, i.currency, i.thesis_area, i.source, f.name as fund, f.kind as fkind, f.slug
    from fund_items i join funds f on f.id = i.fund_id
    where i.date > now() - interval '7 days' and i.possible = false and (i.kind = 'newfund' or (i.kind = 'deal' and i.thesis_area is not null and i.company is not null))
    order by (i.kind = 'newfund') desc, i.amount desc nulls last limit 1`)) as unknown as { rows: { id: number; kind: string; title: string; url: string; company: string | null; amount: number | null; currency: string; thesis_area: string | null; source: string | null; fund: string; fkind: string; slug: string }[] };
  const f = fi.rows[0];
  if (f) {
    const page = f.fkind === "neighborhood" ? "neighborhood" : "synergistic-funders";
    cands.push(
      f.kind === "newfund"
        ? {
            kind: "New fund raised",
            rule: RULES["New fund raised"],
            before: "",
            link: { text: f.fund, href: `/${page}#${f.slug}` },
            after: ` raised a new ${fmtMoney(f.amount, f.currency) || ""} fund`.replace("  ", " "),
            source: { label: f.source || "News", url: f.url, domain: new URL(f.url).hostname },
            itemKey: `fund_item:${f.id}`,
            computedAt: at,
            weight: 60,
          }
        : {
            kind: "Neighborhood deal",
            rule: RULES["Neighborhood deal"],
            before: `${f.fund} just backed `,
            link: { text: f.company!, href: `/${page}#${f.slug}` },
            after: `${f.amount ? `, ${fmtMoney(f.amount, f.currency)}` : ""}, inside Courtside's ${areaLabel(f.thesis_area).toLowerCase()} thesis`,
            source: { label: f.source || "News", url: f.url, domain: new URL(f.url).hostname },
            itemKey: `fund_item:${f.id}`,
            computedAt: at,
            weight: 55,
          },
    );
  }

  if (!cands.length) {
    // nothing new today: the top company in the pipeline, said plainly
    const [top] = await db().select().from(S.companies).where(and(isNotNull(S.companies.thesisArea), eq(S.companies.hidden, false))).orderBy(desc(S.companies.score)).limit(1);
    if (!top) return null;
    const [sig] = await db().select().from(S.signals).where(eq(S.signals.companyId, top.id)).orderBy(desc(S.signals.date)).limit(1);
    if (!sig) return null;
    return {
      kind: "Top of the pipeline",
      rule: "When no rule fires today, the Spotlight shows the company with the highest thesis-fit score.",
      before: "",
      link: { text: top.name, href: `/company/${top.id}` },
      after: ` leads the pipeline at ${top.score}% thesis fit, inside Courtside's ${areaLabel(top.thesisArea).toLowerCase()} thesis`,
      source: { label: sig.source, url: sig.url, domain: new URL(sig.url).hostname },
      itemKey: `company:${top.id}`,
      computedAt: at,
    };
  }
  cands.sort((a, b2) => b2.weight - a.weight);
  const { weight: _w, ...best } = cands[0];
  void _w;
  return best;
}

/** From the cache when fresh (5 minutes), else recomputed and stored. */
export async function getSpotlight(): Promise<Spotlight | null> {
  const cached = await getSetting<Spotlight | null>("spotlight", null);
  if (cached && Date.now() - new Date(cached.computedAt).getTime() < 5 * 60 * 1000) return cached;
  try {
    const s = await computeSpotlight();
    if (s) await setSetting("spotlight", s);
    return s || cached;
  } catch {
    return cached;
  }
}

export async function refreshSpotlight() {
  const s = await computeSpotlight();
  if (s) await setSetting("spotlight", s);
  return s;
}
