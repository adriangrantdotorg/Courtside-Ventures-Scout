// npm run seed:export [out.json]
// Writes the launch seed from THIS database, in the shape scripts/load-seed.ts reads: everything a fresh
// launch needs on day one (portfolio, creators and shows, sponsors with evidence, the scored companies with
// their signals, the hand-verified backtests, trends, funds and their recent items, mentions, the thesis
// filings, Courtside's posts, the shared settings). `npm run release` runs it before every push, so a launch is as current as
// the newest push. Fund items carry `fund_id` as the fund's position in the seed order, as the loader expects.
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { and, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { db, schema as S } from "../src/db";
import { SEED_ORDER, normName } from "../src/data/funds";

config({ path: ".env.local", quiet: true });
const out = process.argv[2] || "seed/scout-launch-seed.json";
const x = db();

const portfolio = await x.select().from(S.portfolio).orderBy(S.portfolio.name);
const voices = (await x.select().from(S.voices).orderBy(S.voices.priority, S.voices.name)).map((v) => ({
  name: v.name, kind: v.kind, group: v.grp, youtube: v.youtube, feeds: v.feeds, site: v.site, note: v.note, status: v.status, exempt: v.exempt, priority: v.priority, lastEpisode: v.lastEpisode,
}));

const sponsorRows = await x.select().from(S.sponsors).orderBy(S.sponsors.brand);
const sightings = await x.select().from(S.sponsorSightings).orderBy(desc(S.sponsorSightings.date));
const sponsors = sponsorRows.map((p) => ({
  brand: p.brand, key: p.key, site: p.site, fitTag: p.fitTag, lane: p.thesisArea, firstSeen: p.firstSeen, lastSeen: p.lastSeen,
  sightings: sightings.filter((s) => s.sponsorId === p.id).slice(0, 12).map((s) => ({ show: s.show, date: s.date, url: s.url, evidence: s.evidence })),
}));

const companies = await x.select().from(S.companies).where(and(eq(S.companies.hidden, false), gte(S.companies.score, 35))).orderBy(desc(S.companies.score)).limit(200);
const ids = companies.map((c) => c.id);
const signals = ids.length ? await x.select().from(S.signals).where(inArray(S.signals.companyId, ids)).orderBy(desc(S.signals.date)) : [];
const companyRows = companies.map((c) => ({
  key: c.key, name: c.name, domain: c.domain, aliases: c.aliases, description: c.description, descriptionUrl: c.descriptionUrl, thesisArea: c.thesisArea, pattern: c.pattern, stage: c.stage,
  amount: c.amount, currency: c.currency, whyFits: c.whyFits, whyFitsManual: c.whyFitsManual, score: c.score, breakdown: c.breakdown, portfolioCheck: c.portfolioCheck, status: c.status,
  firstSeen: c.firstSeen, lastSignal: c.lastSignal,
  signals: signals.filter((g) => g.companyId === c.id).map((g) => ({ type: g.type, source: g.source, title: g.title, url: g.url, date: g.date, voice: g.voice })),
}));

const backtests = (await x.select().from(S.backtests).where(eq(S.backtests.courtside, true)).orderBy(S.backtests.announceDate)).map((b) => ({
  company: b.company, domain: b.domain, announceDate: b.announceDate, announceUrl: b.announceUrl, announceTitle: b.announceTitle, verdict: b.verdict, leadDays: b.leadDays, flaggedOn: b.flaggedOn, signal: b.signal, evidence: b.evidence,
}));

const trends = (await x.select().from(S.trends).orderBy(desc(S.trends.score)).limit(40)).map((t) => ({
  term: t.term, headline: t.headline, why: t.why, thesisArea: t.thesisArea, momentum: t.momentum, score: t.score, sources: t.sources, sourceKinds: t.sourceKinds, voiceCount: t.voiceCount, firstSeen: t.firstSeen, lastSeen: t.lastSeen,
}));

const fundRows = await x.select().from(S.funds).orderBy(S.funds.kind, S.funds.name);
const funds = fundRows.map((f) => ({
  name: f.name, kind: f.kind, focus: f.focus, thesisArea: f.thesisArea, site: f.site, note: f.note, query: f.query, feeds: f.feeds, youtube: f.youtube, edgarName: f.edgarName, lastSharedDate: f.lastSharedDate, active: f.active,
}));
const seedPos = new Map<number, number>();
for (const f of fundRows) {
  const pos = SEED_ORDER.findIndex((n) => normName(n) === normName(f.name)) + 1;
  if (pos > 0) seedPos.set(f.id, pos);
}
const fundItems = (await x.select().from(S.fundItems).orderBy(desc(S.fundItems.date)).limit(400))
  .filter((i) => seedPos.has(i.fundId))
  .map((i) => ({ fund_id: seedPos.get(i.fundId), kind: i.kind, title: i.title, url: i.url, date: i.date, company: i.company, round: i.round, amount: i.amount, currency: i.currency, role: i.role, thesisArea: i.thesisArea, possible: i.possible, source: i.source }));

const mentions = (await x.select().from(S.mentions).orderBy(desc(S.mentions.date)).limit(400)).map((m) => ({ entity: m.entity, kind: m.kind, stance: m.stance, quote: m.quote, url: m.url, date: m.date, voice: m.voice }));
const posts = await x.select().from(S.courtsidePosts).orderBy(desc(S.courtsidePosts.date));
// Form D and Form C filings inside the thesis: a fresh site showed none until the first pull, and the live check
// "Form D rows" failed on every fresh launch (third dry run, 10-14-26). Ids and company links stay behind.
const filings = (await x.select().from(S.filings).where(isNotNull(S.filings.thesisArea)).orderBy(desc(S.filings.filedAt)).limit(200)).map((f) => ({
  accession: f.accession, form: f.form, issuer: f.issuer, cik: f.cik, industry: f.industry, amountSold: f.amountSold, amountOffered: f.amountOffered, currency: f.currency,
  firstSale: f.firstSale, filedAt: f.filedAt, related: f.related, thesisArea: f.thesisArea, confidence: f.confidence, url: f.url, website: f.website, beforePress: f.beforePress,
}));
const settingRows = await x.select().from(S.settings);
const settings = Object.fromEntries(settingRows.filter((r) => !["build_progress", "seededAt"].includes(r.key)).map((r) => [r.key, r.value]));

const seed = {
  name: "Courtside Ventures Scout launch seed",
  exportedAt: new Date().toISOString(),
  source: `this Scout's database (${process.env.SITE_URL || "local"})`,
  counts: { portfolio: portfolio.length, filings: filings.length, voices: voices.length, sponsors: sponsors.length, companies: companyRows.length, signals: signals.length, backtests: backtests.length, trends: trends.length, funds: funds.length, fundItems: fundItems.length, mentions: mentions.length, courtsidePosts: posts.length },
  portfolio: portfolio.map((p) => ({ name: p.name, slug: p.slug, sector: p.sector, description: p.description, descriptionUrl: p.descriptionUrl, site: p.site, exitNote: p.exitNote, updatedAt: p.updatedAt })),
  voices, sponsors, companies: companyRows, backtests, trends, funds, fundItems, mentions, filings,
  courtsidePosts: posts.map((p) => ({ title: p.title, url: p.url, date: p.date, kind: p.kind, summary: p.summary })),
  settings,
};
writeFileSync(out, JSON.stringify(seed, null, 1));
console.log(`${out} · ${Object.entries(seed.counts).map(([k, v]) => `${k} ${v}`).join(" · ")} · ${(Buffer.byteLength(JSON.stringify(seed)) / 1024).toFixed(0)} KB`);
process.exit(0);
