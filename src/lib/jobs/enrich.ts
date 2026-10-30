// V2 (10-26-26): what the cards need. The startup filter and duplicate cards first (database only), then, company by
// company, Funds Raised from every round Scout can find, the official website, and the card's picture.
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db, schema as S } from "@/db";
import * as F from "../sources/fetchers";
import { fetchRaw, mediaLoads } from "../sources/http";
import { isSubject, decodeGoogleNews } from "../backtest";
import { buildRounds, totalOf, startupVerdict, TEAM_HIDDEN, duplicateOf, guessDomains, factsOf, isOfficialSite, searchReportOk, siteBits, pickMedia, appIdOf, SKIP_HOSTS, type Report, type DupIn, type SiteBits } from "../enrich";
import { normKey } from "../companies";
import { domainOf } from "../format";
import { usd, CAP } from "../v2";
import { saveItems } from "./collect-media";
import { fromHeadline, secondLook, FUNDING_SEARCHES, FUNDING_Q } from "./collect-signals";
import { getSetting, setSetting, DEFAULT_QUERIES } from "../settings";
import { aiAvailable, thesisCheck, CHECK_GAP_MS, CHECK_MIN_MS } from "../ai";
import type { Ctx } from "./runner";
import type { Media } from "@/db/schema";
import { brandFor, iconBrand } from "./brand";

const DAY = 86400000;

/** The startup filter, kept in step with the team's restores. */
export async function startupFilter(ctx: Ctx) {
  const cos = await db().select({ id: S.companies.id, name: S.companies.name, domain: S.companies.domain, description: S.companies.description, keep: S.companies.keep, notStartup: S.companies.notStartup, thesisCheck: S.companies.thesisCheck }).from(S.companies);
  await ctx.stage("startup filter", 0, cos.length);
  for (const c of cos) {
    if (c.notStartup === TEAM_HIDDEN && !c.keep) continue; // hidden by hand: only the team's Restore brings it back
    const why = startupVerdict(c);
    if (why !== c.notStartup) {
      await db().update(S.companies).set({ notStartup: why }).where(eq(S.companies.id, c.id));
      if (why) ctx.change(`Not a startup: ${c.name} (${why.toLowerCase()})`);
    }
    ctx.tick();
  }
}

/** Two cards for one company (the same raise under two names) become one. The duplicate's signals move over. */
export async function mergeDuplicates(ctx: Ctx) {
  const cos = await db()
    .select({ id: S.companies.id, name: S.companies.name, area: S.companies.thesisArea, aliases: S.companies.aliases })
    .from(S.companies)
    .where(and(isNull(S.companies.mergedInto), isNotNull(S.companies.thesisArea)));
  const sigs = await db().select({ companyId: S.signals.companyId, title: S.signals.title, url: S.signals.url, date: S.signals.date }).from(S.signals).where(inArray(S.signals.companyId, cos.map((c) => c.id).concat(-1)));
  const by = new Map<number, DupIn["signals"]>();
  for (const s of sigs) (by.get(s.companyId) || by.set(s.companyId, []).get(s.companyId)!).push({ title: s.title, url: s.url, date: s.date ? s.date.toISOString() : null });
  const list: DupIn[] = cos.map((c) => ({ id: c.id, name: c.name, area: c.area, signals: by.get(c.id) || [] }));
  await ctx.stage("duplicate cards", 0, list.length);
  const gone = new Set<number>();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (gone.has(list[i].id) || gone.has(list[j].id)) continue;
      const d = duplicateOf(list[i], list[j]);
      if (!d) continue;
      gone.add(d.drop.id);
      const own = (await db().select().from(S.signals).where(eq(S.signals.companyId, d.drop.id))).map((s) => ({ type: s.type, source: s.source, title: s.title, url: s.url, date: s.date, voice: s.voice, companyId: d.keep.id }));
      if (own.length) await db().insert(S.signals).values(own).onConflictDoNothing();
      await db().execute(sql`update companies set aliases = aliases || ${JSON.stringify([d.drop.name])}::jsonb, last_signal = greatest(last_signal, (select last_signal from companies where id = ${d.drop.id})) where id = ${d.keep.id} and not aliases ? ${d.drop.name}`);
      await db().update(S.companies).set({ mergedInto: d.keep.id }).where(eq(S.companies.id, d.drop.id));
      ctx.change(`Merged "${d.drop.name}" into ${d.keep.name}`);
      ctx.item();
    }
    ctx.tick();
  }
}

