import type { Metadata } from "next";
import { and, desc, gte, inArray } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { cultureOverlaps } from "@/lib/queries";
import { CultureRow } from "@/components/rows";
import { LockChip, Vote } from "@/components/cards";
import { RowFilter } from "@/components/ListHead";
import { Ago } from "@/components/Live";
import { AREA_LABEL, fmtDate, slugify } from "@/lib/format";

export const revalidate = 300;
export const metadata: Metadata = { title: "Culture" };

export default async function Page() {
  const [overlaps, voices] = await Promise.all([cultureOverlaps(30, 60), db().select().from(S.voices).orderBy(S.voices.priority, S.voices.name)]);
  const named = voices.filter((v) => v.kind === "named");
  const sources = voices.filter((v) => v.kind !== "named");
  const namedNews = named.length
    ? await db()
        .select()
        .from(S.feedItems)
        .where(and(inArray(S.feedItems.voice, named.map((n) => n.name)), gte(S.feedItems.date, new Date(Date.now() - 30 * 86400000))))
        .orderBy(desc(S.feedItems.date))
    : [];
  const appearances = named.length ? await db().select().from(S.mentions).where(inArray(S.mentions.entity, named.map((n) => n.name))).orderBy(desc(S.mentions.date)) : [];
  const multi = overlaps.filter((o) => o.voices.length >= 2);
  const areas = Object.entries(AREA_LABEL).map(([key, label]) => ({ key, label, n: overlaps.filter((o) => o.area === key).length }));
  return (
    <div>
      <div className="ph">
        <h1>Culture</h1>
        <span className="count">
          {overlaps.length} brands and startups · {multi.length} named by two or more creators and shows · last 30 days
        </span>
      </div>
      <p className="ph-lede">
        Every day Scout reads each new episode, video and post from the creators and shows, pulls out every company, brand and startup they mention with the sentence it came from, and marks whether they
        recommend, like, discuss, criticize or are sponsored by it. The taste map below ranks where different audiences overlap. It updates once a day; real-time is Phase II work.
      </p>
      <RowFilter placeholder="Search brands and startups" areas={areas} target="#taste" />
      <section className="list" id="taste" aria-label="The taste map">
        <div className="h" style={{ marginTop: 18 }}>
          <h2>The Taste Map</h2>
          <LockChip door="realtime">Real-time</LockChip>
        </div>
        {overlaps.map((o) => (
          <div key={o.slug} data-filter={`${o.entity} ${o.voices.join(" ")}`} data-area={o.area || ""}>
            <CultureRow o={o} />
          </div>
        ))}
      </section>
      <section className="list" aria-label="Tracked by name">
        <div className="h" style={{ marginTop: 18 }}>
          <h2>Tracked by Name</h2>
        </div>
        <p className="explain">
          These influencers live mainly on Instagram, TikTok or Twitch. Reading their own posts takes the firm&apos;s accounts, so that is Phase II work. Today Scout follows them through news mentions by name,
          appearances on the tracked shows and channels, and the brands they&apos;re tied to.
        </p>
        <div className="brands wide4">
          {named.map((v) => {
            const news = namedNews.filter((n) => n.voice === v.name).slice(0, 2);
            const apps = appearances.filter((a) => a.entity === v.name).slice(0, 1);
            return (
              <div className="tile" key={v.id} id={slugify(v.name)} data-item>
                <span />
                <span>
                  <b>{v.name}</b>
                  <small>{v.grp || "Tracked by name"}</small>
                  {news.map((n) => (
                    <span key={n.id} style={{ marginTop: 4 }}>
                      <a href={n.url} target="_blank" rel="noopener noreferrer" title="Opens the story in a new window">
                        {n.title}
                      </a>{" "}
                      <span className="mono" style={{ color: "var(--text-3)" }}>{fmtDate(n.date)}</span>
                    </span>
                  ))}
                  {apps.map((a) => (
                    <span key={a.id} style={{ marginTop: 4 }}>
                      Mentioned on{" "}
                      <a href={a.url} target="_blank" rel="noopener noreferrer" title="Opens the episode or video in a new window">
                        {a.voice}
                      </a>
                    </span>
                  ))}
                  {!news.length && !apps.length && <span style={{ marginTop: 4 }}>No news mentions by name in the last 30 days.</span>}
                  <span style={{ marginTop: 8 }}>
                    <LockChip door="socials">Their posts</LockChip>
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </section>
      <section className="list" aria-label="The creators and shows">
        <div className="h" style={{ marginTop: 18 }}>
          <h2>The Creators and Shows</h2>
          <span className="note-h">{sources.filter((s) => s.status === "active").length} active sources</span>
        </div>
        <p className="explain">A podcast with no new episode in 90 days is not a source and shows here as quiet. Adrian Grant&apos;s own show always stays. Add or remove one in Settings › Creators and Shows.</p>
        <div className="brands wide4">
          {sources.map((v) => (
            <div className="tile" key={v.id} id={slugify(v.name)} data-item>
              {v.image ? <img src={v.image} alt="" width={30} height={30} /> : <span />}
              <span>
                <b>{v.site ? <a href={v.site} target="_blank" rel="noopener noreferrer" title={`Opens ${v.name} in a new window`}>{v.name}</a> : v.name}</b>
                <small>
                  {v.status === "quiet" ? "Quiet: no episode in 90 days" : v.kind === "podcast" ? "Podcast" : "Creator"}
                  {v.lastEpisode ? <> · last <Ago date={v.lastEpisode} ch={8} /></> : null}
                </small>
                <span style={{ marginTop: 6 }}>
                  <Vote k={`voice:${v.id}`} row name={v.name} upTitle="A great source" downTitle="Not useful" />
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
