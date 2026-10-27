import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { companyById } from "@/lib/queries";
import { getWeights } from "@/lib/settings";
import { aiAvailable } from "@/lib/ai";
import { CompanyNotes, MemoPanel } from "@/components/company-bits";
import { DealSheet, FitRing, Logo } from "@/components/V2";
import { favicon, fmtDate, areaLabel, STAGE_LABEL, STATUS_LABEL } from "@/lib/format";
import { moneyRange, CAP } from "@/lib/v2";
import { cleanCopy } from "@/lib/copy";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const d = await companyById(Number(id)).catch(() => null);
  return { title: d?.card.name || "Company" };
}

const PARTS: [string, string][] = [
  ["thesis", "Thesis Fit"],
  ["stage", "Stage and Check"],
  ["signal", "Signal Strength"],
  ["culture", "Culture"],
  ["team", "Team"],
  ["geo", "Geography"],
];

/** A company page, V2 (10-26-26): the Deal Sheet. Thesis fit and Funds Raised lead; Visit Website is the one red button. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await companyById(Number(id));
  if (!d) notFound();
  if (d.row.mergedInto) redirect(`/company/${d.row.mergedInto}`); // a duplicate card opens the one it merged into
  const [w, ai] = await Promise.all([getWeights(), aiAvailable()]);
  const c = d.card;
  const max: Record<string, number> = { thesis: w.thesis, stage: w.stage, signal: w.signal, culture: w.culture, team: w.team, geo: w.geo };
  const b = c.breakdown;
  const val = (k: string) => (k === "thesis" ? (b.thesis ?? b.laneFit ?? 0) : (b[k] ?? 0));
  const low = PARTS.filter(([k]) => val(k) / (max[k] || 1) < 0.35).map(([, l]) => l.toLowerCase());
  const hint = [
    (b.learned || 0) !== 0 ? `Votes moved it ${b.learned > 0 ? "up" : "down"} ${Math.abs(b.learned)} points.` : "",
    (b.penalties || 0) !== 0 ? `Penalties took ${Math.abs(b.penalties)} points.` : "",
    low.length ? `Low on ${low.join(" and ")}: it rises as more independent stories arrive, as creators and shows mention it, and as founders show up in filings.` : "Strong across the board.",
  ]
    .filter(Boolean)
    .join(" ");
  const rounds = c.funds.rounds.filter((r) => r.amount || r.stage !== "unknown");
  const investors = rounds.map((r) => r.investors).find(Boolean) || null;
  const why = d.row.notStartup ? d.row.notStartup : c.funds.total && c.funds.total >= CAP ? `It has raised ${c.funds.text}, past Scout's $15M limit` : null;
  return (
    <div>
      <nav className="crumb" aria-label="Breadcrumb">
        <Link href="/pipeline" title="Open the Pipeline">
          Pipeline
        </Link>
        <span>›</span>
        <span>{c.name}</span>
      </nav>
      {why && (
        <p className="x-notrec" role="note">
          <b>Not on Scout&apos;s recommendations.</b> {why}. It stays here for reference{d.row.notStartup ? "; Settings › Hidden Startups can restore it" : ""}.
        </p>
      )}
      <DealSheet c={c} bars={PARTS.map(([k, l]) => [l, val(k), max[k]])} hint={hint} investors={investors} off={!!why} />
      {rounds.length > 0 && (
        <section className="x-rounds" aria-label="Funds Raised History">
          <h2 className="x-h2">Funds Raised History</h2>
          <table>
            <thead>
              <tr>
                <th>Round</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Investors</th>
                <th>Sources</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((r, i) => (
                <tr key={i}>
                  <td className="r-st">{r.stage !== "unknown" ? STAGE_LABEL[r.stage] || r.stage : "Round"}</td>
                  <td className="r-amt">{r.amount ? moneyRange(r.low ?? r.amount, r.amount) : "Not Disclosed"}</td>
                  <td className="r-date">{fmtDate(r.date)}</td>
                  <td>{r.investors || "Not Reported"}</td>
                  <td>
                    {r.sources
                      .filter((s) => s.url)
                      .map((s, j) => (
                        <span key={j}>
                          {j > 0 && " · "}
                          <a href={s.url} target="_blank" rel="noopener noreferrer" title={`Opens ${s.title.slice(0, 80)} in a new window`}>
                            {s.name}
                          </a>
                        </span>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <div className="rule" />
      <div className="dbody">
        <div className="dcol">
          <CompanyNotes companyId={c.id} name={c.name} initial={d.notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt!.toISOString() }))} />
          <MemoPanel id={c.id} name={c.name} ai={ai} />
        </div>
        <aside className="dcol">
          {d.similar.length > 0 && (
            <section className="sec" aria-label="Similar in the Pipeline">
              <div className="h">
                <h2>Similar in the Pipeline</h2>
              </div>
              <div className="x-sim">
                {d.similar.map((s) => (
                  <Link key={s.id} href={`/company/${s.id}`} title={`Open ${s.name} in Scout`}>
                    <Logo src={s.media?.logo || (s.domain ? favicon(s.domain) : null)} name={s.name} cls="x-logo sm" />
                    <span>
                      <b>{s.name}</b>
                      <span>{cleanCopy(s.why || "")}</span>
                    </span>
                    <FitRing fit={s.score} name={s.name} size="sm" />
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
              <div className="x-sim">
                {d.nearby.map((p) => (
                  <a key={p.id} href={p.descriptionUrl || p.site || "#"} target="_blank" rel="noopener noreferrer" title={`Opens ${p.name} on Courtside's site in a new window`}>
                    <Logo src={p.site ? favicon(p.site) : null} name={p.name} cls="x-logo sm" />
                    <span>
                      <b>{p.name}</b>
                      <span>{(p.description || "").split(/(?<=\.)\s/)[0]}</span>
                    </span>
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
              <dt>Area</dt>
              <dd>{areaLabel(c.thesisArea) || "Outside the Thesis"}</dd>
              <dt>Funds Raised</dt>
              <dd>
                {c.funds.text}
                {c.funds.stage ? ` · ${c.funds.stage}` : ""}
                {rounds.length > 1 ? ` · ${rounds.length} Rounds` : ""}
              </dd>
              <dt>Thesis Fit</dt>
              <dd>{c.score}%</dd>
              {c.overlap && (
                <>
                  <dt>Overlaps with</dt>
                  <dd>{c.overlap.with}</dd>
                </>
              )}
              <dt>First seen</dt>
              <dd>{fmtDate(c.firstSeen)}</dd>
              <dt>Last signal</dt>
              <dd>{c.lastSignal ? fmtDate(c.lastSignal) : "None yet"}</dd>
              <dt>Status</dt>
              <dd>{STATUS_LABEL[c.status]}</dd>
              <dt>Tracked by</dt>
              <dd>{c.tracked ? "The team (shared)" : "Not tracked"}</dd>
              <dt>Website</dt>
              <dd>
                {c.site ? (
                  <a href={c.site} target="_blank" rel="noopener noreferrer" title="Opens the official website in a new window">
                    {c.domain}
                  </a>
                ) : (
                  "Not found yet"
                )}
              </dd>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
