import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { transport, resetBackoff } from "@/lib/sources/http";
import * as F from "@/lib/sources/fetchers";

const real = transport.fetch;
const fx = (f: string) => readFileSync(`tests/fixtures/${f}`, "utf8");
type Mode = "ok" | 404 | 429 | 500 | "timeout" | "junk";
let mode: Mode = "ok";
let body = "";
let calls: string[] = [];

beforeEach(() => {
  resetBackoff();
  calls = [];
  transport.fetch = (async (url: string, init?: RequestInit) => {
    calls.push(String(url));
    if (mode === "timeout")
      return new Promise((_r, rej) => init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    if (typeof mode === "number") return new Response("nope", { status: mode });
    if (mode === "junk") return new Response("<<<not xml or json", { status: 200 });
    return new Response(body, { status: 200 });
  }) as typeof fetch;
});
afterEach(() => {
  transport.fetch = real;
});

// each fetcher with its fixture, then every failure mode: nothing comes back, nothing throws
const CASES: [string, () => Promise<unknown>, string][] = [
  ["SEC daily index", () => F.secDailyIndex(new Date("2026-10-09T12:00:00Z")), "sec-daily-index.idx"],
  ["SEC latest Form D", () => F.secLatest("D"), "sec-formd-atom.xml"],
  ["SEC latest Form C", () => F.secLatest("C"), "sec-formc-atom.xml"],
  ["SEC primary doc", () => F.secPrimary("https://www.sec.gov/Archives/edgar/data/1/2/primary_doc.xml"), "sec-formd-primary.xml"],
  ["EDGAR search", () => F.edgarSearch("Slow Ventures"), "sec-efts.json"],
  ["Hacker News", () => F.hnShow(), "hn-show.json"],
  ["Y Combinator", () => F.ycAll(), "yc-all.json"],
  ["Product Hunt", () => F.productHunt(), "producthunt.xml"],
  ["App Store", () => F.appChart("6004"), "appstore-6004.json"],
  ["Google News", () => F.googleNews("x"), "gnews.xml"],
  ["Google Trends", () => F.googleTrends(), "gtrends.xml"],
  ["YouTube", () => F.youtube("UCxcTeAKWJca6XyJ37_ZoKIQ"), "youtube.xml"],
  ["Podcast", () => F.feed("https://feeds.megaphone.fm/x"), "podcast-megaphone.xml"],
  ["Industry RSS", () => F.feed("https://frontofficesports.com/feed/"), "rss-fos.xml"],
  ["Medium", () => F.feed("https://medium.com/feed/@courtsidevc"), "medium.xml"],
  ["Courtside portfolio", () => F.courtsidePortfolio(), "courtside-portfolio.html"],
  ["beehiiv", () => F.beehiiv("https://snailmail.slow.co/"), "beehiiv-archive.html"],
  ["GitHub", () => F.github("sports", "2026-10-01"), "github.json"],
  ["Wayback", () => F.wayback("eloelo.in"), "wayback.json"],
  ["RDAP", () => F.rdap("eloelo.in"), "rdap.json"],
  ["iTunes search", () => F.itunesPodcast("acquired"), "itunes-search.json"],
];

const empty = (v: unknown) => v === null || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && v !== null && "items" in v && (v as { items: unknown[] }).items.length === 0);
let host = 0;

describe.each(CASES)("%s", (_name, run, fixture) => {
  it("reads its recorded response", async () => {
    mode = "ok";
    body = fx(fixture);
    const v = await run();
    expect(empty(v)).toBe(false);
  });
  for (const m of [404, 429, 500, "junk"] as Mode[])
    it(`returns nothing on ${m}`, async () => {
      mode = m;
      host++;
      const v = await run();
      expect(empty(v)).toBe(true);
    });
});

describe("timeouts", () => {
  it("a hung source returns nothing after its timeout", async () => {
    mode = "timeout";
    const { fetchText } = await import("@/lib/sources/http");
    const v = await fetchText("https://slow.example.com/feed", { timeoutMs: 200 });
    expect(v).toBeNull();
  });
});

describe("manners", () => {
  it("sends the Scout User-Agent", async () => {
    let ua = "";
    transport.fetch = (async (_u: string, init?: RequestInit) => {
      ua = String((init?.headers as Record<string, string>)["user-agent"]);
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    const { fetchText } = await import("@/lib/sources/http");
    await fetchText("https://hn.algolia.com/api/v1/x");
    expect(ua).toMatch(/^CourtsideVenturesScout\/1\.0 \(\+https?:\/\//);
  });
});
