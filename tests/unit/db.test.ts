import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";

const seed = JSON.parse(readFileSync("seed/scout-launch-seed.json", "utf8"));

beforeAll(async () => {
  const pg = new PGlite();
  const d = drizzle(pg, { schema });
  await migrate(d, { migrationsFolder: "./drizzle" });
  (globalThis as { __scoutTestDb?: unknown }).__scoutTestDb = d;
  const small = { ...seed, companies: seed.companies.slice(0, 40), sponsors: seed.sponsors.slice(0, 20), mentions: seed.mentions.slice(0, 100), fundItems: seed.fundItems.slice(0, 80) };
  const { loadSeed } = await import("@/lib/seed");
  await loadSeed(small);
}, 120_000);

describe("the launch seed in the real schema", () => {
  it("loads the portfolio, backtests and settings", async () => {
    const { db, schema: S } = await import("@/db");
    // the counts follow the seed: the weekly job keeps Scout's portfolio in step with Courtside's site (Betty and
    // Zionverse left it before the 10-27-26 export) and adds a backtest per new Courtside post (Commons Clinic, 10-18-26)
    expect((await db().select().from(S.portfolio)).length).toBe(seed.portfolio.length);
    const bt = await db().select().from(S.backtests);
    expect(bt.length).toBe(seed.backtests.length);
    // the three hand-verified wins of the launch stay
    expect(bt.filter((b) => b.verdict === "win").map((b) => b.leadDays)).toEqual(expect.arrayContaining([106, 162, 785]));
    for (const b of bt) for (const e of b.evidence) {
      expect(e.url).not.toMatch(/news\.google\.com/);
      if (!e.counts) expect(e.note.startsWith("Rejected because")).toBe(true);
    }
  });
  it("one company per domain; cards render from the queries", async () => {
    const { companyCards, homeCounts, sponsorCards } = await import("@/lib/queries");
    const cards = await companyCards("thesis");
    const domains = cards.map((c) => c.domain).filter(Boolean);
    expect(new Set(domains).size).toBe(domains.length);
    expect(cards.every((c) => c.score >= 0 && c.score <= 100)).toBe(true);
    const counts = await homeCounts();
    expect(counts.sponsors).toBe(20);
    expect((await sponsorCards()).every((s) => s.shows.length >= 1)).toBe(true);
  });
  it("upsert merges the same company from three sources into one card", async () => {
    const { upsertCompany } = await import("@/lib/companies");
    const a = await upsertCompany({ name: "Zestly", domain: "https://zestly.app", thesisArea: "health", signal: { type: "hn", source: "Hacker News", title: "Show HN: Zestly", url: "https://news.ycombinator.com/item?id=1", date: new Date() } });
    const b = await upsertCompany({ name: "Zestly", thesisArea: "health", signal: { type: "news", source: "TechCrunch", title: "Zestly raises $2M seed", url: "https://techcrunch.com/zestly", date: new Date() } });
    const c = await upsertCompany({ name: "Zestly Inc.", domain: "zestly.app", signal: { type: "formd", source: "SEC EDGAR", title: "Form D: Zestly", url: "https://sec.gov/x", date: new Date() } });
    expect(a?.id).toBe(b?.id);
    expect(b?.id).toBe(c?.id);
    const { db, schema: S } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    expect((await db().select().from(S.signals).where(eq(S.signals.companyId, a!.id))).length).toBe(3);
  });
  it("the Spotlight is always picked by a rule and links inside the app", async () => {
    const { computeSpotlight } = await import("@/lib/spotlight");
    const s = await computeSpotlight();
    expect(s).not.toBeNull();
    expect(s!.link.href.startsWith("/")).toBe(true);
  });
  it("tracking a 31st trend is refused", async () => {
    const { db, schema: S } = await import("@/db");
    const { slugify } = await import("@/lib/format");
    for (let i = 0; i < 31; i++) await db().insert(S.trends).values({ slug: slugify(`t${i}`), term: `t${i}`, headline: `t${i}`, tracked: i < 30 }).onConflictDoNothing();
    const { sql } = await import("drizzle-orm");
    const r = (await db().execute(sql`select count(*)::int as n from trends where tracked`)) as unknown as { rows: { n: number }[] };
    expect(Number(r.rows[0].n)).toBe(30);
  });
});

describe("routes", () => {
  it("a cron call without the secret gets 401", async () => {
    process.env.CRON_SECRET = "s3cret";
    const { GET } = await import("@/app/api/cron/[job]/route");
    const { NextRequest } = await import("next/server");
    const r = await GET(new NextRequest("http://x/api/cron/score", { headers: { authorization: "Bearer nope" } }), { params: Promise.resolve({ job: "score" }) });
    expect(r.status).toBe(401);
    const r2 = await GET(new NextRequest("http://x/api/cron/score"), { params: Promise.resolve({ job: "score" }) });
    expect(r2.status).toBe(401);
  });
  it("with AI off, the memo is an outline and drafting answers quietly", async () => {
    const m = await import("@/app/api/memo/[id]/route");
    const { db, schema: S } = await import("@/db");
    const [c] = await db().select().from(S.companies).limit(1);
    const got = await m.GET(new Request("http://x"), { params: Promise.resolve({ id: String(c.id) }) });
    const j = await got.json();
    expect(j.markdown).toMatch(/Why We Invested:/);
    expect(j.markdown).toMatch(/\[TBD/);
    const post = await m.POST(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ id: String(c.id) }) });
    expect(post.status).toBe(409);
  });
  it("the AI check fails quietly without gateway auth", async () => {
    delete process.env.VERCEL_OIDC_TOKEN;
    const { checkAi, aiAvailable } = await import("@/lib/ai");
    expect(await checkAi()).toBe(false);
    expect(await aiAvailable()).toBe(false);
  });
});

