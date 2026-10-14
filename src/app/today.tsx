import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { companyCards, homeCounts, lastUpdated, trendCards, sponsorCards, cultureOverlaps, filingRows, fundFeed, courtsideLatest, backtestRows } from "@/lib/queries";
import { getSpotlight, RULES } from "@/lib/spotlight";
import { getSetting } from "@/lib/settings";
import { Dossier, Vote, LockChip } from "@/components/cards";
import { Masthead } from "@/components/Masthead";
import { HomePrefs } from "@/components/client-bits";
import { Ago } from "@/components/Live";
import { Rich } from "@/components/Rich";
import { VelocityItem, SponsorTile, CultureRow, FilingTable, FundItemTable, SpotlightPill } from "@/components/rows";
import { favicon, fmtDate } from "@/lib/format";

export async function Today() {
  const [counts, updated, spot, picks, trends, sponsors, culture, filings, nb, syn, posts, tests, learned, refreshAt] = await Promise.all([
    homeCounts(),
    lastUpdated(),
    getSpotlight(),
    companyCards("thesis", 5),
    trendCards(6),
    sponsorCards(6),
    cultureOverlaps(7, 6),
    filingRows({ limit: 5 }),
    fundFeed("neighborhood", 5),
    fundFeed("synergistic", 5),
    courtsideLatest(),
    backtestRows(),
    getSetting<string | null>("learnedSummary", null),
    db().select({ t: S.jobRuns.startedAt }).from(S.jobRuns).where(eq(S.jobRuns.job, "refresh")).orderBy(desc(S.jobRuns.startedAt)).limit(1),
  ]);
  const hits = await db().select().from(S.alertHits).orderBy(desc(S.alertHits.createdAt)).limit(3);
  const wins = tests.filter((t) => t.verdict === "win");
  const overlaps = culture.filter((o) => o.voices.length >= 2);
  const cultureShow = overlaps.length ? overlaps : culture.slice(0, 4);

  return (
    <div className="today">
      <Masthead counts={counts} updated={updated} lastRefresh={refreshAt[0]?.t?.toISOString() || null} />
      <HomePrefs />
      <div className="glowframe" data-home="spotlight">
        {spot && (
          <section className="band onred" aria-label="Spotlight">
            <div className="row">
              <span className="spot">
                <i />
                Spotlight
              </span>
              <span style={{ marginLeft: "auto" }}>
                <Vote k={`spotlight:${spot.itemKey}`} row upTitle="Good call" downTitle="Not useful" />
              </span>
            </div>
            <div className="sub">
              <SpotlightPill kind={spot.kind} rule={RULES[spot.kind] || spot.rule} />
            </div>
            <h2>
              {spot.before}
              <Link href={spot.link.href} title={`Open ${spot.link.text} in Scout`}>
                {spot.link.text}
              </Link>
              {spot.after}
            </h2>
            <div className="sub">
              {spot.source.url.startsWith("http") ? (
                <a className="src" href={spot.source.url} target="_blank" rel="noopener noreferrer" title={`Opens the source at ${spot.source.domain} in a new window`}>
                  {spot.source.domain && <img src={favicon(spot.source.domain)} alt="" width={16} height={16} />}
                  {spot.source.label}
                </a>
              ) : null}
              <LockChip door="realtime">Real-time</LockChip>
            </div>
            <div className="line" />
          </section>
        )}
        <div className="body">
          <div className="col">
            {picks.length > 0 && (
              <section aria-label="Top Picks Today">
                <div className="h">
                  <h2>Top Picks Today</h2>
                  <Link className="more" href="/pipeline" title="Open the Pipeline">
                    All {counts.total} in the Pipeline
                  </Link>
                </div>
                {learned && <p className="explain">{learned}</p>}
                <div className="list" style={{ padding: 0 }}>
                  {picks.map((c) => (
                    <Dossier key={c.id} c={c} />
                  ))}
                </div>
              </section>
            )}
          </div>
          <div className="col">
            {trends.length > 0 && (
              <section aria-label="Velocity">
                <div className="h">
                  <h2>Velocity</h2>
                  <Link className="more" href="/trends" title="Open Trends">
                    Mentions, Last 4 Weeks
                  </Link>
                </div>
                <div className="feed">
                  {trends.slice(0, 5).map((t) => (
                    <VelocityItem key={t.id} t={t} />
                  ))}
                </div>
                <p style={{ margin: "10px 0 0" }}>
                  <Link href="/trends" title="Open Trends: up to 30">
                    Show more
                  </Link>
                </p>
              </section>
            )}
            {sponsors.length > 0 && (
              <section aria-label="Sponsor Radar" style={{ marginTop: 28 }}>
                <div className="h">
                  <h2>Sponsor Radar</h2>
                  <Link className="more" href="/sponsors" title="Open Sponsor Radar">
                    All {counts.sponsors} Brands
                  </Link>
                </div>
                <p className="explain">Brands buying ads on shows synergistic with Courtside&apos;s thesis.</p>
                <div className="brands">
                  {sponsors.map((s) => (
                    <SponsorTile key={s.id} s={s} />
                  ))}
                </div>
              </section>
            )}
            {hits.length > 0 && (
              <section aria-label="Alert Hits" style={{ marginTop: 28 }}>
                <div className="h">
                  <h2>Alert Hits</h2>
                  <Link className="more" href="/alerts" title="Open Alerts">
                    All Alerts
                  </Link>
                </div>
                {hits.map((h) => (
                  <p key={h.id} style={{ margin: "0 0 10px", fontSize: 15 }}>
                    <a href={h.url} target="_blank" rel="noopener noreferrer" title={`Opens ${h.source || "the source"} in a new window`}>
                      {h.title}
                    </a>{" "}
                    <span className="mono" style={{ fontSize: 13, color: "var(--text-3)" }}>
                      {h.source}
                    </span>
                  </p>
                ))}
              </section>
            )}
          </div>
        </div>
      </div>

      {wins.length > 0 && (
        <section className="wide section" aria-label="We'd have found it first" data-home="proof">
          <div className="h">
            <h2>We&apos;d Have Found It First</h2>
            <Link className="more" href="/backtest" title="Open Backtest">
              How the Backtest Works
            </Link>
          </div>
          <div className="proof">
            {wins.map((w) => (
              <Link key={w.slug} className="nl" href={`/backtest#${w.slug}`} title={`Open the ${w.company} backtest`}>
                <b className="mono">{w.leadDays} days</b>
                <span>{w.company}</span>
                <small>
                  Flagged {fmtDate(w.flaggedOn)} through {w.signal?.toLowerCase()}, before {w.announceTitle || "Courtside's post"}
                </small>
              </Link>
            ))}
          </div>
        </section>
      )}

      {cultureShow.length > 0 && (
        <section className="wide section" aria-label="Culture" data-home="culture">
          <div className="h">
            <h2>Culture</h2>
            <Link className="more" href="/culture" title="Open Culture">
              The Taste Map
            </Link>
          </div>
          <p className="explain">Brands and startups several creators and shows mentioned this week, with the quote and a link to the exact episode or video.</p>
          {cultureShow.map((o) => (
            <CultureRow key={o.slug} o={o} compact />
          ))}
        </section>
      )}

      <div className="wide" data-home="money">
        <div className="grid2">
          {filings.length > 0 && (
            <section className="section" aria-label="Throw Some D's on it">
              <div className="h">
                <h2>Throw Some D&apos;s on It</h2>
                <Link className="more" href="/throw-some-ds" title="Open Throw Some D's on it">
                  All Filings
                </Link>
              </div>
              <FilingTable rows={filings} compact />
            </section>
          )}
          {nb.items.length > 0 && (
            <section className="section" aria-label="Neighborhood">
              <div className="h">
                <h2>Neighborhood</h2>
                <Link className="more" href="/neighborhood" title="Open the Neighborhood">
                  All Co-Investor Deals
                </Link>
              </div>
              <p className="explain">Funds that have backed a company alongside Courtside, and what they just backed.</p>
              <FundItemTable items={nb.items} compact />
            </section>
          )}
          {syn.items.length > 0 && (
            <section className="section" aria-label="Synergistic Funders Radar">
              <div className="h">
                <h2>Synergistic Funders Radar</h2>
                <Link className="more" href="/synergistic-funders" title="Open Synergistic Funders">
                  All Synergistic Funders
                </Link>
              </div>
              <p className="explain">Funds that invest where Courtside invests but haven&apos;t shared a deal with it yet, and what they just did.</p>
              <FundItemTable items={syn.items} compact />
            </section>
          )}
          {posts.length > 0 && (
            <section className="section" aria-label="From Courtside">
              <div className="h">
                <h2>From Courtside</h2>
              </div>
              <div className="posts">
                {posts.map((p) => (
                  <div className="post" key={p!.id}>
                    <span className="k2">{p!.kind === "medium" ? "Courtside on Medium" : "The 4th Quarter"}</span>
                    <a href={p!.url} target="_blank" rel="noopener noreferrer" title="Opens the post in a new window">
                      {p!.title}
                    </a>
                    {p!.summary && (
                      <p>
                        <Rich segs={[p!.summary]} />
                      </p>
                    )}
                    <span className="mono" style={{ fontSize: 13, color: "var(--text-3)" }}>
                      <Ago date={p!.date} />
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
