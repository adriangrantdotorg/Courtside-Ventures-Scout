import Link from "next/link";
import type { TrendCard, SponsorCard, Overlap } from "@/lib/queries";
import { Vote, LockChip } from "./cards";
import { Ago } from "./Live";
import { SpotlightPill as Pill } from "./client-bits";
import { areaLabel, domainOf, favicon, fmtDate, fmtMoney, slugify, stageLabel } from "@/lib/format";

export const SpotlightPill = Pill;

export function spark(weekly: number[]) {
  const max = Math.max(1, ...weekly);
  return weekly.map((v, i) => `${2 + i * 38.6},${32 - (v / max) * 28}`).join(" ");
}

export function velPill(t: Pick<TrendCard, "delta" | "weeks" | "isNew" | "up">) {
  const sign = t.up ? "▲ +" : "▼ −";
  const n = Math.abs(t.delta);
  return `${sign}${n} mention${n === 1 ? "" : "s"} · ${t.isNew ? "new" : `${t.weeks} wk`}`;
}

export function VelocityItem({ t }: { t: TrendCard }) {
  return (
    <div className="item" data-item>
      <div style={{ minWidth: 0 }}>
        <h4>
          <Link href={`/trends#${t.slug}`} data-act="open" title="Open this trend">
            {t.headline}
          </Link>
        </h4>
        <div className="meta">
          <span className={"vel" + (t.up ? "" : " dn")}>{velPill(t)}</span>
          {t.faces.length > 0 && (
            <span className="faces">
              {t.faces.map((f) => (
                <a key={f.name} href={f.href} target="_blank" rel="noopener noreferrer" title={`${f.name}: opens the source in a new window`}>
                  {f.img ? <img src={f.img} alt={f.name} /> : f.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}
                </a>
              ))}
            </span>
          )}
          {t.lastSeen && <Ago date={t.lastSeen} ch={7} />}
        </div>
      </div>
      <svg className="spark" viewBox="0 0 120 34" aria-label={`Mentions over four weeks: ${t.weekly.join(", ")}`}>
        <polyline className={t.up ? "" : "dn"} points={spark(t.weekly)} />
      </svg>
    </div>
  );
}

export function SponsorTile({ s }: { s: SponsorCard }) {
  return (
    <Link href={`/sponsors#${s.key}`} title={`Open ${s.brand} in Sponsor Radar`}>
      {s.domain ? <img src={favicon(s.domain)} alt="" width={30} height={30} /> : <span className="lmark" aria-hidden="true">{s.brand.trim().charAt(0).toUpperCase()}</span>}
      <span>
        <b>{s.brand}</b>
        <small>
          {s.stamp.includes(" · new on ") ? (
            <>
              {s.stamp.split(" · new on ")[0]} · <em>new on {s.stamp.split(" · new on ")[1]}</em>
            </>
          ) : (
            s.stamp
          )}
        </small>
      </span>
    </Link>
  );
}

const STANCE: Record<string, string> = { recommends: "recommends", likes: "likes", discusses: "discusses", criticizes: "criticizes", sponsors: "sponsored by" };

