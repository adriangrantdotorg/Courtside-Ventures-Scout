"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Pin, PenLine, Mail, Copy, Download, Plus, Lock, Sparkles, Check } from "lucide-react";
import { useUI, Overlay, Kbd } from "./ui";
import { Ago } from "./Live";
import { Rich } from "./Rich";
import { postJSON, getJSON, download } from "@/lib/client";
import { favicon, STATUS_LABEL } from "@/lib/format";
import type { CompanyCard } from "@/lib/queries";
import { sigLabel } from "@/lib/labels";

/* ---------- votes: live counts and this browser's own votes, batched per page ---------- */
const store = { counts: {} as Record<string, number>, mine: {} as Record<string, number>, v: 0 };
const listeners = new Set<() => void>();
const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
const loaded = new Set<string>();
let inflight: Promise<void> | null = null;
function emit() {
  store.v++;
  listeners.forEach((l) => l());
}
function want(key: string) {
  pending.add(key);
  if (timer) return;
  let done: () => void = () => {};
  inflight = new Promise<void>((res) => (done = res));
  timer = setTimeout(async () => {
    timer = null;
    const keys = [...pending];
    pending.clear();
    const r = await postJSON<{ counts: Record<string, number>; mine: Record<string, number> }>("/api/votes", { keys });
    if (r.ok && r.data) {
      for (const k of keys) {
        store.counts[k] = r.data.counts[k] ?? 0;
        if (r.data.mine[k]) store.mine[k] = r.data.mine[k];
      }
      emit();
    }
    keys.forEach((k) => loaded.add(k));
    done();
  }, 60);
}
function useVoteStore() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => store.v,
    () => 0,
  );
}

const Up = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 3l6 9H2z" />
  </svg>
);
const Down = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 13L2 4h12z" />
  </svg>
);

export function Vote({ k, initial = 0, row, upTitle = "This fits Courtside", downTitle = "Not for Courtside", name }: { k: string; initial?: number; row?: boolean; upTitle?: string; downTitle?: string; name?: string }) {
  useVoteStore();
  const ui = useUI();
  useEffect(() => want(k), [k]);
  const count = store.counts[k] ?? initial;
  const mine = store.mine[k] || 0;
  async function press(v: 1 | -1) {
    if (!loaded.has(k) && inflight) await inflight; // know this browser's own vote before changing it
    const count = store.counts[k] ?? initial;
    const mine = store.mine[k] || 0;
    const before = { c: count, m: mine };
    const next = mine === v ? 0 : v;
    store.mine[k] = next;
    store.counts[k] = count - mine + next;
    emit(); // the number moves the instant the triangle is pressed
    const undo = async () => {
      store.mine[k] = before.m;
      store.counts[k] = before.c;
      emit();
      await postJSON("/api/vote", { key: k, value: before.m });
    };
    const r = await postJSON<{ count: number }>("/api/vote", { key: k, value: next });
    if (!r.ok) {
      store.mine[k] = before.m;
      store.counts[k] = before.c;
      emit();
      ui.error("Your vote didn't save", r.error || "The server did not answer. Try again in a moment.");
      return;
    }
    store.counts[k] = r.data!.count;
    emit();
    ui.pushUndo({ label: "Vote", run: undo });
  }
  return (
    <span className={"votes" + (row ? " row" : "")} data-vote={k}>
      <button data-act="up" aria-pressed={mine === 1} title={upTitle} aria-label={`${upTitle}${name ? `: ${name}` : ""}`} onClick={() => press(1)}>
        <Up />
      </button>
      <span className="n mono" data-testid="vote-count">
        {count}
      </span>
      <button data-act="down" aria-pressed={mine === -1} title={downTitle} aria-label={`${downTitle}${name ? `: ${name}` : ""}`} onClick={() => press(-1)}>
        <Down />
      </button>
    </span>
  );
}

/* ---------- gauge ---------- */
const PARTS: [string, string][] = [
  ["thesis", "Thesis fit"],
  ["stage", "Stage and check"],
  ["signal", "Signal strength"],
  ["culture", "Culture"],
  ["team", "Team"],
  ["geo", "Geography"],
  ["learned", "Learned from votes"],
  ["penalties", "Penalties"],
];
export function partOf(b: Record<string, number>, k: string) {
  return k === "thesis" ? (b.thesis ?? b.laneFit ?? 0) : (b[k] ?? 0);
}

