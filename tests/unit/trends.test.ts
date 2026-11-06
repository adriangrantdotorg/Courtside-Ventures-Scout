// A trend's Find Startups in This Trend (11-05-26: it searched the first word of the trend's id, so "AI video"
// searched "ai" and "The Athletic" searched "the")
import { describe, it, expect } from "vitest";
import { trendPipelineHref } from "@/lib/format";
import { matches, type Filters } from "@/components/Pipeline";
import type { CompanyCard } from "@/lib/queries";

describe("Find Startups in This Trend", () => {
  it("searches the trend's idea, never the first word of its id", () => {
    expect(trendPipelineHref("AI video")).toBe("/pipeline?q=AI%20video");
    expect(trendPipelineHref("The Athletic")).toBe("/pipeline?q=The%20Athletic");
    expect(trendPipelineHref("Recovery")).toBe("/pipeline?q=Recovery");
  });
  it("a list of ideas searches each one", () => {
    expect(decodeURIComponent(trendPipelineHref("Pickleball and padel").split("q=")[1])).toBe("Pickleball OR padel");
    expect(decodeURIComponent(trendPipelineHref("Kick, Twitch and live streaming").split("q=")[1])).toBe("Kick OR Twitch OR live streaming");
  });
});

describe("the Pipeline search reads A OR B as either", () => {
  const card = (name: string, desc: string) => ({ name, domain: null, descSegs: [desc] }) as unknown as CompanyCard;
  const f = (q: string): Filters => ({ q, area: "", bucket: "", signal: "", score: "", seen: "", rating: "" });
  const pick = card("Dinkly", "A booking app for pickleball courts");
  const pad = card("Courtly", "Padel clubs, one app");
  const golf = card("Teeup", "Short-course golf nights");
  it("matches either word, and a plain search stays one search", () => {
    const q = decodeURIComponent(trendPipelineHref("Pickleball and padel").split("q=")[1]);
    expect([pick, pad, golf].filter((c) => matches(c, f(q), 0)).map((c) => c.name)).toEqual(["Dinkly", "Courtly"]);
    expect(matches(pick, f("pickleball courts"), 0)).toBe(true);
    expect(matches(pad, f("pickleball courts"), 0)).toBe(false);
    expect(matches(golf, f("golf or padel"), 0)).toBe(false); // only a capital OR splits the search
  });
});
