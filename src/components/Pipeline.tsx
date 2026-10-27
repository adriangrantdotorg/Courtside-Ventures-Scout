"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { List, Columns3, Search } from "lucide-react";
import { Vote, Signals, StatusPill, partOf } from "./cards";
import { Row } from "./V2";
import { BUCKETS } from "@/lib/v2";
import { useUI, ClearX } from "./ui";
import { Rich } from "./Rich";
import { postJSON } from "@/lib/client";
import { STATUSES, STATUS_LABEL, favicon } from "@/lib/format";
import type { CompanyCard } from "@/lib/queries";

const AREAS = ["health", "sports", "media", "gaming", "lifestyle"];
const AREA_NAME: Record<string, string> = { health: "Health", sports: "Sports", media: "Media", gaming: "Gaming", lifestyle: "Lifestyle" };
// V2 (10-26-26): one row of menus. Funds Raised replaced Stage, Category replaced Status and the area chips.
export type Filters = { q: string; area: string; bucket: string; signal: string; score: string; seen: string; rating: string };
const EMPTY: Filters = { q: "", area: "", bucket: "", signal: "", score: "", seen: "", rating: "" };
const PAGE = 20;
const DAY = 86400000;

/** Does a card pass every filter? One predicate for the list and for the menus' options. */
export function matches(c: CompanyCard, f: Filters, now: number): boolean {
  const q = f.q.trim().toLowerCase();
  if (q && !`${c.name} ${c.domain || ""} ${c.descSegs.map((s) => (typeof s === "string" ? s : s.t)).join("")}`.toLowerCase().includes(q)) return false;
  if (f.bucket !== "" && String(c.bucket) !== f.bucket) return false;
  if (f.area && c.thesisArea !== f.area) return false;
  if (f.signal && !c.signals.some((s) => s.type === f.signal)) return false;
  if (f.score && c.score < Number(f.score)) return false;
  if (f.seen && now) {
    const age = now - new Date(c.firstSeen).getTime();
    if (f.seen === "today" && age > DAY) return false;
    if (f.seen === "week" && age > 7 * DAY) return false;
    if (f.seen === "month" && age > 30 * DAY) return false;
  }
  if (f.rating === "up" && c.votes <= 0) return false;
  if (f.rating === "down" && c.votes >= 0) return false;
  return true;
}

