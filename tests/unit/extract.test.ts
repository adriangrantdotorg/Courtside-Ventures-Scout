import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { extractSponsors, extractMentions } from "@/lib/extract";
import { parseFeed } from "@/lib/sources/parse";

describe("sponsor extraction", () => {
  it("finds brands in a video description, one row per brand", () => {
    const f = parseFeed(readFileSync("tests/fixtures/youtube.xml", "utf8"));
    const b = extractSponsors(f.items[0].description, "The Pat McAfee Show").map((x) => x.brand);
    expect(b).toEqual(expect.arrayContaining(["Kalshi", "Rhoback", "PrizePicks"]));
    expect(new Set(b).size).toBe(b.length);
  });
  it("finds brands in podcast show notes", () => {
    const f = parseFeed(readFileSync("tests/fixtures/podcast-megaphone.xml", "utf8"));
    const all = f.items.flatMap((i) => extractSponsors(i.description + "\n" + i.content, f.title));
    for (const s of all) {
      expect(s.brand).not.toMatch(/learn more|subscribe|\d:\d\d|@|#|http/i);
    }
  });
  it("never takes a CTA, a timestamp, legal words, a title or a guest", () => {
    const t = [
      "This episode is brought to you by Learn more at the link.",
      "Brought to you by 12:30 the second half",
      "Sponsored by Legal Disclaimer",
      "Brought to you by Hollywood legend Tom Cruise",
      "We talked about it, presented by nobody in particular",
      "Support for the show comes from cash.app/pod",
    ].join("\n");
    const b = extractSponsors(t, "Some Show").map((x) => x.brand);
    expect(b).not.toContain("Learn");
    expect(b.join(" ")).not.toMatch(/Hollywood|Legal|12:30/);
    expect(b).toContain("Cash App");
  });
  it("skips the show's own name", () => {
    expect(extractSponsors("Brought to you by New Heights merch", "New Heights").map((x) => x.brand)).toEqual([]);
  });
});

describe("mentions", () => {
  it("resolves known names with a stance and skips the show's own name", () => {
    const m = extractMentions("I'm obsessed with the WHOOP app. The Athletic wrote about it.", "The Athletic Football Show", ["WHOOP", "The Athletic"]);
    expect(m.find((x) => x.entity === "WHOOP")?.stance).toBe("recommends");
    expect(m.find((x) => x.entity === "The Athletic")).toBeUndefined();
  });
});