export function CultureRow({ o, compact }: { o: Overlap; compact?: boolean }) {
  return (
    <div className="rowcard" id={o.slug} data-item>
      <div style={{ minWidth: 0 }}>
        <h3>
          {o.companyId ? (
            <Link href={`/company/${o.companyId}`} data-act="open" title={`Open ${o.entity} in Scout`}>
              {o.entity}
            </Link>
          ) : (
            o.entity
          )}
        </h3>
        <div className="meta">
          <span className={"tag" + (o.kind === "startup" ? " green" : o.kind === "portfolio" ? " gold" : "")}>{o.kind === "startup" ? "Startup inside the thesis" : o.kind === "portfolio" ? "Courtside portfolio" : o.kind === "established" ? "Established brand" : "Brand"}</span>
          <span>
            <b>{o.voices.length}</b> {o.voices.length === 1 ? "creator or show" : "creators and shows"}
          </span>
        </div>
        {o.quotes.slice(0, compact ? 2 : 6).map((q, i) => (
          <blockquote key={i}>
            {q.quote ? `"${q.quote}"` : ""}{" "}
            <a href={q.url} target="_blank" rel="noopener noreferrer" title={`Opens the episode or video from ${q.voice} in a new window`}>
              {q.voice}
            </a>{" "}
            <span className="mono" style={{ fontSize: 13, color: "var(--text-3)" }}>
              {STANCE[q.stance] || q.stance} · {q.date ? fmtDate(q.date) : ""}
            </span>
          </blockquote>
        ))}
        {!compact && (
          <div className="locked">
            <LockChip door="realtime">Real-time</LockChip>
            <Link href={`/pipeline?q=${encodeURIComponent(o.entity)}`} title="Filter the Pipeline to this theme">
              Find startups in this theme
            </Link>
          </div>
        )}
      </div>
      <Vote k={`culture:${o.slug}`} initial={o.votes} upTitle="Worth watching" downTitle="Not useful" name={o.entity} />
    </div>
  );
}

type Filing = { id: number; form: string; issuer: string; amountSold: number | null; amountOffered: number | null; currency: string; firstSale: string | null; filedAt: Date | null; related: string[]; thesisArea: string | null; confidence: number; url: string; beforePress: boolean; companyId: number | null; industry: string | null; votes: number };
export function FilingRow({ f, compact }: { f: Filing; compact?: boolean }) {
  return (
    <div className="rowcard" id={`f${f.id}`} data-item>
      <div style={{ minWidth: 0 }}>
        <h3>
          {f.companyId ? (
            <Link href={`/company/${f.companyId}`} data-act="open" title={`Open ${f.issuer} in Scout`}>
              {f.issuer}
            </Link>
          ) : (
            f.issuer
          )}
        </h3>
        <div className="meta">
          <span className="tag">Form {f.form}</span>
          {f.thesisArea && <span className="tag green">{areaLabel(f.thesisArea)}{f.confidence ? ` · ${Math.round(f.confidence * 100)}%` : ""}</span>}
          {f.beforePress && <span className="tag gold">Before any press</span>}
          {(f.amountSold || f.amountOffered) && (
            <span>
              {f.amountSold ? (
                <>
                  Sold <b>{fmtMoney(f.amountSold, f.currency)}</b>
                </>
              ) : null}
              {f.amountOffered ? (
                <>
                  {f.amountSold ? " of " : "Offering "}
                  <b>{fmtMoney(f.amountOffered, f.currency)}</b>
                </>
              ) : null}
            </span>
          )}
          {f.filedAt && <span>Filed {fmtDate(f.filedAt)}</span>}
          {!compact && f.firstSale && <span>First sale {fmtDate(f.firstSale)}</span>}
        </div>
        {!compact && f.related.length > 0 && <p style={{ marginTop: 6 }}>People named: {f.related.join(", ")}</p>}
        {!compact && f.industry && <p>Industry group: {f.industry}</p>}
        <p>
          <a href={f.url} target="_blank" rel="noopener noreferrer" title="Opens the filing at sec.gov in a new window" data-act="source">
            The filing on SEC EDGAR
          </a>
        </p>
      </div>
      <Vote k={`filing:${f.id}`} initial={f.votes} name={f.issuer} />
    </div>
  );
}

