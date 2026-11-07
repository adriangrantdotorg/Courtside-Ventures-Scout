import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ago, until, fmtMoney, fmtDate, stageLabel, titleCase } from "@/lib/format";
import { buildIndex, linkify } from "@/lib/linkify";
import { classify } from "@/lib/thesis";
import { cleanName, isGenericName, moneyOf, stageOf, subjectOf } from "@/lib/companies";
import { whyFitsLine, portfolioCheck, scoreCompany } from "@/lib/score";
import { cleanCopy } from "@/lib/copy";
import { cleanEvidence } from "@/lib/seed";
import { isSubject, decodeGoogleNews } from "@/lib/backtest";
import { minutesToGo } from "@/lib/progress-core.mjs";

describe("format", () => {
  it("relative time at every age", () => {
    const now = Date.parse("2026-10-14T12:00:00Z");
    expect(ago(now - 10_000, now)).toBe("just now");
    expect(ago(now - 5 * 60_000, now)).toBe("5m ago");
    expect(ago(now - 3 * 3600_000, now)).toBe("3h ago");
    expect(ago(now - 2 * 86400_000, now)).toBe("2d ago");
    expect(ago(now - 21 * 86400_000, now)).toBe("3w ago");
    expect(ago(now - 120 * 86400_000, now)).toBe("4mo ago");
    expect(ago(now - 400 * 86400_000, now)).toBe("1y ago");
    expect(until(now + (6 * 60 + 12) * 60_000, now)).toBe("in 6h 12m");
  });
  it("money keeps its currency", () => {
    expect(fmtMoney(2e6, "EUR")).toBe("€2.0M");
    expect(fmtMoney(10e6, "GBP")).toBe("£10.0M");
    expect(fmtMoney(5.5e6, "$")).toBe("$5.5M");
  });
  it("dates are MM-DD-YY and stages are Title Case", () => {
    expect(fmtDate("2025-04-29")).toBe("04-29-25");
    expect(stageLabel("pre-seed")).toBe("Pre-Seed");
    expect(titleCase("all in the pipeline")).toBe("All in the Pipeline");
  });
});

describe("thesis rules and their traps", () => {
  it("steam on Steam is gaming; gathering steam is not", () => {
    expect(classify("An indie roguelike now on Steam for multiplayer game nights").area).toBe("gaming");
    expect(classify("The fintech movement gathers steam").area).toBeNull();
  });
  it("one weak keyword is not a thesis area", () => {
    expect(classify("A new platform for health").area).toBeNull();
    expect(classify("Performance review software").area).toBeNull();
  });
  it("pharma is not consumer health", () => expect(classify("Biotech pharma drug discovery for oncology clinical trials").area).not.toBe("health"));
});

describe("name hygiene", () => {
  it("strips backed and possessive prefixes", () => {
    expect(cleanName("Lightspeed-backed Acme")).toBe("Acme");
    expect(cleanName("India's TailBlaze")).toBe("TailBlaze");
  });
  it("keeps short real names, drops generic words and job titles", () => {
    expect(isGenericName("1club")).toBe(false);
    expect(isGenericName("Ro")).toBe(false);
    expect(isGenericName("Jump")).toBe(false);
    expect(isGenericName("Head of Innovation")).toBe(true);
    expect(isGenericName("Startup")).toBe(true);
  });
  it("valuation is not the round; sports seeding is not a round", () => {
    expect(moneyOf("Rebel Audio Raises Series A at $50 Million Valuation")).toBeNull();
    expect(moneyOf("Spash raises €2M Series A")).toEqual({ amount: 2e6, currency: "EUR" });
    expect(stageOf("Park boys soccer secures No. 2 seed in sections")).toBe("unknown");
    expect(subjectOf("Noise raises $5.5M seed to pay creators")).toBe("Noise");
  });
});

