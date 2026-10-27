"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Pin, PenLine, Mail, Copy, Download, Plus, Lock, Sparkles, Check } from "lucide-react";
import { useUI, Overlay, Kbd } from "./ui";
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

export function Vote({ k, initial = 0, row, upTitle = "This fits Courtside", downTitle = "Not for Courtside", name, v2 }: { k: string; initial?: number; row?: boolean; upTitle?: string; downTitle?: string; name?: string; v2?: boolean }) {
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
    const r = await ui.undoable("Vote", postJSON<{ count: number }>("/api/vote", { key: k, value: next }), undo);
    if (!r.ok) {
      store.mine[k] = before.m;
      store.counts[k] = before.c;
      emit();
      ui.error("Your vote didn't save", r.error || "The server did not answer. Try again in a moment.");
      return;
    }
    store.counts[k] = r.data!.count;
    emit();
  }
  if (v2)
    return (
      <span className="x-votes" data-vote={k}>
        <button type="button" className={"up" + (mine === 1 ? " on" : "")} data-act="up" aria-pressed={mine === 1} title={upTitle} aria-label={`${upTitle}${name ? `: ${name}` : ""}`} onClick={() => press(1)}>
          <svg className="x-ico fill" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 3l6 9H2z" />
          </svg>
        </button>
        <b data-testid="vote-count">{count}</b>
        <button type="button" className={"dn" + (mine === -1 ? " on" : "")} data-act="down" aria-pressed={mine === -1} title={downTitle} aria-label={`${downTitle}${name ? `: ${name}` : ""}`} onClick={() => press(-1)}>
          <svg className="x-ico fill" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 13L2 4h12z" />
          </svg>
        </button>
      </span>
    );
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

/* ---------- score parts ---------- */
export function partOf(b: Record<string, number>, k: string) {
  return k === "thesis" ? (b.thesis ?? b.laneFit ?? 0) : (b[k] ?? 0);
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
  const head = ["Organization", "Domain", "Description", "Thesis area", "Funds Raised", "Thesis Fit", "Source links", "Notes"];
  const desc = c.descSegs.map((s) => (typeof s === "string" ? s : s.t)).join("");
  const row = [c.name, c.domain || "", desc, c.area, c.funds.text, `${c.score}%`, c.signals.map((s) => s.url).join(" "), notes];
  return head.map(esc).join(",") + "\n" + row.map(esc).join(",") + "\n";
}
function crmText(c: CompanyCard) {
  const desc = c.descSegs.map((s) => (typeof s === "string" ? s : s.t)).join("");
  const why = c.whySegs.map((s) => (typeof s === "string" ? s : s.t)).join("");
  return [
    `${c.name}${c.domain ? ` (${c.domain})` : ""}`,
    `Thesis area: ${c.area} · Funds Raised: ${c.funds.text}${c.funds.stage ? ` (${c.funds.stage})` : ""} · Thesis fit: ${c.score}%`,
    `What it does: ${desc}`,
    `Why it fits Courtside: ${why}`,
    c.overlap ? `Overlaps with ${c.overlap.with}, a Courtside portfolio company (${c.overlap.reason})` : "",
    `Sources:`,
    ...c.signals.map((s) => `- ${s.title}: ${s.url}`),
    `Status: ${STATUS_LABEL[c.status]} · Scout: ${location.origin}/company/${c.id}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/* ---------- Not a Fit: a card the team hides leaves every list on the page at once, and comes back on Undo ---------- */
const gone = { ids: new Set<number>(), v: 0, subs: new Set<() => void>() };
function setGone(id: number, on: boolean) {
  if (on) gone.ids.add(id);
  else gone.ids.delete(id);
  gone.v++;
  gone.subs.forEach((f) => f());
}
const subGone = (f: () => void) => {
  gone.subs.add(f);
  return () => {
    gone.subs.delete(f);
  };
};
/** True once the team hid this company in this visit; false again after Undo. */
export function useGone(id: number) {
  return useSyncExternalStore(subGone, () => gone.ids.has(id), () => false);
}
/** The cards still showing: a hidden one leaves the list and the rest close up. */
export function useShown<T extends { id: number }>(cards: T[]): T[] {
  useSyncExternalStore(subGone, () => gone.v, () => 0);
  return cards.filter((c) => !gone.ids.has(c.id));
}

export function useActions(c: CompanyCard) {
  const ui = useUI();
  const [tracked, setTracked] = useState(c.tracked);
  const [noting, setNoting] = useState(false);
  const isGone = useGone(c.id);
  async function notFit() {
    setGone(c.id, true);
    const r = await ui.undoable("Not a Fit", postJSON("/api/hidden", { id: c.id, keep: false }), async () => {
      setGone(c.id, false);
      await postJSON("/api/hidden", { id: c.id, keep: null });
    });
    if (!r.ok) {
      setGone(c.id, false);
      ui.error(`Not a Fit didn't save for ${c.name}`, r.error || "The server did not answer.");
      return;
    }
    ui.toast(`${c.name} Hidden`);
  }
  async function track() {
    const next = !tracked;
    setTracked(next);
    const r = await ui.undoable("Track", postJSON("/api/track", { kind: "company", id: c.id, on: next }), async () => {
      setTracked(!next);
      await postJSON("/api/track", { kind: "company", id: c.id, on: !next });
    });
    if (!r.ok) {
      setTracked(!next);
      ui.error(`Track didn't save for ${c.name}`, r.error || "The server did not answer.");
      return;
    }
    ui.toast(`${c.name} ${next ? "Tracked" : "Untracked"}`);
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
  return { tracked, track, memo, email, crm, csv, noting, setNoting, gone: isGone, notFit };
}

export function NoteDialog({ c, close, onSaved }: { c: { id: number; name: string }; close: () => void; onSaved?: (n: { id: number; body: string; createdAt: string }) => void }) {
  const ui = useUI();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!text.trim() || busy) return;
    setBusy(true);
    const r = await ui.undoable("Note", postJSON<{ note: { id: number; body: string; createdAt: string } }>("/api/note", { companyId: c.id, body: text }), async (r) => {
      await fetch("/api/note", { method: "DELETE", body: JSON.stringify({ id: r.data!.note.id }) });
    });
    setBusy(false);
    if (!r.ok) return ui.error("The note didn't save", r.error || "The server did not answer.");
    ui.toast("Note Added");
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

export function StatusPill({ s }: { s: string }) {
  return <span className={"status " + s}>{STATUS_LABEL[s] || s}</span>;
}