function Sel({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return (
    <label className={"fsel" + (value ? " on" : "")}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">All</option>
        {opts.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PipelineView({ cards, threshold }: { cards: CompanyCard[]; threshold: number }) {
  const ui = useUI();
  const params = useSearchParams();
  const [view, setView] = useState<"list" | "board">("list");
  const [f, setF] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState(cards);
  const [now, setNow] = useState(0);
  useEffect(() => setItems(cards), [cards]);
  useEffect(() => {
    setNow(Date.now());
    // Filters come only from the URL (10-14-26: a saved search came back on a plain nav click, "that should not be the case")
    const fromUrl: Partial<Filters> = {};
    if (params.get("q")) fromUrl.q = params.get("q")!;
    if (params.get("min")) fromUrl.score = params.get("min")!;
    if (params.get("seen")) fromUrl.seen = params.get("seen")!;
    if (params.get("area")) fromUrl.area = params.get("area")!;
    setF({ ...EMPTY, ...fromUrl });
    setView(params.get("view") === "board" ? "board" : "list");
  }, [params]);
  const set = (k: keyof Filters) => (v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setPage(0);
  };

  const shown = useMemo(() => items.filter((c) => matches(c, f, now)), [items, f, now]);
  // A dropdown option that would show nothing is not offered (Adrian, 10-14-26); the chosen one always stays.
  const live = (k: keyof Filters, opts: [string, string][]) => opts.filter(([v]) => v === f[k] || items.some((c) => matches(c, { ...f, [k]: v }, now)));
  const active = Object.values(f).some(Boolean);
  const newWeek = items.filter((c) => c.isNew).length;

  async function move(c: CompanyCard, status: string) {
    if (c.status === status) return;
    if (status === "passed") {
      const ok = await ui.confirm({
        title: `Pass on ${c.name}?`,
        facts: [
          ["Company", `${c.name} · ${c.area} · ${c.score}% thesis fit`],
          ["Moves to", "Passed, at the end of the Pipeline and off Today"],
          ["Keeps", "its signals, score history, the team's notes and votes"],
        ],
        consequence: "Everyone sees this change. It lands in the change log with Undo, and the Pipeline's Passed column keeps the card.",
        verb: "Pass",
        danger: true,
      });
      if (!ok) return;
    }
    const prev = c.status;
    setItems((xs) => xs.map((x) => (x.id === c.id ? { ...x, status } : x)));
    const r = await ui.undoable("Move", postJSON<{ logId: number }>("/api/status", { id: c.id, status }), async (r) => {
      setItems((xs) => xs.map((x) => (x.id === c.id ? { ...x, status: prev } : x)));
      await postJSON("/api/undo", { id: r.data!.logId });
    });
    if (!r.ok) {
      setItems((xs) => xs.map((x) => (x.id === c.id ? { ...x, status: prev } : x)));
      ui.error(`${c.name} didn't move`, r.error || "The server did not answer.");
      return;
    }
    ui.toast(`${c.name} Moved to ${STATUS_LABEL[status]}`);
  }

  return (
    <>
      <div className="ph">
        <h1>Pipeline</h1>
        <span className="count">
          {items.length} startups inside the thesis{newWeek ? ` · ${newWeek} new this week` : ""} · sorted by thesis fit
        </span>
        <div className="views" role="group" aria-label="View">
          <button aria-pressed={view === "list"} onClick={() => setView("list")} title="Show the Pipeline as a ranked list">
            <List className="ico" />
            List
          </button>
          <button aria-pressed={view === "board"} onClick={() => setView("board")} title="Show the Pipeline as a board by status; drag cards between columns">
            <Columns3 className="ico" />
            Board
          </button>
        </div>
      </div>
      <div className="filters x-pfilters">
        <label className="fsearch">
          <Search className="ico" />
          <input
            data-search
            value={f.q}
            onChange={(e) => set("q")(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (f.q ? set("q")("") : (e.target as HTMLInputElement).blur())}
            placeholder="Search the Pipeline"
            aria-label="Search the Pipeline"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <ClearX show={!!f.q} onClear={() => set("q")("")} />
        </label>
        <Sel label="Funds Raised" value={f.bucket} onChange={set("bucket")} opts={live("bucket", BUCKETS.map((b, i) => [String(i), b] as [string, string]))} />
        <Sel label="Category" value={f.area} onChange={set("area")} opts={live("area", AREAS.map((a) => [a, AREA_NAME[a]] as [string, string]))} />
        <Sel label="Fit" value={f.score} onChange={set("score")} opts={live("score", [[String(threshold), `Worth a Look (${threshold}%+)`], ["50", "50%+"], ["40", "40%+"], ["30", "30%+"]])} />
        <Sel label="Signal" value={f.signal} onChange={set("signal")} opts={live("signal", [["formd", "Form D"], ["formc", "Form C"], ["yc", "Y Combinator"], ["hn", "Show HN"], ["producthunt", "Product Hunt"], ["appstore", "App Store"], ["news", "News"]])} />
        <Sel label="Seen" value={f.seen} onChange={set("seen")} opts={live("seen", [["today", "Today"], ["week", "This Week"], ["month", "This Month"]])} />
        <Sel label="Rating" value={f.rating} onChange={set("rating")} opts={live("rating", [["up", "Voted Up"], ["down", "Voted Down"]])} />
        <button className="fclear" disabled={!active} onClick={() => setF(EMPTY)} title="Clear every filter">
          Clear Filters
        </button>
      </div>
      <div className="rule" />
      {view === "list" ? (
        <>
          <div className="x-rows" id="prows">
            {shown.slice(page * PAGE, page * PAGE + PAGE).map((c) => (
              <Row key={c.id} c={c} rank={items.indexOf(c) + 1} />
            ))}
            {!shown.length && <p className="empty">No company matches these filters. Clear Filters shows all {items.length}.</p>}
          </div>
          {shown.length > PAGE && (
            <div className="pager">
              <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)} title="Previous page">
                Previous
              </button>
              <span>
                {page * PAGE + 1}–{Math.min(shown.length, page * PAGE + PAGE)} of {shown.length}
              </span>
              <button className="btn" disabled={(page + 1) * PAGE >= shown.length} onClick={() => setPage(page + 1)} title="Next page">
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <Board cards={shown} move={move} />
      )}
    </>
  );
}

function Board({ cards, move }: { cards: CompanyCard[]; move: (c: CompanyCard, s: string) => void }) {
  const [over, setOver] = useState<string | null>(null);
  const [lifted, setLifted] = useState<number | null>(null);
  const drag = useRef<number | null>(null);
  const cols = STATUSES.map((s) => ({ s, list: cards.filter((c) => c.status === s) }));
  function onKey(e: React.KeyboardEvent, c: CompanyCard) {
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      if (lifted === c.id) setLifted(null);
      else setLifted(c.id);
      return;
    }
    if (lifted === c.id && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      e.preventDefault();
      const i = STATUSES.indexOf(c.status as (typeof STATUSES)[number]);
      const j = e.key === "ArrowRight" ? Math.min(3, i + 1) : Math.max(0, i - 1);
      if (j !== i) move(c, STATUSES[j]);
      setTimeout(() => document.querySelector<HTMLElement>(`[data-mini="${c.id}"]`)?.focus(), 50);
    }
    if (e.key === "Escape") setLifted(null);
  }
  return (
    <div className="board">
      {cols.map(({ s, list }) => (
        <div
          key={s}
          className={"bcol" + (over === s ? " over" : "")}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(s);
          }}
          onDragLeave={() => setOver(null)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(null);
            const c = cards.find((x) => x.id === drag.current);
            if (c) move(c, s);
          }}
          data-col={s}
        >
          <div className={"col-h " + s}>
            {STATUS_LABEL[s]} <b>{list.length}</b>
          </div>
          {list.map((c) => (
            <div
              key={c.id}
              className={"mini" + (lifted === c.id ? " lifted" : "")}
              draggable
              tabIndex={0}
              data-mini={c.id}
              data-item
              aria-label={`${c.name}, ${STATUS_LABEL[c.status]}. Space picks it up; arrows move it.`}
              onDragStart={() => (drag.current = c.id)}
              onKeyDown={(e) => onKey(e, c)}
            >
              <div className="top2">
                {c.domain && (
                  <span className="clogo" style={{ width: 26, height: 26 }}>
                    <img src={favicon(c.domain)} alt="" width={16} height={16} />
                  </span>
                )}
                <span className="nm">
                  <Link href={`/company/${c.id}`} data-act="open" title={`Open ${c.name} in Scout`}>
                    {c.name}
                  </Link>
                </span>
                <span className="sc">
                  {c.score}
                  <small>%</small>
                </span>
              </div>
              {c.whySegs.length > 0 && (
                <p className="why">
                  <Rich segs={c.whySegs} />
                </p>
              )}
              <div className="facts">
                <span>
                  Funds Raised <b>{c.funds.text}</b>
                </span>
              </div>
              <div className="foot2">
                <Signals signals={c.signals.slice(0, 3)} />
                <Vote k={`company:${c.id}`} initial={c.votes} row name={c.name} />
              </div>
              <div className="stbtns" role="group" aria-label="Move to">
                {STATUSES.filter((x) => x !== c.status).map((x) => (
                  <button key={x} onClick={() => move(c, x)} title={`Move ${c.name} to ${STATUS_LABEL[x]}`}>
                    {STATUS_LABEL[x]}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!list.length && <div className="empty">Drag a card here</div>}
        </div>
      ))}
    </div>
  );
}

export { StatusPill, partOf };