type FundItem = { id: number; kind: string; title: string; url: string; date: Date | null; company: string | null; round: string | null; amount: number | null; currency: string; role: string | null; thesisArea: string | null; possible: boolean; source: string | null; fund: { name: string; slug: string; focus: string; kind: string }; votes: number; inPipeline: boolean; score: number | null; companyId: number | null };
export function FundItemRow({ i, compact }: { i: FundItem; compact?: boolean }) {
  const label = i.kind === "newfund" ? "New fund raised" : i.kind === "said" ? "They said it" : "New deal";
  return (
    <div className="rowcard" data-item>
      <div style={{ minWidth: 0 }}>
        <div className="meta" style={{ marginBottom: 4 }}>
          <span className={"tag" + (i.kind === "newfund" ? " gold" : i.kind === "deal" ? " green" : "")}>{label}</span>
          <Link className="fund-chip" href={`/${i.fund.kind === "neighborhood" ? "neighborhood" : "synergistic-funders"}#${i.fund.slug}`} title={`Open ${i.fund.name}`}>
            {i.fund.name}
          </Link>
          {i.role && <span>{i.role === "lead" ? "Led" : "Participated"}</span>}
          {i.possible && <span className="tag gold">Possible match</span>}
        </div>
        <h3 style={{ fontSize: 17, textTransform: "none", letterSpacing: 0, fontFamily: "Montserrat, sans-serif" }}>
          <a href={i.url} target="_blank" rel="noopener noreferrer" title={`Opens the story${i.source ? ` from ${i.source}` : ""} in a new window`} data-act="source">
            {i.title}
          </a>
        </h3>
        <div className="meta">
          {i.company && i.kind === "deal" && (
            <span>
              Company <b>{i.company}</b>
            </span>
          )}
          {i.round && i.round !== "unknown" && <span>{stageLabel(i.round)}</span>}
          {i.amount ? <b>{fmtMoney(i.amount, i.currency)}</b> : null}
          {i.thesisArea && <span className="tag green">{areaLabel(i.thesisArea)}</span>}
          {i.inPipeline && <span className="tag red">Already in our pipeline{i.score !== null ? ` · ${i.score}%` : ""}</span>}
          {i.source && <span>{i.source}</span>}
          {i.date && <Ago date={i.date} ch={7} />}
        </div>
        {!compact && i.fund.focus && <p style={{ marginTop: 4, fontSize: 13, color: "var(--text-3)" }}>{i.fund.focus === "specialist" ? "Specialist fund: every deal is shown" : "Broad fund: only deals inside Courtside's thesis are shown"}</p>}
      </div>
      <Vote k={`fund_item:${i.id}`} initial={i.votes} name={i.company || i.fund.name} />
    </div>
  );
}

export { domainOf, slugify };


