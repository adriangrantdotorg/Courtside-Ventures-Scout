// The job registry: cron routes, Refresh Now and the local pipeline all run jobs from here.
import { runJob, type Ctx } from "./runner";
import { collectMedia } from "./collect-media";
import { collectSignals } from "./collect-signals";
import { scoreAll } from "./score";
import { cultureJob, sponsorsJob, trendsJob } from "./media-jobs";
import { fundsJob } from "./funds";
import { alertsJob, mondayBrief, weeklyJob, refreshNow } from "./other";
import { enrichJob, backfillJob, aiThesisCheck } from "./enrich";
import { libraryJob } from "./library";
import { linksAllJob, linksJob, openLeft, openSaved, shownLinks } from "./links";
import { refreshSpotlight } from "../spotlight";
import { checkAi } from "../ai";

export const JOBS: Record<string, { label: string; hourUtc: number; weekday?: number; run: (ctx: Ctx) => Promise<void> }> = {
  "funds-neighborhood": { label: "Co-investor watch", hourUtc: 6, run: (c) => fundsJob(c, "neighborhood") },
  "funds-synergistic": { label: "Synergistic funder watch", hourUtc: 7, run: (c) => fundsJob(c, "synergistic") },
  "collect-media": { label: "Creators and shows", hourUtc: 8, run: (c) => collectMedia(c) },
  "collect-signals": { label: "Startup signals", hourUtc: 9, run: collectSignals },
  score: {
    label: "Scoring",
    hourUtc: 10,
    run: async (c) => {
      await scoreAll(c);
      await checkAi(); // one cheap call a day decides whether the AI features turn on
    },
  },
  alerts: { label: "Alerts", hourUtc: 11, run: alertsJob },
  culture: { label: "Culture", hourUtc: 12, run: cultureJob },
  trends: { label: "Trends", hourUtc: 13, run: trendsJob },
  sponsors: { label: "Sponsor Radar", hourUtc: 14, run: sponsorsJob },
  enrich: { label: "Funds Raised, websites and pictures", hourUtc: 15, run: enrichJob },
  // the Google News links a job saved and had no time to open, opened once (src/lib/jobs/links.ts)
  links: { label: "News Links", hourUtc: 16, run: linksJob },
  "monday-brief": { label: "IC Meeting brief", hourUtc: 4, weekday: 1, run: (c) => mondayBrief(c) },
  weekly: { label: "Weekly upkeep", hourUtc: 6, weekday: 0, run: weeklyJob },
};

/** Jobs with no schedule, run by hand: npm run pipeline:all -- backfill */
export const ON_DEMAND: Record<string, { label: string; run: (ctx: Ctx) => Promise<void> }> = {
  backfill: { label: "Funding news, last 12 months", run: (c) => backfillJob(c) },
  // the backlog after the backfill: checks until today's cap (npm run pipeline:all -- thesis-check)
  "thesis-check": { label: "AI Thesis Check", run: (c) => aiThesisCheck(c) },
  // ship day: every waiting card checked in one go, past the daily cap (npm run pipeline:all -- thesis-check-all --rounds=20)
  "thesis-check-all": { label: "AI Thesis Check, Every Card", run: (c) => aiThesisCheck(c, { launch: true }) },
  // ship day: the startups the team saved, screened by the AI Thesis Check (npm run pipeline:all -- library --rounds=5)
  library: { label: "Library Backfill", run: libraryJob },
  // every Google News link a page shows that Scout hasn't opened, the stored backlog included, about 4 s a link
  // (npm run pipeline:all -- links-all --rounds=10)
  "links-all": { label: "News Links, Every One Stored", run: linksAllJob },
};

export const REFRESH = { label: "Refresh Now", run: refreshNow };

/** The links jobs saved and had no time to open: Refresh Now opens them after its answer is sent
 *  (src/app/api/refresh/route.ts). */
export async function openNewLinks(deadline: number) {
  try {
    await openLeft({ deadline });
  } catch {
    /* the News Links job tries again */
  }
}

/** Jobs that open links themselves. */
const NO_TAIL = new Set(["links", "links-all"]);

export async function runNamed(name: string, budgetMs = 240_000) {
  const j = name === "refresh" ? REFRESH : JOBS[name] || ON_DEMAND[name];
  if (!j) throw new Error(`unknown job ${name}`);
  const t0 = Date.now();
  // each job opens the Google News links it saved, in the time its run has left (about 4 s a link); Refresh Now
  // leaves them for after its answer, and the daily News Links job opens any a job had no time for
  const before = NO_TAIL.has(name) ? null : await shownLinks().catch(() => null);
  const res = await runJob(name, j.run, budgetMs);
  if (before) await openSaved(before, Math.min(Date.now() + 45_000, t0 + budgetMs + 30_000), name !== "refresh").catch(() => {});
  try {
    await refreshSpotlight();
  } catch {
    /* the Spotlight keeps its last value */
  }
  return res;
}
