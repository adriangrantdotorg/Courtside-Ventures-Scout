import Link from "next/link";
import type { Metadata } from "next";
import { trendCards } from "@/lib/queries";
import { Vote, LockChip } from "@/components/cards";
import { TrackTrend } from "@/components/TrackTrend";
import { TimelineToggle } from "@/components/TimelineToggle";
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
          <article key={t.id} id={t.slug} className="rowcard tcard" data-item data-filter={`${t.headline} ${t.area}`} data-area={t.thesisArea || ""}>
            <div style={{ minWidth: 0 }}>
              <div className="trow1">
                <div>
                  <h3>{t.headline}</h3>
                  <div className="meta" style={{ margin: "6px 0 8px" }}>
                    {t.area && <span className="tag">{t.area}</span>}
                    <span className={"vel" + (t.up ? "" : " dn")}>{velPill(t)}</span>
                    <span>{t.sources.length} sources</span>
                    {t.lastSeen && <Ago date={t.lastSeen} ch={7} />}
                  </div>
                  {t.whySegs.length > 0 && (
                    <p>
                      <Rich segs={t.whySegs} />
                    </p>
                  )}
                  <div className="meta" style={{ margin: "4px 0 0" }}>
                    {t.sources.slice(0, 3).map((s, i) => (
                      <a key={i} className="src2" href={s.url} target="_blank" rel="noopener noreferrer" title={`${s.title}: opens in a new window`} data-act={i === 0 ? "source" : undefined}>
                        <img src={favicon(domainOf(s.url))} alt="" width={14} height={14} />
                        {SRC[s.source] || s.source}
                      </a>
                    ))}
                  </div>
                </div>
                <svg className="spark" viewBox="0 0 120 34" aria-label={`Mentions over four weeks: ${t.weekly.join(", ")}`}>
                  <polyline className={t.up ? "" : "dn"} points={spark(t.weekly)} />
                </svg>
              </div>
              <div className="tbar">
                <TrackTrend id={t.id} term={t.headline} initial={t.tracked} />
                <Link className="btn" href={`/pipeline?q=${encodeURIComponent(t.slug.split("-")[0])}`} title="Filter the Pipeline to startups in this trend">
                  Find Startups in This Trend
                </Link>
                <TimelineToggle n={t.sources.length}>
                  <ul style={{ margin: 0, paddingLeft: 0 }}>
                    {t.sources.slice(0, 20).map((s, i) => (
                      <li key={i}>
                        <span className="mono" style={{ color: "var(--text-3)" }}>{fmtDate(s.date)}</span>{" "}
                        <a href={s.url} target="_blank" rel="noopener noreferrer" title="Opens the source in a new window">
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </TimelineToggle>
                <span className="lockchip">
                  <LockChip door="realtime">Real-time</LockChip>
                </span>
                <Vote k={`trend:${t.id}`} initial={t.votes} name={t.headline} upTitle="This matters to Courtside" downTitle="Not for Courtside" row />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
