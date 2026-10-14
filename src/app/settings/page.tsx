import type { Metadata } from "next";
import { Suspense } from "react";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { getWeights, getThreshold, getSetting, DEFAULT_QUERIES } from "@/lib/settings";
import { latestJobRuns } from "@/lib/queries";
import { slackConnection, slackConfigured } from "@/lib/slack";
import { aiAvailable } from "@/lib/ai";
import { SettingsView } from "@/components/settings/SettingsView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  const [weights, threshold, queries, extra, off, cap, runs, health, voices, funds, cos, trends, people, alerts, slack, ai, log, feedback, stage] = await Promise.all([
    getWeights(),
    getThreshold(),
    getSetting<string[]>("thesisQueries", DEFAULT_QUERIES),
    getSetting<boolean>("extraSources", false),
    getSetting<string[]>("sourcesOff", []),
    getSetting<number>("aiDailyCap", 150),
    latestJobRuns(),
    db().execute(sql`select source, last_ok, last_error, error_text, items from source_health order by source`) as unknown as Promise<{ rows: { source: string; last_ok: string | null; last_error: string | null; error_text: string | null; items: number }[] }>,
    db().select({ id: S.voices.id, name: S.voices.name, kind: S.voices.kind, status: S.voices.status, lastEpisode: S.voices.lastEpisode, exempt: S.voices.exempt }).from(S.voices).orderBy(S.voices.name),
    db().select({ id: S.funds.id, name: S.funds.name, kind: S.funds.kind, focus: S.funds.focus }).from(S.funds).orderBy(S.funds.name),
    db().select({ id: S.companies.id, name: S.companies.name }).from(S.companies).where(eq(S.companies.tracked, true)),
    db().select({ id: S.trends.id, headline: S.trends.headline }).from(S.trends).where(eq(S.trends.tracked, true)),
    db().select({ id: S.people.id, name: S.people.name }).from(S.people).where(eq(S.people.tracked, true)),
    db().select().from(S.alerts).orderBy(S.alerts.id),
    slackConnection(),
    aiAvailable(),
    db().select().from(S.changeLog).orderBy(desc(S.changeLog.createdAt)).limit(60),
    db().select().from(S.feedback).orderBy(desc(S.feedback.createdAt)).limit(50),
    getSetting("stage", { minCheck: 500000, maxCheck: 4000000 }),
  ]);
  const s = (d: Date | null | undefined) => (d ? d.toISOString() : null);
  return (
    <Suspense>
      <SettingsView
        data={{
          weights,
          threshold,
          queries,
          extra,
          off,
          cap,
          stage,
          runs: runs.map((r) => ({ ...r, started_at: String(r.started_at), finished_at: r.finished_at ? String(r.finished_at) : null })),
          health: health.rows.map((h) => ({ ...h, last_ok: h.last_ok ? String(h.last_ok) : null, last_error: h.last_error ? String(h.last_error) : null })),
          voices: voices.map((v) => ({ ...v, lastEpisode: s(v.lastEpisode) })),
          funds,
          trackedCompanies: cos,
          trackedTrends: trends,
          people,
          alerts: alerts.map((a) => ({ id: a.id, title: a.title, active: a.active })),
          slack,
          slackReady: slackConfigured(),
          ai,
          log: log.map((l) => ({ id: l.id, summary: l.summary, createdAt: s(l.createdAt)!, undone: !!l.undoneAt })),
          feedback: feedback.map((f) => ({ id: f.id, page: f.page, element: f.element, chips: f.chips, note: f.note, meToo: f.meToo, status: f.status, createdAt: s(f.createdAt)! })),
        }}
      />
    </Suspense>
  );
}
