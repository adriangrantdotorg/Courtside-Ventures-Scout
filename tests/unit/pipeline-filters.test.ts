// The Pipeline's address holds its filters, page and view (Adrian, 11-10-26: Back from a startup on page 3 opened
// page 1), the Details menu hides startups Scout knows nothing about, and Funds Raised offers Under $5M.
import { describe, expect, it } from "vitest";
import { filtersFrom, pageFrom, pipelineQuery, matches } from "@/components/Pipeline";
import { FUNDS_OPTS, UNDER_5M, bucketOf, fundsLabel, hasDetails, inFunds, standInWhat } from "@/lib/v2";
import { whyFitsLine, weakDescription } from "@/lib/score";
import { siteDescription } from "@/lib/enrich";
import { radarFrom, radarKeys } from "@/components/V2";
import type { CompanyCard } from "@/lib/queries";

const card = (x: Partial<CompanyCard>) => ({ name: "Nocionix", domain: null, descSegs: [], signals: [], score: 60, votes: 0, bucket: 2, known: false, thesisArea: "health", firstSeen: new Date().toISOString(), ...x }) as CompanyCard;

describe("the Pipeline's address", () => {
  it("round-trips every filter, the page and the view", () => {
    const f = { ...filtersFrom(new URLSearchParams()), q: "AI upsells", bucket: UNDER_5M, details: "known", score: "50", area: "health" };
    const qs = pipelineQuery(f, 2, "list");
    expect(qs).toBe("q=AI+upsells&funds=lt5&area=health&min=50&details=known&page=3");
    const back = new URLSearchParams(qs);
    expect(filtersFrom(back)).toEqual(f);
    expect(pageFrom(back)).toBe(2);
  });
  it("leaves page 1 and an empty list out, and a bad page reads as page 1", () => {
    expect(pipelineQuery(filtersFrom(new URLSearchParams()), 0, "list")).toBe("");
    expect(pipelineQuery(filtersFrom(new URLSearchParams()), 4, "board")).toBe("view=board");
    for (const p of ["", "0", "1", "-3", "abc"]) expect(pageFrom(new URLSearchParams({ page: p }))).toBe(0);
  });
  it("still reads the links other pages open: the masthead's ?seen=today and ?min=, a trend's ?q=A OR B", () => {
    const f = filtersFrom(new URLSearchParams("seen=today&min=55&q=sleep%20OR%20recovery"));
    expect([f.seen, f.score, f.q]).toEqual(["today", "55", "sleep OR recovery"]);
  });
});

describe("Details: the row's line says something real, not the stand-in", () => {
  it("the stand-in has no details, whatever else the startup has (a website, a raise)", () => {
    for (const area of ["Gaming", "Consumer-health", "Vertical-saas", ""]) {
      const line = `${standInWhat(area)}, inside the thesis; raised $500K pre-seed.`;
      expect(hasDetails(line), line).toBe(false);
    }
    expect(hasDetails("")).toBe(false);
  });
  it("a page title or the name again is no details: fewer than three words of its own", () => {
    expect(hasDetails("Homepage, inside Courtside's thesis; raised $220K.")).toBe(false);
    expect(hasDetails("Nineteen Films, inside Courtside's thesis; raised $475K.")).toBe(false);
    expect(hasDetails("GoalPulse: Live Football (by Vu Thi Hanh): GoalPulse helps football fans follow, inside the thesis.")).toBe(true);
  });
  it("a description of its own, or a why line built from one, has details", () => {
    expect(hasDetails("Single-estate olive oil in a refill tin.")).toBe(true);
    expect(hasDetails("Peanut protein powder brand Scoops has secured $2 million in seed investment.")).toBe(true);
    expect(hasDetails("AI upsell offers for Shopify brands: a Shopify tool, like Rebuy; raised $2.4M seed.")).toBe(true);
  });
  it("whyFitsLine writes the stand-in that Details reads, for a startup with no words of its own", () => {
    const line = whyFitsLine({ name: "Arcustin Games", description: "", thesisArea: null, stage: "pre-seed", amount: 5e5, currency: "$", lastSignal: null });
    expect(line.startsWith(standInWhat(""))).toBe(true);
    expect(hasDetails(line)).toBe(false);
  });
  it("Has Details hides it, No Details shows only it", () => {
    const f = filtersFrom(new URLSearchParams());
    expect(matches(card({ known: false }), { ...f, details: "known" }, Date.now())).toBe(false);
    expect(matches(card({ known: true }), { ...f, details: "known" }, Date.now())).toBe(true);
    expect(matches(card({ known: true }), { ...f, details: "unknown" }, Date.now())).toBe(false);
  });
});

