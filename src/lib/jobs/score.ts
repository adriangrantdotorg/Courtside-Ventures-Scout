// Re-scores every company, writes "why it fits" (unless hand-written), the portfolio check,
// and learns from the shared votes (capped at ±15 points).
import { eq, sql } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { scoreCompany, whyFitsLine, portfolioCheck, type Breakdown } from "../score";
import { INCUMBENT, NOT_CONSUMER } from "../thesis";
import { getWeights, getSetting, setSetting } from "../settings";
import { sectorArea } from "../queries";
import { areaLabel } from "../format";
import type { Ctx } from "./runner";

type Learned = { area: Record<string, number>; signal: Record<string, number> };

/** Each vote nudges its thesis area and signal types; a few votes can't swamp the score. */
export async function learnFromVotes(): Promise<{ learned: Learned; summary: string | null }> {
  const r = (await db().execute(sql`
    select c.thesis_area as area, s.type as sig, v.value
    from votes v join companies c on v.item_type = 'company' and v.item_id = c.id::text
    left join lateral (select type from signals where company_id = c.id order by date desc nulls last limit 1) s on true`)) as unknown as { rows: { area: string | null; sig: string | null; value: number }[] };
  const learned: Learned = { area: {}, signal: {} };
  for (const v of r.rows) {
    if (v.area) learned.area[v.area] = (learned.area[v.area] || 0) + v.value * 1.5;
    if (v.sig) learned.signal[v.sig] = (learned.signal[v.sig] || 0) + v.value;
  }
  const n = r.rows.length;
  let summary: string | null = null;
  if (n >= 3) {
    const sorted = Object.entries(learned.area).sort((a, b) => b[1] - a[1]);
    const more = sorted.filter(([, x]) => x > 0)[0];
    const fewer = sorted.filter(([, x]) => x < 0).pop();
    const parts = [more ? `more ${areaLabel(more[0])}` : null, fewer ? `fewer ${areaLabel(fewer[0])}` : null].filter(Boolean);
    if (parts.length) summary = `This week Scout learned: ${parts.join(", ")} (from ${n} ratings).`;
  }
  return { learned, summary };
}

export async function scoreAll(ctx: Ctx) {
  const [w, port, cfg, { learned, summary }] = await Promise.all([
    getWeights(),
    db().select({ name: S.portfolio.name, sector: S.portfolio.sector, description: S.portfolio.description }).from(S.portfolio),
    getSetting("stage", { minCheck: 500000, maxCheck: 4000000 }),
    learnFromVotes(),
  ]);
  await setSetting("learned", learned);
  await setSetting("learnedSummary", summary);
  const cos = await db().select().from(S.companies).where(eq(S.companies.hidden, false));
  const sigs = (await db().execute(sql`select company_id, type, date from signals`)) as unknown as { rows: { company_id: number; type: string; date: string | null }[] };
  const bySig = new Map<number, { type: string; date: Date | null }[]>();
  for (const s of sigs.rows) {
    const l = bySig.get(s.company_id) || [];
    l.push({ type: s.type, date: s.date ? new Date(s.date) : null });
    bySig.set(s.company_id, l);
  }
  const mentionRows = (await db().execute(sql`select lower(entity) as e, count(distinct voice)::int as n from mentions where date > now() - interval '30 days' group by 1`)) as unknown as { rows: { e: string; n: number }[] };
  const mentions = new Map(mentionRows.rows.map((m) => [m.e, m.n]));
  const sponsorRows = (await db().execute(sql`select lower(s.brand) as b, count(distinct ss.show)::int as n from sponsors s join sponsor_sightings ss on ss.sponsor_id = s.id group by 1`)) as unknown as { rows: { b: string; n: number }[] };
  const sponsorShows = new Map(sponsorRows.rows.map((m) => [m.b, m.n]));
  const filingPeople = (await db().execute(sql`select company_id, max(jsonb_array_length(related))::int as n from filings where company_id is not null group by 1`)) as unknown as { rows: { company_id: number; n: number }[] };
  const people = new Map(filingPeople.rows.map((r) => [r.company_id, r.n]));
  const votes = (await db().execute(sql`select item_id, sum(value)::int as n from votes where item_type = 'company' group by 1`)) as unknown as { rows: { item_id: string; n: number }[] };
  const ownVotes = new Map(votes.rows.map((v) => [Number(v.item_id), v.n]));
  await ctx.stage("scoring", 0, cos.length);
  for (const c of cos) {
    const s = bySig.get(c.id) || [];
    const desc = c.description || "";
    const pcheck = c.thesisArea ? portfolioCheck({ name: c.name, description: desc, thesisArea: c.thesisArea }, port.filter((p) => !c.thesisArea || sectorArea(p.sector, p.description) === c.thesisArea || true)) : null;
    const lastSig = s.slice().sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))[0] || null;
    const learnedPts = (learned.area[c.thesisArea || ""] || 0) * 0.5 + (lastSig ? (learned.signal[lastSig.type] || 0) * 0.3 : 0) + (ownVotes.get(c.id) || 0) * 3;
    const b = (c.breakdown || {}) as Partial<Breakdown> & { laneFit?: number };
    const manual = c.whyFitsManual ? { thesis: b.thesis ?? b.laneFit ?? 0, stage: b.stage ?? 0, team: b.team ?? 0, geo: b.geo ?? 0 } : null;
    const { score, breakdown } = scoreCompany(
      {
        name: c.name,
        description: desc,
        thesisArea: c.thesisArea,
        stage: c.stage,
        amount: c.amount,
        currency: c.currency,
        signals: s,
        voiceMentions: mentions.get(c.name.toLowerCase()) || 0,
        sponsorShows: sponsorShows.get(c.name.toLowerCase()) || 0,
        relatedPersons: people.get(c.id) || 0,
        yc: s.some((x) => x.type === "yc"),
        geoText: desc,
        learned: learnedPts,
        competes: pcheck?.kind === "competes",
        manual,
        checkRange: cfg,
      },
      w,
    );
    const why = c.whyFitsManual && c.whyFits ? c.whyFits : c.thesisArea ? whyFitsLine({ name: c.name, description: desc, thesisArea: c.thesisArea, stage: c.stage, amount: c.amount, currency: c.currency, lastSignal: lastSig }) : c.whyFits;
    // hygiene: incumbents and developer tools are never finds, even from the seed
    const junk = !c.whyFitsManual && !c.keep && (INCUMBENT.test(c.name) || NOT_CONSUMER.test(`${c.name}. ${desc}`.slice(0, 300)));
    await db()
      .update(S.companies)
      .set({
        prevScore: c.score,
        score,
        breakdown,
        whyFits: why,
        portfolioCheck: c.whyFitsManual && c.portfolioCheck ? c.portfolioCheck : pcheck,
        hidden: junk,
      })
      .where(eq(S.companies.id, c.id));
    if (score !== c.score) ctx.item();
    ctx.tick();
  }
}
