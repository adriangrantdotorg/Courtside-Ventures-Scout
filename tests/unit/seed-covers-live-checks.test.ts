// The launch seed is what a FRESH site shows at step 5, before the first pull runs, so it has to clear every
// threshold the live checks ask for. On 10-14-26 (third dry run) the seed carried no filings and "Form D rows"
// failed on a brand-new account while the reference site, filled by its daily jobs, passed.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const seed = JSON.parse(readFileSync(join(ROOT, "seed", "scout-launch-seed.json"), "utf8"));

describe("the launch seed clears the live-check thresholds on its own", () => {
  it("carries Form D and Form C filings inside the thesis, with their source links", () => {
    const rows = (seed.filings || []) as { thesisArea?: string; url: string; accession: string; form: string }[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const f of rows) {
      expect(f.thesisArea).toBeTruthy();
      expect(f.url).toMatch(/^https:\/\/www\.sec\.gov\//);
      expect(f.accession).toBeTruthy();
      expect(f.form).not.toBe("fund");
    }
    expect(seed.counts.filings).toBe(rows.length);
  });

  it("has enough rows for the other content checks (top picks, trends, sponsors, culture, backtest, Courtside post)", () => {
    expect(seed.companies.length).toBeGreaterThanOrEqual(5);
    expect(seed.trends.length).toBeGreaterThanOrEqual(5);
    expect(seed.sponsors.length).toBeGreaterThanOrEqual(30);
    expect(seed.mentions.length).toBeGreaterThanOrEqual(10);
    expect(seed.backtests.length).toBeGreaterThanOrEqual(2);
    expect(seed.courtsidePosts.length).toBeGreaterThanOrEqual(1);
  });

  it("the exporter and the loader both know the filings table", () => {
    expect(readFileSync(join(ROOT, "scripts", "export-seed.ts"), "utf8")).toContain("from(S.filings)");
    expect(readFileSync(join(ROOT, "src", "lib", "seed.ts"), "utf8")).toContain("insert(S.filings)");
  });
});
