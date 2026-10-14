import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { companyById } from "@/lib/queries";
import { getWeights } from "@/lib/settings";
import { aiAvailable } from "@/lib/ai";
import { Gauge, Vote, Actions, Facts, StatusPill, LockChip } from "@/components/cards";
import { sigLabel } from "@/lib/labels";
import { CompanyNotes, MemoPanel } from "@/components/company-bits";
import { Ago } from "@/components/Live";
import { Rich } from "@/components/Rich";
import { favicon, fmtDate, fmtExact, areaLabel, stageLabel, STATUS_LABEL } from "@/lib/format";
import { cleanCopy } from "@/lib/copy";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const d = await companyById(Number(id)).catch(() => null);
  return { title: d?.card.name || "Company" };
}

const PARTS: [string, string][] = [
  ["thesis", "Thesis fit"],
  ["stage", "Stage and check"],
  ["signal", "Signal strength"],
  ["culture", "Culture"],
  ["team", "Team"],
  ["geo", "Geography"],
];

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await companyById(Number(id));
  if (!d) notFound();
  const [w, ai] = await Promise.all([getWeights(), aiAvailable()]);
  const c = d.card;
  const max: Record<string, number> = { thesis: w.thesis, stage: w.stage, signal: w.signal, culture: w.culture, team: w.team, geo: w.geo };
  const b = c.breakdown;
  const val = (k: string) => (k === "thesis" ? (b.thesis ?? b.laneFit ?? 0) : (b[k] ?? 0));
  const low = PARTS.filter(([k]) => val(k) / (max[k] || 1) < 0.35).map(([, l]) => l.toLowerCase());
  return (
    <div>
      <nav className="crumb" aria-label="Breadcrumb">
        <Link href="/pipeline" title="Open the Pipeline">
          Pipeline
        </Link>
        <span>›</span>
        <span>{c.name}</span>
      </nav>
      <header className="dh" data-item>
        <Gauge score={c.score} breakdown={c.breakdown} />
        <div className="dh-main" style={{ minWidth: 0 }}>
          <div className="lane">
            {c.domain && (
              <span className="clogo">
                <img src={favicon(c.domain)} alt="" width={18} height={18} />
              </span>
            )}
            <span>#{c.rank} ·</span>
            {c.area && <span>{c.area} ·</span>}
            {c.domain && (
              <a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer" title={`Opens ${c.domain} in a new window`}>
                {c.domain}
              </a>
            )}
            <StatusPill s={c.status} />
          </div>
          <h1>{c.name}</h1>
          {c.descSegs.length > 0 && (
            <p className="cdesc">
              <Rich segs={c.descSegs} />{" "}
              {c.descSource && (
                <span className="per">
                  per{" "}
                  <a href={c.descSource.url} target="_blank" rel="noopener noreferrer" title={`Opens ${c.descSource.label} in a new window`}>
                    {c.descSource.label}
                  </a>
                </span>
              )}
            </p>
          )}
          {c.whySegs.length > 0 && (
            <div className="why">
              <Rich segs={c.whySegs} />
            </div>
          )}
          <div className="facts" style={{ marginTop: 8 }}>
            <Facts c={c} />
            <span>
              First Seen <b>{fmtDate(c.firstSeen)}</b>
            </span>
          </div>
          <div className="locked">
            <LockChip door="funding">Funding history</LockChip>
            <LockChip door="mutuals">Mutual connections</LockChip>
          </div>
        </div>
        <Vote k={`company:${c.id}`} initial={c.votes} name={c.name} />
        <Actions c={c} />
      </header>
      <div className="rule" />
      <div className="dbody">
        <div className="dcol">
          <section className="sec" aria-label="Signals">
            <div className="h">
              <h2>Signals</h2>
              <span className="note-h">Newest first</span>
            </div>
            <div className="tl">
              {c.signals.map((s) => (
                <div className="tli" key={s.id}>
                  <div className="when">
                    <Ago date={s.date} ch={7} />
                    <span title={fmtExact(s.date)}>{fmtDate(s.date)}</span>
                    <a className="src2" href={s.url} target="_blank" rel="noopener noreferrer" title={`Opens ${s.domain} in a new window`}>
                      <img src={favicon(s.domain)} alt="" width={14} height={14} />
                      {sigLabel(s)}
                    </a>
                  </div>
                  <div className="what">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" title="Opens the source in a new window">
                      {s.title}
                    </a>
                  </div>
                </div>
              ))}
              <div className="tli own">
                <div className="when">
                  <Ago date={c.firstSeen} ch={7} />
                  <span>{fmtDate(c.firstSeen)}</span>
                </div>
                <div className="what">Added to the Pipeline by Scout</div>
              </div>
            </div>
          </section>
          <section className="sec" aria-label={`Why ${c.score}%`}>
            <div className="h">
              <h2>Why {c.score}%</h2>
              <Link className="more" href="/settings?s=scoring" title="Open Settings › Scoring">
                How Scout Scores
              </Link>
            </div>
            <div className="bars">
              {PARTS.map(([k, l]) => (
                <div className="bar" key={k}>
                  <span className="lbl">{l}</span>
                  <span className="tr">
                    <i style={{ ["--w" as string]: `${Math.round((val(k) / (max[k] || 1)) * 100)}%` }} />
                  </span>
                  <span className="n">
                    {val(k)}
                    <small>/{max[k]}</small>
                  </span>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 12, fontSize: 15, color: "var(--text-2)" }}>
              {(b.learned || 0) !== 0 && <>Votes moved it {b.learned > 0 ? "up" : "down"} {Math.abs(b.learned)} points. </>}
              {(b.penalties || 0) !== 0 && <>Penalties took {Math.abs(b.penalties)} points ({c.check.tone === "warn" ? "past Courtside's stage" : "portfolio conflict or scale"}). </>}
              {low.length ? `Low on ${low.join(" and ")}: it rises as more independent signals arrive, as creators and shows mention it, and as founders show up in filings.` : "Strong across the board."}
            </p>
          </section>
          {c.portfolio && (
            <section className="sec" aria-label="Portfolio Check">
              <div className="h">
                <h2>Portfolio Check</h2>
              </div>
              <div className={"pcheck" + (c.portfolio.kind === "competes" ? " red" : "")}>
                <b>{c.portfolio.kind === "competes" ? "Competes" : "Adjacent, possible intro"}</b>
                <span>
                  {c.portfolio.text}.{" "}
                  {c.portfolio.href && (
                    <a href={c.portfolio.href} target="_blank" rel="noopener noreferrer" title="Opens the portfolio company on Courtside's site in a new window">
                      Courtside&apos;s page
                    </a>
                  )}{" "}
                  {cleanCopy(c.portfolio.reason)}.
                </span>
              </div>
            </section>
          )}
          <CompanyNotes companyId={c.id} name={c.name} initial={d.notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt!.toISOString() }))} />
        </div>
        <aside className="dcol">
          <MemoPanel id={c.id} name={c.name} ai={ai} />
          {d.similar.length > 0 && (
            <section className="sec" aria-label="Similar in the Pipeline" style={{ marginTop: 28 }}>
              <div className="h">
                <h2>Similar in the Pipeline</h2>
              </div>
              <div className="sim">
                {d.similar.map((s) => (
                  <Link key={s.id} href={`/company/${s.id}`} title={`Open ${s.name} in Scout`}>
                    {s.domain ? <img src={favicon(s.domain)} alt="" width={26} height={26} /> : <span />}
                    <span>
                      <b>{s.name}</b>
                      <span>{cleanCopy(s.why || "")}</span>
                    </span>
                    <span className="sc">{s.score}%</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {d.nearby.length > 0 && (
            <section className="sec" aria-label="Nearby in the Portfolio">
              <div className="h">
                <h2>Nearby in the Portfolio</h2>
              </div>
              <div className="sim">
                {d.nearby.map((p) => (
                  <a key={p.id} href={p.descriptionUrl || p.site || "#"} target="_blank" rel="noopener noreferrer" title={`Opens ${p.name} on Courtside's site in a new window`}>
                    {p.site ? <img src={favicon(p.site)} alt="" width={26} height={26} /> : <span />}
                    <span>
                      <b>{p.name}</b>
                      <span>{(p.description || "").split(/(?<=\.)\s/)[0]}</span>
                    </span>
                    <span />
                  </a>
                ))}
              </div>
            </section>
          )}
          <section className="sec" aria-label="Record">
            <div className="h">
              <h2>Record</h2>
            </div>
            <dl className="kv">
              <dt>Thesis area</dt>
              <dd>{areaLabel(c.thesisArea) || "Outside the thesis"}</dd>
              <dt>Stage</dt>
              <dd>{stageLabel(c.stage)}</dd>
              <dt>First seen</dt>
              <dd>{fmtDate(c.firstSeen)}</dd>
              <dt>Last signal</dt>
              <dd>{c.lastSignal ? fmtDate(c.lastSignal) : "None yet"}</dd>
              <dt>Status</dt>
              <dd>{STATUS_LABEL[c.status]}</dd>
              <dt>Tracked by</dt>
              <dd>{c.tracked ? "The team (shared)" : "Not tracked"}</dd>
              {c.domain && (
                <>
                  <dt>Website</dt>
                  <dd>
                    <a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer" title={`Opens ${c.domain} in a new window`}>
                      {c.domain}
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
