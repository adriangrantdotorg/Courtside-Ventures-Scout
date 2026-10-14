"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ClearX } from "./ui";
import { Vote } from "./cards";
import { Ago } from "./Live";
import { favicon, fmtDate } from "@/lib/format";
import type { SponsorCard } from "@/lib/queries";

const FIT: Record<string, string> = { thesis: "Inside Courtside's thesis", startup: "Startup outside the thesis", established: "Established brand" };

export function SponsorsView({ cards }: { cards: SponsorCard[] }) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState("");
  const [fit, setFit] = useState("");
  const [seen, setSeen] = useState("");
  const shows = useMemo(() => [...new Set(cards.flatMap((c) => c.shows))].sort(), [cards]);
  const [now] = useState(() => Date.now());
  const list = cards.filter((c) => {
    if (q && !c.brand.toLowerCase().includes(q.toLowerCase())) return false;
    if (show && !c.shows.includes(show)) return false;
    if (fit && c.fitTag !== fit) return false;
    if (seen && c.firstSeen && now - new Date(c.firstSeen).getTime() > Number(seen) * 86400000) return false;
    return true;
  });
  return (
    <>
      <div className="filters">
        <div className="frow">
        <label className="fsearch">
          <Search className="ico" />
          <input data-search value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setQ("")} placeholder="Search brands" aria-label="Search brands" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
          <ClearX show={!!q} onClear={() => setQ("")} />
        </label>
        <button className="fclear" disabled={!q && !show && !fit && !seen} onClick={() => (setQ(""), setShow(""), setFit(""), setSeen(""))} title="Clear every filter">
          Clear Filters
        </button>
        </div>
        <div className="frow sels">
        <label className={"fsel" + (show ? " on" : "")}>
          Show
          <select value={show} onChange={(e) => setShow(e.target.value)} aria-label="Show">
            <option value="">All</option>
            {shows.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={"fsel" + (fit ? " on" : "")}>
          Fit
          <select value={fit} onChange={(e) => setFit(e.target.value)} aria-label="Fit tag">
            <option value="">All</option>
            {Object.entries(FIT).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className={"fsel" + (seen ? " on" : "")}>
          First Seen
          <select value={seen} onChange={(e) => setSeen(e.target.value)} aria-label="First seen">
            <option value="">All</option>
            <option value="7">This week</option>
            <option value="30">This month</option>
            <option value="90">Last 90 days</option>
          </select>
        </label>
        </div>
      </div>
      <div className="rule" />
      <div className="list">
        {list.map((c) => (
          <article className="rowcard" key={c.id} id={c.key} data-item>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                {c.domain ? <img src={favicon(c.domain)} alt="" width={28} height={28} style={{ borderRadius: 7, background: "#fff" }} /> : <span className="lmark s28" aria-hidden="true">{c.brand.trim().charAt(0).toUpperCase()}</span>}
                <h3 style={{ margin: 0 }}>
                  {c.site ? (
                    <a href={c.site} target="_blank" rel="noopener noreferrer" title={`Opens ${c.domain} in a new window`} data-act="source">
                      {c.brand}
                    </a>
                  ) : (
                    c.brand
                  )}
                </h3>
                {c.hot && <span className="tag gold">🔥 New on several shows</span>}
              </div>
              {c.whatItIs && <p style={{ margin: "6px 0" }}>{c.whatItIs}</p>}
              <div className="meta">
                <span className={"tag" + (c.fitTag === "thesis" ? " green" : "")}>{FIT[c.fitTag] || c.fitTag}</span>
                <span className={c.fresh ? "" : ""} style={c.fresh ? { color: "var(--green)" } : undefined}>
                  {c.stamp}
                </span>
                <span>
                  First seen <b>{fmtDate(c.firstSeen)}</b>
                </span>
                <span>
                  <b>{c.seen90}</b> times in 90 days
                </span>
                {c.lastSeen && <Ago date={c.lastSeen} prefix="last " ch={13} />}
              </div>
              <p style={{ fontSize: 14.5, margin: "8px 0 4px" }}>Shows: {c.shows.join(", ")}</p>
              <ul style={{ margin: "4px 0", paddingLeft: 18, fontSize: 14 }}>
                {c.sightings.slice(0, 4).map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" title={`Opens the ${s.show} episode or video in a new window`}>
                      {s.show}
                    </a>{" "}
                    <span className="mono" style={{ color: "var(--text-3)" }}>{fmtDate(s.date)}</span>
                    {s.evidence && <span style={{ color: "var(--text-2)" }}> · &ldquo;{s.evidence.slice(0, 120)}&rdquo;</span>}
                  </li>
                ))}
              </ul>
            </div>
            <Vote k={`sponsor:${c.id}`} initial={c.votes} name={c.brand} upTitle="Worth watching" downTitle="Not useful" />
          </article>
        ))}
        {!list.length && <p className="empty">No brand matches these filters.</p>}
      </div>
    </>
  );
}