export function Gauge({ score, breakdown }: { score: number; breakdown: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const off = 141.37 * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <button
      ref={ref}
      className="gauge gauge-btn"
      style={{ ["--v" as string]: score }}
      aria-expanded={open}
      title="How Scout scored it"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      <div className="dial">
        <svg viewBox="0 0 110 62">
          <path className="gt" d="M10 56 A45 45 0 0 1 100 56" />
          <path className="gf" d="M10 56 A45 45 0 0 1 100 56" style={{ strokeDashoffset: off }} />
        </svg>
        <span className="needle" />
      </div>
      <b>
        {score}
        <small>%</small>
      </b>
      <em>Thesis Fit</em>
      {open && (
        <span className="breakdown" role="tooltip">
          {PARTS.map(([k, l]) =>
            k === "learned" || k === "penalties" ? (
              partOf(breakdown, k) ? (
                <span key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                  {l}
                  <b>{partOf(breakdown, k) > 0 ? "+" : ""}{partOf(breakdown, k)}</b>
                </span>
              ) : null
            ) : (
              <span key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                {l}
                <b>{partOf(breakdown, k)}</b>
              </span>
            ),
          )}
        </span>
      )}
    </button>
  );
}

/* ---------- signals ---------- */

export function Signals({ signals }: { signals: CompanyCard["signals"] }) {
  const seen = new Set<string>();
  const list = signals.filter((s) => {
    const k = s.type + ":" + (s.type === "news" ? s.source : "");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return (
    <div className="evi">
      {list.map((s) => (
        <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" title={`Opens ${s.title.slice(0, 90)} in a new window`}>
          <img src={favicon(s.domain)} alt="" width={16} height={16} />
          {sigLabel(s)}
        </a>
      ))}
    </div>
  );
}

export function LockChip({ door, children }: { door: string; children: ReactNode }) {
  const ui = useUI();
  return (
    <button className="lock-chip" title="Phase II: built together, if Courtside and Adrian work together" onClick={() => ui.door(door)}>
      <Lock className="ico" style={{ width: 13, height: 13 }} />
      {children}
    </button>
  );
}

export function AiChip() {
  const ui = useUI();
  return (
    <button className="ai-chip" title="AI drafting is optional; see what it adds" onClick={ui.aiCard}>
      <Sparkles className="ico" />
      AI · Unlock
    </button>
  );
}

/* ---------- the six actions ---------- */
function csvRow(c: CompanyCard, notes = "") {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const head = ["Organization", "Domain", "Description", "Thesis area", "Stage", "Score", "Source links", "Notes"];
  const desc = c.descSegs.map((s) => (typeof s === "string" ? s : s.t)).join("");
  const row = [c.name, c.domain || "", desc, c.area, c.stageText, String(c.score), c.signals.map((s) => s.url).join(" "), notes];
  return head.map(esc).join(",") + "\n" + row.map(esc).join(",") + "\n";
}
function crmText(c: CompanyCard) {
  const desc = c.descSegs.map((s) => (typeof s === "string" ? s : s.t)).join("");
  const why = c.whySegs.map((s) => (typeof s === "string" ? s : s.t)).join("");
  return [
    `${c.name}${c.domain ? ` (${c.domain})` : ""}`,
    `Thesis area: ${c.area} · Stage: ${c.stageText} · Thesis fit: ${c.score}%`,
    `What it does: ${desc}`,
    `Why it fits Courtside: ${why}`,
    c.portfolio ? `Portfolio: ${c.portfolio.text} (${c.portfolio.reason})` : "",
    `Sources:`,
    ...c.signals.map((s) => `- ${s.title}: ${s.url}`),
    `Status: ${STATUS_LABEL[c.status]} · Scout: ${location.origin}/company/${c.id}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function useActions(c: CompanyCard) {
  const ui = useUI();
  const [tracked, setTracked] = useState(c.tracked);
  const [noting, setNoting] = useState(false);
  async function track() {
    const next = !tracked;
    setTracked(next);
    const r = await postJSON("/api/track", { kind: "company", id: c.id, on: next });
    if (!r.ok) {
      setTracked(!next);
      ui.error(`Track didn't save for ${c.name}`, r.error || "The server did not answer.");
      return;
    }
    ui.toast(`${c.name} ${next ? "Tracked" : "Untracked"}`);
    ui.pushUndo({
      label: "Track",
      run: async () => {
        setTracked(!next);
        await postJSON("/api/track", { kind: "company", id: c.id, on: !next });
      },
    });
  }
  async function memo() {
    const r = await getJSON<{ markdown: string }>(`/api/memo/${c.id}`);
    if (!r.ok || !r.data) return ui.error("The outline didn't load", r.error || "The server did not answer.");
    try {
      await navigator.clipboard.writeText(r.data.markdown);
      ui.toast("Outline Copied");
    } catch {
      download(`${c.name} investment memo outline.md`, r.data.markdown, "text/markdown");
      ui.toast("Outline Downloaded");
    }
  }
  function email() {
    const why = c.whySegs.map((s) => (typeof s === "string" ? s : s.t)).join("");
    const subject = `Courtside Ventures × ${c.name}`;
    const body = `Hi [first name],\n\nI'm reaching out from Courtside Ventures. We invest at pre-seed through Series A in sports, gaming, lifestyle, health and media, and ${c.name} caught our eye: ${why}\n\nWould you be open to a 20-minute call in the next couple of weeks?\n\nBest,\n[your name]\nCourtside Ventures`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    ui.toast("Email Drafted in Your Mail App");
  }
  async function crm() {
    try {
      await navigator.clipboard.writeText(crmText(c));
      ui.toast("Copied for CRM");
    } catch {
      ui.error("The clipboard was blocked", "Your browser did not allow Scout to copy. Try again, or use Download CSV.");
    }
  }
  function csv() {
    download(`${c.name}.csv`, csvRow(c), "text/csv");
    ui.toast("CSV Downloaded");
  }
  return { tracked, track, memo, email, crm, csv, noting, setNoting };
}

export function NoteDialog({ c, close, onSaved }: { c: { id: number; name: string }; close: () => void; onSaved?: (n: { id: number; body: string; createdAt: string }) => void }) {
  const ui = useUI();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!text.trim() || busy) return;
    setBusy(true);
    const r = await postJSON<{ note: { id: number; body: string; createdAt: string } }>("/api/note", { companyId: c.id, body: text });
    setBusy(false);
    if (!r.ok) return ui.error("The note didn't save", r.error || "The server did not answer.");
    ui.toast("Note Added");
    const id = r.data!.note.id;
    ui.pushUndo({ label: "Note", run: async () => void (await fetch("/api/note", { method: "DELETE", body: JSON.stringify({ id }) })) });
    onSaved?.(r.data!.note);
    close();
  }
  return (
    <Overlay className="dlg" label={`Add a note on ${c.name}`} onClose={close} onSubmit={save} testid="dialog">
      <div className="hd">
        <div className="tile">
          <Plus className="ico" />
        </div>
        <h2>Add a Note on {c.name}</h2>
      </div>
      <textarea className="sinput" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Everyone sees this note" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
      <p>Everyone who opens Scout sees team notes. Each note lands in the change log with Undo.</p>
      <div className="acts2">
        <button className="btn" onClick={close} title="Close without saving (Esc)">
          Cancel<Kbd>Esc</Kbd>
        </button>
        <button className="btn red" onClick={save} disabled={!text.trim() || busy} title="Save the note for everyone (⌘↩)">
          Save Note<Kbd>⌘↩</Kbd>
        </button>
      </div>
    </Overlay>
  );
}

