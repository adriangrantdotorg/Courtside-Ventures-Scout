// Scout V2 (10-26-26): the rules behind the cards.
import { describe, it, expect } from "vitest";
import { buildRounds, totalOf, notStartupReason, duplicateOf, guessDomains, factsOf, isOfficialSite, searchReportOk, siteBits, pickMedia, investorsOf, appIdOf } from "@/lib/enrich";
import { fundsOf, bucketOf, isNew, overCap, moneyRange, searchUrl, fitHue, CAP } from "@/lib/v2";
import { subjectOf } from "@/lib/companies";
import { classify } from "@/lib/thesis";
import { FUNDING } from "@/lib/jobs/collect-signals";

const r = (title: string, date: string, name = "News", url = title) => ({ title, url, name, date });

describe("Funds Raised adds up the rounds Scout knows about", () => {
  it("one raise reported twice is one round; two raises add up (Topdog: $2.5M seed + $1.6M pre-seed)", () => {
    const rounds = buildRounds([
      r("Topdog raises $2.5M seed round led by Boston Seed Capital", "2026-10-02", "Pulse 2.0"),
      r("Topdog lands $2.5 million seed to scale real-time multiplayer gaming", "2026-10-03", "Bonus.com"),
      r("Topdog raises $1.6M pre-seed", "2025-11-20", "TechCrunch"),
    ]);
    expect(rounds).toHaveLength(2);
    expect(rounds[0].stage).toBe("seed");
    expect(rounds[0].sources).toHaveLength(2);
    expect(rounds[0].investors).toBe("Boston Seed Capital");
    expect(totalOf(rounds)).toBeCloseTo(4.1e6);
    const f = fundsOf(rounds, { amount: null, currency: "$", stage: "unknown" });
    expect(f.text).toBe("$4.1M");
    expect(f.stage).toBe("Seed");
  });
  it("sources that disagree show a range, and the cap reads the high end", () => {
    const rounds = buildRounds([r("EVEN raises $2.0M seed", "2023-04-10", "A"), r("EVEN raises $2.2M seed round", "2023-04-14", "B")]);
    expect(rounds).toHaveLength(1);
    const f = fundsOf(rounds, { amount: null, currency: "$", stage: "unknown" });
    expect(f.text).toBe("$2.0–2.2M");
    expect(f.total).toBeCloseTo(2.2e6);
    expect(f.agree).toBe(false);
  });
  it("IDL's $7M seed and $15M Series A pass the $15M cap", () => {
    const rounds = buildRounds([r("International Dance League raises $15M Series A", "2026-10-21"), r("International Dance League raises $7M seed", "2025-11-03")]);
    expect(totalOf(rounds)).toBe(22e6);
    expect(overCap(totalOf(rounds))).toBe(true);
    expect(overCap(CAP - 1)).toBe(false);
  });
  it("no amount anywhere reads Unknown", () => {
    expect(fundsOf([], { amount: null, currency: "$", stage: "unknown" }).text).toBe("Unknown");
    expect(fundsOf([], { amount: 5e6, currency: "$", stage: "seed" }).text).toBe("$5.0M");
  });
  it("buckets and ranges", () => {
    expect([null, 5e5, 2e6, 9e6].map(bucketOf)).toEqual([0, 1, 2, 3]);
    expect(moneyRange(5e5, 1.2e6)).toBe("$500K–$1.2M");
    expect(investorsOf("Acme raises $3M led by Seven Seven Six")).toBe("Seven Seven Six");
  });
});

describe("the startup filter", () => {
  const c = (name: string, domain: string | null = null, description: string | null = null, keep = false) => ({ name, domain, description, keep });
  it("drops blogs, big companies' products, descriptions and generic app names", () => {
    expect(notStartupReason(c("Nova Soccer Live Hub", "novasccore.blogspot.com"))).toMatch(/blog/i);
    expect(notStartupReason(c("Kling 4.0", null, "Kling is Kuaishou's AI video model"))).toMatch(/big company/i);
    expect(notStartupReason(c("Music Creator"))).toMatch(/generic/i);
    expect(notStartupReason(c("Live Score: Football Result"))).toMatch(/generic/i);
    expect(notStartupReason(c("Creator Mikayla Nogueira’s Beauty Brand"))).toMatch(/description/i);
  });
  it("keeps real startups, and anything the team restored", () => {
    for (const n of ["SleepSense", "Axo Longevity", "Grocalo", "Topdog", "Snag", "Quippy", "International Dance League"]) expect(notStartupReason(c(n))).toBeNull();
    expect(notStartupReason(c("Music Creator", null, null, true))).toBeNull();
  });
});

