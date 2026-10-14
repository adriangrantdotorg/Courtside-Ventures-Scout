import Link from "next/link";
import type { Metadata } from "next";
import { trendCards } from "@/lib/queries";
import { Vote, LockChip } from "@/components/cards";
import { TrackTrend } from "@/components/TrackTrend";
import { ListHead, RowFilter } from "@/components/ListHead";
import { Rich } from "@/components/Rich";
import { Ago } from "@/components/Live";
import { spark, velPill } from "@/components/rows";
import { favicon, fmtDate, domainOf, AREA_LABEL } from "@/lib/format";

export const revalidate = 300;
export const metadata: Metadata = { title: "Trends" };

const SRC: Record<string, string> = { news: "News", industry: "News", "google-trends": "Google Trends", trends: "Google Trends", hn: "Hacker News", formd: "Form D", voices: "Video or episode", podcasts: "Episode" };

export default async function Page() {
  const trends = await trendCards(30);
  const tracked = trends.filter((t) => t.tracked).length;
  const areas = Object.entries(AREA_LABEL).map(([key, label]) => ({ key, label, n: trends.filter((t) => t.thesisArea === key).length }));
  return (
    <div>
      <ListHead title="Trends" count={`${trends.length} trends inside the thesis · ${tracked} of 30 tracked · ranked by momentum`} lede="The same name or idea showing up across several sources this week: news, the creators and shows, Hacker News, the App Store, Form D filings and Google Trends. Each needs at least two independent sources and has to touch the thesis." />
      <RowFilter placeholder="Search trends" areas={areas} target="#trend-list" />
      <div className="list" id="trend-list">
        {trends.map((t) => (
          <article key={t.id} id={t.slug} className="rowcard" data-item data-filter={`${t.headline} ${t.area}`} data-area={t.thesisArea || ""}>
            <div style={{ minWidth: 0 }}>
              <div className="meta" style={{ marginBottom: 6 }}>
                {t.tracked && <span className="tag red">Tracked</span>}
                {t.area && <span className="tag">{t.area}</span>}
                <span className={"vel" + (t.up ? "" : " dn")}>{velPill(t)}</span>
                {t.lastSeen && <Ago date={t.lastSeen} ch={7} />}
              </div>
              <h3>{t.headline}</h3>
              {t.whySegs.length > 0 && (
                <p>
                  <Rich segs={t.whySegs} />
                </p>
              )}
              <div className="meta" style={{ margin: "8px 0" }}>
                <span>Learn more:</span>
                {t.sources.slice(0, 3).map((s, i) => (
                  <a key={i} className="src2" href={s.url} target="_blank" rel="noopener noreferrer" title={`${s.title}: opens in a new window`} data-act={i === 0 ? "source" : undefined}>
                    <img src={favicon(domainOf(s.url))} alt="" width={14} height={14} />
                    {SRC[s.source] || s.source}
                  </a>
                ))}
              </div>
              <details>
                <summary style={{ cursor: "pointer", fontSize: 14, color: "var(--text-2)" }}>Timeline: {t.sources.length} sources</summary>
                <ul style={{ margin: "8px 0", paddingLeft: 18, fontSize: 14.5 }}>
                  {t.sources.slice(0, 20).map((s, i) => (
                    <li key={i}>
                      <span className="mono" style={{ color: "var(--text-3)" }}>{fmtDate(s.date)}</span>{" "}
                      <a href={s.url} target="_blank" rel="noopener noreferrer" title="Opens the source in a new window">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
              <div className="locked">
                <TrackTrend id={t.id} term={t.headline} initial={t.tracked} />
                <Link href={`/pipeline?q=${encodeURIComponent(t.slug.split("-")[0])}`} title="Filter the Pipeline to startups in this trend">
                  Find startups in this trend
                </Link>
                <LockChip door="realtime">Real-time</LockChip>
              </div>
            </div>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <Vote k={`trend:${t.id}`} initial={t.votes} name={t.headline} upTitle="This matters to Courtside" downTitle="Not for Courtside" />
              <svg className="spark" viewBox="0 0 120 34" aria-label={`Mentions over four weeks: ${t.weekly.join(", ")}`}>
                <polyline className={t.up ? "" : "dn"} points={spark(t.weekly)} />
              </svg>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
