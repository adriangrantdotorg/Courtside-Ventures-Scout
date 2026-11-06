// News Links (carried over from the VC Scout engine; Scout 11-06-26), on a test database with Google's own answers
// captured on 11-04-26 (tests/fixtures/proof/: its search, its redirect page and its batchexecute answer, which gives
// TechCrunch's Rebuy Series A). Every Google News link a page shows is opened once, the article's address replaces it
// everywhere it is stored, and a story seen again is saved under that address, never as a second row.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { eq, is, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { transport, resetBackoff } from "@/lib/sources/http";
import { resetLinks } from "@/lib/sources/gnews";

const fx = (f: string) => readFileSync(join(__dirname, "../fixtures/proof", f), "utf8");
const RSS = fx("gnews-rebuy.xml");
const G = RSS.match(/<link>(https:\/\/news\.google\.com\/rss\/articles\/[^<]+)<\/link>/)![1];
const G2 = "https://news.google.com/rss/articles/CBMiTESTONLYINAFEEDITEM?oc=5";
const ARTICLE = "https://techcrunch.com/2023/02/24/rebuy-commerce-personalization-series-a/";

const realFetch = transport.fetch;
let googleCalls = 0;
let googleOpens = true;
type D = ReturnType<typeof drizzle<typeof schema>>;
let d: D;

beforeAll(async () => {
  d = drizzle(new PGlite(), { schema });
  await migrate(d, { migrationsFolder: "./drizzle" });
  (globalThis as { __scoutTestDb?: unknown }).__scoutTestDb = d;
  transport.fetch = (async (u: string | URL | Request) => {
    const url = String(u);
    if (url.includes("news.google.com/rss/search")) return new Response(RSS, { status: 200 });
    if (url.includes("news.google.com")) {
      googleCalls++;
      if (!googleOpens) return new Response("<html>no signature</html>", { status: 200 });
      return new Response(url.includes("batchexecute") ? fx("gnews-batchexecute.txt") : fx("gnews-article-page.html"), { status: 200 });
    }
    return new Response("", { status: 404 });
  }) as typeof fetch;
}, 120_000);
afterAll(() => {
  transport.fetch = realFetch;
  delete (globalThis as { __scoutTestDb?: unknown }).__scoutTestDb;
});
beforeEach(() => {
  resetLinks();
  resetBackoff();
  googleCalls = 0;
  googleOpens = true;
});

