import type { Metadata } from "next";
import { backtestRows } from "@/lib/queries";
import { DocHead, Toc } from "@/components/doc";
import { BacktestAny } from "@/components/BacktestAny";
import { EvidenceRows } from "@/components/Evidence";
import { Vote } from "@/components/cards";
import { favicon, fmtDate } from "@/lib/format";

export const revalidate = 300;
export const metadata: Metadata = { title: "Backtest" };

export default async function Page() {
  const all = await backtestRows(false);
  // Only the deals Scout would have found first are shown; a "none" shows only as the live answer to a request below (Adrian, 10-14-26)
  const deals = all.filter((b) => b.courtside && b.verdict === "win");
  const others = all.filter((b) => !b.courtside && b.verdict === "win").slice(0, 12);
  const wins = deals;
  const leads = wins.map((w) => w.leadDays || 0).sort((a, b) => a - b);
  const median = leads.length ? leads[Math.floor((leads.length - 1) / 2)] : 0;
  const toc = [...deals.map((d) => ({ id: d.slug, label: d.company })), ...(others.length ? [{ id: "others", label: "Other startups" }] : []), { id: "any", label: "Backtest any startup" }];
  return (
    <div>
      <DocHead
        label="Backtest"
        title="We'd Have Found It First"
        lede="For each of Courtside's own deals, Scout checks when it would have surfaced the company, from Form D filings, Hacker News, the App Store, news and domain records. A signal counts only when the company is the headline's subject, inside the thesis, and would pass today's scoring."
        slackText="Backtest: Scout would have flagged these Courtside deals before they were announced."
      />
      <div className="doc">
        <div className="main">
          <div className="res">
            {deals.map((b) => (
              <article key={b.slug} id={b.slug} className={"card2 " + (b.verdict === "win" ? "win" : "none")}>
                <div className="ch">
                  {b.domain ? <img src={favicon(b.domain)} alt="" width={34} height={34} /> : <span />}
                  <div>
                    <h3>
                      <a href={`https://${b.domain}`} target="_blank" rel="noopener noreferrer" title={`Opens ${b.domain} in a new window`}>
                        {b.company}
                      </a>
                    </h3>
                    <div className="ann">
                      Announced {fmtDate(b.announceDate)} ·{" "}
                      <a href={b.announceUrl || "#"} target="_blank" rel="noopener noreferrer" title="Opens Courtside's post in a new window">
                        {b.announceTitle || `Why We Invested: ${b.company}`}
                      </a>
                      {b.verified ? " · Hand-verified" : ""}
                    </div>
                  </div>
                  <Vote k={`backtest:${b.slug}`} row upTitle="Convincing" downTitle="Not convincing" />
                </div>
                {b.verdict === "win" ? (
                  <p className="verdict">
                    Would have flagged on {fmtDate(b.flaggedOn)} through {b.signal?.toLowerCase()}, <em>{b.leadDays} days</em> before the announcement.
                  </p>
                ) : (
                  <p className="verdict n">No earlier public signal found.</p>
                )}
                {b.evidence.length > 0 && <EvidenceRows rows={b.evidence} />}
              </article>
            ))}
          </div>
          {others.length > 0 && (
            <section id="others">
              <h2>Other Startups, Backtested on Request</h2>
              <div className="res">
                {others.map((b) => (
                  <article key={b.slug} className={"card2 " + (b.verdict === "win" ? "win" : "none")}>
                    <div className="ch">
                      {b.domain ? <img src={favicon(b.domain)} alt="" width={34} height={34} /> : <span />}
                      <div>
                        <h3>{b.company}</h3>
                        <div className="ann">
                          Announced {fmtDate(b.announceDate)}
                          {b.announceUrl && (
                            <>
                              {" "}
                              ·{" "}
                              <a href={b.announceUrl} target="_blank" rel="noopener noreferrer" title="Opens the announcement in a new window">
                                the announcement
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                      <span />
                    </div>
                    {b.verdict === "win" ? (
                      <p className="verdict">
                        Would have flagged on {fmtDate(b.flaggedOn)} through {b.signal?.toLowerCase()}, <em>{b.leadDays} days</em> before the announcement.
                      </p>
                    ) : (
                      <p className="verdict n">No earlier public signal found.</p>
                    )}
                    {b.evidence.length > 0 && <EvidenceRows rows={b.evidence} />}
                  </article>
                ))}
              </div>
            </section>
          )}
          <BacktestAny />
        </div>
        <aside className="rail">
          <div className="stick">
            <div>
              <p className="kicker">On This Page</p>
              <Toc items={toc} />
            </div>
            <div>
              <p className="kicker">Scorecard</p>
              <div className="score">
                {median > 0 && (
                  <div>
                    <b>{median} d</b>
                    <span>Median days early</span>
                  </div>
                )}
                {leads.length > 0 && (
                  <div>
                    <b>{leads[leads.length - 1]} d</b>
                    <span>Longest lead</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