describe("duplicate cards: the same raise under two names", () => {
  it("'dance league' merges into International Dance League", () => {
    const a = { id: 292, name: "International Dance League", area: "sports", signals: [{ title: "International Dance League raises $15M Series A", url: "u1", date: "2026-10-21" }] };
    const b = { id: 293, name: "dance league", area: "sports", signals: [{ title: "Dodgers-backed dance league scores $15M Series A", url: "u2", date: "2026-10-21" }] };
    const d = duplicateOf(a, b)!;
    expect(d.keep.id).toBe(292);
    expect(d.drop.id).toBe(293);
  });
  it("different companies with a shared word stay apart", () => {
    const a = { id: 1, name: "Baller League", area: "sports", signals: [{ title: "Baller League raises $10M", url: "a", date: "2026-01-01" }] };
    const b = { id: 2, name: "League", area: "sports", signals: [{ title: "League raises $10M", url: "b", date: "2026-01-01" }] };
    expect(duplicateOf(a, b)).toBeNull();
  });
});

describe("the website finder only accepts the company's own site", () => {
  const facts = factsOf("International Dance League", ["International Dance League raises $15M Series A led by Elysian Park Ventures", "IDL lands ESPN deal"]);
  it("facts are names and acronyms from the news, never single common words", () => {
    expect(facts).toEqual(expect.arrayContaining(["Elysian Park", "Elysian", "ESPN"]));
    expect(facts).not.toContain("Park");
    expect(factsOf("Topdog", ["Topdog Raises $2.5 Million Seed To Scale Real-Time Multiplayer Gaming"])).toEqual([]);
  });
  it("a same-name festival is rejected, even when it mentions a park; the official site names a fact from the news", () => {
    expect(isOfficialSite("<title>International Dance League Rotterdam</title><p>The festival returns to the park in Rotterdam.</p>", { name: "International Dance League", facts })).toBe(false);
    expect(isOfficialSite("<title>IDL</title><p>The International Dance League, live on ESPN from Los Angeles.</p>", { name: "International Dance League", facts })).toBe(true);
    expect(isOfficialSite("<p>Topdog.com is for sale. Buy this domain.</p>", { name: "Topdog", facts: ["Boston"] })).toBe(false);
    expect(isOfficialSite("<p>Topdog: real-time multiplayer games.</p>", { name: "Topdog", facts: [] })).toBe(false);
  });
  it("tries the usual domains", () => {
    expect(guessDomains("Axo Longevity").slice(0, 3)).toEqual(["axolongevity.com", "axolongevity.co", "axolongevity.io"]);
    expect(guessDomains("Axo Longevity")).toContain("axo-longevity.com");
  });
  it("a same-name company's raise never becomes a round", () => {
    expect(searchReportOk("media", "Mochi Health raises $60M Series B for GLP-1 care", "")).toBe(false);
    expect(searchReportOk("health", "Imperfect raises $781M", "")).toBe(false);
    expect(searchReportOk("gaming", "Topdog raises $2.5M seed to scale real-time multiplayer gaming", "")).toBe(true);
    expect(searchReportOk("sports", "Astraea valued at $19B after new funding", "")).toBe(false);
  });
});