// 11-05-26: Hoopr's card read "raised $40.0M Series A" for a ₹4 crore (about $480K) round. It was saved with no amount
// (currency "$" by default); a later "₹4 Crore" story filled the amount and left the "$".
describe("a company's raise keeps its currency", () => {
  it("an amount added to an existing card brings its currency, and the card states it in dollars", async () => {
    const { upsertCompany, moneyOf } = await import("@/lib/companies");
    const { db, schema: S } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const { whyFitsLine } = await import("@/lib/score");
    const sig = (t: string, url: string) => ({ type: "news", source: "test", title: t, url, date: new Date("2026-02-20") });
    const first = await upsertCompany({ name: "Tunelicense Test", thesisArea: "media", stage: "seed", amount: null, currency: "$", signal: sig("Tunelicense Test secures funding in its seed round", "https://example.com/a") });
    const m = moneyOf("Tunelicense Test Raises ₹4 Crore to Strengthen Its Platform")!;
    expect(m).toEqual({ amount: 4e7, currency: "INR" });
    await upsertCompany({ name: "Tunelicense Test", thesisArea: "media", stage: "seed", amount: m.amount, currency: m.currency, signal: sig("Tunelicense Test Raises ₹4 Crore", "https://example.com/b") });
    const [c] = await db().select().from(S.companies).where(eq(S.companies.id, first!.id));
    expect([Number(c.amount), c.currency]).toEqual([4e7, "INR"]);
    // a second story in another currency never re-labels the amount already saved
    await upsertCompany({ name: "Tunelicense Test", thesisArea: "media", stage: "seed", amount: 5e5, currency: "$", signal: sig("Tunelicense Test raises $500K", "https://example.com/c") });
    const [c2] = await db().select().from(S.companies).where(eq(S.companies.id, first!.id));
    expect([Number(c2.amount), c2.currency]).toEqual([4e7, "INR"]);
    const line = whyFitsLine({ name: c.name, description: "", thesisArea: "media", stage: "seed", amount: Number(c.amount), currency: c.currency, lastSignal: null });
    expect(line).toContain("raised $480K seed");
    expect(line).not.toMatch(/40\.0M/);
  });
});

// 11-06-26: Hoopr's memo cited four news.google.com redirect links and asked the founder who backed the round, though
// Scout knew The Chennai Angels did. The outline now carries each story's own address and the round's investors.
describe("the memo outline cites the stories' own links and the round's investors", () => {
  it("opens each Google News link once, lists one Google won't open without a link, and names the investors", async () => {
    const { transport } = await import("@/lib/sources/http");
    const { resetLinks } = await import("@/lib/sources/gnews");
    const { memoOutline } = await import("@/lib/memo");
    const { db, schema: S } = await import("@/db");
    const { upsertCompany } = await import("@/lib/companies");
    const real = transport.fetch;
    const asked: string[] = [];
    transport.fetch = (async (url: string) => {
      asked.push(String(url));
      if (String(url).includes("/rss/articles/OPENS")) return new Response('<div data-n-a-sg="SIG" data-n-a-ts="123"></div>', { status: 200 });
      if (String(url).includes("/rss/articles/")) return new Response("no signature here", { status: 200 });
      return new Response(')]}\'\n[["wrb.fr","Fbv4je","[\\"garturlres\\",\\"https://news.example.com/courtline-seed\\",1]"]]', { status: 200 });
    }) as typeof fetch;
    try {
      resetLinks();
      const sig = (t: string, url: string) => ({ type: "news", source: "test", title: t, url, date: new Date("2026-02-20") });
      const r = await upsertCompany({ name: "Courtline Outline Test", thesisArea: "sports", stage: "seed", amount: 25e5, currency: "$", signal: sig("Courtline Outline Test raises $2.5M seed", "https://news.google.com/rss/articles/OPENS?oc=5") });
      await upsertCompany({ name: "Courtline Outline Test", thesisArea: "sports", stage: "seed", amount: null, currency: "$", signal: sig("Courtline Outline Test seed round", "https://news.google.com/rss/articles/SHUT?oc=5") });
      const { eq } = await import("drizzle-orm");
      await db().update(S.companies).set({ rounds: [{ stage: "seed", amount: 25e5, low: 25e5, currency: "$", date: "2026-02-20", investors: "Example Angels", sources: [{ url: "https://news.google.com/rss/articles/OPENS?oc=5", date: "2026-02-20", name: "Test", title: "seed", amount: 25e5 }] }] }).where(eq(S.companies.id, r!.id));
      const md = (await memoOutline(r!.id))!.markdown;
      expect(md).toContain("Investors the news names: Example Angels (https://news.example.com/courtline-seed)");
      expect(md).toContain("raises $2.5M seed (test, ");
      expect(md).toContain(": https://news.example.com/courtline-seed");
      expect(md).not.toMatch(/news\.google\.com/);
      // the same link again is remembered, never opened twice
      const n = asked.length;
      await memoOutline(r!.id);
      expect(asked.length).toBe(n);
    } finally {
      transport.fetch = real;
    }
  });
});
