"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useUI, ClearX } from "./ui";
import { postJSON } from "@/lib/client";
import { useAdded } from "./Added";

type Hit = { kind: string; id?: number; title: string; sub?: string; href: string };

/** The Add row under the Companies and Trends tabs: type a name, pick a result, it is tracked at once. */
export function AddTracked({ kind, placeholder }: { kind: "company" | "trend"; placeholder: string }) {
  const ui = useUI();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const { add: addItem } = useAdded();
  const listKind = kind === "company" ? "companies" : "trends";
  useEffect(() => {
    if (!q.trim()) return setHits([]);
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal });
        const all = ((await r.json()).hits || []) as Hit[];
        setHits(all.filter((h) => (kind === "company" ? h.kind === "Companies" : h.kind === "Trends") && h.id));
      } catch {
        /* aborted */
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, kind]);
  const [busy, setBusy] = useState(false);
  async function pick(h: Hit) {
    const r = await postJSON("/api/track", { kind, id: h.id, on: true });
    if (!r.ok) return ui.error("Track didn't save", r.error || "The server did not answer.");
    ui.toast(`${h.title.replace(/^Trend: /, "")} Tracked`);
    addItem(listKind, { id: h.id!, title: h.title.replace(/^Trend: /, ""), sub: h.sub });
    setQ("");
    setHits([]);
  }
  /** Add: an exact match is tracked; anything else is created by name and tracked. */
  async function add() {
    const nm = q.trim();
    if (!nm || busy) return;
    const exact = hits.find((h) => h.title.replace(/^Trend: /, "").toLowerCase() === nm.toLowerCase());
    if (exact) return pick(exact);
    setBusy(true);
    const r = await postJSON<{ id: number; name: string }>("/api/track", { kind, name: nm, on: true });
    setBusy(false);
    if (!r.ok) return ui.error(kind === "company" ? "That company wasn't added" : "That trend wasn't added", r.error || "The server did not answer.");
    ui.toast(`${r.data!.name} Tracked`);
    addItem(listKind, { id: r.data!.id, title: r.data!.name });
    setQ("");
    setHits([]);
  }
  return (
    <div className="tabadd">
      <div className="frow">
        <label className="fsearch" style={{ flex: 1 }}>
          <Search className="ico" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => (e.key === "Escape" ? setQ("") : e.key === "Enter" ? (e.preventDefault(), add()) : undefined)}
            placeholder={placeholder}
            aria-label={placeholder}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-search
          />
          <ClearX show={!!q} onClear={() => setQ("")} />
        </label>
        <button className="btn red" disabled={!q.trim() || busy} onClick={add} title={kind === "company" ? "Track this company: a daily check of news, filings and shows (↩)" : "Track this trend: a daily count of mentions (↩)"} data-act="add">
          Add
        </button>
      </div>
      {hits.length > 0 && (
        <div className="addhits" role="listbox">
          {hits.map((h) => (
            <button key={`${h.kind}-${h.id}`} role="option" aria-selected={false} onClick={() => pick(h)} title={`Track ${h.title.replace(/^Trend: /, "")}`}>
              <span>{h.title.replace(/^Trend: /, "")}</span>
              {h.sub && <small>{h.sub}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
