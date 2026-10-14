"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useUI, ClearX } from "./ui";
import { postJSON } from "@/lib/client";

type Hit = { kind: string; id?: number; title: string; sub?: string; href: string };

/** The Add row under the Companies and Trends tabs: type a name, pick a result, it is tracked at once. */
export function AddTracked({ kind, placeholder }: { kind: "company" | "trend"; placeholder: string }) {
  const ui = useUI();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [added, setAdded] = useState<Hit[]>([]);
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
  async function pick(h: Hit) {
    const r = await postJSON("/api/track", { kind, id: h.id, on: true });
    if (!r.ok) return ui.error("Track didn't save", r.error || "The server did not answer.");
    ui.toast(`${h.title.replace(/^Trend: /, "")} Tracked`);
    setAdded((a) => [h, ...a]);
    setQ("");
    setHits([]);
  }
  return (
    <div className="tabadd">
      <label className="fsearch">
        <Search className="ico" />
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setQ("")} placeholder={placeholder} aria-label={placeholder} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} data-search />
        <ClearX show={!!q} onClear={() => setQ("")} />
      </label>
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
      {added.length > 0 && (
        <p className="mono" style={{ margin: "8px 0 0", fontSize: 13, color: "var(--green)" }}>
          Tracked: {added.map((h) => h.title.replace(/^Trend: /, "")).join(", ")}. It shows in the list after the next check, or on reload.
        </p>
      )}
    </div>
  );
}
