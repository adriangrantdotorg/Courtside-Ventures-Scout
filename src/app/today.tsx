import { desc, eq } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { companyCards, homeCounts, lastUpdated } from "@/lib/queries";
import { MUST_SEE_DAYS } from "@/lib/v2";
import { Masthead } from "@/components/Masthead";
import { Hero, Combine, Radar } from "@/components/V2";

/** Today, V2 (10-26-26): only companies. Must See → The Combine → On the Radar, where the filter sits.
 *  Velocity, Sponsor Radar, Culture and the money tables live on their own pages. */
export async function Today() {
  const [counts, updated, cards, refreshAt] = await Promise.all([
    homeCounts(),
    lastUpdated(),
    companyCards("recommend"),
    db().select({ t: S.jobRuns.startedAt }).from(S.jobRuns).where(eq(S.jobRuns.job, "refresh")).orderBy(desc(S.jobRuns.startedAt)).limit(1),
  ]);
  const ranked = cards.filter((c) => c.status !== "passed");
  // Must See: the highest thesis fit among startups with news in the last two weeks
  const fresh = (c: (typeof ranked)[number]) => !!c.lastSignal && Date.now() - new Date(c.lastSignal).getTime() < MUST_SEE_DAYS * 86400000;
  const must = ranked.find(fresh) || ranked[0];
  const radar = ranked.filter((c) => c !== must);

  return (
    <div className="today">
      <Masthead counts={counts} updated={updated} lastRefresh={refreshAt[0]?.t?.toISOString() || null} />
      {must && (
        <section className="x-sec" aria-label="Must See">
          <div className="x-sech">
            <h2 className="x-h2">Must See</h2>
            <span className="x-count">The Highest Thesis-Fit Startup Recently in the News</span>
          </div>
          <Hero c={must} />
        </section>
      )}
      {ranked.length > 0 && <Combine cards={ranked} />}
      {radar.length > 0 && <Radar cards={radar} />}
      {!ranked.length && <p className="empty" style={{ padding: "26px 32px" }}>No startups yet. The first pull fills Today in a few minutes.</p>}
    </div>
  );
}
