// Loads the launch seed (Adrian-checked data from the v4 run) keeping every record's original dates.
import { sql } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { cleanCopy } from "./copy";
import { domainOf, slugify } from "./format";
import { NEIGHBORHOOD, SYNERGISTIC, SEED_ORDER, normName, COMMON_NAMES } from "@/data/funds";
import type { Evidence } from "@/db/schema";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Seed = Record<string, any>;

const d = (x: unknown) => (x ? new Date(x as string) : null);
async function chunked<T>(rowsIn: T[], n: number, f: (c: T[]) => Promise<unknown>) {
  for (let i = 0; i < rowsIn.length; i += n) await f(rowsIn.slice(i, i + n));
}

const TEAM = [
  { name: "Vasu Kulkarni", role: "Partner, Courtside Ventures" },
  { name: "Deepen Parikh", role: "Partner, Courtside Ventures" },
  { name: "Kai Bond", role: "Partner, Courtside Ventures" },
  { name: "Cort Post", role: "Principal, Courtside Ventures" },
  { name: "Oliver Ressler", role: "Venture Partner, Courtside Ventures" },
  { name: "Megan Lightcap", role: "Partner, Slow Ventures Creator Fund", blog: "https://www.meganlightcap.com/" },
];

export const SEED_ALERTS = [
  { title: "Alert me when a Courtside portfolio company is mentioned on one of our podcasts.", rule: { subject: "portfolio", event: "mention", keywords: [], sources: ["podcasts", "voices"] } },
  { title: "Alert me when a startup inside our thesis files a Form D over $2M.", rule: { subject: "thesis", event: "formd", keywords: [], sources: ["sec"], minAmount: 2000000 } },
  { title: "Alert me when two or more of our creators or shows mention the same new brand in a week.", rule: { subject: "brand", event: "overlap", keywords: [], sources: ["voices", "podcasts"] } },
  { title: "Alert me when one of our co-investors or synergistic funders leads a seed round in sports or gaming.", rule: { subject: "funds", event: "lead-seed", keywords: ["sports", "gaming"], sources: ["news"] } },
];

/** Backtest evidence: article URLs only (never a Google News redirect); every rejected row says why. */
export function cleanEvidence(ev: any[]): Evidence[] {
  return ev
    .filter((e) => !String(e.url).includes("news.google.com"))
    .map((e) => {
      let note: string = e.note || "";
      if (!e.counts) {
        if (/release date of the app/i.test(note)) note = "Rejected because the app's release date is after the announcement";
        else if (/site alone/i.test(note)) note = "Rejected because a site alone is not a Scout signal";
        else note = cleanCopy(note).replace(/^Context: /, "Rejected because ");
        if (!note.startsWith("Rejected because")) note = "Rejected because " + note.charAt(0).toLowerCase() + note.slice(1);
      } else if (/release date of the app/i.test(note)) note = "App Store release date";
      return { url: e.url, date: e.date, kind: e.kind, note, title: e.title, counts: !!e.counts, domain: domainOf(e.url) };
    });
}

