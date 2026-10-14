"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { ClearX } from "./ui";

/** The List template's head: title, count line, search with its clear control, optional chips. */
export function ListHead({ title, count, lede, children }: { title: string; count: string; lede?: ReactNode; children?: ReactNode }) {
  return (
    <>
      <div className="ph">
        <h1>{title}</h1>
        <span className="count">{count}</span>
      </div>
      {lede && <p className="ph-lede">{lede}</p>}
      {children}
    </>
  );
}

/** Client-side filter over server-rendered rows: rows carry data-filter text and data-area. */
export function RowFilter({ placeholder, areas, target, clear = true }: { placeholder: string; areas?: { key: string; label: string; n: number }[]; target: string; clear?: boolean }) {
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  useEffect(() => {
    const rows = document.querySelectorAll<HTMLElement>(`${target} [data-filter]`);
    const needle = q.trim().toLowerCase();
    rows.forEach((r) => {
      const okQ = !needle || (r.dataset.filter || "").toLowerCase().includes(needle);
      const okA = !area || r.dataset.area === area;
      r.hidden = !(okQ && okA);
    });
  }, [q, area, target]);
  return (
    <>
      <div className="filters">
        <label className="fsearch">
          <Search className="ico" />
          <input
            data-search
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (q ? setQ("") : (e.target as HTMLInputElement).blur())}
            placeholder={placeholder}
            aria-label={placeholder}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <ClearX show={!!q} onClear={() => setQ("")} />
        </label>
        {clear && (
          <button className="fclear" disabled={!q && !area} onClick={() => (setQ(""), setArea(""))} title="Clear every filter">
            Clear Filters
          </button>
        )}
      </div>
      <div className="rule" />
      {areas && areas.length > 0 && (
        <div className="lanes" role="group" aria-label="Thesis area">
          <button className="lane-chip" aria-pressed={!area} onClick={() => setArea("")} title="Every thesis area">
            All <b>{areas.reduce((a, b) => a + b.n, 0)}</b>
          </button>
          {areas
            .filter((a) => a.n > 0)
            .map((a) => (
              <button key={a.key} className="lane-chip" aria-pressed={area === a.key} onClick={() => setArea(area === a.key ? "" : a.key)} title={`Only ${a.label}`}>
                {a.label} <b>{a.n}</b>
              </button>
            ))}
        </div>
      )}
    </>
  );
}