describe("the card's picture, in the picked order", () => {
  const html = `<meta property="og:image" content="/og.png"><link rel="apple-touch-icon" href="/icon.png"><iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe><video src="/demo.mp4"></video>`;
  it("reads a homepage", () => {
    const b = siteBits(html, "https://acme.com/");
    expect(b).toMatchObject({ ogImage: "https://acme.com/og.png", yt: "abcdefghijk", mp4: "https://acme.com/demo.mp4", logo: "https://acme.com/icon.png" });
  });
  it("video, then App Store screenshots, then the preview image, then the logo", () => {
    expect(pickMedia({ site: siteBits(html, "https://acme.com/") }).kind).toBe("yt");
    expect(pickMedia({ site: { title: null, ogImage: "x", mp4: null, yt: null, logo: null }, shots: ["s1"] }).kind).toBe("shots");
    expect(pickMedia({ site: { title: null, ogImage: "x", mp4: null, yt: null, logo: null } }).kind).toBe("site");
    expect(pickMedia({ domain: "acme.com" })).toMatchObject({ kind: "logo" });
    expect(appIdOf("https://apps.apple.com/us/app/sleepsense/id6745555555?uo=2")).toBe("6745555555");
  });
});

describe("the coverage check's fixes (10-26-26)", () => {
  it("reads the company from more funding headlines", () => {
    expect(subjectOf("Stationhead Clinches $12 Million In Funding Round Led By Diplo")).toBe("Stationhead");
    expect(subjectOf("NAVER D2SF Makes Follow-On Investment in Soundable Health, an AI-Driven Health Tech Startup")).toBe("Soundable Health");
    expect(subjectOf("Kobalt founder Willard Ahdritz to lead funding round in India's Madverse Music Group")).toBe("Madverse Music Group");
    expect(FUNDING.test("NAVER D2SF Makes Follow-On Investment in Soundable Health")).toBe(true);
  });
  it("music and audio wellness are inside the thesis", () => {
    expect(classify("British startup Mozart AI raises €616k for its AI-powered Digital Audio Workstation").area).toBe("media");
    expect(classify("Finnish neurowellness startup Audicin raises $1.9M").area).toBe("health");
  });
});

describe("small rules", () => {
  it("New means a signal in the last 7 days", () => {
    const now = Date.parse("2026-10-26T12:00:00Z");
    expect(isNew("2026-10-21T00:00:00Z", now)).toBe(true);
    expect(isNew("2026-10-10T00:00:00Z", now)).toBe(false);
    expect(isNew(null, now)).toBe(false);
  });
  it("Find Website searches; fit colors run amber to green", () => {
    expect(searchUrl("SleepSense", "Health")).toContain("google.com/search");
    expect(fitHue(40)).toBe(40);
    expect(fitHue(60)).toBe(140);
  });
});

describe("one entry per news story (IC Meeting)", async () => {
  const { groupStories } = await import("@/lib/stories");
  it("the same funder and amount reported twice is one deal with two sources", () => {
    const rows = [
      { title: "International Dance League raises $15M Series A", url: "a", fund: "Elysian Park" },
      { title: "Dodgers-backed dance league scores $15M Series A", url: "b", fund: "Elysian Park" },
      { title: "Acme raises $3M seed", url: "c", fund: "Elysian Park" },
    ];
    const g = groupStories(rows);
    expect(g).toHaveLength(2);
    expect(g[0].sources.map((s) => s.url)).toEqual(["a", "b"]);
    expect(g[1].sources).toHaveLength(1);
  });
});

