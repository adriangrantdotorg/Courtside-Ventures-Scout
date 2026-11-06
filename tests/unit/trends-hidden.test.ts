// A week with no trend hides Trends everywhere (11-06-26): the top bar, the phone tab bar, ⌘K, g t and the shortcuts
// list drop it, and an old link to /trends lands on Today.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";

beforeAll(async () => {
  const d = drizzle(new PGlite(), { schema });
  await migrate(d, { migrationsFolder: "./drizzle" });
  (globalThis as { __scoutTestDb?: unknown }).__scoutTestDb = d;
}, 60_000);

describe("Trends with nothing to show is hidden", () => {
  it("hasTrends answers no with no trend, and yes once one is found", async () => {
    const { hasTrends } = await import("@/lib/queries");
    const { db, schema: S } = await import("@/db");
    expect(await hasTrends()).toBe(false);
    await db().insert(S.trends).values({ slug: "pickleball-and-padel", term: "Pickleball and padel", headline: "Pickleball and padel clubs keep raising" });
    expect(await hasTrends()).toBe(true);
    await db().delete(S.trends);
    expect(await hasTrends()).toBe(false);
  });

  it("the layout passes it to the Shell, the Shell drops Trends from every menu, and the page sends visitors to Today", () => {
    expect(readFileSync("src/app/layout.tsx", "utf8")).toMatch(/const trends = await hasTrends\(\);[\s\S]*<Shell[^\n]*trends=\{trends\}/);
    const shell = readFileSync("src/components/Shell.tsx", "utf8");
    expect(shell).toMatch(/nav: trends \? NAV : NAV_NO_TRENDS, all: trends \? ALL_PAGES : ALL_NO_TRENDS/);
    expect(shell).toMatch(/if \(trends\) router\.push\("\/trends"\)/);
    expect(shell).toMatch(/ACTIONS\.filter\(\(a\) => trends \|\| a\.id !== "goTrends"\)/);
    // every list of pages in the Shell reads the trend-aware lists, never the full ones
    expect(shell.match(/\bNAV\.map\(|\bALL_PAGES\.filter\(\(p\) => !\[/g) || []).toEqual([]);
    expect(readFileSync("src/app/trends/page.tsx", "utf8")).toMatch(/if \(!trends\.length\) redirect\("\/"\)/);
  });
});
