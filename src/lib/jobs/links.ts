// News Links (carried over from the VC Scout engine, 11-04-26; Scout 11-06-26). Google News hands Scout links that hold
// only an id (news.google.com/rss/articles/CBMi…). Each one a page shows is opened once (about 4 s:
// src/lib/sources/gnews.ts), and the article's own address (techcrunch.com/…) replaces it in every place it is stored,
// so company pages, Funds Raised, fund deals, trends, the Monday brief and the memo link the outlet. Every job opens the
// links it just saved as it finishes (runNamed, src/lib/jobs/index.ts); the daily News Links job opens the ones a job
// had no time for. The links stored before this existed (521 on 11-06-26) are opened by `links-all`, run by hand
// (npm run pipeline:all -- links-all --rounds=10). A link Google won't open keeps Google's address (it still opens the story in
// one click) and is tried again after 7 days.
import { getTableName, sql, type Column } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db, schema as S } from "@/db";
import { articleUrl, markSwept, remembered } from "../sources/gnews";
import { getSetting, setSetting } from "../settings";
import type { Ctx } from "./runner";

/** One link costs about this many seconds: Google's 2 s manners, twice (its page, then the address). */
export const LINK_SECONDS = 4;

/** A column that holds links. `shown`: a page shows it (its links are opened); feed_items only keeps copies of stories
 *  for later jobs, so only links already opened are swapped there. `unique`: a row whose new address another row
 *  already holds under the same key is the same story, saved twice, and is removed. */
export type Place = { table: PgTable; column: Column; shown: boolean; json?: boolean; unique?: boolean };

/** Every column that can hold a Google News link. tests/unit/links.test.ts fails when the schema gets a link column
 *  that is in neither PLACES nor NOT_LINKS. */
export const PLACES: Place[] = [
  { table: S.signals, column: S.signals.url, shown: true, unique: true },
  { table: S.fundItems, column: S.fundItems.url, shown: true, unique: true },
  { table: S.alertHits, column: S.alertHits.url, shown: true, unique: true },
  { table: S.mentions, column: S.mentions.url, shown: true, unique: true },
  { table: S.personItems, column: S.personItems.url, shown: true, unique: true },
  { table: S.sponsorSightings, column: S.sponsorSightings.url, shown: true, unique: true },
  { table: S.feedItems, column: S.feedItems.url, shown: false, unique: true },
  { table: S.companies, column: S.companies.descriptionUrl, shown: true },
  { table: S.backtests, column: S.backtests.announceUrl, shown: true },
  { table: S.companies, column: S.companies.rounds, shown: true, json: true }, // Funds Raised's sources
  { table: S.trends, column: S.trends.sources, shown: true, json: true },
  { table: S.briefs, column: S.briefs.data, shown: true, json: true }, // the Monday brief
  { table: S.backtests, column: S.backtests.evidence, shown: true, json: true },
  { table: S.funds, column: S.funds.shared, shown: true, json: true },
  { table: S.settings, column: S.settings.value, shown: true, json: true }, // Today's Spotlight
  { table: S.changeLog, column: S.changeLog.after, shown: true, json: true }, // a fund's move, with its proof
];

/** Link-like columns that never hold a Google News link, and why. */
export const NOT_LINKS: Record<string, string> = {
  "portfolio.description_url": "the firm's own portfolio page",
  "portfolio.site": "a portfolio company's website",
  "companies.media": "pictures and videos from the company's own site",
  "companies.site_snapshot": "the homepage's description",
  "companies.aliases": "names",
  "companies.breakdown": "score parts",
  "companies.portfolio_check": "a portfolio overlap note",
  "companies.thesis_check": "the AI Thesis Check's answer",
  "voices.image": "a creator's picture",
  "voices.feeds": "a creator's feed addresses",
  "voices.youtube": "a creator's YouTube channels",
  "voices.seen_ids": "episode ids already read",
  "voices.site": "a creator's site",
  "funds.site": "a fund's website",
  "funds.feeds": "a fund's blog feeds",
  "funds.youtube": "a fund's YouTube channels",
  "courtside_posts.url": "the firm's own posts",
  "filings.url": "SEC EDGAR",
  "filings.related": "names on the filing",
  "trends.source_kinds": "kinds of sources",
  "trends.weekly": "counts",
  "alerts.rule": "an alert's words",
  "feed_items.processed": "which jobs read the item",
  "job_runs.cursor": "where a job stopped",
  "job_runs.changes": "a job's change lines",
  "change_log.before": "a value before a change",
  "cache.value": "this memory itself",
  "people.site": "a person's own site",
  "sponsors.site": "a sponsor's website",
  "feedback.chips": "a feedback note's tags",
};

