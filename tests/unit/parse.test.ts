import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as P from "@/lib/sources/parse";

const fx = (f: string) => readFileSync(`tests/fixtures/${f}`, "utf8");

describe("parsers read the recorded responses", () => {
  it("SEC daily index", () => {
    const rows = P.parseDailyIndex(fx("sec-daily-index.idx"));
    expect(rows.length).toBeGreaterThan(50);
    expect(rows.every((r) => ["D", "D/A", "C", "C/A"].includes(r.form))).toBe(true);
    expect(rows[0].primaryXml).toMatch(/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/\d+\/\d{18}\/primary_doc\.xml$/);
  });
  it("Form D primary doc", () => {
    const d = P.parseFormD(fx("sec-formd-primary.xml"))!;
    expect(d.issuer.length).toBeGreaterThan(1);
  });
  it("Form C primary doc", () => {
    const c = P.parseFormD(fx("sec-formc-primary.xml"))!;
    expect(c.issuer.length).toBeGreaterThan(1);
  });
  it("SEC atom", () => expect(P.parseSecAtom(fx("sec-formd-atom.xml")).length).toBeGreaterThan(10));
  it("EDGAR full-text search", () => expect(P.parseEfts(JSON.parse(fx("sec-efts.json")))[0].name).toMatch(/Slow Ventures Creator Fund/));
  it("Hacker News", () => expect(P.parseHN(JSON.parse(fx("hn-show.json")))[0].title).toMatch(/Show HN/));
  it("Y Combinator", () => {
    const all = P.parseYC(JSON.parse(fx("yc-all.json")));
    expect(all.length).toBeGreaterThan(100);
    expect(all.filter(P.ycConsumer).length).toBeLessThan(all.length);
  });
  it("Product Hunt", () => expect(P.parseFeed(fx("producthunt.xml")).items.length).toBeGreaterThan(5));
  it("App Store chart", () => {
    const a = P.parseAppChart(JSON.parse(fx("appstore-6004.json")));
    expect(a.length).toBeGreaterThan(20);
    expect(a[0].name).not.toBe("");
  });
  it("Google News strips the outlet", () => {
    const n = P.parseGoogleNews(fx("gnews.xml"));
    expect(n.length).toBeGreaterThan(0);
    for (const x of n) if (x.outlet) expect(x.title.endsWith(" - " + x.outlet)).toBe(false);
  });
  it("Google Trends", () => expect(P.parseGoogleTrends(fx("gtrends.xml")).length).toBeGreaterThan(3));
  it("YouTube", () => {
    const f = P.parseFeed(fx("youtube.xml"));
    expect(f.title).toBe("The Pat McAfee Show");
    expect(f.items[0].description).toMatch(/sponsored by Kalshi/);
  });
  it("Podcast feed", () => {
    const f = P.parseFeed(fx("podcast-megaphone.xml"));
    expect(f.items.length).toBeGreaterThan(5);
    expect(f.items[0].date).not.toBeNull();
  });
  it("Medium", () => expect(P.parseFeed(fx("medium.xml")).items.length).toBeGreaterThan(3));
  it("Courtside portfolio", () => {
    expect(P.parsePortfolioSlugs(fx("courtside-portfolio.html")).length).toBeGreaterThanOrEqual(60);
    const d = P.parsePortfolioDetail(fx("courtside-portfolio-detail.html"))!;
    expect(d.name).toBe("100 Thieves");
    expect(d.sector).toBe("Gaming");
  });
  it("beehiiv archive", () => { const p = P.parseBeehiiv(fx("beehiiv-archive.html"), "https://snailmail.slow.co"); expect(p.length).toBeGreaterThanOrEqual(3); expect(p[0].url).toMatch(/^https:\/\/snailmail.slow.co\/p\//); });
  it("industry RSS", () => expect(P.parseFeed(fx("rss-fos.xml")).items.length).toBeGreaterThan(5));
  it("GitHub, Wayback, RDAP, iTunes", () => {
    expect(P.parseGitHub(JSON.parse(fx("github.json"))).length).toBeGreaterThan(0);
    expect(P.parseWayback(JSON.parse(fx("wayback.json")))?.date).toMatch(/^\d{4}-/);
    expect(P.parseRdap(JSON.parse(fx("rdap.json")))).toMatch(/^\d{4}-/);
    expect(P.parseItunesSearch(JSON.parse(fx("itunes-search.json")))[0].feedUrl).toMatch(/^http/);
  });
  it("junk in, nothing out", () => {
    expect(P.parseFeed("<html>not a feed").items).toEqual([]);
    expect(P.parseFeed("<rss><channel><item><title>x</ti").items.length).toBeLessThanOrEqual(1);
    expect(P.parseDailyIndex("garbage")).toEqual([]);
    expect(P.parseFormD("<oops")).toBeNull();
    expect(P.parseHN(null)).toEqual([]);
    expect(P.parseAppChart({})).toEqual([]);
    expect(P.parseGoogleNews("")).toEqual([]);
  });
});