/* ---------- round 3 (10-14-26): tables instead of pill rows ---------- */
/** Filings as a table: Company · Sold · Area and fit · Notes · Source (Adrian's pick B). */
export function FilingTable({ rows, compact }: { rows: Filing[]; compact?: boolean }) {
  const dates = new Set(rows.map((f) => (f.filedAt ? fmtDate(f.filedAt) : "")));
  const oneDate = compact && dates.size === 1 ? [...dates][0] : null;
  return (
    <>
      {oneDate && <p className="explain">Filed {oneDate}, inside the thesis.</p>}
      <table className="t" data-table="filings">
        <thead>
          <tr>
            <th>Company</th>
            <th>Sold</th>
            <th>Area · fit</th>
            {!compact && <th>Notes</th>}
            {!oneDate && <th>Filed</th>}
            {!compact && <th>Source</th>}
            <th aria-label="Votes" />
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.id} id={`f${f.id}`} data-item data-filter={`${f.issuer} ${f.related.join(" ")}`} data-area={f.thesisArea || ""}>
              <td>
                <span className="fund">{f.companyId ? <Link href={`/company/${f.companyId}`} data-act="open" title={`Open ${f.issuer} in Scout`}>{f.issuer}</Link> : f.issuer}</span>
                {!compact && f.related.length > 0 && <span className="sub">People named: {f.related.join(", ")}</span>}
                {compact && (
                  <span className="sub">
                    <a href={f.url} target="_blank" rel="noopener noreferrer" title="Opens the filing at sec.gov in a new window" data-act="source">
                      SEC EDGAR
                    </a>
                  </span>
                )}
              </td>
              <td className="m">
                {f.amountSold ? <b>{fmtMoney(f.amountSold, f.currency)}</b> : "—"}
                {f.amountOffered ? <> of {fmtMoney(f.amountOffered, f.currency)}</> : null}
              </td>
              <td className="m">
                {f.thesisArea ? <span className="ok">{areaLabel(f.thesisArea)}{f.confidence ? ` · ${Math.round(f.confidence * 100)}%` : ""}</span> : "—"}
                {compact && f.beforePress && <span className="sub gold">before any press</span>}
              </td>
              {!compact && (
                <td className="m">
                  {f.beforePress && <span className="gold">before any press</span>}
                  {f.industry && <span className="sub">Industry group: {f.industry}</span>}
                  {f.firstSale && <span className="sub">First sale {fmtDate(f.firstSale)}</span>}
                </td>
              )}
              {!oneDate && <td className="m">{f.filedAt ? fmtDate(f.filedAt) : "—"}</td>}
              {!compact && (
                <td className="m">
                  <a href={f.url} target="_blank" rel="noopener noreferrer" title="Opens the filing at sec.gov in a new window" data-act="source">
                    SEC EDGAR
                  </a>
                </td>
              )}
              <td>
                <Vote k={`filing:${f.id}`} initial={f.votes} name={f.issuer} row />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** Fund items as a table: Fund · Backed · Round · Amount · Area · Source (Adrian's pick C). The home page's compact form folds Round and Amount together and drops Area. */
export function FundItemTable({ items, compact }: { items: FundItem[]; compact?: boolean }) {
  const backed = (i: FundItem) => {
    const name = i.kind === "newfund" ? "New fund raised" : i.kind === "said" ? "A post" : i.company || "—";
    const link = i.companyId ? <Link href={`/company/${i.companyId}`} data-act="open" title={`Open ${i.company} in Scout`}>{name}</Link> : name;
    return (
      <>
        <span className="co">{link}</span>
        {i.inPipeline && (i.companyId ? (
          <span className="sub"><Link href={`/company/${i.companyId}`} title={`Open ${i.company} in the Pipeline`}>In the Pipeline{i.score !== null ? ` · ${i.score}%` : ""}</Link></span>
        ) : (
          <span className="sub">In the Pipeline{i.score !== null ? ` · ${i.score}%` : ""}</span>
        ))}
      </>
    );
  };
  const round = (i: FundItem) => (i.round && i.round !== "unknown" ? stageLabel(i.round) : "");
  const amount = (i: FundItem) => (i.amount ? <b className="ok">{fmtMoney(i.amount, i.currency)}</b> : null);
  return (
    <table className="t" data-table="deals">
      <thead>
        <tr>
          <th>Fund</th>
          <th>Backed</th>
          {compact ? <th>Amount</th> : <><th>Round</th><th>Amount</th><th>Area</th></>}
          <th>Source</th>
          <th aria-label="Votes" />
        </tr>
      </thead>
      <tbody>
        {items.map((i) => (
          <tr key={i.id} id={`fi${i.id}`} data-item data-filter={`${i.title} ${i.fund.name} ${i.company || ""}`} data-area={i.thesisArea || ""}>
            <td>
              <Link className="fund" href={`/${i.fund.kind === "neighborhood" ? "neighborhood" : "synergistic-funders"}#${i.fund.slug}`} title={`Open ${i.fund.name}`}>
                {i.fund.name}
              </Link>
              {i.role === "lead" && <span className="sub">led</span>}
            </td>
            <td>{backed(i)}</td>
            {compact ? (
              <td className="m">
                {amount(i) || "—"}
                {round(i) && <span className="sub">{round(i)}</span>}
              </td>
            ) : (
              <>
                <td className="m">{round(i) || "—"}</td>
                <td className="m">{amount(i) || "—"}</td>
                <td className="m">{i.thesisArea ? areaLabel(i.thesisArea) : "—"}</td>
              </>
            )}
            <td>
              <a href={i.url} target="_blank" rel="noopener noreferrer" title={`Opens the story${i.source ? ` from ${i.source}` : ""} in a new window`} data-act="source">
                {i.title}
              </a>
              <span className="sub">
                {i.source ? `${i.source} · ` : ""}
                {i.date && <Ago date={i.date} ch={7} />}
              </span>
            </td>
            <td>
              <Vote k={`fund_item:${i.id}`} initial={i.votes} name={i.company || i.fund.name} row />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