/** Every report of a raise Scout holds for one company, plus a news search for older rounds. */
async function reportsFor(c: { id: number; name: string; thesisArea: string | null; amount: number | null; currency: string; stage: string; lastSignal: Date | null }, search: boolean): Promise<Report[]> {
  const [sigs, files, deals] = await Promise.all([
    db().select().from(S.signals).where(eq(S.signals.companyId, c.id)),
    db().select().from(S.filings).where(eq(S.filings.companyId, c.id)),
    db().select({ title: S.fundItems.title, url: S.fundItems.url, date: S.fundItems.date, amount: S.fundItems.amount, currency: S.fundItems.currency, round: S.fundItems.round, fund: S.funds.name }).from(S.fundItems).innerJoin(S.funds, eq(S.funds.id, S.fundItems.fundId)).where(eq(S.fundItems.companyId, c.id)),
  ]);
  const out: Report[] = [];
  for (const s of sigs) if (s.type === "news") out.push({ title: s.title, url: s.url, name: s.source, date: s.date ? s.date.toISOString().slice(0, 10) : null });
  for (const f of files) {
    const amt = f.amountSold || f.amountOffered;
    if (amt) out.push({ title: `Form ${f.form.replace(/\/A$/, "")} filed: ${f.issuer}`, url: f.url, name: "SEC EDGAR", date: f.filedAt ? f.filedAt.toISOString().slice(0, 10) : null, amount: amt, currency: f.currency, stage: "unknown" });
  }
  for (const d of deals) out.push({ title: d.title, url: d.url, name: d.fund, date: d.date ? d.date.toISOString().slice(0, 10) : null, amount: d.amount, currency: d.currency, investors: d.fund });
  // a short name collides with too many other companies to search by it ("Pops", "ORA", "IDL")
  if (search && normKey(c.name).length >= 5) {
    for (const n of (await F.googleNews(FUNDING_Q(c.name), "3650d")).slice(0, 40)) {
      if (!isSubject(c.name, n.title) || !searchReportOk(c.thesisArea, n.title, n.text || "")) continue;
      out.push({ title: n.title, url: decodeGoogleNews(n.url) || n.url, name: n.outlet || "News", date: n.date ? n.date.slice(0, 10) : null });
    }
  }
  if (!out.length && c.amount) out.push({ title: `${c.name} raise`, url: "", name: "Scout", date: c.lastSignal ? c.lastSignal.toISOString().slice(0, 10) : null, amount: c.amount, currency: c.currency, stage: c.stage });
  return out;
}

/** The official website: the App Store's developer link, then domains worth trying. Accepted only when the page
 *  names the company and a fact from its news. */
async function findSite(c: { name: string }, titles: string[], appSeller: string | null): Promise<{ domain: string; html: string; url: string } | null> {
  // the App Store's developer link is the app maker's own word
  if (appSeller && !SKIP_HOSTS.test(domainOf(appSeller))) {
    const r = await fetchRaw(appSeller, { timeoutMs: 6000, accept: "text/html" });
    if (r.ok && r.text && !/domain (is )?for sale|buy this domain/i.test(r.text)) return { domain: domainOf(appSeller), html: r.text.slice(0, 600_000), url: appSeller };
  }
  const facts = factsOf(c.name, titles);
  if (!facts.length) return null; // nothing to check a guess against
  for (const d of guessDomains(c.name).slice(0, 9)) {
    const u = `https://${d}`;
    const r = await fetchRaw(u, { timeoutMs: 6000, accept: "text/html" });
    if (!r.ok || !r.text) continue;
    if (isOfficialSite(r.text, { name: c.name, facts })) return { domain: domainOf(u), html: r.text.slice(0, 600_000), url: u };
  }
  return null;
}

/** A homepage's links that don't load are dropped before the picture is picked, so a dead poster or video never
 *  reaches a card (the next one in the team's order is used instead). Every company is re-read weekly, which also
 *  catches a link that dies later. */
