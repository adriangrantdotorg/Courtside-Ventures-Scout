// Coverage check: startups from the team's Library of Links that Scout doesn't have, and the step that missed each.
// Read-only: it searches the news and reads the database, and writes nothing.
// npx tsx scripts/coverage.ts [--json out.json]
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { findAnnouncement } from "../src/lib/backtest";
import * as F from "../src/lib/sources/fetchers";
import { classify, INCUMBENT, NOT_CONSUMER } from "../src/lib/thesis";
import { subjectOf, stageOf, moneyOf, normKey } from "../src/lib/companies";
import { INDUSTRY_FEEDS } from "../src/lib/jobs/collect-signals";
import { DEFAULT_QUERIES } from "../src/lib/settings";
import { fmtDate } from "../src/lib/format";

import { LIBRARY as PICKS } from "../src/lib/library";

// the startups the team saved (the Library of Links and the Consumer / AI thesis page): one list, src/lib/library.ts
const LIBRARY = PICKS.map((p) => p.name);
const FUNDING = /\b(raises|raised|secures|closes|nabs|bags|funding|seed round|pre-seed|series a)\b/i;
const FEED_HOSTS = INDUSTRY_FEEDS.map(([n, u]) => [n, new URL(u).hostname.replace(/^www\./, "")]);

type Row = { name: string; inScout: string; announced: string; headline: string; outlet: string; missedBy: string; fix: string };

async function scoutStart(): Promise<Date> {
  const r = (await db().execute(sql`select min(started_at) as t from job_runs`)) as unknown as { rows: { t: string }[] };
  return new Date(r.rows[0]?.t || "2026-10-13");
}

async function inScout(name: string) {
  const r = (await db().execute(sql`select id, name, hidden from companies where regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = ${normKey(name)} or aliases ? ${name} limit 1`)) as unknown as { rows: { id: number; name: string; hidden: boolean }[] };
  return r.rows[0] || null;
}

/** The same gates collect-signals' fromHeadline uses, in order; the first one a headline fails. */
function gate(title: string, text: string, name: string): string | null {
  if (!FUNDING.test(title)) return "The headline has no funding word";
  const subj = subjectOf(title);
  if (!subj) return "Scout couldn't read the company name from the headline";
  if (normKey(subj) !== normKey(name)) return `Scout read the company as "${subj}"`;
  if (INCUMBENT.test(subj)) return "The name looks like a big company";
  if (NOT_CONSUMER.test(title)) return "The headline reads as a developer or business tool";
  if (!classify(`${title}. ${text}`).area) return "The thesis keywords didn't match the story";
  const st = stageOf(title);
  if (st === "unknown" && !moneyOf(title)) return "The headline names no round and no amount";
  if (st === "later" || st === "series-b") return "Past Courtside's stage";
  return null;
}

/** Would one of Scout's six daily news searches have returned the story? Same words, one at a time. */
function matchesQueries(text: string): boolean {
  const t = text.toLowerCase();
  return DEFAULT_QUERIES.some((q) => q.split(/\s+OR\s+/).some((w) => t.includes(w.replace(/"/g, "").toLowerCase())));
}

async function main() {
  const start = await scoutStart();
  const out: Row[] = [];
  for (const name of LIBRARY) {
    const have = await inScout(name);
    if (have && !have.hidden) {
      out.push({ name, inScout: `Yes (#${have.id})`, announced: "", headline: "", outlet: "", missedBy: "Nothing: Scout has it", fix: "" });
      continue;
    }
    const a = await findAnnouncement(name);
    if (!a) {
      out.push({ name, inScout: have ? "Hidden" : "No", announced: "", headline: "", outlet: "", missedBy: "No funding story in Google News under this name", fix: "Name-only search misses it: needs a funding database or the company's own site" });
      continue;
    }
    const news = await F.googleNews(`"${name}"`, "3650d");
    const story = news.find((n) => n.title === a.title) || { text: "", outlet: "" };
    const host = new URL(a.url).hostname.replace(/^www\./, "");
    const feed = FEED_HOSTS.find(([, h]) => host.endsWith(h as string));
    let missedBy: string;
    let fix = "";
    const g = gate(a.title, story.text || "", name);
    if (new Date(a.date) < start) {
      missedBy = `Raised ${fmtDate(a.date)}, before Scout started (${fmtDate(start)}); Scout reads news from the last 7 days`;
      fix = "A one-time backfill of funding news, or a funding database";
      if (g) missedBy += `. Even then: ${g.toLowerCase()}`;
    } else if (g) {
      missedBy = g;
      fix = "Loosen that gate";
    } else if (!feed && !matchesQueries(`${a.title} ${story.text || ""}`)) {
      missedBy = `${story.outlet || host} isn't one of Scout's feeds, and the story doesn't use the news searches' words`;
      fix = `Add ${host} or a wider news search`;
    } else {
      missedBy = "Scout's sources carried it; the daily run didn't see it in its 7-day window";
      fix = "Check the run log for that day";
    }
    out.push({ name, inScout: have ? "Hidden" : "No", announced: fmtDate(a.date), headline: a.title, outlet: story.outlet || host, missedBy, fix });
    process.stderr.write(`${name}: ${missedBy}\n`);
  }
  console.log("| Startup | In Scout | Announced | Outlet | What missed it |");
  console.log("|---|---|---|---|---|");
  for (const r of out) console.log(`| ${r.name} | ${r.inScout} | ${r.announced} | ${r.outlet} | ${r.missedBy} |`);
  const i = process.argv.indexOf("--json");
  if (i > 0) writeFileSync(process.argv[i + 1], JSON.stringify(out, null, 2));
}

main().then(() => process.exit(0));