describe("Funds Raised: Under $5M", () => {
  it("takes every startup with a known amount under $5M, and never an unknown one", () => {
    expect([0, 999_999, 1_000_000, 4_999_999, 5_000_000].map((n) => inFunds(bucketOf(n), UNDER_5M))).toEqual([false, true, true, true, false]);
    expect(inFunds(bucketOf(null), UNDER_5M)).toBe(false);
    expect(inFunds(2, "2")).toBe(true);
    expect(inFunds(3, "")).toBe(true);
  });
  it("sits in the menu after Under $1M, with its label", () => {
    expect(FUNDS_OPTS.map(([, l]) => l).slice(0, 3)).toEqual(["Unknown", "Under $1M", "Under $5M"]);
    expect(fundsLabel(UNDER_5M)).toBe("Under $5M");
    expect(fundsLabel("")).toBe("All");
  });
});

describe("Today's On the Radar keeps its place the same way", () => {
  it("round-trips its filters and Show More", () => {
    const f = { bucket: UNDER_5M, area: "health", fit50: true, newonly: true };
    const k = radarKeys(f, 36);
    expect(k).toEqual({ funds: "lt5", area: "health", fit: "50", new: "1", shown: "36" });
    expect(radarFrom(new URLSearchParams(Object.entries(k)))).toEqual({ f, limit: 36 });
  });
  it("an empty or odd address is the first 18 tiles, unfiltered", () => {
    expect(radarFrom(new URLSearchParams("shown=abc"))).toEqual({ f: { bucket: "", area: "", fit50: false, newonly: false }, limit: 18 });
    expect(Object.values(radarKeys({ bucket: "", area: "", fit50: false, newonly: false }, 18)).every((v) => v === "")).toBe(true);
  });
});

describe("a website known means a description: the homepage's own line fills a missing or empty one (11-10-26)", () => {
  const page = (meta: string) => `<html><head><title>Homepage</title>${meta}</head><body></body></html>`;
  it("reads og:description, then description, either attribute order, and keeps an apostrophe", () => {
    expect(siteDescription(page(`<meta property="og:description" content="Monk is the AI-native AR automation platform for finance teams.">`), "Monk")).toBe("Monk is the AI-native AR automation platform for finance teams.");
    expect(siteDescription(page(`<meta content="The team's booking app for padel clubs &amp; courts." name="description">`), "Courtly")).toBe("The team's booking app for padel clubs & courts.");
  });
  it("never runs on into the next tag (ssbdfest.com's real tags: content first, three in a row)", () => {
    const html = `<meta content="Same Same But Different Music Festival at Lake Perris State Park, California." name="description"/> <meta content="Same Same But Different Music Festival at Lake Perris State Park, California." property="og:description"/>`;
    expect(siteDescription(html, "Same Same But Different")).toBe("Same Same But Different Music Festival at Lake Perris State Park, California.");
    expect(siteDescription(`<meta name='description' content='A booking app for padel clubs and courts.'>`, "Courtly")).toBe("A booking app for padel clubs and courts.");
  });
  it("skips a placeholder, a bare name or a line under four words, and cuts a long one at a sentence end", () => {
    expect(siteDescription(page(`<meta name="description" content="Just another WordPress site">`), "X")).toBeNull();
    expect(siteDescription(page(`<meta name="description" content="Homepage">`), "X")).toBeNull();
    expect(siteDescription(page(`<meta name="description" content="Nineteen Films">`), "Nineteen Films")).toBeNull();
    const long = siteDescription(page(`<meta name="description" content="${"Scouts build lineups. ".repeat(20)}">`), "X")!;
    expect(long.length).toBeLessThanOrEqual(300);
    expect(long.endsWith(".")).toBe(true);
  });
  it("only a description that says nothing is replaced", () => {
    expect(weakDescription(null)).toBe(true);
    expect(weakDescription("Homepage. Same Same But Different Music Festival at Lake Perris State Park, California.")).toBe(true); // its real scraped text
    expect(weakDescription("Scoops raises $2M in seed funding for peanut protein")).toBe(true);
    expect(weakDescription("Single-estate olive oil sold in a refill tin.")).toBe(false);
  });
});
