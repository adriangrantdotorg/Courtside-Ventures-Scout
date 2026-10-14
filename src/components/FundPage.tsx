import { Phase2Link } from "./Phase2Link";
import Link from "next/link";
import { fundFeed } from "@/lib/queries";
import { FundItemTable } from "./rows";
import { RowFilter } from "./ListHead";
import { LockChip } from "./cards";
import { AREA_LABEL, fmtDate, slugify } from "@/lib/format";

export async function FundPage({ kind }: { kind: "neighborhood" | "synergistic" }) {
  const { funds, items } = await fundFeed(kind, 120);
  const areas = Object.entries(AREA_LABEL).map(([key, label]) => ({ key, label, n: items.filter((i) => i.thesisArea === key).length }));
  const nb = kind === "neighborhood";
  const sorted = [...funds].sort((a, b) => (b.lastSharedDate || "").localeCompare(a.lastSharedDate || "") || a.name.localeCompare(b.name));
  return (
    <div>
      <div className="ph">
        <h1>{nb ? "Neighborhood" : "Synergistic Funders"}</h1>
        <span className="count">
          {funds.length} funds · {items.length} recent items
        </span>
      </div>
      <p className="ph-lede">
        {nb ? (
          "Funds that have backed a company alongside Courtside, and what they just backed. Specialist funds show every deal; broad funds only deals inside Courtside's thesis. Funds from the most recent shared deal come first."
        ) : (
          <>
            Funds with a thesis like Courtside&apos;s that aren&apos;t co-investors yet. Once one co-invests, it moves to the{" "}
            <Link href="/neighborhood" title="Open the Neighborhood">
              Neighborhood
            </Link>
            .
          </>
        )}
      </p>
      <RowFilter placeholder={nb ? "Search co-investor deals" : "Search synergistic funders"} areas={areas} target="#fund-feed" clear={false} />
      <div className="list" id="fund-feed">
        <FundItemTable items={items} />
        {!items.length && <p className="empty">No new items from these funds in the last two weeks. The fund watch runs every morning.</p>}
      </div>
      <section className="list" aria-label="The funds">
        <div className="h">
          <h2>{nb ? "Co-Investors" : "The Funds"}</h2>
          {!nb && <LockChip door="pitchbook">PitchBook, X and LinkedIn</LockChip>}
        </div>
        {!nb && <p className="explain">PitchBook, X and LinkedIn are links only in this prototype. Reading them is <Phase2Link />, through the firm&apos;s accounts.</p>}
        <div className="brands wide4">
          {sorted.map((f) => (
            <div className="tile" key={f.id} id={f.slug || slugify(f.name)}>
              <span />
              <span>
                <b>{f.site ? <a href={f.site} target="_blank" rel="noopener noreferrer" title={`Opens ${f.name} in a new window`}>{f.name}</a> : f.name}</b>
                <small>
                  {f.focus === "specialist" ? "Specialist" : "Broad"}
                  {f.thesisArea ? ` · ${AREA_LABEL[f.thesisArea]}` : ""}
                </small>
                {f.shared.map((s, k) => (
                  <span key={k}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" title="Opens the round's source in a new window">
                      {s.company}
                    </a>{" "}
                    {s.round ? `· ${s.round}` : ""} {s.date ? `· ${fmtDate(s.date)}` : ""}
                  </span>
                ))}
                {f.note && <span>{f.note}</span>}
                {/creator fund/i.test(f.name) && (
                  <span>
                    <a href="https://pitchbook.com/profiles/fund/26290-90F" target="_blank" rel="noopener noreferrer" title="Opens PitchBook in a new window">PitchBook</a> ·{" "}
                    <a href="https://x.com/mmlightcap" target="_blank" rel="noopener noreferrer" title="Opens Megan Lightcap on X in a new window">Megan on X</a> ·{" "}
                    <a href="https://www.linkedin.com/in/megan-lightcap-513ab96b/" target="_blank" rel="noopener noreferrer" title="Opens Megan Lightcap on LinkedIn in a new window">Megan on LinkedIn</a>
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