export function Actions({ c, onNote }: { c: CompanyCard; onNote?: (n: { id: number; body: string; createdAt: string }) => void }) {
  const a = useActions(c);
  return (
    <div className="acts">
      <button className="btn track" data-act="track" aria-pressed={a.tracked} onClick={a.track} title={a.tracked ? `Stop tracking ${c.name}` : `Track ${c.name}: a daily check of news, filings and shows, on its timeline`}>
        {a.tracked ? <Check className="ico" /> : <Pin className="ico" />}
        {a.tracked ? "Tracking" : "Track"}
      </button>
      <button className="btn" data-act="memo" onClick={a.memo} title="Draft Investment Memo: copies Courtside's eight-part outline filled with every fact Scout has, for your AI">
        <PenLine className="ico" />
        <span className="long">Draft Investment Memo</span>
        <span className="short">Memo</span>
      </button>
      <button className="btn" data-act="email" onClick={a.email} title="Connection Email: opens your mail app with a connection email filled in. Nothing is sent.">
        <Mail className="ico" />
        <span className="long">Connection Email</span>
        <span className="short">Email</span>
      </button>
      <button className="btn" data-act="crm" onClick={a.crm} title="Copy for CRM: copies a clean text block for your CRM">
        <Copy className="ico" />
        Copy for CRM
      </button>
      <button className="btn" data-act="csv" onClick={a.csv} title="Download CSV: one row for this company">
        <Download className="ico" />
        Download CSV
      </button>
      <button className="btn" data-act="note" onClick={() => a.setNoting(true)} title="Add Note: a note everyone on the team sees">
        <Plus className="ico" />
        Add Note
      </button>
      {a.noting && <NoteDialog c={c} close={() => a.setNoting(false)} onSaved={onNote} />}
    </div>
  );
}

