// The job registry: cron routes, Refresh Now and the local pipeline all run jobs from here.
import { runJob, type Ctx } from "./runner";
import { collectMedia } from "./collect-media";
import { collectSignals } from "./collect-signals";
import { scoreAll } from "./score";
import { cultureJob, sponsorsJob, trendsJob } from "./media-jobs";
import { fundsJob } from "./funds";
import { alertsJob, mondayBrief, weeklyJob, refreshNow } from "./other";
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
  "monday-brief": { label: "Monday brief", hourUtc: 15, weekday: 1, run: (c) => mondayBrief(c) },
  weekly: { label: "Weekly upkeep", hourUtc: 6, weekday: 0, run: weeklyJob },
};

export const REFRESH = { label: "Refresh Now", run: refreshNow };

export async function runNamed(name: string, budgetMs = 240_000) {
  const j = name === "refresh" ? REFRESH : JOBS[name];
  if (!j) throw new Error(`unknown job ${name}`);
  const res = await runJob(name, j.run, budgetMs);
  try {
    await refreshSpotlight();
  } catch {
    /* the Spotlight keeps its last value */
  }
  return res;
}
