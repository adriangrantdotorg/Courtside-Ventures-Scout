import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { AddPerson } from "@/components/forms";
import { LockChip, Vote } from "@/components/cards";
import { Ago } from "@/components/Live";
import { fmtDate } from "@/lib/format";

export const revalidate = 300;
export const metadata: Metadata = { title: "People" };

const KIND: Record<string, string> = { video: "Video", post: "Post", appearance: "Podcast appearance", news: "In the news" };

export default async function Page() {
  const [people, items] = await Promise.all([db().select().from(S.people).orderBy(S.people.id), db().select().from(S.personItems).orderBy(desc(S.personItems.date)).limit(400)]);
  return (
    <div>
      <div className="ph">
        <h1>People</h1>
        <span className="count">{people.length} people tracked · a daily check of their public posts and appearances</span>
      </div>
      <p className="ph-lede">Their YouTube uploads, podcast appearances, Medium or Substack posts, GitHub activity and news mentions, newest first. &quot;What they&apos;ve been saying&quot; is the list of their newest items; with AI on, it becomes a written summary.</p>
      <div className="rule" style={{ marginTop: 16 }} />
      <div className="list">
        <div style={{ margin: "18px 0" }}>
          <AddPerson />
        </div>
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
                <p style={{ margin: "8px 0 4px", fontWeight: 600 }}>What they&apos;ve been saying</p>
                {mine.length ? (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14.5 }}>
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
                  <p style={{ fontSize: 14.5, color: "var(--text-2)" }}>Nothing public in the last two weeks. The daily check runs every morning.</p>
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
  );
}