/* ---------- the Dossier card ---------- */
export function Facts({ c }: { c: CompanyCard }) {
  return (
    <div className="facts">
      <span>
        Stage <b>{c.stageText}</b>
      </span>
      <span>
        Check Size <b className={c.check.tone === "ok" ? "ok" : c.check.tone === "warn" ? "warn" : ""}>{c.check.text}</b>
      </span>
      {c.portfolio && (
        <span>
          Portfolio{" "}
          <b className={c.portfolio.kind === "competes" ? "warn" : "amber"}>
            {c.portfolio.href ? (
              <a href={c.portfolio.href} target="_blank" rel="noopener noreferrer" title={`${c.portfolio.reason}. Opens ${c.portfolio.text.replace(/^(Adjacent to|Competes with) /, "")} on Courtside's site in a new window`}>
                {c.portfolio.text}
              </a>
            ) : (
              c.portfolio.text
            )}
          </b>
        </span>
      )}
      {c.lastSignal && (
        <span>
          Last Signal{" "}
          <b>
            <Ago date={c.lastSignal} ch={7} />
          </b>
        </span>
      )}
    </div>
  );
}

export function StatusPill({ s }: { s: string }) {
  return <span className={"status " + s}>{STATUS_LABEL[s] || s}</span>;
}

export function Dossier({ c, showRank = true }: { c: CompanyCard; showRank?: boolean }) {
  return (
    <article className="t1" data-item data-company={c.id}>
      <Gauge score={c.score} breakdown={c.breakdown} />
      <div className="t1-main" style={{ minWidth: 0 }}>
        <div className="lane">
          {c.domain && (
            <span className="clogo">
              <img src={favicon(c.domain)} alt="" width={18} height={18} />
            </span>
          )}
          {showRank && <span>#{c.rank} ·</span>}
          {c.area && <span>{c.area} ·</span>}
          {c.domain && (
            <a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer" title={`Opens ${c.domain} in a new window`}>
              {c.domain}
            </a>
          )}
          <StatusPill s={c.status} />
          {c.possible && <span className="tag gold">Possible match</span>}
        </div>
        <h3 className="cname">
          <Link href={`/company/${c.id}`} data-act="open" title={`Open ${c.name} in Scout`}>
            {c.name}
          </Link>
        </h3>
        {c.descSegs.length > 0 && (
          <p className="cdesc">
            <Rich segs={c.descSegs} />{" "}
            {c.descSource && !c.signals.some((s) => sigLabel(s).toLowerCase() === c.descSource!.label.toLowerCase()) && (
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
        {c.signals.length > 0 && (
          <div className="row">
            <span className="k">Signals</span>
            <Signals signals={c.signals} />
          </div>
        )}
        <div className="row">
          <Facts c={c} />
        </div>
      </div>
      <Vote k={`company:${c.id}`} initial={c.votes} name={c.name} />
      <Actions c={c} />
    </article>
  );
}
