import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { companyCards, trendCards } from "@/lib/queries";
import { LockChip, Vote } from "@/components/cards";
import { Row } from "@/components/V2";
import { AddedProvider, TrackingTabs, AddedList, AddPersonAdded, NewAlertAdded } from "@/components/Added";
import { AddTracked } from "@/components/AddTracked";
import { TrackTrend } from "@/components/TrackTrend";
import { AlertToggle } from "@/components/forms";
import { Phase2Link } from "@/components/Phase2Link";
import { Ago, Until } from "@/components/Live";
import { velPill } from "@/components/rows";
import { aiAvailable } from "@/lib/ai";
import { nextRun, fmtDate } from "@/lib/format";

export const revalidate = 300;
export const metadata: Metadata = { title: "Tracking" };

const KIND: Record<string, string> = { video: "Video", post: "Post", appearance: "Podcast appearance", news: "In the news" };
const WEEK = 7 * 86400000;

export default async function Page() {
  const [allCos, allTrends, people, items, alerts, hits, ai, last] = await Promise.all([
    companyCards("all"),
    trendCards(60),
    db().select().from(S.people).orderBy(S.people.id),
    db().select().from(S.personItems).orderBy(desc(S.personItems.date)).limit(400),
    db().select().from(S.alerts).orderBy(S.alerts.id),
    db().select().from(S.alertHits).orderBy(desc(S.alertHits.createdAt)).limit(200),
    aiAvailable(),
    db().select({ t: S.jobRuns.finishedAt }).from(S.jobRuns).where(eq(S.jobRuns.job, "alerts")).orderBy(desc(S.jobRuns.startedAt)).limit(1),
  ]);
  const cos = allCos.filter((c) => c.tracked);
  const trends = allTrends.filter((t) => t.tracked);
  const weekHits = hits.filter((h) => Date.now() - new Date(h.createdAt || h.date || 0).getTime() < WEEK).length;
  return (
    <div>
      <div className="ph">
        <h1>Tracking</h1>
        <span className="count">{weekHits} {weekHits === 1 ? "alert" : "alerts"} this week</span>
      </div>
      <p className="ph-lede">Everything Scout watches for you in one place: the Companies, Trends and People you follow along with custom alert rules. Checked once a day, around 8 AM ET.</p>
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
      <AddedProvider>
      <TrackingTabs
        tabs={[
          { id: "companies", label: "Companies", count: cos.length },
          { id: "trends", label: "Trends", count: trends.length },
          { id: "people", label: "People", count: people.length },
          { id: "alerts", label: "Alerts", count: hits.length },
          { id: "configure", label: "Configure Alerts", count: alerts.length },
        ]}
      >
        <div>
          <AddTracked kind="company" placeholder="Add a company by name or site" />
          <AddedList kind="companies" />
          <div className="x-rows track">
            {cos.map((c) => (
              <Row key={c.id} c={c} />
            ))}
            {!cos.length && <p className="empty">No company is tracked yet. Press Track on any card, or add one above.</p>}
          </div>
        </div>
        <div>
          <AddTracked kind="trend" placeholder="Add a trend by name" />
          <AddedList kind="trends" />
          <div className="list">
            {trends.map((t) => (
              <article key={t.id} className="rowcard" id={`tr-${t.slug}`} data-item>
                <div style={{ minWidth: 0 }}>
                  <h3>
                    <Link href={`/trends#${t.slug}`} title="Open this trend on Trends">
                      {t.headline}
                    </Link>
                  </h3>
                  <div className="meta">
                    {t.area && <span className="tag">{t.area}</span>}
                    <span className={"vel" + (t.up ? "" : " dn")}>{velPill(t)}</span>
                    <span>{t.sources.length} sources</span>
                    {t.lastSeen && <Ago date={t.lastSeen} ch={7} />}
                  </div>
                </div>
                <TrackTrend id={t.id} term={t.headline} initial={t.tracked} />
              </article>
            ))}
            {!trends.length && <p className="empty">No trend is tracked yet. Press Track on any trend, or add one above.</p>}
          </div>
        </div>
        <div>
          <div className="tabadd">
            <AddPersonAdded />
          </div>
          <AddedList kind="people" />
          <div className="list">
            {people.map((p) => {
              const mine = items.filter((i) => i.personId === p.id);
              return (
                <article className="rowcard" id={p.slug} key={p.id} data-item>
                  <div style={{ minWidth: 0 }}>
                    <h3>{p.name}</h3>
                    <div className="meta">
                      {p.role && <span>{p.role}</span>}
                      {mine[0]?.date && <Ago date={mine[0].date} prefix="latest " ch={14} />}
                    </div>
                    {mine.length ? (
                      <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 14.5 }}>
                        {mine.slice(0, 6).map((i) => (
                          <li key={i.id}>
                            <span className="mono" style={{ color: "var(--text-3)" }}>{fmtDate(i.date)}</span> {KIND[i.kind] || i.kind}:{" "}
                            <a href={i.url} target="_blank" rel="noopener noreferrer" title={`Opens ${i.source || "the source"} in a new window`} data-act="source">
                              {i.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ fontSize: 14.5, color: "var(--text-2)", margin: "8px 0 0" }}>Nothing public in the last two weeks. The daily check runs every morning.</p>
                    )}
                    <div className="locked">
                      <LockChip door="xposts">X posts</LockChip>
                      <LockChip door="linkedin">LinkedIn posts</LockChip>
                    </div>
                  </div>
                  <Vote k={`person:${p.id}`} name={p.name} upTitle="Worth following" downTitle="Not useful" />
                </article>
              );
            })}
          </div>
        </div>
        <div>
          <div className="list">
            {hits.map((h) => {
              const rule = alerts.find((a) => a.id === h.alertId);
              return (
                <div key={h.id} className="rowcard" data-item>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15.5 }}>
                      <a href={h.url} target="_blank" rel="noopener noreferrer" title={`Opens ${h.source || "the source"} in a new window`} data-act="source">
                        {h.title}
                      </a>
                    </p>
                    <div className="meta">
                      {h.source && <span>{h.source}</span>}
                      <span>{fmtDate(h.date || h.createdAt)}</span>
                      {rule && <span>alert: {rule.title}</span>}
                    </div>
                  </div>
                  <Vote k={`alert_hit:${h.id}`} row upTitle="Useful hit" downTitle="Not useful" />
                </div>
              );
            })}
            {!hits.length && <p className="empty">Nothing yet. Scout checks every alert every morning.</p>}
          </div>
        </div>
        <div>
          <div className="tabadd">
            <NewAlertAdded ai={ai} />
          </div>
          <AddedList kind="configure" />
          <p className="explain" style={{ margin: "14px 32px 0" }}>
            Each alert is who or what, the event, keywords and sources, checked every morning. Matches land on the Alerts tab and on Today. Watching all day, with email and text alerts, is <Phase2Link />, built together.
          </p>
          <div className="list">
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
                  </div>
                  <AlertToggle id={a.id} active={a.active} />
                </section>
              );
            })}
          </div>
        </div>
      </TrackingTabs>
      </AddedProvider>
    </div>
  );
}