describe("News Links", () => {
  it("opens each link a page shows once and puts the article's address everywhere it is stored", async () => {
    const [co] = await d.insert(schema.companies).values({ key: "rebuy", name: "Rebuy", rounds: [{ stage: "series-a", amount: 17e6, low: null, currency: "$", date: "2023-02-24", investors: null, sources: [{ name: "TechCrunch", url: G, amount: 17e6, date: "2023-02-24", title: "Rebuy raises" }] }] }).returning();
    await d.insert(schema.signals).values({ companyId: co.id, type: "news", source: "TechCrunch", title: "Rebuy raises $17M", url: G });
    const [fund] = await d.insert(schema.funds).values({ slug: "m13", name: "M13", kind: "neighborhood" }).returning();
    await d.insert(schema.fundItems).values({ fundId: fund.id, kind: "deal", title: "Rebuy raises $17M", url: G });
    await d.insert(schema.trends).values({ slug: "upsells", term: "upsells", headline: "Upsells", sources: [{ url: G, date: "2023-02-24", title: "Rebuy", source: "news" }] });
    await d.insert(schema.feedItems).values([
      { kind: "news", source: "TechCrunch", title: "Rebuy raises $17M", url: G },
      { kind: "news", source: "Elsewhere", title: "A story no page shows", url: G2 },
    ]);
    const { sweepLinks } = await import("@/lib/jobs/links");
    const r = await sweepLinks({ deadline: Date.now() + 60_000 });
    expect(r).toMatchObject({ opened: 1, refused: 0, left: 0, failed: 0 });
    expect(googleCalls).toBe(2); // one link: Google's page, then the address
    expect((await d.select().from(schema.signals))[0].url).toBe(ARTICLE);
    expect((await d.select().from(schema.fundItems))[0].url).toBe(ARTICLE);
    expect((await d.select().from(schema.trends))[0].sources[0].url).toBe(ARTICLE);
    expect((await d.select().from(schema.companies))[0].rounds[0].sources[0].url).toBe(ARTICLE);
    const feed = await d.select().from(schema.feedItems).orderBy(schema.feedItems.id);
    expect(feed.map((f) => f.url)).toEqual([ARTICLE, G2]); // a link no page shows is never opened
    // a second sweep has nothing to open
    googleCalls = 0;
    resetLinks();
    expect(await sweepLinks({ deadline: Date.now() + 60_000 })).toMatchObject({ opened: 0, swapped: 0 });
    expect(googleCalls).toBe(0);
  });

  it("saves a story seen again under the address it already holds, never as a second row", async () => {
    const F = await import("@/lib/sources/fetchers");
    const { addSignal } = await import("@/lib/companies");
    const [n] = await F.googleNews('"Rebuy"');
    expect(n.url).toBe(ARTICLE);
    const [co] = await d.select().from(schema.companies).where(eq(schema.companies.key, "rebuy"));
    await addSignal(co.id, { type: "news", source: n.outlet, title: n.title, url: n.url, date: null });
    expect(await d.select().from(schema.signals).where(eq(schema.signals.companyId, co.id))).toHaveLength(1);
  });

  it("reads a feed copy only when its link is already opened (11-06-26: 2.3 MB of every sweep's 3.3 MB on Neon's free tier)", async () => {
    const shut = "https://news.google.com/rss/articles/CBMiTESTONLYFEEDSHUT?oc=5";
    const open = "https://news.google.com/rss/articles/CBMiTESTONLYFEEDOPEN?oc=5";
    await d.insert(schema.feedItems).values([
      { kind: "news", source: "Elsewhere", title: "A feed copy never opened", url: shut },
      { kind: "news", source: "Elsewhere", title: "A feed copy already opened", url: open },
    ]);
    await d.insert(schema.cache).values({ key: "gnews:CBMiTESTONLYFEEDOPEN", value: { url: "https://example.com/opened" } });
    const { rowsIn, PLACES } = await import("@/lib/jobs/links");
    const feed = PLACES.find((p) => p.table === schema.feedItems)!;
    const read = (await rowsIn(feed)).map((r) => r.v);
    expect(read).toContain(open);
    expect(read).not.toContain(shut);
    expect(read).not.toContain(G2); // the first test's unopened feed copy
    const { sweepLinks } = await import("@/lib/jobs/links");
    await sweepLinks({ deadline: Date.now() + 60_000 });
    const urls = (await d.select().from(schema.feedItems)).map((f) => f.url);
    expect(urls).toContain("https://example.com/opened");
    expect(urls).toContain(shut);
  });

  it("removes the second copy when the same story was saved under both addresses", async () => {
    const [co] = await d.insert(schema.companies).values({ key: "rebuy2", name: "Rebuy Engine" }).returning();
    await d.insert(schema.signals).values([
      { companyId: co.id, type: "news", source: "TechCrunch", title: "Rebuy raises", url: ARTICLE },
      { companyId: co.id, type: "news", source: "TechCrunch", title: "Rebuy raises", url: G },
    ]);
    const { sweepLinks } = await import("@/lib/jobs/links");
    const r = await sweepLinks({ deadline: Date.now() + 60_000 });
    expect(r.removed).toBe(1);
    expect((await d.select().from(schema.signals).where(eq(schema.signals.companyId, co.id))).map((s) => s.url)).toEqual([ARTICLE]);
  });

  it("keeps Google's address for a link Google won't open, and tries it again after 7 days", async () => {
    const link = "https://news.google.com/rss/articles/CBMiTESTONLYREFUSED?oc=5";
    const [co] = await d.insert(schema.companies).values({ key: "refused", name: "Refused Co" }).returning();
    await d.insert(schema.signals).values({ companyId: co.id, type: "news", source: "News", title: "Refused Co raises", url: link });
    googleOpens = false;
    const { sweepLinks } = await import("@/lib/jobs/links");
    expect(await sweepLinks({ deadline: Date.now() + 60_000 })).toMatchObject({ opened: 0, refused: 1 });
    expect((await d.select().from(schema.signals).where(eq(schema.signals.companyId, co.id)))[0].url).toBe(link);
    resetLinks();
    googleCalls = 0;
    await sweepLinks({ deadline: Date.now() + 60_000 });
    expect(googleCalls).toBe(0); // within 7 days: not asked again
    await d.execute(sql`update cache set created_at = now() - interval '8 days' where key = 'gnews:CBMiTESTONLYREFUSED'`);
    resetLinks();
    await sweepLinks({ deadline: Date.now() + 60_000 });
    expect(googleCalls).toBeGreaterThan(0);
  });

  it("leaves the links it has no time for to the next run", async () => {
    const [co] = await d.insert(schema.companies).values({ key: "late", name: "Late Co" }).returning();
    await d.insert(schema.signals).values({ companyId: co.id, type: "news", source: "News", title: "Late Co raises", url: "https://news.google.com/rss/articles/CBMiTESTONLYLATE" });
    const { sweepLinks } = await import("@/lib/jobs/links");
    const r = await sweepLinks({ deadline: Date.now() });
    expect(r.opened).toBe(0);
    expect(r.left).toBeGreaterThan(0);
    expect(googleCalls).toBe(0);
  });
});