export async function loadingOnly(bits: SiteBits): Promise<SiteBits> {
  const [og, mp4, logo] = await Promise.all([
    bits.ogImage ? mediaLoads(bits.ogImage, "image") : false,
    bits.mp4 ? mediaLoads(bits.mp4, "video") : false,
    bits.logo ? mediaLoads(bits.logo, "image") : false,
  ]);
  return { ...bits, ogImage: og ? bits.ogImage : null, mp4: mp4 ? bits.mp4 : null, logo: logo ? bits.logo : null };
}

/** Funds Raised, the website and the picture, one company at a time, oldest first, inside the time box. */
export async function enrichCompanies(ctx: Ctx, opts: { ids?: number[]; limit?: number; search?: boolean } = {}) {
  const conds = [eq(S.companies.hidden, false), isNull(S.companies.mergedInto), isNotNull(S.companies.thesisArea)];
  if (opts.ids) conds.push(inArray(S.companies.id, opts.ids.concat(-1)));
  else conds.push(sql`(${S.companies.enrichedAt} is null or ${S.companies.enrichedAt} < now() - interval '7 days' or ${S.companies.lastSignal} > ${S.companies.enrichedAt})`);
  const cos = await db()
    .select()
    .from(S.companies)
    .where(and(...conds))
    .orderBy(sql`${S.companies.enrichedAt} asc nulls first`, sql`${S.companies.score} desc`)
    .limit(opts.limit ?? 400);
  await ctx.stage("funds raised, websites and pictures", 0, cos.length);
  for (const c of cos) {
    if (ctx.outOfTime()) break;
    try {
      const reports = await reportsFor(c, opts.search !== false);
      const rounds = buildRounds(reports);
      const total = totalOf(rounds) ?? usd(c.amount, c.currency);
      const sigs = await db().select({ type: S.signals.type, url: S.signals.url, title: S.signals.title }).from(S.signals).where(eq(S.signals.companyId, c.id));
      const appId = sigs.map((s) => (s.type === "appstore" ? appIdOf(s.url) : null)).find(Boolean) || null;
      const app = appId ? await F.appDetails(appId) : null;
      let domain = c.domain;
      let page: { html: string; url: string } | null = null;
      if (!domain) {
        const found = await findSite({ name: c.name }, reports.map((r) => r.title).concat(sigs.filter((s) => s.type !== "appstore").map((s) => s.title)), app?.sellerUrl || null);
        if (found) {
          domain = found.domain;
          page = found;
          ctx.change(`Website found: ${c.name} → ${domain}`);
        }
      } else page = await F.homepage(`https://${domain}`);
      let bits: SiteBits | null = page ? siteBits(page.html, page.url) : null;
      if (bits?.ogImage && /favicon|logo|icon/i.test(bits.ogImage) && !/og|share|social|preview|banner|hero/i.test(bits.ogImage)) bits = { ...bits, ogImage: null };
      if (bits) bits = await loadingOnly(bits);
      const media: Media = pickMedia({ site: bits, shots: app?.shots || [], appIcon: app?.icon || null, domain });
      const brand = page ? await brandFor(page.html, page.url, c.name, bits?.logo || app?.icon || null) : await iconBrand(app?.icon || null);
      if (Object.keys(brand).length) media.brand = brand;
      await db()
        .update(S.companies)
        .set({ rounds, totalRaised: total, media, domain: domain || null, enrichedAt: new Date() })
        .where(eq(S.companies.id, c.id));
      ctx.item();
    } catch (e) {
      ctx.error(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
      await db().update(S.companies).set({ enrichedAt: new Date() }).where(eq(S.companies.id, c.id));
    }
    ctx.tick();
  }
}

/** The AI Thesis Check: once per company, a yes/no from the cheap model on whether it is a consumer startup inside
 *  the thesis. A NO keeps it off the recommendations with the reason, in Settings › Hidden Startups (Restore wins).
 *  Skipped when AI is off; today's checks are capped apart from memo drafts. (Adrian, 10-26-26) */
/** Asks AI whether each new card is a consumer startup in the thesis, best scores first. A call every 12.5 s (the free
 *  tier's limit), so the daily run stops with `reserveMs` left for websites and pictures; the rest wait a day. A card past
 *  the $15M cap is never recommended, so it is never checked. */
/** The launch run may pass the daily cap on one day a calendar month (the budget allows one); a second day in the
 *  same month gets the daily cap. Every round of that day's run counts as the same launch. */
export async function launchAllowed(today = new Date().toISOString().slice(0, 10)): Promise<boolean> {
  const last = await getSetting<string | null>("thesisLaunchDay", null);
  if (last && last !== today && last.slice(0, 7) === today.slice(0, 7)) return false;
  if (last !== today) await setSetting("thesisLaunchDay", today);
  return true;
}

export async function aiThesisCheck(ctx: Ctx, opts: { limit?: number; reserveMs?: number; launch?: boolean } = {}) {
  if (!(await aiAvailable())) return;
  const launch = !!opts.launch && (await launchAllowed());
  if (opts.launch && !launch) ctx.change("A launch run already went past the daily cap this month: today's checks stop at the daily cap");
  const cos = await db()
    .select({ id: S.companies.id, name: S.companies.name, area: S.companies.thesisArea, description: S.companies.description, domain: S.companies.domain, keep: S.companies.keep, notStartup: S.companies.notStartup })
    .from(S.companies)
    .where(and(eq(S.companies.hidden, false), isNull(S.companies.mergedInto), isNotNull(S.companies.thesisArea), isNull(S.companies.notStartup), isNull(S.companies.thesisCheck), eq(S.companies.keep, false), sql`coalesce(${S.companies.totalRaised}, ${S.companies.amount}, 0) < ${CAP}`))
    .orderBy(sql`${S.companies.score} desc`)
    .limit(opts.limit ?? 400);
  await ctx.stage("AI thesis check", 0, cos.length);
  for (const c of cos) {
    const room = ctx.timeLeft() - (opts.reserveMs ?? 0); // a check never eats the time kept for websites and pictures
    if (ctx.outOfTime() || room < CHECK_GAP_MS + CHECK_MIN_MS) {
      ctx.more(); // out of room, not out of cards: the next round goes on
      break;
    }
    const heads = (await db().select({ title: S.signals.title }).from(S.signals).where(eq(S.signals.companyId, c.id)).limit(3)).map((s) => s.title);
    const check = await thesisCheck({ name: c.name, area: c.area, description: c.description, headlines: heads }, room, launch);
    if (!check) break; // AI off, today's cap reached, or no answer: the rest wait for tomorrow
    const why = startupVerdict({ ...c, thesisCheck: check });
    await db().update(S.companies).set({ thesisCheck: check, notStartup: why }).where(eq(S.companies.id, c.id));
    if (!check.ok) ctx.change(`Outside the thesis: ${c.name} (${check.why})`);
    ctx.item();
    ctx.tick();
  }
}

export async function enrichJob(ctx: Ctx) {
  await startupFilter(ctx);
  await mergeDuplicates(ctx);
  await aiThesisCheck(ctx, { reserveMs: 120_000 });
  await enrichCompanies(ctx);
}

/** One-time: the last 12 months of funding news, month by month, so startups that raised before Scout started
 *  get a card (the coverage check found every library startup missing for this reason, 10-26-26). Resumable. */
export async function backfillJob(ctx: Ctx, months = 12) {
  const qs = (await getSetting<string[]>("thesisQueries", DEFAULT_QUERIES)).slice(0, 6);
  const done = await ctx.cursor<{ k: number } | null>(null);
  const plan: { q: string; after: string; before: string }[] = [];
  for (let m = 0; m < months; m++) {
    const before = new Date(Date.now() - m * 30 * DAY).toISOString().slice(0, 10);
    const after = new Date(Date.now() - (m + 1) * 30 * DAY).toISOString().slice(0, 10);
    for (const q of qs) for (const f of FUNDING_SEARCHES) plan.push({ q: `(${q}) ${f}`, after, before });
  }
  let k = done?.k || 0;
  await ctx.stage("funding news, last 12 months", k, plan.length);
  const seen = new Set<string>();
  for (; k < plan.length && !ctx.outOfTime(); k++) {
    const p = plan[k];
    const items = await F.googleNews(p.q, "", p.before, p.after);
    await saveItems(items.map((n) => ({ kind: "news", source: n.outlet || "Google News", title: n.title, url: n.url, date: n.date, text: n.text })));
    for (const n of items) {
      await fromHeadline(ctx, { title: n.title, url: n.url, date: n.date, text: n.text, outlet: n.outlet }, "Google News");
      await secondLook(ctx, n, "Google News", seen);
    }
    ctx.tick();
  }
  await ctx.saveCursor({ k: k >= plan.length ? 0 : k });
}
