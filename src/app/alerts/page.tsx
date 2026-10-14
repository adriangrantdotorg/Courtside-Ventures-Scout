import { Phase2Link } from "@/components/Phase2Link";
import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { NewAlert, AlertToggle } from "@/components/forms";
import { LockChip, Vote } from "@/components/cards";
import { Ago, Until } from "@/components/Live";
import { aiAvailable } from "@/lib/ai";
import { nextRun, fmtDate } from "@/lib/format";

export const revalidate = 300;
export const metadata: Metadata = { title: "Alerts" };

export default async function Page() {
  const [alerts, hits, ai, last] = await Promise.all([
    db().select().from(S.alerts).orderBy(S.alerts.id),
    db().select().from(S.alertHits).orderBy(desc(S.alertHits.createdAt)).limit(200),
    aiAvailable(),
    db().select({ t: S.jobRuns.finishedAt }).from(S.jobRuns).where(eq(S.jobRuns.job, "alerts")).orderBy(desc(S.jobRuns.startedAt)).limit(1),
  ]);
  return (
    <div>
      <div className="ph">
        <h1>Alerts</h1>
        <span className="count">
          {alerts.length} alerts · {hits.length} hits
        </span>
      </div>
      <p className="ph-lede">Your alerts live here. Each one is a rule: who or what, the event, keywords, sources.</p>
      <ul className="ph-lede" style={{ paddingLeft: 50, marginTop: 6 }}>
        <li>Checked once a day, around 8 AM ET, against everything new.</li>
        <li>Hits land here and on Today, each with its source.</li>
        <li>
          Watching all day, with email and text alerts, is <Phase2Link />, built together.
        </li>
      </ul>
      <p className="ph-lede mono" style={{ fontSize: 14, color: "var(--text-2)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {last[0]?.t && (
          <>
            Last check <Ago date={last[0].t} ch={8} /> ·
          </>
        )}{" "}
        next <Until date={nextRun(11)} ch={9} />
        <LockChip door="realtime">Real-time</LockChip>
        <Link href="/settings?s=slack" title="Post alert hits to a Slack channel">
          Want this in Slack? Connect Slack
        </Link>
      </p>
      <div className="rule" style={{ marginTop: 16 }} />
      <div className="list">
        <div style={{ margin: "18px 0" }}>
          <NewAlert ai={ai} />
        </div>
        {alerts.map((a) => {
          const mine = hits.filter((h) => h.alertId === a.id);
          return (
            <section className="rowcard" key={a.id} aria-label={a.title}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ textTransform: "none", letterSpacing: 0, fontFamily: "Montserrat, sans-serif", fontSize: 17 }}>{a.title}</h3>
                <div className="meta">
                  <span>{a.active ? "On" : "Off"}</span>
                  <span>
                    <b>{mine.length}</b> {mine.length === 1 ? "hit" : "hits"}
                  </span>
                </div>
                {mine.slice(0, 8).map((h) => (
                  <div key={h.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "8px 0" }} data-item>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 15 }}>
                      <a href={h.url} target="_blank" rel="noopener noreferrer" title={`Opens ${h.source || "the source"} in a new window`} data-act="source">
                        {h.title}
                      </a>{" "}
                      <span className="mono" style={{ fontSize: 13, color: "var(--text-3)" }}>
                        {h.source} · {fmtDate(h.date || h.createdAt)}
                      </span>
                    </div>
                    <Vote k={`alert_hit:${h.id}`} row upTitle="Useful hit" downTitle="Not useful" />
                  </div>
                ))}
              </div>
              <AlertToggle id={a.id} active={a.active} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