/** A Google News link anywhere in a value: its id is group 1. */
const LINK = /https?:\/\/news\.google\.com\/(?:rss\/)?articles\/([A-Za-z0-9_-]+)(?:\?[^"\s\\<>)\]]*)?/g;
const LIKE = "%news.google.com/%articles/%";

type Row = { id: number; v: string };

/** The rows of a place that hold a Google News link. A place no page shows (feed_items) is only swapped, never opened,
 *  so the database returns only the rows whose link is already opened: on 11-06-26 its 7,619 Google rows were 2.3 MB of
 *  every sweep's 3.3 MB read, on Neon's free 5 GB a month of network transfer. */
export async function rowsIn(p: Place): Promise<Row[]> {
  const t = sql.raw(`"${getTableName(p.table)}"`);
  const c = sql.raw(`"${p.column.name}"`);
  const pk = sql.raw(getTableName(p.table) === "settings" ? `"key"` : `"id"`);
  const opened = p.shown
    ? sql``
    : sql` and exists (select 1 from cache k where k.key = 'gnews:' || substring(${c}::text from 'articles/([A-Za-z0-9_-]+)') and k.value->>'url' is not null)`;
  const r = (await db().execute(sql`select ${pk} as id, ${c}::text as v from ${t} where ${c}::text like ${LIKE}${opened}`)) as unknown as { rows: Row[] };
  return r.rows;
}

const idsOf = (v: string) => [...v.matchAll(LINK)].map((m) => m[1]);

export type Sweep = { opened: number; refused: number; left: number; swapped: number; removed: number; failed: number; waiting: string[] };

/** The ids of every Google News link a page shows now. */
export async function shownLinks(): Promise<Set<string>> {
  const out = new Set<string>();
  for (const p of PLACES.filter((x) => x.shown)) for (const r of await rowsIn(p)) for (const id of idsOf(r.v)) out.add(id);
  return out;
}

/** Open the Google News links a page shows that Scout hasn't opened (every one, or only those in `only`) until
 *  `deadline`, then put each opened link's article address everywhere it is stored. `waiting`: the ones left for time. */
export async function sweepLinks(o: { deadline: number; only?: Set<string>; onStart?: (toOpen: number) => unknown; onOpen?: () => unknown }): Promise<Sweep> {
  const out: Sweep = { opened: 0, refused: 0, left: 0, swapped: 0, removed: 0, failed: 0, waiting: [] };
  // the places a page shows first; the feed copies are read after the opening, so they include this run's links
  const found = await Promise.all(PLACES.filter((p) => p.shown).map(async (p) => ({ p, rows: await rowsIn(p) })));
  const shown = new Set<string>();
  const all = new Set<string>();
  for (const { rows } of found)
    for (const r of rows)
      for (const id of idsOf(r.v)) {
        all.add(id);
        shown.add(id);
      }
  const memo = await remembered([...all]);
  const toOpen = [...shown].filter((id) => !memo.has(id) && (!o.only || o.only.has(id)));
  await o.onStart?.(toOpen.length);
  for (const [k, id] of toOpen.entries()) {
    if (Date.now() + LINK_SECONDS * 1000 + 2000 > o.deadline) {
      out.left = toOpen.length - k;
      out.waiting = toOpen.slice(k);
      break;
    }
    const url = await articleUrl(`https://news.google.com/rss/articles/${id}`);
    memo.set(id, { url });
    if (url) out.opened++;
    else out.refused++;
    await o.onOpen?.();
  }
  // the feed copies whose link is opened (the database picks them: rowsIn), this run's included
  for (const p of PLACES.filter((x) => !x.shown)) {
    const rows = await rowsIn(p);
    found.push({ p, rows });
    for (const r of rows) for (const id of idsOf(r.v)) all.add(id);
  }
  if (!all.size) return out;
  const unknown = [...all].filter((id) => !memo.has(id));
  if (unknown.length) for (const [id, m] of await remembered(unknown)) memo.set(id, m);
  // every stored copy of an opened link gets the article's address
  const failed = new Set<string>();
  for (const { p, rows } of found) {
    const t = sql.raw(`"${getTableName(p.table)}"`);
    const c = sql.raw(`"${p.column.name}"`);
    const pk = sql.raw(getTableName(p.table) === "settings" ? `"key"` : `"id"`);
    for (const r of rows) {
      const v = r.v.replace(LINK, (m, id: string) => {
        const a = memo.get(id)?.url;
        return a ? (p.json ? JSON.stringify(a).slice(1, -1) : a) : m;
      });
      if (v === r.v) continue;
      try {
        await db().execute(p.json ? sql`update ${t} set ${c} = ${v}::jsonb where ${pk} = ${r.id}` : sql`update ${t} set ${c} = ${v} where ${pk} = ${r.id}`);
        out.swapped++;
      } catch (e) {
        // the same story under its article's address is already saved: this copy is the second one
        if (p.unique && /duplicate key|23505|unique/i.test(`${e} ${(e as { cause?: unknown }).cause ?? ""}`)) {
          await db().execute(sql`delete from ${t} where ${pk} = ${r.id}`);
          out.removed++;
        } else {
          out.failed++;
          for (const id of idsOf(r.v)) failed.add(id);
        }
      }
    }
  }
  await markSwept([...all].filter((id) => memo.get(id)?.url && !failed.has(id)));
  return out;
}

/** Links a job saved but had no time to open (the daily News Links job opens them). */
const LEFT = "linksLeft";

/** After a job: open the links it saved (shown now, not shown before it ran) until `deadline`; the rest wait for the
 *  daily News Links job. Refresh Now only notes them (`open` false) and opens them after its answer is sent. */
export async function openSaved(before: Set<string>, deadline: number, open = true) {
  const fresh = [...(await shownLinks())].filter((id) => !before.has(id));
  if (!fresh.length) return;
  const waiting = open ? (await sweepLinks({ deadline, only: new Set(fresh) })).waiting : fresh;
  if (waiting.length) await setSetting(LEFT, [...new Set([...(await getSetting<string[]>(LEFT, [])), ...waiting])]);
}

/** The links jobs saved and had no time to open, opened until `deadline`. */
export async function openLeft(o: { deadline: number; onStart?: (toOpen: number) => unknown; onOpen?: () => unknown }) {
  const r = await sweepLinks({ ...o, only: new Set(await getSetting<string[]>(LEFT, [])) });
  await setSetting(LEFT, r.waiting);
  return r;
}

function report(ctx: Ctx, r: Sweep) {
  ctx.item(r.opened);
  if (r.opened || r.refused) ctx.change(`Opened ${r.opened} news links${r.refused ? `; Google wouldn't open ${r.refused} (tried again in 7 days)` : ""}`);
  if (r.removed) ctx.change(`Removed ${r.removed} stories saved twice`);
  if (r.failed) ctx.error(`${r.failed} stored links could not be changed`);
  if (r.left) ctx.more();
}

/** The daily News Links job: the links a job saved and had no time to open. */
export async function linksJob(ctx: Ctx) {
  report(ctx, await openLeft({ deadline: Date.now() + ctx.timeLeft() - 5_000, onStart: (n) => ctx.stage("news links, opened once", 0, n), onOpen: () => ctx.tick() }));
}

/** Every link a page shows that Scout hasn't opened, the ones stored before News Links existed included: run by hand
 *  (npm run pipeline:all -- links-all --rounds=10). About 4 s a link. */
export async function linksAllJob(ctx: Ctx) {
  const r = await sweepLinks({ deadline: Date.now() + ctx.timeLeft() - 5_000, onStart: (n) => ctx.stage("news links, opened once", 0, n), onOpen: () => ctx.tick() });
  await setSetting(LEFT, (await getSetting<string[]>(LEFT, [])).filter((id) => r.waiting.includes(id)));
  report(ctx, r);
}