describe("why it fits and the portfolio check", () => {
  it("why-it-fits stays under 30 words with the play and a parallel", () => {
    const l = whyFitsLine({ name: "Mochi", description: "Anime microdramas produced with AI for mobile viewers.", thesisArea: "media", stage: "pre-seed", amount: null, currency: "$", lastSignal: { type: "yc", date: new Date() } });
    expect(l.split(/\s+/).length).toBeLessThanOrEqual(30);
    expect(l).toMatch(/like Camb AI/);
    expect(l).not.toMatch(/is in the funding news/);
  });
  it("no portfolio tie in prose: never \"near X in the portfolio\" (10-30-26)", () => {
    // only real competitors get a tie, as the Overlaps With tag; 305 cards read "near Religion of Sports in the portfolio"
    const l = whyFitsLine({ name: "Chaos", description: "", thesisArea: "media", stage: "pre-seed", amount: 1_000_000, currency: "£", lastSignal: null });
    expect(l).toBe("A new Media company, inside Courtside's thesis; raised $1.3M pre-seed.");
    expect(cleanCopy("A new Media company in the Media area of the thesis, near Religion of Sports in the portfolio; raised £1.0M pre-seed.")).toBe("A new Media company, inside Courtside's thesis; raised £1.0M pre-seed.");
    expect(cleanCopy("An AI that runs creators' social content, close to Wizard and Stay Tuned in the portfolio; in Y Combinator.")).toBe("An AI that runs creators' social content; in Y Combinator.");
    expect(cleanCopy("An investment platform for sports and trading cards, next to Rare Candy and Kolex in the portfolio; in Y Combinator.")).toBe("An investment platform for sports and trading cards; in Y Combinator.");
  });
  it("VideoDB overlaps Graphon AI", () => {
    const c = portfolioCheck(
      { name: "VideoDB", description: "VideoDB is the video database for AI agents: search, memory and context across video and audio.", thesisArea: "media" },
      [{ name: "Graphon AI", sector: "Sports", description: "Graphon AI is an AI infrastructure company building the memory layer beneath LLMs and agents, converting messy enterprise data across video, audio, documents, and sensors into persistent, searchable context." }, { name: "Veo", sector: "Sports", description: "Veo is a camera for recording youth sports." }],
    );
    expect(c?.with).toBe("Graphon AI");
  });
  it("pre-Series A is its own round: its own label, the same fit score as seed and Series A (11-06-26)", async () => {
    // Hoopr's "extended pre-Series A round" read as Series A on its card (5 cards: Hoopr, Vytalyou, Gamepoint, Matiks, Decode Age)
    const { stageOf } = await import("@/lib/companies");
    const { stageLabel } = await import("@/lib/format");
    expect(stageOf("Music licensing platform Hoopr raises funds in extended pre-Series A round")).toBe("pre-series-a");
    expect(stageOf("Longevity Science Startup Decode Age Secures INR 14.48 Cr Pre Series A Funding")).toBe("pre-series-a");
    expect(stageOf("Social gaming startup Matiks raises $10 Mn in Pre-Series A led by General Catalyst")).toBe("pre-series-a");
    expect(stageOf("Acme raises $8M Series A")).toBe("series-a");
    expect(stageLabel("pre-series-a")).toBe("Pre-Series A");
    const base = { name: "X", description: "A sports fan engagement app for fantasy leagues", thesisArea: "sports", amount: null, currency: "$", signals: [], voiceMentions: 0, sponsorShows: 0, relatedPersons: 0, yc: false, geoText: "", learned: 99, competes: false, checkRange: { minCheck: 5e5, maxCheck: 4e6 } };
    const w = { thesis: 30, stage: 20, signal: 20, culture: 15, team: 10, geo: 5 };
    const pre = scoreCompany({ ...base, stage: "pre-series-a" }, w).score;
    expect(pre).toBe(scoreCompany({ ...base, stage: "seed" }, w).score);
    expect(pre).toBe(scoreCompany({ ...base, stage: "series-a" }, w).score);
    expect(whyFitsLine({ name: "Hoopr", description: "", thesisArea: "media", stage: "pre-series-a", amount: 4e7, currency: "INR", lastSignal: null })).toContain("raised $480K pre-Series A.");
  });
  it("past Series A is penalized and the score stays 0-100", () => {
    const base = { name: "X", description: "A sports fan engagement app for fantasy leagues", thesisArea: "sports", amount: null, currency: "$", signals: [], voiceMentions: 0, sponsorShows: 0, relatedPersons: 0, yc: false, geoText: "", learned: 99, competes: false, checkRange: { minCheck: 5e5, maxCheck: 4e6 } };
    const w = { thesis: 30, stage: 20, signal: 20, culture: 15, team: 10, geo: 5 };
    const a = scoreCompany({ ...base, stage: "seed" }, w);
    const b = scoreCompany({ ...base, stage: "series-b" }, w);
    expect(b.score).toBeLessThan(a.score);
    expect(a.breakdown.learned).toBe(15);
    expect(a.score).toBeLessThanOrEqual(100);
  });
});