describe("V2 guards on the source (10-26-26)", async () => {
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  const UI = walk("src/components").concat(walk("src/app")).filter((f) => /\.(tsx|ts)$/.test(f)).map((f) => ({ f, s: readFileSync(f, "utf8") }));
  it("the screen never says Not Yet Public, Near, or Adjacent: Unknown and Overlaps with only", () => {
    for (const { f, s } of UI) expect(s, f).not.toMatch(/Not Yet Public|>Near |`Near |Adjacent to|Adjacent, possible intro/);
  });
  it("Today, the Pipeline and the IC Meeting read only recommendable startups (the $15M cap and the startup filter)", () => {
    expect(readFileSync("src/app/today.tsx", "utf8")).toMatch(/companyCards\("recommend"\)/);
    expect(readFileSync("src/app/pipeline/page.tsx", "utf8")).toMatch(/companyCards\("recommend"\)/);
    expect(readFileSync("src/lib/jobs/other.ts", "utf8").match(/recommendable\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it("a local run never writes to the shared database: the progress note is skipped, PGlite never loads on Vercel", () => {
    expect(readFileSync("scripts/pipeline-all.ts", "utf8")).toMatch(/if \(process\.env\.SCOUT_PGLITE\) return;/);
    expect(readFileSync("src/db/index.ts", "utf8")).toMatch(/process\.env\.SCOUT_PGLITE && !process\.env\.VERCEL/);
  });
  it("only real competitors get an overlap on a card", () => {
    expect(readFileSync("src/lib/queries.ts", "utf8")).toMatch(/pc && pc\.kind === "competes"/);
  });
});

describe("a valuation is never the round (Rebel Audio, 10-26-26)", async () => {
  const { moneyOf } = await import("@/lib/companies");
  it("reads the raise, not the valuation", () => {
    expect(moneyOf("Rebel Audio Raises Series A At Approximately $50 Million Valuation")).toBeNull();
    expect(moneyOf("Rebel Audio raises $10M Series A at $50M valuation")?.amount).toBe(10e6);
    expect(moneyOf("Acme, valued at $80 million, raises $6M seed")?.amount).toBe(6e6);
  });
});

describe("names from older headlines (the backfill, 10-26-26)", async () => {
  const { cleanName } = await import("@/lib/companies");
  it("drops the describing words before the name", () => {
    expect(cleanName("AI debt recovery fintech OpenDebt")).toBe("OpenDebt");
    expect(cleanName("Longevity play TMRW")).toBe("TMRW");
    expect(cleanName("Factory outlet marketplace For Real")).toBe("For Real");
    expect(cleanName("Irish gaming start-up Entity")).toBe("Entity");
    expect(cleanName("Türkiye studio Rotatelab")).toBe("Rotatelab");
    expect(cleanName("Cydelphi: $3 Million Seed Funding")).toBe("Cydelphi");
    expect(cleanName("Pet food startup TailBlaze")).toBe("TailBlaze");
    expect(cleanName("Mission Control Games")).toBe("Mission Control Games");
    expect(cleanName("Snag")).toBe("Snag");
  });
});

describe("off-thesis finds the backfill exposed (10-26-26)", async () => {
  const { subjectOf } = await import("@/lib/companies");
  const { classify, NOT_CONSUMER } = await import("@/lib/thesis");
  it("recovery is health only for bodies", () => {
    expect(classify("Phoenix Metals raises €4 million seed round to scale recovery of critical raw materials from industrial waste").area).toBeNull();
    expect(classify("Transition Metal Solutions raises $6M to reinvent bio-based copper recovery").area).toBeNull();
    expect(classify("AI debt recovery fintech OpenDebt bags $2 million in pre-Seed").area).toBeNull();
    expect(classify("Recovery and sleep tracking app raises $3M").area).toBe("health");
  });
  it("astrology, lending and industrial waste are not consumer startups for Courtside", () => {
    expect(NOT_CONSUMER.test("Online astrology and spiritual wellness platform InstaAstro raises $12 million")).toBe(true);
    expect(NOT_CONSUMER.test("Phoenix Metals raises €4M to scale recovery of critical raw materials from industrial waste")).toBe(true);
  });
  it("the company after 'raises $X for' is the subject, not the person raising", () => {
    expect(subjectOf("DJ Reinier Zonneveld Raises $1M for GasLab, a GenAI Music App")).toBe("GasLab");
    expect(subjectOf("Topdog Raises $2.5 Million for Real-Money Skill Gaming Platform")).toBe("Topdog");
  });
});

describe("a phrase is not a company name (the backfill, 10-26-26)", async () => {
  const { isGenericName, subjectOf } = await import("@/lib/companies");
  it("drops phrases, keeps real names", () => {
    for (const n of ["This week", "Liverpool graduate"]) expect(isGenericName(n), n).toBe(true);
    // "A Vinyl Bar in Shibuya" raised $5.5M for music creation tools: a real company (Adrian, 10-26-26)
    for (const n of ["A Vinyl Bar in Shibuya", "Mission Control Games", "The Footnote", "Science&Humans", "Rebel Tickets", "Snag", "augustlab", "Sticks and Glass"]) expect(isGenericName(n), n).toBe(false);
    expect(subjectOf("A Vinyl Bar in Shibuya Announces $5.5M in Funding to Build Interactive Music Creation Tools")).toBe("A Vinyl Bar in Shibuya");
  });
});

describe("people are not companies (the backfill, 10-26-26)", async () => {
  const { subjectOf } = await import("@/lib/companies");
  it("reads the company a person launched, and skips an unnamed one", () => {
    expect(subjectOf("DJ Reinier Zonneveld launches AI music startup GasLab with $1M pre-seed funding")).toBe("GasLab");
    expect(subjectOf("Parade’s Cami Tellez announces new creator economy marketing platform, $4M in funding")).toBeNull();
    expect(subjectOf("Acme announces $5M seed round")).toBe("Acme");
  });
});

describe("Scout's AI (10-26-26)", async () => {
  const { readFileSync } = await import("node:fs");
  const { MODELS } = await import("@/lib/ai");
  const src = readFileSync("src/lib/ai.ts", "utf8");
  it("uses models on AI Gateway's free tier: no Claude model is on it", () => {
    expect(MODELS.writer).toBe("openai/gpt-5");
    expect(MODELS.worker).toBe("google/gemini-2.5-flash-lite");
    expect(MODELS.checker).toBe("openai/gpt-5-mini"); // 24/24 on the known cases; Flash-Lite missed 4 or 5
    expect(Object.values(MODELS).some((m) => m.startsWith("anthropic/"))).toBe(false);
  });
  it("gives GPT-5 room to think and write, and never returns an empty draft", () => {
    // at Claude's 1,600-token limit GPT-5's thinking used it all and the draft came back empty
    expect(src).toMatch(/reasoning: "low"/);
    expect(Number(src.match(/maxOutputTokens: (\d+),\n\s+\}\);\n\s+if \(r\.text/)?.[1])).toBeGreaterThanOrEqual(4000);
    expect(src).toMatch(/if \(r\.text\.trim\(\)\.length < 200\) return null/);
  });
});

describe("the AI Thesis Check and the daily caps (10-26-26)", async () => {
  const { parseThesisAnswer, thesisPrompt, CAPS, MEMO_CAP_MESSAGE } = await import("@/lib/ai");
  const { startupVerdict, TEAM_HIDDEN } = await import("@/lib/enrich");
  it("reads the model's one-line answer", () => {
    expect(parseThesisAnswer("NO | none | a person, not a company")).toEqual({ ok: false, area: null, why: "a person, not a company" });
    expect(parseThesisAnswer("YES | media | music creation tools startup")).toEqual({ ok: true, area: "media", why: "music creation tools startup" });
    expect(parseThesisAnswer("Yes, gaming, gaming cafe chain")?.ok).toBe(true);
    expect(parseThesisAnswer("I cannot tell")).toBeNull();
  });
  it("judges the name Scout found, and leans to YES on fit when unsure", () => {
    const p = thesisPrompt({ name: "GasLab", area: "media", description: null, headlines: ["DJ Reinier Zonneveld launches AI music startup GasLab"] });
    expect(p).toContain("Name Scout found: GasLab");
    expect(p).toContain("If unsure, answer YES");
    expect(p).toMatch(/refers to a person/); // the live misses of 10-26-26: a DJ, a founder, a product version
    expect(p).toMatch(/version number/);
    expect(p).toMatch(/a big company's product/); // SleepSense, a small maker's app, was hidden as "a product" (10-26-26)
    expect(p).toMatch(/an app from a small maker is that maker's startup/);
    expect(p).toMatch(/long-established company \(a chain of gyms or stores/); // TOKYOPOP, New EōS Fitness (10-26-26)
    expect(p).toMatch(/sells to businesses, including clubs, teams and gyms/); // Spash
    expect(p).not.toMatch(/venues/); // "venues" hid A Vinyl Bar in Shibuya, a startup the team wants in
  });
  it("a NO keeps a card off the recommendations with its reason; Restore and the team's own hide win", () => {
    const c = { name: "InstaAstro", domain: null, description: null };
    expect(startupVerdict({ ...c, thesisCheck: { ok: false, area: null, why: "astrology service", model: "m", at: "" } })).toBe("Outside the thesis (AI check: astrology service)");
    expect(startupVerdict({ ...c, keep: true, thesisCheck: { ok: false, area: null, why: "x", model: "m", at: "" } })).toBeNull();
    expect(startupVerdict({ ...c, thesisCheck: { ok: true, area: "health", why: "", model: "m", at: "" } })).toBeNull();
    expect(TEAM_HIDDEN).toBe("Hidden by the team");
  });
  it("caps memo drafts at 4 a day so the free $5 lasts the month, with checks counted apart", () => {
    expect(CAPS.memoDailyCap).toBe(4);
    expect(4 * 31 * 0.031).toBeLessThan(5); // a memo measured $0.031 (10-26-26)
    expect(CAPS.thesisCheckDailyCap).toBeGreaterThan(CAPS.memoDailyCap);
    // both caps hit every day of a 31-day month still fit the free $5 (a check measured $0.0004, counted at $0.0005)
    expect(CAPS.memoDailyCap * 31 * 0.031 + CAPS.thesisCheckDailyCap * 31 * 0.0005).toBeLessThan(5);
    // plus one launch day a month that checks every waiting card (Adrian, 10-26-26): still under the free $5
    expect(CAPS.memoDailyCap * 31 * 0.031 + (CAPS.thesisCheckDailyCap * 31 + CAPS.launchChecks) * 0.0005).toBeLessThan(5);
  });
  it("keeps the thesis checks under the free tier's 5 calls a minute, and leaves the daily run time for pictures", async () => {
    const { CHECK_GAP_MS } = await import("@/lib/ai");
    expect(60_000 / CHECK_GAP_MS).toBeLessThanOrEqual(5);
    const job = (await import("node:fs")).readFileSync("src/lib/jobs/enrich.ts", "utf8");
    expect(job).toMatch(/aiThesisCheck\(ctx, \{ reserveMs: [\d_]+ \}\)/);
    expect(job).toMatch(/const room = ctx\.timeLeft\(\) - \(opts\.reserveMs \?\? 0\)/);
    expect(job).toMatch(/room < CHECK_GAP_MS \+ CHECK_MIN_MS\) \{\n\s+ctx\.more\(\)/); // out of room: the next round goes on
    expect(job).toMatch(/headlines: heads \}, room, launch\)/);
    expect(job).toMatch(/isNull\(S\.companies\.thesisCheck\)[^\n]*< \$\{CAP\}/); // a card past the $15M cap is never recommended: no check spent on it
    expect(MEMO_CAP_MESSAGE).toMatch(/copy the outline/);
  });
  it("gives every AI call a time limit, in the app and in the live check", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["src/lib/ai.ts", "scripts/check-ai.ts"]) {
      const calls = readFileSync(f, "utf8").split("generateText({").slice(1).map((c) => c.slice(0, c.indexOf("})")));
      expect(calls.length).toBeGreaterThanOrEqual(3);
      for (const c of calls) expect(c).toMatch(/timeout: /);
    }
  });
});

describe("the Library backfill (10-26-26)", async () => {
  const { LIBRARY, libraryStory } = await import("@/lib/library");
  const { normKey } = await import("@/lib/companies");
  const now = Date.parse("2026-10-26T12:00:00Z");
  const s = (title: string, date: string) => ({ title, url: `https://news.example/${encodeURIComponent(title)}`, date });
  it("takes the newest story that names the company as raising money", () => {
    const r = libraryStory("Udio", [s("Udio raises $10M seed to let anyone make music", "2026-04-01"), s("Udio raises $2M pre-seed", "2025-06-01"), s("Why Udio matters", "2026-09-01")], now);
    expect(r?.title).toBe("Udio raises $10M seed to let anyone make music");
    expect(r?.amount).toBe(10_000_000);
  });
  it("skips stories about someone else, and stories older than two years", () => {
    expect(libraryStory("Spill", [s("Oil spill cleanup startup raises $3M seed", "2026-05-01")], now)).toBeNull();
    expect(libraryStory("Stationhead", [s("Stationhead raises $5M seed", "2022-07-14")], now)).toBeNull();
  });
  it("always checks the startups the team named, by name (A Vinyl Bar in Shibuya, 10-26-26)", () => {
    expect(LIBRARY.find((p) => p.name === "A Vinyl Bar in Shibuya")?.from).toBe("team");
    expect(libraryStory("A Vinyl Bar in Shibuya", [s("Music-apps maker A Vinyl Bar in Shibuya raises $5.5m funding", "2026-09-16")], now)?.amount).toBe(5_500_000);
  });
  it("searches funding news with and without round names, as two searches (10-26-26)", async () => {
    const { FUNDING_SEARCHES } = await import("@/lib/jobs/collect-signals");
    expect(FUNDING_SEARCHES).toEqual(['("pre-seed" OR seed OR "Series A")', '(raises OR raised OR funding OR investment) (startup OR "start-up" OR founders)']);
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("src/lib/jobs/collect-signals.ts", "utf8")).toMatch(/qs\.flatMap\(\(q\) => FUNDING_SEARCHES\.map/);
    expect(readFileSync("src/lib/jobs/enrich.ts", "utf8")).toMatch(/for \(const f of FUNDING_SEARCHES\) plan\.push/);
  });
  it("reads \"bags\" as a raise only with an amount after it", () => {
    expect(libraryStory("Pierre Laborde", [s("The secret behind the viral Pierre Laborde bags is how each of them are created by hand", "2026-05-27")], now)).toBeNull();
    expect(libraryStory("Maison Vive", [s("Maison Vive bags $2M seed for sparkling water", "2026-05-27")], now)?.amount).toBe(2_000_000);
  });
  it("never gives a card past Courtside's stage or over the $15M cap", () => {
    expect(libraryStory("Whop", [s("Whop raises $25M Series B", "2026-02-01")], now)).toBeNull();
    expect(libraryStory("Marble Health", [s("Marble Health raises $20M to expand", "2026-03-01")], now)).toBeNull();
  });
  it("lists each startup once, and none the thesis page marks later stage or whose name finds other news", () => {
    const keys = LIBRARY.map((p) => normKey(p.name));
    expect(new Set(keys).size).toBe(keys.length);
    for (const out of ["ElevenLabs", "Canva", "Splice", "Nucleus", "Runway", "Nero", "Brat", "Moss"]) expect(keys).not.toContain(normKey(out));
    expect(LIBRARY.filter((p) => p.from === "thesis").length).toBeGreaterThanOrEqual(30);
  });
});

describe("Second Look: a startup headline with no funding word gets one name search (10-26-26)", async () => {
  const { secondLookName } = await import("@/lib/jobs/collect-signals");
  it("takes the startup's name from a headline that never mentions money", () => {
    expect(secondLookName("A Vinyl Bar in Shibuya is a startup from a former Spotify leader for making music apps")).toBe("A Vinyl Bar in Shibuya");
    expect(secondLookName("GigaStar launches a creator economy platform for YouTubers")).toBe("GigaStar");
  });
  it("leaves funding headlines to the regular path, and skips stories that aren't about a startup in the thesis", () => {
    expect(secondLookName("Topdog raises $2.5M seed to scale real-time multiplayer gaming")).toBeNull();
    expect(secondLookName("Why everyone is talking about music apps this fall")).toBeNull();
    expect(secondLookName("Acme Logistics launches a freight tracking dashboard")).toBeNull();
  });
  it("runs in both the daily search and the backfill, once per name per run", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["src/lib/jobs/collect-signals.ts", "src/lib/jobs/enrich.ts"]) expect(readFileSync(f, "utf8")).toMatch(/await secondLook\(ctx, n, "Google News", seen\);/);
  });
});
