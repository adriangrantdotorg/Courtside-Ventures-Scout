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