describe("a deploy never starts the stored backlog (Adrian, 11-04-26: \"I want to be able to trigger that at my own convenience\")", () => {
  it("a job opens only the links it saved; the ones stored before wait for links-all", async () => {
    const old = "https://news.google.com/rss/articles/CBMiTESTONLYBACKLOG";
    const fresh = "https://news.google.com/rss/articles/CBMiTESTONLYFRESH";
    const [a] = await d.insert(schema.companies).values({ key: "backlog", name: "Backlog Co" }).returning();
    const [b] = await d.insert(schema.companies).values({ key: "fresh", name: "Fresh Co" }).returning();
    await d.insert(schema.signals).values({ companyId: a.id, type: "news", source: "News", title: "Backlog Co raises", url: old });
    const { shownLinks, openSaved, openLeft } = await import("@/lib/jobs/links");
    const before = await shownLinks();
    await d.insert(schema.signals).values({ companyId: b.id, type: "news", source: "News", title: "Fresh Co raises", url: fresh }); // the job saves one
    await openSaved(before, Date.now() + 60_000);
    const url = async (id: number) => (await d.select().from(schema.signals).where(eq(schema.signals.companyId, id)))[0].url;
    expect(await url(b.id)).toBe(ARTICLE);
    expect(await url(a.id)).toBe(old);
    // the daily News Links job opens only what a job had no time for
    await openLeft({ deadline: Date.now() + 60_000 });
    expect(await url(a.id)).toBe(old);
  });

  it("a link a job had no time for waits in the list the daily job opens", async () => {
    const late = "https://news.google.com/rss/articles/CBMiTESTONLYNOTIME";
    const [c] = await d.insert(schema.companies).values({ key: "notime", name: "No Time Co" }).returning();
    const { shownLinks, openSaved, openLeft } = await import("@/lib/jobs/links");
    const before = await shownLinks();
    await d.insert(schema.signals).values({ companyId: c.id, type: "news", source: "News", title: "No Time Co raises", url: late });
    await openSaved(before, Date.now()); // no time left
    const { getSetting } = await import("@/lib/settings");
    expect(await getSetting<string[]>("linksLeft", [])).toContain("CBMiTESTONLYNOTIME");
    await openLeft({ deadline: Date.now() + 60_000 });
    expect((await d.select().from(schema.signals).where(eq(schema.signals.companyId, c.id)))[0].url).toBe(ARTICLE);
    expect(await getSetting<string[]>("linksLeft", [])).toEqual([]);
  });
});

describe("every column that can hold a link", () => {
  it("is swept (PLACES) or named with why it never holds a Google News link (NOT_LINKS)", async () => {
    const { PLACES, NOT_LINKS } = await import("@/lib/jobs/links");
    const swept = new Set(PLACES.map((p) => `${getTableConfig(p.table).name}.${p.column.name}`));
    const seen = new Set<string>();
    const missing: string[] = [];
    for (const t of Object.values(schema)) {
      if (!is(t, PgTable)) continue;
      const cfg = getTableConfig(t);
      for (const c of cfg.columns) {
        const key = `${cfg.name}.${c.name}`;
        seen.add(key);
        const linkish = c.columnType === "PgJsonb" || (c.columnType === "PgText" && /(^|_)(url|site|link|links|feed|image)$/.test(c.name));
        if (linkish && !swept.has(key) && !NOT_LINKS[key]) missing.push(key);
      }
    }
    expect(missing, "add each to PLACES or NOT_LINKS in src/lib/jobs/links.ts").toEqual([]);
    expect(Object.keys(NOT_LINKS).filter((k) => !seen.has(k)), "NOT_LINKS names a column the schema no longer has").toEqual([]);
  });
});