export async function loadSeed(seed: Seed, log: (s: string) => void = () => {}) {
  const x = db();

  // portfolio
  await chunked(seed.portfolio || [], 100, (c) =>
    x
      .insert(S.portfolio)
      .values(c.map((p: any) => ({ name: p.name, slug: p.slug, sector: p.sector, description: p.description, descriptionUrl: p.descriptionUrl, site: p.site, exitNote: p.exitNote, updatedAt: d(p.updatedAt) || new Date() })))
      .onConflictDoNothing(),
  );
  log(`portfolio ${seed.portfolio?.length || 0}`);

  // creators and shows
  await chunked(seed.voices || [], 100, (c) =>
    x
      .insert(S.voices)
      .values(
        c.map((v: any) => ({
          name: v.name,
          kind: v.kind,
          grp: v.group,
          youtube: v.youtube || [],
          feeds: v.feeds || [],
          site: v.site,
          note: v.note,
          status: v.status === "error" ? "active" : v.status,
          exempt: !!v.exempt || /Only Built For Hyperlinks/i.test(v.name),
          priority: v.priority ?? 99,
          lastEpisode: d(v.lastEpisode),
        })),
      )
      .onConflictDoNothing(),
  );
  log(`creators and shows ${seed.voices?.length || 0}`);

  // sponsors + sightings
  for (const sp of seed.sponsors || []) {
    const [row] = await x
      .insert(S.sponsors)
      .values({ key: sp.key, brand: sp.brand, site: sp.site, fitTag: sp.fitTag === "lanes" ? "thesis" : sp.fitTag, thesisArea: sp.lane, firstSeen: d(sp.firstSeen), lastSeen: d(sp.lastSeen) })
      .onConflictDoUpdate({ target: S.sponsors.key, set: { brand: sp.brand } })
      .returning({ id: S.sponsors.id });
    const sights = (sp.sightings || []).map((s: any) => ({ sponsorId: row.id, show: s.show, date: d(s.date), url: s.url, evidence: s.evidence }));
    if (sights.length) await x.insert(S.sponsorSightings).values(sights).onConflictDoNothing();
  }
  log(`sponsors ${seed.sponsors?.length || 0}`);

  // companies + signals
  for (const c of seed.companies || []) {
    const [row] = await x
      .insert(S.companies)
      .values({
        key: c.key,
        name: c.name,
        domain: c.domain,
        aliases: c.aliases || [],
        description: c.description,
        descriptionUrl: c.descriptionUrl,
        thesisArea: c.thesisArea,
        pattern: c.pattern,
        stage: c.stage || "unknown",
        amount: c.amount ? Number(c.amount) : null,
        currency: c.currency || "$",
        whyFits: cleanCopy(c.whyFits),
        whyFitsManual: !!c.whyFitsManual,
        score: c.score || 0,
        prevScore: c.score || 0,
        breakdown: c.breakdown || {},
        portfolioCheck: c.portfolioCheck ? { ...c.portfolioCheck, reason: cleanCopy(c.portfolioCheck.reason) } : null,
        status: c.status || "new",
        firstSeen: d(c.firstSeen) || new Date(),
        lastSignal: d(c.lastSignal),
      })
      .onConflictDoNothing()
      .returning({ id: S.companies.id });
    if (!row) continue;
    const sigs = (c.signals || []).map((s: any) => ({ companyId: row.id, type: s.type, source: s.source, title: s.title, url: s.url, date: d(s.date), voice: s.voice }));
    if (sigs.length) await x.insert(S.signals).values(sigs).onConflictDoNothing();
  }
  log(`companies ${seed.companies?.length || 0}`);

  // backtests (the three wins were hand-verified by Adrian on 10-12-26)
  for (const b of seed.backtests || []) {
    await x
      .insert(S.backtests)
      .values({
        slug: slugify(b.company),
        company: b.company,
        domain: b.domain,
        announceDate: b.announceDate,
        announceUrl: b.announceUrl,
        announceTitle: b.announceTitle?.replace("Eloelo", "Eloelo"),
        verdict: b.verdict,
        leadDays: b.leadDays,
        flaggedOn: b.flaggedOn,
        signal: b.signal,
        evidence: cleanEvidence(b.evidence || []),
        courtside: true,
        verified: b.verdict === "win",
      })
      .onConflictDoNothing();
  }
  log(`backtests ${seed.backtests?.length || 0}`);

  // trends
  await chunked(seed.trends || [], 50, (c) =>
    x
      .insert(S.trends)
      .values(
        c.map((t: any) => ({
          slug: slugify(t.term),
          term: t.term,
          headline: cleanCopy(t.headline),
          why: cleanCopy(t.why),
          thesisArea: t.thesisArea,
          momentum: cleanCopy(t.momentum),
          score: t.score || 0,
          sources: t.sources || [],
          sourceKinds: t.sourceKinds || [],
          voiceCount: t.voiceCount || 0,
          firstSeen: d(t.firstSeen) || new Date(),
          lastSeen: d(t.lastSeen) || new Date(),
        })),
      )
      .onConflictDoNothing(),
  );
  log(`trends ${seed.trends?.length || 0}`);

  // funds: brief data (focus, shared deals, sites) merged with the seed's feeds
  const seedFunds = new Map<string, any>((seed.funds || []).map((f: any) => [normName(f.name), f]));
  const idBySeedOrder = new Map<number, number>();
  for (const [kind, list] of [
    ["neighborhood", NEIGHBORHOOD],
    ["synergistic", SYNERGISTIC],
  ] as const) {
    for (const f of list) {
      const sf = seedFunds.get(normName(f.name)) || [...seedFunds.values()].find((v) => normName(v.name).startsWith(normName(f.name)) || normName(f.name).startsWith(normName(v.name)));
      const lastShared = f.shared?.map((s) => s.date || "").sort().pop() || sf?.lastSharedDate || null;
      const [row] = await x
        .insert(S.funds)
        .values({
          slug: slugify(f.name),
          name: f.name,
          kind,
          focus: f.focus,
          thesisArea: f.area || sf?.thesisArea || null,
          site: f.site || sf?.site || null,
          note: f.note || sf?.note || null,
          query: sf?.query || (COMMON_NAMES.has(f.name) ? `"${f.name}" (venture OR VC OR seed OR "Series A")` : null),
          feeds: sf?.feeds || f.feeds || [],
          youtube: sf?.youtube?.length ? sf.youtube : f.youtube || [],
          edgarName: f.edgarName || sf?.edgarName || null,
          lastSharedDate: lastShared,
          shared: f.shared || [],
          active: sf?.active ?? true,
        })
        .onConflictDoUpdate({ target: S.funds.slug, set: { name: f.name } })
        .returning({ id: S.funds.id });
      const pos = SEED_ORDER.indexOf(f.name) + 1;
      if (pos > 0) idBySeedOrder.set(pos, row.id);
    }
  }
  const items = (seed.fundItems || [])
    .map((i: any) => ({ i, fundId: idBySeedOrder.get(i.fund_id) }))
    .filter((r: any) => !!r.fundId)
    .map(({ i, fundId }: any) => ({
      fundId,
      kind: i.kind,
      title: i.title,
      url: i.url,
      date: d(i.date),
      company: i.company,
      round: i.round,
      amount: i.amount ? Number(i.amount) : null,
      currency: i.currency || "$",
      role: i.role,
      thesisArea: i.lane || i.thesisArea || null,
      possible: !!i.possible,
      source: i.source,
    }));
  await chunked(items as (typeof S.fundItems.$inferInsert)[], 100, (c) => x.insert(S.fundItems).values(c).onConflictDoNothing());
  log(`funds ${seed.funds?.length || 0}, fund items ${items.length}`);

  // filings (Form D and Form C inside the thesis), keyed by accession; the daily job links companies later
  await chunked(seed.filings || [], 100, (c) =>
    x
      .insert(S.filings)
      .values(c.map((f: any) => ({
        accession: f.accession, form: f.form, issuer: f.issuer, cik: f.cik ?? null, industry: f.industry ?? null, amountSold: f.amountSold ?? null, amountOffered: f.amountOffered ?? null,
        currency: f.currency || "$", firstSale: f.firstSale ?? null, filedAt: d(f.filedAt), related: f.related || [], thesisArea: f.thesisArea ?? null, confidence: f.confidence ?? 0,
        url: f.url, website: f.website ?? null, beforePress: !!f.beforePress,
      })))
      .onConflictDoNothing(),
  );
  log(`filings ${seed.filings?.length || 0}`);

  // mentions
  await chunked(seed.mentions || [], 100, (c) =>
    x
      .insert(S.mentions)
      .values(c.map((m: any) => ({ entity: m.entity, kind: m.kind, stance: m.stance, quote: m.quote, url: m.url, date: d(m.date), voice: m.voice })))
      .onConflictDoNothing(),
  );
  log(`mentions ${seed.mentions?.length || 0}`);

  // Courtside posts
  await chunked(seed.courtsidePosts || [], 100, (c) =>
    x
      .insert(S.courtsidePosts)
      .values(c.map((p: any) => ({ title: p.title, url: p.url, date: d(p.date), kind: p.kind, summary: p.summary })))
      .onConflictDoNothing(),
  );

  // people and alerts
  for (const p of TEAM) await x.insert(S.people).values({ slug: slugify(p.name), name: p.name, role: p.role, blog: p.blog }).onConflictDoNothing();
  const existingAlerts = await x.select({ id: S.alerts.id }).from(S.alerts).limit(1);
  if (!existingAlerts.length) for (const a of SEED_ALERTS) await x.insert(S.alerts).values(a);

  // settings
  const st = seed.settings || {};
  const w = st.scoreWeights || {};
  const put = (key: string, value: unknown) =>
    x
      .insert(S.settings)
      .values({ key, value: value as object })
      .onConflictDoNothing();
  if (st.lanes) await put("lanes", st.lanes);
  await put("scoreWeights", { thesis: w.lane ?? 30, stage: w.stage ?? 20, signal: w.signal ?? 20, culture: w.culture ?? 15, team: w.team ?? 10, geo: w.geo ?? 5 });
  if (st.stage) await put("stage", st.stage);
  if (st.laneQueries) await put("thesisQueries", st.laneQueries);
  await put("extraSources", !!st.extraSources);
  await put("sourcesOff", st.sourcesOff || []);
  await put("memoDailyCap", 4); // the free $5 a month never runs out mid-month (10-26-26)
  await put("thesisCheckDailyCap", 60);
  await put("worthThreshold", 45);
  if (st.appRanks) await put("appRanks", st.appRanks);
  if (st.secIndexDays) await put("secIndexDays", st.secIndexDays);
  await x
    .insert(S.settings)
    .values({ key: "seededAt", value: { at: new Date().toISOString(), exportedAt: seed.exportedAt } })
    .onConflictDoUpdate({ target: S.settings.key, set: { updatedAt: new Date() } });
  await x.execute(sql`select 1`);
  log("settings");
}