describe("words on screen", () => {
  it("cleanCopy keeps a company's own words: only Scout's \"the X pattern\" is rewritten (10-27-26)", () => {
    expect(cleanCopy("Helps users understand their nightly sleep patterns")).toBe("Helps users understand their nightly sleep patterns");
    expect(cleanCopy("the specialized-marketplace pattern behind StockX")).toBe("the specialized-marketplace play behind StockX");
  });
  it("cleanCopy removes lanes, patterns and Context only", () => {
    const s = cleanCopy("Media lane: anime, the Camb AI pattern; Context only: a domain can be older. Pre-seed");
    expect(s).not.toMatch(/\blanes?\b|pattern|Context only|Pre-seed/);
  });
  it("rejected evidence always says why; Google News redirects are dropped", () => {
    const ev = cleanEvidence([
      { url: "https://news.google.com/rss/articles/x", date: "2021-01-01", kind: "News", note: "Funding news", title: "t", counts: true },
      { url: "https://rdap.org/domain/a.com", date: "2020-01-01", kind: "Domain", note: "Context only: a domain can be older than the company", title: "t", counts: false },
    ]);
    expect(ev.length).toBe(1);
    expect(ev[0].note.startsWith("Rejected because")).toBe(true);
  });
});

describe("linkifier", () => {
  const idx = buildIndex([
    { name: "Baller League", aliases: [], href: "/company/1", ext: false },
    { name: "Camb AI", aliases: [], href: "https://camb.ai", ext: true },
  ]);
  it("links whole names once, longest first", () => {
    const segs = linkify("Like Baller League and Baller League again, plus Camb AI.", idx);
    expect(segs.filter((s) => typeof s !== "string").length).toBe(2);
  });
  it("never inside another word", () => expect(linkify("BallerLeagues", idx).every((s) => typeof s === "string")).toBe(true));
});

describe("backtest truth rules", () => {
  it("the company must be the headline's subject", () => {
    expect(isSubject("Eternal", "Doom Eternal gets a new expansion")).toBe(false);
    expect(isSubject("Eternal", "Eternal raises $13M seed for longevity")).toBe(true);
    expect(isSubject("Baller League", "Rival league takes aim at Baller League")).toBe(false);
  });
  it("never keeps a Google News redirect it cannot decode", () => expect(decodeGoogleNews("https://news.google.com/rss/articles/AU_yqLzz?oc=5")).toBeNull());
});

describe("build progress estimate", () => {
  it("rounds to 5 minutes and pauses while waiting", () => {
    const now = Date.now();
    const p = { step: 4, name: "x", startedAt: now - 1e6, stepStartedAt: now - 60_000, updatedAt: now, note: "", waiting: false, liveUrl: "", done: false, durations: { 1: 240, 2: 360, 3: 240 } };
    expect(minutesToGo(p, now)).toBeGreaterThanOrEqual(1);
    const w = { ...p, waiting: true, waitingSince: now - 600_000 };
    expect(minutesToGo(w, now)).toBe(minutesToGo(w, now + 3_600_000));
  });
});

/* ---------- source guards ---------- */
function files(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(tsx?|css|mjs)$/.test(f)) out.push(p);
  }
  return out;
}
const SRC = files("src").map((f) => ({ f, s: readFileSync(f, "utf8") }));

describe("guards on the source", () => {
  it("only a startup takes a vote: every vote button is that startup's own vote (11-06-26)", () => {
    // a vote on a deal, filing, trend, founder, alert hit, sponsor or Backtest card was saved and counted, and nothing
    // read it; only a startup's vote moves its fit score (src/lib/jobs/score.ts). A row tied to a startup votes for it.
    const bad: string[] = [];
    for (const { f, s } of SRC)
      for (const m of s.matchAll(/<Vote\s+k=\{`([a-z_]+):/g)) if (m[1] !== "company") bad.push(`${f}: a "${m[1]}" vote (vote for the row's startup, k={\`company:\${id}\`}, or show none)`);
    expect(bad).toEqual([]);
    expect(readFileSync("src/app/api/vote/route.ts", "utf8")).toMatch(/const TYPES = new Set\(\["company"\]\)/);
  });
  it("every save goes through the shared helper, so the next page shows it (11-06-26)", () => {
    // the browser keeps its own copies of pages; only a save through src/lib/client.ts (postJSON / sendJSON) tells the
    // Shell to drop them, and a save with a bare fetch would bring the old page back
    const clientFiles = SRC.filter(({ f, s }) => !f.endsWith("src/lib/client.ts") && /^["']use client["']/m.test(s));
    const bare = clientFiles.flatMap(({ f, s }) => s.split("\n").map((l, i) => ({ f, i: i + 1, l }))).filter(({ l }) => /fetch\(/.test(l) && /method:\s*"(POST|PATCH|PUT|DELETE)"/.test(l)).map(({ f, i }) => `${f}:${i}`);
    expect(bare, "save through postJSON / sendJSON from @/lib/client").toEqual([]);
    // a POST that only reads never announces a save (it would make every page refresh itself, forever)
    const READ_ROUTES = /(postJSON|sendJSON)[^(]*\(\s*(?:"POST",\s*)?"\/api\/(votes|backtest|slack\/test)"/;
    const reads = SRC.flatMap(({ f, s }) => s.split("\n").map((l, i) => ({ f, i: i + 1, l }))).filter(({ l }) => READ_ROUTES.test(l)).map(({ f, i }) => `${f}:${i}`);
    expect(reads, "read the live counts, a backtest step and Slack's test through readJSON").toEqual([]);
    expect(readFileSync("src/lib/client.ts", "utf8")).toMatch(/if \(!opts\.read\) changed\(\);\n\s+return \{ ok: true/);
    // a Server Action, not router.refresh alone: refresh clears only the page on screen (Next.js 16 docs, use-router)
    const shell = readFileSync("src/components/Shell.tsx", "utf8");
    expect(shell).toMatch(/pagesChanged\(\)/);
    expect(shell).toMatch(/\n      <SaveRefresh \/>\n/);
    expect(shell).toMatch(/\n      <Landing \/>\n/);
    expect(readFileSync("src/app/actions.ts", "utf8")).toMatch(/^"use server";[\s\S]*revalidatePath\("\/", "layout"\)/);
  });
  it("Slack is off in one place, and every Slack address checks it first (11-06-26: no Slack anywhere)", () => {
    expect(readFileSync("src/lib/features.ts", "utf8")).toMatch(/export const SLACK = false;/);
    for (const r of readdirSync("src/app/api/slack")) {
      const src = readFileSync(`src/app/api/slack/${r}/route.ts`, "utf8");
      expect(src, r).toMatch(/export async function (GET|POST)\([^)]*\) \{\n\s+if \(!SLACK\) return new NextResponse\(null, \{ status: 404 \}\)/);
    }
    // the automatic posts check it too
    const jobs = readFileSync("src/lib/jobs/other.ts", "utf8");
    expect(jobs).toMatch(/if \(SLACK\) await postSlackHits\(ctx\)/);
    expect(jobs).toMatch(/if \(!SLACK\) return;\n\s+const \{ slackPost \}/);
  });
  it("the consumer trade feeds are read, and About lists exactly the feeds the job reads (11-06-26)", async () => {
    const { INDUSTRY_FEEDS } = await import("@/lib/jobs/collect-signals");
    const names = INDUSTRY_FEEDS.map(([n]) => n);
    for (const n of ["Glossy", "Beauty Independent", "NOSH", "Food Dive", "BevNET", "Retail Dive", "Practical Ecommerce", "Insurance Journal"]) expect(names, n).toContain(n);
    expect(new Set(names).size).toBe(names.length); // no feed twice
    for (const [, u] of INDUSTRY_FEEDS) expect(u).toMatch(/^https:\/\//);
    // About reads the same list, so it can't name a feed the job no longer reads, or miss a new one
    expect(readFileSync("src/app/about/page.tsx", "utf8")).toMatch(/INDUSTRY_FEEDS\.map\(\(\[n\]\) => n\)/);
  });
  it("unit tests never reach the live database (11-06-26: test runs wrote 8 fake failures into Settings › Sources)", async () => {
    for (const k of Object.keys(process.env)) expect(k, "vitest.config.ts drops every database setting").not.toMatch(/^(DATABASE_URL|POSTGRES_|PG[A-Z]|NEON_)/);
    const { hasDb } = await import("@/db");
    expect(hasDb(), "this file has no test database, so it has no database at all").toBe(false);
  });
  it("no native confirm() or alert(), and no error through toast()", () => {
    for (const { f, s } of SRC) {
      expect(s, f).not.toMatch(/(^|[^.\w])(window\.)?(confirm|alert)\(/);
      expect(s, f).not.toMatch(/toast\([^)]*(error|failed|didn't)/i);
    }
  });
  it("every Undo is ready the moment its action starts: ui.undoable, never an Undo added after the save (10-26-26)", () => {
    // a ⌘Z pressed before a save landed did nothing, or undid the action before it
    for (const { f, s } of SRC) if (!f.endsWith("ui.tsx")) expect(s, f).not.toMatch(/pushUndo/);
    expect(SRC.filter(({ s }) => /ui\.undoable\(/.test(s)).length).toBeGreaterThanOrEqual(5);
  });
  it("a picture with a fallback is an <Img onFail>, never a bare <img onError> (10-30-26)", () => {
    // a server-rendered picture that failed before React attached onError stayed broken instead of falling back
    for (const { f, s } of SRC) for (const m of s.matchAll(/<img\b[^>]*onError=/g)) expect(m.index === s.indexOf("<img ref={ref} alt={alt} {...p} onError={onFail} />") ? "Img" : m[0], f).toBe("Img");
  });
  it("motion follows Scout's own Motion switch, never the Mac's Reduce Motion (10-14-26; 2nd report 11-05-26)", () => {
    // the V2 port brought back four OS checks, so Brand Sky's drift sat still on a Mac with Reduce Motion on.
    // Instead: html[data-motion="off"] <selector> (Settings › Appearance › Motion).
    for (const { f, s } of SRC) expect(s, f).not.toMatch(/prefers-reduced-motion|reducedMotion|reduced-motion/);
    // the mockups too: porting design/v2's CSS is how the OS checks came back, and every page he reviews must move
    const design = (dir: string, out: string[] = []): string[] => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) design(p, out);
        else if (/\.(css|html|py|js)$/.test(f)) out.push(p);
      }
      return out;
    };
    for (const f of design("design")) expect(readFileSync(f, "utf8"), f).not.toMatch(/prefers-reduced-motion/);
  });
  it("a company's raise is shown through raisedText, in dollars, never fmtMoney on its saved amount (11-05-26)", () => {
    // Hoopr's ₹4 crore read "$40.0M" in its why-fits line while Funds Raised said $480K on the same card
    for (const { f, s } of SRC) expect(s, f).not.toMatch(/fmtMoney\(\s*(?:c|co|company)\.amount\b/);
    expect(readFileSync("src/lib/score.ts", "utf8")).not.toMatch(/fmtMoney\(/); // the why-fits line
  });
  it("nothing truncates text", () => {
    for (const { f, s } of SRC) expect(s, f).not.toMatch(/text-overflow:\s*ellipsis|line-clamp/);
  });
  it("no page reloads itself", () => {
    for (const { f, s } of SRC) expect(s, f).not.toMatch(/http-equiv=["']refresh|location\.reload\(|window\.location\s*=[^=]|setInterval\([^)]*router\.refresh/);
  });
  it("no :visited rule", () => {
    for (const { f, s } of SRC.filter((x) => x.f.endsWith(".css"))) expect(s, f).not.toMatch(/:visited/);
  });
  it("cron jobs run at most once a day, at most 100", () => {
    const v = JSON.parse(readFileSync("vercel.json", "utf8"));
    expect(v.crons.length).toBeLessThanOrEqual(100);
    for (const c of v.crons) expect(c.schedule).toMatch(/^\d+ \d+ \* \* (\*|\d)$/);
  });
});

describe("round 1 fixes (10-14-26)", () => {
  it("double-encoded entities never reach the screen", async () => {
    const { unescapeTwice, cleanCopy } = await import("@/lib/copy");
    expect(unescapeTwice("You&amp;#8217;ll &amp;amp; me")).toBe("You’ll & me");
    expect(cleanCopy("won&#8217;t")).toBe("won’t");
  });
  it("a why-it-fits line never starts with punctuation", () => {
    for (const description of ["Tailblaze Longevity.", "Park Boys Soccer", "", "Mochi is."]) {
      const l = whyFitsLine({ name: "X", description, thesisArea: "health", stage: "pre-seed", amount: 300000, currency: "$", lastSignal: null });
      expect(l, description).toMatch(/^[A-Z]/);
    }
  });
  it("the portfolio check never calls an adjective shared ground", () => {
    const r = portfolioCheck({ name: "Alpha", description: "A focused mobile sleep tracking app for athletes", thesisArea: "health" }, [{ name: "Beta", sector: "health", description: "A focused mobile recovery tracking app for athletes" }]);
    expect(r?.reason || "").not.toMatch(/focused|mobile/);
  });
  it("the six weights always add up to 100 after one moves", async () => {
    const { rebalance } = await import("@/components/settings/SettingsView");
    const w = { thesis: 34, stage: 28, signal: 20, culture: 15, team: 10, geo: 5 };
    for (const n of [0, 12, 45, 60]) {
      const r = rebalance(w, "thesis", n);
      expect(Object.values(r).reduce((a, b) => a + b, 0)).toBe(100);
      expect(r.thesis).toBe(n);
      expect(Object.values(r).every((v) => v >= 0 && v <= 60)).toBe(true);
    }
  });
  it("no live slot is followed by punctuation (the period would float)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const bad: string[] = [];
    const walk = (d: string) => {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (/\.tsx$/.test(f) && /<(Until|Ago|Clock)\b[^>]*\/>\s*[.,;:)]/.test(fs.readFileSync(p, "utf8"))) bad.push(p);
      }
    };
    walk("src");
    expect(bad).toEqual([]);
  });
});

describe("round 3 fixes (10-14-26)", () => {
  it("a mention keeps the first letter of its sentence", async () => {
    const { extractMentions } = await import("@/lib/extract");
    const m = extractMentions("Scott Galloway: This is Where Nike Went Wrong.\nWith Nike's stock down, Scott breaks it down.", "Pivot", ["Nike"]);
    expect(m[0]?.quote.startsWith("Scott")).toBe(true);
  });
});

// Neon's free plan allows 5 GB of network transfer a month, and the month was at 85% by 11-06-26: one browser run on
// the live database read 243 MB. Local checks run on a local copy; long runs on GitHub start only by Adrian's button.
describe("the live database's free transfer (11-06-26)", () => {
  it("npm run check builds and runs the browser tests on a local copy", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts.check).toBe("bash scripts/check.sh");
    const sh = readFileSync("scripts/check.sh", "utf8");
    expect(sh).toMatch(/export SCOUT_PGLITE=/);
    expect(sh.indexOf("export SCOUT_PGLITE=")).toBeLessThan(sh.indexOf("npx next build"));
    expect(readFileSync("playwright.config.ts", "utf8")).toMatch(/if \(!LIVE && !process\.env\.SCOUT_PGLITE\)\s*throw/);
  });
  it("Live Runs starts only from the Run workflow button, and offers only runs Scout has", async () => {
    const y = readFileSync(".github/workflows/live-runs.yml", "utf8");
    const on = y.slice(y.indexOf("\non:"), y.indexOf("\nconcurrency:"));
    expect(on).toMatch(/workflow_dispatch:/);
    expect(on).not.toMatch(/\b(push|pull_request|schedule|workflow_run):/);
    expect(y).not.toMatch(/\$\{\{\s*inputs\.[^}]*\}\}[^\n]*\bnpx\b/); // inputs reach the shell as env, never pasted in
    const { JOBS, ON_DEMAND } = await import("@/lib/jobs");
    const opts = [...on.matchAll(/^\s+- ([\w-]+)$/gm)].map((m) => m[1]);
    expect(opts.length).toBeGreaterThan(0);
    for (const o of opts.filter((o) => o !== "ship-day-fill")) expect(o in JOBS || o in ON_DEMAND, o).toBe(true);
    // ship-day-fill runs ship day's step 3 on GitHub (11-06-26): every job it names must exist
    expect(opts).toContain("ship-day-fill");
    const fill = y.slice(y.indexOf("ship-day-fill)"), y.indexOf(";;", y.indexOf("ship-day-fill)")));
    const jobs = [...fill.matchAll(/pipeline-all\.ts ([\w -]+?) "--rounds/g)].flatMap((m) => m[1].split(" "));
    expect(jobs).toEqual(["backfill", "library", "score", "enrich", "thesis-check-all"]);
    for (const j of jobs) expect(j in JOBS || j in ON_DEMAND, j).toBe(true);
    // the AI runs can't use the Mac's Vercel token on GitHub
    expect(y).toMatch(/AI_GATEWAY_API_KEY: \$\{\{ secrets\.AI_GATEWAY_API_KEY \}\}/);
  });
});
